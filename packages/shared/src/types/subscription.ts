export type SubscriptionStatus = 'detected' | 'confirmed' | 'safe' | 'cancel_requested' | 'cancelled' | 'dismissed';
export type SubscriptionFrequency = 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Subscription {
  id: string;
  userId: string;
  merchantName: string;
  normalizedName: string;
  description?: string;
  estimatedAmount: number;
  currencyCode: string;
  frequency: SubscriptionFrequency;
  confidenceScore: number;
  status: SubscriptionStatus;
  category?: string;
  cancelUrl?: string;
  cancelInstructions?: string;
  firstSeenDate: string;
  lastChargeDate?: string;
  nextExpectedDate?: string;
  totalCharges: number;
  totalSpent: number;
  classifiedAt?: string;
  detectedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafeListEntry {
  id: string;
  userId: string;
  subscriptionId: string;
  keepUntil?: string;
  keepReason?: string;
  reviewReminderDate?: string;
  reminderSent: boolean;
  addedAt: string;
  updatedAt: string;
}
