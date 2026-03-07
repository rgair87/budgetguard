import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notification.service.js';
import { addClient, removeClient } from '../services/sse.js';

export async function listNotifications(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const result = await notificationService.getAll(userId, {
      page,
      limit,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function markRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    await notificationService.markRead(userId, id);

    res.status(200).json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
}

export async function markAllRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    await notificationService.markAllRead(userId);

    res.status(200).json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
}

export async function dismiss(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    await notificationService.dismiss(userId, id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;
    const preferences = req.body;

    const settings = await notificationService.updateSettings(
      userId,
      preferences
    );

    res.status(200).json({ data: settings });
  } catch (error) {
    next(error);
  }
}

export function streamNotifications(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const userId = req.userId!;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send initial connection confirmation
  res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

  // Register this client
  addClient(userId, res);

  // Send heartbeat ping every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 30_000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(userId, res);
  });
}
