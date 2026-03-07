import type { ApiResponse, Notification, NotificationPreferences } from '@budgetguard/shared';
import { ApiClient } from './client.js';

export function createNotificationsApi(client: ApiClient) {
  return {
    async listNotifications(params?: {
      unreadOnly?: boolean;
      page?: number;
      limit?: number;
    }): Promise<ApiResponse<Notification[]>> {
      return client.get('/notifications', params as Record<string, string | number | boolean | undefined>);
    },

    async markRead(notificationId: string): Promise<ApiResponse<void>> {
      return client.patch(`/notifications/${notificationId}/read`);
    },

    async markAllRead(): Promise<ApiResponse<void>> {
      return client.post('/notifications/read-all');
    },

    async dismiss(notificationId: string): Promise<ApiResponse<void>> {
      return client.patch(`/notifications/${notificationId}/dismiss`);
    },

    async updateSettings(
      preferences: Partial<NotificationPreferences>,
    ): Promise<ApiResponse<NotificationPreferences>> {
      return client.patch('/notifications/settings', preferences);
    },
  };
}
