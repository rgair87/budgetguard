import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import db from '../config/db';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const rows = db.prepare(
    'SELECT id, name, type, current_balance, available_balance, plaid_account_id, teller_account_id, institution_name, last_synced_at FROM accounts WHERE user_id = ? ORDER BY institution_name, type, name'
  ).all(userId) as any[];

  // Get the most recent transaction date for the user
  const latestTxn = db.prepare(
    'SELECT MAX(date) as latest_date FROM transactions WHERE user_id = ?'
  ).get(userId) as any;

  const hasLinkedBank = rows.some(r => r.plaid_account_id != null || r.teller_account_id != null);
  const latestTransactionDate = latestTxn?.latest_date || null;

  const userRow = db.prepare('SELECT wizard_completed, onboarding_completed FROM users WHERE id = ?').get(userId) as any;
  const wizardCompleted = !!userRow?.wizard_completed;
  const onboardingCompleted = !!userRow?.onboarding_completed;

  res.json({
    accounts: rows,
    hasLinkedBank,
    latestTransactionDate,
    wizardCompleted,
    onboardingCompleted,
  });
});

export default router;
