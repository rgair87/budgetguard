import db from '../config/db';
import { roundCurrency as rc } from '../utils/currency';

interface SafeToSpendResult {
  safeToSpend: number;
  breakdown: {
    availableCash: number;
    upcomingBills: number;
    debtPayments: number;
    savingsReserve: number;
    buffer: number;
  };
  dailySafe: number; // safe amount per day until next payday
  daysUntilPayday: number | null;
}

export function getSafeToSpend(userId: string): SafeToSpendResult {
  // 1. Available cash (checking + savings)
  const cashAccounts = db.prepare(
    "SELECT COALESCE(SUM(available_balance), SUM(current_balance), 0) as total FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings')"
  ).get(userId) as { total: number };
  const availableCash = cashAccounts.total;

  // 2. Upcoming bills in the next 30 days (from recurring transactions)
  const recurringBills = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total
    FROM transactions
    WHERE user_id = ? AND is_recurring = 1 AND amount < 0
      AND date >= date('now', '-35 days') AND date < date('now')
      AND COALESCE(category, '') NOT IN ('Transfers', 'Transfer')
  `).get(userId) as { total: number };
  // Use last month's recurring total as estimate for next month
  const upcomingBills = recurringBills.total;

  // 3. Minimum debt payments due this month
  const debtPayments = db.prepare(
    "SELECT COALESCE(SUM(minimum_payment), 0) as total FROM accounts WHERE user_id = ? AND type IN ('credit', 'loan', 'auto_loan', 'student_loan', 'personal_loan') AND current_balance > 0"
  ).get(userId) as { total: number };

  // 4. Savings goals - monthly contribution target
  const goals = db.prepare(
    "SELECT target_amount, current_amount, deadline FROM savings_goals WHERE user_id = ? AND current_amount < target_amount"
  ).all(userId) as { target_amount: number; current_amount: number; deadline: string | null }[];

  let savingsReserve = 0;
  for (const goal of goals) {
    if (goal.deadline) {
      const daysLeft = Math.max(1, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      const monthsLeft = Math.max(1, daysLeft / 30);
      const remaining = goal.target_amount - goal.current_amount;
      savingsReserve += remaining / monthsLeft;
    }
  }

  // 5. Buffer (10% of monthly spending)
  const monthlySpend = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transactions
    WHERE user_id = ? AND amount < 0 AND date >= date('now', '-30 days')
      AND COALESCE(category, '') NOT IN ('Transfers', 'Transfer')
  `).get(userId) as { total: number };
  const buffer = monthlySpend.total * 0.10;

  // Calculate safe to spend
  const reserved = upcomingBills + debtPayments.total + savingsReserve + buffer;
  const safeToSpend = Math.max(0, availableCash - reserved);

  // Days until payday
  const user = db.prepare(
    'SELECT pay_frequency, next_payday FROM users WHERE id = ?'
  ).get(userId) as { pay_frequency: string | null; next_payday: string | null } | undefined;

  let daysUntilPayday: number | null = null;
  if (user?.next_payday) {
    const np = new Date(user.next_payday + 'T00:00:00');
    const freq: Record<string, number> = { weekly: 7, biweekly: 14, twice_monthly: 15, monthly: 30, irregular: 30 };
    const interval = freq[user.pay_frequency || ''] || 30;
    while (np.getTime() < Date.now()) np.setDate(np.getDate() + interval);
    daysUntilPayday = Math.max(0, Math.ceil((np.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  const dailySafe = daysUntilPayday && daysUntilPayday > 0
    ? rc(safeToSpend / daysUntilPayday)
    : rc(safeToSpend / 30);

  return {
    safeToSpend: rc(safeToSpend),
    breakdown: {
      availableCash: rc(availableCash),
      upcomingBills: rc(upcomingBills),
      debtPayments: rc(debtPayments.total),
      savingsReserve: rc(savingsReserve),
      buffer: rc(buffer),
    },
    dailySafe,
    daysUntilPayday,
  };
}
