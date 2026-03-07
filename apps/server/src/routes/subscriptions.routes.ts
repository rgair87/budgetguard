import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as subscriptionsController from '../controllers/subscriptions.controller.js';

export const subscriptionRoutes = Router();

subscriptionRoutes.use(authenticate);

subscriptionRoutes.get('/', subscriptionsController.listSubscriptions);
subscriptionRoutes.get('/:id', subscriptionsController.getSubscription);
subscriptionRoutes.patch('/:id/classify', subscriptionsController.classifySubscription);
subscriptionRoutes.get('/:id/cancel-guide', subscriptionsController.getCancelGuide);
subscriptionsController.detect && subscriptionRoutes.post('/detect', subscriptionsController.detect);
