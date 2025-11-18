// netGrid_fixed_v4.js — FIXED VIGIL NET GRID v4 (interactive grid, nodes move only on grid-lines)
// Replaces netGrid_v3.js — main fix: reliable mouse -> mapCanvas mapping through CRT shader math
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

    // MUST match crt_overlay.js DISTORTION
    const CRT_DISTORTION = 0.28;

    // ----- DOM: canvas + status + victory + controls -----
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
      textShadow: `0 0 10px rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 0.9)`,
      zIndex: STATUS_Z,
      pointerEvents: 'none',
      userSelect: 'none',
      letterSpacing: '0.6px',
      fontWeight: '700',
      opacity: '1',
    });
    document.body.appendChild(statusEl);

    const victoryEl = document.createElement('div');
    Object.assign(victoryEl.style, {
      pointerEvents: 'none',
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%,-50%)',
      color: `rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 1)`,
      fontSize: '36px',
      fontWeight: '900',
      textShadow: `0 0 18px rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 0.85)`,
      zIndex: 80,
      display: 'none',
      textAlign: 'center',
      padding: '10px 20px',
      borderRadius: '8px',
      background: 'rgba(0,0,0,0.35)'
    });
    victoryEl.textContent = 'Ура, победил!';
    document.body.appendChild(victoryEl);

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
    checkBtn.textContent = 'ПРОВЕРИТЬ ПРИКОЛ';
    Object.assign(checkBtn.style, {
      padding: '8px 18px',
      borderRadius: '6px',
      border: `2px solid rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.95)`,
      background: 'rgba(0,0,0,0.5)',
      color: `rgba(${COLOR.r},${COLOR.g},${COLOR.b},1)`,
      fontFamily: 'Courier, monospace',
      cursor: 'pointer',
      fontWeight: '700',
      letterSpacing: '1px'
    });
    controls.appendChild(checkBtn);

    const resetBtn = document.createElement('button');
    resetBtn.textContent = '⟳';
    Object.assign(resetBtn.style, {
      padding: '8px 12px',
      borderRadius: '6px',
      border: `2px solid rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.95)`,
      background: 'rgba(0,0,0,0.5)',
      color: `rgba(${COLOR.r},${COLOR.g},${COLOR.b},1)`,
      fontFamily: 'Courier, monospace',
      cursor: 'pointer',
      fontWeight: '700'
    });
    controls.appendChild(resetBtn);

    // ----- internal state -----
    let w = 0, h = 0; // internal canvas pixels (device px)
    let cssW = SIZE_CSS, cssH = SIZE_CSS; // css pixels for style
    let gridPoints = [];
    let nodes = [];
    let raf = null;
    let tick = 0;

    let selectedNode = null;
    let draggingNode = null;
    let mouse = { x: 0, y: 0, down: false };

    const SYMBOLS = {
      V: [
        [0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],
        [6,0],[5,1],[4,2]
      ],
      I: [
        [0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3]
      ],
      X: [
        [0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],
        [0,6],[1,5],[2,4],[4,2],[5,1],[6,0]
      ]
    };
    const symbolNames = Object.keys(SYMBOLS);
    const currentTargetName = symbolNames[Math.floor(Math.random()*symbolNames.length)];
    const currentTarget = SYMBOLS[currentTargetName];

    statusEl.textContent = `TARGET: ${currentTargetName}  |  Q/Й = lock/unlock selected node`;

    // ----- helpers -----
    function glowColor(a=1){ return `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${a})`; }
    function redColor(a=1){ return `rgba(255,60,60,${a})`; }

    function resize() {
      cssW = SIZE_CSS; cssH = SIZE_CSS;
      mapCanvas.style.width = cssW + 'px';
      mapCanvas.style.height = cssH + 'px';
      w = mapCanvas.width = Math.max(120, Math.floor(cssW * DPR));
      h = mapCanvas.height = Math.max(120, Math.floor(cssH * DPR));
      // rebuild grid and re-place nodes
      buildGrid();
      resetNodesIfNeeded();
      controls.style.bottom = `${20 + SIZE_CSS + 12}px`;
    }

    function buildGrid() {
      gridPoints = [];
      const margin = 12 * DPR;
      const innerW = w - margin*2;
      const innerH = h - margin*2;
      for (let r=0; r<INTER_COUNT; r++){
        const row = [];
        for (let c=0; c<INTER_COUNT; c++){
          const x = margin + (c / CELL_COUNT) * innerW;
          const y = margin + (r / CELL_COUNT) * innerH;
          row.push({x,y});
        }
        gridPoints.push(row);
      }
    }

    function resetNodesIfNeeded() {
      if (nodes.length === 0) {
        respawnNodes();
      } else {
        for (const n of nodes) {
          n.x = gridPoints[n.gy][n.gx].x;
          n.y = gridPoints[n.gy][n.gx].y;
          n.targetGx = n.gx; n.targetGy = n.gy;
        }
      }
    }

    function respawnNodes() {
      const positions = [];
      for (let r=0;r<INTER_COUNT;r++){
        for (let c=0;c<INTER_COUNT;c++) positions.push([r,c]);
      }
      for (let i=positions.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [positions[i],positions[j]] = [positions[j],positions[i]];
      }
      const chosen = positions.slice(0,NODE_COUNT);
      nodes = chosen.map((rc,idx) => {
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
      selectedNode = null;
      draggingNode = null;
      victoryEl.style.display = 'none';
      victoryShown = false;
    }

    function nearestIntersection(px, py){
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

    // ---------------------------
    // NEW: reliable mapping from mouse (screen) -> mapCanvas local coords
    // Uses exact forward math of crt_overlay shader to compute texture coord,
    // then converts that texture coord into the mapCanvas space where terminal draws it.
    //
    // Steps:
    // 1) find overlay (crtOverlayCanvas) bounding rect to compute vUV (0..1)
    // 2) compute uv = vUV*2-1, r = length(uv)
    // 3) d = mix(uv, uv*r, CRT_DISTORTION)
    // 4) f = (d + 1)/2; f.y = 1 - f.y  (exactly same as shader)
    // 5) tx_css = f.x * terminalCssWidth; ty_css = f.y * terminalCssHeight
    // 6) find mapCanvas.getBoundingClientRect() (sx,sy,sw,sh) used in terminal drawImage
    // 7) if tx_css in [sx,sx+sw], map local = (tx_css - sx)/sw -> map pixel = local * mapCanvas.width
    // 8) return map-local coordinates (device pixels, matching mapCanvas.width/height scale)
    // ---------------------------
    function getMousePosOnCanvas(ev) {
      try {
        // find overlay canvas (crtOverlayCanvas) or default to window
        const overlay = document.getElementById('crtOverlayCanvas');
        const terminal = document.getElementById('terminalCanvas');
        // Fallbacks
        const overlayRect = overlay ? overlay.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const termRect = terminal ? terminal.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

        // 1) compute vUV (0..1) relative to overlay (same as shader)
        const u = (ev.clientX - overlayRect.left) / overlayRect.width;
        const v = (ev.clientY - overlayRect.top) / overlayRect.height;

        // clamp
        const cu = Math.max(0, Math.min(1, u));
        const cv = Math.max(0, Math.min(1, v));

        // 2) shader forward math
        const uvx = cu * 2 - 1;
        const uvy = cv * 2 - 1;
        const r = Math.hypot(uvx, uvy) || 0.0;

        // 3) mix(uv, uv * r, k)
        const k = CRT_DISTORTION;
        const d_x = uvx * (1 - k) + (uvx * r) * k;
        const d_y = uvy * (1 - k) + (uvy * r) * k;

        // 4) f = (d+1)/2; flip y as shader does
        let fx = (d_x + 1) * 0.5;
        let fy = (d_y + 1) * 0.5;
        fy = 1.0 - fy;

        // 5) terminal canvas CSS sizes (we must use css sizes because terminal drawImage used CSS px)
        const termCssW = termRect.width;
        const termCssH = termRect.height;
        const tx_css = fx * termCssW;
        const ty_css = fy * termCssH;

        // 6) locate where mapCanvas was drawn into terminalCanvas:
        // terminal_canvas.js used: const r = mapCanvas.getBoundingClientRect(); ctx.drawImage(mapCanvas, sx, sy, sw, sh);
        const mapRect = mapCanvas.getBoundingClientRect();
        const sx = Math.round(mapRect.left);
        const sy = Math.round(mapRect.top);
        const sw = Math.round(mapRect.width);
        const sh = Math.round(mapRect.height);

        // If point outside drawn map area, fallback to simple nearest mapping to mapCanvas bounding rect
        if (tx_css < sx || tx_css > sx + sw || ty_css < sy || ty_css > sy + sh || sw === 0 || sh === 0) {
          // fallback: map client coords by converting client-->mapCss proportion
          const clientRect = mapRect;
          const mxCss = (ev.clientX - clientRect.left);
          const myCss = (ev.clientY - clientRect.top);
          // mapCanvas internal pixels are device pixels (mapCanvas.width/mapCanvas.height)
          const mapX = (mxCss / clientRect.width) * mapCanvas.width;
          const mapY = (myCss / clientRect.height) * mapCanvas.height;
          return { x: mapX, y: mapY };
        }

        // 7) compute fraction inside drawn map area, then map to mapCanvas internal pixels
        const localX = (tx_css - sx) / sw;
        const localY = (ty_css - sy) / sh;
        const mapX = localX * mapCanvas.width;
        const mapY = localY * mapCanvas.height;

        return { x: mapX, y: mapY };
      } catch (e) {
        // if anything breaks — fallback to direct mapping like original (cheap)
        const rect = mapCanvas.getBoundingClientRect();
        const rawX = (ev.clientX - rect.left) * (mapCanvas.width / rect.width);
        const rawY = (ev.clientY - rect.top) * (mapCanvas.height / rect.height);
        return { x: rawX, y: rawY };
      }
    }

    // ----- event handling -----
    mapCanvas.addEventListener('mousedown', (ev) => {
      const m = getMousePosOnCanvas(ev);
      mouse.down = true;
      mouse.x = m.x; mouse.y = m.y;
      let found = null;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const d = Math.hypot(m.x - n.x, m.y - n.y);
        if (d < 12 * DPR) { found = n; break; }
      }
      if (found) {
        if (found.locked) {
          if (selectedNode && selectedNode !== found) selectedNode.selected = false;
          selectedNode = found;
          selectedNode.selected = true;
          return;
        }
        draggingNode = found;
        draggingNode.drag = true;
        if (selectedNode && selectedNode !== found) selectedNode.selected = false;
        selectedNode = found;
        selectedNode.selected = true;
      } else {
        if (selectedNode) { selectedNode.selected = false; selectedNode = null; }
      }
    });

    // attach mousemove to window to catch drags even if cursor leaves map canvas
    window.addEventListener('mousemove', (ev) => {
      const m = getMousePosOnCanvas(ev);
      mouse.x = m.x; mouse.y = m.y;

      let hoveredNode = null;
      for (const n of nodes) {
        if (Math.hypot(m.x - n.x, m.y - n.y) < 12 * DPR) {
          hoveredNode = n; break;
        }
      }

      mapCanvas.style.cursor = (hoveredNode && hoveredNode.locked) ? 'not-allowed' :
                               (hoveredNode) ? 'pointer' : 'default';

      if (draggingNode && draggingNode.locked) {
        draggingNode.drag = false;
        draggingNode = null;
      }

      if (draggingNode) {
        const nearest = nearestIntersection(mouse.x, mouse.y);
        draggingNode.gx = nearest.col;
        draggingNode.gy = nearest.row;
        draggingNode.targetGx = nearest.col;
        draggingNode.targetGy = nearest.row;
        const p = gridPoints[nearest.row][nearest.col];
        draggingNode.x = p.x;
        draggingNode.y = p.y;
      }
    });

    window.addEventListener('mouseup', (ev) => {
      mouse.down = false;
      if (draggingNode) {
        const n = draggingNode;
        const nearest = nearestIntersection(n.x, n.y);
        n.gx = nearest.col; n.gy = nearest.row;
        const p = gridPoints[n.gy][n.gx];
        n.x = p.x; n.y = p.y;
        n.drag = false;
        draggingNode = null;
      }
    });

    window.addEventListener('keydown', (ev) => {
      if (ev.key && (ev.key.toLowerCase() === 'q' || ev.key.toLowerCase() === 'й')) {
        const n = selectedNode || draggingNode;
        if (!n) return;

        const nearest = nearestIntersection(n.x, n.y);

        const isOccupied = nodes.some(other =>
          other !== n &&
          other.locked &&
          other.gx === nearest.col &&
          other.gy === nearest.row
        );

        if (isOccupied) {
          statusEl.textContent = `⚠ Место занято другим узлом`;
          setTimeout(()=> statusEl.textContent = `TARGET: ${currentTargetName}  |  Q/Й = lock/unlock selected node`, 1500);
          return;
        }

        n.gx = nearest.col;
        n.gy = nearest.row;
        n.targetGx = n.gx;
        n.targetGy = n.gy;
        n.locked = !n.locked;
        n.lastMoveAt = performance.now();

        if (n.locked) {
          const p = gridPoints[n.gy][n.gx];
          n.x = p.x;
          n.y = p.y;
        }

        statusEl.textContent = `TARGET: ${currentTargetName}  |  Node ${n.id} ${n.locked ? 'locked' : 'unlocked'}`;
        setTimeout(()=> statusEl.textContent = `TARGET: ${currentTargetName}  |  Q/Й = lock/unlock selected node`, 1200);
      }
    });

    let victoryShown = false;
    function checkVictory() {
      const set = new Set(nodes.map(n => `${n.gy},${n.gx}`));
      const allPresent = currentTarget.every(([r,c]) => set.has(`${r},${c}`));
      if (allPresent) {
        victoryShown = true;
        victoryEl.style.display = 'block';
        console.info('Victory matched:', currentTargetName);
        return true;
      } else {
        return false;
      }
    }

    checkBtn.addEventListener('click', () => {
      const ok = checkVictory();
      if (!ok) {
        statusEl.textContent = `TARGET: ${currentTargetName}  |  ПРИКОЛ НЕ СОБРАН`;
        setTimeout(()=> statusEl.textContent = `TARGET: ${currentTargetName}  |  Q/Й = lock/unlock selected node`, 1400);
      }
    });

    resetBtn.addEventListener('click', () => {
      for (const n of nodes) { n.locked = false; n.selected = false; n.drag = false; }
      selectedNode = null; draggingNode = null;
      respawnNodes();
    });

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
            n.targetGx = nb.gx;
            n.targetGy = nb.gy;
            n.lastMoveAt = now;
          }
        } else {
          const p = targetP;
          const t = Math.min(1, n.speed * (dt/16) * (1 + Math.random()*0.6));
          n.x += (p.x - n.x) * t;
          n.y += (p.y - n.y) * t;
        }
      }
    }

    function draw() {
      mctx.clearRect(0,0,w,h);
      mctx.fillStyle = 'rgba(2,18,12,0.66)';
      roundRect(mctx, 0, 0, w, h, 8*DPR);
      mctx.fill();

      const vig = mctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.06, w/2, h/2, Math.max(w,h)*0.9);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.14)');
      mctx.fillStyle = vig;
      mctx.fillRect(0,0,w,h);

      mctx.strokeStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.10)`;
      mctx.lineWidth = 1 * DPR;
      mctx.beginPath();
      for (let i=0;i<=CELL_COUNT;i++){
        const x = gridPoints[0][0].x + (i/CELL_COUNT)*(gridPoints[0][CELL_COUNT].x - gridPoints[0][0].x);
        mctx.moveTo(x, gridPoints[0][0].y);
        mctx.lineTo(x, gridPoints[INTER_COUNT-1][0].y);
      }
      for (let j=0;j<=CELL_COUNT;j++){
        const y = gridPoints[0][0].y + (j/CELL_COUNT)*(gridPoints[INTER_COUNT-1][0].y - gridPoints[0][0].y);
        mctx.moveTo(gridPoints[0][0].x, y);
        mctx.lineTo(gridPoints[0][INTER_COUNT-1].x, y);
      }
      mctx.stroke();

      mctx.save();
      mctx.lineCap = 'round';
      for (let i=0;i<nodes.length;i++){
        for (let j=i+1;j<nodes.length;j++){
          const A = nodes[i], B = nodes[j];
          const d = Math.hypot(A.x - B.x, A.y - B.y);
          if (d < (w * 0.32)) {
            const baseAlpha = Math.max(0.10, 0.32 - (d / (w*0.9)) * 0.22);
            const grad = mctx.createLinearGradient(A.x, A.y, B.x, B.y);
            grad.addColorStop(0, glowColor(baseAlpha));
            grad.addColorStop(1, glowColor(baseAlpha * 0.45));
            mctx.strokeStyle = grad;
            mctx.lineWidth = 1 * DPR;
            mctx.beginPath();
            mctx.moveTo(A.x, A.y);
            mctx.lineTo(B.x, B.y);
            mctx.stroke();
          }
        }
      }
      mctx.restore();

      for (const n of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin((n.id + tick*0.02) * 1.2);
        const intensity = n.selected ? 1.4 : (n.locked ? 1.2 : 1.0);
        const glowR = (6 * DPR + pulse*3*DPR) * intensity;
        const c = n.locked ? `rgba(255,60,60,${0.36 * intensity})` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.36 * intensity})`;
        const c2 = n.locked ? `rgba(255,60,60,${0.12 * intensity})` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.12 * intensity})`;
        const grd = mctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
        grd.addColorStop(0, c);
        grd.addColorStop(0.6, c2);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grd;
        mctx.fillRect(n.x - glowR, n.y - glowR, glowR*2, glowR*2);

        mctx.beginPath();
        const coreR = 2.2 * DPR + (n.selected ? 1.6*DPR : 0);
        mctx.fillStyle = n.locked ? redColor(1) : glowColor(1);
        mctx.arc(n.x, n.y, coreR, 0, Math.PI*2);
        mctx.fill();

        mctx.beginPath();
        mctx.lineWidth = 1 * DPR;
        mctx.strokeStyle = n.locked ? redColor(0.92) : glowColor(0.92);
        mctx.arc(n.x, n.y, coreR + 1.2*DPR, 0, Math.PI*2);
        mctx.stroke();
      }

      mctx.save();
      mctx.font = `${10 * DPR}px monospace`;
      mctx.fillStyle = glowColor(0.95);
      mctx.textAlign = 'right';
      mctx.fillText('VIGIL NET', w - 8*DPR, 12*DPR);
      mctx.restore();
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

    let lastTime = performance.now();
    function loop() {
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }

    window.addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame(loop);

    window.netGrid = window.netGrid || {};
    window.netGrid.nodes = nodes;
    window.netGrid.lockAll = function() {
      for (const n of nodes) n.locked = true;
    };
    window.netGrid.unlockAll = function() {
      for (const n of nodes) n.locked = false;
    };
    window.netGrid.getTargetName = () => currentTargetName;

    console.info('netGrid_fixed_v4 loaded — interactive grid (fixed mouse mapping through CRT shader math)');

  } catch (err) {
    console.error('netGrid_fixed_v4 error', err);
  }
})();
