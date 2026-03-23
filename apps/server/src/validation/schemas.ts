import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8),
});

export const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  target_amount: z.number().positive(),
  current_amount: z.number().optional(),
  deadline: z.string().optional(),
  icon: z.string().optional(),
});

export const addToGoalSchema = z.object({
  amount: z.number().positive(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1),
});
