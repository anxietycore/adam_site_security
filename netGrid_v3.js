// netGrid_v3.js — FINAL FIX
// Full replacement. Uses forward mapping of crt_overlay shader (no inversion/LUT).
(() => {
  try {
    // ----- CONFIG -----
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const SIZE_CSS = 300;
    const COLOR = { r: 6, g: 160, b: 118 };
    const MAP_Z = 40;
    const STATUS_Z = 45;
    const CELL_COUNT = 6;
    const INTER_COUNT = CELL_COUNT + 1;
    const NODE_COUNT = 10;
    const AUTONOMOUS_MOVE_COOLDOWN = 800;

    // MUST MATCH crt_overlay.js DISTORTION (the 'uDist' used in shader)
    const CRT_DISTORTION = 0.28;

    // ----- DOM: map canvas + UI -----
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
      opacity: '1',
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

    // ----- state -----
    let w = 0, h = 0;
    let gridPoints = [];
    let nodes = [];
    let raf = null;
    let tick = 0;
    let selectedNode = null;
    let draggingNode = null;

    // mouse pipeline
    let rawClient = { x: 0, y: 0, valid: false };
    let mouseLocal = { x: 0, y: 0, down: false };
    let mouseDirty = false;
    let cachedRects = { termRect: null, mapRect: null };

    // find terminal canvas (the one crt_overlay samples from)
    function getTerminalCanvas() {
      return document.getElementById('terminalCanvas') || null;
    }

    // ----- grid / node helpers -----
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
        for (let c = 0; c < INTER_COUNT; c++)
          positions.push([r, c]);

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

    // ----- cached rects -----
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

    // ----- core: shader-forward mapping (exact) -----
    // This implements exactly the same forward transform used in crt_overlay.js:
    // fs:
    //   vec2 uv = vUV*2.0 - 1.0;
    //   float r = length(uv);
    //   vec2 d = mix(uv, uv*r, uDist);
    //   vec2 f = (d + 1.0) * 0.5;
    //   f.y = 1.0 - f.y;
    //
    // Given screen pixel in terminal pixel space (termPxX, termPxY),
    // compute which texture texel (on terminalCanvas) the shader samples for that screen pixel.
    function shaderForwardSampleCoord_fromScreen(termPxX, termPxY, termW, termH) {
      // guard
      if (termW <= 0 || termH <= 0) return { x: termPxX, y: termPxY };

      // vUV in [0..1]
      const vux = termPxX / termW;
      const vuy = termPxY / termH;

      // uv in [-1..1]
      const ux = vux * 2 - 1;
      const uy = vuy * 2 - 1;

      const r = Math.hypot(ux, uy);
      const k = CRT_DISTORTION;

      // d = uv * ( (1-k) + k * r )
      const s = (1 - k) + k * r;
      const dx = ux * s;
      const dy = uy * s;

      // f = (d + 1) * 0.5 ; then flip y
      let fx = (dx + 1) * 0.5;
      let fy = (dy + 1) * 0.5;
      fy = 1.0 - fy;

      // back to terminal texture pixel coords
      return { x: fx * termW, y: fy * termH };
    }

    // Map a texture pixel (on terminalCanvas) to local pixel within mapCanvas (backing pixels).
    function terminalTexturePixel_to_localMap(texPx, texPy, termRect, mapRect, termW, termH) {
      // fraction across terminal texture
      const fracX = texPx / termW;
      const fracY = texPy / termH;

      // corresponding CSS px inside terminalRect
      const cssX = fracX * termRect.width;
      const cssY = fracY * termRect.height;

      // relative css inside mapRect
      const relCssX = cssX - (mapRect.left - termRect.left);
      const relCssY = cssY - (mapRect.top - termRect.top);

      // map to mapCanvas backing pixels
      const localX = relCssX * (mapCanvas.width / mapRect.width);
      const localY = relCssY * (mapCanvas.height / mapRect.height);

      // clamp
      return {
        x: Math.max(0, Math.min(mapCanvas.width, localX)),
        y: Math.max(0, Math.min(mapCanvas.height, localY))
      };
    }

    // ----- process mouse (called in rAF, not directly on mousemove) -----
    function processMousePosition() {
      mouseDirty = false;
      const term = getTerminalCanvas();
      if (!term) {
        // fallback: map directly using mapCanvas rect (no shader)
        const rect = mapCanvas.getBoundingClientRect();
        const rawX = (rawClient.x - rect.left) * (mapCanvas.width / rect.width);
        const rawY = (rawClient.y - rect.top) * (mapCanvas.height / rect.height);
        mouseLocal.x = Math.max(0, Math.min(mapCanvas.width, rawX));
        mouseLocal.y = Math.max(0, Math.min(mapCanvas.height, rawY));
        return;
      }

      const termW = term.width;
      const termH = term.height;
      // ensure cached rects valid
      if (!cachedRects.termRect || !cachedRects.mapRect) updateCachedRects(true);
      const termRect = cachedRects.termRect;
      const mapRect = cachedRects.mapRect;

      // convert client -> terminal pixel coords
      const termPxX = (rawClient.x - termRect.left) * (termW / termRect.width);
      const termPxY = (rawClient.y - termRect.top) * (termH / termRect.height);

      // use shader forward mapping to find which texture pixel is sampled
      const texCoord = shaderForwardSampleCoord_fromScreen(termPxX, termPxY, termW, termH);

      // map texture pixel to local mapCanvas pixel coords
      const local = terminalTexturePixel_to_localMap(texCoord.x, texCoord.y, termRect, mapRect, termW, termH);

      mouseLocal.x = local.x; mouseLocal.y = local.y;
    }

    // ----- events -----
    window.addEventListener('resize', () => {
      resize();
      updateCachedRects(true);
    }, { passive: true });

    window.addEventListener('scroll', () => updateCachedRects(true), { passive: true });

    window.addEventListener('mousemove', (ev) => {
      rawClient.x = ev.clientX; rawClient.y = ev.clientY; rawClient.valid = true;
      mouseDirty = true;
    }, { passive: true });

    mapCanvas.addEventListener('mousedown', (ev) => {
      rawClient.x = ev.clientX; rawClient.y = ev.clientY; rawClient.valid = true;
      processMousePosition(); // immediate so click feels snappy
      mouseLocal.down = true;
      let found = null;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (Math.hypot(mouseLocal.x - n.x, mouseLocal.y - n.y) < 12 * DPR) { found = n; break; }
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
      } else {
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

    // ----- helpers & UI logic -----
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
      selectedNode = null; draggingNode = null;
      respawnNodes();
    });

    function update(dt) {
      tick++;
      // process mouse once per frame (fast)
      if (mouseDirty) processMousePosition();

      // hovering detection (cheap)
      let hovered = null;
      for (const n of nodes) {
        if (Math.hypot(mouseLocal.x - n.x, mouseLocal.y - n.y) < 12 * DPR) { hovered = n; break; }
      }
      mapCanvas.style.cursor = (hovered && hovered.locked) ? 'not-allowed' : (hovered ? 'pointer' : 'default');

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

      // autonomous moves
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

      // grid lines
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

    // ----- main loop -----
    let lastTime = performance.now();
    function loop() {
      const now = performance.now();
      const dt = now - lastTime; lastTime = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }

    // ----- init / resize -----
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
    // update cached rects also on layout-change events
    window.addEventListener('orientationchange', () => updateCachedRects(true));

    // initial
    resize();

    // expose API
    window.netGrid = window.netGrid || {};
    window.netGrid.nodes = nodes;
    window.netGrid.lockAll = function () { for (const n of nodes) n.locked = true; };
    window.netGrid.unlockAll = function () { for (const n of nodes) n.locked = false; };
    window.netGrid.getMouseLocal = () => ({ ...mouseLocal });

    // simple victory placeholder
    function checkVictory() {
      return false;
    }

    console.info('netGrid_v3 final fix loaded — direct shader-forward mapping');

  } catch (err) {
    console.error('netGrid_v3 fatal', err);
  }
})();
