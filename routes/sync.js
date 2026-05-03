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

// ─────────────────────────────────────────────────────────────
// ATELIER docs — multi-document
// GET  /api/sync/atelier               → liste des docs (sans HTML pour gain)
// GET  /api/sync/atelier/:id           → un doc complet
// POST /api/sync/atelier               → upsert un doc { id, title, html }
// DEL  /api/sync/atelier/:id           → supprime
// POST /api/sync/atelier/bulk          → import bulk { docs: [...] } (1ère sync)
// ─────────────────────────────────────────────────────────────
const MAX_HTML = 1_000_000; // 1 MB cap par doc

router.get('/atelier', requireAuth, async (req, res) => {
  try {
    const uc = userClient(req.token);
    const { data, error } = await uc
      .from('atelier_docs')
      .select('id, title, html, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    res.json({ docs: data || [] });
  } catch (err) {
    console.error('[sync/atelier GET]', err);
    res.status(500).json({ error: 'Erreur lecture atelier.' });
  }
});

router.post('/atelier', requireAuth, async (req, res) => {
  const body = req.body || {};
  const id    = typeof body.id === 'string' ? body.id : null;
  const title = (typeof body.title === 'string' ? body.title : 'Sans titre').slice(0, 300);
  const html  = typeof body.html === 'string' ? body.html : '';
  if (html.length > MAX_HTML) return res.status(413).json({ error: 'Document trop volumineux.' });
  try {
    const uc = userClient(req.token);
    const payload = { user_id: req.user.id, title, html, updated_at: new Date().toISOString() };
    let q;
    if (id) {
      payload.id = id;
      q = uc.from('atelier_docs').upsert(payload, { onConflict: 'id' }).select('id, updated_at').single();
    } else {
      q = uc.from('atelier_docs').insert(payload).select('id, updated_at').single();
    }
    const { data, error } = await q;
    if (error) throw error;
    res.json({ ok: true, id: data.id, updated_at: data.updated_at });
  } catch (err) {
    console.error('[sync/atelier POST]', err);
    res.status(500).json({ error: 'Erreur sauvegarde atelier.' });
  }
});

router.delete('/atelier/:id', requireAuth, async (req, res) => {
  try {
    const uc = userClient(req.token);
    const { error } = await uc
      .from('atelier_docs')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[sync/atelier DELETE]', err);
    res.status(500).json({ error: 'Erreur suppression.' });
  }
});

router.post('/atelier/bulk', requireAuth, async (req, res) => {
  // Import en masse pour la 1ère sync : on insère ce que le client a en local
  const docs = Array.isArray(req.body && req.body.docs) ? req.body.docs : [];
  if (!docs.length) return res.json({ ok: true, inserted: 0 });
  try {
    const uc = userClient(req.token);
    const rows = docs
      .filter(d => d && typeof d === 'object')
      .map(d => ({
        user_id: req.user.id,
        title: (typeof d.title === 'string' ? d.title : 'Sans titre').slice(0, 300),
        html:  typeof d.html === 'string' ? d.html.slice(0, MAX_HTML) : '',
      }))
      .slice(0, 100); // max 100 docs par sync initiale
    if (!rows.length) return res.json({ ok: true, inserted: 0 });
    const { data, error } = await uc.from('atelier_docs').insert(rows).select('id, title, updated_at');
    if (error) throw error;
    res.json({ ok: true, inserted: data.length, docs: data });
  } catch (err) {
    console.error('[sync/atelier BULK]', err);
    res.status(500).json({ error: 'Erreur import atelier.' });
  }
});

// ─────────────────────────────────────────────────────────────
// MINDMAPS — cartes mentales multi-cartes
// GET  /api/sync/mindmaps               → liste des cartes
// POST /api/sync/mindmaps               → upsert { id?, title, data }
// DEL  /api/sync/mindmaps/:id           → supprime
// POST /api/sync/mindmaps/bulk          → import bulk
// ─────────────────────────────────────────────────────────────
const MAX_DATA_BYTES = 2_000_000; // 2 MB cap par carte

router.get('/mindmaps', requireAuth, async (req, res) => {
  try {
    const uc = userClient(req.token);
    const { data, error } = await uc
      .from('mindmaps')
      .select('id, title, data, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    res.json({ maps: data || [] });
  } catch (err) {
    console.error('[sync/mindmaps GET]', err);
    res.status(500).json({ error: 'Erreur lecture cartes.' });
  }
});

router.post('/mindmaps', requireAuth, async (req, res) => {
  const body = req.body || {};
  const id    = typeof body.id === 'string' ? body.id : null;
  const title = (typeof body.title === 'string' ? body.title : 'Ma carte').slice(0, 300);
  const data  = body.data && typeof body.data === 'object' ? body.data : { nodes: [], edges: [] };
  // Cap de taille
  try {
    const size = Buffer.byteLength(JSON.stringify(data));
    if (size > MAX_DATA_BYTES) return res.status(413).json({ error: 'Carte trop volumineuse.' });
  } catch (_) {}
  try {
    const uc = userClient(req.token);
    const payload = { user_id: req.user.id, title, data, updated_at: new Date().toISOString() };
    let q;
    if (id) {
      payload.id = id;
      q = uc.from('mindmaps').upsert(payload, { onConflict: 'id' }).select('id, updated_at').single();
    } else {
      q = uc.from('mindmaps').insert(payload).select('id, updated_at').single();
    }
    const { data: row, error } = await q;
    if (error) throw error;
    res.json({ ok: true, id: row.id, updated_at: row.updated_at });
  } catch (err) {
    console.error('[sync/mindmaps POST]', err);
    res.status(500).json({ error: 'Erreur sauvegarde carte.' });
  }
});

router.delete('/mindmaps/:id', requireAuth, async (req, res) => {
  try {
    const uc = userClient(req.token);
    const { error } = await uc
      .from('mindmaps')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[sync/mindmaps DELETE]', err);
    res.status(500).json({ error: 'Erreur suppression.' });
  }
});

router.post('/mindmaps/bulk', requireAuth, async (req, res) => {
  const maps = Array.isArray(req.body && req.body.maps) ? req.body.maps : [];
  if (!maps.length) return res.json({ ok: true, inserted: 0 });
  try {
    const uc = userClient(req.token);
    const rows = maps
      .filter(m => m && typeof m === 'object')
      .map(m => ({
        user_id: req.user.id,
        title: (typeof m.title === 'string' ? m.title : 'Ma carte').slice(0, 300),
        data: (m.data && typeof m.data === 'object') ? m.data : { nodes: m.nodes || [], edges: m.edges || [] },
      }))
      .slice(0, 50);
    if (!rows.length) return res.json({ ok: true, inserted: 0 });
    const { data, error } = await uc.from('mindmaps').insert(rows).select('id, title, updated_at');
    if (error) throw error;
    res.json({ ok: true, inserted: data.length, maps: data });
  } catch (err) {
    console.error('[sync/mindmaps BULK]', err);
    res.status(500).json({ error: 'Erreur import cartes.' });
  }
});

module.exports = router;
