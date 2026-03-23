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
     AND created_at > datetime('now', '-1 day')`
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
