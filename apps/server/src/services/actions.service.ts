import db from '../config/db';
import { calculateRunway } from './runway.service';

interface DailyAction {
  title: string;
  body: string;
  link: string;
  dollarImpact: number;
  type: string;
}

export function getDailyAction(userId: string): DailyAction | null {
  const actions: DailyAction[] = [];

  try {
    const runway = calculateRunway(userId);

    // 1. Cuttable merchants (from runway calculation)
    if (runway.cuttableMerchants.length > 0) {
      const top = runway.cuttableMerchants[0];
      actions.push({
        title: `Cut ${top.name}`,
        body: `Save $${Math.round(top.monthlyAmount)}/mo by dropping this ${top.category} expense.`,
        link: '/cut-this',
        dollarImpact: top.monthlyAmount,
        type: 'cut',
      });
    }

    // 2. Weekend/daily spending budget
    if (runway.daysToPayday !== null && runway.daysToPayday > 0 && runway.daysToPayday <= 7) {
      const dailyBudget = Math.round(runway.amount / runway.daysToPayday);
      if (dailyBudget > 0) {
        actions.push({
          title: `$${dailyBudget}/day until payday`,
          body: `You have $${Math.round(runway.amount)} left and ${runway.daysToPayday} days until your next paycheck.`,
          link: '/calendar',
          dollarImpact: dailyBudget,
          type: 'budget',
        });
      }
    }

    // 3. High-interest debt
    const debtAccounts = db.prepare(
      `SELECT name, current_balance, interest_rate FROM accounts
       WHERE user_id = ? AND type IN ('credit', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan')
       AND current_balance > 0 AND COALESCE(interest_rate, 0) >= 15
       ORDER BY interest_rate DESC LIMIT 1`
    ).get(userId) as { name: string; current_balance: number; interest_rate: number } | undefined;

    if (debtAccounts) {
      const monthlyInterest = Math.round(debtAccounts.current_balance * (debtAccounts.interest_rate / 100 / 12));
      actions.push({
        title: `Pay down ${debtAccounts.name}`,
        body: `${debtAccounts.interest_rate}% APR is costing you $${monthlyInterest}/mo in interest alone.`,
        link: '/debt',
        dollarImpact: monthlyInterest,
        type: 'debt',
      });
    }

    // 4. Uncategorized transactions
    const uncatRow = db.prepare(
      `SELECT COUNT(*) as count FROM transactions
       WHERE user_id = ? AND (category IS NULL OR category = '' OR category = 'Other')
       AND date >= date('now', '-30 days')`
    ).get(userId) as { count: number };

    if (uncatRow.count > 5) {
      actions.push({
        title: `Review ${uncatRow.count} transactions`,
        body: 'Help us learn your spending patterns. Categorize these for better insights.',
        link: '/transactions',
        dollarImpact: 0,
        type: 'review',
      });
    }

    // 5. Goals with shortfall
    const goalRows = db.prepare(
      `SELECT name, target_amount, current_amount, deadline FROM savings_goals
       WHERE user_id = ? AND current_amount < target_amount
       ORDER BY deadline ASC LIMIT 1`
    ).all(userId) as { name: string; target_amount: number; current_amount: number; deadline: string | null }[];

    if (goalRows.length > 0) {
      const g = goalRows[0];
      const remaining = g.target_amount - g.current_amount;
      actions.push({
        title: `Save toward ${g.name}`,
        body: `$${Math.round(remaining).toLocaleString()} to go. Any amount helps.`,
        link: '/goals',
        dollarImpact: Math.min(remaining, 100),
        type: 'goal',
      });
    }

    // Return highest dollar-impact action, with "review" as tiebreaker
    actions.sort((a, b) => b.dollarImpact - a.dollarImpact);
    // If there's a budget/daily action and payday is close, prioritize it
    const budgetAction = actions.find(a => a.type === 'budget');
    if (budgetAction && budgetAction.dollarImpact > 0) return budgetAction;

    return actions[0] || null;
  } catch {
    return null;
  }
}
