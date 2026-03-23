import crypto from 'crypto';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { env } from '../config/env';
import db from '../config/db';

const config = new Configuration({
  basePath: PlaidEnvironments[env.PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': env.PLAID_CLIENT_ID,
      'PLAID-SECRET': env.PLAID_SECRET,
    },
  },
});

const client = new PlaidApi(config);

export async function createLinkToken(userId: string): Promise<string> {
  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Runway',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
  });
  return response.data.link_token;
}

export async function exchangePublicToken(userId: string, publicToken: string): Promise<void> {
  const response = await client.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = response.data.access_token;

  db.prepare('UPDATE users SET plaid_access_token = ? WHERE id = ?').run(accessToken, userId);

  await syncAccounts(userId, accessToken);
}

export async function syncAccounts(userId: string, accessToken?: string): Promise<void> {
  if (!accessToken) {
    const row = db.prepare('SELECT plaid_access_token FROM users WHERE id = ?').get(userId) as any;
    accessToken = row?.plaid_access_token;
    if (!accessToken) throw new Error('No Plaid access token');
  }

  // Fetch accounts
  const accountsRes = await client.accountsGet({ access_token: accessToken });

  const upsertAcct = db.prepare(
    `INSERT INTO accounts (id, user_id, plaid_account_id, name, type, current_balance, available_balance, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (user_id, plaid_account_id)
       DO UPDATE SET current_balance = excluded.current_balance, available_balance = excluded.available_balance, last_synced_at = datetime('now')`
  );

  for (const acct of accountsRes.data.accounts) {
    const type = acct.type === 'depository'
      ? (acct.subtype === 'savings' ? 'savings' : 'checking')
      : 'credit';
    upsertAcct.run(
      crypto.randomUUID(), userId, acct.account_id, acct.name, type,
      acct.balances.current ?? 0, acct.balances.available
    );
  }

  // Fetch transactions (last 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startDate = thirtyDaysAgo.toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];

  const txnRes = await client.transactionsGet({
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
  });

  const insertTxn = db.prepare(
    `INSERT OR IGNORE INTO transactions (id, user_id, account_id, amount, date, merchant_name, category, is_recurring)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
  );

  for (const txn of txnRes.data.transactions) {
    const acctRow = db.prepare(
      'SELECT id FROM accounts WHERE user_id = ? AND plaid_account_id = ?'
    ).get(userId, txn.account_id) as any;
    if (!acctRow) continue;

    insertTxn.run(
      crypto.randomUUID(), userId, acctRow.id,
      -txn.amount, txn.date, txn.merchant_name || txn.name,
      txn.personal_finance_category?.primary || null
    );
  }
}
