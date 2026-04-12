import crypto from 'crypto';
import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import db from '../config/db';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const rows = db.prepare(
    `SELECT * FROM incoming_events WHERE user_id = ?
     ORDER BY CASE WHEN expected_date IS NULL THEN 0 ELSE 1 END, expected_date`
  ).all(userId);
  res.json(rows);
});

router.post('/', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { name, estimated_amount, expected_date, is_recurring, recurrence_interval, notes } = req.body;
  if (!name || estimated_amount == null) {
    res.status(400).json({ error: 'validation', message: 'name and estimated_amount required' });
    return;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO incoming_events (id, user_id, name, estimated_amount, expected_date, is_recurring, recurrence_interval, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, name, estimated_amount, expected_date || null, is_recurring ? 1 : 0, recurrence_interval || null, notes || null);

  const row = db.prepare('SELECT * FROM incoming_events WHERE id = ?').get(id);
  res.status(201).json(row);
});

router.put('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const eventId = req.params.id as string;
  const { name, estimated_amount, expected_date, is_recurring, recurrence_interval, notes } = req.body;

  const existing = db.prepare('SELECT * FROM incoming_events WHERE id = ? AND user_id = ?').get(eventId, userId) as any;
  if (!existing) {
    res.status(404).json({ error: 'not_found', message: 'Event not found' });
    return;
  }

  db.prepare(
    `UPDATE incoming_events
     SET name = ?, estimated_amount = ?, expected_date = ?, is_recurring = ?, recurrence_interval = ?, notes = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    name ?? existing.name,
    estimated_amount ?? existing.estimated_amount,
    expected_date !== undefined ? expected_date : existing.expected_date,
    is_recurring !== undefined ? (is_recurring ? 1 : 0) : existing.is_recurring,
    recurrence_interval !== undefined ? recurrence_interval : existing.recurrence_interval,
    notes !== undefined ? notes : existing.notes,
    eventId, userId
  );

  const updated = db.prepare('SELECT * FROM incoming_events WHERE id = ?').get(eventId);
  res.json(updated);
});

router.delete('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const eventId = req.params.id as string;
  const result = db.prepare('DELETE FROM incoming_events WHERE id = ? AND user_id = ?').run(eventId, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'not_found', message: 'Event not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
