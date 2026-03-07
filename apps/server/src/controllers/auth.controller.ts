import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({
        error: 'Missing required fields: email, password, firstName, lastName',
      });
      return;
    }

    const tokens = await authService.register({
      email,
      password,
      firstName,
      lastName,
    });

    res.status(201).json(tokens);
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        error: 'Missing required fields: email, password',
      });
      return;
    }

    const tokens = await authService.login({ email, password });

    res.status(200).json(tokens);
  } catch (error) {
    next(error);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken =
      req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      res.status(400).json({
        error: 'Refresh token is required',
      });
      return;
    }

    const tokens = await authService.refresh(refreshToken);

    res.status(200).json(tokens);
  } catch (error) {
    next(error);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const refreshToken =
      req.cookies?.refreshToken || req.body.refreshToken;

    await authService.logout(userId, refreshToken);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
