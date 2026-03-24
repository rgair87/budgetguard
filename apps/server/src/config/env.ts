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
  TELLER_APP_ID: process.env.TELLER_APP_ID || 'app_pq8bujpq2bv1virlra000',
  TELLER_ENV: (process.env.TELLER_ENV || 'development') as 'sandbox' | 'development' | 'production',
  TELLER_CERT_PATH: process.env.TELLER_CERT_PATH || '',
  TELLER_CERTIFICATE: process.env.TELLER_CERTIFICATE || '',   // PEM content as env var (for Railway/Docker)
  TELLER_PRIVATE_KEY: process.env.TELLER_PRIVATE_KEY || '',   // PEM content as env var (for Railway/Docker)
  JWT_SECRET: required('JWT_SECRET'),
  PORT: parseInt(process.env.PORT || '3001', 10),
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:5173',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  APP_URL: process.env.APP_URL || 'http://localhost:5173',
};
