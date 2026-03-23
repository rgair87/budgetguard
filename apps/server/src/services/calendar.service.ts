import db from '../config/db';
import { getPaycheckPlan } from './paycheck.service';
import type { CalendarMonth, CalendarDay, CalendarWeek } from '@runway/shared';

export function getCalendarMonth(userId: string, month: string): CalendarMonth {
  const [year, mon] = month.split('-').map(Number);
  const firstDay = new Date(year, mon - 1, 1);
  const lastDay = new Date(year, mon, 0);
  const daysInMonth = lastDay.getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // --- Same data queries as runway.service.ts ---

  const user = db.prepare(
    'SELECT pay_frequency, next_payday, take_home_pay FROM users WHERE id = ?'
  ).get(userId) as any;

  const accounts = db.prepare(
    'SELECT id, name, type, current_balance, available_balance, purpose, income_allocation FROM accounts WHERE user_id = ?'
  ).all(userId) as any[];

  const spendableAccounts = accounts.filter(a => a.type === 'checking' || a.type === 'savings');
  const spendableBalance = spendableAccounts.reduce((sum, a) => sum + (a.available_balance ?? a.current_balance), 0);

  const spendableIds = new Set(spendableAccounts.map(a => a.id));
  const allocations = accounts.filter(a => a.income_allocation && a.income_allocation > 0);
  const spendableIncome = allocations.length > 0
    ? allocations.filter(a => spendableIds.has(a.id)).reduce((s, a) => s + a.income_allocation, 0)
    : (user.take_home_pay || 0);

  // Daily burn rate from last 90 days — use actual calendar days, not just days with spending
  const spendRow = db.prepare(
    `SELECT COALESCE(SUM(ABS(amount)), 0) as total,
            MIN(date) as earliest_date
     FROM transactions WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')`
  ).get(userId) as any;
  let calendarDays = 90;
  if (spendRow.earliest_date) {
    const earliest = new Date(spendRow.earliest_date + 'T00:00:00');
    const now2 = new Date();
    now2.setHours(0, 0, 0, 0);
    calendarDays = Math.max(1, Math.round((now2.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }
  const dailyBurnRate = spendRow.total / calendarDays;

  // Monthly budget = spending money from paycheck plan (income minus bills/debt/savings)
  // This matches what the home page shows, not the partial category budgets table
  const plan = getPaycheckPlan(userId);
  const monthlyBudget = plan ? Math.max(0, plan.buckets.spending.monthly) : 0;

  // Actual non-recurring spend for the requested month (exclude bills — they're already accounted for)
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`;
  const actualSpendRow = db.prepare(
    `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transactions
     WHERE user_id = ? AND amount < 0 AND is_recurring = 0 AND date >= ? AND date <= ?`
  ).get(userId, monthStart, monthEnd) as any;
  const spentSoFar = actualSpendRow.total;

  // Events
  const events = db.prepare(
    `SELECT name, estimated_amount, expected_date, is_recurring, recurrence_interval
     FROM incoming_events WHERE user_id = ?
     ORDER BY CASE WHEN expected_date IS NULL THEN '1900-01-01' ELSE expected_date END`
  ).all(userId) as any[];

  // Build event map by date (with details, not just cost)
  // Expand recurring events into future occurrences
  const eventDetailsByDate = new Map<string, { name: string; amount: number }[]>();
  for (const evt of events) {
    if (!evt.expected_date) continue;

    // Add the base event
    const existing = eventDetailsByDate.get(evt.expected_date) || [];
    existing.push({ name: evt.name, amount: evt.estimated_amount });
    eventDetailsByDate.set(evt.expected_date, existing);

    // Expand recurring events
    if (evt.is_recurring && evt.recurrence_interval) {
      const intervalDays = parseRecurrenceInterval(evt.recurrence_interval);
      if (intervalDays > 0) {
        let nextDate = new Date(evt.expected_date + 'T00:00:00');
        for (let i = 0; i < 24; i++) { // up to ~2 years of monthly recurrences
          nextDate = new Date(nextDate);
          nextDate.setDate(nextDate.getDate() + intervalDays);
          const ds = nextDate.toISOString().split('T')[0];
          // Only add if within reasonable future
          const daysFuture = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (daysFuture > 400) break;
          const list = eventDetailsByDate.get(ds) || [];
          list.push({ name: evt.name, amount: evt.estimated_amount });
          eventDetailsByDate.set(ds, list);
        }
      }
    }
  }

  // Payday tracking (advance past stale dates)
  const paycheckIntervalDays = getPaycheckInterval(user.pay_frequency);
  let simPayday = user.next_payday ? new Date(user.next_payday + 'T00:00:00') : null;
  if (simPayday) {
    simPayday.setHours(0, 0, 0, 0);
    if (paycheckIntervalDays) {
      while (simPayday.getTime() < today.getTime()) {
        simPayday.setDate(simPayday.getDate() + paycheckIntervalDays);
      }
    }
  }

  // --- Day-by-day simulation from today through end of requested month ---

  let simBalance = spendableBalance;

  // Deduct undated events immediately (same as runway.service.ts)
  for (const evt of events) {
    if (!evt.expected_date) {
      simBalance -= evt.estimated_amount;
    }
  }

  // How many days from today to end of the requested month
  const simEndDate = lastDay;
  const totalSimDays = Math.max(
    0,
    Math.ceil((simEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Store projected balances keyed by date string
  const projections = new Map<string, {
    balance: number;
    isPayday: boolean;
    incomeAmount: number;
    dayEvents: { name: string; amount: number }[];
    eventsCost: number;
  }>();

  for (let day = 0; day <= totalSimDays; day++) {
    const d = new Date(today);
    d.setDate(d.getDate() + day);
    d.setHours(0, 0, 0, 0);
    const ds = d.toISOString().split('T')[0];

    // Payday income (skip day 0 — today's balance already reflects it)
    let isPayday = false;
    let incomeAmount = 0;
    if (day > 0 && simPayday && d.getTime() === simPayday.getTime()) {
      simBalance += spendableIncome;
      isPayday = true;
      incomeAmount = spendableIncome;
      if (paycheckIntervalDays) {
        simPayday = new Date(simPayday);
        simPayday.setDate(simPayday.getDate() + paycheckIntervalDays);
      } else {
        simPayday = null;
      }
    }

    // Daily spending
    if (day > 0) simBalance -= dailyBurnRate;

    // Events
    const dayEvents = eventDetailsByDate.get(ds) || [];
    const eventsCost = dayEvents.reduce((sum, e) => sum + e.amount, 0);
    if (eventsCost) simBalance -= eventsCost;

    // Store if within the requested month
    const dMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (dMonth === month) {
      projections.set(ds, {
        balance: simBalance,
        isPayday,
        incomeAmount,
        dayEvents,
        eventsCost,
      });
    }
  }

  // --- Back-calculate past days in the current month ---
  // For days before today, estimate what balance was by working backwards
  // from today's known balance using the daily burn rate
  const todayStr = today.toISOString().split('T')[0];
  const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  if (todayMonth === month || firstDay.getTime() < today.getTime()) {
    const todayBalance = simBalance; // balance as of today (day 0 in simulation)
    // For past days, estimate: balance was higher by (daysAgo * dailyBurnRate)
    // and add back any events that happened, subtract any paydays that occurred
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const ds = `${month}-${String(dayNum).padStart(2, '0')}`;
      const d = new Date(year, mon - 1, dayNum);
      d.setHours(0, 0, 0, 0);

      if (d.getTime() < today.getTime() && !projections.has(ds)) {
        const daysAgo = Math.ceil((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        // Rough estimate: balance was higher by burn rate per day
        const estimatedBalance = spendableBalance + (dailyBurnRate * daysAgo);
        const dayEvents = eventDetailsByDate.get(ds) || [];
        const eventsCost = dayEvents.reduce((sum, e) => sum + e.amount, 0);

        projections.set(ds, {
          balance: estimatedBalance,
          isPayday: false,
          incomeAmount: 0,
          dayEvents,
          eventsCost,
        });
      }
    }
  }

  // --- Build CalendarDay array for every day of the month ---

  const days: CalendarDay[] = [];
  let lowestBalance = Infinity;
  let lowestBalanceDate = monthStart;

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const ds = `${month}-${String(dayNum).padStart(2, '0')}`;
    const d = new Date(year, mon - 1, dayNum);
    d.setHours(0, 0, 0, 0);

    const proj = projections.get(ds);
    const projectedBalance = proj
      ? Math.round(proj.balance * 100) / 100
      : Math.round(spendableBalance * 100) / 100;

    const isPast = d.getTime() < today.getTime();
    const isToday = d.getTime() === today.getTime();

    // Only count projected days (today + future) for lowest balance
    if (!isPast && projectedBalance < lowestBalance) {
      lowestBalance = projectedBalance;
      lowestBalanceDate = ds;
    }

    const status: 'green' | 'yellow' | 'red' =
      isPast ? 'green' : // past days don't need status warnings
      projectedBalance < 0 ? 'red' :
      projectedBalance < dailyBurnRate * 7 ? 'yellow' : 'green';

    days.push({
      date: ds,
      projectedBalance,
      isPayday: proj?.isPayday || false,
      incomeAmount: Math.round((proj?.incomeAmount || 0) * 100) / 100,
      dailySpend: Math.round(dailyBurnRate * 100) / 100,
      events: proj?.dayEvents || [],
      eventsCost: Math.round((proj?.eventsCost || 0) * 100) / 100,
      isPast,
      isToday,
      status,
    });
  }

  // --- Non-recurring (discretionary) daily spend for budget comparisons ---
  const nonRecurringSpendRow = db.prepare(
    `SELECT COALESCE(SUM(ABS(amount)), 0) as total,
            MIN(date) as earliest_date
     FROM transactions WHERE user_id = ? AND amount < 0 AND is_recurring = 0 AND date >= date('now', '-90 days')`
  ).get(userId) as any;
  let nrCalendarDays = calendarDays;
  if (nonRecurringSpendRow.earliest_date) {
    const nrEarliest = new Date(nonRecurringSpendRow.earliest_date + 'T00:00:00');
    const nrNow = new Date();
    nrNow.setHours(0, 0, 0, 0);
    nrCalendarDays = Math.max(1, Math.round((nrNow.getTime() - nrEarliest.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }
  const dailyDiscretionaryRate = nonRecurringSpendRow.total / nrCalendarDays;

  // --- Weekly summaries ---
  const weeks = computeWeeks(days, monthlyBudget, daysInMonth, dailyDiscretionaryRate);

  // --- Month-level summary ---
  const projectedMonthlySpend = dailyDiscretionaryRate * daysInMonth +
    days.reduce((sum, d) => sum + d.eventsCost, 0);
  const overBudget = monthlyBudget > 0 && projectedMonthlySpend > monthlyBudget;
  const budgetUtilization = monthlyBudget > 0 ? projectedMonthlySpend / monthlyBudget : 0;
  const monthStatus: 'green' | 'yellow' | 'red' =
    overBudget ? 'red' : budgetUtilization > 0.85 ? 'yellow' : 'green';

  return {
    month,
    days,
    weeks,
    monthlyBudget: Math.round(monthlyBudget * 100) / 100,
    projectedMonthlySpend: Math.round(projectedMonthlySpend * 100) / 100,
    spentSoFar: Math.round(spentSoFar * 100) / 100,
    overBudget,
    monthStatus,
    startingBalance: days.length > 0 ? days[0].projectedBalance : Math.round(spendableBalance * 100) / 100,
    endingBalance: days.length > 0 ? days[days.length - 1].projectedBalance : Math.round(spendableBalance * 100) / 100,
    // For lowest balance, if no projected (future) days exist, use current balance
    lowestBalance: lowestBalance === Infinity ? 0 : Math.round(lowestBalance * 100) / 100,
    lowestBalanceDate,
  };
}

function computeWeeks(days: CalendarDay[], monthlyBudget: number, daysInMonth: number, dailyDiscretionaryRate: number): CalendarWeek[] {
  // Use ~4.33 weeks per month for consistent weekly budgets
  const weeklyBudget = monthlyBudget > 0 ? monthlyBudget / 4.33 : 0;
  const weeks: CalendarWeek[] = [];

  let currentWeek: CalendarDay[] = [];
  let weekNum = 1;

  for (const day of days) {
    const dow = new Date(day.date).getDay(); // 0=Sun

    // Start new week on Sunday (but not the very first day)
    if (dow === 0 && currentWeek.length > 0) {
      weeks.push(buildWeek(currentWeek, weekNum++, weeklyBudget, dailyDiscretionaryRate));
      currentWeek = [];
    }
    currentWeek.push(day);
  }

  // Last partial week
  if (currentWeek.length > 0) {
    weeks.push(buildWeek(currentWeek, weekNum, weeklyBudget, dailyDiscretionaryRate));
  }

  return weeks;
}

function buildWeek(days: CalendarDay[], weekNum: number, fullWeekBudget: number, dailyDiscretionaryRate: number): CalendarWeek {
  // Use discretionary daily rate (excluding bills) for projected spend
  const totalSpend = days.length * dailyDiscretionaryRate + days.reduce((sum, d) => sum + d.eventsCost, 0);
  // Pro-rate budget for partial weeks
  const proportionalBudget = fullWeekBudget > 0 ? fullWeekBudget * (days.length / 7) : 0;
  const overBudget = proportionalBudget > 0 && totalSpend > proportionalBudget;
  const utilization = proportionalBudget > 0 ? totalSpend / proportionalBudget : 0;

  return {
    weekNumber: weekNum,
    startDate: days[0].date,
    endDate: days[days.length - 1].date,
    totalSpend: Math.round(totalSpend * 100) / 100,
    weeklyBudget: Math.round(proportionalBudget * 100) / 100,
    overBudget,
    status: overBudget ? 'red' : utilization > 0.85 ? 'yellow' : 'green',
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
      const num = parseInt(interval, 10);
      return isNaN(num) ? 0 : num;
    }
  }
}
