import PgBoss from 'pg-boss';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let boss: PgBoss;

export function getBoss(): PgBoss {
  if (!boss) {
    throw new Error('pg-boss not initialized. Call initJobRunner() first.');
  }
  return boss;
}

export async function initJobRunner() {
  boss = new PgBoss(env.DATABASE_URL);

  boss.on('error', (error) => {
    logger.error(error, 'pg-boss error');
  });

  await boss.start();
  logger.info('pg-boss job runner started');

  // Create queues (required in pg-boss v10+)
  await boss.createQueue('sync-transactions');
  await boss.createQueue('detect-subscriptions');
  await boss.createQueue('generate-budgets');
  await boss.createQueue('send-subscription-alerts');
  await boss.createQueue('sync-transactions-fallback');

  // Register job handlers (lazy import to avoid circular deps)
  const { handleSyncTransactions } = await import('./syncTransactions.job.js');
  const { handleDetectSubscriptions } = await import('./detectSubscriptions.job.js');
  const { handleGenerateBudgets } = await import('./generateBudgets.job.js');
  const { handleSendAlerts } = await import('./sendAlerts.job.js');

  await boss.work('sync-transactions', handleSyncTransactions);
  await boss.work('detect-subscriptions', handleDetectSubscriptions);
  await boss.work('generate-budgets', handleGenerateBudgets);
  await boss.work('send-subscription-alerts', handleSendAlerts);

  // Schedule recurring jobs
  await boss.schedule('send-subscription-alerts', '0 9,18 * * *'); // 9 AM and 6 PM
  await boss.schedule('sync-transactions-fallback', '0 */4 * * *'); // Every 4 hours

  logger.info('Background jobs registered and scheduled');
}

export async function enqueueJob(name: string, data: any, options?: PgBoss.SendOptions) {
  const jobId = await getBoss().send(name, data, options);
  logger.info({ jobId, jobName: name }, 'Job enqueued');
  return jobId;
}
