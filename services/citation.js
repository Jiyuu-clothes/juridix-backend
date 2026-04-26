/**
 * Citation Service — Parser de citations juridiques françaises
 *
 * Reconnaît les requêtes étudiantes de type :
 *   "1240"                   → Code civil 1240 (boost numéro)
 *   "art. 311-1 CP"          → Code pénal 311-1
 *   "L. 121-3 c. consom."    → Code conso L121-3
 *   "1382"                   → renumérotation 2016 → 1240
 *   "art 1240 al 2"          → Code civil 1240 al. 2
 *
 * Retourne : { num, alinea, codeId, codeName, ancien, ancienNum, raw } ou null
 *
 * Branché en amont de PISTE/corpus dans routes/search.js.
 */

// ─── Codes : abréviations → {legifranceId, name} ──────────────────────────
// LEGITEXT IDs alignés sur services/piste.js KEY_CODES quand disponibles.
const CODES = {
  // Civil
  'cc':         { id: 'LEGITEXT000006070721', name: 'Code civil', ambiguous: true },
  'civ':        { id: 'LEGITEXT000006070721', name: 'Code civil' },
  'civil':      { id: 'LEGITEXT000006070721', name: 'Code civil' },
  'c.civ':      { id: 'LEGITEXT000006070721', name: 'Code civil' },
  'cciv':       { id: 'LEGITEXT000006070721', name: 'Code civil' },
  // Pénal
  'cp':         { id: 'LEGITEXT000006069414', name: 'Code pénal' },
  'pen':        { id: 'LEGITEXT000006069414', name: 'Code pénal' },
  'penal':      { id: 'LEGITEXT000006069414', name: 'Code pénal' },
  'c.pen':      { id: 'LEGITEXT000006069414', name: 'Code pénal' },
  // Procédure pénale
  'cpp':        { id: 'LEGITEXT000006071154', name: 'Code de procédure pénale' },
  // Procédure civile
  'cpc':        { id: 'LEGITEXT000006074233', name: 'Code de procédure civile' },
  // Commerce
  'ccom':       { id: 'LEGITEXT000005634379', name: 'Code de commerce' },
  'com':        { id: 'LEGITEXT000005634379', name: 'Code de commerce' },
  'c.com':      { id: 'LEGITEXT000005634379', name: 'Code de commerce' },
  // Travail
  'ct':         { id: 'LEGITEXT000006072050', name: 'Code du travail' },
  'trav':       { id: 'LEGITEXT000006072050', name: 'Code du travail' },
  'c.trav':     { id: 'LEGITEXT000006072050', name: 'Code du travail' },
  // Sans LEGITEXT mappé pour l'instant (corpus statique uniquement)
  'cgi':        { name: 'Code général des impôts' },
  'css':        { name: 'Code de la sécurité sociale' },
  'cgct':       { name: 'Code général des collectivités territoriales' },
  'cch':        { name: 'Code de la construction et de l\'habitation' },
  'ceseda':     { name: 'Code de l\'entrée et du séjour des étrangers et du droit d\'asile' },
  'csp':        { name: 'Code de la santé publique' },
  'conso':      { name: 'Code de la consommation' },
  'consom':     { name: 'Code de la consommation' },
  'c.consom':   { name: 'Code de la consommation' },
  'urba':       { name: 'Code de l\'urbanisme' },
  'envir':      { name: 'Code de l\'environnement' },
  'env':        { name: 'Code de l\'environnement' },
  'route':      { name: 'Code de la route' },
  'crout':      { name: 'Code de la route' },
  'cmf':        { name: 'Code monétaire et financier' },
  'cesp':       { name: 'Code de l\'éducation' },
  'educ':       { name: 'Code de l\'éducation' },
  'const':      { name: 'Constitution' },
  'constit':    { name: 'Constitution' },
};

