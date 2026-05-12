/**
 * routes/news.js — Endpoints actualités juridiques.
 *
 * GET /api/news               → liste agrégée (max 50 par défaut)
 *   ?source=conseil-etat        ne garder qu'une source
 *   ?matiere=civil              filtrer par matière
 *   ?limit=20                   limite la pagination
 *
 * GET /api/news/sources        → liste des sources connues + leurs labels
 *
 * POST /api/news/refresh       → force le refresh du cache (admin)
 */

const express = require('express');
const router  = express.Router();
const news    = require('../services/news-aggregator');

router.get('/', async (req, res) => {
  try {
    const { source, matiere, limit } = req.query;
    const items = await news.getNews({
      source:  source || undefined,
      matiere: matiere || undefined,
      limit:   limit ? Math.max(1, Math.min(100, parseInt(limit, 10))) : 50,
    });
    res.set('Cache-Control', 'public, max-age=300'); // 5 min côté CDN/navigateur
    res.json({ total: items.length, items });
  } catch (err) {
    console.error('[News] Erreur agrégation :', err);
    res.status(500).json({ error: 'Erreur lors de l\'agrégation des actualités.' });
  }
});

router.get('/sources', (_req, res) => {
  res.json({ sources: news.listSources() });
});

router.post('/refresh', async (_req, res) => {
  try {
    const items = await news.fetchAll();
    res.json({ ok: true, count: items.length });
  } catch (err) {
    console.error('[News] Refresh forcé échoué :', err);
    res.status(500).json({ error: 'Refresh échoué.' });
  }
});

module.exports = router;
