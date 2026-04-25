// ─────────────────────────────────────────────────────────────
// Studio cloud sync — debounced upsert of editor content.
// Schema: studio_content (user_id PK, content_html, char_count, version, updated_at)
// GET  /api/sync/studio  → { content_html, char_count, version, updated_at }
// POST /api/sync/studio  → upsert { content_html }
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/supabase-auth');
const { userClient } = require('../lib/supabase');

const MAX_CONTENT_LENGTH = 500_000; // 500 KB safety cap

router.get('/studio', requireAuth, async (req, res) => {
  try {
    const uc = userClient(req.token);
    const { data, error } = await uc
      .from('studio_content')
      .select('content_html, char_count, version, updated_at')
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    res.json(data || { content_html: '', char_count: 0, version: 1, updated_at: null });
  } catch (err) {
    console.error('[sync/studio GET]', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du Studio.' });
  }
});

router.post('/studio', requireAuth, async (req, res) => {
  // Accept either {content_html} or legacy {content} from older clients
  const body = req.body || {};
  const html = typeof body.content_html === 'string'
    ? body.content_html
    : (typeof body.content === 'string' ? body.content : '');
  if (typeof html !== 'string') {
    return res.status(400).json({ error: 'Format invalide.' });
  }
  if (html.length > MAX_CONTENT_LENGTH) {
    return res.status(413).json({ error: 'Contenu trop volumineux.' });
  }
  const charCount = html.replace(/<[^>]*>/g, '').length;

  try {
    const uc = userClient(req.token);
    const { data, error } = await uc
      .from('studio_content')
      .upsert(
        {
          user_id: req.user.id,
          content_html: html,
          char_count: charCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('updated_at, version, char_count')
      .single();
    if (error) throw error;
    res.json({ ok: true, updated_at: data.updated_at, version: data.version, char_count: data.char_count });
  } catch (err) {
    console.error('[sync/studio POST]', err);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde.' });
  }
});

module.exports = router;
