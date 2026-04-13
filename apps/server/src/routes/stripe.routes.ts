import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { AuthRequest, authenticate } from '../middleware/auth';
import { env } from '../config/env';
import db from '../config/db';
import logger from '../config/logger';

const router = Router();

function getStripe(): InstanceType<typeof Stripe> | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY);
}

/**
 * POST /api/stripe/create-checkout
 * Creates a Stripe Checkout session for the user to subscribe.
 */
router.post('/create-checkout', authenticate, async (req: AuthRequest, res: Response) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(500).json({ error: 'Stripe not configured' });
    return;
  }

  const userId = req.userId!;
  const { tier, interval } = req.body; // tier: 'plus' | 'pro', interval: 'month' | 'year'

  let priceId: string;
  if (interval === 'year') {
    priceId = tier === 'pro' ? env.STRIPE_PRO_ANNUAL_PRICE_ID : env.STRIPE_PLUS_ANNUAL_PRICE_ID;
  } else {
    priceId = tier === 'pro' ? env.STRIPE_PRO_PRICE_ID : env.STRIPE_PLUS_PRICE_ID;
  }
  if (!priceId) {
    res.status(500).json({ error: 'Price not configured for this tier' });
    return;
  }

  const user = db.prepare('SELECT email, stripe_customer_id FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  try {
    // Create or reuse Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, userId);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.APP_URL}/settings?upgraded=true`,
      cancel_url: `${env.APP_URL}/settings?cancelled=true`,
      metadata: { userId, tier },
      subscription_data: {
        metadata: { userId, tier },
      },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Stripe checkout error');
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/stripe/portal
 * Creates a Stripe Customer Portal session for managing subscription.
 */
router.post('/portal', authenticate, async (req: AuthRequest, res: Response) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(500).json({ error: 'Stripe not configured' });
    return;
  }

  const user = db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').get(req.userId!) as any;
  if (!user?.stripe_customer_id) {
    res.status(400).json({ error: 'No subscription found' });
    return;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${env.APP_URL}/settings`,
    });
    res.json({ url: session.url });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Stripe portal error');
    res.status(500).json({ error: 'Failed to open billing portal' });
  }
});

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events for subscription lifecycle.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(500).send('Stripe not configured');
    return;
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: any;

  try {
    // req.body must be the raw buffer for signature verification
    event = stripe.webhooks.constructEvent(
      (req as any).rawBody || req.body,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err: any) {
    logger.error({ err: err.message }, 'Stripe webhook signature error');
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  logger.info({ type: event.type }, 'Stripe webhook received');

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier || 'plus';
      if (userId) {
        const status = tier === 'pro' ? 'pro' : 'plus';
        db.prepare('UPDATE users SET subscription_status = ?, stripe_subscription_id = ? WHERE id = ?')
          .run(status, session.subscription as string, userId);
        logger.info({ userId, status }, 'Stripe checkout completed');
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as any;
      const userId = sub.metadata?.userId;
      if (userId && sub.status === 'active') {
        const tier = sub.metadata?.tier || 'plus';
        const status = tier === 'pro' ? 'pro' : 'plus';
        db.prepare('UPDATE users SET subscription_status = ? WHERE id = ?').run(status, userId);
        logger.info({ userId, status }, 'Stripe subscription updated');
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as any;
      const userId = sub.metadata?.userId;
      if (userId) {
        db.prepare("UPDATE users SET subscription_status = 'trial', stripe_subscription_id = NULL WHERE id = ?")
          .run(userId);
        logger.info({ userId }, 'Stripe subscription cancelled');
      }
      break;
    }

    default:
      logger.debug({ type: event.type }, 'Stripe unhandled event');
  }

  res.json({ received: true });
});

export default router;
