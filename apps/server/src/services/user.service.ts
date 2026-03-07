import { query } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export async function getDashboardSummary(userId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0];

  const [
    balanceResult,
    transactionResult,
    subscriptionResult,
    unreadResult,
    budgetResult,
    suggestionsResult,
  ] = await Promise.all([
    // Total balance from accounts
    query<{ total_balance: string }>(
      `SELECT COALESCE(SUM(current_balance), 0) AS total_balance
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    ),

    // Monthly spending and income from transactions
    query<{ total_spending: string; total_income: string }>(
      `SELECT
         COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total_spending,
         COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS total_income
       FROM transactions
       WHERE user_id = $1
         AND date >= $2
         AND date <= $3`,
      [userId, monthStart, monthEnd]
    ),

    // Active subscription count, cost, and unclassified count
    query<{ active_count: string; total_cost: string; unclassified_count: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status NOT IN ('dismissed', 'cancelled')) AS active_count,
         COALESCE(SUM(
           CASE
             WHEN status NOT IN ('dismissed', 'cancelled') AND frequency = 'weekly' THEN estimated_amount * 4.33
             WHEN status NOT IN ('dismissed', 'cancelled') AND frequency = 'biweekly' THEN estimated_amount * 2.17
             WHEN status NOT IN ('dismissed', 'cancelled') AND frequency = 'quarterly' THEN estimated_amount / 3.0
             WHEN status NOT IN ('dismissed', 'cancelled') AND frequency = 'semi-annual' THEN estimated_amount / 6.0
             WHEN status NOT IN ('dismissed', 'cancelled') AND frequency = 'annual' THEN estimated_amount / 12.0
             WHEN status NOT IN ('dismissed', 'cancelled') THEN estimated_amount
             ELSE 0
           END
         ), 0) AS total_cost,
         COUNT(*) FILTER (WHERE status = 'detected' AND classified_at IS NULL) AS unclassified_count
       FROM subscriptions
       WHERE user_id = $1`,
      [userId]
    ),

    // Unread notification count
    query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE user_id = $1 AND read_at IS NULL AND dismissed_at IS NULL`,
      [userId]
    ),

    // Active budget count and health (calculate avg percent used)
    query<{ active_count: string; avg_percent: string; max_percent: string }>(
      `SELECT
         COUNT(*) AS active_count,
         COALESCE(AVG(
           CASE WHEN b.amount_limit > 0
             THEN COALESCE(sub.spent, 0) / b.amount_limit * 100
             ELSE 0
           END
         ), 0) AS avg_percent,
         COALESCE(MAX(
           CASE WHEN b.amount_limit > 0
             THEN COALESCE(sub.spent, 0) / b.amount_limit * 100
             ELSE 0
           END
         ), 0) AS max_percent
       FROM budgets b
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(t.amount), 0) AS spent
         FROM transactions t
         WHERE t.user_id = b.user_id
           AND t.personal_finance_category_primary = b.category
           AND t.amount > 0
           AND t.date >= b.period_start
           AND t.date <= b.period_end
       ) sub ON true
       WHERE b.user_id = $1
         AND b.is_active = true
         AND b.period_start <= $2
         AND b.period_end >= $2`,
      [userId, now.toISOString().split('T')[0]]
    ),

    // Savings suggestions count (table may not exist for new installs)
    query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM spending_suggestions
       WHERE user_id = $1
         AND status IS DISTINCT FROM 'dismissed'`,
      [userId]
    ).catch(() => ({ rows: [{ count: '0' }] })),
  ]);

  const totalBalance = parseFloat(balanceResult.rows[0].total_balance);
  const monthlySpending = parseFloat(transactionResult.rows[0].total_spending);
  const monthlyIncome = parseFloat(transactionResult.rows[0].total_income);
  const activeSubscriptions = parseInt(subscriptionResult.rows[0].active_count, 10);
  const subscriptionsCost = parseFloat(subscriptionResult.rows[0].total_cost);
  const unclassifiedSubscriptions = parseInt(subscriptionResult.rows[0].unclassified_count, 10);
  const unreadNotifications = parseInt(unreadResult.rows[0].count, 10);
  const activeBudgets = parseInt(budgetResult.rows[0].active_count, 10);
  const avgBudgetPercent = parseFloat(budgetResult.rows[0].avg_percent);
  const maxBudgetPercent = parseFloat(budgetResult.rows[0].max_percent);
  const savingsSuggestions = parseInt(suggestionsResult.rows[0].count, 10);

  // Determine budget health
  let budgetHealth: 'good' | 'warning' | 'over';
  if (maxBudgetPercent >= 100) {
    budgetHealth = 'over';
  } else if (avgBudgetPercent >= 75 || maxBudgetPercent >= 90) {
    budgetHealth = 'warning';
  } else {
    budgetHealth = 'good';
  }

  return {
    totalBalance,
    monthlySpending,
    monthlyIncome,
    activeSubscriptions,
    subscriptionsCost,
    unclassifiedSubscriptions,
    activeBudgets,
    budgetHealth,
    unreadNotifications,
    savingsSuggestions,
  };
}

export async function getProfile(userId: string) {
  const result = await query(
    `SELECT
       id, email, first_name, last_name,
       notification_preferences,
       created_at, updated_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const user = result.rows[0];

  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    notificationPreferences: user.notification_preferences,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export async function updateProfile(
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }
) {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.firstName !== undefined) {
    setClauses.push(`first_name = $${paramIndex}`);
    params.push(data.firstName);
    paramIndex++;
  }

  if (data.lastName !== undefined) {
    setClauses.push(`last_name = $${paramIndex}`);
    params.push(data.lastName);
    paramIndex++;
  }

  if (data.email !== undefined) {
    setClauses.push(`email = $${paramIndex}`);
    params.push(data.email.toLowerCase().trim());
    paramIndex++;
  }

  if (params.length === 0) {
    return getProfile(userId);
  }

  params.push(userId);

  const result = await query(
    `UPDATE users SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, email, first_name, last_name,
       notification_preferences, created_at, updated_at`,
    params
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const user = result.rows[0];

  logger.info({ userId }, 'User profile updated');

  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    notificationPreferences: user.notification_preferences,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}
