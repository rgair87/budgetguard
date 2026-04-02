import db from '../config/db';
import { calculateRunway } from './runway.service';

export interface HealthScoreResult {
  score: number;
  label: string;
  breakdown: {
    runway: { score: number; max: 30; detail: string };
    cashFlow: { score: number; max: 25; detail: string };
    debtBurden: { score: number; max: 20; detail: string };
    savingsRate: { score: number; max: 15; detail: string };
    trends: { score: number; max: 10; detail: string };
  };
}

export function calculateHealthScore(userId: string): HealthScoreResult {
  const runway = calculateRunway(userId);

  // 1. Runway days (30 points)
  let runwayScore: number;
  let runwayDetail: string;
  if (runway.runwayDays >= 365) {
    runwayScore = 30;
    runwayDetail = `${runway.runwayDays} days — excellent cushion`;
  } else if (runway.runwayDays >= 90) {
    runwayScore = 20 + Math.round((runway.runwayDays - 90) / 275 * 10);
    runwayDetail = `${runway.runwayDays} days — solid runway`;
  } else if (runway.runwayDays >= 30) {
    runwayScore = 10 + Math.round((runway.runwayDays - 30) / 60 * 10);
    runwayDetail = `${runway.runwayDays} days — room to improve`;
  } else {
    runwayScore = Math.round(runway.runwayDays / 30 * 10);
    runwayDetail = `${runway.runwayDays} days — critically low`;
  }

  // 2. Income vs spending (25 points)
  const user = db.prepare(
    'SELECT take_home_pay, pay_frequency FROM users WHERE id = ?'
  ).get(userId) as unknown as any;

  let monthlyIncome = 0;
  if (user?.take_home_pay && user?.pay_frequency) {
    const freq = user.pay_frequency;
    monthlyIncome = freq === 'weekly' ? user.take_home_pay * 4.33
      : freq === 'biweekly' ? user.take_home_pay * 2.17
      : freq === 'twice_monthly' ? user.take_home_pay * 2
      : user.take_home_pay;
  }

  const spendRow = db.prepare(
    `SELECT COALESCE(SUM(ABS(amount)), 0) as total, MIN(date) as earliest
     FROM transactions WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
     AND COALESCE(category, '') NOT IN ('Transfers', 'Transfer', 'Debt Payments', 'Loan Payment', 'Credit Card Payment', 'Income', 'Payroll', 'Direct Deposit', 'Credit')
     AND (merchant_name IS NULL OR (
       LOWER(merchant_name) NOT LIKE '%transfer%'
       AND LOWER(merchant_name) NOT LIKE '%payment to%'
       AND LOWER(merchant_name) NOT LIKE '%credit card%'
       AND LOWER(merchant_name) NOT LIKE '%direct dep%'
       AND LOWER(merchant_name) NOT LIKE '%payroll%'
     ))`
  ).get(userId) as unknown as any;

  let calendarDays = 90;
  if (spendRow.earliest) {
    const earliest = new Date(spendRow.earliest + 'T00:00:00');
    const now = new Date(); now.setHours(0, 0, 0, 0);
    calendarDays = Math.max(1, Math.round((now.getTime() - earliest.getTime()) / 86400000) + 1);
  }
  const monthlySpending = (spendRow.total / calendarDays) * 30;

  let cashFlowScore: number;
  let cashFlowDetail: string;
  if (monthlyIncome <= 0) {
    cashFlowScore = 8;
    cashFlowDetail = 'No income data — set up your paycheck info';
  } else {
    const surplusRate = (monthlyIncome - monthlySpending) / monthlyIncome;
    if (surplusRate >= 0.2) {
      cashFlowScore = 25;
      cashFlowDetail = `${Math.round(surplusRate * 100)}% surplus — great cash flow`;
    } else if (surplusRate > 0) {
      cashFlowScore = 15 + Math.round(surplusRate / 0.2 * 10);
      cashFlowDetail = `${Math.round(surplusRate * 100)}% surplus — positive but tight`;
    } else if (surplusRate > -0.1) {
      cashFlowScore = 10;
      cashFlowDetail = 'About breaking even — watch spending';
    } else {
      cashFlowScore = Math.max(0, 10 + Math.round(surplusRate * 100));
      cashFlowDetail = `Spending ${Math.round(Math.abs(surplusRate) * 100)}% more than income`;
    }
  }

  // 3. Debt burden (20 points)
  const totalDebt = runway.totalDebt;
  let debtScore: number;
  let debtDetail: string;

  if (totalDebt <= 0) {
    debtScore = 20;
    debtDetail = 'No debt — outstanding';
  } else if (monthlyIncome > 0) {
    const debtRatio = totalDebt / monthlyIncome;
    if (debtRatio < 1) {
      debtScore = 18;
      debtDetail = `Debt is ${debtRatio.toFixed(1)}x monthly income — very manageable`;
    } else if (debtRatio < 3) {
      debtScore = 12;
      debtDetail = `Debt is ${debtRatio.toFixed(1)}x monthly income — moderate`;
    } else if (debtRatio < 6) {
      debtScore = 5;
      debtDetail = `Debt is ${debtRatio.toFixed(1)}x monthly income — heavy`;
    } else {
      debtScore = 2;
      debtDetail = `Debt is ${debtRatio.toFixed(1)}x monthly income — very heavy`;
    }
  } else {
    debtScore = totalDebt > 5000 ? 5 : 8;
    debtDetail = `$${Math.round(totalDebt).toLocaleString()} total debt`;
  }

  // 4. Savings rate (15 points)
  const savingsAccounts = db.prepare(
    "SELECT COALESCE(SUM(current_balance), 0) as total FROM accounts WHERE user_id = ? AND type = 'savings'"
  ).get(userId) as unknown as any;
  const savingsBalance = savingsAccounts.total;

  let savingsScore: number;
  let savingsDetail: string;
  if (monthlyIncome <= 0) {
    savingsScore = savingsBalance > 1000 ? 8 : 3;
    savingsDetail = savingsBalance > 0 ? `$${Math.round(savingsBalance).toLocaleString()} saved` : 'No savings detected';
  } else {
    const monthsOfExpenses = monthlySpending > 0 ? savingsBalance / monthlySpending : 0;
    if (monthsOfExpenses >= 6) {
      savingsScore = 15;
      savingsDetail = `${monthsOfExpenses.toFixed(1)} months of expenses saved — excellent`;
    } else if (monthsOfExpenses >= 3) {
      savingsScore = 10;
      savingsDetail = `${monthsOfExpenses.toFixed(1)} months of expenses saved — good`;
    } else if (monthsOfExpenses >= 1) {
      savingsScore = 5;
      savingsDetail = `${monthsOfExpenses.toFixed(1)} months of expenses saved — building`;
    } else {
      savingsScore = Math.round(monthsOfExpenses * 5);
      savingsDetail = savingsBalance > 0 ? 'Less than 1 month of expenses saved' : 'No savings buffer';
    }
  }

  // 5. Spending trends (10 points) — is spending going up or down?
  // Exclude current partial month to avoid comparing 10 days vs 30 days
  const monthlyTotals = db.prepare(
    `SELECT strftime('%Y-%m', date) as month, SUM(ABS(amount)) as total
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
     AND date < date('now', 'start of month')
     GROUP BY month ORDER BY month`
  ).all(userId) as unknown as { month: string; total: number }[];

  let trendsScore: number;
  let trendsDetail: string;
  if (monthlyTotals.length < 2) {
    trendsScore = 5;
    trendsDetail = 'Not enough history to detect trends';
  } else {
    const latest = monthlyTotals[monthlyTotals.length - 1].total;
    const prior = monthlyTotals.slice(0, -1).reduce((s, m) => s + m.total, 0) / (monthlyTotals.length - 1);
    const change = prior > 0 ? ((latest - prior) / prior) * 100 : 0;

    if (change < -10) {
      trendsScore = 10;
      trendsDetail = `Spending down ${Math.abs(Math.round(change))}% — great trend`;
    } else if (change <= 5) {
      trendsScore = 7;
      trendsDetail = 'Spending is stable';
    } else if (change <= 20) {
      trendsScore = 3;
      trendsDetail = `Spending up ${Math.round(change)}% — watch this`;
    } else {
      trendsScore = 0;
      trendsDetail = `Spending up ${Math.round(change)}% — lifestyle creep alert`;
    }
  }

  const totalScore = runwayScore + cashFlowScore + debtScore + savingsScore + trendsScore;
  const label = totalScore >= 81 ? 'Excellent'
    : totalScore >= 61 ? 'Strong'
    : totalScore >= 41 ? 'Stable'
    : totalScore >= 21 ? 'Struggling'
    : 'Critical';

  return {
    score: totalScore,
    label,
    breakdown: {
      runway: { score: runwayScore, max: 30, detail: runwayDetail },
      cashFlow: { score: cashFlowScore, max: 25, detail: cashFlowDetail },
      debtBurden: { score: debtScore, max: 20, detail: debtDetail },
      savingsRate: { score: savingsScore, max: 15, detail: savingsDetail },
      trends: { score: trendsScore, max: 10, detail: trendsDetail },
    },
  };
}
