import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import db from '../config/db';

/**
 * Middleware that updates the user's daily streak on each authenticated request.
 * Debounced to 1 update per day per user via last_active_date check.
 */
export function updateStreak(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.userId) { next(); return; }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const user = db.prepare(
    'SELECT last_active_date, streak_days FROM users WHERE id = ?'
  ).get(req.userId) as { last_active_date: string | null; streak_days: number } | undefined;

  if (!user) { next(); return; }

  // Already updated today — skip
  if (user.last_active_date === today) { next(); return; }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let newStreak: number;

  if (user.last_active_date === yesterday) {
    // Consecutive day — increment
    newStreak = (user.streak_days || 0) + 1;
  } else {
    // Gap — reset to 1
    newStreak = 1;
  }

  db.prepare(
    'UPDATE users SET last_active_date = ?, streak_days = ? WHERE id = ?'
  ).run(today, newStreak, req.userId);

  next();
}
