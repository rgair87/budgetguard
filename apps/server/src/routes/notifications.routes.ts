import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as notificationsController from '../controllers/notifications.controller.js';

export const notificationRoutes = Router();

// SSE stream endpoint (must be before the general authenticate middleware)
notificationRoutes.get('/stream', authenticate, notificationsController.streamNotifications);

notificationRoutes.use(authenticate);

notificationRoutes.get('/', notificationsController.listNotifications);
notificationRoutes.patch('/:id/read', notificationsController.markRead);
notificationRoutes.post('/read-all', notificationsController.markAllRead);
notificationRoutes.patch('/:id/dismiss', notificationsController.dismiss);
notificationRoutes.patch('/settings', notificationsController.updateSettings);
