import db from '../config/db';
import type { LumpSumRecommendation, LumpSumDebtTarget } from '@spenditure/shared';
import { getSpendBreakdown } from './runway.service';

interface DebtAccount {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
}

interface DebtPayoffPlan {
  strategy: 'avalanche' | 'snowball';
  strategyReason: string;
  debts: (DebtAccount & { isFocus: boolean; order: number })[];
  totalDebt: number;
  totalMinimumPayments: number;
  monthsToPayoff: number;
  totalInterestSaved: number;
  extraPayment: number;
}

// Default rates by account type when user hasn't entered their real rate
const DEFAULT_RATES_BY_TYPE: Record<string, number> = {
  credit: 24.0,
  mortgage: 7.0,
  auto_loan: 8.5,
  student_loan: 6.0,
  personal_loan: 12.0,
};

export function getDebtPayoffPlan(userId: string, extraMonthly: number = 0): DebtPayoffPlan {
  const accounts = db.prepare(
    "SELECT id, name, type, current_balance, interest_rate, minimum_payment FROM accounts WHERE user_id = ? AND type IN ('credit', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan')"
  ).all(userId) as any[];

  const debts: DebtAccount[] = accounts.map(a => ({
    id: a.id,
    name: a.name,
    balance: a.current_balance,
    interestRate: a.interest_rate ?? DEFAULT_RATES_BY_TYPE[a.type] ?? 22.0,
    minimumPayment: a.minimum_payment ?? Math.max(25, a.current_balance * 0.02),
  }));

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalMinimum = debts.reduce((s, d) => s + d.minimumPayment, 0);

  // Avalanche: highest interest first (saves most money)
  const avalancheOrder = [...debts].sort((a, b) => b.interestRate - a.interestRate);
  // Snowball: lowest balance first (fastest psychological wins)
  const snowballOrder = [...debts].sort((a, b) => a.balance - b.balance);

  const totalPayment = totalMinimum + Math.max(0, extraMonthly);

  // Simulate each strategy with proper cascading
  const avalancheResult = simulatePayoff(debts, avalancheOrder.map(d => d.id), totalPayment);
  const snowballResult = simulatePayoff(debts, snowballOrder.map(d => d.id), totalPayment);
  const minimumOnlyResult = simulatePayoff(debts, avalancheOrder.map(d => d.id), totalMinimum);

  // Choose strategy: avalanche if it saves significant interest, snowball if debts are similar rates
  const rateSpread = debts.length > 1
    ? Math.max(...debts.map(d => d.interestRate)) - Math.min(...debts.map(d => d.interestRate))
    : 0;

  const useAvalanche = rateSpread > 3;
  const strategy = useAvalanche ? 'avalanche' : 'snowball';
  const ordered = useAvalanche ? avalancheOrder : snowballOrder;
  const result = useAvalanche ? avalancheResult : snowballResult;

  return {
    strategy,
    strategyReason: useAvalanche
      ? `Your interest rates vary by ${rateSpread.toFixed(1)}%. Avalanche saves the most money by targeting high-interest debt first.`
      : debts.length <= 1
        ? 'Focus all extra payments on this debt to pay it off faster.'
        : `Your interest rates are similar. Snowball gives you quick wins by paying off the smallest balance first.`,
    debts: ordered.map((d, i) => ({
      ...d,
      isFocus: i === 0,
      order: i + 1,
    })),
    totalDebt,
    totalMinimumPayments: totalMinimum,
    monthsToPayoff: result.months,
    totalInterestSaved: Math.max(0, Math.round((minimumOnlyResult.totalInterest - result.totalInterest) * 100) / 100),
    extraPayment: Math.max(0, extraMonthly),
  };
}

