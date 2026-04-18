-- ═══════════════════════════════════════════════════
-- JURIDIX — Schéma de base de données
-- ═══════════════════════════════════════════════════

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Utilisateurs ─────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT    NOT NULL UNIQUE,
  password    TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  year        TEXT    DEFAULT 'L1',       -- L1, L2, L3, M1, M2
  specialty   TEXT    DEFAULT 'Général',  -- Droit privé, pénal, etc.
  is_premium  INTEGER DEFAULT 0,
  premium_until TEXT  DEFAULT NULL,       -- ISO date
  daily_searches INTEGER DEFAULT 0,
  last_search_date TEXT DEFAULT NULL,     -- YYYY-MM-DD
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT    DEFAULT (datetime('now'))
);

-- ── Thèmes de révision ────────────────────────────
CREATE TABLE IF NOT EXISTS themes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  color       TEXT    DEFAULT '#818cf8',
  position    INTEGER DEFAULT 0,
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- ── Notes ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme_id    INTEGER REFERENCES themes(id) ON DELETE SET NULL,
  source_type TEXT    DEFAULT 'libre',    -- 'code', 'jurisprudence', 'libre'
  source_ref  TEXT    DEFAULT NULL,       -- 'Art. 1240', 'Arrêt Blieck'
  source_id   TEXT    DEFAULT NULL,       -- ID interne du corpus
  content     TEXT    NOT NULL,
  highlight_color TEXT DEFAULT NULL,      -- 'y', 'b', 'g', 'p'
  created_at  TEXT    DEFAULT (datetime('now')),
  updated_at  TEXT    DEFAULT (datetime('now'))
);

-- ── Historique de recherche ───────────────────────
CREATE TABLE IF NOT EXISTS search_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query       TEXT    NOT NULL,
  results_count INTEGER DEFAULT 0,
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- ── Sessions refresh token ────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT    NOT NULL UNIQUE,
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    DEFAULT (datetime('now'))
);

-- ── Index pour performances ───────────────────────
CREATE INDEX IF NOT EXISTS idx_notes_user    ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_theme   ON notes(theme_id);
CREATE INDEX IF NOT EXISTS idx_themes_user   ON themes(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user  ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_user   ON refresh_tokens(user_id);
