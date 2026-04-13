import db from '../config/db';
import { calculateRunway } from './runway.service';

export interface Alert {
  id: string;
  type: 'runway_low' | 'budget_exceeded' | 'bill_due' | 'unusual_spending' | 'debt_milestone' | 'debt_payoff_opportunity' | 'streak_milestone' | 'runway_improvement' | 'budget_underrun';
  severity: 'critical' | 'warning' | 'info' | 'win';
  title: string;
  body: string;
  action: string | null;
  actionLink: string | null;
}

export function getAlerts(userId: string): Alert[] {
  const alerts: Alert[] = [];
  const runway = calculateRunway(userId);

  // 1. Runway warnings
  if (runway.runwayDays <= 7) {
    alerts.push({
      id: 'runway_critical',
      type: 'runway_low',
      severity: 'critical',
      title: `Only ${runway.runwayDays} days of runway left`,
      body: `At your current spending of $${runway.dailyBurnRate.toFixed(0)}/day, you'll run out${runway.runoutDate ? ' by ' + new Date(runway.runoutDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ' soon'}. Cut non-essential spending immediately.`,
      action: 'Review what to cut',
      actionLink: '/cut-this',
    });
  } else if (runway.runwayDays <= 21) {
    alerts.push({
      id: 'runway_warning',
      type: 'runway_low',
      severity: 'warning',
      title: `${runway.runwayDays} days of runway — getting tight`,
      body: `You have $${runway.spendableBalance.toLocaleString()} with $${runway.dailyBurnRate.toFixed(0)}/day spending.${runway.daysToPayday ? ` Payday is in ${runway.daysToPayday} days.` : ''}`,
      action: 'See spending cuts',
      actionLink: '/cut-this',
    });
  }

  // 2. Budget exceeded alerts
  const budgets = db.prepare(
    'SELECT category, monthly_limit FROM budgets WHERE user_id = ?'
  ).all(userId) as unknown as { category: string; monthly_limit: number }[];

  const categorySpend = db.prepare(
    `SELECT category, SUM(ABS(amount)) as total FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', 'start of month')
     GROUP BY category`
  ).all(userId) as unknown as { category: string; total: number }[];

  const spendMap = new Map(categorySpend.map(c => [c.category, c.total]));

  for (const budget of budgets) {
    const spent = spendMap.get(budget.category) || 0;
    const pct = budget.monthly_limit > 0 ? (spent / budget.monthly_limit) * 100 : 0;
    if (pct >= 100) {
      alerts.push({
        id: `budget_over_${budget.category}`,
        type: 'budget_exceeded',
        severity: 'warning',
        title: `${budget.category} budget exceeded`,
        body: `You've spent $${spent.toFixed(0)} of your $${budget.monthly_limit} ${budget.category} budget (${Math.round(pct)}%).`,
        action: 'View spending breakdown',
        actionLink: '/',
      });
    } else if (pct >= 80) {
      alerts.push({
        id: `budget_near_${budget.category}`,
        type: 'budget_exceeded',
        severity: 'info',
        title: `${budget.category} budget ${Math.round(pct)}% used`,
        body: `$${(budget.monthly_limit - spent).toFixed(0)} left in your ${budget.category} budget for the rest of the month.`,
        action: null,
        actionLink: null,
      });
    }
  }

  // 3. Upcoming bills due (events in next 7 days)
  const upcomingEvents = db.prepare(
    `SELECT name, estimated_amount, expected_date FROM incoming_events
     WHERE user_id = ? AND expected_date IS NOT NULL
     AND expected_date BETWEEN date('now') AND date('now', '+7 days')
     ORDER BY expected_date`
  ).all(userId) as unknown as { name: string; estimated_amount: number; expected_date: string }[];

  for (const evt of upcomingEvents) {
    const daysUntil = Math.ceil((new Date(evt.expected_date + 'T00:00:00').getTime() - Date.now()) / 86400000);
    alerts.push({
      id: `bill_due_${evt.name}`,
      type: 'bill_due',
      severity: daysUntil <= 2 ? 'warning' : 'info',
      title: `${evt.name} due ${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`,
      body: `$${evt.estimated_amount.toLocaleString()} is coming up on ${new Date(evt.expected_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`,
      action: 'View events',
      actionLink: '/events',
    });
  }

  // 4. Unusual spending (category actually exceeding 3-month average)
  // Skip null/empty categories and system categories (Transfers, Income, etc.)
  const ALERT_SKIP_CATEGORIES = new Set([null, '', 'Transfers', 'Transfer', 'Income', 'Debt Payments', 'Fees']);
  // Use complete prior calendar months (not rolling 90 days) to avoid partial-month averages
  // that miss bills paid on the 1st or 2nd of the month
  const avgCategorySpend = db.prepare(
    `SELECT category, AVG(monthly_total) as avg_monthly FROM (
       SELECT category, strftime('%Y-%m', date) as month, SUM(ABS(amount)) as monthly_total
       FROM transactions
       WHERE user_id = ? AND amount < 0
       AND date >= date('now', 'start of month', '-3 months')
       AND date < date('now', 'start of month')
       AND category IS NOT NULL AND category != ''
       GROUP BY category, month
     ) GROUP BY category`
  ).all(userId) as unknown as { category: string; avg_monthly: number }[];

  const avgMap = new Map(avgCategorySpend.map(c => [c.category, c.avg_monthly]));

  // Get LAST month's spend per category — to detect "consistent but average is lagging"
  const lastMonthSpend = db.prepare(
    `SELECT category, SUM(ABS(amount)) as total FROM transactions
     WHERE user_id = ? AND amount < 0
     AND date >= date('now', 'start of month', '-1 month')
     AND date < date('now', 'start of month')
     AND category IS NOT NULL AND category != ''
     GROUP BY category`
  ).all(userId) as unknown as { category: string; total: number }[];
  const lastMonthMap = new Map(lastMonthSpend.map(c => [c.category, c.total]));

  // Get transaction count per category this month (to decide if pro-rating makes sense)
  const categoryTxnCounts = db.prepare(
    `SELECT category, COUNT(*) as count, COUNT(DISTINCT date) as distinct_days
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', 'start of month')
     AND category IS NOT NULL AND category != ''
     GROUP BY category`
  ).all(userId) as unknown as { category: string; count: number; distinct_days: number }[];
  const txnCountMap = new Map(categoryTxnCounts.map(c => [c.category, { count: c.count, days: c.distinct_days }]));

  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  for (const [category, spent] of spendMap) {
    if (ALERT_SKIP_CATEGORIES.has(category)) continue;
    const avg = avgMap.get(category);
    if (!avg || avg <= 50) continue;

    const txnInfo = txnCountMap.get(category);
    const txnCount = txnInfo?.count || 1;
    const distinctDays = txnInfo?.days || 1;

    // Smart projection: only pro-rate if the category has frequent transactions across multiple days.
    // Categories with few large transactions (mortgage, insurance, tuition) should NOT be pro-rated —
    // a $5,000 mortgage on day 1 doesn't mean $50,000/month.
    let projectedMonthly: number;
    if (distinctDays >= 3 && txnCount >= 5) {
      // Frequent spending (dining, gas, groceries) — safe to pro-rate
      const monthProgressRatio = dayOfMonth / daysInCurrentMonth;
      projectedMonthly = monthProgressRatio > 0 ? spent / monthProgressRatio : spent;
    } else {
      // Infrequent/large transactions (rent, insurance, tuition) — use actual amount
      projectedMonthly = spent;
    }

    // Skip if current spend is consistent with last month (within 15%).
    // This avoids alerting when a bill amount changed and the average is just catching up.
    const lastMonth = lastMonthMap.get(category);
    if (lastMonth && lastMonth > 0) {
      const vsLastMonth = Math.abs(projectedMonthly - lastMonth) / lastMonth;
      if (vsLastMonth <= 0.15) continue; // Consistent with last month — not unusual
    }

    if (projectedMonthly > avg * 1.5) {
      const pctAbove = Math.round(((projectedMonthly - avg) / avg) * 100);
      const isProrated = distinctDays >= 3 && txnCount >= 5;
      alerts.push({
        id: `unusual_${category}`,
        type: 'unusual_spending',
        severity: 'warning',
        title: `${category} spending is ${isProrated ? 'on pace to be ' : ''}${pctAbove}% above normal`,
        body: isProrated
          ? `You've spent $${spent.toFixed(0)} on ${category} so far this month (on pace for $${Math.round(projectedMonthly)}) vs your $${avg.toFixed(0)} monthly average.`
          : `You've spent $${spent.toFixed(0)} on ${category} this month vs your $${avg.toFixed(0)} monthly average.`,
        action: null,
        actionLink: null,
      });
    }
  }

  // 5. Positive milestones
  if (runway.status === 'green' && runway.runwayDays >= 90) {
    alerts.push({
      id: 'runway_great',
      type: 'debt_milestone',
      severity: 'win',
      title: '90+ days of runway',
      body: `You have ${runway.runwayDays} days of financial cushion. You're in a strong position.`,
      action: null,
      actionLink: null,
    });
  }

  // 5b. Streak milestones
  const user = db.prepare('SELECT streak_days FROM users WHERE id = ?').get(userId) as { streak_days: number } | undefined;
  const streak = user?.streak_days || 0;
  const streakMilestones = [7, 14, 30, 60, 90];
  for (const ms of streakMilestones) {
    if (streak >= ms && streak < ms + 7) {
      alerts.push({
        id: `streak_${ms}`,
        type: 'streak_milestone',
        severity: 'win',
        title: `${ms}-day streak!`,
        body: ms >= 30
          ? `You've checked in ${ms} days in a row. That's real financial discipline.`
          : `${ms} days in a row. You're building a great habit.`,
        action: null,
        actionLink: null,
      });
      break;
    }
  }

  // 5c. Runway improvement (requires snapshots)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const lastWeekSnapshot = db.prepare(
    'SELECT runway_days FROM daily_snapshots WHERE user_id = ? AND date <= ? ORDER BY date DESC LIMIT 1'
  ).get(userId, weekAgo) as { runway_days: number } | undefined;
  if (lastWeekSnapshot && runway.runwayDays - lastWeekSnapshot.runway_days >= 5) {
    const gained = runway.runwayDays - lastWeekSnapshot.runway_days;
    alerts.push({
      id: 'runway_improved',
      type: 'runway_improvement',
      severity: 'win',
      title: `Runway up ${gained} days`,
      body: `Your financial cushion grew by ${gained} days this week. Nice work.`,
      action: null,
      actionLink: null,
    });
  }

  // 5d. Budget underrun (after 20th of the month)
  const currentDay = new Date().getDate();
  if (currentDay >= 20) {
    const underBudget = budgets
      .filter(b => b.monthly_limit > 0)
      .map(b => ({ ...b, spent: spendMap.get(b.category) || 0 }))
      .filter(b => b.spent > 0 && b.spent < b.monthly_limit * 0.8);
    if (underBudget.length > 0) {
      const best = underBudget.sort((a, b) => (b.monthly_limit - b.spent) - (a.monthly_limit - a.spent))[0];
      const saved = Math.round(best.monthly_limit - best.spent);
      alerts.push({
        id: `budget_under_${best.category}`,
        type: 'budget_underrun',
        severity: 'win',
        title: `Under budget on ${best.category}`,
        body: `You have $${saved} left in your ${best.category} budget with ${30 - currentDay} days to go.`,
        action: null,
        actionLink: '/budgets',
      });
    }
  }

  // 6. Smart debt payoff opportunity — when user has excess cash and outstanding debt
  const monthlyExpenses = runway.dailyBurnRate * 30;
  const safetyNet = monthlyExpenses * 3; // Keep 3 months as safety net (consistent with advisor emergency fund target)
  const excessCash = runway.spendableBalance - safetyNet;

  if (excessCash > 0 && monthlyExpenses > 0) {
    // Fetch debt accounts to find payoff targets
    // Only consider debts with interest > 0% — never recommend paying off 0% promo rates early
    const debtAccounts = db.prepare(
      `SELECT name, type, current_balance, interest_rate, minimum_payment
       FROM accounts
       WHERE user_id = ? AND type IN ('credit', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan')
         AND current_balance > 0
         AND COALESCE(interest_rate, 0) > 0
       ORDER BY interest_rate DESC`
    ).all(userId) as unknown as {
      name: string; type: string; current_balance: number;
      interest_rate: number | null; minimum_payment: number | null;
    }[];

    if (debtAccounts.length > 0) {
      // Find highest-interest debt (already sorted DESC, nulls filtered out)
      const highestInterest = debtAccounts[0];
      // Find smallest balance with meaningful interest (>5%) for quick wins
      const smallBalanceCandidates = [...debtAccounts]
        .filter(d => (d.interest_rate || 0) > 5)
        .sort((a, b) => a.current_balance - b.current_balance);
      const smallestBalance = smallBalanceCandidates.length > 0 ? smallBalanceCandidates[0] : null;

      // Pick the best target: prefer small payable balance with real interest, otherwise highest rate
      const target = (smallestBalance && smallestBalance.current_balance <= excessCash)
        ? smallestBalance
        : highestInterest;

      const canPayInFull = target.current_balance <= excessCash;
      const minPayment = target.minimum_payment || 0;
      const interestRate = target.interest_rate || 0;
      const monthlyInterestCost = Math.round((target.current_balance * (interestRate / 100)) / 12);

      // Only show alert if there's actual interest savings
      if (monthlyInterestCost > 0) {
        let body: string;
        let title: string;

        if (canPayInFull) {
          title = `Extra cash could wipe out ${target.name}`;
          body = `You have $${Math.round(excessCash).toLocaleString()} beyond your 3-month safety net. Paying off ${target.name} ($${Math.round(target.current_balance).toLocaleString()} at ${interestRate}% APR) saves $${monthlyInterestCost}/mo in interest`;
          if (minPayment > 0) {
            body += ` and frees up $${Math.round(minPayment).toLocaleString()}/mo in payments`;
          }
          body += '.';
        } else {
          title = `Excess cash? Attack your ${target.name} balance`;
          body = `You have $${Math.round(excessCash).toLocaleString()} above your 3-month safety net. A lump payment on ${target.name} (${interestRate}% APR, $${Math.round(target.current_balance).toLocaleString()} balance) would save ~$${monthlyInterestCost}/mo in interest.`;
        }

        alerts.push({
          id: 'debt_payoff_opportunity',
          type: 'debt_payoff_opportunity',
          severity: 'info',
          title,
          body,
          action: canPayInFull ? `Pay off ${target.name} in full` : `Make extra payment on ${target.name}`,
          actionLink: '/debt',
        });
      }
    }
  }

  // Sort: critical first, then warning, info, win
  const order = { critical: 0, warning: 1, info: 2, win: 3 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  return alerts;
}