// Simulate month-by-month payoff with proper cascading:
// 1. Apply interest to all debts
// 2. Pay minimums on all active debts
// 3. Apply ALL remaining budget to the highest-priority debt (per the order)
// 4. When a debt is paid off, its freed-up minimum rolls into the next debt
function simulatePayoff(
  debts: DebtAccount[],
  priorityOrder: string[],
  totalPayment: number
): { months: number; totalInterest: number } {
  if (debts.length === 0) return { months: 0, totalInterest: 0 };

  const balances = new Map(debts.map(d => [d.id, d.balance]));
  const debtMap = new Map(debts.map(d => [d.id, d]));
  let months = 0;
  let totalInterest = 0;
  const maxMonths = 360;

  while (months < maxMonths) {
    // Check if all debts are paid
    let remaining = 0;
    for (const [, bal] of balances) {
      if (bal > 0.01) remaining += bal;
    }
    if (remaining <= 0.01) break;

    months++;

    // 1. Apply interest
    for (const d of debts) {
      const bal = balances.get(d.id)!;
      if (bal > 0.01) {
        const interest = bal * (d.interestRate / 100 / 12);
        totalInterest += interest;
        balances.set(d.id, bal + interest);
      }
    }

    // 2. Pay minimums on all active debts, track remaining budget
    let available = totalPayment;
    for (const d of debts) {
      const bal = balances.get(d.id)!;
      if (bal > 0.01) {
        const payment = Math.min(d.minimumPayment, bal);
        balances.set(d.id, bal - payment);
        available -= payment;
      }
    }

    // 3. Apply remaining budget to debts in priority order (cascade)
    if (available > 0.01) {
      for (const id of priorityOrder) {
        const bal = balances.get(id)!;
        if (bal > 0.01) {
          const extra = Math.min(available, bal);
          balances.set(id, bal - extra);
          available -= extra;
          if (available <= 0.01) break;
        }
      }
    }
  }

  return { months, totalInterest };
}

// === Lump Sum Payoff Recommendation ===
// Should the user use their cash on hand to pay off debt?

