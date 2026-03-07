import { Request, Response, NextFunction } from 'express';
import * as plaidService from '../services/plaid.service.js';

export async function createLinkToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const linkToken = await plaidService.createLinkToken(userId);

    res.status(200).json({ data: linkToken });
  } catch (error) {
    next(error);
  }
}

export async function exchangeToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { public_token, metadata } = req.body;

    if (!public_token) {
      res.status(400).json({
        error: 'Missing required field: public_token',
      });
      return;
    }

    const accounts = await plaidService.exchangePublicToken(
      userId,
      public_token,
      metadata
    );

    res.status(200).json({ data: accounts });
  } catch (error) {
    next(error);
  }
}

export async function handleWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const webhookPayload = req.body;

    await plaidService.handleWebhook(webhookPayload);

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
}
