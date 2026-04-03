import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { enrollBank, syncAccounts, recleanMerchantNames, type SyncResult } from '../services/teller.service';
import { classifyMerchantsWithAI } from '../services/ai-categorize.service';

const router = Router();

/**
 * POST /api/teller/enroll
 * Called after Teller Connect completes on the frontend.
 * Stores the access token and syncs accounts + transactions.
 */
router.post('/enroll', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      res.status(400).json({ error: 'validation', message: 'accessToken is required' });
      return;
    }
    const result = await enrollBank(req.userId!, accessToken);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Teller enroll error:', err);
    const msg = err.message || '';
    // Provide user-friendly error messages
    let userMessage = 'Failed to connect bank. Please try again.';
    if (msg.includes('certificate') || msg.includes('cert') || msg.includes('CERT')) {
      userMessage = 'Bank connection is not configured properly. Please contact support.';
    } else if (msg.includes('enrollment.disconnected') || msg.includes('not healthy')) {
      userMessage = 'Your bank connection expired. Please try connecting again.';
    } else if (msg.includes('401') || msg.includes('unauthorized')) {
      userMessage = 'Bank authentication failed. Please try connecting again.';
    } else if (msg.includes('429') || msg.includes('rate')) {
      userMessage = 'Too many requests. Please wait a minute and try again.';
    } else if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
      userMessage = 'Your bank\'s servers are temporarily unavailable. Please try again later.';
    } else if (msg.includes('504') || msg.includes('timeout')) {
      userMessage = 'Your bank is taking too long to respond. Try again in a few minutes.';
    }
    res.status(500).json({ error: 'enroll_error', message: userMessage });
  }
});

/**
 * POST /api/teller/sync
 * Manually re-sync accounts and transactions from Teller.
 */
router.post('/sync', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await syncAccounts(req.userId!);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Teller sync error:', err);
    const msg = err.message || '';
    let userMessage = 'Failed to sync. Please try again.';
    if (msg.includes('No Teller access token')) {
      userMessage = 'No bank connected. Link your bank first.';
    } else if (msg.includes('enrollment.disconnected') || msg.includes('expired') || msg.includes('not healthy')) {
      userMessage = 'Your bank connection expired. Please disconnect and re-connect your bank.';
    } else if (msg.includes('504') || msg.includes('timeout') || msg.includes('taking too long')) {
      userMessage = 'Your bank is slow to respond. We\'ll retry automatically in about a minute.';
    }
    res.status(500).json({ error: 'sync_error', message: userMessage });
  }
});

/**
 * GET /api/teller/status
 * Debug: check what Teller has synced for this user.
 */
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const db = (await import('../config/db')).default;
    const userId = req.userId!;
    const user = db.prepare('SELECT teller_access_token FROM users WHERE id = ?').get(userId) as any;

    const accounts = db.prepare(
      `SELECT id, name, type, teller_account_id, current_balance, available_balance, last_synced_at,
              CASE WHEN teller_access_token IS NOT NULL THEN 1 ELSE 0 END as has_token
       FROM accounts WHERE user_id = ?`
    ).all(userId) as any[];

    const txnByAccount = db.prepare(
      `SELECT account_id, COUNT(*) as count, MIN(date) as earliest, MAX(date) as latest
       FROM transactions WHERE user_id = ? GROUP BY account_id`
    ).all(userId) as any[];

    const totalTxns = db.prepare(
      'SELECT COUNT(*) as total, SUM(CASE WHEN is_recurring = 1 THEN 1 ELSE 0 END) as recurring FROM transactions WHERE user_id = ?'
    ).get(userId) as any;

    const uncategorized = db.prepare(
      `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND (category IS NULL OR category = '')`
    ).get(userId) as any;

    const categoryDist = db.prepare(
      `SELECT COALESCE(category, '(uncategorized)') as category, COUNT(*) as count
       FROM transactions WHERE user_id = ? GROUP BY category ORDER BY count DESC`
    ).all(userId) as any[];

    const topRecurring = db.prepare(
      `SELECT merchant_name, COUNT(*) as count, ROUND(AVG(ABS(amount)),2) as avg_amt, category
       FROM transactions WHERE user_id = ? AND is_recurring = 1
       GROUP BY LOWER(merchant_name) ORDER BY count DESC LIMIT 25`
    ).all(userId) as any[];

    const merchantCatCount = db.prepare(
      'SELECT COUNT(*) as count FROM merchant_categories WHERE user_id = ?'
    ).get(userId) as any;

    res.json({
      hasAccessToken: !!user?.teller_access_token,
      accounts,
      transactionsByAccount: txnByAccount,
      totalTransactions: totalTxns.total,
      recurringTransactions: totalTxns.recurring,
      uncategorizedTransactions: uncategorized.count,
      categoryDistribution: categoryDist,
      topRecurringMerchants: topRecurring,
      merchantCategoryEntries: merchantCatCount.count,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/teller/reclean
 * Re-clean all merchant names with improved cleaning logic.
 */
router.post('/reclean', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const updated = recleanMerchantNames(req.userId!);
    res.json({ success: true, updated });
  } catch (err: any) {
    console.error('Reclean error:', err);
    res.status(500).json({ error: 'reclean_error', message: err.message });
  }
});

