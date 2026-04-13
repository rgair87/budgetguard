import crypto from 'crypto';
import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { attachTier, TieredRequest, requirePro } from '../middleware/tier';
import { invalidateCache, invalidateUserCache } from '../utils/cache';
import db from '../config/db';
import logger from '../config/logger';
import { guessCategoryFromMerchant, normalizeMerchantKey } from '../services/csv.service';
import { cleanMerchantName } from '../services/merchant-utils';
import { classifyMerchantsWithAI } from '../services/ai-categorize.service';
import { SPEND_EXCLUSION_CATEGORIES, SPEND_EXCLUSION_MERCHANTS } from '../services/runway.service';

const router = Router();

// GET /transactions — with search, filtering, pagination
router.get('/', authenticate, (req: TieredRequest, res: Response) => {
  const userId = req.userId!;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const search = (req.query.search as string || '').trim();
  const category = req.query.category as string;
  const dateFrom = req.query.dateFrom as string;
  const dateTo = req.query.dateTo as string;

  let where = 't.user_id = ?';
  const params: any[] = [userId];

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

  const amountMin = req.query.amountMin ? parseFloat(req.query.amountMin as string) : null;
  const amountMax = req.query.amountMax ? parseFloat(req.query.amountMax as string) : null;
  if (amountMin !== null && !isNaN(amountMin)) {
    where += ' AND ABS(t.amount) >= ?';
    params.push(amountMin);
  }
  if (amountMax !== null && !isNaN(amountMax)) {
    where += ' AND ABS(t.amount) <= ?';
    params.push(amountMax);
  }

  // spendingOnly: filter to only transactions counted as "spending" (exclude transfers, debt, income, etc.)
  const spendingOnly = req.query.spendingOnly === 'true';
  if (spendingOnly) {
    where += ` AND t.amount < 0 AND COALESCE(t.category, '') NOT IN ${SPEND_EXCLUSION_CATEGORIES} ${SPEND_EXCLUSION_MERCHANTS.replace(/merchant_name/g, 't.merchant_name')}`;
  }

  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM transactions t WHERE ${where}`
  ).get(...params) as unknown as any;

  const rows = db.prepare(
    `SELECT t.id, t.amount, t.date, t.merchant_name, t.category, t.subcategory, t.is_recurring, a.name as account_name
     FROM transactions t
     JOIN accounts a ON t.account_id = a.id
     WHERE ${where}
     ORDER BY ${
       req.query.sort === 'amount_desc' ? 'ABS(t.amount) DESC' :
       req.query.sort === 'amount_asc' ? 'ABS(t.amount) ASC' :
       req.query.sort === 'date_asc' ? 't.date ASC' :
       't.date DESC'
     }
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  res.json({ transactions: rows, total: countRow.total, limit, offset });
});

// PATCH /transactions/:id — edit transaction category or merchant name
router.patch('/:id', authenticate, (req: TieredRequest, res: Response) => {
  const userId = req.userId!;
  const transactionId = req.params.id as string;
  const tx = db.prepare(
    'SELECT id FROM transactions WHERE id = ? AND user_id = ?'
  ).get(transactionId, userId) as unknown as any;

  if (!tx) {
    res.status(404).json({ error: 'not_found', message: 'Transaction not found' });
    return;
  }

  const { category, merchant_name, subcategory } = req.body;
  if (subcategory !== undefined) {
    db.prepare('UPDATE transactions SET subcategory = ? WHERE id = ?').run(subcategory || null, transactionId);
  }
  if (category) {
    db.prepare('UPDATE transactions SET category = ? WHERE id = ?').run(category, transactionId);

    // Auto-learn: create a merchant rule and apply to all matching transactions
    const txData = db.prepare('SELECT merchant_name FROM transactions WHERE id = ?').get(transactionId) as { merchant_name: string } | undefined;
    if (txData?.merchant_name) {
      const pattern = normalizeMerchantKey(cleanMerchantName(txData.merchant_name));
      if (pattern && pattern.length >= 3) {
        // Upsert merchant rule with confidence 1.0 (user-confirmed)
        db.prepare(
          `INSERT INTO merchant_categories (id, user_id, merchant_pattern, category, confidence)
           VALUES (?, ?, ?, ?, 1.0)
           ON CONFLICT(user_id, merchant_pattern) DO UPDATE SET category = excluded.category, confidence = 1.0`
        ).run(crypto.randomUUID(), userId, pattern, category);

        // Bulk update all matching transactions from this merchant
        const updated = db.prepare(
          `UPDATE transactions SET category = ?
           WHERE user_id = ? AND id != ?
           AND LOWER(REPLACE(REPLACE(merchant_name, '  ', ' '), '''', '')) LIKE ?`
        ).run(category, userId, transactionId, `%${pattern}%`);

        if (updated.changes > 0) {
          logger.info({ userId, pattern, category, updated: updated.changes }, 'Merchant rule applied to past transactions');
        }
      }
    }
  }
  if (merchant_name) {
    db.prepare('UPDATE transactions SET merchant_name = ? WHERE id = ?').run(merchant_name, transactionId);
  }

  invalidateCache(`runway:${userId}`);
  invalidateCache(`trends:${userId}`);
  invalidateCache(`predictions:${userId}`);
  res.json({ success: true });
});

