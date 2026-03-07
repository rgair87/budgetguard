import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as notificationsController from '../controllers/notifications.controller.js';

export const notificationRoutes = Router();

notificationRoutes.use(authenticate);

notificationRoutes.get('/', notificationsController.listNotifications);
notificationRoutes.patch('/:id/read', notificationsController.markRead);
notificationRoutes.post('/read-all', notificationsController.markAllRead);
notificationRoutes.patch('/:id/dismiss', notificationsController.dismiss);
notificationRoutes.patch('/settings', notificationsController.updateSettings);
