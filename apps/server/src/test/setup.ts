import { vi, beforeEach, afterAll } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

// Create in-memory test database
export const testDb = new DatabaseSync(':memory:');
testDb.exec('PRAGMA foreign_keys = ON');

testDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    subscription_status TEXT NOT NULL DEFAULT 'trial',
    pay_frequency TEXT,
    next_payday TEXT,
    take_home_pay REAL,
    plaid_access_token TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    verification_token TEXT,
    reset_token TEXT,
    reset_token_expires TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
  CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
`);

// Mock the db module to use our in-memory test database
vi.mock('../config/db', () => ({
  default: testDb,
}));

// Mock the env module so it doesn't require real environment variables
vi.mock('../config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-key-for-testing',
    PORT: 3001,
    CORS_ORIGINS: 'http://localhost:5173',
    ANTHROPIC_API_KEY: 'test-key',
    PLAID_CLIENT_ID: 'test-plaid-id',
    PLAID_SECRET: 'test-plaid-secret',
    PLAID_ENV: 'sandbox',
  },
}));

// Clean tables between tests
beforeEach(() => {
  testDb.exec('DELETE FROM refresh_tokens');
  testDb.exec('DELETE FROM users');
});

afterAll(() => {
  testDb.close();
});
