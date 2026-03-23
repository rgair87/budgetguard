import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { generateCutRecommendations } from '../services/cutthis.service';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const result = await generateCutRecommendations(req.userId!, forceRefresh);
    res.json(result);
  } catch (err: any) {
    console.error('Cut This error:', err);
    res.status(500).json({ error: 'ai_error', message: 'Failed to generate recommendations' });
  }
});

export default router;
