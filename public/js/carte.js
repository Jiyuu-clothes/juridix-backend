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
    initialized: false,
  };

  // ---------- Utils ----------
  function uid(){ return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function now(){ return new Date().toISOString(); }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

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
    // Sync top-tabs (.ttab) — used in hub-mode
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
    load();
    ui.initialized = true;
  }

  // ---------- Render: maps list ----------
  function renderList(){
    var box = document.getElementById('carte-list');
    if (!box) return;
    if (state.maps.length === 0){
      box.innerHTML = '<div class="carte-empty-list">Aucune carte. Clique « + » pour en créer une.</div>';
      return;
    }
    box.innerHTML = state.maps.map(function(m){
      var on = m.id === state.active ? ' on' : '';
      return '<div class="carte-item' + on + '" data-id="' + esc(m.id) + '">'
        +   '<span class="carte-item-title">' + esc(m.title || '(sans titre)') + '</span>'
        +   '<button class="carte-item-del" data-action="del" title="Supprimer">🗑</button>'
        + '</div>';
    }).join('');
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
        state.active = id;
        save(); renderList(); renderActive();
      });
    });
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

  function nodeHtml(n){
    var color = n.color ? ' data-color="' + esc(n.color) + '"' : '';
    var inner = '';
    if (n.type === 'ref'){
      var eyebrow = n.kind === 'jurisprudence'
        ? '⚖ ' + (n.date || 'Jurisprudence')
        : '📚 ' + (n.codeLabel || 'Article');
      inner = '<div class="cm-node-eyebrow">' + esc(eyebrow.trim()) + '</div>'
        + '<div class="cm-node-title">' + esc(n.title || '') + '</div>'
        + (n.snippet ? '<div class="cm-node-snippet">' + esc(n.snippet) + '</div>' : '');
    } else {
      inner = '<div class="cm-node-title">' + esc(n.title || 'Sans titre') + '</div>';
    }
    var sel = (ui.selected && ui.selected.type === 'node' && ui.selected.id === n.id) ? ' selected' : '';
    return '<div class="cm-node' + sel + '" data-id="' + esc(n.id) + '" data-type="' + esc(n.type || 'text') + '"' + color
      + ' style="left:' + (n.x | 0) + 'px;top:' + (n.y | 0) + 'px">'
      +   inner
      +   '<div class="cm-node-colors">'
      +     '<div class="cm-color-dot" data-c="default" title="Défaut"></div>'
      +     '<div class="cm-color-dot" data-c="cyan" title="Cyan"></div>'
      +     '<div class="cm-color-dot" data-c="green" title="Vert"></div>'
      +     '<div class="cm-color-dot" data-c="gold" title="Or"></div>'
      +     '<div class="cm-color-dot" data-c="red" title="Rouge"></div>'
      +   '</div>'
      +   '<div class="cm-handle" data-side="top"></div>'
      +   '<div class="cm-handle" data-side="right"></div>'
      +   '<div class="cm-handle" data-side="bottom"></div>'
      +   '<div class="cm-handle" data-side="left"></div>'
      + '</div>';
  }

  function bindNode(id){
    var el = ui.nodes.querySelector('.cm-node[data-id="' + id + '"]');
    if (!el) return;
    var n = findNode(id); if (!n) return;
    el.addEventListener('mousedown', function(ev){
      if (ev.target.classList.contains('cm-handle')){
        startEdgeDrag(id, ev.target.getAttribute('data-side'), ev);
        ev.stopPropagation(); ev.preventDefault();
        return;
      }
      if (ev.target.classList.contains('cm-color-dot')){
        var c = ev.target.getAttribute('data-c');
        n.color = (c === 'default' ? null : c);
        touchMap(); renderNodes();
        ev.stopPropagation(); return;
      }
      startNodeDrag(id, ev);
      ui.selected = { type: 'node', id: id };
      renderNodes(); renderEdges();
      ev.stopPropagation();
    });
    el.addEventListener('dblclick', function(ev){
      if (n.type === 'ref'){ openRef(n); return; }
      startEditNode(id, el);
      ev.stopPropagation();
    });
  }

  function startEditNode(id, el){
    var n = findNode(id); if (!n) return;
    var t = el.querySelector('.cm-node-title');
    if (!t) return;
    var ta = document.createElement('textarea');
    ta.className = 'cm-node-edit';
    ta.value = n.title || '';
    t.replaceWith(ta);
    ta.focus(); ta.select();
    var commit = function(){
      n.title = ta.value.trim() || 'Sans titre';
      touchMap(); renderNodes();
    };
    ta.addEventListener('blur', commit);
    ta.addEventListener('keydown', function(ev){
      if (ev.key === 'Escape'){ ta.value = n.title; ta.blur(); }
      else if (ev.key === 'Enter' && !ev.shiftKey){ ev.preventDefault(); ta.blur(); }
    });
  }

  function openRef(n){
    if (!n.ref) return;
    if (n.kind === 'jurisprudence'){
      if (typeof window.openJuris === 'function') window.openJuris(n.ref);
      else if (typeof window.openArticle === 'function') window.openArticle(n.ref);
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
      var pa = nodeAnchor(a, e.fromSide || 'right');
      var pb = nodeAnchor(b, e.toSide || 'left');
      var path = bezierPath(pa, pb);
      var sel = (ui.selected && ui.selected.type === 'edge' && ui.selected.id === e.id) ? ' selected' : '';
      html += '<path class="cm-edge' + sel + '" d="' + path + '" data-id="' + esc(e.id) + '" marker-end="url(#cm-arrow)"></path>';
      if (e.label){
        var mid = bezierMid(pa, pb);
        html += '<text class="cm-edge-label" x="' + mid.x + '" y="' + mid.y + '" text-anchor="middle" data-id="' + esc(e.id) + '">' + esc(e.label) + '</text>';
      }
    });
    ui.edges.innerHTML = html;
    ui.edges.querySelectorAll('.cm-edge,.cm-edge-label').forEach(function(el){
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
  }

  function nodeAnchor(n, side){
    var el = ui.nodes && ui.nodes.querySelector('.cm-node[data-id="' + n.id + '"]');
    var w = el ? el.offsetWidth : 160;
    var h = el ? el.offsetHeight : 40;
    var cx = n.x + w / 2, cy = n.y + h / 2;
    if (side === 'right')  return { x: n.x + w, y: cy };
    if (side === 'left')   return { x: n.x,     y: cy };
    if (side === 'top')    return { x: cx,      y: n.y };
    if (side === 'bottom') return { x: cx,      y: n.y + h };
    return { x: cx, y: cy };
  }
  function bezierPath(a, b){
    var dx = b.x - a.x;
    var cx1 = a.x + dx * 0.5, cy1 = a.y;
    var cx2 = b.x - dx * 0.5, cy2 = b.y;
    return 'M ' + a.x + ' ' + a.y + ' C ' + cx1 + ' ' + cy1 + ' ' + cx2 + ' ' + cy2 + ' ' + b.x + ' ' + b.y;
  }
  function bezierMid(a, b){ return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 6 }; }

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
      var onCanvas = (ev.target === c) || ev.target.closest('#carte-edges') || ev.target.closest('#carte-empty');
      if (!onCanvas) return;
      ui.panStart = { mx: ev.clientX, my: ev.clientY, vx: view.x, vy: view.y };
      c.classList.add('panning');
      ui.selected = null;
      renderNodes(); renderEdges();
    });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    c.addEventListener('wheel', function(ev){
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      var delta = ev.deltaY > 0 ? 0.9 : 1.1;
      var rect = c.getBoundingClientRect();
      var mx = ev.clientX - rect.left;
      var my = ev.clientY - rect.top;
      var newScale = clamp(view.scale * delta, 0.3, 2.5);
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
      view.x = ui.panStart.vx + (ev.clientX - ui.panStart.mx);
      view.y = ui.panStart.vy + (ev.clientY - ui.panStart.my);
      applyViewTransform();
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
    }
    if (ui.nodeDrag){
      var el = ui.nodes.querySelector('.cm-node[data-id="' + ui.nodeDrag.id + '"]');
      if (el) el.classList.remove('dragging');
      ui.nodeDrag = null;
      touchMap();
    }
    if (ui.edgeDrag){
      var target = document.elementFromPoint(ev.clientX, ev.clientY);
      var nodeEl = target ? target.closest('.cm-node') : null;
      if (nodeEl){
        var toId = nodeEl.getAttribute('data-id');
        if (toId !== ui.edgeDrag.fromId){
          var m = activeMap();
          m.edges.push({
            id: uid(),
            from: ui.edgeDrag.fromId,
            fromSide: ui.edgeDrag.side,
            to: toId,
            toSide: 'left',
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
  function startEdgeDrag(fromId, side, ev){
    ui.edgeDrag = { fromId: fromId, side: side, mouseX: ev.clientX, mouseY: ev.clientY };
    ui.canvas.classList.add('connecting');
    drawTempEdge();
  }
  function drawTempEdge(){
    if (!ui.edgeDrag) return;
    var n = findNode(ui.edgeDrag.fromId); if (!n) return;
    var a = nodeAnchor(n, ui.edgeDrag.side);
    var rect = ui.canvas.getBoundingClientRect();
    var b = {
      x: (ui.edgeDrag.mouseX - rect.left - view.x) / view.scale,
      y: (ui.edgeDrag.mouseY - rect.top - view.y) / view.scale,
    };
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

  // ---------- Drag-drop from search results ----------
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
    // Make search results draggable on hover
    document.addEventListener('mouseover', function(ev){
      var item = ev.target.closest && ev.target.closest('#results-list .result-item');
      if (item && !item.hasAttribute('draggable')){
        item.setAttribute('draggable', 'true');
        item.addEventListener('dragstart', function(de){
          var titleEl = item.querySelector('.ri-title') || item.querySelector('.r-title') || item;
          var snippetEl = item.querySelector('.ri-snippet') || item.querySelector('.r-snippet');
          var payload = {
            id: item.getAttribute('data-id') || '',
            type: 'ref',
            kind: item.getAttribute('data-kind') || (item.classList.contains('juris') ? 'jurisprudence' : 'article'),
            title: (titleEl.textContent || '').trim().slice(0, 140),
            snippet: snippetEl ? snippetEl.textContent.trim().slice(0, 200) : '',
            ref: item.getAttribute('data-id') || '',
            codeLabel: item.getAttribute('data-code') || '',
            date: item.getAttribute('data-date') || '',
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
    m.nodes.push({
      id: uid(), type: 'ref', x: x, y: y,
      title: data.title || data.ref || 'Référence',
      snippet: data.snippet || '',
      ref: data.ref || data.id || '',
      kind: data.kind || 'article',
      codeLabel: data.codeLabel || '',
      date: data.date || '',
    });
    touchMap();
    renderNodes(); renderEdges();
    var emp = document.getElementById('carte-empty'); if (emp) emp.style.display = 'none';
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
    var t = document.getElementById('carte-title-in');
    if (t) { t.focus(); t.select(); }
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

  // ---------- Expose ----------
  window.openCarte    = open;
  window.exitCarte    = exit;
  window.newCarte     = newCarte;
  window.renameCarte  = renameActive;
  window.addTextNode  = addTextNode;
  window.resetCarteView = resetView;
  window.zoomCarteIn  = zoomIn;
  window.zoomCarteOut = zoomOut;

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
