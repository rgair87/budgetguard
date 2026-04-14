import { Router, Response } from 'express';
import crypto from 'crypto';
import { AuthRequest, authenticate } from '../middleware/auth';
import { calculateRunway } from '../services/runway.service';
import { getPaycheckPlan } from '../services/paycheck.service';
import { getCalendarMonth } from '../services/calendar.service';
import { getSubscriptionLifetime, getSpendingByCategory, getCategoryTransactions, normalizeMerchantKey, detectDebtPayments } from '../services/csv.service';
import { getCached, setCache, invalidateCache } from '../utils/cache';
import { getMonthlyIncome } from '../services/income.service';
import { SPEND_EXCLUSION_CATEGORIES, SPEND_EXCLUSION_MERCHANTS } from '../services/runway.service';
import db from '../config/db';
import { getEffectiveUserId } from '../utils/family';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const effectiveId = getEffectiveUserId(req.userId!);
  const key = `runway:${effectiveId}`;
  const cached = getCached(key);

  // Always include fresh streak (not cached)
  const streakRow = db.prepare('SELECT streak_days FROM users WHERE id = ?').get(req.userId!) as { streak_days: number } | undefined;
  const streak = streakRow?.streak_days || 0;

  if (cached) return res.json({ ...cached, streak });

  const score = calculateRunway(effectiveId);
  setCache(key, score, 60);
  res.json({ ...score, streak });
});

// Dashboard charts data
router.get('/dashboard-charts', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { getDashboardCharts } = require('../services/dashboard.service');
    const data = getDashboardCharts(getEffectiveUserId(req.userId!));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'server_error', message: 'Failed to load dashboard charts' });
  }
});

// Daily action: highest-impact thing to do today
router.get('/daily-action', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { getDailyAction } = require('../services/actions.service');
    const action = getDailyAction(getEffectiveUserId(req.userId!));
    res.json({ action });
  } catch {
    res.json({ action: null });
  }
});

// Progress: runway change this week + spending trend
router.get('/progress', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const current = db.prepare(
      'SELECT runway_days, daily_burn FROM daily_snapshots WHERE user_id = ? AND date = ?'
    ).get(userId, today) as { runway_days: number; daily_burn: number } | undefined;

    const lastWeek = db.prepare(
      'SELECT runway_days, daily_burn FROM daily_snapshots WHERE user_id = ? AND date <= ? ORDER BY date DESC LIMIT 1'
    ).get(userId, weekAgo) as { runway_days: number; daily_burn: number } | undefined;

    const lastMonth = db.prepare(
      'SELECT daily_burn FROM daily_snapshots WHERE user_id = ? AND date <= ? ORDER BY date DESC LIMIT 1'
    ).get(userId, monthAgo) as { daily_burn: number } | undefined;

    const runwayChange = current && lastWeek ? current.runway_days - lastWeek.runway_days : null;
    const spendChangeVsLastMonth = current && lastMonth && lastMonth.daily_burn > 0
      ? Math.round(((current.daily_burn - lastMonth.daily_burn) / lastMonth.daily_burn) * 100)
      : null;

    res.json({ runwayChange, spendChangeVsLastMonth });
  } catch {
    res.json({ runwayChange: null, spendChangeVsLastMonth: null });
  }
});

