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
    let corrected = null;

    const runPiste = async (q) => {
      const pisteFilters = { ...filters, type: getType(filters) };
      return await piste.search(q, pisteFilters);
    };

    if (hasCreds) {
      try {
        results = await runPiste(query);
        source = 'piste';

        // Si PISTE renvoie 0 résultat, on tente une correction de typo
        // (Levenshtein ≤ 2 contre un dico juridique) et on relance.
        if (!Array.isArray(results) || results.length === 0) {
          const fix = corpus.fuzzyCorrect(query);
          if (fix && fix.toLowerCase() !== query.toLowerCase()) {
            try {
              const retry = await runPiste(fix);
              if (Array.isArray(retry) && retry.length > 0) {
                results = retry;
                corrected = fix;
              }
            } catch (_) { /* on garde le résultat vide d'origine */ }
          }
        }
      } catch (err) {
        pisteError = err.detail || err.message;
        console.warn('[PISTE] Indisponible, fallback corpus —', pisteError);
        results = corpus.search(query, filters);
      }
    } else {
      results = corpus.search(query, filters);
    }

    // Boost numérique : si la query est un numéro d'article (ex. "1240" ou "221-1"),
    // on fait remonter les résultats qui matchent exactement ce numéro.
    const numMatch = query.trim().match(/^(\d{1,4}(?:[-\s]\d+)?)$/);
    if (numMatch && Array.isArray(results) && results.length > 1) {
      const num = numMatch[1].replace(/\s+/g, '-');
      const refOf = (s) => (s || '').toString();
      const isExactNum = (a) => {
        const r = refOf(a.ref);
        const art = refOf(a.article);
        return art === num
          || r === num
          || r.endsWith(' ' + num)
          || r.endsWith('.' + num)
          || r.endsWith('art. ' + num);
      };
      results.sort((a, b) => (isExactNum(b) ? 1 : 0) - (isExactNum(a) ? 1 : 0));
    }

    return res.json({
      query,
      results,
      source,
      total: Array.isArray(results) ? results.length : 0,
      ...(corrected ? { corrected } : {}),
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

// GET /api/search/codes — liste des codes disponibles
router.get('/codes', (_req, res) => {
  const codes = Object.entries(piste.KEY_CODES).map(([id, name]) => ({ id, name }));
  res.json({ codes });
});

// GET /api/search/codes/:textId/nav — structure de navigation d'un code
router.get('/codes/:textId/nav', async (req, res) => {
  try {
    const { textId } = req.params;
    if (!piste.KEY_CODES[textId]) return res.status(404).json({ error: 'Code non trouvé.' });
    const hasCreds = !!(process.env.PISTE_CLIENT_ID && process.env.PISTE_CLIENT_SECRET);
    if (!hasCreds) return res.status(503).json({ error: 'PISTE non configuré.' });
    const articles = await piste.getCodeArticles(textId);
    res.json({ textId, name: piste.KEY_CODES[textId], articles, total: articles.length });
  } catch (err) {
    console.error('[Nav] Erreur:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de la structure.' });
  }
});

module.exports = router;
