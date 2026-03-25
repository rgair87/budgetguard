import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
import db from '../config/db';
import { env } from '../config/env';
import { guessCategoryFromMerchant } from './csv.service';
import { classifyMerchantsWithAI } from './ai-categorize.service';

// ─── mTLS Agent ──────────────────────────────────────────────
// Teller requires mutual TLS for all API calls.
// Certs can be loaded from:
//   1. TELLER_CERTIFICATE / TELLER_PRIVATE_KEY env vars (PEM content, for Railway/Docker)
//   2. Files on disk at TELLER_CERT_PATH or default ./certs/ dir

let cert: Buffer | null = null;
let key: Buffer | null = null;
let _agent: https.Agent | null = null;

function loadCerts(): { cert: Buffer; key: Buffer } {
  if (cert && key) return { cert, key };

  if (env.TELLER_CERTIFICATE && env.TELLER_PRIVATE_KEY) {
    // Normalize PEM content from env vars:
    // - Replace literal "\n" strings with actual newlines
    // - Handle base64-encoded PEM (Railway sometimes base64-encodes multiline values)
    function normalizePem(raw: string): string {
      // If it looks base64-encoded (no BEGIN marker), try decoding
      if (!raw.includes('-----BEGIN') && raw.length > 100) {
        try {
          const decoded = Buffer.from(raw, 'base64').toString('utf-8');
          if (decoded.includes('-----BEGIN')) return decoded;
        } catch {}
      }
      // Replace literal \n with real newlines
      return raw.replace(/\\n/g, '\n');
    }
    const certStr = normalizePem(env.TELLER_CERTIFICATE);
    const keyStr = normalizePem(env.TELLER_PRIVATE_KEY);
    cert = Buffer.from(certStr);
    key = Buffer.from(keyStr);
    console.log('Teller certs loaded from environment variables');
    console.log('Cert starts with:', certStr.substring(0, 30));
    console.log('Key starts with:', keyStr.substring(0, 30));
  } else {
    const certsDir = env.TELLER_CERT_PATH || path.resolve(__dirname, '../../certs');
    try {
      cert = fs.readFileSync(path.join(certsDir, 'certificate.pem'));
      key = fs.readFileSync(path.join(certsDir, 'private_key.pem'));
      console.log('Teller certs loaded from', certsDir);
    } catch {
      throw new Error(
        'Teller certificates not found. Set TELLER_CERTIFICATE and TELLER_PRIVATE_KEY env vars, or place cert files at ' +
        (env.TELLER_CERT_PATH || path.resolve(__dirname, '../../certs'))
      );
    }
  }
  return { cert, key };
}

function getAgent(): https.Agent {
  if (_agent) return _agent;
  const certs = loadCerts();
  _agent = new https.Agent({ cert: certs.cert, key: certs.key });
  return _agent;
}

const TELLER_BASE = 'https://api.teller.io';

// ─── HTTP helper ─────────────────────────────────────────────

async function tellerFetch<T = any>(
  endpoint: string,
  accessToken: string,
  method: 'GET' | 'DELETE' = 'GET',
): Promise<T> {
  const url = `${TELLER_BASE}${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Basic ${Buffer.from(`${accessToken}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    // @ts-ignore - Node fetch supports dispatcher/agent via undici
    dispatcher: getAgent(),
  } as any);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Teller API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// Node 18+ native fetch doesn't support custom https agents directly.
