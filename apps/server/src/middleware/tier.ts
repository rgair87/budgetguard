import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import db from '../config/db';

export type Tier = 'free' | 'plus' | 'pro';

export interface TieredRequest extends AuthRequest {
  tier?: Tier;
  trialDaysLeft?: number;
}

// ─── Tier Limits ────────────────────────────────────────────
// Free: basic dashboard, heavily limited
// Plus ($7.99/mo): bank sync, budgets, goals, trends
// Pro ($14.99/mo): AI advisor, cut-this, negotiate, family, unlimited

export const TIER_LIMITS = {
  free: {
    chatMessagesPerDay: 5,
    csvAccounts: 2,
    advisorRefreshDays: 0,   // no advisor access
    calendarMonthsForward: 1,
    canUseTeller: false,
    canExport: false,
    canEditTransactions: true,
    canDismissSubscriptions: false,
    goalsLimit: 1,
    canNegotiate: false,
    canViewTrends: false,    // last 30 days only
    canViewPredictions: false,
    canCreateFamily: false,
    canUseAdvisor: false,
    canUseCutThis: false,
    budgetCategories: 3,
    trendsMonths: 1,
  },
  plus: {
    chatMessagesPerDay: 15,
    csvAccounts: 10,
    advisorRefreshDays: 30,  // 1x/month
    calendarMonthsForward: 3,
    canUseTeller: true,
    canExport: true,
    canEditTransactions: true,
    canDismissSubscriptions: true,
    goalsLimit: 5,
    canNegotiate: false,
    canViewTrends: true,
    canViewPredictions: true,
    canCreateFamily: false,
    canUseAdvisor: true,
    canUseCutThis: false,
    budgetCategories: 999,
    trendsMonths: 6,
  },
  pro: {
    chatMessagesPerDay: 50,
    csvAccounts: 999,
    advisorRefreshDays: 3,   // unlimited (3-day cache)
    calendarMonthsForward: 6,
    canUseTeller: true,
    canExport: true,
    canEditTransactions: true,
    canDismissSubscriptions: true,
    goalsLimit: 999,
    canNegotiate: true,
    canViewTrends: true,
    canViewPredictions: true,
    canCreateFamily: true,
    canUseAdvisor: true,
    canUseCutThis: true,
    budgetCategories: 999,
    trendsMonths: 12,
  },
} as const;

// 7-day trial gives Pro access
const TRIAL_DAYS = 7;

// Admin emails always get Pro
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export function attachTier(req: TieredRequest, _res: Response, next: NextFunction) {
  if (!req.userId) {
    req.tier = 'free';
    next();
    return;
  }

  const user = db.prepare(
    'SELECT email, subscription_status, created_at FROM users WHERE id = ?'
  ).get(req.userId) as { email: string; subscription_status: string; created_at: string } | undefined;

  if (!user) {
    req.tier = 'free';
    next();
    return;
  }

  // Admin override
  if (ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    req.tier = 'pro';
    next();
    return;
  }

  // Check subscription status
  const status = user.subscription_status || 'trial';

  if (status === 'pro') {
    req.tier = 'pro';
  } else if (status === 'plus' || status === 'active') {
    req.tier = 'plus';
  } else if (status === 'trial') {
    // 7-day trial = Pro access
    const createdAt = new Date(user.created_at);
    const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    req.trialDaysLeft = Math.max(0, TRIAL_DAYS - daysSinceCreation);

    if (req.trialDaysLeft > 0) {
      req.tier = 'pro'; // Trial users get full Pro access
    } else {
      req.tier = 'free'; // Trial expired
    }
  } else {
    req.tier = 'free';
  }

  next();
}

export function requirePlus(req: TieredRequest, res: Response, next: NextFunction) {
  if (req.tier === 'free') {
    res.status(403).json({
      error: 'upgrade_required',
      tier: 'plus',
      message: 'This feature requires a Plus or Pro subscription.',
      upgradeUrl: '/pricing',
    });
    return;
  }
  next();
}

export function requirePro(req: TieredRequest, res: Response, next: NextFunction) {
  if (req.tier !== 'pro') {
    res.status(403).json({
      error: 'upgrade_required',
      tier: 'pro',
      message: 'This feature requires a Pro subscription.',
      upgradeUrl: '/pricing',
    });
    return;
  }
  next();
}

export function getTierLimits(tier: Tier) {
  return TIER_LIMITS[tier];
}