export function getLumpSumRecommendation(userId: string): LumpSumRecommendation {
  // 1. Get all debt accounts
  const debtRows = db.prepare(
    "SELECT id, name, type, current_balance, interest_rate, minimum_payment FROM accounts WHERE user_id = ? AND type IN ('credit', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan') AND current_balance > 0"
  ).all(userId) as any[];

  const debts: DebtAccount[] = debtRows.map(a => ({
    id: a.id,
    name: a.name,
    balance: a.current_balance,
    interestRate: a.interest_rate ?? DEFAULT_RATES_BY_TYPE[a.type] ?? 22.0,
    minimumPayment: a.minimum_payment ?? Math.max(25, a.current_balance * 0.02),
  }));

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const oldMonthlyMinimums = debts.reduce((s, d) => s + d.minimumPayment, 0);

  // 2. Get spendable cash
  const cashAccounts = db.prepare(
    "SELECT current_balance, available_balance FROM accounts WHERE user_id = ? AND type IN ('checking', 'savings')"
  ).all(userId) as any[];
  const availableCash = cashAccounts.reduce((s, a) => s + (a.available_balance ?? a.current_balance), 0);

  // 3. Calculate monthly expenses using the shared spend breakdown (excludes outliers + refunds)
  const breakdown = getSpendBreakdown(userId, 90);
  const ongoingSpend = breakdown.recurring + breakdown.variable;
  const refundAdjusted = Math.max(0, ongoingSpend - breakdown.refundOffset);
  const monthlyExpenses = (refundAdjusted / breakdown.calendarDays) * 30;

  // 4. Emergency fund: 3 months of expenses (minimum safety net)
  const emergencyFund = Math.round(monthlyExpenses * 3);

  // 5. Available for lump sum
  const lumpSumAvailable = Math.max(0, availableCash - emergencyFund);

  // No debt or no cash available
  if (debts.length === 0 || lumpSumAvailable <= 0) {
    const reason = debts.length === 0
      ? 'You have no outstanding debt.'
      : availableCash <= emergencyFund
        ? `You need to keep at least $${emergencyFund.toLocaleString()} (3 months of expenses) as an emergency fund. Your cash of $${Math.round(availableCash).toLocaleString()} doesn't leave room for a lump sum payment.`
        : 'Not enough available cash after keeping your emergency fund.';

    return {
      shouldPayoff: false,
      reason,
      availableCash: Math.round(availableCash),
      emergencyFund,
      lumpSumAvailable: 0,
      targets: [],
      totalLumpSum: 0,
      totalInterestSaved: 0,
      newMonthlyMinimums: oldMonthlyMinimums,
      oldMonthlyMinimums,
      monthlyFreedUp: 0,
      monthsShaved: 0,
      remainingBalance: Math.round(availableCash),
      monthsOfRunway: monthlyExpenses > 0 ? Math.round(availableCash / monthlyExpenses) : 999,
    };
  }

  // 6. Sort debts by interest rate (avalanche — always optimal for lump sum)
  const sorted = [...debts].sort((a, b) => b.interestRate - a.interestRate);

  // 7. Simulate applying lump sum
  let remaining = lumpSumAvailable;
  const targets: LumpSumDebtTarget[] = [];
  const afterDebts: DebtAccount[] = []; // debts remaining after lump sum

  for (const debt of sorted) {
    if (remaining <= 0) {
      // No lump sum for this debt
      afterDebts.push({ ...debt });
      targets.push({
        id: debt.id,
        name: debt.name,
        balance: debt.balance,
        interestRate: debt.interestRate,
        amountToPay: 0,
        remainingAfter: debt.balance,
        isPaidOff: false,
        monthlyPaymentFreed: 0,
      });
      continue;
    }

    const payAmount = Math.min(remaining, debt.balance);
    const remainingBalance = debt.balance - payAmount;
    const isPaidOff = remainingBalance < 0.01;
    remaining -= payAmount;

    targets.push({
      id: debt.id,
      name: debt.name,
      balance: debt.balance,
      interestRate: debt.interestRate,
      amountToPay: Math.round(payAmount * 100) / 100,
      remainingAfter: Math.round(remainingBalance * 100) / 100,
      isPaidOff,
      monthlyPaymentFreed: isPaidOff ? debt.minimumPayment : 0,
    });

    if (!isPaidOff) {
      afterDebts.push({
        ...debt,
        balance: remainingBalance,
        minimumPayment: debt.minimumPayment, // min payment stays until paid off
      });
    }
  }

  const totalLumpSum = lumpSumAvailable - remaining;

  // 8. Calculate interest saved: compare "no lump sum" vs "with lump sum" payoff simulations
  const avalancheIds = sorted.map(d => d.id);

  // Before: pay off all debts at their current balances with just minimums
  const beforeResult = simulatePayoff(debts, avalancheIds, oldMonthlyMinimums);

  // After: pay off remaining debts (lower balances) with reduced minimums
  const newMinimums = afterDebts.reduce((s, d) => s + d.minimumPayment, 0);
  const afterAvalancheIds = [...afterDebts].sort((a, b) => b.interestRate - a.interestRate).map(d => d.id);
  const afterResult = afterDebts.length > 0
    ? simulatePayoff(afterDebts, afterAvalancheIds, newMinimums)
    : { months: 0, totalInterest: 0 };

  const totalInterestSaved = Math.max(0, Math.round((beforeResult.totalInterest - afterResult.totalInterest) * 100) / 100);
  const monthsShaved = Math.max(0, beforeResult.months - afterResult.months);
  const monthlyFreedUp = Math.round((oldMonthlyMinimums - newMinimums) * 100) / 100;

  const cashAfterLumpSum = availableCash - totalLumpSum;
  const monthsOfRunway = monthlyExpenses > 0 ? Math.round(cashAfterLumpSum / monthlyExpenses * 10) / 10 : 999;

  // 9. Build recommendation reason
  const paidOffCount = targets.filter(t => t.isPaidOff).length;
  let reason: string;

  if (paidOffCount === debts.length) {
    reason = `You can pay off ALL your debt and still keep $${Math.round(cashAfterLumpSum).toLocaleString()} (${monthsOfRunway} months of expenses). This saves $${Math.round(totalInterestSaved).toLocaleString()} in interest.`;
  } else if (paidOffCount > 0) {
    const highestRate = targets.find(t => t.isPaidOff);
    reason = `Pay off ${paidOffCount} debt${paidOffCount > 1 ? 's' : ''} starting with ${highestRate?.name} (${highestRate?.interestRate}% APR) and save $${Math.round(totalInterestSaved).toLocaleString()} in interest. You'll still have $${Math.round(cashAfterLumpSum).toLocaleString()} (${monthsOfRunway} months of expenses).`;
  } else {
    // Partial paydown only
    const topTarget = targets.find(t => t.amountToPay > 0);
    reason = `Put $${Math.round(totalLumpSum).toLocaleString()} toward ${topTarget?.name} (${topTarget?.interestRate}% APR) to save $${Math.round(totalInterestSaved).toLocaleString()} in interest and be debt-free ${monthsShaved} months sooner.`;
  }

  return {
    shouldPayoff: totalLumpSum >= 100 && totalInterestSaved >= 10,
    reason,
    availableCash: Math.round(availableCash),
    emergencyFund,
    lumpSumAvailable: Math.round(lumpSumAvailable),
    targets: targets.filter(t => t.amountToPay > 0), // only show debts being paid
    totalLumpSum: Math.round(totalLumpSum),
    totalInterestSaved: Math.round(totalInterestSaved),
    newMonthlyMinimums: Math.round(newMinimums),
    oldMonthlyMinimums: Math.round(oldMonthlyMinimums),
    monthlyFreedUp: Math.round(monthlyFreedUp),
    monthsShaved,
    remainingBalance: Math.round(cashAfterLumpSum),
    monthsOfRunway,
  };
}
