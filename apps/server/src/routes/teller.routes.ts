import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { enrollBank, syncAccounts } from '../services/teller.service';

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

export default router;
