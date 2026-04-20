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

  // Étape 2 — chercher comment obtenir des LEGIARTI depuis un LEGITEXT
  const h = { Authorization:`Bearer ${token}`, Accept:'application/json', 'Content-Type':'application/json', ...(apiKey ? {'X-Gravitee-Api-Key': apiKey} : {}) };
  const CODE_CIVIL = 'LEGITEXT000006070721';
  out.consult_tests = [];

  // Test A : POST consult/code/tableMatieres (POST au lieu de GET)
  try {
    const r = await axios.post(`${apiBase}/consult/code/tableMatieres`, { textId: CODE_CIVIL, date:'2024-01-01' }, { headers:h, timeout:8000 });
    out.consult_tests.push({ endpoint:'POST consult/code/tableMatieres', ok:true, status:r.status, preview: JSON.stringify(r.data).substring(0,300) });
  } catch(e) {
    out.consult_tests.push({ endpoint:'POST consult/code/tableMatieres', ok:false, status:e.response?.status, err:e.response?.data||e.message });
  }

  // Test B : POST consult/legi/tableMatieres
  try {
    const r = await axios.post(`${apiBase}/consult/legi/tableMatieres`, { textId: CODE_CIVIL, date:'2024-01-01' }, { headers:h, timeout:8000 });
    out.consult_tests.push({ endpoint:'POST consult/legi/tableMatieres', ok:true, status:r.status, preview: JSON.stringify(r.data).substring(0,300) });
  } catch(e) {
    out.consult_tests.push({ endpoint:'POST consult/legi/tableMatieres', ok:false, status:e.response?.status, err:e.response?.data||e.message });
  }

  // Test C : POST search motsCles+LEGI sans filtres (filtres omis)
  try {
    const r = await axios.post(`${apiBase}/search`, { recherche:{ motsCles:'responsabilité', pageNumber:1, pageSize:3, operateur:'ET' }, fond:'LEGI' }, { headers:h, timeout:8000 });
    const first = r.data?.results?.[0];
    out.consult_tests.push({ endpoint:'POST search LEGI sans filtres', ok:true, total:r.data?.results?.length, first_nature:first?.nature, first_cid:first?.titles?.[0]?.cid });
  } catch(e) {
    out.consult_tests.push({ endpoint:'POST search LEGI sans filtres', ok:false, status:e.response?.status, err:e.response?.data||e.message });
  }

  // Test D : POST search CODE_DATE avec filtre textId Code civil
  try {
    const r = await axios.post(`${apiBase}/search`, { recherche:{ motsCles:'responsabilité', filtres:[{ facette:'CODE_DATE', valeur: CODE_CIVIL }], pageNumber:1, pageSize:3, operateur:'ET', typePagination:'ARTICLE' }, fond:'CODE_DATE' }, { headers:h, timeout:8000 });
    const first = r.data?.results?.[0];
    out.consult_tests.push({ endpoint:'POST search CODE_DATE + filtre textId', ok:true, total:r.data?.results?.length, first_nature:first?.nature, first_cid:first?.titles?.[0]?.cid });
  } catch(e) {
    out.consult_tests.push({ endpoint:'POST search CODE_DATE + filtre textId', ok:false, status:e.response?.status, err:e.response?.data||e.message });
  }

  // Test E : POST consult/code/getArticle par numéro
  try {
    const r = await axios.post(`${apiBase}/consult/code/getArticle`, { textId: CODE_CIVIL, num:'1240' }, { headers:h, timeout:8000 });
    out.consult_tests.push({ endpoint:'POST consult/code/getArticle num=1240', ok:true, status:r.status, preview: JSON.stringify(r.data).substring(0,300) });
  } catch(e) {
    out.consult_tests.push({ endpoint:'POST consult/code/getArticle num=1240', ok:false, status:e.response?.status, err:e.response?.data||e.message });
  }

  out.consult = { see: 'consult_tests' };

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
    // ── motsCles + différents fonds (priorité) ──
    { name:'motsCles + LEGI',      body: { recherche:{ motsCles:'contrat', filtres:[], pageNumber:1, pageSize:5, operateur:'ET', typePagination:'ARTICLE' }, fond:'LEGI' } },
    { name:'motsCles + CODE_DATE', body: { recherche:{ motsCles:'contrat', filtres:[], pageNumber:1, pageSize:5, operateur:'ET', typePagination:'ARTICLE' }, fond:'CODE_DATE' } },
    { name:'motsCles + JORF',      body: { recherche:{ motsCles:'contrat', filtres:[], pageNumber:1, pageSize:5, operateur:'ET', typePagination:'ARTICLE' }, fond:'JORF' } },
    { name:'motsCles + CETAT',     body: { recherche:{ motsCles:'contrat', filtres:[], pageNumber:1, pageSize:5, operateur:'ET', typePagination:'ARTICLE' }, fond:'CETAT' } },
    // ── champs format ──
    { name:'champs + CODE_DATE',   body: { recherche:{ champs:[{typeChamp:'ALL',criteres:[{typeRecherche:'TOUS_LES_MOTS',valeur:'contrat'}],operateur:'ET'}], filtres:[], pageNumber:1, pageSize:5, operateur:'ET', typePagination:'ARTICLE' }, fond:'CODE_DATE' } },
    { name:'champs + LEGI',        body: { recherche:{ champs:[{typeChamp:'ALL',criteres:[{typeRecherche:'TOUS_LES_MOTS',valeur:'contrat'}],operateur:'ET'}], filtres:[], pageNumber:1, pageSize:5, operateur:'ET', typePagination:'ARTICLE' }, fond:'LEGI' } },
  ];

  const headerSets = [
    { label:'Bearer seul',           headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json', Accept:'application/json' } },
    ...(apiKey ? [{ label:'Bearer + X-Gravitee-Api-Key', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json', Accept:'application/json', 'X-Gravitee-Api-Key': apiKey } }] : []),
  ];

  // Tester tous les variants et collecter les résultats pour comparaison
  const hset = headerSets[0]; // Bearer seul suffit
  out.variants_results = [];
  for (const v of variants) {
    try {
      const r = await axios.post(`${apiBase}/search`, v.body, { headers: hset.headers, timeout:10000 });
      const results = r.data?.results || [];
      const first = results[0];
      out.variants_results.push({
        variant: v.name,
        ok: true,
        total: results.length,
        first_nature: first?.nature || null,
        first_cid: first?.titles?.[0]?.cid || null,
        first_title: first?.titles?.[0]?.title || null,
        has_text: !!(first?.text || (first?.resumePrincipal?.length > 0)),
        text_preview: first?.text?.substring(0,100) || (first?.resumePrincipal || []).join(' ').substring(0,100) || null
      });
    } catch(e) {
      out.variants_results.push({ variant: v.name, ok: false, status: e.response?.status, err: e.response?.data || e.message });
    }
  }
  out.search = { message: 'Voir variants_results pour comparaison complète' };
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
