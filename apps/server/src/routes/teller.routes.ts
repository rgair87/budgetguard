import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { enrollBank, syncAccounts, recleanMerchantNames } from '../services/teller.service';

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
    await enrollBank(req.userId!, accessToken);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Teller enroll error:', err);
    res.status(500).json({ error: 'enroll_error', message: err.message || 'Failed to connect bank' });
  }
});

/**
 * POST /api/teller/sync
 * Manually re-sync accounts and transactions from Teller.
 */
router.post('/sync', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await syncAccounts(req.userId!);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Teller sync error:', err);
    res.status(500).json({ error: 'sync_error', message: err.message || 'Failed to sync' });
  }
});

/**
 * GET /api/teller/status
 * Debug: check what Teller has synced for this user.
 */
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const db = (await import('../config/db')).default;
    const user = db.prepare('SELECT teller_access_token FROM users WHERE id = ?').get(req.userId!) as any;
    const accounts = db.prepare(
      'SELECT id, name, type, teller_account_id, current_balance, last_synced_at FROM accounts WHERE user_id = ? AND teller_account_id IS NOT NULL'
    ).all(req.userId!) as any[];
    const txnCount = db.prepare(
      'SELECT COUNT(*) as count FROM transactions WHERE user_id = ?'
    ).get(req.userId!) as any;

    res.json({
      hasAccessToken: !!user?.teller_access_token,
      accounts,
      transactionCount: txnCount.count,
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
