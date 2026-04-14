import db from '../config/db';
import { getMonthlyIncome } from './income.service';
import { roundCurrency as rc } from '../utils/currency';
import type { RunwayScore } from '@spenditure/shared';

// Shared WHERE clause fragments for excluding non-spend transactions
export const SPEND_EXCLUSION_CATEGORIES = `('Transfers', 'Transfer', 'Debt Payments', 'Income', 'Payroll', 'Direct Deposit', 'Credit', 'Loans', 'Loan Payment', 'Loan Payments', 'Credit Card Payments', 'Credit Card Payment', 'Mortgage', 'Mortgages')`;
export const SPEND_EXCLUSION_MERCHANTS = `
  AND merchant_name NOT LIKE '%transfer%'
  AND merchant_name NOT LIKE '%payment to%'
  AND merchant_name NOT LIKE '%CREDIT CARD%'
  AND merchant_name NOT LIKE '%CREDIT CRD%'
  AND merchant_name NOT LIKE '%CRCARDPMT%'
  AND merchant_name NOT LIKE '%AUTOPAY%'
  AND merchant_name NOT LIKE '%DIRECT DEP%'
  AND merchant_name NOT LIKE '%PAYROLL%'
  AND merchant_name NOT LIKE '%DEPOSIT%'
  AND merchant_name NOT LIKE '%BONUS%'
  AND merchant_name NOT LIKE '%TAX REFUND%'
  AND merchant_name NOT LIKE '%VENMO CASHOUT%'
  AND merchant_name NOT LIKE '%ZELLE FROM%'
  AND merchant_name NOT LIKE '%ACH CREDIT%'
  AND merchant_name NOT LIKE '%TAX REF%'
  AND merchant_name NOT LIKE '%MORTGAGE%'
  AND merchant_name NOT LIKE '%LOAN PAYMT%'
  AND merchant_name NOT LIKE '%LOAN PAYMENT%'
  AND merchant_name NOT LIKE '%E-PAYMENT%'
  AND merchant_name NOT LIKE '%ONLINE PMT%'
  AND merchant_name NOT LIKE '%ONLINE PAYMENT%'
  AND merchant_name NOT LIKE '%ACCT XFER%'
  AND merchant_name NOT LIKE '%INST XFER%'
  AND merchant_name NOT LIKE '%PL PYMT%'
  AND merchant_name NOT LIKE '%DIRECTPAY%'
  AND merchant_name NOT LIKE '%BANKERS HEALTHCA%'
  AND merchant_name NOT LIKE '%SOFI BANK%'
  AND merchant_name NOT LIKE '%Automatic Payment%'
  AND merchant_name NOT LIKE '%AUTO PAY%'
  AND merchant_name NOT LIKE '%PAYMENT - THANK%'
  AND merchant_name NOT LIKE 'Check'
  AND merchant_name NOT LIKE 'CHECK %'`;

// Detect outlier transactions using IQR method on the user's own spending distribution
function detectOutlierThreshold(amounts: number[]): number {
  if (amounts.length < 10) return Infinity; // not enough data to detect outliers
  const sorted = [...amounts].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  // Upper fence: Q3 + 2.5 * IQR (slightly more permissive than classic 1.5x to avoid flagging normal large purchases)
  return q3 + 2.5 * iqr;
}

export interface SpendBreakdown {
  recurring: number;    // subscriptions, bills, regular merchants
  variable: number;     // normal day-to-day spending (non-outlier, non-recurring)
  oneOff: number;       // outlier large purchases
  refundOffset: number; // refunds that offset spending
  outlierTransactions: Array<{ merchant: string; amount: number; date: string }>;
}

