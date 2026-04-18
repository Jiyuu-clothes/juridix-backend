/**
 * PISTE API Service — Légifrance OAuth2 client
 * Docs: https://developer.aife.economie.gouv.fr/
 * Base URL: https://api.piste.gouv.fr/dila/legifrance/lf-engine-app
 */
const axios = require('axios');

const PISTE_BASE = process.env.PISTE_BASE_URL || 'https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app';
const OAUTH_URL = process.env.PISTE_OAUTH_URL || 'https://oauth.piste.gouv.fr/api/oauth/token';

let tokenCache = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache && now < tokenExpiry) return tokenCache;

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'openid'
  });

  const basicAuth = Buffer.from(
    `${process.env.PISTE_CLIENT_ID}:${process.env.PISTE_CLIENT_SECRET}`
  ).toString('base64');

  const response = await axios.post(OAUTH_URL, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    }
  });

  tokenCache = response.data.access_token;
  tokenExpiry = now + (response.data.expires_in - 60) * 1000; // refresh 1 min early
  return tokenCache;
}

/**
 * Search Légifrance for articles matching query.
 * Returns array of { id, title, code, article, content, url }
 */
async function search(query, filters = {}) {
  const token = await getAccessToken();

  const body = {
    recherche: {
      champs: [{ typeChamp: 'ALL', criteres: [{ typeRecherche: 'TOUS_LES_MOTS', valeur: query }], operateur: 'ET' }],
      filtres: buildFilters(filters),
      pageNumber: 1,
      pageSize: 20,
      operateur: 'ET',
      typePagination: 'ARTICLE'
    },
    fond: filters.code || 'CODE_DATE'
  };

  const response = await axios.post(`${PISTE_BASE}/search`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    timeout: 8000
  });

  const items = response.data?.results || [];
  return items.map(item => ({
    id: item.id || item.cid,
    title: item.titre || item.title || 'Article',
    code: item.nature || filters.code || 'Légifrance',
    article: item.num || '',
    content: item.texte || item.extraits?.[0]?.valeur || '',
    url: `https://www.legifrance.gouv.fr/codes/article_lc/${item.id || item.cid}`,
    source: 'legifrance'
  }));
}

function buildFilters(filters) {
  const result = [];
  if (filters.date_debut) result.push({ facette: 'DATE_VERSION', valeurDebut: filters.date_debut });
  if (filters.en_vigueur !== false) result.push({ facette: 'ETAT', valeur: 'VIGUEUR' });
  return result;
}

/**
 * Fetch a single article by CID
 */
async function getArticle(cid) {
  const token = await getAccessToken();
  const response = await axios.get(`${PISTE_BASE}/consult/legi/article`, {
    params: { id: cid },
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    timeout: 8000
  });
  const art = response.data?.article;
  if (!art) return null;
  return {
    id: art.id,
    title: art.titre,
    code: art.codeParte?.titreCode || '',
    article: art.num,
    content: art.texteHtml || art.texte,
    url: `https://www.legifrance.gouv.fr/codes/article_lc/${art.id}`,
    source: 'legifrance'
  };
}

module.exports = { search, getArticle, getAccessToken };
