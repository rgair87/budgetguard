import db from '../config/db';
import { randomUUID } from 'crypto';

// Create table at module load
db.exec(`CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL NOT NULL DEFAULT 0,
  deadline TEXT,
  icon TEXT DEFAULT '🎯',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  icon: string;
  created_at: string;
  percent: number;
  remaining: number;
  onTrack: boolean | null;
  dailyNeeded: number | null;
  daysLeft: number | null;
}

interface GoalRow {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  icon: string;
  created_at: string;
}

function enrich(row: GoalRow): Goal {
  const remaining = Math.max(0, row.target_amount - row.current_amount);
  const percent = row.target_amount > 0
    ? Math.min(100, Math.round((row.current_amount / row.target_amount) * 100))
    : 0;

  let onTrack: boolean | null = null;
  let dailyNeeded: number | null = null;
  let daysLeft: number | null = null;

  if (row.deadline) {
    const now = new Date();
    const deadline = new Date(row.deadline);
    const msLeft = deadline.getTime() - now.getTime();
    daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    dailyNeeded = daysLeft > 0 ? remaining / daysLeft : remaining > 0 ? Infinity : 0;
    onTrack = remaining === 0 || (daysLeft > 0 && dailyNeeded < Infinity);
  }

  return { ...row, percent, remaining, onTrack, dailyNeeded, daysLeft };
}

export function getGoals(userId: string): Goal[] {
  const rows = db.prepare(
    `SELECT * FROM savings_goals WHERE user_id = ?
     ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC`
  ).all(userId) as unknown as GoalRow[];
  return rows.map(enrich);
}

export function createGoal(
  userId: string,
  data: { name: string; target_amount: number; current_amount?: number; deadline?: string; icon?: string }
): Goal {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO savings_goals (id, user_id, name, target_amount, current_amount, deadline, icon)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, data.name, data.target_amount, data.current_amount ?? 0, data.deadline ?? null, data.icon ?? '🎯');

  const row = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(id) as unknown as GoalRow;
  return enrich(row);
}

export function updateGoal(
  userId: string,
  goalId: string,
  data: Partial<{ name: string; target_amount: number; current_amount: number; deadline: string; icon: string }>
): Goal {
  const existing = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?').get(goalId, userId) as unknown as GoalRow | undefined;
  if (!existing) throw new NotFoundError('Goal not found');

  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length > 0) {
    values.push(goalId, userId);
    db.prepare(`UPDATE savings_goals SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  }

  const row = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(goalId) as unknown as GoalRow;
  return enrich(row);
}

export function deleteGoal(userId: string, goalId: string): void {
  const result = db.prepare('DELETE FROM savings_goals WHERE id = ? AND user_id = ?').run(goalId, userId);
  if (result.changes === 0) throw new NotFoundError('Goal not found');
}

export function addToGoal(userId: string, goalId: string, amount: number): Goal {
  const existing = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?').get(goalId, userId) as unknown as GoalRow | undefined;
  if (!existing) throw new NotFoundError('Goal not found');

  db.prepare('UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = ? AND user_id = ?').run(amount, goalId, userId);

  const row = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(goalId) as unknown as GoalRow;
  return enrich(row);
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
