import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { attachTier, requirePro, TieredRequest } from '../middleware/tier';
import { getNegotiationSuggestions } from '../services/negotiate.service';

const router = Router();
router.use(authenticate);

// Pro only — negotiation scripts and phone numbers
router.get('/', attachTier, requirePro, (req: TieredRequest, res: Response) => {
  try {
    const suggestions = getNegotiationSuggestions(req.userId!);
    res.json({ suggestions });
  } catch (err: any) {
    res.status(500).json({ error: 'server_error', message: 'Failed to load negotiation suggestions' });
  }
});

export default router;
