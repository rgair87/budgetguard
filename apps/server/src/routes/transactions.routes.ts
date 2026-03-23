import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { attachTier, TieredRequest, requirePro } from '../middleware/tier';
import { invalidateCache } from '../utils/cache';
import db from '../config/db';

const router = Router();

// GET /transactions — with search, filtering, pagination
router.get('/', authenticate, (req: TieredRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const search = (req.query.search as string || '').trim();
  const category = req.query.category as string;
  const dateFrom = req.query.dateFrom as string;
  const dateTo = req.query.dateTo as string;

  let where = 't.user_id = ?';
  const params: any[] = [req.userId];

  if (search) {
    where += ' AND (LOWER(t.merchant_name) LIKE ? OR LOWER(t.category) LIKE ?)';
    const s = `%${search.toLowerCase()}%`;
    params.push(s, s);
  }

  if (category) {
    where += ' AND t.category = ?';
    params.push(category);
  }

  if (dateFrom) {
    where += ' AND t.date >= ?';
    params.push(dateFrom);
  }

  if (dateTo) {
    where += ' AND t.date <= ?';
    params.push(dateTo);
  }

  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM transactions t WHERE ${where}`
  ).get(...params) as unknown as any;

  const rows = db.prepare(
    `SELECT t.id, t.amount, t.date, t.merchant_name, t.category, t.is_recurring, a.name as account_name
     FROM transactions t
     JOIN accounts a ON t.account_id = a.id
     WHERE ${where}
     ORDER BY t.date DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  res.json({ transactions: rows, total: countRow.total, limit, offset });
});

// PATCH /transactions/:id — edit transaction category or merchant name
router.patch('/:id', authenticate, (req: TieredRequest, res: Response) => {
  const tx = db.prepare(
    'SELECT id FROM transactions WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId) as unknown as any;

  if (!tx) {
    res.status(404).json({ error: 'not_found', message: 'Transaction not found' });
    return;
  }

  const { category, merchant_name } = req.body;
  if (category) {
    db.prepare('UPDATE transactions SET category = ? WHERE id = ?').run(category, req.params.id);
  }
  if (merchant_name) {
    db.prepare('UPDATE transactions SET merchant_name = ? WHERE id = ?').run(merchant_name, req.params.id);
  }

  invalidateCache(`runway:${req.userId}`);
  invalidateCache(`trends:${req.userId}`);
  invalidateCache(`predictions:${req.userId}`);
  res.json({ success: true });
});

// GET /transactions/export — export as CSV
router.get('/export', authenticate, attachTier, requirePro, (req: TieredRequest, res: Response) => {
  const rows = db.prepare(
    `SELECT t.date, t.merchant_name, t.category, t.amount, t.is_recurring, a.name as account_name
     FROM transactions t
     JOIN accounts a ON t.account_id = a.id
     WHERE t.user_id = ?
     ORDER BY t.date DESC`
  ).all(req.userId) as unknown as any[];

  const header = 'Date,Merchant,Category,Amount,Recurring,Account\n';
  const csv = rows.map(r =>
    `${r.date},"${(r.merchant_name || '').replace(/"/g, '""')}","${r.category || ''}",${r.amount},${r.is_recurring ? 'Yes' : 'No'},"${r.account_name}"`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="runway-transactions.csv"');
  res.send(header + csv);
});

// GET /transactions/categories — list all unique categories for filtering
router.get('/categories', authenticate, (req: TieredRequest, res: Response) => {
  const rows = db.prepare(
    `SELECT DISTINCT category FROM transactions
     WHERE user_id = ? AND category IS NOT NULL AND category != ''
     ORDER BY category`
  ).all(req.userId) as unknown as { category: string }[];

  res.json(rows.map(r => r.category));
});

export default router;
