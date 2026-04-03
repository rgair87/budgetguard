import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../../runway.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Run full schema on startup (all CREATE TABLE IF NOT EXISTS — safe to repeat)
const schemaPath = path.resolve(__dirname, '../db/schema.sql');
if (fs.existsSync(schemaPath)) {
  db.exec(fs.readFileSync(schemaPath, 'utf-8'));
}

// Migrations — safe to run repeatedly
try { db.exec("ALTER TABLE accounts ADD COLUMN purpose TEXT DEFAULT 'general'"); } catch {}
try { db.exec("ALTER TABLE accounts ADD COLUMN income_allocation REAL"); } catch {}
try { db.exec("ALTER TABLE accounts ADD COLUMN interest_rate REAL"); } catch {}
try { db.exec("ALTER TABLE accounts ADD COLUMN minimum_payment REAL"); } catch {}

// Email verification & password reset columns
try { db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN verification_token TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN reset_token TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN reset_token_expires TEXT"); } catch {}

// Migration: Plaid → Teller (add teller columns alongside plaid for backwards compat)
try { db.exec("ALTER TABLE users ADD COLUMN teller_access_token TEXT"); } catch {}
try { db.exec("ALTER TABLE accounts ADD COLUMN teller_account_id TEXT"); } catch {}
try { db.exec("ALTER TABLE accounts ADD COLUMN teller_access_token TEXT"); } catch {}
try { db.exec("ALTER TABLE accounts ADD COLUMN institution_name TEXT"); } catch {}
// Create unique index for teller upserts (can't use UNIQUE constraint in ALTER TABLE)
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_user_teller ON accounts(user_id, teller_account_id)"); } catch {}

// Refresh tokens table
db.exec(`CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

// Fixed expenses (user-entered bills from CSV template)
db.exec(`CREATE TABLE IF NOT EXISTS fixed_expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

// Merchant → category mapping (user-confirmed classifications)
db.exec(`CREATE TABLE IF NOT EXISTS merchant_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  is_bill INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, merchant_pattern)
)`);

// Migration: add hide_recurring to merchant_categories
try { db.exec("ALTER TABLE merchant_categories ADD COLUMN hide_recurring INTEGER NOT NULL DEFAULT 0"); } catch {}

// Cache table for AI results
db.exec(`CREATE TABLE IF NOT EXISTS ai_cache (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, cache_key)
)`);

// Family plan tables
db.exec(`CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'My Family',
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  invite_token TEXT,
  invited_at TEXT NOT NULL DEFAULT (datetime('now')),
  joined_at TEXT
)`);

// Feature usage analytics
db.exec(`CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'view',
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
db.exec("CREATE INDEX IF NOT EXISTS idx_analytics_feature ON analytics_events(feature, created_at)");
db.exec("CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id, created_at)");

export default db;
