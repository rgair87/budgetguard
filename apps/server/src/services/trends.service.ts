import db from '../config/db';

interface MonthAmount {
  month: string;
  amount: number;
}

interface MerchantTrend {
  merchantName: string;
  category: string | null;
  isRecurring: boolean;
  months: MonthAmount[];
  currentMonth: number;
  previousMonth: number;
  changePercent: number;
  changeAmount: number;
  trend: 'up' | 'down' | 'stable' | 'new';
  alert: string | null;
}

interface CategoryTrend {
  category: string;
  months: MonthAmount[];
  currentMonth: number;
  threeMonthAvg: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface SpendingTrends {
  merchantTrends: MerchantTrend[];
  categoryTrends: CategoryTrend[];
  alerts: string[];
  totalMonthlySpend: MonthAmount[];
}

function getLast6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${yyyy}-${mm}`);
  }
  return months; // newest first
}

function classifyTrend(changePercent: number): 'up' | 'down' | 'stable' {
  if (changePercent > 5) return 'up';
  if (changePercent < -5) return 'down';
  return 'stable';
}

function buildMonthMap(months: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of months) map.set(m, 0);
  return map;
}

export function getSpendingTrends(userId: string): SpendingTrends {
  const last6 = getLast6Months();
  const oldest = last6[last6.length - 1];
  const currentMonth = last6[0];
  const previousMonth = last6[1];

  // --- Merchant-level data ---
  const merchantRows = db.prepare(`
    SELECT
      merchant_name,
      category,
      is_recurring,
      substr(date, 1, 7) AS month,
      SUM(ABS(amount)) AS total
    FROM transactions
    WHERE user_id = ?
      AND amount < 0
      AND merchant_name IS NOT NULL
      AND substr(date, 1, 7) >= ?
    GROUP BY merchant_name, month
    ORDER BY merchant_name, month
  `).all(userId, oldest) as unknown as {
    merchant_name: string;
    category: string | null;
    is_recurring: number;
    month: string;
    total: number;
  }[];

  // Collect recurring flag per merchant (take max across rows)
  const merchantMeta = new Map<string, { category: string | null; isRecurring: boolean }>();
  const merchantMonthly = new Map<string, Map<string, number>>();

  for (const row of merchantRows) {
    const name = row.merchant_name;

    if (!merchantMonthly.has(name)) {
      merchantMonthly.set(name, buildMonthMap(last6));
    }
    merchantMonthly.get(name)!.set(row.month, row.total);

    const existing = merchantMeta.get(name);
    if (!existing) {
      merchantMeta.set(name, { category: row.category, isRecurring: row.is_recurring === 1 });
    } else if (row.is_recurring === 1) {
      existing.isRecurring = true;
    }
  }

  // Filter: recurring OR appears in 3+ months
  const qualifiedMerchants: string[] = [];
  for (const [name, monthMap] of merchantMonthly) {
    const meta = merchantMeta.get(name)!;
    const monthsWithSpend = [...monthMap.values()].filter(v => v > 0).length;
    const isRecurring = meta.isRecurring || monthsWithSpend >= 3;
    meta.isRecurring = isRecurring;

    if (!isRecurring) continue;

    // Filter noise: average monthly spend must be >= $20
    const totalSpend = [...monthMap.values()].reduce((a, b) => a + b, 0);
    const nonZeroMonths = Math.max(monthsWithSpend, 1);
    if (totalSpend / nonZeroMonths < 20) continue;

    qualifiedMerchants.push(name);
  }

  const alerts: string[] = [];
  const merchantTrends: MerchantTrend[] = [];

  for (const name of qualifiedMerchants) {
    const monthMap = merchantMonthly.get(name)!;
    const meta = merchantMeta.get(name)!;

    const cur = monthMap.get(currentMonth) ?? 0;
    const prev = monthMap.get(previousMonth) ?? 0;

    const months: MonthAmount[] = last6.map(m => ({
      month: m,
      amount: Math.round((monthMap.get(m) ?? 0) * 100) / 100,
    })).reverse(); // oldest first

    // Determine trend
    let trend: MerchantTrend['trend'];
    const onlyCurrentMonth = cur > 0 && [...monthMap.entries()].every(([m, v]) => m === currentMonth || v === 0);
    if (onlyCurrentMonth) {
      trend = 'new';
    } else if (prev === 0 && cur > 0) {
      trend = 'up';
    } else {
      const pct = prev > 0 ? ((cur - prev) / prev) * 100 : 0;
      trend = classifyTrend(pct);
    }

    const changeAmount = Math.round((cur - prev) * 100) / 100;
    const changePercent = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : 0);

    let alert: string | null = null;
    if (changePercent > 15 && changeAmount > 0) {
      alert = `${name} up ${changePercent}% vs last month ($${Math.round(prev)} → $${Math.round(cur)})`;
      alerts.push(alert);
    }

    merchantTrends.push({
      merchantName: name,
      category: meta.category,
      isRecurring: meta.isRecurring,
      months,
      currentMonth: Math.round(cur * 100) / 100,
      previousMonth: Math.round(prev * 100) / 100,
      changePercent,
      changeAmount,
      trend,
      alert,
    });
  }

  // Sort by absolute changeAmount desc
  merchantTrends.sort((a, b) => Math.abs(b.changeAmount) - Math.abs(a.changeAmount));

  // --- Category-level trends ---
  const categoryRows = db.prepare(`
    SELECT
      COALESCE(category, 'Uncategorized') AS category,
      substr(date, 1, 7) AS month,
      SUM(ABS(amount)) AS total
    FROM transactions
    WHERE user_id = ?
      AND amount < 0
      AND substr(date, 1, 7) >= ?
    GROUP BY category, month
    ORDER BY category, month
  `).all(userId, oldest) as unknown as {
    category: string;
    month: string;
    total: number;
  }[];

  const categoryMonthly = new Map<string, Map<string, number>>();
  for (const row of categoryRows) {
    if (!categoryMonthly.has(row.category)) {
      categoryMonthly.set(row.category, buildMonthMap(last6));
    }
    categoryMonthly.get(row.category)!.set(row.month, row.total);
  }

  const categoryTrends: CategoryTrend[] = [];
  for (const [category, monthMap] of categoryMonthly) {
    const cur = monthMap.get(currentMonth) ?? 0;
    const months: MonthAmount[] = last6.map(m => ({
      month: m,
      amount: Math.round((monthMap.get(m) ?? 0) * 100) / 100,
    })).reverse();

    // Three month average (previous 3 months, not including current)
    const prev3Months = [last6[1], last6[2], last6[3]];
    const prev3Total = prev3Months.reduce((sum, m) => sum + (monthMap.get(m) ?? 0), 0);
    const threeMonthAvg = Math.round((prev3Total / 3) * 100) / 100;

    const changePercent = threeMonthAvg > 0
      ? Math.round(((cur - threeMonthAvg) / threeMonthAvg) * 100)
      : (cur > 0 ? 100 : 0);

    categoryTrends.push({
      category,
      months,
      currentMonth: Math.round(cur * 100) / 100,
      threeMonthAvg,
      changePercent,
      trend: classifyTrend(changePercent),
    });
  }

  categoryTrends.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  // --- Total monthly spend ---
  const totalRows = db.prepare(`
    SELECT
      substr(date, 1, 7) AS month,
      SUM(ABS(amount)) AS total
    FROM transactions
    WHERE user_id = ?
      AND amount < 0
      AND substr(date, 1, 7) >= ?
    GROUP BY month
    ORDER BY month ASC
  `).all(userId, oldest) as unknown as { month: string; total: number }[];

  const totalMap = buildMonthMap(last6);
  for (const row of totalRows) totalMap.set(row.month, row.total);

  const totalMonthlySpend: MonthAmount[] = last6.map(m => ({
    month: m,
    amount: Math.round((totalMap.get(m) ?? 0) * 100) / 100,
  })).reverse();

  return {
    merchantTrends,
    categoryTrends,
    alerts,
    totalMonthlySpend,
  };
}
