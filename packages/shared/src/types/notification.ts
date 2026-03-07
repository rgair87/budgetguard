export type NotificationType =
  | 'new_subscription'
  | 'budget_alert'
  | 'safe_list_reminder'
  | 'sync_error'
  | 'budget_generated'
  | 'subscription_expiring'
  | 'smart_suggestion';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  channelsSent: string[];
  pushSentAt?: string;
  emailSentAt?: string;
  readAt?: string;
  dismissedAt?: string;
  actionUrl?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  alertRepeatCount: number;
  nextAlertAt?: string;
  alertResolved: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}
