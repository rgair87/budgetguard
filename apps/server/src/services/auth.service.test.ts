import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from '../test/setup';
import {
  registerUser,
  loginUser,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  refreshAccessToken,
  revokeRefreshToken,
  generateRefreshToken,
} from './auth.service';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'SecurePass123!';
const JWT_SECRET = 'test-jwt-secret-key-for-testing';

/** Helper: register a user and return the result */
async function createTestUser(email = TEST_EMAIL, password = TEST_PASSWORD) {
  return registerUser(email, password);
}

// ─── registerUser ────────────────────────────────────────────────────────────

describe('registerUser', () => {
  it('creates user with hashed password, returns token + refreshToken + user without password_hash', async () => {
    const result = await createTestUser();

    // Returns expected shape
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('refreshToken');
    expect(result).toHaveProperty('user');
    expect(result.user).toHaveProperty('id');
    expect(result.user).toHaveProperty('email', TEST_EMAIL);
    expect(result.user).not.toHaveProperty('password_hash');

    // Token is a valid JWT
    const decoded = jwt.verify(result.token, JWT_SECRET) as { userId: string };
    expect(decoded.userId).toBe(result.user.id);

    // Password is hashed in DB (not stored in plain text)
    const row = testDb.prepare('SELECT password_hash FROM users WHERE id = ?').get(result.user.id) as { password_hash: string };
    expect(row.password_hash).not.toBe(TEST_PASSWORD);
    const matches = await bcrypt.compare(TEST_PASSWORD, row.password_hash);
    expect(matches).toBe(true);

    // Refresh token is stored in DB
    const rt = testDb.prepare('SELECT * FROM refresh_tokens WHERE user_id = ?').get(result.user.id) as any;
    expect(rt).toBeTruthy();
    expect(rt.token).toBe(result.refreshToken);
  });

  it('throws on duplicate email', async () => {
    await createTestUser();
    await expect(createTestUser()).rejects.toThrow('Email already registered');
  });
});

// ─── loginUser ───────────────────────────────────────────────────────────────

describe('loginUser', () => {
  beforeEach(async () => {
    await createTestUser();
  });

  it('returns token for valid credentials', async () => {
    const result = await loginUser(TEST_EMAIL, TEST_PASSWORD);

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user.email).toBe(TEST_EMAIL);
    expect(result.user).not.toHaveProperty('password_hash');

    // Token is valid
    const decoded = jwt.verify(result.token, JWT_SECRET) as { userId: string };
    expect(decoded.userId).toBe(result.user.id);
  });

  it('throws on wrong password', async () => {
    await expect(loginUser(TEST_EMAIL, 'WrongPassword!')).rejects.toThrow('Invalid credentials');
  });

  it('throws on non-existent email', async () => {
    await expect(loginUser('nobody@example.com', TEST_PASSWORD)).rejects.toThrow('Invalid credentials');
  });
});

// ─── verifyEmail ─────────────────────────────────────────────────────────────

describe('verifyEmail', () => {
  it('sets email_verified to 1', async () => {
    const { user } = await createTestUser();

    // Get the verification token from DB
    const row = testDb.prepare('SELECT verification_token FROM users WHERE id = ?').get(user.id) as { verification_token: string };
    expect(row.verification_token).toBeTruthy();

    const result = verifyEmail(row.verification_token);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Email verified successfully');

    // Check DB
    const updated = testDb.prepare('SELECT email_verified, verification_token FROM users WHERE id = ?').get(user.id) as any;
    expect(updated.email_verified).toBe(1);
    expect(updated.verification_token).toBeNull();
  });

  it('returns failure for invalid token', () => {
    const result = verifyEmail('invalid-token-that-does-not-exist');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid');
  });
});

// ─── requestPasswordReset ────────────────────────────────────────────────────

