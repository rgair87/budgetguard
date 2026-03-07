import { CountryCode, Products, type TransactionsSyncResponse } from 'plaid';
import { plaidClient } from '../config/plaid.js';
import { query, transaction } from '../config/database.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { env } from '../config/env.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type PgBoss from 'pg-boss';

let boss: PgBoss | null = null;

export function setBoss(pgBoss: PgBoss) {
  boss = pgBoss;
}

export async function createLinkToken(userId: string) {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'BudgetGuard',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    webhook: env.PLAID_WEBHOOK_URL,
  });

  logger.info({ userId }, 'Plaid link token created');

  return {
    linkToken: response.data.link_token,
    expiration: response.data.expiration,
  };
}

export async function exchangePublicToken(
  userId: string,
  publicToken: string,
  metadata: {
    institution?: { institution_id: string; name: string };
    accounts?: Array<{
      id: string;
      name: string;
      mask: string | null;
      type: string;
      subtype: string | null;
    }>;
  }
) {
  const exchangeResponse = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });

  const { access_token: accessToken, item_id: itemId } = exchangeResponse.data;

  // Encrypt access token before storing
  const encryptedAccessToken = await encrypt(accessToken);

  return transaction(async (client) => {
    // Store the Plaid item
    const itemResult = await client.query<{ id: string }>(
      `INSERT INTO plaid_items (
         user_id, plaid_item_id, plaid_access_token,
         institution_id, institution_name, cursor
       )
       VALUES ($1, $2, $3, $4, $5, NULL)
       RETURNING id`,
      [
        userId,
        itemId,
        encryptedAccessToken,
        metadata.institution?.institution_id || null,
        metadata.institution?.name || null,
      ]
    );

    const plaidItemId = itemResult.rows[0].id;

    // Store accounts from metadata
    if (metadata.accounts && metadata.accounts.length > 0) {
      for (const account of metadata.accounts) {
        await client.query(
          `INSERT INTO accounts (
             user_id, plaid_item_id, plaid_account_id,
             name, mask, type, subtype
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (plaid_account_id) DO UPDATE SET
             name = EXCLUDED.name,
             mask = EXCLUDED.mask,
             type = EXCLUDED.type,
             subtype = EXCLUDED.subtype`,
          [
            userId,
            plaidItemId,
            account.id,
            account.name,
            account.mask,
            account.type,
            account.subtype || null,
          ]
        );
      }
    }

    // Enqueue initial transaction sync job
    if (boss) {
      await boss.send('sync-transactions', {
        plaidItemId,
        userId,
      });
    }

    logger.info(
      { userId, plaidItemId, institutionName: metadata.institution?.name },
      'Plaid item connected and accounts stored'
    );

    return { plaidItemId };
  });
}

export async function handleWebhook(body: {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  [key: string]: unknown;
}) {
  const { webhook_type: webhookType, webhook_code: webhookCode, item_id: plaidItemId } = body;

  logger.info({ webhookType, webhookCode, plaidItemId }, 'Plaid webhook received');

  if (webhookType === 'TRANSACTIONS') {
    // Look up the internal plaid_item record
    const itemResult = await query<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM plaid_items WHERE plaid_item_id = $1',
      [plaidItemId]
    );

    if (itemResult.rows.length === 0) {
      logger.warn({ plaidItemId }, 'Webhook received for unknown Plaid item');
      return;
    }

    const item = itemResult.rows[0];

    if (
      webhookCode === 'SYNC_UPDATES_AVAILABLE' ||
      webhookCode === 'INITIAL_UPDATE' ||
      webhookCode === 'HISTORICAL_UPDATE' ||
      webhookCode === 'DEFAULT_UPDATE'
    ) {
      if (boss) {
        await boss.send('sync-transactions', {
          plaidItemId: item.id,
          userId: item.user_id,
        });
      }
    }
  }
}

export async function syncTransactions(plaidItemId: string) {
  // Fetch the plaid item
  const itemResult = await query<{
    id: string;
    user_id: string;
    plaid_access_token: Buffer;
    cursor: string | null;
  }>(
    'SELECT id, user_id, plaid_access_token, cursor FROM plaid_items WHERE id = $1',
    [plaidItemId]
  );

  if (itemResult.rows.length === 0) {
    throw new NotFoundError('Plaid item not found');
  }

  const item = itemResult.rows[0];

  // Decrypt the access token
  const accessToken = await decrypt(item.plaid_access_token);

  let cursor = item.cursor;
  let hasMore = true;
  let addedCount = 0;
  let modifiedCount = 0;
  let removedCount = 0;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor: cursor || undefined,
    });

    const data: TransactionsSyncResponse = response.data;

    // Process added transactions
    for (const txn of data.added) {
      // Look up internal account ID
      const accountResult = await query<{ id: string }>(
        'SELECT id FROM accounts WHERE plaid_account_id = $1',
        [txn.account_id]
      );

      if (accountResult.rows.length === 0) continue;

      const accountId = accountResult.rows[0].id;

      await query(
        `INSERT INTO transactions (
           user_id, account_id, plaid_transaction_id,
           amount, iso_currency_code, date,
           name, merchant_name,
           category, pending, logo_url
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (plaid_transaction_id) DO UPDATE SET
           amount = EXCLUDED.amount,
           pending = EXCLUDED.pending,
           name = EXCLUDED.name,
           merchant_name = EXCLUDED.merchant_name,
           category = EXCLUDED.category`,
        [
          item.user_id,
          accountId,
          txn.transaction_id,
          txn.amount,
          txn.iso_currency_code || 'USD',
          txn.date,
          txn.name,
          txn.merchant_name || null,
          txn.personal_finance_category?.primary || null,
          txn.pending,
          txn.logo_url || null,
        ]
      );

      addedCount++;
    }

    // Process modified transactions
    for (const txn of data.modified) {
      await query(
        `UPDATE transactions SET
           amount = $1, pending = $2, name = $3,
           merchant_name = $4, category = $5
         WHERE plaid_transaction_id = $6 AND user_id = $7`,
        [
          txn.amount,
          txn.pending,
          txn.name,
          txn.merchant_name || null,
          txn.personal_finance_category?.primary || null,
          txn.transaction_id,
          item.user_id,
        ]
      );

      modifiedCount++;
    }

    // Process removed transactions
    for (const removed of data.removed) {
      await query(
        'DELETE FROM transactions WHERE plaid_transaction_id = $1 AND user_id = $2',
        [removed.transaction_id, item.user_id]
      );

      removedCount++;
    }

    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  // Update cursor on the plaid item
  await query(
    'UPDATE plaid_items SET cursor = $1, last_synced_at = NOW() WHERE id = $2',
    [cursor, plaidItemId]
  );

  logger.info(
    { plaidItemId, addedCount, modifiedCount, removedCount },
    'Transaction sync completed'
  );

  return { addedCount, modifiedCount, removedCount };
}

