import { query, transaction } from '../config/database.js';
import { anthropic } from '../config/claude.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type PgBoss from 'pg-boss';

let boss: PgBoss | null = null;

export function setBoss(pgBoss: PgBoss) {
  boss = pgBoss;
}

export async function getActive(userId: string) {
  const now = new Date();
  const result = await query(
    `SELECT
       b.id, b.user_id, b.name, b.category, b.amount_limit, b.amount_spent,
       b.period, b.period_start, b.period_end, b.is_ai_generated,
       b.user_adjusted, b.is_active,
       b.created_at, b.updated_at,
       COALESCE(SUM(
         CASE WHEN t.amount > 0 AND t.date >= b.period_start AND t.date <= b.period_end
         THEN t.amount ELSE 0 END
       ), 0) AS live_spent
     FROM budgets b
     LEFT JOIN transactions t
       ON t.user_id = b.user_id
       AND t.category = b.category
     WHERE b.user_id = $1
       AND b.is_active = true
       AND b.period_start <= $2
       AND b.period_end >= $2
     GROUP BY b.id
     ORDER BY b.amount_limit DESC`,
    [userId, now.toISOString().split('T')[0]]
  );

  return result.rows.map((row) => ({
    ...row,
    amount_spent: parseFloat(row.live_spent),
    remaining: parseFloat(row.amount_limit) - parseFloat(row.live_spent),
    percentUsed:
      parseFloat(row.amount_limit) > 0
        ? Math.round((parseFloat(row.live_spent) / parseFloat(row.amount_limit)) * 100)
        : 0,
  }));
}

export async function getById(userId: string, id: string) {
  const budgetResult = await query(
    `SELECT
       b.id, b.user_id, b.name, b.category, b.amount_limit, b.amount_spent,
       b.period, b.period_start, b.period_end, b.is_ai_generated,
       b.user_adjusted, b.is_active,
       b.created_at, b.updated_at
     FROM budgets b
     WHERE b.id = $1 AND b.user_id = $2`,
    [id, userId]
  );

  if (budgetResult.rows.length === 0) {
    throw new NotFoundError('Budget not found');
  }

  const budget = budgetResult.rows[0];

  const spendingResult = await query<{ spent: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS spent
     FROM transactions
     WHERE user_id = $1
       AND category = $2
       AND date >= $3
       AND date <= $4
       AND amount > 0`,
    [userId, budget.category, budget.period_start, budget.period_end]
  );

  const spent = parseFloat(spendingResult.rows[0].spent);

  return {
    ...budget,
    amount_spent: spent,
    remaining: parseFloat(budget.amount_limit) - spent,
    percentUsed:
      parseFloat(budget.amount_limit) > 0
        ? Math.round((spent / parseFloat(budget.amount_limit)) * 100)
        : 0,
  };
}

export async function create(
  userId: string,
  data: {
    name: string;
    category: string;
    amount_limit: number;
    period?: 'weekly' | 'biweekly' | 'monthly';
  }
) {
  const period = data.period || 'monthly';
  const { periodStart, periodEnd } = calculatePeriodDates(period);

  const result = await query(
    `INSERT INTO budgets (user_id, name, category, amount_limit, period, period_start, period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, data.name, data.category, data.amount_limit, period, periodStart, periodEnd]
  );

  logger.info({ userId, category: data.category, amount_limit: data.amount_limit }, 'Budget created');

  return result.rows[0];
}

