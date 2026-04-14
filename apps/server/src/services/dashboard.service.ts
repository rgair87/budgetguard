import db from '../config/db';
import { SPEND_EXCLUSION_CATEGORIES, SPEND_EXCLUSION_MERCHANTS } from './runway.service';
import { roundCurrency as rc } from '../utils/currency';

interface DashboardData {
  // Cash flow timeline: past 90 days + projected 30 days forward
  cashFlowTimeline: Array<{ date: string; balance: number; projected?: boolean }>;
  // Monthly income vs expenses (6 months)
  monthlyComparison: Array<{ month: string; income: number; expenses: number }>;
  // Runway trend from snapshots
  runwayTrend: Array<{ date: string; days: number }>;
  // Key numbers
  savingsBalance: number;
  checkingBalance: number;
}

export function getDashboardCharts(userId: string): DashboardData {
  // 1. Cash flow timeline: daily balance from transactions
  const balanceHistory = db.prepare(`
    SELECT date, SUM(amount) as net
    FROM transactions
    WHERE user_id = ? AND date >= date('now', '-90 days')
    GROUP BY date
    ORDER BY date
  `).all(userId) as { date: string; net: number }[];

  // Get current balance
  const cashAccounts = db.prepare(
    "SELECT current_balance, available_balance, type FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings')"
  ).all(userId) as { current_balance: number; available_balance: number | null; type: string }[];

  const totalBalance = cashAccounts.reduce((s, a) => s + (a.available_balance ?? a.current_balance), 0);
  const savingsBalance = cashAccounts.filter(a => a.type === 'savings').reduce((s, a) => s + (a.available_balance ?? a.current_balance), 0);
  const checkingBalance = cashAccounts.filter(a => a.type === 'checking').reduce((s, a) => s + (a.available_balance ?? a.current_balance), 0);

  // Build daily balance timeline working backwards from current balance
  const cashFlowTimeline: DashboardData['cashFlowTimeline'] = [];
  let runningBalance = totalBalance;
  const dailyNet = new Map(balanceHistory.map(d => [d.date, d.net]));

  // Walk back from today
  const today = new Date();
  const dates: string[] = [];
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  dates.reverse();

  // Reconstruct balance: start from current and subtract forward changes
  // This is imprecise but gives directional accuracy
  let balance = totalBalance;
  for (let i = dates.length - 1; i >= 0; i--) {
    cashFlowTimeline.unshift({ date: dates[i], balance: rc(balance) });
    const net = dailyNet.get(dates[i]) || 0;
    balance -= net; // Remove this day's effect to get previous balance
  }

  // Project 30 days forward (simple: current balance - avg daily burn)
  const avgDailyBurn = balanceHistory.length > 0
    ? Math.abs(balanceHistory.filter(d => d.net < 0).reduce((s, d) => s + d.net, 0)) / 90
    : 0;

  let projBalance = totalBalance;
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    projBalance -= avgDailyBurn;
    cashFlowTimeline.push({
      date: d.toISOString().split('T')[0],
      balance: rc(Math.max(0, projBalance)),
      projected: true,
    });
  }

  // 2. Monthly income vs expenses (6 months)
  // Income: ALL positive transactions >= $200 (excludes small refunds)
  const monthlyIncome = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
    FROM transactions
    WHERE user_id = ? AND amount >= 200 AND date >= date('now', '-6 months')
    GROUP BY strftime('%Y-%m', date)
  `).all(userId) as { month: string; total: number }[];

  // Expenses: negative transactions excluding transfers/debt payments
  const monthlyExpenses = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(ABS(amount)) as total
    FROM transactions
    WHERE user_id = ? AND amount < 0 AND date >= date('now', '-6 months')
      AND COALESCE(category, '') NOT IN ${SPEND_EXCLUSION_CATEGORIES}
      ${SPEND_EXCLUSION_MERCHANTS}
    GROUP BY strftime('%Y-%m', date)
  `).all(userId) as { month: string; total: number }[];

  const incomeMap = new Map(monthlyIncome.map(m => [m.month, m.total]));
  const expenseMap = new Map(monthlyExpenses.map(m => [m.month, m.total]));
  const allMonths = [...new Set([...incomeMap.keys(), ...expenseMap.keys()])].sort();

  const monthlyComparison = allMonths.map(month => ({
    month,
    income: rc(incomeMap.get(month) || 0),
    expenses: rc(expenseMap.get(month) || 0),
  }));

  // 3. Runway trend from snapshots
  const snapshots = db.prepare(`
    SELECT date, runway_days FROM daily_snapshots
    WHERE user_id = ? AND date >= date('now', '-90 days')
    ORDER BY date
  `).all(userId) as { date: string; runway_days: number }[];

  const runwayTrend = snapshots.map(s => ({
    date: s.date,
    days: s.runway_days,
  }));

  return {
    cashFlowTimeline,
    monthlyComparison,
    runwayTrend,
    savingsBalance: rc(savingsBalance),
    checkingBalance: rc(checkingBalance),
  };
}
