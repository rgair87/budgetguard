import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import { query, transaction } from '../config/database.js';
import { env } from '../config/env.js';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const BCRYPT_ROUNDS = 12;

const privateKey = fs.readFileSync(env.JWT_PRIVATE_KEY_PATH, 'utf8');
const publicKey = fs.readFileSync(env.JWT_PUBLIC_KEY_PATH, 'utf8');

export { publicKey };

export async function register(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
) {
  const existing = await query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  if (existing.rows.length > 0) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const result = await query<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    created_at: Date;
  }>(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, first_name, last_name, created_at`,
    [email.toLowerCase().trim(), passwordHash, firstName || null, lastName || null]
  );

  const user = result.rows[0];

  const tokens = await generateTokens(user.id);

  logger.info({ userId: user.id }, 'User registered successfully');

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      createdAt: user.created_at,
    },
    ...tokens,
  };
}

export async function login(email: string, password: string) {
  const result = await query<{
    id: string;
    email: string;
    password_hash: string;
    first_name: string | null;
    last_name: string | null;
    created_at: Date;
  }>(
    'SELECT id, email, password_hash, first_name, last_name, created_at FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  if (result.rows.length === 0) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const user = result.rows[0];

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const tokens = await generateTokens(user.id);

  logger.info({ userId: user.id }, 'User logged in successfully');

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      createdAt: user.created_at,
    },
    ...tokens,
  };
}

export async function generateTokens(userId: string) {
  const accessToken = jwt.sign(
    { sub: userId, type: 'access' },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn: env.JWT_ACCESS_EXPIRY,
    }
  );

  const refreshToken = crypto.randomUUID();

  const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, refreshTokenHash, expiresAt]
  );

  return { accessToken, refreshToken };
}

export async function refresh(refreshToken: string) {
  return transaction(async (client) => {
    // Get all non-expired refresh tokens
    const tokensResult = await client.query<{
      id: string;
      user_id: string;
      token_hash: string;
      revoked_at: Date | null;
      expires_at: Date;
    }>(
      `SELECT id, user_id, token_hash, revoked_at, expires_at
       FROM refresh_tokens
       WHERE expires_at > NOW()
       ORDER BY created_at DESC`,
      []
    );

    // Find the matching token by comparing hashes
    let matchedToken: (typeof tokensResult.rows)[0] | null = null;

    for (const row of tokensResult.rows) {
      const isMatch = await bcrypt.compare(refreshToken, row.token_hash);
      if (isMatch) {
        matchedToken = row;
        break;
      }
    }

    if (!matchedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Breach detection: if the matched token was already revoked,
    // someone is reusing a stolen token. Revoke ALL tokens for this user.
    if (matchedToken.revoked_at) {
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [matchedToken.user_id]
      );

      logger.warn(
        { userId: matchedToken.user_id },
        'Refresh token reuse detected — all tokens revoked'
      );

      throw new UnauthorizedError('Refresh token reuse detected. Please log in again.');
    }

    // Check expiry
    if (matchedToken.expires_at < new Date()) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    // Revoke old token
    await client.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1',
      [matchedToken.id]
    );

    // Issue new token pair
    const accessToken = jwt.sign(
      { sub: matchedToken.user_id, type: 'access' },
      privateKey,
      {
        algorithm: 'RS256',
        expiresIn: env.JWT_ACCESS_EXPIRY,
      }
    );

    const newRefreshToken = crypto.randomUUID();
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, BCRYPT_ROUNDS);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [matchedToken.user_id, newRefreshTokenHash, expiresAt]
    );

    logger.info({ userId: matchedToken.user_id }, 'Tokens refreshed');

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  });
}

export async function logout(userId: string, refreshToken: string) {
  const tokensResult = await query<{
    id: string;
    token_hash: string;
  }>(
    `SELECT id, token_hash FROM refresh_tokens
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [userId]
  );

  for (const row of tokensResult.rows) {
    const isMatch = await bcrypt.compare(refreshToken, row.token_hash);
    if (isMatch) {
      await query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1',
        [row.id]
      );

      logger.info({ userId }, 'User logged out');
      return;
    }
  }

  // Token not found or already revoked — still succeed silently
  logger.info({ userId }, 'Logout called but no matching active token found');
}
