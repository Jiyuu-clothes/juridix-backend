/**
 * services/news-aggregator.js
 * ────────────────────────────────────────────────────────────────────
 * Agrège les actualités juridiques depuis plusieurs sources :
 *   - Flux RSS publics des juridictions et sites doctrinaux
 *   - PISTE Légifrance pour les arrêts récents publiés au Bulletin
 *
 * Cache en mémoire pendant 1h pour ne pas marteler les serveurs sources.
 * Fail-open : si une source échoue, on log et on garde les autres.
 *
 * Sortie normalisée : tableau d'items au format
 *   { id, source, sourceLabel, title, excerpt, date, url, matiere, badge }
 */

const axios = require('axios');
const piste = require('./piste');

const CACHE_TTL_MS    = 60 * 60 * 1000; // 1h pour servir le cache
const REFRESH_EVERY   = 60 * 60 * 1000; // refresh proactif toutes les heures
let cache = { data: null, expires: 0, lastUpdated: null };
let refreshTimer = null;
let refreshInFlight = false;

// ─── Définition des sources RSS publiques ────────────────────────
// On essaie chaque URL ; si elle échoue, on passe à la suivante.
// Les sources institutionnelles passent en premier (haute fiabilité).
const RSS_SOURCES = [
  {
    source: 'conseil-etat',
    label:  "Conseil d'État",
    badge:  '⚖️',
    urls: [
      'https://www.conseil-etat.fr/actualites/actualites/rss.xml',
      'https://www.conseil-etat.fr/feed',
    ],
  },
  {
    source: 'conseil-constit',
    label:  'Conseil constitutionnel',
    badge:  '🏛',
    urls: [
      'https://www.conseil-constitutionnel.fr/rss/decisions.xml',
      'https://www.conseil-constitutionnel.fr/feed.xml',
    ],
  },
  {
    source: 'village-justice',
    label:  'Village Justice',
    badge:  '📚',
    urls: [
      'https://www.village-justice.com/articles/spip.php?page=backend',
      'https://www.village-justice.com/articles/rss.xml',
    ],
  },
  {
    source: 'actu-juridique',
    label:  'Actu-Juridique',
    badge:  '📰',
    urls: [
      'https://www.actu-juridique.fr/feed/',
    ],
  },
  {
    source: 'dalloz-actu',
    label:  'Dalloz Actualité',
    badge:  '📕',
    urls: [
      'https://www.dalloz-actualite.fr/rss.xml',
    ],
  },
];

// ─── Parsing XML RSS sans dépendance externe ─────────────────────
function parseRss(xml) {
  if (!xml || typeof xml !== 'string') return [];
  const items = [];
  // RSS 2.0 : <item> ; Atom : <entry>
  const itemRegex = /<(item|entry)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = itemRegex.exec(xml))) {
    const block = m[2];
    items.push({
      title:   extract(block, 'title'),
      link:    extract(block, 'link') || extract(block, 'guid'),
      pubDate: extract(block, 'pubDate') || extract(block, 'published') || extract(block, 'updated') || extract(block, 'dc:date'),
      desc:    extract(block, 'description') || extract(block, 'summary') || extract(block, 'content:encoded') || extract(block, 'content'),
      image:   extractImage(block),
    });
  }
  return items;
}

