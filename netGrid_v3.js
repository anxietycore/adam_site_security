// netGrid_final.js — full replacement
// Stable pick + drag using screen-space forward mapping, minimal per-frame work.
// Replace your existing netGrid file entirely with this file.

(() => {
  try {
    // ---------- CONFIG ----------
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const SIZE_CSS = 300; // visual size in CSS px
    const COLOR = { r: 6, g: 160, b: 118 };
    const MAP_Z = 40;
    const STATUS_Z = 45;
    const CELL_COUNT = 6;
    const INTER_COUNT = CELL_COUNT + 1;
    const NODE_COUNT = 10;
    const AUTONOMOUS_MOVE_COOLDOWN = 800;

    // Must match shader uDist (crt_overlay). If not, set exact value here.
    const CRT_DISTORTION = 0.28;

    const DEV = false; // true -> console debug of rects/picks

    // hit threshold in CSS-backbuffer map pixels
    const HIT_PX = 12 * DPR;

    // ---------- DOM: create map UI (same style) ----------
    const mapCanvas = document.createElement('canvas');
    mapCanvas.id = 'netGrid_map';
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
      backgroundColor: 'rgba(0,10,6,0.28)'
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

    // small controls
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
    Object.assign(checkBtn.style, { padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' });
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '⟳';
    Object.assign(resetBtn.style, { padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' });
    controls.appendChild(checkBtn); controls.appendChild(resetBtn);

    // ---------- state ----------
    let w = 0, h = 0;
    let gridPoints = []; // map-local coords gridPoints[r][c] = {x,y}
    let nodes = []; // nodes with map-local coords
    let selectedNode = null;
    let draggingNode = null;
    let raf = null;
    let tick = 0;

    // cached screen positions for grid intersections (client coords)
    // screenGrid[r][c] = {cx, cy}
    let screenGrid = null;

    // cached rects of terminal and map
    let cached = { termRect: null, termW: 0, termH: 0, mapRect: null };

    // ---------- helpers ----------
    function getTerminalCanvas() {
      return document.getElementById('terminalCanvas') || null;
    }

    function defaultStatus() { return `TARGET: GRID  |  Q/Й = lock/unlock selected node`; }
    statusEl.textContent = defaultStatus();

    // ---------- grid / nodes ----------
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
          x: p.x, y: p.y,
          targetGx: c, targetGy: r,
          speed: 0.002 + Math.random() * 0.004,
          locked: false,
          lastMoveAt: performance.now(),
          drag: false,
          selected: false
        };
      });
      selectedNode = null; draggingNode = null;
      // recompute node screen positions as they are created
      recomputeScreenGrid();
    }

    // ---------- update cached rects ----------
    function updateCachedRects(force = false) {
      const term = getTerminalCanvas();
      if (!term) {
        cached.termRect = null; cached.termW = 0; cached.termH = 0;
        cached.mapRect = mapCanvas.getBoundingClientRect();
        return;
      }
      const tr = term.getBoundingClientRect();
      const tw = term.width, th = term.height;
      const mr = mapCanvas.getBoundingClientRect();
      const changed = force ||
        !cached.termRect ||
        cached.termRect.width !== tr.width ||
        cached.termRect.height !== tr.height ||
        !cached.mapRect ||
        cached.mapRect.left !== mr.left ||
        cached.mapRect.top !== mr.top ||
        cached.termW !== tw || cached.termH !== th;
      if (changed) {
        cached.termRect = tr;
        cached.termW = tw; cached.termH = th;
        cached.mapRect = mr;
        if (DEV) console.debug('updateCachedRects', cached);
        recomputeScreenGrid();
      }
    }

    // ---------- shader-forward mapping helpers ----------
    // Given texture coordinate f (0..1 across terminal texture), compute screen-normalized S where shader samples f.
    // Implements analytic solver from earlier messages.
    function textureF_to_screenNormalized(fx, fy) {
      // f' y flipped
      const fpx = fx;
      const fpy = 1.0 - fy;
      const dx = fpx * 2 - 1;
      const dy = fpy * 2 - 1;
      const rd = Math.hypot(dx, dy);
      const k = CRT_DISTORTION;
      if (rd === 0 || k === 0) {
        const ux = dx, uy = dy;
        return { sx: (ux + 1) * 0.5, sy: (uy + 1) * 0.5 };
      }
      // Solve k*r^2 + (1-k)*r - rd = 0 for r >=0
      const a = k, b = (1 - k), c = -rd;
      const disc = b * b - 4 * a * c;
      let r = rd;
      if (disc >= 0) {
        const root = (-b + Math.sqrt(disc)) / (2 * a);
        if (root > 0) r = root;
      }
      const s = (1 - k) + k * r;
      const uvx = dx / s, uvy = dy / s;
      return { sx: (uvx + 1) * 0.5, sy: (uvy + 1) * 0.5 };
    }

    // Map a map-local pixel (px_local,py_local) -> client screen coords {cx,cy}
    // This computes where that map-local pixel is visible on screen after draw+shader.
    function mapLocalToClient(px_local, py_local) {
      updateCachedRects(false);
      const tr = cached.termRect, mr = cached.mapRect;
      const termW = cached.termW, termH = cached.termH;
      if (!tr || !mr || termW === 0 || termH === 0) {
        // fallback: mapCanvas on page directly
        const mrect = mapCanvas.getBoundingClientRect();
        const cssX = mrect.left + (px_local / mapCanvas.width) * mrect.width;
        const cssY = mrect.top + (py_local / mapCanvas.height) * mrect.height;
        return { cx: cssX, cy: cssY };
      }
      // fraction across mapCanvas (CSS)
      const fracX = px_local / mapCanvas.width;
      const fracY = py_local / mapCanvas.height;
      // CSS position inside terminalRect
      const cssX = (mr.left - tr.left) + fracX * mr.width;
      const cssY = (mr.top - tr.top) + fracY * mr.height;
      // convert to texture fraction across terminal texture
      const fx = cssX / tr.width;
      const fy = cssY / tr.height;
      // shader-forward mapping: from texture f -> normalized screen S
      const s = textureF_to_screenNormalized(fx, fy);
      // back to client coords
      const cx = tr.left + s.sx * tr.width;
      const cy = tr.top + s.sy * tr.height;
      return { cx, cy };
    }

    // Recompute screenGrid (client coords) for all grid intersections.
    // This is called on layout changes (resize/scroll/orientationchange) and when mapRect moves.
    function recomputeScreenGrid() {
      updateCachedRects(false);
      screenGrid = [];
      for (let r = 0; r < INTER_COUNT; r++) {
        const row = [];
        for (let c = 0; c < INTER_COUNT; c++) {
          const p = gridPoints[r][c]; // map-local
          const sc = mapLocalToClient(p.x, p.y);
          row.push({ cx: sc.cx, cy: sc.cy });
        }
        screenGrid.push(row);
      }
      // Also recompute nodes' screen positions for selection (cache on nodes)
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const sc = mapLocalToClient(n.x, n.y);
        n._screen = { cx: sc.cx, cy: sc.cy };
      }
      if (DEV) console.debug('recomputeScreenGrid done');
    }

    // ---------- hit detection & drag logic ----------
    // Find node under clientX,clientY by comparing to nodes' screen pos.
    function findNodeUnder(clientX, clientY) {
      let best = { node: null, d: Infinity, idx: -1 };
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const sc = n._screen || mapLocalToClient(n.x, n.y);
        n._screen = sc;
        const d = Math.hypot(clientX - sc.cx, clientY - sc.cy);
        if (d < best.d) { best = { node: n, d, idx: i }; }
      }
      if (best.node && best.d <= HIT_PX) return best;
      return null;
    }

    // While dragging: find nearest grid intersection to clientXY in screenGrid, snap node to that intersection map-local coords
    function snapNodeToNearestGridScreen(clientX, clientY, node) {
      if (!screenGrid) recomputeScreenGrid();
      let best = { r: 0, c: 0, d: Infinity };
      for (let r = 0; r < INTER_COUNT; r++) {
        for (let c = 0; c < INTER_COUNT; c++) {
          const sc = screenGrid[r][c];
          const d = Math.hypot(clientX - sc.cx, clientY - sc.cy);
          if (d < best.d) best = { r, c, d };
        }
      }
      const p = gridPoints[best.r][best.c];
      node.gx = best.c; node.gy = best.r;
      node.x = p.x; node.y = p.y;
      node._screen = mapLocalToClient(node.x, node.y);
    }

    // ---------- events ----------
    window.addEventListener('resize', () => {
      resize();
      updateCachedRects(true);
    }, { passive: true });

    window.addEventListener('scroll', () => {
      updateCachedRects(true);
    }, { passive: true });

    window.addEventListener('orientationchange', () => {
      updateCachedRects(true);
    }, { passive: true });

    // mousemove: only heavy when dragging; otherwise nothing expensive
    window.addEventListener('mousemove', (ev) => {
      if (draggingNode) {
        // while dragging, snap to nearest grid intersection according to visual position
        snapNodeToNearestGridScreen(ev.clientX, ev.clientY, draggingNode);
      }
    }, { passive: true });

    // catch clicks anywhere -> selection or start dragging
    window.addEventListener('mousedown', (ev) => {
      // ensure screen positions up-to-date
      recomputeScreenGrid();
      const found = findNodeUnder(ev.clientX, ev.clientY);
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
      if (draggingNode) {
        // finalize snap
        snapNodeToNearestGridScreen(ev.clientX, ev.clientY, draggingNode);
        draggingNode.drag = false;
        draggingNode = null;
      }
    });

    window.addEventListener('keydown', (ev) => {
      if (!ev.key) return;
      const k = ev.key.toLowerCase();
      if (k === 'q' || k === 'й') {
        const n = selectedNode;
        if (!n) return;
        const nearest = nearestIntersection(n.x, n.y);
        const occupied = nodes.some(other => other !== n && other.locked && other.gx === nearest.col && other.gy === nearest.row);
        if (occupied) {
          statusEl.textContent = `⚠ Место занято`;
          setTimeout(() => statusEl.textContent = defaultStatus(), 1400);
          return;
        }
        n.gx = nearest.col; n.gy = nearest.row;
        n.targetGx = n.gx; n.targetGy = n.gy;
        n.locked = !n.locked; n.lastMoveAt = performance.now();
        if (n.locked) {
          const p = gridPoints[n.gy][n.gx]; n.x = p.x; n.y = p.y;
          n._screen = mapLocalToClient(n.x, n.y);
        }
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

    // ---------- helpers ----------
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

    // ---------- update & draw ----------
    function update(dt) {
      tick++;
      // autonomous movement (unchanged)
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
      // update nodes' screen cache occasionally if needed
      // (only when nodes moved or on layout change recomputeScreenGrid was already called)
      for (const n of nodes) {
        if (!n._screen) n._screen = mapLocalToClient(n.x, n.y);
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

      // links
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
      const now = performance.now();
      const dt = now - last; last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }

    // ---------- init / resize ----------
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

    // ---------- debug API ----------
    window.netGrid = window.netGrid || {};
    window.netGrid.debug = () => {
      updateCachedRects(false); recomputeScreenGrid();
      return {
        termRect: cached.termRect,
        termSize: { w: cached.termW, h: cached.termH },
        mapRect: cached.mapRect,
        screenGrid
      };
    };
    window.netGrid.nodes = nodes;

    console.info('netGrid_final loaded — forward screen mapping + snap-dragging active');

  } catch (err) {
    console.error('netGrid_final fatal', err);
  }
})();
