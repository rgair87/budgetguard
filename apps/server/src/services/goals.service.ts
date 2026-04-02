import db from '../config/db';
import { randomUUID } from 'crypto';

// Create table at module load
db.exec(`CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL NOT NULL DEFAULT 0,
  deadline TEXT,
  icon TEXT DEFAULT '🎯',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  icon: string;
  created_at: string;
  percent: number;
  remaining: number;
  onTrack: boolean | null;
  dailyNeeded: number | null;
  daysLeft: number | null;
}

interface GoalRow {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  icon: string;
  created_at: string;
}

function enrich(row: GoalRow): Goal {
  const remaining = Math.max(0, row.target_amount - row.current_amount);
  const percent = row.target_amount > 0
    ? Math.min(100, Math.round((row.current_amount / row.target_amount) * 100))
    : 0;

  let onTrack: boolean | null = null;
  let dailyNeeded: number | null = null;
  let daysLeft: number | null = null;

  if (row.deadline) {
    const now = new Date();
    const deadline = new Date(row.deadline);
    const msLeft = deadline.getTime() - now.getTime();
    daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    dailyNeeded = daysLeft > 0 ? remaining / daysLeft : remaining > 0 ? Infinity : 0;
    // Check if the required daily savings rate is realistic:
    // Compare progress so far against where they should be by now
    const totalDuration = deadline.getTime() - new Date(row.created_at).getTime();
    const elapsed = now.getTime() - new Date(row.created_at).getTime();
    if (remaining === 0) {
      onTrack = true;
    } else if (daysLeft <= 0) {
      onTrack = false; // deadline passed and not complete
    } else if (totalDuration > 0 && elapsed > 0) {
      const expectedProgress = (elapsed / totalDuration) * row.target_amount;
      // On track if actual progress is at least 80% of expected progress
      onTrack = row.current_amount >= expectedProgress * 0.8;
    } else {
      onTrack = true; // just created, give benefit of the doubt
    }
  }

  return { ...row, percent, remaining, onTrack, dailyNeeded, daysLeft };
}

export function getGoals(userId: string): Goal[] {
  const rows = db.prepare(
    `SELECT * FROM savings_goals WHERE user_id = ?
     ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC`
  ).all(userId) as unknown as GoalRow[];
  return rows.map(enrich);
}

export function createGoal(
  userId: string,
  data: { name: string; target_amount: number; current_amount?: number; deadline?: string; icon?: string }
): Goal {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO savings_goals (id, user_id, name, target_amount, current_amount, deadline, icon)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, data.name, data.target_amount, data.current_amount ?? 0, data.deadline ?? null, data.icon ?? '🎯');

  const row = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(id) as unknown as GoalRow;
  return enrich(row);
}

export function updateGoal(
  userId: string,
  goalId: string,
  data: Partial<{ name: string; target_amount: number; current_amount: number; deadline: string; icon: string }>
): Goal {
  const existing = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?').get(goalId, userId) as unknown as GoalRow | undefined;
  if (!existing) throw new NotFoundError('Goal not found');

  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length > 0) {
    values.push(goalId, userId);
    db.prepare(`UPDATE savings_goals SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  }

  const row = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(goalId) as unknown as GoalRow;
  return enrich(row);
}

export function deleteGoal(userId: string, goalId: string): void {
  const result = db.prepare('DELETE FROM savings_goals WHERE id = ? AND user_id = ?').run(goalId, userId);
  if (result.changes === 0) throw new NotFoundError('Goal not found');
}

