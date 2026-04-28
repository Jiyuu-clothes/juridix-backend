/* =============================================================================
   CARTE MENTALE — Canvas mind map for JuriDix
   Pattern: viewport with pan/zoom, nodes (text + reference), edges (SVG bezier)
   Persistence: localStorage jdx_mindmaps_v1 = { active, maps: [...] }
   ============================================================================= */
(function(){
  'use strict';

  // ---------- State ----------
  var STORE_KEY = 'jdx_mindmaps_v1';
  var state = { active: null, maps: [] };
  var view = { x: 0, y: 0, scale: 1 };
  var ui = {
    canvas: null, nodes: null, edges: null,
    selected: null,
    panStart: null,
    nodeDrag: null,
    edgeDrag: null,
    nodeResize: null,
    sidebarPane: 'maps',
    initialized: false,
  };

  // ---------- Smooth pan animation (rAF lerp + release inertia) ----------
  var anim = {
    target: null,        // { x, y } position que view.x/y essaie de rejoindre pendant le pan
    velocity: null,      // { vx, vy } px/s appliqué au relâchement
    running: false,
    lastT: 0
  };
  var panSamples = [];   // historique récent { x, y, t } pour calculer la vélocité au relâchement

  function ensureAnim(){
    if (anim.running) return;
    anim.running = true;
    anim.lastT = performance.now();
    requestAnimationFrame(tickAnim);
  }
  function tickAnim(t){
    var dt = Math.min(50, t - anim.lastT) / 1000; // s, plafonné pour éviter les sauts au tab inactif
    anim.lastT = t;
    var keepGoing = false;

    if (anim.target){
      // Smooth follow : view.x/y se rapproche exponentiellement de la cible
      var k = 1 - Math.exp(-30 * dt); // ~halving every ~23ms
      var dx = anim.target.x - view.x;
      var dy = anim.target.y - view.y;
      view.x += dx * k;
      view.y += dy * k;
      if (Math.abs(dx) > 0.15 || Math.abs(dy) > 0.15) keepGoing = true;
      applyViewTransform();
    } else if (anim.velocity){
      // Inertie : décélération exponentielle après relâchement
      view.x += anim.velocity.vx * dt;
      view.y += anim.velocity.vy * dt;
      var decay = Math.exp(-4.5 * dt); // ~10% velocité après 0.5s
      anim.velocity.vx *= decay;
      anim.velocity.vy *= decay;
      var spd = Math.hypot(anim.velocity.vx, anim.velocity.vy);
      if (spd > 12) keepGoing = true;
      else anim.velocity = null;
      applyViewTransform();
    }

    if (keepGoing) requestAnimationFrame(tickAnim);
    else anim.running = false;
  }
  function stopAnim(){
    anim.target = null;
    anim.velocity = null;
  }

  // ---------- Utils ----------
  function uid(){ return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function now(){ return new Date().toISOString(); }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  // Build a rich text body from a fiche object (def + cond + eff + jur + arts)
  function ficheBodyText(f){
    if (!f) return '';
    var parts = [];
    if (f.def) parts.push('📖 ' + f.def);
    if (f.cond && f.cond.length){
      parts.push('\n✅ Conditions :\n' + f.cond.map(function(c){ return '• ' + c; }).join('\n'));
    }
    if (f.eff && f.eff.length){
      parts.push('\n⚡ Effets :\n' + f.eff.map(function(e){ return '• ' + e; }).join('\n'));
    }
    if (f.jur && f.jur.length){
      parts.push('\n⚖️ Jurisprudence :\n' + f.jur.map(function(j){ return '• ' + j; }).join('\n'));
    }
    if (f.arts && f.arts.length){
      parts.push('\n📚 Articles : ' + f.arts.join(', '));
    }
    return parts.join('\n');
  }
  function findFicheById(id){
    var fiches = window.FICHES || [];
    for (var i = 0; i < fiches.length; i++){ if (fiches[i].id === id) return fiches[i]; }
    return null;
  }

  function load(){
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.maps)){
        state.maps = parsed.maps;
        state.active = parsed.active || (parsed.maps[0] && parsed.maps[0].id) || null;
      }
    } catch(e){ console.warn('carte: load failed', e); }
  }
  function save(){
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ active: state.active, maps: state.maps }));
    } catch(e){ console.warn('carte: save failed', e); }
  }
  function activeMap(){
    return state.maps.find(function(m){ return m.id === state.active; });
  }
  function newMapObj(title){
    return {
      id: uid(),
      title: title || 'Nouvelle carte',
      nodes: [], edges: [],
      createdAt: now(), updatedAt: now(),
    };
  }
  function ensureMap(){
    if (!activeMap()){
      var m = newMapObj();
      state.maps.unshift(m);
      state.active = m.id;
      save();
    }
    return activeMap();
  }
  function touchMap(){
    var m = activeMap();
    if (m) m.updatedAt = now();
    save();
  }
  function findNode(id){
    var m = activeMap(); if (!m) return null;
    return m.nodes.find(function(n){ return n.id === id; });
  }

  // ---------- Lifecycle ----------
  function open(){
    if (!ui.initialized) init();
    document.body.classList.add('carte-mode');
    var ov = document.getElementById('carte-overlay');
    if (ov) ov.hidden = false;
    document.querySelectorAll('#icon-sidebar .nav-icon').forEach(function(el){ el.classList.remove('on'); });
    var ni = document.getElementById('ni-carte');
    if (ni) ni.classList.add('on');
    document.querySelectorAll('.ttab').forEach(function(el){ el.classList.remove('on'); });
    var tt = document.querySelector('.ttab[data-tab="carte"]');
    if (tt) tt.classList.add('on');
    if (state.maps.length === 0){
      var m = newMapObj('Ma première carte');
      state.maps.push(m);
      state.active = m.id;
      save();
    }
    if (!state.active && state.maps[0]) state.active = state.maps[0].id;
    renderList();
    renderActive();
    renderSidebarPane(ui.sidebarPane);
  }
  function exit(){
    document.body.classList.remove('carte-mode');
    var ov = document.getElementById('carte-overlay');
    if (ov) ov.hidden = true;
    var lastTab = window._tab || 'search';
    document.querySelectorAll('#icon-sidebar .nav-icon').forEach(function(el){ el.classList.remove('on'); });
    var ni = document.getElementById('ni-' + lastTab);
    if (ni) ni.classList.add('on');
    document.querySelectorAll('.ttab').forEach(function(el){ el.classList.remove('on'); });
    var tt = document.querySelector('.ttab[data-tab="' + lastTab + '"]');
    if (tt) tt.classList.add('on');
  }

  function init(){
    ui.canvas = document.getElementById('carte-canvas');
    ui.nodes  = document.getElementById('carte-nodes');
    ui.edges  = document.getElementById('carte-edges');
    if (!ui.canvas) { console.warn('carte: missing #carte-canvas'); return; }
    bindCanvas();
    bindKeyboard();
    bindDragDrop();
    bindResizer();
    bindSidebarTabs();
    load();
    ui.initialized = true;
  }

  // ---------- Sidebar: tabs ----------
  function bindSidebarTabs(){
    var tabs = document.getElementById('carte-sidebar-tabs');
    if (!tabs) return;
    tabs.addEventListener('click', function(ev){
      var btn = ev.target.closest('.cs-tab');
      if (!btn) return;
      var pane = btn.getAttribute('data-pane');
      ui.sidebarPane = pane;
      tabs.querySelectorAll('.cs-tab').forEach(function(t){ t.classList.toggle('on', t === btn); });
      var allPanes = document.querySelectorAll('#carte-sidebar .cs-pane');
      allPanes.forEach(function(p){ p.hidden = p.getAttribute('data-pane') !== pane; });
      var newBtn = document.getElementById('carte-new-btn');
      if (newBtn) newBtn.style.display = (pane === 'maps' ? '' : 'none');
      renderSidebarPane(pane);
    });
  }

  function renderSidebarPane(pane){
    if (pane === 'notes') renderNotesPane();
    else if (pane === 'fiches') renderFichesPane();
    else renderList();
  }

  function renderNotesPane(){
    var box = document.getElementById('carte-notes-list');
    if (!box) return;
    var notes = (window._notes && Array.isArray(window._notes)) ? window._notes : [];
    if (notes.length === 0){
      box.innerHTML = '<div class="cs-empty">Aucune note.<br>Crée des notes depuis Studio puis glisse-les ici.</div>';
      return;
    }
    box.innerHTML = notes.map(function(n, i){
      var title = (n.title || 'Note ' + (i + 1)).slice(0, 80);
      var body  = (n.body || '').slice(0, 120);
      return '<div class="cs-item" draggable="true" data-source="note" data-idx="' + i + '">'
        +   '<button class="cs-item-open" data-action="open" title="Ouvrir / éditer la note">↗</button>'
        +   '<div class="cs-item-eyebrow">📝 Note</div>'
        +   '<div class="cs-item-title">' + esc(title) + '</div>'
        +   (body ? '<div class="cs-item-meta">' + esc(body) + '</div>' : '')
        + '</div>';
    }).join('');
    box.querySelectorAll('.cs-item').forEach(function(el){
      var idx = parseInt(el.getAttribute('data-idx'), 10);
      var n = notes[idx]; if (!n) return;
      var openBtn = el.querySelector('[data-action="open"]');
      if (openBtn){
        openBtn.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
        openBtn.addEventListener('click', function(ev){
          ev.stopPropagation();
          if (typeof window.openNoteModal === 'function') window.openNoteModal(idx);
        });
      }
      el.addEventListener('dragstart', function(de){
        var payload = {
          type: 'ref', kind: 'note',
          title: (n.title || 'Note').slice(0, 140),
          body:  (n.body  || '').slice(0, 600),
          ref: '', codeLabel: '', date: n.date || '',
        };
        de.dataTransfer.setData('application/x-juridix-result', JSON.stringify(payload));
        de.dataTransfer.setData('text/plain', payload.title);
        de.dataTransfer.effectAllowed = 'copy';
      });
      el.addEventListener('dblclick', function(){
        addRefNodeAtCenter({
          type: 'ref', kind: 'note',
          title: (n.title || 'Note').slice(0, 140),
          body:  (n.body  || '').slice(0, 600),
          date: n.date || '',
        });
      });
    });
  }

  function renderFichesPane(){
    var box = document.getElementById('carte-fiches-list');
    if (!box) return;
    var fiches = (window.FICHES && Array.isArray(window.FICHES)) ? window.FICHES : [];
    if (fiches.length === 0){
      box.innerHTML = '<div class="cs-empty">Aucune fiche disponible.</div>';
      return;
    }
    box.innerHTML = fiches.map(function(f, i){
      return '<div class="cs-item" draggable="true" data-source="fiche" data-idx="' + i + '">'
        +   '<button class="cs-item-open" data-action="open" title="Ouvrir la fiche">↗</button>'
        +   '<div class="cs-item-eyebrow">📋 ' + esc(f.mat || 'Fiche') + '</div>'
        +   '<div class="cs-item-title">' + esc((f.ico || '') + ' ' + (f.titre || '')) + '</div>'
        +   '<div class="cs-item-meta">' + ((f.arts && f.arts.length) || 0) + ' article(s)</div>'
        + '</div>';
    }).join('');
    box.querySelectorAll('.cs-item').forEach(function(el){
      var idx = parseInt(el.getAttribute('data-idx'), 10);
      var f = fiches[idx]; if (!f) return;
      var openBtn = el.querySelector('[data-action="open"]');
      if (openBtn){
        openBtn.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
        openBtn.addEventListener('click', function(ev){
          ev.stopPropagation();
          // Exit carte mode and open the fiche
          if (typeof window.closeCarte === 'function') window.closeCarte();
          else document.body.classList.remove('carte-mode');
          if (typeof window.openFiche === 'function' && f.id) window.openFiche(f.id);
        });
      }
      el.addEventListener('dragstart', function(de){
        var payload = {
          type: 'ref', kind: 'fiche',
          title: (f.titre || 'Fiche').slice(0, 140),
          body: ficheBodyText(f).slice(0, 4000),
          ref: f.id || '', codeLabel: f.mat || '',
        };
        de.dataTransfer.setData('application/x-juridix-result', JSON.stringify(payload));
        de.dataTransfer.setData('text/plain', payload.title);
        de.dataTransfer.effectAllowed = 'copy';
      });
      el.addEventListener('dblclick', function(){
        addRefNodeAtCenter({
          type: 'ref', kind: 'fiche',
          title: (f.titre || 'Fiche').slice(0, 140),
          body: ficheBodyText(f).slice(0, 4000),
          ref: f.id || '', codeLabel: f.mat || '',
        });
      });
    });
  }

  function renderList(){
    var box = document.getElementById('carte-list');
    if (!box) return;
    var listHtml = '';
    if (state.maps.length === 0){
      listHtml = '<div class="carte-empty-list">Aucune carte pour l\'instant.</div>';
    } else {
      listHtml = state.maps.map(function(m){
        var on = m.id === state.active ? ' on' : '';
        return '<div class="carte-item' + on + '" data-id="' + esc(m.id) + '">'
          +   '<span class="carte-item-title" title="Double-clic pour renommer">' + esc(m.title || '(sans titre)') + '</span>'
          +   '<button class="carte-item-rn" data-action="rename" title="Renommer">✏️</button>'
          +   '<button class="carte-item-del" data-action="del" title="Supprimer">🗑</button>'
          + '</div>';
      }).join('');
    }
    // "+ Nouvelle carte" button at the bottom of the list
    listHtml += '<button class="carte-add-btn" data-action="add" title="Créer une nouvelle carte">+ Nouvelle carte</button>';
    box.innerHTML = listHtml;
    box.querySelectorAll('.carte-item').forEach(function(el){
      el.addEventListener('click', function(ev){
        var id = el.getAttribute('data-id');
        var btn = ev.target.closest('[data-action]');
        if (btn && btn.getAttribute('data-action') === 'del'){
          ev.stopPropagation();
          if (confirm('Supprimer cette carte ?')){
            state.maps = state.maps.filter(function(m){ return m.id !== id; });
            if (state.active === id) state.active = state.maps[0] ? state.maps[0].id : null;
            save(); renderList(); renderActive();
          }
          return;
        }
        if (btn && btn.getAttribute('data-action') === 'rename'){
          ev.stopPropagation();
          startInlineRename(el, id);
          return;
        }
        state.active = id;
        save(); renderList(); renderActive();
      });
      // Double-click on the title to rename inline
      var titleEl = el.querySelector('.carte-item-title');
      if (titleEl){
        titleEl.addEventListener('dblclick', function(ev){
          ev.stopPropagation();
          startInlineRename(el, el.getAttribute('data-id'));
        });
      }
    });
    var addBtn = box.querySelector('.carte-add-btn');
    if (addBtn){
      addBtn.addEventListener('click', function(){
        if (typeof window.newCarte === 'function') window.newCarte();
      });
    }
  }

  // ---------- Render: active map ----------
  function renderActive(){
    var m = activeMap();
    var titleIn = document.getElementById('carte-title-in');
    var empty = document.getElementById('carte-empty');
    if (!m){
      if (titleIn) titleIn.value = '';
      if (ui.nodes) ui.nodes.innerHTML = '';
      if (ui.edges) ui.edges.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }
    if (titleIn && titleIn.value !== m.title) titleIn.value = m.title;
    renderNodes();
    renderEdges();
    if (empty) empty.style.display = (m.nodes.length === 0 ? 'flex' : 'none');
    applyViewTransform();
  }

  function renderNodes(){
    var m = activeMap(); if (!m || !ui.nodes) return;
    ui.nodes.innerHTML = m.nodes.map(nodeHtml).join('');
    m.nodes.forEach(function(n){ bindNode(n.id); });
  }

  function nodeEyebrow(n){
    if (n.type !== 'ref') return '';
    if (n.kind === 'jurisprudence') return '⚖ ' + (n.date || 'Jurisprudence');
    if (n.kind === 'note')          return '📝 Note';
    if (n.kind === 'fiche')         return '📋 ' + (n.codeLabel || 'Fiche');
    return '📚 ' + (n.codeLabel || 'Article');
  }

  function nodeHtml(n){
    var color = n.color ? ' data-color="' + esc(n.color) + '"' : '';
    var styleParts = ['left:' + (n.x | 0) + 'px', 'top:' + (n.y | 0) + 'px'];
    if (n.w) styleParts.push('width:' + (n.w | 0) + 'px');
    if (n.h) styleParts.push('height:' + (n.h | 0) + 'px');
    var style = ' style="' + styleParts.join(';') + '"';

    var inner = '';
    var eyebrow = nodeEyebrow(n);
    if (eyebrow) inner += '<div class="cm-node-eyebrow">' + esc(eyebrow.trim()) + '</div>';
    inner += '<div class="cm-node-title">' + esc(n.title || (n.type === 'ref' ? '' : 'Sans titre')) + '</div>';
    var body = n.body || n.snippet;
    if (body) inner += '<div class="cm-node-snippet">' + esc(body) + '</div>';

    var sel = (ui.selected && ui.selected.type === 'node' && ui.selected.id === n.id) ? ' selected' : '';
    var openBtn = (n.type === 'ref' && n.ref)
      ? '<button class="cm-tb-btn" data-act="open" title="Ouvrir la référence">🔗</button>'
        + '<div class="cm-tb-sep"></div>'
      : '';

    return '<div class="cm-node' + sel + '" data-id="' + esc(n.id) + '" data-type="' + esc(n.type || 'text') + '"' + color + style + '>'
      +   '<div class="cm-node-toolbar">'
      +     '<button class="cm-tb-btn" data-act="edit-title" title="Modifier le titre">✏</button>'
      +     '<button class="cm-tb-btn" data-act="edit-body" title="Modifier la note">📝</button>'
      +     openBtn
      +     '<button class="cm-tb-btn" data-act="color" title="Couleur">🎨</button>'
      +     '<div class="cm-tb-sep"></div>'
      +     '<button class="cm-tb-btn danger" data-act="delete" title="Supprimer (Suppr)">🗑</button>'
      +   '</div>'
      +   '<div class="cm-node-colors">'
      +     '<div class="cm-color-dot" data-c="default" title="Défaut"></div>'
      +     '<div class="cm-color-dot" data-c="cyan" title="Cyan"></div>'
      +     '<div class="cm-color-dot" data-c="green" title="Vert"></div>'
      +     '<div class="cm-color-dot" data-c="gold" title="Or"></div>'
      +     '<div class="cm-color-dot" data-c="red" title="Rouge"></div>'
      +   '</div>'
      +   inner
      +   '<div class="cm-handle" data-side="top"></div>'
      +   '<div class="cm-handle" data-side="right"></div>'
      +   '<div class="cm-handle" data-side="bottom"></div>'
      +   '<div class="cm-handle" data-side="left"></div>'
      +   '<div class="cm-resize" title="Redimensionner"></div>'
      + '</div>';
  }

  function bindNode(id){
    var el = ui.nodes.querySelector('.cm-node[data-id="' + id + '"]');
    if (!el) return;
    var n = findNode(id); if (!n) return;
    el.addEventListener('mousedown', function(ev){
      // Toolbar buttons
      var tbBtn = ev.target.closest && ev.target.closest('.cm-tb-btn');
      if (tbBtn && el.contains(tbBtn)){
        var act = tbBtn.getAttribute('data-act');
        ev.stopPropagation(); ev.preventDefault();
        ui.selected = { type: 'node', id: id };
        if (act === 'edit-title')      startEditField(id, 'title');
        else if (act === 'edit-body')  startEditField(id, 'body');
        else if (act === 'open')       openRef(n);
        else if (act === 'color')      el.classList.toggle('colors-open');
        else if (act === 'delete')     { deleteNode(id); }
        return;
      }
      // Resize handle
      if (ev.target.classList.contains('cm-resize')){
        startNodeResize(id, ev);
        ev.stopPropagation(); ev.preventDefault();
        return;
      }
      // Edge handle
      if (ev.target.classList.contains('cm-handle')){
        startEdgeDrag(id, ev.target.getAttribute('data-side'), ev);
        ev.stopPropagation(); ev.preventDefault();
        return;
      }
      // Color dot
      if (ev.target.classList.contains('cm-color-dot')){
        var c = ev.target.getAttribute('data-c');
        n.color = (c === 'default' ? null : c);
        touchMap(); renderNodes();
        ev.stopPropagation(); return;
      }
      // Hold Alt/Option to start an edge from any point on the node's border
      if (ev.altKey){
        var rect0 = el.getBoundingClientRect();
        var lx = (ev.clientX - rect0.left) / view.scale;
        var ly = (ev.clientY - rect0.top) / view.scale;
        var w0 = el.offsetWidth, h0 = el.offsetHeight;
        var midX = w0/2, midY = h0/2;
        var side;
        var dxRel = lx - midX, dyRel = ly - midY;
        var ax = Math.abs(dxRel) / (w0/2 || 1);
        var ay = Math.abs(dyRel) / (h0/2 || 1);
        if (ax >= ay) side = dxRel > 0 ? 'right' : 'left';
        else          side = dyRel > 0 ? 'bottom' : 'top';
        startEdgeDrag(id, side, ev);
        ev.stopPropagation(); ev.preventDefault();
        return;
      }
      // Drag the node
      startNodeDrag(id, ev);
      ui.selected = { type: 'node', id: id };
      renderNodes(); renderEdges();
      ev.stopPropagation();
    });
    el.addEventListener('dblclick', function(ev){
      // For ref nodes, double-click opens the link unless on title/body (which edits).
      var onText = ev.target.closest('.cm-node-title') || ev.target.closest('.cm-node-snippet');
      if (n.type === 'ref' && !onText){ openRef(n); return; }
      if (onText){
        var field = ev.target.closest('.cm-node-snippet') ? 'body' : 'title';
        startEditField(id, field);
        ev.stopPropagation();
        return;
      }
      startEditField(id, 'title');
      ev.stopPropagation();
    });
  }

  function startEditField(id, field){
    var el = ui.nodes.querySelector('.cm-node[data-id="' + id + '"]');
    if (!el) return;
    var n = findNode(id); if (!n) return;
    var sel = field === 'body' ? '.cm-node-snippet' : '.cm-node-title';
    var target = el.querySelector(sel);

    if (!target && field === 'body'){
      // Insert a body slot under the title (or eyebrow if no title)
      var anchor = el.querySelector('.cm-node-title') || el.querySelector('.cm-node-eyebrow') || null;
      target = document.createElement('div');
      target.className = 'cm-node-snippet';
      target.textContent = n.body || n.snippet || '';
      if (anchor && anchor.nextSibling) anchor.parentNode.insertBefore(target, anchor.nextSibling);
      else el.insertBefore(target, el.querySelector('.cm-handle'));
    }
    if (!target) return;

    var ta = document.createElement('textarea');
    ta.className = field === 'body' ? 'cm-node-edit-body' : 'cm-node-edit';
    ta.value = field === 'body' ? (n.body || n.snippet || '') : (n.title || '');
    ta.setAttribute('data-field', field);
    target.replaceWith(ta);
    ta.focus(); ta.select();

    var commit = function(){
      var v = ta.value.trim();
      if (field === 'body'){
        n.body = v;
        if (n.snippet && !v) delete n.snippet;
      } else {
        n.title = v || (n.type === 'ref' ? '(Sans titre)' : 'Sans titre');
      }
      touchMap(); renderNodes(); renderEdges();
    };
    ta.addEventListener('blur', commit);
    ta.addEventListener('keydown', function(ev){
      if (ev.key === 'Escape'){
        ta.value = field === 'body' ? (n.body || n.snippet || '') : (n.title || '');
        ta.removeEventListener('blur', commit);
        renderNodes(); renderEdges();
      } else if (ev.key === 'Enter' && !ev.shiftKey && field === 'title'){
        ev.preventDefault(); ta.blur();
      } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && field === 'body'){
        ev.preventDefault(); ta.blur();
      }
    });
  }

  function deleteNode(id){
    var m = activeMap(); if (!m) return;
    m.nodes = m.nodes.filter(function(n){ return n.id !== id; });
    m.edges = m.edges.filter(function(e){ return e.from !== id && e.to !== id; });
    if (ui.selected && ui.selected.id === id) ui.selected = null;
    touchMap();
    renderNodes(); renderEdges();
    var emp = document.getElementById('carte-empty');
    if (emp) emp.style.display = (m.nodes.length === 0 ? 'flex' : 'none');
  }

  function openRef(n){
    if (!n.ref) return;
    if (n.kind === 'jurisprudence'){
      if (typeof window.openJuris === 'function') window.openJuris(n.ref);
      else if (typeof window.openArticle === 'function') window.openArticle(n.ref);
    } else if (n.kind === 'fiche'){
      if (typeof window.openFiche === 'function') window.openFiche(n.ref);
    } else if (n.kind === 'note'){
      // Notes don't have a reference; nothing to open.
    } else {
      if (typeof window.openArticle === 'function') window.openArticle(n.ref);
    }
  }

  // ---------- Render: edges ----------
  function renderEdges(){
    var m = activeMap(); if (!m || !ui.edges){ if (ui.edges) ui.edges.innerHTML = ''; return; }
    var html = '<defs><marker id="cm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" style="color:var(--acc)"/></marker></defs>';
    m.edges.forEach(function(e){
      var a = m.nodes.find(function(n){ return n.id === e.from; });
      var b = m.nodes.find(function(n){ return n.id === e.to; });
      if (!a || !b) return;
      // Geometric anchoring: each end attaches to the perimeter point on the line
      // between the two centers — gives smooth, infinite attachment points.
      var ba = nodeBox(a), bb = nodeBox(b);
      var pa = perimeterAnchor(a, bb.cx, bb.cy);
      var pb = perimeterAnchor(b, ba.cx, ba.cy);
      var path = bezierPath(pa, pb);
      var isSel = (ui.selected && ui.selected.type === 'edge' && ui.selected.id === e.id);
      var sel = isSel ? ' selected' : '';
      // Hit zone (wide invisible) for easy clicking
      html += '<path class="cm-edge-hit" d="' + path + '" data-id="' + esc(e.id) + '"></path>';
      // Visible edge
      html += '<path class="cm-edge' + sel + '" d="' + path + '" data-id="' + esc(e.id) + '" marker-end="url(#cm-arrow)"></path>';
      if (e.label){
        var mid = bezierMid(pa, pb);
        html += '<text class="cm-edge-label" x="' + mid.x + '" y="' + mid.y + '" text-anchor="middle" data-id="' + esc(e.id) + '">' + esc(e.label) + '</text>';
      }
      // Delete button when selected
      if (isSel){
        var midPt = bezierMid(pa, pb);
        html += '<g class="cm-edge-del" data-id="' + esc(e.id) + '" transform="translate(' + (midPt.x + 12) + ',' + (midPt.y - 4) + ')" style="cursor:pointer">'
              + '<circle r="10" fill="#dc2626" stroke="#fff" stroke-width="1.5"/>'
              + '<path d="M -4 -4 L 4 4 M -4 4 L 4 -4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'
              + '</g>';
      }
    });
    ui.edges.innerHTML = html;
    // Selection / dblclick on edges (visible, hit-zone, label)
    ui.edges.querySelectorAll('.cm-edge,.cm-edge-hit,.cm-edge-label').forEach(function(el){
      el.addEventListener('mousedown', function(ev){
        ev.stopPropagation();
      });
      el.addEventListener('click', function(ev){
        var id = el.getAttribute('data-id');
        ui.selected = { type: 'edge', id: id };
        renderNodes(); renderEdges();
        ev.stopPropagation();
      });
      el.addEventListener('dblclick', function(ev){
        var id = el.getAttribute('data-id');
        var m2 = activeMap();
        var e2 = m2.edges.find(function(x){ return x.id === id; });
        if (!e2) return;
        var label = prompt('Étiquette de la flèche :', e2.label || '');
        if (label !== null){
          e2.label = label.trim();
          touchMap(); renderEdges();
        }
        ev.stopPropagation();
      });
    });
    // Delete button on selected edge
    ui.edges.querySelectorAll('.cm-edge-del').forEach(function(el){
      el.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
      el.addEventListener('click', function(ev){
        ev.stopPropagation();
        var id = el.getAttribute('data-id');
        var m3 = activeMap(); if (!m3) return;
        m3.edges = m3.edges.filter(function(x){ return x.id !== id; });
        if (ui.selected && ui.selected.type === 'edge' && ui.selected.id === id) ui.selected = null;
        touchMap(); renderEdges();
      });
    });
  }

  function nodeBox(n){
    var el = ui.nodes && ui.nodes.querySelector('.cm-node[data-id="' + n.id + '"]');
    var w = (n.w | 0) || (el ? el.offsetWidth : 160);
    var h = (n.h | 0) || (el ? el.offsetHeight : 40);
    return { x: n.x, y: n.y, w: w, h: h, cx: n.x + w/2, cy: n.y + h/2 };
  }
  function nodeAnchor(n, side){
    var b = nodeBox(n);
    if (side === 'right')  return { x: b.x + b.w, y: b.cy, nx:  1, ny:  0, side: 'right' };
    if (side === 'left')   return { x: b.x,       y: b.cy, nx: -1, ny:  0, side: 'left' };
    if (side === 'top')    return { x: b.cx,      y: b.y,  nx:  0, ny: -1, side: 'top' };
    if (side === 'bottom') return { x: b.cx,      y: b.y + b.h, nx: 0, ny: 1, side: 'bottom' };
    return { x: b.cx, y: b.cy, nx: 0, ny: 0, side: '' };
  }
  // Continuous perimeter anchor: returns the point on the rectangle's border
  // intersected by the ray from the node's center toward (towardX, towardY).
  // This effectively gives infinite attachment points around the node.
  function perimeterAnchor(n, towardX, towardY){
    var b = nodeBox(n);
    var dx = towardX - b.cx, dy = towardY - b.cy;
    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001){
      return { x: b.cx, y: b.cy, nx: 1, ny: 0, side: 'right' };
    }
    var halfW = b.w / 2, halfH = b.h / 2;
    var tx = Math.abs(dx) > 0.0001 ? halfW / Math.abs(dx) : Infinity;
    var ty = Math.abs(dy) > 0.0001 ? halfH / Math.abs(dy) : Infinity;
    var t = Math.min(tx, ty);
    var px = b.cx + dx * t, py = b.cy + dy * t;
    var side, nx = 0, ny = 0;
    if (tx <= ty){
      side = dx > 0 ? 'right' : 'left';
      nx = dx > 0 ? 1 : -1;
    } else {
      side = dy > 0 ? 'bottom' : 'top';
      ny = dy > 0 ? 1 : -1;
    }
    return { x: px, y: py, nx: nx, ny: ny, side: side };
  }
  // Pick the side of `toNode` whose anchor is closest to `fromAnchor`.
  function pickClosestSide(fromAnchor, toNode){
    var sides = ['left', 'right', 'top', 'bottom'];
    var best = 'left', bestD = Infinity;
    for (var i = 0; i < sides.length; i++){
      var p = nodeAnchor(toNode, sides[i]);
      var d = Math.hypot(p.x - fromAnchor.x, p.y - fromAnchor.y);
      if (d < bestD){ bestD = d; best = sides[i]; }
    }
    return best;
  }
  function sideOffset(side, dist){
    if (side === 'left')   return { dx: -dist, dy: 0 };
    if (side === 'right')  return { dx:  dist, dy: 0 };
    if (side === 'top')    return { dx: 0, dy: -dist };
    if (side === 'bottom') return { dx: 0, dy:  dist };
    return { dx: 0, dy: 0 };
  }
  function bezierPath(a, b, sideA, sideB){
    var d = Math.max(48, Math.hypot(b.x - a.x, b.y - a.y) * 0.42);
    // If the anchor objects carry their own outward normals (nx, ny), use them.
    // Otherwise fall back to the named-side offset.
    var oa, ob;
    if (a && typeof a.nx === 'number' && typeof a.ny === 'number' && (a.nx || a.ny)){
      oa = { dx: a.nx * d, dy: a.ny * d };
    } else {
      oa = sideOffset(sideA || 'right', d);
    }
    if (b && typeof b.nx === 'number' && typeof b.ny === 'number' && (b.nx || b.ny)){
      ob = { dx: b.nx * d, dy: b.ny * d };
    } else {
      ob = sideOffset(sideB || 'left', d);
    }
    var cx1 = a.x + oa.dx, cy1 = a.y + oa.dy;
    var cx2 = b.x + ob.dx, cy2 = b.y + ob.dy;
    return 'M ' + a.x + ' ' + a.y + ' C ' + cx1 + ' ' + cy1 + ' ' + cx2 + ' ' + cy2 + ' ' + b.x + ' ' + b.y;
  }
  function bezierMid(a, b){ return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 6 }; }
  function inverseSide(s){
    return { left:'right', right:'left', top:'bottom', bottom:'top' }[s] || 'left';
  }

  // ---------- Pan & zoom ----------
  function applyViewTransform(){
    if (!ui.nodes) return;
    var t = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.scale + ')';
    ui.nodes.style.transform = t;
    if (ui.edges) ui.edges.style.transform = t;
    var ind = document.getElementById('cz-pct');
    if (ind) ind.textContent = Math.round(view.scale * 100) + '%';
  }

  function bindCanvas(){
    var c = ui.canvas;
    c.addEventListener('mousedown', function(ev){
      // Don't pan/deselect when clicking on an edge (path or hit zone) or its label/delete button
      if (ev.target.closest('.cm-edge,.cm-edge-hit,.cm-edge-label,.cm-edge-del')) return;
      var onCanvas = (ev.target === c) || ev.target.closest('#carte-edges') || ev.target.closest('#carte-empty');
      if (!onCanvas) return;
      // Stop toute inertie en cours quand on re-clique → on attrape la carte sec
      stopAnim();
      ui.panStart = { mx: ev.clientX, my: ev.clientY, vx: view.x, vy: view.y };
      panSamples = [{ x: ev.clientX, y: ev.clientY, t: performance.now() }];
      c.classList.add('panning');
      ui.selected = null;
      // Close any open color picker
      ui.nodes.querySelectorAll('.cm-node.colors-open').forEach(function(el){ el.classList.remove('colors-open'); });
      renderNodes(); renderEdges();
    });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    c.addEventListener('wheel', function(ev){
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      // Smooth multiplicative zoom proportional to wheel delta.
      // deltaMode: 0 = pixel, 1 = line, 2 = page — normalize roughly to pixels.
      var dy = ev.deltaY;
      if (ev.deltaMode === 1) dy *= 16;
      else if (ev.deltaMode === 2) dy *= 100;
      // Cap per-event delta so a single big wheel tick doesn't overshoot.
      dy = Math.max(-60, Math.min(60, dy));
      var factor = Math.exp(-dy * 0.0035);
      var rect = c.getBoundingClientRect();
      var mx = ev.clientX - rect.left;
      var my = ev.clientY - rect.top;
      var newScale = clamp(view.scale * factor, 0.3, 2.5);
      var ratio = newScale / view.scale;
      view.x = mx - (mx - view.x) * ratio;
      view.y = my - (my - view.y) * ratio;
      view.scale = newScale;
      applyViewTransform();
    }, { passive: false });
    c.addEventListener('dblclick', function(ev){
      var onCanvas = (ev.target === c) || ev.target.closest('#carte-empty');
      if (!onCanvas) return;
      var rect = c.getBoundingClientRect();
      var x = (ev.clientX - rect.left - view.x) / view.scale;
      var y = (ev.clientY - rect.top - view.y) / view.scale;
      addNodeAt(x - 70, y - 18, 'Nouveau node');
    });
  }

  function onMouseMove(ev){
    if (ui.panStart){
      // Smooth pan : on définit une CIBLE — la boucle rAF anime view.x/y vers cette cible
      anim.target = {
        x: ui.panStart.vx + (ev.clientX - ui.panStart.mx),
        y: ui.panStart.vy + (ev.clientY - ui.panStart.my)
      };
      // On garde un historique court pour calculer la vélocité au relâchement
      var nowT = performance.now();
      panSamples.push({ x: ev.clientX, y: ev.clientY, t: nowT });
      var cutoff = nowT - 80;
      while (panSamples.length > 2 && panSamples[0].t < cutoff) panSamples.shift();
      ensureAnim();
      return;
    }
    if (ui.nodeDrag){
      var n = findNode(ui.nodeDrag.id); if (!n) return;
      n.x = ui.nodeDrag.nx + (ev.clientX - ui.nodeDrag.sx) / view.scale;
      n.y = ui.nodeDrag.ny + (ev.clientY - ui.nodeDrag.sy) / view.scale;
      var el = ui.nodes.querySelector('.cm-node[data-id="' + n.id + '"]');
      if (el){ el.style.left = (n.x | 0) + 'px'; el.style.top = (n.y | 0) + 'px'; }
      renderEdges();
      return;
    }
    if (ui.nodeResize){
      var nr = findNode(ui.nodeResize.id); if (!nr) return;
      var dx = (ev.clientX - ui.nodeResize.sx) / view.scale;
      var dy = (ev.clientY - ui.nodeResize.sy) / view.scale;
      nr.w = clamp(ui.nodeResize.w + dx, 120, 540);
      nr.h = clamp(ui.nodeResize.h + dy, 40, 480);
      var rEl = ui.nodes.querySelector('.cm-node[data-id="' + nr.id + '"]');
      if (rEl){
        rEl.style.width = (nr.w | 0) + 'px';
        rEl.style.height = (nr.h | 0) + 'px';
      }
      renderEdges();
      return;
    }
    if (ui.edgeDrag){
      ui.edgeDrag.mouseX = ev.clientX;
      ui.edgeDrag.mouseY = ev.clientY;
      drawTempEdge();
    }
  }
  function onMouseUp(ev){
    if (ui.panStart){
      ui.panStart = null;
      ui.canvas.classList.remove('panning');
      // Vélocité = ratio (Δposition / Δtemps) sur la fenêtre récente, en px de l'ÉCRAN
      // → on pousse view.x/y dans la même direction (la transform applique le décalage écran)
      if (panSamples.length >= 2){
        var last = panSamples[panSamples.length - 1];
        var first = panSamples[0];
        var dt = (last.t - first.t) / 1000;
        if (dt > 0.012){
          var vx = (last.x - first.x) / dt;
          var vy = (last.y - first.y) / dt;
          // Plafond + seuil minimal pour éviter les micro-glissements parasites
          var spd = Math.hypot(vx, vy);
          if (spd > 80){
            var capped = Math.min(spd, 2400) / spd;
            anim.velocity = { vx: vx * capped, vy: vy * capped };
          }
        }
      }
      anim.target = null;
      panSamples = [];
      if (anim.velocity) ensureAnim();
    }
    if (ui.nodeDrag){
      var el = ui.nodes.querySelector('.cm-node[data-id="' + ui.nodeDrag.id + '"]');
      if (el) el.classList.remove('dragging');
      ui.nodeDrag = null;
      touchMap();
    }
    if (ui.nodeResize){
      ui.nodeResize = null;
      touchMap();
    }
    if (ui.edgeDrag){
      var target = document.elementFromPoint(ev.clientX, ev.clientY);
      var nodeEl = target ? target.closest('.cm-node') : null;
      if (nodeEl){
        var toId = nodeEl.getAttribute('data-id');
        if (toId !== ui.edgeDrag.fromId){
          var m = activeMap();
          var fromN = findNode(ui.edgeDrag.fromId);
          var toN = findNode(toId);
          var fromAnchor = fromN ? nodeAnchor(fromN, ui.edgeDrag.side) : null;
          var smartToSide = (fromAnchor && toN) ? pickClosestSide(fromAnchor, toN) : 'left';
          m.edges.push({
            id: uid(),
            from: ui.edgeDrag.fromId,
            fromSide: ui.edgeDrag.side,
            to: toId,
            toSide: smartToSide,
            label: '',
          });
          touchMap();
        }
      }
      ui.edgeDrag = null;
      ui.canvas.classList.remove('connecting');
      removeTempEdge();
      renderEdges();
    }
  }

  function startNodeDrag(id, ev){
    var n = findNode(id); if (!n) return;
    ui.nodeDrag = { id: id, sx: ev.clientX, sy: ev.clientY, nx: n.x, ny: n.y };
    var el = ui.nodes.querySelector('.cm-node[data-id="' + id + '"]');
    if (el) el.classList.add('dragging');
  }
  function startNodeResize(id, ev){
    var n = findNode(id); if (!n) return;
    var el = ui.nodes.querySelector('.cm-node[data-id="' + id + '"]');
    var w = n.w || (el ? el.offsetWidth : 200);
    var h = n.h || (el ? el.offsetHeight : 60);
    ui.nodeResize = { id: id, sx: ev.clientX, sy: ev.clientY, w: w, h: h };
  }
  function startEdgeDrag(fromId, side, ev){
    ui.edgeDrag = { fromId: fromId, side: side, mouseX: ev.clientX, mouseY: ev.clientY };
    ui.canvas.classList.add('connecting');
    drawTempEdge();
  }
  function drawTempEdge(){
    if (!ui.edgeDrag) return;
    var n = findNode(ui.edgeDrag.fromId); if (!n) return;
    var rect = ui.canvas.getBoundingClientRect();
    var mx = (ui.edgeDrag.mouseX - rect.left - view.x) / view.scale;
    var my = (ui.edgeDrag.mouseY - rect.top - view.y) / view.scale;
    // Anchor point follows the cursor direction continuously
    var a = perimeterAnchor(n, mx, my);
    var b = { x: mx, y: my, nx: -a.nx, ny: -a.ny };
    var d = bezierPath(a, b);
    var existing = ui.edges.querySelector('.cm-edge-tmp');
    if (existing){ existing.setAttribute('d', d); return; }
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('class', 'cm-edge-tmp');
    p.setAttribute('d', d);
    ui.edges.appendChild(p);
  }
  function removeTempEdge(){
    var t = ui.edges.querySelector('.cm-edge-tmp');
    if (t) t.remove();
  }

  // ---------- Keyboard ----------
  function bindKeyboard(){
    document.addEventListener('keydown', function(ev){
      if (!document.body.classList.contains('carte-mode')) return;
      var inField = ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA' || ev.target.isContentEditable;
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && ui.selected && !inField){
        ev.preventDefault();
        deleteSelected();
      } else if (ev.key === 'Escape'){
        if (ui.selected){
          ui.selected = null;
          renderNodes(); renderEdges();
        }
      }
    });
  }

  function deleteSelected(){
    if (!ui.selected) return;
    var m = activeMap(); if (!m) return;
    if (ui.selected.type === 'node'){
      m.nodes = m.nodes.filter(function(n){ return n.id !== ui.selected.id; });
      m.edges = m.edges.filter(function(e){ return e.from !== ui.selected.id && e.to !== ui.selected.id; });
    } else if (ui.selected.type === 'edge'){
      m.edges = m.edges.filter(function(e){ return e.id !== ui.selected.id; });
    }
    ui.selected = null;
    touchMap();
    renderNodes(); renderEdges();
  }

  // ---------- Drag-drop from external sources ----------
  function bindDragDrop(){
    var c = ui.canvas;
    c.addEventListener('dragover', function(ev){
      var t = ev.dataTransfer && ev.dataTransfer.types;
      var ok = false;
      if (t){
        for (var i = 0; i < t.length; i++){
          if (t[i] === 'application/x-juridix-result' || t[i] === 'text/plain'){ ok = true; break; }
        }
      }
      if (ok){ ev.preventDefault(); c.classList.add('drop-target'); }
    });
    c.addEventListener('dragleave', function(ev){
      if (ev.target === c) c.classList.remove('drop-target');
    });
    c.addEventListener('drop', function(ev){
      ev.preventDefault();
      c.classList.remove('drop-target');
      var raw = ev.dataTransfer.getData('application/x-juridix-result')
            || ev.dataTransfer.getData('text/plain');
      if (!raw) return;
      var rect = c.getBoundingClientRect();
      var x = (ev.clientX - rect.left - view.x) / view.scale;
      var y = (ev.clientY - rect.top - view.y) / view.scale;
      try {
        var data = JSON.parse(raw);
        addRefNode(x - 80, y - 24, data);
      } catch(e){
        addNodeAt(x - 70, y - 18, raw.slice(0, 80));
      }
    });

    // Make external sources draggable on hover
    document.addEventListener('mouseover', function(ev){
      if (!ev.target || !ev.target.closest) return;

      // Search results
      var resultItem = ev.target.closest('#results-list .result-item');
      if (resultItem && !resultItem.hasAttribute('draggable')){
        resultItem.setAttribute('draggable', 'true');
        resultItem.addEventListener('dragstart', function(de){
          var titleEl = resultItem.querySelector('.ri-title') || resultItem.querySelector('.r-title') || resultItem;
          var snippetEl = resultItem.querySelector('.ri-snippet') || resultItem.querySelector('.r-snippet');
          var payload = {
            id: resultItem.getAttribute('data-id') || '',
            type: 'ref',
            kind: resultItem.getAttribute('data-kind') || (resultItem.classList.contains('juris') ? 'jurisprudence' : 'article'),
            title: (titleEl.textContent || '').trim().slice(0, 140),
            body: snippetEl ? snippetEl.textContent.trim().slice(0, 400) : '',
            ref: resultItem.getAttribute('data-id') || '',
            codeLabel: resultItem.getAttribute('data-code') || '',
            date: resultItem.getAttribute('data-date') || '',
          };
          de.dataTransfer.setData('application/x-juridix-result', JSON.stringify(payload));
          de.dataTransfer.setData('text/plain', payload.title);
          de.dataTransfer.effectAllowed = 'copy';
        });
      }

      // Studio notes (sidebar chips)
      var noteChip = ev.target.closest('.note-chip');
      if (noteChip && !noteChip.hasAttribute('data-cm-drag')){
        noteChip.setAttribute('data-cm-drag', '1');
        noteChip.setAttribute('draggable', 'true');
        noteChip.addEventListener('dragstart', function(de){
          // Find the index by matching with window._notes
          var titleEl = noteChip.querySelector('.nc-title');
          var dateEl  = noteChip.querySelector('.nc-date');
          var title = titleEl ? titleEl.textContent.trim() : 'Note';
          // Try to retrieve body from window._notes by title match
          var body = '';
          try {
            var notes = window._notes || [];
            for (var i = 0; i < notes.length; i++){
              if ((notes[i].title || '') === title){ body = (notes[i].body || ''); break; }
            }
          } catch(e){}
          var payload = {
            type: 'ref', kind: 'note',
            title: title.slice(0, 140),
            body: body.slice(0, 600),
            ref: '', codeLabel: '',
            date: dateEl ? dateEl.textContent.trim() : '',
          };
          de.dataTransfer.setData('application/x-juridix-result', JSON.stringify(payload));
          de.dataTransfer.setData('text/plain', payload.title);
          de.dataTransfer.effectAllowed = 'copy';
        });
      }

      // Fiches cards
      var ficheCard = ev.target.closest('.fiche-card');
      if (ficheCard && !ficheCard.hasAttribute('data-cm-drag')){
        ficheCard.setAttribute('data-cm-drag', '1');
        ficheCard.setAttribute('draggable', 'true');
        ficheCard.addEventListener('dragstart', function(de){
          var titleEl = ficheCard.querySelector('.fc-title');
          var matEl   = ficheCard.querySelector('.fc-mat');
          var title = titleEl ? titleEl.textContent.trim() : 'Fiche';
          var mat   = matEl ? matEl.textContent.trim() : '';
          // Try to extract id from the onclick attribute
          var oc = ficheCard.getAttribute('onclick') || '';
          var idMatch = oc.match(/openFiche\(['"]([^'"]+)['"]/);
          var id = idMatch ? idMatch[1] : '';
          var body = '';
          try {
            var f = findFicheById(id);
            if (f) body = ficheBodyText(f);
          } catch(e){}
          var payload = {
            type: 'ref', kind: 'fiche',
            title: title.slice(0, 140),
            body: body.slice(0, 4000),
            ref: id, codeLabel: mat,
          };
          de.dataTransfer.setData('application/x-juridix-result', JSON.stringify(payload));
          de.dataTransfer.setData('text/plain', payload.title);
          de.dataTransfer.effectAllowed = 'copy';
        });
      }
    });
  }

  // ---------- Resizer ----------
  function bindResizer(){
    var r = document.getElementById('carte-resizer');
    if (!r) return;
    r.addEventListener('mousedown', function(ev){
      var sidebar = document.getElementById('carte-sidebar');
      var startX = ev.clientX;
      var startW = sidebar.offsetWidth;
      r.classList.add('dragging');
      function mm(e){
        var w = clamp(startW + (e.clientX - startX), 160, 380);
        sidebar.style.flex = '0 0 ' + w + 'px';
      }
      function mu(){
        document.removeEventListener('mousemove', mm);
        document.removeEventListener('mouseup', mu);
        r.classList.remove('dragging');
      }
      document.addEventListener('mousemove', mm);
      document.addEventListener('mouseup', mu);
    });
  }

  // ---------- Public ops ----------
  function addNodeAt(x, y, title){
    var m = ensureMap();
    m.nodes.push({ id: uid(), type: 'text', x: x, y: y, title: title || 'Nouveau node' });
    touchMap();
    renderNodes(); renderEdges();
    var emp = document.getElementById('carte-empty'); if (emp) emp.style.display = 'none';
  }
  function addRefNode(x, y, data){
    var m = ensureMap();
    var body = data.body || data.snippet || '';
    m.nodes.push({
      id: uid(), type: 'ref', x: x, y: y,
      title: data.title || data.ref || 'Référence',
      body: body,
      ref: data.ref || data.id || '',
      kind: data.kind || 'article',
      codeLabel: data.codeLabel || '',
      date: data.date || '',
    });
    touchMap();
    renderNodes(); renderEdges();
    var emp = document.getElementById('carte-empty'); if (emp) emp.style.display = 'none';
  }
  function addRefNodeAtCenter(data){
    if (!ui.canvas) return;
    var rect = ui.canvas.getBoundingClientRect();
    var x = (rect.width / 2 - view.x) / view.scale - 90;
    var y = (rect.height / 2 - view.y) / view.scale - 30;
    addRefNode(x, y, data);
  }
  function addTextNode(){
    if (!ui.canvas) return;
    var rect = ui.canvas.getBoundingClientRect();
    var x = (rect.width / 2 - view.x) / view.scale - 70;
    var y = (rect.height / 2 - view.y) / view.scale - 18;
    addNodeAt(x, y, 'Nouveau node');
  }

  function newCarte(){
    var m = newMapObj('Nouvelle carte');
    state.maps.unshift(m);
    state.active = m.id;
    save(); renderList(); renderActive();
    // Open inline rename on the new card immediately
    var newEl = document.querySelector('.carte-item[data-id="' + m.id + '"]');
    if (newEl) startInlineRename(newEl, m.id);
  }
  function startInlineRename(itemEl, id){
    var m = state.maps.find(function(x){ return x.id === id; });
    if (!m || !itemEl) return;
    var titleEl = itemEl.querySelector('.carte-item-title');
    if (!titleEl) return;
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'carte-item-rename-in';
    input.value = m.title || '';
    input.setAttribute('autocomplete', 'off');
    titleEl.replaceWith(input);
    input.focus(); input.select();
    var done = false;
    var commit = function(){
      if (done) return; done = true;
      m.title = input.value.trim() || 'Sans titre';
      touchMap(); renderList();
      // If renaming the active map, sync the top title input too
      if (state.active === id){
        var t = document.getElementById('carte-title-in');
        if (t) t.value = m.title;
      }
    };
    var cancel = function(){
      if (done) return; done = true;
      renderList();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function(ev){
      if (ev.key === 'Enter'){ ev.preventDefault(); input.blur(); }
      else if (ev.key === 'Escape'){ ev.preventDefault(); input.removeEventListener('blur', commit); cancel(); }
    });
    // Prevent the parent click from selecting the card while editing
    input.addEventListener('mousedown', function(ev){ ev.stopPropagation(); });
    input.addEventListener('click', function(ev){ ev.stopPropagation(); });
  }
  function renameActive(){
    var m = activeMap(); if (!m) return;
    var t = document.getElementById('carte-title-in');
    if (!t) return;
    m.title = t.value.trim() || 'Sans titre';
    touchMap();
    renderList();
  }
  function resetView(){
    view = { x: 0, y: 0, scale: 1 };
    applyViewTransform();
  }
  function zoomIn(){ view.scale = clamp(view.scale * 1.15, 0.3, 2.5); applyViewTransform(); }
  function zoomOut(){ view.scale = clamp(view.scale / 1.15, 0.3, 2.5); applyViewTransform(); }

  // ---------- Inject from outside (fiches grid, fiche detail, article reader, etc.) ----------
  // Generic injection : takes any node payload and adds it as a ref-node to the active carte.
  // payload : { title, body, ref, kind, codeLabel, date }
  function injectIntoCarte(payload, openAfter){
    if (!payload || !payload.title){ console.warn('carte: injectIntoCarte — payload invalide'); return false; }
    if (!ui.initialized) init();
    ensureMap();
    var clean = {
      type: 'ref',
      kind: payload.kind || 'article',
      title: payload.title,
      body: (payload.body || '').slice(0, 4000),
      ref: payload.ref || '',
      codeLabel: payload.codeLabel || '',
      date: payload.date || ''
    };
    var doInject = function(){
      if (ui.canvas && ui.canvas.getBoundingClientRect().width > 0){
        addRefNodeAtCenter(clean);
      } else {
        var m = activeMap();
        var x = 60 + (m.nodes.length % 6) * 30;
        var y = 60 + (m.nodes.length % 6) * 30;
        addRefNode(x, y, clean);
      }
    };
    if (openAfter !== false){
      open();
      setTimeout(doInject, 60);
    } else {
      doInject();
    }
    return true;
  }

  // Inject a fiche as a ref-node into the active carte.
  // If `openAfter` is true (default) the carte is opened to show the result.
  function injectFicheIntoCarte(id, openAfter){
    var f = findFicheById(id);
    if (!f){ console.warn('carte: injectFicheIntoCarte — fiche introuvable:', id); return false; }
    if (!ui.initialized) init();
    // S'assurer qu'une carte existe
    ensureMap();
    var payload = {
      type: 'ref',
      kind: 'fiche',
      title: f.titre || 'Fiche',
      body: ficheBodyText(f).slice(0, 4000),
      ref: f.id,
      codeLabel: f.mat || ''
    };
    var doInject = function(){
      // Si le canvas est masqué (carte-mode pas activé), fallback : position fixe en haut-gauche du dernier état
      if (ui.canvas && ui.canvas.getBoundingClientRect().width > 0){
        addRefNodeAtCenter(payload);
      } else {
        // canvas non visible — placer à proximité de l'origine de la map
        var m = activeMap();
        var x = 60 + (m.nodes.length % 6) * 30;
        var y = 60 + (m.nodes.length % 6) * 30;
        addRefNode(x, y, payload);
      }
    };
    if (openAfter !== false){
      open();
      // attendre un tick pour que le canvas ait des dimensions
      setTimeout(doInject, 60);
    } else {
      doInject();
    }
    return true;
  }

  // ---------- Expose ----------
  window.openCarte    = open;
  window.exitCarte    = exit;
  window.closeCarte   = exit;
  window.newCarte     = newCarte;
  window.renameCarte  = renameActive;
  window.addTextNode  = addTextNode;
  window.resetCarteView = resetView;
  window.zoomCarteIn  = zoomIn;
  window.zoomCarteOut = zoomOut;
  window.injectFicheIntoCarte = injectFicheIntoCarte;
  window.injectIntoCarte      = injectIntoCarte;

  // Patch switchTab so any other nav-icon click exits carte-mode
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', patchSwitchTab);
  } else {
    patchSwitchTab();
  }
  function patchSwitchTab(){
    if (typeof window.switchTab === 'function' && !window.switchTab._cartePatched){
      var orig = window.switchTab;
      window.switchTab = function(tab){
        if (document.body.classList.contains('carte-mode') && tab !== 'carte'){
          exit();
        }
        return orig.apply(this, arguments);
      };
      window.switchTab._cartePatched = true;
    }
    load();
  }
})();
