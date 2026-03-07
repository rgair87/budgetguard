export interface Account {
  id: string;
  userId: string;
  plaidItemId: string;
  plaidAccountId: string;
  name: string;
  officialName?: string;
  type: 'depository' | 'credit' | 'loan' | 'investment';
  subtype?: string;
  mask?: string;
  currentBalance?: number;
  availableBalance?: number;
  currencyCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
