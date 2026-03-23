import crypto from 'crypto';
import db from '../config/db';

// Realistic demo transactions spanning 90 days
const DEMO_TRANSACTIONS: { amount: number; merchant: string; category: string; isRecurring: boolean; dayOffset: number }[] = [
  // Recurring bills
  { amount: -1450, merchant: 'Rent Payment', category: 'Housing', isRecurring: true, dayOffset: -2 },
  { amount: -1450, merchant: 'Rent Payment', category: 'Housing', isRecurring: true, dayOffset: -32 },
  { amount: -1450, merchant: 'Rent Payment', category: 'Housing', isRecurring: true, dayOffset: -62 },
  { amount: -148, merchant: 'GEICO Auto Insurance', category: 'Insurance', isRecurring: true, dayOffset: -5 },
  { amount: -148, merchant: 'GEICO Auto Insurance', category: 'Insurance', isRecurring: true, dayOffset: -35 },
  { amount: -148, merchant: 'GEICO Auto Insurance', category: 'Insurance', isRecurring: true, dayOffset: -65 },
  { amount: -135, merchant: 'Electric Company', category: 'Utilities', isRecurring: true, dayOffset: -8 },
  { amount: -142, merchant: 'Electric Company', category: 'Utilities', isRecurring: true, dayOffset: -38 },
  { amount: -128, merchant: 'Electric Company', category: 'Utilities', isRecurring: true, dayOffset: -68 },
  { amount: -85, merchant: 'AT&T Wireless', category: 'Phone', isRecurring: true, dayOffset: -10 },
  { amount: -85, merchant: 'AT&T Wireless', category: 'Phone', isRecurring: true, dayOffset: -40 },
  { amount: -85, merchant: 'AT&T Wireless', category: 'Phone', isRecurring: true, dayOffset: -70 },
  { amount: -60, merchant: 'Spectrum Internet', category: 'Internet', isRecurring: true, dayOffset: -12 },
  { amount: -60, merchant: 'Spectrum Internet', category: 'Internet', isRecurring: true, dayOffset: -42 },
  { amount: -15.99, merchant: 'Netflix', category: 'Entertainment', isRecurring: true, dayOffset: -3 },
  { amount: -15.99, merchant: 'Netflix', category: 'Entertainment', isRecurring: true, dayOffset: -33 },
  { amount: -15.99, merchant: 'Netflix', category: 'Entertainment', isRecurring: true, dayOffset: -63 },
  { amount: -10.99, merchant: 'Spotify', category: 'Entertainment', isRecurring: true, dayOffset: -7 },
  { amount: -10.99, merchant: 'Spotify', category: 'Entertainment', isRecurring: true, dayOffset: -37 },
  { amount: -39.99, merchant: 'Planet Fitness', category: 'Healthcare', isRecurring: true, dayOffset: -15 },
  { amount: -39.99, merchant: 'Planet Fitness', category: 'Healthcare', isRecurring: true, dayOffset: -45 },
  // Groceries
  { amount: -92.40, merchant: 'Whole Foods', category: 'Groceries', isRecurring: false, dayOffset: -1 },
  { amount: -67.30, merchant: 'Kroger', category: 'Groceries', isRecurring: false, dayOffset: -4 },
  { amount: -45.20, merchant: 'Trader Joe\'s', category: 'Groceries', isRecurring: false, dayOffset: -9 },
  { amount: -112.80, merchant: 'Costco', category: 'Groceries', isRecurring: false, dayOffset: -14 },
  { amount: -78.60, merchant: 'Whole Foods', category: 'Groceries', isRecurring: false, dayOffset: -18 },
  { amount: -54.30, merchant: 'Kroger', category: 'Groceries', isRecurring: false, dayOffset: -22 },
  { amount: -88.90, merchant: 'Whole Foods', category: 'Groceries', isRecurring: false, dayOffset: -28 },
  { amount: -62.10, merchant: 'Kroger', category: 'Groceries', isRecurring: false, dayOffset: -34 },
  { amount: -95.50, merchant: 'Costco', category: 'Groceries', isRecurring: false, dayOffset: -44 },
  { amount: -71.20, merchant: 'Trader Joe\'s', category: 'Groceries', isRecurring: false, dayOffset: -52 },
  { amount: -83.40, merchant: 'Whole Foods', category: 'Groceries', isRecurring: false, dayOffset: -58 },
  { amount: -66.80, merchant: 'Kroger', category: 'Groceries', isRecurring: false, dayOffset: -66 },
  // Dining out
  { amount: -23.50, merchant: 'Chipotle', category: 'Restaurants', isRecurring: false, dayOffset: -2 },
  { amount: -42.80, merchant: 'Olive Garden', category: 'Restaurants', isRecurring: false, dayOffset: -6 },
  { amount: -18.40, merchant: 'Panera Bread', category: 'Restaurants', isRecurring: false, dayOffset: -11 },
  { amount: -56.70, merchant: 'Cheesecake Factory', category: 'Restaurants', isRecurring: false, dayOffset: -16 },
  { amount: -31.20, merchant: 'Chipotle', category: 'Restaurants', isRecurring: false, dayOffset: -20 },
  { amount: -14.80, merchant: 'Starbucks', category: 'Restaurants', isRecurring: false, dayOffset: -23 },
  { amount: -28.90, merchant: 'Taco Bell', category: 'Restaurants', isRecurring: false, dayOffset: -27 },
  { amount: -65.40, merchant: 'DoorDash', category: 'Restaurants', isRecurring: false, dayOffset: -31 },
  { amount: -19.50, merchant: 'Starbucks', category: 'Restaurants', isRecurring: false, dayOffset: -36 },
  { amount: -47.20, merchant: 'DoorDash', category: 'Restaurants', isRecurring: false, dayOffset: -41 },
  { amount: -22.30, merchant: 'Chipotle', category: 'Restaurants', isRecurring: false, dayOffset: -50 },
  { amount: -35.60, merchant: 'DoorDash', category: 'Restaurants', isRecurring: false, dayOffset: -55 },
  // Gas
  { amount: -48.50, merchant: 'Shell Gas', category: 'Transportation', isRecurring: false, dayOffset: -3 },
  { amount: -52.30, merchant: 'Chevron', category: 'Transportation', isRecurring: false, dayOffset: -17 },
  { amount: -45.80, merchant: 'Shell Gas', category: 'Transportation', isRecurring: false, dayOffset: -31 },
  { amount: -50.20, merchant: 'Shell Gas', category: 'Transportation', isRecurring: false, dayOffset: -48 },
  { amount: -47.60, merchant: 'Chevron', category: 'Transportation', isRecurring: false, dayOffset: -62 },
  // Shopping
  { amount: -89.99, merchant: 'Amazon', category: 'Shopping', isRecurring: false, dayOffset: -5 },
  { amount: -34.50, merchant: 'Target', category: 'Shopping', isRecurring: false, dayOffset: -13 },
  { amount: -129.00, merchant: 'Amazon', category: 'Shopping', isRecurring: false, dayOffset: -25 },
  { amount: -42.30, merchant: 'Target', category: 'Shopping', isRecurring: false, dayOffset: -39 },
  { amount: -67.80, merchant: 'Amazon', category: 'Shopping', isRecurring: false, dayOffset: -56 },
  // Income
  { amount: 2800, merchant: 'EMPLOYER DIRECT DEP', category: 'Income', isRecurring: false, dayOffset: -6 },
  { amount: 2800, merchant: 'EMPLOYER DIRECT DEP', category: 'Income', isRecurring: false, dayOffset: -20 },
  { amount: 2800, merchant: 'EMPLOYER DIRECT DEP', category: 'Income', isRecurring: false, dayOffset: -34 },
  { amount: 2800, merchant: 'EMPLOYER DIRECT DEP', category: 'Income', isRecurring: false, dayOffset: -48 },
  { amount: 2800, merchant: 'EMPLOYER DIRECT DEP', category: 'Income', isRecurring: false, dayOffset: -62 },
  { amount: 2800, merchant: 'EMPLOYER DIRECT DEP', category: 'Income', isRecurring: false, dayOffset: -76 },
  // Debt payments
  { amount: -130, merchant: 'Chase Visa PYMT', category: 'Debt Payments', isRecurring: true, dayOffset: -10 },
  { amount: -130, merchant: 'Chase Visa PYMT', category: 'Debt Payments', isRecurring: true, dayOffset: -40 },
  { amount: -130, merchant: 'Chase Visa PYMT', category: 'Debt Payments', isRecurring: true, dayOffset: -70 },
  { amount: -350, merchant: 'Auto Loan PYMT', category: 'Debt Payments', isRecurring: true, dayOffset: -12 },
  { amount: -350, merchant: 'Auto Loan PYMT', category: 'Debt Payments', isRecurring: true, dayOffset: -42 },
  { amount: -350, merchant: 'Auto Loan PYMT', category: 'Debt Payments', isRecurring: true, dayOffset: -72 },
];

