import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as userController from '../controllers/user.controller.js';

export const userRoutes = Router();

userRoutes.use(authenticate);

userRoutes.get('/profile', userController.getProfile);
userRoutes.patch('/profile', userController.updateProfile);
userRoutes.get('/dashboard', userController.getDashboard);
