/**
 * Corpus Service — Embedded French legal texts fallback
 * Used when PISTE API is unavailable or not configured.
 * Full corpus mirrors the HTML prototype data.
 */

const ARTICLES = [
  // ─── CODE CIVIL ───
  { id: 'cc-1', code: 'Code civil', article: 'Art. 1240', title: 'Responsabilité délictuelle',
    content: 'Tout fait quelconque de l\'homme, qui cause à autrui un dommage, oblige celui par la faute duquel il est arrivé à le réparer.',
    tags: ['responsabilité', 'dommage', 'faute', 'délit', 'réparation'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006436298' },

  { id: 'cc-2', code: 'Code civil', article: 'Art. 1241', title: 'Responsabilité par imprudence ou négligence',
    content: 'Chacun est responsable du dommage qu\'il a causé non seulement par son fait, mais encore par sa négligence ou par son imprudence.',
    tags: ['responsabilité', 'négligence', 'imprudence', 'dommage'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006436302' },

  { id: 'cc-3', code: 'Code civil', article: 'Art. 1242', title: 'Responsabilité du fait d\'autrui',
    content: 'On est responsable non seulement du dommage que l\'on cause par son propre fait, mais encore de celui qui est causé par le fait des personnes dont on doit répondre, ou des choses que l\'on a sous sa garde.',
    tags: ['responsabilité', 'autrui', 'garde', 'commettant', 'préposé'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006436306' },

  { id: 'cc-4', code: 'Code civil', article: 'Art. 1101', title: 'Définition du contrat',
    content: 'Le contrat est un accord de volontés entre deux ou plusieurs personnes destiné à créer, modifier, transmettre ou éteindre des obligations.',
    tags: ['contrat', 'accord', 'volonté', 'obligation', 'définition'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040787' },

  { id: 'cc-5', code: 'Code civil', article: 'Art. 1103', title: 'Force obligatoire du contrat',
    content: 'Les contrats légalement formés tiennent lieu de loi à ceux qui les ont faits.',
    tags: ['contrat', 'force obligatoire', 'loi', 'partie'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040777' },

  { id: 'cc-6', code: 'Code civil', article: 'Art. 1104', title: 'Bonne foi contractuelle',
    content: 'Les contrats doivent être négociés, formés et exécutés de bonne foi. Cette disposition est d\'ordre public.',
    tags: ['bonne foi', 'contrat', 'exécution', 'ordre public', 'négociation'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040773' },

  { id: 'cc-7', code: 'Code civil', article: 'Art. 1128', title: 'Conditions de validité du contrat',
    content: 'Sont nécessaires à la validité d\'un contrat : 1° Le consentement des parties ; 2° Leur capacité de contracter ; 3° Un contenu licite et certain.',
    tags: ['validité', 'consentement', 'capacité', 'licite', 'contrat'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040937' },

  { id: 'cc-8', code: 'Code civil', article: 'Art. 1130', title: 'Vices du consentement',
    content: 'L\'erreur, le dol et la violence vicient le consentement lorsqu\'ils sont de telle nature que, sans eux, l\'une des parties n\'aurait pas contracté ou aurait contracté à des conditions substantiellement différentes.',
    tags: ['vices', 'consentement', 'erreur', 'dol', 'violence', 'nullité'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040922' },

  { id: 'cc-9', code: 'Code civil', article: 'Art. 1217', title: 'Inexécution du contrat — remèdes',
    content: 'La partie envers laquelle l\'engagement n\'a pas été exécuté, ou l\'a été imparfaitement, peut : refuser d\'exécuter ou suspendre l\'exécution de sa propre obligation ; poursuivre l\'exécution forcée en nature de l\'obligation ; obtenir une réduction du prix ; provoquer la résolution du contrat ; demander réparation des conséquences de l\'inexécution.',
    tags: ['inexécution', 'résolution', 'exécution forcée', 'réduction du prix', 'responsabilité'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040876' },

  { id: 'cc-10', code: 'Code civil', article: 'Art. 544', title: 'Droit de propriété',
    content: 'La propriété est le droit de jouir et disposer des choses de la manière la plus absolue, pourvu qu\'on n\'en fasse pas un usage prohibé par les lois ou par les règlements.',
    tags: ['propriété', 'jouissance', 'disposition', 'droit réel', 'absolu'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006428859' },

  { id: 'cc-11', code: 'Code civil', article: 'Art. 1382', title: 'Ancien art. — responsabilité (note historique)',
    content: 'Ancienne numérotation de l\'article 1240 (réforme 2016). Cet article fondateur de la responsabilité délictuelle dispose : « Tout fait quelconque de l\'homme, qui cause à autrui un dommage, oblige celui par la faute duquel il est arrivé à le réparer. »',
    tags: ['responsabilité', 'faute', 'dommage', 'historique', '1382'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006436298' },

  { id: 'cc-12', code: 'Code civil', article: 'Art. 9', title: 'Droit au respect de la vie privée',
    content: 'Chacun a droit au respect de sa vie privée. Les juges peuvent, sans préjudice de la réparation du dommage subi, prescrire toutes mesures, telles que séquestre, saisie et autres, propres à empêcher ou faire cesser une atteinte à l\'intimité de la vie privée.',
    tags: ['vie privée', 'droit de la personnalité', 'intimité', 'atteinte', 'réparation'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006419288' },

  { id: 'cc-13', code: 'Code civil', article: 'Art. 371-1', title: 'Autorité parentale',
    content: 'L\'autorité parentale est un ensemble de droits et de devoirs ayant pour finalité l\'intérêt de l\'enfant. Elle appartient aux parents jusqu\'à la majorité ou l\'émancipation de l\'enfant pour le protéger dans sa sécurité, sa santé et sa moralité, pour assurer son éducation et permettre son développement, dans le respect dû à sa personne.',
    tags: ['autorité parentale', 'enfant', 'intérêt', 'droits', 'devoirs', 'famille'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006427434' },

  // ─── CODE PÉNAL ───
  { id: 'cp-1', code: 'Code pénal', article: 'Art. 121-3', title: 'Élément moral de l\'infraction',
    content: 'Il n\'y a point de crime ou de délit sans intention de le commettre. Toutefois, lorsque la loi le prévoit, il y a délit en cas de mise en danger délibérée de la personne d\'autrui. Il y a également délit, lorsque la loi le prévoit, en cas de faute d\'imprudence, de négligence ou de manquement à une obligation de prudence ou de sécurité prévue par la loi ou le règlement.',
    tags: ['élément moral', 'intention', 'imprudence', 'négligence', 'délit', 'crime'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417206' },

  { id: 'cp-2', code: 'Code pénal', article: 'Art. 111-1', title: 'Classification des infractions',
    content: 'Les infractions pénales sont classées, suivant leur gravité, en crimes, délits et contraventions.',
    tags: ['classification', 'infraction', 'crime', 'délit', 'contravention'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417100' },

  { id: 'cp-3', code: 'Code pénal', article: 'Art. 122-1', title: 'Irresponsabilité pénale — trouble mental',
    content: 'N\'est pas pénalement responsable la personne qui était atteinte, au moment des faits, d\'un trouble mental ayant aboli son discernement ou le contrôle de ses actes.',
    tags: ['irresponsabilité', 'trouble mental', 'discernement', 'responsabilité pénale', 'abolition'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417213' },

  { id: 'cp-4', code: 'Code pénal', article: 'Art. 122-2', title: 'Contrainte et irresponsabilité',
    content: 'N\'est pas pénalement responsable la personne qui a agi sous l\'empire d\'une force ou d\'une contrainte à laquelle elle n\'a pu résister.',
    tags: ['contrainte', 'irresponsabilité', 'force', 'résistance'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417218' },

  { id: 'cp-5', code: 'Code pénal', article: 'Art. 221-1', title: 'Meurtre',
    content: 'Le fait de donner volontairement la mort à autrui constitue un meurtre. Il est puni de trente ans de réclusion criminelle.',
    tags: ['meurtre', 'mort', 'volontaire', 'réclusion criminelle', 'homicide'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417526' },

  { id: 'cp-6', code: 'Code pénal', article: 'Art. 311-1', title: 'Vol',
    content: 'Le vol est la soustraction frauduleuse de la chose d\'autrui.',
    tags: ['vol', 'soustraction', 'frauduleuse', 'propriété', 'bien'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417818' },

  { id: 'cp-7', code: 'Code pénal', article: 'Art. 313-1', title: 'Escroquerie',
    content: 'L\'escroquerie est le fait, soit par l\'usage d\'un faux nom ou d\'une fausse qualité, soit par l\'abus d\'une qualité vraie, soit par l\'emploi de manœuvres frauduleuses, de tromper une personne physique ou morale et de la déterminer ainsi, à son préjudice ou au préjudice d\'un tiers, à remettre des fonds, des valeurs ou un bien quelconque.',
    tags: ['escroquerie', 'tromperie', 'manœuvres frauduleuses', 'faux', 'préjudice'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417974' },

  // ─── JURISPRUDENCE ───
  { id: 'jp-1', code: 'Jurisprudence', article: 'Cass. civ. 1re, 13 déc. 1994', title: 'Arrêt Branly — Histoire et paternité scientifique',
    content: 'La Cour de cassation reconnaît que la minimisation du rôle d\'un savant dans des ouvrages historiques peut constituer une faute engageant la responsabilité de l\'auteur au titre du droit moral et de la réputation.',
    tags: ['responsabilité', 'faute', 'droit moral', 'réputation', 'auteur'], url: '' },

  { id: 'jp-2', code: 'Jurisprudence', article: 'Cass. ass. plén., 13 déc. 2002', title: 'Arrêt Perruche — Préjudice de l\'enfant né handicapé',
    content: 'Lorsque des fautes médicales commises envers une femme enceinte l\'ont empêchée d\'exercer son choix d\'interrompre sa grossesse, l\'enfant né handicapé peut demander réparation du préjudice résultant de son handicap.',
    tags: ['préjudice', 'naissance', 'handicap', 'médecin', 'faute médicale', 'IVG'], url: '' },

  { id: 'jp-3', code: 'Jurisprudence', article: 'CE, 10 avr. 1992', title: 'Arrêt Époux V. — Responsabilité hospitalière sans faute',
    content: 'Le Conseil d\'État engage la responsabilité d\'un hôpital public sans faute prouvée lorsqu\'un patient subit un dommage grave, anormal et spécial résultant de traitements médicaux.',
    tags: ['responsabilité sans faute', 'hôpital', 'Conseil d\'État', 'dommage', 'service public'], url: '' },

  { id: 'jp-4', code: 'Jurisprudence', article: 'Cass. ch. mixte, 27 févr. 1970', title: 'Arrêt Dangereux — Causalité et préjudice',
    content: 'Cet arrêt fixe la théorie de la causalité adéquate : seul le fait qui, d\'après le cours normal des choses, était de nature à produire le dommage est retenu comme cause juridique.',
    tags: ['causalité', 'causalité adéquate', 'lien causal', 'dommage', 'responsabilité'], url: '' },

  { id: 'jp-5', code: 'Jurisprudence', article: 'Cass. civ. 1re, 3 avr. 2002', title: 'Perte de chance — Définition jurisprudentielle',
    content: 'La perte de chance constitue un préjudice réparable distinct et autonome lorsqu\'elle est réelle et sérieuse. Son évaluation est distincte du préjudice final.',
    tags: ['perte de chance', 'préjudice', 'réparation', 'évaluation', 'causalité'], url: '' },

  // ─── DÉFINITIONS JURIDIQUES ───
  { id: 'def-1', code: 'Définitions', article: 'Définition', title: 'Prescription extinctive',
    content: 'La prescription extinctive est un mode d\'extinction d\'un droit résultant de l\'inaction de son titulaire pendant un certain délai. En droit commun, le délai est de 5 ans à compter du jour où le titulaire d\'un droit a connu ou aurait dû connaître les faits lui permettant de l\'exercer (art. 2224 C. civ.).',
    tags: ['prescription', 'délai', 'extinction', 'droit', 'inaction', '5 ans'], url: '' },

  { id: 'def-2', code: 'Définitions', article: 'Définition', title: 'Force majeure',
    content: 'Selon l\'article 1218 du Code civil, il y a force majeure lorsqu\'un événement échappant au contrôle du débiteur, qui ne pouvait être raisonnablement prévu lors de la conclusion du contrat et dont les effets ne peuvent être évités par des mesures appropriées, empêche l\'exécution de son obligation.',
    tags: ['force majeure', 'exonération', 'imprévisibilité', 'irrésistibilité', 'extériorité', 'contrat'], url: '' },

  { id: 'def-3', code: 'Définitions', article: 'Définition', title: 'Abus de droit',
    content: 'L\'abus de droit est le détournement d\'un droit de son usage normal dans l\'intention de nuire. Il peut engager la responsabilité de son auteur sur le fondement de l\'article 1240 du Code civil, même si l\'acte accompli est en lui-même licite.',
    tags: ['abus de droit', 'responsabilité', 'intention de nuire', 'licite', 'détournement'], url: '' },

  { id: 'def-4', code: 'Définitions', article: 'Définition', title: 'Nullité relative et absolue',
    content: 'La nullité absolue sanctionne la violation d\'une règle d\'ordre public ; elle peut être invoquée par tout intéressé. La nullité relative protège un intérêt particulier ; seule la partie protégée peut s\'en prévaloir. Les deux sont soumises à un délai de prescription de 5 ans.',
    tags: ['nullité', 'nullité absolue', 'nullité relative', 'ordre public', 'intérêt particulier'], url: '' },

  { id: 'def-5', code: 'Définitions', article: 'Définition', title: 'Enrichissement injustifié',
    content: 'L\'enrichissement injustifié (art. 1303 C. civ.) oblige celui qui s\'est enrichi sans cause légitime au détriment d\'autrui, à indemniser ce dernier dans la mesure de son appauvrissement. C\'est une quasi-source d\'obligations.',
    tags: ['enrichissement injustifié', 'appauvrissement', 'quasi-contrat', 'indemnisation', 'sans cause'], url: '' },

  // ─── CODE DE COMMERCE ───
  { id: 'cco-1', code: 'Code de commerce', article: 'Art. L. 631-1', title: 'Redressement judiciaire',
    content: 'Il est institué une procédure de redressement judiciaire ouverte à tout débiteur qui, dans l\'impossibilité de faire face au passif exigible avec son actif disponible, est en état de cessation de ses paiements.',
    tags: ['redressement judiciaire', 'cessation des paiements', 'passif', 'actif', 'débiteur'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032312096' },

  // ─── DROIT CONSTITUTIONNEL ───
  { id: 'const-1', code: 'Constitution', article: 'Art. 16 DDHC', title: 'Séparation des pouvoirs',
    content: 'Toute Société dans laquelle la garantie des Droits n\'est pas assurée, ni la séparation des Pouvoirs déterminée, n\'a point de Constitution.',
    tags: ['constitution', 'séparation des pouvoirs', 'droits fondamentaux', 'DDHC', '1789'], url: '' },
];

/**
 * Keyword scoring search (TF-IDF-inspired)
 * Returns sorted results with score and highlighted excerpt
 */
function search(query, filters = {}) {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  if (terms.length === 0) return [];

  let results = ARTICLES.map(article => {
    const haystack = [article.title, article.content, article.article, article.code, ...(article.tags || [])].join(' ').toLowerCase();
    let score = 0;
    for (const term of terms) {
      const regex = new RegExp(term, 'gi');
      const matches = haystack.match(regex);
      if (matches) {
        score += matches.length;
        if (article.title.toLowerCase().includes(term)) score += 5;
        if ((article.tags || []).some(t => t.toLowerCase().includes(term))) score += 3;
      }
    }
    return { ...article, score, excerpt: buildExcerpt(article.content, terms) };
  }).filter(r => r.score > 0);

  // Filter by code if specified
  if (filters.code) {
    const codeFilter = filters.code.toLowerCase();
    results = results.filter(r => r.code.toLowerCase().includes(codeFilter));
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 20);
}

function buildExcerpt(content, terms) {
  const lower = content.toLowerCase();
  let bestIdx = 0;
  let bestScore = 0;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1) { bestIdx = idx; bestScore++; break; }
  }
  const start = Math.max(0, bestIdx - 60);
  const end = Math.min(content.length, bestIdx + 200);
  return (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '');
}

module.exports = { search, ARTICLES };
