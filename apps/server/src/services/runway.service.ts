import db from '../config/db';
import type { RunwayScore } from '@runway/shared';

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
  const debtAccounts = accounts.filter(a => DEBT_TYPES.includes(a.type));
  const totalDebt = debtAccounts.reduce((sum, a) => sum + a.current_balance, 0);

  // Daily burn rate from last 90 days — use actual calendar days, not just days with spending
  // Exclude transfers and internal movements (credit card payments, account transfers)
  const EXCLUDED_CATEGORIES = ['Transfers', 'Transfer', 'Debt Payments'];
  const spendRow = db.prepare(
    `SELECT COALESCE(SUM(ABS(amount)), 0) as total,
            MIN(date) as earliest_date
     FROM transactions WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
       AND COALESCE(category, '') NOT IN ('Transfers', 'Transfer', 'Debt Payments')
       AND merchant_name NOT LIKE '%transfer%'
       AND merchant_name NOT LIKE '%payment to%'
       AND merchant_name NOT LIKE '%CREDIT CARD%'`
  ).get(userId) as unknown as any;
  let calendarDays = 90; // default to full window
  if (spendRow.earliest_date) {
    const earliest = new Date(spendRow.earliest_date + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    calendarDays = Math.max(1, Math.round((now.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }
  const dailyBurnRate = spendRow.total / calendarDays;

  // Spent this month (exclude transfers)
  const monthSpendRow = db.prepare(
    `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', 'start of month')
       AND COALESCE(category, '') NOT IN ('Transfers', 'Transfer', 'Debt Payments')
       AND merchant_name NOT LIKE '%transfer%'
       AND merchant_name NOT LIKE '%payment to%'
       AND merchant_name NOT LIKE '%CREDIT CARD%'`
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

  const paycheckIntervalDays = getPaycheckInterval(user.pay_frequency);

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
  const spendableIncome = allocations.length > 0
    ? allocations.filter(a => spendableIds.has(a.id)).reduce((s, a) => s + a.income_allocation, 0)
    : (user.take_home_pay || 0);

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
  // No income configured but spending money = definitely losing money
  // Income configured but spending more than earning = losing money
  const isLosingMoney = dailyBurnRate > 0 && (dailyIncome === 0 || dailyBurnRate > dailyIncome);

  let status: 'green' | 'yellow' | 'red';
  if (runwayDays <= 21) {
    status = 'red';
  } else if (runwayDays <= 60) {
    status = 'yellow';
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
  ]);

  // Merchant name patterns that are essential even if miscategorized as "Other"
  const ESSENTIAL_PATTERNS = [
    /grocery/i, /walmart/i, /kroger/i, /safeway/i, /publix/i, /aldi/i, /costco/i,
    /electric/i, /power/i, /energy/i, /water\s/i, /gas\s/i, /sewer/i,
    /at&t/i, /t-mobile/i, /verizon/i, /sprint/i, /comcast/i, /xfinity/i, /spectrum/i,
    /insurance/i, /geico/i, /state\s*farm/i, /allstate/i,
    /mortgage/i, /rent/i, /lease/i,
    /pharmacy/i, /cvs/i, /walgreens/i,
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
       AND merchant_name IS NOT NULL AND merchant_name != ''
     GROUP BY merchant_key
     ORDER BY total DESC
     LIMIT 20`
  ).all(userId) as unknown as any[];

  function titleCase(s: string): string {
    return s.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
  }

  const cuttableMerchants = merchantRows
    .filter(m => !NECESSITY_CATEGORIES.has(m.category || '') && !isEssentialMerchant(m.merchant_name))
    .slice(0, 5)
    .map(m => ({
      name: titleCase(m.merchant_name as string),
      monthlyAmount: Math.round((m.total / calendarDays) * 30 * 100) / 100,
      category: (m.category || 'Other') as string,
    }))
    .filter(m => m.monthlyAmount >= 5);

  return {
    amount: Math.round(currentRunway * 100) / 100,
    status,
    hasUrgentWarning: urgentEvents.length > 0,
    urgentEvents,
    spentThisMonth: Math.round(spentThisMonth * 100) / 100,
    remainingBudget: Math.round(remainingBudget * 100) / 100,
    daysToPayday,
    runwayDays,
    runoutDate,
    dailyBurnRate: Math.round(dailyBurnRate * 100) / 100,
    totalDebt: Math.round(totalDebt * 100) / 100,
    spendableBalance: Math.round(spendableBalance * 100) / 100,
    cuttableMerchants,
  };
}

function getPaycheckInterval(freq: string | null): number | null {
  switch (freq) {
    case 'weekly': return 7;
    case 'biweekly': return 14;
    case 'twice_monthly': return 15;
    case 'monthly': return 30;
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
