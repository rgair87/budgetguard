import { Router } from 'express';
import { validate } from '../middleware/validateRequest.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/auth.js';
import { registerSchema, loginSchema } from '@budgetguard/shared/validation/auth.schema.js';
import * as authController from '../controllers/auth.controller.js';

export const authRoutes = Router();

authRoutes.post('/register', authLimiter, validate(registerSchema), authController.register);
authRoutes.post('/login', authLimiter, validate(loginSchema), authController.login);
authRoutes.post('/refresh', authLimiter, authController.refresh);
authRoutes.post('/logout', authenticate, authController.logout);
