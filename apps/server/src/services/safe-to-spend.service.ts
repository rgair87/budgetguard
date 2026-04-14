import db from '../config/db';
import { roundCurrency as rc } from '../utils/currency';

interface SafeToSpendResult {
  safeToSpend: number;
  dailySafe: number;
  daysUntilPayday: number | null;
  breakdown: {
    availableCash: number;
    recurringBills: number;       // next 60 days of recurring charges
    debtPayments: number;         // minimum payments due
    essentialSpending: number;    // groceries, gas, transport based on history
    savingsReserve: number;      // goal contributions
    emergencyBuffer: number;     // keeps runway above 30 days
    totalReserved: number;
  };
}

export function getSafeToSpend(userId: string): SafeToSpendResult {
  // 1. Available cash (checking + savings)
  const cashRow = db.prepare(
    "SELECT COALESCE(SUM(COALESCE(available_balance, current_balance)), 0) as total FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings')"
  ).get(userId) as { total: number };
  const availableCash = cashRow.total;

  // 2. Recurring bills - look at last 2 months of recurring charges to estimate next 2 months
  // This catches monthly AND bimonthly bills
  const recurringRow = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total
    FROM transactions
    WHERE user_id = ? AND is_recurring = 1 AND amount < 0
      AND date >= date('now', '-60 days') AND date < date('now')
      AND COALESCE(category, '') NOT IN ('Transfers', 'Transfer')
  `).get(userId) as { total: number };
  // This gives us ~2 months of bills. That's our reserve for the next 2 months.
  const recurringBills = recurringRow.total;

  // 3. Minimum debt payments (monthly total x2 for 2-month buffer)
  const debtRow = db.prepare(
    "SELECT COALESCE(SUM(minimum_payment), 0) as total FROM accounts WHERE user_id = ? AND type IN ('credit', 'loan', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan') AND current_balance > 0"
  ).get(userId) as { total: number };
  const debtPayments = debtRow.total * 2; // 2 months of minimum payments

  // 4. Essential variable spending (groceries, gas, transportation, healthcare, phone)
  // Based on 90-day average, reserve for 2 months
  const essentialRow = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total
    FROM transactions
    WHERE user_id = ? AND amount < 0
      AND date >= date('now', '-90 days')
      AND COALESCE(category, '') IN ('Groceries', 'Gas', 'Transportation', 'Healthcare', 'Phone & Internet', 'Utilities')
  `).get(userId) as { total: number };
  // 90 days of essential spending / 3 = monthly, x2 = 2 month reserve
  const monthlyEssentials = essentialRow.total / 3;
  const essentialSpending = monthlyEssentials * 2;

  // 5. Savings goal contributions (monthly target)
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

  // 6. Emergency buffer - ensure at least 30 days of runway remains after spending
  // Daily burn = all spending over 90 days / 90
  const burnRow = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total
    FROM transactions
    WHERE user_id = ? AND amount < 0
      AND date >= date('now', '-90 days')
      AND COALESCE(category, '') NOT IN ('Transfers', 'Transfer')
  `).get(userId) as { total: number };
  const dailyBurn = burnRow.total / 90;
  const emergencyBuffer = dailyBurn * 30; // 30 days of spending as minimum floor

  // Total reserved
  const totalReserved = recurringBills + debtPayments + essentialSpending + savingsReserve + emergencyBuffer;
  const safeToSpend = Math.max(0, availableCash - totalReserved);

  // Days until payday for daily budget
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
    dailySafe,
    daysUntilPayday,
    breakdown: {
      availableCash: rc(availableCash),
      recurringBills: rc(recurringBills),
      debtPayments: rc(debtPayments),
      essentialSpending: rc(essentialSpending),
      savingsReserve: rc(savingsReserve),
      emergencyBuffer: rc(emergencyBuffer),
      totalReserved: rc(totalReserved),
    },
  };
}
