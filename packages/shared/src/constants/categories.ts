export const SPENDING_CATEGORIES = [
  'FOOD_AND_DRINK',
  'TRANSPORTATION',
  'RENT_AND_UTILITIES',
  'ENTERTAINMENT',
  'SHOPPING',
  'PERSONAL_CARE',
  'HEALTH_AND_FITNESS',
  'EDUCATION',
  'TRAVEL',
  'SUBSCRIPTIONS',
  'INSURANCE',
  'TAXES',
  'TRANSFER',
  'OTHER',
] as const;

export type SpendingCategory = typeof SPENDING_CATEGORIES[number];

export const CATEGORY_LABELS: Record<SpendingCategory, string> = {
  FOOD_AND_DRINK: 'Food & Drink',
  TRANSPORTATION: 'Transportation',
  RENT_AND_UTILITIES: 'Rent & Utilities',
  ENTERTAINMENT: 'Entertainment',
  SHOPPING: 'Shopping',
  PERSONAL_CARE: 'Personal Care',
  HEALTH_AND_FITNESS: 'Health & Fitness',
  EDUCATION: 'Education',
  TRAVEL: 'Travel',
  SUBSCRIPTIONS: 'Subscriptions',
  INSURANCE: 'Insurance',
  TAXES: 'Taxes',
  TRANSFER: 'Transfers',
  OTHER: 'Other',
};
