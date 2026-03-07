export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  plaidTransactionId?: string;
  amount: number;
  date: string;
  authorizedDate?: string;
  name: string;
  merchantName?: string;
  personalFinanceCategoryPrimary?: string;
  personalFinanceCategoryDetailed?: string;
  pending: boolean;
  paymentChannel?: string;
  transactionType?: string;
  isRecurring: boolean;
  subscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpendingSummary {
  category: string;
  total: number;
  transactionCount: number;
  avgPerMonth: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}
