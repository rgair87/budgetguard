import { Router, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { AuthRequest, authenticate } from '../middleware/auth';
import { attachTier, TieredRequest, TIER_LIMITS } from '../middleware/tier';
import db from '../config/db';
import logger from '../config/logger';
import { env } from '../config/env';
import { validate } from '../middleware/validate';
import { deleteAccountSchema } from '../validation/schemas';
import { invalidateCache } from '../utils/cache';

const router = Router();

router.get('/', authenticate, attachTier, (req: TieredRequest, res: Response) => {
  const userId = req.userId!;
  const user = db.prepare(
    'SELECT id, email, subscription_status, pay_frequency, next_payday, take_home_pay, created_at FROM users WHERE id = ?'
  ).get(userId) as unknown as any;

  const accounts = db.prepare(
    'SELECT id, name, type, current_balance, purpose, income_allocation, interest_rate, minimum_payment, credit_limit, plaid_account_id, teller_account_id, institution_name, last_synced_at FROM accounts WHERE user_id = ? ORDER BY institution_name, type, name'
  ).all(userId);

  const tier = req.tier!;
  const limits = TIER_LIMITS[tier];

  res.json({ user, accounts, tier, limits, trialDaysLeft: req.trialDaysLeft ?? null });
});

// Downgrade to free — cancels Stripe subscription if active
router.post('/downgrade', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = db.prepare('SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?').get(userId) as any;

    // Cancel Stripe subscription if one exists
    if (user?.stripe_subscription_id && env.STRIPE_SECRET_KEY) {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);
      try {
        await stripe.subscriptions.cancel(user.stripe_subscription_id);
      } catch (err: any) {
        // Subscription may already be canceled — log but don't block downgrade
        logger.error({ err: err.message }, 'Stripe cancellation error during downgrade');
      }
      db.prepare('UPDATE users SET subscription_status = ?, stripe_subscription_id = NULL WHERE id = ?').run('trial', userId);
    } else {
      db.prepare("UPDATE users SET subscription_status = 'trial' WHERE id = ?").run(userId);
    }

    res.json({ success: true, message: 'Downgraded to free tier.' });
  } catch (err: any) {
    res.status(500).json({ error: 'server_error', message: 'Failed to downgrade' });
  }
});

