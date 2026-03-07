import { pool, query } from '../config/database.js';
import { logger } from '../utils/logger.js';
import bcrypt from 'bcryptjs';

async function seed() {
  logger.info('Seeding database...');

  // Create a demo user
  const passwordHash = await bcrypt.hash('Demo1234', 12);
  const userResult = await query(
    `INSERT INTO users (email, password_hash, first_name, last_name, email_verified)
     VALUES ('demo@budgetguard.com', $1, 'Demo', 'User', true)
     ON CONFLICT (email) DO UPDATE SET first_name = 'Demo'
     RETURNING id`,
    [passwordHash]
  );
  const userId = userResult.rows[0].id;
  logger.info({ userId }, 'Demo user created/updated');

  // Create some sample subscriptions
  const subs = [
    { merchant: 'Netflix', amount: 15.99, freq: 'monthly', confidence: 0.95 },
    { merchant: 'Spotify', amount: 10.99, freq: 'monthly', confidence: 0.92 },
    { merchant: 'Adobe Creative Cloud', amount: 54.99, freq: 'monthly', confidence: 0.88 },
    { merchant: 'Amazon Prime', amount: 14.99, freq: 'monthly', confidence: 0.90 },
    { merchant: 'ChatGPT Plus', amount: 20.00, freq: 'monthly', confidence: 0.85 },
    { merchant: 'Gym Membership', amount: 49.99, freq: 'monthly', confidence: 0.80 },
  ];

  for (const sub of subs) {
    await query(
      `INSERT INTO subscriptions (
        user_id, merchant_name, normalized_name, estimated_amount,
        frequency, confidence_score, first_seen_date, last_charge_date,
        total_charges, total_spent, status
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE - INTERVAL '6 months',
        CURRENT_DATE - INTERVAL '5 days', 6, $7, 'detected')
      ON CONFLICT DO NOTHING`,
      [
        userId,
        sub.merchant,
        sub.merchant.toLowerCase().replace(/\s+/g, ' '),
        sub.amount,
        sub.freq,
        sub.confidence,
        sub.amount * 6,
      ]
    );
  }
  logger.info('Sample subscriptions created');

  // Create sample budgets
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const budgets = [
    { name: 'Dining & Restaurants', category: 'FOOD_AND_DRINK', limit: 350, spent: 220 },
    { name: 'Transportation', category: 'TRANSPORTATION', limit: 200, spent: 145 },
    { name: 'Entertainment', category: 'ENTERTAINMENT', limit: 150, spent: 89 },
    { name: 'Shopping', category: 'SHOPPING', limit: 300, spent: 275 },
    { name: 'Subscriptions', category: 'SUBSCRIPTIONS', limit: 170, spent: 166.95 },
  ];

  for (const budget of budgets) {
    await query(
      `INSERT INTO budgets (
        user_id, name, category, amount_limit, amount_spent,
        period, period_start, period_end, is_ai_generated, is_active
      ) VALUES ($1, $2, $3, $4, $5, 'monthly', $6, $7, true, true)
      ON CONFLICT DO NOTHING`,
      [userId, budget.name, budget.category, budget.limit, budget.spent, periodStart, periodEnd]
    );
  }
  logger.info('Sample budgets created');

  // Create sample notifications
  await query(
    `INSERT INTO notifications (user_id, type, title, body, action_url)
     VALUES
       ($1, 'new_subscription', 'New subscription detected: ChatGPT Plus',
        'We found a recurring charge to ChatGPT Plus for ~$20.00/monthly. Tap to keep or cancel.',
        '/subscriptions'),
       ($1, 'budget_alert', 'Shopping budget at 92%',
        'You''ve spent $275 of your $300 shopping budget this month.',
        '/budgets'),
       ($1, 'smart_suggestion', 'Save $65/month on subscriptions',
        'We found 2 subscriptions you might not need. Review your smart savings suggestions.',
        '/suggestions')`,
    [userId]
  );
  logger.info('Sample notifications created');

  logger.info('Seeding complete!');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
