import db from '../config/db';

export interface NegotiationSuggestion {
  id: string;
  billName: string;
  currentAmount: number;
  estimatedSavings: { low: number; high: number };
  annualSavings: { low: number; high: number };
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'call_to_negotiate' | 'switch_provider' | 'cancel_downgrade' | 'rate_reduction';
  script: string;
  tips: string[];
  phoneNumber: string | null;
  bestTimeToCall: string | null;
  successRate: string;
}

interface NegotiableCategory {
  patterns: string[];
  type: 'call_to_negotiate' | 'switch_provider' | 'cancel_downgrade' | 'rate_reduction';
  savingsPercent: { low: number; high: number };
  difficulty: 'easy' | 'medium' | 'hard';
  script: string;
  tips: string[];
  successRate: string;
  bestTimeToCall: string | null;
}

const PHONE_NUMBERS: Record<string, string> = {
  comcast: '1-800-934-6489',
  xfinity: '1-800-934-6489',
  spectrum: '1-833-267-6094',
  'at&t': '1-800-288-2020',
  att: '1-800-288-2020',
  verizon: '1-800-922-0204',
  tmobile: '1-800-937-8997',
  't-mobile': '1-800-937-8997',
  geico: '1-800-207-7847',
  'state farm': '1-800-782-8332',
  progressive: '1-800-776-4737',
};

const ONLINE_ONLY = new Set(['netflix', 'spotify', 'hulu', 'disney', 'hbo', 'max', 'paramount', 'apple tv', 'peacock', 'amazon prime', 'youtube']);

const NEGOTIABLE_BILLS: NegotiableCategory[] = [
  {
    patterns: ['comcast', 'xfinity', 'spectrum', 'att', 'at&t', 'verizon', 'tmobile', 't-mobile', 'cox', 'centurylink', 'frontier', 'optimum'],
    type: 'call_to_negotiate',
    savingsPercent: { low: 10, high: 30 },
    difficulty: 'medium',
    script: "Hi, I'm calling because I noticed my bill has gone up recently. I've been a loyal customer for [X years], and I was wondering if there are any promotions or discounts available for existing customers. I've been looking at [competitor] and they're offering [lower price]. I'd prefer to stay with you, but I need the price to make sense. Can you transfer me to your retention department?",
    tips: [
      'Call early morning (7-9 AM) for shorter wait times',
      'Ask to be transferred to the retention department',
      'Mention competitor offers',
      'Be polite but firm — they have authority to discount 15-30%',
      "If the first rep can't help, politely ask for a supervisor",
    ],
    successRate: '73% success rate',
    bestTimeToCall: 'Tuesday-Thursday, 7-9 AM',
  },
  {
    patterns: ['geico', 'state farm', 'allstate', 'progressive', 'usaa', 'liberty mutual', 'farmers', 'nationwide'],
    type: 'call_to_negotiate',
    savingsPercent: { low: 5, high: 25 },
    difficulty: 'medium',
    script: "Hi, I'd like to review my policy and see if there are any discounts I might be missing. I've gotten quotes from other companies that are lower. Can we review my coverages and see if there's a way to bring my premium down? I'm also wondering about bundling discounts, safe driver discounts, or loyalty discounts.",
    tips: [
      'Get 2-3 competitor quotes before calling',
      'Ask about all available discounts (multi-policy, safe driver, low mileage)',
      'Consider raising your deductible to lower premiums',
      'Ask about paying annually vs monthly to save',
    ],
    successRate: '65% success rate',
    bestTimeToCall: null,
  },
  {
    patterns: ['netflix', 'hulu', 'spotify', 'youtube', 'disney', 'hbo', 'max', 'paramount', 'apple tv', 'peacock', 'amazon prime'],
    type: 'cancel_downgrade',
    savingsPercent: { low: 20, high: 100 },
    difficulty: 'easy',
    script: "Go to account settings → cancel subscription. Most streaming services will offer a discounted rate or free months when you try to cancel. If they don't, cancel and wait — they often send win-back offers within 1-2 weeks at 25-50% off.",
    tips: [
      'Start the cancellation process online — many services offer retention deals',
      'If no deal offered, actually cancel and wait for a win-back email',
      'Consider rotating services instead of paying for all simultaneously',
      'Check if your phone/internet plan includes any free subscriptions',
    ],
    successRate: '80% success rate',
    bestTimeToCall: null,
  },
  {
    patterns: ['chase', 'capital one', 'citi', 'amex', 'american express', 'discover', 'wells fargo', 'bank of america'],
    type: 'rate_reduction',
    savingsPercent: { low: 15, high: 40 },
    difficulty: 'medium',
    script: "Hi, I'd like to request a lower APR on my credit card. I've been a customer for [X years] and I have a good payment history. I've received offers from other cards at much lower rates. Would you be able to lower my rate?",
    tips: [
      'Have your current APR and a competitor offer ready',
      'Mention your positive payment history',
      "If denied, ask 'Is there anything else you can do?'",
      'Try again in 3-6 months if denied — each call is independent',
    ],
    successRate: '56% success rate',
    bestTimeToCall: 'Monday-Wednesday morning',
  },
  {
    patterns: ['planet fitness', 'la fitness', '24 hour fitness', 'anytime fitness', 'equinox', 'crunch', 'gold gym', 'ymca'],
    type: 'call_to_negotiate',
    savingsPercent: { low: 10, high: 30 },
    difficulty: 'easy',
    script: "Hi, I'm considering my membership options. I've been a member for a while and I'm looking at whether I should continue or try a different gym. Are there any promotions or loyalty discounts available?",
    tips: [
      'Best time to negotiate is January (they want to keep members) or summer (slow season)',
      'Ask about annual payment discount',
      'Mention competitor prices',
      'If cancelling, they often offer 1-3 months free',
    ],
    successRate: '60% success rate',
    bestTimeToCall: null,
  },
];

