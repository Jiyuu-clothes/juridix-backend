/**
 * PISTE API Service — Légifrance OAuth2
 * OAuth2 client_credentials → oauth.piste.gouv.fr (production)
 * API base → api.piste.gouv.fr (production)
 */
const axios = require('axios');

const PISTE_BASE = process.env.PISTE_BASE_URL || 'https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app';
const OAUTH_URL  = process.env.PISTE_OAUTH_URL  || 'https://sandbox-oauth.piste.gouv.fr/api/oauth/token';

// ─── Codes principaux à indexer ──────────────────────────────
const KEY_CODES = {
  'LEGITEXT000006070721': 'Code civil',
  'LEGITEXT000006069414': 'Code pénal',
  'LEGITEXT000005634379': 'Code de commerce',
  'LEGITEXT000006072050': 'Code du travail',
  'LEGITEXT000006074233': 'Code de procédure civile',
  'LEGITEXT000006071154': 'Code de procédure pénale',
};

// ─── Cache token OAuth ────────────────────────────────────────
let tokenCache  = null;
let tokenExpiry = 0;

// ─── Cache table des matières (2h) ───────────────────────────
const codeArticleCache = new Map(); // textId -> { articles, expires }
const CACHE_TTL = 2 * 60 * 60 * 1000;

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache && now < tokenExpiry) return tokenCache;

  const id     = process.env.PISTE_CLIENT_ID;
  const secret = process.env.PISTE_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PISTE_CLIENT_ID / PISTE_CLIENT_SECRET non configurés');

  const attempts = [
    new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret, scope: 'openid' }),
    new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  ];

  let lastError;
  for (const params of attempts) {
    try {
      const r = await axios.post(OAUTH_URL, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8000
      });
      tokenCache  = r.data.access_token;
      tokenExpiry = now + ((r.data.expires_in || 3600) - 60) * 1000;
      return tokenCache;
    } catch (e) {
      lastError = e;
    }
  }
  const detail = lastError?.response?.data || lastError?.message;
  throw Object.assign(new Error(`PISTE OAuth échoué: ${JSON.stringify(detail)}`), { pisteError: true, detail });
}

function makeHeaders(token) {
  const apiKey = process.env.PISTE_API_KEY;
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(apiKey ? { 'X-Gravitee-Api-Key': apiKey } : {})
  };
}

// ─── Table des matières ───────────────────────────────────────

/**
 * Aplatit récursivement les articles d'un nœud de tableMatieres
 */
function flattenArticles(node, path = []) {
  const result = [];
  const currentPath = node.title ? [...path, node.title] : path;

  for (const art of node.articles || []) {
    if (art.id && art.etat === 'VIGUEUR') {
      result.push({
        id:   art.id,
        cid:  art.cid || art.id,
        num:  art.num || '',
        path: currentPath
      });
    }
  }

  for (const section of node.sections || []) {
    result.push(...flattenArticles(section, currentPath));
  }

  return result;
}

/**
 * Récupère et met en cache la liste des articles d'un code
 */
async function getCodeArticles(textId) {
  const now = Date.now();
  const cached = codeArticleCache.get(textId);
  if (cached && now < cached.expires) return cached.articles;

  const token  = await getAccessToken();
  const today  = new Date().toISOString().split('T')[0];

  const r = await axios.post(`${PISTE_BASE}/consult/code/tableMatieres`,
    { textId, date: today },
    { headers: makeHeaders(token), timeout: 15000 }
  );

  const articles = flattenArticles(r.data);
  codeArticleCache.set(textId, { articles, expires: now + CACHE_TTL });
  return articles;
}

/**
 * Recherche dans un code par mots-clés (titres de sections) ou par numéro d'article
 * Retourne des résultats formatés [{id, title, code, article, content, url, source}]
 */