export function loadDemoData(userId: string): { accountsAdded: number; transactionsAdded: number } {
  // Check if user already has data
  const existing = db.prepare('SELECT COUNT(*) as c FROM accounts WHERE user_id = ?').get(userId) as any;
  if (existing.c > 0) {
    // Clear existing data to reload fresh demo
    db.prepare('DELETE FROM transactions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM accounts WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM incoming_events WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM budgets WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM merchant_categories WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM ai_cache WHERE user_id = ?').run(userId);
  }

  // Set paycheck info
  db.prepare(
    "UPDATE users SET pay_frequency = 'biweekly', next_payday = date('now', '+6 days'), take_home_pay = 2800 WHERE id = ?"
  ).run(userId);

  // Create accounts
  const checkingId = crypto.randomUUID();
  const savingsId = crypto.randomUUID();
  const creditId = crypto.randomUUID();
  const autoLoanId = crypto.randomUUID();

  db.prepare(
    `INSERT INTO accounts (id, user_id, name, type, current_balance, available_balance, purpose) VALUES (?, ?, 'Main Checking', 'checking', 3240.50, 3240.50, 'spending')`
  ).run(checkingId, userId);

  db.prepare(
    `INSERT INTO accounts (id, user_id, name, type, current_balance, available_balance, purpose) VALUES (?, ?, 'Emergency Savings', 'savings', 2800.00, 2800.00, 'emergency')`
  ).run(savingsId, userId);

  db.prepare(
    `INSERT INTO accounts (id, user_id, name, type, current_balance, interest_rate, minimum_payment) VALUES (?, ?, 'Chase Visa', 'credit', 4200, 24.99, 130)`
  ).run(creditId, userId);

  db.prepare(
    `INSERT INTO accounts (id, user_id, name, type, current_balance, interest_rate, minimum_payment) VALUES (?, ?, 'Car Loan', 'auto_loan', 12500, 6.9, 350)`
  ).run(autoLoanId, userId);

  // Insert transactions
  const insertTxn = db.prepare(
    `INSERT INTO transactions (id, user_id, account_id, amount, date, merchant_name, category, is_recurring)
     VALUES (?, ?, ?, ?, date('now', ? || ' days'), ?, ?, ?)`
  );

  for (const tx of DEMO_TRANSACTIONS) {
    insertTxn.run(
      crypto.randomUUID(), userId, checkingId,
      tx.amount, String(tx.dayOffset), tx.merchant, tx.category, tx.isRecurring ? 1 : 0
    );
  }

  // Incoming events
  const insertEvent = db.prepare(
    `INSERT INTO incoming_events (id, user_id, name, estimated_amount, expected_date, is_recurring, recurrence_interval) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  insertEvent.run(crypto.randomUUID(), userId, 'Car Registration', 350, new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0], 0, null);
  insertEvent.run(crypto.randomUUID(), userId, 'Summer Vacation', 2000, '2026-07-15', 0, null);
  insertEvent.run(crypto.randomUUID(), userId, 'Holiday Gifts', 600, '2026-12-20', 0, null);

  // Budgets
  const insertBudget = db.prepare(`INSERT INTO budgets (id, user_id, category, monthly_limit) VALUES (?, ?, ?, ?)`);
  insertBudget.run(crypto.randomUUID(), userId, 'Groceries', 450);
  insertBudget.run(crypto.randomUUID(), userId, 'Restaurants', 200);
  insertBudget.run(crypto.randomUUID(), userId, 'Entertainment', 80);
  insertBudget.run(crypto.randomUUID(), userId, 'Transportation', 200);
  insertBudget.run(crypto.randomUUID(), userId, 'Shopping', 150);

  return { accountsAdded: 4, transactionsAdded: DEMO_TRANSACTIONS.length };
}
