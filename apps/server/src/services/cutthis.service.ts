import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import db from '../config/db';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const CACHE_DAYS = 7;

interface CutRecommendation {
  emoji: string;
  title: string;
  detail: string;
  potentialSavings: number;
  actionSteps: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  timeToComplete: string | null;
}

export async function generateCutRecommendations(userId: string, forceRefresh = false): Promise<{ recommendations: CutRecommendation[]; cached: boolean; cachedAt: string | null }> {
  // Check cache first
  if (!forceRefresh) {
    const cached = db.prepare(
      `SELECT result, created_at FROM ai_cache
       WHERE user_id = ? AND cache_key = 'cut_this'
         AND created_at >= datetime('now', '-${CACHE_DAYS} days')`
    ).get(userId) as any;

    if (cached) {
      return { recommendations: JSON.parse(cached.result), cached: true, cachedAt: cached.created_at };
    }
  }

  // Gather spending data
  const subscriptions = db.prepare(
    `SELECT merchant_name, ABS(amount) as amount, date
     FROM transactions
     WHERE user_id = ? AND is_recurring = 1 AND amount < 0
     ORDER BY amount ASC`
  ).all(userId) as any[];

  const categorySpend = db.prepare(
    `SELECT category, COUNT(*) as count, SUM(ABS(amount)) as total, AVG(ABS(amount)) as avg_amount
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
     GROUP BY category
     ORDER BY total DESC`
  ).all(userId) as any[];

  const merchantSpend = db.prepare(
    `SELECT merchant_name, COUNT(*) as count, SUM(ABS(amount)) as total
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
     GROUP BY merchant_name
     ORDER BY total DESC
     LIMIT 15`
  ).all(userId) as any[];

  const longTermAvg = db.prepare(
    `SELECT category, AVG(monthly_total) as avg_monthly FROM (
       SELECT category, strftime('%Y-%m', date) as month, SUM(ABS(amount)) as monthly_total
       FROM transactions
       WHERE user_id = ? AND amount < 0 AND date >= date('now', '-180 days')
       GROUP BY category, month
     ) GROUP BY category`
  ).all(userId) as any[];

  const prompt = `Analyze this spending data and give exactly 3 specific, actionable recommendations to cut spending. Each should be concrete and reference real numbers. Look at long-term patterns, not just recent activity.

SUBSCRIPTIONS (recurring charges):
${JSON.stringify(subscriptions)}

SPENDING BY CATEGORY (last 90 days):
${JSON.stringify(categorySpend)}

TOP MERCHANTS (last 90 days):
${JSON.stringify(merchantSpend)}

6-MONTH AVERAGE BY CATEGORY:
${JSON.stringify(longTermAvg)}

Respond with a JSON array of exactly 3 objects, each with:
- emoji: a single relevant emoji
- title: a short headline (under 60 chars)
- detail: 2-3 sentences with specific numbers and actionable advice
- potentialSavings: estimated monthly dollar savings as a number
- actionSteps: a string with the EXACT steps to take. Be specific about what to do and how long it takes. Do NOT include phone numbers or URLs — those change frequently and could be wrong. Instead say "Log into your [merchant] account" or "Call [merchant] customer service". Examples: "Log into your Netflix account → downgrade to Basic ($6.99). Takes 2 minutes." or "Call your insurance company and ask for a loyalty discount. 10-min call." or "Delete DoorDash app from your phone and batch-cook meals on Sunday."
- difficulty: "easy", "medium", or "hard"
- timeToComplete: how long it takes (e.g. "2 minutes", "10 min phone call", "1 hour meal prep")

Focus on: unused/duplicate subscriptions, categories way above average, and high-frequency merchants. Be specific — use real merchant names and amounts from the data. Every recommendation MUST have concrete action steps a person can follow right now.

Respond ONLY with the JSON array, no other text.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
  let recommendations: CutRecommendation[];

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    recommendations = [
      {
        emoji: '💸',
        title: 'Review your subscriptions',
        detail: `You have ${subscriptions.length} recurring charges. Check if you're using all of them.`,
        potentialSavings: subscriptions.length > 0 ? subscriptions[0].amount : 0,
        actionSteps: 'Go to Settings → Recurring and review each subscription. Cancel any you haven\'t used in 30 days.',
        difficulty: 'easy' as const,
        timeToComplete: '10 minutes',
      },
      {
        emoji: '🍔',
        title: 'Restaurant spending is high',
        detail: `You've spent $${(categorySpend.find(c => c.category === 'Restaurants')?.total || 0).toFixed(2)} on dining recently.`,
        potentialSavings: 50,
        actionSteps: 'Meal prep on Sunday for the week. Delete food delivery apps from your phone.',
        difficulty: 'medium' as const,
        timeToComplete: '2 hours meal prep',
      },
      {
        emoji: '📦',
        title: 'Check your top merchant',
        detail: `${merchantSpend[0]?.merchant_name || 'Your top merchant'} accounts for $${(merchantSpend[0]?.total || 0).toFixed(2)} in spending.`,
        potentialSavings: 30,
        actionSteps: 'Set a monthly spending cap for this merchant. Remove saved payment methods to add friction.',
        difficulty: 'easy' as const,
        timeToComplete: '5 minutes',
      },
    ];
  }

  // Save to cache
  // Post-generation validation: cap savings to actual spending, strip fake URLs/phones
  const allMerchantAmounts = new Map(
    [...(subscriptions || []).map(s => [s.name?.toLowerCase(), s.amount] as const),
     ...(merchantSpend || []).map(m => [m.merchant_name?.toLowerCase(), m.total / 3] as const)]
  );

  for (const rec of recommendations) {
    // Cap savings to actual monthly spend on any mentioned merchant
    if (rec.potentialSavings > 0) {
      const maxPossible = Math.max(...[...allMerchantAmounts.values()].filter(v => v > 0), rec.potentialSavings);
      rec.potentialSavings = Math.min(rec.potentialSavings, maxPossible);
    }
    // Strip any hallucinated phone numbers (XXX-XXX-XXXX patterns)
    if (rec.actionSteps) {
      rec.actionSteps = rec.actionSteps.replace(/\d{1,2}-\d{3}-\d{3}-\d{4}/g, '[call customer service]');
      rec.actionSteps = rec.actionSteps.replace(/1-\d{3}-\d{3}-\d{4}/g, '[call customer service]');
    }
  }

  db.prepare(
    `INSERT OR REPLACE INTO ai_cache (id, user_id, cache_key, result, created_at)
     VALUES (?, ?, 'cut_this', ?, datetime('now'))`
  ).run(crypto.randomUUID(), userId, JSON.stringify(recommendations));

  return { recommendations, cached: false, cachedAt: null };
}