// ─── Renumérotation 2016 — droit des obligations ──────────────────────────
// Ordonnance 2016-131 du 10 février 2016 portant réforme du droit des contrats,
// du régime général et de la preuve des obligations.
//
// On limite aux articles les plus enseignés en L1/L2 (responsabilité,
// vices du consentement, force obligatoire, force majeure, exécution).
// Les renvois "groupés" (ex. ancien 1184 → plusieurs articles) renvoient
// l'article principal le plus pédagogique.
const RENUMEROTATION_2016 = {
  // Validité du contrat
  '1108': { to: '1128', note: 'conditions de validité' },
  '1109': { to: '1130', note: 'vices du consentement (umbrella)' },
  '1110': { to: '1132', note: 'erreur' },
  '1112': { to: '1137', note: 'dol' },
  '1116': { to: '1137', note: 'dol' },
  '1118': { to: '1143', note: 'lésion / violence économique' },
  // Force obligatoire & bonne foi
  '1134': { to: '1103', note: 'force obligatoire (al. 1) — pour la bonne foi voir 1104' },
  '1135': { to: '1194', note: 'effets du contrat' },
  // Inexécution
  '1142': { to: '1217', note: 'remèdes à l\'inexécution' },
  '1147': { to: '1231-1', note: 'dommages-intérêts pour inexécution' },
  '1148': { to: '1218', note: 'force majeure' },
  '1149': { to: '1231-2', note: 'mesure du préjudice' },
  '1150': { to: '1231-3', note: 'prévisibilité du dommage' },
  '1152': { to: '1231-5', note: 'clause pénale' },
  // Interprétation
  '1156': { to: '1188', note: 'interprétation — commune intention' },
  '1157': { to: '1191', note: 'interprétation — effet utile' },
  '1162': { to: '1190', note: 'interprétation contre le rédacteur' },
  // Effet relatif & opposabilité
  '1165': { to: '1199', note: 'effet relatif des conventions' },
  '1166': { to: '1341-1', note: 'action oblique' },
  '1167': { to: '1341-2', note: 'action paulienne' },
  // Résolution
  '1184': { to: '1224', note: 'résolution pour inexécution' },
  // Paiement / quasi-contrats
  '1235': { to: '1302', note: 'paiement de l\'indu' },
  '1371': { to: '1300', note: 'quasi-contrats — généralité' },
  '1376': { to: '1302-1', note: 'répétition de l\'indu' },
  '1382': { to: '1240', note: 'responsabilité délictuelle (fait personnel)' },
  '1383': { to: '1241', note: 'responsabilité — négligence / imprudence' },
  '1384': { to: '1242', note: 'responsabilité du fait d\'autrui / des choses' },
  '1385': { to: '1243', note: 'responsabilité du fait des animaux' },
  '1386': { to: '1244', note: 'responsabilité du fait des bâtiments' },
};