export async function getAccounts(userId: string) {
  const result = await query<{
    id: string;
    plaid_item_id: string;
    plaid_account_id: string;
    name: string;
    mask: string | null;
    type: string;
    subtype: string | null;
    balance_available: number | null;
    balance_current: number | null;
    balance_iso_currency_code: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT a.*, pi.institution_name
     FROM accounts a
     JOIN plaid_items pi ON a.plaid_item_id = pi.id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC`,
    [userId]
  );

  return result.rows;
}

export async function getAccount(userId: string, accountId: string) {
  const result = await query(
    `SELECT a.*, pi.institution_name
     FROM accounts a
     JOIN plaid_items pi ON a.plaid_item_id = pi.id
     WHERE a.id = $1 AND a.user_id = $2`,
    [accountId, userId]
  );

  return result.rows[0] || null;
}

export async function unlinkAccount(userId: string, accountId: string) {
  // Get the account and its plaid item
  const accountResult = await query<{ id: string; plaid_item_id: string }>(
    'SELECT id, plaid_item_id FROM accounts WHERE id = $1 AND user_id = $2',
    [accountId, userId]
  );

  if (accountResult.rows.length === 0) {
    throw new NotFoundError('Account not found');
  }

  const account = accountResult.rows[0];

  await transaction(async (client) => {
    // Delete transactions for this account
    await client.query(
      'DELETE FROM transactions WHERE account_id = $1 AND user_id = $2',
      [accountId, userId]
    );

    // Delete the account
    await client.query(
      'DELETE FROM accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    // Check if there are remaining accounts for this plaid item
    const remaining = await client.query(
      'SELECT COUNT(*) as count FROM accounts WHERE plaid_item_id = $1',
      [account.plaid_item_id]
    );

    // If no accounts remain, remove the plaid item and revoke access
    if (parseInt(remaining.rows[0].count, 10) === 0) {
      const itemResult = await client.query<{ plaid_access_token: Buffer }>(
        'SELECT plaid_access_token FROM plaid_items WHERE id = $1',
        [account.plaid_item_id]
      );

      if (itemResult.rows.length > 0) {
        const accessToken = await decrypt(itemResult.rows[0].plaid_access_token);
        try {
          await plaidClient.itemRemove({ access_token: accessToken });
        } catch (err) {
          logger.warn({ err, plaidItemId: account.plaid_item_id }, 'Failed to revoke Plaid access token');
        }
      }

      await client.query('DELETE FROM plaid_items WHERE id = $1', [account.plaid_item_id]);
    }
  });

  logger.info({ userId, accountId }, 'Account unlinked');
}

export async function refreshBalance(userId: string, accountId: string) {
  const accountResult = await query<{
    id: string;
    plaid_account_id: string;
    plaid_item_id: string;
  }>(
    `SELECT a.id, a.plaid_account_id, a.plaid_item_id
     FROM accounts a
     WHERE a.id = $1 AND a.user_id = $2`,
    [accountId, userId]
  );

  if (accountResult.rows.length === 0) {
    throw new NotFoundError('Account not found');
  }

  const account = accountResult.rows[0];

  // Get the access token for this item
  const itemResult = await query<{ plaid_access_token: Buffer }>(
    'SELECT plaid_access_token FROM plaid_items WHERE id = $1',
    [account.plaid_item_id]
  );

  if (itemResult.rows.length === 0) {
    throw new NotFoundError('Plaid item not found');
  }

  const accessToken = await decrypt(itemResult.rows[0].plaid_access_token);

  // Fetch balances from Plaid
  const balanceResponse = await plaidClient.accountsBalanceGet({
    access_token: accessToken,
    options: {
      account_ids: [account.plaid_account_id],
    },
  });

  const plaidAccount = balanceResponse.data.accounts[0];

  if (plaidAccount) {
    await query(
      `UPDATE accounts SET
         balance_available = $1,
         balance_current = $2,
         balance_iso_currency_code = $3,
         updated_at = NOW()
       WHERE id = $4`,
      [
        plaidAccount.balances.available,
        plaidAccount.balances.current,
        plaidAccount.balances.iso_currency_code || 'USD',
        accountId,
      ]
    );
  }

  // Return the updated account
  return getAccount(userId, accountId);
}
