import type PgBoss from 'pg-boss';
import { logger } from '../utils/logger.js';
import { query } from '../config/database.js';
import { plaidClient } from '../config/plaid.js';
import { decrypt } from '../utils/encryption.js';
import { enqueueJob } from './jobRunner.js';

interface SyncJobData {
  plaidItemId: string;
  isInitialSync?: boolean;
}

export async function handleSyncTransactions(job: PgBoss.Job<SyncJobData>) {
  const { plaidItemId, isInitialSync } = job.data;
  logger.info({ plaidItemId }, 'Starting transaction sync');

  try {
    // Get plaid item with encrypted access token
    const itemResult = await query(
      `SELECT id, user_id, access_token_encrypted, transaction_cursor
       FROM plaid_items WHERE id = $1 AND status = 'active'`,
      [plaidItemId]
    );

    if (itemResult.rows.length === 0) {
      logger.warn({ plaidItemId }, 'Plaid item not found or inactive');
      return;
    }

    const item = itemResult.rows[0];
    const accessToken = await decrypt(item.access_token_encrypted);

    let cursor = item.transaction_cursor || undefined;
    let hasMore = true;
    let addedCount = 0;
    let modifiedCount = 0;
    let removedCount = 0;

    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
      });

      const { added, modified, removed, next_cursor, has_more } = response.data;

      // Process added transactions
      for (const txn of added) {
        await query(
          `INSERT INTO transactions (
            user_id, account_id, plaid_transaction_id, amount, date,
            authorized_date, name, merchant_name,
            personal_finance_category_primary, personal_finance_category_detailed,
            pending, pending_transaction_id, payment_channel, transaction_type
          )
          SELECT $1, a.id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          FROM accounts a WHERE a.plaid_account_id = $2
          ON CONFLICT (plaid_transaction_id) DO NOTHING`,
          [
            item.user_id,
            txn.account_id,
            txn.transaction_id,
            txn.amount,
            txn.date,
            txn.authorized_date,
            txn.name,
            txn.merchant_name,
            txn.personal_finance_category?.primary,
            txn.personal_finance_category?.detailed,
            txn.pending,
            txn.pending_transaction_id,
            txn.payment_channel,
            txn.transaction_type,
          ]
        );
        addedCount++;
      }

      // Process modified transactions
      for (const txn of modified) {
        await query(
          `UPDATE transactions SET
            amount = $2, date = $3, authorized_date = $4, name = $5,
            merchant_name = $6, pending = $7, updated_at = NOW()
          WHERE plaid_transaction_id = $1`,
          [
            txn.transaction_id,
            txn.amount,
            txn.date,
            txn.authorized_date,
            txn.name,
            txn.merchant_name,
            txn.pending,
          ]
        );
        modifiedCount++;
      }

      // Process removed transactions
      for (const txn of removed) {
        await query(
          `DELETE FROM transactions WHERE plaid_transaction_id = $1`,
          [txn.transaction_id]
        );
        removedCount++;
      }

      cursor = next_cursor;
      hasMore = has_more;
    }

    // Update cursor and last synced timestamp
    await query(
      `UPDATE plaid_items SET transaction_cursor = $2, last_synced_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [plaidItemId, cursor]
    );

    logger.info(
      { plaidItemId, addedCount, modifiedCount, removedCount },
      'Transaction sync completed'
    );

    // After initial sync, trigger subscription detection and budget generation
    if (isInitialSync) {
      await enqueueJob('detect-subscriptions', { userId: item.user_id });
    }
  } catch (error) {
    logger.error({ plaidItemId, error }, 'Transaction sync failed');
    throw error;
  }
}
