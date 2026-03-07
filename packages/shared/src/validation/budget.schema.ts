import { z } from 'zod';

export const createBudgetSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  amountLimit: z.number().positive(),
  period: z.enum(['monthly', 'weekly', 'yearly']).default('monthly'),
});

export const updateBudgetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  amountLimit: z.number().positive().optional(),
  alertAtPercent: z.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
