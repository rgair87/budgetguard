import type PgBoss from 'pg-boss';
import { logger } from '../utils/logger.js';
import { query } from '../config/database.js';

interface AlertJobData {
  // No specific data needed, runs on schedule
}

export async function handleSendAlerts(_job: PgBoss.Job<AlertJobData>) {
  logger.info('Starting subscription alert job');

  try {
    // Find all unclassified subscriptions with users who need alerts
    const result = await query(
      `SELECT
        s.id as subscription_id,
        s.user_id,
        s.merchant_name,
        s.estimated_amount,
        s.frequency,
        u.expo_push_token,
        u.notification_preferences,
        n.id as notification_id,
        n.alert_repeat_count
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN notifications n ON n.related_entity_id = s.id
        AND n.type = 'new_subscription'
        AND n.alert_resolved = FALSE
      WHERE s.status = 'detected'
        AND s.classified_at IS NULL`
    );

    let alertsSent = 0;

    for (const row of result.rows) {
      const prefs = row.notification_preferences || {};
      if (!prefs.push_enabled && !prefs.email_enabled) continue;

      const title = 'New subscription detected';
      const body = `Recurring charge to ${row.merchant_name} for ~$${parseFloat(row.estimated_amount).toFixed(2)}/${row.frequency}. Tap to keep or cancel.`;

      if (row.notification_id) {
        // Update existing notification
        await query(
          `UPDATE notifications SET
            alert_repeat_count = alert_repeat_count + 1,
            next_alert_at = NOW() + INTERVAL '12 hours',
            updated_at = NOW()
          WHERE id = $1`,
          [row.notification_id]
        );
      } else {
        // Create new notification
        await query(
          `INSERT INTO notifications (
            user_id, type, title, body, action_url,
            related_entity_type, related_entity_id,
            next_alert_at, alert_repeat_count
          ) VALUES ($1, 'new_subscription', $2, $3, $4, 'subscription', $5, NOW() + INTERVAL '12 hours', 1)`,
          [
            row.user_id,
            title,
            body,
            `/subscriptions/${row.subscription_id}`,
            row.subscription_id,
          ]
        );
      }

      // TODO: Send push notification via expo-server-sdk if expo_push_token exists
      // TODO: Send email via Resend if email_enabled

      alertsSent++;
    }

    logger.info({ alertsSent }, 'Subscription alerts completed');
  } catch (error) {
    logger.error(error, 'Subscription alert job failed');
    throw error;
  }
}
