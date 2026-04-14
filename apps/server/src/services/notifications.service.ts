import crypto from 'crypto';
import db from '../config/db';
import { getAlerts, Alert } from './alerts.service';

// Create table at module load
db.exec(`CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action TEXT,
  action_link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info' | 'win';
  title: string;
  body: string;
  action: string | null;
  action_link: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  action: string | null;
  action_link: string | null;
  is_read: number;
  created_at: string;
}

function rowToNotification(row: NotificationRow): Notification {
  return {
    ...row,
    severity: row.severity as Notification['severity'],
    is_read: row.is_read === 1,
  };
}

export function syncNotifications(userId: string): void {
  const alerts = getAlerts(userId);

  const checkStmt = db.prepare(
    `SELECT COUNT(*) as cnt FROM notifications
     WHERE user_id = ? AND type = ? AND title = ?
     AND created_at > datetime('now', '-7 days')`
  );

  const insertStmt = db.prepare(
    `INSERT INTO notifications (id, user_id, type, severity, title, body, action, action_link)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const alert of alerts) {
    const existing = checkStmt.get(userId, alert.type, alert.title) as { cnt: number };
    if (existing.cnt === 0) {
      insertStmt.run(
        crypto.randomUUID(),
        userId,
        alert.type,
        alert.severity,
        alert.title,
        alert.body,
        alert.action ?? null,
        alert.actionLink ?? null,
      );
    }
  }

  // Trial-phase strategic notifications
  const user = db.prepare(
    "SELECT subscription_status, created_at FROM users WHERE id = ?"
  ).get(userId) as { subscription_status: string; created_at: string } | undefined;

  if (user && user.subscription_status === 'trial') {
    const daysSinceSignup = Math.floor(
      (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    const trialNotifications: Array<{ day: number; type: string; title: string; body: string; action: string; link: string }> = [
      {
        day: 3,
        type: 'trial_day3',
        title: 'Your AI Advisor has insights ready',
        body: 'We\'ve analyzed your spending patterns. Check your personalized financial health score and recommendations.',
        action: 'View Advisor',
        link: '/advisor',
      },
      {
        day: 5,
        type: 'trial_day5',
        title: 'Your trial is halfway done',
        body: 'You\'ve been building great financial habits. Lock in Plus ($7.99/mo) to keep AI insights, bank sync, and more.',
        action: 'View plans',
        link: '/pricing',
      },
      {
        day: 7,
        type: 'trial_day7',
        title: 'Your trial ends today',
        body: 'After today, you\'ll lose access to AI Advisor, bank sync, spending trends, and 50 daily chat messages. Subscribe to keep going.',
        action: 'View plans',
        link: '/pricing',
      },
      {
        day: 10,
        type: 'trial_day10',
        title: 'Your data is still here',
        body: 'Pick up where you left off. Your transactions, goals, and insights are waiting. Reactivate to access everything.',
        action: 'View plans',
        link: '/pricing',
      },
    ];

    // Send trial expired email once (day 8)
    if (daysSinceSignup === 8) {
      const alreadySent = checkStmt.get(userId, 'trial_expired_email', 'Trial expired email') as { cnt: number };
      if (alreadySent.cnt === 0) {
        try {
          const { sendTrialExpiredEmail } = require('./email.service');
          const emailRow = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
          if (emailRow) {
            sendTrialExpiredEmail(emailRow.email);
            insertStmt.run(crypto.randomUUID(), userId, 'trial_expired_email', 'info', 'Trial expired email', 'Sent', null, null);
          }
        } catch {}
      }
    }

    for (const notif of trialNotifications) {
      if (daysSinceSignup >= notif.day) {
        const existing = checkStmt.get(userId, notif.type, notif.title) as { cnt: number };
        if (existing.cnt === 0) {
          insertStmt.run(
            crypto.randomUUID(), userId, notif.type,
            notif.day >= 7 ? 'warning' : 'info',
            notif.title, notif.body, notif.action, notif.link,
          );
        }
      }
    }
  }
}

export function getNotifications(
  userId: string,
  opts?: { unreadOnly?: boolean; limit?: number },
): Notification[] {
  const limit = opts?.limit ?? 50;

  if (opts?.unreadOnly) {
    const rows = db.prepare(
      `SELECT * FROM notifications
       WHERE user_id = ? AND is_read = 0
       ORDER BY created_at DESC LIMIT ?`
    ).all(userId, limit) as unknown as NotificationRow[];
    return rows.map(rowToNotification);
  }

  const rows = db.prepare(
    `SELECT * FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ?`
  ).all(userId, limit) as unknown as NotificationRow[];
  return rows.map(rowToNotification);
}

export function getUnreadCount(userId: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0`
  ).get(userId) as { cnt: number };
  return row.cnt;
}

export function markRead(userId: string, notificationId: string): void {
  db.prepare(
    `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`
  ).run(notificationId, userId);
}

export function markAllRead(userId: string): void {
  db.prepare(
    `UPDATE notifications SET is_read = 1 WHERE user_id = ?`
  ).run(userId);
}

export function clearOld(userId: string, daysOld: number = 30): void {
  db.prepare(
    `DELETE FROM notifications WHERE user_id = ? AND created_at < datetime('now', '-' || ? || ' days')`
  ).run(userId, daysOld);
}
