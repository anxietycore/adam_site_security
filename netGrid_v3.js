// netGrid_v3-DEBUG.js — ОТЛАДОЧНАЯ ВЕРСИЯ
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
    const CRT_DISTORTION = 0.28;
    
    // ----- ОТЛАДОЧНЫЕ ПЕРЕМЕННЫЕ -----
    let DEBUG_MODE = true; // ✅ Включите/выключите отладку
    let debugMousePos = { x: 0, y: 0, undistortedX: 0, undistortedY: 0 };
    let debugNearestNode = null;

    // ----- ОБРАТНАЯ ТРАНСФОРМАЦИЯ -----
    let inverseLUT = null;
    let lutSize = { w: -1, h: -1 };

    function buildInverseLUT(canvasWidth, canvasHeight) {
      console.log(`[DEBUG] Building LUT ${canvasWidth}x${canvasHeight}`);
      const step = 1;
      const cols = Math.ceil(canvasWidth / step);
      const rows = Math.ceil(canvasHeight / step);
      
      lutSize.w = canvasWidth;
      lutSize.h = canvasHeight;
      inverseLUT = new Array(rows);
      
      for (let y = 0; y < rows; y++) {
        inverseLUT[y] = new Array(cols);
        for (let x = 0; x < cols; x++) {
          const px = x * step;
          const py = y * step;
          
          const xd = (px / canvasWidth) * 2 - 1;
          const yd = (py / canvasHeight) * 2 - 1;
          const rd = Math.sqrt(xd*xd + yd*yd);
          
          const k = CRT_DISTORTION;
          let r = rd;
          
          if (k !== 0 && rd > 0) {
            const discriminant = (1 - k) * (1 - k) + 4 * k * rd;
            if (discriminant >= 0) {
              r = (-(1 - k) + Math.sqrt(discriminant)) / (2 * k);
            }
          }
          
          const factor = (r > 0) ? 1 / (1 + k * (r - 1)) : 1;
          const xn = xd * factor;
          const yn = yd * factor;
          
          inverseLUT[y][x] = {
            x: (xn + 1) * 0.5 * canvasWidth,
            y: (yn + 1) * 0.5 * canvasHeight
          };
        }
      }
      console.log(`[DEBUG] LUT built: ${rows}x${cols} cells`);
    }

    function applyInverseCRT(distortedPx, distortedPy) {
      if (!inverseLUT || lutSize.w !== w || lutSize.h !== h) {
        if (w <= 0 || h <= 0) return { x: distortedPx, y: distortedPy };
        buildInverseLUT(w, h);
      }
      
      const step = 1;
      const col = Math.floor(distortedPx / step);
      const row = Math.floor(distortedPy / step);
      
      if (row < 0 || row >= inverseLUT.length || col < 0 || col >= inverseLUT[0].length) {
        return { x: distortedPx, y: distortedPy };
      }
      
      const fracX = (distortedPx - col * step) / step;
      const fracY = (distortedPy - row * step) / step;
      
      const topLeft = inverseLUT[row][col];
      const topRight = inverseLUT[row][Math.min(col + 1, inverseLUT[0].length - 1)];
      const bottomLeft = inverseLUT[Math.min(row + 1, inverseLUT.length - 1)][col];
      const bottomRight = inverseLUT[Math.min(row + 1, inverseLUT.length - 1)][Math.min(col + 1, inverseLUT[0].length - 1)];
      
      const topX = topLeft.x * (1 - fracX) + topRight.x * fracX;
      const bottomX = bottomLeft.x * (1 - fracX) + bottomRight.x * fracX;
      const finalX = topX * (1 - fracY) + bottomX * fracY;
      
      const topY = topLeft.y * (1 - fracX) + topRight.y * fracX;
      const bottomY = bottomLeft.y * (1 - fracX) + bottomRight.y * fracX;
      const finalY = topY * (1 - fracY) + bottomY * fracY;
      
      return { x: finalX, y: finalY };
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

    // ----- Внутреннее состояние -----
    let w = 0, h = 0;
    let gridPoints = [];
    let nodes = [];
    let raf = null;
    let tick = 0;
    let selectedNode = null;
    let draggingNode = null;
    let mouse = { x: 0, y: 0, down: false };

    const HIT_RADIUS = 20 * DPR; // ✅ Увеличен для отладки

    // ----- Символы -----
    const SYMBOLS = {
      V: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[6,0],[5,1],[4,2]],
      I: [[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3]],
      X: [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[0,6],[1,5],[2,4],[4,2],[5,1],[6,0]]
    };
    const symbolNames = Object.keys(SYMBOLS);
    const currentTargetName = symbolNames[Math.floor(Math.random()*symbolNames.length)];
    const currentTarget = SYMBOLS[currentTargetName];

    // ----- Вспомогательные функции -----
    function glowColor(a=1){ return `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${a})`; }
    function redColor(a=1){ return `rgba(255,60,60,${a})`; }

    function resize() {
      const cssW = SIZE_CSS, cssH = SIZE_CSS;
      mapCanvas.style.width = cssW + 'px';
      mapCanvas.style.height = cssH + 'px';
      w = mapCanvas.width = Math.max(120, Math.floor(cssW * DPR));
      h = mapCanvas.height = Math.max(120, Math.floor(cssH * DPR));
      
      console.log(`[DEBUG] Resize: canvas ${w}x${h}, CSS ${cssW}x${cssH}, DPR ${DPR}`);
      
      buildInverseLUT(w, h);
      buildGrid();
      resetNodesIfNeeded();
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
      console.log(`[DEBUG] Nodes respawned: ${nodes.length} nodes`);
    }

    function getMousePosOnCanvas(ev) {
      const rect = mapCanvas.getBoundingClientRect();
      const rawX = (ev.clientX - rect.left) * (mapCanvas.width / rect.width);
      const rawY = (ev.clientY - rect.top) * (mapCanvas.height / rect.height);
      
      const undistorted = applyInverseCRT(rawX, rawY);
      
      // ✅ СОХРАНЯЕМ ДЛЯ ОТЛАДКИ
      debugMousePos = {
        x: rawX,
        y: rawY,
        undistortedX: undistorted.x,
        undistortedY: undistorted.y
      };
      
      return undistorted;
    }

    // ----- ГЛОБАЛЬНЫЕ ОТЛАДОЧНЫЕ КОМАНДЫ -----
    window.netGridDebug = {
      getNodeInfo: (id) => {
        const n = nodes.find(n => n.id === id);
        if (!n) console.log(`[DEBUG] Node ${id} not found`);
        else console.log(`[DEBUG] Node ${id}: x=${n.x.toFixed(2)}, y=${n.y.toFixed(2)}, gx=${n.gx}, gy=${n.gy}`);
      },
      getMouseInfo: () => {
        console.log(`[DEBUG] Mouse (distorted): ${debugMousePos.x.toFixed(2)}, ${debugMousePos.y.toFixed(2)}`);
        console.log(`[DEBUG] Mouse (undistorted): ${debugMousePos.undistortedX.toFixed(2)}, ${debugMousePos.undistortedY.toFixed(2)}`);
      },
      toggleVisualDebug: () => {
        DEBUG_MODE = !DEBUG_MODE;
        console.log(`[DEBUG] Visual debug: ${DEBUG_MODE ? 'ON' : 'OFF'}`);
      },
      testHit: (nodeId) => {
        const n = nodes.find(n => n.id === nodeId);
        if (!n) return;
        const dist = Math.hypot(debugMousePos.undistortedX - n.x, debugMousePos.undistortedY - n.y);
        console.log(`[DEBUG] Distance to node ${nodeId}: ${dist.toFixed(2)} (hit radius: ${HIT_RADIUS})`);
      },
      rebuildLUT: () => {
        buildInverseLUT(w, h);
        console.log('[DEBUG] LUT rebuilt manually');
      }
    };

    // ----- Обработчики мыши -----
    mapCanvas.addEventListener('mousedown', (ev) => {
      const m = getMousePosOnCanvas(ev);
      mouse.down = true;
      mouse.x = m.x; mouse.y = m.y;
      
      console.log(`[MOUSE] DOWN at distorted: ${debugMousePos.x.toFixed(2)}, ${debugMousePos.y.toFixed(2)}`);
      console.log(`[MOUSE] DOWN at undistorted: ${m.x.toFixed(2)}, ${m.y.toFixed(2)}`);
      
      let found = null;
      let closestDist = Infinity;
      let closestNode = null;
      
      for (const n of nodes) {
        const d = Math.hypot(m.x - n.x, m.y - n.y);
        console.log(`[HITTEST] Node ${n.id}: distance = ${d.toFixed(2)}`);
        if (d < closestDist) {
          closestDist = d;
          closestNode = n;
        }
        if (d < HIT_RADIUS) { 
          found = n; 
          break; 
        }
      }
      
      if (closestNode) {
        console.log(`[HITTEST] Closest node: ${closestNode.id} at distance ${closestDist.toFixed(2)}`);
      }
      
      if (found) {
        console.log(`[HITTEST] SUCCESS! Selected node ${found.id}`);
        debugNearestNode = found;
        
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
        console.log(`[HITTEST] MISS! No node within ${HIT_RADIUS}px`);
        if (selectedNode) { selectedNode.selected = false; selectedNode = null; }
      }
    });

    window.addEventListener('mousemove', (ev) => {
      const m = getMousePosOnCanvas(ev);
      mouse.x = m.x; mouse.y = m.y;
      
      let hoveredNode = null;
      for (const n of nodes) {
        if (Math.hypot(m.x - n.x, m.y - n.y) < HIT_RADIUS) {
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
      console.log('[MOUSE] UP');
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

      // ----- ОТЛАДОЧНЫЕ ВИЗУАЛЬНЫЕ МАРКЕРЫ -----
      if (DEBUG_MODE) {
        // Красный крестик на позиции мыши (undistorted)
        if (mouse.down) {
          mctx.strokeStyle = '#FF0000';
          mctx.lineWidth = 2 * DPR;
          mctx.beginPath();
          mctx.moveTo(mouse.x - 10 * DPR, mouse.y);
          mctx.lineTo(mouse.x + 10 * DPR, mouse.y);
          mctx.moveTo(mouse.x, mouse.y - 10 * DPR);
          mctx.lineTo(mouse.x, mouse.y + 10 * DPR);
          mctx.stroke();
          
          // Желтый круг hit radius
          mctx.strokeStyle = '#FFFF00';
          mctx.lineWidth = 1 * DPR;
          mctx.globalAlpha = 0.5;
          mctx.beginPath();
          mctx.arc(mouse.x, mouse.y, HIT_RADIUS, 0, Math.PI*2);
          mctx.stroke();
          mctx.globalAlpha = 1;
        }
        
        // Зеленый круг вокруг ближайшей узловой точки
        if (debugNearestNode) {
          mctx.strokeStyle = '#00FF00';
          mctx.lineWidth = 2 * DPR;
          mctx.beginPath();
          mctx.arc(debugNearestNode.x, debugNearestNode.y, HIT_RADIUS + 5 * DPR, 0, Math.PI*2);
          mctx.stroke();
        }
      }

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

      // Рисуем узлы
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

    console.log('[DEBUG] netGrid_v3-DEBUG loaded. Commands: netGridDebug.getMouseInfo(), netGridDebug.getNodeInfo(id), netGridDebug.toggleVisualDebug(), netGridDebug.testHit(id)');

  } catch (err) {
    console.error('[DEBUG] CRITICAL ERROR:', err);
  }
})();