export async function update(
  userId: string,
  id: string,
  data: {
    name?: string;
    amount_limit?: number;
    category?: string;
    period?: 'weekly' | 'biweekly' | 'monthly';
    is_active?: boolean;
  }
) {
  const existing = await query(
    'SELECT id FROM budgets WHERE id = $1 AND user_id = $2',
    [id, userId]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError('Budget not found');
  }

  const setClauses: string[] = ['user_adjusted = true', 'updated_at = NOW()'];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${paramIndex}`);
    params.push(data.name);
    paramIndex++;
  }

  if (data.amount_limit !== undefined) {
    setClauses.push(`amount_limit = $${paramIndex}`);
    params.push(data.amount_limit);
    paramIndex++;
  }

  if (data.category !== undefined) {
    setClauses.push(`category = $${paramIndex}`);
    params.push(data.category);
    paramIndex++;
  }

  if (data.is_active !== undefined) {
    setClauses.push(`is_active = $${paramIndex}`);
    params.push(data.is_active);
    paramIndex++;
  }

  if (data.period !== undefined) {
    const { periodStart, periodEnd } = calculatePeriodDates(data.period);
    setClauses.push(`period = $${paramIndex}`);
    params.push(data.period);
    paramIndex++;
    setClauses.push(`period_start = $${paramIndex}`);
    params.push(periodStart);
    paramIndex++;
    setClauses.push(`period_end = $${paramIndex}`);
    params.push(periodEnd);
    paramIndex++;
  }

  params.push(id, userId);

  const result = await query(
    `UPDATE budgets SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
     RETURNING *`,
    params
  );

  logger.info({ userId, budgetId: id }, 'Budget updated');

  return result.rows[0];
}

export async function deleteBudget(userId: string, id: string) {
  const result = await query(
    'DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Budget not found');
  }

  logger.info({ userId, budgetId: id }, 'Budget deleted');

  return { success: true };
}

export async function triggerGeneration(userId: string) {
  if (!boss) {
    throw new Error('Job queue not initialized');
  }

  // Create budget_generations record
  const genResult = await query<{ id: string }>(
    `INSERT INTO budget_generations (user_id, status)
     VALUES ($1, 'pending')
     RETURNING id`,
    [userId]
  );

  const generationId = genResult.rows[0].id;

  await boss.send('generate-budgets', { userId, generationId });

  logger.info({ userId, generationId }, 'Budget generation job enqueued');

  return { generationId };
}

export async function getGenerationHistory(userId: string) {
  const result = await query(
    `SELECT id, user_id, status, error_message, created_at, completed_at
     FROM budget_generations
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId]
  );

  return result.rows;
}

// -----------------------------------------------------------------------
// AI Budget Generation
// -----------------------------------------------------------------------