export function addToGoal(userId: string, goalId: string, amount: number): Goal {
  const existing = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?').get(goalId, userId) as unknown as GoalRow | undefined;
  if (!existing) throw new NotFoundError('Goal not found');

  db.prepare('UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = ? AND user_id = ?').run(amount, goalId, userId);

  const row = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(goalId) as unknown as GoalRow;
  return enrich(row);
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// ─── Smart Goal Insights ──────────────────────────────────────

export interface GoalInsight {
  type: 'strategy' | 'tip' | 'milestone' | 'boost';
  title: string;
  body: string;
}

type GoalCategory = 'house' | 'car' | 'emergency' | 'vacation' | 'education' | 'debt_free' | 'general';

function detectGoalCategory(name: string, icon: string): GoalCategory {
  const n = name.toLowerCase();
  if (icon === 'home' || /\b(house|home|down\s*payment|mortgage|condo|apartment)\b/.test(n)) return 'house';
  if (icon === 'car' || /\b(car|vehicle|auto|truck|suv)\b/.test(n)) return 'car';
  if (icon === 'shield' || icon === 'piggybank' || /\b(emergency|rainy\s*day|safety\s*net|6\s*month)\b/.test(n)) return 'emergency';
  if (icon === 'plane' || icon === 'palmtree' || /\b(vacation|travel|trip|holiday|cruise|flight)\b/.test(n)) return 'vacation';
  if (icon === 'graduation' || /\b(college|school|tuition|education|student|degree|course)\b/.test(n)) return 'education';
  if (/\b(debt\s*free|pay\s*off|loan|credit\s*card)\b/.test(n)) return 'debt_free';
  return 'general';
}

/** Generate smart, actionable insights for a single goal based on user's financial context. */
export function generateGoalInsights(userId: string, goal: Goal): GoalInsight[] {
  const insights: GoalInsight[] = [];
  const category = detectGoalCategory(goal.name, goal.icon);

  // Pull user financial context
  const user = db.prepare('SELECT take_home_pay, pay_frequency FROM users WHERE id = ?').get(userId) as any;
  const monthlyIncome = user?.take_home_pay
    ? (user.pay_frequency === 'biweekly' ? user.take_home_pay * 26 / 12
       : user.pay_frequency === 'weekly' ? user.take_home_pay * 52 / 12
       : user.take_home_pay)
    : 0;

  const spendRow = db.prepare(
    `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transactions
     WHERE user_id = ? AND amount < 0 AND date >= date('now', '-30 days')`
  ).get(userId) as any;
  const monthlySpend = spendRow?.total ?? 0;
  const monthlySurplus = monthlyIncome > 0 ? monthlyIncome - monthlySpend : 0;

  const debtRow = db.prepare(
    `SELECT COALESCE(SUM(current_balance), 0) as total FROM accounts
     WHERE user_id = ? AND type IN ('credit', 'auto_loan', 'student_loan', 'personal_loan')`
  ).get(userId) as any;
  const totalDebt = debtRow?.total ?? 0;

  const { remaining, percent, daysLeft, dailyNeeded } = goal;

  // ── Milestone celebrations ──
  if (percent >= 75 && percent < 100) {
    insights.push({ type: 'milestone', title: 'Almost there!', body: `You're ${percent}% of the way to your goal. Only $${Math.round(remaining).toLocaleString()} left to go.` });
  } else if (percent >= 50 && percent < 75) {
    insights.push({ type: 'milestone', title: 'Halfway mark', body: `You've passed the halfway point. The momentum is on your side now.` });
  } else if (percent >= 25 && percent < 50) {
    insights.push({ type: 'milestone', title: 'Building momentum', body: `You've saved a quarter of your goal. Keep the habit going.` });
  }

  // ── Savings pace strategies ──
  const monthlyNeeded = dailyNeeded ? dailyNeeded * 30 : remaining > 0 ? remaining / 12 : 0;
  const weeklyNeeded = monthlyNeeded / 4.33;

  if (remaining > 0 && monthlyNeeded > 0) {
    if (monthlySurplus > 0 && monthlyNeeded <= monthlySurplus * 0.5) {
      insights.push({
        type: 'strategy',
        title: 'This fits your budget',
        body: `You'd need to save about $${Math.round(monthlyNeeded)}/mo ($${Math.round(weeklyNeeded)}/wk). That's ${Math.round((monthlyNeeded / monthlySurplus) * 100)}% of your current monthly surplus, which is very doable.`,
      });
    } else if (monthlySurplus > 0 && monthlyNeeded <= monthlySurplus) {
      insights.push({
        type: 'strategy',
        title: 'Tight but possible',
        body: `You'd need about $${Math.round(monthlyNeeded)}/mo, which is ${Math.round((monthlyNeeded / monthlySurplus) * 100)}% of your surplus. Consider cutting a subscription or two to stay comfortable.`,
      });
    } else if (monthlySurplus > 0 && monthlyNeeded > monthlySurplus) {
      insights.push({
        type: 'strategy',
        title: 'Stretch goal',
        body: `At $${Math.round(monthlyNeeded)}/mo needed, this exceeds your current $${Math.round(monthlySurplus)}/mo surplus. You might need extra income or a longer timeline.`,
      });
    } else if (monthlyIncome > 0) {
      insights.push({
        type: 'strategy',
        title: 'Find room in your budget',
        body: `Try to set aside $${Math.round(weeklyNeeded)}/wk toward this goal. Automate a transfer on payday so you don't have to think about it.`,
      });
    }
  }

  // ── Category-specific advice ──
  switch (category) {
    case 'house': {
      insights.push({
        type: 'tip',
        title: 'Down payment strategies',
        body: goal.target_amount >= 20000
          ? 'Look into FHA loans (3.5% down) if 20% feels out of reach. Also check your state\'s first-time homebuyer programs for grants or down payment assistance.'
          : 'For smaller down payments, consider an FHA loan. Some lenders offer 3% conventional loans for first-time buyers too.',
      });
      if (remaining > 10000) {
        insights.push({
          type: 'tip',
          title: 'Where to park your down payment',
          body: 'Keep your down payment in a high-yield savings account (HYSA) earning 4-5% APY. Avoid investing it in stocks if you plan to buy within 2-3 years.',
        });
      }
      if (totalDebt > 0) {
        insights.push({
          type: 'tip',
          title: 'Improve your mortgage rate',
          body: `Paying down your $${Math.round(totalDebt).toLocaleString()} in debt could improve your credit score, potentially saving you tens of thousands in mortgage interest.`,
        });
      }
      break;
    }
    case 'car': {
      insights.push({
        type: 'tip',
        title: 'Buying strategy',
        body: goal.target_amount >= 15000
          ? 'Consider a certified pre-owned (CPO) vehicle. You get a near-new car with warranty at 20-30% less. Put 20% down to avoid being underwater on the loan.'
          : 'With a smaller budget, look at 2-3 year old used cars with low mileage. Pay cash if possible to avoid interest and keep monthly costs lower.',
      });
      if (remaining > 5000) {
        insights.push({
          type: 'boost',
          title: 'Accelerate with your old car',
          body: 'If you have a trade-in, check KBB and get quotes from CarMax/Carvana first. Private sale typically gets you 15-20% more than dealer trade-in.',
        });
      }
      break;
    }
    case 'emergency': {
      const monthsOfExpenses = monthlySpend > 0 ? goal.target_amount / monthlySpend : 0;
      insights.push({
        type: 'tip',
        title: 'Right-size your fund',
        body: monthsOfExpenses >= 3
          ? `Your target covers about ${monthsOfExpenses.toFixed(1)} months of expenses, which is solid. Most experts recommend 3-6 months.`
          : `Your target covers about ${monthsOfExpenses.toFixed(1)} months of expenses. Try to aim for at least 3 months ($${Math.round(monthlySpend * 3).toLocaleString()}) as a starting point.`,
      });
      insights.push({
        type: 'tip',
        title: 'Keep it liquid',
        body: 'Put your emergency fund in a high-yield savings account (HYSA). You need instant access, but there\'s no reason not to earn 4-5% APY while it sits.',
      });
      break;
    }
    case 'vacation': {
      insights.push({
        type: 'tip',
        title: 'Travel hacks',
        body: 'Book flights 6-8 weeks out for the best prices. Use Google Flights price alerts. Consider a travel credit card to earn points toward your trip.',
      });
      if (daysLeft && daysLeft > 60 && remaining > 500) {
        insights.push({
          type: 'boost',
          title: 'Side hustle sprint',
          body: `With ${daysLeft} days to go, earning an extra $${Math.round(remaining / (daysLeft / 30))}/mo from a side gig would cover the gap entirely.`,
        });
      }
      break;
    }
    case 'education': {
      insights.push({
        type: 'tip',
        title: 'Reduce the cost first',
        body: 'Apply for every scholarship you qualify for, no matter how small. Check if your employer offers tuition reimbursement. FAFSA is a must even if you think you won\'t qualify.',
      });
      if (goal.target_amount >= 10000) {
        insights.push({
          type: 'tip',
          title: 'Consider a 529 plan',
          body: '529 plans grow tax-free for education expenses. Some states offer tax deductions on contributions too. Even short-term, the tax benefits help.',
        });
      }
      break;
    }
    case 'debt_free': {
      if (totalDebt > 0) {
        insights.push({
          type: 'strategy',
          title: 'Attack high-interest first',
          body: 'List your debts by interest rate. Pay minimums on everything except the highest-rate debt. Throw every extra dollar at that one until it\'s gone.',
        });
      }
      insights.push({
        type: 'tip',
        title: 'Negotiate your rates',
        body: 'Call your credit card company and ask for a lower APR. If you have good payment history, many will drop 2-5% just for asking. That saves hundreds in interest.',
      });
      break;
    }
    default: {
      // General goal tips
      if (remaining > 0 && !goal.deadline) {
        insights.push({
          type: 'tip',
          title: 'Set a target date',
          body: 'Goals with deadlines are 3x more likely to be reached. Even a rough target date helps you plan your monthly savings amount.',
        });
      }
      if (remaining > 1000) {
        insights.push({
          type: 'tip',
          title: 'Automate your savings',
          body: 'Set up an automatic transfer on payday. Even $25/wk adds up to $1,300/year. You won\'t miss money you never see in your checking account.',
        });
      }
      break;
    }
  }

  // ── Boost ideas (applicable to all goals) ──
  if (remaining > 500 && percent < 50) {
    insights.push({
      type: 'boost',
      title: 'Quick wins to boost savings',
      body: 'Cancel unused subscriptions, sell things you don\'t use, do a no-spend weekend, or switch to a cheaper phone plan. Small wins compound fast.',
    });
  }

  // ── Behind pace warning with action ──
  if (goal.onTrack === false && daysLeft && daysLeft > 0) {
    // Calculate how far behind: compare where they should be vs where they are
    const totalDuration = new Date(goal.deadline!).getTime() - new Date(goal.created_at).getTime();
    const elapsed = Date.now() - new Date(goal.created_at).getTime();
    const expectedSaved = totalDuration > 0 ? (elapsed / totalDuration) * goal.target_amount : 0;
    const behindBy = Math.round(Math.max(0, expectedSaved - goal.current_amount));
    const catchUpWeekly = Math.round((dailyNeeded ?? 0) * 7);
    const extraDaysNeeded = monthlySurplus > 0 ? Math.round((remaining / monthlySurplus) * 30) - daysLeft : 0;
    insights.push({
      type: 'strategy',
      title: 'Getting back on track',
      body: `You're about $${behindBy.toLocaleString()} behind where you should be. To catch up, try saving $${catchUpWeekly}/wk${extraDaysNeeded > 0 ? `, or extend your deadline by about ${extraDaysNeeded} days` : ''}.`,
    });
  }

  // Limit to top 4 most relevant
  return insights.slice(0, 4);
}

/** Generate insights for all goals at once. Returns a map of goalId -> insights. */
export function getGoalInsights(userId: string): Record<string, GoalInsight[]> {
  const goals = getGoals(userId);
  const result: Record<string, GoalInsight[]> = {};
  for (const goal of goals) {
    result[goal.id] = generateGoalInsights(userId, goal);
  }
  return result;
}
