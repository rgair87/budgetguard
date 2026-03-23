import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { getDebtPayoffPlan, getLumpSumRecommendation } from '../services/debt.service';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const extra = parseFloat(req.query.extra as string) || 0;
  const plan = getDebtPayoffPlan(req.userId!, extra);
  res.json(plan);
});

router.get('/lump-sum', authenticate, (req: AuthRequest, res: Response) => {
  const recommendation = getLumpSumRecommendation(req.userId!);
  res.json(recommendation);
});

export default router;
