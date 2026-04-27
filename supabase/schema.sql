-- ═══════════════════════════════════════════════════════════════════════════
-- JURIDIX — Schéma Supabase (Postgres + RLS + Auth)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Idempotent : peut être rejoué sans casser l'existant.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PROFILES — 1:1 avec auth.users, contient l'état paywall + premium
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id                       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                    text,
  name                     text,
  year                     text DEFAULT 'L1',         -- L1, L2, L3, M1, M2
  specialty                text DEFAULT 'Général',

  -- ── Paywall state ────────────────────────────────────────
  action_count             integer NOT NULL DEFAULT 0,
  first_action_at          timestamptz,               -- horodatage de la 1ère action de la fenêtre courante (ROUTINE: reset 4h)

  -- ── Premium state ────────────────────────────────────────
  is_premium               boolean NOT NULL DEFAULT false,
  premium_expiry           timestamptz,               -- RUSH: 2026-06-30 23:59:59 / ROUTINE: null (subscription)
  config_mode_purchased    text,                      -- 'RUSH' ou 'ROUTINE' (tracé pour analytics)

  -- ── Stripe linkage ───────────────────────────────────────
  stripe_customer_id       text UNIQUE,
  stripe_subscription_id   text UNIQUE,
  stripe_subscription_status text,                    -- 'active', 'canceled', 'past_due', etc.

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. STUDIO_CONTENT — Cloud sync de l'éditeur Studio (1 ligne par user)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.studio_content (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  content_html text NOT NULL DEFAULT '',
  char_count   integer NOT NULL DEFAULT 0,
  version      integer NOT NULL DEFAULT 1,            -- pour conflict resolution si plusieurs onglets
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. NOTES — Notes/highlights ancrées sur un article (feature existante)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notes (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_id      uuid REFERENCES public.themes(id) ON DELETE SET NULL,
  article_id    text,                                 -- ex: 'cc-1240' ou 'api_LEGIARTI...'
  article_title text,
  content       text NOT NULL,
  highlight     text,
  color         text DEFAULT '#FFD700',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. THEMES — Thèmes de révision personnalisés
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.themes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  color      text DEFAULT '#38BDF8',
  position   integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- (FK circulaire notes→themes : on crée la contrainte après que les 2 tables existent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notes_theme_id_fkey' AND table_name = 'notes'
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_theme_id_fkey
      FOREIGN KEY (theme_id) REFERENCES public.themes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notes_user      ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_theme     ON public.notes(theme_id);
CREATE INDEX IF NOT EXISTS idx_themes_user     ON public.themes(user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. ACTION_LOGS — Audit des actions paywall (1 ligne par action validée)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.action_logs (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('search_open','inject')),
  action_ref  text,                                   -- ex: 'cc-1240' ou 'LEGIARTI...'
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_logs_user_created ON public.action_logs(user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. STRIPE_EVENTS — Idempotence du webhook (chaque event_id traité 1 seule fois)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id     text PRIMARY KEY,                      -- evt_xxx fourni par Stripe
  event_type   text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload      jsonb
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. TRIGGER — création automatique du profil à l'inscription
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  -- Crée 3 thèmes par défaut
  INSERT INTO public.themes (user_id, name, color, position) VALUES
    (NEW.id, 'Responsabilité civile', '#38BDF8', 0),
    (NEW.id, 'Droit des contrats',    '#34D399', 1),
    (NEW.id, 'Famille',               '#F59E0B', 2);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. TRIGGER — bump updated_at automatique
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.bump_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated      ON public.profiles;
DROP TRIGGER IF EXISTS trg_studio_updated        ON public.studio_content;
DROP TRIGGER IF EXISTS trg_notes_updated         ON public.notes;

CREATE TRIGGER trg_profiles_updated  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.bump_updated_at();
CREATE TRIGGER trg_studio_updated    BEFORE UPDATE ON public.studio_content
  FOR EACH ROW EXECUTE FUNCTION public.bump_updated_at();
CREATE TRIGGER trg_notes_updated     BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.bump_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. ROW LEVEL SECURITY — étanchéité par utilisateur
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.themes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events  ENABLE ROW LEVEL SECURITY;  -- aucune policy = service_role only

-- ── PROFILES ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- L'utilisateur ne peut PAS s'octroyer le premium ni manipuler les colonnes Stripe
    -- (seul le webhook avec service_role peut écrire ces champs).
    AND is_premium             = (SELECT is_premium             FROM public.profiles WHERE id = auth.uid())
    AND premium_expiry         IS NOT DISTINCT FROM (SELECT premium_expiry         FROM public.profiles WHERE id = auth.uid())
    AND stripe_customer_id     IS NOT DISTINCT FROM (SELECT stripe_customer_id     FROM public.profiles WHERE id = auth.uid())
    AND stripe_subscription_id IS NOT DISTINCT FROM (SELECT stripe_subscription_id FROM public.profiles WHERE id = auth.uid())
  );

-- ── STUDIO_CONTENT ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "studio_select_own" ON public.studio_content;
CREATE POLICY "studio_select_own" ON public.studio_content
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "studio_insert_own" ON public.studio_content;
CREATE POLICY "studio_insert_own" ON public.studio_content
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "studio_update_own" ON public.studio_content;
CREATE POLICY "studio_update_own" ON public.studio_content
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── NOTES ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notes_all_own" ON public.notes;
CREATE POLICY "notes_all_own" ON public.notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── THEMES ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "themes_all_own" ON public.themes;
CREATE POLICY "themes_all_own" ON public.themes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── ACTION_LOGS ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "logs_select_own" ON public.action_logs;
CREATE POLICY "logs_select_own" ON public.action_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "logs_insert_own" ON public.action_logs;
CREATE POLICY "logs_insert_own" ON public.action_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. RPC — increment_action atomique (anti-race)
-- ═══════════════════════════════════════════════════════════════════════════
-- Appel depuis le front : await supabase.rpc('increment_action', { p_type: 'search_open', p_ref: 'cc-1240', p_config_mode: 'RUSH' })
-- Retour : { allowed: bool, action_count: int, reset: bool, premium: bool }
CREATE OR REPLACE FUNCTION public.increment_action(
  p_type        text,
  p_ref         text,
  p_config_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_profile      public.profiles%ROWTYPE;
  v_now          timestamptz := now();
  v_reset        boolean := false;
  v_window_hours int := 4;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;

  IF p_type NOT IN ('search_open','inject') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_action_type');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid FOR UPDATE;

  -- Premium actif ?
  IF v_profile.is_premium AND (v_profile.premium_expiry IS NULL OR v_profile.premium_expiry > v_now) THEN
    INSERT INTO public.action_logs (user_id, action_type, action_ref) VALUES (v_uid, p_type, p_ref);
    RETURN jsonb_build_object('allowed', true, 'premium', true, 'action_count', v_profile.action_count);
  END IF;

  -- Reset 4h en mode ROUTINE
  IF p_config_mode = 'ROUTINE'
     AND v_profile.first_action_at IS NOT NULL
     AND v_profile.first_action_at < (v_now - (v_window_hours || ' hours')::interval) THEN
    UPDATE public.profiles
       SET action_count = 0, first_action_at = NULL
     WHERE id = v_uid;
    v_profile.action_count := 0;
    v_profile.first_action_at := NULL;
    v_reset := true;
  END IF;

  -- Limite atteinte ? (10 actions gratuites → la 11ᵉ déclenche le paywall)
  IF v_profile.action_count >= 11 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'paywall',
      'action_count', v_profile.action_count,
      'reset', v_reset,
      'premium', false
    );
  END IF;

  -- Incrément
  UPDATE public.profiles
     SET action_count    = action_count + 1,
         first_action_at = COALESCE(first_action_at, v_now)
   WHERE id = v_uid;

  INSERT INTO public.action_logs (user_id, action_type, action_ref) VALUES (v_uid, p_type, p_ref);

  RETURN jsonb_build_object(
    'allowed', true,
    'premium', false,
    'action_count', v_profile.action_count + 1,
    'reset', v_reset
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_action(text, text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN — vérifications rapides
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT * FROM public.profiles;
-- SELECT * FROM public.action_logs ORDER BY created_at DESC LIMIT 10;
