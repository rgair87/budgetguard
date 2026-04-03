import db from '../config/db';

/**
 * Shared income calculation service.
 *
 * Uses actual deposit history (3-month trailing average) as the primary income source.
 * Filters out non-paycheck noise (refunds, cashback, transfers) and outliers (bonuses, stock sales, tax refunds).
 * Falls back to user-configured take_home_pay if no deposit history exists.
 *
 * Every service that needs "monthly income" should call getMonthlyIncome() instead of
 * reading take_home_pay directly.
 */

export interface IncomeResult {
  monthlyIncome: number;           // Best estimate of regular monthly income
  source: 'deposits' | 'settings'; // Where the number came from
  confidence: 'high' | 'medium' | 'low'; // How reliable this estimate is
  depositBased: number;            // Income calculated purely from deposits (0 if no data)
  settingsBased: number;           // Income from take_home_pay * frequency (0 if not set)
  outlierTotal: number;            // Excluded bonus/windfall amount in last 90 days
  incomeIsVariable: boolean;       // True if deposit amounts vary significantly
}

// Deposits matching these keywords are NOT regular income
const NON_PAY_KEYWORDS = [
  'refund', 'cashback', 'cash back', 'venmo', 'zelle', 'paypal',
  'int trnsfr', 'acct xfer', 'inst xfer', 'ext trnsfr',
  'atm', 'reversal', 'adjustment', 'interest', 'dividend', 'rebate',
  'irs', 'tax ref', 'treas 310',
];

const NON_PAY_WHERE = NON_PAY_KEYWORDS.map(() => 'LOWER(merchant_name) NOT LIKE ?').join(' AND ');
const NON_PAY_PARAMS = NON_PAY_KEYWORDS.map(k => `%${k}%`);

/**
 * Calculate monthly income from actual deposit history.
 * Returns outlier-filtered 3-month average.
 */
function calculateDepositIncome(userId: string): { monthly: number; outlierTotal: number; isVariable: boolean } {
  const rows = db.prepare(
    `SELECT merchant_name, amount, date FROM transactions
     WHERE user_id = ? AND amount > 0 AND amount >= 200
       AND date >= date('now', '-90 days')
       AND (merchant_name IS NULL OR (${NON_PAY_WHERE}))
     ORDER BY date DESC`
  ).all(userId, ...NON_PAY_PARAMS) as unknown as { merchant_name: string; amount: number; date: string }[];

  if (rows.length === 0) return { monthly: 0, outlierTotal: 0, isVariable: false };

  // Group by source
  const bySource = new Map<string, number[]>();
  for (const r of rows) {
    const key = (r.merchant_name || 'unknown').toLowerCase().substring(0, 30).trim();
    const existing = bySource.get(key) || [];
    existing.push(r.amount);
    bySource.set(key, existing);
  }

  let totalRegular = 0;
  let totalOutlier = 0;
  const allRegularAmounts: number[] = [];

  for (const [, amounts] of bySource) {
    if (amounts.length < 2) {
      // Single deposit from a source — could be a one-off. Include if modest, exclude if huge.
      const amt = amounts[0];
      if (amt <= 5000) {
        totalRegular += amt;
        allRegularAmounts.push(amt);
      } else {
        totalOutlier += amt;
      }
      continue;
    }

    // Multiple deposits from same source — use median to filter outliers
    const sorted = [...amounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    for (const a of amounts) {
      if (a > median * 3) {
        totalOutlier += a;
      } else {
        totalRegular += a;
        allRegularAmounts.push(a);
      }
    }
  }

  const monthly = Math.round(totalRegular / 3);

  // Determine variability: coefficient of variation > 0.3 = variable income
  let isVariable = false;
  if (allRegularAmounts.length >= 3) {
    const mean = allRegularAmounts.reduce((s, a) => s + a, 0) / allRegularAmounts.length;
    if (mean > 0) {
      const variance = allRegularAmounts.reduce((s, a) => s + (a - mean) ** 2, 0) / allRegularAmounts.length;
      const cv = Math.sqrt(variance) / mean;
      isVariable = cv > 0.3;
    }
  }

  return { monthly, outlierTotal: Math.round(totalOutlier), isVariable };
}

/**
 * Calculate monthly income from user settings (take_home_pay * frequency).
 */
function calculateSettingsIncome(userId: string): number {
  const user = db.prepare('SELECT take_home_pay, pay_frequency FROM users WHERE id = ?').get(userId) as any;
  if (!user?.take_home_pay || user.take_home_pay <= 0) return 0;

  const freq = user.pay_frequency || 'monthly';
  const multiplier = freq === 'weekly' ? 4.33
    : freq === 'biweekly' ? 2.167
    : freq === 'twice_monthly' ? 2
    : 1;
  return Math.round(user.take_home_pay * multiplier);
}

/**
 * Get the best estimate of monthly income for a user.
 *
 * Priority:
 * 1. If deposit history exists and is reliable → use deposit-based income
 * 2. If user has take_home_pay set and no deposits → use settings-based income
 * 3. If both exist and are within 30% → use settings (user knows best)
 * 4. If both exist and diverge → use deposit-based (more accurate) but flag it
 */
export function getMonthlyIncome(userId: string): IncomeResult {
  const deposit = calculateDepositIncome(userId);
  const settings = calculateSettingsIncome(userId);

  let monthlyIncome: number;
  let source: 'deposits' | 'settings';
  let confidence: 'high' | 'medium' | 'low';

  if (deposit.monthly > 0 && settings > 0) {
    // Both sources available — check if they agree
    const ratio = Math.abs(deposit.monthly - settings) / Math.max(deposit.monthly, settings);
    if (ratio <= 0.3) {
      // Within 30% — use user's setting (they know their pay)
      monthlyIncome = settings;
      source = 'settings';
      confidence = 'high';
    } else {
      // Diverge significantly — use deposits (actual data wins)
      monthlyIncome = deposit.monthly;
      source = 'deposits';
      confidence = 'medium';
    }
  } else if (deposit.monthly > 0) {
    monthlyIncome = deposit.monthly;
    source = 'deposits';
    confidence = deposit.isVariable ? 'medium' : 'high';
  } else if (settings > 0) {
    monthlyIncome = settings;
    source = 'settings';
    confidence = 'medium';
  } else {
    monthlyIncome = 0;
    source = 'settings';
    confidence = 'low';
  }

  return {
    monthlyIncome,
    source,
    confidence,
    depositBased: deposit.monthly,
    settingsBased: settings,
    outlierTotal: deposit.outlierTotal,
    incomeIsVariable: deposit.isVariable,
  };
}
