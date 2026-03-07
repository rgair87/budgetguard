import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service.js';

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

    res.status(200).json({ data: profile });
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

    res.status(200).json({ data: profile });
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

    const summary = await userService.getDashboardSummary(userId);

    res.status(200).json({ data: summary });
  } catch (error) {
    next(error);
  }
}
