import { Request, Response, NextFunction } from 'express';
import * as budgetService from '../services/budget.service.js';

export async function listBudgets(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const budgets = await budgetService.getActive(userId);

    res.status(200).json({ data: budgets });
  } catch (error) {
    next(error);
  }
}

export async function getBudget(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const budget = await budgetService.getById(userId, id);

    if (!budget) {
      res.status(404).json({ error: 'Budget not found' });
      return;
    }

    res.status(200).json({ data: budget });
  } catch (error) {
    next(error);
  }
}

export async function createBudget(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { name, category, amount_limit, period } = req.body;

    if (!name || !category || amount_limit == null || !period) {
      res.status(400).json({
        error:
          'Missing required fields: name, category, amount_limit, period',
      });
      return;
    }

    const budget = await budgetService.create(userId, {
      name,
      category,
      amount_limit,
      period,
    });

    res.status(201).json({ data: budget });
  } catch (error) {
    next(error);
  }
}

export async function updateBudget(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const updates = req.body;

    const budget = await budgetService.update(userId, id, updates);

    res.status(200).json({ data: budget });
  } catch (error) {
    next(error);
  }
}

export async function deleteBudget(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    await budgetService.deleteBudget(userId, id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function generateBudget(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const result = await budgetService.triggerGeneration(userId);

    res.status(202).json({ data: { generation_id: result.generationId } });
  } catch (error) {
    next(error);
  }
}

export async function getGenerationHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const history = await budgetService.getGenerationHistory(userId);

    res.status(200).json({ data: history });
  } catch (error) {
    next(error);
  }
}

export async function getSmartSuggestions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const suggestions = await budgetService.getSmartSuggestions(userId);

    res.status(200).json({ data: suggestions });
  } catch (error) {
    next(error);
  }
}