export async function generateBudget(userId: string, generationId: string) {
  try {
    // Update status to processing
    await query(
      `UPDATE budget_generations SET status = 'processing' WHERE id = $1`,
      [generationId]
    );

    // 1. Fetch 3 months of transactions, calculate spending summaries by category
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const spendingResult = await query<{
      category: string;
      total: string;
      avg_monthly: string;
      transaction_count: string;
      min_amount: string;
      max_amount: string;
    }>(
      `SELECT
         category,
         SUM(amount) AS total,
         SUM(amount) / 3.0 AS avg_monthly,
         COUNT(*)::int AS transaction_count,
         MIN(amount) AS min_amount,
         MAX(amount) AS max_amount
       FROM transactions
       WHERE user_id = $1
         AND date >= $2
         AND amount > 0
         AND category IS NOT NULL
       GROUP BY category
       ORDER BY total DESC`,
      [userId, threeMonthsAgo.toISOString().split('T')[0]]
    );

    // 2. Detect income from inflows (negative amounts in Plaid = income)
    const incomeResult = await query<{
      total_income: string;
      avg_monthly_income: string;
    }>(
      `SELECT
         COALESCE(SUM(ABS(amount)), 0) AS total_income,
         COALESCE(SUM(ABS(amount)) / 3.0, 0) AS avg_monthly_income
       FROM transactions
       WHERE user_id = $1
         AND date >= $2
         AND amount < 0`,
      [userId, threeMonthsAgo.toISOString().split('T')[0]]
    );

    const monthlyIncome = parseFloat(incomeResult.rows[0].avg_monthly_income);

    const spendingSummary = spendingResult.rows.map((row) => ({
      category: row.category,
      totalSpent: parseFloat(row.total),
      avgMonthly: parseFloat(row.avg_monthly),
      transactionCount: parseInt(row.transaction_count, 10),
      minAmount: parseFloat(row.min_amount),
      maxAmount: parseFloat(row.max_amount),
    }));

    if (spendingSummary.length === 0) {
      await query(
        `UPDATE budget_generations
         SET status = 'failed', error_message = 'Not enough transaction data to generate budgets', completed_at = NOW()
         WHERE id = $1`,
        [generationId]
      );
      return;
    }

    // 3. Build Claude prompt
    const prompt = `You are a personal finance budgeting assistant. Based on the user's spending data from the last 3 months, create a smart monthly budget.

Estimated monthly income: $${monthlyIncome.toFixed(2)}

Spending by category (last 3 months):
${spendingSummary.map((s) => `- ${s.category}: $${s.avgMonthly.toFixed(2)}/month avg (${s.transactionCount} transactions, range: $${s.minAmount.toFixed(2)} - $${s.maxAmount.toFixed(2)})`).join('\n')}

Total average monthly spending: $${spendingSummary.reduce((sum, s) => sum + s.avgMonthly, 0).toFixed(2)}

Create a realistic monthly budget. For each category:
1. Consider the user's actual spending patterns
2. Suggest a budget amount that's realistic but encourages slight improvement
3. Aim for total budgets to be at most 90% of income (to encourage saving)

Respond with ONLY a JSON object in this exact format:
{
  "budgets": [
    {
      "category": "CATEGORY_NAME",
      "amount": 123.45,
      "rationale": "Brief explanation for this budget amount"
    }
  ],
  "savingsTarget": 123.45,
  "summary": "Brief overall budget summary"
}`;

    // 4. Call Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    // 5. Parse response
    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract JSON from the response (handle potential markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse Claude response as JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      budgets: Array<{ category: string; amount: number; rationale: string }>;
      savingsTarget: number;
      summary: string;
    };

    // 6. Create budget records
    const { periodStart, periodEnd } = calculatePeriodDates('monthly');

    await transaction(async (client) => {
      for (const budget of parsed.budgets) {
        await client.query(
          `INSERT INTO budgets (
             user_id, name, category, amount_limit, period,
             period_start, period_end, is_ai_generated
           )
           VALUES ($1, $2, $3, $4, 'monthly', $5, $6, true)
           ON CONFLICT DO NOTHING`,
          [userId, budget.category, budget.category, budget.amount, periodStart, periodEnd]
        );
      }

      // 7. Update budget_generations record
      await client.query(
        `UPDATE budget_generations
         SET status = 'completed',
             result_summary = $1,
             completed_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            budgetCount: parsed.budgets.length,
            savingsTarget: parsed.savingsTarget,
            summary: parsed.summary,
          }),
          generationId,
        ]
      );

      // 8. Create notification
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body, action_url)
         VALUES ($1, 'budget_ready', $2, $3, $4)`,
        [
          userId,
          'Your smart budget is ready!',
          parsed.summary,
          '/budgets',
        ]
      );
    });

    logger.info(
      { userId, generationId, budgetCount: parsed.budgets.length },
      'Budget generation completed'
    );
  } catch (error) {
    logger.error({ userId, generationId, error }, 'Budget generation failed');

    await query(
      `UPDATE budget_generations
       SET status = 'failed',
           error_message = $1,
           completed_at = NOW()
       WHERE id = $2`,
      [error instanceof Error ? error.message : 'Unknown error', generationId]
    );

    throw error;
  }
}

// -----------------------------------------------------------------------
// AI Smart Suggestions (overspending detection)
// -----------------------------------------------------------------------