// GET /transactions/export — export as CSV
router.get('/export', authenticate, attachTier, requirePro, (req: TieredRequest, res: Response) => {
  const userId = req.userId!;
  const rows = db.prepare(
    `SELECT t.date, t.merchant_name, t.category, t.amount, t.is_recurring, a.name as account_name
     FROM transactions t
     JOIN accounts a ON t.account_id = a.id
     WHERE t.user_id = ?
     ORDER BY t.date DESC`
  ).all(userId) as unknown as any[];

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
  const userId = req.userId!;
  const rows = db.prepare(
    `SELECT DISTINCT category FROM transactions
     WHERE user_id = ? AND category IS NOT NULL AND category != ''
     ORDER BY category`
  ).all(userId) as unknown as { category: string }[];

  res.json(rows.map(r => r.category));
});

// POST /transactions/auto-classify — bulk classify uncategorized transactions
router.post('/auto-classify', authenticate, async (req: TieredRequest, res: Response) => {
  try {
    const userId = req.userId!;
    // Get all uncategorized unique merchants
    const rows = db.prepare(
      `SELECT DISTINCT merchant_name FROM transactions
       WHERE user_id = ? AND (category IS NULL OR category = '' OR category = 'Other')
         AND merchant_name IS NOT NULL AND merchant_name != ''`
    ).all(userId) as any[];

    const merchants = rows.map((r: any) => r.merchant_name as string);
    if (merchants.length === 0) {
      res.json({ classified: 0, message: 'All transactions are already classified' });
      return;
    }

    // Load existing mappings
    const knownRows = db.prepare(
      'SELECT merchant_pattern, category, is_bill FROM merchant_categories WHERE user_id = ?'
    ).all(userId) as any[];
    const knownMap = new Map<string, { category: string; isBill: boolean }>();
    for (const mc of knownRows) {
      knownMap.set(mc.merchant_pattern, { category: mc.category, isBill: !!mc.is_bill });
    }

    const updateTxns = db.prepare(
      `UPDATE transactions SET category = ?
       WHERE user_id = ? AND LOWER(REPLACE(merchant_name, '  ', ' ')) = ?`
    );
    const markRecurring = db.prepare(
      `UPDATE transactions SET is_recurring = 1
       WHERE user_id = ? AND LOWER(REPLACE(merchant_name, '  ', ' ')) = ?`
    );
    const upsertMerchant = db.prepare(
      `INSERT INTO merchant_categories (id, user_id, merchant_pattern, category, is_bill)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, merchant_pattern) DO UPDATE SET category = excluded.category, is_bill = excluded.is_bill`
    );

    let classified = 0;
    const needsAI: string[] = [];

    // Pass 1: keyword + known mappings
    for (const name of merchants) {
      const norm = name.toLowerCase().replace(/\s+/g, ' ').trim();
      const known = knownMap.get(norm);
      if (known) {
        updateTxns.run(known.category, userId, norm);
        if (known.isBill) markRecurring.run(userId, norm);
        classified++;
      } else {
        const guess = guessCategoryFromMerchant(name);
        if (guess) {
          updateTxns.run(guess, userId, norm);
          upsertMerchant.run(crypto.randomUUID(), userId, norm, guess, 0);
          classified++;
        } else {
          needsAI.push(name);
        }
      }
    }

    // Pass 2: AI classification
    if (needsAI.length > 0) {
      const aiResults = await classifyMerchantsWithAI(needsAI);
      for (const c of aiResults) {
        if (c.category === 'Other') continue;
        const norm = c.merchantName.toLowerCase().replace(/\s+/g, ' ').trim();
        upsertMerchant.run(crypto.randomUUID(), userId, norm, c.category, c.isBill ? 1 : 0);
        updateTxns.run(c.category, userId, norm);
        if (c.isBill) markRecurring.run(userId, norm);
        classified++;
      }
    }

    invalidateUserCache(userId);
    res.json({ classified, total: merchants.length, message: `Classified ${classified} of ${merchants.length} merchants` });
  } catch (err: any) {
    logger.error({ err }, 'Auto-classify error');
    res.status(500).json({ error: 'classify_error', message: err.message });
  }
});

export default router;
