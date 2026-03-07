import type PgBoss from 'pg-boss';
import { logger } from '../utils/logger.js';
import { query } from '../config/database.js';
import { anthropic } from '../config/claude.js';

interface GenerateJobData {
  userId: string;
  generationId: string;
}

const BUDGET_SYSTEM_PROMPT = `You are a personal finance advisor AI. Analyze the user's spending data and create practical, achievable monthly budgets.

Rules:
- Base budgets on actual spending patterns with modest improvement targets (5-15% reduction in overspending areas)
- Always include a buffer/miscellaneous category
- Be realistic about fixed costs (rent, insurance) - don't suggest reducing those
- Explain your reasoning briefly for each budget
- Consider the user's income when setting total budget

Return valid JSON matching the exact schema requested.`;

export async function handleGenerateBudgets(job: PgBoss.Job<GenerateJobData>) {
  const { userId, generationId } = job.data;
  logger.info({ userId, generationId }, 'Starting AI budget generation');

  try {
    // Gather 3 months of spending data
    const spendingResult = await query(
      `SELECT
        COALESCE(personal_finance_category_primary, 'OTHER') as category,
        SUM(amount) as total,
        COUNT(*) as transaction_count,
        AVG(amount) as avg_amount
      FROM transactions
      WHERE user_id = $1
        AND date >= CURRENT_DATE - INTERVAL '3 months'
        AND amount > 0
      GROUP BY personal_finance_category_primary
      ORDER BY total DESC`,
      [userId]
    );

    // Detect income (negative amounts = credits/income in Plaid)
    const incomeResult = await query(
      `SELECT ABS(SUM(amount)) as total_income
      FROM transactions
      WHERE user_id = $1
        AND date >= CURRENT_DATE - INTERVAL '3 months'
        AND amount < 0
        AND personal_finance_category_primary IN ('INCOME', 'TRANSFER_IN')`,
      [userId]
    );

    // Get subscription costs
    const subsResult = await query(
      `SELECT SUM(estimated_amount) as monthly_sub_cost, COUNT(*) as sub_count
      FROM subscriptions
      WHERE user_id = $1 AND status IN ('detected', 'confirmed', 'safe')`,
      [userId]
    );

    const totalIncome3Mo = parseFloat(incomeResult.rows[0]?.total_income || '0');
    const monthlyIncome = totalIncome3Mo / 3;
    const monthlySubs = parseFloat(subsResult.rows[0]?.monthly_sub_cost || '0');

    const spendingData = spendingResult.rows.map((r) => ({
      category: r.category,
      total3Months: parseFloat(r.total),
      monthlyAvg: (parseFloat(r.total) / 3).toFixed(2),
      transactionCount: parseInt(r.transaction_count),
    }));

    const totalMonthlySpending = spendingData.reduce(
      (sum, s) => sum + parseFloat(s.monthlyAvg),
      0
    );

    const userMessage = `Here is my spending data for the last 3 months:

Monthly Income (estimated): $${monthlyIncome.toFixed(2)}
Total Monthly Spending (average): $${totalMonthlySpending.toFixed(2)}
Active Subscriptions: ${subsResult.rows[0]?.sub_count || 0} totaling $${monthlySubs.toFixed(2)}/month

Spending by Category (3-month totals):
${spendingData.map((s) => `- ${s.category}: $${s.total3Months.toFixed(2)} total ($${s.monthlyAvg}/mo, ${s.transactionCount} transactions)`).join('\n')}

Please create a monthly budget plan. For each category, provide:
- A realistic monthly limit
- Brief reasoning for that limit
- Your confidence level (0-1) in this recommendation
- Whether it represents a reduction, maintenance, or increase vs current spending`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 2048,
      system: BUDGET_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    // Parse Claude's response
    const responseText = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.type === 'text' ? c.text : '')
      .join('');

    // Extract JSON from response (Claude may wrap it in markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Claude response');
    }

    const budgetPlan = JSON.parse(jsonMatch[0]);

    // Get current month boundaries
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0];
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    // Create budget records
    const budgets = budgetPlan.budgets || [];
    for (const budget of budgets) {
      await query(
        `INSERT INTO budgets (
          user_id, name, category, amount_limit, period,
          period_start, period_end, is_ai_generated,
          ai_reasoning, ai_confidence
        ) VALUES ($1, $2, $3, $4, 'monthly', $5, $6, true, $7, $8)`,
        [
          userId,
          budget.name,
          budget.category,
          budget.amount_limit,
          periodStart,
          periodEnd,
          budget.reasoning,
          budget.confidence,
        ]
      );
    }

    // Update generation record
    await query(
      `UPDATE budget_generations SET
        status = 'completed',
        total_transactions_analyzed = $2,
        total_spending_analyzed = $3,
        claude_model_used = $4,
        claude_prompt_tokens = $5,
        claude_output_tokens = $6,
        raw_response = $7,
        budgets_created = $8
      WHERE id = $1`,
      [
        generationId,
        spendingResult.rows.reduce((sum, r) => sum + parseInt(r.transaction_count), 0),
        totalMonthlySpending * 3,
        'claude-sonnet-4-5-20250514',
        response.usage.input_tokens,
        response.usage.output_tokens,
        JSON.stringify(budgetPlan),
        budgets.length,
      ]
    );

    // Create notification
    await query(
      `INSERT INTO notifications (user_id, type, title, body, action_url)
      VALUES ($1, 'budget_generated', 'Your smart budget is ready!',
        'We analyzed your spending and created ${budgets.length} budget categories. Tap to review.',
        '/budgets')`,
      [userId]
    );

    logger.info({ userId, generationId, budgetsCreated: budgets.length }, 'Budget generation completed');
  } catch (error) {
    logger.error({ userId, generationId, error }, 'Budget generation failed');

    await query(
      `UPDATE budget_generations SET status = 'failed', error_message = $2 WHERE id = $1`,
      [generationId, error instanceof Error ? error.message : 'Unknown error']
    );

    throw error;
  }
}
