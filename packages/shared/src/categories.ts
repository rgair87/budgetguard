export interface CategoryDef {
  name: string;
  type: 'necessity' | 'discretionary' | 'system';
  icon: string;
}

export const CATEGORIES: CategoryDef[] = [
  // Necessities — can reduce but can't eliminate
  { name: 'Housing', type: 'necessity', icon: 'Home' },
  { name: 'Groceries', type: 'necessity', icon: 'ShoppingCart' },
  { name: 'Utilities', type: 'necessity', icon: 'Zap' },
  { name: 'Transportation', type: 'necessity', icon: 'Car' },
  { name: 'Gas', type: 'necessity', icon: 'Fuel' },
  { name: 'Insurance', type: 'necessity', icon: 'Shield' },
  { name: 'Healthcare', type: 'necessity', icon: 'Heart' },
  { name: 'Phone & Internet', type: 'necessity', icon: 'Wifi' },
  { name: 'Childcare', type: 'necessity', icon: 'Baby' },

  // Discretionary — cuttable
  { name: 'Food & Dining', type: 'discretionary', icon: 'UtensilsCrossed' },
  { name: 'Entertainment', type: 'discretionary', icon: 'Tv' },
  { name: 'Shopping', type: 'discretionary', icon: 'ShoppingBag' },
  { name: 'Subscriptions', type: 'discretionary', icon: 'Repeat' },
  { name: 'Personal Care', type: 'discretionary', icon: 'Sparkles' },
  { name: 'Travel', type: 'discretionary', icon: 'Plane' },
  { name: 'Education', type: 'discretionary', icon: 'GraduationCap' },
  { name: 'Pets', type: 'discretionary', icon: 'PawPrint' },
  { name: 'Gifts', type: 'discretionary', icon: 'Gift' },
  { name: 'Home Improvement', type: 'discretionary', icon: 'Wrench' },
  { name: 'Services', type: 'discretionary', icon: 'Briefcase' },
  { name: 'Bills', type: 'discretionary', icon: 'FileText' },

  // System — not user-budgetable
  { name: 'Debt Payments', type: 'system', icon: 'CreditCard' },
  { name: 'Transfers', type: 'system', icon: 'ArrowLeftRight' },
  { name: 'Fees', type: 'system', icon: 'AlertCircle' },
  { name: 'Income', type: 'system', icon: 'DollarSign' },
  { name: 'Other', type: 'discretionary', icon: 'MoreHorizontal' },
];

/** All category names */
export const CATEGORY_NAMES = CATEGORIES.map(c => c.name);

/** Categories the user can set budgets for (necessity + discretionary) */
export const BUDGETABLE_CATEGORIES = CATEGORIES.filter(c => c.type !== 'system');

/** Category names for dropdowns (excludes system categories users shouldn't pick manually) */
export const USER_CATEGORY_NAMES = CATEGORIES.filter(c => c.type !== 'system').map(c => c.name);

/** Necessity category names — can't cut these */
export const NECESSITY_NAMES = new Set(CATEGORIES.filter(c => c.type === 'necessity').map(c => c.name));

/** Discretionary category names — cuttable */
export const DISCRETIONARY_NAMES = new Set(CATEGORIES.filter(c => c.type === 'discretionary').map(c => c.name));

/** Lookup: name → CategoryDef */
export const CATEGORY_MAP = new Map(CATEGORIES.map(c => [c.name, c]));
