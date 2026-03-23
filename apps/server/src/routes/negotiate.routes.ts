import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { getNegotiationSuggestions } from '../services/negotiate.service';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  const suggestions = getNegotiationSuggestions(req.userId!);
  res.json({ suggestions });
});

export default router;