// Cherche l'URL d'une image associée à l'item, par ordre de fiabilité :
//   1. <media:thumbnail url="..."/>   (RSS Media)
//   2. <media:content url="..." medium="image"/>
//   3. <enclosure url="..." type="image/*"/>
//   4. <itunes:image href="..."/>
//   5. première <img src="..."/> dans description / content:encoded
//   6. og:image dans le contenu (rare dans RSS, mais on tente)
function extractImage(block) {
  if (!block) return null;
  // 1 & 2 : balises Media RSS
  let m = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (m) return cleanImageUrl(m[1]);
  m = block.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*(?:type=["']image|medium=["']image)/i);
  if (m) return cleanImageUrl(m[1]);
  m = block.match(/<media:content[^>]+(?:type=["']image|medium=["']image)[^>]*url=["']([^"']+)["']/i);
  if (m) return cleanImageUrl(m[1]);
  // 3 : enclosure
  m = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image\//i);
  if (m) return cleanImageUrl(m[1]);
  m = block.match(/<enclosure[^>]+type=["']image\/[^"']+["'][^>]*url=["']([^"']+)["']/i);
  if (m) return cleanImageUrl(m[1]);
  // 4 : itunes:image
  m = block.match(/<itunes:image[^>]+href=["']([^"']+)["']/i);
  if (m) return cleanImageUrl(m[1]);
  // 5 : première <img> dans le contenu (description ou content:encoded)
  const descContent = (extract(block, 'description') || '') + ' ' + (extract(block, 'content:encoded') || '') + ' ' + (extract(block, 'content') || '');
  m = descContent.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return cleanImageUrl(m[1]);
  return null;
}

// Nettoie une URL d'image : décode les entités, force https si possible,
// rejette les data URIs et les pixels de tracking (1x1).
function cleanImageUrl(url) {
  if (!url) return null;
  url = decodeEntities(String(url).trim());
  if (!/^https?:\/\//i.test(url)) return null;
  if (/data:image/i.test(url)) return null;
  // Filtre les pixels de tracking et trop petites images détectables par URL
  if (/[?&](w|width)=1(&|$)/i.test(url) || /1x1/.test(url)) return null;
  return url;
}

function extract(xml, tag) {
  // CDATA + balises normales
  const reCData = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i');
  const reNorm  = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  // Atom <link href="..."/>
  const reAttr  = new RegExp(`<${tag}[^>]*href=["']([^"']+)["']`, 'i');
  return (xml.match(reCData)?.[1] || xml.match(reNorm)?.[1] || xml.match(reAttr)?.[1] || '').trim();
}

// Décode les entités HTML courantes (numériques + nommées). Indispensable
// pour les flux français qui sont souvent encodés en &eacute; etc. dans le RSS.
const HTML_ENTITIES = {
  amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ',
  eacute:'é', egrave:'è', ecirc:'ê', euml:'ë',
  agrave:'à', acirc:'â', auml:'ä', aring:'å', atilde:'ã',
  iacute:'í', igrave:'ì', icirc:'î', iuml:'ï',
  oacute:'ó', ograve:'ò', ocirc:'ô', ouml:'ö', otilde:'õ',
  uacute:'ú', ugrave:'ù', ucirc:'û', uuml:'ü',
  yacute:'ý', yuml:'ÿ',
  ccedil:'ç', ntilde:'ñ',
  Eacute:'É', Egrave:'È', Ecirc:'Ê', Euml:'Ë',
  Agrave:'À', Acirc:'Â', Auml:'Ä', Aring:'Å',
  Iacute:'Í', Igrave:'Ì', Icirc:'Î', Iuml:'Ï',
  Oacute:'Ó', Ograve:'Ò', Ocirc:'Ô', Ouml:'Ö',
  Uacute:'Ú', Ugrave:'Ù', Ucirc:'Û', Uuml:'Ü',
  Ccedil:'Ç', Ntilde:'Ñ',
  laquo:'«', raquo:'»', hellip:'…', middot:'·',
  ldquo:'"', rdquo:'"', lsquo:"'", rsquo:"'", sbquo:'‚', bdquo:'„',
  mdash:'—', ndash:'–', copy:'©', reg:'®', trade:'™',
  deg:'°', euro:'€', pound:'£', yen:'¥', cent:'¢',
  times:'×', divide:'÷', plusmn:'±', frac12:'½',
  Oelig:'Œ', oelig:'œ', AElig:'Æ', aelig:'æ',
  szlig:'ß', shy:'-', bull:'•',
};
function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    // entités hexadécimales : &#xE9;
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; }
    })
    // entités décimales : &#233;
    .replace(/&#(\d+);/g, (_, d) => {
      try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ''; }
    })
    // entités nommées : &eacute;
    .replace(/&([a-z][a-z0-9]+);/gi, (full, name) => HTML_ENTITIES[name] || full);
}

function stripHtml(s) {
  return decodeEntities((s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeDate(d) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

// ─── Détection automatique de la matière depuis le titre ─────────
const MATIERE_KEYWORDS = {
  'civil':       /\b(responsab|contrat|obligation|propri[ée]t|bien|famille|mariage|divorce|succession|h[ée]ritage|nullit|caution)\b/i,
  'penal':       /\b(p[ée]nal|crime|d[ée]lit|infraction|garde\s+vue|prison|meurtre|vol|escroquerie|harc[èe]lement)\b/i,
  'travail':     /\b(travail|licenciement|salari[ée]|employeur|syndicat|cdd|cdi|prud'?hommes?|harc[èe]lement\s+moral|d[ée]mission|rupture)\b/i,
  'commercial':  /\b(commerc|soci[ée]t[ée]|sas|sarl|sa\b|liquidation|redressement|faillite|concurrence)\b/i,
  'administratif': /\b(administrat|fonctionnaire|service\s+public|march[ée]\s+public|urbanism|expropriation|oqtf|[ée]tranger)\b/i,
  'constit':     /\b(constituti?on|qpc|qprior|libert[ée]\s+fondament)\b/i,
  'fiscal':      /\b(fiscal|imp[oô]t|tva|taxe|redevance|recouvrement)\b/i,
  'europ':       /\b(europ|cjue|cedh|conventionnel)\b/i,
};

function detectMatiere(title) {
  if (!title) return null;
  for (const [m, re] of Object.entries(MATIERE_KEYWORDS)) {
    if (re.test(title)) return m;
  }
  return null;
}

// ─── Détection d'articles cités dans le titre/description ────────
// Pour permettre un bouton "Ouvrir dans JuriDix" sur les actus qui
// mentionnent un article précis.
const ARTICLE_PATTERN = /\b(article|art\.?)[\s\xa0]+([LRDA]?\.?\s?\d+(?:[\-.]\d+)*)/i;

function detectArticleRef(...texts) {
  for (const t of texts) {
    if (!t) continue;
    const m = t.match(ARTICLE_PATTERN);
    if (m) return m[2].replace(/\s+/g, '').replace(/^([LRDA])\./i, '$1');
  }
  return null;
}

// ─── Fetch d'une source RSS avec fallback sur les URLs alternatives
async function fetchRssSource(source) {
  for (const url of source.urls) {
    try {
      const r = await axios.get(url, {
        timeout: 8000,
        headers: {
          'User-Agent': 'JuriDix/1.0 (legal news aggregator)',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
        maxRedirects: 5,
      });
      const items = parseRss(r.data);
      if (items.length > 0) {
        return items.map(item => ({
          id:          `${source.source}-${(item.link || item.title || '').slice(0, 80)}`,
          source:      source.source,
          sourceLabel: source.label,
          badge:       source.badge,
          title:       stripHtml(item.title),
          excerpt:     stripHtml(item.desc).slice(0, 280),
          date:        normalizeDate(item.pubDate),
          url:         decodeEntities(item.link || ''),   // décode &amp; etc. dans l'URL
          image:       item.image || null,
          matiere:     detectMatiere(item.title),
          articleRef:  detectArticleRef(item.title, item.desc),
        })).filter(x => x.title);
      }
    } catch (e) {
      console.warn(`[News] RSS ${source.source} échec sur ${url} :`, e.code || e.message);
    }
  }
  return [];
}

// ─── Récupération des derniers arrêts Cassation publiés via PISTE
async function fetchRecentCassation() {
  if (!process.env.PISTE_CLIENT_ID || !process.env.PISTE_CLIENT_SECRET) {
    return [];
  }
  try {
    // Recherche large sur le fond JURI, tri par date naturelle (PISTE renvoie
    // par défaut les plus récents en haut quand on tape un mot vide ou très
    // général).
    const results = await piste.search('Publié au bulletin', { type: 'JURIS', en_vigueur: false });
    return results.slice(0, 10).map(r => ({
      id:          `cass-${r.id}`,
      source:      'cassation',
      sourceLabel: 'Cour de cassation',
      badge:       '⚖️',
      title:       r.title,
      excerpt:     stripHtml(r.content).slice(0, 280),
      date:        r.date ? new Date(r.date).toISOString() : null,
      url:         r.url,
      matiere:     detectMatiere(r.title),
      articleRef:  detectArticleRef(r.title, r.content),
    }));
  } catch (e) {
    console.warn('[News] PISTE Cassation récents échoué :', e.message);
    return [];
  }
}

// ─── Pipeline principal ──────────────────────────────────────────
async function fetchAll() {
  console.log('[News] Refresh des sources…');
  const tasks = [
    ...RSS_SOURCES.map(s => fetchRssSource(s)),
    fetchRecentCassation(),
  ];
  const results = await Promise.allSettled(tasks);
  const all = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Dédoublonner par URL canonique
  const seen = new Set();
  const dedup = all.filter(it => {
    const key = (it.url || it.id || '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Tri chronologique décroissant
  dedup.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Enrichissement og:image pour les items sans image RSS (Village Justice,
  // sources institutionnelles…). Concurrent limité pour ne pas saturer.
  await enrichWithOgImages(dedup);

  console.log(`[News] ${dedup.length} actu(s) agrégée(s) depuis ${results.length} source(s).`);
  return dedup;
}

// ─── Enrichissement og:image ─────────────────────────────────────
// Pour les items sans image, fetch la page de l'article (premiers 64 KB
// seulement) et extrait <meta property="og:image"> / <meta name="twitter:image">.
// Limite à N requêtes concurrentes pour ne pas surcharger.
async function enrichWithOgImages(items) {
  const missing = items.filter(it => !it.image && it.url);
  if (!missing.length) return;
  console.log(`[News] Enrichissement og:image pour ${missing.length} article(s)…`);

  const CONCURRENCY = 8;
  let cursor = 0;
  let found = 0;

  async function worker() {
    while (cursor < missing.length) {
      const idx = cursor++;
      const it = missing[idx];
      try {
        const og = await fetchOgImage(it.url);
        if (og) {
          it.image = og;
          found++;
        }
      } catch {/* silencieux : c'est best-effort */}
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`[News] og:image trouvées : ${found}/${missing.length}`);
}

async function fetchOgImage(url) {
  try {
    const r = await axios.get(url, {
      timeout: 7000,
      maxRedirects: 3,
      maxContentLength: 2 * 1024 * 1024,   // 2 MB — la plupart des pages modernes
      maxBodyLength: 2 * 1024 * 1024,
      responseType: 'text',
      transformResponse: [(d) => d],
      headers: {
        // User-Agent réaliste de navigateur — certains sites bloquent les bots
        // (Légifrance via Cloudflare notamment). On reste honnête en gardant
        // un suffixe d'identification.
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 JuriDixBot/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      validateStatus: s => s >= 200 && s < 400,
    });
    // Le head suffit pour og:image, on coupe à 128 KB pour l'analyse regex
    const html = String(r.data || '').slice(0, 128 * 1024);
    return extractOgImageFromHtml(html, url);
  } catch (e) {
    // Log discret pour diagnostic — on garde silencieux niveau erreur
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[News] og:image fetch failed for ${url.slice(0, 80)} :`, e.code || e.message);
    }
    return null;
  }
}

function extractOgImageFromHtml(html, baseUrl) {
  if (!html) return null;
  // og:image (Open Graph) puis twitter:image (Twitter Cards)
  let m = html.match(/<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i);
  if (!m) m = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
  if (!m) m = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (!m) m = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);
  if (!m) return null;
  let raw = decodeEntities(m[1].trim());
  // URLs relatives → absolues
  if (raw.startsWith('//')) raw = 'https:' + raw;
  else if (raw.startsWith('/')) {
    try { const u = new URL(baseUrl); raw = u.origin + raw; } catch {}
  }
  return cleanImageUrl(raw);
}

async function getNews({ source, matiere, limit = 50 } = {}) {
  const now = Date.now();
  if (!cache.data || now > cache.expires) {
    await refreshCache();
  }
  let out = cache.data || [];
  if (source)  out = out.filter(x => x.source === source);
  if (matiere) out = out.filter(x => x.matiere === matiere);
  return {
    items: out.slice(0, limit),
    lastUpdated: cache.lastUpdated,
    total: out.length,
  };
}

// Refresh atomique (évite les fetchs concurrents).
async function refreshCache() {
  if (refreshInFlight) return cache.data; // déjà en cours
  refreshInFlight = true;
  try {
    const data = await fetchAll();
    cache.data        = data;
    cache.expires     = Date.now() + CACHE_TTL_MS;
    cache.lastUpdated = new Date().toISOString();
    console.log(`[News] Cache rafraîchi : ${data.length} items.`);
    return data;
  } finally {
    refreshInFlight = false;
  }
}

// Démarre le refresh proactif périodique (idempotent : ne lance qu'un timer).
function startScheduledRefresh() {
  if (refreshTimer) return;
  refreshTimer = setInterval(() => {
    refreshCache().catch(e => console.warn('[News] Refresh planifié échoué :', e.message));
  }, REFRESH_EVERY);
  // Premier warm-up rapide (5s après le boot pour ne pas bloquer le démarrage).
  setTimeout(() => {
    refreshCache().catch(e => console.warn('[News] Warm-up échoué :', e.message));
  }, 5000);
  console.log(`[News] Refresh proactif activé (toutes les ${REFRESH_EVERY/1000}s).`);
}

function listSources() {
  return [
    ...RSS_SOURCES.map(s => ({ source: s.source, label: s.label, badge: s.badge })),
    { source: 'cassation', label: 'Cour de cassation', badge: '⚖️' },
  ];
}

// Démarre automatiquement le refresh planifié à l'import du module.
startScheduledRefresh();

module.exports = { getNews, listSources, fetchAll, refreshCache };
