// netGrid_v3-FINAL-FIXED.js — FORWARD DISTORTION для рендеринга, точный hit-test
(() => {
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
  const CRT_DISTORTION = 0.28;
  const HIT_RADIUS_CSS = 30;

  // ----- СИМВОЛЫ -----
  const SYMBOLS = {
    V: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[6,0],[5,1],[4,2]],
    I: [[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3]],
    X: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[0,6],[1,5],[2,4],[4,2],[5,1],[6,0]]
  };
  const symbolNames = Object.keys(SYMBOLS);
  const currentTargetName = symbolNames[Math.floor(Math.random()*symbolNames.length)];
  const currentTarget = SYMBOLS[currentTargetName];

  // ----- АНАЛИТИЧЕСКИЕ ТРАНСФОРМАЦИИ -----
  function inverseDistortion(distortedX, distortedY, width, height) {
    const xn = (distortedX / width) * 2 - 1;
    const yn = (distortedY / height) * 2 - 1;
    const rn = Math.sqrt(xn*xn + yn*yn);
    if (rn === 0) return { x: distortedX, y: distortedY };
    
    const k = CRT_DISTORTION;
    const b = 1 - k;
    const discriminant = b*b + 4*k*rn;
    if (discriminant < 0) return { x: distortedX, y: distortedY };
    
    const r = (-b + Math.sqrt(discriminant)) / (2*k);
    const scale = r / rn;
    
    return {
      x: (xn * scale + 1) * 0.5 * width,
      y: (yn * scale + 1) * 0.5 * height
    };
  }

  function forwardDistortion(x, y, width, height) {
    const xn = (x / width) * 2 - 1;
    const yn = (y / height) * 2 - 1;
    const rn = Math.sqrt(xn*xn + yn*yn);
    if (rn === 0) return { x: x, y: y };
    
    const k = CRT_DISTORTION;
    const r = rn * (1 + k * (rn - 1));
    const scale = r / rn;
    
    return {
      x: (xn * scale + 1) * 0.5 * width,
      y: (yn * scale + 1) * 0.5 * height
    };
  }

  // ----- DOM-элементы -----
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

  // ----- Внутреннее состояние -----
  let w = 0, h = 0;
  let gridPoints = [];
  let nodes = [];
  let raf = null;
  let tick = 0;
  let selectedNode = null;
  let draggingNode = null;
  let mouse = { x: 0, y: 0, down: false };

  // ----- Вспомогательные функции -----
  function glowColor(a=1){ return `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${a})`; }
  function redColor(a=1){ return `rgba(255,60,60,${a})`; }

  function resize() {
    w = SIZE_CSS;
    h = SIZE_CSS;
    mapCanvas.width = Math.floor(w * DPR);
    mapCanvas.height = Math.floor(h * DPR);
    buildGrid();
    resetNodesIfNeeded();
  }

  function buildGrid() {
    gridPoints = [];
    const margin = 12;
    const innerW = w - margin*2;
    const innerH = h - margin*2;
    for (let r=0; r<INTER_COUNT; r++) {
      const row = [];
      for (let c=0; c<INTER_COUNT; c++) {
        const x = margin + (c / CELL_COUNT) * innerW;
        const y = margin + (r / CELL_COUNT) * innerH;
        row.push({x, y});
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
    for (let r=0; r<INTER_COUNT; r++) {
      for (let c=0; c<INTER_COUNT; c++) positions.push([r,c]);
    }
    for (let i=positions.length-1; i>0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    const chosen = positions.slice(0, NODE_COUNT);
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
  }

  function nearestIntersection(px, py) {
    let best = { r: 0, c: 0, d: Infinity };
    for (let r = 0; r < INTER_COUNT; r++) {
      for (let c = 0; c < INTER_COUNT; c++) {
        const p = gridPoints[r][c];
        const d = Math.hypot(px - p.x, py - p.y);
        if (d < best.d) { best = { r, c, d }; }
      }
    }
    return { row: best.r, col: best.c, dist: best.d };
  }

  function getMousePosOnCanvas(ev) {
    const rect = mapCanvas.getBoundingClientRect();
    const cssX = ev.clientX - rect.left;
    const cssY = ev.clientY - rect.top;
    const undistorted = inverseDistortion(cssX, cssY, w, h);
    return { x: undistorted.x, y: undistorted.y };
  }

  // ----- Обработчики мыши -----
  mapCanvas.addEventListener('mousedown', (ev) => {
    const m = getMousePosOnCanvas(ev);
    mouse.down = true;
    mouse.x = m.x;
    mouse.y = m.y;
    
    let found = null;
    for (const n of nodes) {
      if (Math.hypot(m.x - n.x, m.y - n.y) < HIT_RADIUS_CSS) {
        found = n;
        break;
      }
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

  window.addEventListener('mousemove', (ev) => {
    const m = getMousePosOnCanvas(ev);
    mouse.x = m.x;
    mouse.y = m.y;
    
    let hoveredNode = null;
    for (const n of nodes) {
      if (Math.hypot(m.x - n.x, m.y - n.y) < HIT_RADIUS_CSS) {
        hoveredNode = n;
        break;
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
        statusEl.textContent = `⚠ Место занято`;
        setTimeout(()=> statusEl.textContent = `TARGET: ${currentTargetName} | Q/Й = lock/unlock`, 1500);
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
        n.x = p.x; n.y = p.y;
      }
      
      statusEl.textContent = `Node ${n.id} ${n.locked ? 'locked' : 'unlocked'}`;
      setTimeout(()=> statusEl.textContent = `TARGET: ${currentTargetName} | Q/Й = lock/unlock`, 1200);
    }
  });

  // ----- Анимация и рендер -----
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
      if (dist < 1.4) {
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

  function pickNeighbor(gx, gy) {
    const candidates = [];
    if (gy > 0) candidates.push({gx, gy: gy-1});
    if (gy < INTER_COUNT-1) candidates.push({gx, gy: gy+1});
    if (gx > 0) candidates.push({gx: gx-1, gy});
    if (gx < INTER_COUNT-1) candidates.push({gx: gx+1, gy});
    return candidates[Math.floor(Math.random() * candidates.length)] || {gx, gy};
  }

  function draw() {
    mctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    
    // Прямоугольник фона
    mctx.fillStyle = 'rgba(2,18,12,0.66)';
    roundRect(mctx, 0, 0, mapCanvas.width, mapCanvas.height, 8*DPR);
    mctx.fill();
    
    // Виньетка
    const vig = mctx.createRadialGradient(
      mapCanvas.width/2, mapCanvas.height/2, Math.min(mapCanvas.width, mapCanvas.height)*0.06,
      mapCanvas.width/2, mapCanvas.height/2, Math.max(mapCanvas.width, mapCanvas.height)*0.9
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.14)');
    mctx.fillStyle = vig;
    mctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
    
    // Сетка
    mctx.strokeStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.10)`;
    mctx.lineWidth = 1 * DPR;
    mctx.beginPath();
    for (let i=0; i<=CELL_COUNT; i++) {
      const x = gridPoints[0][0].x * DPR + (i/CELL_COUNT) * ((gridPoints[0][CELL_COUNT].x - gridPoints[0][0].x) * DPR);
      mctx.moveTo(x, gridPoints[0][0].y * DPR);
      mctx.lineTo(x, gridPoints[INTER_COUNT-1][0].y * DPR);
    }
    for (let j=0; j<=CELL_COUNT; j++) {
      const y = gridPoints[0][0].y * DPR + (j/CELL_COUNT) * ((gridPoints[INTER_COUNT-1][0].y - gridPoints[0][0].y) * DPR);
      mctx.moveTo(gridPoints[0][0].x * DPR, y);
      mctx.lineTo(gridPoints[0][INTER_COUNT-1].x * DPR, y);
    }
    mctx.stroke();
    
    // Линии между точками
    mctx.save();
    mctx.lineCap = 'round';
    for (let i=0; i<nodes.length; i++) {
      for (let j=i+1; j<nodes.length; j++) {
        const A = nodes[i], B = nodes[j];
        const d = Math.hypot(A.x - B.x, A.y - B.y);
        if (d < (w * 0.32)) {
          const baseAlpha = Math.max(0.10, 0.32 - (d / (w*0.9)) * 0.22);
          
          // Применяем forward distortion к координатам для линий
          const A_distorted = forwardDistortion(A.x, A.y, w, h);
          const B_distorted = forwardDistortion(B.x, B.y, w, h);
          
          const grad = mctx.createLinearGradient(
            A_distorted.x * DPR, A_distorted.y * DPR, 
            B_distorted.x * DPR, B_distorted.y * DPR
          );
          grad.addColorStop(0, glowColor(baseAlpha));
          grad.addColorStop(1, glowColor(baseAlpha * 0.45));
          mctx.strokeStyle = grad;
          mctx.lineWidth = 1 * DPR;
          mctx.beginPath();
          mctx.moveTo(A_distorted.x * DPR, A_distorted.y * DPR);
          mctx.lineTo(B_distorted.x * DPR, B_distorted.y * DPR);
          mctx.stroke();
        }
      }
    }
    mctx.restore();
    
    // Точки (с forward distortion)
    for (const n of nodes) {
      const pulse = 0.5 + 0.5 * Math.sin((n.id + tick*0.02) * 1.2);
      const intensity = n.selected ? 1.4 : (n.locked ? 1.2 : 1.0);
      const glowR = (6 * DPR + pulse*3*DPR) * intensity;
      
      // Применяем forward distortion к координатам точки
      const posDistorted = forwardDistortion(n.x, n.y, w, h);
      
      const c = n.locked ? `rgba(255,60,60,${0.36 * intensity})` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.36 * intensity})`;
      const c2 = n.locked ? `rgba(255,60,60,${0.12 * intensity})` : `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.12 * intensity})`;
      const grd = mctx.createRadialGradient(posDistorted.x*DPR, posDistorted.y*DPR, 0, posDistorted.x*DPR, posDistorted.y*DPR, glowR);
      grd.addColorStop(0, c);
      grd.addColorStop(0.6, c2);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = grd;
      mctx.fillRect(posDistorted.x*DPR - glowR, posDistorted.y*DPR - glowR, glowR*2, glowR*2);

      // Ядро точки
      mctx.beginPath();
      const coreR = 2.2 * DPR + (n.selected ? 1.6*DPR : 0);
      mctx.fillStyle = n.locked ? redColor(1) : glowColor(1);
      mctx.arc(posDistorted.x*DPR, posDistorted.y*DPR, coreR, 0, Math.PI*2);
      mctx.fill();

      // Обводка
      mctx.beginPath();
      mctx.lineWidth = 1 * DPR;
      mctx.strokeStyle = n.locked ? redColor(0.92) : glowColor(0.92);
      mctx.arc(posDistorted.x*DPR, posDistorted.y*DPR, coreR + 1.2*DPR, 0, Math.PI*2);
      mctx.stroke();
    }

    // Текст
    mctx.save();
    mctx.font = `${10 * DPR}px monospace`;
    mctx.fillStyle = glowColor(0.95);
    mctx.textAlign = 'right';
    mctx.fillText('VIGIL NET', w*DPR - 8*DPR, 12*DPR);
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
})();