// Count transactions needing review (low confidence or uncategorized)
router.get('/needs-review', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM transactions t
    LEFT JOIN merchant_categories mc ON mc.user_id = t.user_id
      AND LOWER(REPLACE(REPLACE(t.merchant_name, '  ', ' '), '''', '')) LIKE '%' || mc.merchant_pattern || '%'
    WHERE t.user_id = ?
      AND (t.category IS NULL OR t.category = '' OR t.category = 'Other' OR mc.confidence < 0.7)
      AND t.date >= date('now', '-90 days')
  `).get(userId) as { count: number };
  res.json({ count: row.count });
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
    `SELECT merchant_name, category,
            ROUND(AVG(ABS(amount)), 2) as avg_amount,
            ROUND(MIN(ABS(amount)), 2) as min_amount,
            ROUND(MAX(ABS(amount)), 2) as max_amount,
            COUNT(*) as count,
            MAX(date) as last_date,
            MIN(date) as first_date
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND merchant_name IS NOT NULL
     AND date >= date('now', '-90 days')
     GROUP BY LOWER(merchant_name)
     ORDER BY COUNT(*) DESC, AVG(ABS(amount)) DESC`
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
  const needsReview: { merchantName: string; avgAmount: number; minAmount: number; maxAmount: number; count: number; lastDate: string; firstDate: string; currentCategory: string | null }[] = [];
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
      avgAmount: m.avg_amount,
      minAmount: m.min_amount,
      maxAmount: m.max_amount,
      count: m.count,
      lastDate: m.last_date,
      firstDate: m.first_date,
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

// === Budget Wizard ===

router.get('/wizard/data', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  // 1. Recurring bills/subscriptions
  const subs = getSubscriptionLifetime(userId);

  // 2. Debt accounts
  const debtAccounts = db.prepare(
    `SELECT id, name, type, current_balance, interest_rate, minimum_payment
     FROM accounts WHERE user_id = ? AND type IN ('credit', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan')
     AND current_balance > 0`
  ).all(userId) as any[];

  // 3. Spending averages by category (last 90 days)
  const spendingAvgs = db.prepare(
    `SELECT COALESCE(category, 'Other') as category, ROUND(SUM(ABS(amount)) / 3, 2) as monthlyAvg,
            COUNT(*) as txnCount
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
       AND COALESCE(category, '') NOT IN ${SPEND_EXCLUSION_CATEGORIES}
       ${SPEND_EXCLUSION_MERCHANTS}
       AND is_recurring = 0
     GROUP BY category
     HAVING monthlyAvg >= 10
     ORDER BY monthlyAvg DESC`
  ).all(userId) as any[];

  // 4. Income
  const income = getMonthlyIncome(userId);

  // 5. User settings
  const user = db.prepare(
    'SELECT pay_frequency, next_payday, take_home_pay, wizard_completed FROM users WHERE id = ?'
  ).get(userId) as any;

  // 6. Existing budgets
  const budgets = db.prepare(
    'SELECT category, monthly_limit FROM budgets WHERE user_id = ?'
  ).all(userId) as any[];

  res.json({
    bills: subs,
    debtAccounts,
    spendingByCategory: spendingAvgs.map(s => ({
      category: s.category,
      monthlyAvg: s.monthlyAvg,
      suggested: Math.ceil(s.monthlyAvg / 25) * 25,
      txnCount: s.txnCount,
    })),
    income,
    user: {
      payFrequency: user?.pay_frequency || null,
      nextPayday: user?.next_payday || null,
      takeHomePay: user?.take_home_pay || null,
      wizardCompleted: !!user?.wizard_completed,
    },
    existingBudgets: budgets,
    detectedDebts: detectDebtPayments(userId),
  });
});

router.post('/wizard/save', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { bills, debts, budgets: budgetData, income } = req.body;

  // 1. Update merchant classifications from bills
  if (Array.isArray(bills)) {
    const upsertMc = db.prepare(
      `INSERT INTO merchant_categories (id, user_id, merchant_pattern, category, is_bill)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, merchant_pattern) DO UPDATE SET category = excluded.category, is_bill = excluded.is_bill`
    );
    for (const bill of bills) {
      if (!bill.name) continue;
      const key = bill.name.toLowerCase().replace(/\s+/g, ' ').trim();
      const isBill = bill.type === 'bill' || bill.type === 'subscription' ? 1 : 0;
      const category = bill.type === 'debt' ? 'Debt Payments'
        : bill.type === 'subscription' ? 'Entertainment'
        : bill.category || 'Bills';
      upsertMc.run(crypto.randomUUID(), userId, key, category, isBill);
    }
  }

  // 2. Upsert debt accounts
  if (Array.isArray(debts)) {
    for (const debt of debts) {
      if (debt.id) {
        // Update existing
        db.prepare(
          `UPDATE accounts SET name = ?, current_balance = ?, interest_rate = ?, minimum_payment = ?, type = ?
           WHERE id = ? AND user_id = ?`
        ).run(debt.name, debt.balance, debt.apr || null, debt.minimumPayment || null, debt.type || 'credit', debt.id, userId);
      } else if (debt.name && debt.balance > 0) {
        // Create new
        db.prepare(
          `INSERT INTO accounts (id, user_id, name, type, current_balance, interest_rate, minimum_payment)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(crypto.randomUUID(), userId, debt.name, debt.type || 'credit', debt.balance, debt.apr || null, debt.minimumPayment || null);
      }
    }
  }

  // 3. Save budgets
  if (Array.isArray(budgetData)) {
    const delBudget = db.prepare('DELETE FROM budgets WHERE user_id = ? AND category = ?');
    const insBudget = db.prepare(
      `INSERT INTO budgets (id, user_id, category, monthly_limit) VALUES (?, ?, ?, ?)`
    );
    for (const b of budgetData) {
      if (!b.category) continue;
      delBudget.run(userId, b.category);
      if (b.monthlyLimit > 0) {
        insBudget.run(crypto.randomUUID(), userId, b.category, b.monthlyLimit);
      }
    }
  }

  // 4. Update income settings
  if (income) {
    const updates: string[] = [];
    const values: any[] = [];
    if (income.payFrequency !== undefined) { updates.push('pay_frequency = ?'); values.push(income.payFrequency); }
    if (income.takeHomePay !== undefined) { updates.push('take_home_pay = ?'); values.push(income.takeHomePay); }
    if (income.nextPayday !== undefined) { updates.push('next_payday = ?'); values.push(income.nextPayday); }
    if (updates.length > 0) {
      values.push(userId);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
  }

  // 5. Mark wizard complete
  db.prepare('UPDATE users SET wizard_completed = 1 WHERE id = ?').run(userId);

  // 6. Invalidate all caches
  invalidateCache(`runway:${userId}`);
  invalidateCache(`trends:${userId}`);
  invalidateCache(`predictions:${userId}`);
  db.prepare('DELETE FROM ai_cache WHERE user_id = ?').run(userId);

  res.json({ success: true });
});

router.get('/detected-debts', authenticate, (req: AuthRequest, res: Response) => {
  const detected = detectDebtPayments(req.userId!);
  // Filter out debts that already exist as accounts
  const existingAccounts = db.prepare(
    "SELECT LOWER(name) as name FROM accounts WHERE user_id = ? AND type IN ('credit', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan') AND current_balance > 0"
  ).all(req.userId!) as any[];
  const existingNames = new Set(existingAccounts.map((a: any) => a.name));
  const newDebts = detected.filter(d => !existingNames.has(d.displayName.toLowerCase()));
  res.json({ detected: newDebts, existingCount: existingAccounts.length });
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

// Reclassify a subscription (change its category)
router.post('/subscriptions/reclassify', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { merchantName, category } = req.body;
  if (!merchantName || !category) {
    res.status(400).json({ error: 'validation', message: 'merchantName and category required' });
    return;
  }

  const key = normalizeMerchantKey(merchantName);

  // Accept any category directly — no mapping needed
  const txnCategory = category;

  // Upsert merchant classification
  const BILL_CATEGORIES = new Set(['Utilities', 'Insurance', 'Phone & Internet', 'Housing', 'Bills', 'Debt Payments']);
  const isBill = BILL_CATEGORIES.has(txnCategory) ? 1 : 0;

  db.prepare(
    `INSERT INTO merchant_categories (id, user_id, merchant_pattern, category, is_bill)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, merchant_pattern) DO UPDATE SET category = excluded.category, is_bill = excluded.is_bill`
  ).run(crypto.randomUUID(), userId, key, txnCategory, isBill);

  // Also update existing transactions with this merchant
  db.prepare(
    `UPDATE transactions SET category = ?
     WHERE user_id = ? AND LOWER(REPLACE(merchant_name, '  ', ' ')) LIKE ?`
  ).run(txnCategory, userId, `%${key}%`);

  invalidateCache(`runway:${userId}`);
  invalidateCache(`trends:${userId}`);
  invalidateCache(`predictions:${userId}`);

  res.json({ success: true, message: `${merchantName} reclassified as ${txnCategory}` });
});

// Monthly averages by category (12-month lookback)
router.get('/category-averages', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const months = parseInt(req.query.months as string) || 12;

    // Get monthly totals by category for the last N months
    const rows = db.prepare(`
      SELECT
        category,
        strftime('%Y-%m', date) as month,
        SUM(ABS(amount)) as total
      FROM transactions
      WHERE user_id = ? AND amount < 0
        AND date >= date('now', '-' || ? || ' months')
        AND COALESCE(category, '') NOT IN ${SPEND_EXCLUSION_CATEGORIES}
        ${SPEND_EXCLUSION_MERCHANTS}
        AND category IS NOT NULL AND category != ''
      GROUP BY category, strftime('%Y-%m', date)
      ORDER BY category, month
    `).all(userId, months) as { category: string; month: string; total: number }[];

    // Group by category
    const byCategory: Record<string, { months: { month: string; total: number }[]; totalSpent: number }> = {};
    for (const row of rows) {
      if (!byCategory[row.category]) {
        byCategory[row.category] = { months: [], totalSpent: 0 };
      }
      byCategory[row.category].months.push({ month: row.month, total: Math.round(row.total * 100) / 100 });
      byCategory[row.category].totalSpent += row.total;
    }

    // Calculate averages
    const categories = Object.entries(byCategory).map(([category, data]) => {
      const monthCount = data.months.length;
      const avg = monthCount > 0 ? Math.round(data.totalSpent / monthCount) : 0;
      const amounts = data.months.map(m => m.total);
      const min = amounts.length > 0 ? Math.round(Math.min(...amounts)) : 0;
      const max = amounts.length > 0 ? Math.round(Math.max(...amounts)) : 0;

      return {
        category,
        monthlyAverage: avg,
        min,
        max,
        monthCount,
        months: data.months,
      };
    }).sort((a, b) => b.monthlyAverage - a.monthlyAverage);

    res.json({ categories, lookbackMonths: months });
  } catch (err: any) {
    res.status(500).json({ error: 'server_error', message: 'Failed to calculate category averages' });
  }
});

export default router;