function findMatchingCategory(name: string): { category: NegotiableCategory; matchedPattern: string } | null {
  const lower = name.toLowerCase();
  for (const category of NEGOTIABLE_BILLS) {
    for (const pattern of category.patterns) {
      if (lower.includes(pattern)) {
        return { category, matchedPattern: pattern };
      }
    }
  }
  return null;
}

function lookupPhoneNumber(matchedPattern: string): string | null {
  if (ONLINE_ONLY.has(matchedPattern)) return null;
  return PHONE_NUMBERS[matchedPattern] ?? null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getNegotiationSuggestions(userId: string): NegotiationSuggestion[] {
  const suggestions: NegotiationSuggestion[] = [];
  const seen = new Set<string>();

  // 1. Recurring transactions
  const recurringTxns = db.prepare(`
    SELECT merchant_name, ABS(amount) as amount
    FROM transactions
    WHERE user_id = ? AND is_recurring = 1 AND amount < 0
    GROUP BY LOWER(merchant_name)
    ORDER BY ABS(amount) DESC
  `).all(userId) as unknown as { merchant_name: string; amount: number }[];

  for (const txn of recurringTxns) {
    const match = findMatchingCategory(txn.merchant_name);
    if (!match) continue;
    const key = match.matchedPattern;
    if (seen.has(key)) continue;
    seen.add(key);

    const { category, matchedPattern } = match;
    const monthlySavingsLow = round2(txn.amount * (category.savingsPercent.low / 100));
    const monthlySavingsHigh = round2(txn.amount * (category.savingsPercent.high / 100));

    suggestions.push({
      id: `neg-txn-${key.replace(/[^a-z0-9]/g, '')}`,
      billName: txn.merchant_name,
      currentAmount: round2(txn.amount),
      estimatedSavings: { low: monthlySavingsLow, high: monthlySavingsHigh },
      annualSavings: { low: round2(monthlySavingsLow * 12), high: round2(monthlySavingsHigh * 12) },
      difficulty: category.difficulty,
      type: category.type,
      script: category.script,
      tips: category.tips,
      phoneNumber: lookupPhoneNumber(matchedPattern),
      bestTimeToCall: category.bestTimeToCall,
      successRate: category.successRate,
    });
  }

  // 2. Fixed expenses
  const fixedExpenses = db.prepare(`
    SELECT name, amount, frequency
    FROM fixed_expenses
    WHERE user_id = ?
  `).all(userId) as unknown as { name: string; amount: number; frequency: string }[];

  for (const exp of fixedExpenses) {
    const match = findMatchingCategory(exp.name);
    if (!match) continue;
    const key = match.matchedPattern;
    if (seen.has(key)) continue;
    seen.add(key);

    const { category, matchedPattern } = match;
    // Normalize to monthly amount
    let monthlyAmount = exp.amount;
    if (exp.frequency === 'weekly') monthlyAmount = exp.amount * (52 / 12);
    else if (exp.frequency === 'biweekly') monthlyAmount = exp.amount * (26 / 12);
    else if (exp.frequency === 'quarterly') monthlyAmount = exp.amount / 3;
    else if (exp.frequency === 'annually' || exp.frequency === 'yearly') monthlyAmount = exp.amount / 12;

    const monthlySavingsLow = round2(monthlyAmount * (category.savingsPercent.low / 100));
    const monthlySavingsHigh = round2(monthlyAmount * (category.savingsPercent.high / 100));

    suggestions.push({
      id: `neg-fix-${key.replace(/[^a-z0-9]/g, '')}`,
      billName: exp.name,
      currentAmount: round2(monthlyAmount),
      estimatedSavings: { low: monthlySavingsLow, high: monthlySavingsHigh },
      annualSavings: { low: round2(monthlySavingsLow * 12), high: round2(monthlySavingsHigh * 12) },
      difficulty: category.difficulty,
      type: category.type,
      script: category.script,
      tips: category.tips,
      phoneNumber: lookupPhoneNumber(matchedPattern),
      bestTimeToCall: category.bestTimeToCall,
      successRate: category.successRate,
    });
  }

  // 3. Credit card accounts — APR reduction opportunities
  const creditCards = db.prepare(`
    SELECT id, name, current_balance, interest_rate, minimum_payment
    FROM accounts
    WHERE user_id = ? AND type = 'credit' AND current_balance < 0 AND interest_rate > 0
  `).all(userId) as unknown as { id: string; name: string; current_balance: number; interest_rate: number; minimum_payment: number }[];

  const ccCategory = NEGOTIABLE_BILLS.find(c => c.type === 'rate_reduction')!;
  for (const card of creditCards) {
    const match = findMatchingCategory(card.name);
    const key = match ? match.matchedPattern : `cc-${card.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Estimate monthly interest: balance * APR / 12
    const balance = Math.abs(card.current_balance);
    const monthlyInterest = round2(balance * (card.interest_rate / 100) / 12);
    const monthlySavingsLow = round2(monthlyInterest * (ccCategory.savingsPercent.low / 100));
    const monthlySavingsHigh = round2(monthlyInterest * (ccCategory.savingsPercent.high / 100));

    suggestions.push({
      id: `neg-cc-${card.id}`,
      billName: card.name,
      currentAmount: monthlyInterest,
      estimatedSavings: { low: monthlySavingsLow, high: monthlySavingsHigh },
      annualSavings: { low: round2(monthlySavingsLow * 12), high: round2(monthlySavingsHigh * 12) },
      difficulty: ccCategory.difficulty,
      type: 'rate_reduction',
      script: ccCategory.script,
      tips: ccCategory.tips,
      phoneNumber: match ? lookupPhoneNumber(match.matchedPattern) : null,
      bestTimeToCall: ccCategory.bestTimeToCall,
      successRate: ccCategory.successRate,
    });
  }

  // Sort by estimated annual savings (high end) descending
  suggestions.sort((a, b) => b.annualSavings.high - a.annualSavings.high);

  return suggestions;
}