// ─── Synonymes & terminologie juridique courants ──────────────────────────
// Étend ce qui existe déjà dans corpus.js mais côté requête utilisateur.
// Format : terme étudiant → terme(s) consacré(s) à ajouter à la recherche.
const LEGAL_SYNONYMS = {
  'manoeuvres frauduleuses': ['dol'],
  'manoeuvre frauduleuse':   ['dol'],
  'tromperie':                ['dol'],
  'autorite de la chose jugee': ['res judicata'],
  'res judicata':             ['autorité de la chose jugée'],
  'pacta sunt servanda':      ['force obligatoire', '1103'],
  'loyaute contractuelle':    ['bonne foi', '1104'],
  'loyaute':                  ['bonne foi'],
  'imprevision':              ['1195'],
  'imprévision':              ['1195'],
  'cas fortuit':              ['force majeure', '1218'],
  'evenement fortuit':        ['force majeure'],
  'enrichissement sans cause':['enrichissement injustifié', '1303'],
  'gestion d\'affaires':      ['1301'],
  'paiement de l\'indu':      ['1302'],
  'mise en demeure':          ['1344'],
  'astreinte':                ['exécution forcée'],
  'voie d\'execution':        ['exécution forcée'],
  'fait du prince':           ['force majeure'],
  'theorie generale':         ['principes généraux'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function normalize(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'")
    .trim();
}

/**
 * Reconnaît un numéro d'article au format Légifrance :
 *   "1240", "311-1", "L121-3", "L. 121-3", "R. 121-1", "D.1-1",
 *   "L121-3-1", "L 121-3" → "L121-3"
 * Retourne la forme canonique (préfixe collé), ou null.
 */
function normalizeArticleNum(raw) {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .toUpperCase();
  // L121-3, R*, D*  +  préfixé optionnel
  const m = cleaned.match(/^([LRD])?(\d{1,4}(?:-\d+){0,3})$/);
  if (!m) return null;
  return (m[1] || '') + m[2];
}

/**
 * Détecte le code mentionné dans la requête (suffixe ou plein nom).
 * Retourne {abbr, code} ou null.
 */
function detectCode(rawQuery) {
  const q = normalize(rawQuery);
  // Cherche les abréviations en fin de requête (le cas le plus typique)
  // Trie par longueur décroissante pour matcher "ccom" avant "cc"
  const abbrs = Object.keys(CODES).sort((a, b) => b.length - a.length);
  for (const abbr of abbrs) {
    // Match exact en fin de chaîne, précédé d'un espace ou d'un point
    const re = new RegExp('(?:^|[\\s.])' + abbr.replace(/\./g, '\\.?') + '\\.?\\s*$', 'i');
    if (re.test(q)) return { abbr, ...CODES[abbr] };
  }
  // Mots-clés plus longs ("code civil", "code pénal", "code de la consommation")
  const longMatches = [
    [/\bcode\s+civil\b/i,       CODES['cc']],
    [/\bcode\s+p[ée]nal\b/i,    CODES['cp']],
    [/\bcode\s+du\s+travail\b/i,CODES['ct']],
    [/\bcode\s+de\s+commerce\b/i, CODES['ccom']],
    [/\bcode\s+de\s+(?:la\s+)?consom/i, CODES['conso']],
    [/\bcode\s+de\s+proc[ée]dure\s+civile/i, CODES['cpc']],
    [/\bcode\s+de\s+proc[ée]dure\s+p[ée]nale/i, CODES['cpp']],
    [/\bconstitution(?:nel)?\b/i, CODES['const']],
  ];
  for (const [re, c] of longMatches) {
    if (re.test(rawQuery)) return { abbr: c.name.toLowerCase().slice(0, 4), ...c };
  }
  return null;
}

/**
 * Détecte un alinéa : "al. 2", "alinéa 3", "al 1"
 */
function detectAlinea(rawQuery) {
  const m = rawQuery.match(/\b(?:al\.?|alin[ée]a)\s*(\d{1,2})\b/i);
  return m ? m[1] : null;
}

/**
 * Cœur du parser. Renvoie un objet citation, ou null si la requête n'est
 * pas une citation reconnaissable.
 */
function parseCitation(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') return null;
  const raw = rawQuery.trim();
  if (raw.length < 1) return null;

  // 1. Trouver un numéro d'article — on cherche "art. X" en priorité,
  //    puis un numéro nu (avec préfixe L/R/D optionnel).
  let numCandidate = null;

  // "art. 1240", "article 311-1", "art 1240", "art. L121-3"
  const artMatch = raw.match(/\bart(?:icle|\.)?\s*((?:[LRD]\.?\s*)?\d{1,4}(?:[-\s.]?\d+){0,3})/i);
  if (artMatch) {
    numCandidate = artMatch[1];
  } else {
    // Numéro nu : "1240", "L121-3", "311-1", "1240 cc", "L. 121-3 conso"
    // On accepte le numéro en tout début/avec espace devant, et n'importe quoi
    // (espace, ponctuation ou fin) derrière.
    const bareMatch = raw.match(/(?:^|\s)((?:[LRD]\.?\s*)?\d{1,4}(?:[-\s.]?\d+){0,3})(?=\s|$|[.,;])/i);
    if (bareMatch) numCandidate = bareMatch[1];
  }

  if (!numCandidate) return null;

  const num = normalizeArticleNum(numCandidate);
  if (!num) return null;

  // 2. Détecter le code mentionné
  const codeInfo = detectCode(raw);

  // 3. Détecter l'alinéa
  const alinea = detectAlinea(raw);

  // 4. Renumérotation : si num pure (sans préfixe L/R/D) et présent dans le
  //    map, on propose le nouveau numéro. Surtout pertinent pour Code civil.
  let ancien = false;
  let ancienNum = null;
  let nouveauNum = num;

  const isCcContext = !codeInfo || (codeInfo.id === 'LEGITEXT000006070721');
  if (isCcContext && /^\d+(?:-\d+)?$/.test(num) && RENUMEROTATION_2016[num]) {
    const reroute = RENUMEROTATION_2016[num];
    ancien = true;
    ancienNum = num;
    nouveauNum = reroute.to;
  }

  return {
    num: nouveauNum,
    rawNum: num,
    alinea,
    codeId:   codeInfo?.id || null,
    codeName: codeInfo?.name || null,
    codeAmbiguous: !!codeInfo?.ambiguous,
    ancien,
    ancienNum,
    note: ancien ? RENUMEROTATION_2016[ancienNum].note : null,
    raw,
  };
}

/**
 * Étend une requête avec ses synonymes consacrés.
 * Renvoie { expanded: string, added: string[] } ou null si rien à ajouter.
 */
function expandSynonyms(rawQuery) {
  if (!rawQuery) return null;
  const norm = normalize(rawQuery);
  const added = new Set();
  for (const [key, syns] of Object.entries(LEGAL_SYNONYMS)) {
    if (norm.includes(normalize(key))) {
      syns.forEach(s => added.add(s));
    }
  }
  if (added.size === 0) return null;
  return {
    expanded: rawQuery + ' ' + Array.from(added).join(' '),
    added: Array.from(added),
  };
}

module.exports = {
  parseCitation,
  expandSynonyms,
  normalizeArticleNum,
  detectCode,
  CODES,
  RENUMEROTATION_2016,
  LEGAL_SYNONYMS,
};
