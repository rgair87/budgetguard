import logger from '../config/logger';
import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { attachTier, requirePlus, TieredRequest } from '../middleware/tier';
import { generateAdvisorReport, getAdvisorSummary, invalidateAdvisorCache } from '../services/advisor.service';
import { calculateHealthScore } from '../services/healthscore.service';

const router = Router();

// Full report (for Advisor page) — requires Plus or Pro
router.get('/', authenticate, attachTier, requirePlus, async (req: TieredRequest, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const report = await generateAdvisorReport(req.userId!, forceRefresh);
    res.json(report);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Advisor route error');
    res.status(500).json({ error: 'ai_error', message: 'Failed to generate advisor report' });
  }
});

// Summary (for Home page — cache-only, never calls AI)
router.get('/summary', authenticate, (req: AuthRequest, res: Response) => {
  const summary = getAdvisorSummary(req.userId!);
  res.json(summary);
});

// Health score only — deterministic, no AI call
router.get('/health-score', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const score = calculateHealthScore(req.userId!);
    res.json(score);
  } catch (err: any) {
    logger.error({ err: err.message }, 'HealthScore error');
    res.status(500).json({ error: 'score_error', message: 'Failed to calculate health score' });
  }
});

// Invalidate cache (force fresh report on next visit)
router.post('/invalidate-cache', authenticate, (req: AuthRequest, res: Response) => {
  invalidateAdvisorCache(req.userId!);
  res.json({ success: true });
});

export default router;
