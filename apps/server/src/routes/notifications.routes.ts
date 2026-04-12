import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  syncNotifications,
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  clearOld,
} from '../services/notifications.service';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  syncNotifications(req.userId!);
  const notifications = getNotifications(req.userId!);
  const unreadCount = getUnreadCount(req.userId!);
  res.json({ notifications, unreadCount });
});

router.get('/unread-count', (req: AuthRequest, res: Response) => {
  const count = getUnreadCount(req.userId!);
  res.json({ count });
});

router.post('/read-all', (req: AuthRequest, res: Response) => {
  markAllRead(req.userId!);
  res.json({ ok: true });
});

router.post('/:id/read', (req: AuthRequest, res: Response) => {
  markRead(req.userId!, req.params.id as string);
  res.json({ ok: true });
});

router.delete('/old', (req: AuthRequest, res: Response) => {
  clearOld(req.userId!);
  res.json({ ok: true });
});

export default router;
