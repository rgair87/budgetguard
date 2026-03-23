import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ override: true });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const env = {
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  ANTHROPIC_API_KEY: required('ANTHROPIC_API_KEY'),
  PLAID_CLIENT_ID: required('PLAID_CLIENT_ID'),
  PLAID_SECRET: required('PLAID_SECRET'),
  PLAID_ENV: (process.env.PLAID_ENV || 'sandbox') as 'sandbox' | 'production',
  JWT_SECRET: required('JWT_SECRET'),
  PORT: parseInt(process.env.PORT || '3001', 10),
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:5173',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  APP_URL: process.env.APP_URL || 'http://localhost:5173',
};
