import { query, transaction } from '../config/database.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type PgBoss from 'pg-boss';

let boss: PgBoss | null = null;

export function setBoss(pgBoss: PgBoss) {
  boss = pgBoss;
}

export async function getAll(userId: string) {
  const result = await query(
    `SELECT
       s.id, s.user_id, s.merchant_name, s.normalized_merchant_name,
       s.estimated_amount, s.frequency, s.confidence,
       s.status, s.classified_at, s.last_charge_date,
       s.next_expected_date, s.logo_url, s.category,
       s.cancel_url, s.cancel_instructions,
       s.created_at, s.updated_at,
       CASE WHEN sl.id IS NOT NULL THEN true ELSE false END AS is_safe
     FROM subscriptions s
     LEFT JOIN safe_list sl ON sl.subscription_id = s.id AND sl.user_id = s.user_id
     WHERE s.user_id = $1
     ORDER BY s.estimated_amount DESC`,
    [userId]
  );

  return result.rows;
}

export async function getById(userId: string, id: string) {
  const subResult = await query(
    `SELECT
       s.id, s.user_id, s.merchant_name, s.normalized_merchant_name,
       s.estimated_amount, s.frequency, s.confidence,
       s.status, s.classified_at, s.last_charge_date,
       s.next_expected_date, s.logo_url, s.category,
       s.cancel_url, s.cancel_instructions,
       s.created_at, s.updated_at,
       CASE WHEN sl.id IS NOT NULL THEN true ELSE false END AS is_safe,
       sl.keep_reason, sl.keep_until
     FROM subscriptions s
     LEFT JOIN safe_list sl ON sl.subscription_id = s.id AND sl.user_id = s.user_id
     WHERE s.id = $1 AND s.user_id = $2`,
    [id, userId]
  );

  if (subResult.rows.length === 0) {
    throw new NotFoundError('Subscription not found');
  }

  // Get related transaction history
  const transactionsResult = await query(
    `SELECT id, amount, date, name, merchant_name
     FROM transactions
     WHERE user_id = $1
       AND LOWER(TRIM(merchant_name)) = $2
     ORDER BY date DESC
     LIMIT 24`,
    [userId, subResult.rows[0].normalized_merchant_name]
  );

  return {
    ...subResult.rows[0],
    transactions: transactionsResult.rows,
  };
}

