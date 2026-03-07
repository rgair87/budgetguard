import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service.js';
import * as accountService from '../services/plaid.service.js';
import * as budgetService from '../services/budget.service.js';
import * as subscriptionService from '../services/subscription.service.js';
import * as notificationService from '../services/notification.service.js';

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const profile = await userService.getProfile(userId);

    if (!profile) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ profile });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const updates = req.body;

    const profile = await userService.updateProfile(userId, updates);

    res.status(200).json({ profile });
  } catch (error) {
    next(error);
  }
}

export async function getDashboard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const [accounts, budgets, subscriptions, notifications] =
      await Promise.all([
        accountService.getAccounts(userId),
        budgetService.getActive(userId),
        subscriptionService.getAll(userId),
        notificationService.getAll(userId, { page: 1, limit: 5 }),
      ]);

    res.status(200).json({
      dashboard: {
        accounts,
        budgets,
        subscriptions,
        recentNotifications: notifications,
      },
    });
  } catch (error) {
    next(error);
  }
}