export async function getSmartSuggestions(userId: string) {
  // 1. Calculate monthly income vs spending for the current month
  const currentMonth = new Date();
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  const financialsResult = await query<{
    total_income: string;
    total_spending: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS total_income,
       COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total_spending
     FROM transactions
     WHERE user_id = $1
       AND date >= $2
       AND date <= $3`,
    [userId, monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]]
  );

  const income = parseFloat(financialsResult.rows[0].total_income);
  const spending = parseFloat(financialsResult.rows[0].total_spending);
  const savings = income - spending;
  const savingsRate = income > 0 ? savings / income : 0;

  // 2. If not overspending and savings >= 10% of income, return empty
  if (spending <= income && savingsRate >= 0.1) {
    return { suggestions: [], savingsRate, income, spending };
  }

  // Get spending breakdown for Claude analysis
  const categoryResult = await query(
    `SELECT
       category,
       SUM(amount) AS total,
       COUNT(*)::int AS transaction_count
     FROM transactions
     WHERE user_id = $1
       AND date >= $2
       AND date <= $3
       AND amount > 0
     GROUP BY category
     ORDER BY total DESC`,
    [userId, monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]]
  );

  // Get active subscriptions
  const subsResult = await query(
    `SELECT merchant_name, estimated_amount, frequency
     FROM subscriptions
     WHERE user_id = $1 AND status NOT IN ('dismissed', 'cancelled')
     ORDER BY estimated_amount DESC`,
    [userId]
  );

  // 3. Analyze with Claude
  const prompt = `You are a personal finance advisor. The user is ${spending > income ? 'spending more than they earn' : 'saving less than 10% of income'}.

Monthly Income: $${income.toFixed(2)}
Monthly Spending: $${spending.toFixed(2)}
Monthly Savings: $${savings.toFixed(2)} (${(savingsRate * 100).toFixed(1)}% savings rate)

Spending by category this month:
${categoryResult.rows.map((r) => `- ${r.category}: $${parseFloat(r.total).toFixed(2)} (${r.transaction_count} transactions)`).join('\n')}

Active subscriptions:
${subsResult.rows.map((r) => `- ${r.merchant_name}: $${parseFloat(r.estimated_amount).toFixed(2)}/${r.frequency}`).join('\n') || 'None detected'}

Provide 3-5 specific, actionable suggestions to reduce spending. For each suggestion, classify it as:
- "cut": completely eliminate this expense
- "swap": switch to a cheaper alternative
- "trim": reduce the amount spent

Respond with ONLY a JSON object:
{
  "suggestions": [
    {
      "type": "cut" | "swap" | "trim",
      "category": "CATEGORY_NAME",
      "title": "Short title",
      "description": "Specific actionable advice",
      "estimatedSavings": 123.45,
      "priority": 1
    }
  ]
}

Rank by estimated savings (highest priority = highest savings). Be specific and practical.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText =
    message.content[0].type === 'text' ? message.content[0].text : '';

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse Claude suggestions response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    suggestions: Array<{
      type: 'cut' | 'swap' | 'trim';
      category: string;
      title: string;
      description: string;
      estimatedSavings: number;
      priority: number;
    }>;
  };

  // 4. Store suggestions
  for (const suggestion of parsed.suggestions) {
    await query(
      `INSERT INTO spending_suggestions (
         user_id, type, category, title, description,
         estimated_savings, priority
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        suggestion.type,
        suggestion.category,
        suggestion.title,
        suggestion.description,
        suggestion.estimatedSavings,
        suggestion.priority,
      ]
    );
  }

  logger.info(
    { userId, suggestionCount: parsed.suggestions.length },
    'Smart suggestions generated'
  );

  // 5. Return suggestions
  return {
    suggestions: parsed.suggestions,
    savingsRate,
    income,
    spending,
  };
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function calculatePeriodDates(frequency: 'weekly' | 'biweekly' | 'monthly') {
  const now = new Date();
  let periodStart: string;
  let periodEnd: string;

  switch (frequency) {
    case 'weekly': {
      const dayOfWeek = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek); // Sunday start
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      periodStart = start.toISOString().split('T')[0];
      periodEnd = end.toISOString().split('T')[0];
      break;
    }
    case 'biweekly': {
      const dayOfWeek = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      const end = new Date(start);
      end.setDate(start.getDate() + 13);
      periodStart = start.toISOString().split('T')[0];
      periodEnd = end.toISOString().split('T')[0];
      break;
    }
    case 'monthly':
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      periodStart = start.toISOString().split('T')[0];
      periodEnd = end.toISOString().split('T')[0];
      break;
    }
  }

  return { periodStart, periodEnd };
}
