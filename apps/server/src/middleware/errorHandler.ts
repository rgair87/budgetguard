import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import logger from '../config/logger';

const isDev = env.NODE_ENV === 'development';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Always log the full error server-side
  logger.error({ err }, 'Unhandled error');

  // ZodError → 400 with validation details
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'validation_error',
      message: 'Validation failed',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // SyntaxError from bad JSON body
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: 'bad_request',
      message: 'Invalid request body',
    });
    return;
  }

  // Errors with an explicit status/statusCode
  const status =
    (err as any)?.status ?? (err as any)?.statusCode ?? 500;
  const message =
    err instanceof Error ? err.message : 'Internal server error';

  const body: Record<string, unknown> = {
    error: status >= 500 ? 'internal' : 'error',
    message: status >= 500 && !isDev ? 'Internal server error' : message,
  };

  if (isDev && err instanceof Error && err.stack) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}
