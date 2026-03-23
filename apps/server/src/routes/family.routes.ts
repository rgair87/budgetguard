import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  createFamily,
  getFamily,
  inviteMember,
  acceptInvite,
  removeMember,
  leaveFamily,
} from '../services/family.service';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const family = getFamily(req.userId!);
    res.json({ family });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    const family = createFamily(req.userId!, name);
    res.status(201).json(family);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/invite', (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }
    const member = inviteMember(req.userId!, email);
    res.status(201).json(member);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/accept', (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }
    const member = acceptInvite(token, req.userId!);
    res.json(member);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/members/:id', (req: AuthRequest, res: Response) => {
  try {
    removeMember(req.userId!, req.params.id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/leave', (req: AuthRequest, res: Response) => {
  try {
    leaveFamily(req.userId!);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
