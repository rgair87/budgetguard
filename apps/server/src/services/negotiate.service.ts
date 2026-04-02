import db from '../config/db';
import { cleanMerchantName, titleCase, normalizeMerchantName } from './merchant-utils';

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
  cox: '1-800-234-3993',
  centurylink: '1-800-244-1111',
  frontier: '1-800-921-8101',
  optimum: '1-866-200-7273',
  geico: '1-800-207-7847',
  'state farm': '1-800-782-8332',
  progressive: '1-800-776-4737',
  allstate: '1-800-255-7828',
  usaa: '1-800-531-8722',
  'liberty mutual': '1-800-290-8711',
  farmers: '1-888-327-6335',
  nationwide: '1-877-669-6877',
  chase: '1-800-935-9935',
  'capital one': '1-800-227-4825',
  citi: '1-800-950-5114',
  amex: '1-800-528-4800',
  'american express': '1-800-528-4800',
  discover: '1-800-347-2683',
  'wells fargo': '1-800-869-3557',
  'bank of america': '1-800-732-9194',
  'planet fitness': '1-844-880-7180',
  'la fitness': '1-949-255-7200',
  'anytime fitness': '1-800-704-5004',
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

// Merchant-specific overrides for scripts, tips, success rates
const MERCHANT_OVERRIDES: Record<string, Partial<Pick<NegotiableCategory, 'script' | 'tips' | 'successRate' | 'bestTimeToCall'>>> = {
  comcast: {
    script: "Hi, I'm calling about my Comcast/Xfinity account. My bill has increased and I'd like to explore options to lower it. I've been a loyal customer and I've seen Spectrum and AT&T offering promotional rates. Could you check what retention offers or promotions are available for my account?",
    bestTimeToCall: 'Tuesday-Thursday, 7-9 AM EST',
    successRate: '73% success rate',
  },
  xfinity: {
    script: "Hi, I'm calling about my Xfinity account. My bill has increased and I'd like to explore options to lower it. I've been a loyal customer and I've seen Spectrum and AT&T offering promotional rates. Could you check what retention offers or promotions are available for my account?",
    bestTimeToCall: 'Tuesday-Thursday, 7-9 AM EST',
    successRate: '73% success rate',
  },
  spectrum: {
    script: "Hi, I'm calling about my Spectrum bill. I've noticed the price went up after my promotional period ended. I'd like to see if there are any current promotions I can switch to. I've been comparing prices with AT&T Fiber and they have a competitive offer.",
    successRate: '70% success rate',
  },
  'at&t': {
    script: "Hi, I'm calling about my AT&T bill. I've been a customer for a while and my rate has gone up. I'd like to explore loyalty discounts or any current promotions. I've seen offers from competing providers that are significantly lower.",
    successRate: '68% success rate',
  },
  att: {
    script: "Hi, I'm calling about my AT&T bill. I've been a customer for a while and my rate has gone up. I'd like to explore loyalty discounts or any current promotions. I've seen offers from competing providers that are significantly lower.",
    successRate: '68% success rate',
  },
  geico: {
    script: "Hi, I'd like to review my GEICO policy. I've gotten quotes from Progressive and State Farm that are lower. Can we go through my coverage and see if there are any discounts I'm missing — like multi-policy, safe driver, or low mileage?",
    tips: [
      'Get 2-3 competitor quotes before calling (Progressive, State Farm, USAA)',
      'Ask about bundling auto + renters/home insurance',
      'Mention safe driver record and low annual mileage',
      'Ask about paying in full for a 6-month or annual discount',
      'Consider raising deductible from $500 to $1000 to save 15-25%',
    ],
    successRate: '65% success rate',
  },
  'state farm': {
    script: "Hi, I'd like to review my State Farm policy. I've been shopping around and found lower rates. Can you help me find any discounts — bundling, drive safe & save, or a higher deductible option?",
    successRate: '62% success rate',
  },
  progressive: {
    script: "Hi, I'd like to review my Progressive policy. I've been getting quotes from competitors and I'm seeing lower rates. Can we review my coverage for any savings opportunities?",
    successRate: '60% success rate',
  },
  netflix: {
    script: "Go to netflix.com/account → Change Plan. Consider downgrading from Premium to Standard (saves ~$7/mo). If you want to cancel, Netflix will often offer 1-2 months at a reduced rate during the cancellation flow.",
    tips: [
      'Downgrade plan tier before cancelling — Standard with ads is $7.99/mo',
      'If cancelling, complete the process — Netflix often sends 50% off win-back emails within 2 weeks',
      'Check if your phone carrier includes Netflix (T-Mobile does)',
      'Consider rotating: cancel for 2 months, re-subscribe for 1 month',
    ],
    successRate: '85% success rate',
  },
  spotify: {
    script: "Go to spotify.com/account → Cancel subscription. Spotify almost always offers a discounted rate (usually 3 months at $9.99 or 1 month free) when you initiate cancellation. If they don't, cancel and wait for a win-back email.",
    tips: [
      'Start the cancellation flow — Spotify frequently offers retention deals',
      'Check if you qualify for Student ($5.99) or Duo ($16.99) plans',
      'If you have a family, the Family plan at $17.99 covers 6 accounts',
      'Free tier with ads is available if you mainly listen to playlists',
    ],
    successRate: '90% success rate',
  },
  chase: {
    script: "Hi, I'd like to request a lower APR on my Chase credit card. I've been a Chase customer for several years with a strong payment history. I've received balance transfer offers from other cards at 0% for 15 months. Would you be able to reduce my current rate?",
    tips: [
      'Call the number on the back of your card for best results',
      'Mention your account tenure and on-time payment history',
      'Reference specific competitor offers (Citi 0% BT, Discover)',
      'If first agent declines, ask to speak with a retention specialist',
      'Try again in 90 days if declined — each review is independent',
    ],
    successRate: '52% success rate',
    bestTimeToCall: 'Monday-Wednesday, 8-10 AM EST',
  },
  'capital one': {
    script: "Hi, I'd like to discuss lowering the APR on my Capital One card. I've been making consistent on-time payments and I've seen balance transfer offers from other issuers at much lower rates. Is there anything you can do to reduce my interest rate?",
    tips: [
      'Capital One is known for being less flexible on APR — be persistent',
      'Ask about product changes to a lower-rate card instead',
      'Mention specific competitor BT offers you received',
      'If APR reduction fails, ask about waiving the annual fee (if applicable)',
    ],
    successRate: '45% success rate',
    bestTimeToCall: 'Tuesday-Thursday morning',
  },
  discover: {
    script: "Hi, I'd like to request an APR reduction on my Discover card. I've been a loyal cardholder with a solid payment track record. I've been offered lower rates elsewhere and I'd like to keep my Discover account but the rate needs to be competitive.",
    tips: [
      'Discover is generally more receptive to APR negotiations',
      'Mention your credit score improvement if applicable',
      'Ask about their hardship programs if carrying a large balance',
      'Request a temporary rate reduction if permanent isn\'t available',
    ],
    successRate: '60% success rate',
    bestTimeToCall: 'Monday-Wednesday morning',
  },
};

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
    const override = MERCHANT_OVERRIDES[matchedPattern] || {};
    const monthlySavingsLow = round2(txn.amount * (category.savingsPercent.low / 100));
    const monthlySavingsHigh = round2(txn.amount * (category.savingsPercent.high / 100));

    suggestions.push({
      id: `neg-txn-${key.replace(/[^a-z0-9]/g, '')}`,
      billName: normalizeMerchantName(titleCase(cleanMerchantName(txn.merchant_name))),
      currentAmount: round2(txn.amount),
      estimatedSavings: { low: monthlySavingsLow, high: monthlySavingsHigh },
      annualSavings: { low: round2(monthlySavingsLow * 12), high: round2(monthlySavingsHigh * 12) },
      difficulty: category.difficulty,
      type: category.type,
      script: override.script || category.script,
      tips: override.tips || category.tips,
      phoneNumber: lookupPhoneNumber(matchedPattern),
      bestTimeToCall: override.bestTimeToCall ?? category.bestTimeToCall,
      successRate: override.successRate || category.successRate,
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
    const override = MERCHANT_OVERRIDES[matchedPattern] || {};
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
      script: override.script || category.script,
      tips: override.tips || category.tips,
      phoneNumber: lookupPhoneNumber(matchedPattern),
      bestTimeToCall: override.bestTimeToCall ?? category.bestTimeToCall,
      successRate: override.successRate || category.successRate,
    });
  }

  // 3. Credit card accounts — APR reduction opportunities
  const creditCards = db.prepare(`
    SELECT id, name, current_balance, interest_rate, minimum_payment
    FROM accounts
    WHERE user_id = ? AND type = 'credit' AND current_balance > 0 AND interest_rate > 0
  `).all(userId) as unknown as { id: string; name: string; current_balance: number; interest_rate: number; minimum_payment: number }[];

  const ccCategory = NEGOTIABLE_BILLS.find(c => c.type === 'rate_reduction')!;
  for (const card of creditCards) {
    const match = findMatchingCategory(card.name);
    const key = match ? match.matchedPattern : `cc-${card.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const override = match ? (MERCHANT_OVERRIDES[match.matchedPattern] || {}) : {};

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
      script: override.script || ccCategory.script,
      tips: override.tips || ccCategory.tips,
      phoneNumber: match ? lookupPhoneNumber(match.matchedPattern) : null,
      bestTimeToCall: override.bestTimeToCall ?? ccCategory.bestTimeToCall,
      successRate: override.successRate || ccCategory.successRate,
    });
  }

  // Sort by estimated annual savings (high end) descending
  suggestions.sort((a, b) => b.annualSavings.high - a.annualSavings.high);

  return suggestions;
}
