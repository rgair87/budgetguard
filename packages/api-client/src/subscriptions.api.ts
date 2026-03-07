import type { ApiResponse, Subscription, ClassifySubscriptionInput } from '@budgetguard/shared';
import { ApiClient } from './client.js';

export interface CancelGuide {
  subscriptionId: string;
  merchantName: string;
  cancelUrl?: string;
  cancelInstructions?: string;
  steps: string[];
}

export function createSubscriptionsApi(client: ApiClient) {
  return {
    async listSubscriptions(params?: {
      status?: string;
    }): Promise<ApiResponse<Subscription[]>> {
      return client.get('/subscriptions', params as Record<string, string | number | boolean | undefined>);
    },

    async getSubscription(subscriptionId: string): Promise<ApiResponse<Subscription>> {
      return client.get(`/subscriptions/${subscriptionId}`);
    },

    async classifySubscription(
      subscriptionId: string,
      input: ClassifySubscriptionInput,
    ): Promise<ApiResponse<Subscription>> {
      return client.post(`/subscriptions/${subscriptionId}/classify`, input);
    },

    async getCancelGuide(subscriptionId: string): Promise<ApiResponse<CancelGuide>> {
      return client.get(`/subscriptions/${subscriptionId}/cancel-guide`);
    },

    async triggerDetection(): Promise<ApiResponse<{ detected: number }>> {
      return client.post('/subscriptions/detect');
    },
  };
}
