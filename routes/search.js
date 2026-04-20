const express = require('express');
const router  = express.Router();
const piste   = require('../services/piste');
const corpus  = require('../services/corpus');

// Pré-charger le cache des codes principaux au démarrage (async, non bloquant)
const WARMUP_CODES = [
  'LEGITEXT000006070721', // Code civil
  'LEGITEXT000006069414', // Code pénal
];

setTimeout(async () => {
  if (!(process.env.PISTE_CLIENT_ID && process.env.PISTE_CLIENT_SECRET)) return;
  for (const textId of WARMUP_CODES) {
    try {
      await piste.getCodeArticles(textId);
      console.log(`[PISTE] Cache chargé: ${textId}`);
    } catch (e) {
      console.warn(`[PISTE] Warmup échoué pour ${textId}:`, e.message);
    }
  }
}, 5000); // délai 5s après démarrage

// Mapping filtre frontend → type piste
function getType(filters) {
  const f = (filters.fond || filters.type || '').toLowerCase();
  if (f.includes('code') || f === 'code_date') return 'CODE';
  if (f.includes('juris') || f === 'cetat' || f === 'cass') return 'JURIS';
  return 'ALL';
}

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
        const pisteFilters = { ...filters, type: getType(filters) };
        results = await piste.search(query, pisteFilters);
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

// GET /api/search/article/:cid — texte complet d'un article par CID
router.get('/article/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    if (!cid || !cid.startsWith('LEGIARTI')) {
      return res.status(400).json({ error: 'CID invalide (doit commencer par LEGIARTI).' });
    }
    const hasCreds = !!(process.env.PISTE_CLIENT_ID && process.env.PISTE_CLIENT_SECRET);
    if (!hasCreds) return res.status(503).json({ error: 'PISTE non configuré.' });
    const article = await piste.getArticle(cid);
    if (!article) return res.status(404).json({ error: 'Article non trouvé.' });
    return res.json(article);
  } catch (err) {
    console.error('[Article] Erreur:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération de l\'article.' });
  }
});

// GET /api/search/credits
router.get('/credits', (_req, res) => res.json({ credits: null, is_premium: true }));

module.exports = router;