describe('requestPasswordReset', () => {
  it('generates reset token for existing user', async () => {
    const { user } = await createTestUser();

    await requestPasswordReset(TEST_EMAIL);

    const row = testDb.prepare('SELECT reset_token, reset_token_expires FROM users WHERE id = ?').get(user.id) as any;
    expect(row.reset_token).toBeTruthy();
    expect(row.reset_token_expires).toBeTruthy();
    // Token should expire in the future
    expect(new Date(row.reset_token_expires).getTime()).toBeGreaterThan(Date.now());
  });

  it('does not throw for non-existent email', async () => {
    await expect(requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();
  });
});

// ─── resetPassword ───────────────────────────────────────────────────────────

describe('resetPassword', () => {
  it('updates password with valid token', async () => {
    const { user } = await createTestUser();

    await requestPasswordReset(TEST_EMAIL);
    const row = testDb.prepare('SELECT reset_token FROM users WHERE id = ?').get(user.id) as { reset_token: string };

    const newPassword = 'NewSecurePass456!';
    await resetPassword(row.reset_token, newPassword);

    // Old password should no longer work
    await expect(loginUser(TEST_EMAIL, TEST_PASSWORD)).rejects.toThrow('Invalid credentials');

    // New password should work
    const result = await loginUser(TEST_EMAIL, newPassword);
    expect(result.user.email).toBe(TEST_EMAIL);

    // Reset token should be cleared
    const updated = testDb.prepare('SELECT reset_token, reset_token_expires FROM users WHERE id = ?').get(user.id) as any;
    expect(updated.reset_token).toBeNull();
    expect(updated.reset_token_expires).toBeNull();
  });

  it('throws on expired token', async () => {
    const { user } = await createTestUser();

    // Manually insert an expired reset token
    const expiredToken = crypto.randomUUID();
    const expiredTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago
    testDb.prepare(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?'
    ).run(expiredToken, expiredTime, user.id);

    await expect(resetPassword(expiredToken, 'NewPass!')).rejects.toThrow('Invalid or expired reset token');
  });

  it('throws on invalid token', async () => {
    await expect(resetPassword('nonexistent-token', 'NewPass!')).rejects.toThrow('Invalid or expired reset token');
  });
});

// ─── refreshAccessToken ──────────────────────────────────────────────────────

describe('refreshAccessToken', () => {
  it('returns new token for valid refresh token', async () => {
    const { refreshToken, user } = await createTestUser();

    const result = refreshAccessToken(refreshToken);
    expect(result).toHaveProperty('token');
    expect(result.user.id).toBe(user.id);
    expect(result.user.email).toBe(TEST_EMAIL);

    // New token is valid
    const decoded = jwt.verify(result.token, JWT_SECRET) as { userId: string };
    expect(decoded.userId).toBe(user.id);
  });

  it('throws on invalid refresh token', () => {
    expect(() => refreshAccessToken('invalid-token')).toThrow('Invalid refresh token');
  });

  it('throws on expired refresh token', async () => {
    const { user } = await createTestUser();

    // Insert an expired refresh token directly
    const expiredToken = crypto.randomUUID();
    testDb.prepare(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
    ).run(crypto.randomUUID(), user.id, expiredToken, new Date(Date.now() - 1000).toISOString());

    expect(() => refreshAccessToken(expiredToken)).toThrow('Refresh token expired');
  });
});

// ─── revokeRefreshToken ──────────────────────────────────────────────────────

describe('revokeRefreshToken', () => {
  it('removes token from DB', async () => {
    const { refreshToken, user } = await createTestUser();

    // Verify it exists
    const before = testDb.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refreshToken);
    expect(before).toBeTruthy();

    revokeRefreshToken(refreshToken);

    // Verify it's gone
    const after = testDb.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refreshToken);
    expect(after).toBeUndefined();
  });

  it('does not throw when revoking non-existent token', () => {
    expect(() => revokeRefreshToken('nonexistent-token')).not.toThrow();
  });
});
