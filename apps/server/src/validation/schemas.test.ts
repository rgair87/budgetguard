import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createGoalSchema,
  addToGoalSchema,
  deleteAccountSchema,
} from './schemas';

describe('loginSchema', () => {
  it('accepts valid email and password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts valid email and password with 8+ chars', () => {
    const result = registerSchema.safeParse({ email: 'user@example.com', password: 'longpassword' });
    expect(result.success).toBe(true);
  });

  it('rejects password under 8 chars', () => {
    const result = registerSchema.safeParse({ email: 'user@example.com', password: 'short' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].path).toContain('password');
    }
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({ email: 'bad', password: 'longpassword' });
    expect(result.success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'nope' });
    expect(result.success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid UUID token and password', () => {
    const result = resetPasswordSchema.safeParse({
      token: '550e8400-e29b-41d4-a716-446655440000',
      password: 'newpassword123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID token', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'not-a-uuid',
      password: 'newpassword123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].path).toContain('token');
    }
  });

  it('rejects short password', () => {
    const result = resetPasswordSchema.safeParse({
      token: '550e8400-e29b-41d4-a716-446655440000',
      password: 'short',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].path).toContain('password');
    }
  });
});

describe('createGoalSchema', () => {
  it('accepts valid goal data with name and target_amount', () => {
    const result = createGoalSchema.safeParse({ name: 'Emergency Fund', target_amount: 5000 });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createGoalSchema.safeParse({ name: '', target_amount: 5000 });
    expect(result.success).toBe(false);
  });

  it('rejects negative target_amount', () => {
    const result = createGoalSchema.safeParse({ name: 'Fund', target_amount: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects zero target_amount', () => {
    const result = createGoalSchema.safeParse({ name: 'Fund', target_amount: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts optional deadline and icon', () => {
    const result = createGoalSchema.safeParse({
      name: 'Vacation',
      target_amount: 3000,
      deadline: '2026-12-31',
      icon: 'plane',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deadline).toBe('2026-12-31');
      expect(result.data.icon).toBe('plane');
    }
  });

  it('accepts optional current_amount', () => {
    const result = createGoalSchema.safeParse({
      name: 'Car',
      target_amount: 20000,
      current_amount: 500,
    });
    expect(result.success).toBe(true);
  });
});

describe('addToGoalSchema', () => {
  it('accepts positive amount', () => {
    const result = addToGoalSchema.safeParse({ amount: 100 });
    expect(result.success).toBe(true);
  });

  it('rejects zero amount', () => {
    const result = addToGoalSchema.safeParse({ amount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const result = addToGoalSchema.safeParse({ amount: -50 });
    expect(result.success).toBe(false);
  });
});

describe('deleteAccountSchema', () => {
  it('accepts non-empty password', () => {
    const result = deleteAccountSchema.safeParse({ password: 'mypassword' });
    expect(result.success).toBe(true);
  });

  it('rejects empty password', () => {
    const result = deleteAccountSchema.safeParse({ password: '' });
    expect(result.success).toBe(false);
  });
});
