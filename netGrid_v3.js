// netGrid_v6_leftbottom.js
// Full, self-contained net grid — left-bottom HUD.
// - Autonomous: creates its own canvas in left-bottom, manages nodes, drag/drop, lock/unlock (Q/Й).
// - Uses direct client->canvas mapping (bounding rect -> device px).
// - Defensive: removes previous instances if present.
// - Debug API: window.netGridV6Left.debug(), .destroy(), .forceRespawn()

(() => {
  'use strict';
  try {
    // ---------- CLEANUP previous instances ----------
    if (window.netGridV6Left && typeof window.netGridV6Left.destroy === 'function') {
      try { window.netGridV6Left.destroy(); } catch (e) { /* ignore */ }
    }
    // remove any lingering canvas with our default id
    const existing = document.getElementById('netGrid_v6_leftbottom_canvas');
    if (existing) existing.remove();

    // ---------- CONFIG ----------
    const CSS_SIZE = 300;              // css px of the HUD square
    const MARGIN_CSS = 20;             // css px from left+bottom
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const CANVAS_Z = 2500;             // high z-index to be visible above overlays
    const UI_Z = CANVAS_Z + 1;
    const CELL_COUNT = 6;
    const INTER_COUNT = CELL_COUNT + 1;
    const NODE_COUNT = 10;
    const AUTONOMOUS_MOVE_COOLDOWN = 800;
    const HIT_RADIUS_PX = 12 * DPR;
    const COLOR = { r: 6, g: 160, b: 118 };

    // ---------- CREATE CANVAS ----------
    const canvas = document.createElement('canvas');
    canvas.id = 'netGrid_v6_leftbottom_canvas';
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
      cursor: 'default'
    });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: true });

    // ---------- UI: status + controls ----------
    const statusEl = document.createElement('div');
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
    Object.assign(controls.style, {
      position: 'fixed',
      left: `${MARGIN_CSS}px`,
      bottom: `${MARGIN_CSS + CSS_SIZE + 12}px`,
      display: 'flex',
      gap: '8px',
      zIndex: UI_Z,
      alignItems: 'center'
    });
    document.body.appendChild(controls);

    const checkBtn = document.createElement('button');
    checkBtn.textContent = 'ПРОВЕРИТЬ ПРИКОЛ';
    Object.assign(checkBtn.style, {
      padding: '8px 12px',
      borderRadius: '6px',
      border: `2px solid rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.95)`,
      background: 'rgba(0,0,0,0.4)',
      color: `rgba(${COLOR.r},${COLOR.g},${COLOR.b},1)`,
      fontFamily: 'Courier, monospace',
      cursor: 'pointer',
      fontWeight: '700'
    });
    controls.appendChild(checkBtn);

    const resetBtn = document.createElement('button');
    resetBtn.textContent = '⟳';
    Object.assign(resetBtn.style, {
      padding: '8px 10px',
      borderRadius: '6px',
      border: `2px solid rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.95)`,
      background: 'rgba(0,0,0,0.4)',
      color: `rgba(${COLOR.r},${COLOR.g},${COLOR.b},1)`,
      fontFamily: 'Courier, monospace',
      cursor: 'pointer',
      fontWeight: '700'
    });
    controls.appendChild(resetBtn);

    // ---------- STATE ----------
    let canvasW = 0, canvasH = 0;      // device pixels
    let gridPoints = [];
    let nodes = [];
    let raf = null;
    let lastTime = performance.now();
    let tick = 0;
    let selectedNode = null;
    let draggingNode = null;
    let victoryEl = null;
    let victoryShown = false;

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

    function respawnNodes() {
      nodes = [];
      const positions = [];
      for (let r=0;r<INTER_COUNT;r++){
        for (let c=0;c<INTER_COUNT;c++) positions.push([r,c]);
      }
      for (let i=positions.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [positions[i],positions[j]] = [positions[j],positions[i]];
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
          lastMoveAt: performance.now() - Math.random()*1000,
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
          if (d < best.d) { best = {r, c, d}; }
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

    // client -> canvas device coords
    function clientToCanvas(ev){
      const rect = canvas.getBoundingClientRect();
      const rawX = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const rawY = (ev.clientY - rect.top) * (canvas.height / rect.height);
      return { x: Math.round(rawX), y: Math.round(rawY) };
    }

    // ---------- POINTER HANDLERS ----------
    function onPointerDown(ev) {
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
    }

    let lastPointerTime = 0;
    function onPointerMove(ev) {
      const now = performance.now();
      if (now - lastPointerTime < 8) return; // throttle
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
        draggingNode.gx = nearest.col;
        draggingNode.gy = nearest.row;
        draggingNode.targetGx = nearest.col;
        draggingNode.targetGy = nearest.row;
        const p = gridPoints[nearest.row][nearest.col];
        draggingNode.x = p.x; draggingNode.y = p.y;
        ev.preventDefault();
      }
    }

    function onPointerUp(ev) {
      if (draggingNode) {
        const n = draggingNode;
        const nearest = nearestIntersection(n.x, n.y);
        n.gx = nearest.col; n.gy = nearest.row;
        const p = gridPoints[n.gy][n.gx];
        n.x = p.x; n.y = p.y;
        n.drag = false; draggingNode = null;
        ev.preventDefault();
      }
    }

    function onKeyDown(ev) {
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
        n.locked = !n.locked; n.lastMoveAt = performance.now();
        if (n.locked) { const p = gridPoints[n.gy][n.gx]; n.x = p.x; n.y = p.y; }
        flashStatus(`Node ${n.id} ${n.locked ? 'locked' : 'unlocked'}`, 1200);
      }
    }

    // small status flash
    let statusTimer = null;
    function flashStatus(text, timeout = 900) {
      const prev = statusEl.textContent;
      statusEl.textContent = text;
      if (statusTimer) clearTimeout(statusTimer);
      statusTimer = setTimeout(()=> statusEl.textContent = `TARGET: ${currentTargetName}  |  Q/Й = lock/unlock`, timeout);
    }

    // ---------- UPDATE / DRAW ----------
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
      ctx.clearRect(0,0,canvas.width, canvas.height);
      ctx.save();
      // background rounded rect
      const r = 8 * DPR;
      roundRect(ctx, 0, 0, canvas.width, canvas.height, r);
      ctx.fillStyle = 'rgba(2,18,12,0.9)';
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

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    // ---------- loop ----------
    function loop(now) {
      const dt = Math.max(1, now - lastTime);
      lastTime = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }

    // ---------- victory ----------
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

    // ---------- controls ----------
    checkBtn.addEventListener('click', () => {
      const ok = checkVictory();
      if (!ok) flashStatus('TARGET: ПРИКОЛ НЕ СОБРАН', 1200);
      else flashStatus('TARGET: СОБРАН — ВЫЙГРАЛ', 1200);
    });
    resetBtn.addEventListener('click', () => {
      for (const n of nodes) { n.locked = false; n.selected = false; n.drag = false; }
      respawnNodes();
    });

    // ---------- events binding ----------
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('keydown', onKeyDown, { passive: false });

    // ---------- init ----------
    function init() {
      setCanvasSize();
      buildGrid();
      respawnNodes();
      if (raf) cancelAnimationFrame(raf);
      lastTime = performance.now();
      raf = requestAnimationFrame(loop);
    }

    // on resize: keep nodes snapped and visible
    let resizeTimer = null;
    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(()=> {
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

    // run
    init();

    // ---------- debug API ----------
    window.netGridV6Left = {
      canvas, ctx, nodes, gridPoints,
      debug: () => ({
        canvasSize: { w: canvas.width, h: canvas.height, cssW: canvas.clientWidth, cssH: canvas.clientHeight },
        nodesCount: nodes.length, selected: selectedNode ? selectedNode.id : null, dragging: draggingNode ? draggingNode.id : null,
        target: currentTargetName
      }),
      forceRespawn: respawnNodes,
      destroy: () => {
        try {
          if (raf) cancelAnimationFrame(raf);
          canvas.remove();
          controls.remove();
          statusEl.remove();
          if (victoryEl) victoryEl.remove();
          delete window.netGridV6Left;
        } catch (e){}
      }
    };

    console.info('netGrid_v6_leftbottom loaded — left-bottom HUD active.');

  } catch (err) {
    console.error('netGrid_v6_leftbottom error', err);
  }
})();
