import path from 'path';
import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import logger from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter, authLimiter, aiLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth.routes';
import plaidRoutes from './routes/plaid.routes';
import accountsRoutes from './routes/accounts.routes';
import transactionsRoutes from './routes/transactions.routes';
import eventsRoutes from './routes/events.routes';
import runwayRoutes from './routes/runway.routes';
import chatRoutes from './routes/chat.routes';
import cutthisRoutes from './routes/cutthis.routes';
import debtRoutes from './routes/debt.routes';
import csvRoutes from './routes/csv.routes';
import settingsRoutes from './routes/settings.routes';
import advisorRoutes from './routes/advisor.routes';
import alertsRoutes from './routes/alerts.routes';
import goalsRoutes from './routes/goals.routes';
import notificationsRoutes from './routes/notifications.routes';
import predictionsRoutes from './routes/predictions.routes';
import trendsRoutes from './routes/trends.routes';
import negotiateRoutes from './routes/negotiate.routes';
import familyRoutes from './routes/family.routes';

const app = express();

// Trust proxy when behind reverse proxy (Railway, Heroku, etc.)
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(cors({
  origin: env.CORS_ORIGINS.split(','),
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({ method: req.method, url: req.url, status: res.statusCode, ms: Date.now() - start }, 'request');
  });
  next();
});

// Rate limiting
app.use(generalLimiter);

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/plaid', plaidRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/runway', runwayRoutes);
app.use('/api/chat', aiLimiter, chatRoutes);
app.use('/api/cut-this', cutthisRoutes);
app.use('/api/debt', debtRoutes);
app.use('/api/csv', csvRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/advisor', aiLimiter, advisorRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/trends', trendsRoutes);
app.use('/api/negotiate', negotiateRoutes);
app.use('/api/family', familyRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// In production, serve the web app
if (process.env.NODE_ENV === 'production') {
  const webDist = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(webDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`Runway API running on http://localhost:${env.PORT}`);
});
