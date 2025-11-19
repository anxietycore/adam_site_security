// netGrid_v3-KEYMODE.js — Режим управления клавиатурой + логика ключа
(() => {
  try {
    // ════════════════════════════════════════════════════════════════════
    // ЦЕЛЕВАЯ КОНФИГУРАЦИЯ ДЛЯ АКТИВАЦИИ КЛЕЙМА
    // Формат: [[x,y], [x,y], ...] — координаты ПЕРЕСЕЧЕНИЙ, не пиксели!
    // ТЕСТОВЫЙ КЛЮЧ: буква "V" (10 точек)
    // ASCII представление:
    //   0 1 2 3 4 5 6
    // 0 . . . . . . .
    // 1 . . . . . . .
    // 2 . . . . ● . .
    // 3 . . . ● . ● .
    // 4 . . ● . . . ●
    // 5 . ● . . . . .
    // 6 ● . . . . . .
    const TARGET_PATTERN = [
      [0,6], [1,5], [2,4], [3,3], [4,2],  // Левая ветвь V
      [6,6], [5,5], [4,4], [3,2], [2,1]   // Правая ветвь V (зеркально)
    ];
    // ════════════════════════════════════════════════════════════════════

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
    const MOVE_SPEED = 0.02; // Скорость плавного движения (0-1)

    // ----- DOM-элементы -----
    const mapCanvas = document.createElement('canvas');
    Object.assign(mapCanvas.style, {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      width: `${SIZE_CSS}px`,
      height: `${SIZE_CSS}px`,
      pointerEvents: 'none', // Отключаем мышь полностью
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

    // ----- Внутреннее состояние -----
    let w = 0, h = 0;
    let gridPoints = [];
    let nodes = [];
    let raf = null;
    let tick = 0;
    let selectedNode = null;
    let isGridMode = false;
    let keyDegradation = 0; // Деградация сетки (0-100)
    let systemDegradation = 0; // Деградация всей системы (0-100)

    // ----- Вспомогательные функции -----
    function glowColor(a=1){ return `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${a})`; }
    function redColor(a=1){ return `rgba(255,60,60,${a})`; }

    function resize() {
      const cssW = SIZE_CSS, cssH = SIZE_CSS;
      mapCanvas.style.width = cssW + 'px';
      mapCanvas.style.height = cssH + 'px';
      w = mapCanvas.width = Math.floor(cssW * DPR);
      h = mapCanvas.height = Math.floor(cssH * DPR);
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
          n.y = gridPoints[n.gy][n.gy].y;
          n.targetGx = n.gx;
          n.targetGy = n.gy;
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
          targetGx: c, targetGy: r, // Целевая позиция для плавного движения
          locked: false,
          selected: false,
          lastMove: 0
        };
      });
      selectedNode = null;
    }

    // ----- API для терминала -----
    window.__netGrid = {
      setGridMode(active){
        isGridMode = active;
        if (active) {
          mapCanvas.style.pointerEvents = 'auto';
          if (!selectedNode && nodes.length > 0) {
            selectedNode = nodes[0];
            selectedNode.selected = true;
          }
          updateStatusBar();
        } else {
          mapCanvas.style.pointerEvents = 'none';
          if (selectedNode) {
            selectedNode.selected = false;
            selectedNode = null;
          }
        }
      },
      isGridMode: () => isGridMode,
      checkSolution(){
        const lockedNodes = nodes.filter(n => n.locked);
        if (lockedNodes.length !== TARGET_PATTERN.length) {
          return { solved: false, total: TARGET_PATTERN.length, correct: 0, lockedCount: lockedNodes.length };
        }
        
        let correct = 0;
        for (const node of lockedNodes) {
          const isCorrect = TARGET_PATTERN.some(([gx, gy]) => node.gx === gx && node.gy === gy);
          if (isCorrect) correct++;
        }
        
        return { 
          solved: correct === TARGET_PATTERN.length,
          total: TARGET_PATTERN.length,
          correct: correct,
          lockedCount: lockedNodes.length
        };
      },
      getDegradation: () => keyDegradation,
      addDegradation: (v) => { keyDegradation = Math.max(0, Math.min(100, keyDegradation + v)); },
      setSystemDegradation: (level) => { systemDegradation = level; }
    };

    function updateStatusBar(){
      if (!isGridMode) return;
      const nodeInfo = selectedNode ? `Узел: ${selectedNode.id} [${selectedNode.gx},${selectedNode.gy}]` : 'Узел: -';
      statusEl.textContent = `[РЕЖИМ СЕТКИ] | ${nodeInfo} | [WASD] Движение | [Space] Закрепить/Открепить | [Tab] Выбор | [ESC] Выход`;
    }

    function moveSelectedNode(dx, dy){
      if (!selectedNode || selectedNode.locked) return;
      
      const newGx = Math.max(0, Math.min(INTER_COUNT-1, selectedNode.gx + dx));
      const newGy = Math.max(0, Math.min(INTER_COUNT-1, selectedNode.gy + dy));
      
      // Проверка занятости
      const occupied = nodes.some(n => 
        n !== selectedNode && 
        n.locked && 
        n.gx === newGx && 
        n.gy === newGy
      );
      
      if (occupied) {
        statusEl.textContent = '⚠ КООРДИНАТА ЗАНЯТА';
        setTimeout(updateStatusBar, 1000);
        return;
      }
      
      selectedNode.gx = newGx;
      selectedNode.gy = newGy;
      selectedNode.targetGx = newGx;
      selectedNode.targetGy = newGy;
      updateStatusBar();
    }

    function toggleLockSelected(){
      if (!selectedNode) return;
      selectedNode.locked = !selectedNode.locked;
      window.__netGrid.addDegradation(0.5); // +0.5% за каждое действие
      
      // Автоматическая проверка при достижении нужного кол-ва закреплений
      const lockedCount = nodes.filter(n => n.locked).length;
      if (lockedCount === TARGET_PATTERN.length) {
        setTimeout(() => {
          const result = window.__netGrid.checkSolution();
          if (result.solved) {
            // Успех
            if (window.__TerminalCanvas) {
              window.__TerminalCanvas.addColoredText('>>> КЛЮЧ ПОДОШЁЛ <<<', '#00FF41');
              window.__TerminalCanvas.addColoredText('> Доступ к сектору OBSERVER-7 открыт', '#FFFF00');
            }
            // Мигаем сеткой зелёным
            flashGridSuccess();
          } else {
            // Неудача
            const wrong = lockedCount - result.correct;
            if (window.__TerminalCanvas) {
              window.__TerminalCanvas.addColoredText('> Конфигурация не соответствует протоколу', '#FF4444');
              window.__TerminalCanvas.addColoredText(`> Правильных узлов: ${result.correct}/${result.total} | Неправильных: ${wrong}`, '#FFFF00');
            }
            window.__netGrid.addDegradation(2); // +2% деградация сетки
          }
        }, 500);
      }
    }

    function selectNextNode(){
      if (nodes.length === 0) return;
      if (selectedNode) selectedNode.selected = false;
      const currentIndex = selectedNode ? selectedNode.id : -1;
      const nextIndex = (currentIndex + 1) % nodes.length;
      selectedNode = nodes[nextIndex];
      selectedNode.selected = true;
      updateStatusBar();
    }

    function selectPrevNode(){
      if (nodes.length === 0) return;
      if (selectedNode) selectedNode.selected = false;
      const currentIndex = selectedNode ? selectedNode.id : 0;
      const prevIndex = currentIndex === 0 ? nodes.length - 1 : currentIndex - 1;
      selectedNode = nodes[prevIndex];
      selectedNode.selected = true;
      updateStatusBar();
    }

    function flashGridSuccess(){
      // Визуальный эффект: 3 быстрых вспышки зелёным
      let flashCount = 0;
      const flashInterval = setInterval(() => {
        nodes.forEach(n => n.selected = !n.selected); // Мигаем выделением
        flashCount++;
        if (flashCount >= 6) {
          clearInterval(flashInterval);
          nodes.forEach(n => n.selected = false);
          selectedNode = null;
        }
      }, 100);
    }

    // Обновление автономного движения точек
    function updateAutonomousMovement() {
      const now = Date.now();
      const degradation = systemDegradation;
      
      for (const n of nodes) {
        // Если точка выбрана, закреплена или деградация 90-99% (хаос) - не двигаем
        if (n.selected || n.locked || (degradation >= 90 && degradation < 100)) {
          n.targetGx = n.gx;
          n.targetGy = n.gy;
          continue;
        }
        
        // При высокой деградации (80-89%) - увеличиваем частоту движения и хаотичность
        const moveChance = degradation > 80 ? 0.3 : 0.15;
        const moveDelay = degradation > 80 ? 300 : AUTONOMOUS_MOVE_COOLDOWN;
        
        if (now - n.lastMove > moveDelay && Math.random() < moveChance) {
          // Выбираем случайную соседнюю позицию на сетке
          const dirs = [[0,1], [1,0], [0,-1], [-1,0], [1,1], [-1,-1], [1,-1], [-1,1]];
          const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
          const newGx = Math.max(0, Math.min(INTER_COUNT-1, n.gx + dx));
          const newGy = Math.max(0, Math.min(INTER_COUNT-1, n.gy + dy));
          
          // Проверяем, не занята ли целевая позиция
          const occupied = nodes.some(other => 
            other !== n && 
            other.locked && 
            other.gx === newGx && 
            other.gy === newGy
          );
          
          if (!occupied) {
            n.targetGx = newGx;
            n.targetGy = newGy;
            n.lastMove = now;
          }
        }
      }
      
      // Плавная интерполяция к целевой позиции
      for (const n of nodes) {
        const targetX = gridPoints[n.targetGy][n.targetGx].x;
        const targetY = gridPoints[n.targetGy][n.targetGx].y;
        
        // При деградации 90-99% - добавляем хаотичные смещения
        if (degradation >= 90 && degradation < 100) {
          n.x += (Math.random() - 0.5) * 10;
          n.y += (Math.random() - 0.5) * 10;
          // Ограничиваем размерами canvas
          n.x = Math.max(0, Math.min(w, n.x));
          n.y = Math.max(0, Math.min(h, n.y));
        } else {
          // Плавное движение
          n.x += (targetX - n.x) * MOVE_SPEED;
          n.y += (targetY - n.y) * MOVE_SPEED;
        }
        
        // Обновляем grid coordinates если близко к цели
        const dist = Math.hypot(targetX - n.x, targetY - n.y);
        if (dist < 1) {
          n.gx = n.targetGx;
          n.gy = n.targetGy;
        }
      }
    }

    // ----- Обработчики клавиатуры -----
    document.addEventListener('keydown', (e) => {
      if (!isGridMode) return;
      
      switch(e.key) {
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) selectPrevNode();
          else selectNextNode();
          break;
        case ' ':
          e.preventDefault();
          toggleLockSelected();
          break;
        case 'Escape':
          window.__netGrid.setGridMode(false);
          if (window.__TerminalCanvas) {
            window.__TerminalCanvas.addColoredText('> Выход из режима сетки', '#00FF41');
          }
          break;
        case 'w':
        case 'ArrowUp':
          e.preventDefault();
          moveSelectedNode(0, -1);
          break;
        case 's':
        case 'ArrowDown':
          e.preventDefault();
          moveSelectedNode(0, 1);
          break;
        case 'a':
        case 'ArrowLeft':
          e.preventDefault();
          moveSelectedNode(-1, 0);
          break;
        case 'd':
        case 'ArrowRight':
          e.preventDefault();
          moveSelectedNode(1, 0);
          break;
      }
    });

    // ----- Анимация и рендер -----
    function draw() {
      mctx.clearRect(0,0,w,h);
      
      // Обновляем автономное движение
      updateAutonomousMovement();
      
      // Фон
      mctx.fillStyle = 'rgba(2,18,12,0.66)';
      mctx.beginPath();
      mctx.roundRect(0, 0, w, h, 8*DPR);
      mctx.fill();

      // Виньетка
      const vig = mctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.06, w/2, h/2, Math.max(w,h)*0.9);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.14)');
      mctx.fillStyle = vig;
      mctx.fillRect(0,0,w,h);

      // Сетка
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

      // Связи
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

      // Узлы
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

        // Ядро узла
        mctx.beginPath();
        const coreR = 2.2 * DPR + (n.selected ? 1.6*DPR : 0);
        mctx.fillStyle = n.locked ? redColor(1) : glowColor(1);
        mctx.arc(n.x, n.y, coreR, 0, Math.PI*2);
        mctx.fill();

        // Обводка
        mctx.beginPath();
        mctx.lineWidth = 1 * DPR;
        mctx.strokeStyle = n.selected ? '#FFFFFF' : (n.locked ? redColor(0.92) : glowColor(0.92));
        mctx.arc(n.x, n.y, coreR + 1.2*DPR, 0, Math.PI*2);
        mctx.stroke();

        // ID узла
        if (n.selected || keyDegradation > 60) {
          mctx.save();
          mctx.font = `${10 * DPR}px ${'monospace'}`;
          mctx.fillStyle = '#FFFFFF';
          mctx.textAlign = 'center';
          mctx.textBaseline = 'middle';
          mctx.fillText(String(n.id), n.x, n.y);
          mctx.restore();
        }
      }

      // ASCII-подсказка ключа (показывается при низкой деградации)
      if (systemDegradation < 50) {
        mctx.save();
        mctx.font = `${8 * DPR}px monospace`;
        mctx.fillStyle = glowColor(0.3);
        mctx.textAlign = 'left';
        mctx.textBaseline = 'top';
        const ascii = [
          'КЛЮЧ: Буква "V"',
          '  0 1 2 3 4 5 6',
          '0 . . . . . . .',
          '1 . . . . . . .',
          '2 . . . . ● . .',
          '3 . . . ● . ● .',
          '4 . . ● . . . ●',
          '5 . ● . . . . .',
          '6 ● . . . . . .'
        ];
        ascii.forEach((line, i) => {
          mctx.fillText(line, 10 * DPR, 20 * DPR + i * 10 * DPR);
        });
        mctx.restore();
      }

      // Лейбл
      mctx.save();
      mctx.font = `${10 * DPR}px monospace`;
      mctx.fillStyle = glowColor(0.95);
      mctx.textAlign = 'right';
      mctx.fillText('VIGIL NET', w - 8*DPR, 12*DPR);
      mctx.restore();
    }

    // ----- Запуск -----
    window.addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame(function loop(){
      tick++;
      draw();
      raf = requestAnimationFrame(loop);
    });

    console.log(`[DEBUG] netGrid_v3-KEYMODE loaded. Canvas: ${w}x${h}, DPR: ${DPR}`);

  } catch (err) {
    console.error('[DEBUG] CRITICAL ERROR:', err);
  }
})();
