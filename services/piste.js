/**
 * PISTE API Service — Légifrance OAuth2
 * OAuth2 client_credentials → oauth.piste.gouv.fr (production)
 * API base → api.piste.gouv.fr (production)
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
 * Tente d'abord LEGI (articles), puis CODE_DATE en fallback.
 */
async function search(query, filters = {}) {
  const token = await getAccessToken();
  const apiKey = process.env.PISTE_API_KEY;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(apiKey ? { 'X-Gravitee-Api-Key': apiKey } : {})
  };

  // Fonds qui fonctionnent avec motsCles :
  // - CETAT  : jurisprudence Conseil d'État — retourne du texte ✅
  // - CASS   : jurisprudence Cour de Cassation — probablement du texte
  // - CONSTIT: Conseil Constitutionnel
  // - CODE_DATE : codes en vigueur — retourne des refs sans texte inline
  // - JORF   : Journal Officiel — textes officiels
  // LEGI et champs/* retournent 400 → exclus
  const fonds = filters.fond
    ? [filters.fond]
    : ['CETAT', 'CASS', 'CONSTIT', 'CODE_DATE', 'JORF'];

  let allResults = [];

  for (const fond of fonds) {
    const body = {
      recherche: {
        motsCles: query,
        filtres: buildFilters(filters),
        pageNumber: 1,
        pageSize: fond === 'CODE_DATE' ? 10 : 5,
        operateur: 'ET',
        typePagination: 'ARTICLE'
      },
      fond
    };

    try {
      const r = await axios.post(`${PISTE_BASE}/search`, body, { headers, timeout: 10000 });
      const items = (r.data?.results || []).map(i => ({ ...i, _fond: fond }));
      allResults = allResults.concat(items);
    } catch (e) {
      // fond non supporté, continuer
    }
  }

  // Trier : résultats avec texte en premier
  allResults.sort((a, b) => {
    const aHasText = !!(a.text || (a.resumePrincipal?.length));
    const bHasText = !!(b.text || (b.resumePrincipal?.length));
    return (bHasText ? 1 : 0) - (aHasText ? 1 : 0);
  });

  const results = allResults.slice(0, 20);

  return results.map(item => {
    const mainTitle = item.titles?.[0];
    const cid  = mainTitle?.cid || mainTitle?.id || item.id || item.cid || '';
    const fond = item._fond || '';
    const nature = (item.nature || '').toLowerCase();

    // URL selon la source
    let url;
    if (cid.startsWith('CETATEXT') || cid.startsWith('CETACOMP')) {
      url = `https://www.legifrance.gouv.fr/ceta/id/${cid}`;
    } else if (cid.startsWith('JURITEXT') || nature.includes('jurisprudence')) {
      url = `https://www.legifrance.gouv.fr/juri/id/${cid}`;
    } else if (cid.startsWith('LEGIARTI')) {
      url = `https://www.legifrance.gouv.fr/codes/article_lc/${cid}`;
    } else if (cid.startsWith('LEGITEXT')) {
      url = `https://www.legifrance.gouv.fr/codes/id/${cid}`;
    } else if (cid.startsWith('JORFTEXT')) {
      url = `https://www.legifrance.gouv.fr/jorf/id/${cid}`;
    } else {
      url = `https://www.legifrance.gouv.fr/search?query=${encodeURIComponent(query)}`;
    }

    const content = item.text
      || item.texteHtml
      || item.texte
      || (item.resumePrincipal || []).join(' ')
      || (item.autreResume || []).join(' ')
      || '';

    // Label source lisible
    const sourceLabel = {
      CETAT: 'Conseil d\'État',
      CASS: 'Cour de cassation',
      CONSTIT: 'Conseil constitutionnel',
      CODE_DATE: 'Code en vigueur',
      JORF: 'Journal Officiel'
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
  });
}

function buildFilters(filters) {
  const out = [];
  if (filters.date_debut) out.push({ facette: 'DATE_VERSION', valeurDebut: filters.date_debut });
  if (filters.en_vigueur !== false) out.push({ facette: 'ETAT', valeur: 'VIGUEUR' });
  return out;
}

/**
 * Récupère un article par CID (LEGIARTI...)
 */
async function getArticle(cid) {
  const token = await getAccessToken();
  const apiKey = process.env.PISTE_API_KEY;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(apiKey ? { 'X-Gravitee-Api-Key': apiKey } : {})
  };

  // Essai 1 — endpoint article direct
  try {
    const r = await axios.get(`${PISTE_BASE}/consult/legi/article`, {
      params: { id: cid },
      headers,
      timeout: 8000
    });
    const art = r.data?.article;
    if (art) {
      return {
        id:      art.id,
        title:   art.titre,
        code:    art.codeParte?.titreCode || art.codeTitle || '',
        article: art.num,
        content: art.texteHtml || art.texte || '',
        url:     `https://www.legifrance.gouv.fr/codes/article_lc/${art.id}`,
        source:  'piste'
      };
    }
  } catch (e) { /* essayer autre endpoint */ }

  // Essai 2 — getArticle via POST (certaines versions de l'API)
  try {
    const r = await axios.post(`${PISTE_BASE}/consult/getArticle`, { id: cid }, { headers, timeout: 8000 });
    const art = r.data?.article || r.data;
    if (art && (art.texteHtml || art.texte)) {
      return {
        id:      art.id || cid,
        title:   art.titre || '',
        code:    art.codeTitle || '',
        article: art.num || '',
        content: art.texteHtml || art.texte || '',
        url:     `https://www.legifrance.gouv.fr/codes/article_lc/${cid}`,
        source:  'piste'
      };
    }
  } catch (e) { /* ignore */ }

  return null;
}

module.exports = { search, getArticle, getAccessToken };
