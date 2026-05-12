#!/usr/bin/env node
/**
 * build-cassation-corpus.js
 * ─────────────────────────────────────────────────────────────────────
 * Construit un index Article → Arrêts à partir de l'open data Cour de
 * cassation publié sur https://echanges.dila.gouv.fr/OPENDATA/CASS/
 *
 * Le mapping article ↔ arrêt est extrait FACTUELLEMENT du champ "Visa"
 * de chaque arrêt (la liste des articles que l'arrêt déclare appliquer).
 * Aucune IA, aucune devinette : si un arrêt cite article X dans son
 * Visa, il apparaît dans l'index pour cet article. Sinon, non.
 *
 * Sortie : data/grands-arrets-auto.json — fusionnable avec le corpus
 * curé manuel data/grands-arrets.json côté backend.
 *
 * USAGE :
 *   node scripts/build-cassation-corpus.js [options]
 *
 *   --year=2024          Année à traiter (défaut: 2024)
 *   --bulletin-only      Ne garder que les arrêts publiés au Bulletin
 *   --output=path        Fichier de sortie (défaut: data/grands-arrets-auto.json)
 *   --tmp=path           Dossier de travail (défaut: ./tmp-cassation)
 *   --keep-tmp           Ne pas supprimer le dossier temporaire après
 *
 * Exemple typique pour un premier corpus :
 *   node scripts/build-cassation-corpus.js --year=2024 --bulletin-only
 *
 * REMARQUES :
 *   - À lancer en local sur ton Mac, pas sur Render (volumineux).
 *   - Une année complète Cassation pèse ~200-500 MB compressés.
 *   - L'index final fait ~2-10 MB selon les filtres.
 *   - Idempotent : peut être relancé, écrase le fichier de sortie.
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const zlib  = require('zlib');
const { execSync } = require('child_process');

// ─── Parsing des arguments ────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) acc[m[1]] = m[2] === undefined ? true : m[2];
  return acc;
}, {});

const YEAR          = String(args.year || '2024');
const BULLETIN_ONLY = !!args['bulletin-only'];
const OUTPUT        = args.output || path.join(__dirname, '..', 'data', 'grands-arrets-auto.json');
const TMP_DIR       = args.tmp    || path.join(__dirname, '..', 'tmp-cassation');
const KEEP_TMP      = !!args['keep-tmp'];

const BASE_URL = 'https://echanges.dila.gouv.fr/OPENDATA/CASS';

// ─── Helpers ──────────────────────────────────────────────────────
function log(...x) { console.log('[Cassation]', ...x); }
function err(...x) { console.error('[Cassation][ERR]', ...x); }

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        return downloadFile(response.headers.location, dest).then(resolve, reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode} on ${url}`));
      }
      response.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    }).on('error', reject);
  });
}

// Liste des archives disponibles pour une année donnée. Le serveur DILA
// publie un index HTML, on parse les liens vers les archives .tar.gz.
async function listArchives(year) {
  const indexUrl = `${BASE_URL}/Freemium_cass_global_${year}.tar.gz`;
  // À défaut d'index HTML stable, on tente directement le pattern global.
  // Si ça échoue, on documente l'URL réelle dans le README.
  return [indexUrl];
}

// ─── Parsing XML très basique sans dépendances ────────────────────
// Pour éviter d'installer xml2js, on extrait les balises clés via regex.
// Suffisant pour les fichiers Cassation qui sont relativement plats.

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function extractAll(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

function stripTags(s) {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Détection du code parent à partir d'une référence d'article ───
// Ex : "Code civil - Article 1240" → { code: "Code civil", num: "1240" }
//      "L1232-1 du Code du travail" → { code: "Code du travail", num: "L1232-1" }

const KNOWN_CODES = [
  'Code civil',
  'Code pénal',
  'Code de commerce',
  'Code du travail',
  'Code de procédure civile',
  'Code de procédure pénale',
  'Code de la consommation',
  'Code de la sécurité sociale',
  'Code monétaire et financier',
  'Code des assurances',
  'Code de la propriété intellectuelle',
];

function parseArticleRef(text) {
  if (!text) return null;
  // Cherche un numéro d'article (ex: 1240, L1232-1, R625-7, 121-3)
  const numMatch = text.match(/\b([LRDA]?\.?\s?\d+(?:[\-.]\d+)*)\b/i);
  if (!numMatch) return null;
  const num = numMatch[1].replace(/\s+/g, '').replace(/^([LRDA])\./i, '$1');

  // Cherche le nom du code
  const lowerText = text.toLowerCase();
  const code = KNOWN_CODES.find(c => lowerText.includes(c.toLowerCase()));
  if (!code) return null;

  return { code, num };
}

// ─── Extraction des champs d'un arrêt depuis son XML ──────────────
function parseArret(xml) {
  if (!xml) return null;

  // ID (format JURITEXT...)
  const id = extractTag(xml, 'ID') || extractTag(xml, 'CID');

  // Métadonnées
  const titre        = stripTags(extractTag(xml, 'TITRE_ARRET') || extractTag(xml, 'TITRE'));
  const dateDecision = extractTag(xml, 'DATE_DEC');
  const juridiction  = stripTags(extractTag(xml, 'JURIDICTION'));
  const formation    = stripTags(extractTag(xml, 'FORMATION'));
  const numeroAffaire = stripTags(extractTag(xml, 'NUMERO_AFFAIRE'));

  // Publication (Bulletin = arrêt important)
  const publi = stripTags(extractTag(xml, 'PUBLI_BULL') || extractTag(xml, 'BULLETIN') || '');
  const isPublishedBulletin = /publi[ée]/i.test(publi) || /^o(ui)?$/i.test(publi);

  // Sommaire (résumé court de l'arrêt)
  const sommaire = stripTags(extractTag(xml, 'SOMMAIRE'));

  // Visa : la liste des articles cités. Selon le format, c'est dans
  // <CITATIONS>, <VISA>, ou des balises imbriquées. On essaie plusieurs.
  const visaTexte = stripTags(extractTag(xml, 'VISA') || extractTag(xml, 'CITATIONS') || '');
  const refCitees = stripTags(extractTag(xml, 'REF_CITEES') || '');
  const allRefs   = visaTexte + ' ' + refCitees;

  // Extraction des articles cités (multiple par arrêt)
  const articles = [];
  const refRegex = /(article|art\.?)[\s\xa0]+([LRDA]?\.?\s?\d+(?:[\-.]\d+)*)[^.;]*?(code\s+[a-zàéèêëîïôö\s']+)/gi;
  let m;
  while ((m = refRegex.exec(allRefs))) {
    const num = m[2].replace(/\s+/g, '').replace(/^([LRDA])\./i, '$1');
    const codeRaw = m[3].trim().toLowerCase();
    const code = KNOWN_CODES.find(c => codeRaw.startsWith(c.toLowerCase()));
    if (code && num) {
      articles.push({ code, num });
    }
  }

  return {
    id,
    titre,
    date: dateDecision,
    juridiction,
    formation,
    numero: numeroAffaire,
    publishedBulletin: isPublishedBulletin,
    sommaire,
    articlesCites: articles,
  };
}

// ─── Construction de l'index ──────────────────────────────────────
function buildIndex(arrets) {
  const index = {};
  for (const a of arrets) {
    if (!a || !a.articlesCites?.length) continue;
    const seen = new Set();
    for (const ref of a.articlesCites) {
      const key = `${ref.code}:${ref.num}`;
      if (seen.has(key)) continue; // un arrêt ne se compte qu'une fois par article
      seen.add(key);
      if (!index[key]) index[key] = [];
      index[key].push({
        id:           a.id,
        ref:          a.titre || `${a.juridiction}, ${a.date}, n° ${a.numero || ''}`.trim(),
        date:         a.date,
        juridiction:  a.juridiction,
        formation:    a.formation,
        numero:       a.numero,
        bulletin:     a.publishedBulletin,
        sommaire:     a.sommaire,
        retenir:      null, // sera rempli par la phase 2 IA
      });
    }
  }
  // Trie chaque liste : Bulletin d'abord, puis date décroissante
  for (const k of Object.keys(index)) {
    index[k].sort((x, y) => {
      if (x.bulletin !== y.bulletin) return y.bulletin - x.bulletin;
      return (y.date || '').localeCompare(x.date || '');
    });
  }
  return index;
}

// ─── Pipeline principal ───────────────────────────────────────────
async function main() {
  log(`Année cible : ${YEAR}`);
  log(`Filtre bulletin uniquement : ${BULLETIN_ONLY}`);
  log(`Sortie : ${OUTPUT}`);
  log(`Dossier temp : ${TMP_DIR}`);
  log('');

  ensureDir(TMP_DIR);
  ensureDir(path.dirname(OUTPUT));

  // 1. Lister les archives disponibles
  const archives = await listArchives(YEAR);
  log(`${archives.length} archive(s) à télécharger.`);

  // 2. Télécharger
  for (const url of archives) {
    const fname = path.basename(url);
    const dest  = path.join(TMP_DIR, fname);
    if (fs.existsSync(dest)) {
      log(`Déjà présent : ${fname}`);
      continue;
    }
    log(`Téléchargement : ${url}`);
    try {
      await downloadFile(url, dest);
      log(`  → ${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)} MB`);
    } catch (e) {
      err(`Échec ${url} :`, e.message);
      err('Vérifie l\'URL exacte sur https://echanges.dila.gouv.fr/OPENDATA/CASS/');
    }
  }

  // 3. Décompresser (utilise tar via shell — le format DILA est .tar.gz)
  log('Décompression…');
  const extractedDir = path.join(TMP_DIR, 'extracted');
  ensureDir(extractedDir);
  for (const url of archives) {
    const fname = path.basename(url);
    const archivePath = path.join(TMP_DIR, fname);
    if (!fs.existsSync(archivePath)) continue;
    try {
      execSync(`tar -xzf "${archivePath}" -C "${extractedDir}"`, { stdio: 'pipe' });
    } catch (e) {
      err(`Échec décompression ${fname} :`, e.message);
    }
  }

  // 4. Parser chaque XML
  log('Parsing des arrêts XML…');
  const arrets = [];
  function walkDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(fp);
      else if (entry.name.endsWith('.xml')) {
        try {
          const xml = fs.readFileSync(fp, 'utf8');
          const a = parseArret(xml);
          if (a && a.id) arrets.push(a);
        } catch {}
      }
    }
  }
  walkDir(extractedDir);
  log(`Arrêts parsés : ${arrets.length}`);

  const filtered = BULLETIN_ONLY ? arrets.filter(a => a.publishedBulletin) : arrets;
  log(`Après filtre bulletin : ${filtered.length}`);

  const withCitations = filtered.filter(a => a.articlesCites?.length > 0);
  log(`Avec citations d'articles : ${withCitations.length}`);

  // 5. Construire l'index
  const index = buildIndex(withCitations);
  const articleCount = Object.keys(index).length;
  const totalRefs    = Object.values(index).reduce((s, l) => s + l.length, 0);

  // 6. Écrire le résultat
  const output = {
    _meta: {
      generated: new Date().toISOString(),
      year: YEAR,
      bulletinOnly: BULLETIN_ONLY,
      arretsParsed: arrets.length,
      arretsKept: withCitations.length,
      articlesIndexed: articleCount,
      totalReferences: totalRefs,
    },
    articles: index,
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf8');
  log('');
  log('✅ Terminé.');
  log(`   ${articleCount} articles indexés, ${totalRefs} références totales.`);
  log(`   Fichier : ${OUTPUT}`);
  log(`   Taille : ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);

  // 7. Cleanup
  if (!KEEP_TMP) {
    log('Nettoyage du dossier temporaire…');
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  } else {
    log(`Dossier temp conservé : ${TMP_DIR}`);
  }
}

main().catch(e => {
  err('Erreur fatale :', e);
  process.exit(1);
});
