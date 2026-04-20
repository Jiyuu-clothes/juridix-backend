const express = require('express');
const router  = express.Router();
const piste   = require('../services/piste');
const corpus  = require('../services/corpus');

// POST /api/search
router.post('/', async (req, res) => {
  try {
    const { query, filters = {} } = req.body;
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'La requête doit contenir au moins 2 caractères.' });
    }

    const hasCreds = !!(process.env.PISTE_CLIENT_ID && process.env.PISTE_CLIENT_SECRET);
    let results = [];
    let source  = 'corpus';
    let pisteError = null;

    if (hasCreds) {
      try {
        results = await piste.search(query, filters);
        source  = 'piste';
      } catch (err) {
        pisteError = err.detail || err.message;
        console.warn('[PISTE] Indisponible, fallback corpus —', pisteError);
        results = corpus.search(query, filters);
      }
    } else {
      results = corpus.search(query, filters);
    }

    return res.json({
      query,
      results,
      source,
      total: results.length,
      credits_remaining: null,
      ...(pisteError && process.env.NODE_ENV !== 'production' ? { piste_error: pisteError } : {})
    });

  } catch (err) {
    console.error('[Search] Erreur:', err);
    return res.status(500).json({ error: 'Erreur serveur lors de la recherche.' });
  }
});

// GET /api/search/credits
router.get('/credits', (_req, res) => res.json({ credits: null, is_premium: true }));

module.exports = router;
