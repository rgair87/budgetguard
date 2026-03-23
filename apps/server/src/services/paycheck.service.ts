import db from '../config/db';
import { calculateRunway } from './runway.service';
import type { PaycheckPlan, SpendingCategory } from '@runway/shared';

function getPaychecksPerMonth(freq: string | null): number {
  switch (freq) {
    case 'weekly': return 52 / 12;        // 4.33
    case 'biweekly': return 26 / 12;      // 2.167
    case 'twice_monthly': return 2;
    case 'monthly': return 1;
    default: return 2;
  }
}

function getFrequencyLabel(freq: string | null): string {
  switch (freq) {
    case 'weekly': return 'weekly';
    case 'biweekly': return 'every 2 weeks';
    case 'twice_monthly': return 'twice a month';
    case 'monthly': return 'monthly';
    default: return 'per paycheck';
  }
}

// ========================================================
// SMART MERCHANT → CATEGORY DEFAULTS
// Auto-classifies ~80% of common merchants
// ========================================================
const DEFAULT_MERCHANT_MAP: Record<string, string> = {
  // Restaurants & Dining
  'chipotle': 'Restaurants', 'mcdonald': 'Restaurants', "mcdonald's": 'Restaurants',
  'chick-fil-a': 'Restaurants', 'taco bell': 'Restaurants', 'wendy': 'Restaurants',
  'burger king': 'Restaurants', 'subway': 'Restaurants', 'panera': 'Restaurants',
  'starbucks': 'Restaurants', 'dunkin': 'Restaurants', 'doordash': 'Restaurants',
  'uber eats': 'Restaurants', 'grubhub': 'Restaurants', 'pizza hut': 'Restaurants',
  'domino': 'Restaurants', 'olive garden': 'Restaurants', 'applebee': 'Restaurants',
  'panda express': 'Restaurants', 'popeye': 'Restaurants', 'five guys': 'Restaurants',
  'wingstop': 'Restaurants', 'chili': 'Restaurants', 'ihop': 'Restaurants',
  'waffle house': 'Restaurants', 'sonic': 'Restaurants', 'jack in the box': 'Restaurants',
  'raising cane': 'Restaurants', 'zaxby': 'Restaurants', 'cracker barrel': 'Restaurants',
  'instacart': 'Groceries',

  // Groceries
  'whole foods': 'Groceries', 'kroger': 'Groceries', 'walmart': 'Groceries',
  'aldi': 'Groceries', 'trader joe': 'Groceries', 'publix': 'Groceries',
  'safeway': 'Groceries', 'food lion': 'Groceries', 'heb': 'Groceries',
  'meijer': 'Groceries', 'costco': 'Groceries', 'sam\'s club': 'Groceries',
  'piggly wiggly': 'Groceries', 'winn-dixie': 'Groceries', 'stop & shop': 'Groceries',
  'giant': 'Groceries', 'wegmans': 'Groceries', 'sprouts': 'Groceries',

  // Shopping
  'target': 'Shopping', 'amazon': 'Shopping', 'dollar general': 'Shopping',
  'dollar tree': 'Shopping', 'family dollar': 'Shopping', 'marshalls': 'Shopping',
  'tjmaxx': 'Shopping', 'ross': 'Shopping', 'old navy': 'Shopping',
  'nike': 'Shopping', 'best buy': 'Shopping', 'home depot': 'Shopping',
  'lowes': 'Shopping', 'bath & body': 'Shopping', 'shein': 'Shopping',
  'temu': 'Shopping', 'etsy': 'Shopping', 'ebay': 'Shopping',
  'wish': 'Shopping', 'walgreens': 'Healthcare', 'cvs': 'Healthcare',

  // Entertainment
  'netflix': 'Entertainment', 'spotify': 'Entertainment', 'hulu': 'Entertainment',
  'disney+': 'Entertainment', 'disney plus': 'Entertainment', 'hbo': 'Entertainment',
  'apple tv': 'Entertainment', 'paramount': 'Entertainment', 'peacock': 'Entertainment',
  'youtube': 'Entertainment', 'twitch': 'Entertainment', 'xbox': 'Entertainment',
  'playstation': 'Entertainment', 'steam': 'Entertainment', 'nintendo': 'Entertainment',
  'amc': 'Entertainment', 'regal': 'Entertainment', 'cinemark': 'Entertainment',
  'spotify + hulu': 'Entertainment',

  // Transportation
  'shell': 'Transportation', 'bp': 'Transportation', 'chevron': 'Transportation',
  'exxon': 'Transportation', 'marathon': 'Transportation', 'circle k': 'Transportation',
  'wawa': 'Transportation', 'sheetz': 'Transportation', 'uber': 'Transportation',
  'lyft': 'Transportation', 'shell gas': 'Transportation',

  // Utilities / Bills (these are necessities + bills)
  'electric company': 'Utilities', 'water company': 'Utilities',
  'at&t': 'Utilities', 'verizon': 'Utilities', 't-mobile': 'Utilities',
  'comcast': 'Utilities', 'xfinity': 'Utilities', 'spectrum': 'Utilities',
  'cox': 'Utilities',

  // Housing
  'rent payment': 'Housing', 'mortgage': 'Housing',
};

