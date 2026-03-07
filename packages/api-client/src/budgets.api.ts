import type {
  ApiResponse,
  Budget,
  BudgetGeneration,
  SpendingSuggestion,
  CreateBudgetInput,
  UpdateBudgetInput,
} from '@budgetguard/shared';
import { ApiClient } from './client.js';

export function createBudgetsApi(client: ApiClient) {
  return {
    async listBudgets(params?: {
      isActive?: boolean;
    }): Promise<ApiResponse<Budget[]>> {
      return client.get('/budgets', params as Record<string, string | number | boolean | undefined>);
    },

    async getBudget(budgetId: string): Promise<ApiResponse<Budget>> {
      return client.get(`/budgets/${budgetId}`);
    },

    async createBudget(input: CreateBudgetInput): Promise<ApiResponse<Budget>> {
      return client.post('/budgets', input);
    },

    async updateBudget(
      budgetId: string,
      input: UpdateBudgetInput,
    ): Promise<ApiResponse<Budget>> {
      return client.patch(`/budgets/${budgetId}`, input);
    },

    async deleteBudget(budgetId: string): Promise<ApiResponse<void>> {
      return client.delete(`/budgets/${budgetId}`);
    },

    async generateBudget(): Promise<ApiResponse<BudgetGeneration>> {
      return client.post('/budgets/generate');
    },

    async getGenerationHistory(): Promise<ApiResponse<BudgetGeneration[]>> {
      return client.get('/budgets/generations');
    },

    async getSmartSuggestions(): Promise<ApiResponse<SpendingSuggestion[]>> {
      return client.get('/budgets/suggestions');
    },
  };
}
