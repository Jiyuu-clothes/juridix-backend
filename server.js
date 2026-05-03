// ─────────────────────────────────────────────────────────────
// JuriDix — API Server
// Stack: Express + Supabase (Auth/Postgres/RLS) + Stripe + PISTE
// ─────────────────────────────────────────────────────────────

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const searchRoutes = require('./routes/search');
const configRoutes = require('./routes/config');
const actionRoutes = require('./routes/action');
const syncRoutes = require('./routes/sync');
const { router: stripeRoutes, webhookRouter: stripeWebhookRouter } = require('./routes/stripe');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security ─────────────────────────────────────────────
// Content Security Policy — bloque les scripts externes non whitelistés,
// limite les destinations XHR (anti-exfiltration), interdit le framing.
// Note: 'unsafe-inline' reste nécessaire car le frontend (index.html) contient
// du JS et CSS inline + des handlers onclick. C'est un compromis pragmatique :
// la CSP bloque toujours les scripts externes injectés et l'exfiltration.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.jsdelivr.net',
      ],
      // Google Fonts servi via fonts.googleapis.com (CSS) + fonts.gstatic.com (woff2)
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      // connect-src restreint les fetch/XHR/WebSocket (anti-exfiltration)
      connectSrc: [
        "'self'",
        'https://*.supabase.co',
        'wss://*.supabase.co',
      ],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"], // anti-clickjacking
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // évite de casser le CDN Supabase
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// CORS — par défaut même origine uniquement. Liste blanche via env CORS_ORIGIN
// (séparateur virgule). Plus de wildcard fallback : on échoue fermé.
const _corsAllowed = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    // Requêtes même origine (pas de header Origin) → toujours autorisées
    if (!origin) return cb(null, true);
    if (_corsAllowed.length === 0) return cb(null, false); // fail-closed
    if (_corsAllowed.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
  credentials: false,
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Stripe webhook FIRST (raw body required) ─────────────
app.use('/api/stripe', stripeWebhookRouter);

// ─── JSON parsing for everything else ─────────────────────
app.use(express.json({ limit: '512kb' })); // bumped for studio sync
app.use(express.urlencoded({ extended: true }));

// ─── Rate limiting ────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez dans 15 minutes.' },
});
app.use('/api/', apiLimiter);

// ─── Routes ───────────────────────────────────────────────
app.use('/api/config', configRoutes);
app.use('/api/action', actionRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/account', require('./routes/account'));
app.use('/api/search', searchRoutes);
app.use('/api/stripe', stripeRoutes);

// ─── Health ───────────────────────────────────────────────
// Endpoint public minimaliste — pas de divulgation de la config interne.
// Détail uniquement en dev pour le debug local.
app.get('/api/health', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    return res.json({
      status: 'ok',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      config_mode: process.env.CONFIG_MODE || 'RUSH',
      supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY),
      stripe: !!process.env.STRIPE_SECRET_KEY,
      piste: !!(process.env.PISTE_CLIENT_ID && process.env.PISTE_CLIENT_SECRET),
    });
  }
  res.json({ status: 'ok' });
});

// ─── Static frontend ──────────────────────────────────────
// HTML jamais en cache — le reste (js/css/img) bénéficie d'un cache court
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // Cache court (5 min) pour assets — Render purge à chaque déploiement de toute façon
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    }
  }
}));

// SPA fallback — must NOT shadow /api routes (express handles this naturally)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Error handler ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Erreur interne.' : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏛️  JuriDix v2.0 démarrée sur le port ${PORT}`);
  console.log(`   Mode tarifaire: ${process.env.CONFIG_MODE || 'RUSH'}`);
  console.log(`   Supabase: ${process.env.SUPABASE_URL ? '✅' : '⚠️  non configuré'}`);
  console.log(`   Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅' : '⚠️  non configuré'}`);
  console.log(`   PISTE: ${process.env.PISTE_CLIENT_ID ? '✅' : '⚠️  non configuré'}`);
  console.log(`   → http://localhost:${PORT}/api/health\n`);
});
