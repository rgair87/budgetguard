import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { enrollBank, syncAccounts, recleanMerchantNames, type SyncResult } from '../services/teller.service';

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

export default router;
