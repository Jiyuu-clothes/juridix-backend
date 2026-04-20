/**
 * Corpus Service — Base de données juridique française pour JuriDix
 * Couvre : Code civil, Code pénal, Code du travail, Droit administratif,
 *          Droit constitutionnel, Code de commerce, Droit européen,
 *          Grands arrêts, Définitions essentielles
 */

const ARTICLES = [

  // ══════════════════════════════════════════════
  // CODE CIVIL — OBLIGATIONS & RESPONSABILITÉ
  // ══════════════════════════════════════════════
  { id: 'cc-1240', code: 'Code civil', article: 'Art. 1240', title: 'Responsabilité délictuelle (fait personnel)',
    content: 'Tout fait quelconque de l\'homme, qui cause à autrui un dommage, oblige celui par la faute duquel il est arrivé à le réparer.',
    tags: ['responsabilité', 'délictuelle', 'dommage', 'faute', 'réparation', 'quasi-délit'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006436298' },

  { id: 'cc-1241', code: 'Code civil', article: 'Art. 1241', title: 'Responsabilité par imprudence ou négligence',
    content: 'Chacun est responsable du dommage qu\'il a causé non seulement par son fait, mais encore par sa négligence ou par son imprudence.',
    tags: ['responsabilité', 'négligence', 'imprudence', 'dommage', 'faute non-intentionnelle'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006436302' },

  { id: 'cc-1242', code: 'Code civil', article: 'Art. 1242', title: 'Responsabilité du fait d\'autrui',
    content: 'On est responsable non seulement du dommage que l\'on cause par son propre fait, mais encore de celui qui est causé par le fait des personnes dont on doit répondre, ou des choses que l\'on a sous sa garde. Le père et la mère, en tant qu\'ils exercent l\'autorité parentale, sont solidairement responsables du dommage causé par leurs enfants mineurs habitant avec eux. Les maîtres et les commettants, du dommage causé par leurs domestiques et préposés dans les fonctions auxquelles ils les ont employés.',
    tags: ['responsabilité', 'fait d\'autrui', 'garde', 'commettant', 'préposé', 'parents', 'enfant mineur'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006436306' },

  { id: 'cc-1243', code: 'Code civil', article: 'Art. 1243', title: 'Responsabilité du fait des animaux',
    content: 'Le propriétaire d\'un animal, ou celui qui s\'en sert, pendant qu\'il est à son usage, est responsable du dommage que l\'animal a causé, soit que l\'animal fût sous sa garde, soit qu\'il fût égaré ou échappé.',
    tags: ['responsabilité', 'animal', 'propriétaire', 'garde', 'dommage'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006436310' },

  { id: 'cc-1244', code: 'Code civil', article: 'Art. 1244', title: 'Responsabilité du fait des bâtiments',
    content: 'Le propriétaire d\'un bâtiment est responsable du dommage causé par sa ruine, lorsqu\'elle est arrivée par une suite du défaut d\'entretien ou par le vice de sa construction.',
    tags: ['responsabilité', 'bâtiment', 'ruine', 'propriétaire', 'défaut d\'entretien', 'vice de construction'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006436314' },

  { id: 'cc-1217', code: 'Code civil', article: 'Art. 1217', title: 'Inexécution contractuelle — remèdes',
    content: 'La partie envers laquelle l\'engagement n\'a pas été exécuté, ou l\'a été imparfaitement, peut : refuser d\'exécuter ou suspendre l\'exécution de sa propre obligation (exception d\'inexécution) ; poursuivre l\'exécution forcée en nature de l\'obligation ; obtenir une réduction du prix ; provoquer la résolution du contrat ; demander réparation des conséquences de l\'inexécution.',
    tags: ['inexécution', 'résolution', 'exécution forcée', 'exception d\'inexécution', 'réduction du prix', 'responsabilité contractuelle'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040876' },

  { id: 'cc-1218', code: 'Code civil', article: 'Art. 1218', title: 'Force majeure en matière contractuelle',
    content: 'Il y a force majeure en matière contractuelle lorsqu\'un événement échappant au contrôle du débiteur, qui ne pouvait être raisonnablement prévu lors de la conclusion du contrat et dont les effets ne peuvent être évités par des mesures appropriées, empêche l\'exécution de son obligation par le débiteur. Si l\'empêchement est temporaire, l\'exécution de l\'obligation est suspendue à moins que le retard qui en résulterait ne justifie la résolution du contrat. Si l\'empêchement est définitif, le contrat est résolu de plein droit.',
    tags: ['force majeure', 'exonération', 'imprévisibilité', 'irrésistibilité', 'extériorité', 'contrat', 'empêchement'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040873' },

  { id: 'cc-1231', code: 'Code civil', article: 'Art. 1231-1', title: 'Dommages-intérêts pour inexécution',
    content: 'Le débiteur est condamné, s\'il y a lieu, au paiement de dommages et intérêts soit à raison de l\'inexécution de l\'obligation, soit à raison du retard dans l\'exécution, s\'il ne justifie pas que l\'exécution a été empêchée par la force majeure.',
    tags: ['dommages-intérêts', 'inexécution', 'retard', 'force majeure', 'débiteur', 'responsabilité contractuelle'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040858' },

  // ══════════════════════════════════════════════
  // CODE CIVIL — CONTRATS
  // ══════════════════════════════════════════════
  { id: 'cc-1101', code: 'Code civil', article: 'Art. 1101', title: 'Définition du contrat',
    content: 'Le contrat est un accord de volontés entre deux ou plusieurs personnes destiné à créer, modifier, transmettre ou éteindre des obligations.',
    tags: ['contrat', 'accord', 'volonté', 'obligation', 'définition'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040787' },

  { id: 'cc-1102', code: 'Code civil', article: 'Art. 1102', title: 'Liberté contractuelle',
    content: 'Chacun est libre de contracter ou de ne pas contracter, de choisir son cocontractant et de déterminer le contenu et la forme du contrat dans les limites fixées par la loi. La liberté contractuelle ne permet pas de déroger aux règles qui intéressent l\'ordre public.',
    tags: ['liberté contractuelle', 'autonomie de la volonté', 'ordre public', 'contrat'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040783' },

  { id: 'cc-1103', code: 'Code civil', article: 'Art. 1103', title: 'Force obligatoire du contrat',
    content: 'Les contrats légalement formés tiennent lieu de loi à ceux qui les ont faits.',
    tags: ['force obligatoire', 'contrat', 'loi des parties', 'pacta sunt servanda'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040777' },

  { id: 'cc-1104', code: 'Code civil', article: 'Art. 1104', title: 'Bonne foi contractuelle',
    content: 'Les contrats doivent être négociés, formés et exécutés de bonne foi. Cette disposition est d\'ordre public.',
    tags: ['bonne foi', 'contrat', 'exécution', 'ordre public', 'négociation', 'formation'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040773' },

  { id: 'cc-1112', code: 'Code civil', article: 'Art. 1112', title: 'Obligation précontractuelle d\'information',
    content: 'Celle des parties qui connaît une information dont l\'importance est déterminante pour le consentement de l\'autre doit l\'en informer dès lors que, légitimement, cette dernière ignore cette information ou fait confiance à son cocontractant.',
    tags: ['information précontractuelle', 'devoir d\'information', 'consentement', 'loyauté', 'négociation'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040730' },

  { id: 'cc-1128', code: 'Code civil', article: 'Art. 1128', title: 'Conditions de validité du contrat',
    content: 'Sont nécessaires à la validité d\'un contrat : 1° Le consentement des parties ; 2° Leur capacité de contracter ; 3° Un contenu licite et certain.',
    tags: ['validité', 'consentement', 'capacité', 'licite', 'contrat', 'conditions de formation'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040937' },

  { id: 'cc-1130', code: 'Code civil', article: 'Art. 1130', title: 'Vices du consentement',
    content: 'L\'erreur, le dol et la violence vicient le consentement lorsqu\'ils sont de telle nature que, sans eux, l\'une des parties n\'aurait pas contracté ou aurait contracté à des conditions substantiellement différentes. Leur caractère déterminant s\'apprécie eu égard aux personnes et aux circonstances dans lesquelles le consentement a été donné.',
    tags: ['vices du consentement', 'erreur', 'dol', 'violence', 'nullité relative', 'consentement'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040922' },

  { id: 'cc-1132', code: 'Code civil', article: 'Art. 1132', title: 'Erreur',
    content: 'L\'erreur de droit ou de fait, à moins qu\'elle ne soit inexcusable, est une cause de nullité du contrat lorsqu\'elle porte sur les qualités essentielles de la prestation due ou sur celles du cocontractant.',
    tags: ['erreur', 'vice du consentement', 'qualités essentielles', 'nullité', 'erreur inexcusable'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040913' },

  { id: 'cc-1137', code: 'Code civil', article: 'Art. 1137', title: 'Dol',
    content: 'Le dol est le fait pour un contractant d\'obtenir le consentement de l\'autre par des manœuvres ou des mensonges. Constitue également un dol la dissimulation intentionnelle par l\'un des contractants d\'une information dont il sait le caractère déterminant pour l\'autre partie.',
    tags: ['dol', 'manœuvres', 'mensonge', 'réticence dolosive', 'vice du consentement', 'intention'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040893' },

  { id: 'cc-1140', code: 'Code civil', article: 'Art. 1140', title: 'Violence',
    content: 'Il y a violence lorsqu\'une partie s\'engage sous la pression d\'une contrainte qui lui inspire la crainte d\'exposer sa personne, sa fortune ou celles de ses proches à un mal considérable.',
    tags: ['violence', 'contrainte', 'crainte', 'vice du consentement', 'nullité'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040878' },

  { id: 'cc-1143', code: 'Code civil', article: 'Art. 1143', title: 'Abus de dépendance',
    content: 'Il y a également violence lorsqu\'une partie, abusant de l\'état de dépendance dans lequel se trouve son cocontractant à son égard, obtient de lui un engagement qu\'il n\'aurait pas souscrit en l\'absence d\'une telle contrainte et en tire un avantage manifestement excessif.',
    tags: ['abus de dépendance', 'violence économique', 'état de dépendance', 'avantage excessif', 'nullité'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040867' },

  { id: 'cc-1162', code: 'Code civil', article: 'Art. 1162', title: 'Ordre public et bonnes mœurs',
    content: 'Le contrat ne peut déroger à l\'ordre public ni par ses stipulations, ni par son but, que ce dernier ait été connu ou non par toutes les parties.',
    tags: ['ordre public', 'bonnes mœurs', 'nullité absolue', 'contrat', 'cause illicite'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040778' },

  { id: 'cc-1169', code: 'Code civil', article: 'Art. 1169', title: 'Clause créant un déséquilibre significatif',
    content: 'Un contrat à titre onéreux est nul lorsque, au moment de sa formation, la contrepartie convenue au profit de celui qui s\'engage est illusoire ou dérisoire.',
    tags: ['déséquilibre', 'contrepartie dérisoire', 'nullité', 'contrat onéreux', 'cause'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040779' },

  { id: 'cc-1171', code: 'Code civil', article: 'Art. 1171', title: 'Clauses abusives dans les contrats d\'adhésion',
    content: 'Dans un contrat d\'adhésion, toute clause non négociable, déterminée à l\'avance par l\'une des parties, qui crée un déséquilibre significatif entre les droits et obligations des parties au contrat est réputée non écrite.',
    tags: ['clause abusive', 'contrat d\'adhésion', 'déséquilibre significatif', 'réputée non écrite', 'protection'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040780' },

  { id: 'cc-1231-5', code: 'Code civil', article: 'Art. 1231-5', title: 'Clause pénale — pouvoir modérateur du juge',
    content: 'Lorsque le contrat stipule que celui qui manquera de l\'exécuter paiera une certaine somme à titre de dommages et intérêts, il ne peut être alloué à l\'autre partie une somme plus forte ni moindre. Néanmoins, le juge peut, même d\'office, modérer ou augmenter la pénalité ainsi convenue si elle est manifestement excessive ou dérisoire.',
    tags: ['clause pénale', 'pouvoir modérateur', 'juge', 'dommages-intérêts', 'pénalité'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040854' },

  // ══════════════════════════════════════════════
  // CODE CIVIL — BIENS & PROPRIÉTÉ
  // ══════════════════════════════════════════════
  { id: 'cc-544', code: 'Code civil', article: 'Art. 544', title: 'Droit de propriété',
    content: 'La propriété est le droit de jouir et disposer des choses de la manière la plus absolue, pourvu qu\'on n\'en fasse pas un usage prohibé par les lois ou par les règlements.',
    tags: ['propriété', 'usus', 'fructus', 'abusus', 'droit réel', 'absolu'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006428859' },

  { id: 'cc-545', code: 'Code civil', article: 'Art. 545', title: 'Expropriation',
    content: 'Nul ne peut être contraint de céder sa propriété, si ce n\'est pour cause d\'utilité publique, et moyennant une juste et préalable indemnité.',
    tags: ['expropriation', 'utilité publique', 'indemnité', 'propriété', 'droit fondamental'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006428863' },

  { id: 'cc-2224', code: 'Code civil', article: 'Art. 2224', title: 'Prescription quinquennale',
    content: 'Les actions personnelles ou mobilières se prescrivent par cinq ans à compter du jour où le titulaire d\'un droit a connu ou aurait dû connaître les faits lui permettant de l\'exercer.',
    tags: ['prescription', 'délai', '5 ans', 'cinq ans', 'action personnelle', 'mobilière', 'extinction'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032042137' },

  // ══════════════════════════════════════════════
  // CODE CIVIL — FAMILLE & PERSONNES
  // ══════════════════════════════════════════════
  { id: 'cc-9', code: 'Code civil', article: 'Art. 9', title: 'Droit au respect de la vie privée',
    content: 'Chacun a droit au respect de sa vie privée. Les juges peuvent, sans préjudice de la réparation du dommage subi, prescrire toutes mesures, telles que séquestre, saisie et autres, propres à empêcher ou faire cesser une atteinte à l\'intimité de la vie privée.',
    tags: ['vie privée', 'intimité', 'droit de la personnalité', 'atteinte', 'réparation'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006419288' },

  { id: 'cc-371-1', code: 'Code civil', article: 'Art. 371-1', title: 'Autorité parentale',
    content: 'L\'autorité parentale est un ensemble de droits et de devoirs ayant pour finalité l\'intérêt de l\'enfant. Elle appartient aux parents jusqu\'à la majorité ou l\'émancipation de l\'enfant pour le protéger dans sa sécurité, sa santé et sa moralité, pour assurer son éducation et permettre son développement, dans le respect dû à sa personne.',
    tags: ['autorité parentale', 'enfant', 'intérêt', 'droits', 'devoirs', 'famille', 'éducation'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006427434' },

  { id: 'cc-212', code: 'Code civil', article: 'Art. 212', title: 'Devoirs des époux',
    content: 'Les époux se doivent mutuellement respect, fidélité, secours, assistance.',
    tags: ['mariage', 'époux', 'fidélité', 'respect', 'secours', 'assistance', 'devoirs conjugaux'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006422829' },

  { id: 'cc-220', code: 'Code civil', article: 'Art. 220', title: 'Solidarité des époux pour les dettes ménagères',
    content: 'Chacun des époux a pouvoir pour passer seul les contrats qui ont pour objet l\'entretien du ménage ou l\'éducation des enfants : toute dette ainsi contractée par l\'un oblige l\'autre solidairement.',
    tags: ['mariage', 'solidarité', 'dettes ménagères', 'entretien', 'époux', 'régime primaire'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006422849' },

  { id: 'cc-515-8', code: 'Code civil', article: 'Art. 515-8', title: 'Définition du concubinage',
    content: 'Le concubinage est une union de fait, caractérisée par une vie commune présentant un caractère de stabilité et de continuité, entre deux personnes, de sexe différent ou de même sexe, qui vivent en couple.',
    tags: ['concubinage', 'union libre', 'couple', 'cohabitation', 'union de fait'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006424329' },

  { id: 'cc-731', code: 'Code civil', article: 'Art. 731', title: 'Ordre successoral',
    content: 'Les successions sont dévolues selon la loi, lorsque le défunt n\'a pas disposé de ses biens par des libéralités. Les parents sont appelés à succéder selon les ordres et les degrés tels qu\'ils seront ci-après déterminés.',
    tags: ['succession', 'héritage', 'dévolution', 'ordre', 'héritiers', 'loi'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006431279' },

  { id: 'cc-912', code: 'Code civil', article: 'Art. 912', title: 'Réserve héréditaire',
    content: 'La réserve héréditaire est la part des biens et droits successoraux dont la loi assure la dévolution libre à certains héritiers, dits réservataires, s\'ils sont appelés à la succession et s\'ils l\'acceptent. La quotité disponible est la part des biens et droits successoraux qui n\'est pas réservée par la loi et dont le défunt a pu disposer librement par des libéralités.',
    tags: ['réserve héréditaire', 'quotité disponible', 'héritiers réservataires', 'succession', 'libéralité'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006431523' },

  // ══════════════════════════════════════════════
  // CODE CIVIL — QUASI-CONTRATS
  // ══════════════════════════════════════════════
  { id: 'cc-1300', code: 'Code civil', article: 'Art. 1300', title: 'Gestion d\'affaires',
    content: 'Celui qui, sans y être tenu, gère sciemment et utilement l\'affaire d\'autrui, à l\'insu ou sans opposition du maître de cette affaire, est soumis, dans l\'accomplissement des actes juridiques et matériels de sa gestion, à toutes les obligations d\'un mandataire.',
    tags: ['gestion d\'affaires', 'quasi-contrat', 'gérant', 'maître de l\'affaire', 'mandataire'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041199' },

  { id: 'cc-1302', code: 'Code civil', article: 'Art. 1302', title: 'Paiement de l\'indu',
    content: 'Tout paiement suppose une dette ; ce qui a été reçu sans être dû est sujet à restitution. La restitution n\'est pas admise à l\'égard des obligations naturelles qui ont été volontairement acquittées.',
    tags: ['paiement de l\'indu', 'quasi-contrat', 'restitution', 'dette', 'obligation naturelle'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041193' },

  { id: 'cc-1303', code: 'Code civil', article: 'Art. 1303', title: 'Enrichissement injustifié',
    content: 'En dehors des cas de gestion d\'affaires et de paiement de l\'indu, celui qui bénéficie d\'un enrichissement injustifié au détriment d\'autrui doit, à celui qui s\'en trouve appauvri, une indemnité égale à la moindre des deux valeurs de l\'enrichissement et de l\'appauvrissement.',
    tags: ['enrichissement injustifié', 'enrichissement sans cause', 'appauvrissement', 'indemnité', 'quasi-contrat'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041191' },

  // ══════════════════════════════════════════════
  // CODE PÉNAL
  // ══════════════════════════════════════════════
  { id: 'cp-111-1', code: 'Code pénal', article: 'Art. 111-1', title: 'Classification des infractions',
    content: 'Les infractions pénales sont classées, suivant leur gravité, en crimes, délits et contraventions.',
    tags: ['classification', 'infraction', 'crime', 'délit', 'contravention', 'droit pénal général'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417100' },

  { id: 'cp-111-2', code: 'Code pénal', article: 'Art. 111-2', title: 'Légalité des peines',
    content: 'La loi détermine les crimes et délits et fixe les peines applicables à leurs auteurs. Le règlement détermine les contraventions et fixe, dans les limites et selon les distinctions établies par la loi, les peines applicables aux auteurs de contraventions.',
    tags: ['légalité des peines', 'légalité criminelle', 'loi', 'règlement', 'principes'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417104' },

  { id: 'cp-121-1', code: 'Code pénal', article: 'Art. 121-1', title: 'Responsabilité pénale personnelle',
    content: 'Nul n\'est responsable pénalement que de son propre fait.',
    tags: ['responsabilité pénale', 'personnalité', 'fait personnel', 'principe'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417198' },

  { id: 'cp-121-3', code: 'Code pénal', article: 'Art. 121-3', title: 'Élément intentionnel — dol général',
    content: 'Il n\'y a point de crime ou de délit sans intention de le commettre. Toutefois, lorsque la loi le prévoit, il y a délit en cas de mise en danger délibérée de la personne d\'autrui. Il y a également délit, lorsque la loi le prévoit, en cas de faute d\'imprudence, de négligence ou de manquement à une obligation de prudence ou de sécurité prévue par la loi ou le règlement, s\'il est établi que l\'auteur des faits n\'a pas accompli les diligences normales compte tenu, le cas échéant, de la nature de ses missions ou de ses fonctions, de ses compétences ainsi que du pouvoir et des moyens dont il disposait.',
    tags: ['élément moral', 'intention', 'dol général', 'imprudence', 'négligence', 'mise en danger'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417206' },

  { id: 'cp-121-4', code: 'Code pénal', article: 'Art. 121-4', title: 'Auteur et coauteur',
    content: 'Est auteur de l\'infraction la personne qui : 1° Commet les faits incriminés ; 2° Tente de commettre un crime ou, dans les cas prévus par la loi, un délit.',
    tags: ['auteur', 'coauteur', 'tentative', 'infraction', 'participation criminelle'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417210' },

  { id: 'cp-121-6', code: 'Code pénal', article: 'Art. 121-6', title: 'Complicité — peine',
    content: 'Sera puni comme auteur le complice de l\'infraction, au sens de l\'article 121-7.',
    tags: ['complicité', 'complice', 'peine', 'auteur', 'participation criminelle'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417214' },

  { id: 'cp-121-7', code: 'Code pénal', article: 'Art. 121-7', title: 'Définition de la complicité',
    content: 'Est complice d\'un crime ou d\'un délit la personne qui sciemment, par aide ou assistance, en a facilité la préparation ou la consommation. Est également complice la personne qui par don, promesse, menace, ordre, abus d\'autorité ou de pouvoir aura provoqué à une infraction ou donné des instructions pour la commettre.',
    tags: ['complicité', 'aide', 'assistance', 'provocation', 'instructions', 'sciemment'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417218' },

  { id: 'cp-122-1', code: 'Code pénal', article: 'Art. 122-1', title: 'Trouble mental — irresponsabilité pénale',
    content: 'N\'est pas pénalement responsable la personne qui était atteinte, au moment des faits, d\'un trouble mental ayant aboli son discernement ou le contrôle de ses actes. La personne qui était atteinte, au moment des faits, d\'un trouble mental ayant altéré son discernement ou entravé le contrôle de ses actes demeure punissable ; toutefois, la juridiction tient compte de cette circonstance lorsqu\'elle détermine la peine et en fixe le régime.',
    tags: ['irresponsabilité pénale', 'trouble mental', 'discernement', 'abolition', 'altération'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417221' },

  { id: 'cp-122-2', code: 'Code pénal', article: 'Art. 122-2', title: 'Contrainte — fait justificatif',
    content: 'N\'est pas pénalement responsable la personne qui a agi sous l\'empire d\'une force ou d\'une contrainte à laquelle elle n\'a pu résister.',
    tags: ['contrainte', 'fait justificatif', 'irresponsabilité', 'force', 'résistance impossible'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417225' },

  { id: 'cp-122-4', code: 'Code pénal', article: 'Art. 122-4', title: 'Ordre de la loi — commandement de l\'autorité',
    content: 'N\'est pas pénalement responsable la personne qui accomplit un acte prescrit ou autorisé par des dispositions législatives ou réglementaires. N\'est pas pénalement responsable la personne qui accomplit un acte commandé par l\'autorité légitime, sauf si cet acte est manifestement illégal.',
    tags: ['ordre de la loi', 'fait justificatif', 'commandement de l\'autorité', 'légalité', 'légitimité'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417231' },

  { id: 'cp-122-5', code: 'Code pénal', article: 'Art. 122-5', title: 'Légitime défense',
    content: 'N\'est pas pénalement responsable la personne qui, devant une atteinte injustifiée envers elle-même ou autrui, accomplit, dans le même temps, un acte commandé par la nécessité de la légitime défense d\'elle-même ou d\'autrui, sauf s\'il y a disproportion entre les moyens de défense employés et la gravité de l\'atteinte.',
    tags: ['légitime défense', 'fait justificatif', 'atteinte injustifiée', 'nécessité', 'proportion'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417235' },

  { id: 'cp-131-1', code: 'Code pénal', article: 'Art. 131-1', title: 'Peines criminelles',
    content: 'Pour les crimes, les peines privatives de liberté encourues sont : La réclusion criminelle ou la détention criminelle à perpétuité ; La réclusion criminelle ou la détention criminelle de trente ans au plus ; La réclusion criminelle ou la détention criminelle de vingt ans au plus ; La réclusion criminelle ou la détention criminelle de quinze ans au plus.',
    tags: ['peines', 'crime', 'réclusion criminelle', 'détention criminelle', 'perpétuité'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417314' },

  { id: 'cp-221-1', code: 'Code pénal', article: 'Art. 221-1', title: 'Meurtre',
    content: 'Le fait de donner volontairement la mort à autrui constitue un meurtre. Il est puni de trente ans de réclusion criminelle.',
    tags: ['meurtre', 'mort', 'homicide volontaire', 'réclusion criminelle', '30 ans'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417526' },

  { id: 'cp-221-3', code: 'Code pénal', article: 'Art. 221-3', title: 'Assassinat',
    content: 'Le meurtre commis avec préméditation ou avec guet-apens constitue un assassinat. Il est puni de la réclusion criminelle à perpétuité.',
    tags: ['assassinat', 'préméditation', 'guet-apens', 'homicide aggravé', 'perpétuité'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417533' },

  { id: 'cp-311-1', code: 'Code pénal', article: 'Art. 311-1', title: 'Vol',
    content: 'Le vol est la soustraction frauduleuse de la chose d\'autrui.',
    tags: ['vol', 'soustraction frauduleuse', 'propriété', 'bien', 'définition'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417818' },

  { id: 'cp-313-1', code: 'Code pénal', article: 'Art. 313-1', title: 'Escroquerie',
    content: 'L\'escroquerie est le fait, soit par l\'usage d\'un faux nom ou d\'une fausse qualité, soit par l\'abus d\'une qualité vraie, soit par l\'emploi de manœuvres frauduleuses, de tromper une personne physique ou morale et de la déterminer ainsi, à son préjudice ou au préjudice d\'un tiers, à remettre des fonds, des valeurs ou un bien quelconque, à fournir un service ou à consentir un acte opérant obligation ou décharge.',
    tags: ['escroquerie', 'tromperie', 'manœuvres frauduleuses', 'faux nom', 'préjudice'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417974' },

  { id: 'cp-222-22', code: 'Code pénal', article: 'Art. 222-22', title: 'Définition du viol',
    content: 'Constitue une agression sexuelle tout acte de pénétration sexuelle, de quelque nature qu\'il soit, ou tout acte bucco-génital commis sur la personne d\'autrui ou sur la personne de l\'auteur par violence, contrainte, menace ou surprise. Le viol et les autres agressions sexuelles sont constitués lorsqu\'ils ont été imposés à la victime dans les circonstances prévues aux articles 222-22 à 222-30.',
    tags: ['viol', 'agression sexuelle', 'violence', 'contrainte', 'menace', 'surprise', 'consentement'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417626' },

  // ══════════════════════════════════════════════
  // CODE DU TRAVAIL
  // ══════════════════════════════════════════════
  { id: 'ct-L1221-1', code: 'Code du travail', article: 'Art. L. 1221-1', title: 'Contrat de travail — définition',
    content: 'Le contrat de travail est soumis aux règles du droit commun. Il peut être établi selon les formes que les parties contractantes décident d\'adopter. Le contrat de travail est caractérisé par un lien de subordination juridique entre l\'employeur et le salarié.',
    tags: ['contrat de travail', 'subordination', 'lien de subordination', 'emploi', 'salarié'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006900856' },

  { id: 'ct-L1237-19', code: 'Code du travail', article: 'Art. L. 1237-19', title: 'Rupture conventionnelle',
    content: 'L\'employeur et le salarié peuvent convenir en commun des conditions de la rupture du contrat de travail qui les lie. La rupture conventionnelle, exclusive du licenciement ou de la démission, ne peut être imposée par l\'une ou l\'autre des parties.',
    tags: ['rupture conventionnelle', 'séparation amiable', 'contrat de travail', 'accord', 'licenciement'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000019068171' },

  { id: 'ct-L1232-1', code: 'Code du travail', article: 'Art. L. 1232-1', title: 'Licenciement pour motif personnel',
    content: 'Tout licenciement pour motif personnel est motivé dans les conditions définies par le présent chapitre. Il est justifié par une cause réelle et sérieuse.',
    tags: ['licenciement', 'motif personnel', 'cause réelle et sérieuse', 'justification'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006901043' },

  { id: 'ct-L1233-1', code: 'Code du travail', article: 'Art. L. 1233-1', title: 'Licenciement pour motif économique',
    content: 'Constitue un licenciement pour motif économique le licenciement effectué par un employeur pour un ou plusieurs motifs non inhérents à la personne du salarié résultant d\'une suppression ou transformation d\'emploi ou d\'une modification, refusée par le salarié, d\'un élément essentiel du contrat de travail, consécutives notamment à des difficultés économiques.',
    tags: ['licenciement économique', 'suppression d\'emploi', 'difficultés économiques', 'transformation', 'reclassement'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006901063' },

  { id: 'ct-L1152-1', code: 'Code du travail', article: 'Art. L. 1152-1', title: 'Harcèlement moral',
    content: 'Aucun salarié ne doit subir les agissements répétés de harcèlement moral qui ont pour objet ou pour effet une dégradation de ses conditions de travail susceptible de porter atteinte à ses droits et à sa dignité, d\'altérer sa santé physique ou mentale ou de compromettre son avenir professionnel.',
    tags: ['harcèlement moral', 'agissements répétés', 'dégradation', 'dignité', 'santé', 'travail'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006900818' },

  { id: 'ct-L3121-1', code: 'Code du travail', article: 'Art. L. 3121-1', title: 'Durée du travail effectif',
    content: 'La durée du travail effectif est le temps pendant lequel le salarié est à la disposition de l\'employeur et se conforme à ses directives sans pouvoir vaquer librement à des occupations personnelles.',
    tags: ['durée du travail', 'temps de travail effectif', 'disponibilité', 'directive', 'occupation personnelle'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033020284' },

  { id: 'ct-L3121-27', code: 'Code du travail', article: 'Art. L. 3121-27', title: 'Durée légale du travail — 35h',
    content: 'La durée légale de travail effectif des salariés à temps complet est fixée à trente-cinq heures par semaine.',
    tags: ['durée légale', '35 heures', 'temps plein', 'semaine', 'travail'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033020275' },

  { id: 'ct-L2141-1', code: 'Code du travail', article: 'Art. L. 2141-1', title: 'Liberté syndicale',
    content: 'Tout salarié peut librement adhérer au syndicat professionnel de son choix. Tout salarié peut exercer librement les fonctions de délégué syndical dans l\'entreprise ou à l\'extérieur de celle-ci.',
    tags: ['syndicat', 'liberté syndicale', 'adhésion', 'délégué syndical', 'représentation'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006902164' },

  // ══════════════════════════════════════════════
  // DROIT ADMINISTRATIF
  // ══════════════════════════════════════════════
  { id: 'da-1', code: 'Droit administratif', article: 'Principe', title: 'Principe de légalité',
    content: 'Le principe de légalité impose à l\'administration de respecter la hiérarchie des normes : la Constitution, les traités internationaux, la loi, les règlements. L\'acte administratif illégal peut être annulé par le juge administratif par voie d\'excès de pouvoir.',
    tags: ['légalité', 'hiérarchie des normes', 'administration', 'acte administratif', 'recours pour excès de pouvoir'], url: '' },

  { id: 'da-2', code: 'Droit administratif', article: 'Principe', title: 'Service public — critères (arrêt Narcy)',
    content: 'Le service public se définit par trois critères cumulatifs : 1° Une mission d\'intérêt général ; 2° Un rattachement à une personne publique (directement ou par habilitation) ; 3° La présence de prérogatives de puissance publique ou l\'application d\'un régime exorbitant du droit commun.',
    tags: ['service public', 'intérêt général', 'personne publique', 'prérogatives', 'arrêt Narcy', 'SPIC', 'SPA'], url: '' },

  { id: 'da-3', code: 'Droit administratif', article: 'Principe', title: 'Lois de Rolland — principes du service public',
    content: 'Les trois lois de Rolland régissent tout service public : 1° Continuité du service public ; 2° Mutabilité (ou adaptabilité) ; 3° Égalité des usagers devant le service public. Ces principes s\'appliquent tant aux SPA qu\'aux SPIC.',
    tags: ['lois de Rolland', 'service public', 'continuité', 'mutabilité', 'égalité', 'usagers'], url: '' },

  { id: 'da-4', code: 'Droit administratif', article: 'Principe', title: 'Recours pour excès de pouvoir',
    content: 'Le recours pour excès de pouvoir (REP) est un recours contentieux objectif qui tend à l\'annulation d\'un acte administratif illégal. Il est ouvert sans texte contre tout acte administratif faisant grief, devant le tribunal administratif compétent dans un délai de deux mois à compter de la notification ou publication de l\'acte.',
    tags: ['REP', 'recours pour excès de pouvoir', 'annulation', 'acte administratif', 'tribunal administratif', 'contentieux'], url: '' },

  { id: 'da-5', code: 'Droit administratif', article: 'Principe', title: 'Responsabilité administrative pour faute',
    content: 'La responsabilité de l\'État et des personnes publiques peut être engagée en raison d\'une faute de service. La faute de service (ou faute lourde pour certaines activités) est la faute commise par un agent dans l\'exercice de ses fonctions, détachable de la personne de l\'agent. Le juge administratif en connaît.',
    tags: ['responsabilité administrative', 'faute de service', 'État', 'dommage', 'juge administratif'], url: '' },

  { id: 'da-6', code: 'Droit administratif', article: 'Principe', title: 'Acte administratif unilatéral',
    content: 'L\'acte administratif unilatéral (AAU) est une décision prise unilatéralement par l\'administration qui modifie l\'ordonnancement juridique. Il bénéficie du privilège du préalable (exécution immédiate) et de la présomption de légalité. Il est soumis au respect du principe de légalité et peut être attaqué par voie de REP.',
    tags: ['acte administratif unilatéral', 'AAU', 'décision', 'privilège du préalable', 'légalité'], url: '' },

  { id: 'da-7', code: 'Droit administratif', article: 'Principe', title: 'Contrat administratif',
    content: 'Un contrat est administratif soit par détermination de la loi, soit en raison de son objet (participation à l\'exécution du service public) ou de la présence d\'une clause exorbitante du droit commun. Il est soumis au droit administratif et au juge administratif.',
    tags: ['contrat administratif', 'clause exorbitante', 'service public', 'marchés publics', 'concession'], url: '' },

  // ══════════════════════════════════════════════
  // DROIT CONSTITUTIONNEL
  // ══════════════════════════════════════════════
  { id: 'const-1', code: 'Constitution de 1958', article: 'Art. 1', title: 'République française — principes fondamentaux',
    content: 'La France est une République indivisible, laïque, démocratique et sociale. Elle assure l\'égalité devant la loi de tous les citoyens sans distinction d\'origine, de race ou de religion. Elle respecte toutes les croyances. Son organisation est décentralisée.',
    tags: ['République', 'indivisible', 'laïcité', 'démocratie', 'égalité', 'social', 'décentralisation'], url: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006527453' },

  { id: 'const-2', code: 'Constitution de 1958', article: 'Art. 3', title: 'Souveraineté nationale',
    content: 'La souveraineté nationale appartient au peuple qui l\'exerce par ses représentants et par la voie du référendum. Aucune section du peuple ni aucun individu ne peut s\'en attribuer l\'exercice.',
    tags: ['souveraineté', 'peuple', 'représentants', 'référendum', 'démocratie représentative', 'semi-directe'], url: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006527457' },

  { id: 'const-4', code: 'Constitution de 1958', article: 'Art. 34', title: 'Domaine de la loi',
    content: 'La loi est votée par le Parlement. La loi fixe les règles concernant : les droits civiques et les garanties fondamentales accordées aux citoyens pour l\'exercice des libertés publiques ; les sujétions imposées par la Défense Nationale aux citoyens en leur personne et en leurs biens ; la nationalité, l\'état et la capacité des personnes, les régimes matrimoniaux, les successions et libéralités ; la détermination des crimes et délits ainsi que les peines qui leur sont applicables.',
    tags: ['domaine de la loi', 'Parlement', 'répartition des compétences', 'art 34', 'loi vs règlement'], url: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006527490' },

  { id: 'const-5', code: 'Constitution de 1958', article: 'Art. 37', title: 'Pouvoir réglementaire',
    content: 'Les matières autres que celles qui sont du domaine de la loi ont un caractère réglementaire. Les textes de forme législative intervenus en ces matières peuvent être modifiés par décrets pris après avis du Conseil d\'État.',
    tags: ['pouvoir réglementaire', 'règlement', 'décret', 'art 37', 'domaine réglementaire'], url: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006527493' },

  { id: 'const-6', code: 'Constitution de 1958', article: 'Art. 49', title: 'Responsabilité gouvernementale',
    content: 'Le Premier ministre, après délibération du Conseil des ministres, engage devant l\'Assemblée nationale la responsabilité du Gouvernement sur son programme ou éventuellement sur une déclaration de politique générale. L\'Assemblée nationale met en cause la responsabilité du Gouvernement par le vote d\'une motion de censure.',
    tags: ['responsabilité gouvernementale', 'motion de censure', 'vote de confiance', 'art 49', '49-3', 'Assemblée nationale'], url: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006527505' },

  { id: 'const-7', code: 'Constitution de 1958', article: 'Art. 61-1', title: 'Question prioritaire de constitutionnalité (QPC)',
    content: 'Lorsque, à l\'occasion d\'une instance en cours devant une juridiction, il est soutenu qu\'une disposition législative porte atteinte aux droits et libertés que la Constitution garantit, le Conseil constitutionnel peut être saisi de cette question sur renvoi du Conseil d\'État ou de la Cour de cassation.',
    tags: ['QPC', 'question prioritaire de constitutionnalité', 'Conseil constitutionnel', 'droits fondamentaux', 'contrôle a posteriori'], url: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000019237211' },

  { id: 'ddhc-16', code: 'DDHC 1789', article: 'Art. 16', title: 'Séparation des pouvoirs',
    content: 'Toute Société dans laquelle la garantie des Droits n\'est pas assurée, ni la séparation des Pouvoirs déterminée, n\'a point de Constitution.',
    tags: ['séparation des pouvoirs', 'Constitution', 'droits fondamentaux', 'DDHC', '1789'], url: '' },

  { id: 'ddhc-17', code: 'DDHC 1789', article: 'Art. 17', title: 'Droit de propriété — inviolable et sacré',
    content: 'La propriété étant un droit inviolable et sacré, nul ne peut en être privé, si ce n\'est lorsque la nécessité publique, légalement constatée, l\'exige évidemment, et sous la condition d\'une juste et préalable indemnité.',
    tags: ['propriété', 'droit fondamental', 'inviolable', 'expropriation', 'nécessité publique', 'DDHC'], url: '' },

  // ══════════════════════════════════════════════
  // CODE DE COMMERCE
  // ══════════════════════════════════════════════
  { id: 'cco-L210-1', code: 'Code de commerce', article: 'Art. L. 210-1', title: 'Sociétés commerciales — formes',
    content: 'Le caractère commercial d\'une société est déterminé par sa forme ou par son objet. Sont commerciales à raison de leur forme et quel que soit leur objet, les sociétés en nom collectif, les sociétés en commandite simple, les sociétés à responsabilité limitée et les sociétés par actions.',
    tags: ['société commerciale', 'forme sociale', 'SNC', 'SARL', 'SA', 'SAS', 'objet social'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006221696' },

  { id: 'cco-L223-1', code: 'Code de commerce', article: 'Art. L. 223-1', title: 'SARL — définition',
    content: 'La société à responsabilité limitée est instituée par une ou plusieurs personnes qui ne supportent les pertes qu\'à concurrence de leurs apports. Quand la société ne comporte qu\'une seule personne, celle-ci est dénommée « associé unique ».',
    tags: ['SARL', 'responsabilité limitée', 'apports', 'associé unique', 'EURL'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006221852' },

  { id: 'cco-L225-1', code: 'Code de commerce', article: 'Art. L. 225-1', title: 'Société anonyme — définition',
    content: 'La société anonyme est la société dont le capital est divisé en actions et qui est constituée entre des associés qui ne supportent les pertes qu\'à concurrence de leurs apports.',
    tags: ['SA', 'société anonyme', 'capital', 'actions', 'actionnaires', 'responsabilité limitée'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006221968' },

  { id: 'cco-L631-1', code: 'Code de commerce', article: 'Art. L. 631-1', title: 'Redressement judiciaire',
    content: 'Il est institué une procédure de redressement judiciaire ouverte à tout débiteur qui, dans l\'impossibilité de faire face au passif exigible avec son actif disponible, est en état de cessation de ses paiements. Cette procédure est destinée à permettre la poursuite de l\'activité de l\'entreprise, le maintien de l\'emploi et l\'apurement du passif.',
    tags: ['redressement judiciaire', 'cessation des paiements', 'passif exigible', 'actif disponible', 'procédure collective'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032312096' },

  { id: 'cco-L640-1', code: 'Code de commerce', article: 'Art. L. 640-1', title: 'Liquidation judiciaire',
    content: 'Il est institué une procédure de liquidation judiciaire ouverte à tout débiteur en cessation des paiements et dont le redressement est manifestement impossible. Cette procédure est destinée à mettre fin à l\'activité de l\'entreprise ou à réaliser le patrimoine du débiteur par une cession globale ou séparée de ses droits et de ses biens.',
    tags: ['liquidation judiciaire', 'cessation des paiements', 'redressement impossible', 'procédure collective', 'cession'], url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032312141' },

  // ══════════════════════════════════════════════
  // DROIT EUROPÉEN
  // ══════════════════════════════════════════════
  { id: 'ue-1', code: 'Droit européen', article: 'TFUE — Principe', title: 'Primauté du droit de l\'Union européenne',
    content: 'Le droit de l\'Union européenne est primaire sur les droits nationaux des États membres. Cette primauté, dégagée par la CJCE dans l\'arrêt Costa c/ ENEL (1964), signifie que toute règle nationale contraire au droit de l\'UE doit être écartée par les juridictions nationales, sans attendre son abrogation formelle.',
    tags: ['primauté', 'droit européen', 'droit de l\'UE', 'Costa c/ ENEL', 'CJUE', 'États membres'], url: '' },

  { id: 'ue-2', code: 'Droit européen', article: 'CJCE', title: 'Effet direct du droit de l\'UE',
    content: 'L\'effet direct, dégagé par la CJCE dans l\'arrêt Van Gend en Loos (1963), permet aux particuliers d\'invoquer directement des dispositions du droit de l\'Union devant les juridictions nationales. Les règlements ont un effet direct général ; les directives ont un effet direct vertical (contre l\'État) lorsqu\'elles sont précises, inconditionnelles et que le délai de transposition est expiré.',
    tags: ['effet direct', 'droit européen', 'Van Gend en Loos', 'règlement', 'directive', 'invocabilité'], url: '' },

  { id: 'ue-3', code: 'Droit européen', article: 'TFUE — Art. 267', title: 'Question préjudicielle',
    content: 'La Cour de justice de l\'Union européenne (CJUE) est compétente pour statuer à titre préjudiciel sur l\'interprétation des traités et sur la validité et l\'interprétation des actes pris par les institutions de l\'Union. Toute juridiction nationale dont la décision n\'est pas susceptible de recours est tenue de saisir la CJUE.',
    tags: ['question préjudicielle', 'CJUE', 'renvoi préjudiciel', 'interprétation', 'droit européen', 'art 267 TFUE'], url: '' },

  // ══════════════════════════════════════════════
  // GRANDS ARRÊTS — RESPONSABILITÉ CIVILE
  // ══════════════════════════════════════════════
  { id: 'jp-arrRég', code: 'Jurisprudence', article: 'Cass. ass. plén., 29 mars 1991', title: 'Arrêt Blieck — Responsabilité du fait d\'autrui (clause générale)',
    content: 'La Cour de cassation affirme pour la première fois qu\'il existe une clause générale de responsabilité du fait d\'autrui sur le fondement de l\'alinéa 1er de l\'article 1384 ancien (1242 actuel). Un centre accueillant des personnes handicapées mentales est déclaré responsable du dommage causé par l\'un d\'eux.',
    tags: ['arrêt Blieck', 'responsabilité du fait d\'autrui', 'clause générale', 'acceptation de la charge', 'organisation'], url: '' },

  { id: 'jp-Perruche', code: 'Jurisprudence', article: 'Cass. ass. plén., 17 nov. 2000', title: 'Arrêt Perruche — Préjudice de naissance',
    content: 'La Cour de cassation reconnaît que l\'enfant né handicapé en raison d\'une faute médicale qui a empêché la mère de recourir à l\'interruption volontaire de grossesse peut demander réparation du préjudice résultant de ce handicap. Arrêt très controversé, conduit à la loi du 4 mars 2002 (loi Kouchner) qui l\'inverse.',
    tags: ['arrêt Perruche', 'préjudice de naissance', 'faute médicale', 'IVG', 'handicap', 'loi Kouchner'], url: '' },

  { id: 'jp-Lamoriciere', code: 'Jurisprudence', article: 'Cass. ch. req., 13 févr. 1930', title: 'Arrêt Jand\'heur — Responsabilité du fait des choses',
    content: 'La Cour de cassation consacre une présomption de responsabilité du fait des choses : le gardien d\'une chose est présumé responsable du dommage que cette chose a causé, sans que la victime ait à prouver une faute de sa part. La présomption n\'est détruite que par la preuve d\'une cause étrangère.',
    tags: ['responsabilité du fait des choses', 'arrêt Jand\'heur', 'gardien', 'présomption', 'cause étrangère', 'chose'], url: '' },

  { id: 'jp-Causalite', code: 'Jurisprudence', article: 'Divers arrêts', title: 'Causalité — théories',
    content: 'Deux théories s\'opposent : 1° La théorie de l\'équivalence des conditions (in absentia) : chaque condition nécessaire au dommage est une cause ; 2° La théorie de la causalité adéquate : seule la cause qui, selon le cours normal des choses, était de nature à produire le dommage est retenue. La jurisprudence française retient principalement la causalité adéquate.',
    tags: ['causalité', 'lien causal', 'équivalence des conditions', 'causalité adéquate', 'responsabilité', 'dommage'], url: '' },

  { id: 'jp-PertDeChance', code: 'Jurisprudence', article: 'Cass. civ. 1re, 27 mars 1973', title: 'Perte de chance — préjudice autonome',
    content: 'La perte de chance constitue un préjudice réparable distinct et autonome lorsqu\'elle est réelle et sérieuse. Elle s\'apprécie proportionnellement aux probabilités de succès : la réparation correspond à une fraction des bénéfices attendus, non à leur totalité. Elle est couramment appliquée en responsabilité médicale et dans les actions contre les avocats.',
    tags: ['perte de chance', 'préjudice', 'probabilité', 'réparation', 'avocat', 'responsabilité médicale'], url: '' },

  // ══════════════════════════════════════════════
  // GRANDS ARRÊTS — CONTRATS
  // ══════════════════════════════════════════════
  { id: 'jp-Craponne', code: 'Jurisprudence', article: 'Cass. civ., 6 mars 1876', title: 'Arrêt Canal de Craponne — Révision pour imprévision (refus)',
    content: 'La Cour de cassation affirme que les juges ne peuvent pas modifier un contrat pour tenir compte d\'un déséquilibre économique survenu après sa conclusion. Ce refus de la révision pour imprévision en droit privé a perduré jusqu\'à la réforme de 2016 (art. 1195 C. civ.) qui l\'admet désormais.',
    tags: ['Canal de Craponne', 'imprévision', 'révision judiciaire', 'déséquilibre économique', 'pacta sunt servanda', 'art 1195'], url: '' },

  { id: 'jp-Chronopost', code: 'Jurisprudence', article: 'Cass. com., 22 oct. 1996', title: 'Arrêt Chronopost — Clause limitative de responsabilité',
    content: 'La Cour de cassation réputé non écrite la clause limitative de responsabilité d\'un transporteur express (Chronopost) qui vidait de sa substance l\'obligation essentielle du contrat. Consacre la notion d\'obligation essentielle et l\'inefficacité des clauses qui la contredisent.',
    tags: ['Chronopost', 'clause limitative de responsabilité', 'obligation essentielle', 'réputée non écrite', 'contrat'], url: '' },

  // ══════════════════════════════════════════════
  // GRANDS ARRÊTS — DROIT ADMINISTRATIF
  // ══════════════════════════════════════════════
  { id: 'jp-Blanco', code: 'Jurisprudence', article: 'TC, 8 févr. 1873', title: 'Arrêt Blanco — Fondement du droit administratif',
    content: 'Le Tribunal des conflits pose le principe de l\'autonomie du droit administratif : la responsabilité de l\'État pour les dommages causés à des particuliers par le service public ne peut être régie par les principes du Code civil. Elle obéit à des règles spéciales et relève de la juridiction administrative.',
    tags: ['arrêt Blanco', 'droit administratif', 'autonomie', 'responsabilité de l\'État', 'service public', 'Tribunal des conflits'], url: '' },

  { id: 'jp-Cadot', code: 'Jurisprudence', article: 'CE, 13 déc. 1889', title: 'Arrêt Cadot — Compétence générale du Conseil d\'État',
    content: 'Le Conseil d\'État affirme sa compétence générale de juge administratif de droit commun, mettant fin au système du ministre-juge. Tout acte administratif illégal peut être porté devant le juge administratif.',
    tags: ['arrêt Cadot', 'Conseil d\'État', 'compétence générale', 'ministre-juge', 'juge administratif'], url: '' },

  { id: 'jp-Epoux-V', code: 'Jurisprudence', article: 'CE, Ass., 9 avr. 1993', title: 'Arrêt Bianchi — Responsabilité hospitalière sans faute',
    content: 'Le Conseil d\'État admet la responsabilité sans faute du service public hospitalier lorsqu\'un patient subit un dommage grave, anormal et directement causé par un acte médical nécessaire au diagnostic ou au traitement, alors même que ce risque était connu.',
    tags: ['responsabilité sans faute', 'hôpital public', 'risque médical', 'Conseil d\'État', 'dommage grave', 'aléa thérapeutique'], url: '' },

  // ══════════════════════════════════════════════
  // DÉFINITIONS ESSENTIELLES
  // ══════════════════════════════════════════════
  { id: 'def-prescription', code: 'Définitions', article: 'Définition', title: 'Prescription extinctive',
    content: 'La prescription extinctive est un mode d\'extinction d\'un droit résultant de l\'inaction de son titulaire pendant un certain délai. En droit commun, le délai est de 5 ans (art. 2224 C. civ.) à compter du jour où le titulaire a connu ou aurait dû connaître les faits permettant l\'exercice du droit. Ne pas confondre avec la prescription acquisitive (usucapion) qui permet d\'acquérir un droit réel par possession prolongée.',
    tags: ['prescription extinctive', 'délai', '5 ans', 'extinction', 'inaction', 'forclusion'], url: '' },

  { id: 'def-forcemajeure', code: 'Définitions', article: 'Définition', title: 'Force majeure',
    content: 'La force majeure (art. 1218 C. civ.) est un événement qui cumule trois caractères : 1° Extériorité (indépendant du débiteur) ; 2° Imprévisibilité (au moment de la conclusion du contrat) ; 3° Irrésistibilité (effets impossibles à éviter). Elle exonère totalement le débiteur de sa responsabilité contractuelle. À distinguer du cas fortuit (aléa imprévu mais non extérieur).',
    tags: ['force majeure', 'extériorité', 'imprévisibilité', 'irrésistibilité', 'exonération', 'cas fortuit'], url: '' },

  { id: 'def-abus-droit', code: 'Définitions', article: 'Définition', title: 'Abus de droit',
    content: 'L\'abus de droit est l\'exercice d\'un droit de façon excessive ou détournée de sa finalité. Il peut être caractérisé par : l\'intention de nuire (acte d\'émulation) ; ou l\'usage anormal du droit (dommage excessif, disproportion). Sanction : engagement de la responsabilité civile de l\'auteur, voire inopposabilité de l\'acte abusif.',
    tags: ['abus de droit', 'intention de nuire', 'détournement', 'exercice excessif', 'responsabilité'], url: '' },

  { id: 'def-nullite', code: 'Définitions', article: 'Définition', title: 'Nullité relative et absolue',
    content: 'La nullité est la sanction de la formation irrégulière d\'un acte juridique. Nullité absolue : sanctionne la violation d\'une règle d\'ordre public ou d\'intérêt général ; elle peut être invoquée par tout intéressé et le juge peut la soulever d\'office. Nullité relative : protège un intérêt particulier (vices du consentement, incapacité) ; seule la partie protégée peut s\'en prévaloir. Les deux se prescrivent par 5 ans.',
    tags: ['nullité', 'nullité absolue', 'nullité relative', 'ordre public', 'intérêt particulier', 'vice', 'prescription'], url: '' },

  { id: 'def-enrichissement', code: 'Définitions', article: 'Définition', title: 'Enrichissement injustifié',
    content: 'L\'enrichissement injustifié (art. 1303 C. civ.) est une source autonome d\'obligations. Conditions : enrichissement de l\'un ; appauvrissement corrélatif de l\'autre ; lien de causalité entre les deux ; absence de cause (ni contrat, ni loi, ni quasi-contrat). L\'action de in rem verso est subsidiaire. L\'indemnité est la moindre valeur entre l\'enrichissement et l\'appauvrissement.',
    tags: ['enrichissement injustifié', 'enrichissement sans cause', 'action de in rem verso', 'subsidiarité', 'appauvrissement'], url: '' },

  { id: 'def-responsabilite', code: 'Définitions', article: 'Définition', title: 'Conditions de la responsabilité civile',
    content: 'La responsabilité civile délictuelle suppose la réunion de trois éléments : 1° Un fait générateur (faute, fait d\'autrui, fait d\'une chose) ; 2° Un dommage (certain, direct, personnel, légitime) ; 3° Un lien de causalité entre le fait générateur et le dommage. Elle tend à la réparation du préjudice subi par la victime.',
    tags: ['responsabilité civile', 'fait générateur', 'dommage', 'lien de causalité', 'trilogie', 'réparation'], url: '' },

  { id: 'def-contrat-def', code: 'Définitions', article: 'Définition', title: 'Classification des contrats',
    content: 'Les contrats se classent selon : la formation (consensuel, solennel, réel) ; les obligations créées (synallagmatique/bilatéral vs unilatéral ; commutatif vs aléatoire) ; l\'intérêt des parties (à titre onéreux vs gratuit) ; le mode de conclusion (gré à gré vs adhésion) ; la durée (à exécution instantanée vs successive).',
    tags: ['classification des contrats', 'synallagmatique', 'unilatéral', 'commutatif', 'aléatoire', 'adhésion', 'consensuel'], url: '' },

  { id: 'def-obligation', code: 'Définitions', article: 'Définition', title: 'Sources des obligations',
    content: 'Les obligations naissent de : 1° Actes juridiques : contrat, acte unilatéral, décision de justice ; 2° Faits juridiques : responsabilité délictuelle (art. 1240 s. C.civ.), quasi-contrats (gestion d\'affaires, paiement de l\'indu, enrichissement injustifié). La réforme de 2016 a restructuré le droit des obligations dans le Code civil.',
    tags: ['sources des obligations', 'acte juridique', 'fait juridique', 'contrat', 'responsabilité', 'quasi-contrat', 'réforme 2016'], url: '' },

  { id: 'def-domicile', code: 'Définitions', article: 'Définition', title: 'Domicile — notion juridique',
    content: 'Le domicile est le lieu du principal établissement d\'une personne physique (art. 102 C. civ.). Il présente un caractère fixe et permanent, distinct de la résidence habituelle et de l\'habitation temporaire. Il a une importance procédurale (assignation, compétence territoriale) et en droit international privé.',
    tags: ['domicile', 'résidence', 'établissement', 'procédure civile', 'compétence', 'principal établissement'], url: '' },

  { id: 'def-prescription-penale', code: 'Définitions', article: 'Définition', title: 'Prescription de l\'action publique',
    content: 'En droit pénal, la prescription de l\'action publique éteint le droit de poursuivre l\'auteur d\'une infraction après l\'écoulement d\'un délai courant à compter de sa commission. Délais : 20 ans pour les crimes, 6 ans pour les délits, 1 an pour les contraventions (loi du 27 févr. 2017). La prescription est interrompue par les actes d\'instruction ou de poursuite.',
    tags: ['prescription pénale', 'action publique', 'crime', 'délit', 'contravention', 'délai', 'interruption'], url: '' },

  { id: 'def-chose-jugee', code: 'Définitions', article: 'Définition', title: 'Autorité de la chose jugée',
    content: 'L\'autorité de la chose jugée interdit de rejuger une affaire déjà définitivement tranchée entre les mêmes parties, pour le même objet et fondée sur la même cause (identité de parties, d\'objet et de cause). Elle garantit la sécurité juridique et la stabilité des décisions de justice.',
    tags: ['autorité de la chose jugée', 'res judicata', 'identité de parties', 'objet', 'cause', 'sécurité juridique'], url: '' },

  { id: 'def-voie-fait', code: 'Définitions', article: 'Définition', title: 'Voie de fait administrative',
    content: 'La voie de fait est une irrégularité particulièrement grave commise par l\'administration (atteinte à une liberté individuelle ou à la propriété privée manifestement insusceptible d\'être rattachée à un pouvoir administratif). Elle fait exception à la compétence administrative et permet au juge judiciaire d\'intervenir (référé-liberté).',
    tags: ['voie de fait', 'administration', 'liberté individuelle', 'juge judiciaire', 'référé-liberté', 'irrégularité grave'], url: '' },

  { id: 'def-tutelle-curatelle', code: 'Définitions', article: 'Définition', title: 'Tutelle et curatelle',
    content: 'Mesures de protection juridique des majeurs vulnérables (loi 5 mars 2007). La sauvegarde de justice est la protection légère et temporaire. La curatelle (simple ou renforcée) assiste le majeur pour les actes graves. La tutelle représente le majeur hors d\'état de pourvoir seul à ses intérêts — c\'est la mesure la plus complète, placée sous contrôle judiciaire.',
    tags: ['tutelle', 'curatelle', 'majeur protégé', 'sauvegarde de justice', 'incapacité', 'juge des tutelles'], url: '' },

];

// ══════════════════════════════════════════════════════════
// MOTEUR DE RECHERCHE — Scoring intelligent pour le droit
// ══════════════════════════════════════════════════════════

// Synonymes et variantes pour le droit français
const SYNONYMES = {
  'responsabilité': ['responsable', 'responsabilités', 'imputabilité'],
  'contrat': ['contractuel', 'contractuelle', 'contractuels', 'convention', 'accord'],
  'dommage': ['dommages', 'préjudice', 'préjudices', 'tort', 'lésion'],
  'faute': ['fautes', 'fautif', 'fautive', 'négligence', 'imprudence'],
  'nullité': ['nul', 'nulle', 'annulation', 'annulable', 'annulé'],
  'prescription': ['prescrit', 'prescrite', 'délai', 'forclusion'],
  'propriété': ['propriétaire', 'propriétaires', 'droit réel'],
  'succession': ['successoral', 'successorale', 'héritage', 'héritier', 'héritiers'],
  'licenciement': ['licencié', 'licenciée', 'rupture', 'congédier'],
  'indemnité': ['indemnités', 'indemnisation', 'réparation', 'dommages-intérêts'],
  'tribunaux': ['tribunal', 'juridiction', 'juge', 'cour'],
  'délit': ['délits', 'infraction', 'infractions'],
  'crime': ['crimes', 'criminel', 'criminelle'],
  'arrêt': ['arrêts', 'décision', 'jugement'],
};

/**
 * Normalise un terme de recherche (retire accents, minuscules)
 */
function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'");
}

/**
 * Étend les termes de recherche avec synonymes
 */
function expandTerms(terms) {
  const expanded = new Set(terms);
  for (const term of terms) {
    const normTerm = normalize(term);
    for (const [key, variants] of Object.entries(SYNONYMES)) {
      if (normalize(key).startsWith(normTerm) || normTerm.startsWith(normalize(key).substring(0, 5))) {
        expanded.add(key);
        variants.forEach(v => expanded.add(v));
      }
      if (variants.some(v => normalize(v).startsWith(normTerm))) {
        expanded.add(key);
        variants.forEach(v => expanded.add(v));
      }
    }
  }
  return Array.from(expanded);
}

/**
 * Recherche par numéro d'article (ex: "1240", "art 1240", "L. 1221")
 */
function matchArticleNumber(query, article) {
  const qNorm = normalize(query).replace(/\s+/g, ' ').replace(/art\.?\s*/i, '').trim();
  const aNorm = normalize(article.article).replace(/art\.?\s*/i, '').trim();
  if (qNorm === aNorm || aNorm.includes(qNorm) || qNorm.includes(aNorm.replace(/\s+/g, ''))) {
    return 50;
  }
  // match numéro seul (ex: "1240" dans "Art. 1240")
  const nums = qNorm.match(/[\d\-\.]+/g) || [];
  for (const n of nums) {
    if (n.length >= 2 && aNorm.includes(n)) return 20;
  }
  return 0;
}

/**
 * Recherche principale — TF-IDF amélioré avec synonymes et numéros d'articles
 */
function search(query, filters = {}) {
  const rawTerms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  if (rawTerms.length === 0) return [];

  const terms = expandTerms(rawTerms);
  const normalizedTerms = terms.map(normalize);

  let results = ARTICLES.map(article => {
    let score = 0;

    // Correspondance numéro d'article
    score += matchArticleNumber(query, article);

    // Score sur titre, contenu, tags
    const haystack = normalize([
      article.title, article.content, article.article, article.code,
      ...(article.tags || [])
    ].join(' '));

    for (const term of normalizedTerms) {
      if (term.length < 2) continue;
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = haystack.match(regex);
      if (matches) {
        score += matches.length;
        if (normalize(article.title).includes(term)) score += 8;
        if ((article.tags || []).some(t => normalize(t).includes(term))) score += 5;
        if (normalize(article.code).includes(term)) score += 3;
      }
    }

    return { ...article, score, excerpt: buildExcerpt(article.content, normalizedTerms) };
  }).filter(r => r.score > 0);

  // Filtre par code si précisé
  if (filters.code) {
    const cf = normalize(filters.code);
    results = results.filter(r => normalize(r.code).includes(cf));
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(({ score, ...rest }) => rest); // retire le score interne
}

function buildExcerpt(content, normalizedTerms) {
  const lower = normalize(content);
  let bestIdx = 0;
  for (const term of normalizedTerms) {
    const idx = lower.indexOf(term);
    if (idx !== -1) { bestIdx = idx; break; }
  }
  const start = Math.max(0, bestIdx - 60);
  const end = Math.min(content.length, bestIdx + 220);
  return (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '');
}

module.exports = { search, ARTICLES };