// Add a manual account
router.post('/accounts', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { name, type, balance } = req.body;
  if (!name || !type) {
    res.status(400).json({ error: 'validation', message: 'Name and type required' });
    return;
  }

  const id = crypto.randomUUID();
  const bal = parseFloat(balance) || 0;
  const purpose = req.body.purpose || 'general';
  const incomeAllocation = req.body.income_allocation ? parseFloat(req.body.income_allocation) : null;
  const interestRate = req.body.interest_rate ? parseFloat(req.body.interest_rate) : null;
  const minimumPayment = req.body.minimum_payment ? parseFloat(req.body.minimum_payment) : null;
  const creditLimit = req.body.credit_limit ? parseFloat(req.body.credit_limit) : null;

  db.prepare(
    `INSERT INTO accounts (id, user_id, name, type, current_balance, available_balance, purpose, income_allocation, interest_rate, minimum_payment, credit_limit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, name, type, bal, bal, purpose, incomeAllocation, interestRate, minimumPayment, creditLimit);

  res.json({ id, name, type, current_balance: bal, purpose, income_allocation: incomeAllocation, interest_rate: interestRate, minimum_payment: minimumPayment, credit_limit: creditLimit });
});

// Update account fields
router.patch('/accounts/:id', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const accountId = req.params.id as string;
  const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(accountId, userId) as unknown as any;
  if (!account) {
    res.status(404).json({ error: 'not_found', message: 'Account not found' });
    return;
  }

  if (req.body.balance !== undefined) {
    const bal = parseFloat(req.body.balance) || 0;
    // For credit cards, available_balance means available credit (limit - balance), not the balance itself.
    // Only update available_balance to match current_balance for non-credit accounts.
    const acctType = db.prepare('SELECT type FROM accounts WHERE id = ?').get(accountId) as any;
    if (acctType?.type === 'credit') {
      db.prepare('UPDATE accounts SET current_balance = ? WHERE id = ?').run(bal, accountId);
    } else {
      db.prepare('UPDATE accounts SET current_balance = ?, available_balance = ? WHERE id = ?').run(bal, bal, accountId);
    }
  }
  if (req.body.name) {
    db.prepare('UPDATE accounts SET name = ? WHERE id = ?').run(req.body.name, accountId);
  }
  if (req.body.purpose !== undefined) {
    db.prepare('UPDATE accounts SET purpose = ? WHERE id = ?').run(req.body.purpose, accountId);
  }
  if (req.body.income_allocation !== undefined) {
    const alloc = req.body.income_allocation ? parseFloat(req.body.income_allocation) : null;
    db.prepare('UPDATE accounts SET income_allocation = ? WHERE id = ?').run(alloc, accountId);
  }
  if (req.body.interest_rate !== undefined) {
    const rate = req.body.interest_rate ? parseFloat(req.body.interest_rate) : null;
    db.prepare('UPDATE accounts SET interest_rate = ? WHERE id = ?').run(rate, accountId);
  }
  if (req.body.minimum_payment !== undefined) {
    const min = req.body.minimum_payment ? parseFloat(req.body.minimum_payment) : null;
    db.prepare('UPDATE accounts SET minimum_payment = ? WHERE id = ?').run(min, accountId);
  }
  if (req.body.credit_limit !== undefined) {
    const cl = req.body.credit_limit ? parseFloat(req.body.credit_limit) : null;
    db.prepare('UPDATE accounts SET credit_limit = ? WHERE id = ?').run(cl, accountId);
  }

  res.json({ success: true });
});

router.delete('/accounts/:id', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const accountId = req.params.id as string;
  // Delete account and its transactions
  db.prepare('DELETE FROM transactions WHERE account_id = ? AND user_id = ?').run(accountId, userId);
  const result = db.prepare(
    'DELETE FROM accounts WHERE id = ? AND user_id = ?'
  ).run(accountId, userId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'Account not found' });
    return;
  }
  invalidateCache(`runway:${userId}`);
  invalidateCache(`trends:${userId}`);
  invalidateCache(`predictions:${userId}`);
  res.json({ success: true });
});

// Disconnect bank: remove all Teller-linked accounts, their transactions, and clear the access token
router.delete('/bank', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const tellerAccounts = db.prepare(
    'SELECT id FROM accounts WHERE user_id = ? AND teller_account_id IS NOT NULL'
  ).all(userId) as any[];

  for (const acct of tellerAccounts) {
    db.prepare('DELETE FROM transactions WHERE account_id = ? AND user_id = ?').run(acct.id, userId);
  }
  db.prepare('DELETE FROM accounts WHERE user_id = ? AND teller_account_id IS NOT NULL').run(userId);
  db.prepare('UPDATE users SET teller_access_token = NULL WHERE id = ?').run(userId);

  res.json({ success: true, removed: tellerAccounts.length });
});

// --- GDPR: Export all user data ---
router.get('/export-data', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const user = db.prepare(
    'SELECT id, email, subscription_status, pay_frequency, next_payday, take_home_pay, email_verified, created_at FROM users WHERE id = ?'
  ).get(userId) as unknown as any;

  if (!user) {
    res.status(404).json({ error: 'not_found', message: 'User not found' });
    return;
  }

  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ?').all(userId);
  const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ?').all(userId);
  const budgets = db.prepare('SELECT * FROM budgets WHERE user_id = ?').all(userId);
  const incomingEvents = db.prepare('SELECT * FROM incoming_events WHERE user_id = ?').all(userId);
  const chatMessages = db.prepare('SELECT * FROM chat_messages WHERE user_id = ?').all(userId);
  const fixedExpenses = db.prepare('SELECT * FROM fixed_expenses WHERE user_id = ?').all(userId);
  const merchantCategories = db.prepare('SELECT * FROM merchant_categories WHERE user_id = ?').all(userId);
  const savingsGoals = db.prepare('SELECT * FROM savings_goals WHERE user_id = ?').all(userId);

  res.json({
    exported_at: new Date().toISOString(),
    email: user.email,
    user,
    accounts,
    transactions,
    budgets,
    incoming_events: incomingEvents,
    chat_messages: chatMessages,
    fixed_expenses: fixedExpenses,
    merchant_categories: merchantCategories,
    savings_goals: savingsGoals,
  });
});

// --- Export transactions as CSV ---
router.get('/export-csv', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  const rows = db.prepare(
    `SELECT t.date, t.merchant_name, t.amount, t.category, a.name AS account_name, a.type AS account_type
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id
     WHERE t.user_id = ?
     ORDER BY t.date DESC`
  ).all(userId) as unknown as { date: string; merchant_name: string | null; amount: number; category: string | null; account_name: string | null; account_type: string | null }[];

  const header = 'Date,Description,Amount,Category,Account,Type';
  const csvRows = rows.map(r => {
    const escape = (v: string | null | undefined) => {
      const s = v ?? '';
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [
      r.date,
      escape(r.merchant_name),
      r.amount.toFixed(2),
      escape(r.category),
      escape(r.account_name),
      escape(r.account_type),
    ].join(',');
  });

  const csv = [header, ...csvRows].join('\n');
  const today = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="runway-transactions-${today}.csv"`);
  res.send(csv);
});

// --- GDPR: Delete account and all user data ---
router.delete('/delete-account', authenticate, validate(deleteAccountSchema), async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { password } = req.body;

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as unknown as any;
  if (!user) {
    res.status(404).json({ error: 'not_found', message: 'User not found' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'unauthorized', message: 'Incorrect password' });
    return;
  }

  // Delete from all tables (foreign keys have ON DELETE CASCADE, but be explicit)
  db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM merchant_categories WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM ai_cache WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM fixed_expenses WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM incoming_events WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM savings_goals WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM transactions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM accounts WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM budgets WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  res.json({ success: true });
});

export default router;
