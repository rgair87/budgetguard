import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as accountsController from '../controllers/accounts.controller.js';

export const accountRoutes = Router();

accountRoutes.use(authenticate);

accountRoutes.get('/', accountsController.listAccounts);
accountRoutes.get('/:id', accountsController.getAccount);
accountRoutes.delete('/:id', accountsController.unlinkAccount);
accountRoutes.post('/:id/refresh', accountsController.refreshBalance);
