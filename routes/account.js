// ─────────────────────────────────────────────────────────────
// Account management routes
//   PATCH  /api/account/profile  → update name (+ optional year/specialty)
//   DELETE /api/account          → supprime le compte (RGPD)
//                                  CASCADE supprime profile/docs/cartes/notes/etc.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/supabase-auth');
const { supabaseAdmin, userClient } = require('../lib/supabase');

// PATCH /api/account/profile — met à jour le nom (et optionnellement l'année/spé)
router.patch('/profile', requireAuth, async (req, res) => {
  const body = req.body || {};
  const updates = {};
  if (typeof body.name === 'string') updates.name = body.name.trim().slice(0, 80) || null;
  if (typeof body.year === 'string') updates.year = body.year.trim().slice(0, 8) || null;
  if (typeof body.specialty === 'string') updates.specialty = body.specialty.trim().slice(0, 80) || null;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour.' });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase non configuré' });

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, name, year, specialty')
      .single();
    if (error) throw error;

    // Met aussi à jour le metadata auth.users (utilisé pour l'affichage du nom dans le badge)
    if (updates.name !== undefined) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
          user_metadata: { name: updates.name }
        });
      } catch (e) {
        console.warn('[account/profile] meta update failed', e.message);
      }
    }

    res.json({ ok: true, profile: data });
  } catch (err) {
    console.error('[account/profile PATCH]', err);
    res.status(500).json({ error: 'Erreur de mise à jour du profil.' });
  }
});

// DELETE /api/account — supprime définitivement le compte (RGPD)
router.delete('/', requireAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase non configuré' });

  // Confirmation explicite par texte (anti-suppression accidentelle)
  const confirm = (req.body && req.body.confirm) || '';
  if (confirm !== 'SUPPRIMER') {
    return res.status(400).json({ error: 'Confirmation manquante. Tape "SUPPRIMER" pour confirmer.' });
  }

  try {
    // Le CASCADE en DB supprime profile/docs/cartes/notes/etc.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.user.id);
    if (error) throw error;
    res.json({ ok: true, deleted: req.user.id });
  } catch (err) {
    console.error('[account DELETE]', err);
    res.status(500).json({ error: 'Erreur de suppression du compte.' });
  }
});

module.exports = router;
