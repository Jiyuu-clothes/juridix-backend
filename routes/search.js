const express = require('express');
const router = express.Router();
const pisteService = require('../services/piste');
const corpus = require('../services/corpus');

// POST /api/search
router.post('/', async (req, res) => {
  try {
    const { query, filters = {} } = req.body;
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'La requête doit contenir au moins 2 caractères.' });
    }

    let results = [];
    let source = 'corpus';

    if (process.env.PISTE_CLIENT_ID && process.env.PISTE_CLIENT_SECRET) {
      try {
        results = await pisteService.search(query, filters);
        source = 'piste';
      } catch (pisteError) {
        console.warn('PISTE API unavailable, using corpus fallback:', pisteError.message);
        results = corpus.search(query, filters);
      }
    } else {
      results = corpus.search(query, filters);
    }

    res.json({
      query,
      results,
      source,
      credits_remaining: null,
      total: results.length
    });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la recherche.' });
  }
});

// GET /api/search/credits
router.get('/credits', (req, res) => {
  res.json({ credits: null, is_premium: true });
});

module.exports = router;
