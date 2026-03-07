import { Request, Response, NextFunction } from 'express';
import * as transactionService from '../services/transaction.service.js';

interface TransactionFilters {
  accountId?: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
}

export async function listTransactions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 25;

    const filters: TransactionFilters = {};

    if (req.query.accountId) {
      filters.accountId = req.query.accountId as string;
    }
    if (req.query.category) {
      filters.category = req.query.category as string;
    }
    if (req.query.minAmount) {
      filters.minAmount = parseFloat(req.query.minAmount as string);
    }
    if (req.query.maxAmount) {
      filters.maxAmount = parseFloat(req.query.maxAmount as string);
    }
    if (req.query.startDate) {
      filters.startDate = req.query.startDate as string;
    }
    if (req.query.endDate) {
      filters.endDate = req.query.endDate as string;
    }

    const result = await transactionService.getTransactions(userId, {
      ...filters,
      page,
      limit,
    });

    res.json({ data: result.transactions, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}

export async function getSpendingSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    if (!startDate || !endDate) {
      res.status(400).json({
        error: 'Missing required query params: startDate, endDate',
      });
      return;
    }

    const summary = await transactionService.getSummary(
      userId,
      startDate,
      endDate
    );

    res.status(200).json({ data: summary });
  } catch (error) {
    next(error);
  }
}

export async function searchTransactions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const query = req.query.q as string | undefined;

    if (!query) {
      res.status(400).json({
        error: 'Missing required query param: q',
      });
      return;
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 25;

    const results = await transactionService.search(
      userId,
      query,
      page,
      limit
    );

    res.json({ data: results.transactions, pagination: results.pagination });
  } catch (error) {
    next(error);
  }
}
