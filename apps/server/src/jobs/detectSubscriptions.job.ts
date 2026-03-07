import type PgBoss from 'pg-boss';
import { logger } from '../utils/logger.js';
import { query } from '../config/database.js';

interface DetectJobData {
  userId: string;
}

function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*(inc\.?|llc|ltd|corp\.?|co\.?)\s*$/i, '')
    .replace(/\s*#\d+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^(sq\s*\*|tst\s*\*|paypal\s*\*)/i, '')
    .trim();
}

function detectFrequency(intervals: number[]): { frequency: string; isConsistent: boolean } {
  if (intervals.length === 0) return { frequency: 'monthly', isConsistent: false };

  const median = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];

  if (median <= 9) return { frequency: 'weekly', isConsistent: true };
  if (median <= 17) return { frequency: 'bi-weekly', isConsistent: true };
  if (median >= 28 && median <= 35) return { frequency: 'monthly', isConsistent: true };
  if (median >= 85 && median <= 100) return { frequency: 'quarterly', isConsistent: true };
  if (median >= 355 && median <= 375) return { frequency: 'yearly', isConsistent: true };

  return { frequency: 'monthly', isConsistent: false };
}

function calculateConfidence(
  amountCV: number,
  intervalStdDev: number,
  daysSinceLastCharge: number,
  expectedInterval: number,
  occurrences: number
): number {
  let confidence = 0;

  // Amount consistency
  if (amountCV < 0.05) confidence += 0.35;
  else if (amountCV < 0.10) confidence += 0.25;
  else if (amountCV < 0.25) confidence += 0.10;

  // Frequency consistency
  if (intervalStdDev < 3) confidence += 0.35;
  else if (intervalStdDev < 7) confidence += 0.25;
  else if (intervalStdDev < 14) confidence += 0.10;

  // Recency
  if (daysSinceLastCharge <= expectedInterval * 1.5) confidence += 0.15;
  else confidence += 0.05;

  // Occurrence count
  if (occurrences >= 6) confidence += 0.15;
  else if (occurrences >= 3) confidence += 0.10;
  else if (occurrences >= 2) confidence += 0.05;

  return Math.min(confidence, 1.0);
}

export async function handleDetectSubscriptions(job: PgBoss.Job<DetectJobData>) {
  const { userId } = job.data;
  logger.info({ userId }, 'Starting subscription detection');

  try {
    // Get transactions from last 12 months grouped by merchant
    const result = await query(
      `SELECT
        merchant_name,
        array_agg(amount ORDER BY date) as amounts,
        array_agg(date ORDER BY date) as dates,
        count(*) as occurrence_count,
        avg(amount) as avg_amount,
        stddev(amount) as amount_stddev,
        max(date) as last_charge_date,
        min(date) as first_seen_date
      FROM transactions
      WHERE user_id = $1
        AND date >= CURRENT_DATE - INTERVAL '12 months'
        AND merchant_name IS NOT NULL
        AND merchant_name != ''
        AND personal_finance_category_primary NOT IN ('FOOD_AND_DRINK_GROCERIES', 'GENERAL_MERCHANDISE', 'GAS')
      GROUP BY merchant_name
      HAVING count(*) >= 2`,
      [userId]
    );

    let newSubscriptions = 0;

    for (const row of result.rows) {
      const normalizedName = normalizeMerchantName(row.merchant_name);
      const amounts: number[] = row.amounts;
      const dates: string[] = row.dates;
      const mean = parseFloat(row.avg_amount);
      const stddev = row.amount_stddev ? parseFloat(row.amount_stddev) : 0;
      const amountCV = mean !== 0 ? stddev / Math.abs(mean) : 1;

      // Calculate intervals between charges
      const intervals: number[] = [];
      for (let i = 1; i < dates.length; i++) {
        const d1 = new Date(dates[i - 1]);
        const d2 = new Date(dates[i]);
        intervals.push(Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
      }

      const { frequency, isConsistent } = detectFrequency(intervals);

      if (!isConsistent && amountCV > 0.25) continue;

      // Calculate interval standard deviation
      const intervalMean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const intervalStdDev = Math.sqrt(
        intervals.reduce((sum, v) => sum + Math.pow(v - intervalMean, 2), 0) / intervals.length
      );

      const daysSinceLastCharge = Math.round(
        (Date.now() - new Date(row.last_charge_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      const confidence = calculateConfidence(
        amountCV,
        intervalStdDev,
        daysSinceLastCharge,
        intervalMean,
        parseInt(row.occurrence_count)
      );

      if (confidence < 0.50) continue;

      // Calculate next expected date
      const lastDate = new Date(row.last_charge_date);
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + Math.round(intervalMean));

      // Upsert subscription
      const upsertResult = await query(
        `INSERT INTO subscriptions (
          user_id, merchant_name, normalized_name, estimated_amount,
          frequency, confidence_score, first_seen_date, last_charge_date,
          next_expected_date, total_charges, total_spent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (user_id, normalized_name)
        DO UPDATE SET
          estimated_amount = EXCLUDED.estimated_amount,
          confidence_score = GREATEST(subscriptions.confidence_score, EXCLUDED.confidence_score),
          last_charge_date = EXCLUDED.last_charge_date,
          next_expected_date = EXCLUDED.next_expected_date,
          total_charges = EXCLUDED.total_charges,
          total_spent = EXCLUDED.total_spent,
          updated_at = NOW()
        WHERE subscriptions.status = 'detected'
        RETURNING id, (xmax = 0) as is_new`,
        [
          userId,
          row.merchant_name,
          normalizedName,
          Math.abs(mean).toFixed(2),
          frequency,
          confidence.toFixed(2),
          row.first_seen_date,
          row.last_charge_date,
          nextDate.toISOString().split('T')[0],
          parseInt(row.occurrence_count),
          amounts.reduce((sum: number, a: number) => sum + Math.abs(a), 0).toFixed(2),
        ]
      );

      if (upsertResult.rows[0]?.is_new) {
        newSubscriptions++;

        // Create notification for new subscription
        await query(
          `INSERT INTO notifications (
            user_id, type, title, body, action_url,
            related_entity_type, related_entity_id, next_alert_at
          ) VALUES ($1, 'new_subscription', $2, $3, $4, 'subscription', $5, NOW())`,
          [
            userId,
            `New subscription detected: ${row.merchant_name}`,
            `We found a recurring charge to ${row.merchant_name} for ~$${Math.abs(mean).toFixed(2)}/${frequency}. Tap to keep or cancel.`,
            `/subscriptions/${upsertResult.rows[0].id}`,
            upsertResult.rows[0].id,
          ]
        );
      }
    }

    logger.info(
      { userId, detected: result.rows.length, newSubscriptions },
      'Subscription detection completed'
    );
  } catch (error) {
    logger.error({ userId, error }, 'Subscription detection failed');
    throw error;
  }
}
