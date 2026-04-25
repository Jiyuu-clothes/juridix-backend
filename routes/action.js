// ─────────────────────────────────────────────────────────────
// POST /api/action — atomic paywall counter via increment_action RPC
// Body: { type: 'search'|'open'|'inject', ref?: string }
// Returns: { allowed: bool, premium: bool, action_count: int, reset?: ISO }
//
// We call the RPC through a USER-scoped client so auth.uid() inside the
// SECURITY DEFINER function resolves to the calling user.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/supabase-auth');
const { userClient, supabaseAdmin } = require('../lib/supabase');

router.post('/', requireAuth, async (req, res) => {
  const { type: rawType = 'open', ref = null } = req.body || {};
  // Map frontend types → schema action types (schema accepts: 'search_open' | 'inject')
  const typeMap = { open: 'search_open', search: 'search_open', search_open: 'search_open', inject: 'inject' };
  const type = typeMap[rawType];
  if (!type) {
    return res.status(400).json({ error: 'Type d\'action invalide' });
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
      .select('id, is_premium, premium_expiry, action_count, first_action_at, config_mode_purchased')
      .eq('id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    res.json(data || null);
  } catch (err) {
    console.error('[action/profile]', err);
    res.status(500).json({ error: 'Erreur de lecture du profil.' });
  }
});

module.exports = router;
