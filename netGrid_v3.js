// netGrid_v3.js — Final replacement (screen-space forward mapping, analytic solver)
// Replace your existing netGrid_v3.js with this file entirely.

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

    // MUST match crt_overlay.js (uDist). If your shader uses a different value, set it here the same.
    const CRT_DISTORTION = 0.28;

    // hit radius in map-backbuffer pixels (visual tolerance)
    const HIT_RADIUS_MAP_PX = 12 * DPR;

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
    let gridPoints = []; // map-local coordinates gridPoints[r][c] = {x,y}
    let nodes = []; // nodes with map-local coordinates and grid indexes
    let raf = null;
    let tick = 0;
    let selectedNode = null;
    let draggingNode = null;

    // screen-space caches (computed each frame): positions in client coords of every grid intersection & nodes
    let screenGrid = []; // same shape as gridPoints: screenGrid[r][c] = {cx, cy}
    let screenNodes = []; // screenNodes[i] = {cx, cy}

    // mouse pipeline
    let rawClient = { x: 0, y: 0, valid: false };
    let mouseDirty = false;
    let mouseDown = false;

    // cache DOM rects (updated on resize/scroll/orientationchange)
    let cachedRects = { termRect: null, mapRect: null, termWidth: 0, termHeight: 0 };

    // helper: get terminal canvas (the one crt_overlay uses)
    function getTerminalCanvas() {
      return document.getElementById('terminalCanvas') || null;
    }

    // ---------- GRID BUILDERS ----------
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
          id: idx,
          gx: c, gy: r,
          x: p.x, y: p.y, // local map-backbuffer coords
          targetGx: c, targetGy: r,
          speed: 0.002 + Math.random() * 0.004,
          locked: false,
          lastMoveAt: performance.now(),
          drag: false,
          selected: false
        };
      });
      selectedNode = null; draggingNode = null;
    }

    // ---------- CACHED RECTS ----------
    function updateCachedRects(force = false) {
      const term = getTerminalCanvas();
      if (!term) {
        cachedRects.termRect = null;
        cachedRects.mapRect = mapCanvas.getBoundingClientRect();
        cachedRects.termWidth = 0;
        cachedRects.termHeight = 0;
        return;
      }
      const termRect = term.getBoundingClientRect();
      const mapRect = mapCanvas.getBoundingClientRect();
      const termW = term.width; // backing pixel width
      const termH = term.height;
      const changed = force ||
        !cachedRects.termRect ||
        cachedRects.termRect.width !== termRect.width ||
        cachedRects.termRect.height !== termRect.height ||
        !cachedRects.mapRect ||
        cachedRects.mapRect.left !== mapRect.left ||
        cachedRects.mapRect.top !== mapRect.top ||
        cachedRects.termWidth !== termW ||
        cachedRects.termHeight !== termH;
      if (changed) {
        cachedRects.termRect = termRect;
        cachedRects.mapRect = mapRect;
        cachedRects.termWidth = termW;
        cachedRects.termHeight = termH;
      }
    }

    // ---------- Math: analytic inverse derived from shader ----------
    // Given texture-coordinate f (in [0..1]) that corresponds to pre-shader texture (map),
    // compute screen normalized coordinate S (0..1) such that shader would sample f for that screen position.
    // This is the analytic solver for d = uv * s, with s = (1-k)+k*r and d = 2*f' - 1 where f' = (f.x, 1 - f.y).
    function textureF_to_screenNormalized(fx, fy) {
      // f' (shader U) has y flipped before computing d
      const fpx = fx;
      const fpy = 1.0 - fy;
      const dx = fpx * 2 - 1;
      const dy = fpy * 2 - 1;
      const dd = Math.hypot(dx, dy);
      const k = CRT_DISTORTION;

      if (dd === 0 || k === 0) {
        // uv = d (when s == 1)
        const uvx = dx;
        const uvy = dy;
        return { sx: (uvx + 1) * 0.5, sy: (uvy + 1) * 0.5 };
      }

      // Solve quadratic: k*r^2 + (1-k)*r - dd = 0, for r >= 0
      // a = k, b = (1-k), c = -dd
      const a = k;
      const b = (1 - k);
      const c = -dd;
      const disc = b * b - 4 * a * c;
      let r = dd; // fallback
      if (disc >= 0) {
        // root = ( -b + sqrt(disc) ) / (2a)  (the positive root)
        const root = (-b + Math.sqrt(disc)) / (2 * a);
        if (root > 0) r = root;
      }

      const s = (1 - k) + k * r;
      // uv = d / s
      const uvx = dx / s;
      const uvy = dy / s;

      // screen normalized S = (uv + 1) / 2
      const sx = (uvx + 1) * 0.5;
      const sy = (uvy + 1) * 0.5;
      return { sx, sy };
    }

    // Map map-local pixel -> client coordinates (where that map pixel appears visually after shader)
    function mapLocalToClient(px_local, py_local) {
      // ensure cached rects
      const term = getTerminalCanvas();
      if (!term || !cachedRects.termRect) {
        // fallback: no terminal distortion — direct mapping to client coords
        const mapRect = mapCanvas.getBoundingClientRect();
        const cssX = mapRect.left + (px_local / mapCanvas.width) * mapRect.width;
        const cssY = mapRect.top + (py_local / mapCanvas.height) * mapRect.height;
        return { cx: cssX, cy: cssY };
      }
      const termRect = cachedRects.termRect;
      const mapRect = cachedRects.mapRect;
      const termW = cachedRects.termWidth;
      const termH = cachedRects.termHeight;

      // pixel position in client (CSS) where this map pixel is drawn (before shader)
      const clientX = mapRect.left + (px_local / mapCanvas.width) * mapRect.width;
      const clientY = mapRect.top + (py_local / mapCanvas.height) * mapRect.height;

      // texture coordinate f in [0..1] across terminal texture
      const fx = (clientX - termRect.left) / termRect.width;
      const fy = (clientY - termRect.top) / termRect.height;

      // solve analytic inverse to get screen normalized coordinate (S)
      const s = textureF_to_screenNormalized(fx, fy);

      // convert normalized screen S to client coords (use termRect to map)
      const outClientX = termRect.left + s.sx * termRect.width;
      const outClientY = termRect.top + s.sy * termRect.height;
      return { cx: outClientX, cy: outClientY };
    }

    // ---------- Precompute screen positions for all grid intersections and nodes ----------
    function recomputeScreenPositions() {
      updateCachedRects(false);
      // build screenGrid
      screenGrid = [];
      for (let r = 0; r < INTER_COUNT; r++) {
        const row = [];
        for (let c = 0; c < INTER_COUNT; c++) {
          const p = gridPoints[r][c];
          const sc = mapLocalToClient(p.x, p.y);
          row.push(sc); // {cx,cy}
        }
        screenGrid.push(row);
      }

      // nodes
      screenNodes = [];
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const sc = mapLocalToClient(n.x, n.y);
        screenNodes.push(sc);
      }
    }

    // ---------- Hit detection in screen-space ----------
    // returns { node, dist, index } or null
    function findNodeUnderClient(clientX, clientY) {
      let best = { node: null, dist: Infinity, idx: -1 };
      for (let i = 0; i < nodes.length; i++) {
        const sc = screenNodes[i];
        if (!sc) continue;
        const dx = clientX - sc.cx;
        const dy = clientY - sc.cy;
        const d = Math.hypot(dx, dy);
        if (d < best.dist) { best.node = nodes[i]; best.dist = d; best.idx = i; }
      }
      if (best.node && best.dist <= Math.max(12, HIT_RADIUS_MAP_PX)) return best;
      return null;
    }

    // For dragging: find nearest grid intersection in screen space and return its grid indices
    function findNearestGridScreen(clientX, clientY) {
      let best = { r: 0, c: 0, d: Infinity };
      for (let r = 0; r < INTER_COUNT; r++) {
        for (let c = 0; c < INTER_COUNT; c++) {
          const sc = screenGrid[r][c];
          const d = Math.hypot(clientX - sc.cx, clientY - sc.cy);
          if (d < best.d) { best = { r, c, d }; }
        }
      }
      return best; // contains r,c,d
    }

    // ---------- EVENTS ----------
    window.addEventListener('resize', () => { resize(); updateCachedRects(true); }, { passive: true });
    window.addEventListener('scroll', () => updateCachedRects(true), { passive: true });
    window.addEventListener('orientationchange', () => updateCachedRects(true), { passive: true });

    window.addEventListener('mousemove', (ev) => {
      rawClient.x = ev.clientX; rawClient.y = ev.clientY; rawClient.valid = true;
      mouseDirty = true;
    }, { passive: true });

    mapCanvas.addEventListener('mousedown', (ev) => {
      rawClient.x = ev.clientX; rawClient.y = ev.clientY; rawClient.valid = true;
      mouseDirty = true;
      mouseDown = true;

      // ensure up-to-date screen positions for accurate picking
      recomputeScreenPositions();

      const found = findNodeUnderClient(ev.clientX, ev.clientY);
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
        if (selectedNode) { selectedNode.selected = false; selectedNode = null; }
      }
    });

    window.addEventListener('mouseup', (ev) => {
      mouseDown = false;
      if (draggingNode) {
        // snap dragged node to nearest grid intersection (in map-local coordinates)
        recomputeScreenPositions();
        const nearest = findNearestGridScreen(rawClient.x, rawClient.y);
        const r = nearest.r, c = nearest.c;
        draggingNode.gx = c; draggingNode.gy = r;
        const p = gridPoints[r][c];
        draggingNode.x = p.x; draggingNode.y = p.y;
        draggingNode.targetGx = c; draggingNode.targetGy = r;
        draggingNode.drag = false;
        draggingNode = null;
      }
    });

    window.addEventListener('keydown', (ev) => {
      if (!ev.key) return;
      const k = ev.key.toLowerCase();
      if (k === 'q' || k === 'й') {
        const n = selectedNode || draggingNode;
        if (!n) return;
        // compute nearest grid to current node visually (we can use map coords)
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

    // ---------- HELPERS ----------
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

    // ---------- UPDATE & DRAW ----------
    function update(dt) {
      tick++;

      // recompute screen positions if mouseDirty (cheap: recompute N grid + N nodes)
      if (mouseDirty) {
        recomputeScreenPositions();
        mouseDirty = false;
      }

      // If dragging, find nearest screen-space grid intersection and update node (fast)
      if (draggingNode && rawClient.valid) {
        const nearest = findNearestGridScreen(rawClient.x, rawClient.y);
        const r = nearest.r, c = nearest.c;
        draggingNode.gx = c; draggingNode.gy = r;
        const p = gridPoints[r][c];
        draggingNode.x = p.x; draggingNode.y = p.y;
        draggingNode.targetGx = c; draggingNode.targetGy = r;
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

      // Keep screenNodes in sync for next interactions (cheap)
      // update screenNodes positions from nodes' map-local coordinates
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        screenNodes[i] = mapLocalToClient(n.x, n.y);
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

    // ---------- main loop ----------
    let lastTime = performance.now();
    function loop() {
      const now = performance.now();
      const dt = now - lastTime; lastTime = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }

    // ---------- resize / init ----------
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
    window.netGrid.getMouseLocal = () => ({});

    function checkVictory() { return false; }

    console.info('netGrid_v3 — final screen-space forwarding fix loaded');

  } catch (err) {
    console.error('netGrid_v3 fatal', err);
  }
})();
