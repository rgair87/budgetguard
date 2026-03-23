import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import db from '../config/db';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const rows = db.prepare(
    'SELECT id, name, type, current_balance, available_balance, plaid_account_id, last_synced_at FROM accounts WHERE user_id = ? ORDER BY type, name'
  ).all(req.userId) as any[];

  // Get the most recent transaction date for the user
  const latestTxn = db.prepare(
    'SELECT MAX(date) as latest_date FROM transactions WHERE user_id = ?'
  ).get(req.userId) as any;

  const hasLinkedBank = rows.some(r => r.plaid_account_id != null);
  const latestTransactionDate = latestTxn?.latest_date || null;

  res.json({
    accounts: rows,
    hasLinkedBank,
    latestTransactionDate,
  });
});

export default router;
