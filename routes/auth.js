const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { getDb } = require('../db/database');
const router   = express.Router();

// ── Inscription ──────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name, year, specialty } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, mot de passe et prénom requis' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  }

  const hash = await bcrypt.hash(password, 10);
  const stmt = db.prepare(`
    INSERT INTO users (email, password, name, year, specialty)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(email, hash, name, year || 'L1', specialty || 'Général');
  const userId = result.lastInsertRowid;

  // Créer 3 thèmes par défaut
  const themeStmt = db.prepare('INSERT INTO themes (user_id, name, color, position) VALUES (?, ?, ?, ?)');
  themeStmt.run(userId, 'Responsabilité civile', '#818cf8', 0);
  themeStmt.run(userId, 'Droit des contrats',    '#34d399', 1);
  themeStmt.run(userId, 'Famille',               '#f59e0b', 2);

  const token = jwt.sign(
    { id: userId, email, name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.status(201).json({ token, user: { id: userId, email, name, year, specialty } });
});

// ── Connexion ─────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const db   = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id, email: user.email, name: user.name,
      year: user.year, specialty: user.specialty,
      is_premium: user.is_premium === 1
    }
  });
});

// ── Profil ────────────────────────────────────────
router.get('/me', require('../middleware/auth'), (req, res) => {
  const db   = getDb();
  const user = db.prepare('SELECT id, email, name, year, specialty, is_premium, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(user);
});

// ── Mise à jour du profil ─────────────────────────
router.put('/me', require('../middleware/auth'), (req, res) => {
  const { name, year, specialty } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE users SET name = ?, year = ?, specialty = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(name, year, specialty, req.user.id);
  res.json({ success: true });
});

module.exports = router;
