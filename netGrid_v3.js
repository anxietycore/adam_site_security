// netGrid_production.js
// Production-grade replacement for netGrid
// - Limited inverse-LUT (only mapRect region)
// - Analytic fallback
// - Pointer API + setPointerCapture
// - Heavy math only on mousedown / LUT build
// - Screen-space snap on drag (uses precomputed screenGrid)
// - Debug APIs: netGrid_prod.debug(), netGrid_prod.rebuildLUT()
//
// Usage: Replace existing netGrid file with this file entirely, reload page (Ctrl+R).

(() => {
  'use strict';

  // ---------- CONFIG ----------
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const CSS_SIZE = 300; // CSS px size of mini-map (keeps UI same)
  const COLOR = { r: 6, g: 160, b: 118 };
  const CELL_COUNT = 6;
  const INTER_COUNT = CELL_COUNT + 1;
  const NODE_COUNT = 10;
  const DEFAULT_CRT_DISTORTION = 0.28; // must match crt_overlay shader uDist - change if different
  const MAX_LUT_CELLS = 1600; // adaptive cap to keep LUT small
  const CLICK_SAMPLE_OFFSETS = [[0,0],[-3,0],[3,0],[0,-3],[0,3]]; // neighbors to sample
  const CLICK_THRESHOLD_MAP_PX = 12 * DPR; // tolerance in map-local pixels
  const DEV = false; // set true to enable verbose console.debug

  // ---------- DOM creation (non-invasive) ----------
  const mapCanvas = document.createElement('canvas');
  mapCanvas.id = 'netGrid_prod_map';
  Object.assign(mapCanvas.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    width: `${CSS_SIZE}px`,
    height: `${CSS_SIZE}px`,
    pointerEvents: 'auto',
    zIndex: 99999,
    borderRadius: '8px',
    boxShadow: '0 18px 40px rgba(0,0,0,0.9)',
    backgroundColor: 'rgba(0,10,6,0.28)'
  });
  document.body.appendChild(mapCanvas);
  const ctx = mapCanvas.getContext('2d');

  const statusEl = document.createElement('div');
  Object.assign(statusEl.style, {
    position: 'fixed',
    left: '18px',
    bottom: '12px',
    fontFamily: 'Courier, monospace',
    fontSize: '13px',
    color: `rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 1)`,
    zIndex: 100000,
    pointerEvents: 'none',
    userSelect: 'none',
    fontWeight: '700'
  });
  statusEl.textContent = 'netGrid — initializing...';
  document.body.appendChild(statusEl);

  const controls = document.createElement('div');
  Object.assign(controls.style, {
    position: 'fixed',
    right: '20px',
    bottom: `${20 + CSS_SIZE + 12}px`,
    display: 'flex',
    gap: '8px',
    zIndex: 100000,
    alignItems: 'center'
  });
  document.body.appendChild(controls);

  const checkBtn = document.createElement('button');
  checkBtn.textContent = 'ПРОВЕРИТЬ';
  Object.assign(checkBtn.style, { padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' });
  controls.appendChild(checkBtn);

  const resetBtn = document.createElement('button');
  resetBtn.textContent = '⟳';
  Object.assign(resetBtn.style, { padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' });
  controls.appendChild(resetBtn);

  // ---------- State ----------
  let w = 0, h = 0;
  let gridPoints = []; // map-local coords [row][col] = {x,y}
  let nodes = []; // node objects {id, gx, gy, x, y, locked, drag, selected, _screen}
  let selectedNode = null;
  let draggingNode = null;
  let raf = null, lastTick = performance.now();

  // cached terminal and map rects, LUT region and LUT
  const cache = {
    termRect: null, termW: 0, termH: 0,
    mapRect: null,
    lutRegion: null, // {sx, sy, sw, sh} in terminal backing pixels
    inverseLUT: null, // 2D array [row][col] -> {x,y} tex coords (undistorted)
    lutCols: 0, lutRows: 0,
    lutStep: 1,
    uDist: DEFAULT_CRT_DISTORTION
  };

  // cached screenGrid for intersections: screenGrid[r][c] = {cx, cy}
  let screenGrid = null;
  let lastScreenRecompute = 0;

  // ---------- Utilities ----------
  function log(...args) { if (DEV) console.debug('[netGrid_prod]', ...args); }
  function defaultStatus() { return 'TARGET: GRID  |  Q/Й = lock/unlock selected node'; }
  statusEl.textContent = defaultStatus();

  function getTerminalCanvas() {
    // typical id used in your project is 'terminalCanvas'; fallback to first canvas if not found
    return document.getElementById('terminalCanvas') || document.querySelector('canvas') || null;
  }

  // ---------- Grid & Nodes ----------
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
    const cells = [];
    for (let r = 0; r < INTER_COUNT; r++) for (let c = 0; c < INTER_COUNT; c++) cells.push([r, c]);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const chosen = cells.slice(0, NODE_COUNT);
    nodes = chosen.map((rc, idx) => {
      const [r, c] = rc;
      const p = gridPoints[r][c];
      return { id: idx, gx: c, gy: r, x: p.x, y: p.y, targetGx: c, targetGy: r, locked: false, drag: false, selected: false, _screen: null };
    });
    selectedNode = null; draggingNode = null;
    log('nodes respawned', nodes.length);
  }

  // ---------- Cached rects and LUT region ----------
  function updateRects(force = false) {
    const term = getTerminalCanvas();
    if (!term) {
      cache.termRect = null; cache.termW = 0; cache.termH = 0;
      cache.mapRect = mapCanvas.getBoundingClientRect();
      return;
    }
    const termRect = term.getBoundingClientRect();
    const mapRect = mapCanvas.getBoundingClientRect();
    const termW = term.width, termH = term.height;
    const changed = force ||
      !cache.termRect ||
      cache.termRect.width !== termRect.width ||
      cache.termRect.height !== termRect.height ||
      !cache.mapRect ||
      cache.mapRect.left !== mapRect.left ||
      cache.mapRect.top !== mapRect.top ||
      cache.termW !== termW || cache.termH !== termH;
    if (changed) {
      cache.termRect = termRect;
      cache.mapRect = mapRect;
      cache.termW = termW; cache.termH = termH;
      // compute LUT region in terminal backing pixel coords that correspond to mapRect
      const sx = Math.max(0, Math.round((mapRect.left - termRect.left) * (termW / termRect.width)));
      const sy = Math.max(0, Math.round((mapRect.top - termRect.top) * (termH / termRect.height)));
      const sw = Math.max(1, Math.round(mapRect.width * (termW / termRect.width)));
      const sh = Math.max(1, Math.round(mapRect.height * (termH / termRect.height)));
      cache.lutRegion = { sx, sy, sw, sh };
      cache.inverseLUT = null; // invalidate LUT - will be rebuilt lazily
      cache.lutCols = cache.lutRows = 0;
      log('updateRects ->', cache.lutRegion);
    }
  }

  // ---------- Build inverse LUT for region (adaptive step) ----------
  function buildInverseLUT() {
    if (!cache.termW || !cache.termH || !cache.lutRegion) return;
    const { sx, sy, sw, sh } = cache.lutRegion;
    // choose step so lutCols * lutRows <= MAX_LUT_CELLS
    let step = 1;
    let cols = Math.ceil(sw / step), rows = Math.ceil(sh / step);
    if (cols * rows > MAX_LUT_CELLS) {
      // increase step
      const ratio = Math.sqrt((cols * rows) / MAX_LUT_CELLS);
      step = Math.max(1, Math.floor(step * ratio));
      cols = Math.ceil(sw / step); rows = Math.ceil(sh / step);
    }
    cache.lutStep = step;
    cache.lutCols = cols; cache.lutRows = rows;

    const k = cache.uDist;
    const lut = new Array(rows);
    for (let ry = 0; ry < rows; ry++) {
      const row = new Array(cols);
      const py = sy + ry * step;
      for (let cx = 0; cx < cols; cx++) {
        const px = sx + cx * step;
        // normalized distorted [-1,1]
        const xd = (px / cache.termW) * 2 - 1;
        const yd = (py / cache.termH) * 2 - 1;
        const rd = Math.hypot(xd, yd);
        // solve k*r^2 + (1-k)*r - rd = 0 for r
        let r = rd;
        if (k !== 0 && rd !== 0) {
          // stable quadratic solve (choose positive root)
          const a = k, b = (1 - k), c = -rd;
          const disc = b * b - 4 * a * c;
          if (disc >= 0) {
            const root = (-b + Math.sqrt(disc)) / (2 * a);
            if (root > 0) r = root;
          }
        }
        const s = (1 - k) + k * r;
        const ux = (s === 0 ? xd : xd / s);
        const uy = (s === 0 ? yd : yd / s);
        const texX = (ux + 1) * 0.5 * cache.termW;
        const texY = (uy + 1) * 0.5 * cache.termH;
        row[cx] = { x: texX, y: texY };
      }
      lut[ry] = row;
    }
    cache.inverseLUT = lut;
    log('LUT built', { cols, rows, step });
  }

  // ---------- Apply inverse with bilinear interpolation inside LUT region ----------
  function applyInverseAtTermPixel(px, py) {
    if (!cache.inverseLUT) buildInverseLUT();
    if (!cache.inverseLUT) return analyticInverse(px, py);
    const { sx, sy, sw, sh } = cache.lutRegion;
    const step = cache.lutStep;
    const relX = px - sx, relY = py - sy;
    if (relX < 0 || relY < 0 || relX > sw || relY > sh) return analyticInverse(px, py);
    const fx = relX / step, fy = relY / step;
    let cx = Math.floor(fx), cy = Math.floor(fy);
    cx = Math.max(0, Math.min(cache.lutCols - 1, cx));
    cy = Math.max(0, Math.min(cache.lutRows - 1, cy));
    const cx1 = Math.min(cache.lutCols - 1, cx + 1);
    const cy1 = Math.min(cache.lutRows - 1, cy + 1);
    const tx00 = cache.inverseLUT[cy][cx], tx10 = cache.inverseLUT[cy][cx1];
    const tx01 = cache.inverseLUT[cy1][cx], tx11 = cache.inverseLUT[cy1][cx1];
    const fracX = Math.min(1, Math.max(0, fx - Math.floor(fx)));
    const fracY = Math.min(1, Math.max(0, fy - Math.floor(fy)));
    const topX = tx00.x * (1 - fracX) + tx10.x * fracX;
    const topY = tx00.y * (1 - fracX) + tx10.y * fracX;
    const botX = tx01.x * (1 - fracX) + tx11.x * fracX;
    const botY = tx01.y * (1 - fracX) + tx11.y * fracX;
    const finalX = topX * (1 - fracY) + botX * fracY;
    const finalY = topY * (1 - fracY) + botY * fracY;
    return { x: finalX, y: finalY };
  }

  // analytic inversion fallback (cheap)
  function analyticInverse(termPxX, termPxY) {
    if (!cache.termW || !cache.termH) return { x: termPxX, y: termPxY };
    const nx = (termPxX / cache.termW) * 2 - 1;
    const ny = (termPxY / cache.termH) * 2 - 1;
    const rd = Math.hypot(nx, ny);
    const k = cache.uDist;
    let r = rd;
    if (k !== 0 && rd !== 0) {
      const a = k, b = (1 - k), c = -rd;
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const root = (-b + Math.sqrt(disc)) / (2 * a);
        if (root > 0) r = root;
      }
    }
    const s = (1 - k) + k * r;
    const ux = (s === 0 ? nx : nx / s);
    const uy = (s === 0 ? ny : ny / s);
    return { x: (ux + 1) * 0.5 * cache.termW, y: (uy + 1) * 0.5 * cache.termH };
  }

  // ---------- Terminal texel -> map-local coords ----------
  function terminalTexelToMapLocal(texX, texY) {
    const tr = cache.termRect, mr = cache.mapRect;
    if (!tr || !mr || !cache.termW || !cache.termH) return null;
    const fracX = texX / cache.termW;
    const fracY = texY / cache.termH;
    const cssX = fracX * tr.width;
    const cssY = fracY * tr.height;
    const relCssX = cssX - (mr.left - tr.left);
    const relCssY = cssY - (mr.top - tr.top);
    const localX = relCssX * (mapCanvas.width / mr.width);
    const localY = relCssY * (mapCanvas.height / mr.height);
    // clamp
    return { x: Math.max(0, Math.min(mapCanvas.width, localX)), y: Math.max(0, Math.min(mapCanvas.height, localY)) };
  }

  // ---------- forward mapping (mapLocal -> client screen) for screenGrid ----------
  function textureF_to_screenNormalized(fx, fy) {
    const fpx = fx;
    const fpy = 1.0 - fy;
    const dx = fpx * 2 - 1;
    const dy = fpy * 2 - 1;
    const rd = Math.hypot(dx, dy);
    const k = cache.uDist;
    if (rd === 0 || k === 0) return { sx: (dx + 1) * 0.5, sy: (dy + 1) * 0.5 };
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

  function mapLocalToClient(px_local, py_local) {
    updateRects(false);
    const tr = cache.termRect, mr = cache.mapRect;
    if (!tr || !mr || !cache.termW || !cache.termH) {
      const rect = mapCanvas.getBoundingClientRect();
      return { cx: rect.left + (px_local / mapCanvas.width) * rect.width, cy: rect.top + (py_local / mapCanvas.height) * rect.height };
    }
    const fracX = px_local / mapCanvas.width;
    const fracY = py_local / mapCanvas.height;
    const cssX = (mr.left - tr.left) + fracX * mr.width;
    const cssY = (mr.top - tr.top) + fracY * mr.height;
    const fx = cssX / tr.width, fy = cssY / tr.height;
    const s = textureF_to_screenNormalized(fx, fy);
    const cx = tr.left + s.sx * tr.width, cy = tr.top + s.sy * tr.height;
    return { cx, cy };
  }

  // ---------- Recompute screenGrid (throttled) ----------
  function recomputeScreenGrid(force = false) {
    const now = performance.now();
    if (!force && (now - lastScreenRecompute) < 70) return; // throttle UI recomputes
    lastScreenRecompute = now;
    updateRects(false);
    screenGrid = [];
    for (let r = 0; r < INTER_COUNT; r++) {
      const row = [];
      for (let c = 0; c < INTER_COUNT; c++) {
        const p = gridPoints[r][c];
        row.push(mapLocalToClient(p.x, p.y));
      }
      screenGrid.push(row);
    }
    // update cached node screens
    for (let i = 0; i < nodes.length; i++) {
      nodes[i]._screen = mapLocalToClient(nodes[i].x, nodes[i].y);
    }
    log('screenGrid recomputed');
  }

  // ---------- Picking: sample neighborhood, inverse, map to map-local, choose nearest node ----------
  function pickNodeAtClient(clientX, clientY) {
    updateRects(false);
    const term = getTerminalCanvas();
    let best = { node: null, dist: Infinity, local: null };

    if (term && cache.termRect) {
      const termW = cache.termW, termH = cache.termH;
      const tr = cache.termRect;
      for (let i = 0; i < CLICK_SAMPLE_OFFSETS.length; i++) {
        const [ox, oy] = CLICK_SAMPLE_OFFSETS[i];
        const sx = clientX + ox, sy = clientY + oy;
        // client -> terminal backing pixel
        const termPxX = (sx - tr.left) * (termW / tr.width);
        const termPxY = (sy - tr.top) * (termH / tr.height);
        const und = applyInverseAtTermPixel(termPxX, termPxY);
        const local = terminalTexelToMapLocalSafe(und.x, und.y);
        if (!local) continue;
        for (const n of nodes) {
          const d = Math.hypot(local.x - n.x, local.y - n.y);
          if (d < best.dist) best = { node: n, dist: d, local };
        }
      }
      if (best.node && best.dist <= CLICK_THRESHOLD_MAP_PX) return best;
    }

    // fallback: direct mapCanvas coords (if terminal not found)
    try {
      const mr = cache.mapRect || mapCanvas.getBoundingClientRect();
      const relX = (clientX - mr.left) * (mapCanvas.width / mr.width);
      const relY = (clientY - mr.top) * (mapCanvas.height / mr.height);
      for (const n of nodes) {
        const d = Math.hypot(relX - n.x, relY - n.y);
        if (d < best.dist) best = { node: n, dist: d, local: { x: relX, y: relY } };
      }
      if (best.node && best.dist <= CLICK_THRESHOLD_MAP_PX) return best;
    } catch (e) { /* ignore */ }

    return null;
  }

  // safe wrapper
  function terminalTexelToMapLocalSafe(texX, texY) {
    try { return terminalTexelToMapLocal(texX, texY); } catch (e) { return null; }
  }

  // ---------- terminalTexelToMapLocal uses cache above ----------
  function terminalTexelToMapLocal(texX, texY) {
    const tr = cache.termRect, mr = cache.mapRect;
    if (!tr || !mr || !cache.termW || !cache.termH) return null;
    const fracX = texX / cache.termW, fracY = texY / cache.termH;
    const cssX = fracX * tr.width, cssY = fracY * tr.height;
    const relCssX = cssX - (mr.left - tr.left);
    const relCssY = cssY - (mr.top - tr.top);
    const localX = relCssX * (mapCanvas.width / mr.width);
    const localY = relCssY * (mapCanvas.height / mr.height);
    return { x: Math.max(0, Math.min(mapCanvas.width, localX)), y: Math.max(0, Math.min(mapCanvas.height, localY)) };
  }

  // ---------- Snap to nearest screenGrid intersection during drag ----------
  function snapNodeToScreen(clientX, clientY, node) {
    if (!screenGrid) recomputeScreenGrid(true);
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

  // ---------- Events: pointer handling with capture ----------
  function onPointerDown(ev) {
    ev.preventDefault();
    try { ev.target.setPointerCapture(ev.pointerId); } catch (e) {}
    recomputeScreenGrid(true);
    const found = pickNodeAtClient(ev.clientX, ev.clientY);
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
  }

  function onPointerMove(ev) {
    if (!draggingNode) return;
    // throttle: snap at pointer moves but low-cost
    snapNodeToScreen(ev.clientX, ev.clientY, draggingNode);
  }

  function onPointerUp(ev) {
    try { ev.target.releasePointerCapture(ev.pointerId); } catch (e) {}
    if (draggingNode) {
      // finalize snap (in case movement happened after last pointermove)
      snapNodeToScreen(ev.clientX, ev.clientY, draggingNode);
      draggingNode.drag = false;
      draggingNode = null;
    }
  }

  // keyboard lock/unlock
  function onKeyDown(ev) {
    if (!ev.key) return;
    if (ev.key.toLowerCase() === 'q' || ev.key.toLowerCase() === 'й') {
      const n = selectedNode;
      if (!n) return;
      const nearest = findNearestIntersection(n.x, n.y);
      const occupied = nodes.some(other => other !== n && other.locked && other.gx === nearest.col && other.gy === nearest.row);
      if (occupied) {
        statusEl.textContent = '⚠ Место занято';
        setTimeout(() => statusEl.textContent = defaultStatus(), 1200);
        return;
      }
      n.gx = nearest.col; n.gy = nearest.row;
      n.targetGx = n.gx; n.targetGy = n.gy;
      n.locked = !n.locked; n.lastMoveAt = performance.now();
      if (n.locked) {
        const p = gridPoints[n.gy][n.gx];
        n.x = p.x; n.y = p.y; n._screen = mapLocalToClient(n.x, n.y);
      }
    }
  }

  // ---------- Helpers ----------
  function findNearestIntersection(px, py) {
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

  // ---------- Draw (very cheap) ----------
  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(2,18,12,0.66)';
    roundRect(ctx, 0, 0, w, h, 8 * DPR);
    ctx.fill();

    // grid lines
    ctx.strokeStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.10)`;
    ctx.lineWidth = 1 * DPR;
    ctx.beginPath();
    for (let i = 0; i <= CELL_COUNT; i++) {
      const x = gridPoints[0][0].x + (i / CELL_COUNT) * (gridPoints[0][CELL_COUNT].x - gridPoints[0][0].x);
      ctx.moveTo(x, gridPoints[0][0].y); ctx.lineTo(x, gridPoints[INTER_COUNT - 1][0].y);
    }
    for (let j = 0; j <= CELL_COUNT; j++) {
      const y = gridPoints[0][0].y + (j / CELL_COUNT) * (gridPoints[INTER_COUNT - 1][0].y - gridPoints[0][0].y);
      ctx.moveTo(gridPoints[0][0].x, y); ctx.lineTo(gridPoints[0][INTER_COUNT - 1].x, y);
    }
    ctx.stroke();

    // connections (cheap n^2 but n small)
    ctx.save();
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const A = nodes[i], B = nodes[j];
        const d = Math.hypot(A.x - B.x, A.y - B.y);
        if (d < (w * 0.32)) {
          const baseAlpha = Math.max(0.10, 0.32 - (d / (w * 0.9)) * 0.22);
          const grad = ctx.createLinearGradient(A.x, A.y, B.x, B.y);
          grad.addColorStop(0, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${baseAlpha})`);
          grad.addColorStop(1, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${baseAlpha * 0.45})`);
          ctx.strokeStyle = grad; ctx.lineWidth = 1 * DPR; ctx.beginPath();
          ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        }
      }
    }
    ctx.restore();

    // nodes
    for (const n of nodes) {
      const pulse = 0.5 + 0.5 * Math.sin((n.id + (performance.now() / 60)) * 0.02);
      const intensity = n.selected ? 1.4 : (n.locked ? 1.2 : 1.0);
      const glowR = (6 * DPR + pulse * 3 * DPR) * intensity;
      const c = n.locked ? `rgba(255,60,60,${0.36 * intensity})` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.36 * intensity})`;
      const c2 = n.locked ? `rgba(255,60,60,${0.12 * intensity})` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.12 * intensity})`;
      const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
      grd.addColorStop(0, c); grd.addColorStop(0.6, c2); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.fillRect(n.x - glowR, n.y - glowR, glowR * 2, glowR * 2);

      ctx.beginPath();
      const coreR = 2.2 * DPR + (n.selected ? 1.6 * DPR : 0);
      ctx.fillStyle = n.locked ? `rgba(255,60,60,1)` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},1)`;
      ctx.arc(n.x, n.y, coreR, 0, Math.PI * 2); ctx.fill();

      ctx.beginPath(); ctx.lineWidth = 1 * DPR;
      ctx.strokeStyle = n.locked ? `rgba(255,60,60,0.92)` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.92)`;
      ctx.arc(n.x, n.y, coreR + 1.2 * DPR, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.save();
    ctx.font = `${10 * DPR}px monospace`;
    ctx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.95)`;
    ctx.textAlign = 'right';
    ctx.fillText('VIGIL NET', w - 8 * DPR, 12 * DPR);
    ctx.restore();
  }

  function roundRect(cnv, x, y, w, h, r) {
    cnv.beginPath();
    cnv.moveTo(x + r, y); cnv.arcTo(x + w, y, x + w, y + h, r);
    cnv.arcTo(x + w, y + h, x, y + h, r); cnv.arcTo(x, y + h, x, y, r);
    cnv.arcTo(x, y, x + w, y, r); cnv.closePath();
  }

  // ---------- Update loop ----------
  function update(dt) {
    // autonomous movement (keeps behavior)
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
        if (now - n.lastMoveAt > 800 + Math.random() * 1200) {
          const nb = pickNeighbor(n.gx, n.gy);
          n.targetGx = nb.gx; n.targetGy = nb.gy; n.lastMoveAt = now;
        }
      } else {
        const t = Math.min(1, (0.002 + Math.random() * 0.004) * (dt / 16));
        n.x += (targetP.x - n.x) * t; n.y += (targetP.y - n.y) * t;
        n._screen = null; // mark screen cache dirty
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

  function loop() {
    const now = performance.now();
    const dt = now - lastTick; lastTick = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  // ---------- Events wiring ----------
  function wireEvents() {
    window.addEventListener('resize', () => { resize(); updateRects(true); recomputeScreenGrid(true); }, { passive: true });
    window.addEventListener('scroll', () => { updateRects(true); recomputeScreenGrid(true); }, { passive: true });
    window.addEventListener('orientationchange', () => { updateRects(true); recomputeScreenGrid(true); }, { passive: true });

    // pointer events on mapCanvas
    mapCanvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    mapCanvas.addEventListener('pointermove', onPointerMove, { passive: true });
    mapCanvas.addEventListener('pointerup', onPointerUp, { passive: true });
    mapCanvas.addEventListener('pointercancel', onPointerUp, { passive: true });

    window.addEventListener('keydown', onKeyDown, { passive: true });

    checkBtn.addEventListener('click', () => {
      statusEl.textContent = 'ПРОВЕРКА...';
      setTimeout(() => statusEl.textContent = defaultStatus(), 800);
    });

    resetBtn.addEventListener('click', () => {
      for (const n of nodes) { n.locked = false; n.drag = false; n.selected = false; }
      respawnNodes();
      recomputeScreenGrid(true);
    });
  }

  // ---------- Init / Resize ----------
  function resize() {
    const cssW = CSS_SIZE, cssH = CSS_SIZE;
    mapCanvas.style.width = cssW + 'px';
    mapCanvas.style.height = cssH + 'px';
    w = mapCanvas.width = Math.max(120, Math.floor(cssW * DPR));
    h = mapCanvas.height = Math.max(120, Math.floor(cssH * DPR));
    buildGrid();
    if (!nodes || nodes.length === 0) respawnNodes();
    updateRects(true);
    recomputeScreenGrid(true);
    statusEl.textContent = defaultStatus();
  }

  // ---------- Debug API ----------
  window.netGrid_prod = window.netGrid_prod || {};
  window.netGrid_prod.debug = function() {
    updateRects(false);
    recomputeScreenGrid(true);
    return {
      termRect: cache.termRect,
      termSize: { w: cache.termW, h: cache.termH },
      mapRect: cache.mapRect,
      lutRegion: cache.lutRegion,
      lutCols: cache.lutCols,
      lutRows: cache.lutRows,
      lutStep: cache.lutStep,
      nodes: JSON.parse(JSON.stringify(nodes.map(n => ({ id: n.id, x: n.x, y: n.y, gx: n.gx, gy: n.gy, locked: n.locked })))),
      screenGridSample: screenGrid ? screenGrid.slice(0, 3) : null
    };
  };
  window.netGrid_prod.rebuildLUT = function(force) {
    if (force) cache.inverseLUT = null;
    buildInverseLUT();
    recomputeScreenGrid(true);
    return { lutCols: cache.lutCols, lutRows: cache.lutRows, step: cache.lutStep };
  };
  window.netGrid_prod.getNodes = () => nodes;

  // ---------- Start ----------
  try {
    resize();
    wireEvents();
    buildInverseLUT(); // build eagerly once - region may be unknown yet, will lazy rebuild if needed
    raf = requestAnimationFrame(loop);
    log('netGrid_production started');
    statusEl.textContent = defaultStatus();
  } catch (err) {
    console.error('netGrid_production fatal', err);
    statusEl.textContent = 'netGrid error — see console';
  }

  // Expose a careful note: I will NOT patch crt_overlay.js unless you say "patch crt".
  // If after this file you still see severe lag, say exactly: "crt" and I will provide
  // a single-file safe, non-visual-changing optimization for crt_overlay.js.
})();
