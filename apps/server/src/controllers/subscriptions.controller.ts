import { Request, Response, NextFunction } from 'express';
import * as subscriptionService from '../services/subscription.service.js';

export async function listSubscriptions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const subscriptions = await subscriptionService.getAll(userId);

    res.status(200).json({ data: subscriptions });
  } catch (error) {
    next(error);
  }
}

export async function getSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const subscription = await subscriptionService.getById(userId, id);

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    res.status(200).json({ data: subscription });
  } catch (error) {
    next(error);
  }
}

export async function classifySubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { action, keep_until, keep_reason } = req.body;

    const validActions = ['safe_list', 'cancel', 'dismiss'];
    if (!action || !validActions.includes(action)) {
      res.status(400).json({
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
      });
      return;
    }

    const result = await subscriptionService.classify(userId, id, action, keep_until, keep_reason);

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function getCancelGuide(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const guide = await subscriptionService.getCancelGuide(id);

    if (!guide) {
      res.status(404).json({ error: 'Cancel guide not found' });
      return;
    }

    res.status(200).json({ data: guide });
  } catch (error) {
    next(error);
  }
}

export async function detect(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const result = await subscriptionService.triggerDetection(userId);

    res.status(202).json({ data: result });
  } catch (error) {
    next(error);
  }
}
