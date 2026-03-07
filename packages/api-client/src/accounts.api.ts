import type { ApiResponse, Account } from '@budgetguard/shared';
import { ApiClient } from './client.js';

export function createAccountsApi(client: ApiClient) {
  return {
    async listAccounts(): Promise<ApiResponse<Account[]>> {
      return client.get('/accounts');
    },

    async getAccount(accountId: string): Promise<ApiResponse<Account>> {
      return client.get(`/accounts/${accountId}`);
    },

    async unlinkAccount(accountId: string): Promise<ApiResponse<void>> {
      return client.delete(`/accounts/${accountId}`);
    },

    async refreshBalance(accountId: string): Promise<ApiResponse<Account>> {
      return client.post(`/accounts/${accountId}/refresh`);
    },
  };
}
