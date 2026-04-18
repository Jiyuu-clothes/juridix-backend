const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getDb } = require('../db/database');
const pisteService = require('../services/piste');
const corpus = require('../services/corpus');

// POST /api/search
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { query, filters = {} } = req.body;
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'La requête doit contenir au moins 2 caractères.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    // Check credits
    if (!user.is_premium) {
      const today = new Date().toISOString().split('T')[0];
      const lastReset = user.credits_last_reset ? user.credits_last_reset.split('T')[0] : null;
      
      let currentCredits = user.search_credits;
      if (lastReset !== today) {
        currentCredits = 20; // daily reset
        db.prepare('UPDATE users SET search_credits = 20, credits_last_reset = ? WHERE id = ?')
          .run(new Date().toISOString(), req.user.id);
      }
      
      if (currentCredits <= 0) {
        return res.status(403).json({ 
          error: 'Quota journalier épuisé.',
          credits_remaining: 0,
          reset_at: 'demain à minuit'
        });
      }
      
      // Deduct credit
      db.prepare('UPDATE users SET search_credits = search_credits - 1 WHERE id = ?').run(req.user.id);
      
      // Save to history
      db.prepare(`INSERT INTO search_history (user_id, query, filters, credits_used) VALUES (?, ?, ?, 1)`)
        .run(req.user.id, query, JSON.stringify(filters));
    }

    // Try PISTE API first, fall back to corpus
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

    // Get updated credits
    const updatedUser = db.prepare('SELECT search_credits FROM users WHERE id = ?').get(req.user.id);

    res.json({
      query,
      results,
      source,
      credits_remaining: user.is_premium ? null : updatedUser.search_credits,
      total: results.length
    });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la recherche.' });
  }
});

// GET /api/search/history
router.get('/history', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const history = db.prepare(
      'SELECT id, query, filters, created_at FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(req.user.id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// GET /api/search/credits
router.get('/credits', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT search_credits, is_premium, credits_last_reset FROM users WHERE id = ?').get(req.user.id);
    
    // Reset if new day
    const today = new Date().toISOString().split('T')[0];
    const lastReset = user.credits_last_reset ? user.credits_last_reset.split('T')[0] : null;
    if (!user.is_premium && lastReset !== today) {
      db.prepare('UPDATE users SET search_credits = 20, credits_last_reset = ? WHERE id = ?')
        .run(new Date().toISOString(), req.user.id);
      return res.json({ credits: 20, is_premium: false });
    }

    res.json({ credits: user.is_premium ? null : user.search_credits, is_premium: user.is_premium });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
