import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
import db from '../config/db';

// ─── mTLS Agent ──────────────────────────────────────────────
// Teller requires mutual TLS for all API calls.

const certsDir = process.env.TELLER_CERT_PATH || path.resolve(__dirname, '../../certs');
let cert: Buffer;
let key: Buffer;

try {
  cert = fs.readFileSync(path.join(certsDir, 'certificate.pem'));
  key = fs.readFileSync(path.join(certsDir, 'private_key.pem'));
} catch {
  console.warn('Teller certificates not found at', certsDir, '- bank sync will not work');
  cert = Buffer.from('');
  key = Buffer.from('');
}

const agent = new https.Agent({ cert, key });

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
    dispatcher: agent,
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
    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method,
        cert,
        key,
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

// ─── Service functions ───────────────────────────────────────

/**
 * Store the access token from Teller Connect and sync accounts + transactions.
 */
export async function enrollBank(userId: string, accessToken: string): Promise<void> {
  // Store access token
  db.prepare('UPDATE users SET teller_access_token = ? WHERE id = ?').run(accessToken, userId);

  // Sync immediately
  await syncAccounts(userId, accessToken);
}

/**
 * Fetch accounts and transactions from Teller and store in our DB.
 */
export async function syncAccounts(userId: string, accessToken?: string): Promise<void> {
  if (!accessToken) {
    const row = db.prepare('SELECT teller_access_token FROM users WHERE id = ?').get(userId) as any;
    accessToken = row?.teller_access_token;
    if (!accessToken) throw new Error('No Teller access token. Connect a bank first.');
  }

  // ── Fetch accounts ──
  const accounts = await tellerRequest<TellerAccount[]>('/accounts', accessToken);

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
    let balance = 0;
    let available: number | null = null;
    try {
      const bal = await tellerRequest<TellerBalance>(`/accounts/${acct.id}/balances`, accessToken!);
      balance = parseFloat(bal.ledger || '0');
      available = bal.available ? parseFloat(bal.available) : null;
    } catch {
      // Balance fetch can fail for some account types; continue with 0
    }

    upsertAcct.run(
      crypto.randomUUID(), userId, acct.id, acct.name, type,
      balance, available,
    );
  }

  // ── Fetch transactions for each account ──
  const insertTxn = db.prepare(
    `INSERT OR IGNORE INTO transactions (id, user_id, account_id, amount, date, merchant_name, category, is_recurring)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
  );

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

      for (const txn of transactions) {
        const amount = parseFloat(txn.amount);
        const merchantName = txn.details?.counterparty?.name || txn.description;
        const category = txn.details?.category || null;

        insertTxn.run(
          crypto.randomUUID(), userId, acctRow.id,
          amount, // Teller: negative = money out, positive = money in (same as our convention)
          txn.date, merchantName, category,
        );
      }
    } catch (err) {
      console.warn(`Failed to fetch transactions for account ${acct.id}:`, err);
    }
  }
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
