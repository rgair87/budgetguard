import { Router, Response } from 'express';
import crypto from 'crypto';
import { AuthRequest, authenticate } from '../middleware/auth';
import { calculateRunway } from '../services/runway.service';
import { getPaycheckPlan } from '../services/paycheck.service';
import { getCalendarMonth } from '../services/calendar.service';
import { getSubscriptionLifetime, getSpendingByCategory, getCategoryTransactions, normalizeMerchantKey } from '../services/csv.service';
import { getCached, setCache, invalidateCache } from '../utils/cache';
import db from '../config/db';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const key = `runway:${req.userId}`;
  const cached = getCached(key);
  if (cached) return res.json(cached);

  const score = calculateRunway(req.userId!);
  setCache(key, score, 60);
  res.json(score);
});

router.get('/paycheck-plan', authenticate, (req: AuthRequest, res: Response) => {
  const plan = getPaycheckPlan(req.userId!);
  if (!plan) {
    res.status(404).json({ error: 'no_paycheck', message: 'Set up your paycheck info in Settings first' });
    return;
  }
  res.json(plan);
});

router.put('/paycheck', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { pay_frequency, next_payday, take_home_pay } = req.body;
  if (!pay_frequency || !next_payday || !take_home_pay) {
    res.status(400).json({ error: 'validation', message: 'pay_frequency, next_payday, and take_home_pay required' });
    return;
  }

  db.prepare(
    'UPDATE users SET pay_frequency = ?, next_payday = ?, take_home_pay = ? WHERE id = ?'
  ).run(pay_frequency, next_payday, take_home_pay, userId);
  invalidateCache(`runway:${userId}`);
  invalidateCache(`trends:${userId}`);
  invalidateCache(`predictions:${userId}`);
  res.json({ success: true });
});

// === Merchant Review: which merchants need user classification? ===
router.get('/review-merchants', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  // Find distinct merchants from last 90 days that have no user classification
  // and no default classification
  const merchants = db.prepare(
    `SELECT DISTINCT merchant_name, category, ABS(amount) as sample_amount
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND merchant_name IS NOT NULL
     AND date >= date('now', '-90 days')
     AND is_recurring = 0
     ORDER BY ABS(amount) DESC`
  ).all(userId) as unknown as any[];

  // Default merchant map keys (simplified check)
  const DEFAULT_MERCHANTS = new Set([
    'chipotle', 'mcdonald', 'starbucks', 'subway', 'panera', 'doordash', 'uber eats',
    'whole foods', 'kroger', 'walmart', 'aldi', 'trader joe', 'publix', 'costco',
    'target', 'amazon', 'best buy', 'home depot',
    'netflix', 'spotify', 'hulu', 'disney', 'hbo', 'spotify + hulu',
    'shell', 'bp', 'chevron', 'uber', 'lyft', 'shell gas',
    'electric company', 'rent payment', 'at&t', 'verizon', 't-mobile',
    'taco bell', 'chick-fil-a', 'wendy', 'burger king', 'pizza hut',
    'walgreens', 'cvs', 'dollar general',
  ]);

  // Get user's existing classifications
  const userClassifications = db.prepare(
    'SELECT merchant_pattern FROM merchant_categories WHERE user_id = ?'
  ).all(userId) as unknown as any[];
  const classifiedSet = new Set(userClassifications.map((r: any) => r.merchant_pattern));

  // Filter to unclassified merchants
  const needsReview: { merchantName: string; sampleAmount: number; currentCategory: string | null }[] = [];
  const seen = new Set<string>();

  for (const m of merchants) {
    const normalized = m.merchant_name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    // Skip if user already classified
    if (classifiedSet.has(normalized)) continue;

    // Skip if our default map knows it
    let knownByDefault = false;
    for (const key of DEFAULT_MERCHANTS) {
      if (normalized.includes(key) || key.includes(normalized)) {
        knownByDefault = true;
        break;
      }
    }
    if (knownByDefault) continue;

    needsReview.push({
      merchantName: m.merchant_name,
      sampleAmount: m.sample_amount,
      currentCategory: m.category,
    });
  }

  res.json({ merchants: needsReview, count: needsReview.length });
});

// === Classify a merchant ===
router.post('/classify-merchant', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { merchantName, category, isBill } = req.body;
  if (!merchantName || !category) {
    res.status(400).json({ error: 'validation', message: 'merchantName and category required' });
    return;
  }

  const normalized = merchantName.toLowerCase().replace(/\s+/g, ' ').trim();

  // Upsert into merchant_categories
  db.prepare(
    `INSERT INTO merchant_categories (id, user_id, merchant_pattern, category, is_bill)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, merchant_pattern) DO UPDATE SET category = excluded.category, is_bill = excluded.is_bill`
  ).run(crypto.randomUUID(), userId, normalized, category, isBill ? 1 : 0);

  // Also update existing transactions with this merchant
  db.prepare(
    `UPDATE transactions SET category = ?
     WHERE user_id = ? AND LOWER(merchant_name) = ?`
  ).run(category, userId, normalized);

  // If it's a bill, mark those transactions as recurring
  if (isBill) {
    db.prepare(
      `UPDATE transactions SET is_recurring = 1
       WHERE user_id = ? AND LOWER(merchant_name) = ?`
    ).run(userId, normalized);
  }

  invalidateCache(`runway:${userId}`);
  invalidateCache(`trends:${userId}`);
  invalidateCache(`predictions:${userId}`);
  res.json({ success: true, message: `${merchantName} classified as ${category}` });
});