export async function classify(
  userId: string,
  id: string,
  action: 'safe_list' | 'cancel' | 'dismiss',
  keepUntil?: string,
  keepReason?: string
) {
  // Verify subscription exists and belongs to user
  const existing = await query(
    'SELECT id, status FROM subscriptions WHERE id = $1 AND user_id = $2',
    [id, userId]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError('Subscription not found');
  }

  return transaction(async (client) => {
    if (action === 'safe_list') {
      // Update subscription status
      await client.query(
        `UPDATE subscriptions
         SET status = 'safe', classified_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      // Insert into safe_list table
      await client.query(
        `INSERT INTO safe_list (user_id, subscription_id, keep_until, keep_reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, subscription_id) DO UPDATE SET
           keep_until = EXCLUDED.keep_until,
           keep_reason = EXCLUDED.keep_reason,
           updated_at = NOW()`,
        [userId, id, keepUntil || null, keepReason || null]
      );
    } else if (action === 'cancel') {
      await client.query(
        `UPDATE subscriptions
         SET status = 'cancel_requested', classified_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
    } else if (action === 'dismiss') {
      await client.query(
        `UPDATE subscriptions
         SET status = 'dismissed', classified_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
    } else {
      throw new BadRequestError(`Invalid action: ${action}`);
    }

    // Resolve any pending alerts/notifications for this subscription
    await client.query(
      `UPDATE notifications
       SET dismissed_at = NOW()
       WHERE user_id = $1
         AND related_entity_type = 'subscription'
         AND related_entity_id = $2
         AND dismissed_at IS NULL`,
      [userId, id]
    );

    logger.info({ userId, subscriptionId: id, action }, 'Subscription classified');

    return { success: true };
  });
}

export async function getCancelGuide(subscriptionId: string) {
  const result = await query<{
    cancel_url: string | null;
    cancel_instructions: string | null;
    merchant_name: string;
  }>(
    'SELECT cancel_url, cancel_instructions, merchant_name FROM subscriptions WHERE id = $1',
    [subscriptionId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Subscription not found');
  }

  return {
    merchantName: result.rows[0].merchant_name,
    cancelUrl: result.rows[0].cancel_url,
    cancelInstructions: result.rows[0].cancel_instructions,
  };
}

export async function triggerDetection(userId: string) {
  if (!boss) {
    throw new Error('Job queue not initialized');
  }

  const jobId = await boss.send('detect-subscriptions', { userId });

  logger.info({ userId, jobId }, 'Subscription detection job enqueued');

  return { jobId };
}

// -----------------------------------------------------------------------
// Core detection algorithm
// -----------------------------------------------------------------------

export async function detectSubscriptions(userId: string) {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Query all transactions for the last 12 months, grouped by normalized merchant
  const txnResult = await query<{
    normalized_merchant: string;
    merchant_name: string;
    amounts: number[];
    dates: string[];
    logo_url: string | null;
    category: string | null;
  }>(
    `SELECT
       LOWER(TRIM(merchant_name)) AS normalized_merchant,
       MAX(merchant_name) AS merchant_name,
       ARRAY_AGG(amount ORDER BY date ASC) AS amounts,
       ARRAY_AGG(date::text ORDER BY date ASC) AS dates,
       MAX(logo_url) AS logo_url,
       MAX(category) AS category
     FROM transactions
     WHERE user_id = $1
       AND date >= $2
       AND merchant_name IS NOT NULL
       AND amount > 0
     GROUP BY LOWER(TRIM(merchant_name))
     HAVING COUNT(*) >= 2`,
    [userId, twelveMonthsAgo.toISOString().split('T')[0]]
  );

  let detected = 0;
  let newDetections = 0;

  for (const group of txnResult.rows) {
    const normalizedName = normalizeMerchantName(group.normalized_merchant);
    const amounts: number[] = group.amounts;
    const dates: Date[] = group.dates.map((d) => new Date(d));

    // (a) Calculate amount coefficient of variation (stddev / mean)
    const amountMean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const amountVariance =
      amounts.reduce((sum, a) => sum + (a - amountMean) ** 2, 0) / amounts.length;
    const amountStddev = Math.sqrt(amountVariance);
    const amountCV = amountMean > 0 ? amountStddev / amountMean : 1;

    // (b) Calculate intervals between charges, determine frequency
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const diffMs = dates[i].getTime() - dates[i - 1].getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      intervals.push(diffDays);
    }

    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const intervalVariance =
      intervals.reduce((s, v) => s + (v - avgInterval) ** 2, 0) / intervals.length;
    const intervalStddev = Math.sqrt(intervalVariance);
    const intervalCV = avgInterval > 0 ? intervalStddev / avgInterval : 1;

    const frequency = determineFrequency(avgInterval);

    // (c) Score confidence
    // Amount consistency: low CV = high consistency
    const amountScore = Math.max(0, 1 - amountCV);

    // Frequency consistency: low interval CV = high consistency
    const frequencyScore = Math.max(0, 1 - intervalCV);

    // Recency: last charge within expected window
    const lastDate = dates[dates.length - 1];
    const daysSinceLastCharge =
      (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    const expectedNextDays = avgInterval * 1.5; // allow 50% buffer
    const recencyScore = daysSinceLastCharge <= expectedNextDays ? 1 : 0.3;

    // Occurrences: more charges = more confidence
    const occurrenceScore = Math.min(1, amounts.length / 6);

    const confidence =
      amountScore * 0.3 +
      frequencyScore * 0.3 +
      recencyScore * 0.2 +
      occurrenceScore * 0.2;

    // (d) If confidence >= 0.50, create/update subscription
    if (confidence >= 0.5) {
      // Calculate next expected date
      const nextExpected = new Date(lastDate);
      nextExpected.setDate(nextExpected.getDate() + Math.round(avgInterval));

      const upsertResult = await query<{ id: string; was_new: boolean }>(
        `INSERT INTO subscriptions (
           user_id, merchant_name, normalized_merchant_name,
           estimated_amount, frequency, confidence,
           last_charge_date, next_expected_date,
           logo_url, category, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'detected')
         ON CONFLICT (user_id, normalized_merchant_name) DO UPDATE SET
           estimated_amount = EXCLUDED.estimated_amount,
           frequency = EXCLUDED.frequency,
           confidence = EXCLUDED.confidence,
           last_charge_date = EXCLUDED.last_charge_date,
           next_expected_date = EXCLUDED.next_expected_date,
           logo_url = COALESCE(EXCLUDED.logo_url, subscriptions.logo_url),
           category = COALESCE(EXCLUDED.category, subscriptions.category),
           updated_at = NOW()
         RETURNING id,
           (xmax = 0) AS was_new`,
        [
          userId,
          group.merchant_name,
          normalizedName,
          Math.round(amountMean * 100) / 100,
          frequency,
          Math.round(confidence * 100) / 100,
          lastDate.toISOString().split('T')[0],
          nextExpected.toISOString().split('T')[0],
          group.logo_url,
          group.category,
        ]
      );

      detected++;

      const sub = upsertResult.rows[0];

      // For NEW subscriptions (not previously detected), create notification
      if (sub.was_new) {
        newDetections++;

        await query(
          `INSERT INTO notifications (
             user_id, type, title, body,
             related_entity_type, related_entity_id
           )
           VALUES ($1, 'subscription_detected', $2, $3, 'subscription', $4)`,
          [
            userId,
            `New subscription detected: ${group.merchant_name}`,
            `We found a recurring charge of $${amountMean.toFixed(2)}/${frequency} from ${group.merchant_name}. Tap to review.`,
            sub.id,
          ]
        );
      }
    }
  }

  logger.info(
    { userId, detected, newDetections },
    'Subscription detection completed'
  );

  return { detected, newDetections };
}

function determineFrequency(avgIntervalDays: number): string {
  if (avgIntervalDays <= 10) return 'weekly';
  if (avgIntervalDays <= 18) return 'biweekly';
  if (avgIntervalDays <= 45) return 'monthly';
  if (avgIntervalDays <= 100) return 'quarterly';
  if (avgIntervalDays <= 200) return 'semi-annual';
  return 'annual';
}

export function normalizeMerchantName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Remove common corporate suffixes
  normalized = normalized.replace(
    /\s*(,?\s*(inc\.?|llc\.?|corp\.?|ltd\.?|co\.?|l\.?p\.?|plc\.?))+\s*$/i,
    ''
  );

  // Remove location patterns like #123 or Store #456
  normalized = normalized.replace(/\s*#\d+\s*/g, '');

  // Remove payment processor prefixes
  normalized = normalized.replace(
    /^(sq\s*\*|tst\s*\*|paypal\s*\*|pp\s*\*|sp\s*\*|goog\s*\*|amzn\s*\*|apple\.com\/bill)\s*/i,
    ''
  );

  // Remove trailing whitespace and extra spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}