// Categories that are necessities (can reduce but can't eliminate)
const NECESSITY_CATEGORIES = new Set([
  'Groceries', 'Transportation', 'Housing', 'Utilities',
  'Insurance', 'Healthcare', 'Phone', 'Internet',
  'Childcare', 'Medical', 'Pharmacy', 'Rent',
]);

// Categories that are discretionary (the "cuttable" ones)
const DISCRETIONARY_CATEGORIES = new Set([
  'Restaurants', 'Entertainment', 'Shopping', 'Subscriptions',
  'Personal Care', 'Travel', 'Hobbies', 'Clothing', 'Gifts',
]);

function classifyMerchant(merchantName: string, existingCategory: string | null, userId: string): string {
  const normalized = (merchantName || '').toLowerCase().replace(/\s+/g, ' ').trim();

  // 1. Check user's custom classifications first
  const userMapping = db.prepare(
    'SELECT category FROM merchant_categories WHERE user_id = ? AND merchant_pattern = ?'
  ).get(userId, normalized) as any;
  if (userMapping) return userMapping.category;

  // 2. Check our default merchant map (fuzzy: check if merchant starts with known key)
  for (const [key, category] of Object.entries(DEFAULT_MERCHANT_MAP)) {
    if (normalized.includes(key) || (normalized.length >= 4 && key.includes(normalized))) {
      return category;
    }
  }

  // 3. Fall back to existing transaction category if it exists
  if (existingCategory) return existingCategory;

  // 4. Unknown
  return 'Other';
}

function isNecessity(category: string): boolean {
  return NECESSITY_CATEGORIES.has(category);
}

