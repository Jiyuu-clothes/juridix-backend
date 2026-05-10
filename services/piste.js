/**
 * PISTE API Service — Légifrance OAuth2
 * OAuth2 client_credentials → oauth.piste.gouv.fr (production)
 * API base → api.piste.gouv.fr (production)
 */
const axios = require('axios');

const PISTE_BASE = process.env.PISTE_BASE_URL || 'https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app';
const OAUTH_URL  = process.env.PISTE_OAUTH_URL  || 'https://sandbox-oauth.piste.gouv.fr/api/oauth/token';

// ─── Codes principaux à indexer ──────────────────────────────
// IMPORTANT : ces LEGITEXT ont été vérifiés un par un. Ne pas réutiliser ceux
// qu'on trouve sur d'anciens tutos — beaucoup sont obsolètes ou pointent en
// fait vers des codes sans rapport (ex: LEGITEXT000006069414 = Code de la
// propriété intellectuelle, pas Code pénal).
const KEY_CODES = {
  'LEGITEXT000006070721': 'Code civil',
  'LEGITEXT000006070719': 'Code pénal',                  // corrigé (était LEGITEXT000006069414 = CPI)
  'LEGITEXT000005634379': 'Code de commerce',
  'LEGITEXT000006072050': 'Code du travail',
  'LEGITEXT000006070716': 'Code de procédure civile',    // corrigé (était LEGITEXT000006074233 = ports maritimes)
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
 * Aplatit récursivement les articles d'un nœud de tableMatieres.
 * Capture aussi le textId du code parent pour permettre un fallback
 * via consult/code (qui prend textId+num+date).
 */
function flattenArticles(node, path = [], textId = null) {
  const result = [];
  const currentPath = node.title ? [...path, node.title] : path;

  for (const art of node.articles || []) {
    if (art.id && art.etat === 'VIGUEUR') {
      result.push({
        id:        art.id,
        cid:       art.cid || art.id,
        num:       art.num || '',
        textId,                          // pour fallback consult/code
        path:      currentPath,
        dateDebut: art.dateDebut || art.dateDebutVersion || null,
        dateFin:   art.dateFin   || art.dateFinVersion   || null,
      });
    }
  }

  for (const section of node.sections || []) {
    result.push(...flattenArticles(section, currentPath, textId));
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

  const articles = flattenArticles(r.data, [], textId);
  codeArticleCache.set(textId, { articles, expires: now + CACHE_TTL });
  return articles;
}

/**
 * Cherche les métadonnées (textId, num) d'un article dans tous les caches
 * de tableMatieres déjà chargés. Utilisé par getArticle() comme fallback
 * quand consult/getArticle renvoie vide.
 */
function findArticleMeta(cid) {
  if (!cid) return null;
  for (const cached of codeArticleCache.values()) {
    const match = cached.articles.find(a => a.id === cid || a.cid === cid);
    if (match) return match;
  }
  return null;
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
          if (full) {
            // Récupérer la date depuis la table des matières si getArticle ne l'a pas remontée
            return {
              ...full,
              code: codeName,
              date: full.date || art.dateDebut || null,
            };
          }
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

// ─── Pertinence par domaine juridique ─────────────────────────
//
// Problème : PISTE indexe en plein texte, donc une mention "article 221-1 du
// code pénal" dans le visa d'un arrêt fiscal CAA matche autant qu'un arrêt
// Cass. crim. sur le meurtre. Pour un usage pédagogique, c'est inutilisable.
//
// Solution : quand on détecte le code visé par la requête, on filtre les
// résultats pour ne garder que les juridictions pertinentes. Cass. crim. pour
// le pénal, Cass. soc. pour le travail, etc.
//
// ⚠ Le filtrage se base sur le titre brut de l'arrêt (ex: "Cour de cassation,
// civile, Chambre commerciale, 5 mai 2021"). Si PISTE change le format, il
// faudra adapter parseChambre().

function parseChambre(title) {
  if (!title) return null;
  const t = title.toLowerCase();
  if (/chambre\s+criminelle|cass\.\s*crim|^cour de cassation,\s*criminelle/.test(t)) return 'crim';
  if (/chambre\s+sociale|cass\.\s*soc/.test(t)) return 'soc';
  if (/chambre\s+commerciale|cass\.\s*com/.test(t)) return 'com';
  if (/chambre\s+civile|cass\.\s*civ/.test(t)) return 'civ';
  if (/chambre\s+mixte/.test(t)) return 'mixte';
  if (/assembl[éeée]e\s+pl[ée]ni[èe]re|ass\.\s+pl[ée]n/.test(t)) return 'plen';
  return null;
}

// Détermine la nature de la juridiction depuis le titre brut.
function parseJuridiction(title) {
  if (!title) return 'unknown';
  const t = title.toLowerCase();
  if (/^cour de cassation/.test(t)) return 'cass';
  if (/^cour d'appel/.test(t)) return 'ca';
  if (/cour administrative d'appel|^caa/.test(t)) return 'caa';
  if (/^conseil d'[ée]tat/.test(t)) return 'ce';
  if (/^conseil constitutionnel/.test(t)) return 'cc';
  if (/^tribunal des conflits/.test(t)) return 'tc';
  return 'autre';
}

// Mapping code → juridictions+chambres pertinentes pour ce domaine de droit.
// `chambres` : chambres Cass. à conserver (ou null = toutes les Cass.)
// `juridictions` : autres juridictions à conserver
const CODE_DOMAINS = {
  'Code civil': {
    chambres: ['civ', 'mixte', 'plen', 'com'],   // com car nb d'arrêts contractuels
    juridictions: ['cass', 'ca', 'cc'],
  },
  'Code pénal': {
    chambres: ['crim', 'mixte', 'plen'],
    juridictions: ['cass', 'ca', 'cc'],
  },
  'Code de commerce': {
    chambres: ['com', 'mixte', 'plen', 'civ'],
    juridictions: ['cass', 'ca', 'cc'],
  },
  'Code du travail': {
    chambres: ['soc', 'mixte', 'plen'],
    juridictions: ['cass', 'ca', 'cc'],
  },
  'Code de procédure civile': {
    chambres: ['civ', 'com', 'soc', 'mixte', 'plen'],
    juridictions: ['cass', 'ca'],
  },
  'Code de procédure pénale': {
    chambres: ['crim', 'mixte', 'plen'],
    juridictions: ['cass', 'ca', 'cc'],
  },
};

/**
 * Filtre les résultats pour ne garder que ceux pertinents pour le code donné.
 * - codeName : "Code civil", "Code pénal", etc. (passé via filters.code)
 * - results : items PISTE bruts ou formatés
 * Retourne un sous-ensemble pertinent.
 */
function filterByDomain(items, codeName) {
  if (!codeName || !CODE_DOMAINS[codeName]) return items;
  const domain = CODE_DOMAINS[codeName];

  return items.filter(item => {
    // On lit le titre depuis l'item brut PISTE ou l'item formaté.
    const title = item.titles?.[0]?.title || item.title || item.titre || '';
    const jur = parseJuridiction(title);

    if (!domain.juridictions.includes(jur)) return false;

    // Si c'est une Cass., on vérifie aussi la chambre.
    if (jur === 'cass') {
      const ch = parseChambre(title);
      // Si on n'arrive pas à parser la chambre, on garde par prudence (mieux
      // vaut un arrêt potentiellement hors-sujet qu'un panneau vide).
      return !ch || domain.chambres.includes(ch);
    }

    return true;
  });
}

/**
 * Score "qualité institutionnelle" d'un arrêt selon son statut de publication.
 * Utilisé pour le tri secondaire (les arrêts de principe remontent en premier).
 */
function bulletinScore(item) {
  const title = item.titles?.[0]?.title || item.title || item.titre || '';
  const t = title.toLowerCase();
  if (/publi[ée]\s+au\s+bulletin/.test(t))     return 100;  // Cass. publiée = arrêt de principe
  if (/publi[ée]\s+au\s+recueil\s+lebon/.test(t)) return 90;   // CE recueil = idem
  if (/mentionn[ée]\s+aux\s+tables/.test(t))   return 50;
  return 0;
}

// ─── Recherche principale ─────────────────────────────────────

/**
 * Recherche Légifrance — retourne [{id, title, code, article, content, url, source}]
 * filters.type: 'ALL' | 'CODE' | 'JURIS'
 * filters.code: nom du code détecté (ex: "Code civil") pour filtrage par domaine
 */
async function search(query, filters = {}) {
  const token   = await getAccessToken();
  const headers = makeHeaders(token);
  const type    = filters.type || 'ALL';

  // Si la requête est entourée de guillemets, on traite comme phrase exacte
  // (haute précision, utile pour citer un article spécifique).
  const quotedMatch = String(query || '').trim().match(/^"(.+)"$/);
  const isExact   = !!quotedMatch;
  const motsCles  = isExact ? quotedMatch[1] : query;
  const operateur = isExact ? 'EXACTE' : 'ET';

  let allResults = [];

  // Fonction pour interroger les fonds jurisprudence avec un opérateur donné.
  const queryJuris = async (mc, op) => {
    const out = [];
    const jurisFonds = ['JURI', 'CETAT', 'CONSTIT'];
    for (const fond of jurisFonds) {
      try {
        const r = await axios.post(`${PISTE_BASE}/search`, {
          recherche: {
            motsCles: mc,
            filtres: buildFilters(filters, { isJuris: true }),
            pageNumber: 1,
            pageSize: type === 'JURIS' ? 15 : 5,
            operateur: op,
            typePagination: 'DEFAUT'
          },
          fond
        }, { headers, timeout: 10000 });
        const items = r.data?.results || [];
        console.log(`[PISTE] search(${fond}, "${mc}", op=${op}) — ${items.length} résultat(s).`);
        out.push(...items.map(i => ({ ...i, _fond: fond })));
      } catch (e) {
        console.warn(`[PISTE] search(${fond}, op=${op}) — échec:`, e?.response?.status || '', e?.response?.data || e.message);
      }
    }
    return out;
  };

  // ── 1. Jurisprudence (JURI, CETAT, CONSTIT) ──────────────
  // ⚠ Fonds jurisprudence PISTE : 'JURI' (Cour de cassation, pas 'CASS'),
  // 'CETAT' (Conseil d'État), 'CONSTIT' (Conseil constitutionnel).
  if (type === 'ALL' || type === 'JURIS') {
    let jurisHits = await queryJuris(motsCles, operateur);

    // Cascade 1 : si EXACTE n'a rien donné, retomber sur ET déballé.
    if (isExact && jurisHits.length === 0) {
      const fallbackMc = motsCles
        .replace(/^article\s+/i, '')
        .replace(/\bdu\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      console.log(`[PISTE] EXACTE vide pour "${motsCles}" — fallback ET sur "${fallbackMc}".`);
      jurisHits = await queryJuris(fallbackMc, 'ET');
    }

    // Filtrage par domaine : on rejette les juridictions hors-sujet
    // (ex: pas de CAA pour une recherche de Code pénal).
    if (filters.code && CODE_DOMAINS[filters.code]) {
      const filtered = filterByDomain(jurisHits, filters.code);
      console.log(`[PISTE] Filtre domaine "${filters.code}" : ${jurisHits.length} → ${filtered.length} pertinent(s).`);

      if (filtered.length >= 5) {
        // Filtre fin satisfaisant : on garde uniquement les pertinents.
        jurisHits = filtered;
      } else if (filtered.length > 0) {
        // Filtre fin insuffisant : on met les pertinents en premier, puis
        // on complète avec les autres pour éviter un panneau quasi-vide.
        const filteredIds = new Set(filtered.map(r => r.titles?.[0]?.cid || r.id || r.cid));
        const others = jurisHits.filter(r => {
          const cid = r.titles?.[0]?.cid || r.id || r.cid;
          return !filteredIds.has(cid);
        });
        jurisHits = [...filtered, ...others];
      } else {
        // Filtre fin rejette tout : on rejette au moins les juridictions
        // clairement hors-sujet (CAA fiscal pour une question pénale, etc.).
        // On garde les Cass. toutes chambres + CA + CC plutôt que de
        // remettre la pollution administrative.
        const allowedJur = CODE_DOMAINS[filters.code].juridictions;
        jurisHits = jurisHits.filter(item => {
          const title = item.titles?.[0]?.title || item.title || item.titre || '';
          return allowedJur.includes(parseJuridiction(title));
        });
        console.log(`[PISTE] Filtre fin vide, rétention par juridiction seulement : ${jurisHits.length} arrêt(s).`);
      }
    }

    allResults = allResults.concat(jurisHits);
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
      const items = r.data?.results || [];
      console.log(`[PISTE] search(CODE_DATE, "${query}") — ${items.length} résultat(s).`);
      allResults = items.map(i => ({ ...i, _fond: 'CODE_DATE' }));
    } catch (e) {
      console.warn('[PISTE] search(CODE_DATE) — échec:', e?.response?.status || '', e?.response?.data || e.message);
    }
  }

  // ── 4. Tri en cascade :
  //   (a) résultats avec contenu d'abord
  //   (b) score "publication officielle" (bulletin/Lebon) — signal de qualité
  //   (c) date décroissante (arrêts récents en priorité)
  allResults.sort((a, b) => {
    const aText = !!(a.content || a.text || (a.resumePrincipal?.length) || a._fromCode);
    const bText = !!(b.content || b.text || (b.resumePrincipal?.length) || b._fromCode);
    if (aText !== bText) return (bText ? 1 : 0) - (aText ? 1 : 0);

    // Boost : "Publié au bulletin" > "Mentionné aux tables" > inédit.
    // Filtre les arrêts d'appel et CAA inédits qui polluent les premières
    // positions, surface les arrêts de principe.
    const aBull = bulletinScore(a);
    const bBull = bulletinScore(b);
    if (aBull !== bBull) return bBull - aBull;

    // À qualité égale, on privilégie la date la plus récente.
    return extractSortDate(b) - extractSortDate(a);
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

// Parse une date FR du titre d'un arrêt (ex: "22 avril 2021", "12/11/2025") ou
// d'un champ PISTE brut. Retourne YYYY-MM-DD ou null.
const FR_MONTHS = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11,
  decembre: 12, décembre: 12
};
function parseDateFromTitle(title) {
  if (!title) return null;
  const t = String(title).toLowerCase();
  // "22 avril 2021"
  const m1 = t.match(/(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+(\d{4})/);
  if (m1) {
    const day = String(m1[1]).padStart(2, '0');
    const month = String(FR_MONTHS[m1[2]]).padStart(2, '0');
    return `${m1[3]}-${month}-${day}`;
  }
  // "12/11/2025"
  const m2 = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return null;
}

// Extrait la "meilleure" date d'un item PISTE brut (jurisprudence ou code).
function extractItemDate(item) {
  if (item._fromCode) return item.date || null;
  const mainTitle = item.titles?.[0];
  const fromFields = item.datePublication || item.dateText || mainTitle?.dateText
                  || mainTitle?.datePubli || item.dateDebut || mainTitle?.dateDebut || null;
  if (fromFields) return normalizeDate(fromFields);
  // Fallback : la date est souvent dans le titre lui-même pour la jurisprudence.
  return parseDateFromTitle(mainTitle?.title || item.titre || item.title);
}

// Représentation triable (YYYYMMDD entier) d'une date d'item.
function extractSortDate(item) {
  const d = extractItemDate(item);
  if (!d) return 0;
  const iso = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? parseInt(iso[1] + iso[2] + iso[3], 10) : 0;
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

  // Le fond JURI mélange Cassation et Cours d'appel ; CETAT mélange CE et CAA.
  // On lit le titre brut pour afficher la juridiction réelle, pas juste le fond.
  const rawTitle = mainTitle?.title || item.titre || item.title || '';
  function deriveLabel() {
    const t = rawTitle.toLowerCase();
    if (/^cour de cassation/.test(t)) return 'Cour de cassation';
    if (/^cour d'appel/.test(t))      return 'Cour d\'appel';
    if (/^cour administrative d'appel|^caa\b/.test(t)) return 'Cour administrative d\'appel';
    if (/^conseil d'état|^ce\b/.test(t)) return 'Conseil d\'État';
    if (/^conseil constitutionnel/.test(t)) return 'Conseil constitutionnel';
    return {
      JURI:      'Cour de cassation',
      CASS:      'Cour de cassation',          // legacy
      CETAT:     'Conseil d\'État',
      CONSTIT:   'Conseil constitutionnel',
      CODE_DATE: 'Code en vigueur',
      JORF:      'Journal Officiel'
    }[fond] || fond || 'Légifrance';
  }
  const sourceLabel = deriveLabel();

  // Extraction de la date pertinente :
  //  • Jurisprudence (JURI/CETAT/CONSTIT) → date de la décision (peut nécessiter
  //    un parsing du titre car PISTE ne la remonte pas dans un champ dédié).
  //  • Article de code (LEGIARTI) → date d'entrée en vigueur de la version
  const isJuris = fond === 'JURI' || fond === 'CETAT' || fond === 'CASS' || fond === 'CONSTIT';

  return {
    id:      cid,
    title:   mainTitle?.title || item.titre || item.title || 'Document Légifrance',
    code:    sourceLabel,
    article: item.num || '',
    content,
    url,
    date:    extractItemDate(item),
    dateKind: isJuris ? 'decision' : 'envigueur',
    source:  'piste'
  };
}

// Normalise une date PISTE (ms epoch, ISO, "YYYY-MM-DD", "DD/MM/YYYY") en YYYY-MM-DD.
function normalizeDate(d) {
  if (!d) return null;
  if (typeof d === 'number') {
    try { return new Date(d).toISOString().slice(0, 10); } catch { return null; }
  }
  const s = String(d).trim();
  if (!s) return null;
  // Déjà en YYYY-MM-DD ou ISO
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // DD/MM/YYYY
  const fr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
  return s;
}

/**
 * Construit la liste des filtres PISTE selon le contexte.
 * Important : le filtre ETAT=VIGUEUR n'a de sens que pour les textes
 * législatifs (codes, lois). Pour la jurisprudence (CETAT/CASS/CONSTIT),
 * l'inclure renvoie systématiquement 0 résultat car les décisions n'ont
 * pas d'état "VIGUEUR".
 */
function buildFilters(filters, opts = {}) {
  const { isJuris = false } = opts;
  const out = [];
  if (filters.date_debut) {
    out.push({ facette: 'DATE_VERSION', valeurDebut: filters.date_debut });
  }
  if (!isJuris && filters.en_vigueur !== false) {
    out.push({ facette: 'ETAT', valeur: 'VIGUEUR' });
  }
  return out;
}

// ─── Récupère un article par CID ─────────────────────────────

/**
 * Met en forme un article PISTE brut vers le format JuriDix.
 * Accepte aussi un fallback `code` (nom lisible) et `cidHint` (CID d'origine
 * passé par le front) au cas où l'article PISTE ne le re-fournit pas.
 */
function formatArticle(art, { codeHint = '', cidHint = '', numHint = '' } = {}) {
  if (!art) return null;
  const id = art.id || cidHint;
  return {
    id,
    title:    art.titre || (art.num ? `Article ${art.num}` : 'Article'),
    code:     art.codeTitle || art.origine || codeHint || '',
    article:  art.num || numHint || '',
    content:  art.texteHtml || art.texte || '',
    url:      `https://www.legifrance.gouv.fr/codes/article_lc/${id}`,
    date:     normalizeDate(art.dateDebut || art.dateDebutVersion || null),
    dateKind: 'envigueur',
    source:   'piste'
  };
}

/**
 * Fallback : récupère un article via consult/code (textId + num + date).
 * Cet endpoint sert toujours la version courante en vigueur, ce qui contourne
 * les cas où consult/getArticle renvoie vide pour un ID de version ancien.
 */
async function getArticleByCodeAndNum(textId, num, headers, cidHint = '') {
  const today = new Date().toISOString().split('T')[0];
  const codeHint = KEY_CODES[textId] || '';
  try {
    const r = await axios.post(`${PISTE_BASE}/consult/code`,
      { textId, num, date: today },
      { headers, timeout: 8000 }
    );
    const art = r.data?.article || r.data?.articles?.[0];
    if (!art) {
      console.warn(`[PISTE] consult/code(${textId}, num=${num}) — réponse vide.`);
      return null;
    }
    console.log(`[PISTE] consult/code(${textId}, num=${num}) — OK (id=${art.id || '?'}).`);
    return formatArticle(art, { codeHint, cidHint, numHint: num });
  } catch (e) {
    const status = e?.response?.status;
    const detail = e?.response?.data || e.message;
    console.warn(`[PISTE] consult/code(${textId}, num=${num}) — erreur ${status || ''}:`, detail);
    return null;
  }
}

/**
 * Tentative consult/getArticle avec un id donné. Retourne :
 *  - { ok: true, art }            si article trouvé avec contenu
 *  - { ok: false, kind: 'empty' } si 200 mais réponse vide
 *  - { ok: false, kind: '404' }   si 404
 *  - throws                       pour toute autre erreur (5xx, timeout, etc.)
 */
async function tryGetArticleById(id, headers) {
  try {
    const r = await axios.post(`${PISTE_BASE}/consult/getArticle`,
      { id },
      { headers, timeout: 8000 }
    );
    const art = r.data?.article;
    if (art && (art.texteHtml || art.texte)) {
      return { ok: true, art };
    }
    console.warn(`[PISTE] consult/getArticle(${id}) — vide (data keys: ${Object.keys(r.data || {}).join(',') || '∅'}).`);
    return { ok: false, kind: 'empty' };
  } catch (e) {
    const status = e?.response?.status;
    if (status === 404) {
      console.warn(`[PISTE] consult/getArticle(${id}) — 404.`);
      return { ok: false, kind: '404' };
    }
    const detail = e?.response?.data || e.message;
    console.error(`[PISTE] consult/getArticle(${id}) — erreur ${status || ''}:`, detail);
    const err = new Error('PISTE getArticle échoué');
    err.kind = 'upstream';
    err.status = status;
    err.detail = detail;
    throw err;
  }
}

/**
 * Récupère un article par son identifiant Légifrance.
 * L'identifiant peut être un `id` (version-spécifique) ou un `cid` (chronique).
 * On regarde d'abord dans le cache tableMatieres pour résoudre cid → id si besoin,
 * puis on tente plusieurs stratégies en cascade :
 *   1. consult/getArticle avec l'id de version (le plus fiable)
 *   2. consult/getArticle avec l'identifiant brut reçu (cid ou autre)
 *   3. consult/code via textId+num (version courante en vigueur)
 */
async function getArticle(rawId) {
  let token;
  try {
    token = await getAccessToken();
  } catch (e) {
    console.error(`[PISTE] getArticle(${rawId}) — OAuth échoué:`, e.detail || e.message);
    const err = new Error('PISTE OAuth échoué');
    err.kind = 'auth';
    err.detail = e.detail || e.message;
    throw err;
  }

  const headers = makeHeaders(token);
  const meta = findArticleMeta(rawId);  // peut être null si tableMatieres pas en cache

  // Construire la liste ordonnée des ids à essayer, sans doublons.
  const idsToTry = [];
  if (meta?.id && meta.id !== rawId) idsToTry.push(meta.id);  // priorité : id de version
  idsToTry.push(rawId);                                        // fallback : ce qu'a envoyé le client
  if (meta?.cid && meta.cid !== rawId && meta.cid !== meta?.id) idsToTry.push(meta.cid);

  for (const id of idsToTry) {
    const result = await tryGetArticleById(id, headers);
    if (result.ok) {
      console.log(`[PISTE] getArticle — succès avec id=${id} (raw=${rawId}).`);
      return formatArticle(result.art, {
        codeHint: meta ? (KEY_CODES[meta.textId] || '') : '',
        cidHint:  rawId,
        numHint:  meta?.num
      });
    }
    // empty ou 404 → on essaie l'id suivant
  }

  // Dernier recours : consult/code via num+textId (version courante en vigueur)
  if (meta && meta.textId && meta.num) {
    console.log(`[PISTE] getArticle(${rawId}) — fallback consult/code(${meta.textId}, num=${meta.num})...`);
    const fallback = await getArticleByCodeAndNum(meta.textId, meta.num, headers, rawId);
    if (fallback) return fallback;
  } else {
    console.warn(`[PISTE] getArticle(${rawId}) — pas de méta tableMatieres en cache, fallback consult/code impossible.`);
  }

  return null;
}

module.exports = { search, getArticle, getAccessToken, searchCodeArticles, getCodeArticles, KEY_CODES };
