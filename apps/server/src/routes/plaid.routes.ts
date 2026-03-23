import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { createLinkToken, exchangePublicToken, syncAccounts } from '../services/plaid.service';

const router = Router();

router.post('/create-link-token', authenticate, async (req: AuthRequest, res: Response) => {
  const linkToken = await createLinkToken(req.userId!);
  res.json({ link_token: linkToken });
});

router.post('/exchange-token', authenticate, async (req: AuthRequest, res: Response) => {
  const { public_token } = req.body;
  if (!public_token) {
    res.status(400).json({ error: 'validation', message: 'public_token required' });
    return;
  }
  await exchangePublicToken(req.userId!, public_token);
  res.json({ success: true });
});

router.post('/sync', authenticate, async (req: AuthRequest, res: Response) => {
  await syncAccounts(req.userId!);
  res.json({ success: true });
});

export default router;