export function getPaycheckPlan(userId: string): PaycheckPlan | null {
  const user = db.prepare(
    'SELECT pay_frequency, take_home_pay FROM users WHERE id = ?'
  ).get(userId) as any;

  if (!user?.take_home_pay) return null;

  const paycheckAmount = user.take_home_pay;
  const perMonth = getPaychecksPerMonth(user.pay_frequency);
  const monthlyIncome = paycheckAmount * perMonth;
  const frequency = getFrequencyLabel(user.pay_frequency);

  const runway = calculateRunway(userId);

  // === BILLS: recurring transactions from last 90 days → monthly amounts ===
  const recurringRows = db.prepare(
    `SELECT merchant_name, category, ABS(amount) as amount
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND is_recurring = 1
     AND date >= date('now', '-90 days')
     ORDER BY ABS(amount) DESC`
  ).all(userId) as any[];

  // Figure out how many months of data we actually have for recurring bills
  const recurringSpanRow = db.prepare(
    `SELECT MIN(date) as earliest FROM transactions
     WHERE user_id = ? AND amount < 0 AND is_recurring = 1 AND date >= date('now', '-90 days')`
  ).get(userId) as any;
  let recurringMonths = 3; // default to 3 months
  if (recurringSpanRow?.earliest) {
    const earliest = new Date(recurringSpanRow.earliest + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const daySpan = Math.max(1, Math.round((now.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    recurringMonths = Math.max(1, daySpan / 30);
  }

  // Group by normalized merchant, get total in data span
  const merchantTotals = new Map<string, { displayName: string; total: number }>();
  for (const row of recurringRows) {
    const raw = row.merchant_name || row.category || 'Other';
    const key = raw.toLowerCase().replace(/\s+/g, ' ').trim();
    const existing = merchantTotals.get(key) || { displayName: raw, total: 0 };
    existing.total += row.amount;
    merchantTotals.set(key, existing);
  }

  // Convert totals to monthly amounts using actual data span
  const billDetails: { name: string; amount: number }[] = [];
  let totalBillsMonthly = 0;

  for (const [, data] of merchantTotals) {
    const monthly = Math.round((data.total / recurringMonths) * 100) / 100;
    if (monthly >= 5) {
      billDetails.push({ name: data.displayName, amount: monthly });
      totalBillsMonthly += monthly;
    }
  }

  // Fallback: estimate from spending categories
  if (billDetails.length === 0) {
    const categorySpend = db.prepare(
      `SELECT category, SUM(ABS(amount)) as total
       FROM transactions
       WHERE user_id = ? AND amount < 0 AND date >= date('now', '-90 days')
       AND category IN ('Rent', 'Utilities', 'Insurance', 'Phone', 'Internet', 'Subscription')
       GROUP BY category
       ORDER BY total DESC`
    ).all(userId) as any[];

    for (const row of categorySpend) {
      const monthly = Math.round((row.total / 3) * 100) / 100;
      if (monthly >= 5) {
        billDetails.push({ name: row.category, amount: monthly });
        totalBillsMonthly += monthly;
      }
    }
  }

  // Merge in user-entered fixed expenses (from bills template)
  const fixedExpenses = db.prepare(
    `SELECT name, amount, frequency FROM fixed_expenses WHERE user_id = ?`
  ).all(userId) as any[];

  for (const fe of fixedExpenses) {
    const key = fe.name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (merchantTotals.has(key)) continue;
    let monthly = fe.amount;
    if (fe.frequency === 'weekly') monthly = fe.amount * 4.33;
    else if (fe.frequency === 'biweekly') monthly = fe.amount * 2.167;
    else if (fe.frequency === 'yearly' || fe.frequency === 'annual') monthly = fe.amount / 12;
    else if (fe.frequency === 'quarterly') monthly = fe.amount / 3;

    monthly = Math.round(monthly);
    if (monthly >= 5) {
      billDetails.push({ name: fe.name, amount: monthly });
      totalBillsMonthly += monthly;
    }
  }

  totalBillsMonthly = Math.round(totalBillsMonthly);

  // === DEBT: monthly minimum payments ===
  const debtAccounts = db.prepare(
    "SELECT name, current_balance, minimum_payment FROM accounts WHERE user_id = ? AND type IN ('credit', 'mortgage', 'auto_loan', 'student_loan', 'personal_loan') AND current_balance > 0"
  ).all(userId) as any[];

  const debtDetails: { name: string; amount: number }[] = [];
  let totalDebtMonthly = 0;

  for (const acct of debtAccounts) {
    const monthlyMin = acct.minimum_payment ?? Math.max(25, acct.current_balance * 0.02);
    const rounded = Math.round(monthlyMin);
    debtDetails.push({ name: acct.name, amount: rounded });
    totalDebtMonthly += rounded;
  }

  // === SAVINGS: based on runway status ===
  let savingsPercent: number;
  let savingsReason: string;

  if (runway.status === 'red') {
    savingsPercent = 0;
    savingsReason = 'Bills come first right now. Savings will come.';
  } else if (runway.status === 'yellow') {
    savingsPercent = 0.05;
    savingsReason = 'Starting small, every bit counts';
  } else {
    if (runway.totalDebt > 0) {
      savingsPercent = 0.10;
      savingsReason = 'Building your safety net';
    } else {
      savingsPercent = 0.20;
      savingsReason = 'Growing your cushion';
    }
  }

  const savingsMonthly = Math.round(monthlyIncome * savingsPercent);

  // === SPENDING: what's left ===
  const fixedCosts = totalBillsMonthly + totalDebtMonthly + savingsMonthly;
  const spendingMonthly = monthlyIncome - fixedCosts;
  const spendingWeekly = Math.round(spendingMonthly / 4.33);
  const spendingDaily = Math.round(spendingMonthly / 30);

  // === SHORTFALL CHECK ===
  const isShortfall = spendingMonthly < 0;
  const shortfallAmount = isShortfall ? Math.abs(spendingMonthly) : 0;

  // === BILLS COVERED? The #1 confidence signal ===
  const billsCovered = !isShortfall;
  const billsGap = isShortfall ? shortfallAmount : 0;

  // ============================================================
  // CATEGORY BREAKDOWN: Where does the spending money actually go?
  // ============================================================
  const nonRecurringRows = db.prepare(
    `SELECT merchant_name, category, ABS(amount) as amount
     FROM transactions
     WHERE user_id = ? AND amount < 0
     AND date >= date('now', '-90 days')
     AND is_recurring = 0
     ORDER BY ABS(amount) DESC`
  ).all(userId) as any[];

  // Classify each transaction and group by category
  const categoryTotals = new Map<string, number>();
  for (const row of nonRecurringRows) {
    const cat = classifyMerchant(row.merchant_name || '', row.category, userId);
    categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + row.amount);
  }

  // Get user budgets for comparison
  const budgets = db.prepare(
    'SELECT category, monthly_limit FROM budgets WHERE user_id = ?'
  ).all(userId) as any[];
  const budgetMap = new Map<string, number>();
  for (const b of budgets) {
    budgetMap.set(b.category, b.monthly_limit);
  }

  // Build SpendingCategory array
  const dailyBurn = runway.dailyBurnRate;
  const spendableBalance = runway.spendableBalance;
  const categories: SpendingCategory[] = [];
  let totalNecessities = 0;
  let totalDiscretionary = 0;

  for (const [catName, total90] of categoryTotals) {
    const monthlyAmount = Math.round((total90 / 3) * 100) / 100;
    if (monthlyAmount < 5) continue; // skip noise

    const budget = budgetMap.get(catName) || null;
    const necessity = isNecessity(catName);
    const isOverBudget = budget !== null && monthlyAmount > budget;

    // Runway impact: if you cut this category by 50%, how many days do you gain?
    // Must account for income — the real drain is (burn - income), not just burn
    const dailyIncome = monthlyIncome / 30;
    const halfSavings = monthlyAmount / 2;
    const dailySavings = halfSavings / 30;
    const netBurn = dailyBurn - dailyIncome;
    let runwayImpactDays = 0;
    if (netBurn > 0) {
      const currentRunwayDays = spendableBalance / netBurn;
      const newNetBurn = Math.max(0.1, netBurn - dailySavings);
      const newRunwayDays = spendableBalance / newNetBurn;
      runwayImpactDays = Math.round(Math.min(newRunwayDays - currentRunwayDays, 365));
    }

    categories.push({
      name: catName,
      monthlyAmount,
      budget,
      isNecessity: necessity,
      isOverBudget,
      runwayImpactDays: necessity ? 0 : runwayImpactDays, // only show impact for cuttable categories
    });

    if (necessity) {
      totalNecessities += monthlyAmount;
    } else {
      totalDiscretionary += monthlyAmount;
    }
  }

  // Sort: discretionary first (the cuttable stuff), then necessities; within each, by amount desc
  categories.sort((a, b) => {
    if (a.isNecessity !== b.isNecessity) return a.isNecessity ? 1 : -1;
    return b.monthlyAmount - a.monthlyAmount;
  });

  totalNecessities = Math.round(totalNecessities);
  totalDiscretionary = Math.round(totalDiscretionary);

  // === OVERSPENDING CHECK ===
  // Instead of comparing daily burn rate to daily income (which mixes bills),
  // compare actual discretionary spending to available spending money
  const actualTotalDiscretionaryAndNecessity = totalDiscretionary + totalNecessities;
  const availableForSpending = Math.max(0, spendingMonthly);
  const isOverspending = !isShortfall && actualTotalDiscretionaryAndNecessity > availableForSpending * 1.05;

  // === TOP CUT SUGGESTION ===
  // Find the discretionary category with highest runway impact
  const cuttableCategories = categories.filter(c => !c.isNecessity && c.runwayImpactDays > 0);
  let topCut: PaycheckPlan['topCut'] = null;
  if (cuttableCategories.length > 0) {
    const best = cuttableCategories.reduce((a, b) =>
      b.runwayImpactDays > a.runwayImpactDays ? b : a
    );
    topCut = {
      category: best.name,
      saveAmount: Math.round(best.monthlyAmount / 2),
      runwayGainDays: best.runwayImpactDays,
    };
  }

  // === SPENDING PACE ===
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const percentThroughMonth = Math.round((dayOfMonth / daysInMonth) * 100);

  // How much of their spending money have they used this month?
  const monthSpend = db.prepare(
    `SELECT COALESCE(SUM(ABS(amount)), 0) as total
     FROM transactions
     WHERE user_id = ? AND amount < 0 AND is_recurring = 0
     AND date >= date('now', 'start of month')`
  ).get(userId) as any;
  const spentThisMonth = monthSpend.total || 0;
  const percentBudgetUsed = availableForSpending > 0
    ? Math.round((spentThisMonth / availableForSpending) * 100)
    : 0;
  const paceOnTrack = percentBudgetUsed <= percentThroughMonth + 10; // 10% grace

  let paceMessage: string;
  if (availableForSpending <= 0) {
    paceMessage = "Let's focus on covering bills first.";
  } else if (percentBudgetUsed > percentThroughMonth + 25) {
    paceMessage = `You're ${percentThroughMonth}% through the month but ${percentBudgetUsed}% through your spending money. Time to slow down.`;
  } else if (percentBudgetUsed > percentThroughMonth + 10) {
    paceMessage = `Spending is a little ahead of pace. You have ${100 - percentBudgetUsed}% of your spending money left for ${100 - percentThroughMonth}% of the month.`;
  } else if (percentBudgetUsed < percentThroughMonth - 15) {
    paceMessage = `You're ahead of plan. Spending less than expected, nice work.`;
  } else {
    paceMessage = `Right on pace. Keep doing what you're doing.`;
  }

  // === WINS: celebrate progress ===
  const wins: string[] = [];

  // Win: any discretionary category under budget
  for (const cat of categories) {
    if (cat.budget && !cat.isNecessity && cat.monthlyAmount < cat.budget * 0.8) {
      wins.push(`You're under budget on ${cat.name}, saving $${Math.round(cat.budget - cat.monthlyAmount)}/mo.`);
    }
  }

  // Win: spending pace is good
  if (paceOnTrack && availableForSpending > 0 && percentThroughMonth > 20) {
    wins.push("Your spending pace is on track this month.");
  }

  // Win: bills covered
  if (billsCovered && totalBillsMonthly > 0) {
    wins.push("All your bills are covered by your income.");
  }

  // Win: has savings
  if (savingsMonthly > 0) {
    wins.push(`You're saving $${savingsMonthly}/mo. That adds up.`);
  }

  // Keep max 3 wins (most impactful)
  const topWins = wins.slice(0, 3);

  // === ADVICE ===
  let advice: string;
  if (isShortfall) {
    advice = `Your bills cost more than your income right now. Most people find $50-100/mo to cut. Let's look.`;
  } else if (isOverspending && totalDiscretionary > availableForSpending * 0.5) {
    const overBy = Math.round(actualTotalDiscretionaryAndNecessity - availableForSpending);
    advice = `You're spending about $${overBy}/mo more than your plan. Check the categories below, small cuts make a big difference.`;
  } else if (isOverspending) {
    advice = `Spending is a bit over plan. The categories below show where. Even small adjustments help.`;
  } else if (spendingMonthly < monthlyIncome * 0.05) {
    advice = `It's tight but you have a plan. Every dollar you free up goes straight to breathing room.`;
  } else if (runway.status === 'green' && runway.totalDebt === 0) {
    advice = `You're doing great. Real progress, keep going.`;
  } else if (runway.totalDebt > 0) {
    advice = `You're handling it. Once your safety net is set, extra cash knocks out debt faster than you'd think.`;
  } else {
    advice = `You've got a solid plan. Stick with it and watch your runway grow.`;
  }

  return {
    monthlyIncome,
    paycheckAmount,
    paycheckCount: perMonth,
    frequency,
    buckets: {
      bills: { amount: totalBillsMonthly, details: billDetails.sort((a, b) => b.amount - a.amount) },
      debt: { amount: totalDebtMonthly, details: debtDetails.sort((a, b) => b.amount - a.amount) },
      savings: { amount: savingsMonthly, reason: savingsReason },
      spending: {
        monthly: Math.max(0, spendingMonthly),
        weekly: Math.max(0, spendingWeekly),
        daily: Math.max(0, spendingDaily),
        categories,
        totalNecessities,
        totalDiscretionary,
      },
    },
    billsCovered,
    billsGap: Math.round(billsGap),
    spendingPace: {
      percentThroughMonth,
      percentBudgetUsed,
      onTrack: paceOnTrack,
      message: paceMessage,
    },
    wins: topWins,
    isOverspending,
    daysToPayday: runway.daysToPayday,
    isShortfall,
    shortfallAmount: Math.round(shortfallAmount),
    advice,
    topCut,
  };
}
