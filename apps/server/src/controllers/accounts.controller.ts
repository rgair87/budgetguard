import { Request, Response, NextFunction } from 'express';
import * as accountService from '../services/plaid.service.js';

export async function listAccounts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const accounts = await accountService.getAccounts(userId);

    res.status(200).json({ data: accounts });
  } catch (error) {
    next(error);
  }
}

export async function getAccount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const account = await accountService.getAccount(userId, id);

    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    res.status(200).json({ data: account });
  } catch (error) {
    next(error);
  }
}

export async function unlinkAccount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    await accountService.unlinkAccount(userId, id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function refreshBalance(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const account = await accountService.refreshBalance(userId, id);

    res.status(200).json({ data: account });
  } catch (error) {
    next(error);
  }
}
