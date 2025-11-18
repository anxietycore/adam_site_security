// netGrid_v4.js — full replacement
// Robust hit-testing for distorted CRT overlay. Replace previous netGrid file entirely.
//
// Strategy (short):
// - On mouse click: sample small neighborhood in screen space (center + 4 offsets).
// - For each sample: convert screen->terminal canvas pixel coords, analytically invert CRT distortion
//   to get original texture pixel, map that texel to mapCanvas local pixel coords.
// - Pick the nearest node in map-local coordinates within threshold -> select / start drag.
// - Heavy work only on click. Mousemove only updates a cheap 'hover' test by reusing last click map (cheap).
// - Cache rects; update on resize/scroll/orientationchange.
//
// Place this file as netGrid_v4.js and reload page.

(() => {
  try {
    // ---------- CONFIG ----------
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const SIZE_CSS = 300; // map UI size in CSS px (unchanged)
    const COLOR = { r: 6, g: 160, b: 118 };
    const MAP_Z = 40;
    const STATUS_Z = 45;
    const CELL_COUNT = 6;
    const INTER_COUNT = CELL_COUNT + 1;
    const NODE_COUNT = 10;
    const AUTONOMOUS_MOVE_COOLDOWN = 800;

    // MUST match your crt_overlay shader uDist value
    const CRT_DISTORTION = 0.28;

    // Sampling offsets (CSS pixels). Small neighborhood to cover sub-pixel / rounding differences.
    const CLICK_OFFSETS = [
      [0, 0],
      [-3, 0],
      [3, 0],
      [0, -3],
      [0, 3],
    ];

    const CLICK_THRESHOLD_PX = 12 * DPR; // how close (in map-backbuffer pixels) counts as hit

    const DEV_LOG = false; // set true to see console debug for clicks

    // ---------- DOM: create map UI (compatible with previous UI) ----------
    const mapCanvas = document.createElement('canvas');
    Object.assign(mapCanvas.style, {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      width: `${SIZE_CSS}px`,
      height: `${SIZE_CSS}px`,
      pointerEvents: 'auto',
      zIndex: MAP_Z,
      borderRadius: '8px'
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
      fontWeight: '700'
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
      padding: '6px 12px', borderRadius: '6px', cursor: 'pointer'
    });
    controls.appendChild(checkBtn);
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '⟳';
    Object.assign(resetBtn.style, { padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' });
    controls.appendChild(resetBtn);

    // ---------- state ----------
    let w = 0, h = 0;
    let gridPoints = []; // map-local coordinates
    let nodes = [];
    let selectedNode = null, draggingNode = null;
    let raf = null, tick = 0;

    // cached rects & terminals
    let cached = { termRect: null, mapRect: null, termW: 0, termH: 0 };

    // cheap mouse pipeline (we do heavy work only on click)
    let rawMouse = { x: 0, y: 0, valid: false };

    // ---------- helpers: grid & nodes ----------
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
      for (let r = 0; r < INTER_COUNT; r++) for (let c = 0; c < INTER_COUNT; c++) positions.push([r, c]);
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
          locked: false, lastMoveAt: performance.now(), drag: false, selected: false
        };
      });
      selectedNode = null; draggingNode = null;
    }

    function nearestIntersection(px, py) {
      let best = { r: 0, c: 0, d: Infinity };
      for (let r = 0; r < INTER_COUNT; r++) for (let c = 0; c < INTER_COUNT; c++) {
        const p = gridPoints[r][c];
        const d = Math.hypot(px - p.x, py - p.y);
        if (d < best.d) best = { r, c, d };
      }
      return { row: best.r, col: best.c, dist: best.d };
    }

    // ---------- rect cache ----------
    function getTerminalCanvas() {
      return document.getElementById('terminalCanvas') || null;
    }
    function updateRects(force = false) {
      const term = getTerminalCanvas();
      if (!term) {
        cached.termRect = null;
        cached.termW = 0; cached.termH = 0;
        cached.mapRect = mapCanvas.getBoundingClientRect();
        return;
      }
      const trect = term.getBoundingClientRect();
      const mrect = mapCanvas.getBoundingClientRect();
      const tw = term.width, th = term.height;
      const changed = force ||
        !cached.termRect ||
        cached.termRect.width !== trect.width ||
        cached.termRect.height !== trect.height ||
        !cached.mapRect ||
        cached.mapRect.left !== mrect.left ||
        cached.mapRect.top !== mrect.top ||
        cached.termW !== tw || cached.termH !== th;
      if (changed) {
        cached.termRect = trect;
        cached.mapRect = mrect;
        cached.termW = tw;
        cached.termH = th;
      }
    }

    // ---------- CRT inversion (analytic) ----------
    // Input: termPxX/termPxY in terminalCanvas backing pixels (term.width/term.height).
    // Output: undistorted texture pixel coords (on terminal texture) {x,y}.
    function invertCRT_analytic(termPxX, termPxY, termW, termH) {
      // normalize to [-1,1]
      const nx = (termPxX / termW) * 2 - 1;
      const ny = (termPxY / termH) * 2 - 1;
      const rd = Math.hypot(nx, ny);
      const k = CRT_DISTORTION;
      if (rd === 0 || k === 0) return { x: termPxX, y: termPxY };
      // solve k*r^2 + (1-k)*r - rd = 0
      const a = k, b = (1 - k), c = -rd;
      const disc = b * b - 4 * a * c;
      let r = rd;
      if (disc >= 0) {
        const root = (-b + Math.sqrt(disc)) / (2 * a);
        if (root > 0) r = root;
      }
      // d = uv * s where s = (1-k)+k*r, and uv = undistorted
      const s = (1 - k) + k * r;
      const ux = nx / s, uy = ny / s;
      // back to pixel coords
      return { x: (ux + 1) * 0.5 * termW, y: (uy + 1) * 0.5 * termH };
    }

    // ---------- Mapping chain: screen client -> terminal backing pixels ----------
    function clientToTerminalPixels(clientX, clientY) {
      const term = getTerminalCanvas();
      if (!term || !cached.termRect) return null;
      const tr = cached.termRect;
      const termW = cached.termW; const termH = cached.termH;
      const px = (clientX - tr.left) * (termW / tr.width);
      const py = (clientY - tr.top) * (termH / tr.height);
      return { x: px, y: py, termW, termH, termRect: tr };
    }

    // ---------- Map terminal texture pixel -> mapCanvas local pixel ----------
    // This mirrors how terminal draws the map: terminal draws mapCanvas into terminal at mapRect (CSS px).
    function terminalTexelToMapLocal(texX, texY) {
      // texX/texY are in terminal texture backing pixels (term.width/term.height)
      const tr = cached.termRect;
      const mr = cached.mapRect;
      const termW = cached.termW; const termH = cached.termH;
      if (!tr || !mr || termW === 0 || termH === 0) return null;

      const fracX = texX / termW;
      const fracY = texY / termH;
      const cssX = fracX * tr.width;
      const cssY = fracY * tr.height;

      // position relative to mapRect on page
      const relX = cssX - (mr.left - tr.left);
      const relY = cssY - (mr.top - tr.top);

      // convert to mapCanvas backing pixels
      const localX = relX * (mapCanvas.width / mr.width);
      const localY = relY * (mapCanvas.height / mr.height);
      return { x: localX, y: localY };
    }

    // ---------- MAIN robust pick function (called on mousedown) ----------
    // returns nearest node or null
    function pickNodeFromClient(clientX, clientY) {
      updateRects(false);
      const term = getTerminalCanvas();
      // We'll try two flows:
      // 1) Preferred: treat click as happening on terminal rendering (screen-space), so use analytic inverse.
      // 2) Fallback: treat click relative to hidden mapCanvas DOM (if terminal not found).
      let best = { node: null, dist: Infinity, samplePos: null };

      if (term && cached.termRect) {
        // for each offset sample
        for (let i = 0; i < CLICK_OFFSETS.length; i++) {
          const [ox, oy] = CLICK_OFFSETS[i];
          const sx = clientX + ox;
          const sy = clientY + oy;

          // map to terminal backing pixels
          const termPx = clientToTerminalPixels(sx, sy);
          if (!termPx) continue;
          // invert CRT -> get original texture pixel
          const und = invertCRT_analytic(termPx.x, termPx.y, termPx.termW, termPx.termH);

          // map that texel back to map-local pixels
          const local = terminalTexelToMapLocal(und.x, und.y);
          if (!local) continue;

          // find nearest node in map-local coords
          for (const n of nodes) {
            const d = Math.hypot(local.x - n.x, local.y - n.y);
            if (d < best.dist) { best = { node: n, dist: d, samplePos: local }; }
          }
        }
        if (best.node && best.dist <= CLICK_THRESHOLD_PX) {
          if (DEV_LOG) console.log('pickNodeFromClient — picked via terminal flow', best);
          return best;
        }
      }

      // fallback: mapCanvas direct (if event landed directly on mapCanvas)
      try {
        const mrect = cached.mapRect || mapCanvas.getBoundingClientRect();
        const relX = (clientX - mrect.left) * (mapCanvas.width / mrect.width);
        const relY = (clientY - mrect.top) * (mapCanvas.height / mrect.height);
        for (const n of nodes) {
          const d = Math.hypot(relX - n.x, relY - n.y);
          if (d < best.dist) best = { node: n, dist: d, samplePos: { x: relX, y: relY } };
        }
        if (best.node && best.dist <= CLICK_THRESHOLD_PX) {
          if (DEV_LOG) console.log('pickNodeFromClient — picked via mapCanvas fallback', best);
          return best;
        }
      } catch (e) { /* ignore fallback errors */ }

      if (DEV_LOG) console.log('pickNodeFromClient — no node found', best);
      return null;
    }

    // ---------- EVENTS ----------
    window.addEventListener('resize', () => { resize(); updateRects(true); }, { passive: true });
    window.addEventListener('scroll', () => updateRects(true), { passive: true });
    window.addEventListener('orientationchange', () => updateRects(true), { passive: true });

    // track raw mouse for possible hover usage (non-heavy)
    window.addEventListener('mousemove', (ev) => {
      rawMouse.x = ev.clientX; rawMouse.y = ev.clientY; rawMouse.valid = true;
    }, { passive: true });

    // Listen on whole window for clicks (we catch clicks whether they land on terminal, map or something else)
    window.addEventListener('mousedown', (ev) => {
      // heavy work only on mouse down
      const res = pickNodeFromClient(ev.clientX, ev.clientY);
      if (res && res.node) {
        const n = res.node;
        if (n.locked) {
          if (selectedNode && selectedNode !== n) selectedNode.selected = false;
          selectedNode = n; selectedNode.selected = true;
        } else {
          draggingNode = n; draggingNode.drag = true;
          if (selectedNode && selectedNode !== n) selectedNode.selected = false;
          selectedNode = n; selectedNode.selected = true;
        }
      } else {
        if (selectedNode) { selectedNode.selected = false; selectedNode = null; }
      }
    });

    window.addEventListener('mouseup', () => {
      if (draggingNode) {
        // snap to nearest intersection in map-local coords
        const snap = nearestIntersection(draggingNode.x, draggingNode.y);
        draggingNode.gx = snap.col; draggingNode.gy = snap.row;
        const p = gridPoints[snap.row][snap.col];
        draggingNode.x = p.x; draggingNode.y = p.y;
        draggingNode.targetGx = snap.col; draggingNode.targetGy = snap.row;
        draggingNode.drag = false; draggingNode = null;
      }
    });

    window.addEventListener('keydown', (ev) => {
      if (!ev.key) return;
      const k = ev.key.toLowerCase();
      if (k === 'q' || k === 'й') {
        const n = selectedNode || draggingNode;
        if (!n) return;
        const nearest = nearestIntersection(n.x, n.y);
        const isOccupied = nodes.some(other => other !== n && other.locked && other.gx === nearest.col && other.gy === nearest.row);
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

    checkBtn.addEventListener('click', () => {
      statusEl.textContent = 'ПРОВЕРКА...';
      setTimeout(() => statusEl.textContent = defaultStatus(), 900);
    });
    resetBtn.addEventListener('click', () => {
      for (const n of nodes) { n.locked = false; n.selected = false; n.drag = false; }
      selectedNode = null; draggingNode = null;
      respawnNodes();
    });

    function defaultStatus() { return `TARGET: GRID  |  Q/Й = lock/unlock selected node`; }

    // ---------- update & draw ----------
    function update(dt) {
      tick++;
      // dragging movement handled by mouse events -> snap in mouseup; here only autonomous movement
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

    function pickNeighbor(gx, gy) {
      const candidates = [];
      if (gy > 0) candidates.push({ gx, gy: gy - 1 });
      if (gy < INTER_COUNT - 1) candidates.push({ gx, gy: gy + 1 });
      if (gx > 0) candidates.push({ gx: gx - 1, gy });
      if (gx < INTER_COUNT - 1) candidates.push({ gx: gx + 1, gy });
      return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : { gx, gy };
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

    // ---------- main loop ----------
    let last = performance.now();
    function loop() {
      const now = performance.now(); const dt = now - last; last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }

    // ---------- init/resize ----------
    function resize() {
      const cssW = SIZE_CSS; const cssH = SIZE_CSS;
      mapCanvas.style.width = cssW + 'px'; mapCanvas.style.height = cssH + 'px';
      w = mapCanvas.width = Math.max(120, Math.floor(cssW * DPR));
      h = mapCanvas.height = Math.max(120, Math.floor(cssH * DPR));
      buildGrid();
      if (!nodes || nodes.length === 0) respawnNodes();
      updateRects(true);
      statusEl.textContent = defaultStatus();
    }

    window.addEventListener('load', () => { resize(); raf = requestAnimationFrame(loop); });
    window.addEventListener('resize', resize);
    resize();

    // ---------- API ----------
    window.netGrid = window.netGrid || {};
    window.netGrid.nodes = nodes;
    window.netGrid.getMouseRaw = () => ({ ...rawMouse });

    console.info('netGrid_v4 — full replacement loaded (robust CRT hit-testing)');

  } catch (err) {
    console.error('netGrid_v4 fatal', err);
  }
})();
