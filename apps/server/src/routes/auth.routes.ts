import { Router, Request, Response } from 'express';
import { registerUser, loginUser, verifyEmail, resendVerification, requestPasswordReset, resetPassword, refreshAccessToken, revokeRefreshToken } from '../services/auth.service';
import { AuthRequest, authenticate } from '../middleware/auth';
import { loadDemoData } from '../services/demo.service';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../validation/schemas';
import { invalidateUserCache } from '../utils/cache';
import db from '../config/db';

const router = Router();

router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await registerUser(email, password);
    res.status(201).json(result);
  } catch (err: any) {
    if (err.message === 'Email already registered') {
      res.status(409).json({ error: 'conflict', message: err.message });
      return;
    }
    throw err;
  }
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'Invalid credentials') {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid email or password' });
      return;
    }
    throw err;
  }
});

router.get('/verify-email', (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token) {
    res.status(400).json({ error: 'validation', message: 'Token is required' });
    return;
  }
  const result = verifyEmail(token);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/resend-verification', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'validation', message: 'Email is required' });
    return;
  }
  const result = resendVerification(email);
  res.json(result);
});

router.post('/forgot-password', validate(forgotPasswordSchema), async (req: Request, res: Response) => {
  const { email } = req.body;
  await requestPasswordReset(email);
  res.json({ message: 'If an account exists with that email, a reset link has been sent' });
});

router.post('/reset-password', validate(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    await resetPassword(token, password);
    res.json({ message: 'Password has been reset successfully' });
  } catch (err: any) {
    if (err.message === 'Invalid or expired reset token') {
      res.status(400).json({ error: 'invalid_token', message: err.message });
      return;
    }
    throw err;
  }
});

router.post('/refresh', (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'validation', message: 'refreshToken is required' });
      return;
    }
    const result = refreshAccessToken(refreshToken);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: 'unauthorized', message: err.message });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    revokeRefreshToken(refreshToken);
  }
  res.json({ message: 'Logged out' });
});

// Clear demo/sample data for the logged-in user
router.post('/clear-demo-data', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    db.prepare('DELETE FROM transactions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM accounts WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM incoming_events WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM budgets WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM merchant_categories WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM fixed_expenses WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM ai_cache WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM savings_goals WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
    // Reset paycheck settings so calendar/budget don't show stale numbers
    db.prepare('UPDATE users SET pay_frequency = NULL, next_payday = NULL, take_home_pay = NULL WHERE id = ?').run(userId);
    // Invalidate ALL cached data for this user so pages get fresh results
    invalidateUserCache(userId);
    res.json({ success: true, message: 'Demo data cleared. Add your own accounts to get started!' });
  } catch (err: any) {
    console.error('Clear demo data error:', err);
    res.status(500).json({ error: 'clear_error', message: 'Failed to clear demo data' });
  }
});

// Load demo/sample data for the logged-in user
router.post('/demo-data', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const result = loadDemoData(userId);
    // Invalidate ALL cached data so pages get fresh results on reload
    invalidateUserCache(userId);
    res.json({ success: true, ...result, message: 'Sample data loaded! Explore the app to see all features in action.' });
  } catch (err: any) {
    console.error('Demo data error:', err);
    res.status(500).json({ error: 'demo_error', message: 'Failed to load sample data' });
  }
});

// Mark onboarding as completed
router.post('/complete-onboarding', authenticate, (req: AuthRequest, res: Response) => {
  db.prepare('UPDATE users SET onboarding_completed = 1 WHERE id = ?').run(req.userId!);
  res.json({ success: true });
});

export default router;
