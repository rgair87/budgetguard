import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getGoals, createGoal, updateGoal, deleteGoal, addToGoal, getGoalInsights, NotFoundError } from '../services/goals.service';
import { validate } from '../middleware/validate';
import { createGoalSchema, addToGoalSchema } from '../validation/schemas';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  const goals = getGoals(req.userId!);
  const insights = getGoalInsights(req.userId!);
  res.json({ goals, insights });
});

router.post('/', validate(createGoalSchema), (req: AuthRequest, res: Response) => {
  const { name, target_amount, current_amount, deadline, icon } = req.body;
  const goal = createGoal(req.userId!, { name, target_amount, current_amount, deadline, icon });
  res.status(201).json(goal);
});

router.patch('/:id', (req: AuthRequest, res: Response) => {
  try {
    const goal = updateGoal(req.userId!, req.params.id as string, req.body);
    res.json(goal);
  } catch (e) {
    if (e instanceof NotFoundError) { res.status(404).json({ error: e.message }); return; }
    throw e;
  }
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  try {
    deleteGoal(req.userId!, req.params.id as string);
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof NotFoundError) { res.status(404).json({ error: e.message }); return; }
    throw e;
  }
});

router.post('/:id/add', validate(addToGoalSchema), (req: AuthRequest, res: Response) => {
  const { amount } = req.body;
  try {
    const goal = addToGoal(req.userId!, req.params.id as string, amount);
    res.json(goal);
  } catch (e) {
    if (e instanceof NotFoundError) { res.status(404).json({ error: e.message }); return; }
    throw e;
  }
});

export default router;
