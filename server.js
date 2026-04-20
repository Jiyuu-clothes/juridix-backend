require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const searchRoutes = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security & Middleware ────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Trop de requêtes, réessayez dans 15 minutes.' }
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { error: 'Trop de tentatives de connexion, réessayez dans 1 heure.' }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// ─── API Routes ───────────────────────────────────────────
app.use('/api/search', searchRoutes);

// ─── PISTE Debug complet ───────────────────────────────────
app.get('/api/debug/piste', async (req, res) => {
  const axios = require('axios');
  const id      = process.env.PISTE_CLIENT_ID || '';
  const secret  = process.env.PISTE_CLIENT_SECRET || '';
  const apiKey  = process.env.PISTE_API_KEY || '';
  const oauthUrl = process.env.PISTE_OAUTH_URL || 'https://sandbox-oauth.piste.gouv.fr/api/oauth/token';
  const apiBase  = process.env.PISTE_BASE_URL  || 'https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app';

  const out = {
    client_id: id ? id.substring(0,8)+'…' : 'MANQUANT',
    api_key: apiKey ? apiKey.substring(0,8)+'…' : 'NON DÉFINI',
    oauth: null, consult: null, search: null, search_results: []
  };

  // Étape 1 — token OAuth
  let token = null;
  try {
    const params = new URLSearchParams({ grant_type:'client_credentials', client_id:id, client_secret:secret, scope:'openid' });
    const r = await axios.post(oauthUrl, params.toString(), { headers:{'Content-Type':'application/x-www-form-urlencoded'}, timeout:8000 });
    token = r.data?.access_token;
    out.oauth = { ok:true, token_preview: token?.substring(0,20)+'…' };
  } catch(e) {
    out.oauth = { ok:false, status:e.response?.status, error:e.response?.data || e.message };
    return res.json(out);
  }

  // Étape 2 — test GET simple (consult code civil) pour vérifier connectivité
  try {
    const r = await axios.get(`${apiBase}/consult/code/tableMatieres`, {
      params: { textId: 'LEGITEXT000006070721', date: '2024-01-01' },
      headers: { Authorization:`Bearer ${token}`, Accept:'application/json', ...(apiKey ? {'X-Gravitee-Api-Key': apiKey} : {}) },
      timeout: 8000
    });
    out.consult = { ok:true, status:r.status, titre: r.data?.code?.titre || r.data?.titre || 'OK' };
  } catch(e) {
    out.consult = { ok:false, status:e.response?.status, error:e.response?.data || e.message };
  }

  // Étape 3 — recherche avec plusieurs formats et combinaisons headers
  const baseBody = {
    recherche: {
      champs: [{ typeChamp:'ALL', criteres:[{ typeRecherche:'TOUS_LES_MOTS', valeur:'contrat' }], operateur:'ET' }],
      filtres: [],
      pageNumber: 1, pageSize: 5, operateur: 'ET', sort: 'PERTINENCE', typePagination: 'ARTICLE'
    },
    fond: 'CODE_DATE'
  };

  const variants = [
    // Format 1 : avec sort PERTINENCE
    { name:'sort PERTINENCE', body: { recherche:{ champs:[{typeChamp:'ALL',criteres:[{typeRecherche:'TOUS_LES_MOTS',valeur:'contrat'}],operateur:'ET'}], filtres:[], pageNumber:1, pageSize:5, operateur:'ET', sort:'PERTINENCE', typePagination:'ARTICLE' }, fond:'CODE_DATE' } },
    // Format 2 : sans sort, sans typePagination
    { name:'minimal sans sort/typePagination', body: { recherche:{ champs:[{typeChamp:'ALL',criteres:[{typeRecherche:'TOUS_LES_MOTS',valeur:'contrat'}],operateur:'ET'}], filtres:[], pageNumber:1, pageSize:5, operateur:'ET' }, fond:'CODE_DATE' } },
    // Format 3 : typeRecherche UN_DES_MOTS
    { name:'UN_DES_MOTS', body: { recherche:{ champs:[{typeChamp:'ALL',criteres:[{typeRecherche:'UN_DES_MOTS',valeur:'contrat'}],operateur:'ET'}], filtres:[], pageNumber:1, pageSize:5, operateur:'ET', typePagination:'ARTICLE' }, fond:'CODE_DATE' } },
    // Format 4 : LEGI sans filtres
    { name:'LEGI minimal', body: { recherche:{ champs:[{typeChamp:'ALL',criteres:[{typeRecherche:'TOUS_LES_MOTS',valeur:'contrat'}],operateur:'ET'}], filtres:[], pageNumber:1, pageSize:5, operateur:'ET', typePagination:'ARTICLE' }, fond:'LEGI' } },
    // Format 5 : sans champs, avec motsCles
    { name:'motsCles direct', body: { recherche:{ motsCles:'contrat', filtres:[], pageNumber:1, pageSize:5, operateur:'ET', typePagination:'ARTICLE' }, fond:'CODE_DATE' } },
    // Format 6 : JORF
    { name:'JORF fond', body: { recherche:{ champs:[{typeChamp:'ALL',criteres:[{typeRecherche:'TOUS_LES_MOTS',valeur:'contrat'}],operateur:'ET'}], filtres:[], pageNumber:1, pageSize:5, operateur:'ET', typePagination:'ARTICLE' }, fond:'JORF' } },
  ];

  const headerSets = [
    { label:'Bearer seul',           headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json', Accept:'application/json' } },
    ...(apiKey ? [{ label:'Bearer + X-Gravitee-Api-Key', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json', Accept:'application/json', 'X-Gravitee-Api-Key': apiKey } }] : []),
  ];

  for (const hset of headerSets) {
    for (const v of variants) {
      try {
        const r = await axios.post(`${apiBase}/search`, v.body, { headers: hset.headers, timeout:10000 });
        out.search = { ok:true, variant:v.name, headers:hset.label, status:r.status, total:r.data?.results?.length };
        // Montrer la structure brute du premier résultat pour identifier les bons champs
        out.search_results = (r.data?.results || []).slice(0,2);
        out.raw_keys = r.data?.results?.[0] ? Object.keys(r.data.results[0]) : [];
        return res.json(out);
      } catch(e) {
        out.search_results.push({ variant:v.name, headers:hset.label, status:e.response?.status, err: e.response?.data || e.message });
      }
    }
  }
  out.search = { ok:false, message:'Tous les formats ont échoué — voir search_results pour détails' };
  res.json(out);
});

// ─── Health Check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    piste: !!(process.env.PISTE_CLIENT_ID && process.env.PISTE_CLIENT_SECRET)
  });
});

// ─── Static Frontend (production) ────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// ─── Error Handler ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Erreur interne.' : err.message 
  });
});

// ─── Start ────────────────────────────────────────────────
async function start() {
  try {
    app.listen(PORT, () => {
      console.log(`\n🏛️  JuriDix API démarrée sur le port ${PORT}`);
      console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   PISTE: ${process.env.PISTE_CLIENT_ID ? '✅ configuré' : '⚠️  non configuré (corpus embarqué)'}`);
      console.log(`   → http://localhost:${PORT}/api/health\n`);
    });
  } catch (err) {
    console.error('Erreur au démarrage:', err);
    process.exit(1);
  }
}

start();
