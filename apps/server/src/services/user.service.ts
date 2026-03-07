import { query } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export async function getProfile(userId: string) {
  const result = await query(
    `SELECT
       id, email, first_name, last_name,
       notification_preferences,
       created_at, updated_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const user = result.rows[0];

  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    notificationPreferences: user.notification_preferences,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export async function updateProfile(
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }
) {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.firstName !== undefined) {
    setClauses.push(`first_name = $${paramIndex}`);
    params.push(data.firstName);
    paramIndex++;
  }

  if (data.lastName !== undefined) {
    setClauses.push(`last_name = $${paramIndex}`);
    params.push(data.lastName);
    paramIndex++;
  }

  if (data.email !== undefined) {
    setClauses.push(`email = $${paramIndex}`);
    params.push(data.email.toLowerCase().trim());
    paramIndex++;
  }

  if (params.length === 0) {
    return getProfile(userId);
  }

  params.push(userId);

  const result = await query(
    `UPDATE users SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, email, first_name, last_name,
       notification_preferences, created_at, updated_at`,
    params
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  const user = result.rows[0];

  logger.info({ userId }, 'User profile updated');

  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    notificationPreferences: user.notification_preferences,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}