/**
 * POST /api/teller/fix-data
 * One-time data cleanup: fix income misclassification, clean ghost accounts,
 * remove orphaned merchant_categories, fix recurring flags.
 */
router.post('/fix-data', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const db = (await import('../config/db')).default;
    const userId = req.userId!;
    const fixes: string[] = [];

    // 1. Fix positive-amount transactions classified as debt/bills
    const incomeFixed = db.prepare(
      `UPDATE transactions SET category = 'Income', is_recurring = 0
       WHERE user_id = ? AND amount > 0 AND amount >= 200
       AND category NOT IN ('Income', 'Transfers', 'Transfer')
       AND COALESCE(category, '') != 'Income'`
    ).run(userId);
    if (incomeFixed.changes > 0) fixes.push(`Reclassified ${incomeFixed.changes} income transactions`);

    // 2. Fix positive small amounts (refunds, cashback, interest) — don't mark as recurring
    const smallPosFixed = db.prepare(
      `UPDATE transactions SET is_recurring = 0
       WHERE user_id = ? AND amount > 0 AND is_recurring = 1`
    ).run(userId);
    if (smallPosFixed.changes > 0) fixes.push(`Unflagged ${smallPosFixed.changes} positive transactions from recurring`);

    // 3. Fix merchant_categories entries that point to income merchants
    const badMcFixed = db.prepare(
      `DELETE FROM merchant_categories
       WHERE user_id = ? AND merchant_pattern IN (
         SELECT DISTINCT LOWER(REPLACE(merchant_name, '  ', ' '))
         FROM transactions
         WHERE user_id = ? AND amount > 0 AND amount >= 200
         GROUP BY LOWER(merchant_name)
         HAVING COUNT(*) >= 3
       )`
    ).run(userId, userId);
    if (badMcFixed.changes > 0) fixes.push(`Removed ${badMcFixed.changes} income merchants from category overrides`);

    // 4. Remove ghost $0 debt accounts that have no teller_account_id and no transactions
    const ghostAccounts = db.prepare(
      `DELETE FROM accounts
       WHERE user_id = ? AND teller_account_id IS NULL AND current_balance = 0
       AND id NOT IN (SELECT DISTINCT account_id FROM transactions WHERE user_id = ? AND account_id IS NOT NULL)`
    ).run(userId, userId);
    if (ghostAccounts.changes > 0) fixes.push(`Removed ${ghostAccounts.changes} empty ghost accounts`);

    // 5. Remove orphaned merchant_categories (no matching transactions)
    const orphanedMc = db.prepare(
      `DELETE FROM merchant_categories
       WHERE user_id = ? AND merchant_pattern NOT IN (
         SELECT DISTINCT LOWER(REPLACE(merchant_name, '  ', ' '))
         FROM transactions WHERE user_id = ?
       )`
    ).run(userId, userId);
    if (orphanedMc.changes > 0) fixes.push(`Cleaned ${orphanedMc.changes} orphaned merchant classifications`);

    // 6. Fix recurring flag on transactions with only 1 occurrence
    const singleFixed = db.prepare(
      `UPDATE transactions SET is_recurring = 0
       WHERE user_id = ? AND is_recurring = 1
       AND LOWER(merchant_name) IN (
         SELECT LOWER(merchant_name)
         FROM transactions WHERE user_id = ? AND is_recurring = 1
         GROUP BY LOWER(merchant_name) HAVING COUNT(*) = 1
       )`
    ).run(userId, userId);
    if (singleFixed.changes > 0) fixes.push(`Unflagged ${singleFixed.changes} single-occurrence transactions from recurring`);

    // Invalidate caches
    const { invalidateCache } = await import('../utils/cache');
    invalidateCache(`runway:${userId}`);
    invalidateCache(`trends:${userId}`);
    invalidateCache(`predictions:${userId}`);
    db.prepare('DELETE FROM ai_cache WHERE user_id = ?').run(userId);

    res.json({ success: true, fixes });
  } catch (err: any) {
    console.error('Fix-data error:', err);
    res.status(500).json({ error: 'fix_data_error', message: err.message });
  }
});

