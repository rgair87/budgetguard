import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import { env } from '../config/env';
import db from '../config/db';
import { calculateRunway } from './runway.service';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

function getFinancialSnapshot(userId: string) {
  const runway = calculateRunway(userId);

  const accounts = db.prepare(
    'SELECT name, type, current_balance, available_balance FROM accounts WHERE user_id = ?'
  ).all(userId) as any[];

  const totalCCDebt = accounts
    .filter(a => a.type === 'credit')
    .reduce((sum, a) => sum + a.current_balance, 0);

  const user = db.prepare(
    'SELECT take_home_pay, pay_frequency, next_payday FROM users WHERE id = ?'
  ).get(userId) as any;

  const topCategories = db.prepare(
    `SELECT category, SUM(ABS(amount)) as total
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', 'start of month')
     GROUP BY category
     ORDER BY total DESC
     LIMIT 5`
  ).all(userId) as any[];

  const events = db.prepare(
    'SELECT name, estimated_amount, expected_date FROM incoming_events WHERE user_id = ?'
  ).all(userId) as any[];

  const monthlyIncome = user.take_home_pay
    ? user.pay_frequency === 'weekly' ? user.take_home_pay * 4
      : user.pay_frequency === 'biweekly' ? user.take_home_pay * 2
      : user.pay_frequency === 'twice_monthly' ? user.take_home_pay * 2
      : user.take_home_pay
    : 0;

  return {
    checking_balance: accounts.filter(a => a.type === 'checking').reduce((s, a) => s + (a.available_balance ?? a.current_balance), 0),
    savings_balance: accounts.filter(a => a.type === 'savings').reduce((s, a) => s + (a.available_balance ?? a.current_balance), 0),
    total_cc_debt: totalCCDebt,
    monthly_income: monthlyIncome,
    days_to_payday: runway.daysToPayday,
    spent_this_month: runway.spentThisMonth,
    remaining_budget: runway.remainingBudget,
    runway_amount: runway.amount,
    runway_status: runway.status,
    incoming_events: events,
    top_categories: topCategories,
  };
}

// Off-topic patterns that are clearly NOT financial — catch obvious abuse only
const OFF_TOPIC_PATTERNS = [
  /^(write|compose|create|generate)\s+(a |me )?(poem|story|song|essay|joke|code|script|program)/i,
  /^(tell me|what is|who is|explain)\s+(a joke|the meaning of life|quantum|evolution|history of)/i,
  /^(translate|convert)\s+.+\s+(to|into)\s+(spanish|french|german|japanese|chinese)/i,
  /^(play|sing|draw|paint|design)\s/i,
];

function isOffTopic(message: string): boolean {
  // Short messages or questions are almost always follow-ups — always allow
  if (message.trim().length < 20) return false;
  // Only block messages that are clearly unrelated creative/general tasks
  return OFF_TOPIC_PATTERNS.some(p => p.test(message.trim()));
}

const OFF_TOPIC_RESPONSE = "I'm built to help with your money — budgeting, spending, debt, savings, and your runway. Ask me anything about your finances and I'll give you a real answer using your actual data.";

export async function chat(userId: string, userMessage: string): Promise<string> {
  // Only block clearly off-topic requests (creative writing, translations, etc.)
  if (isOffTopic(userMessage)) {
    // Save both messages so the conversation history stays consistent
    db.prepare(
      `INSERT INTO chat_messages (id, user_id, role, content) VALUES (?, ?, 'user', ?)`
    ).run(crypto.randomUUID(), userId, userMessage);
    db.prepare(
      `INSERT INTO chat_messages (id, user_id, role, content) VALUES (?, ?, 'assistant', ?)`
    ).run(crypto.randomUUID(), userId, OFF_TOPIC_RESPONSE);
    return OFF_TOPIC_RESPONSE;
  }

  const snapshot = getFinancialSnapshot(userId);

  // Save user message
  db.prepare(
    `INSERT INTO chat_messages (id, user_id, role, content, context_snapshot)
     VALUES (?, ?, 'user', ?, ?)`
  ).run(crypto.randomUUID(), userId, userMessage, JSON.stringify(snapshot));

  // Get recent history, excluding off-topic exchanges so Claude doesn't echo the disclaimer
  const history = db.prepare(
    `SELECT role, content FROM chat_messages
     WHERE user_id = ? AND content != ? ORDER BY created_at DESC LIMIT 10`
  ).all(userId, OFF_TOPIC_RESPONSE) as any[];
  history.reverse();

  const systemPrompt = `You are Runway, a personal finance assistant. You have access to the user's real financial data. Always answer using their specific numbers. Never give generic advice.

User's current financial snapshot:
- Checking balance: $${snapshot.checking_balance.toFixed(2)}
- Savings balance: $${snapshot.savings_balance.toFixed(2)}
- Total credit card debt: $${snapshot.total_cc_debt.toFixed(2)}
- Monthly take-home: $${snapshot.monthly_income.toFixed(2)}
- Days until payday: ${snapshot.days_to_payday ?? 'unknown'}
- Amount spent this month: $${snapshot.spent_this_month.toFixed(2)}
- Remaining budget this month: $${snapshot.remaining_budget.toFixed(2)}
- Runway score: $${snapshot.runway_amount.toFixed(2)} (${snapshot.runway_status})
- Upcoming events: ${JSON.stringify(snapshot.incoming_events)}
- Top spending categories this month: ${JSON.stringify(snapshot.top_categories)}

Rules:
- Keep answers to 3-4 sentences maximum
- Always reference their real numbers
- Factor in incoming events when answering any question about available money
- End with one specific action when relevant
- Never say "I recommend consulting a financial advisor" for basic questions
- Speak plainly — no financial jargon`;

  const messages = history.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages,
  });

  const assistantMessage = response.content[0].type === 'text' ? response.content[0].text : '';

  // Save assistant message
  db.prepare(
    `INSERT INTO chat_messages (id, user_id, role, content)
     VALUES (?, ?, 'assistant', ?)`
  ).run(crypto.randomUUID(), userId, assistantMessage);

  return assistantMessage;
}

export function getChatHistory(userId: string) {
  return db.prepare(
    `SELECT id, role, content, created_at FROM chat_messages
     WHERE user_id = ? ORDER BY created_at ASC`
  ).all(userId);
}

export function clearChatHistory(userId: string) {
  db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(userId);
}
