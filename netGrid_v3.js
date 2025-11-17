// netGrid_v4.js — VIGIL NET GRID v4 (interactive grid, nodes move only on grid-lines)
// Включает: live-drag (node следует за мышкой), snap-on-release, Q/Й lock toggle,
// locked nodes become red, кнопки "ПРОВЕРИТЬ ПРИКОЛ" и "⟳" (reset)
(() => {
  try {
    // ----- CONFIG -----
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const SIZE_CSS = 300; // размер панели в CSS px
    const COLOR = { r: 6, g: 160, b: 118 };
    const MAP_Z = 40;
    const STATUS_Z = 45;

    // Grid params
    const CELL_COUNT = 6; // 6x6 клеток => 7x7 перекрестков
    const INTER_COUNT = CELL_COUNT + 1;
    const NODE_COUNT = 10;
    const AUTONOMOUS_MOVE_COOLDOWN = 800; // ms before picking next target
// ⭐ ДОЛЖЕН СОВПАДАТЬ С crt_overlay.js
const CRT_DISTORTION = 0.28; 

// ----- HELPERS: Inverse CRT Transform -----
function applyInverseCRT(px, py, w, h, distortion) {
  // Нормализуем координаты
  const x = (px / w) * 2 - 1;
  const y = (py / h) * 2 - 1;
  
  const r = Math.sqrt(x*x + y*y);
  if (r === 0) return { x: px, y: py };
  
  // ⭐ ПРАВИЛЬНАЯ ОБРАТНАЯ ТРАНСФОРМАЦИЯ для твоего шейдера
  // Шейдер делает: uv' = uv * (1 + distortion * (r - 1))
  // Обратная: uv = uv' / (1 + distortion * (r - 1))
  
  const factor = 1 / (1 + distortion * (r - 1));
  
  // Защита от экстремальных значений
  if (!isFinite(factor)) return { x: px, y: py };
  
  return {
    x: (x * factor + 1) * 0.5 * w,
    y: (y * factor + 1) * 0.5 * h
  };
}
    // ----- DOM: canvas + status + victory + controls -----
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

    // status element (bottom-left style in original, but we place near map)
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

    // victory message
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

    // controls container (above the map, right-aligned)
    const controls = document.createElement('div');
    Object.assign(controls.style, {
      position: 'fixed',
      right: '20px',
      bottom: `${20 + SIZE_CSS + 12}px`, // над картой
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
    let w = 0, h = 0;
    let gridPoints = []; // массив {x,y} по пикселям для каждой интерсекции [row][col]
    let nodes = []; // Node objects
    let raf = null;
    let tick = 0;

    // Selected / dragging
    let selectedNode = null;
    let draggingNode = null;
    let mouse = { x: 0, y: 0, down: false };

    // Victory targets (заглушки)
    const SYMBOLS = {
      V: [  // буква V — относительные координаты на интерсециях (row,col)
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

    // show target in status
    statusEl.textContent = `TARGET: ${currentTargetName}  |  Q/Й = lock/unlock selected node`;

    // ----- helpers -----
    function glowColor(a=1){ return `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${a})`; }
    function redColor(a=1){ return `rgba(255,60,60,${a})`; }

    function resize() {
      const cssW = SIZE_CSS, cssH = SIZE_CSS;
      mapCanvas.style.width = cssW + 'px';
      mapCanvas.style.height = cssH + 'px';
      w = mapCanvas.width = Math.max(120, Math.floor(cssW * DPR));
      h = mapCanvas.height = Math.max(120, Math.floor(cssH * DPR));
      buildGrid();
      resetNodesIfNeeded();
      // reposition controls (in case SIZE_CSS changed)
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
      // create nodes if not exist, or if count changed
      if (nodes.length === 0) {
        respawnNodes();
      } else {
        // adjust positions to new grid if size changed
        for (const n of nodes) {
          n.x = gridPoints[n.gy][n.gx].x;
          n.y = gridPoints[n.gy][n.gx].y;
          n.targetGx = n.gx; n.targetGy = n.gy;
        }
      }
    }

    // respawn: random unique intersections for nodes
    function respawnNodes() {
      const positions = [];
      for (let r=0;r<INTER_COUNT;r++){
        for (let c=0;c<INTER_COUNT;c++) positions.push([r,c]);
      }
      // shuffle
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
          gx: c, gy: r,             // grid indices (col, row)
          x: p.x, y: p.y,          // real position (for smooth movement)
          targetGx: c, targetGy: r,
          speed: 0.002 + Math.random()*0.004, // lerp speed
          locked: false,
          lastMoveAt: performance.now() - Math.random()*1000,
          drag: false,
          selected: false
        };
      });
      // clear selection / dragging
      selectedNode = null;
      draggingNode = null;
      victoryEl.style.display = 'none';
      victoryShown = false;
    }

    // Get nearest intersection indices for a pixel position
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

    // choose a random neighbor for autonomous move (up/down/left/right), stays inside grid
    function pickNeighbor(gx, gy) {
      const candidates = [];
      if (gy > 0) candidates.push({gx,gy:gy-1});
      if (gy < INTER_COUNT-1) candidates.push({gx,gy:gy+1});
      if (gx > 0) candidates.push({gx:gx-1,gy});
      if (gx < INTER_COUNT-1) candidates.push({gx:gx+1,gy});
      if (candidates.length === 0) return {gx,gy};
      return candidates[Math.floor(Math.random()*candidates.length)];
    }

function getMousePosOnCanvas(ev) {
  const rect = mapCanvas.getBoundingClientRect();
  const rawX = (ev.clientX - rect.left) * (mapCanvas.width / rect.width);
  const rawY = (ev.clientY - rect.top) * (mapCanvas.height / rect.height);
  
  // ⭐ РАЗГИБАЕМ координаты мыши
  return applyInverseCRT(rawX, rawY, w, h, CRT_DISTORTION);
}

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
    // ⭐ НЕ трогаем, если заблокирована
    if (found.locked) {
      if (selectedNode && selectedNode !== found) selectedNode.selected = false;
      selectedNode = found;
      selectedNode.selected = true;
      return; // прекращаем, не начинаем dragging
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

window.addEventListener('mousemove', (ev) => {
  const m = getMousePosOnCanvas(ev);
  mouse.x = m.x; mouse.y = m.y;
  
  // Остальной код проверки hover остается тем же
  let hoveredNode = null;
  for (const n of nodes) {
    if (Math.hypot(m.x - n.x, m.y - n.y) < 12 * DPR) {
      hoveredNode = n; break;
    }
  }
  
  // Визуальный фидбэк курсора
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
        // on release, ensure the node snaps exactly to the target intersection
        const n = draggingNode;
        // find nearest intersection for final snap
        const nearest = nearestIntersection(n.x, n.y);
        n.gx = nearest.col; n.gy = nearest.row;
        const p = gridPoints[n.gy][n.gx];
        n.x = p.x; n.y = p.y;
        n.drag = false;
        draggingNode = null;
      }
    });

// keyboard Q toggles lock for selected node (snap to nearest intersection)
window.addEventListener('keydown', (ev) => {
  // accept both 'q' and russian 'й'
  if (ev.key && (ev.key.toLowerCase() === 'q' || ev.key.toLowerCase() === 'й')) {
    const n = selectedNode || draggingNode;
    if (!n) return;

    // snap to nearest intersection
    const nearest = nearestIntersection(n.x, n.y);

    // check if that grid cell already has a locked node
    const isOccupied = nodes.some(other => 
      other !== n &&
      other.locked &&
      other.gx === nearest.col &&
      other.gy === nearest.row
    );

    if (isOccupied) {
      // just small feedback in status
      statusEl.textContent = `⚠ Место занято другим узлом`;
      setTimeout(()=> statusEl.textContent = `TARGET: ${currentTargetName}  |  Q/Й = lock/unlock selected node`, 1500);
      return; // don't lock here
    }

    // otherwise proceed normally
    n.gx = nearest.col;
    n.gy = nearest.row;
    n.targetGx = n.gx;
    n.targetGy = n.gy;
    n.locked = !n.locked;
    n.lastMoveAt = performance.now();

    // if locked - snap to exact grid point
    if (n.locked) {
      const p = gridPoints[n.gy][n.gx];
      n.x = p.x;
      n.y = p.y;
    }

    statusEl.textContent = `TARGET: ${currentTargetName}  |  Node ${n.id} ${n.locked ? 'locked' : 'unlocked'}`;
    setTimeout(()=> statusEl.textContent = `TARGET: ${currentTargetName}  |  Q/Й = lock/unlock selected node`, 1200);
  }
});


    // ----- victory check -----
    let victoryShown = false;
    function checkVictory() {
      // build a set of occupied intersections by nodes
      const set = new Set(nodes.map(n => `${n.gy},${n.gx}`));
      // check if all required points are present
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

    // wire check button: manual check
    checkBtn.addEventListener('click', () => {
      const ok = checkVictory();
      if (!ok) {
        // temporary negative feedback
        statusEl.textContent = `TARGET: ${currentTargetName}  |  ПРИКОЛ НЕ СОБРАН`;
        setTimeout(()=> statusEl.textContent = `TARGET: ${currentTargetName}  |  Q/Й = lock/unlock selected node`, 1400);
      }
    });

    // wire reset button: unlock all and respawn
    resetBtn.addEventListener('click', () => {
      // unlock all
      for (const n of nodes) { n.locked = false; n.selected = false; n.drag = false; }
      selectedNode = null; draggingNode = null;
      respawnNodes();
    });

    // ----- rendering & update loop -----
    function update(dt) {
      tick++;
      const now = performance.now();
      // autonomous movement: for each unlocked node, if reached target, maybe pick neighbor after cooldown
      for (const n of nodes) {
        // if node is being dragged, skip autonomous position picking
        if (n.drag) continue;
        if (n.locked) { // locked nodes stay exactly on their grid point
          const pLock = gridPoints[n.gy][n.gx];
          n.x = pLock.x; n.y = pLock.y;
          n.targetGx = n.gx; n.targetGy = n.gy;
          continue;
        }
        // if node is near its target pixel, consider picking a new neighbor after cooldown
        const targetP = gridPoints[n.targetGy][n.targetGx];
        const dist = Math.hypot(n.x - targetP.x, n.y - targetP.y);
        if (dist < 1.4 * DPR) {
          // snap to target
          n.gx = n.targetGx; n.gy = n.targetGy;
          // pick next target after cooldown
          if (now - n.lastMoveAt > AUTONOMOUS_MOVE_COOLDOWN + Math.random()*1200) {
            const nb = pickNeighbor(n.gx, n.gy);
            n.targetGx = nb.gx;
            n.targetGy = nb.gy;
            n.lastMoveAt = now;
          }
        } else {
          // move toward target by lerp (smooth)
          const p = targetP;
          const t = Math.min(1, n.speed * (dt/16) * (1 + Math.random()*0.6));
          n.x += (p.x - n.x) * t;
          n.y += (p.y - n.y) * t;
        }
      }
    }

    function draw() {
      // clear
      mctx.clearRect(0,0,w,h);

      // background rounded rect
      mctx.fillStyle = 'rgba(2,18,12,0.66)';
      roundRect(mctx, 0, 0, w, h, 8*DPR);
      mctx.fill();

      // vignette
      const vig = mctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.06, w/2, h/2, Math.max(w,h)*0.9);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.14)');
      mctx.fillStyle = vig;
      mctx.fillRect(0,0,w,h);

      // grid lines
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

      // draw connections (simple straight lines between nodes that are close enough)
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

      // draw nodes
      for (const n of nodes) {
        // glow
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

        // core
        mctx.beginPath();
        const coreR = 2.2 * DPR + (n.selected ? 1.6*DPR : 0);
        mctx.fillStyle = n.locked ? redColor(1) : glowColor(1);
        mctx.arc(n.x, n.y, coreR, 0, Math.PI*2);
        mctx.fill();

        // stroke
        mctx.beginPath();
        mctx.lineWidth = 1 * DPR;
        mctx.strokeStyle = n.locked ? redColor(0.92) : glowColor(0.92);
        mctx.arc(n.x, n.y, coreR + 1.2*DPR, 0, Math.PI*2);
        mctx.stroke();
      }

      // draw label
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

    // ----- startup -----
    window.addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame(loop);

    // ----- debug / API -----
    window.netGrid = window.netGrid || {};
    window.netGrid.nodes = nodes;
    window.netGrid.lockAll = function() {
      for (const n of nodes) n.locked = true;
    };
    window.netGrid.unlockAll = function() {
      for (const n of nodes) n.locked = false;
    };
    window.netGrid.getTargetName = () => currentTargetName;

    console.info('netGrid_v4 loaded — INTERACTIVE GRID (nodes move only on intersections)');

  } catch (err) {
    console.error('netGrid_v4 error', err);
  }
})();
