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
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
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
app.use('/api/search', searchRoutes);
app.use('/api/stripe', stripeRoutes);

// ─── Health ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    config_mode: process.env.CONFIG_MODE || 'RUSH',
    supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    piste: !!(process.env.PISTE_CLIENT_ID && process.env.PISTE_CLIENT_SECRET),
  });
});

// ─── Static frontend ──────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — must NOT shadow /api routes (express handles this naturally)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
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
