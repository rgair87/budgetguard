import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { getAlerts } from '../services/alerts.service';
import { getEffectiveUserId } from '../utils/family';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const alerts = getAlerts(getEffectiveUserId(req.userId!));
    res.json({ alerts, count: alerts.length });
  } catch (err: any) {
    res.status(500).json({ error: 'server_error', message: 'Failed to load alerts' });
  }
});

export default router;