// === Batch classify multiple merchants at once ===
router.post('/classify-merchants-batch', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { classifications } = req.body;
  if (!Array.isArray(classifications) || classifications.length === 0) {
    res.status(400).json({ error: 'validation', message: 'classifications array required' });
    return;
  }

  let classified = 0;
  const upsertMerchant = db.prepare(
    `INSERT INTO merchant_categories (id, user_id, merchant_pattern, category, is_bill)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, merchant_pattern) DO UPDATE SET category = excluded.category, is_bill = excluded.is_bill`
  );
  const updateTxns = db.prepare(
    `UPDATE transactions SET category = ?
     WHERE user_id = ? AND LOWER(merchant_name) = ?`
  );
  const markRecurring = db.prepare(
    `UPDATE transactions SET is_recurring = 1
     WHERE user_id = ? AND LOWER(merchant_name) = ?`
  );

  for (const { merchantName, category, isBill } of classifications) {
    if (!merchantName || !category) continue;
    const normalized = merchantName.toLowerCase().replace(/\s+/g, ' ').trim();
    upsertMerchant.run(crypto.randomUUID(), userId, normalized, category, isBill ? 1 : 0);
    updateTxns.run(category, userId, normalized);
    if (isBill) markRecurring.run(userId, normalized);
    classified++;
  }
  invalidateCache(`runway:${userId}`);
  invalidateCache(`trends:${userId}`);
  invalidateCache(`predictions:${userId}`);
  res.json({ success: true, classified });
});

// === Budgets ===

router.get('/budgets', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  // Get user's existing budgets
  const budgets = db.prepare(
    'SELECT category, monthly_limit FROM budgets WHERE user_id = ? ORDER BY category'
  ).all(userId) as unknown as { category: string; monthly_limit: number }[];

  const budgetMap = new Map(budgets.map(b => [b.category, b.monthly_limit]));

  // Get 3-month average spend per category for suggestions
  const spendRows = db.prepare(
    `SELECT category, SUM(ABS(amount)) as total
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
       AND category IS NOT NULL AND category != ''
       AND category NOT IN ('Transfers', 'Transfer', 'Debt Payments', 'Income', 'Payroll', 'Direct Deposit', 'Credit', 'Fees')
     GROUP BY category
     ORDER BY total DESC`
  ).all(userId) as unknown as { category: string; total: number }[];

  // Get last-30-day spend per category
  const recentRows = db.prepare(
    `SELECT category, SUM(ABS(amount)) as total
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-30 days')
       AND category IS NOT NULL AND category != ''
       AND category NOT IN ('Transfers', 'Transfer', 'Debt Payments', 'Income', 'Payroll', 'Direct Deposit', 'Credit', 'Fees')
     GROUP BY category`
  ).all(userId) as unknown as { category: string; total: number }[];

  const recentMap = new Map(recentRows.map(r => [r.category, Math.round(r.total)]));

  // Build response: categories with spending, their budget, and a suggestion
  const result = spendRows.map(row => {
    const monthlyAvg = row.total / 3;
    // Round up to nearest $25 as a buffer
    const suggested = Math.ceil(monthlyAvg / 25) * 25;
    return {
      category: row.category,
      monthly_limit: budgetMap.get(row.category) ?? 0,
      suggested: suggested > 0 ? suggested : null,
      currentSpend: recentMap.get(row.category) ?? 0,
    };
  });

  res.json({ budgets: result });
});

router.put('/budgets', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { budgets } = req.body;
  if (!Array.isArray(budgets)) {
    res.status(400).json({ error: 'validation', message: 'budgets array required' });
    return;
  }

  const upsert = db.prepare(
    `INSERT INTO budgets (id, user_id, category, monthly_limit)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit`
  );

  // Check if budgets table has unique constraint on (user_id, category)
  // If not, we need a different approach
  const del = db.prepare('DELETE FROM budgets WHERE user_id = ? AND category = ?');

  let saved = 0;
  for (const b of budgets) {
    if (!b.category || typeof b.monthly_limit !== 'number') continue;
    if (b.monthly_limit <= 0) {
      // Remove budget if set to 0
      del.run(userId, b.category);
    } else {
      // Try upsert, fall back to delete+insert if no unique constraint
      del.run(userId, b.category);
      upsert.run(crypto.randomUUID(), userId, b.category, b.monthly_limit);
    }
    saved++;
  }

  invalidateCache(`runway:${userId}`);
  res.json({ success: true, saved });
});

