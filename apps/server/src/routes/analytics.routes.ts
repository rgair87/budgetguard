import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import db from '../config/db';

const router = Router();

// ─── Record an event ─────────────────────────────────────────
router.post('/track', authenticate, (req: AuthRequest, res: Response) => {
  const { feature, action = 'view', metadata } = req.body;
  if (!feature) { res.status(400).json({ error: 'feature is required' }); return; }

  db.prepare(
    'INSERT INTO analytics_events (user_id, feature, action, metadata) VALUES (?, ?, ?, ?)'
  ).run(req.userId, feature, action, metadata ? JSON.stringify(metadata) : null);

  res.json({ ok: true });
});

// ─── Batch track (for queued events) ─────────────────────────
router.post('/track-batch', authenticate, (req: AuthRequest, res: Response) => {
  const { events } = req.body;
  if (!Array.isArray(events)) { res.status(400).json({ error: 'events array required' }); return; }

  const stmt = db.prepare(
    'INSERT INTO analytics_events (user_id, feature, action, metadata) VALUES (?, ?, ?, ?)'
  );

  for (const evt of events) {
    if (evt.feature) {
      stmt.run(req.userId, evt.feature, evt.action || 'view', evt.metadata ? JSON.stringify(evt.metadata) : null);
    }
  }

  res.json({ ok: true, count: events.length });
});

// ─── Dashboard: feature usage summary ────────────────────────
router.get('/dashboard', authenticate, (req: AuthRequest, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // Feature usage ranked by total events
  const featureRanking = db.prepare(`
    SELECT feature, action, COUNT(*) as total_events, COUNT(DISTINCT user_id) as unique_users,
           MAX(created_at) as last_used
    FROM analytics_events
    WHERE created_at >= ?
    GROUP BY feature, action
    ORDER BY total_events DESC
  `).all(since) as any[];

  // Aggregate by feature (combine all actions)
  const byFeature = db.prepare(`
    SELECT feature, COUNT(*) as total_events, COUNT(DISTINCT user_id) as unique_users,
           MAX(created_at) as last_used
    FROM analytics_events
    WHERE created_at >= ?
    GROUP BY feature
    ORDER BY total_events DESC
  `).all(since) as any[];

  // Daily trend (last N days)
  const dailyTrend = db.prepare(`
    SELECT DATE(created_at) as day, COUNT(*) as events, COUNT(DISTINCT user_id) as users
    FROM analytics_events
    WHERE created_at >= ?
    GROUP BY DATE(created_at)
    ORDER BY day ASC
  `).all(since) as any[];

  // Total stats
  const totals = db.prepare(`
    SELECT COUNT(*) as total_events, COUNT(DISTINCT user_id) as total_users, COUNT(DISTINCT feature) as total_features
    FROM analytics_events
    WHERE created_at >= ?
  `).get(since) as any;

  res.json({ days, featureRanking, byFeature, dailyTrend, totals });
});

export default router;
