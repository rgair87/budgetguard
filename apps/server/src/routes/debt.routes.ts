import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { getDebtPayoffPlan, getLumpSumRecommendation } from '../services/debt.service';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const extra = parseFloat(req.query.extra as string) || 0;
    const plan = getDebtPayoffPlan(req.userId!, extra);
    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ error: 'server_error', message: 'Failed to calculate debt payoff plan' });
  }
});

router.get('/lump-sum', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const recommendation = getLumpSumRecommendation(req.userId!);
    res.json(recommendation);
  } catch (err: any) {
    res.status(500).json({ error: 'server_error', message: 'Failed to calculate lump sum recommendation' });
  }
});

export default router;
