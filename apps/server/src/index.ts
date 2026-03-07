import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { authRoutes } from './routes/auth.routes.js';
import { accountRoutes } from './routes/accounts.routes.js';
import { transactionRoutes } from './routes/transactions.routes.js';
import { subscriptionRoutes } from './routes/subscriptions.routes.js';
import { budgetRoutes } from './routes/budgets.routes.js';
import { notificationRoutes } from './routes/notifications.routes.js';
import { plaidRoutes } from './routes/plaid.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { initJobRunner } from './jobs/jobRunner.js';

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: [env.WEB_URL],
  credentials: true,
}));

// Logging
app.use(pinoHttp({ logger }));

// Body parsing
app.use(express.json({ limit: '10kb' }));

// Rate limiting
app.use('/api/', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/plaid', plaidRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/user', userRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Initialize background job runner
    await initJobRunner();

    app.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`);
    });
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
}

start();
