// === Database Models ===

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  subscription_status: 'trial' | 'active' | 'cancelled';
  pay_frequency: 'weekly' | 'biweekly' | 'twice_monthly' | 'monthly' | null;
  next_payday: string | null;
  take_home_pay: number | null;
  email_verified: boolean;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  plaid_account_id: string | null;
  name: string;
  type: 'checking' | 'savings' | 'credit';
  current_balance: number;
  available_balance: number | null;
  institution_name: string | null;
  last_synced_at: string | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  date: string;
  merchant_name: string | null;
  category: string | null;
  is_recurring: boolean;
}

export interface IncomingEvent {
  id: string;
  user_id: string;
  name: string;
  estimated_amount: number;
  expected_date: string | null;
  is_recurring: boolean;
  recurrence_interval: 'monthly' | 'yearly' | 'custom' | null;
  notes: string | null;
}

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  context_snapshot: Record<string, unknown> | null;
  created_at: string;
}

// === Runway Score ===

export interface RunwayScore {
  amount: number;
  status: 'green' | 'yellow' | 'red';
  hasUrgentWarning: boolean;
  urgentEvents: { name: string; amount: number }[];
  spentThisMonth: number;
  remainingBudget: number;
  daysToPayday: number | null;
  runwayDays: number;
  runoutDate: string | null;
  dailyBurnRate: number;
  totalDebt: number;
  spendableBalance: number;
  cuttableMerchants: { name: string; monthlyAmount: number; category: string; occurrences?: number }[];
  noIncomeConfigured?: boolean;
  spendBreakdown?: {
    recurringMonthly: number;
    variableMonthly: number;
    oneOffTotal: number;
    refundOffset: number;
    outlierCount: number;
    outlierTransactions: { merchant: string; amount: number; date: string }[];
    rawDailyBurn: number;
  };
}

// === Budget ===

export interface Budget {
  category: string;
  monthly_limit: number;
}

export interface BudgetWithSuggestion extends Budget {
  suggested: number | null;   // 3-month avg rounded up to nearest $25
  currentSpend: number;       // actual last-30-day spend
}

// === Spending Category ===

export interface SpendingCategory {
  name: string;
  monthlyAmount: number;     // actual spending in this category (monthly avg)
  budget: number | null;      // user-set budget for this category, if any
  isNecessity: boolean;       // groceries/gas = true, dining/shopping = false
  isOverBudget: boolean;      // spending > budget
  runwayImpactDays: number;   // "cut this by 50% → gain X days"
}

// === Paycheck Plan (monthly-based) ===

export interface PaycheckPlan {
  monthlyIncome: number;
  paycheckAmount: number;
  paycheckCount: number; // per month
  frequency: string;
  buckets: {
    bills: { amount: number; details: { name: string; amount: number }[] };
    debt: { amount: number; details: { name: string; amount: number }[] };
    savings: { amount: number; reason: string };
    spending: {
      monthly: number;
      weekly: number;
      daily: number;
      categories: SpendingCategory[];   // WHERE spending money goes
      totalNecessities: number;          // sum of necessity categories
      totalDiscretionary: number;        // sum of cuttable categories
    };
  };
  // Confidence signals
  billsCovered: boolean;         // #1 signal: can you pay your bills?
  billsGap: number;              // if not covered, how much short?
  // Spending pace
  spendingPace: {
    percentThroughMonth: number;   // 0-100: what % of month has passed
    percentBudgetUsed: number;     // 0-100: what % of spending money used
    onTrack: boolean;              // pace ≤ time
    message: string;               // human-friendly pace message
  };
  // Wins — celebrate progress
  wins: string[];
  // Reality check
  isOverspending: boolean;       // spending more than available after bills
  daysToPayday: number | null;
  isShortfall: boolean;
  shortfallAmount: number;
  advice: string;
  // Top cut suggestion
  topCut: { category: string; saveAmount: number; runwayGainDays: number } | null;
}

// === API Types ===

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: Omit<User, 'password_hash'>;
}

export interface CreateEventRequest {
  name: string;
  estimated_amount: number;
  expected_date?: string | null;
  is_recurring?: boolean;
  recurrence_interval?: 'monthly' | 'yearly' | 'custom' | null;
  notes?: string | null;
}

