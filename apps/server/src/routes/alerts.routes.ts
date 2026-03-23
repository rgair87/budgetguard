import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { getAlerts } from '../services/alerts.service';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const alerts = getAlerts(req.userId!);
  res.json({ alerts, count: alerts.length });
});

export default router;
