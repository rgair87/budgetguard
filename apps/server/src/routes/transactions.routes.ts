import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as transactionsController from '../controllers/transactions.controller.js';

export const transactionRoutes = Router();

transactionRoutes.use(authenticate);

transactionRoutes.get('/', transactionsController.listTransactions);
transactionRoutes.get('/summary', transactionsController.getSpendingSummary);
transactionRoutes.get('/search', transactionsController.searchTransactions);
