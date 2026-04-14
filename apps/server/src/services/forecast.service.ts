import db from '../config/db';
import { roundCurrency as rc } from '../utils/currency';

interface MonthlyHistory {
  month: string; // YYYY-MM
  amount: number;
}

interface BillForecast {
  merchantName: string;
  category: string;
  monthlyHistory: MonthlyHistory[]; // last 12 months
  averageAmount: number;
  nextExpectedAmount: number; // based on same month last year or recent trend
  nextExpectedMonth: string; // YYYY-MM
  trend: 'rising' | 'falling' | 'stable';
  seasonalPattern: boolean; // true if amount varies significantly by season
  highMonth: string; // month name with highest average (e.g. "July")
  lowMonth: string; // month name with lowest average
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getBillForecasts(userId: string): BillForecast[] {
  // Get all recurring merchants with 6+ months of data
  const rows = db.prepare(`
    SELECT merchant_name, category, strftime('%Y-%m', date) as month, SUM(ABS(amount)) as total
    FROM transactions
    WHERE user_id = ? AND amount < 0 AND is_recurring = 1
      AND date >= date('now', '-18 months')
      AND merchant_name IS NOT NULL
    GROUP BY merchant_name, strftime('%Y-%m', date)
    ORDER BY merchant_name, month
  `).all(userId) as { merchant_name: string; category: string; month: string; total: number }[];

  // Group by merchant
  const byMerchant = new Map<string, { category: string; months: Map<string, number> }>();
  for (const row of rows) {
    if (!byMerchant.has(row.merchant_name)) {
      byMerchant.set(row.merchant_name, { category: row.category || 'Other', months: new Map() });
    }
    const existing = byMerchant.get(row.merchant_name)!;
    existing.months.set(row.month, (existing.months.get(row.month) || 0) + row.total);
  }

  const forecasts: BillForecast[] = [];
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (const [merchant, data] of byMerchant) {
    // Need at least 4 months of data to forecast
    if (data.months.size < 4) continue;

    const monthlyHistory: MonthlyHistory[] = [];
    const amounts: number[] = [];
    const byMonthOfYear = new Map<number, number[]>(); // month (0-11) -> amounts

    for (const [month, amount] of data.months) {
      monthlyHistory.push({ month, amount: rc(amount) });
      amounts.push(amount);

      const monthNum = parseInt(month.split('-')[1]) - 1;
      if (!byMonthOfYear.has(monthNum)) byMonthOfYear.set(monthNum, []);
      byMonthOfYear.get(monthNum)!.push(amount);
    }

    // Sort by month
    monthlyHistory.sort((a, b) => a.month.localeCompare(b.month));
    // Keep last 12
    const recent12 = monthlyHistory.slice(-12);

    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;

    // Check for seasonal pattern: if the std deviation of monthly averages
    // is > 20% of the overall average, it's seasonal
    const monthAvgs: number[] = [];
    for (let m = 0; m < 12; m++) {
      const vals = byMonthOfYear.get(m);
      if (vals && vals.length > 0) {
        monthAvgs.push(vals.reduce((s, a) => s + a, 0) / vals.length);
      }
    }

    let seasonal = false;
    let highMonthIdx = 0;
    let lowMonthIdx = 0;

    if (monthAvgs.length >= 4) {
      const monthAvgValues = [...byMonthOfYear.entries()].map(([m, vals]) => ({
        month: m,
        avg: vals.reduce((s, a) => s + a, 0) / vals.length,
      }));
      const maxEntry = monthAvgValues.reduce((max, e) => e.avg > max.avg ? e : max, monthAvgValues[0]);
      const minEntry = monthAvgValues.reduce((min, e) => e.avg < min.avg ? e : min, monthAvgValues[0]);
      highMonthIdx = maxEntry.month;
      lowMonthIdx = minEntry.month;

      // Seasonal if the difference between high and low month is > 30% of average
      if (maxEntry.avg - minEntry.avg > avg * 0.3) {
        seasonal = true;
      }
    }

    // Predict next month's amount
    const nextMonthNum = (now.getMonth() + 1) % 12; // next month (0-indexed)
    const nextMonthStr = `${nextMonthNum === 0 ? now.getFullYear() + 1 : now.getFullYear()}-${String(nextMonthNum + 1).padStart(2, '0')}`;

    let nextExpected: number;
    if (seasonal && byMonthOfYear.has(nextMonthNum)) {
      // Use same-month average from historical data
      const sameMonthAmounts = byMonthOfYear.get(nextMonthNum)!;
      nextExpected = sameMonthAmounts.reduce((s, a) => s + a, 0) / sameMonthAmounts.length;
    } else {
      // Use 3-month rolling average
      const last3 = amounts.slice(-3);
      nextExpected = last3.reduce((s, a) => s + a, 0) / last3.length;
    }

    // Trend: compare last 3 months average to previous 3 months
    const recentAvg = amounts.slice(-3).reduce((s, a) => s + a, 0) / Math.min(3, amounts.length);
    const olderAvg = amounts.length >= 6
      ? amounts.slice(-6, -3).reduce((s, a) => s + a, 0) / 3
      : recentAvg;

    const trend = recentAvg > olderAvg * 1.1 ? 'rising' as const
      : recentAvg < olderAvg * 0.9 ? 'falling' as const
      : 'stable' as const;

    forecasts.push({
      merchantName: merchant,
      category: data.category,
      monthlyHistory: recent12,
      averageAmount: rc(avg),
      nextExpectedAmount: rc(nextExpected),
      nextExpectedMonth: nextMonthStr,
      trend,
      seasonalPattern: seasonal,
      highMonth: MONTH_NAMES[highMonthIdx],
      lowMonth: MONTH_NAMES[lowMonthIdx],
    });
  }

  // Sort by average amount descending (biggest bills first)
  return forecasts.sort((a, b) => b.averageAmount - a.averageAmount);
}
