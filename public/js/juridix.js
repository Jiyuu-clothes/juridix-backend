// ─────────────────────────────────────────────────────────────
// JuriDix — Frontend bootstrap (auth + paywall + studio sync)
// Exposed as window.JuriDix
// Loaded AFTER @supabase/supabase-js UMD so window.supabase is available.
// ─────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const JD = {
    config: null,             // /api/config payload
    supabase: null,           // supabase-js client
    session: null,            // active Supabase session
    profile: null,            // last-fetched profile snapshot
    _readyResolvers: [],
    _ready: false,
    _studioTimer: null,
    _studioLastSaved: '',
  };

  // ────── promise-style ready gate ──────
  JD.ready = function () {
    if (JD._ready) return Promise.resolve();
    return new Promise((resolve) => JD._readyResolvers.push(resolve));
  };
  function _flushReady() {
    JD._ready = true;
    JD._readyResolvers.forEach((r) => r());
    JD._readyResolvers = [];
  }

  // ────── HTTP helper with bearer ──────
  async function api(path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (JD.session?.access_token) {
      headers.Authorization = 'Bearer ' + JD.session.access_token;
    }
    const r = await fetch(path, Object.assign({}, opts, { headers }));
    const txt = await r.text();
    let body = null;
    try { body = txt ? JSON.parse(txt) : null; } catch { body = txt; }
    if (!r.ok) {
      const err = new Error((body && body.error) || ('HTTP ' + r.status));
      err.status = r.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  // ────── INIT ──────
  JD.init = async function () {
    JD.config = await fetch('/api/config').then((r) => r.json());

    if (!window.supabase || !window.supabase.createClient) {
      console.error('[JuriDix] supabase-js non chargé');
      _flushReady();
      return;
    }
    JD.supabase = window.supabase.createClient(
      JD.config.supabaseUrl,
      JD.config.supabasePublishableKey,
      {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }
    );

    const { data: { session } } = await JD.supabase.auth.getSession();
    JD.session = session;

    JD.supabase.auth.onAuthStateChange((event, sess) => {
      JD.session = sess;
      if (sess) {
        // refresh profile + studio on sign-in
        JD.refreshProfile().catch(() => {});
        JD.loadStudio().catch(() => {});
        _hideAuthModal();
        _renderAccountBadge();
      } else {
        JD.profile = null;
        _renderAccountBadge();
      }
    });

    if (JD.session) {
      await JD.refreshProfile().catch(() => {});
      await JD.loadStudio().catch(() => {});
    }

    _injectStyles();
    _injectAuthModal();
    _injectAccountBadge();
    _renderAccountBadge();

    // Détection du flow "reset password" : Supabase pose un access_token dans l'URL
    // (hash) après recovery, et nous on ajoute ?reset=1 pour identifier le contexte.
    try {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash || '';
      if (params.get('reset') === '1' || /type=recovery/.test(hash)) {
        // Une fois la session établie via le lien, on propose de saisir un nouveau mot de passe
        setTimeout(() => _showResetModal(), 400);
        // Nettoie l'URL pour éviter de relancer la modal au prochain refresh
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('reset');
          url.hash = '';
          window.history.replaceState({}, '', url.toString());
        } catch (_) {}
      }
    } catch (_) {}

    _flushReady();
  };

  // ────── AUTH ──────
  JD.signUp = async function (email, password, name) {
    const { data, error } = await JD.supabase.auth.signUp({
      email, password,
      options: { data: { name: name || '' } },
    });
    if (error) throw error;
    return data;
  };

  JD.signIn = async function (email, password) {
    const { data, error } = await JD.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  JD.signInOAuth = async function (provider) {
    // 'google' | 'apple' | etc. Supabase redirige + revient sur cette page.
    const { data, error } = await JD.supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) throw error;
    return data;
  };

  JD.resetPassword = async function (email) {
    const { data, error } = await JD.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname + '?reset=1'
    });
    if (error) throw error;
    return data;
  };

  JD.updatePassword = async function (newPassword) {
    const { data, error } = await JD.supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  };

  JD.signOut = async function () {
    await JD.supabase.auth.signOut();
  };

  JD.requireAuth = function () {
    if (!JD.session) {
      _showAuthModal();
      return false;
    }
    return true;
  };

  JD.refreshProfile = async function () {
    if (!JD.session) return null;
    try {
      JD.profile = await api('/api/action/profile');
      // Phase 9.4 — afficher le compteur dès le chargement du profil
      if (JD.profile && typeof JD.profile.action_count === 'number') {
        _updateActionPill({
          premium: !!JD.profile.is_premium,
          action_count: JD.profile.action_count,
        });
      }
      return JD.profile;
    } catch (e) {
      console.warn('[JuriDix] profile fetch failed', e);
      return null;
    }
  };

  // ────── PAYWALL ACTION ──────
  // type: 'search' | 'open' | 'inject' ; ref optional
  // returns true if allowed, false if blocked (paywall shown)
  JD.trackAction = async function (type, ref) {
    if (!JD.session) {
      _showAuthModal();
      return false;
    }
    try {
      const out = await api('/api/action', {
        method: 'POST',
        body: JSON.stringify({ type, ref: ref || null }),
      });
      // out: { allowed, premium, action_count, reset? }
      if (out && typeof out.action_count === 'number' && JD.profile) {
        JD.profile.action_count = out.action_count;
        JD.profile.is_premium = out.premium;
      }
      _updateActionPill(out);
      if (!out.allowed) {
        _showPaywall(out);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[JuriDix] trackAction', e);
      // Fail-open in dev to avoid hard-blocking on transient error
      return true;
    }
  };

  // ────── STUDIO SYNC ──────
  JD.loadStudio = async function () {
    if (!JD.session) return null;
    try {
      const data = await api('/api/sync/studio');
      const editor = document.getElementById('lab-editor2');
      const html = data && (data.content_html || data.content);
      if (html && editor && !editor.innerHTML.trim()) {
        editor.innerHTML = html;
        JD._studioLastSaved = html;
      }
      return data;
    } catch (e) {
      console.warn('[JuriDix] loadStudio', e);
      return null;
    }
  };

  JD.scheduleStudioSync = function () {
    if (!JD.session) return;
    clearTimeout(JD._studioTimer);
    JD._studioTimer = setTimeout(JD._flushStudio, 30_000);
  };

  JD._flushStudio = async function () {
    const editor = document.getElementById('lab-editor2');
    if (!editor) return;
    const content = editor.innerHTML;
    if (content === JD._studioLastSaved) return;
    try {
      await api('/api/sync/studio', {
        method: 'POST',
        body: JSON.stringify({ content_html: content }),
      });
      JD._studioLastSaved = content;
      // Defer to the global state helper if present, fallback to legacy text.
      if (typeof window._setSaveState === 'function') {
        window._setSaveState('saved');
      } else {
        const el = document.getElementById('lab-autosave2');
        if (el) el.textContent = '☁ Synchronisé';
      }
    } catch (e) {
      console.warn('[JuriDix] studio sync', e);
      if (typeof window._setSaveState === 'function') {
        window._setSaveState('error');
      } else {
        const el = document.getElementById('lab-autosave2');
        if (el) el.textContent = '⚠ Sauvegarde locale';
      }
    }
  };

  // ────── CHECKOUT ──────
  // mode: 'RUSH' | 'ROUTINE' | undefined (server uses CONFIG_MODE if undefined)
  JD.startCheckout = async function (mode) {
    if (!JD.session) { _showAuthModal(); return; }
    try {
      const body = mode ? JSON.stringify({ mode }) : '{}';
      const out = await api('/api/stripe/checkout', { method: 'POST', body });
      if (out && out.url) {
        window.location.href = out.url;
      } else {
        alert('Checkout indisponible — réessaie dans un instant.');
      }
    } catch (e) {
      alert(e.message || 'Erreur Stripe');
    }
  };

  // Stripe Billing Portal — manage payment method, invoices, cancel sub.
  JD.openBillingPortal = async function () {
    if (!JD.session) { _showAuthModal(); return; }
    try {
      const out = await api('/api/stripe/portal', { method: 'POST', body: '{}' });
      if (out && out.url) {
        window.location.href = out.url;
      } else {
        alert('Portail indisponible — réessaie dans un instant.');
      }
    } catch (e) {
      alert(e.message || 'Erreur Stripe Portal');
    }
  };

  // ────── UI: styles ──────
  function _injectStyles() {
    const css = `
    .jd-modal{position:fixed;inset:0;z-index:9000;background:rgba(2,6,15,0.85);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:20px}
    .jd-modal.show{display:flex}
    .jd-card{background:#0F172A;border:1px solid rgba(56,189,248,0.25);border-radius:16px;padding:32px;width:100%;max-width:420px;box-shadow:0 32px 80px rgba(0,0,0,0.5)}
    .jd-card h2{font-size:22px;font-weight:700;color:#f1f5f9;margin-bottom:6px;letter-spacing:-0.3px}
    .jd-card .jd-sub{color:#94a3b8;font-size:13px;margin-bottom:20px}
    .jd-tabs{display:flex;gap:6px;background:rgba(15,23,42,0.6);padding:4px;border-radius:10px;margin-bottom:18px}
    .jd-tab{flex:1;padding:8px 14px;font-size:13px;color:#94a3b8;cursor:pointer;border-radius:7px;text-align:center;transition:all .15s;border:none;background:transparent;font-weight:500}
    .jd-tab.on{background:#38BDF8;color:#0F172A;font-weight:600}
    .jd-field{margin-bottom:12px}
    .jd-field label{display:block;font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px}
    .jd-field input{width:100%;padding:10px 12px;background:rgba(15,23,42,0.8);border:1px solid rgba(56,189,248,0.18);border-radius:8px;color:#f1f5f9;font-size:14px;outline:none;transition:border-color .15s,box-shadow .15s}
    .jd-field input:focus{border-color:#38BDF8;box-shadow:0 0 0 3px rgba(56,189,248,0.15)}
    .jd-btn{width:100%;padding:11px;background:#38BDF8;color:#0F172A;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;transition:transform .1s,box-shadow .15s;margin-top:6px}
    .jd-btn:hover{box-shadow:0 4px 16px rgba(56,189,248,0.4)}
    .jd-btn:active{transform:translateY(1px)}
    .jd-btn:disabled{opacity:.5;cursor:not-allowed}
    .jd-btn-sec{background:transparent;color:#94a3b8;border:1px solid rgba(148,163,184,0.25);font-weight:500}
    .jd-btn-sec:hover{box-shadow:none;background:rgba(148,163,184,0.08)}
    .jd-err{margin-top:10px;padding:9px 12px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);border-radius:8px;color:#fca5a5;font-size:12.5px;display:none}
    .jd-err.show{display:block}
    .jd-info{margin-top:10px;padding:9px 12px;background:rgba(34,197,94,0.10);border:1px solid rgba(34,197,94,0.3);border-radius:8px;color:#86efac;font-size:12.5px}
    .jd-info[hidden]{display:none}
    /* OAuth row */
    .jd-oauth-row{display:flex;gap:8px;margin:14px 0 10px}
    .jd-oauth{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:8px;color:#f1f5f9;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit}
    .jd-oauth:hover{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.20)}
    .jd-oauth-apple{color:#fff}
    .jd-divider{display:flex;align-items:center;gap:10px;margin:6px 0 14px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.4px}
    .jd-divider:before,.jd-divider:after{content:"";flex:1;height:1px;background:rgba(148,163,184,0.18)}
    /* Lien "mot de passe oublié" */
    .jd-link-btn{display:block;width:100%;background:transparent;border:none;color:#7dd3fc;font-size:12px;font-weight:500;cursor:pointer;padding:8px 0 0;margin-top:4px;text-decoration:underline;text-decoration-color:rgba(125,211,252,0.4);text-underline-offset:3px;font-family:inherit}
    .jd-link-btn:hover{color:#38BDF8;text-decoration-color:#38BDF8}
    .jd-pill{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.95);border:1px solid rgba(56,189,248,0.3);border-radius:999px;padding:6px 14px;font-size:12px;color:#cbd5e1;z-index:5000;display:none;align-items:center;gap:8px;backdrop-filter:blur(10px)}
    .jd-pill.show{display:flex}
    .jd-pill b{color:#38BDF8;font-weight:700}
    .jd-pill .jd-pill-bar{width:60px;height:3px;background:rgba(148,163,184,0.2);border-radius:2px;overflow:hidden}
    .jd-pill .jd-pill-bar i{display:block;height:100%;background:linear-gradient(90deg,#38BDF8,#7dd3fc);border-radius:2px;transition:width .25s}
    #jd-account{display:flex;align-items:center;gap:8px;padding:5px 11px;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.25);border-radius:999px;color:#7dd3fc;cursor:pointer;font-size:12px;font-weight:500;transition:background .15s}
    #jd-account:hover{background:rgba(56,189,248,0.18)}
    #jd-account .jd-acc-dot{width:7px;height:7px;border-radius:50%;background:#38BDF8;box-shadow:0 0 8px #38BDF8}
    #jd-account.guest{color:#94a3b8;background:rgba(148,163,184,0.08);border-color:rgba(148,163,184,0.25)}
    #jd-account.guest .jd-acc-dot{background:#64748b;box-shadow:none}
    /* ─── Paywall premium — full-page modal with cyan glow + gold/cyan CTA ─── */
    #jd-paywall{background:radial-gradient(ellipse at center,rgba(8,15,30,.92) 0%,rgba(0,0,0,.96) 70%);backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);overflow-y:auto;padding:24px}
    @keyframes jdPwBoxIn{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes jdPwGlow{0%,100%{box-shadow:0 0 0 1px rgba(56,189,248,.18),0 0 80px rgba(56,189,248,.18),0 30px 80px rgba(0,0,0,.55)}50%{box-shadow:0 0 0 1px rgba(56,189,248,.28),0 0 120px rgba(56,189,248,.26),0 30px 80px rgba(0,0,0,.55)}}
    #jd-paywall .jd-card{position:relative;max-width:520px;text-align:center;background:linear-gradient(180deg,rgba(15,23,42,.96) 0%,rgba(8,15,30,.98) 100%);border:1px solid rgba(56,189,248,.22);border-radius:20px;padding:44px 44px 32px;animation:jdPwBoxIn .45s cubic-bezier(.2,.7,.3,1),jdPwGlow 4s ease-in-out 1s infinite;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    #jd-paywall .jd-card::before{content:'';position:absolute;inset:-1px;border-radius:20px;padding:1px;background:linear-gradient(135deg,rgba(56,189,248,.45) 0%,rgba(56,189,248,0) 35%,rgba(244,200,99,.35) 100%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
    #jd-paywall .jd-card h2{font-size:26px;font-weight:700;letter-spacing:-.02em;margin-bottom:10px}
    #jd-paywall .jd-pw-icon{display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,rgba(56,189,248,.2) 0%,rgba(56,189,248,.06) 100%);border:1px solid rgba(56,189,248,.28);font-size:30px;margin:0 auto 18px;box-shadow:0 0 32px rgba(56,189,248,.22),inset 0 0 16px rgba(56,189,248,.08)}
    #jd-paywall .jd-pw-eyebrow{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#38BDF8;background:rgba(56,189,248,.10);border:1px solid rgba(56,189,248,.22);padding:5px 12px;border-radius:999px;margin-bottom:14px}
    #jd-paywall .jd-sub{color:#94a3b8;font-size:14.5px;line-height:1.6;margin:0 auto 24px;max-width:420px}
    #jd-paywall .jd-pw-feats{list-style:none;text-align:left;margin:0 auto 22px;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;max-width:440px;background:transparent;border:none}
    #jd-paywall .jd-pw-feats li{padding:0;font-size:13px;color:#cbd5e1;display:flex;align-items:flex-start;gap:9px;line-height:1.45}
    #jd-paywall .jd-pw-feats li::before{content:'';flex-shrink:0;width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,rgba(56,189,248,.22),rgba(56,189,248,.08));border:1px solid rgba(56,189,248,.32);background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2338BDF8' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'/></svg>");background-size:11px 11px;background-position:center;background-repeat:no-repeat;margin-top:1px;font-weight:400}
    #jd-paywall .jd-pw-price{font-size:34px;font-weight:700;color:#f1f5f9;margin:0 0 18px;letter-spacing:-.02em;display:flex;align-items:baseline;justify-content:center;gap:6px}
    #jd-paywall .jd-pw-price small{font-size:13px;color:#94a3b8;font-weight:500;letter-spacing:0}
    #jd-paywall .jd-pw-cta{display:flex;flex-direction:column;gap:10px;margin-top:6px;align-items:center}
    #jd-paywall .jd-pw-cta button{width:100%;max-width:340px;margin:0}
    #jd-paywall .jd-pw-cta .jd-btn-pw{position:relative;padding:14px 22px;border:none;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:.01em;cursor:pointer;color:#0B1220;background:linear-gradient(135deg,#F4C863 0%,#FFE49B 45%,#38BDF8 100%);box-shadow:0 0 0 1px rgba(244,200,99,.4),0 8px 24px rgba(244,200,99,.18),0 0 32px rgba(56,189,248,.22),inset 0 1px 0 rgba(255,255,255,.45);transition:transform .2s cubic-bezier(.2,.7,.3,1),box-shadow .2s,filter .2s;overflow:hidden}
    #jd-paywall .jd-pw-cta .jd-btn-pw::after{content:'';position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.5) 50%,transparent 70%);transform:translateX(-100%);transition:transform .65s}
    #jd-paywall .jd-pw-cta .jd-btn-pw:hover{transform:translateY(-1px);filter:brightness(1.03);box-shadow:0 0 0 1px rgba(244,200,99,.5),0 12px 28px rgba(244,200,99,.26),0 0 40px rgba(56,189,248,.32),inset 0 1px 0 rgba(255,255,255,.55)}
    #jd-paywall .jd-pw-cta .jd-btn-pw:hover::after{transform:translateX(100%)}
    #jd-paywall .jd-pw-cta .jd-btn-pw:active{transform:translateY(0)}
    #jd-paywall .jd-pw-secondary{background:none;border:none;color:#94a3b8;font-size:12.5px;cursor:pointer;padding:6px 16px;letter-spacing:.01em;transition:color .2s}
    #jd-paywall .jd-pw-secondary:hover{color:#f1f5f9}
    #jd-paywall .jd-pw-trust{margin-top:18px;display:flex;align-items:center;justify-content:center;gap:14px;font-size:11px;color:#64748b;letter-spacing:.02em;flex-wrap:wrap}
    #jd-paywall .jd-pw-trust span{display:inline-flex;align-items:center;gap:5px}
    #jd-paywall .jd-pw-trust svg{width:11px;height:11px;opacity:.7}
    @media(max-width:560px){#jd-paywall .jd-card{padding:32px 22px 26px}#jd-paywall .jd-pw-feats{grid-template-columns:1fr}#jd-paywall .jd-card h2{font-size:22px}}

    /* ─── Account dashboard modal ─── */
    #jd-account-modal .jd-card{max-width:520px}
    #jd-account-modal .jd-acc-head{display:flex;align-items:center;gap:14px;margin-bottom:18px}
    #jd-account-modal .jd-acc-avatar{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#38BDF8,#0284c7);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;flex-shrink:0;text-transform:uppercase}
    #jd-account-modal .jd-acc-meta{flex:1;min-width:0}
    #jd-account-modal .jd-acc-name{font-size:15px;font-weight:700;color:#f1f5f9;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #jd-account-modal .jd-acc-mail{font-size:12.5px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #jd-account-modal .jd-section-title{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin:18px 0 8px}
    #jd-account-modal .jd-plan-box{background:rgba(15,23,42,0.55);border:1px solid rgba(56,189,248,0.18);border-radius:11px;padding:14px 16px;margin-bottom:6px}
    #jd-account-modal .jd-plan-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
    #jd-account-modal .jd-plan-name{font-size:15px;font-weight:700;color:#f1f5f9;display:flex;align-items:center;gap:8px}
    #jd-account-modal .jd-badge{font-size:10.5px;padding:3px 8px;border-radius:999px;font-weight:700;letter-spacing:.3px;text-transform:uppercase}
    #jd-account-modal .jd-badge.on{background:rgba(56,189,248,0.18);color:#7dd3fc;border:1px solid rgba(56,189,248,0.4)}
    #jd-account-modal .jd-badge.off{background:rgba(148,163,184,0.12);color:#94a3b8;border:1px solid rgba(148,163,184,0.3)}
    #jd-account-modal .jd-plan-detail{font-size:12.5px;color:#94a3b8;margin-top:6px;line-height:1.5}
    #jd-account-modal .jd-plan-detail b{color:#cbd5e1;font-weight:600}
    #jd-account-modal .jd-formulas{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}
    #jd-account-modal .jd-formula{background:rgba(15,23,42,0.55);border:1px solid rgba(148,163,184,0.18);border-radius:11px;padding:14px;cursor:pointer;text-align:left;transition:border-color .15s,transform .1s,box-shadow .15s;color:inherit;font:inherit}
    #jd-account-modal .jd-formula:hover{border-color:rgba(56,189,248,0.45);box-shadow:0 4px 18px rgba(56,189,248,0.12)}
    #jd-account-modal .jd-formula:active{transform:translateY(1px)}
    #jd-account-modal .jd-formula.current{border-color:#38BDF8;background:rgba(56,189,248,0.08)}
    #jd-account-modal .jd-formula-name{font-size:13px;font-weight:700;color:#f1f5f9;display:flex;align-items:center;gap:6px}
    #jd-account-modal .jd-formula-price{font-size:20px;font-weight:800;color:#38BDF8;margin:6px 0 2px;letter-spacing:-.5px}
    #jd-account-modal .jd-formula-price small{font-size:11px;color:#94a3b8;font-weight:500;letter-spacing:0}
    #jd-account-modal .jd-formula-desc{font-size:11.5px;color:#94a3b8;line-height:1.4}
    #jd-account-modal .jd-actions{display:flex;flex-direction:column;gap:8px;margin-top:14px}
    #jd-account-modal .jd-act-row{display:flex;gap:8px}
    #jd-account-modal .jd-act-row .jd-btn{margin-top:0}
    #jd-account-modal .jd-meter{height:6px;background:rgba(148,163,184,0.18);border-radius:3px;overflow:hidden;margin-top:8px}
    #jd-account-modal .jd-meter i{display:block;height:100%;background:linear-gradient(90deg,#38BDF8,#7dd3fc);border-radius:3px;transition:width .25s}
    #jd-account-modal .jd-close{position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:8px;background:rgba(148,163,184,0.08);border:1px solid rgba(148,163,184,0.2);color:#94a3b8;cursor:pointer;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;transition:background .15s}
    #jd-account-modal .jd-close:hover{background:rgba(148,163,184,0.18);color:#f1f5f9}
    #jd-account-modal .jd-card{position:relative}
    `;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ────── UI: auth modal ──────
  function _injectAuthModal() {
    const html = `
    <div id="jd-auth-modal" class="jd-modal" onclick="if(event.target===this)JuriDix._hideAuth()">
      <div class="jd-card">
        <h2 id="jd-auth-title">Connexion</h2>
        <p class="jd-sub" id="jd-auth-sub">Accède à ta bibliothèque juridique.</p>
        <div class="jd-tabs">
          <button class="jd-tab on" data-mode="signin" onclick="JuriDix._switchAuthMode('signin')">Connexion</button>
          <button class="jd-tab" data-mode="signup" onclick="JuriDix._switchAuthMode('signup')">Inscription</button>
        </div>

        <!-- OAuth (Google/Apple) — désactivés tant que les providers ne sont pas configurés
             côté Supabase. Le code JS (JD.signInOAuth, JD._oauthSignIn) reste dispo. -->

        <div id="jd-name-field" class="jd-field" style="display:none">
          <label>Prénom</label>
          <input type="text" id="jd-name" autocomplete="given-name">
        </div>
        <div class="jd-field">
          <label>Email</label>
          <input type="email" id="jd-email" autocomplete="email" required>
        </div>
        <div class="jd-field">
          <label>Mot de passe</label>
          <input type="password" id="jd-pwd" autocomplete="current-password" minlength="6" required>
        </div>
        <button class="jd-btn" id="jd-auth-submit" onclick="JuriDix._submitAuth()">Se connecter</button>
        <button type="button" class="jd-link-btn" id="jd-forgot-btn" onclick="JuriDix._forgotPassword()">Mot de passe oublié&nbsp;?</button>
        <div class="jd-err" id="jd-auth-err"></div>
        <div class="jd-info" id="jd-auth-info" hidden></div>
      </div>
    </div>

    <!-- Modal "réinitialiser le mot de passe" (après clic sur lien email) -->
    <div id="jd-reset-modal" class="jd-modal" onclick="if(event.target===this)JuriDix._hideReset()">
      <div class="jd-card">
        <h2>Nouveau mot de passe</h2>
        <p class="jd-sub">Choisis un nouveau mot de passe pour ton compte.</p>
        <div class="jd-field">
          <label>Nouveau mot de passe</label>
          <input type="password" id="jd-new-pwd" autocomplete="new-password" minlength="6" required>
        </div>
        <button class="jd-btn" onclick="JuriDix._submitNewPassword()">Mettre à jour</button>
        <div class="jd-err" id="jd-reset-err"></div>
        <div class="jd-info" id="jd-reset-info" hidden></div>
      </div>
    </div>

    <div id="jd-paywall" class="jd-modal" role="dialog" aria-modal="true" aria-labelledby="jd-paywall-title" onclick="if(event.target===this)JuriDix._hidePaywall()">
      <div class="jd-card">
        <div class="jd-pw-icon">⚡</div>
        <div class="jd-pw-eyebrow">Limite atteinte</div>
        <h2 id="jd-paywall-title">Continue avec JuriDix Premium</h2>
        <p class="jd-sub" id="jd-paywall-sub">10 articles consultés. Passe à l'illimité pour continuer ta révision sans interruption.</p>
        <ul class="jd-pw-feats">
          <li>Recherches Légifrance illimitées</li>
          <li>6 codes officiels à jour</li>
          <li>Jurisprudence Cass. & CE en direct</li>
          <li>Studio rédac' avec auto-citation</li>
          <li>Export PDF haute qualité</li>
          <li>Notes synchronisées entre appareils</li>
        </ul>
        <div class="jd-pw-price" id="jd-pw-price">9,90 € <small id="jd-pw-price-sub">— accès jusqu'au 30 juin</small></div>
        <div class="jd-pw-cta">
          <button class="jd-btn-pw" onclick="JuriDix.startCheckout()" aria-label="Passer Premium via Stripe">✨ Passer Premium</button>
          <button class="jd-pw-secondary" onclick="JuriDix._hidePaywall()">Plus tard</button>
        </div>
        <div class="jd-pw-trust">
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Paiement sécurisé Stripe</span>
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"/><path d="m9 12 2 2 4-4"/></svg>Annulation 1 clic</span>
        </div>
      </div>
    </div>

    <div class="jd-pill" id="jd-pill"><span>Recherches</span><span class="jd-pill-bar"><i id="jd-pill-bar"></i></span><b id="jd-pill-num">0/10</b></div>

    <div id="jd-account-modal" class="jd-modal" onclick="if(event.target===this)JuriDix._hideAccount()">
      <div class="jd-card">
        <button class="jd-close" onclick="JuriDix._hideAccount()" aria-label="Fermer">×</button>
        <div class="jd-acc-head">
          <div class="jd-acc-avatar" id="jd-acc-avatar">?</div>
          <div class="jd-acc-meta">
            <div class="jd-acc-name" id="jd-acc-name">—</div>
            <div class="jd-acc-mail" id="jd-acc-mail">—</div>
          </div>
        </div>

        <div class="jd-section-title">Mon abonnement</div>
        <div class="jd-plan-box">
          <div class="jd-plan-row">
            <div class="jd-plan-name" id="jd-plan-name">Gratuit</div>
            <div class="jd-badge off" id="jd-plan-badge">Inactif</div>
          </div>
          <div class="jd-plan-detail" id="jd-plan-detail">Tu utilises la version gratuite.</div>
          <div class="jd-meter" id="jd-meter-wrap" style="display:none"><i id="jd-meter-bar"></i></div>
        </div>

        <div class="jd-section-title" id="jd-formulas-title">Choisir une formule</div>
        <div class="jd-formulas" id="jd-formulas-grid">
          <button type="button" class="jd-formula" data-mode="RUSH" onclick="JuriDix.startCheckout('RUSH')">
            <div class="jd-formula-name">⚡ Pass révision</div>
            <div class="jd-formula-price">9,90 € <small>une fois</small></div>
            <div class="jd-formula-desc">Accès illimité jusqu'au 30 juin 2026.</div>
          </button>
          <button type="button" class="jd-formula" data-mode="ROUTINE" onclick="JuriDix.startCheckout('ROUTINE')">
            <div class="jd-formula-name">📚 Abonnement</div>
            <div class="jd-formula-price">6 € <small>/ mois</small></div>
            <div class="jd-formula-desc">Annulable à tout moment.</div>
          </button>
        </div>

        <div class="jd-actions">
          <button type="button" class="jd-btn" id="jd-portal-btn" onclick="JuriDix.openBillingPortal()" style="display:none">Gérer paiement & factures</button>
          <button type="button" class="jd-btn jd-btn-sec" onclick="JuriDix.signOut(); JuriDix._hideAccount();">Se déconnecter</button>
        </div>
      </div>
    </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    while (div.firstChild) document.body.appendChild(div.firstChild);
  }

  function _injectAccountBadge() {
    const tb = document.querySelector('.tb-right');
    if (!tb) return;
    const btn = document.createElement('button');
    btn.id = 'jd-account';
    btn.className = 'guest';
    btn.innerHTML = '<span class="jd-acc-dot"></span><span id="jd-account-label">Connexion</span>';
    btn.onclick = () => {
      if (JD.session) JD._showAccountMenu();
      else _showAuthModal();
    };
    tb.insertBefore(btn, tb.firstChild);
  }

  function _renderAccountBadge() {
    const btn = document.getElementById('jd-account');
    const lbl = document.getElementById('jd-account-label');
    if (!btn || !lbl) return;
    if (JD.session) {
      btn.classList.remove('guest');
      const name = JD.session.user?.user_metadata?.name
        || (JD.session.user?.email || '').split('@')[0];
      const isPrem = JD.profile?.is_premium;
      lbl.textContent = (isPrem ? '⚡ ' : '') + name;
    } else {
      btn.classList.add('guest');
      lbl.textContent = 'Connexion';
    }
  }

  function _showAuthModal() {
    document.getElementById('jd-auth-modal')?.classList.add('show');
    setTimeout(() => document.getElementById('jd-email')?.focus(), 80);
  }
  function _hideAuthModal() {
    document.getElementById('jd-auth-modal')?.classList.remove('show');
    const err = document.getElementById('jd-auth-err');
    if (err) { err.classList.remove('show'); err.textContent = ''; }
  }
  JD._hideAuth = _hideAuthModal;

  JD._switchAuthMode = function (mode) {
    document.querySelectorAll('#jd-auth-modal .jd-tab').forEach((t) => {
      t.classList.toggle('on', t.dataset.mode === mode);
    });
    const isSignup = mode === 'signup';
    document.getElementById('jd-name-field').style.display = isSignup ? 'block' : 'none';
    document.getElementById('jd-auth-title').textContent = isSignup ? 'Créer un compte' : 'Connexion';
    document.getElementById('jd-auth-sub').textContent = isSignup
      ? 'Démarre ta révision en 30 secondes.'
      : 'Accède à ta bibliothèque juridique.';
    document.getElementById('jd-auth-submit').textContent = isSignup ? 'Créer mon compte' : 'Se connecter';
    document.getElementById('jd-pwd').setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
  };

  JD._oauthSignIn = async function (provider) {
    const errEl = document.getElementById('jd-auth-err');
    if (errEl) { errEl.classList.remove('show'); errEl.textContent = ''; }
    try {
      await JD.signInOAuth(provider);
      // redirige automatiquement vers le provider
    } catch (e) {
      if (errEl) {
        errEl.textContent = 'Connexion ' + provider + ' indisponible : ' + (e.message || '');
        errEl.classList.add('show');
      }
    }
  };

  JD._forgotPassword = async function () {
    const email = (document.getElementById('jd-email')?.value || '').trim();
    const errEl = document.getElementById('jd-auth-err');
    const infoEl = document.getElementById('jd-auth-info');
    if (errEl) { errEl.classList.remove('show'); errEl.textContent = ''; }
    if (infoEl) { infoEl.hidden = true; infoEl.textContent = ''; }
    if (!email || !/.+@.+\..+/.test(email)) {
      if (errEl) { errEl.textContent = 'Saisis ton email avant de cliquer sur "mot de passe oublié".'; errEl.classList.add('show'); }
      document.getElementById('jd-email')?.focus();
      return;
    }
    try {
      await JD.resetPassword(email);
      if (infoEl) {
        infoEl.textContent = 'Un email de réinitialisation a été envoyé à ' + email + '. Vérifie ta boîte (et tes spams).';
        infoEl.hidden = false;
      }
    } catch (e) {
      if (errEl) {
        errEl.textContent = 'Impossible d\'envoyer l\'email : ' + (e.message || 'erreur inconnue');
        errEl.classList.add('show');
      }
    }
  };

  function _showResetModal() {
    document.getElementById('jd-reset-modal')?.classList.add('show');
    setTimeout(() => document.getElementById('jd-new-pwd')?.focus(), 80);
  }
  function _hideResetModal() {
    document.getElementById('jd-reset-modal')?.classList.remove('show');
  }
  JD._hideReset = _hideResetModal;
  JD._showReset = _showResetModal;

  JD._submitNewPassword = async function () {
    const pwd = document.getElementById('jd-new-pwd')?.value || '';
    const errEl = document.getElementById('jd-reset-err');
    const infoEl = document.getElementById('jd-reset-info');
    if (errEl) { errEl.classList.remove('show'); errEl.textContent = ''; }
    if (infoEl) { infoEl.hidden = true; }
    if (pwd.length < 6) {
      if (errEl) { errEl.textContent = 'Mot de passe trop court (6 caractères minimum).'; errEl.classList.add('show'); }
      return;
    }
    try {
      await JD.updatePassword(pwd);
      if (infoEl) {
        infoEl.textContent = 'Mot de passe mis à jour. Tu es maintenant connecté.';
        infoEl.hidden = false;
      }
      setTimeout(_hideResetModal, 1400);
    } catch (e) {
      if (errEl) {
        errEl.textContent = 'Erreur : ' + (e.message || 'mise à jour impossible');
        errEl.classList.add('show');
      }
    }
  };

  JD._submitAuth = async function () {
    const mode = document.querySelector('#jd-auth-modal .jd-tab.on')?.dataset.mode || 'signin';
    const email = document.getElementById('jd-email').value.trim();
    const pwd = document.getElementById('jd-pwd').value;
    const name = document.getElementById('jd-name')?.value.trim() || '';
    const errEl = document.getElementById('jd-auth-err');
    const btn = document.getElementById('jd-auth-submit');
    errEl.classList.remove('show');
    if (!email || !pwd) { errEl.textContent = 'Email et mot de passe requis.'; errEl.classList.add('show'); return; }
    btn.disabled = true; btn.textContent = '…';
    try {
      if (mode === 'signup') await JD.signUp(email, pwd, name);
      else await JD.signIn(email, pwd);
      // close handled by onAuthStateChange
    } catch (e) {
      errEl.textContent = (e.message || 'Erreur d\'authentification').replace(/Invalid login credentials/, 'Email ou mot de passe incorrect.');
      errEl.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.textContent = mode === 'signup' ? 'Créer mon compte' : 'Se connecter';
    }
  };

  JD._showAccountMenu = async function () {
    if (!JD.session) { _showAuthModal(); return; }

    // Refresh the profile so plan info is up to date when opening
    try { await JD.refreshProfile(); } catch (_) {}

    const user = JD.session.user || {};
    const email = user.email || '';
    const name = user.user_metadata?.name || (email.split('@')[0] || 'Utilisateur');
    const initials = (name[0] || email[0] || '?').toUpperCase();

    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText('jd-acc-avatar', initials);
    setText('jd-acc-name', name);
    setText('jd-acc-mail', email);

    const profile = JD.profile || {};
    const isPrem = !!profile.is_premium;
    const purchased = (profile.config_mode_purchased || '').toUpperCase(); // 'RUSH' | 'ROUTINE' | ''
    const subStatus = profile.stripe_subscription_status || null;
    const expiry = profile.premium_expiry ? new Date(profile.premium_expiry) : null;

    // Plan box
    const nameEl = document.getElementById('jd-plan-name');
    const badgeEl = document.getElementById('jd-plan-badge');
    const detailEl = document.getElementById('jd-plan-detail');
    const meterWrap = document.getElementById('jd-meter-wrap');
    const meterBar = document.getElementById('jd-meter-bar');

    const fmtDate = (d) => d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    if (isPrem && purchased === 'RUSH') {
      nameEl.textContent = '⚡ Pass révision';
      badgeEl.textContent = 'Actif';
      badgeEl.className = 'jd-badge on';
      detailEl.innerHTML = expiry
        ? 'Accès illimité jusqu\'au <b>' + fmtDate(expiry) + '</b>.'
        : 'Accès illimité jusqu\'à la fin de la session.';
      meterWrap.style.display = 'none';
    } else if (isPrem && purchased === 'ROUTINE') {
      nameEl.textContent = '📚 Abonnement mensuel';
      badgeEl.textContent = subStatus === 'past_due' ? 'En retard' : 'Actif';
      badgeEl.className = 'jd-badge on';
      detailEl.innerHTML = expiry
        ? 'Prochain renouvellement le <b>' + fmtDate(expiry) + '</b>.'
        : '6 € / mois — annulable à tout moment.';
      meterWrap.style.display = 'none';
    } else if (subStatus && subStatus !== 'active' && subStatus !== 'trialing') {
      nameEl.textContent = '📚 Abonnement';
      badgeEl.textContent = subStatus === 'canceled' ? 'Annulé' : subStatus;
      badgeEl.className = 'jd-badge off';
      detailEl.textContent = 'Ton abonnement est inactif. Choisis une formule pour reprendre.';
      meterWrap.style.display = 'none';
    } else {
      nameEl.textContent = 'Gratuit';
      badgeEl.textContent = 'Découverte';
      badgeEl.className = 'jd-badge off';
      const limit = JD.config?.actionLimit || 10;
      const count = profile.action_count || 0;
      detailEl.innerHTML = '<b>' + count + ' / ' + limit + '</b> actions consultées sur ta période en cours.';
      meterWrap.style.display = 'block';
      meterBar.style.width = Math.min(100, (count / limit) * 100) + '%';
    }

    // Highlight the current formula card
    const grid = document.getElementById('jd-formulas-grid');
    if (grid) {
      grid.querySelectorAll('.jd-formula').forEach((card) => {
        card.classList.toggle('current', isPrem && card.dataset.mode === purchased);
      });
    }

    // Hide RUSH formula after the cutoff (server rejects it anyway)
    const cutoff = JD.config?.rushCutoffDate ? new Date(JD.config.rushCutoffDate) : null;
    if (cutoff && new Date() >= cutoff) {
      const rushBtn = grid?.querySelector('.jd-formula[data-mode="RUSH"]');
      if (rushBtn) rushBtn.style.display = 'none';
    }

    // Section title + formulas visibility:
    // - If user is already premium on a plan, label becomes "Changer de formule"
    // - Hide the "Gérer paiement" button if no Stripe customer yet
    const formulasTitle = document.getElementById('jd-formulas-title');
    if (formulasTitle) formulasTitle.textContent = isPrem ? 'Changer de formule' : 'Choisir une formule';

    const portalBtn = document.getElementById('jd-portal-btn');
    if (portalBtn) {
      const hasCustomer = !!profile.stripe_customer_id;
      portalBtn.style.display = hasCustomer ? 'block' : 'none';
    }

    document.getElementById('jd-account-modal')?.classList.add('show');
  };

  JD._hideAccount = function () {
    document.getElementById('jd-account-modal')?.classList.remove('show');
  };

  function _showPaywall(out) {
    const isRush = JD.config?.configMode === 'RUSH';
    const limit = JD.config?.actionLimit || 10;
    // Pricing — read from server config so changes flow without code update.
    const rushAmount = JD.config?.pricing?.RUSH?.amount ?? 9.90;
    const routineAmount = JD.config?.pricing?.ROUTINE?.amount ?? 6.00;
    const fmt = (n) => n.toFixed(2).replace('.', ',').replace(',00', '');
    const expiry = JD.config?.rushAccessExpiry || '';
    let expiryFr = 'la fin de la session';
    if (expiry) {
      try {
        const d = new Date(expiry);
        if (!isNaN(d)) {
          expiryFr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
        }
      } catch (_) { /* fallback */ }
    }
    document.getElementById('jd-pw-price').innerHTML = isRush
      ? `${fmt(rushAmount)} € <small>— accès jusqu'au ${expiryFr}</small>`
      : `${fmt(routineAmount)} € <small>/ mois — sans engagement</small>`;
    document.getElementById('jd-paywall-sub').textContent = isRush
      ? `${limit} recherches consultées. Passe à l'illimité pour continuer ta révision jusqu'au ${expiryFr}.`
      : `${limit} recherches consultées sur les 4 dernières heures. Passe à l'illimité ou attends le reset.`;
    document.getElementById('jd-paywall').classList.add('show');
  }
  JD._hidePaywall = function () {
    document.getElementById('jd-paywall')?.classList.remove('show');
  };

  function _updateActionPill(out) {
    const pill = document.getElementById('jd-pill');
    const bar = document.getElementById('jd-pill-bar');
    const num = document.getElementById('jd-pill-num');
    if (!pill) return;
    if (out.premium) {
      pill.classList.remove('show');
      return;
    }
    const limit = JD.config?.actionLimit || 10;
    const count = out.action_count || 0;
    pill.classList.add('show');
    bar.style.width = Math.min(100, (count / limit) * 100) + '%';
    num.textContent = count + '/' + limit;
  }

  window.JuriDix = JD;

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => JD.init());
  } else {
    JD.init();
  }
})();
