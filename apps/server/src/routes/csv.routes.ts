import { Router, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { AuthRequest, authenticate } from '../middleware/auth';
import { parseCsv, importCsvTransactions, detectPaySchedule, getRecurringSummary, detectDebtPayments, classifyUnknownMerchantsWithAI } from '../services/csv.service';
import { invalidateAdvisorCache } from '../services/advisor.service';
import db from '../config/db';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

router.post('/preview', authenticate, upload.single('file'), (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'validation', message: 'CSV file required' });
    return;
  }

  try {
    const content = req.file.buffer.toString('utf-8');
    const { rows, preview } = parseCsv(content);
    res.json({ totalRows: rows.length, preview });
  } catch (err: any) {
    res.status(400).json({ error: 'parse_error', message: err.message });
  }
});

router.post('/import', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  if (!req.file) {
    res.status(400).json({ error: 'validation', message: 'CSV file required' });
    return;
  }

  try {
    const content = req.file.buffer.toString('utf-8');
    const { rows } = parseCsv(content);
    const accountId = req.body?.accountId as string | undefined;
    const result = importCsvTransactions(userId, rows, accountId);

    // Auto-fix mis-signed deposits (descriptions that look like income but got flipped to negative)
    const DEPOSIT_FIX_PATTERNS = [
      '%DIRECT DEP%', '%DIR DEP%', '%PAYROLL%', '%SALARY%', '%BONUS%',
      '%TAX REFUND%', '%TAX REF%', '%REFUND%',
      '%CASHBACK%', '%CASH BACK%', '%INTEREST PAID%', '%DIVIDEND%',
      '%VENMO CASHOUT%', '%ZELLE FROM%', '%ACH CREDIT%', '%DEPOSIT%',
      '%MONEYLINE%',
    ];
    let signsFixed = 0;
    for (const pattern of DEPOSIT_FIX_PATTERNS) {
      const r = db.prepare(
        `UPDATE transactions SET amount = ABS(amount)
         WHERE user_id = ? AND amount < 0 AND merchant_name LIKE ?`
      ).run(userId, pattern);
      signsFixed += Number(r.changes);
    }
    for (const cat of ['Income', 'Payroll', 'Direct Deposit', 'Credit', 'Refund']) {
      const r = db.prepare(
        `UPDATE transactions SET amount = ABS(amount)
         WHERE user_id = ? AND amount < 0 AND category = ?`
      ).run(userId, cat);
      signsFixed += Number(r.changes);
    }

    // AI-classify unknown merchants (runs before pattern detection so those benefit from AI categories)
    const merchantNames = rows.map(r => r.description);
    const aiResult = await classifyUnknownMerchantsWithAI(userId, merchantNames);

    // After import + AI classification, detect pay schedule, recurring bills, and debt payments
    const paySchedule = detectPaySchedule(userId);
    const recurringExpenses = getRecurringSummary(userId);
    const detectedDebtPayments = detectDebtPayments(userId);

    // Invalidate advisor cache so next visit generates fresh insights
    invalidateAdvisorCache(userId);

    res.json({ ...result, signsFixed, aiClassified: aiResult.classified, paySchedule, recurringExpenses, detectedDebtPayments });
  } catch (err: any) {
    res.status(400).json({ error: 'import_error', message: err.message });
  }
});

// Fix mis-signed transactions — flip deposits that were incorrectly stored as negative
router.post('/fix-signs', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  // Find negative-amount transactions whose descriptions look like deposits/income
  const DEPOSIT_PATTERNS = [
    '%DIRECT DEP%', '%DIR DEP%', '%PAYROLL%', '%SALARY%', '%BONUS%',
    '%TAX REFUND%', '%TAX REF%', '%REFUND%',
    '%CASHBACK%', '%CASH BACK%', '%INTEREST PAID%', '%DIVIDEND%',
    '%VENMO CASHOUT%', '%ZELLE FROM%', '%ACH CREDIT%', '%DEPOSIT%',
    '%MONEYLINE%',
  ];

  const DEPOSIT_CATEGORIES = ['Income', 'Payroll', 'Direct Deposit', 'Credit', 'Refund'];

  let fixed = 0;

  // Fix by merchant name pattern
  for (const pattern of DEPOSIT_PATTERNS) {
    const result = db.prepare(
      `UPDATE transactions SET amount = ABS(amount)
       WHERE user_id = ? AND amount < 0 AND merchant_name LIKE ?`
    ).run(userId, pattern);
    fixed += Number(result.changes);
  }

  // Fix by category
  for (const cat of DEPOSIT_CATEGORIES) {
    const result = db.prepare(
      `UPDATE transactions SET amount = ABS(amount)
       WHERE user_id = ? AND amount < 0 AND category = ?`
    ).run(userId, cat);
    fixed += Number(result.changes);
  }

  res.json({ fixed, message: `${fixed} transaction(s) corrected from spending to income` });
});

// Remove a merchant from recurring bills
router.post('/recurring/remove', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { merchantName } = req.body;
  if (!merchantName) {
    res.status(400).json({ error: 'validation', message: 'merchantName required' });
    return;
  }

  // Match by exact name or case-insensitive
  const result = db.prepare(
    `UPDATE transactions SET is_recurring = 0
     WHERE user_id = ? AND is_recurring = 1 AND LOWER(merchant_name) = LOWER(?)`
  ).run(userId, merchantName);

  res.json({ removed: result.changes });
});