// Fall back to a manual https.request wrapper if needed.
async function tellerRequest<T = any>(
  endpoint: string,
  accessToken: string,
  method: 'GET' | 'DELETE' = 'GET',
): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${TELLER_BASE}${endpoint}`);
    const certs = loadCerts();
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method,
        cert: certs.cert,
        key: certs.key,
        headers: {
          'Authorization': `Basic ${Buffer.from(`${accessToken}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Teller API ${res.statusCode}: ${data}`));
            return;
          }
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error(`Teller API invalid JSON: ${data}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// ─── Teller types ────────────────────────────────────────────

interface TellerAccount {
  id: string;
  name: string;
  type: 'depository' | 'credit';
  subtype: string; // checking, savings, credit_card, etc.
  status: string;
  institution: { id: string; name: string };
  currency: string;
  enrollment_id: string;
  last_four: string;
}

interface TellerBalance {
  account_id: string;
  available: string | null;
  ledger: string | null;
}

interface TellerTransaction {
  id: string;
  account_id: string;
  amount: string; // negative for debits
  date: string;
  description: string;
  details: {
    category: string;
    counterparty: { name: string; type: string } | null;
    processing_status: string;
  };
  status: string;
  type: string; // ach, card_payment, etc.
}

// ─── Category mapping ────────────────────────────────────────

// Teller provides its own categories — map to our app's categories
const TELLER_CATEGORY_MAP: Record<string, string> = {
  'accommodation': 'Travel',
  'advertising': 'Services',
  'bar': 'Food & Dining',
  'charity': 'Other',
  'clothing': 'Shopping',
  'dining': 'Food & Dining',
  'education': 'Education',
  'electronics': 'Shopping',
  'entertainment': 'Entertainment',
  'fuel': 'Gas',
  'general': 'Other',
  'groceries': 'Groceries',
  'health': 'Healthcare',
  'home': 'Housing',
  'income': 'Other',
  'insurance': 'Insurance',
  'investment': 'Other',
  'loan': 'Debt Payments',
  'office': 'Services',
  'phone': 'Utilities',
  'service': 'Services',
  'shopping': 'Shopping',
  'software': 'Services',
  'sport': 'Entertainment',
  'tax': 'Other',
  'transport': 'Transportation',
  'transportation': 'Transportation',
  'utilities': 'Utilities',
};

function mapTellerCategory(tellerCat: string | null): string | null {
  if (!tellerCat) return null;
  return TELLER_CATEGORY_MAP[tellerCat.toLowerCase()] || null;
}

// ─── Merchant name cleaning ──────────────────────────────────

const US_STATES = new Set(['TX','WA','CA','NY','FL','IL','PA','OH','GA','NC','MI','NJ','VA','AZ','MA','CO','WI','MN','MO','MD','IN','TN','OR','SC','KY','LA','OK','CT','IA','MS','AR','KS','NV','NM','NE','WV','ID','HI','ME','NH','RI','MT','DE','SD','ND','AK','VT','WY','DC']);

function cleanMerchantName(raw: string): string {
  return raw
    // Strip transaction type prefixes
    .replace(/\s*(DEBIT CARD PURCHASE|RECURRING DEBIT CARD|POS DEBIT|POS PURCHASE|CHECKCARD|CHECK CARD|PURCHASE AUTHORIZED ON \d{2}\/\d{2})\s*/gi, '')
    .replace(/\s*(ACH WEB-?RECUR?|ACH WEB|ACH DEBIT|ACH TEL|ACH DR|PPD ID:?\s*\S+|WEB ID:?\s*\S+)\s*/gi, '')
    .replace(/\s*(EXTERNAL WITHDRAWAL|EXTERNAL DEPOSIT|ONLINE PAYMENT|ONLINE TRANSFER|MOBILE PAYMENT)\s*/gi, '')
    // Strip card numbers and masked digits
    .replace(/\s*POSxxxx\d+\s*xxx\d+/gi, '')
    .replace(/x{4,}\d*/gi, '')
    .replace(/\d{16}/g, '')
    .replace(/\s*(CARD\d+|\[PENDING\])/gi, '')
    // Strip trailing phone numbers
    .replace(/\s+\d{3}-\d{3,}-?\d*\s+\w{2}\s*$/i, '')
    .replace(/\s+\d{3}-\d{3,4}-?\d{0,4}$/i, '')
    // Strip trailing dates
    .replace(/\s+\d{2}\/\d{2}$/i, '')
    // Strip trailing city + state like "CONROE TX" or "WILLIS TX"
    .replace(/\s+[A-Z][a-z]+\s+([A-Z]{2})\s*$/i, (match, state) => {
      return US_STATES.has(state.toUpperCase()) ? '' : match;
    })
    // Strip trailing bare state codes
    .replace(/\s+([A-Z]{2})\s*$/i, (match, state) => {
      return US_STATES.has(state.toUpperCase()) ? '' : match;
    })
    // Strip trailing transaction reference numbers
    .replace(/\s+#\S+$/i, '')
    .replace(/\s+REF\s*#?\s*\S+$/i, '')
    // Collapse whitespace and trim
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Title case a cleaned merchant name
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, c => c.toUpperCase())
    // Keep known acronyms uppercase
    .replace(/\b(Cvs|Heb|Usps|Ups|Atm|Ach)\b/gi, m => m.toUpperCase());
}

// ─── Service functions ───────────────────────────────────────

/**
 * Store the access token from Teller Connect and sync accounts + transactions.
 */
export async function enrollBank(userId: string, accessToken: string): Promise<SyncResult> {
  // Store access token
  db.prepare('UPDATE users SET teller_access_token = ? WHERE id = ?').run(accessToken, userId);

  // Sync immediately
  return await syncAccounts(userId, accessToken);
}

export interface SyncResult {
  accounts: number;
  transactions: number;
  pendingTransactions: boolean; // true if bank timed out (still processing)
  message: string;
}

/**
 * Fetch accounts and transactions from Teller and store in our DB.
 */
export async function syncAccounts(userId: string, accessToken?: string): Promise<SyncResult> {
  if (!accessToken) {
    const row = db.prepare('SELECT teller_access_token FROM users WHERE id = ?').get(userId) as any;
    accessToken = row?.teller_access_token;
    if (!accessToken) throw new Error('No Teller access token. Connect a bank first.');
  }

  // ── Fetch accounts ──
  let accounts: TellerAccount[];
  try {
    accounts = await tellerRequest<TellerAccount[]>('/accounts', accessToken);
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.includes('enrollment.disconnected') || msg.includes('not healthy')) {
      throw new Error('Bank connection expired. Please re-connect your bank through Settings.');
    }
    throw err;
  }

  const upsertAcct = db.prepare(
    `INSERT INTO accounts (id, user_id, teller_account_id, name, type, current_balance, available_balance, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (user_id, teller_account_id)
       DO UPDATE SET name = excluded.name, current_balance = excluded.current_balance, available_balance = excluded.available_balance, last_synced_at = datetime('now')`
  );

  for (const acct of accounts) {
    // Map Teller types to our types
    let type: string;
    if (acct.type === 'credit') {
      type = 'credit';
    } else if (acct.subtype === 'savings') {
      type = 'savings';
    } else {
      type = 'checking';
    }

    // Fetch balances for this account
    let balance: number | null = null;
    let available: number | null = null;
    try {
      const bal = await tellerRequest<TellerBalance>(`/accounts/${acct.id}/balances`, accessToken!);
      balance = parseFloat(bal.ledger || '0');
      available = bal.available ? parseFloat(bal.available) : null;
    } catch (err) {
      console.warn(`Failed to fetch balance for ${acct.id}, keeping existing balance:`, (err as Error).message);
    }

    if (balance !== null) {
      // Got fresh balances — upsert with new values
      upsertAcct.run(
        crypto.randomUUID(), userId, acct.id, acct.name, type,
        balance, available,
      );
    } else {
      // Balance fetch failed — insert if new, but don't overwrite existing balances
      const existing = db.prepare(
        'SELECT id FROM accounts WHERE user_id = ? AND teller_account_id = ?'
      ).get(userId, acct.id);
      if (!existing) {
        upsertAcct.run(
          crypto.randomUUID(), userId, acct.id, acct.name, type,
          0, null,
        );
      }
    }
  }

  // ── Load existing merchant→category mappings for this user ──
  const knownMerchants = new Map<string, { category: string; isBill: boolean }>();
  const mcRows = db.prepare(
    'SELECT merchant_pattern, category, is_bill FROM merchant_categories WHERE user_id = ?'
  ).all(userId) as any[];
  for (const mc of mcRows) {
    knownMerchants.set(mc.merchant_pattern, { category: mc.category, isBill: !!mc.is_bill });
  }

  // ── Fetch transactions for each account ──
  const insertTxn = db.prepare(
    `INSERT OR IGNORE INTO transactions (id, user_id, account_id, amount, date, merchant_name, category, is_recurring)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const unclassifiedMerchants = new Set<string>();
  let totalInserted = 0;
  let pendingTransactions = false;

  for (const acct of accounts) {
    const acctRow = db.prepare(
      'SELECT id FROM accounts WHERE user_id = ? AND teller_account_id = ?'
    ).get(userId, acct.id) as any;
    if (!acctRow) continue;

    try {
      const transactions = await tellerRequest<TellerTransaction[]>(
        `/accounts/${acct.id}/transactions`,
        accessToken!,
      );

      console.log(`Teller: fetched ${transactions.length} transactions for account ${acct.id}`);
      if (transactions.length > 0) {
        console.log('Sample transaction:', JSON.stringify(transactions[0]));
      }

      for (const txn of transactions) {
        const rawAmount = parseFloat(txn.amount);
        // Teller amounts: negative = money out (debits), positive = money in (credits)
        const amount = rawAmount;
        const rawName = txn.details?.counterparty?.name || txn.description;
        const merchantName = titleCase(cleanMerchantName(rawName));
        const tellerCategory = txn.details?.category || null;

        // Classify: 1) existing mapping, 2) keyword match, 3) Teller's category, 4) leave for AI
        const normalized = merchantName.toLowerCase().replace(/\s+/g, ' ').trim();
        const known = knownMerchants.get(normalized);
        let category: string | null = null;
        let isRecurring = 0;

        if (known) {
          category = known.category;
          isRecurring = known.isBill ? 1 : 0;
        } else {
          // Try keyword-based guess
          category = guessCategoryFromMerchant(merchantName);
          if (!category) {
            // Try Teller's own category
            category = mapTellerCategory(tellerCategory);
          }
          if (!category) {
            unclassifiedMerchants.add(merchantName);
          }
        }

        insertTxn.run(
          `teller_${txn.id}`,
          userId, acctRow.id,
          amount,
          txn.date, merchantName, category,
          isRecurring,
        );
        totalInserted++;
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('504') || msg.includes('gateway_timeout') || msg.includes('taking too long')) {
        pendingTransactions = true;
        console.warn(`Transactions still processing for account ${acct.id} (bank is slow)`);
      } else {
        console.warn(`Failed to fetch transactions for account ${acct.id}:`, err);
      }
    }
  }

  console.log(`Teller sync: ${totalInserted} transactions imported, ${unclassifiedMerchants.size} unclassified merchants, pending=${pendingTransactions}`);

  // ── AI-classify unknown merchants ──
  if (unclassifiedMerchants.size > 0) {
    try {
      console.log(`Teller: AI-classifying ${unclassifiedMerchants.size} unknown merchants...`);
      const classifications = await classifyMerchantsWithAI([...unclassifiedMerchants]);

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
      for (const c of classifications) {
        if (c.category === 'Other') continue;
        const norm = c.merchantName.toLowerCase().replace(/\s+/g, ' ').trim();
        upsertMerchant.run(crypto.randomUUID(), userId, norm, c.category, c.isBill ? 1 : 0);
        updateTxns.run(c.category, userId, norm);
        if (c.isBill) markRecurring.run(userId, norm);
        classified++;
      }
      console.log(`Teller: AI classified ${classified} merchants`);
    } catch (err) {
      console.warn('Teller: AI classification failed, transactions saved without categories:', err);
    }
  }

  const message = pendingTransactions && totalInserted === 0
    ? 'Your bank is still processing. Transactions will appear shortly — try syncing again in a minute.'
    : pendingTransactions
      ? `Synced ${totalInserted} transactions so far. Your bank is still processing more — try syncing again shortly.`
      : `Synced ${accounts.length} accounts and ${totalInserted} transactions.`;

  return {
    accounts: accounts.length,
    transactions: totalInserted,
    pendingTransactions,
    message,
  };
}

/**
 * Re-clean all merchant names in the database for a user.
 * Useful after improving the cleaning logic.
 */
export function recleanMerchantNames(userId: string): number {
  const rows = db.prepare(
    'SELECT id, merchant_name FROM transactions WHERE user_id = ? AND merchant_name IS NOT NULL'
  ).all(userId) as any[];

  const update = db.prepare('UPDATE transactions SET merchant_name = ? WHERE id = ?');
  let updated = 0;
  for (const row of rows) {
    const cleaned = titleCase(cleanMerchantName(row.merchant_name));
    if (cleaned !== row.merchant_name) {
      update.run(cleaned, row.id);
      updated++;
    }
  }
  return updated;
}

/**
 * Disconnect a linked bank account from Teller.
 */
export async function disconnectAccount(userId: string, tellerAccountId: string): Promise<void> {
  const row = db.prepare('SELECT teller_access_token FROM users WHERE id = ?').get(userId) as any;
  if (row?.teller_access_token) {
    try {
      await tellerRequest(`/accounts/${tellerAccountId}`, row.teller_access_token, 'DELETE');
    } catch {
      // Account may already be disconnected on Teller's end
    }
  }
}