/**
 * POST /api/teller/reclassify
 * Re-classify transactions stuck in Services/Other/uncategorized using AI.
 */
router.post('/reclassify', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const db = (await import('../config/db')).default;
    const userId = req.userId!;

    // Get distinct merchants in junk categories
    const junkMerchants = db.prepare(
      `SELECT DISTINCT merchant_name FROM transactions
       WHERE user_id = ? AND amount < 0
       AND (category IN ('Services', 'Other') OR category IS NULL OR category = '')
       AND merchant_name IS NOT NULL AND merchant_name != ''`
    ).all(userId) as any[];

    const merchantNames = junkMerchants.map((m: any) => m.merchant_name);
    if (merchantNames.length === 0) {
      res.json({ success: true, classified: 0, message: 'No merchants to reclassify' });
      return;
    }

    console.log(`[Reclassify] ${merchantNames.length} merchants to classify for user ${userId}`);

    // Run AI classification
    const results = await classifyMerchantsWithAI(merchantNames);
    if (results.length === 0) {
      res.json({ success: true, classified: 0, message: 'AI classification returned no results' });
      return;
    }

    // Apply classifications
    const upsertMc = db.prepare(
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
       WHERE user_id = ? AND LOWER(merchant_name) = ? AND amount < 0`
    );

    let classified = 0;
    const { randomUUID } = await import('crypto');
    for (const c of results) {
      if (c.category === 'Other' || c.category === 'Services') continue; // Skip if AI also says Other/Services
      const norm = c.merchantName.toLowerCase().replace(/\s+/g, ' ').trim();
      upsertMc.run(randomUUID(), userId, norm, c.category, c.isBill ? 1 : 0);
      updateTxns.run(c.category, userId, norm);
      if (c.isBill) markRecurring.run(userId, norm);
      classified++;
    }

    // Invalidate caches
    const { invalidateCache } = await import('../utils/cache');
    invalidateCache(`runway:${userId}`);
    invalidateCache(`trends:${userId}`);
    invalidateCache(`predictions:${userId}`);

    console.log(`[Reclassify] Classified ${classified} of ${merchantNames.length} merchants`);
    res.json({ success: true, classified, total: merchantNames.length, message: `Reclassified ${classified} merchants` });
  } catch (err: any) {
    console.error('Reclassify error:', err);
    res.status(500).json({ error: 'reclassify_error', message: err.message });
  }
});

export default router;
