// netGrid_fixed.js — full replacement
// Stable, performant inverse-LUT limited to mapRect region + accurate hit-testing.
// Replace your current netGrid file fully with this.

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

    // MUST match crt_overlay.js DISTORTION (shader uniform uDist)
    const CRT_DISTORTION = 0.28;

    // LUT step (in terminal backing pixels) — tradeoff acc/perf. For map ~300px CSS and DPR <=1.5 it's small.
    const LUT_STEP = 2;

    // hit threshold in map-backbuffer pixels
    const CLICK_THRESHOLD = 12 * DPR;

    const DEV = false; // true => console.debug useful messages

    // ---------- create UI / map canvas ----------
    const mapCanvas = document.createElement('canvas');
    mapCanvas.id = 'netGridMapCanvas';
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
    const checkBtn = document.createElement('button'); checkBtn.textContent = 'ПРОВЕРИТЬ';
    const resetBtn = document.createElement('button'); resetBtn.textContent = '⟳';
    Object.assign(checkBtn.style, { padding:'6px 12px', borderRadius:'6px', cursor:'pointer' });
    Object.assign(resetBtn.style, { padding:'6px 12px', borderRadius:'6px', cursor:'pointer' });
    controls.appendChild(checkBtn); controls.appendChild(resetBtn);

    // ---------- state ----------
    let w = 0, h = 0;
    let gridPoints = [];
    let nodes = [];
    let selectedNode = null, draggingNode = null;
    let raf = null, tick = 0;

    // cached rects & terminal info
    const cached = {
      termRect: null, mapRect: null,
      termW: 0, termH: 0,
      // LUT region description: {sx, sy, sw, sh} in terminal backing pixels
      lutRegion: null,
      // inverseLUT storage: inverseLUT[row][col] = {x:texX, y:texY}
      inverseLUT: null,
      lutCols: 0, lutRows: 0, lutStep: LUT_STEP
    };

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
          locked: false, lastMoveAt: performance.now(), drag: false, selected: false
        };
      });
      selectedNode = null; draggingNode = null;
    }

    // ---------- cached rects / region for LUT ----------
    function getTerminalCanvas() {
      return document.getElementById('terminalCanvas') || null;
    }

    function updateRects(force = false) {
      const term = getTerminalCanvas();
      if (!term) {
        cached.termRect = null; cached.termW = 0; cached.termH = 0;
        cached.mapRect = mapCanvas.getBoundingClientRect();
        return;
      }
      const tr = term.getBoundingClientRect();
      const mr = mapCanvas.getBoundingClientRect();
      const tw = term.width, th = term.height;
      const changed = force ||
        !cached.termRect ||
        cached.termRect.width !== tr.width ||
        cached.termRect.height !== tr.height ||
        !cached.mapRect ||
        cached.mapRect.left !== mr.left ||
        cached.mapRect.top !== mr.top ||
        cached.termW !== tw || cached.termH !== th;
      if (changed) {
        cached.termRect = tr; cached.mapRect = mr; cached.termW = tw; cached.termH = th;
        // compute LUT region in terminal backing pixels that corresponds to mapRect area
        // mapRect may be partially outside termRect -> clamp
        const sx_px = Math.max(0, Math.round((mr.left - tr.left) * (tw / tr.width)));
        const sy_px = Math.max(0, Math.round((mr.top - tr.top) * (th / tr.height)));
        const sw_px = Math.max(1, Math.round(mr.width * (tw / tr.width)));
        const sh_px = Math.max(1, Math.round(mr.height * (th / tr.height)));
        cached.lutRegion = { sx: sx_px, sy: sy_px, sw: sw_px, sh: sh_px };
        // invalidate existing LUT to be rebuilt lazily
        cached.inverseLUT = null;
        cached.lutCols = 0; cached.lutRows = 0;
        if (DEV) console.debug('updateRects => lutRegion', cached.lutRegion);
      }
    }

    // ---------- build inverse LUT but ONLY for mapRect region in terminal texture ----------
    function buildInverseLUTForRegion() {
      if (!cached.termW || !cached.termH || !cached.lutRegion) return;
      const { sx, sy, sw, sh } = cached.lutRegion;
      const step = cached.lutStep = LUT_STEP;
      const cols = Math.ceil(sw / step);
      const rows = Math.ceil(sh / step);
      cached.lutCols = cols; cached.lutRows = rows;
      const k = CRT_DISTORTION;

      const lut = new Array(rows);
      for (let ry = 0; ry < rows; ry++) {
        const row = new Array(cols);
        for (let cx = 0; cx < cols; cx++) {
          const px = sx + cx * step;
          const py = sy + ry * step;
          // normalized distorted coordinates [-1..1]
          const xd = (px / cached.termW) * 2 - 1;
          const yd = (py / cached.termH) * 2 - 1;
          const rd = Math.hypot(xd, yd);
          // analytical solve for r: k*r^2 + (1-k)*r - rd = 0
          let r = rd;
          if (k === 0 || rd === 0) {
            r = rd;
          } else {
            const discriminant = (1 - k) * (1 - k) + 4 * k * rd;
            if (discriminant >= 0) {
              r = (-(1 - k) + Math.sqrt(discriminant)) / (2 * k);
              if (!(r > 0)) r = rd;
            } else {
              r = rd;
            }
          }
          // s = (1-k) + k*r ; uv = d / s  ; but earlier code used factor as below (equivalent)
          const factor = (r > 0) ? 1 / (1 + k * (r - 1)) : 1;
          const xn = xd * factor;
          const yn = yd * factor;
          // texel in terminal texture (undistorted)
          const texX = (xn + 1) * 0.5 * cached.termW;
          const texY = (yn + 1) * 0.5 * cached.termH;
          row[cx] = { x: texX, y: texY };
        }
        lut[ry] = row;
      }
      cached.inverseLUT = lut;
      if (DEV) console.debug('buildInverseLUTForRegion built', { cols, rows, step });
    }

    // ---------- apply inverse to an arbitrary terminal backing pixel (returns tex coords) ----------
    function applyInverseCRT_atTermPixel(px, py) {
      if (!cached.inverseLUT) buildInverseLUTForRegion();
      if (!cached.inverseLUT) return { x: px, y: py }; // fallback: identity

      const { sx, sy, sw, sh } = cached.lutRegion;
      const step = cached.lutStep;
      // compute indices into LUT (clamp)
      const relX = px - sx;
      const relY = py - sy;
      if (relX < 0 || relY < 0 || relX > sw || relY > sh) {
        // outside region: fallback to analytic single-point inversion (cheap)
        return analyticInverseSingle(px, py);
      }
      const fx = relX / step;
      const fy = relY / step;
      const cx = Math.floor(fx);
      const cy = Math.floor(fy);
      const cx1 = Math.min(cx + 1, cached.lutCols - 1);
      const cy1 = Math.min(cy + 1, cached.lutRows - 1);
      const tx00 = cached.inverseLUT[cy][cx];
      const tx10 = cached.inverseLUT[cy][cx1];
      const tx01 = cached.inverseLUT[cy1][cx];
      const tx11 = cached.inverseLUT[cy1][cx1];
      const fracX = Math.min(1, Math.max(0, fx - cx));
      const fracY = Math.min(1, Math.max(0, fy - cy));
      // bilinear interp
      const ixTopX = tx00.x * (1 - fracX) + tx10.x * fracX;
      const ixTopY = tx00.y * (1 - fracX) + tx10.y * fracX;
      const ixBotX = tx01.x * (1 - fracX) + tx11.x * fracX;
      const ixBotY = tx01.y * (1 - fracX) + tx11.y * fracX;
      const finalX = ixTopX * (1 - fracY) + ixBotX * fracY;
      const finalY = ixTopY * (1 - fracY) + ixBotY * fracY;
      return { x: finalX, y: finalY };
    }

    // fallback analytic inversion used only rarely (outside LUT region)
    function analyticInverseSingle(termPxX, termPxY) {
      const termW = cached.termW, termH = cached.termH;
      if (!termW || !termH) return { x: termPxX, y: termPxY };
      // normalized [-1..1]
      const nx = (termPxX / termW) * 2 - 1;
      const ny = (termPxY / termH) * 2 - 1;
      const rd = Math.hypot(nx, ny);
      const k = CRT_DISTORTION;
      let r = rd;
      if (k === 0 || rd === 0) r = rd;
      else {
        const disc = (1 - k) * (1 - k) + 4 * k * rd;
        if (disc >= 0) r = (-(1 - k) + Math.sqrt(disc)) / (2 * k);
      }
      const factor = (r > 0) ? 1 / (1 + k * (r - 1)) : 1;
      const xn = nx * factor;
      const yn = ny * factor;
      return { x: (xn + 1) * 0.5 * termW, y: (yn + 1) * 0.5 * termH };
    }

    // ---------- mapping terminal texture pixel -> mapCanvas local pixel ----------
    function terminalTexelToMapLocal(texX, texY) {
      const tr = cached.termRect, mr = cached.mapRect;
      if (!tr || !mr || !cached.termW || !cached.termH) return null;
      const fracX = texX / cached.termW;
      const fracY = texY / cached.termH;
      const cssX = fracX * tr.width;
      const cssY = fracY * tr.height;
      const relCssX = cssX - (mr.left - tr.left);
      const relCssY = cssY - (mr.top - tr.top);
      const localX = relCssX * (mapCanvas.width / mr.width);
      const localY = relCssY * (mapCanvas.height / mr.height);
      return { x: localX, y: localY };
    }

    // ---------- main pick function (called on click) ----------
    function pickNodeFromClient(clientX, clientY) {
      updateRects(false);
      const term = getTerminalCanvas();
      let best = { node: null, dist: Infinity, local: null };

      if (term && cached.termRect) {
        // convert client to terminal backing pixels
        const tr = cached.termRect;
        const termW = cached.termW, termH = cached.termH;
        // sample small neighborhood to avoid micro-mismatch (center + 4 offsets)
        const samples = [[0,0],[-3,0],[3,0],[0,-3],[0,3]];
        for (let i = 0; i < samples.length; i++) {
          const sx = clientX + samples[i][0];
          const sy = clientY + samples[i][1];
          const termPxX = (sx - tr.left) * (termW / tr.width);
          const termPxY = (sy - tr.top) * (termH / tr.height);
          // invert (using LUT)
          const undTex = applyInverseCRT_atTermPixel(termPxX, termPxY);
          // map to map-local
          const local = terminalTexelToMapLocal(undTex.x, undTex.y);
          if (!local) continue;
          // find nearest node in map-local coords
          for (const n of nodes) {
            const d = Math.hypot(local.x - n.x, local.y - n.y);
            if (d < best.dist) { best = { node: n, dist: d, local }; }
          }
        }
        if (best.node && best.dist <= CLICK_THRESHOLD) {
          if (DEV) console.debug('picked via term flow', best);
          return best;
        }
      }

      // fallback: direct mapCanvas mapping (if terminal absent)
      try {
        const mr = cached.mapRect || mapCanvas.getBoundingClientRect();
        const relX = (clientX - mr.left) * (mapCanvas.width / mr.width);
        const relY = (clientY - mr.top) * (mapCanvas.height / mr.height);
        for (const n of nodes) {
          const d = Math.hypot(relX - n.x, relY - n.y);
          if (d < best.dist) best = { node: n, dist: d, local: { x: relX, y: relY } };
        }
        if (best.node && best.dist <= CLICK_THRESHOLD) {
          if (DEV) console.debug('picked via fallback map flow', best);
          return best;
        }
      } catch (e) { /* ignore */ }

      if (DEV) console.debug('no pick', best);
      return null;
    }

    // ---------- events ----------
    window.addEventListener('resize', () => { resize(); updateRects(true); }, { passive: true });
    window.addEventListener('scroll', () => updateRects(true), { passive: true });
    window.addEventListener('orientationchange', () => updateRects(true), { passive: true });

    window.addEventListener('mousemove', (ev) => {
      // keep mouse cheap (we do heavy work on click)
      // change cursor when hovering near last-known nodes (cheap approximation)
      // compute a quick local map position from last LUT if available
      // (not strictly necessary; keep minimal)
      // no-op here to keep responsiveness
    }, { passive: true });

    // mousedown: robust pick
    window.addEventListener('mousedown', (ev) => {
      const found = pickNodeFromClient(ev.clientX, ev.clientY);
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

    window.addEventListener('mouseup', () => {
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
      // dragging update: while dragging we snap node to nearest grid intersection (map-local)
      if (draggingNode) {
        // draggingNode.x/y are map-local; we compute nearest intersection around mouse by sampling current map position
        // to get better user feel we do nothing here because pick/drag already set drag=true and initial node position is used.
      }
      // autonomous movement
      const now = performance.now();
      for (const n of nodes) {
        if (n.drag) continue;
        if (n.locked) {
          const p = gridPoints[n.gy][n.gx]; n.x = p.x; n.y = p.y; n.targetGx = n.gx; n.targetGy = n.gy; continue;
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
          const p = targetP; const t = Math.min(1, n.speed * (dt / 16) * (1 + Math.random() * 0.6));
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

    // ---------- init / resize ----------
    function resize() {
      const cssW = SIZE_CSS, cssH = SIZE_CSS;
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

    // ---------- debug helper (call from console) ----------
    window.netGrid = window.netGrid || {};
    window.netGrid.debugRects = function(){ updateRects(false); return { termRect: cached.termRect, termSize:{w:cached.termW,h:cached.termH}, mapRect: cached.mapRect, lutRegion: cached.lutRegion, lutCols: cached.lutCols, lutRows: cached.lutRows }; };
    window.netGrid.forceRebuildLUT = function(){ cached.inverseLUT = null; buildInverseLUTForRegion(); return {lutCols: cached.lutCols, lutRows: cached.lutRows}; };

    window.netGrid.nodes = nodes;
    window.netGrid.getMouseLocal = () => ({});
    console.info('netGrid_fixed loaded — inverse-LUT limited to mapRect region');

  } catch (err) {
    console.error('netGrid_fixed fatal', err);
  }
})();
