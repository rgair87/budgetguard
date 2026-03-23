import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getSpendingPredictions } from '../services/predictions.service';
import { getCached, setCache } from '../utils/cache';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res) => {
  const key = `predictions:${req.userId}`;
  const cached = getCached(key);
  if (cached) return res.json(cached);

  const predictions = getSpendingPredictions(req.userId!);
  setCache(key, predictions, 120);
  res.json(predictions);
});

export default router;
