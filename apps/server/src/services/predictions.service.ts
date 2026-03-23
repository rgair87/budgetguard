import db from '../config/db';

interface CategoryPrediction {
  category: string;
  spentSoFar: number;
  budget: number | null;
  projectedTotal: number;
  projectedOverage: number;
  daysLeft: number;
  dailyPace: number;
  safeDailyBudget: number | null;
  status: 'on_track' | 'warning' | 'over_budget' | 'no_budget';
  message: string;
}

interface SpendingPredictions {
  predictions: CategoryPrediction[];
  overallMessage: string;
  daysLeftInMonth: number;
  percentThroughMonth: number;
}

export function getSpendingPredictions(userId: string): SpendingPredictions {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const dayOfMonth = now.getDate();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = Math.max(1, dayOfMonth); // at least 1 to avoid division by zero
  const daysLeft = totalDaysInMonth - dayOfMonth;
  const percentThroughMonth = Math.round((daysElapsed / totalDaysInMonth) * 100);

  // Start of current month as YYYY-MM-01
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;

  // Get spending by category this month (amount < 0 means spending)
  const categorySpending = db.prepare(
    `SELECT category, COALESCE(SUM(ABS(amount)), 0) as spent
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= ?
     GROUP BY category`
  ).all(userId) as unknown as Array<{ category: string; spent: number }>;

  // Get all budgets for user
  const budgets = db.prepare(
    `SELECT category, monthly_limit FROM budgets WHERE user_id = ?`
  ).all(userId) as unknown as Array<{ category: string; monthly_limit: number }>;

  const budgetMap = new Map<string, number>();
  for (const b of budgets) {
    budgetMap.set(b.category, b.monthly_limit);
  }

  const predictions: CategoryPrediction[] = categorySpending.map(row => {
    const spentSoFar = Math.round(row.spent * 100) / 100;
    const budget = budgetMap.get(row.category) ?? null;
    const dailyPace = Math.round((spentSoFar / daysElapsed) * 100) / 100;
    const projectedTotal = Math.round(dailyPace * totalDaysInMonth * 100) / 100;

    let projectedOverage = 0;
    let status: CategoryPrediction['status'] = 'no_budget';
    let safeDailyBudget: number | null = null;
    let message: string;

    if (budget !== null) {
      projectedOverage = Math.max(0, Math.round((projectedTotal - budget) * 100) / 100);

      if (daysLeft > 0) {
        const remaining = Math.max(0, budget - spentSoFar);
        safeDailyBudget = Math.round((remaining / daysLeft) * 100) / 100;
      } else {
        safeDailyBudget = 0;
      }

      if (spentSoFar > budget) {
        status = 'over_budget';
        const overBy = Math.round((spentSoFar - budget) * 100) / 100;
        message = `Already $${overBy.toFixed(2)} over your $${budget.toFixed(2)} ${row.category} budget`;
      } else if (projectedTotal > budget * 1.1) {
        status = 'warning';
        message = `At this pace, you'll spend $${projectedTotal.toFixed(2)} on ${row.category} by month end — $${projectedOverage.toFixed(2)} over budget`;
      } else {
        status = 'on_track';
        message = `${row.category} spending is on track — $${spentSoFar.toFixed(2)} of $${budget.toFixed(2)} used`;
      }
    } else {
      message = `$${spentSoFar.toFixed(2)} spent on ${row.category} this month (no budget set)`;
    }

    return {
      category: row.category,
      spentSoFar,
      budget,
      projectedTotal,
      projectedOverage,
      daysLeft,
      dailyPace,
      safeDailyBudget,
      status,
      message,
    };
  });

  // Sort by projectedOverage descending (most over-budget first)
  predictions.sort((a, b) => b.projectedOverage - a.projectedOverage);

  const overBudgetCount = predictions.filter(
    p => p.status === 'over_budget' || p.status === 'warning'
  ).length;

  let overallMessage: string;
  if (overBudgetCount === 0) {
    overallMessage = 'All categories are within budget this month';
  } else if (overBudgetCount === 1) {
    overallMessage = '1 category is on pace to exceed budget';
  } else {
    overallMessage = `${overBudgetCount} categories are on pace to exceed budget`;
  }

  return {
    predictions,
    overallMessage,
    daysLeftInMonth: daysLeft,
    percentThroughMonth,
  };
}
