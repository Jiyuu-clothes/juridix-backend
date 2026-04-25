// ─────────────────────────────────────────────────────────────
// Stripe Checkout + Webhook
// ─────────────────────────────────────────────────────────────
// POST /api/stripe/checkout — create Checkout session (RUSH or ROUTINE)
// POST /api/stripe/webhook  — Stripe webhook (raw body) → set is_premium=true
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/supabase-auth');
const { supabaseAdmin } = require('../lib/supabase');

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PRICE_RUSH = process.env.STRIPE_PRICE_ID_RUSH;
const PRICE_ROUTINE = process.env.STRIPE_PRICE_ID_ROUTINE;
const RUSH_CUTOFF = process.env.RUSH_CUTOFF_DATE || '2026-06-01';
const RUSH_EXPIRY = process.env.RUSH_ACCESS_EXPIRY || '2026-06-30';

const stripe = STRIPE_KEY ? require('stripe')(STRIPE_KEY) : null;

// ─────────────── Checkout ───────────────
// Body (optional): { mode: 'RUSH' | 'ROUTINE' } → overrides env CONFIG_MODE so the
// user can pick a formula from the account dashboard. Defaults to env.
router.post('/checkout', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe non configuré.' });

  const envMode = (process.env.CONFIG_MODE || 'RUSH').toUpperCase();
  const requested = (req.body && req.body.mode || '').toString().toUpperCase();
  const configMode = (requested === 'RUSH' || requested === 'ROUTINE') ? requested : envMode;

  // Hard cutoff: after RUSH_CUTOFF_DATE, RUSH purchase is no longer worth it
  const now = new Date();
  if (configMode === 'RUSH' && now >= new Date(RUSH_CUTOFF)) {
    return res.status(410).json({ error: 'La session de révision est terminée. Reviens en septembre.' });
  }

  const priceId = configMode === 'RUSH' ? PRICE_RUSH : PRICE_ROUTINE;
  if (!priceId) return res.status(503).json({ error: 'Prix Stripe non configuré.' });

  const origin = req.headers.origin || `http://localhost:${process.env.PORT || 3000}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: configMode === 'RUSH' ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: req.user.email,
      client_reference_id: req.user.id,
      metadata: {
        user_id: req.user.id,
        config_mode: configMode,
      },
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancel`,
      allow_promotion_codes: true,
    });
    res.json({ url: session.url, mode: configMode });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    res.status(500).json({ error: 'Erreur Stripe Checkout.' });
  }
});

// ─────────────── Customer Portal ───────────────
// Creates a Stripe Billing Portal session so the user can manage their
// payment method, view invoices, cancel/resume the subscription, etc.
router.post('/portal', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe non configuré.' });
  if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });

  const origin = req.headers.origin || `http://localhost:${process.env.PORT || 3000}`;

  try {
    // 1) Find the user's Stripe customer id (set by the checkout webhook)
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', req.user.id)
      .maybeSingle();
    if (error) throw error;

    let customerId = profile?.stripe_customer_id;

    // 2) Fallback: lookup by email if we don't have it stored
    //    (covers users whose webhook didn't run yet, or older profiles)
    if (!customerId && req.user.email) {
      const list = await stripe.customers.list({ email: req.user.email, limit: 1 });
      if (list.data && list.data.length > 0) {
        customerId = list.data[0].id;
        // Persist for next time
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
          .eq('id', req.user.id);
      }
    }

    if (!customerId) {
      return res.status(404).json({ error: 'Aucun paiement trouvé. Achète d\'abord un pass.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/?from=portal`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/portal]', err);
    res.status(500).json({ error: err.message || 'Erreur Stripe Portal.' });
  }
});

// ─────────────── Webhook (raw body) ───────────────
// IMPORTANT: this route must be mounted BEFORE express.json() in server.js
// OR use express.raw() locally — we use express.raw on this router below.
const webhookRouter = express.Router();
webhookRouter.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !WEBHOOK_SECRET) return res.status(503).send('Stripe non configuré');
  if (!supabaseAdmin) return res.status(503).send('Supabase non configuré');

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe/webhook] bad signature', err.message);
    return res.status(400).send(`Webhook signature invalid: ${err.message}`);
  }

  // Idempotence: insert into stripe_events; on duplicate PK, exit early
  try {
    const { error: insErr } = await supabaseAdmin
      .from('stripe_events')
      .insert({ event_id: event.id, type: event.type, payload: event });
    if (insErr) {
      // duplicate key → already processed
      if (insErr.code === '23505') {
        return res.json({ received: true, duplicate: true });
      }
      console.error('[stripe/webhook] dedupe insert error', insErr);
    }
  } catch (e) {
    console.error('[stripe/webhook] dedupe', e);
  }

  // Process event
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.user_id;
      const configMode = session.metadata?.config_mode || 'RUSH';
      if (!userId) {
        console.warn('[stripe/webhook] no user_id in session', session.id);
        return res.json({ received: true });
      }

      // Determine premium expiry
      const expiry = configMode === 'RUSH'
        ? new Date(RUSH_EXPIRY).toISOString()
        : null; // for ROUTINE, expiry comes from subscription events

      const update = {
        is_premium: true,
        config_mode_purchased: configMode,
        stripe_customer_id: session.customer || null,
        stripe_subscription_id: session.subscription || null,
        stripe_subscription_status: session.subscription ? 'active' : null,
        ...(expiry ? { premium_expiry: expiry } : {}),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from('profiles')
        .update(update)
        .eq('id', userId);
      if (error) console.error('[stripe/webhook] profile update', error);
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const customerId = sub.customer;
      const status = sub.status;
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
      const isPremium = ['active', 'trialing', 'past_due'].includes(status);

      const update = {
        stripe_subscription_status: status,
        is_premium: isPremium,
        ...(periodEnd ? { premium_expiry: periodEnd } : {}),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabaseAdmin
        .from('profiles')
        .update(update)
        .eq('stripe_customer_id', customerId);
      if (error) console.error('[stripe/webhook] sub update', error);
    }
  } catch (err) {
    console.error('[stripe/webhook] processing error', err);
  }

  res.json({ received: true });
});

module.exports = { router, webhookRouter };
