import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { attachTier, requirePro, TieredRequest } from '../middleware/tier';
import { getNegotiationSuggestions } from '../services/negotiate.service';

const router = Router();
router.use(authenticate);

// Pro only — negotiation scripts and phone numbers
router.get('/', attachTier, requirePro, (req: TieredRequest, res: Response) => {
  const suggestions = getNegotiationSuggestions(req.userId!);
  res.json({ suggestions });
});

export default router;