export interface UpdatePaycheckRequest {
  pay_frequency: 'weekly' | 'biweekly' | 'twice_monthly' | 'monthly';
  next_payday: string;
  take_home_pay: number;
}

export interface ApiError {
  error: string;
  message: string;
}

// === Lump Sum Payoff ===

export interface LumpSumDebtTarget {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  amountToPay: number;         // how much of this debt to pay off now
  remainingAfter: number;      // balance remaining after lump sum
  isPaidOff: boolean;          // fully eliminated?
  monthlyPaymentFreed: number; // minimum payment freed up if paid off
}

export interface LumpSumRecommendation {
  shouldPayoff: boolean;           // is it worth it?
  reason: string;                  // why or why not
  availableCash: number;           // total spendable balance
  emergencyFund: number;           // how much to keep as safety net
  lumpSumAvailable: number;        // cash available after emergency fund
  targets: LumpSumDebtTarget[];    // debts to pay, highest interest first
  totalLumpSum: number;            // total amount to pay toward debt
  totalInterestSaved: number;      // lifetime interest saved
  newMonthlyMinimums: number;      // total minimums after payoffs
  oldMonthlyMinimums: number;      // total minimums before
  monthlyFreedUp: number;          // how much less in minimums per month
  monthsShaved: number;            // how many months faster to debt-free
  remainingBalance: number;        // cash left after lump sum + emergency fund
  monthsOfRunway: number;          // months of expenses the remaining cash covers
}

// === Detected Debt Payments ===

export interface DetectedDebtPayment {
  merchantName: string;           // raw merchant name from transactions
  displayName: string;            // cleaned display name
  suggestedType: 'credit' | 'mortgage' | 'auto_loan' | 'student_loan' | 'personal_loan';
  monthlyAmount: number;          // detected monthly payment amount
  occurrences: number;            // how many payments found
  lastPaymentDate: string;        // most recent payment
}

// === Calendar ===

export interface CalendarDay {
  date: string;
  projectedBalance: number;
  isPayday: boolean;
  incomeAmount: number;
  dailySpend: number;
  events: { name: string; amount: number }[];
  eventsCost: number;
  isPast: boolean;
  isToday: boolean;
  status: 'green' | 'yellow' | 'red';
}

export interface CalendarWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  totalSpend: number;
  weeklyBudget: number;
  overBudget: boolean;
  status: 'green' | 'yellow' | 'red';
}

export interface CalendarMonth {
  month: string;
  days: CalendarDay[];
  weeks: CalendarWeek[];
  monthlyBudget: number;
  projectedMonthlySpend: number;
  spentSoFar: number;
  overBudget: boolean;
  monthStatus: 'green' | 'yellow' | 'red';
  startingBalance: number;
  endingBalance: number;
  lowestBalance: number;
  lowestBalanceDate: string;
}

// === AI Financial Advisor ===

export type InsightSeverity = 'critical' | 'warning' | 'info' | 'win';

export type InsightCategory =
  | 'health_score'
  | 'spending_trend'
  | 'cash_flow'
  | 'debt_intelligence'
  | 'quick_win'
  | 'bill_negotiation'
  | 'behavioral_pattern'
  | 'what_if'
  | 'progress'
  | 'action_plan'
  | 'savings';

export interface AdvisorInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  body: string;
  action: string | null;
  estimatedImpact: string | null;
  timeToComplete: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  relatedPage: string | null;
}

export interface WhatIfScenario {
  description: string;
  currentMonthly: number;
  proposedMonthly: number;
  monthlySavings: number;
  runwayDaysGained: number;
  debtPayoffMonthsShaved: number;
  annualImpact: number;
}

export interface AdvisorReport {
  healthScore: number;
  healthLabel: string;
  healthSummary: string;
  insights: AdvisorInsight[];
  scenarios: WhatIfScenario[];
  changes: {
    hasLastReport: boolean;
    summary: string | null;
    improved: string[];
    regressed: string[];
  };
  priorityActions: {
    rank: number;
    action: string;
    reason: string;
    impact: string;
    timeToComplete?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
  }[];
  generatedAt: string;
  cached: boolean;
  cachedAt: string | null;
  dataAsOf: string;
}
