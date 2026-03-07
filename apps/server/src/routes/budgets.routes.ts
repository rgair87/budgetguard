import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as budgetsController from '../controllers/budgets.controller.js';

export const budgetRoutes = Router();

budgetRoutes.use(authenticate);

budgetRoutes.get('/', budgetsController.listBudgets);
budgetRoutes.post('/', budgetsController.createBudget);
budgetRoutes.post('/generate', budgetsController.generateBudget);
budgetRoutes.get('/generate/history', budgetsController.getGenerationHistory);
budgetRoutes.post('/suggestions', budgetsController.getSmartSuggestions);
budgetRoutes.get('/:id', budgetsController.getBudget);
budgetRoutes.patch('/:id', budgetsController.updateBudget);
budgetRoutes.delete('/:id', budgetsController.deleteBudget);
