import db from '../config/db';
import { calculateRunway } from './runway.service';

export interface Alert {
  id: string;
  type: 'runway_low' | 'budget_exceeded' | 'bill_due' | 'unusual_spending' | 'debt_milestone' | 'debt_payoff_opportunity';
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

  // 4. Unusual spending (category projected to exceed 50%+ above 3-month average)
  const avgCategorySpend = db.prepare(
    `SELECT category, AVG(monthly_total) as avg_monthly FROM (
       SELECT category, strftime('%Y-%m', date) as month, SUM(ABS(amount)) as monthly_total
       FROM transactions
       WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
       AND date < date('now', 'start of month')
       GROUP BY category, month
     ) GROUP BY category`
  ).all(userId) as unknown as { category: string; avg_monthly: number }[];

  const avgMap = new Map(avgCategorySpend.map(c => [c.category, c.avg_monthly]));

  // Pro-rate current month spending to project full month
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthProgressRatio = dayOfMonth / daysInCurrentMonth;

  for (const [category, spent] of spendMap) {
    const avg = avgMap.get(category);
    if (avg && avg > 50) {
      // Project current spending to full month
      const projectedMonthly = monthProgressRatio > 0 ? spent / monthProgressRatio : spent;
      if (projectedMonthly > avg * 1.5) {
        const pctAbove = Math.round(((projectedMonthly - avg) / avg) * 100);
        alerts.push({
          id: `unusual_${category}`,
          type: 'unusual_spending',
          severity: 'warning',
          title: `${category} spending is on pace to be ${pctAbove}% above normal`,
          body: `You've spent $${spent.toFixed(0)} on ${category} so far this month (on pace for $${Math.round(projectedMonthly)}) vs your $${avg.toFixed(0)} monthly average.`,
          action: null,
          actionLink: null,
        });
      }
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

  // 6. Smart debt payoff opportunity — when user has excess cash and outstanding debt
  const monthlyExpenses = runway.dailyBurnRate * 30;
  const safetyNet = monthlyExpenses * 3; // Keep 3 months as safety net (consistent with advisor emergency fund target)
  const excessCash = runway.spendableBalance - safetyNet;

  if (excessCash > 0 && monthlyExpenses > 0) {
    // Fetch debt accounts to find payoff targets
    const debtAccounts = db.prepare(
      `SELECT name, type, current_balance, interest_rate, minimum_payment
       FROM accounts
       WHERE user_id = ? AND type IN ('credit', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan')
         AND current_balance > 0
       ORDER BY interest_rate DESC`
    ).all(userId) as unknown as {
      name: string; type: string; current_balance: number;
      interest_rate: number | null; minimum_payment: number | null;
    }[];

    if (debtAccounts.length > 0) {
      // Find highest-interest debt
      const highestInterest = debtAccounts[0];
      // Find smallest balance debt (for quick wins)
      const smallestBalance = [...debtAccounts].sort((a, b) => a.current_balance - b.current_balance)[0];

      // Pick the best target: if smallest balance can be fully paid off with excess cash, suggest that;
      // otherwise suggest highest-interest debt
      const target = (smallestBalance.current_balance <= excessCash)
        ? smallestBalance
        : highestInterest;

      const canPayInFull = target.current_balance <= excessCash;
      const minPayment = target.minimum_payment || 0;
      const interestRate = target.interest_rate || 0;
      const monthlyInterestCost = Math.round((target.current_balance * (interestRate / 100)) / 12);

      let body: string;
      let title: string;

      if (canPayInFull) {
        title = `Extra cash could wipe out ${target.name}`;
        body = `You have $${Math.round(excessCash).toLocaleString()} beyond your 3-month safety net. Paying off ${target.name} ($${Math.round(target.current_balance).toLocaleString()} balance) would free up $${Math.round(minPayment).toLocaleString()}/mo in payments`;
        if (monthlyInterestCost > 0) {
          body += ` and save ~$${monthlyInterestCost}/mo in interest`;
        }
        body += '.';
      } else {
        title = `Excess cash? Attack your ${target.name} balance`;
        body = `You have $${Math.round(excessCash).toLocaleString()} above your 3-month safety net. A lump payment on ${target.name} (${interestRate > 0 ? interestRate + '% APR, ' : ''}$${Math.round(target.current_balance).toLocaleString()} balance) would cut interest costs`;
        if (monthlyInterestCost > 0) {
          body += ` — currently ~$${monthlyInterestCost}/mo in interest charges`;
        }
        body += '.';
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

  // Sort: critical first, then warning, info, win
  const order = { critical: 0, warning: 1, info: 2, win: 3 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  return alerts;
}
