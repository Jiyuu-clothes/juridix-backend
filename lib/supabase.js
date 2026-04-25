// ─────────────────────────────────────────────────────────────
// JuriDix — Singleton Supabase clients
// • supabaseAdmin = secret key (bypass RLS, service role)
//   Used for: Stripe webhook profile updates, action increment RPC
// • verifyBearerToken(token) → { user, error }
// ─────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.warn('[supabase] ⚠️  SUPABASE_URL ou SUPABASE_SECRET_KEY manquant — auth désactivée');
}

// Admin client — bypasses RLS, used server-side only
const supabaseAdmin = SUPABASE_URL && SUPABASE_SECRET_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Verify a user-supplied access token (JWT) and return the user
async function verifyBearerToken(token) {
  if (!supabaseAdmin) return { user: null, error: 'Supabase non configuré' };
  if (!token) return { user: null, error: 'Token manquant' };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return { user: null, error: error.message };
  return { user: data?.user || null, error: null };
}

// Build a user-scoped client (RLS-enabled) from a bearer token
function userClient(token) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

module.exports = {
  supabaseAdmin,
  verifyBearerToken,
  userClient,
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
};
