/**
 * PISTE API Service — Légifrance OAuth2
 * OAuth2 client_credentials → sandbox-oauth.piste.gouv.fr
 * API base → sandbox-api.piste.gouv.fr
 */
const axios = require('axios');

const PISTE_BASE = process.env.PISTE_BASE_URL || 'https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app';
const OAUTH_URL  = process.env.PISTE_OAUTH_URL  || 'https://sandbox-oauth.piste.gouv.fr/api/oauth/token';

let tokenCache  = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache && now < tokenExpiry) return tokenCache;

  const id     = process.env.PISTE_CLIENT_ID;
  const secret = process.env.PISTE_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PISTE_CLIENT_ID / PISTE_CLIENT_SECRET non configurés');

  // Essai 1 — avec scope=openid (requis par certaines configs Axway)
  // Essai 2 — sans scope (certaines configs Axway sandbox ne demandent pas de scope)
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

/**
 * Recherche Légifrance — retourne [{id, title, code, article, content, url, source}]
 */
async function search(query, filters = {}) {
  const token = await getAccessToken();

  const body = {
    recherche: {
      motsCles: query,
      filtres: buildFilters(filters),
      pageNumber: 1,
      pageSize: 20,
      operateur: 'ET',
      typePagination: 'ARTICLE'
    },
    fond: filters.fond || 'CODE_DATE'
  };

  const r = await axios.post(`${PISTE_BASE}/search`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    timeout: 10000
  });

  return (r.data?.results || []).map(item => {
    const mainTitle = item.titles?.[0];
    const cid  = mainTitle?.cid || mainTitle?.id || item.id || item.cid || '';
    const nature = (item.nature || '').toLowerCase();

    // Construire l'URL selon la nature du résultat
    let url;
    if (nature === 'article' || cid.startsWith('LEGIARTI')) {
      url = `https://www.legifrance.gouv.fr/codes/article_lc/${cid}`;
    } else if (nature === 'code' || cid.startsWith('LEGITEXT')) {
      url = `https://www.legifrance.gouv.fr/codes/id/${cid}`;
    } else {
      url = `https://www.legifrance.gouv.fr/search?query=${encodeURIComponent(cid)}`;
    }

    const content = item.text
      || (item.resumePrincipal || []).join(' ')
      || (item.autreResume || []).join(' ')
      || '';

    return {
      id:      cid,
      title:   mainTitle?.title || item.titre || item.title || 'Document Légifrance',
      code:    item.nature || item.origin || filters.fond || 'Légifrance',
      article: item.num || '',
      content,
      url,
      source:  'piste'
    };
  });
}

function buildFilters(filters) {
  const out = [];
  if (filters.date_debut) out.push({ facette: 'DATE_VERSION', valeurDebut: filters.date_debut });
  if (filters.en_vigueur !== false) out.push({ facette: 'ETAT', valeur: 'VIGUEUR' });
  return out;
}

/**
 * Récupère un article par CID
 */
async function getArticle(cid) {
  const token = await getAccessToken();
  const r = await axios.get(`${PISTE_BASE}/consult/legi/article`, {
    params: { id: cid },
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    timeout: 8000
  });
  const art = r.data?.article;
  if (!art) return null;
  return {
    id:      art.id,
    title:   art.titre,
    code:    art.codeParte?.titreCode || '',
    article: art.num,
    content: art.texteHtml || art.texte,
    url:     `https://www.legifrance.gouv.fr/codes/article_lc/${art.id}`,
    source:  'piste'
  };
}

module.exports = { search, getArticle, getAccessToken };
