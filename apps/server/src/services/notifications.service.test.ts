import { vi, describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';

// Create in-memory test DB (hoisted so it's available in vi.mock factory)
const testDb = vi.hoisted(() => {
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, password_hash TEXT NOT NULL DEFAULT '', subscription_status TEXT NOT NULL DEFAULT 'trial', created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  db.exec(`INSERT INTO users (id, email) VALUES ('user-notif-001', 'test@example.com')`);
  db.exec(`INSERT INTO users (id, email) VALUES ('other-user', 'other@example.com')`);
  return db;
});

// Mock the db module before importing the service
vi.mock('../config/db', () => ({ default: testDb }));

// Mock alerts.service since syncNotifications depends on it and we don't test that here
vi.mock('./alerts.service', () => ({
  getAlerts: vi.fn(() => []),
}));

// Import service AFTER the mocks are set up
import { getNotifications, getUnreadCount, markRead, markAllRead } from './notifications.service';

const TEST_USER = 'user-notif-001';

function insertNotification(overrides: Partial<{
  id: string;
  user_id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  is_read: number;
  created_at: string;
}> = {}) {
  const row = {
    id: overrides.id ?? crypto.randomUUID(),
    user_id: overrides.user_id ?? TEST_USER,
    type: overrides.type ?? 'alert',
    severity: overrides.severity ?? 'info',
    title: overrides.title ?? 'Test notification',
    body: overrides.body ?? 'Test body',
    is_read: overrides.is_read ?? 0,
    created_at: overrides.created_at ?? new Date().toISOString(),
  };

  testDb.prepare(
    `INSERT INTO notifications (id, user_id, type, severity, title, body, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(row.id, row.user_id, row.type, row.severity, row.title, row.body, row.is_read, row.created_at);

  return row;
}

describe('notifications.service', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM notifications');
  });

  describe('getNotifications', () => {
    it('returns notifications for user', () => {
      insertNotification({ title: 'Alert 1' });
      insertNotification({ title: 'Alert 2' });
      insertNotification({ user_id: 'other-user', title: 'Not mine' });

      const results = getNotifications(TEST_USER);

      expect(results).toHaveLength(2);
      expect(results.map(n => n.title)).toContain('Alert 1');
      expect(results.map(n => n.title)).toContain('Alert 2');
      // Verify is_read is converted to boolean
      expect(typeof results[0].is_read).toBe('boolean');
      expect(results[0].is_read).toBe(false);
    });

    it('filters to unread only when requested', () => {
      insertNotification({ title: 'Unread', is_read: 0 });
      insertNotification({ title: 'Read', is_read: 1 });

      const unread = getNotifications(TEST_USER, { unreadOnly: true });
      expect(unread).toHaveLength(1);
      expect(unread[0].title).toBe('Unread');
    });
  });

  describe('getUnreadCount', () => {
    it('returns count of unread notifications', () => {
      insertNotification({ is_read: 0 });
      insertNotification({ is_read: 0 });
      insertNotification({ is_read: 1 });

      const count = getUnreadCount(TEST_USER);
      expect(count).toBe(2);
    });

    it('returns 0 when all are read', () => {
      insertNotification({ is_read: 1 });
      expect(getUnreadCount(TEST_USER)).toBe(0);
    });
  });

  describe('markRead', () => {
    it('marks a notification as read', () => {
      const notif = insertNotification({ is_read: 0 });

      markRead(TEST_USER, notif.id);

      const results = getNotifications(TEST_USER);
      const updated = results.find(n => n.id === notif.id);
      expect(updated?.is_read).toBe(true);
    });
  });

  describe('markAllRead', () => {
    it('marks all notifications as read for a user', () => {
      insertNotification({ is_read: 0 });
      insertNotification({ is_read: 0 });
      insertNotification({ is_read: 0 });

      markAllRead(TEST_USER);

      const count = getUnreadCount(TEST_USER);
      expect(count).toBe(0);

      const all = getNotifications(TEST_USER);
      expect(all.every(n => n.is_read === true)).toBe(true);
    });
  });
});
