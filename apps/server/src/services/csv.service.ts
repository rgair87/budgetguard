import crypto from 'crypto';
import db from '../config/db';
import logger from '../config/logger';
import { classifyMerchantsWithAI } from './ai-categorize.service';
import { cleanMerchantName, titleCase, normalizeMerchantName } from './merchant-utils';

interface CsvRow {
  date: string;
  amount: number;
  description: string;
  category: string | null;  // bank-provided category (e.g., "Loans", "Credit Card Payments")
}

// Find the most common value in an array of numbers
function mode(arr: number[]): number {
  const counts = new Map<number, number>();
  for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
  let best = arr[0], bestCount = 0;
  for (const [v, c] of counts) { if (c > bestCount) { best = v; bestCount = c; } }
  return best;
}

// Try to parse any reasonable date string into YYYY-MM-DD
function parseDate(val: string): string | null {
  if (!val) return null;
  const trimmed = val.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) return null;

  // Strip time portions like " 12:00:00 AM" or "T00:00:00"
  const dateOnly = trimmed.split(/[T ]/)[0].trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateOnly)) {
    const d = new Date(dateOnly + 'T00:00:00');
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  // MM/DD/YYYY or M/D/YYYY or MM-DD-YYYY
  const slashMatch = dateOnly.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    let [, month, day, year] = slashMatch;
    // Handle 2-digit year
    if (year.length === 2) {
      const y = parseInt(year);
      year = (y > 50 ? '19' : '20') + year;
    }
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }

  // Last resort: try native parser
  const d = new Date(trimmed);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1990 && d.getFullYear() < 2100) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