async function searchCodeArticles(textId, query, maxResults = 5) {
  const codeName = KEY_CODES[textId] || 'Code';
  try {
    const articles = await getCodeArticles(textId);
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    // Recherche par numéro d'article (ex: "1240", "article 9")
    const numMatch = query.match(/\b(\d+(?:-\d+)?)\b/);
    let candidates = [];

    if (numMatch) {
      const num = numMatch[1];
      const byNum = articles.filter(a => a.num === num);
      if (byNum.length > 0) candidates = byNum;
    }

    // Si pas de résultat par numéro, chercher dans les titres de sections
    if (candidates.length === 0 && terms.length > 0) {
      candidates = articles
        .map(a => {
          const searchText = a.path.join(' ').toLowerCase();
          const score = terms.filter(t => searchText.includes(t)).length;
          return { ...a, score };
        })
        .filter(a => a.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
    }

    if (candidates.length === 0) return [];

    // Récupérer le texte de chaque article en parallèle
    const results = await Promise.all(
      candidates.slice(0, maxResults).map(async (art) => {
        try {
          const full = await getArticle(art.id);
          if (full) return { ...full, code: codeName };
        } catch {}
        return null;
      })
    );

    return results.filter(Boolean);
  } catch (e) {
    console.warn(`[PISTE] searchCodeArticles(${textId}) échoué:`, e.message);
    return [];
  }
}

// ─── Recherche principale ─────────────────────────────────────

/**
 * Recherche Légifrance — retourne [{id, title, code, article, content, url, source}]
 * filters.type: 'ALL' | 'CODE' | 'JURIS'
 */
async function search(query, filters = {}) {
  const token   = await getAccessToken();
  const headers = makeHeaders(token);
  const type    = filters.type || 'ALL';

  let allResults = [];

  // ── 1. Jurisprudence (CETAT, CASS, CONSTIT) ──────────────
  if (type === 'ALL' || type === 'JURIS') {
    const jurisFonds = ['CETAT', 'CASS', 'CONSTIT'];
    for (const fond of jurisFonds) {
      try {
        const r = await axios.post(`${PISTE_BASE}/search`, {
          recherche: {
            motsCles: query,
            filtres: buildFilters(filters),
            pageNumber: 1,
            pageSize: type === 'JURIS' ? 15 : 5,
            operateur: 'ET',
            typePagination: 'ARTICLE'
          },
          fond
        }, { headers, timeout: 10000 });
        allResults = allResults.concat(
          (r.data?.results || []).map(i => ({ ...i, _fond: fond }))
        );
      } catch {}
    }
  }

  // ── 2. Articles de codes (tableMatieres + getArticle) ─────
  if (type === 'ALL' || type === 'CODE') {
    const maxPerCode = type === 'CODE' ? 8 : 3;
    const codeIds = Object.keys(KEY_CODES);

    // Vérifier lesquels sont déjà en cache (pour éviter de ralentir "Tout")
    const toSearch = type === 'CODE'
      ? codeIds
      : codeIds.filter(id => codeArticleCache.has(id)); // "Tout" : seulement si déjà caché

    if (toSearch.length > 0) {
      const codeResults = await Promise.all(
        toSearch.map(textId => searchCodeArticles(textId, query, maxPerCode))
      );
      // Ajouter les résultats code avec un marqueur
      codeResults.flat().forEach(r => allResults.push({ ...r, _fromCode: true }));
    }

    // Si filtre CODE actif et aucun résultat cache → charger Code civil + Code pénal
    if (type === 'CODE' && allResults.filter(r => r._fromCode).length === 0) {
      const priorityCodes = ['LEGITEXT000006070721', 'LEGITEXT000006069414'];
      const codeResults = await Promise.all(
        priorityCodes.map(textId => searchCodeArticles(textId, query, maxPerCode))
      );
      codeResults.flat().forEach(r => allResults.push({ ...r, _fromCode: true }));
    }
  }

  // ── 3. Fallback CODE_DATE si rien d'autre ────────────────
  if (allResults.length === 0) {
    try {
      const r = await axios.post(`${PISTE_BASE}/search`, {
        recherche: {
          motsCles: query,
          filtres: buildFilters(filters),
          pageNumber: 1,
          pageSize: 10,
          operateur: 'ET',
          typePagination: 'ARTICLE'
        },
        fond: 'CODE_DATE'
      }, { headers, timeout: 10000 });
      allResults = (r.data?.results || []).map(i => ({ ...i, _fond: 'CODE_DATE' }));
    } catch {}
  }

  // ── 4. Trier : résultats avec texte en premier ───────────
  allResults.sort((a, b) => {
    const aText = !!(a.content || a.text || (a.resumePrincipal?.length));
    const bText = !!(b.content || b.text || (b.resumePrincipal?.length));
    return (bText ? 1 : 0) - (aText ? 1 : 0);
  });

  return allResults.slice(0, 20).map(item => {
    // Résultats déjà formatés par searchCodeArticles
    if (item._fromCode) {
      const { _fromCode, ...rest } = item;
      return rest;
    }
    return formatItem(item, query);
  });
}

function formatItem(item, query) {
  const mainTitle = item.titles?.[0];
  const cid  = mainTitle?.cid || mainTitle?.id || item.id || item.cid || '';
  const fond = item._fond || '';

  let url;
  if (cid.startsWith('CETATEXT')) url = `https://www.legifrance.gouv.fr/ceta/id/${cid}`;
  else if (cid.startsWith('JURITEXT')) url = `https://www.legifrance.gouv.fr/juri/id/${cid}`;
  else if (cid.startsWith('LEGIARTI')) url = `https://www.legifrance.gouv.fr/codes/article_lc/${cid}`;
  else if (cid.startsWith('LEGITEXT')) url = `https://www.legifrance.gouv.fr/codes/id/${cid}`;
  else if (cid.startsWith('JORFTEXT')) url = `https://www.legifrance.gouv.fr/jorf/id/${cid}`;
  else url = `https://www.legifrance.gouv.fr/search?query=${encodeURIComponent(query)}`;

  const content = item.text
    || item.texteHtml
    || item.texte
    || (item.resumePrincipal || []).join(' ')
    || (item.autreResume || []).join(' ')
    || '';

  const sourceLabel = {
    CETAT:     'Conseil d\'État',
    CASS:      'Cour de cassation',
    CONSTIT:   'Conseil constitutionnel',
    CODE_DATE: 'Code en vigueur',
    JORF:      'Journal Officiel'
  }[fond] || fond || 'Légifrance';

  return {
    id:      cid,
    title:   mainTitle?.title || item.titre || item.title || 'Document Légifrance',
    code:    sourceLabel,
    article: item.num || '',
    content,
    url,
    source:  'piste'
  };
}

function buildFilters(filters) {
  const out = [];
  if (filters.date_debut) out.push({ facette: 'DATE_VERSION', valeurDebut: filters.date_debut });
  if (filters.en_vigueur !== false) out.push({ facette: 'ETAT', valeur: 'VIGUEUR' });
  return out;
}

// ─── Récupère un article par CID ─────────────────────────────

async function getArticle(cid) {
  const token   = await getAccessToken();
  const headers = makeHeaders(token);

  try {
    const r = await axios.post(`${PISTE_BASE}/consult/getArticle`,
      { id: cid },
      { headers, timeout: 8000 }
    );
    const art = r.data?.article;
    if (art) {
      return {
        id:      art.id || cid,
        title:   art.titre || (art.num ? `Article ${art.num}` : 'Article'),
        code:    art.codeTitle || art.origine || '',
        article: art.num || '',
        content: art.texteHtml || art.texte || '',
        url:     `https://www.legifrance.gouv.fr/codes/article_lc/${art.id || cid}`,
        source:  'piste'
      };
    }
  } catch {}

  return null;
}

module.exports = { search, getArticle, getAccessToken, searchCodeArticles, getCodeArticles };
