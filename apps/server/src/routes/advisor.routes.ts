import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { generateAdvisorReport, getAdvisorSummary } from '../services/advisor.service';
import { calculateHealthScore } from '../services/healthscore.service';

const router = Router();

// Full report (for Advisor page)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const report = await generateAdvisorReport(req.userId!, forceRefresh);
    res.json(report);
  } catch (err: any) {
    console.error('[Advisor] Route error:', err.message);
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
    console.error('[HealthScore] Error:', err.message);
    res.status(500).json({ error: 'score_error', message: 'Failed to calculate health score' });
  }
});

export default router;
