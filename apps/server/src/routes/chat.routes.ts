import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { attachTier, TieredRequest, getTierLimits } from '../middleware/tier';
import { chat, getChatHistory, clearChatHistory } from '../services/chat.service';
import db from '../config/db';

const router = Router();

function getDailyMessageCount(userId: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM chat_messages
     WHERE user_id = ? AND role = 'user'
     AND created_at >= datetime('now', 'start of day')`
  ).get(userId) as unknown as any;
  return row?.count ?? 0;
}

router.get('/history', authenticate, attachTier, (req: TieredRequest, res: Response) => {
  const messages = getChatHistory(req.userId!);
  const used = getDailyMessageCount(req.userId!);
  const limit = getTierLimits(req.tier!).chatMessagesPerDay;
  res.json({ messages, dailyUsage: { used, limit, remaining: Math.max(0, limit - used) } });
});

router.post('/', authenticate, attachTier, async (req: TieredRequest, res: Response) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'validation', message: 'message required' });
    return;
  }

  if (message.length > 2000) {
    res.status(400).json({ error: 'validation', message: 'Message too long (max 2000 characters)' });
    return;
  }

  const limit = getTierLimits(req.tier!).chatMessagesPerDay;
  const used = getDailyMessageCount(req.userId!);
  if (used >= limit) {
    const upgradeMsg = req.tier === 'free'
      ? ' Upgrade to Pro for 50 messages/day.'
      : '';
    res.status(429).json({
      error: 'rate_limit',
      message: `You've used all ${limit} messages for today. Your limit resets at midnight.${upgradeMsg}`,
      dailyUsage: { used, limit, remaining: 0 }
    });
    return;
  }

  try {
    const reply = await chat(req.userId!, message.trim());
    const newUsed = used + 1;
    res.json({ reply, dailyUsage: { used: newUsed, limit, remaining: Math.max(0, limit - newUsed) } });
  } catch (err: any) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'chat_error', message: 'Failed to get AI response' });
  }
});

router.delete('/history', authenticate, (req: TieredRequest, res: Response) => {
  clearChatHistory(req.userId!);
  res.json({ success: true });
});

export default router;
