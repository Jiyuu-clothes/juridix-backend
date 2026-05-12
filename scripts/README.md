# Scripts JuriDix

## `build-cassation-corpus.js`

Construit un index **Article → Arrêts publiés au Bulletin de la Cour de cassation** à partir de l'open data DILA.

### Pourquoi ce script

PISTE plein-texte est imprécis : un arrêt fiscal qui mentionne en passant
`article 221-1 du code pénal` remonte aussi haut qu'un arrêt de principe
de la Chambre criminelle. Pour avoir une jurisprudence pédagogiquement
fiable, on construit notre propre index à partir des **Visas** structurés
des arrêts (la liste officielle des articles que chaque arrêt déclare
appliquer).

Ce mapping est 100% factuel : si l'arrêt cite l'article dans son Visa,
il apparaît. Sinon, non. Pas d'IA, pas de devinette.

### Préparation (à faire une seule fois)

1. **Avoir Node ≥ 18** sur ton Mac
2. **Avoir `tar` disponible** dans le shell (présent par défaut sur macOS)
3. **Espace disque** : prévoir 2-5 GB libres dans `juridix-app/` pendant
   l'exécution (le dossier temporaire est nettoyé à la fin par défaut)

### Lancer le script

Depuis la racine `juridix-app/` :

```bash
# Corpus de l'année en cours, uniquement les arrêts publiés au Bulletin
node scripts/build-cassation-corpus.js --year=2024 --bulletin-only
```

Options disponibles :

| Option | Description |
|---|---|
| `--year=2024` | Année à traiter. Une archive ≈ 200-500 MB compressée. |
| `--bulletin-only` | Filtre les arrêts publiés au Bulletin (= arrêts importants). Recommandé pour un premier corpus. |
| `--output=path` | Fichier de sortie. Défaut : `data/grands-arrets-auto.json`. |
| `--tmp=path` | Dossier temporaire. Défaut : `tmp-cassation/`. |
| `--keep-tmp` | Garde les XML extraits après. Utile pour debug. |

### Ce que tu obtiens

Le script écrit dans `data/grands-arrets-auto.json` :

```json
{
  "_meta": {
    "generated": "2026-05-10T14:00:00Z",
    "year": "2024",
    "bulletinOnly": true,
    "arretsParsed": 12503,
    "arretsKept": 1042,
    "articlesIndexed": 387,
    "totalReferences": 1842
  },
  "articles": {
    "Code civil:1240": [
      {
        "id": "JURITEXT...",
        "ref": "Cass. 2e civ., 14 mars 2024, n° 22-19.876",
        "date": "2024-03-14",
        "juridiction": "Cour de cassation, civile",
        "formation": "Chambre civile 2",
        "numero": "22-19.876",
        "bulletin": true,
        "sommaire": "...",
        "retenir": null
      }
    ]
  }
}
```

Le champ `retenir` est `null` à ce stade : il sera rempli par le script
de phase 2 (résumé IA via Gemini Flash, voir plus bas).

### Pour traiter plusieurs années

```bash
# Lance pour 5 dernières années — 5-10 min par année
for y in 2020 2021 2022 2023 2024; do
  node scripts/build-cassation-corpus.js --year=$y --bulletin-only \
    --output=data/grands-arrets-auto-$y.json
done

# Puis fusionne les sorties (script de fusion à écrire si besoin,
# ou on laisse le route backend gérer les fichiers multiples)
```

### Commit du résultat

Une fois généré, **commit le JSON dans le repo** pour qu'il soit déployé
avec l'app sur Render :

```bash
git add data/grands-arrets-auto.json
git commit -m "data: corpus Cassation 2024 publié au Bulletin"
git push
```

Render redéploie automatiquement et la route `/api/search/grands-arrets`
servira immédiatement les arrêts indexés.

### Phase 2 — résumés IA (à venir)

Le champ `retenir` (résumé en 2-3 phrases de la portée de chaque arrêt)
sera ajouté par un second script qui passe chaque arrêt à Gemini Flash
via API. Coût estimé : 5 € pour ~5 000 arrêts résumés. À implémenter
dans `scripts/summarize-cassation.js`.

Voir aussi `data/grands-arrets.json` : c'est le corpus **manuel** dont
les entrées sont prioritaires (qualité plus élevée que le résumé auto).
