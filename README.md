# 🏛️ JuriDix — Bibliothèque Juridique Numérique

Plateforme de recherche légale pour étudiants en droit français.  
Stack : **Node.js + Express + SQLite + Légifrance PISTE API**

---

## 🚀 Déploiement en 5 minutes sur Render.com (gratuit)

### 1. Préparer le repository

```bash
# Depuis le dossier juridix-app
git init
git add .
git commit -m "Initial commit — JuriDix backend"

# Créer un repo GitHub (ou GitLab) et pousser
git remote add origin https://github.com/TON_USER/juridix-app.git
git push -u origin main
```

### 2. Créer le service sur Render.com

1. Aller sur **[render.com](https://render.com)** → New → **Web Service**
2. Connecter votre repo GitHub
3. Remplir :
   - **Name** : `juridix-api`
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
   - **Plan** : Free

### 3. Variables d'environnement (Render → Environment)

| Variable | Valeur | Obligatoire |
|---|---|---|
| `NODE_ENV` | `production` | ✅ |
| `JWT_SECRET` | chaîne aléatoire 32+ chars | ✅ |
| `PORT` | `10000` (auto Render) | auto |
| `PISTE_CLIENT_ID` | Votre ID PISTE | ⚡ optionnel |
| `PISTE_CLIENT_SECRET` | Votre secret PISTE | ⚡ optionnel |
| `DB_PATH` | `/opt/render/project/src/data/juridix.db` | ⚠️ voir note |

> **Note SQLite sur Render Free** : Le disque est éphémère sur le plan gratuit. Pour persister la DB, utilisez un **Render Disk** (1 Go gratuit) ou migrez vers PlanetScale/Supabase.

### 4. Obtenir les clés PISTE (Légifrance officiel)

1. Aller sur **[developer.aife.economie.gouv.fr](https://developer.aife.economie.gouv.fr)**
2. Créer un compte → Nouvelle application
3. Souscrire à l'API **Légifrance** (gratuit, accès immédiat en sandbox)
4. Copier `Client ID` et `Client Secret` dans Render

> Sans clés PISTE, l'application fonctionne avec le **corpus embarqué** (30+ articles).

---

## 💻 Développement local

```bash
cd juridix-app

# Installer les dépendances
npm install

# Copier et remplir les variables
cp .env.example .env
# Éditer .env avec votre éditeur

# Lancer
node server.js
# → http://localhost:3000/api/health
```

---

## 📡 API — Référence

### Auth

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Inscription |
| `POST` | `/api/auth/login` | Connexion → JWT |
| `GET` | `/api/auth/me` | Profil utilisateur |
| `PUT` | `/api/auth/me` | Mise à jour profil |

**Inscription** :
```json
POST /api/auth/register
{ "email": "etudiant@univ.fr", "password": "motdepasse", "name": "Jean Dupont" }
```

**Connexion** :
```json
POST /api/auth/login
{ "email": "etudiant@univ.fr", "password": "motdepasse" }
→ { "token": "eyJ...", "user": { "id": 1, "email": "...", "name": "..." } }
```

### Recherche

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/search` | Recherche (1 crédit) |
| `GET` | `/api/search/credits` | Crédits restants |
| `GET` | `/api/search/history` | Historique |

**Recherche** :
```json
POST /api/search
Authorization: Bearer <token>
{ "query": "responsabilité délictuelle", "filters": { "code": "Code civil" } }
```

### Notes & Thèmes

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/notes` | Toutes les notes |
| `POST` | `/api/notes` | Créer une note |
| `PUT` | `/api/notes/:id` | Modifier |
| `DELETE` | `/api/notes/:id` | Supprimer |
| `GET` | `/api/notes/themes` | Thèmes |
| `POST` | `/api/notes/themes` | Créer thème |
| `DELETE` | `/api/notes/themes/:id` | Supprimer thème |

**Créer une note** :
```json
POST /api/notes
Authorization: Bearer <token>
{
  "article_id": "cc-1",
  "article_title": "Art. 1240 — Responsabilité délictuelle",
  "content": "Fondement de toute la responsabilité civile extracontractuelle",
  "highlight": "Tout fait quelconque de l'homme",
  "color": "#FFD700"
}
```

---

## 🗂️ Structure des fichiers

```
juridix-app/
├── server.js              # Point d'entrée Express
├── package.json
├── .env.example           # Template des variables
├── db/
│   ├── schema.sql         # Tables SQLite
│   ├── database.js        # Singleton connexion
│   └── setup.js           # Init automatique au démarrage
├── middleware/
│   └── auth.js            # Vérification JWT
├── routes/
│   ├── auth.js            # /api/auth/*
│   ├── search.js          # /api/search/*
│   └── notes.js           # /api/notes/*
├── services/
│   ├── piste.js           # Client OAuth2 Légifrance
│   └── corpus.js          # Corpus embarqué (fallback)
└── public/
    └── index.html         # Frontend SPA (prototype)
```

---

## 🔒 Sécurité

- Mots de passe hashés avec **bcrypt** (salt rounds: 12)
- Authentification **JWT** (expiration 7 jours)
- Headers de sécurité via **Helmet**
- Rate limiting : 200 req/15min (API) + 20 req/h (auth)
- Validation des entrées sur toutes les routes

---

## 📈 Roadmap

- [ ] Interface web React complète
- [ ] Paiement Stripe (abonnement premium)
- [ ] Export PDF des notes
- [ ] Alertes jurisprudence par email
- [ ] Application mobile React Native
