import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { Resend } from 'resend';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type PgBoss from 'pg-boss';

const expo = new Expo();
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

let boss: PgBoss | null = null;

export function setBoss(pgBoss: PgBoss) {
  boss = pgBoss;
}

export async function getAll(
  userId: string,
  options: { page?: number; limit?: number } = {}
) {
  const { page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM notifications
     WHERE user_id = $1 AND dismissed_at IS NULL`,
    [userId]
  );

  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    `SELECT
       id, user_id, type, title, body,
       read_at, dismissed_at,
       related_entity_type, related_entity_id,
       action_url, channels,
       created_at
     FROM notifications
     WHERE user_id = $1 AND dismissed_at IS NULL
     ORDER BY read_at ASC NULLS FIRST, created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  // Get unread count
  const unreadResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM notifications
     WHERE user_id = $1 AND read_at IS NULL AND dismissed_at IS NULL`,
    [userId]
  );

  return {
    notifications: result.rows,
    unreadCount: parseInt(unreadResult.rows[0].count, 10),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function markRead(userId: string, id: string) {
  const result = await query(
    `UPDATE notifications
     SET read_at = NOW()
     WHERE id = $1 AND user_id = $2 AND read_at IS NULL
     RETURNING id`,
    [id, userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Notification not found or already read');
  }

  return { success: true };
}

export async function markAllRead(userId: string) {
  const result = await query(
    `UPDATE notifications
     SET read_at = NOW()
     WHERE user_id = $1 AND read_at IS NULL AND dismissed_at IS NULL`,
    [userId]
  );

  return { updated: result.rowCount || 0 };
}

export async function dismiss(userId: string, id: string) {
  const result = await query(
    `UPDATE notifications
     SET dismissed_at = NOW()
     WHERE id = $1 AND user_id = $2 AND dismissed_at IS NULL
     RETURNING id`,
    [id, userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Notification not found or already dismissed');
  }

  return { success: true };
}

export async function updateSettings(
  userId: string,
  preferences: {
    push_enabled?: boolean;
    email_enabled?: boolean;
    subscription_alerts?: boolean;
    budget_alerts?: boolean;
    weekly_summary?: boolean;
  }
) {
  const result = await query(
    `UPDATE users
     SET notification_preferences = notification_preferences || $1::jsonb,
         updated_at = NOW()
     WHERE id = $2
     RETURNING notification_preferences`,
    [JSON.stringify(preferences), userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  return result.rows[0].notification_preferences;
}

export async function send(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  channels?: ('push' | 'email')[];
  relatedEntity?: { type: string; id: string };
  actionUrl?: string;
}) {
  const {
    userId,
    type,
    title,
    body,
    channels = ['push'],
    relatedEntity,
    actionUrl,
  } = params;

  // Create notification record
  const result = await query<{ id: string }>(
    `INSERT INTO notifications (
       user_id, type, title, body,
       related_entity_type, related_entity_id,
       action_url, channels
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      userId,
      type,
      title,
      body,
      relatedEntity?.type || null,
      relatedEntity?.id || null,
      actionUrl || null,
      JSON.stringify(channels),
    ]
  );

  const notificationId = result.rows[0].id;

  // Enqueue delivery jobs for each channel
  if (boss) {
    for (const channel of channels) {
      if (channel === 'push') {
        await boss.send('deliver-push', {
          notificationId,
          userId,
          title,
          body,
          actionUrl,
        });
      } else if (channel === 'email') {
        await boss.send('deliver-email', {
          notificationId,
          userId,
          title,
          body,
          actionUrl,
        });
      }
    }
  }

  logger.info(
    { userId, notificationId, type, channels },
    'Notification created and delivery enqueued'
  );

  return { notificationId };
}

// -----------------------------------------------------------------------
// Push notification delivery (called by job worker)
// -----------------------------------------------------------------------

