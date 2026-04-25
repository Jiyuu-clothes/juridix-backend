// ─────────────────────────────────────────────────────────────
// Supabase auth middleware
// Reads Authorization: Bearer <access_token>, verifies via admin client
// Attaches req.user = { id, email, ... } and req.token (for user client)
// ─────────────────────────────────────────────────────────────

const { verifyBearerToken } = require('../lib/supabase');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  const token = header.slice(7).trim();
  const { user, error } = await verifyBearerToken(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Session expirée. Reconnecte-toi.' });
  }
  req.user = user;
  req.token = token;
  next();
}

// Optional: attach user if token present, but don't reject otherwise
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    const { user } = await verifyBearerToken(token);
    if (user) {
      req.user = user;
      req.token = token;
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
