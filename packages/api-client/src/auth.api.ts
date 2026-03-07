import type { ApiResponse, AuthTokens, User, RegisterInput, LoginInput } from '@budgetguard/shared';
import { ApiClient } from './client.js';

export function createAuthApi(client: ApiClient) {
  return {
    async register(input: RegisterInput): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
      return client.post('/auth/register', input);
    },

    async login(input: LoginInput): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
      return client.post('/auth/login', input);
    },

    async refresh(refreshToken: string): Promise<ApiResponse<AuthTokens>> {
      return client.post('/auth/refresh', { refreshToken });
    },

    async logout(): Promise<ApiResponse<void>> {
      return client.post('/auth/logout');
    },
  };
}