export async function deliverPush(params: {
  userId: string;
  title: string;
  body: string;
  actionUrl?: string;
}) {
  const { userId, title, body, actionUrl } = params;

  // Get user's push tokens
  const tokenResult = await query<{ push_token: string }>(
    'SELECT push_token FROM push_tokens WHERE user_id = $1',
    [userId]
  );

  if (tokenResult.rows.length === 0) {
    logger.debug({ userId }, 'No push tokens found for user, skipping push delivery');
    return;
  }

  const messages: ExpoPushMessage[] = [];

  for (const row of tokenResult.rows) {
    if (!Expo.isExpoPushToken(row.push_token)) {
      logger.warn({ token: row.push_token }, 'Invalid Expo push token');
      continue;
    }

    messages.push({
      to: row.push_token,
      sound: 'default',
      title,
      body,
      data: actionUrl ? { url: actionUrl } : undefined,
    });
  }

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      logger.debug({ userId, tickets: ticketChunk.length }, 'Push notifications sent');
    } catch (error) {
      logger.error({ userId, error }, 'Failed to send push notification chunk');
    }
  }
}

// -----------------------------------------------------------------------
// Email delivery (called by job worker)
// -----------------------------------------------------------------------

export async function deliverEmail(params: {
  userId: string;
  title: string;
  body: string;
  actionUrl?: string;
}) {
  if (!resend) {
    logger.debug('Resend not configured, skipping email delivery');
    return;
  }

  const { userId, title, body, actionUrl } = params;

  // Get user email and notification preferences
  const userResult = await query<{
    email: string;
    notification_preferences: { email_enabled?: boolean } | null;
  }>(
    'SELECT email, notification_preferences FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) return;

  const user = userResult.rows[0];

  // Check if email notifications are enabled
  if (user.notification_preferences?.email_enabled === false) {
    logger.debug({ userId }, 'Email notifications disabled for user');
    return;
  }

  try {
    await resend.emails.send({
      from: env.FROM_EMAIL,
      to: user.email,
      subject: title,
      html: buildEmailHtml(title, body, actionUrl),
    });

    logger.info({ userId, email: user.email }, 'Email notification sent');
  } catch (error) {
    logger.error({ userId, error }, 'Failed to send email notification');
  }
}

// -----------------------------------------------------------------------
// 2x daily subscription alert job
// -----------------------------------------------------------------------

export async function sendSubscriptionAlerts() {
  // Query all unclassified subscriptions (status = 'detected')
  const result = await query<{
    user_id: string;
    subscription_id: string;
    merchant_name: string;
    estimated_amount: string;
    frequency: string;
  }>(
    `SELECT
       s.user_id, s.id AS subscription_id,
       s.merchant_name, s.estimated_amount, s.frequency
     FROM subscriptions s
     WHERE s.status = 'detected'
       AND s.classified_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.related_entity_type = 'subscription'
           AND n.related_entity_id = s.id
           AND n.created_at > NOW() - INTERVAL '12 hours'
       )`
  );

  let alertsSent = 0;

  for (const row of result.rows) {
    await send({
      userId: row.user_id,
      type: 'subscription_alert',
      title: `Review: ${row.merchant_name}`,
      body: `You have an unreviewed subscription to ${row.merchant_name} ($${parseFloat(row.estimated_amount).toFixed(2)}/${row.frequency}). Keep it, cancel it, or add it to your safe list.`,
      channels: ['push', 'email'],
      relatedEntity: { type: 'subscription', id: row.subscription_id },
      actionUrl: `/subscriptions/${row.subscription_id}`,
    });

    alertsSent++;
  }

  logger.info({ alertsSent }, 'Subscription alerts sent');

  return { alertsSent };
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function buildEmailHtml(title: string, body: string, actionUrl?: string): string {
  const ctaButton = actionUrl
    ? `<a href="${env.WEB_URL}${actionUrl}" style="display:inline-block;padding:12px 24px;background-color:#4F46E5;color:#ffffff;text-decoration:none;border-radius:6px;margin-top:16px;">View Details</a>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <div style="border-bottom:3px solid #4F46E5;padding-bottom:16px;margin-bottom:24px;">
    <h1 style="margin:0;font-size:24px;color:#4F46E5;">BudgetGuard</h1>
  </div>
  <h2 style="font-size:20px;margin-bottom:8px;">${escapeHtml(title)}</h2>
  <p style="font-size:16px;line-height:1.5;color:#4b5563;">${escapeHtml(body)}</p>
  ${ctaButton}
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
    <p>You received this email because you have notifications enabled on BudgetGuard.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
