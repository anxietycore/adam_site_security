// netGrid_v5_FINAL.js — Universal robust netGrid
// - Auto-detects whether grid is drawn on a separate mapCanvas or on terminalCanvas
// - Implements exact forward shader math used in your crt_overlay (uv->r->mix->f)
// - Implements analytic inverse mapping (no LUT, no iterations)
// - Provides optional 4-point calibrator (netGridFinal.calibrate())
// - Debug API: netGridFinal.debug(), netGridFinal.calibrate(), netGridFinal.forcemap('<id>')
//
// Replace your netGrid file with this one, reload page, test. If something still off,
// run: console.log(window.netGridFinal.debug()) and paste output here.

(() => {
  'use strict';

  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const SIZE_CSS = 300;
  const COLOR = { r: 6, g: 160, b: 118 };
  const CELL_COUNT = 6;
  const INTER_COUNT = CELL_COUNT + 1;
  const NODE_COUNT = 10;
  const AUTONOMOUS_MOVE_COOLDOWN = 800;

  // MUST match crt_overlay.js value — if different, call netGridFinal.setDistortion(v)
  let CRT_DISTORTION = 0.28;

  // ---------- find canvases (best-effort detection) ----------
  function findMapCanvasCandidate() {
    const ids = ['netGridMapCanvas','netGrid_map','netGrid_mapCanvas','mapCanvas'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.tagName === 'CANVAS') return el;
    }
    // heuristics: canvas with small fixed size in corner, or canvases created by our earlier scripts
    const canvases = Array.from(document.querySelectorAll('canvas'));
    // prefer canvases positioned fixed with small size in corner
    for (const c of canvases) {
      const st = getComputedStyle(c);
      if (st.position === 'fixed' && parseFloat(st.width) <= SIZE_CSS + 40) return c;
    }
    // fallback: any canvas that has width/height <= 1024 and not fullscreen may be map
    for (const c of canvases) {
      if (c.width <= 1024 && c.height <= 1024 && c.clientWidth < window.innerWidth * 0.9) return c;
    }
    return null;
  }

  function findTerminalCanvas() {
    // common id 'terminalCanvas' used in your project
    const t = document.getElementById('terminalCanvas');
    if (t && t.tagName === 'CANVAS') return t;
    // fallback to first large canvas (likely terminal)
    const canv = Array.from(document.querySelectorAll('canvas'));
    let best = null;
    for (const c of canv) {
      if (!best) best = c;
      if (c.width > best.width) best = c;
    }
    return best || null;
  }

  const mapCanvas_auto = findMapCanvasCandidate();
  const terminalCanvas_auto = findTerminalCanvas();
  const overlayCanvas_auto = document.getElementById('crtOverlayCanvas') || null;

  // ---------- DOM: if no mapCanvas found, create our visible mapCanvas (safe) ----------
  const userProvidedMap = !!mapCanvas_auto;
  const mapCanvas = mapCanvas_auto || (() => {
    const c = document.createElement('canvas');
    c.id = 'netGridMapCanvas_auto';
    Object.assign(c.style, {
      position: 'fixed', right: '20px', bottom: '20px',
      width: `${SIZE_CSS}px`, height: `${SIZE_CSS}px`,
      zIndex: 99999, pointerEvents: 'auto', borderRadius: '8px',
      boxShadow: '0 18px 40px rgba(0,0,0,0.9)', backgroundColor: 'rgba(0,10,6,0.28)'
    });
    document.body.appendChild(c);
    return c;
  })();

  // prefer explicit terminals if present
  const terminalCanvas = terminalCanvas_auto || null;
  const overlayCanvas = overlayCanvas_auto || null;

  // ---------- Setup mapCanvas context ----------
  const mctx = mapCanvas.getContext('2d');

  // ---------- state ----------
  let cssW = SIZE_CSS, cssH = SIZE_CSS;
  let w = Math.max(120, Math.floor(cssW * DPR));
  let h = Math.max(120, Math.floor(cssH * DPR));
  mapCanvas.width = w; mapCanvas.height = h;
  mapCanvas.style.width = cssW + 'px'; mapCanvas.style.height = cssH + 'px';

  let gridPoints = [];
  let nodes = [];
  let selectedNode = null;
  let draggingNode = null;
  let tick = 0;

  // ---------- build grid & nodes ----------
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
      const j = Math.floor(Math.random() * (i + 1)); [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    const chosen = positions.slice(0, NODE_COUNT);
    nodes = chosen.map((rc, idx) => {
      const [r, c] = rc;
      const p = gridPoints[r][c];
      return {
        id: idx, gx: c, gy: r, x: p.x, y: p.y,
        targetGx: c, targetGy: r, speed: 0.002 + Math.random() * 0.004,
        locked: false, lastMoveAt: performance.now() - Math.random() * 1000, drag: false, selected: false
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

  function pickNeighbor(gx, gy) {
    const candidates = [];
    if (gy > 0) candidates.push({ gx, gy: gy - 1 });
    if (gy < INTER_COUNT - 1) candidates.push({ gx, gy: gy + 1 });
    if (gx > 0) candidates.push({ gx: gx - 1, gy });
    if (gx < INTER_COUNT - 1) candidates.push({ gx: gx + 1, gy });
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : { gx, gy };
  }

  // ---------- drawing ----------
  function drawGridAndNodes() {
    mctx.clearRect(0, 0, w, h);
    mctx.fillStyle = 'rgba(2,18,12,0.66)';
    roundRect(mctx, 0, 0, w, h, 8 * DPR); mctx.fill();

    mctx.strokeStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.10)`; mctx.lineWidth = 1 * DPR;
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

    // connections (cheap)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const A = nodes[i], B = nodes[j];
        const d = Math.hypot(A.x - B.x, A.y - B.y);
        if (d < (w * 0.32)) {
          const baseAlpha = Math.max(0.10, 0.32 - (d / (w * 0.9)) * 0.22);
          const grad = mctx.createLinearGradient(A.x, A.y, B.x, B.y);
          grad.addColorStop(0, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${baseAlpha})`);
          grad.addColorStop(1, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${baseAlpha * 0.45})`);
          mctx.strokeStyle = grad; mctx.lineWidth = 1 * DPR;
          mctx.beginPath(); mctx.moveTo(A.x, A.y); mctx.lineTo(B.x, B.y); mctx.stroke();
        }
      }
    }

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
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---------- shader forward mapping (exactly same as your fragment shader) ----------
  // input: normalized vUV in [0..1]; returns f in [0..1] (texture lookup coords used by shader)
  function shaderForward_uvToF(u, v, k = CRT_DISTORTION) {
    // uv mapped to [-1..1]
    let uvx = u * 2 - 1;
    let uvy = v * 2 - 1;
    const r = Math.hypot(uvx, uvy);
    // mix(uv, uv * r, k)
    const dx = uvx * (1 - k) + (uvx * r) * k;
    const dy = uvy * (1 - k) + (uvy * r) * k;
    let fx = (dx + 1) * 0.5;
    let fy = (dy + 1) * 0.5;
    fy = 1.0 - fy; // shader flips Y
    return { fx, fy };
  }

  // ---------- analytic inverse mapping for the specific mix(uv, uv*r, k) model ----------
  // input: f in [0..1] (texture sample coords) -> returns vUV in [0..1] (screen uv)
  function shaderInverse_fToUV(fx, fy, k = CRT_DISTORTION) {
    // undo flip
    let dy = 1.0 - fy;
    // d in [-1..1]
    const dx = fx * 2 - 1;
    const dvy = dy * 2 - 1;
    const dr = Math.hypot(dx, dvy);
    if (dr < 1e-6 || k === 0) {
      // near center, identity
      const ux = (dx + 1) * 0.5;
      const uy = (dvy + 1) * 0.5;
      return { u: ux, v: uy };
    }
    // Solve for r such that d = uv*(1-k) + uv*r*k = uv*((1-k)+k*r)
    // Let s = (1-k)+k*r -> uv = d / s ; r = length(uv) = length(d)/s = dr/s => s = (1-k)+k*(dr/s) -> quadratic in s
    // Rearrange: s = (1 - k) + k*(dr/s) => s^2 - (1-k)*s - k*dr = 0
    const a = 1.0;
    const b = -(1.0 - k);
    const c = -k * dr;
    // quadratic s^2 + b*s + c = 0  (note sign already incorporated)
    const disc = b * b - 4 * a * c;
    let s = (disc >= 0) ? ((-b + Math.sqrt(disc)) / (2 * a)) : (1.0 - k);
    if (!isFinite(s) || s === 0) s = 1.0 - k;
    const ux = dx / s;
    const uy = dvy / s;
    // now uv in [-1..1] range -> convert to [0..1]
    return { u: (ux + 1) * 0.5, v: (uy + 1) * 0.5 };
  }

  // ---------- convert client (ev.clientX, clientY) -> mapCanvas local device pixels ----------
  // Strategy (robust):
  // 1) if overlayCanvas + terminalCanvas present: compute vUV relative to overlay, forward shader -> texture f
  // 2) convert f to terminalCss pixels (f * terminalCssW/H)
  // 3) find where mapCanvas is drawn inside terminal (mapRect = mapCanvas.getBoundingClientRect())
  // 4) compute local fraction inside mapRect and scale to mapCanvas.width/height
  // Fallbacks:
  // - if mapCanvas occupies whole terminal or terminal absent -> map pixel computed directly from f * terminal.width/height
  // - ultimate fallback -> direct conversion from client -> mapCanvas bounding rect
  function getMousePosOnMap(ev) {
    try {
      const overlay = document.getElementById('crtOverlayCanvas') || overlayCanvas;
      const terminal = document.getElementById('terminalCanvas') || terminalCanvas;
      // overlay rect used to compute vUV; if overlay absent, assume fullscreen
      const overlayRect = overlay ? overlay.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      const u = (ev.clientX - overlayRect.left) / overlayRect.width;
      const v = (ev.clientY - overlayRect.top) / overlayRect.height;
      const cu = Math.max(0, Math.min(1, u));
      const cv = Math.max(0, Math.min(1, v));
      // apply forward shader mapping to compute texture sample coords f
      const f = shaderForward_uvToF(cu, cv, CRT_DISTORTION);
      // now get terminal CSS size to compute css coords tx_css, ty_css
      const termRect = terminal ? terminal.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      const tx_css = f.fx * termRect.width + termRect.left;
      const ty_css = f.fy * termRect.height + termRect.top;
      // determine mapRect: where mapCanvas is drawn inside terminal (or on page)
      const mapRect = mapCanvas.getBoundingClientRect();
      // If tx_css falls within mapRect, convert proportionally to mapCanvas device pixels
      if (tx_css >= mapRect.left - 1 && tx_css <= mapRect.right + 1 && ty_css >= mapRect.top - 1 && ty_css <= mapRect.bottom + 1 && mapRect.width > 2 && mapRect.height > 2) {
        const localX = (tx_css - mapRect.left) / mapRect.width;
        const localY = (ty_css - mapRect.top) / mapRect.height;
        const mapX = Math.max(0, Math.min(mapCanvas.width, localX * mapCanvas.width));
        const mapY = Math.max(0, Math.min(mapCanvas.height, localY * mapCanvas.height));
        return { x: mapX, y: mapY, mode: 'overlay->term->map' };
      }
      // fallback: if terminal present and mapRect doesn't contain tx_css, maybe mapCanvas was drawn scaled: attempt direct term->map mapping
      if (terminal && terminal.width && terminal.height) {
        const mapX = Math.max(0, Math.min(mapCanvas.width, f.fx * mapCanvas.width));
        const mapY = Math.max(0, Math.min(mapCanvas.height, f.fy * mapCanvas.height));
        return { x: mapX, y: mapY, mode: 'overlay->term->map-fallback' };
      }
      // ultimate fallback: client -> map bounding rect
      const rect = mapCanvas.getBoundingClientRect();
      const rawX = (ev.clientX - rect.left) * (mapCanvas.width / rect.width);
      const rawY = (ev.clientY - rect.top) * (mapCanvas.height / rect.height);
      return { x: rawX, y: rawY, mode: 'client->map-fallback' };
    } catch (e) {
      const rect = mapCanvas.getBoundingClientRect();
      const rawX = (ev.clientX - rect.left) * (mapCanvas.width / rect.width);
      const rawY = (ev.clientY - rect.top) * (mapCanvas.height / rect.height);
      return { x: rawX, y: rawY, mode: 'exception-fallback' };
    }
  }

  // ---------- events ----------
  function onPointerDown(ev) {
    const m = getMousePosOnMap(ev);
    const mx = m.x, my = m.y;
    let found = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const d = Math.hypot(mx - n.x, my - n.y);
      if (d < 12 * DPR) { found = n; break; }
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
  }

  function onPointerMove(ev) {
    const m = getMousePosOnMap(ev);
    const mx = m.x, my = m.y;
    let hovered = null;
    for (const n of nodes) {
      if (Math.hypot(mx - n.x, my - n.y) < 12 * DPR) { hovered = n; break; }
    }
    mapCanvas.style.cursor = (hovered && hovered.locked) ? 'not-allowed' : (hovered ? 'pointer' : 'default');
    if (draggingNode && draggingNode.locked) { draggingNode.drag = false; draggingNode = null; }
    if (draggingNode) {
      const nearest = nearestIntersection(mx, my);
      draggingNode.gx = nearest.col; draggingNode.gy = nearest.row;
      draggingNode.targetGx = nearest.col; draggingNode.targetGy = nearest.row;
      const p = gridPoints[nearest.row][nearest.col];
      draggingNode.x = p.x; draggingNode.y = p.y;
    }
  }

  function onPointerUp(ev) {
    if (draggingNode) {
      const n = draggingNode;
      const nearest = nearestIntersection(n.x, n.y);
      n.gx = nearest.col; n.gy = nearest.row;
      const p = gridPoints[n.gy][n.gx]; n.x = p.x; n.y = p.y;
      n.drag = false; draggingNode = null;
    }
  }

  // keyboard lock/unlock
  function onKeyDown(ev) {
    if (!ev.key) return;
    if (ev.key.toLowerCase() === 'q' || ev.key.toLowerCase() === 'й') {
      const n = selectedNode;
      if (!n) return;
      const nearest = nearestIntersection(n.x, n.y);
      const isOccupied = nodes.some(other => other !== n && other.locked && other.gx === nearest.col && other.gy === nearest.row);
      if (isOccupied) return;
      n.gx = nearest.col; n.gy = nearest.row; n.targetGx = n.gx; n.targetGy = n.gy;
      n.locked = !n.locked; n.lastMoveAt = performance.now();
      if (n.locked) { const p = gridPoints[n.gy][n.gx]; n.x = p.x; n.y = p.y; }
    }
  }

  // ---------- update & loop ----------
  function update(dt) {
    tick++;
    const now = performance.now();
    for (const n of nodes) {
      if (n.drag) continue;
      if (n.locked) { const p = gridPoints[n.gy][n.gx]; n.x = p.x; n.y = p.y; n.targetGx = n.gx; n.targetGy = n.gy; continue; }
      const tp = gridPoints[n.targetGy][n.targetGx];
      const dist = Math.hypot(n.x - tp.x, n.y - tp.y);
      if (dist < 1.4 * DPR) {
        n.gx = n.targetGx; n.gy = n.targetGy;
        if (now - n.lastMoveAt > AUTONOMOUS_MOVE_COOLDOWN + Math.random() * 1200) {
          const nb = pickNeighbor(n.gx, n.gy); n.targetGx = nb.gx; n.targetGy = nb.gy; n.lastMoveAt = now;
        }
      } else {
        const p = tp; const t = Math.min(1, n.speed * (dt / 16) * (1 + Math.random() * 0.6));
        n.x += (p.x - n.x) * t; n.y += (p.y - n.y) * t;
      }
    }
  }

  function loop() {
    const now = performance.now();
    const dt = now - (loop._last || now);
    loop._last = now;
    update(dt);
    drawGridAndNodes();
    requestAnimationFrame(loop);
  }

  // ---------- resize ----------
  function resizeAll() {
    // keep css size constant but sync device pixels
    mapCanvas.style.width = cssW + 'px'; mapCanvas.style.height = cssH + 'px';
    w = mapCanvas.width = Math.max(120, Math.floor(cssW * DPR));
    h = mapCanvas.height = Math.max(120, Math.floor(cssH * DPR));
    buildGrid(); if (!nodes || nodes.length === 0) respawnNodes();
  }
  window.addEventListener('resize', resizeAll);

  // ---------- calibrator (optional manual) ----------
  // quick 4-point calibrator: click 4 visible intersections (corners) to compute homography
  // If auto-detection misses, use this: netGridFinal.calibrate()
  (function createCalibrator() {
    const overlay = document.createElement('canvas');
    overlay.id = 'netGrid_calib_overlay_v5';
    overlay.style.position = 'fixed'; overlay.style.left = '0'; overlay.style.top = '0';
    overlay.style.width = '100%'; overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none'; overlay.style.zIndex = 2147483647;
    document.body.appendChild(overlay);
    const ctx = overlay.getContext('2d');
    function resize() { overlay.width = Math.round(window.innerWidth * DPR); overlay.height = Math.round(window.innerHeight * DPR); ctx.setTransform(1,0,0,1,0,0); ctx.scale(DPR, DPR); }
    window.addEventListener('resize', resize); resize();

    let state = { active: false, points: [], H: null };

    function draw() {
      ctx.clearRect(0, 0, overlay.width, overlay.height / DPR);
      if (!state.active) return;
      ctx.strokeStyle = 'yellow'; ctx.fillStyle = 'yellow'; ctx.lineWidth = 2;
      for (let i = 0; i < state.points.length; i++) {
        const p = state.points[i];
        ctx.beginPath(); ctx.arc(p.sx, p.sy, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillText((i + 1).toString(), p.sx + 8, p.sy + 6);
      }
    }

    function addPoint(sx, sy) {
      // nearest grid intersection in client space
      // map grid intersections to client coords via mapCanvas.getBoundingClientRect()
      const mapRect = mapCanvas.getBoundingClientRect();
      const pts = [];
      const margin = 12 * DPR;
      const innerW = mapCanvas.width - margin * 2;
      const innerH = mapCanvas.height - margin * 2;
      for (let r = 0; r <= 6; r++) for (let c = 0; c <= 6; c++) {
        const mx = margin + (c / 6) * innerW;
        const my = margin + (r / 6) * innerH;
        const clientX = mapRect.left + (mx / mapCanvas.width) * mapRect.width;
        const clientY = mapRect.top + (my / mapCanvas.height) * mapRect.height;
        pts.push({ r, c, mx, my, cx: clientX, cy: clientY });
      }
      let best = null;
      for (const p of pts) {
        const d = Math.hypot(p.cx - sx, p.cy - sy);
        if (!best || d < best.d) best = { ...p, d };
      }
      if (best) {
        state.points.push({ sx, sy, mx: best.mx, my: best.my, rx: best.r, cx: best.c });
        draw();
      }
      if (state.points.length === 4) {
        // build homography (8x8 solve)
        const H = computeHomography(state.points.slice(0, 4).map(p => ({ sx: p.sx, sy: p.sy, mx: p.mx, my: p.my })));
        state.H = H; state.active = false;
        console.log('Calibration H:', H);
      }
    }

    // light-weight gaussian solver to compute homography — same as earlier calibrator
    function solveLinear(A, b) {
      const n = A.length;
      const M = new Array(n);
      for (let i = 0; i < n; i++) { M[i] = new Float64Array(n + 1); for (let j = 0; j < n; j++) M[i][j] = A[i][j]; M[i][n] = b[i]; }
      for (let k = 0; k < n; k++) {
        let maxRow = k, maxVal = Math.abs(M[k][k]);
        for (let r = k + 1; r < n; r++) { const v = Math.abs(M[r][k]); if (v > maxVal) { maxVal = v; maxRow = r; } }
        if (maxVal === 0) return null;
        if (maxRow !== k) { const tmp = M[k]; M[k] = M[maxRow]; M[maxRow] = tmp; }
        const pivot = M[k][k]; for (let c = k; c <= n; c++) M[k][c] /= pivot;
        for (let r = 0; r < n; r++) { if (r === k) continue; const f = M[r][k]; if (f === 0) continue; for (let c = k; c <= n; c++) M[r][c] -= f * M[k][c]; }
      }
      const x = new Array(n); for (let i = 0; i < n; i++) x[i] = M[i][n]; return x;
    }

    function computeHomography(pts) {
      if (!pts || pts.length < 4) return null;
      const A = [], B = [];
      for (let i = 0; i < 4; i++) {
        const p = pts[i];
        const x = p.sx, y = p.sy, u = p.mx, v = p.my;
        A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
        A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
      }
      const h8 = solveLinear(A, B); if (!h8) return null;
      return [[h8[0], h8[1], h8[2]], [h8[3], h8[4], h8[5]], [h8[6], h8[7], 1]];
    }

    // public control
    window.netGridFinalCalibrator = {
      start: function () { state.active = true; state.points = []; overlay.style.pointerEvents = 'auto'; overlay.addEventListener('click', onClick); draw(); console.log('Calibrator: click 4 visible intersections'); },
      stop: function () { state.active = false; overlay.style.pointerEvents = 'none'; overlay.removeEventListener('click', onClick); draw(); console.log('Calibrator: stopped'); },
      state: function () { return JSON.parse(JSON.stringify(state)); },
      destroy: function () { overlay.remove(); delete window.netGridFinalCalibrator; }
    };

    function onClick(ev) { if (!state.active) return; const sx = ev.clientX, sy = ev.clientY; addPoint(sx, sy); }

    // computeHomography/applyHomography used in debug if needed
  })();

  // ---------- debug & API ----------
  const API = {
    debug: function () {
      return {
        CRT_DISTORTION,
        mapCanvasId: mapCanvas.id || null,
        mapCanvasSize: { w: mapCanvas.width, h: mapCanvas.height, cssW: mapCanvas.clientWidth, cssH: mapCanvas.clientHeight },
        terminalCanvasId: terminalCanvas && terminalCanvas.id ? terminalCanvas.id : null,
        overlayCanvasId: overlayCanvas && overlayCanvas.id ? overlayCanvas.id : null,
        sample: (function () {
          const rect = mapCanvas.getBoundingClientRect();
          return { rect, userProvidedMap, detectMode: overlayCanvas ? 'overlay present' : 'overlay absent' };
        })()
      };
    },
    setDistortion: function (v) { CRT_DISTORTION = +v; console.log('CRT_DISTORTION set to', CRT_DISTORTION); },
    calibrate: function () { if (window.netGridFinalCalibrator) window.netGridFinalCalibrator.start(); else console.warn('Calibrator not available'); },
    forcemap: function (id) {
      const el = document.getElementById(id);
      if (el && el.tagName === 'CANVAS') { console.log('forcemap -> using', id); /* nothing else — manual override not implemented beyond detection */ }
      else console.warn('forcemap: id not found or not canvas');
    },
    getNodes: function () { return nodes.map(n => ({ id: n.id, gx: n.gx, gy: n.gy, x: n.x, y: n.y, locked: n.locked })); }
  };
  window.netGridFinal = API;

  // ---------- wire events ----------
  mapCanvas.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('keydown', onKeyDown, { passive: true });

  // ---------- start ----------
  buildGrid(); respawnNodes(); drawGridAndNodes(); requestAnimationFrame(loop);

  console.info('netGrid_v5_FINAL loaded — auto-detect mode:', userProvidedMap ? 'mapCanvas found' : 'mapCanvas auto-created');
})();
