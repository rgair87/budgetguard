import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import db from '../config/db';

export type Tier = 'free' | 'pro';

export interface TieredRequest extends AuthRequest {
  tier?: Tier;
}

// Tier limits
export const TIER_LIMITS = {
  free: {
    chatMessagesPerDay: 15,
    csvAccounts: 3,
    advisorRefreshDays: 14, // biweekly refresh
    calendarMonthsForward: 2,
    canUseTeller: false,
    canExport: false,
    canEditTransactions: true,
    canDismissSubscriptions: false,
    goalsLimit: 3,
    canNegotiate: true,
    canViewTrends: true,
    canViewPredictions: true,
    canCreateFamily: false,
  },
  pro: {
    chatMessagesPerDay: 50,
    csvAccounts: 999,
    advisorRefreshDays: 7, // weekly refresh
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
  },
} as const;

export function attachTier(req: TieredRequest, _res: Response, next: NextFunction) {
  if (!req.userId) {
    req.tier = 'free';
    next();
    return;
  }

  const user = db.prepare(
    'SELECT subscription_status FROM users WHERE id = ?'
  ).get(req.userId) as { subscription_status: string } | undefined;

  req.tier = (user?.subscription_status === 'active') ? 'pro' : 'free';
  next();
}

export function requirePro(req: TieredRequest, res: Response, next: NextFunction) {
  if (req.tier !== 'pro') {
    res.status(403).json({
      error: 'upgrade_required',
      message: 'This feature requires a Pro subscription.',
      upgradeUrl: '/settings',
    });
    return;
  }
  next();
}

export function getTierLimits(tier: Tier) {
  return TIER_LIMITS[tier];
}
