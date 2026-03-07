export interface Budget {
  id: string;
  userId: string;
  name: string;
  category: string;
  amountLimit: number;
  amountSpent: number;
  period: 'monthly' | 'weekly' | 'yearly';
  periodStart: string;
  periodEnd: string;
  isAiGenerated: boolean;
  aiReasoning?: string;
  aiConfidence?: number;
  userAdjusted: boolean;
  alertAtPercent: number;
  alertSent: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetGeneration {
  id: string;
  userId: string;
  analysisPeriodStart: string;
  analysisPeriodEnd: string;
  totalTransactionsAnalyzed: number;
  totalSpendingAnalyzed: number;
  budgetsCreated: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export type SuggestionType = 'cut' | 'swap' | 'trim';
export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed';

export interface SpendingSuggestion {
  id: string;
  userId: string;
  type: SuggestionType;
  category: string;
  title: string;
  description: string;
  currentAmount: number;
  suggestedAmount: number;
  savingsAmount: number;
  projectedAnnualSavings: number;
  confidence: number;
  relatedSubscriptionId?: string;
  status: SuggestionStatus;
  acceptedAt?: string;
  createdAt: string;
}
