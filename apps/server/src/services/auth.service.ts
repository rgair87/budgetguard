import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db';
import { env } from '../config/env';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.service';
import type { User } from '@runway/shared';

const USER_SELECT_COLS = 'id, email, subscription_status, pay_frequency, next_payday, take_home_pay, email_verified, created_at';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(userId: string): string {
  // Clean up expired refresh tokens for this user
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < datetime(\'now\')').run(userId);

  const token = crypto.randomUUID();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
  ).run(id, userId, token, expiresAt);

  return token;
}

export function refreshAccessToken(refreshToken: string): { token: string; user: Omit<User, 'password_hash'> } {
  const row = db.prepare(
    'SELECT rt.user_id, rt.expires_at FROM refresh_tokens rt WHERE rt.token = ?'
  ).get(refreshToken) as unknown as { user_id: string; expires_at: string } | undefined;

  if (!row) {
    throw new Error('Invalid refresh token');
  }

  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
    throw new Error('Refresh token expired');
  }

  const user = db.prepare(
    `SELECT ${USER_SELECT_COLS} FROM users WHERE id = ?`
  ).get(row.user_id) as unknown as Omit<User, 'password_hash'> | undefined;

  if (!user) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
    throw new Error('User not found');
  }

  const token = generateAccessToken(user.id);
  return { token, user };
}

export function revokeRefreshToken(refreshToken: string): void {
  db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
}

export async function registerUser(email: string, password: string): Promise<{ token: string; refreshToken: string; user: Omit<User, 'password_hash'> }> {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    throw new Error('Email already registered');
  }

  const hash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();
  const verificationToken = crypto.randomUUID();

  db.prepare(
    'INSERT INTO users (id, email, password_hash, verification_token) VALUES (?, ?, ?, ?)'
  ).run(id, email, hash, verificationToken);

  await sendVerificationEmail(email, verificationToken);

  const user = db.prepare(
    `SELECT ${USER_SELECT_COLS} FROM users WHERE id = ?`
  ).get(id) as unknown as Omit<User, 'password_hash'>;

  const token = generateAccessToken(id);
  const refreshToken = generateRefreshToken(id);
  return { token, refreshToken, user };
}

export async function loginUser(email: string, password: string): Promise<{ token: string; refreshToken: string; user: Omit<User, 'password_hash'> }> {
  const row = db.prepare(
    `SELECT ${USER_SELECT_COLS}, password_hash FROM users WHERE email = ?`
  ).get(email) as unknown as (User | undefined);

  if (!row) {
    throw new Error('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, row.password_hash!);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  const { password_hash, ...safeUser } = row;
  const token = generateAccessToken(row.id);
  const refreshToken = generateRefreshToken(row.id);
  return { token, refreshToken, user: safeUser };
}

export function verifyEmail(token: string): { success: boolean; message: string } {
  const row = db.prepare(
    'SELECT id, email FROM users WHERE verification_token = ?'
  ).get(token) as unknown as { id: string; email: string } | undefined;

  if (!row) {
    return { success: false, message: 'Invalid or expired verification token' };
  }

  db.prepare(
    'UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?'
  ).run(row.id);

  console.log(`[EMAIL VERIFICATION] Email verified for ${row.email}`);
  return { success: true, message: 'Email verified successfully' };
}

export async function resendVerification(email: string): Promise<{ success: boolean; message: string }> {
  const row = db.prepare(
    'SELECT id, email_verified FROM users WHERE email = ?'
  ).get(email) as unknown as { id: string; email_verified: number } | undefined;

  if (!row) {
    return { success: true, message: 'If that email is registered, a verification link has been sent' };
  }

  if (row.email_verified) {
    return { success: false, message: 'Email is already verified' };
  }

  const newToken = crypto.randomUUID();
  db.prepare(
    'UPDATE users SET verification_token = ? WHERE id = ?'
  ).run(newToken, row.id);

  await sendVerificationEmail(email, newToken);

  return { success: true, message: 'If that email is registered, a verification link has been sent' };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as unknown as { id: string } | undefined;
  if (!user) {
    // Don't reveal whether the email exists
    return;
  }

  const resetToken = crypto.randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  db.prepare(
    'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?'
  ).run(resetToken, expires, user.id);

  await sendPasswordResetEmail(email, resetToken);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const user = db.prepare(
    'SELECT id, reset_token_expires FROM users WHERE reset_token = ?'
  ).get(token) as unknown as { id: string; reset_token_expires: string } | undefined;

  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  if (new Date(user.reset_token_expires) < new Date()) {
    db.prepare('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?').run(user.id);
    throw new Error('Invalid or expired reset token');
  }

  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?'
  ).run(hash, user.id);
}
