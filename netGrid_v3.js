// netGrid_v7_killold_leftbottom.js
// 1) Aggressive cleanup: removes legacy netGrid scripts/canvases to stop terminalCanvas errors.
// 2) Installs a full autonomous net-grid HUD in LEFT-BOTTOM.
// 3) Interactive: nodes, drag/drop, snap, lock/unlock (Q/Й), auto-move, check/reset buttons.
// 4) Defensive: avoids terminalCanvas, handles duplicate loads, provides debug API.
// 5) Drop-in: include only this file. If old netGrid_xxx.js scripts are still present they will be removed.

(() => {
  'use strict';

  try {
    // ---------- UTILS ----------
    function tryRemove(node) {
      try { if (node && node.remove) node.remove(); } catch(e) {}
    }
    function isNetGridScript(srcOrId) {
      if (!srcOrId) return false;
      const s = String(srcOrId).toLowerCase();
      return s.includes('netgrid') || s.includes('net_grid') || s.includes('net-grid');
    }
    function log(...args){ try { console.info('[netGrid_v7]', ...args); } catch(e){} }
    function warn(...args){ try { console.warn('[netGrid_v7]', ...args); } catch(e){} }
    function err(...args){ try { console.error('[netGrid_v7]', ...args); } catch(e){} }

    // ---------- 0) KILL OLD SCRIPTS / CANVASES ----------
    // Remove script tags whose src or id contains "netgrid"
    (function killOldScriptsAndCanvases(){
      try {
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const s of scripts) {
          try {
            if (s.src && isNetGridScript(s.src)) {
              log('Removing old script (src):', s.src);
              tryRemove(s);
            } else if (s.id && isNetGridScript(s.id)) {
              log('Removing old script (id):', s.id);
              tryRemove(s);
            }
          } catch(e){}
        }
        // canvases or elements created by old scripts
        const possibleIds = ['netgrid', 'netGrid', 'netGrid_canvas', 'netGrid_restore_mapcanvas', 'netGridFull_canvas_overlay', 'netGrid_v6_leftbottom_canvas', 'netGrid_v3', 'terminalCanvas'];
        const allElems = Array.from(document.querySelectorAll('*'));
        for (const el of allElems) {
          try {
            const id = el.id || '';
            const cls = el.className || '';
            if (isNetGridScript(id) || isNetGridScript(cls)) {
              log('Removing old element:', el.tagName, id || cls);
              tryRemove(el);
            } else if (id && (id.toLowerCase().includes('netgrid') || id.toLowerCase().includes('net_grid') || id.toLowerCase().includes('net-grid'))) {
              log('Removing old element by id match:', id);
              tryRemove(el);
            }
          } catch(e){}
        }
      } catch(e){
        warn('killOldScriptsAndCanvases error', e);
      }
    })();

    // Additionally, try to null out known globals left by old scripts to avoid collisions
    try { if (window.netGrid) delete window.netGrid; } catch(e){}
    try { if (window.netGridRestore) delete window.netGridRestore; } catch(e){}
    try { if (window.__netGridFull) delete window.__netGridFull; } catch(e){}
    try { if (window.netGridV6Left) delete window.netGridV6Left; } catch(e){}
    try { if (window.netGrid_v6_leftbottom) delete window.netGrid_v6_leftbottom; } catch(e){}

    // ---------- CONFIG ----------
    const CSS_SIZE = 300;              // css px square HUD
    const MARGIN_CSS = 20;             // from left + bottom
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const CANVAS_Z = 3000;             // super-high z
    const UI_Z = CANVAS_Z + 1;
    const CELL_COUNT = 6;
    const INTER_COUNT = CELL_COUNT + 1;
    const NODE_COUNT = 10;
    const AUTONOMOUS_MOVE_COOLDOWN = 800;
    const HIT_RADIUS_BASE = 12;
    const COLOR = { r: 6, g: 160, b: 118 };

    // ---------- CLEAN PREVIOUS INSTANCE  ----------
    if (window.netGrid_v7 && typeof window.netGrid_v7.destroy === 'function') {
      try { window.netGrid_v7.destroy(); } catch(e) {}
    }
    // remove previous typical ids
    tryRemove(document.getElementById('netGrid_v7_left_canvas'));
    tryRemove(document.getElementById('netGrid_v7_controls'));

    // ---------- CREATE ROOT CANVAS ----------
    const canvasId = 'netGrid_v7_left_canvas';
    const existingCanvas = document.getElementById(canvasId);
    if (existingCanvas) tryRemove(existingCanvas);

    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    Object.assign(canvas.style, {
      position: 'fixed',
      left: `${MARGIN_CSS}px`,
      bottom: `${MARGIN_CSS}px`,
      width: `${CSS_SIZE}px`,
      height: `${CSS_SIZE}px`,
      pointerEvents: 'auto',
      zIndex: CANVAS_Z,
      borderRadius: '8px',
      boxShadow: '0 18px 40px rgba(0,0,0,0.9)',
      backgroundColor: 'rgba(0,10,6,0.18)',
      cursor: 'default',
      userSelect: 'none'
    });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: true });

    // ---------- SMALL UI: status + controls ----------
    const statusEl = document.createElement('div');
    statusEl.id = 'netGrid_v7_status';
    Object.assign(statusEl.style, {
      position: 'fixed',
      left: `${MARGIN_CSS + CSS_SIZE + 12}px`,
      bottom: `${MARGIN_CSS + 6}px`,
      fontFamily: 'Courier, monospace',
      fontSize: '13px',
      color: `rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 1)`,
      zIndex: UI_Z,
      pointerEvents: 'none',
      userSelect: 'none',
      fontWeight: '700',
      textShadow: `0 0 8px rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 0.8)`
    });
    statusEl.textContent = 'TARGET: ---  |  Q/Й = lock/unlock';
    document.body.appendChild(statusEl);

    const controls = document.createElement('div');
    controls.id = 'netGrid_v7_controls';
    Object.assign(controls.style, {
      position: 'fixed',
      left: `${MARGIN_CSS}px`,
      bottom: `${MARGIN_CSS + CSS_SIZE + 12}px`,
      display: 'flex',
      gap: '8px',
      zIndex: UI_Z,
      alignItems: 'center',
      pointerEvents: 'auto'
    });
    document.body.appendChild(controls);

    const makeBtn = (text) => {
      const b = document.createElement('button');
      b.textContent = text;
      Object.assign(b.style, {
        padding: '8px 12px',
        borderRadius: '6px',
        border: `2px solid rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.95)`,
        background: 'rgba(0,0,0,0.4)',
        color: `rgba(${COLOR.r},${COLOR.g},${COLOR.b},1)`,
        fontFamily: 'Courier, monospace',
        cursor: 'pointer',
        fontWeight: '700'
      });
      return b;
    };

    const checkBtn = makeBtn('ПРОВЕРИТЬ ПРИКОЛ');
    const resetBtn = makeBtn('⟳');
    controls.appendChild(checkBtn);
    controls.appendChild(resetBtn);

    // ---------- STATE ----------
    let canvasW = 0, canvasH = 0;
    let gridPoints = [];
    let nodes = [];
    let raf = null;
    let lastTime = performance.now();
    let tick = 0;
    let selectedNode = null;
    let draggingNode = null;
    let victoryEl = null;
    let victoryShown = false;

    const HIT_RADIUS_PX = Math.round(HIT_RADIUS_BASE * DPR);

    // symbols (target patterns)
    const SYMBOLS = {
      V: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[6,0],[5,1],[4,2]],
      I: [[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3]],
      X: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[0,6],[1,5],[2,4],[4,2],[5,1],[6,0]]
    };
    const symbolNames = Object.keys(SYMBOLS);
    const currentTargetName = symbolNames[Math.floor(Math.random()*symbolNames.length)];
    const currentTarget = SYMBOLS[currentTargetName];
    statusEl.textContent = `TARGET: ${currentTargetName}  |  Q/Й = lock/unlock`;

    // ---------- HELPERS ----------
    function glowColor(a=1){ return `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${a})`; }
    function redColor(a=1){ return `rgba(255,60,60,${a})`; }
    function safeNum(n, fallback=0){ return (typeof n === 'number' && isFinite(n)) ? n : fallback; }
    function tryNow(){ try { return performance.now(); } catch(e){ return Date.now(); } }

    // ---------- GRID BUILD ----------
    function setCanvasSize() {
      const rect = canvas.getBoundingClientRect();
      const cssW = Math.max(40, rect.width);
      const cssH = Math.max(40, rect.height);
      canvas.width = Math.max(120, Math.floor(cssW * DPR));
      canvas.height = Math.max(120, Math.floor(cssH * DPR));
      canvasW = canvas.width; canvasH = canvas.height;
    }

    function buildGrid() {
      gridPoints = [];
      const margin = Math.round(12 * DPR);
      const innerW = canvasW - margin*2;
      const innerH = canvasH - margin*2;
      for (let r=0; r<INTER_COUNT; r++){
        const row = [];
        for (let c=0; c<INTER_COUNT; c++){
          const x = margin + Math.round((c / CELL_COUNT) * innerW);
          const y = margin + Math.round((r / CELL_COUNT) * innerH);
          row.push({ x, y });
        }
        gridPoints.push(row);
      }
    }

    // ---------- NODES ----------
    function respawnNodes() {
      nodes = [];
      const positions = [];
      for (let r=0;r<INTER_COUNT;r++){
        for (let c=0;c<INTER_COUNT;c++) positions.push([r,c]);
      }
      // Fisher-Yates shuffle
      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }
      const chosen = positions.slice(0, NODE_COUNT);
      nodes = chosen.map((rc, idx) => {
        const [r,c] = rc;
        const p = gridPoints[r][c];
        return {
          id: idx,
          gx: c, gy: r,
          x: p.x, y: p.y,
          targetGx: c, targetGy: r,
          speed: 0.002 + Math.random()*0.004,
          locked: false,
          lastMoveAt: tryNow() - Math.random()*1000,
          drag: false,
          selected: false
        };
      });
      selectedNode = null; draggingNode = null;
      victoryShown = false;
      if (victoryEl) victoryEl.style.display = 'none';
    }

    function nearestIntersection(px, py) {
      let best = { r:0, c:0, d: Infinity };
      for (let r=0;r<INTER_COUNT;r++){
        for (let c=0;c<INTER_COUNT;c++){
          const p = gridPoints[r][c];
          const d = Math.hypot(px - p.x, py - p.y);
          if (d < best.d) { best = { r, c, d }; }
        }
      }
      return { row: best.r, col: best.c, dist: best.d };
    }

    function pickNeighbor(gx, gy) {
      const candidates = [];
      if (gy > 0) candidates.push({gx,gy:gy-1});
      if (gy < INTER_COUNT-1) candidates.push({gx,gy:gy+1});
      if (gx > 0) candidates.push({gx:gx-1,gy});
      if (gx < INTER_COUNT-1) candidates.push({gx:gx+1,gy});
      if (candidates.length === 0) return {gx,gy};
      return candidates[Math.floor(Math.random()*candidates.length)];
    }

    // ---------- MAPPING client -> canvas ----------
    function clientToCanvas(ev){
      const rect = canvas.getBoundingClientRect();
      const rawX = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const rawY = (ev.clientY - rect.top) * (canvas.height / rect.height);
      return { x: Math.round(rawX), y: Math.round(rawY) };
    }

    // ---------- POINTER HANDLERS ----------
    function pointerDown(ev) {
      try {
        if (ev.button !== 0) return;
        const m = clientToCanvas(ev);
        let found = null;
        for (let i = nodes.length - 1; i >= 0; i--) {
          const n = nodes[i];
          const d = Math.hypot(m.x - n.x, m.y - n.y);
          if (d < HIT_RADIUS_PX) { found = n; break; }
        }
        if (found) {
          if (found.locked) {
            if (selectedNode && selectedNode !== found) selectedNode.selected = false;
            selectedNode = found; selectedNode.selected = true;
            return;
          }
          draggingNode = found; draggingNode.drag = true;
          if (selectedNode && selectedNode !== found) selectedNode.selected = false;
          selectedNode = found; selectedNode.selected = true;
          ev.preventDefault();
        } else {
          if (selectedNode) { selectedNode.selected = false; selectedNode = null; }
        }
      } catch(e){ warn('pointerDown err', e); }
    }

    let lastPointerTime = 0;
    function pointerMove(ev) {
      try {
        const now = performance.now();
        if (now - lastPointerTime < 8) return;
        lastPointerTime = now;
        const m = clientToCanvas(ev);
        let hovered = null;
        for (const n of nodes) {
          if (Math.hypot(m.x - n.x, m.y - n.y) < HIT_RADIUS_PX) { hovered = n; break; }
        }
        canvas.style.cursor = hovered ? (hovered.locked ? 'not-allowed' : 'pointer') : 'default';
        if (draggingNode && draggingNode.locked) {
          draggingNode.drag = false; draggingNode = null;
        }
        if (draggingNode) {
          const nearest = nearestIntersection(m.x, m.y);
          draggingNode.gx = nearest.col; draggingNode.gy = nearest.row;
          draggingNode.targetGx = nearest.col; draggingNode.targetGy = nearest.row;
          const p = gridPoints[nearest.row][nearest.col];
          draggingNode.x = p.x; draggingNode.y = p.y;
          ev.preventDefault();
        }
      } catch(e){ warn('pointerMove err', e); }
    }

    function pointerUp(ev) {
      try {
        if (draggingNode) {
          const n = draggingNode;
          const nearest = nearestIntersection(n.x, n.y);
          n.gx = nearest.col; n.gy = nearest.row;
          const p = gridPoints[n.gy][n.gx];
          n.x = p.x; n.y = p.y;
          n.drag = false; draggingNode = null;
          ev.preventDefault();
        }
      } catch(e){ warn('pointerUp err', e); }
    }

    function keyDownHandler(ev) {
      try {
        if (!ev.key) return;
        if (ev.key.toLowerCase() === 'q' || ev.key.toLowerCase() === 'й') {
          const n = selectedNode || draggingNode;
          if (!n) return;
          const nearest = nearestIntersection(n.x, n.y);
          const occupied = nodes.some(o => o !== n && o.locked && o.gx === nearest.col && o.gy === nearest.row);
          if (occupied) {
            flashStatus('⚠ Место занято другим узлом');
            return;
          }
          n.gx = nearest.col; n.gy = nearest.row; n.targetGx = n.gx; n.targetGy = n.gy;
          n.locked = !n.locked; n.lastMoveAt = tryNow();
          if (n.locked) { const p = gridPoints[n.gy][n.gx]; n.x = p.x; n.y = p.y; }
          flashStatus(`Node ${n.id} ${n.locked ? 'locked' : 'unlocked'}`, 1200);
        }
      } catch(e){ warn('keyDownHandler err', e); }
    }

    let statusTimer = null;
    function flashStatus(text, timeout = 900) {
      statusEl.textContent = text;
      if (statusTimer) clearTimeout(statusTimer);
      statusTimer = setTimeout(()=> statusEl.textContent = `TARGET: ${currentTargetName}  |  Q/Й = lock/unlock`, timeout);
    }

    // ---------- UPDATE & DRAW ----------
    function update(dt) {
      tick++;
      const now = performance.now();
      for (const n of nodes) {
        if (n.drag) continue;
        if (n.locked) {
          const pLock = gridPoints[n.gy][n.gx];
          n.x = pLock.x; n.y = pLock.y;
          n.targetGx = n.gx; n.targetGy = n.gy;
          continue;
        }
        const targetP = gridPoints[n.targetGy][n.targetGx];
        const dist = Math.hypot(n.x - targetP.x, n.y - targetP.y);
        if (dist < 1.4 * DPR) {
          n.gx = n.targetGx; n.gy = n.targetGy;
          if (now - n.lastMoveAt > AUTONOMOUS_MOVE_COOLDOWN + Math.random()*1200) {
            const nb = pickNeighbor(n.gx, n.gy);
            n.targetGx = nb.gx; n.targetGy = nb.gy; n.lastMoveAt = now;
          }
        } else {
          const p = targetP;
          const t = Math.min(1, n.speed * (dt/16) * (1 + Math.random()*0.6));
          n.x += (p.x - n.x) * t; n.y += (p.y - n.y) * t;
        }
      }
    }

    function draw() {
      // clear
      ctx.clearRect(0,0,canvas.width, canvas.height);

      ctx.save();
      // rounded background
      const r = 8 * DPR;
      roundRect(ctx, 0, 0, canvas.width, canvas.height, r);
      ctx.fillStyle = 'rgba(2,18,12,0.92)';
      ctx.fill();

      // vignette
      const vig = ctx.createRadialGradient(canvas.width/2, canvas.height/2, Math.min(canvas.width,canvas.height)*0.06, canvas.width/2, canvas.height/2, Math.max(canvas.width,canvas.height)*0.9);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.14)');
      ctx.fillStyle = vig; ctx.fillRect(0,0,canvas.width, canvas.height);

      // grid lines
      ctx.strokeStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.12)`;
      ctx.lineWidth = Math.max(1, Math.round(1 * DPR));
      ctx.beginPath();
      for (let i=0;i<=CELL_COUNT;i++){
        const x = gridPoints[0][0].x + Math.round((i/CELL_COUNT)*(gridPoints[0][CELL_COUNT].x - gridPoints[0][0].x));
        ctx.moveTo(x, gridPoints[0][0].y);
        ctx.lineTo(x, gridPoints[INTER_COUNT-1][0].y);
      }
      for (let j=0;j<=CELL_COUNT;j++){
        const y = gridPoints[0][0].y + Math.round((j/CELL_COUNT)*(gridPoints[INTER_COUNT-1][0].y - gridPoints[0][0].y));
        ctx.moveTo(gridPoints[0][0].x, y);
        ctx.lineTo(gridPoints[0][INTER_COUNT-1].x, y);
      }
      ctx.stroke();

      // connections
      ctx.lineCap = 'round';
      for (let i=0;i<nodes.length;i++){
        for (let j=i+1;j<nodes.length;j++){
          const A = nodes[i], B = nodes[j];
          const d = Math.hypot(A.x - B.x, A.y - B.y);
          if (d < (canvas.width * 0.32)) {
            const baseAlpha = Math.max(0.10, 0.32 - (d / (canvas.width*0.9)) * 0.22);
            const grad = ctx.createLinearGradient(A.x, A.y, B.x, B.y);
            grad.addColorStop(0, glowColor(baseAlpha));
            grad.addColorStop(1, glowColor(baseAlpha * 0.45));
            ctx.strokeStyle = grad;
            ctx.lineWidth = Math.max(1, Math.round(1 * DPR));
            ctx.beginPath();
            ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
          }
        }
      }

      // nodes
      for (const n of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin((n.id + tick*0.02) * 1.2);
        const intensity = n.selected ? 1.4 : (n.locked ? 1.2 : 1.0);
        const glowR = (6 * DPR + pulse*3*DPR) * intensity;
        const c = n.locked ? `rgba(255,60,60,${0.36 * intensity})` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.36 * intensity})`;
        const c2 = n.locked ? `rgba(255,60,60,${0.12 * intensity})` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.12 * intensity})`;
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
        grd.addColorStop(0, c); grd.addColorStop(0.6, c2); grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd; ctx.fillRect(n.x - glowR, n.y - glowR, glowR*2, glowR*2);

        ctx.beginPath();
        const coreR = 2.2 * DPR + (n.selected ? 1.6*DPR : 0);
        ctx.fillStyle = n.locked ? redColor(1) : glowColor(1);
        ctx.arc(n.x, n.y, coreR, 0, Math.PI*2); ctx.fill();

        ctx.beginPath();
        ctx.lineWidth = Math.max(1, Math.round(1 * DPR));
        ctx.strokeStyle = n.locked ? redColor(0.92) : glowColor(0.92);
        ctx.arc(n.x, n.y, coreR + 1.2*DPR, 0, Math.PI*2); ctx.stroke();
      }

      // label
      ctx.save();
      ctx.font = `${10 * DPR}px monospace`;
      ctx.fillStyle = glowColor(0.95);
      ctx.textAlign = 'right';
      ctx.fillText('VIGIL NET', canvas.width - 8*DPR, 12*DPR);
      ctx.restore();

      ctx.restore();
    }

    function roundRect(cn, x, y, w, h, r) {
      cn.beginPath();
      cn.moveTo(x + r, y);
      cn.arcTo(x + w, y, x + w, y + h, r);
      cn.arcTo(x + w, y + h, x, y + h, r);
      cn.arcTo(x, y + h, x, y, r);
      cn.arcTo(x, y, x + w, y, r);
      cn.closePath();
    }

    // ---------- MAIN LOOP ----------
    function loop(ms) {
      const now = ms || performance.now();
      const dt = Math.max(1, now - lastTime);
      lastTime = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }

    // ---------- VICTORY CHECK ----------
    function checkVictory() {
      const set = new Set(nodes.map(n => `${n.gy},${n.gx}`));
      const allPresent = currentTarget.every(([r,c]) => set.has(`${r},${c}`));
      if (allPresent && !victoryShown) {
        victoryShown = true;
        if (!victoryEl) {
          victoryEl = document.createElement('div');
          Object.assign(victoryEl.style, {
            position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            color: `rgba(${COLOR.r},${COLOR.g},${COLOR.b},1)`, fontSize: '36px', fontWeight: '900',
            zIndex: UI_Z + 2, pointerEvents: 'none', padding: '10px 20px', borderRadius: '8px',
            background: 'rgba(0,0,0,0.45)', textShadow: `0 0 18px rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.85)`
          });
          victoryEl.textContent = 'Ура, победил!';
          document.body.appendChild(victoryEl);
        } else {
          victoryEl.style.display = 'block';
        }
      }
      return allPresent;
    }

    // ---------- CONTROLS ----------
    checkBtn.addEventListener('click', () => {
      const ok = checkVictory();
      if (!ok) flashStatus('TARGET: ПРИКОЛ НЕ СОБРАН', 1200);
      else flashStatus('TARGET: СОБРАН — ВЫЙГРАЛ', 1200);
    });
    resetBtn.addEventListener('click', () => {
      for (const n of nodes) { n.locked = false; n.selected = false; n.drag = false; }
      respawnNodes();
    });

    // ---------- EVENTS ----------
    canvas.addEventListener('pointerdown', pointerDown, { passive: false });
    window.addEventListener('pointermove', pointerMove, { passive: false });
    window.addEventListener('pointerup', pointerUp, { passive: false });
    window.addEventListener('keydown', keyDownHandler, { passive: false });

    // ---------- INIT ----------
    function init() {
      setCanvasSize();
      buildGrid();
      respawnNodes();
      if (raf) cancelAnimationFrame(raf);
      lastTime = performance.now();
      raf = requestAnimationFrame(loop);
    }

    // resize handler to re-snap
    let resizeTimer = null;
    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(()=>{
        setCanvasSize();
        buildGrid();
        for (const n of nodes) {
          const nearest = nearestIntersection(n.x, n.y);
          const p = gridPoints[nearest.row][nearest.col];
          n.gx = nearest.col; n.gy = nearest.row; n.x = p.x; n.y = p.y;
          n.targetGx = n.gx; n.targetGy = n.gy;
        }
      }, 80);
    }
    window.addEventListener('resize', onResize);

    // ---------- DEBUG API & DESTROY ----------
    window.netGrid_v7 = {
      canvas, ctx, nodes, gridPoints,
      debug: function(){
        return {
          canvasSize: { w: canvas.width, h: canvas.height, cssW: canvas.clientWidth, cssH: canvas.clientHeight },
          nodesCount: nodes.length,
          selected: selectedNode ? selectedNode.id : null,
          dragging: draggingNode ? draggingNode.id : null,
          target: currentTargetName
        };
      },
      forceRespawn: respawnNodes,
      destroy: function(){
        try {
          if (raf) cancelAnimationFrame(raf);
          canvas.remove();
          controls.remove();
          statusEl.remove();
          if (victoryEl) victoryEl.remove();
          delete window.netGrid_v7;
        } catch(e){ warn('destroy fail', e); }
      }
    };

    init();
    log('netGrid_v7 loaded — left-bottom autonomous HUD active. Old netGrid scripts (if any) were removed.');

  } catch (e) {
    try { console.error('[netGrid_v7] fatal error', e); } catch(_) {}
  }
})();
