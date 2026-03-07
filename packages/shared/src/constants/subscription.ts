export const SUBSCRIPTION_STATUSES = [
  'detected', 'confirmed', 'safe', 'cancel_requested', 'cancelled', 'dismissed'
] as const;

export const SUBSCRIPTION_FREQUENCIES = [
  'weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly'
] as const;

export const KNOWN_SUBSCRIPTION_CATEGORIES = [
  'SUBSCRIPTION', 'ENTERTAINMENT', 'SOFTWARE', 'MEDIA', 'MUSIC', 'VIDEO_STREAMING',
  'NEWS', 'CLOUD_STORAGE', 'GAMING', 'FITNESS',
] as const;