export function getSpendBreakdown(userId: string, days: number = 90): SpendBreakdown & { calendarDays: number } {
  // Get all spend transactions in the window
  const txns = db.prepare(
    `SELECT ABS(amount) as amt, merchant_name, date, is_recurring, category
     FROM transactions WHERE user_id = ? AND amount < 0 AND date >= date('now', '-${days} days')
       AND COALESCE(category, '') NOT IN ${SPEND_EXCLUSION_CATEGORIES}
       ${SPEND_EXCLUSION_MERCHANTS}`
  ).all(userId) as any[];

  // Get refunds (positive amounts from merchants that also have negative amounts)
  const refunds = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions WHERE user_id = ? AND amount > 0 AND date >= date('now', '-${days} days')
       AND COALESCE(category, '') NOT IN ${SPEND_EXCLUSION_CATEGORIES}
       AND COALESCE(category, '') NOT IN ('Income', 'Payroll', 'Direct Deposit')
       ${SPEND_EXCLUSION_MERCHANTS}
       AND (LOWER(merchant_name) LIKE '%refund%' OR LOWER(merchant_name) LIKE '%return%'
            OR LOWER(category) LIKE '%refund%' OR LOWER(category) LIKE '%return%')`
  ).get(userId) as any;

  // Calculate calendar days from earliest transaction
  let calendarDays = days;
  if (txns.length > 0) {
    const dates = txns.map(t => t.date).sort();
    const earliest = new Date(dates[0] + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    calendarDays = Math.max(1, Math.floor((now.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }

  const amounts = txns.map(t => t.amt);
  const outlierThreshold = detectOutlierThreshold(amounts);

  let recurring = 0;
  let variable = 0;
  let oneOff = 0;
  const outlierTransactions: SpendBreakdown['outlierTransactions'] = [];

  for (const t of txns) {
    if (t.is_recurring) {
      // Recurring bills are never outliers — a $1,200 mortgage is expected every month
      recurring += t.amt;
    } else if (t.amt >= outlierThreshold) {
      oneOff += t.amt;
      outlierTransactions.push({ merchant: t.merchant_name, amount: t.amt, date: t.date });
    } else {
      variable += t.amt;
    }
  }

  return {
    recurring,
    variable,
    oneOff,
    refundOffset: refunds.total || 0,
    outlierTransactions,
    calendarDays,
  };
}

export function calculateRunway(userId: string): RunwayScore {
  const user = db.prepare(
    'SELECT pay_frequency, next_payday, take_home_pay FROM users WHERE id = ?'
  ).get(userId) as unknown as any;

  const accounts = db.prepare(
    'SELECT id, name, type, current_balance, available_balance, purpose, income_allocation FROM accounts WHERE user_id = ?'
  ).all(userId) as unknown as any[];

  // Separate spendable cash from debt
  const spendableAccounts = accounts.filter(a => a.type === 'checking' || a.type === 'savings');
  const spendableBalance = spendableAccounts.reduce((sum, a) => sum + (a.available_balance ?? a.current_balance), 0);

  const DEBT_TYPES = ['credit', 'loan', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan'];
  // Only count debt accounts that have a real balance — skip $0 ghost accounts from CSV auto-detection
  const debtAccounts = accounts.filter(a => DEBT_TYPES.includes(a.type) && a.current_balance > 0);
  const totalDebt = debtAccounts.reduce((sum, a) => sum + a.current_balance, 0);

  // Get spend breakdown with outlier detection
  const breakdown = getSpendBreakdown(userId, 90);
  const calendarDays = breakdown.calendarDays;

  // Daily burn rate EXCLUDING outliers and offset by refunds
  // Recurring + variable spend represents the true ongoing burn rate
  const ongoingSpend = breakdown.recurring + breakdown.variable;
  const refundAdjusted = Math.max(0, ongoingSpend - breakdown.refundOffset);
  const dailyBurnRate = refundAdjusted / calendarDays;

  // Raw total (including outliers) for context — the advisor uses this
  const rawTotalSpend = breakdown.recurring + breakdown.variable + breakdown.oneOff;

  // Spent this month (exclude transfers and income) — keep raw for budget tracking
  const monthSpendRow = db.prepare(
    `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', 'start of month')
       AND COALESCE(category, '') NOT IN ${SPEND_EXCLUSION_CATEGORIES}
       ${SPEND_EXCLUSION_MERCHANTS}`
  ).get(userId) as unknown as any;
  const spentThisMonth = monthSpendRow.total;

  // Budget
  const budgetRow = db.prepare(
    'SELECT COALESCE(SUM(monthly_limit), 0) as total FROM budgets WHERE user_id = ?'
  ).get(userId) as unknown as any;
  const remainingBudget = budgetRow.total - spentThisMonth;

  // Events
  const events = db.prepare(
    `SELECT name, estimated_amount, expected_date, is_recurring, recurrence_interval
     FROM incoming_events WHERE user_id = ?
     ORDER BY CASE WHEN expected_date IS NULL THEN '1900-01-01' ELSE expected_date END`
  ).all(userId) as unknown as any[];

  // Payday
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let daysToPayday: number | null = null;

  let paycheckIntervalDays = getPaycheckInterval(user.pay_frequency);

  if (user.next_payday) {
    const np = new Date(user.next_payday + 'T00:00:00');
    np.setHours(0, 0, 0, 0);
    // Auto-advance past paydays to the next future occurrence
    if (paycheckIntervalDays) {
      while (np.getTime() < today.getTime()) {
        np.setDate(np.getDate() + paycheckIntervalDays);
      }
    }
    daysToPayday = Math.max(0, Math.ceil((np.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // Income splits
  const spendableIds = new Set(spendableAccounts.map(a => a.id));
  const allocations = accounts.filter(a => a.income_allocation && a.income_allocation > 0);
  let spendableIncome = allocations.length > 0
    ? allocations.filter(a => spendableIds.has(a.id)).reduce((s, a) => s + a.income_allocation, 0)
    : (user.take_home_pay || 0);

  // If no manual income configured, use deposit-based income
  if (spendableIncome <= 0) {
    const incomeResult = getMonthlyIncome(userId);
    if (incomeResult.monthlyIncome > 0) {
      spendableIncome = Math.round(incomeResult.monthlyIncome / 2); // estimate per-paycheck
    }
  }

  // === Day-by-day projection ===
  let balance = spendableBalance;
  let runoutDate: string | null = null;
  let runwayDays = 0;
  const maxDays = 730; // project up to 2 years
  const urgentEvents: { name: string; amount: number }[] = [];

  // Deduct undated events immediately (could hit anytime)
  for (const evt of events) {
    if (!evt.expected_date) {
      urgentEvents.push({ name: evt.name, amount: evt.estimated_amount });
      balance -= evt.estimated_amount;
    }
  }

  // Build event cost map by date, expanding recurring events into future occurrences
  const eventsByDate = new Map<string, number>();
  for (const evt of events) {
    if (!evt.expected_date) continue;

    // Add the base event date
    eventsByDate.set(evt.expected_date, (eventsByDate.get(evt.expected_date) || 0) + evt.estimated_amount);
    const daysTil = Math.ceil((new Date(evt.expected_date + 'T00:00:00').getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysTil >= 0 && daysTil <= 14) {
      urgentEvents.push({ name: evt.name, amount: evt.estimated_amount });
    }

    // Expand recurring events into future occurrences within the projection window
    if (evt.is_recurring && evt.recurrence_interval) {
      const intervalDays = parseRecurrenceInterval(evt.recurrence_interval);
      if (intervalDays > 0) {
        let nextDate = new Date(evt.expected_date + 'T00:00:00');
        for (let i = 0; i < 104; i++) { // up to ~2 years of recurrences
          nextDate = new Date(nextDate);
          nextDate.setDate(nextDate.getDate() + intervalDays);
          const ds = nextDate.toISOString().split('T')[0];
          const futureDaysTil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (futureDaysTil > maxDays) break;
          eventsByDate.set(ds, (eventsByDate.get(ds) || 0) + evt.estimated_amount);
        }
      }
    }
  }

  // Track next payday (advance past stale dates)
  let nextPayday = user.next_payday ? new Date(user.next_payday + 'T00:00:00') : null;
  if (nextPayday) {
    nextPayday.setHours(0, 0, 0, 0);
    if (paycheckIntervalDays) {
      while (nextPayday.getTime() < today.getTime()) {
        nextPayday.setDate(nextPayday.getDate() + paycheckIntervalDays);
      }
    }
  } else if (paycheckIntervalDays && spendableIncome > 0) {
    // No next_payday set but pay_frequency exists — estimate next payday
    nextPayday = new Date(today);
    nextPayday.setDate(nextPayday.getDate() + 1);
  }

  // Auto-detect paydays from deposit history if nothing configured
  // Group deposits by date to handle split deposits (multiple on same day = one payday)
  if (!nextPayday && spendableIncome > 0) {
    const recentDeposits = db.prepare(
      `SELECT date, SUM(amount) as total FROM transactions
       WHERE user_id = ? AND amount > 0 AND amount >= 200
       AND date >= date('now', '-90 days')
       AND LOWER(COALESCE(merchant_name, '')) NOT LIKE '%refund%'
       AND LOWER(COALESCE(merchant_name, '')) NOT LIKE '%transfer%'
       AND LOWER(COALESCE(merchant_name, '')) NOT LIKE '%venmo%'
       AND LOWER(COALESCE(merchant_name, '')) NOT LIKE '%zelle%'
       AND LOWER(COALESCE(category, '')) NOT IN ('transfers', 'transfer')
       GROUP BY date
       HAVING total >= 500
       ORDER BY date DESC LIMIT 15`
    ).all(userId) as any[];

    if (recentDeposits.length >= 2) {
      const dates = recentDeposits.map(d => new Date(d.date + 'T00:00:00').getTime()).sort();
      let totalInterval = 0;
      for (let i = 1; i < dates.length; i++) totalInterval += dates[i] - dates[i - 1];
      const avgDays = Math.round(totalInterval / (dates.length - 1) / (1000 * 60 * 60 * 24));

      if (avgDays >= 3 && avgDays <= 35) {
        const lastPay = new Date(dates[dates.length - 1]);
        nextPayday = new Date(lastPay);
        nextPayday.setDate(nextPayday.getDate() + avgDays);
        while (nextPayday.getTime() < today.getTime()) {
          nextPayday.setDate(nextPayday.getDate() + avgDays);
        }
        paycheckIntervalDays = avgDays;
        const avgDeposit = recentDeposits.reduce((s, d) => s + d.total, 0) / recentDeposits.length;
        spendableIncome = Math.round(avgDeposit);
      }
    }
  }

  // Simulate forward
  for (let day = 0; day < maxDays; day++) {
    const d = new Date(today);
    d.setDate(d.getDate() + day);
    const ds = d.toISOString().split('T')[0];

    // Payday income (skip day 0 — it's today, balance already reflects it)
    if (day > 0 && nextPayday && d.getTime() === nextPayday.getTime()) {
      balance += spendableIncome;
      if (paycheckIntervalDays) {
        nextPayday = new Date(nextPayday);
        nextPayday.setDate(nextPayday.getDate() + paycheckIntervalDays);
      } else {
        nextPayday = null;
      }
    }

    // Daily spending
    if (day > 0) balance -= dailyBurnRate;

    // Events on this date
    const evtCost = eventsByDate.get(ds);
    if (evtCost) balance -= evtCost;

    if (balance <= 0 && !runoutDate) {
      runoutDate = ds;
      runwayDays = day;
      break;
    }
    runwayDays = day;
  }

  if (!runoutDate) runwayDays = maxDays;

  // Current runway until next payday
  const projectedSpend = daysToPayday !== null ? dailyBurnRate * daysToPayday : 0;
  const urgentTotal = urgentEvents.reduce((s, e) => s + e.amount, 0);
  const currentRunway = spendableBalance - projectedSpend - urgentTotal;

  // Check if spending outpaces income (net negative cash flow)
  const dailyIncome = paycheckIntervalDays && spendableIncome
    ? spendableIncome / paycheckIntervalDays
    : 0;
  const monthlyIncome = dailyIncome * 30;
  const monthlyBurn = dailyBurnRate * 30;
  const monthlyCashFlow = monthlyIncome - monthlyBurn;
  // No income configured but spending money = definitely losing money
  // Income configured but spending more than earning = losing money
  const isLosingMoney = dailyBurnRate > 0 && (dailyIncome === 0 || dailyBurnRate > dailyIncome);

  let status: 'green' | 'yellow' | 'red';
  if (runwayDays <= 21) {
    status = 'red';
  } else if (runwayDays <= 60) {
    status = 'yellow';
  } else if (isLosingMoney && monthlyCashFlow < -200) {
    // Spending significantly more than earning, even with long runway
    status = runwayDays <= 120 ? 'red' : 'yellow';
  } else if (isLosingMoney) {
    status = 'yellow';
  } else {
    status = 'green';
  }

  // Top non-essential merchants to cut
  const NECESSITY_CATEGORIES = new Set([
    'Groceries', 'Transportation', 'Housing', 'Utilities',
    'Insurance', 'Healthcare', 'Phone', 'Internet',
    'Childcare', 'Medical', 'Pharmacy', 'Rent',
    'Debt Payments', 'Loans', 'Loan Payment', 'Mortgage',
  ]);

  // Merchant name patterns that are essential or debt-related (shouldn't suggest cutting)
  const ESSENTIAL_PATTERNS = [
    /grocery/i, /walmart/i, /kroger/i, /safeway/i, /publix/i, /aldi/i, /costco/i,
    /electric/i, /power/i, /energy/i, /water\s/i, /gas\s/i, /sewer/i,
    /at&t/i, /t-mobile/i, /verizon/i, /sprint/i, /comcast/i, /xfinity/i, /spectrum/i,
    /insurance/i, /geico/i, /state\s*farm/i, /allstate/i,
    /mortgage/i, /rent/i, /lease/i,
    /pharmacy/i, /cvs/i, /walgreens/i,
    // Debt/loan payments — never suggest cutting these
    /sofi/i, /navient/i, /sallie\s*mae/i, /nelnet/i, /great\s*lakes/i, /fedloan/i,
    /capital\s*one/i, /discover/i, /synchrony/i, /barclays/i, /citi\s*card/i,
    /loan/i, /lending/i, /pymt/i, /payment/i,
    /bankers\s*healthcare/i, /prosper/i, /upstart/i, /lightstream/i,
    /cmg\s*mortgage/i, /bank\s*of\s*america/i,
  ];

  function isEssentialMerchant(name: string): boolean {
    return ESSENTIAL_PATTERNS.some(p => p.test(name));
  }

  const merchantRows = db.prepare(
    `SELECT merchant_name, category,
            SUM(ABS(amount)) as total, COUNT(*) as count,
            LOWER(merchant_name) as merchant_key
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND is_recurring = 0
       AND date >= date('now', '-90 days')
       AND COALESCE(category, '') NOT IN ${SPEND_EXCLUSION_CATEGORIES}
       ${SPEND_EXCLUSION_MERCHANTS}
       AND merchant_name IS NOT NULL AND merchant_name != ''
     GROUP BY merchant_key
     ORDER BY total DESC
     LIMIT 20`
  ).all(userId) as unknown as any[];

  function titleCase(s: string): string {
    return s.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
  }

  const cuttableMerchants = merchantRows
    .filter(m =>
      !NECESSITY_CATEGORIES.has(m.category || '') &&
      !isEssentialMerchant(m.merchant_name) &&
      m.count >= 2 // Only recommend cutting truly recurring discretionary spending, not one-time purchases
    )
    .slice(0, 5)
    .map(m => ({
      name: titleCase(m.merchant_name as string),
      // Use per-occurrence average * estimated monthly frequency instead of raw total projection
      monthlyAmount: Math.round((m.total / calendarDays) * 30 * 100) / 100,
      category: (m.category || 'Other') as string,
      occurrences: m.count as number,
    }))
    .filter(m => m.monthlyAmount >= 5);

  const result = {
    amount: rc(currentRunway),
    status,
    hasUrgentWarning: urgentEvents.length > 0,
    urgentEvents,
    spentThisMonth: rc(spentThisMonth),
    remainingBudget: rc(remainingBudget),
    daysToPayday,
    runwayDays,
    runoutDate,
    dailyBurnRate: rc(dailyBurnRate),
    totalDebt: rc(totalDebt),
    spendableBalance: rc(spendableBalance),
    cuttableMerchants,
    monthlyCashFlow: rc(monthlyCashFlow),
    isLosingMoney,
    monthlyIncome: rc(monthlyIncome),
    monthlyBurn: rc(monthlyBurn),
    // Spend breakdown for advisor and debugging
    spendBreakdown: {
      recurringMonthly: rc((breakdown.recurring / calendarDays) * 30),
      variableMonthly: rc((breakdown.variable / calendarDays) * 30),
      oneOffTotal: rc(breakdown.oneOff),
      refundOffset: rc(breakdown.refundOffset),
      outlierCount: breakdown.outlierTransactions.length,
      outlierTransactions: breakdown.outlierTransactions.map(t => ({
        merchant: t.merchant,
        amount: rc(t.amount),
        date: t.date,
      })),
      rawDailyBurn: rc(rawTotalSpend / calendarDays),
    },
    noIncomeConfigured: spendableIncome === 0 && !user.take_home_pay,
  };

  // Record daily snapshot for progress tracking (fire-and-forget)
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    db.prepare(
      `INSERT OR REPLACE INTO daily_snapshots (user_id, date, runway_days, daily_burn, total_balance, total_debt)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userId, todayStr, runwayDays, rc(dailyBurnRate), rc(spendableBalance), rc(totalDebt));
  } catch {}

  return result;
}

function getPaycheckInterval(freq: string | null): number | null {
  switch (freq) {
    case 'weekly': return 7;
    case 'biweekly': return 14;
    case 'twice_monthly': return 15;
    case 'monthly': return 30;
    case 'irregular': return 30; // Treat as monthly average
    default: return null;
  }
}

function parseRecurrenceInterval(interval: string): number {
  switch (interval) {
    case 'weekly': return 7;
    case 'biweekly': return 14;
    case 'monthly': return 30;
    case 'quarterly': return 91;
    case 'annually': case 'yearly': return 365;
    default: {
      // Try to parse "N days" or just a number
      const num = parseInt(interval, 10);
      return isNaN(num) ? 0 : num;
    }
  }
}
