import dotenv from 'dotenv';
import path from 'path';

// Try multiple .env locations (server dir + project root)
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
dotenv.config({ override: true }); // also try CWD

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

const isProd = process.env.NODE_ENV === 'production';

function requiredInProd(key: string, fallback: string): string {
  const val = process.env[key];
  if (!val && isProd) throw new Error(`Missing required env var in production: ${key}`);
  return val || fallback;
}

export const env = {
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  ANTHROPIC_API_KEY: required('ANTHROPIC_API_KEY'),
  TELLER_APP_ID: process.env.TELLER_APP_ID || '',
  TELLER_ENV: (process.env.TELLER_ENV || 'development') as 'sandbox' | 'development' | 'production',
  TELLER_CERT_PATH: process.env.TELLER_CERT_PATH || '',
  TELLER_CERTIFICATE: process.env.TELLER_CERTIFICATE || '',   // PEM content as env var (for Railway/Docker)
  TELLER_PRIVATE_KEY: process.env.TELLER_PRIVATE_KEY || '',   // PEM content as env var (for Railway/Docker)
  JWT_SECRET: required('JWT_SECRET'),
  PORT: parseInt(process.env.PORT || '3001', 10),
  CORS_ORIGINS: requiredInProd('CORS_ORIGINS', 'http://localhost:5173'),
  RESEND_API_KEY: requiredInProd('RESEND_API_KEY', ''),
  APP_URL: requiredInProd('APP_URL', 'http://localhost:5173'),
  STRIPE_SECRET_KEY: requiredInProd('STRIPE_SECRET_KEY', ''),
  STRIPE_WEBHOOK_SECRET: requiredInProd('STRIPE_WEBHOOK_SECRET', ''),
  STRIPE_PLUS_PRICE_ID: process.env.STRIPE_PLUS_PRICE_ID || '',
  STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID || '',
  STRIPE_PLUS_ANNUAL_PRICE_ID: process.env.STRIPE_PLUS_ANNUAL_PRICE_ID || '',
  STRIPE_PRO_ANNUAL_PRICE_ID: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || '',
  VITE_STRIPE_PUBLISHABLE_KEY: process.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  SENTRY_DSN: process.env.SENTRY_DSN || '',
};
