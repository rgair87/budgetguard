import { vi, describe, it, expect, beforeEach } from 'vitest';

// Create in-memory test DB (hoisted so it's available in vi.mock factory)
const testDb = vi.hoisted(() => {
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, password_hash TEXT NOT NULL DEFAULT '', subscription_status TEXT NOT NULL DEFAULT 'trial', created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  db.exec(`INSERT INTO users (id, email) VALUES ('user-test-001', 'test@example.com')`);
  db.exec(`INSERT INTO users (id, email) VALUES ('other-user', 'other@example.com')`);
  return db;
});

// Mock the db module before importing the service
vi.mock('../config/db', () => ({ default: testDb }));

// Import service AFTER the mock is set up
import { createGoal, getGoals, updateGoal, deleteGoal, addToGoal, NotFoundError } from './goals.service';

// The service creates the savings_goals table at import via db.exec,
// but we also need the users table for foreign key references if enabled.
// Since this is in-memory and FK constraints aren't enabled by default, the
// service's own CREATE TABLE IF NOT EXISTS runs on our testDb at import time.

const TEST_USER = 'user-test-001';

describe('goals.service', () => {
  beforeEach(() => {
    // Clean the table between tests
    testDb.exec('DELETE FROM savings_goals');
  });

  describe('createGoal', () => {
    it('creates a goal and returns enriched data', () => {
      const goal = createGoal(TEST_USER, {
        name: 'Emergency Fund',
        target_amount: 5000,
        current_amount: 1000,
      });

      expect(goal.name).toBe('Emergency Fund');
      expect(goal.target_amount).toBe(5000);
      expect(goal.current_amount).toBe(1000);
      expect(goal.percent).toBe(20);
      expect(goal.remaining).toBe(4000);
      expect(goal.id).toBeDefined();
      expect(goal.icon).toBe('\u{1F3AF}'); // default icon
    });
  });

  describe('getGoals', () => {
    it('returns all goals for a user', () => {
      createGoal(TEST_USER, { name: 'Goal A', target_amount: 1000 });
      createGoal(TEST_USER, { name: 'Goal B', target_amount: 2000 });
      createGoal('other-user', { name: 'Goal C', target_amount: 3000 });

      const goals = getGoals(TEST_USER);
      expect(goals).toHaveLength(2);
      expect(goals.map(g => g.name)).toContain('Goal A');
      expect(goals.map(g => g.name)).toContain('Goal B');
    });
  });

  describe('updateGoal', () => {
    it('updates goal fields', () => {
      const goal = createGoal(TEST_USER, {
        name: 'Vacation',
        target_amount: 3000,
      });

      const updated = updateGoal(TEST_USER, goal.id, {
        name: 'Beach Vacation',
        target_amount: 4000,
        current_amount: 500,
      });

      expect(updated.name).toBe('Beach Vacation');
      expect(updated.target_amount).toBe(4000);
      expect(updated.current_amount).toBe(500);
      expect(updated.percent).toBe(13); // 500/4000 = 12.5 -> 13 rounded
      expect(updated.remaining).toBe(3500);
    });
  });

  describe('deleteGoal', () => {
    it('removes a goal', () => {
      const goal = createGoal(TEST_USER, {
        name: 'Temp Goal',
        target_amount: 100,
      });

      deleteGoal(TEST_USER, goal.id);

      const goals = getGoals(TEST_USER);
      expect(goals).toHaveLength(0);
    });

    it('throws NotFoundError for non-existent goal', () => {
      expect(() => deleteGoal(TEST_USER, 'fake-id')).toThrow(NotFoundError);
    });
  });

  describe('addToGoal', () => {
    it('increases current_amount', () => {
      const goal = createGoal(TEST_USER, {
        name: 'Save Up',
        target_amount: 1000,
        current_amount: 200,
      });

      const updated = addToGoal(TEST_USER, goal.id, 350);

      expect(updated.current_amount).toBe(550);
      expect(updated.remaining).toBe(450);
      expect(updated.percent).toBe(55);
    });

    it('throws NotFoundError for non-existent goal', () => {
      expect(() => addToGoal(TEST_USER, 'no-such-goal', 100)).toThrow(NotFoundError);
    });
  });
});
