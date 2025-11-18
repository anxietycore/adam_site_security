// netGrid_v3.js — Robust final fix (replacement)
// Strategy:
// 1) fast analytic forward-mapping of shader (O(1)) used in rAF to keep mouseLocal up-to-date
// 2) on mousedown do a small screen-space sampling (center + 4 neighbors) to robustly map visible pixel -> texture -> map local
// 3) cache getBoundingClientRect(), minimize work on mousemove (only capture client coords)
// 4) do heavy checks only on click, not per-mousemove — avoids lag
(() => {
  try {
    // ---------- CONFIG ----------
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const SIZE_CSS = 300;
    const COLOR = { r: 6, g: 160, b: 118 };
    const MAP_Z = 40;
    const STATUS_Z = 45;
    const CELL_COUNT = 6;
    const INTER_COUNT = CELL_COUNT + 1;
    const NODE_COUNT = 10;
    const AUTONOMOUS_MOVE_COOLDOWN = 800;

    // MUST match crt_overlay.js DISTORTION
    const CRT_DISTORTION = 0.28;

    // How many samples around click (center + 4) — keeps cost low but robust
    const CLICK_SAMPLE_OFFSETS = [
      [0,0],
      [-6, 0],
      [6, 0],
      [0, -6],
      [0, 6]
    ];

    // pick radius in map-backbuffer pixels to consider "on node"
    const CLICK_RADIUS_PX = 12; // visual tolerance
    const CLICK_RADIUS_PX_DPR = CLICK_RADIUS_PX * DPR;

    // ---------- DOM ----------
    const mapCanvas = document.createElement('canvas');
    Object.assign(mapCanvas.style, {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      width: `${SIZE_CSS}px`,
      height: `${SIZE_CSS}px`,
      pointerEvents: 'auto',
      zIndex: MAP_Z,
      borderRadius: '8px',
      boxShadow: '0 18px 40px rgba(0,0,0,0.9)',
      backgroundColor: 'rgba(0,10,6,0.28)',
      cursor: 'default'
    });
    document.body.appendChild(mapCanvas);
    const mctx = mapCanvas.getContext('2d');

    const statusEl = document.createElement('div');
    Object.assign(statusEl.style, {
      position: 'fixed',
      left: '18px',
      bottom: '12px',
      fontFamily: 'Courier, monospace',
      fontSize: '13px',
      color: `rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 1)`,
      zIndex: STATUS_Z,
      pointerEvents: 'none',
      userSelect: 'none',
      letterSpacing: '0.6px',
      fontWeight: '700',
      opacity: '1'
    });
    document.body.appendChild(statusEl);

    const controls = document.createElement('div');
    Object.assign(controls.style, {
      position: 'fixed',
      right: '20px',
      bottom: `${20 + SIZE_CSS + 12}px`,
      display: 'flex',
      gap: '8px',
      zIndex: MAP_Z + 1,
      alignItems: 'center'
    });
    document.body.appendChild(controls);

    const checkBtn = document.createElement('button');
    checkBtn.textContent = 'ПРОВЕРИТЬ';
    Object.assign(checkBtn.style, {
      padding: '6px 12px',
      borderRadius: '6px',
      border: `2px solid rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.95)`,
      background: 'rgba(0,0,0,0.5)',
      color: `rgba(${COLOR.r},${COLOR.g},${COLOR.b},1)`,
      cursor: 'pointer',
      fontFamily: 'Courier, monospace',
      fontWeight: '700'
    });
    controls.appendChild(checkBtn);

    const resetBtn = document.createElement('button');
    resetBtn.textContent = '⟳';
    Object.assign(resetBtn.style, { padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' });
    controls.appendChild(resetBtn);

    // ---------- STATE ----------
    let w = 0, h = 0;
    let gridPoints = [];
    let nodes = [];
    let raf = null;
    let tick = 0;
    let selectedNode = null;
    let draggingNode = null;

    // mouse pipeline: raw client coords stored at mousemove (cheap); processed once-per-frame
    let rawClient = { x: 0, y: 0, valid: false };
    let mouseLocal = { x: 0, y: 0, down: false };
    let mouseDirty = false;

    // cached rects (term canvas and map canvas) to avoid frequent DOM reads
    let cachedRects = { termRect: null, mapRect: null };

    function getTerminalCanvas() {
      return document.getElementById('terminalCanvas') || null;
    }

    // ---------- GRID & NODES ----------
    function buildGrid() {
      gridPoints = [];
      const margin = 12 * DPR;
      const innerW = w - margin * 2;
      const innerH = h - margin * 2;
      for (let r = 0; r < INTER_COUNT; r++) {
        const row = [];
        for (let c = 0; c < INTER_COUNT; c++) {
          const x = margin + (c / CELL_COUNT) * innerW;
          const y = margin + (r / CELL_COUNT) * innerH;
          row.push({ x, y });
        }
        gridPoints.push(row);
      }
    }

    function respawnNodes() {
      const positions = [];
      for (let r = 0; r < INTER_COUNT; r++)
        for (let c = 0; c < INTER_COUNT; c++) positions.push([r, c]);

      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }

      const chosen = positions.slice(0, NODE_COUNT);
      nodes = chosen.map((rc, idx) => {
        const [r, c] = rc;
        const p = gridPoints[r][c];
        return {
          id: idx, gx: c, gy: r, x: p.x, y: p.y,
          targetGx: c, targetGy: r,
          speed: 0.002 + Math.random() * 0.004,
          locked: false, lastMoveAt: performance.now(),
          drag: false, selected: false
        };
      });
      selectedNode = null; draggingNode = null;
    }

    function pickNeighbor(gx, gy) {
      const candidates = [];
      if (gy > 0) candidates.push({ gx, gy: gy - 1 });
      if (gy < INTER_COUNT - 1) candidates.push({ gx, gy: gy + 1 });
      if (gx > 0) candidates.push({ gx: gx - 1, gy });
      if (gx < INTER_COUNT - 1) candidates.push({ gx: gx + 1, gy });
      return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : { gx, gy };
    }

    function nearestIntersection(px, py) {
      let best = { r: 0, c: 0, d: Infinity };
      for (let r = 0; r < INTER_COUNT; r++) {
        for (let c = 0; c < INTER_COUNT; c++) {
          const p = gridPoints[r][c];
          const d = Math.hypot(px - p.x, py - p.y);
          if (d < best.d) best = { r, c, d };
        }
      }
      return { row: best.r, col: best.c, dist: best.d };
    }

    // ---------- CACHED RECTS ----------
    function updateCachedRects(force = false) {
      const term = getTerminalCanvas();
      if (!term) {
        cachedRects = { termRect: null, mapRect: mapCanvas.getBoundingClientRect() };
        return;
      }
      const termRect = term.getBoundingClientRect();
      const mapRect = mapCanvas.getBoundingClientRect();
      const changed = !cachedRects.termRect ||
        cachedRects.termRect.width !== termRect.width ||
        cachedRects.termRect.height !== termRect.height ||
        !cachedRects.mapRect ||
        cachedRects.mapRect.left !== mapRect.left ||
        cachedRects.mapRect.top !== mapRect.top ||
        force;
      if (changed) {
        cachedRects.termRect = termRect;
        cachedRects.mapRect = mapRect;
      }
    }

    // ---------- SHADER-FORWARD MAPPING ----------
    // Implements forward mapping equivalent to crt_overlay shader:
    // uv = vUV*2.0 - 1.0;
    // r = length(uv);
    // d = mix(uv, uv * r, uDist);
    // f = (d + 1.0) * 0.5;
    // f.y = 1.0 - f.y;
    function shaderForwardSampleCoord_fromScreen(termPxX, termPxY, termW, termH) {
      if (termW <= 0 || termH <= 0) return { x: termPxX, y: termPxY };

      const vux = termPxX / termW;
      const vuy = termPxY / termH;
      const ux = vux * 2 - 1;
      const uy = vuy * 2 - 1;
      const r = Math.hypot(ux, uy);
      const k = CRT_DISTORTION;
      // s = mix(1.0, r, k) = (1-k) + k*r
      const s = (1 - k) + k * r;
      const dx = ux * s;
      const dy = uy * s;
      let fx = (dx + 1) * 0.5;
      let fy = (dy + 1) * 0.5;
      fy = 1.0 - fy; // shader flips Y
      return { x: fx * termW, y: fy * termH };
    }

    // Map a texture pixel (on terminalCanvas) to local mapCanvas pixel coords (backing pixels)
    function terminalTexturePixel_to_localMap(texPx, texPy, termRect, mapRect, termW, termH) {
      const fracX = texPx / termW;
      const fracY = texPy / termH;
      const cssX = fracX * termRect.width;
      const cssY = fracY * termRect.height;
      const relCssX = cssX - (mapRect.left - termRect.left);
      const relCssY = cssY - (mapRect.top - termRect.top);
      const localX = relCssX * (mapCanvas.width / mapRect.width);
      const localY = relCssY * (mapCanvas.height / mapRect.height);
      return {
        x: Math.max(0, Math.min(mapCanvas.width, localX)),
        y: Math.max(0, Math.min(mapCanvas.height, localY))
      };
    }

    // ---------- PROCESS MOUSE (rAF) ----------
    // cheap analytic mapping executed once per frame if mouseDirty
    function processMousePosition() {
      mouseDirty = false;
      const term = getTerminalCanvas();
      if (!term) {
        const rect = mapCanvas.getBoundingClientRect();
        const rawX = (rawClient.x - rect.left) * (mapCanvas.width / rect.width);
        const rawY = (rawClient.y - rect.top) * (mapCanvas.height / rect.height);
        mouseLocal.x = Math.max(0, Math.min(mapCanvas.width, rawX));
        mouseLocal.y = Math.max(0, Math.min(mapCanvas.height, rawY));
        return;
      }
      const termW = term.width, termH = term.height;
      if (!cachedRects.termRect || !cachedRects.mapRect) updateCachedRects(true);
      const termRect = cachedRects.termRect, mapRect = cachedRects.mapRect;
      const termPxX = (rawClient.x - termRect.left) * (termW / termRect.width);
      const termPxY = (rawClient.y - termRect.top) * (termH / termRect.height);
      const tex = shaderForwardSampleCoord_fromScreen(termPxX, termPxY, termW, termH);
      const local = terminalTexturePixel_to_localMap(tex.x, tex.y, termRect, mapRect, termW, termH);
      mouseLocal.x = local.x; mouseLocal.y = local.y;
    }

    // ---------- ROBUST CLICK MAPPING ----------
    // On mousedown we sample a few neighboring screen pixels and map them to local coords,
    // then choose the best node (closest) among samples. This improves hit detection when
    // shader/rounding produce a slight offset between visual dot and exact math mapping.
    function findNodeAtScreen(clientX, clientY) {
      const term = getTerminalCanvas();
      if (!term) {
        // fallback: simple mapCanvas mapping
        const rect = mapCanvas.getBoundingClientRect();
        const localX = (clientX - rect.left) * (mapCanvas.width / rect.width);
        const localY = (clientY - rect.top) * (mapCanvas.height / rect.height);
        return findNodeNearLocal(localX, localY, CLICK_RADIUS_PX_DPR);
      }

      const termW = term.width, termH = term.height;
      if (!cachedRects.termRect || !cachedRects.mapRect) updateCachedRects(true);
      const termRect = cachedRects.termRect, mapRect = cachedRects.mapRect;

      let best = { node: null, dist: Infinity, localX: null, localY: null };

      for (let i = 0; i < CLICK_SAMPLE_OFFSETS.length; i++) {
        const [ox, oy] = CLICK_SAMPLE_OFFSETS[i];
        const sx = clientX + ox;
        const sy = clientY + oy;
        // project to terminal pixel space
        const termPxX = (sx - termRect.left) * (termW / termRect.width);
        const termPxY = (sy - termRect.top) * (termH / termRect.height);
        // shader forward mapping
        const tex = shaderForwardSampleCoord_fromScreen(termPxX, termPxY, termW, termH);
        // to local map pixel
        const local = terminalTexturePixel_to_localMap(tex.x, tex.y, termRect, mapRect, termW, termH);

        // find nearest node to this local sample
        for (const n of nodes) {
          const d = Math.hypot(local.x - n.x, local.y - n.y);
          if (d < best.dist) {
            best = { node: n, dist: d, localX: local.x, localY: local.y };
          }
        }
      }

      if (best.node && best.dist <= CLICK_RADIUS_PX_DPR) {
        return { node: best.node, localX: best.localX, localY: best.localY, dist: best.dist };
      }
      return null;
    }

    function findNodeNearLocal(localX, localY, radius) {
      let best = { node: null, dist: Infinity };
      for (const n of nodes) {
        const d = Math.hypot(localX - n.x, localY - n.y);
        if (d < best.dist) best = { node: n, dist: d };
      }
      if (best.node && best.dist <= radius) return { node: best.node, dist: best.dist };
      return null;
    }

    // ---------- EVENTS ----------
    window.addEventListener('resize', () => { resize(); updateCachedRects(true); }, { passive: true });
    window.addEventListener('scroll', () => updateCachedRects(true), { passive: true });
    window.addEventListener('orientationchange', () => updateCachedRects(true), { passive: true });

    window.addEventListener('mousemove', (ev) => {
      rawClient.x = ev.clientX; rawClient.y = ev.clientY; rawClient.valid = true;
      mouseDirty = true;
    }, { passive: true });

    // mousedown uses robust sample to determine node at screen location
    mapCanvas.addEventListener('mousedown', (ev) => {
      rawClient.x = ev.clientX; rawClient.y = ev.clientY; rawClient.valid = true;
      // do robust find (samples) on click — expensive but only runs on click
      const found = findNodeAtScreen(ev.clientX, ev.clientY);
      mouseLocal.down = true;
      if (found && found.node) {
        const n = found.node;
        if (n.locked) {
          if (selectedNode && selectedNode !== n) selectedNode.selected = false;
          selectedNode = n; selectedNode.selected = true;
          return;
        }
        draggingNode = n; draggingNode.drag = true;
        if (selectedNode && selectedNode !== n) selectedNode.selected = false;
        selectedNode = n; selectedNode.selected = true;
      } else {
        // no node found at click — deselect
        if (selectedNode) { selectedNode.selected = false; selectedNode = null; }
      }
    });

    window.addEventListener('mouseup', () => {
      mouseLocal.down = false;
      if (draggingNode) {
        const n = draggingNode;
        const nearest = nearestIntersection(n.x, n.y);
        n.gx = nearest.col; n.gy = nearest.row;
        const p = gridPoints[n.gy][n.gx];
        n.x = p.x; n.y = p.y;
        n.drag = false; draggingNode = null;
      }
    });

    window.addEventListener('keydown', (ev) => {
      if (!ev.key) return;
      const k = ev.key.toLowerCase();
      if (k === 'q' || k === 'й') {
        const n = selectedNode || draggingNode;
        if (!n) return;
        const nearest = nearestIntersection(n.x, n.y);
        const isOccupied = nodes.some(other =>
          other !== n && other.locked && other.gx === nearest.col && other.gy === nearest.row);
        if (isOccupied) {
          statusEl.textContent = `⚠ Место занято`;
          setTimeout(() => (statusEl.textContent = defaultStatus()), 1400);
          return;
        }
        n.gx = nearest.col; n.gy = nearest.row;
        n.targetGx = n.gx; n.targetGy = n.gy;
        n.locked = !n.locked; n.lastMoveAt = performance.now();
        if (n.locked) { const p = gridPoints[n.gy][n.gx]; n.x = p.x; n.y = p.y; }
      }
    });

    // ---------- UI ----------
    function defaultStatus() { return `TARGET: GRID  |  Q/Й = lock/unlock selected node`; }
    checkBtn.addEventListener('click', () => {
      const ok = checkVictory();
      if (!ok) {
        statusEl.textContent = `TARGET: GRID  |  NOT COMPLETE`;
        setTimeout(() => statusEl.textContent = defaultStatus(), 1400);
      }
    });
    resetBtn.addEventListener('click', () => {
      for (const n of nodes) { n.locked = false; n.selected = false; n.drag = false; }
      selectedNode = null; draggingNode = null; respawnNodes();
    });

    // ---------- UPDATE & DRAW ----------
    function update(dt) {
      tick++;
      if (mouseDirty) processMousePosition(); // cheap analytic mapping once per frame

      // hover & dragging
      let hoveredNode = null;
      for (const n of nodes) {
        if (Math.hypot(mouseLocal.x - n.x, mouseLocal.y - n.y) < 12 * DPR) {
          hoveredNode = n; break;
        }
      }
      mapCanvas.style.cursor = (hoveredNode && hoveredNode.locked) ? 'not-allowed' : (hoveredNode ? 'pointer' : 'default');

      if (draggingNode && draggingNode.locked) {
        draggingNode.drag = false; draggingNode = null;
      }
      if (draggingNode) {
        const nearest = nearestIntersection(mouseLocal.x, mouseLocal.y);
        draggingNode.gx = nearest.col; draggingNode.gy = nearest.row;
        draggingNode.targetGx = nearest.col; draggingNode.targetGy = nearest.row;
        const p = gridPoints[nearest.row][nearest.col];
        draggingNode.x = p.x; draggingNode.y = p.y;
      }

      // autonomous movement
      const now = performance.now();
      for (const n of nodes) {
        if (n.drag) continue;
        if (n.locked) {
          const p = gridPoints[n.gy][n.gx];
          n.x = p.x; n.y = p.y; n.targetGx = n.gx; n.targetGy = n.gy; continue;
        }
        const targetP = gridPoints[n.targetGy][n.targetGx];
        const dist = Math.hypot(n.x - targetP.x, n.y - targetP.y);
        if (dist < 1.4 * DPR) {
          n.gx = n.targetGx; n.gy = n.targetGy;
          if (now - n.lastMoveAt > AUTONOMOUS_MOVE_COOLDOWN + Math.random() * 1200) {
            const nb = pickNeighbor(n.gx, n.gy);
            n.targetGx = nb.gx; n.targetGy = nb.gy; n.lastMoveAt = now;
          }
        } else {
          const p = targetP;
          const t = Math.min(1, n.speed * (dt / 16) * (1 + Math.random() * 0.6));
          n.x += (p.x - n.x) * t; n.y += (p.y - n.y) * t;
        }
      }
    }

    function draw() {
      mctx.clearRect(0, 0, w, h);
      mctx.fillStyle = 'rgba(2,18,12,0.66)';
      roundRect(mctx, 0, 0, w, h, 8 * DPR);
      mctx.fill();

      mctx.strokeStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.10)`;
      mctx.lineWidth = 1 * DPR;
      mctx.beginPath();
      for (let i = 0; i <= CELL_COUNT; i++) {
        const x = gridPoints[0][0].x + (i / CELL_COUNT) * (gridPoints[0][CELL_COUNT].x - gridPoints[0][0].x);
        mctx.moveTo(x, gridPoints[0][0].y); mctx.lineTo(x, gridPoints[INTER_COUNT - 1][0].y);
      }
      for (let j = 0; j <= CELL_COUNT; j++) {
        const y = gridPoints[0][0].y + (j / CELL_COUNT) * (gridPoints[INTER_COUNT - 1][0].y - gridPoints[0][0].y);
        mctx.moveTo(gridPoints[0][0].x, y); mctx.lineTo(gridPoints[0][INTER_COUNT - 1].x, y);
      }
      mctx.stroke();

      // connections
      mctx.save();
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const A = nodes[i], B = nodes[j];
          const d = Math.hypot(A.x - B.x, A.y - B.y);
          if (d < (w * 0.32)) {
            const baseAlpha = Math.max(0.10, 0.32 - (d / (w * 0.9)) * 0.22);
            const grad = mctx.createLinearGradient(A.x, A.y, B.x, B.y);
            grad.addColorStop(0, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${baseAlpha})`);
            grad.addColorStop(1, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${baseAlpha * 0.45})`);
            mctx.strokeStyle = grad; mctx.lineWidth = 1 * DPR; mctx.beginPath();
            mctx.moveTo(A.x, A.y); mctx.lineTo(B.x, B.y); mctx.stroke();
          }
        }
      }
      mctx.restore();

      // nodes
      for (const n of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin((n.id + tick * 0.02) * 1.2);
        const intensity = n.selected ? 1.4 : (n.locked ? 1.2 : 1.0);
        const glowR = (6 * DPR + pulse * 3 * DPR) * intensity;
        const c = n.locked ? `rgba(255,60,60,${0.36 * intensity})` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.36 * intensity})`;
        const c2 = n.locked ? `rgba(255,60,60,${0.12 * intensity})` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.12 * intensity})`;
        const grd = mctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
        grd.addColorStop(0, c); grd.addColorStop(0.6, c2); grd.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grd; mctx.fillRect(n.x - glowR, n.y - glowR, glowR * 2, glowR * 2);

        mctx.beginPath();
        const coreR = 2.2 * DPR + (n.selected ? 1.6 * DPR : 0);
        mctx.fillStyle = n.locked ? `rgba(255,60,60,1)` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},1)`;
        mctx.arc(n.x, n.y, coreR, 0, Math.PI * 2); mctx.fill();

        mctx.beginPath(); mctx.lineWidth = 1 * DPR;
        mctx.strokeStyle = n.locked ? `rgba(255,60,60,0.92)` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.92)`;
        mctx.arc(n.x, n.y, coreR + 1.2 * DPR, 0, Math.PI * 2); mctx.stroke();
      }

      mctx.save();
      mctx.font = `${10 * DPR}px monospace`;
      mctx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.95)`;
      mctx.textAlign = 'right';
      mctx.fillText('VIGIL NET', w - 8 * DPR, 12 * DPR);
      mctx.restore();
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    let lastTime = performance.now();
    function loop() {
      const now = performance.now();
      const dt = now - lastTime; lastTime = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }

    // ---------- INIT ----------
    function resize() {
      const cssW = SIZE_CSS, cssH = SIZE_CSS;
      mapCanvas.style.width = cssW + 'px';
      mapCanvas.style.height = cssH + 'px';
      w = mapCanvas.width = Math.max(120, Math.floor(cssW * DPR));
      h = mapCanvas.height = Math.max(120, Math.floor(cssH * DPR));
      buildGrid();
      if (!nodes || nodes.length === 0) respawnNodes();
      updateCachedRects(true);
      statusEl.textContent = defaultStatus();
    }
    window.addEventListener('load', () => { resize(); raf = requestAnimationFrame(loop); });
    window.addEventListener('resize', resize);
    resize();

    // ---------- API ----------
    window.netGrid = window.netGrid || {};
    window.netGrid.nodes = nodes;
    window.netGrid.lockAll = () => { for (const n of nodes) n.locked = true; };
    window.netGrid.unlockAll = () => { for (const n of nodes) n.locked = false; };
    window.netGrid.getMouseLocal = () => ({ ...mouseLocal });

    function checkVictory() { return false; } // keep simple placeholder

    console.info('netGrid_v3 — robust final fix loaded');

  } catch (err) {
    console.error('netGrid_v3 fatal', err);
  }
})();
