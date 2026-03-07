import type { ApiResponse, PaginatedResponse, Transaction, SpendingSummary } from '@budgetguard/shared';
import { ApiClient } from './client.js';

export interface ListTransactionsParams {
  page?: number;
  limit?: number;
  accountId?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

export interface SearchTransactionsParams {
  query: string;
  page?: number;
  limit?: number;
}

export function createTransactionsApi(client: ApiClient) {
  return {
    async listTransactions(
      params?: ListTransactionsParams,
    ): Promise<PaginatedResponse<Transaction>> {
      const response = await client.get<PaginatedResponse<Transaction>>('/transactions', params as Record<string, string | number | boolean | undefined>);
      return response.data!;
    },

    async getSpendingSummary(params?: {
      startDate?: string;
      endDate?: string;
    }): Promise<ApiResponse<SpendingSummary[]>> {
      return client.get('/transactions/spending-summary', params as Record<string, string | number | boolean | undefined>);
    },

    async searchTransactions(
      params: SearchTransactionsParams,
    ): Promise<PaginatedResponse<Transaction>> {
      const response = await client.get<PaginatedResponse<Transaction>>('/transactions/search', params as Record<string, string | number | boolean | undefined>);
      return response.data!;
    },
  };
}
