import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import db from '../config/db';

// Block seed from running in production
if (process.env.NODE_ENV === 'production') {
  console.error('Seed script cannot run in production. Exiting.');
  process.exit(1);
}

// Ensure schema exists
const schema = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

const hash = bcrypt.hashSync('demo1234', 10);
const userId = crypto.randomUUID();

// Create demo user (local dev only)
db.prepare(
  `INSERT OR REPLACE INTO users (id, email, password_hash, pay_frequency, next_payday, take_home_pay)
   VALUES (?, ?, ?, 'biweekly', date('now', '+6 days'), 2800)`
).run(userId, 'demo@spenditure.co', hash);

// Create accounts
const checkingId = crypto.randomUUID();
const savingsId = crypto.randomUUID();
const creditId = crypto.randomUUID();

db.prepare(
  `INSERT INTO accounts (id, user_id, name, type, current_balance, available_balance)
   VALUES (?, ?, 'Main Checking', 'checking', 3240.50, 3240.50)`
).run(checkingId, userId);

db.prepare(
  `INSERT INTO accounts (id, user_id, name, type, current_balance, available_balance)
   VALUES (?, ?, 'Savings', 'savings', 1500.00, 1500.00)`
).run(savingsId, userId);

db.prepare(
  `INSERT INTO accounts (id, user_id, name, type, current_balance)
   VALUES (?, ?, 'Discover Card', 'credit', 2340.00)`
).run(creditId, userId);

// Sample transactions
const txns: [number, string, string, boolean][] = [
  [-85.40, 'Whole Foods', 'Groceries', false],
  [-12.99, 'Netflix', 'Entertainment', true],
  [-45.00, 'Shell Gas', 'Transportation', false],
  [-67.30, 'Target', 'Shopping', false],
  [-23.50, 'Chipotle', 'Restaurants', false],
  [-142.00, 'Electric Company', 'Utilities', false],
  [-1200.00, 'Rent Payment', 'Housing', false],
  [-34.99, 'Spotify + Hulu', 'Entertainment', true],
  [-52.80, 'Kroger', 'Groceries', false],
  [-18.00, 'Uber', 'Transportation', false],
];

const insertTxn = db.prepare(
  `INSERT INTO transactions (id, user_id, account_id, amount, date, merchant_name, category, is_recurring)
   VALUES (?, ?, ?, ?, date('now', ? || ' days'), ?, ?, ?)`
);

for (let i = 0; i < txns.length; i++) {
  const dayOffset = -Math.floor(i * 2.5);
  insertTxn.run(
    crypto.randomUUID(), userId, checkingId,
    txns[i][0], String(dayOffset), txns[i][1], txns[i][2], txns[i][3] ? 1 : 0
  );
}

// Incoming events
const insertEvent = db.prepare(
  `INSERT INTO incoming_events (id, user_id, name, estimated_amount, expected_date, is_recurring)
   VALUES (?, ?, ?, ?, ?, ?)`
);
insertEvent.run(crypto.randomUUID(), userId, 'Lawyer Payment', 5000, null, 0);
insertEvent.run(crypto.randomUUID(), userId, 'Christmas Shopping', 800, '2026-12-25', 0);
insertEvent.run(crypto.randomUUID(), userId, 'Summer Vacation', 2000, '2026-07-15', 0);

// Budgets
const insertBudget = db.prepare(
  `INSERT INTO budgets (id, user_id, category, monthly_limit) VALUES (?, ?, ?, ?)`
);
insertBudget.run(crypto.randomUUID(), userId, 'Groceries', 400);
insertBudget.run(crypto.randomUUID(), userId, 'Restaurants', 200);
insertBudget.run(crypto.randomUUID(), userId, 'Entertainment', 100);
insertBudget.run(crypto.randomUUID(), userId, 'Transportation', 150);

console.log('Seed data inserted successfully');
console.log('Demo login: demo@runway.app / demo1234');
db.close();
