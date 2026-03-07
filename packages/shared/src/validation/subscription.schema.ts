import { z } from 'zod';

export const classifySubscriptionSchema = z.object({
  action: z.enum(['safe_list', 'cancel', 'dismiss']),
  keepUntil: z.string().datetime().optional(),
  keepReason: z.string().max(255).optional(),
});

export type ClassifySubscriptionInput = z.infer<typeof classifySubscriptionSchema>;
