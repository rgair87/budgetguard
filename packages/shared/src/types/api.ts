export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface DashboardData {
  totalBalance: number;
  monthlySpending: number;
  monthlyIncome: number;
  activeSubscriptions: number;
  subscriptionsCost: number;
  unclassifiedSubscriptions: number;
  activeBudgets: number;
  budgetHealth: 'good' | 'warning' | 'over';
  unreadNotifications: number;
  savingsSuggestions: number;
}
