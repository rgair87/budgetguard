import { query } from '../config/database.js';

export interface TransactionFilters {
  accountId?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  isRecurring?: boolean;
  page?: number;
  limit?: number;
}

export async function getTransactions(userId: string, filters: TransactionFilters = {}) {
  const {
    accountId,
    category,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    isRecurring,
    page = 1,
    limit = 50,
  } = filters;

  const conditions: string[] = ['t.user_id = $1'];
  const params: any[] = [userId];
  let paramIndex = 2;

  if (accountId) {
    conditions.push(`t.account_id = $${paramIndex}`);
    params.push(accountId);
    paramIndex++;
  }

  if (category) {
    conditions.push(`t.category = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }

  if (startDate) {
    conditions.push(`t.date >= $${paramIndex}`);
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    conditions.push(`t.date <= $${paramIndex}`);
    params.push(endDate);
    paramIndex++;
  }

  if (minAmount !== undefined) {
    conditions.push(`t.amount >= $${paramIndex}`);
    params.push(minAmount);
    paramIndex++;
  }

  if (maxAmount !== undefined) {
    conditions.push(`t.amount <= $${paramIndex}`);
    params.push(maxAmount);
    paramIndex++;
  }

  if (isRecurring !== undefined) {
    conditions.push(`t.is_recurring = $${paramIndex}`);
    params.push(isRecurring);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const offset = (page - 1) * limit;

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM transactions t WHERE ${whereClause}`,
    params
  );

  const total = parseInt(countResult.rows[0].count, 10);

  // Get paginated transactions
  const dataParams = [...params, limit, offset];
  const result = await query(
    `SELECT
       t.id, t.account_id, t.plaid_transaction_id,
       t.amount, t.iso_currency_code, t.date,
       t.name, t.merchant_name, t.category,
       t.pending, t.is_recurring, t.logo_url,
       t.created_at,
       a.name AS account_name, a.mask AS account_mask
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id
     WHERE ${whereClause}
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    dataParams
  );

  return {
    transactions: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getSummary(userId: string, startDate: string, endDate: string) {
  // Total spending by category
  const categoryResult = await query(
    `SELECT
       category,
       COUNT(*)::int AS transaction_count,
       SUM(amount) AS total,
       AVG(amount) AS average
     FROM transactions
     WHERE user_id = $1
       AND date >= $2
       AND date <= $3
       AND amount > 0
     GROUP BY category
     ORDER BY total DESC`,
    [userId, startDate, endDate]
  );

  // Overall totals
  const totalsResult = await query<{
    total_spending: string;
    total_income: string;
    transaction_count: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total_spending,
       COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS total_income,
       COUNT(*)::int AS transaction_count
     FROM transactions
     WHERE user_id = $1
       AND date >= $2
       AND date <= $3`,
    [userId, startDate, endDate]
  );

  // Monthly trend
  const trendResult = await query(
    `SELECT
       DATE_TRUNC('month', date)::date AS month,
       SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS spending,
       SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS income,
       COUNT(*)::int AS transaction_count
     FROM transactions
     WHERE user_id = $1
       AND date >= $2
       AND date <= $3
     GROUP BY DATE_TRUNC('month', date)
     ORDER BY month ASC`,
    [userId, startDate, endDate]
  );

  // Calculate number of months for averages
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months = Math.max(
    1,
    (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) + 1
  );

  const totals = totalsResult.rows[0];

  return {
    categories: categoryResult.rows.map((row) => ({
      category: row.category,
      transactionCount: row.transaction_count,
      total: parseFloat(row.total),
      average: parseFloat(row.average),
      avgPerMonth: parseFloat(row.total) / months,
    })),
    totals: {
      spending: parseFloat(totals.total_spending),
      income: parseFloat(totals.total_income),
      net: parseFloat(totals.total_income) - parseFloat(totals.total_spending),
      transactionCount: parseInt(totals.transaction_count, 10),
      avgMonthlySpending: parseFloat(totals.total_spending) / months,
      avgMonthlyIncome: parseFloat(totals.total_income) / months,
    },
    trend: trendResult.rows.map((row) => ({
      month: row.month,
      spending: parseFloat(row.spending),
      income: parseFloat(row.income),
      transactionCount: row.transaction_count,
    })),
  };
}

export async function search(
  userId: string,
  searchQuery: string,
  page: number = 1,
  limit: number = 50
) {
  const offset = (page - 1) * limit;
  const pattern = `%${searchQuery}%`;

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM transactions
     WHERE user_id = $1
       AND (name ILIKE $2 OR merchant_name ILIKE $2)`,
    [userId, pattern]
  );

  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    `SELECT
       t.id, t.account_id, t.plaid_transaction_id,
       t.amount, t.iso_currency_code, t.date,
       t.name, t.merchant_name, t.category,
       t.pending, t.is_recurring, t.logo_url,
       t.created_at,
       a.name AS account_name, a.mask AS account_mask
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id
     WHERE t.user_id = $1
       AND (t.name ILIKE $2 OR t.merchant_name ILIKE $2)
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT $3 OFFSET $4`,
    [userId, pattern, limit, offset]
  );

  return {
    transactions: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