function parseAmount(val: string): number | null {
  if (!val) return null;
  const cleaned = val.trim().replace(/^["']|["']$/g, '').replace(/[$,\s]/g, '');
  if (!cleaned || cleaned === '-') return null;

  // Handle parentheses as negative: (45.67) → -45.67
  const parenMatch = cleaned.match(/^\((.+)\)$/);
  if (parenMatch) {
    const num = parseFloat(parenMatch[1]);
    return isNaN(num) ? null : -num;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

interface ColumnMapping {
  dateCol: number;
  amountCol: number;
  debitCol: number;   // -1 if not separate
  creditCol: number;  // -1 if not separate
  descCol: number;
  categoryCol: number; // -1 if not present
  typeCol: number;     // -1 if not present — "Debit"/"Credit" indicator column
}

function detectColumns(headers: string[]): ColumnMapping | null {
  const lower = headers.map(h => h.toLowerCase().trim().replace(/^["']|["']$/g, ''));

  // Date column — try specific first, then general
  let dateCol = lower.findIndex(h => h === 'transaction date' || h === 'trans date' || h === 'posting date' || h === 'post date');
  if (dateCol === -1) dateCol = lower.findIndex(h => h === 'date');
  if (dateCol === -1) dateCol = lower.findIndex(h => h.includes('date'));

  // Amount — look for single amount column
  let amountCol = lower.findIndex(h => h === 'amount');
  if (amountCol === -1) amountCol = lower.findIndex(h => h.includes('amount') && !h.includes('balance'));

  // Separate debit/credit columns (BofA, Wells Fargo, etc.)
  let debitCol = -1;
  let creditCol = -1;
  if (amountCol === -1) {
    debitCol = lower.findIndex(h => h === 'debit' || h === 'withdrawal' || h === 'withdrawals');
    creditCol = lower.findIndex(h => h === 'credit' || h === 'deposit' || h === 'deposits');
    // If we found debit, use it as the primary amount column
    if (debitCol !== -1) amountCol = debitCol;
  }

  // Description column
  let descCol = lower.findIndex(h => h === 'description' || h === 'original description');
  if (descCol === -1) descCol = lower.findIndex(h =>
    h.includes('description') || h.includes('memo') || h.includes('merchant') ||
    h.includes('payee') || h.includes('narrative') || h.includes('details')
  );
  if (descCol === -1) descCol = lower.findIndex(h => h.includes('name') && !h.includes('file'));

  // Type column — indicates "Debit"/"Credit" direction (Chase, Capital One, etc.)
  // Must detect BEFORE category to avoid misidentifying it
  let typeCol = lower.findIndex(h => h === 'transaction type' || h === 'trans type');
  if (typeCol === -1) typeCol = lower.findIndex(h => h === 'type' && !h.includes('account'));

  // Category column (bank-provided categories like "Loans", "Groceries", "Credit Card Payments")
  let categoryCol = lower.findIndex(h => h === 'category' || h === 'transaction category' || h === 'trans category');
  if (categoryCol === -1) categoryCol = lower.findIndex(h => h.includes('category') && !h.includes('sub'));

  // If we still can't find date or amount, fail
  if (dateCol === -1 || amountCol === -1) return null;

  // If no description column, pick the first text column that isn't date/amount
  if (descCol === -1) {
    descCol = lower.findIndex((_, i) => i !== dateCol && i !== amountCol && i !== debitCol && i !== creditCol && i !== categoryCol && i !== typeCol);
  }

  return { dateCol, amountCol, debitCol, creditCol, descCol, categoryCol, typeCol };
}

function splitRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += char;
  }
  result.push(current.trim());
  return result;
}

export function parseCsv(content: string): { rows: CsvRow[]; preview: string[][] } {
  // Strip BOM if present
  const clean = content.replace(/^\uFEFF/, '');
  const lines = clean.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  const headers = splitRow(lines[0]);
  const mapping = detectColumns(headers);
  if (!mapping) {
    throw new Error(
      `Could not detect columns. Found headers: ${headers.join(', ')}. ` +
      `Need at least a date column and an amount column.`
    );
  }

  const rows: CsvRow[] = [];
  const preview: string[][] = [headers];

  // Check if there's a type column that tells us debit vs credit
  // Sample values to see if they contain "debit"/"credit" indicators
  let typeColIsDirection = false;
  if (mapping.typeCol !== -1) {
    for (let i = 1; i <= Math.min(10, lines.length - 1); i++) {
      const cols = splitRow(lines[i]);
      const typeVal = (cols[mapping.typeCol] || '').toLowerCase().trim();
      if (/^(debit|credit|deposit|withdrawal|deb|cre|dr|cr)$/i.test(typeVal)) {
        typeColIsDirection = true;
        break;
      }
    }
  }

  // Detect if the "Amount" column has sign convention (negative = spending, positive = income)
  // by sampling a few rows
  let hasNegativeAmounts = false;
  let hasPositiveAmounts = false;
  const sampleSize = Math.min(20, lines.length - 1);
  for (let i = 1; i <= sampleSize; i++) {
    const cols = splitRow(lines[i]);
    const amt = parseAmount(cols[mapping.amountCol] || '');
    if (amt !== null && amt < 0) hasNegativeAmounts = true;
    if (amt !== null && amt > 0) hasPositiveAmounts = true;
  }
  // If amounts are mixed (positive AND negative), the CSV already uses sign convention
  const amountsHaveSign = hasNegativeAmounts && hasPositiveAmounts;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    if (i <= 5) preview.push(cols);

    const date = parseDate(cols[mapping.dateCol] || '');
    const description = (cols[mapping.descCol] || 'Unknown').replace(/^["']|["']$/g, '');
    const category = mapping.categoryCol !== -1
      ? (cols[mapping.categoryCol] || '').replace(/^["']|["']$/g, '').trim() || null
      : null;

    let amount: number | null = null;

    if (mapping.debitCol !== -1 && mapping.creditCol !== -1) {
      // Separate debit/credit columns
      const debit = parseAmount(cols[mapping.debitCol] || '');
      const credit = parseAmount(cols[mapping.creditCol] || '');
      if (debit !== null && debit !== 0) {
        amount = -Math.abs(debit); // debits are spending
      } else if (credit !== null && credit !== 0) {
        amount = Math.abs(credit); // credits are income
      }
    } else {
      // Single amount column
      amount = parseAmount(cols[mapping.amountCol] || '');
      if (amount !== null && typeColIsDirection && mapping.typeCol !== -1) {
        // Use the type column to determine sign
        const typeVal = (cols[mapping.typeCol] || '').toLowerCase().trim();
        const isCredit = /^(credit|deposit|cre|cr)$/i.test(typeVal);
        const isDebit = /^(debit|withdrawal|deb|dr)$/i.test(typeVal);
        if (isDebit) {
          amount = -Math.abs(amount); // spending
        } else if (isCredit) {
          amount = Math.abs(amount); // income/deposit
        }
      } else if (amount !== null && !amountsHaveSign) {
        // All positive amounts and no type column
        // Check if description looks like income/deposit/refund — keep positive
        const descLower = description.toLowerCase();
        const isLikelyDeposit = /\b(direct dep|dir dep|payroll|salary|bonus|tax refund|tax ref|deposit|refund|cashback|cash back|interest paid|dividend|venmo cashout|zelle from|ach credit|debit card credit|moneyline)\b/i.test(descLower)
          || (category && /^(income|payroll|direct deposit|credit|refund)$/i.test(category));
        if (isLikelyDeposit) {
          amount = Math.abs(amount); // keep as income
        } else {
          amount = -Math.abs(amount); // spending
        }
      }
      // If amounts have sign, keep as-is (negative = spending, positive = income)
    }

    if (date && amount !== null && amount !== 0) {
      // Clean up raw bank descriptions into readable merchant names
      const cleanedName = normalizeMerchantName(titleCase(cleanMerchantName(description)));
      rows.push({ date, amount, description: cleanedName, category });
    }
  }

  return { rows, preview };
}

export function importCsvTransactions(userId: string, rows: CsvRow[], targetAccountId?: string) {
  let account: any;

  if (targetAccountId) {
    account = db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(targetAccountId, userId);
    if (!account) throw new Error('Account not found');
  } else {
    account = db.prepare(
      "SELECT id FROM accounts WHERE user_id = ? AND name = 'CSV Import'"
    ).get(userId);

    if (!account) {
      const accountId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO accounts (id, user_id, name, type, current_balance)
         VALUES (?, ?, 'CSV Import', 'checking', 0)`
      ).run(accountId, userId);
      account = { id: accountId };
    }
  }

  // Use a hash of date+amount+description to prevent duplicates
  const existing = new Set<string>();
  const existingRows = db.prepare(
    'SELECT date, amount, merchant_name FROM transactions WHERE account_id = ?'
  ).all(account.id) as any[];
  for (const r of existingRows) {
    existing.add(`${r.date}|${r.amount}|${r.merchant_name}`);
  }

  const insert = db.prepare(
    `INSERT INTO transactions (id, user_id, account_id, amount, date, merchant_name, category, is_recurring)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
  );

  // Also prepare a statement to backfill categories on existing transactions that have null category
  const backfillCategory = db.prepare(
    `UPDATE transactions SET category = ?
     WHERE account_id = ? AND date = ? AND amount = ? AND merchant_name = ? AND category IS NULL`
  );

  let imported = 0;
  let skippedDupes = 0;
  let categoriesBackfilled = 0;
  for (const row of rows) {
    const key = `${row.date}|${row.amount}|${row.description}`;
    if (existing.has(key)) {
      // Even for dupes, backfill the category if the CSV provides one and the DB doesn't have it
      if (row.category) {
        const result = backfillCategory.run(row.category, account.id, row.date, row.amount, row.description);
        if (result.changes > 0) categoriesBackfilled++;
      }
      skippedDupes++;
      continue;
    }
    existing.add(key);
    insert.run(crypto.randomUUID(), userId, account.id, row.amount, row.date, row.description, row.category);
    imported++;
  }

  // Don't auto-compute balance — let the user enter their real balance
  // (CSV transactions are a partial view, summing them gives a wrong number)

  // After import, detect recurring transactions
  const recurringCount = detectAndFlagRecurring(userId);

  return { imported, skippedDupes, categoriesBackfilled, accountId: account.id, recurringDetected: recurringCount };
}

// Merchants that are variable spending, NOT fixed bills
const NOT_BILL_KEYWORDS = [
  // Gas stations
  'gas', 'shell', 'exxon', 'chevron', 'bp ', 'marathon', 'citgo', 'sunoco', 'valero', 'speedway', 'racetrac', 'wawa', 'quiktrip', 'fuel', 'buc-ee', 'bucee',
  // Grocery stores
  'grocery', 'groceries', 'walmart', 'target', 'costco', 'kroger', 'heb', 'publix', 'aldi', 'trader joe', 'whole foods', 'safeway', 'food lion', 'winco', 'meijer', 'sam\'s club', 'sams club',
  // Restaurants & fast food
  'restaurant', 'chipotle', 'mcdonald', 'chick-fil', 'starbucks', 'dunkin', 'taco bell', 'wendy', 'burger', 'pizza', 'subway', 'panda express', 'sonic', 'whataburger',
  'wingstop', 'wing stop', 'popeyes', 'five guys', 'in-n-out', 'jack in the box', 'arby', 'dairy queen', 'ihop', 'denny', 'waffle house', 'cracker barrel',
  'olive garden', 'applebee', 'chili\'s', 'outback', 'red lobster', 'texas roadhouse', 'buffalo wild', 'hooters', 'noodles',
  'cafe', 'coffee', 'bakery', 'diner', 'grill', 'tavern', 'pub ', 'bar ', 'brewery', 'bistro', 'lilly', 'joe\'s',
  // Delivery
  'doordash', 'grubhub', 'uber eats', 'ubereats', 'postmates', 'instacart',
  // Rideshare
  'uber trip', 'lyft',
  // POS systems (restaurants/retail)
  'sq *', 'tst*', 'clover*',
  // Retail / shopping
  'amazon', 'amzn', 'best buy', 'hobby', 'home depot', 'lowes', 'lowe\'s', 'tj maxx', 'marshalls', 'ross ', 'old navy', 'gap ', 'zara',
  // Healthcare / medical (visits, not subscriptions)
  'infusion', 'clinic', 'medical', 'dr ', 'doctor', 'dental', 'dentist', 'urgent care', 'hospital', 'pharmacy', 'cvs', 'walgreen',
  'labcorp', 'quest diag', 'renu', 'therapy', 'chiro', 'orthoped', 'dermat', 'optom', 'vision',
  // Gaming / entertainment
  'roblox', 'gemmint', 'century games', 'steam', 'playstation', 'xbox', 'nintendo',
  // Social / misc
  'facebooktec', 'facebook', 'tinder', 'bumble', 'hinge',
  'printerval',
  // Generic short names that are likely not bills
  'home', 'shop', 'store', 'market',
];

// One-time payment patterns — these are usually annual/one-off, not monthly bills
const ONE_TIME_KEYWORDS = [
  'hoa', 'homeowner', 'association',
  'tax', 'irs ', 'treas', 'tax ref',
  'dmv', 'registration', 'vehreg', 'vehicle reg',
  'court', 'attorney', 'legal',
  'deposit', 'down payment',
  'best buy', 'home depot', 'lowes',
  'corporate filing', 'filing',
  'camp bow wow',    // pet boarding = variable
];

// Debt/loan payments — tracked separately as debt accounts, not bills
const DEBT_PAYMENT_KEYWORDS = [
  'auto pay', 'autopay', 'auto pymt',
  'credit crd', 'credit card',
  'loan paymt', 'loan payment', 'loan pymt',
  'loan pay',
  'capital one auto', 'capital one crcardpmt',
  'sofi bank', 'sofi ',
  'discover e-payment', 'discover e payment',
  'chase credit', 'citi autopay',
  'home depot auto pymt',  // Home Depot credit card payment
  'wf credit card', 'wells fargo',
  'tjx rewards', 'jcpenny', 'jcpenney',
  'bank of america online pmt',
  'bankers healthca',      // Bankers Healthcare Group — loan payment
  'initium professi',      // Initium Professional — loan/legal payment
  'e-payment ach',
  // Modern lenders & BNPL
  'affirm', 'klarna', 'afterpay', 'zip pay', 'sezzle',
  'upstart', 'lightstream', 'prosper', 'lending club', 'lendingclub',
  'avant', 'upgrade', 'best egg', 'bestegg', 'payoff',
  'navient', 'nelnet', 'sallie mae', 'mohela', 'fedloan', 'great lakes',
  'psecu', 'penfed', 'navy federal',
  // Common credit card issuers
  'synchrony', 'barclays', 'amex', 'american express',
  'apple card', 'goldman sachs',
];

// Transfers between own accounts, not real expenses
// NOTE: Don't include 'xfer ach web' — PayPal uses "INST XFER ACH WEB" for real bill payments
const TRANSFER_KEYWORDS = [
  'ext trnsfr', 'int trnsfr', 'internal transfer',
  'acct xfer',  // PSECU ACCT XFER, bank account transfers
  'zelle', 'cash app', 'venmo',
];

// Bank categories that are definitely bills (not variable spending)
const BILL_CATEGORIES = [
  'utilities', 'insurance', 'phone', 'internet', 'cable',
  'subscriptions and renewals', 'subscriptions', 'other bills',
];

// Bank categories that are NOT bills (variable spending or one-time)
const NOT_BILL_CATEGORIES = [
  'restaurants and dining', 'restaurants', 'dining',
  'groceries', 'grocery',
  'gas and fuel', 'gas', 'fuel',
  'general merchandise', 'shopping',
  'entertainment', // could be subscriptions OR one-time, so let keyword filter handle it
  'travel',
  'clothing and shoes', 'clothing',
  'healthcare', 'health',
  'home improvement',
  'personal expenses',
  'electronics',
  'pets and pet care',
  'deposits', 'transfers',
  'loans', 'credit card payments', // debt, tracked separately (mortgage stays as bill)
];

function isBillMerchant(merchantName: string, bankCategory?: string | null): boolean {
  const lower = merchantName.toLowerCase();
  const cat = (bankCategory || '').toLowerCase().trim();

  // Skip transfers
  if (TRANSFER_KEYWORDS.some(kw => lower.includes(kw))) return false;
  if (cat === 'transfers' || cat === 'deposits') return false;

  // Skip debt/loan payments (tracked separately as debt accounts)
  if (DEBT_PAYMENT_KEYWORDS.some(kw => lower.includes(kw))) return false;
  if (DEBT_CATEGORIES.some(dc => cat === dc || (cat && cat.includes(dc)))) return false;

  // If bank says it's a bill category, trust it (overrides keyword filters)
  if (cat && BILL_CATEGORIES.some(bc => cat === bc || cat.includes(bc))) return true;

  // Skip variable spending
  if (NOT_BILL_KEYWORDS.some(kw => lower.includes(kw))) return false;

  // Skip likely one-time payments
  if (ONE_TIME_KEYWORDS.some(kw => lower.includes(kw))) return false;

  return true;
}

// Scan transactions and flag recurring ones (same merchant, similar amount, regular intervals)
export function detectAndFlagRecurring(userId: string): number {
  // Reset all recurring flags first so re-imports don't accumulate
  db.prepare('UPDATE transactions SET is_recurring = 0 WHERE user_id = ? AND is_recurring = 1').run(userId);

  // Get all transactions from last 90 days grouped by merchant (include category)
  const txns = db.prepare(
    `SELECT id, date, amount, merchant_name, category FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
     ORDER BY merchant_name, date`
  ).all(userId) as any[];

  // Group by normalized merchant name
  const byMerchant = new Map<string, typeof txns>();
  for (const t of txns) {
    if (!t.merchant_name) continue;

    // Skip merchants that are variable spending or transfers (use bank category if available)
    if (!isBillMerchant(t.merchant_name, t.category)) continue;

    // Normalize: lowercase, strip numbers/special chars, trim
    let key = t.merchant_name.toLowerCase()
      .replace(/\d{4,}/g, '') // strip long numbers (transaction IDs, phone numbers)
      .replace(/[#*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s+(payment|pymt|pmt|autopay|auto pay|bill pay)$/i, ''); // strip payment suffixes

    // PayPal subscriptions include unique session IDs (e.g. "SPOTIFY*P3FFA47") — strip them
    // so all payments to the same service group together
    if (key.includes('paypal')) {
      key = key
        .replace(/\*[a-z0-9]+$/i, '')      // strip trailing *ID (e.g. SPOTIFY*P3FFA47)
        .replace(/\s+[a-z]\d{3,}[a-z0-9]*$/i, '') // strip trailing session codes
        .replace(/\s+x\d+/g, '')           // strip x1234 account references
        .trim();
    }
    // Strip common bank description prefixes and suffixes
    key = key
      .replace(/^(debit card purchase|recurring debit card|pos purchase|pos return)\s*/i, '')
      .replace(/\s*x{4,}\d*\s*/g, ' ')    // strip masked card numbers (xxxxxxxxxxxxxxxx8139)
      .replace(/\s*card\d*/gi, '')          // strip CARD8139 references
      .replace(/\s+\d{3}-[a-z]{3}\d+/gi, '') // strip phone-like numbers (325-xxx7259)
      // Strip ACH transfer type suffixes and trailing transaction/reference IDs
      .replace(/\s+ach\s+(web|debit|credit|tel)[-\s]*(recur|single|ppd)?\s*/gi, ' ')
      .replace(/\s+ach\s+(web|debit|credit|tel)\s*/gi, ' ')
      .replace(/\s+[a-z]{2}\d[a-z0-9]{6,}/gi, '')  // trailing transaction IDs
      .replace(/\s+[a-z]{2,3}x[a-z0-9]+/gi, '')     // trailing masked IDs
      .replace(/\s+[a-z]{2}$/i, '')         // strip trailing state code (TX, CA, NY)
      .replace(/\s+/g, ' ')
      .trim();
    if (!key || key.length < 3) continue;
    const existing = byMerchant.get(key) || [];
    existing.push(t);
    byMerchant.set(key, existing);
  }

  const updateStmt = db.prepare('UPDATE transactions SET is_recurring = 1 WHERE id = ?');
  let flagged = 0;

  for (const [merchant, txnList] of byMerchant) {
    // Require at least 3 transactions to consider recurring
    // (2 is too easy to match by coincidence — two visits to the same restaurant a month apart)
    if (txnList.length < 3) continue;

    // Skip merchants with very short names (too generic, high false positive rate)
    if (merchant.length < 4) continue;

    // Group by similar amounts (within 10% — tighter than before to reduce false positives)
    const amtGroups: { amount: number; txns: typeof txnList }[] = [];
    for (const t of txnList) {
      const absAmt = Math.abs(t.amount);
      if (absAmt < 5) continue; // Skip tiny charges
      const match = amtGroups.find(g => {
        const diff = Math.abs(g.amount - absAmt);
        return diff / g.amount < 0.10;
      });
      if (match) {
        match.txns.push(t);
      } else {
        amtGroups.push({ amount: absAmt, txns: [t] });
      }
    }

    for (const grp of amtGroups) {
      if (grp.txns.length < 3) continue;

      // Require transactions span at least 2 distinct calendar months
      const months = new Set(grp.txns.map((t: any) => t.date.substring(0, 7)));
      if (months.size < 2) continue;

      const sorted = grp.txns.sort((a: any, b: any) => a.date.localeCompare(b.date));
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const diff = Math.round(
          (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / (1000 * 60 * 60 * 24)
        );
        intervals.push(diff);
      }

      if (intervals.length === 0) continue;
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

      // Check interval-based pattern (must be consistent)
      const isIntervalRecurring = (avgInterval >= 5 && avgInterval <= 9) ||   // weekly
                                  (avgInterval >= 12 && avgInterval <= 16) ||  // biweekly
                                  (avgInterval >= 25 && avgInterval <= 35);    // monthly

      // Also check day-of-month pattern
      const daysOfMonth = sorted.map((t: any) => new Date(t.date).getDate());
      const mostCommonDay = mode(daysOfMonth);
      const nearSameDay = daysOfMonth.filter(d => Math.abs(d - mostCommonDay) <= 2).length;
      const isSameDayOfMonth = nearSameDay >= Math.ceil(daysOfMonth.length * 0.7) && grp.txns.length >= 3;

      if (isIntervalRecurring || isSameDayOfMonth) {
        for (const t of grp.txns) {
          updateStmt.run(t.id);
          flagged++;
        }
      }
    }
  }

  return flagged;
}

// Clean up ugly bank descriptions into readable merchant names
function cleanMerchantDisplay(raw: string): string {
  let name = raw
    // Strip bank description prefixes
    .replace(/^(DEBIT CARD PURCHASE|RECURRING DEBIT CARD|POS PURCHASE|POS RETURN)\s*/i, '')
    // Strip masked card numbers (xxxxxxxxxxxxxxxx8139)
    .replace(/x{4,}\d*\s*/g, '')
    // Strip CARD8139 references
    .replace(/\s*CARD\d*/gi, '')
    // Strip phone numbers (936-xxx4070, 325-xxx7259, 800-xxx6687)
    .replace(/\s+\d{3}-[a-z]{3}\d+/gi, '')
    // Strip trailing state codes (TX, CA, NY)
    .replace(/\s+[A-Z]{2}$/i, '')
    // Strip city names if they come after the merchant name (CONROE, HOUSTON, etc.)
    .replace(/\s+(CONROE|HOUSTON|MIDLAND|ODESSA|WILLIS|SPRING|TOMBALL|SHENANDOAH|MONTGOMERY)\s*$/i, '')
    // Strip PayPal wrapper for subscriptions
    .replace(/^PAYPAL INST XFER ACH WEB\s*/i, '')
    // Strip "ACH DEBIT" / "ACH WEB-RECUR" and everything after
    .replace(/\s+ACH\s+(DEBIT|CREDIT|WEB|TEL).*$/i, '')
    // Strip PayPal session IDs (e.g., *P3FFA47, *S695D6QP3)
    .replace(/\*[A-Z0-9]+$/i, '')
    // Strip trailing masked numbers
    .replace(/\s+x+\d*\s*$/i, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Title case
  if (name === name.toUpperCase() || name === name.toLowerCase()) {
    name = name.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
  }

  return name || raw;
}

// Normalize merchant key for grouping (same logic as detectAndFlagRecurring)
export function normalizeMerchantKey(merchantName: string): string {
  let key = merchantName.toLowerCase()
    .replace(/\d{4,}/g, '')
    .replace(/[#*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(payment|pymt|pmt|autopay|auto pay|bill pay)$/i, '');

  // PayPal session IDs
  if (key.includes('paypal')) {
    key = key
      .replace(/\*[a-z0-9]+$/i, '')
      .replace(/\s+[a-z]\d{3,}[a-z0-9]*$/i, '')
      .replace(/\s+x\d+/g, '')
      .trim();
  }
  // Strip bank prefixes & card numbers for consistent grouping
  key = key
    .replace(/^(debit card purchase|recurring debit card|pos purchase|pos return)\s*/i, '')
    .replace(/\s*x{4,}\d*\s*/g, ' ')
    .replace(/\s*card\d*/gi, '')
    .replace(/\s+\d{3}-[a-z]{3}\d+/gi, '')
    // Strip ACH transfer type suffixes and trailing transaction/reference IDs
    .replace(/\s+ach\s+(web|debit|credit|tel)[-\s]*(recur|single|ppd)?\s*/gi, ' ')
    .replace(/\s+ach\s+(web|debit|credit|tel)\s*/gi, ' ')
    .replace(/\s+[a-z0-9]*x{2,}[a-z0-9]*/gi, '')   // trailing masked account numbers (Txxxx4744, CKFxxxxx1188POS)
    .replace(/\s+[a-z0-9]{2,5}x[a-z0-9]+/gi, '')  // trailing masked IDs like CAx3872F952F89F, DP00Ax...
    .replace(/\s+[a-z]{1,3}\d[a-z0-9]{5,}/gi, '') // trailing transaction IDs like DP0DC0A0D56DB8F
    .replace(/\s+[a-z]{1,3}$/i, '')                // trailing short codes (T, POS, etc.)
    .replace(/\s+[a-z]{2}$/i, '')                   // trailing state code (TX, CA, NY)
    .replace(/\s+/g, ' ')
    .trim();

  return key;
}

// Get a summary of detected recurring expenses for display
export function getRecurringSummary(userId: string): { name: string; monthlyAmount: number; frequency: string }[] {
  const rows = db.prepare(
    `SELECT merchant_name, amount, date, category FROM transactions
     WHERE user_id = ? AND amount < 0 AND is_recurring = 1
     AND date >= date('now', '-90 days')
     ORDER BY merchant_name, date`
  ).all(userId) as any[];

  if (rows.length === 0) return [];

  // Group by normalized merchant name, skip non-bills
  const byMerchant = new Map<string, { displayName: string; total: number; count: number; dates: string[] }>();
  for (const r of rows) {
    const raw = r.merchant_name || 'Unknown';
    if (!isBillMerchant(raw, r.category)) continue;
    const key = normalizeMerchantKey(raw);
    const existing = byMerchant.get(key) || { displayName: cleanMerchantDisplay(raw), total: 0, count: 0, dates: [] };
    existing.total += Math.abs(r.amount);
    existing.count++;
    existing.dates.push(r.date);
    byMerchant.set(key, existing);
  }

  // Calculate actual months of data span for accurate monthly amount
  let dataMonths = 3;
  if (rows.length > 0) {
    const dates = rows.map(r => r.date).sort();
    const earliest = new Date(dates[0] + 'T00:00:00');
    const latest = new Date(dates[dates.length - 1] + 'T00:00:00');
    const daySpan = Math.max(1, Math.round((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    dataMonths = Math.max(1, daySpan / 30);
  }

  const result: { name: string; monthlyAmount: number; frequency: string }[] = [];
  for (const [, data] of byMerchant) {
    const monthlyAmount = Math.round((data.total / dataMonths) * 100) / 100;
    if (monthlyAmount < 1) continue;

    // Guess frequency from count vs months
    let frequency = 'monthly';
    const perMonth = data.count / dataMonths;
    if (perMonth >= 3.5) frequency = 'weekly';
    else if (perMonth >= 1.8) frequency = 'biweekly';
    else if (perMonth >= 0.8) frequency = 'monthly';

    result.push({ name: data.displayName, monthlyAmount, frequency });
  }

  return result.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

// Bank-provided categories that indicate debt/loan payments
const DEBT_CATEGORIES = [
  'loans', 'loan', 'loan payment', 'loan payments',
  'credit card payments', 'credit card payment',
  'mortgage', 'mortgages',
];

// Detect debt/loan payments from transactions and suggest adding them as debt accounts
export function detectDebtPayments(userId: string): {
  merchantName: string;
  displayName: string;
  suggestedType: string;
  monthlyAmount: number;
  occurrences: number;
  lastPaymentDate: string;
}[] {
  // Get all spending transactions from last 90 days — include category column
  const txns = db.prepare(
    `SELECT merchant_name, amount, date, category FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
     ORDER BY merchant_name, date`
  ).all(userId) as any[];

  if (txns.length === 0) return [];

  // Check which debt accounts already exist for this user
  const existingDebts = db.prepare(
    "SELECT LOWER(name) as name FROM accounts WHERE user_id = ? AND type IN ('credit', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan')"
  ).all(userId) as any[];
  const existingDebtNames = new Set(existingDebts.map((d: any) => d.name));

  // Find transactions matching debt payment keywords OR bank-provided debt categories
  const debtTxns: Array<(typeof txns)[number]> = [];
  for (const t of txns) {
    if (!t.merchant_name) continue;
    const lower = t.merchant_name.toLowerCase();
    const cat = (t.category || '').toLowerCase().trim();

    // Primary signal: bank-provided category says it's a loan/credit card/mortgage payment
    const hasBankCategory = cat && DEBT_CATEGORIES.some(dc => cat === dc || cat.includes(dc));

    // Secondary signal: merchant name matches debt payment keywords
    const hasKeyword = DEBT_PAYMENT_KEYWORDS.some(kw => lower.includes(kw));

    if (hasBankCategory || hasKeyword) {
      debtTxns.push(t);
    }
  }

  if (debtTxns.length === 0) return [];

  // Group by normalized merchant key
  const byMerchant = new Map<string, { raw: string; total: number; count: number; dates: string[]; amounts: number[]; bankCategory: string | null }>();
  for (const t of debtTxns) {
    const key = normalizeMerchantKey(t.merchant_name);
    const existing = byMerchant.get(key) || {
      raw: t.merchant_name,
      total: 0,
      count: 0,
      dates: [],
      amounts: [],
      bankCategory: t.category || null,
    } as {
      raw: string;
      total: number;
      count: number;
      dates: string[];
      amounts: number[];
      bankCategory: string | null;
    };
    existing.total += Math.abs(t.amount);
    existing.count++;
    existing.dates.push(t.date);
    existing.amounts.push(Math.abs(t.amount));
    // Keep the most specific bank category (prefer non-null)
    if (!existing.bankCategory && t.category) existing.bankCategory = t.category;
    byMerchant.set(key, existing);
  }

  // Calculate actual data span for monthly amount
  let dataMonths = 3;
  if (debtTxns.length > 0) {
  const allDates = debtTxns.map(t => t.date).sort();
  const earliest = new Date(`${allDates[0]}T00:00:00`);
  const latest = new Date(`${allDates[allDates.length - 1]}T00:00:00`);
    const daySpan = Math.max(1, Math.round((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    dataMonths = Math.max(1, daySpan / 30);
  }

  const results: {
    merchantName: string;
    displayName: string;
    suggestedType: string;
    monthlyAmount: number;
    occurrences: number;
    lastPaymentDate: string;
  }[] = [];

  for (const [key, data] of byMerchant) {
    if (data.count < 2) continue; // need at least 2 payments to suggest

    const displayName = cleanMerchantDisplay(data.raw);
    const monthlyAmount = Math.round((data.total / dataMonths) * 100) / 100;
    if (monthlyAmount < 20) continue; // too small to be a real debt payment

    // Skip if user already has this debt account (fuzzy name match)
    const lowerDisplay = displayName.toLowerCase();
    const lowerKey = key.toLowerCase();
    let alreadyExists = false;
    for (const existing of existingDebtNames) {
      if (lowerDisplay.includes(existing) || existing.includes(lowerDisplay) ||
          lowerKey.includes(existing) || existing.includes(lowerKey)) {
        alreadyExists = true;
        break;
      }
    }
    if (alreadyExists) continue;

    // Guess the debt type from the merchant name + bank category
    const suggestedType = guessDebtType(data.raw, data.bankCategory);

    const sortedDates = [...data.dates].sort();
    const lastPaymentDate = sortedDates[sortedDates.length - 1];

    // Use the mode/most common payment amount (more accurate than average)
    const roundedAmounts = data.amounts.map(a => Math.round(a * 100) / 100);
    const amountCounts = new Map<number, number>();
    for (const a of roundedAmounts) amountCounts.set(a, (amountCounts.get(a) || 0) + 1);
    let typicalAmount = roundedAmounts[0];
    let bestCount = 0;
    for (const [amt, cnt] of amountCounts) {
      if (cnt > bestCount) { typicalAmount = amt; bestCount = cnt; }
    }

    // Skip variable-amount payments (like credit cards where you pay different amounts each month)
    // A fixed loan payment should be very consistent — same amount ±5% each time
    const minAmt = Math.min(...roundedAmounts);
    const maxAmt = Math.max(...roundedAmounts);
    if (minAmt > 0 && maxAmt / minAmt > 2) continue; // amounts vary by more than 2x = variable payment, skip

    results.push({
      merchantName: data.raw,
      displayName,
      suggestedType,
      monthlyAmount: typicalAmount,
      occurrences: data.count,
      lastPaymentDate,
    });
  }

  return results.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

function guessDebtType(merchantName: string, bankCategory?: string | null): string {
  const lower = merchantName.toLowerCase();
  const cat = (bankCategory || '').toLowerCase().trim();

  // Bank category is the strongest signal — use it first
  if (cat.includes('mortgage')) return 'mortgage';
  if (cat === 'credit card payments' || cat === 'credit card payment') return 'credit';
  if (cat.includes('student')) return 'student_loan';
  // "Loans" category alone — fall through to merchant name for more specific type

  // Merchant name keywords
  if (lower.includes('mortgage') || lower.includes('cmg ')) return 'mortgage';
  if (lower.includes('student') || lower.includes('navient') || lower.includes('nelnet') || lower.includes('fedloan') || lower.includes('sallie')) return 'student_loan';

  // Credit card payments — check before auto_loan since "auto pay" appears in credit card payments
  if (lower.includes('credit') || lower.includes('crcardpmt') || lower.includes('discover') ||
      lower.includes('citi') || lower.includes('tjx') || lower.includes('jcpen') ||
      lower.includes('home depot') || lower.includes('wf credit') || lower.includes('wells fargo')) return 'credit';

  // Auto loan — must specifically say "auto" in a loan context, not "auto pay"
  if ((lower.includes('auto') && !lower.includes('auto pay') && !lower.includes('autopay') && !lower.includes('auto pymt')) ||
      lower.includes('car loan')) return 'auto_loan';
  // Capital One Auto is specifically an auto loan
  if (lower.includes('capital one auto')) return 'auto_loan';

  // If bank says "Loans" but we can't determine type, default to personal_loan
  if (cat.includes('loan')) return 'personal_loan';

  return 'personal_loan';
}

// Detect pay schedule from transaction history
export function detectPaySchedule(userId: string): {
  detected: boolean;
  frequency: string | null;
  amount: number | null;
  nextPayday: string | null;
  confidence: string;
} {
  // Look for recurring deposits (positive amounts) in the last 120 days for better patterns
  const deposits = db.prepare(
    `SELECT date, amount, merchant_name FROM transactions
     WHERE user_id = ? AND amount > 0 AND date >= date('now', '-120 days')
     ORDER BY date DESC`
  ).all(userId) as any[];

  if (deposits.length < 2) {
    return { detected: false, frequency: null, amount: null, nextPayday: null, confidence: 'none' };
  }

  // Filter out likely non-paycheck deposits:
  // - Small amounts (< $200) are probably refunds, cashback, Venmo, etc.
  // - Filter out names that look like transfers/refunds
  const NON_PAY_KEYWORDS = ['refund', 'cashback', 'cash back', 'venmo', 'zelle', 'paypal',
    'transfer', 'atm', 'reversal', 'adjustment', 'interest', 'dividend', 'rebate'];

  const likelyPay = deposits.filter(d => {
    if (d.amount < 200) return false;
    const name = (d.merchant_name || '').toLowerCase();
    return !NON_PAY_KEYWORDS.some(kw => name.includes(kw));
  });

  if (likelyPay.length < 2) {
    return { detected: false, frequency: null, amount: null, nextPayday: null, confidence: 'none' };
  }

  // Group by same source (merchant name) first, then by similar amounts
  const bySource = new Map<string, typeof likelyPay>();
  for (const dep of likelyPay) {
    const key = (dep.merchant_name || 'unknown').toLowerCase().trim();
    const existing = bySource.get(key) || [];
    existing.push(dep);
    bySource.set(key, existing);
  }

  // Find the best paycheck candidate:
  // Prefer groups from the same source with 2+ occurrences and consistent intervals
  type Candidate = {
    name: string;
    amount: number;
    dates: string[];
    avgInterval: number;
    frequency: string | null;
    confidence: string;
    score: number; // higher = better candidate
  };

  const candidates: Candidate[] = [];

  for (const [name, deps] of bySource) {
    if (deps.length < 2) continue;

    // Group this source's deposits by similar amounts (5% tolerance)
    const amtGroups: { amount: number; dates: string[] }[] = [];
    for (const d of deps) {
      const match = amtGroups.find(g => Math.abs(g.amount - d.amount) / g.amount < 0.05);
      if (match) {
        match.dates.push(d.date);
      } else {
        amtGroups.push({ amount: d.amount, dates: [d.date] });
      }
    }

    for (const grp of amtGroups) {
      if (grp.dates.length < 2) continue;
      const sorted = [...grp.dates].sort();
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const diff = Math.round(
          (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / (1000 * 60 * 60 * 24)
        );
        intervals.push(diff);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;

      const { frequency, confidence } = classifyInterval(avg, intervals, sorted);
      if (!frequency) continue;

      // Score: prefer more occurrences, higher amounts, more consistent intervals
      const intervalVariance = intervals.length > 1
        ? intervals.reduce((sum, i) => sum + Math.abs(i - avg), 0) / intervals.length
        : 0;
      const score = grp.dates.length * 10 + grp.amount / 100 - intervalVariance;

      candidates.push({
        name,
        amount: grp.amount,
        dates: sorted,
        avgInterval: avg,
        frequency,
        confidence,
        score,
      });
    }
  }

  // Also try grouping ALL deposits by amount regardless of source
  const allAmtGroups: { amount: number; dates: string[] }[] = [];
  for (const d of likelyPay) {
    const match = allAmtGroups.find(g => Math.abs(g.amount - d.amount) / g.amount < 0.05);
    if (match) {
      match.dates.push(d.date);
    } else {
      allAmtGroups.push({ amount: d.amount, dates: [d.date] });
    }
  }
  for (const grp of allAmtGroups) {
    if (grp.dates.length < 2) continue;
    const sorted = [...grp.dates].sort();
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.round(
        (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / (1000 * 60 * 60 * 24)
      );
      intervals.push(diff);
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const { frequency, confidence } = classifyInterval(avg, intervals, sorted);
    if (!frequency) continue;

    const intervalVariance = intervals.length > 1
      ? intervals.reduce((sum, i) => sum + Math.abs(i - avg), 0) / intervals.length
      : 0;
    const score = grp.dates.length * 10 + grp.amount / 100 - intervalVariance;

    candidates.push({
      name: 'all',
      amount: grp.amount,
      dates: sorted,
      avgInterval: avg,
      frequency,
      confidence,
      score,
    });
  }

  if (candidates.length === 0) {
    return { detected: false, frequency: null, amount: null, nextPayday: null, confidence: 'none' };
  }

  // Pick the best candidate
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // Estimate next payday
  const lastPayDate = new Date(best.dates[best.dates.length - 1]);
  const intervalDays = best.frequency === 'weekly' ? 7 : best.frequency === 'biweekly' ? 14 : best.frequency === 'twice_monthly' ? 15 : 30;

  let nextPayday = new Date(lastPayDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (nextPayday.getTime() <= today.getTime()) {
    nextPayday.setDate(nextPayday.getDate() + intervalDays);
  }

  return {
    detected: true,
    frequency: best.frequency,
    amount: Math.round(best.amount * 100) / 100,
    nextPayday: nextPayday.toISOString().split('T')[0],
    confidence: best.confidence,
  };
}

function classifyInterval(avg: number, intervals: number[], dates: string[]): { frequency: string | null; confidence: string } {
  if (avg >= 5 && avg <= 9) {
    return { frequency: 'weekly', confidence: intervals.every(i => i >= 5 && i <= 9) ? 'high' : 'medium' };
  }
  if (avg >= 12 && avg <= 16) {
    // Could be biweekly or twice_monthly — check day-of-month patterns
    const days = dates.map(d => new Date(d).getDate());
    const clustersAroundFixed = days.every(d => (d >= 1 && d <= 3) || (d >= 14 && d <= 16) || (d >= 28 && d <= 31));
    if (clustersAroundFixed) {
      return { frequency: 'twice_monthly', confidence: 'medium' };
    }
    return { frequency: 'biweekly', confidence: intervals.every(i => i >= 12 && i <= 16) ? 'high' : 'medium' };
  }
  if (avg >= 27 && avg <= 33) {
    return { frequency: 'monthly', confidence: intervals.every(i => i >= 27 && i <= 33) ? 'high' : 'medium' };
  }
  return { frequency: null, confidence: 'none' };
}

// === Subscription / Recurring Spend Tracking ===

export interface SubscriptionSummary {
  name: string;              // cleaned merchant name
  monthlyAmount: number;     // current typical monthly cost
  frequency: string;         // weekly, biweekly, monthly, annual
  firstPaymentDate: string;  // earliest payment we have
  lastPaymentDate: string;   // most recent payment
  totalPayments: number;     // total number of payments
  totalSpent: number;        // lifetime total $ spent
  monthsActive: number;      // how many months they've been paying
  isActive: boolean;         // had a payment in the last 45 days
  category: string;          // 'subscription' | 'bill' | 'debt'
  avgAmount: number;         // average payment amount
  minAmount: number;         // lowest payment
  maxAmount: number;         // highest payment
}

// Get full lifetime subscription/recurring spend data for a user
export function getSubscriptionLifetime(userId: string): SubscriptionSummary[] {
  // Load hidden merchants so we can exclude them
  const hiddenRows = db.prepare(
    'SELECT merchant_pattern FROM merchant_categories WHERE user_id = ? AND hide_recurring = 1'
  ).all(userId) as any[];
  const hiddenSet = new Set(hiddenRows.map((r: any) => r.merchant_pattern));

  // Get ALL transactions (no date limit) that are recurring or match bill/debt patterns
  const txns = db.prepare(
    `SELECT merchant_name, amount, date, category, is_recurring FROM transactions
     WHERE user_id = ? AND amount < 0
     ORDER BY merchant_name, date`
  ).all(userId) as any[];

  if (txns.length === 0) return [];

  // Group by normalized merchant key
  const byMerchant = new Map<string, {
    raw: string;
    amounts: number[];
    dates: string[];
    isRecurring: boolean;
    bankCategory: string | null;
  }>();

  for (const t of txns) {
    if (!t.merchant_name) continue;
    const key = normalizeMerchantKey(t.merchant_name);
    if (!key || key.length < 3) continue;

    // Skip merchants the user has dismissed from the recurring list
    if (hiddenSet.has(key)) continue;

  const existing = byMerchant.get(key) || {
      raw: t.merchant_name,
      amounts: [],
      dates: [],
      isRecurring: false,
      bankCategory: t.category || null,
    } as {
      raw: string;
      amounts: number[];
      dates: string[];
      isRecurring: boolean;
      bankCategory: string | null;
    };
    existing.amounts.push(Math.abs(t.amount));
    existing.dates.push(t.date);
    if (t.is_recurring) existing.isRecurring = true;
    if (!existing.bankCategory && t.category) existing.bankCategory = t.category;
    byMerchant.set(key, existing);
  }

  const now = new Date();
  const cutoff45 = new Date(now);
  cutoff45.setDate(cutoff45.getDate() - 45);
  const cutoff45Str = cutoff45.toISOString().split('T')[0];

  const results: SubscriptionSummary[] = [];

  for (const [key, data] of byMerchant) {
    // Need at least 3 payments to be "recurring" (reduces false positives)
    if (data.amounts.length < 3) continue;

    const lower = data.raw.toLowerCase();
    const cat = (data.bankCategory || '').toLowerCase().trim();

    // Skip transfers always
    if (TRANSFER_KEYWORDS.some(kw => lower.includes(kw))) continue;

    // Determine category
    let subCategory: string = 'bill';
    const isDebt = DEBT_PAYMENT_KEYWORDS.some(kw => lower.includes(kw)) ||
        DEBT_CATEGORIES.some(dc => cat === dc || (cat && cat.includes(dc)));
    const isSubscriptionCat = cat.includes('subscription') || cat === 'entertainment';
    const isBillCat = BILL_CATEGORIES.some(bc => cat === bc || (cat && cat.includes(bc)));

    if (isDebt) subCategory = 'debt';
    else if (isSubscriptionCat) subCategory = 'subscription';

    // STRICT FILTER: Only include merchants that meet at least one of these criteria:
    // 1. Already flagged as recurring by our interval detection algorithm (is_recurring = 1)
    // 2. Matches debt payment keywords (always interesting)
    // 3. Bank categorized as subscription/bill/debt
    // This prevents random merchants with 2 similar purchases from showing up
    const hasSignal = data.isRecurring || isDebt || isSubscriptionCat || isBillCat;
    if (!hasSignal) continue;

    // Skip variable spending merchants even if flagged recurring
    // (shouldn't happen, but safety net)
    if (NOT_BILL_KEYWORDS.some(kw => lower.includes(kw))) {
      if (!isSubscriptionCat && !data.isRecurring) continue;
    }

    // Skip one-time payment patterns (unless is_recurring flag is set)
    if (!data.isRecurring && ONE_TIME_KEYWORDS.some(kw => lower.includes(kw))) continue;

    const sortedDates = [...data.dates].sort();
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    const totalSpent = data.amounts.reduce((s, a) => s + a, 0);

    // Calculate months active
    const first = new Date(firstDate + 'T00:00:00');
    const last = new Date(lastDate + 'T00:00:00');
    const daySpan = Math.max(1, Math.round((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)));
    const monthsActive = Math.max(1, Math.round(daySpan / 30));

    // Current monthly cost (use mode of recent payments)
    const recentAmounts = data.amounts.slice(-Math.min(6, data.amounts.length));
    const monthlyAmount = mode(recentAmounts.map(a => Math.round(a * 100) / 100));

    // Is it still active? (payment within last 45 days)
    const isActive = lastDate >= cutoff45Str;

    // Guess frequency
    let frequency = 'monthly';
    if (data.dates.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) {
        const diff = Math.round(
          (new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime()) / (1000 * 60 * 60 * 24)
        );
        intervals.push(diff);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval <= 9) frequency = 'weekly';
      else if (avgInterval <= 16) frequency = 'biweekly';
      else if (avgInterval <= 35) frequency = 'monthly';
      else if (avgInterval <= 100) frequency = 'quarterly';
      else frequency = 'annual';
    }

    // If monthly amount is tiny (< $1), skip — probably not a real subscription
    if (monthlyAmount < 1) continue;

    results.push({
      name: cleanMerchantDisplay(data.raw),
      monthlyAmount,
      frequency,
      firstPaymentDate: firstDate,
      lastPaymentDate: lastDate,
      totalPayments: data.amounts.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      monthsActive,
      isActive,
      category: subCategory,
      avgAmount: Math.round((totalSpent / data.amounts.length) * 100) / 100,
      minAmount: Math.round(Math.min(...data.amounts) * 100) / 100,
      maxAmount: Math.round(Math.max(...data.amounts) * 100) / 100,
    });
  }

  // Sort by total lifetime spend (biggest shock value first)
  return results.sort((a, b) => b.totalSpent - a.totalSpent);
}

// === Spending by Category ===

export interface CategorySpend {
  category: string;
  total: number;
  count: number;
  pctOfTotal: number;
}

export interface SpendingBreakdown {
  categories: CategorySpend[];
  totalSpend: number;
  period: string;
  periodLabel: string;
}

// Map bank-provided categories AND user-assigned categories to a clean, consolidated set
function normalizeCategory(raw: string | null, merchantName?: string): string {
  // Always try merchant name first — it's more specific than bank category
  if (merchantName) {
    const guessed = guessCategoryFromMerchant(merchantName);
    if (guessed) return guessed;
  }
  if (!raw) return 'Other';
  const lower = raw.toLowerCase().trim();

  // Food / Restaurants
  if (lower.includes('restaurant') || lower.includes('dining') || lower.includes('takeout') ||
      lower.includes('fast food') || lower.includes('coffee')) return 'Food & Dining';

  // Groceries
  if (lower.includes('grocer') || lower.includes('supermarket')) return 'Groceries';

  // Gas & Fuel
  if (lower.includes('gas') || lower.includes('fuel') || lower.includes('petrol')) return 'Gas';

  // Transportation
  if (lower.includes('transport') || lower.includes('parking') || lower.includes('toll') ||
      lower.includes('auto maintenance') || lower.includes('auto repair')) return 'Transportation';

  // Housing / Mortgage / Rent
  if (lower.includes('mortgage') || lower.includes('rent') || lower.includes('housing')) return 'Housing';

  // Utilities
  if (lower.includes('utilit') || lower.includes('electric') || lower.includes('water ') ||
      lower.includes('sewer') || lower.includes('phone') || lower.includes('internet') ||
      lower.includes('cable') || lower.includes('telecom')) return 'Utilities';

  // Insurance
  if (lower.includes('insurance') || lower.includes('geico') || lower.includes('state farm') ||
      lower.includes('allstate') || lower.includes('progressive') || lower.includes('usaa ins') ||
      lower.includes('liberty mutual') || lower.includes('nationwide') || lower.includes('farmers ins') ||
      lower.startsWith('erie') || lower.includes('erie ins') || lower.includes('travelers')) return 'Insurance';

  // Healthcare
  if (lower.includes('health') || lower.includes('medical') || lower.includes('doctor') ||
      lower.includes('dental') || lower.includes('pharmacy') || lower.includes('hospital') ||
      lower.includes('clinic')) return 'Healthcare';

  // Debt / Loans — check BEFORE services, since "Services and Supplies" can include payments
  if (lower.includes('loan') || lower.includes('credit card payment') ||
      lower.includes('debt')) return 'Debt Payments';

  // Home Improvement — separate from Shopping
  if (lower.includes('home improvement') || lower.includes('home maintenance')) return 'Home Improvement';

  // Shopping
  if (lower.includes('shopping') || lower.includes('general merchandise') ||
      lower.includes('clothing') || lower.includes('shoes') || lower.includes('electronics')) return 'Shopping';

  // Entertainment / Subscriptions
  if (lower.includes('entertainment') || lower.includes('subscription') ||
      lower.includes('renewal') || lower.includes('hobbies') || lower.includes('recreation')) return 'Entertainment';

  // Services — but check if merchant name has debt/payment keywords
  if (lower.includes('service') || lower.includes('supplies')) {
    if (merchantName) {
      const ml = merchantName.toLowerCase();
      if (ml.includes('pymt') || ml.includes('payment') || ml.includes('autopay') || ml.includes('online pmt')) {
        return 'Debt Payments';
      }
    }
    return 'Services';
  }

  // Travel
  if (lower.includes('travel') || lower.includes('hotel') || lower.includes('airline') ||
      lower.includes('flight') || lower.includes('airbnb')) return 'Travel';

  // Bills
  if (lower.includes('bill')) return 'Bills';

  // Transfers
  if (lower.includes('transfer')) return 'Transfers';

  // Pending
  if (lower === 'pending') return 'Other';

  // Personal
  if (lower.includes('personal') || lower.includes('pets') || lower.includes('pet care')) return 'Personal';

  // Fees
  if (lower.includes('fee') || lower.includes('charge')) return 'Fees';

  // Clean up: capitalize what's left
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// Guess category from merchant name when no bank category available
export function guessCategoryFromMerchant(merchantName: string): string | null {
  const lower = merchantName.toLowerCase();

  // Mortgage / Rent — check very early since bank may misclassify (e.g., as "Shopping")
  if (lower.includes('mortgage') || lower.includes('cmg ') || lower.includes('rent payment') ||
      lower.includes('lease payment') || lower.includes('hoa ') || lower.includes('homeowner')) {
    return 'Housing';
  }

  // Debt payments — check first since these can appear under any bank category
  if (lower.includes('pymt') || lower.includes('autopay') || lower.includes('online pmt') ||
      lower.includes('auto pay') || lower.includes('bill pay')) {
    // Only classify as debt if it's clearly a payment to a financial institution
    if (lower.includes('sofi') || lower.includes('bank of america') || lower.includes('chase credit') ||
        lower.includes('capital one') || lower.includes('discover') || lower.includes('wells fargo') ||
        lower.includes('citi') || lower.includes('barclays') || lower.includes('amex') ||
        lower.includes('rewards') || lower.includes('mastercard') || lower.includes('mstcrd')) {
      return 'Debt Payments';
    }
  }

  // Food & restaurants
  const FOOD_KEYWORDS = [
    'doordash', 'uber eats', 'grubhub', 'postmates', 'chipotle', 'mcdonald',
    'starbucks', 'subway', 'panera', 'taco bell', 'chick-fil-a', 'wendy',
    'burger king', 'pizza', 'sushi', 'thai', 'chinese', 'mexican', 'restaurant',
    'diner', 'cafe', 'grill', 'kitchen', 'bistro', 'bakery', 'waffle', 'ihop',
    'applebee', 'olive garden', 'outback', 'buffalo wild', 'dunkin', 'sonic',
    'popeyes', 'whataburger', 'zaxby', 'wingstop', 'wing stop', 'bbq', 'ramen',
    'pho', 'noodle', 'wok', 'steakhouse', 'seafood', 'five guys', 'torchy',
    'jersey mike', 'jimmy john', 'firehouse sub', 'smoothie', 'jamba',
    'jack in the box', 'little caesars', 'caesars', 'potbelly', 'roadhouse',
    'walk-on', 'walk on', 'chiller bee', 'sweetbox', 'daves hot chicken',
    'hoodadak', 'two hands', 'cane\'s', 'raising cane',
  ];
  if (FOOD_KEYWORDS.some(kw => lower.includes(kw))) return 'Food & Dining';

  // Groceries
  const GROCERY_KEYWORDS = [
    'whole foods', 'kroger', 'walmart', 'aldi', 'trader joe', 'publix',
    'costco', 'safeway', 'h-e-b', 'heb ', 'target', 'food lion', 'wegmans',
    'grocery', 'supermarket', 'sams club', 'sam\'s club',
  ];
  if (GROCERY_KEYWORDS.some(kw => lower.includes(kw))) return 'Groceries';

  // Gas / fuel
  const GAS_KEYWORDS = [
    'shell oil', 'shell/', 'chevron', 'exxon', 'bp ', 'mobil', 'speedway',
    'wawa', 'quiktrip', 'racetrac', 'buc-ee', 'sunoco', 'pilot', 'loves ',
    'casey', 'murphy', 'valero', 'citgo', 'marathon',
  ];
  if (GAS_KEYWORDS.some(kw => lower.includes(kw))) return 'Gas';

  // Transportation
  if ((lower.includes('uber') || lower.includes('lyft') || lower.includes('parking') || lower.includes('toll')) && !lower.includes('uber eats')) return 'Transportation';

  // Debt payments disguised as other categories (check BEFORE healthcare)
  // Bankers Healthcare Group is a lending company, NOT a healthcare provider
  if (lower.includes('bankers healthca') || lower.includes('initium professi')) return 'Debt Payments';

  // Healthcare / pharmacy
  const HEALTH_KEYWORDS = [
    'pharmacy', 'cvs', 'walgreens', 'rite aid', 'doctor', 'dental', 'medical',
    'clinic', 'hospital', 'infusion', 'strut health', 'diagnostic',
  ];
  if (HEALTH_KEYWORDS.some(kw => lower.includes(kw))) return 'Healthcare';

  // Pets
  if (lower.includes('chewy') || lower.includes('petsmart') || lower.includes('petco') ||
      lower.includes('pet ') || lower.includes('grooming') || lower.includes('paw*')) return 'Personal';

  // Utilities — catch "CITY OF*" municipal bills, CPENERGY, etc.
  if (lower.includes('city of*') || lower.includes('city of ') || lower.includes('cpenergy') ||
      lower.includes('electric co') || lower.includes('water dept') || lower.includes('gas co') ||
      lower.includes('att ') || lower.includes('at&t') || lower.includes('verizon') ||
      lower.includes('t-mobile') || lower.includes('tmobile') || lower.includes('xfinity') ||
      lower.includes('comcast') || lower.includes('spectrum')) return 'Utilities';

  // Apple subscriptions via PayPal
  if (lower.includes('apple.com') || lower.includes('apple ')) return 'Entertainment';

  // Entertainment / streaming
  const ENT_KEYWORDS = [
    'netflix', 'spotify', 'hulu', 'disney', 'hbo', 'youtube', 'yt primetime',
    'steam games', 'movie', 'amc', 'regal', 'santikos', 'fubotv', 'fubo',
    'roblox', 'playstation', 'xbox', 'nintendo', 'prime video',
  ];
  if (ENT_KEYWORDS.some(kw => lower.includes(kw))) return 'Entertainment';

  // Home Improvement
  const HOME_KEYWORDS = [
    'home depot', 'lowes', 'lowe\'s', 'menards', 'ace hardware', 'true value',
    'build sale', 'lumber', 'floor & decor',
  ];
  if (HOME_KEYWORDS.some(kw => lower.includes(kw))) return 'Home Improvement';

  // Home security / services
  if (lower.includes('ring.com') || lower.includes('ring multi') || lower.includes('adt ') ||
      lower.includes('simplisafe') || lower.includes('vivint')) return 'Housing';

  // Shopping (keep after food/grocery/gas so we don't catch amazon groceries as shopping)
  const SHOPPING_KEYWORDS = [
    'amazon', 'best buy', 'ikea', 'wayfair', 'etsy',
    'ebay', 'jcpenny', 'jcpenney', 'paulette',
  ];
  if (SHOPPING_KEYWORDS.some(kw => lower.includes(kw))) return 'Shopping';

  // Tech services / SaaS / Home services
  const TECH_KEYWORDS = [
    'openai', 'anthropic', 'github', 'adobe', 'squarespace', 'sqsp',
    'wordpress', 'expo.dev', 'expo)', 'google *workspace', 'supabase',
    'google *svc', 'ipostal', 'total air service', 'plumber', 'hvac',
    'lawn', 'maid', 'cleaning service',
  ];
  if (TECH_KEYWORDS.some(kw => lower.includes(kw))) return 'Services';

  // Travel / lodging
  const TRAVEL_KEYWORDS = [
    'great wolf', 'hotel', 'hilton', 'marriott', 'holiday inn', 'airbnb',
    'vrbo', 'airline', 'flight', 'southwest', 'united', 'delta', 'american air',
    'island breeze',
  ];
  if (TRAVEL_KEYWORDS.some(kw => lower.includes(kw))) return 'Travel';

  // School
  if (lower.includes('schoolcafe') || lower.includes('school cafe')) return 'Education';

  // Transfers / Zelle
  if (lower.includes('zelle') || lower.includes('venmo') || lower.includes('cashapp')) return 'Transfers';

  return null;
}

export function getSpendingByCategory(userId: string, period: 'this_month' | 'last_30' | 'last_90' = 'this_month'): SpendingBreakdown {
  let dateFilter: string;
  let periodLabel: string;
  if (period === 'this_month') {
    dateFilter = "date >= date('now', 'start of month')";
    const now = new Date();
    periodLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else if (period === 'last_30') {
    dateFilter = "date >= date('now', '-30 days')";
    periodLabel = 'Last 30 days';
  } else {
    dateFilter = "date >= date('now', '-90 days')";
    periodLabel = 'Last 90 days';
  }

  // Get every spending transaction individually so we can normalize categories properly
  const txns = db.prepare(
    `SELECT merchant_name, category, ABS(amount) as amount
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND ${dateFilter}`
  ).all(userId) as any[];

  // Get user's merchant classifications for uncategorized fallback
  const userCats = db.prepare(
    'SELECT merchant_pattern, category FROM merchant_categories WHERE user_id = ?'
  ).all(userId) as any[];
  const userCatMap = new Map<string, string>();
  for (const uc of userCats) userCatMap.set(uc.merchant_pattern, uc.category);

  // Aggregate by normalized category
  const catMap = new Map<string, { total: number; count: number }>();

  for (const tx of txns) {
    // Check user classification first for uncategorized transactions
    let bankCat = tx.category;
    if (!bankCat && tx.merchant_name) {
      const normalized = tx.merchant_name.toLowerCase().replace(/\s+/g, ' ').trim();
      bankCat = userCatMap.get(normalized) || null;
    }

    const cat = normalizeCategory(bankCat, tx.merchant_name);
    const existing = catMap.get(cat) || { total: 0, count: 0 };
    existing.total += tx.amount;
    existing.count += 1;
    catMap.set(cat, existing);
  }

  const totalSpend = Array.from(catMap.values()).reduce((s, v) => s + v.total, 0);

  const categories: CategorySpend[] = Array.from(catMap.entries())
    .map(([cat, data]) => ({
      category: cat,
      total: Math.round(data.total * 100) / 100,
      count: data.count,
      pctOfTotal: totalSpend > 0 ? Math.round((data.total / totalSpend) * 1000) / 10 : 0,
    }))
    .filter(c => c.total >= 1) // skip tiny rounding noise
    .sort((a, b) => b.total - a.total);

  return {
    categories,
    totalSpend: Math.round(totalSpend * 100) / 100,
    period,
    periodLabel,
  };
}

// Get individual transactions for a specific category (drilldown)
export interface CategoryTransaction {
  merchant: string;
  amount: number;
  date: string;
  bankCategory: string | null;
}

export function getCategoryTransactions(
  userId: string,
  targetCategory: string,
  period: 'this_month' | 'last_30' | 'last_90' = 'this_month'
): { transactions: CategoryTransaction[]; total: number; category: string } {
  let dateFilter: string;
  if (period === 'this_month') {
    dateFilter = "date >= date('now', 'start of month')";
  } else if (period === 'last_30') {
    dateFilter = "date >= date('now', '-30 days')";
  } else {
    dateFilter = "date >= date('now', '-90 days')";
  }

  const txns = db.prepare(
    `SELECT merchant_name, category, ABS(amount) as amount, date
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND ${dateFilter}
     ORDER BY date DESC, ABS(amount) DESC`
  ).all(userId) as any[];

  const userCats = db.prepare(
    'SELECT merchant_pattern, category FROM merchant_categories WHERE user_id = ?'
  ).all(userId) as any[];
  const userCatMap = new Map<string, string>();
  for (const uc of userCats) userCatMap.set(uc.merchant_pattern, uc.category);

  const results: CategoryTransaction[] = [];
  let total = 0;

  for (const tx of txns) {
    let bankCat = tx.category;
    if (!bankCat && tx.merchant_name) {
      const normalized = tx.merchant_name.toLowerCase().replace(/\s+/g, ' ').trim();
      bankCat = userCatMap.get(normalized) || null;
    }
    const cat = normalizeCategory(bankCat, tx.merchant_name);
    if (cat === targetCategory) {
      results.push({
        merchant: tx.merchant_name || 'Unknown',
        amount: Math.round(tx.amount * 100) / 100,
        date: tx.date,
        bankCategory: tx.category,
      });
      total += tx.amount;
    }
  }

  return { transactions: results, total: Math.round(total * 100) / 100, category: targetCategory };
}

// === AI-Powered Merchant Classification ===

export async function classifyUnknownMerchantsWithAI(
  userId: string,
  merchantNames: string[]
): Promise<{ classified: number; results: Array<{ merchant: string; category: string; isBill: boolean }> }> {
  // 1. Deduplicate
  const uniqueMerchants = [...new Set(merchantNames.filter(Boolean))];

  // 2. Filter out already-classified merchants
  const existingPatterns = db.prepare(
    'SELECT merchant_pattern FROM merchant_categories WHERE user_id = ?'
  ).all(userId) as any[];
  const classifiedSet = new Set(existingPatterns.map((r: any) => r.merchant_pattern));

  // 3. Filter out merchants recognizable by keyword matching
  const unknownMerchants = uniqueMerchants.filter(name => {
    const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (classifiedSet.has(normalized)) return false;
    if (guessCategoryFromMerchant(name) !== null) return false;
    return true;
  });

  if (unknownMerchants.length === 0) {
    return { classified: 0, results: [] };
  }

  logger.info(`[AI Categorize] ${unknownMerchants.length} unknown merchants to classify`);

  // 4. Call AI service
  const classifications = await classifyMerchantsWithAI(unknownMerchants);
  if (classifications.length === 0) {
    return { classified: 0, results: [] };
  }

  // 5. Store results and update transactions
  const upsertMerchant = db.prepare(
    `INSERT INTO merchant_categories (id, user_id, merchant_pattern, category, is_bill)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, merchant_pattern) DO UPDATE SET category = excluded.category, is_bill = excluded.is_bill`
  );
  const updateTxns = db.prepare(
    `UPDATE transactions SET category = ?
     WHERE user_id = ? AND LOWER(REPLACE(merchant_name, '  ', ' ')) = ?`
  );
  const markRecurring = db.prepare(
    `UPDATE transactions SET is_recurring = 1
     WHERE user_id = ? AND LOWER(REPLACE(merchant_name, '  ', ' ')) = ?`
  );

  let classified = 0;
  const appliedResults: Array<{ merchant: string; category: string; isBill: boolean }> = [];

  for (const c of classifications) {
    if (c.category === 'Other') continue; // Skip if AI couldn't determine

    const normalized = c.merchantName.toLowerCase().replace(/\s+/g, ' ').trim();

    upsertMerchant.run(crypto.randomUUID(), userId, normalized, c.category, c.isBill ? 1 : 0);
    updateTxns.run(c.category, userId, normalized);
    if (c.isBill) {
      markRecurring.run(userId, normalized);
    }
    classified++;
    appliedResults.push({ merchant: c.merchantName, category: c.category, isBill: c.isBill });
  }

  logger.info(`[AI Categorize] Successfully classified ${classified} merchants`);
  return { classified, results: appliedResults };
}
