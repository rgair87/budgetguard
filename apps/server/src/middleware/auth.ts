import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

export interface AuthPayload {
  sub: string;
  type: 'access';
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

let publicKey: string;

function getPublicKey(): string {
  if (!publicKey) {
    publicKey = fs.readFileSync(env.JWT_PUBLIC_KEY_PATH, 'utf-8');
  }
  return publicKey;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, getPublicKey(), {
      algorithms: ['RS256'],
    }) as AuthPayload;

    if (payload.type !== 'access') {
      throw new UnauthorizedError('Invalid token type');
    }

    req.userId = payload.sub;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}
