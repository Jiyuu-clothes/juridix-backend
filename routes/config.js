// ─────────────────────────────────────────────────────────────
// GET /api/config — Public bootstrap config for the frontend.
// Returns Supabase publishable URL/key + tarifaire mode + cutoffs.
// NEVER exposes secret keys.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const mode = (process.env.CONFIG_MODE || 'RUSH').toUpperCase();
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    configMode: mode, // 'RUSH' or 'ROUTINE'
    rushCutoffDate: process.env.RUSH_CUTOFF_DATE || '2026-06-01',
    rushAccessExpiry: process.env.RUSH_ACCESS_EXPIRY || '2026-06-30',
    actionLimit: 10, // free actions before paywall
    routineResetHours: 4,
    pricing: {
      RUSH: { amount: 9.90, currency: 'eur', label: 'Pass JuriDix — accès jusqu\'au 30 juin' },
      ROUTINE: { amount: 6.00, currency: 'eur', label: 'Abonnement mensuel' },
    },
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
  });
});

module.exports = router;
