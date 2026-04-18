const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getDb } = require('../db/database');

// ─────────────── NOTES ───────────────

// GET /api/notes — list all notes for user
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const notes = db.prepare(
      'SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC'
    ).all(req.user.id);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/notes — create a note
router.post('/', authenticateToken, (req, res) => {
  try {
    const { article_id, article_title, content, highlight, color } = req.body;
    if (!article_id || !content) {
      return res.status(400).json({ error: 'article_id et content sont requis.' });
    }
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO notes (user_id, article_id, article_title, content, highlight, color)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(req.user.id, article_id, article_title || '', content, highlight || '', color || '#FFD700');

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// PUT /api/notes/:id — update a note
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!note) return res.status(404).json({ error: 'Note introuvable.' });

    const { content, highlight, color } = req.body;
    db.prepare(
      `UPDATE notes SET content = ?, highlight = ?, color = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`
    ).run(
      content ?? note.content,
      highlight ?? note.highlight,
      color ?? note.color,
      req.params.id,
      req.user.id
    );

    const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// DELETE /api/notes/:id — delete a note
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const info = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Note introuvable.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─────────────── THEMES ───────────────

// GET /api/notes/themes — list user themes
router.get('/themes', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const themes = db.prepare('SELECT * FROM themes WHERE user_id = ? ORDER BY created_at ASC').all(req.user.id);
    res.json(themes);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/notes/themes — create a theme
router.post('/themes', authenticateToken, (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Le nom du thème est requis.' });
    const db = getDb();
    const result = db.prepare(
      'INSERT INTO themes (user_id, name, color) VALUES (?, ?, ?)'
    ).run(req.user.id, name, color || '#6366f1');
    const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(theme);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// DELETE /api/notes/themes/:id — delete a theme
router.delete('/themes/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const info = db.prepare('DELETE FROM themes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Thème introuvable.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
