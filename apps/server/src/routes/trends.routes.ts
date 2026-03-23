import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getSpendingTrends } from '../services/trends.service';
import { getCached, setCache } from '../utils/cache';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res) => {
  const key = `trends:${req.userId}`;
  const cached = getCached(key);
  if (cached) return res.json(cached);

  const trends = getSpendingTrends(req.userId!);
  setCache(key, trends, 300);
  res.json(trends);
});

export default router;
