// netGrid_v6_terminalCanvas.js
// Render the interactive net grid directly INTO terminalCanvas (right-bottom HUD area).
// - Automatic CRT-aware picking (uses crtOverlay if present).
// - DPR-aware, deterministic, no LUT, analytic inverse/forward mapping.
// - Exposes window.netGridV6.debug().

(() => {
  'use strict';
  try {
    const SIZE_CSS = 300;          // CSS size of the grid HUD
    const MARGIN_RIGHT = 20;       // CSS px from right
    const MARGIN_BOTTOM = 20;      // CSS px from bottom
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const CELL_COUNT = 6;
    const INTER_COUNT = CELL_COUNT + 1;
    const NODE_COUNT = 10;
    const AUTONOMOUS_MOVE_COOLDOWN = 800;
    const COLOR = { r: 6, g: 160, b: 118 };
    let CRT_DISTORTION = 0.28; // default; if you changed crt_overlay, adjust with API

    // find terminal canvas
    const terminalCanvas = document.getElementById('terminalCanvas');
    if (!terminalCanvas || terminalCanvas.tagName !== 'CANVAS') {
      console.error('netGrid_v6: terminalCanvas not found — aborting.');
      return;
    }
    const ctx = terminalCanvas.getContext('2d', { alpha: false });

    // overlay canvas (crt) if present
    const overlayCanvas = document.getElementById('crtOverlayCanvas') || null;

    // grid drawing area in device pixels (computed each resize)
    let gridCssW = SIZE_CSS, gridCssH = SIZE_CSS;
    let gridDevW = Math.max(64, Math.floor(gridCssW * DPR));
    let gridDevH = Math.max(64, Math.floor(gridCssH * DPR));
    let gridDevLeft = 0, gridDevTop = 0; // device pixel coords inside terminalCanvas

    // internal state
    let gridW = gridDevW, gridH = gridDevH;
    let gridPoints = [];
    let nodes = [];
    let tick = 0;
    let selectedNode = null;
    let draggingNode = null;

    // symbol target (same as previous)
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

    // helpers
    function glowColor(a=1){ return `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${a})`; }
    function redColor(a=1){ return `rgba(255,60,60,${a})`; }

    // compute grid rectangle within terminal canvas (device pixels)
    function computeGridRect() {
      const cssCanvasWidth = terminalCanvas.clientWidth; // CSS px
      const cssCanvasHeight = terminalCanvas.clientHeight;
      // left/top in CSS pixels:
      const cssLeft = Math.max(0, cssCanvasWidth - gridCssW - MARGIN_RIGHT);
      const cssTop = Math.max(0, cssCanvasHeight - gridCssH - MARGIN_BOTTOM);
      gridDevLeft = Math.round(cssLeft * DPR);
      gridDevTop = Math.round(cssTop * DPR);
      gridDevW = Math.round(gridCssW * DPR);
      gridDevH = Math.round(gridCssH * DPR);
      gridW = gridDevW; gridH = gridDevH;
    }

    function buildGridPoints() {
      gridPoints = [];
      const margin = Math.round(12 * DPR);
      const innerW = gridW - margin*2;
      const innerH = gridH - margin*2;
      for (let r=0; r<INTER_COUNT; r++) {
        const row = [];
        for (let c=0; c<INTER_COUNT; c++) {
          const x = gridDevLeft + margin + Math.round((c / CELL_COUNT) * innerW);
          const y = gridDevTop + margin + Math.round((r / CELL_COUNT) * innerH);
          row.push({ x, y });
        }
        gridPoints.push(row);
      }
    }

    function respawnNodes() {
      nodes = [];
      const positions = [];
      for (let r=0;r<INTER_COUNT;r++) for (let c=0;c<INTER_COUNT;c++) positions.push([r,c]);
      for (let i=positions.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [positions[i],positions[j]] = [positions[j],positions[i]];
      }
      const chosen = positions.slice(0, NODE_COUNT);
      nodes = chosen.map((rc, idx) => {
        const [r,c] = rc;
        const p = gridPoints[r][c];
        return {
          id: idx, gx: c, gy: r,
          x: p.x, y: p.y,
          targetGx: c, targetGy: r,
          speed: 0.002 + Math.random()*0.004,
          locked: false, lastMoveAt: performance.now() - Math.random()*1000,
          drag: false, selected: false
        };
      });
      selectedNode = null; draggingNode = null;
    }

    function nearestIntersection(px, py) {
      let best = { r:0, c:0, d: Infinity };
      for (let r=0;r<INTER_COUNT;r++){
        for (let c=0;c<INTER_COUNT;c++){
          const p = gridPoints[r][c];
          const d = Math.hypot(px - p.x, py - p.y);
          if (d < best.d) { best = { r, c, d }; }
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
      return candidates.length ? candidates[Math.floor(Math.random()*candidates.length)] : {gx,gy};
    }

    // shader forward mapping (same as crt fragment): uv->f
    function shaderForward_uvToF(u, v, k = CRT_DISTORTION) {
      let uvx = u * 2 - 1;
      let uvy = v * 2 - 1;
      const r = Math.hypot(uvx, uvy);
      const dx = uvx * (1 - k) + (uvx * r) * k;
      const dy = uvy * (1 - k) + (uvy * r) * k;
      let fx = (dx + 1) * 0.5;
      let fy = (dy + 1) * 0.5;
      fy = 1.0 - fy; // shader flips Y
      return { fx, fy };
    }

    // get mouse position mapped to grid device pixels
    function mapPointerToGrid(ev) {
      try {
        // prefer overlay mapping
        if (overlayCanvas && typeof CRT_DISTORTION === 'number') {
          const overlayRect = overlayCanvas.getBoundingClientRect();
          const u = (ev.clientX - overlayRect.left) / overlayRect.width;
          const v = (ev.clientY - overlayRect.top) / overlayRect.height;
          const cu = Math.max(0, Math.min(1, u));
          const cv = Math.max(0, Math.min(1, v));
          // forward shader to get texture sample coordinates (terminalCanvas texture coords)
          const f = shaderForward_uvToF(cu, cv, CRT_DISTORTION);
          // map f to terminalCanvas device pixels
          const tx = Math.max(0, Math.min(terminalCanvas.width, Math.round(f.fx * terminalCanvas.width)));
          const ty = Math.max(0, Math.min(terminalCanvas.height, Math.round(f.fy * terminalCanvas.height)));
          // now check if inside grid rectangle
          if (tx >= gridDevLeft && tx <= gridDevLeft + gridW && ty >= gridDevTop && ty <= gridDevTop + gridH) {
            const gx = tx; const gy = ty;
            return { x: gx, y: gy, mode: 'overlay->terminal->grid' };
          } else {
            // fallback to nearest point inside grid (clamped)
            const clx = Math.max(gridDevLeft, Math.min(gridDevLeft + gridW, tx));
            const cly = Math.max(gridDevTop, Math.min(gridDevTop + gridH, ty));
            return { x: clx, y: cly, mode: 'overlay->terminal->grid-clamped' };
          }
        } else {
          // direct mapping: client -> terminalCanvas bounding rect -> device pixels
          const rect = terminalCanvas.getBoundingClientRect();
          const rawX = (ev.clientX - rect.left) * (terminalCanvas.width / rect.width);
          const rawY = (ev.clientY - rect.top) * (terminalCanvas.height / rect.height);
          // clamp to grid rect (we only care about grid area)
          const clx = Math.max(gridDevLeft, Math.min(gridDevLeft + gridW, Math.round(rawX)));
          const cly = Math.max(gridDevTop, Math.min(gridDevTop + gridH, Math.round(rawY)));
          return { x: clx, y: cly, mode: 'client->terminal->grid' };
        }
      } catch (e) {
        // fallback simpler
        const rect = terminalCanvas.getBoundingClientRect();
        const rawX = (ev.clientX - rect.left) * (terminalCanvas.width / rect.width);
        const rawY = (ev.clientY - rect.top) * (terminalCanvas.height / rect.height);
        const clx = Math.max(gridDevLeft, Math.min(gridDevLeft + gridW, Math.round(rawX)));
        const cly = Math.max(gridDevTop, Math.min(gridDevTop + gridH, Math.round(rawY)));
        return { x: clx, y: cly, mode: 'fallback' };
      }
    }

    // Pointer handlers (use capture to reduce interference)
    function onPointerDown(ev) {
      if (ev.button !== 0) return;
      const mp = mapPointerToGrid(ev);
      const mx = mp.x, my = mp.y;
      let found = null;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const d = Math.hypot(mx - n.x, my - n.y);
        if (d < 14 * DPR) { found = n; break; }
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

    function onPointerMove(ev) {
      const mp = mapPointerToGrid(ev);
      const mx = mp.x, my = mp.y;
      let hovered = null;
      for (const n of nodes) {
        if (Math.hypot(mx - n.x, my - n.y) < 14 * DPR) { hovered = n; break; }
      }
      // update cursor by setting style on canvas element
      terminalCanvas.style.cursor = hovered ? (hovered.locked ? 'not-allowed' : 'pointer') : 'default';

      if (draggingNode && draggingNode.locked) { draggingNode.drag = false; draggingNode = null; }
      if (draggingNode) {
        const nearest = nearestIntersection(mx, my);
        draggingNode.gx = nearest.col; draggingNode.gy = nearest.row;
        draggingNode.targetGx = nearest.col; draggingNode.targetGy = nearest.row;
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

    // keyboard lock/unlock Q/Й
    function onKeyDown(ev) {
      if (!ev.key) return;
      if (ev.key.toLowerCase() === 'q' || ev.key.toLowerCase() === 'й') {
        const n = selectedNode || draggingNode;
        if (!n) return;
        const nearest = nearestIntersection(n.x, n.y);
        const isOccupied = nodes.some(other => other !== n && other.locked && other.gx === nearest.col && other.gy === nearest.row);
        if (isOccupied) return;
        n.gx = nearest.col; n.gy = nearest.row; n.targetGx = n.gx; n.targetGy = n.gy;
        n.locked = !n.locked; n.lastMoveAt = performance.now();
        if (n.locked) { const p = gridPoints[n.gy][n.gx]; n.x = p.x; n.y = p.y; }
      }
    }

    // update loop (autonomous motion)
    function update(dt) {
      tick++;
      const now = performance.now();
      for (const n of nodes) {
        if (n.drag) continue;
        if (n.locked) {
          const pLock = gridPoints[n.gy][n.gx];
          n.x = pLock.x; n.y = pLock.y; n.targetGx = n.gx; n.targetGy = n.gy; continue;
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

    // draw grid & nodes directly into terminalCanvas context (on top)
    function drawGridOverlay() {
      // NOTE: terminalCanvas might have been transformed by its own code; save/restore to be safe
      try {
        ctx.save();
        // no global transform — coordinates are device pixels; draw with device precision
        // draw rounded background rect
        const r = 8 * DPR;
        ctx.beginPath();
        const x = gridDevLeft, y = gridDevTop, W = gridW, H = gridH;
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + W, y, x + W, y + H, r);
        ctx.arcTo(x + W, y + H, x, y + H, r);
        ctx.arcTo(x, y + H, x, y, r);
        ctx.arcTo(x, y, x + W, y, r);
        ctx.closePath();
        ctx.fillStyle = 'rgba(2,18,12,0.66)';
        ctx.fill();

        // vignette
        const vig = ctx.createRadialGradient(x + W/2, y + H/2, Math.min(W,H)*0.06, x + W/2, y + H/2, Math.max(W,H)*0.9);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.14)');
        ctx.fillStyle = vig;
        ctx.fillRect(x, y, W, H);

        // grid lines
        ctx.strokeStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.10)`;
        ctx.lineWidth = Math.max(1, Math.round(1 * DPR));
        ctx.beginPath();
        for (let i=0;i<=CELL_COUNT;i++){
          const gx = gridPoints[0][0].x + Math.round((i/CELL_COUNT)*(gridPoints[0][CELL_COUNT].x - gridPoints[0][0].x));
          ctx.moveTo(gx, gridPoints[0][0].y);
          ctx.lineTo(gx, gridPoints[INTER_COUNT-1][0].y);
        }
        for (let j=0;j<=CELL_COUNT;j++){
          const gy = gridPoints[0][0].y + Math.round((j/CELL_COUNT)*(gridPoints[INTER_COUNT-1][0].y - gridPoints[0][0].y));
          ctx.moveTo(gridPoints[0][0].x, gy);
          ctx.lineTo(gridPoints[0][INTER_COUNT-1].x, gy);
        }
        ctx.stroke();

        // connections
        ctx.lineCap = 'round';
        for (let i=0;i<nodes.length;i++){
          for (let j=i+1;j<nodes.length;j++){
            const A = nodes[i], B = nodes[j];
            const d = Math.hypot(A.x - B.x, A.y - B.y);
            if (d < (W * 0.32)) {
              const baseAlpha = Math.max(0.10, 0.32 - (d / (W*0.9)) * 0.22);
              const grad = ctx.createLinearGradient(A.x, A.y, B.x, B.y);
              grad.addColorStop(0, glowColor(baseAlpha));
              grad.addColorStop(1, glowColor(baseAlpha * 0.45));
              ctx.strokeStyle = grad;
              ctx.lineWidth = Math.max(1, Math.round(1 * DPR));
              ctx.beginPath();
              ctx.moveTo(A.x, A.y);
              ctx.lineTo(B.x, B.y);
              ctx.stroke();
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
          ctx.arc(n.x, n.y, coreR + 1.2*DPR, 0, Math.PI*2);
          ctx.stroke();
        }

        // label
        ctx.font = `${10 * DPR}px monospace`;
        ctx.fillStyle = glowColor(0.95);
        ctx.textAlign = 'right';
        ctx.fillText('VIGIL NET', gridDevLeft + gridW - 8*DPR, gridDevTop + 12*DPR);

      } catch (e) {
        // swallow draw errors — terminal may change transforms
      } finally {
        try { ctx.restore(); } catch(e){}
      }
    }

    // main loop — attempts to draw overlay at high frequency.
    let last = performance.now();
    function loop() {
      const now = performance.now();
      const dt = now - last; last = now;
      update(dt);
      drawGridOverlay();
      requestAnimationFrame(loop);
    }

    // resize handler: compute grid rect relative to terminal canvas size
    function onResize() {
      // recompute grid rect
      computeGridRect();
      buildGridPoints();
      respawnNodes();
    }
    window.addEventListener('resize', onResize);

    // init compute using current sizes
    computeGridRect();
    buildGridPoints();
    respawnNodes();

    // wire pointer events (capture to ensure delivery)
    window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: false });
    window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
    window.addEventListener('pointerup', onPointerUp, { capture: true, passive: false });
    window.addEventListener('keydown', onKeyDown, { capture: true });

    // debug API
    window.netGridV6 = {
      debug: function(){
        return {
          terminalCanvasId: terminalCanvas.id || null,
          terminalSize: { deviceW: terminalCanvas.width, deviceH: terminalCanvas.height, cssW: terminalCanvas.clientWidth, cssH: terminalCanvas.clientHeight },
          gridRect: { left: gridDevLeft, top: gridDevTop, w: gridW, h: gridH },
          nodesCount: nodes.length,
          CRT_DISTORTION
        };
      },
      setDistortion: function(v){ CRT_DISTORTION = +v; console.log('netGridV6: CRT_DISTORTION =', CRT_DISTORTION); },
      getNodes: function(){ return nodes.map(n => ({ id: n.id, gx: n.gx, gy: n.gy, x: n.x, y: n.y, locked: n.locked })); },
      forceRespawn: function(){ respawnNodes(); }
    };

    console.info('netGrid_v6_terminalCanvas loaded — drawing inside terminalCanvas. TARGET:', currentTargetName);

    // start loop
    requestAnimationFrame(loop);

  } catch (err) {
    console.error('netGrid_v6_terminalCanvas error', err);
  }
})();
