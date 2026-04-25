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
      const el = document.getElementById('lab-autosave2');
      if (el) el.textContent = '☁ Synchronisé';
    } catch (e) {
      console.warn('[JuriDix] studio sync', e);
      const el = document.getElementById('lab-autosave2');
      if (el) el.textContent = '⚠ Sauvegarde locale';
    }
  };

  // ────── CHECKOUT ──────
  JD.startCheckout = async function () {
    if (!JD.session) { _showAuthModal(); return; }
    try {
      const out = await api('/api/stripe/checkout', { method: 'POST', body: '{}' });
      if (out && out.url) {
        window.location.href = out.url;
      } else {
        alert('Checkout indisponible — réessaie dans un instant.');
      }
    } catch (e) {
      alert(e.message || 'Erreur Stripe');
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
    #jd-paywall .jd-card{max-width:480px;text-align:center}
    #jd-paywall .jd-pw-icon{font-size:48px;margin-bottom:14px}
    #jd-paywall .jd-pw-feats{list-style:none;text-align:left;margin:18px 0;padding:14px 18px;background:rgba(15,23,42,0.6);border-radius:10px}
    #jd-paywall .jd-pw-feats li{padding:5px 0;font-size:13px;color:#cbd5e1;display:flex;align-items:center;gap:9px}
    #jd-paywall .jd-pw-feats li::before{content:'✓';color:#38BDF8;font-weight:800}
    #jd-paywall .jd-pw-price{font-size:34px;font-weight:800;color:#38BDF8;margin:8px 0 4px;letter-spacing:-1px}
    #jd-paywall .jd-pw-price small{font-size:14px;color:#94a3b8;font-weight:500}
    #jd-paywall .jd-pw-cta{display:flex;gap:8px;margin-top:14px}
    #jd-paywall .jd-pw-cta button{flex:1}
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
        <div class="jd-err" id="jd-auth-err"></div>
      </div>
    </div>

    <div id="jd-paywall" class="jd-modal" onclick="if(event.target===this)JuriDix._hidePaywall()">
      <div class="jd-card">
        <div class="jd-pw-icon">⚖️</div>
        <h2 id="jd-paywall-title">Tu touches du doigt l'illimité</h2>
        <p class="jd-sub" id="jd-paywall-sub">10 articles consultés. Pour continuer ta révision sans limite, débloque le pass.</p>
        <ul class="jd-pw-feats">
          <li>Recherches illimitées sur 5 codes</li>
          <li>Studio cloud avec sauvegarde automatique</li>
          <li>Insertion d'articles dans tes fiches</li>
          <li>Navigation Précédent / Suivant entre articles</li>
        </ul>
        <div class="jd-pw-price" id="jd-pw-price">9,90 € <small id="jd-pw-price-sub">— accès jusqu'au 30 juin</small></div>
        <div class="jd-pw-cta">
          <button class="jd-btn jd-btn-sec" onclick="JuriDix._hidePaywall()">Plus tard</button>
          <button class="jd-btn" onclick="JuriDix.startCheckout()">Débloquer maintenant</button>
        </div>
      </div>
    </div>

    <div class="jd-pill" id="jd-pill"><span>Recherches</span><span class="jd-pill-bar"><i id="jd-pill-bar"></i></span><b id="jd-pill-num">0/10</b></div>
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

  JD._showAccountMenu = function () {
    const ok = confirm('Connecté en tant que ' + (JD.session.user.email) + '\n\nSe déconnecter ?');
    if (ok) JD.signOut();
  };

  function _showPaywall(out) {
    const isRush = JD.config?.configMode === 'RUSH';
    document.getElementById('jd-pw-price').innerHTML = isRush
      ? '9,90 € <small>— accès jusqu\'au 30 juin</small>'
      : '6 € <small>/ mois — annulable à tout moment</small>';
    document.getElementById('jd-paywall-sub').textContent = isRush
      ? '10 articles consultés. Le pass JuriDix te donne un accès illimité jusqu\'à la fin de la session.'
      : '10 articles consultés sur les dernières 4h. Passe en illimité ou attends le reset.';
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
