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

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
let cache = { data: null, expires: 0 };

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
    });
  }
  return items;
}

function extract(xml, tag) {
  // CDATA + balises normales
  const reCData = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i');
  const reNorm  = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  // Atom <link href="..."/>
  const reAttr  = new RegExp(`<${tag}[^>]*href=["']([^"']+)["']`, 'i');
  return (xml.match(reCData)?.[1] || xml.match(reNorm)?.[1] || xml.match(reAttr)?.[1] || '').trim();
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
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
          url:         item.link,
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

  console.log(`[News] ${dedup.length} actu(s) agrégée(s) depuis ${results.length} source(s).`);
  return dedup;
}

async function getNews({ source, matiere, limit = 50 } = {}) {
  const now = Date.now();
  if (!cache.data || now > cache.expires) {
    cache.data = await fetchAll();
    cache.expires = now + CACHE_TTL_MS;
  }
  let out = cache.data;
  if (source)  out = out.filter(x => x.source === source);
  if (matiere) out = out.filter(x => x.matiere === matiere);
  return out.slice(0, limit);
}

function listSources() {
  return [
    ...RSS_SOURCES.map(s => ({ source: s.source, label: s.label, badge: s.badge })),
    { source: 'cassation', label: 'Cour de cassation', badge: '⚖️' },
  ];
}

module.exports = { getNews, listSources, fetchAll };