router.get('/subscriptions', authenticate, (req: AuthRequest, res: Response) => {
  const subs = getSubscriptionLifetime(req.userId!);
  res.json(subs);
});

router.get('/calendar', authenticate, (req: AuthRequest, res: Response) => {
  const month = req.query.month as string;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: 'validation', message: 'month query parameter required in YYYY-MM format' });
    return;
  }
  const data = getCalendarMonth(req.userId!, month);
  res.json(data);
});

// === Spending by Category ===
router.get('/spending-by-category', authenticate, (req: AuthRequest, res: Response) => {
  const period = (req.query.period as string) || 'this_month';
  if (!['this_month', 'last_30', 'last_90'].includes(period)) {
    res.status(400).json({ error: 'validation', message: 'period must be this_month, last_30, or last_90' });
    return;
  }
  const data = getSpendingByCategory(req.userId!, period as any);
  res.json(data);
});

// Category drilldown — show individual transactions for a category
router.get('/spending-by-category/transactions', authenticate, (req: AuthRequest, res: Response) => {
  const period = (req.query.period as string) || 'this_month';
  const category = req.query.category as string;
  if (!category) {
    res.status(400).json({ error: 'validation', message: 'category query parameter required' });
    return;
  }
  if (!['this_month', 'last_30', 'last_90'].includes(period)) {
    res.status(400).json({ error: 'validation', message: 'period must be this_month, last_30, or last_90' });
    return;
  }
  const data = getCategoryTransactions(req.userId!, category, period as any);
  res.json(data);
});

// === Subscription Management ===

// Dismiss a subscription from the recurring list
router.post('/subscriptions/dismiss', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { merchantName } = req.body;
  if (!merchantName) {
    res.status(400).json({ error: 'validation', message: 'merchantName required' });
    return;
  }

  const key = normalizeMerchantKey(merchantName);

  // Upsert into merchant_categories with hide_recurring = 1
  db.prepare(
    `INSERT INTO merchant_categories (id, user_id, merchant_pattern, category, is_bill, hide_recurring)
     VALUES (?, ?, ?, 'Other', 0, 1)
     ON CONFLICT(user_id, merchant_pattern) DO UPDATE SET hide_recurring = 1`
  ).run(crypto.randomUUID(), userId, key);

  // Also unflag those transactions as recurring
  db.prepare(
    `UPDATE transactions SET is_recurring = 0
     WHERE user_id = ? AND LOWER(REPLACE(merchant_name, '  ', ' ')) LIKE ?`
  ).run(userId, `%${key}%`);

  res.json({ success: true, message: `${merchantName} removed from recurring list` });
});

// Restore a dismissed subscription
router.post('/subscriptions/restore', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { merchantName } = req.body;
  if (!merchantName) {
    res.status(400).json({ error: 'validation', message: 'merchantName required' });
    return;
  }

  const key = normalizeMerchantKey(merchantName);

  db.prepare(
    `UPDATE merchant_categories SET hide_recurring = 0
     WHERE user_id = ? AND merchant_pattern = ?`
  ).run(userId, key);

  // Re-flag matching transactions as recurring
  db.prepare(
    `UPDATE transactions SET is_recurring = 1
     WHERE user_id = ? AND LOWER(REPLACE(merchant_name, '  ', ' ')) LIKE ?`
  ).run(userId, `%${key}%`);

  res.json({ success: true, message: `${merchantName} restored to recurring list` });
});

// Reclassify a subscription (change its category: subscription, bill, or debt)
router.post('/subscriptions/reclassify', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { merchantName, category } = req.body;
  if (!merchantName || !category) {
    res.status(400).json({ error: 'validation', message: 'merchantName and category required' });
    return;
  }
  if (!['subscription', 'bill', 'debt'].includes(category)) {
    res.status(400).json({ error: 'validation', message: 'category must be subscription, bill, or debt' });
    return;
  }

  const key = normalizeMerchantKey(merchantName);

  // Map subscription category to a transaction category for consistency
  // Look up existing category from transactions first; fall back to defaults
  const existingCatRow = db.prepare(
    `SELECT category FROM transactions WHERE user_id = ? AND LOWER(REPLACE(merchant_name, '  ', ' ')) LIKE ? AND category IS NOT NULL LIMIT 1`
  ).get(userId, `%${key}%`) as any;

  const txnCategory = category === 'subscription' ? 'Entertainment'
    : category === 'debt' ? 'Debt Payments'
    : existingCatRow?.category || 'Bills';

  // Upsert merchant classification
  db.prepare(
    `INSERT INTO merchant_categories (id, user_id, merchant_pattern, category, is_bill)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, merchant_pattern) DO UPDATE SET category = excluded.category, is_bill = excluded.is_bill`
  ).run(crypto.randomUUID(), userId, key, txnCategory, category === 'bill' ? 1 : 0);

  res.json({ success: true, message: `${merchantName} reclassified as ${category}` });
});

export default router;
