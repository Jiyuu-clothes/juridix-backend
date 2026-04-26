// ─────────────────────────────────────────────────────────────
// POST /api/action — atomic paywall counter via increment_action RPC
// Body: { type: 'search'|'open'|'inject', ref?: string }
// Returns: { allowed: bool, premium: bool, action_count: int, reset?: ISO }
//
// We call the RPC through a USER-scoped client so auth.uid() inside the
// SECURITY DEFINER function resolves to the calling user.
//
// ADMIN BYPASS — emails listed in ADMIN_EMAILS env var (comma-separated)
// reçoivent un accès illimité côté API (premium:true) sans toucher la DB.
// Pratique pour tester la version live sans buter sur le paywall.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/supabase-auth');
const { userClient, supabaseAdmin } = require('../lib/supabase');

// Liste des emails admin (lue à chaque requête pour permettre changement à chaud)
function isAdminEmail(email) {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

router.post('/', requireAuth, async (req, res) => {
  const { type: rawType = 'open', ref = null } = req.body || {};
  // Map frontend types → schema action types (schema accepts: 'search_open' | 'inject')
  const typeMap = { open: 'search_open', search: 'search_open', search_open: 'search_open', inject: 'inject' };
  const type = typeMap[rawType];
  if (!type) {
    return res.status(400).json({ error: 'Type d\'action invalide' });
  }
  // ─── ADMIN BYPASS ───
  if (isAdminEmail(req.user && req.user.email)) {
    return res.json({
      allowed: true,
      premium: true,
      action_count: 0,
      admin: true,
    });
  }
  const configMode = (process.env.CONFIG_MODE || 'RUSH').toUpperCase();

  try {
    const uc = userClient(req.token);
    if (!uc) return res.status(500).json({ error: 'Supabase non configuré' });

    const { data, error } = await uc.rpc('increment_action', {
      p_type: type,
      p_ref: ref,
      p_config_mode: configMode,
    });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[action] RPC error', err);
    res.status(500).json({ error: 'Erreur lors du décompte des actions.' });
  }
});

// GET /api/action/profile — read profile (action_count, premium, etc.)
router.get('/profile', requireAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase non configuré' });
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, is_premium, premium_expiry, action_count, first_action_at, config_mode_purchased, stripe_customer_id, stripe_subscription_id, stripe_subscription_status')
      .eq('id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    // ─── ADMIN BYPASS ─── force le premium côté UI sans toucher à la DB
    if (isAdminEmail(req.user && req.user.email)) {
      const adminProfile = Object.assign({}, data || {}, {
        is_premium: true,
        admin: true,
        action_count: 0,
      });
      return res.json(adminProfile);
    }
    res.json(data || null);
  } catch (err) {
    console.error('[action/profile]', err);
    res.status(500).json({ error: 'Erreur de lecture du profil.' });
  }
});

module.exports = router;