// Add a detected debt payment as a debt account
router.post('/add-debt', authenticate, (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { name, type, monthlyPayment, balance, interestRate } = req.body;
  if (!name || !type) {
    res.status(400).json({ error: 'validation', message: 'name and type required' });
    return;
  }

  const id = crypto.randomUUID();
  const bal = balance ? Math.abs(parseFloat(balance)) : 0;
  const apr = interestRate ? parseFloat(interestRate) : null;
  const minPay = monthlyPayment ? Math.abs(parseFloat(monthlyPayment)) : null;

  db.prepare(
    `INSERT INTO accounts (id, user_id, name, type, current_balance, interest_rate, minimum_payment)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, name, type, bal, apr, minPay);

  res.json({ id, name, type, current_balance: bal, interest_rate: apr, minimum_payment: minPay });
});

// === Template imports ===

function parseSimpleCsv(content: string): Record<string, string>[] {
  // Strip BOM
  const clean = content.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  }).filter(r => Object.values(r).some(v => v));
}

const TYPE_MAP: Record<string, string> = {
  'credit card': 'credit', 'credit': 'credit', 'cc': 'credit',
  'mortgage': 'mortgage', 'home loan': 'mortgage',
  'auto loan': 'auto_loan', 'car loan': 'auto_loan', 'auto': 'auto_loan',
  'student loan': 'student_loan', 'student': 'student_loan',
  'personal loan': 'personal_loan', 'personal': 'personal_loan', 'loan': 'personal_loan',
};

// Import debts as accounts
router.post('/import-debts', authenticate, upload.single('file'), (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  if (!req.file) { res.status(400).json({ error: 'validation', message: 'CSV file required' }); return; }

  try {
    const rows = parseSimpleCsv(req.file.buffer.toString('utf-8'));
    if (rows.length === 0) { res.status(400).json({ error: 'parse_error', message: 'No data rows found' }); return; }

    let imported = 0;
    const insert = db.prepare(
      `INSERT INTO accounts (id, user_id, name, type, current_balance, interest_rate, minimum_payment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    for (const row of rows) {
      const name = row.name || row.creditor || row.account || '';
      if (!name) continue;
      const type = TYPE_MAP[(row.type || row.account_type || 'credit').toLowerCase()] || 'credit';
      const balance = Math.abs(parseFloat(row.balance || row.amount || row.owed || '0')) || 0;
      const apr = parseFloat(row.apr || row.interest_rate || row.rate || '0') || null;
      const minPay = parseFloat(row.minimum_payment || row.min_payment || row.minimum || '0') || null;

      insert.run(crypto.randomUUID(), userId, name, type, balance, apr, minPay);
      imported++;
    }

    res.json({ imported, message: `${imported} debt account(s) added` });
  } catch (err: any) {
    res.status(400).json({ error: 'import_error', message: err.message });
  }
});

// Import budget categories
router.post('/import-budget', authenticate, upload.single('file'), (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  if (!req.file) { res.status(400).json({ error: 'validation', message: 'CSV file required' }); return; }

  try {
    const rows = parseSimpleCsv(req.file.buffer.toString('utf-8'));
    if (rows.length === 0) { res.status(400).json({ error: 'parse_error', message: 'No data rows found' }); return; }

    let imported = 0;
    const upsert = db.prepare(
      `INSERT INTO budgets (id, user_id, category, monthly_limit)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit`
    );

    for (const row of rows) {
      const category = row.category || row.name || '';
      if (!category) continue;
      const limit = parseFloat(row.monthly_limit || row.limit || row.budget || row.amount || '0');
      if (limit <= 0) continue;

      upsert.run(crypto.randomUUID(), userId, category, limit);
      imported++;
    }

    res.json({ imported, message: `${imported} budget categor${imported === 1 ? 'y' : 'ies'} set` });
  } catch (err: any) {
    res.status(400).json({ error: 'import_error', message: err.message });
  }
});

// Import fixed bills/expenses
router.post('/import-bills', authenticate, upload.single('file'), (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  if (!req.file) { res.status(400).json({ error: 'validation', message: 'CSV file required' }); return; }

  try {
    const rows = parseSimpleCsv(req.file.buffer.toString('utf-8'));
    if (rows.length === 0) { res.status(400).json({ error: 'parse_error', message: 'No data rows found' }); return; }

    let imported = 0;
    const insert = db.prepare(
      `INSERT INTO fixed_expenses (id, user_id, name, amount, frequency)
       VALUES (?, ?, ?, ?, ?)`
    );

    for (const row of rows) {
      const name = row.name || row.bill || row.expense || '';
      if (!name) continue;
      const amount = Math.abs(parseFloat(row.amount || row.cost || row.monthly_amount || '0'));
      if (amount <= 0) continue;
      const freq = (row.frequency || 'monthly').toLowerCase();

      insert.run(crypto.randomUUID(), userId, name, amount, freq);
      imported++;
    }

    res.json({ imported, message: `${imported} bill(s) added` });
  } catch (err: any) {
    res.status(400).json({ error: 'import_error', message: err.message });
  }
});

export default router;
