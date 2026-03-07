import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { webhookLimiter } from '../middleware/rateLimiter.js';
import * as plaidController from '../controllers/plaid.controller.js';

export const plaidRoutes = Router();

plaidRoutes.post('/create-link-token', authenticate, plaidController.createLinkToken);
plaidRoutes.post('/exchange-token', authenticate, plaidController.exchangeToken);
plaidRoutes.post('/webhooks', webhookLimiter, plaidController.handleWebhook);
