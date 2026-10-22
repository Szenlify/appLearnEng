import { Hono } from 'hono';
import { supabaseAdmin } from '../lib/supabase';

export const revenueCatRoutes = new Hono();

revenueCatRoutes.post('/api/v1/revenuecat/webhook', async (c) => {
  const authHeader = c.req.header('Authorization');
  const expectedAuth = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;

  // Verify webhook authorization header configured in RevenueCat dashboard
  if (expectedAuth && authHeader !== expectedAuth) {
    return c.json({ error: 'Unauthorized webhook' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const event = body.event;
  if (!event) return c.json({ received: false }, 400);

  const userId = event.app_user_id;
  const eventType = event.type; // INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION
  const productId = event.product_id || '';

  // Determine plan tier from product ID
  let planTier: 'free' | 'pro' | 'master' = 'free';
  if (productId.includes('master')) planTier = 'master';
  else if (productId.includes('pro')) planTier = 'pro';

  let status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'inactive' = 'inactive';
  if (eventType === 'INITIAL_PURCHASE' || eventType === 'RENEWAL') {
    status = event.period_type === 'TRIAL' ? 'trialing' : 'active';
  } else if (eventType === 'CANCELLATION') {
    status = 'canceled';
  } else if (eventType === 'EXPIRATION') {
    status = 'inactive';
    planTier = 'free';
  }

  // Update Supabase user_subscriptions table
  if (userId) {
    await supabaseAdmin
      .from('user_subscriptions')
      .upsert(
        {
          user_id: userId,
          revenuecat_app_user_id: userId,
          plan_tier: planTier,
          status,
          product_identifier: productId,
          current_period_start: event.purchased_at_ms
            ? new Date(event.purchased_at_ms).toISOString()
            : null,
          current_period_end: event.expiration_at_ms
            ? new Date(event.expiration_at_ms).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
  }

  return c.json({ received: true }, 200);
});
