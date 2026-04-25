# JuriDix — Déploiement

## 1. Supabase (déjà fait si la DB est en ligne)

1. Dashboard → SQL Editor → coller `supabase/schema.sql` → Run
2. Auth → Providers → Email → **désactiver "Confirm email"** (sinon les nouveaux users restent bloqués)
3. Récupérer les clés (Project Settings → API → New API Keys) :
   - `Publishable key` → `SUPABASE_PUBLISHABLE_KEY`
   - `Secret key` → `SUPABASE_SECRET_KEY`

## 2. Stripe (Phase 4 — manuelle)

1. dashboard.stripe.com → accepter CGU si pas déjà fait
2. Products → créer **2 prix** :
   - **RUSH** : "Pass JuriDix Concours 2026", €9.90, **One-time**, copier `price_xxx`
   - **ROUTINE** : "JuriDix Routine", €6.00/mois, **Recurring monthly**, copier `price_xxx`
3. Developers → API keys → copier `sk_live_xxx` (ou `sk_test_xxx` pour staging)
4. Developers → Webhooks → Add endpoint
   - URL : `https://<ton-app>.onrender.com/api/stripe/webhook`
   - Events : `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copier le `whsec_xxx` (signing secret)

## 3. Render (one-click avec render.yaml)

1. `git init && git add . && git commit -m "v2.0 ship"`
2. `git remote add origin <ton-repo>` puis `git push`
3. render.com → New → Blueprint → sélectionner le repo → Apply
4. Dans la nouvelle service → **Environment** → remplir les 9 vars marquées `sync: false` :
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_RUSH`, `STRIPE_PRICE_ID_ROUTINE`
   - `PISTE_CLIENT_ID`, `PISTE_CLIENT_SECRET`
5. Manual Deploy → wait for `/api/health` to return 200

## 4. Smoke test prod

```bash
APP=https://<ton-app>.onrender.com
curl -sf $APP/api/health
curl -s -X POST $APP/api/search -H "Content-Type: application/json" -d '{"query":"responsabilité"}'
```

## 5. Post-launch

- **Custom domain** : Render → Settings → Custom Domains → ajouter `juridix.fr` → suivre DNS instructions
- **CORS_ORIGIN** : passer de `*` au vrai domaine (`https://juridix.fr`) pour bloquer les autres origines
- **Stripe webhook** : remplacer `<ton-app>.onrender.com` par le vrai domaine puis update endpoint
- **Bascule ROUTINE** : 2026-06-01 → flip `CONFIG_MODE=ROUTINE` dans Render env, redeploy

## Notes

- Schéma DB : `supabase/schema.sql` (idempotent — re-runnable sans casser)
- Rollback : Render garde les 5 derniers builds en "Deploys" → 1-clic rollback
- Logs : Render Logs onglet, filtrer par `[stripe]` ou `[action]` ou `[sync]`
