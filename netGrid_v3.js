// netGrid_v3-BIOCODE-FINAL-V2.js — МГНОВЕННЫЙ СБРОС, БЕЗ ГОВНО-КОДА
(() => {
  try {
    // ════════════════════════════════════════════════════════════════════
    // ЦЕЛЕВАЯ КОНФИГУРАЦИЯ: СИМВОЛ «БИОКОД» (15 узлов)
    // ════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════
// 1. БАЗОВЫЕ КОНСТАНТЫ (все определяются ПЕРВЫМИ)
// ════════════════════════════════════════════════════════════════════
const CELL_COUNT = 7;
const NODE_COUNT = 15;
const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
const SIZE_CSS = 300;
const COLOR = { r: 6, g: 160, b: 118 };
const COLOR_DEGRADED = { r: 136, g: 68, b: 255 };
const MAP_Z = 40;
const STATUS_Z = 45;
const MOVE_SPEED = 0.05;

// ════════════════════════════════════════════════════════════════════
// 2. ЦЕЛЕВАЯ СХЕМА (правильное решение — КЛЮЧ)
// ════════════════════════════════════════════════════════════════════
const TARGET_PATTERN = [

  [3,0], [4,0], 
  [5,1], 
  [3,2], [4,2], [5,2], 
  [2,3], [3,3], [5,3],
  [1,4], [2,4], [4,4], 
  [0,5], [1,5], 
  [0,6]
];

// ════════════════════════════════════════════════════════════════════
// 3. СТАРТОВАЯ СХЕМА (случайная — МЕНЯЕТСЯ НА `let`)
// ════════════════════════════════════════════════════════════════════
function generateStartPattern() {
  const used = new Set();
  const pattern = [];
  for (let i = 0; i < TARGET_PATTERN.length; i++) {
    let gx, gy, key;
    do {
      gx = Math.floor(Math.random() * CELL_COUNT);
      gy = Math.floor(Math.random() * CELL_COUNT);
      key = `${gx},${gy}`;
    } while (used.has(key));
    used.add(key);
    pattern.push([gx, gy]);
  }
  return pattern;
}

let START_PATTERN = generateStartPattern(); // ← ВАЖНО: let, НЕ const!

    const mapCanvas = document.createElement('canvas');
    Object.assign(mapCanvas.style, {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      width: `${SIZE_CSS}px`,
      height: `${SIZE_CSS}px`,
      pointerEvents: 'none',
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
      fontFamily: "'Press Start 2P', monospace, Courier",
      fontSize: '11px',
      color: `rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 1)`,
      textShadow: `0 0 10px rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 0.9)`,
      zIndex: STATUS_Z,
      pointerEvents: 'none',
      userSelect: 'none',
      letterSpacing: '0.6px',
      fontWeight: '700',
      opacity: '1',
      lineHeight: '1.4'
    });
    document.body.appendChild(statusEl);

    let w = 0, h = 0;
    let gridPoints = [];
    let nodes = [];
    let raf = null;
    let tick = 0;
    let selectedNode = null;
    let isGridMode = false;
    let keyDegradation = 0;
    let systemDegradation = 0;
const AudioManager = {
  play: (file, options = {}) => {
    try {
      // Если файл УЖЕ содержит расширение .mp3, ищем как есть
      if (file.endsWith('.mp3')) {
        const audio = new Audio(`sounds/${file}`);
        audio.volume = options.volume !== undefined ? options.volume : 0.7;
        if (options.playbackRate) audio.playbackRate = options.playbackRate;
        audio.play().catch(() => {});
        return audio;
      }
      
      // Для остальных (без расширения) ищем .wav, потом .mp3
      const paths = [
        `sounds/grid/${file}.wav`,
        `sounds/grid/${file}.mp3`,
        `sounds/grid/${file}`
      ];
      
      for (let path of paths) {
        try {
          const audio = new Audio(path);
          audio.volume = options.volume !== undefined ? options.volume : 0.7;
          if (options.playbackRate) audio.playbackRate = options.playbackRate;
          audio.play().catch(() => {});
          return audio;
        } catch(e) {}
      }
      
      console.warn(`Audio not found: ${file}`);
      return null;
    } catch(e) {
      console.warn(`Audio failed: ${file}`);
      return null;
    }
  }
};

    function glowColor(a=1, degraded=false){ 
      const c = degraded ? COLOR_DEGRADED : COLOR;
      return `rgba(${c.r},${c.g},${c.b},${a})`; 
    }
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
      const margin = 15 * DPR;
      const innerW = w - margin*2;
      const innerH = h - margin*2;
      for (let r=0; r<CELL_COUNT; r++){
        const row = [];
        for (let c=0; c<CELL_COUNT; c++){
          const x = margin + (c / (CELL_COUNT-1)) * innerW;
          const y = margin + (r / (CELL_COUNT-1)) * innerH;
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
          n.targetGx = n.gx;
          n.targetGy = n.gy;
        }
      }
    }

function respawnNodes() {
  nodes = START_PATTERN.map((coord, idx) => {
    const [gx, gy] = coord;
    const p = gridPoints[gy][gx];
    return {
      id: idx,
      gx: gx, gy: gy,
      x: p.x, y: p.y,
      targetGx: gx, targetGy: gy,
      locked: false,
      selected: false,
      lastMove: 0,
    };
  });
  selectedNode = null;
}

    window.__netGrid = {
      setGridMode(active){
        isGridMode = active;
        mapCanvas.style.pointerEvents = active ? 'auto' : 'none';
        
        if (active && !selectedNode && nodes.length > 0) {
          selectedNode = nodes[0];
          selectedNode.selected = true;
        } else if (!active && selectedNode) {
          selectedNode.selected = false;
          selectedNode = null;
        }
        updateStatusBar();
      },
      
      isGridMode: () => isGridMode,
      
checkSolution(){
  const lockedNodes = nodes.filter(n => n.locked);
  
  if (lockedNodes.length === 0) {
    return { solved: false, total: TARGET_PATTERN.length, correct: 0, lockedCount: 0 };
  }
  
  let correct = 0;
  
  // Проверяем КАЖДУЮ ПОЗИЦИЮ в ключе
  for (let i = 0; i < TARGET_PATTERN.length; i++) {
    const [targetX, targetY] = TARGET_PATTERN[i];
    
    // Есть ли ТАМ закрепленный узел?
    const nodeAtTarget = lockedNodes.find(n => n.gx === targetX && n.gy === targetY);
    
    if (nodeAtTarget) correct++;
  }
  
  return { 
    solved: correct === TARGET_PATTERN.length,
    total: TARGET_PATTERN.length,
    correct: correct,
    lockedCount: lockedNodes.length
  };
},
      
      addDegradation: (v) => { 
        keyDegradation = Math.max(0, Math.min(100, keyDegradation + Math.round(v))); 
      },
      
      setSystemDegradation: (level) => { 
        systemDegradation = level;
        if (level < 80) {
          mapCanvas.style.filter = '';
          mapCanvas.style.transform = '';
          mapCanvas.style.opacity = '1';
        }
      },
      
      getDegradation: () => keyDegradation,
      
forceReset() {
  console.log('[CRITICAL] NetGrid forceReset triggered');
  systemDegradation = 0;
  keyDegradation = 0;
  tick = 0;
  
  // ════════════════════════════════════════════════════════════════════
  // ГЕНЕРИРУЕМ НОВЫЕ СЛУЧАЙНЫЕ ПОЗИЦИИ ПРИ КАЖДОМ СБРОСЕ
  // ════════════════════════════════════════════════════════════════════
  START_PATTERN = generateStartPattern();
  
  // ════════════════════════════════════════════════════════════════════
  // ПЕРЕСОЗДАЁМ УЗЛЫ НА ОСНОВЕ НОВОГО ПАТТЕРНА
  // ════════════════════════════════════════════════════════════════════
  respawnNodes();
  
  // Очищаем визуальные эффекты
  mapCanvas.style.pointerEvents = 'none';
  mapCanvas.style.filter = '';
  mapCanvas.style.transform = '';
  mapCanvas.style.opacity = '1';
  
  document.querySelectorAll('#glitchLayer, #cursorLayer').forEach(el => {
    if (el && el.parentNode) el.remove();
  });
}
    };

    function updateStatusBar(){
      if (!isGridMode) {
        statusEl.textContent = `[СЕТЬ: НЕАКТИВНА] | ДЕГРАДАЦИЯ: ${keyDegradation}%`;
        return;
      }
      
      const nodeInfo = selectedNode ? `УЗЕЛ: ${selectedNode.id} [${selectedNode.gx},${selectedNode.gy}]` : 'УЗЕЛ: НЕ ВЫБРАН';
      const lockedCount = nodes.filter(n => n.locked).length;
      const keyStatus = lockedCount === TARGET_PATTERN.length ? 'КЛЮЧ: СОБРАН' : 'КЛЮЧ: НЕ СОБРАН';
      
      statusEl.innerHTML = `[РЕЖИМ СЕТКИ] | ${nodeInfo} | ${keyStatus}<br>
[WASD/↑↓←→] Движение | [Space] Закрепить/Открепить (${lockedCount}/${TARGET_PATTERN.length}) | [Tab] Выбор | [ESC] Выход`;
    }

    function moveSelectedNode(dx, dy){
      if (!selectedNode || selectedNode.locked) return;
      
      if (systemDegradation > 93 && Math.random() < 0.4) {
        selectedNode.selected = false;
        selectedNode = nodes[Math.floor(Math.random() * nodes.length)];
        selectedNode.selected = true;
        statusEl.textContent = '⚠ ОШИБКА: УЗЕЛ ЗАБЛОКИРОВАН СИСТЕМОЙ';
        setTimeout(updateStatusBar, 1500);
        return;
      }
      
      const newGx = Math.max(0, Math.min(CELL_COUNT-1, selectedNode.gx + dx));
      const newGy = Math.max(0, Math.min(CELL_COUNT-1, selectedNode.gy + dy));
      
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
      
      if (systemDegradation > 93 && Math.random() < 0.4) {
        selectedNode.selected = false;
        selectedNode = nodes[Math.floor(Math.random() * nodes.length)];
        selectedNode.selected = true;
        statusEl.textContent = '⚠ ОШИБКА: УЗЕЛ ЗАБЛОКИРОВАН СИСТЕМОЙ';
        setTimeout(updateStatusBar, 1500);
        return;
      }
      
      selectedNode.locked = !selectedNode.locked;
      keyDegradation = Math.max(0, Math.min(100, keyDegradation + 1));
      
      const lockedCount = nodes.filter(n => n.locked).length;
      
      if (lockedCount === TARGET_PATTERN.length) {
        setTimeout(() => {
          const result = window.__netGrid.checkSolution();
          if (result.solved) {
            if (window.__TerminalCanvas) {
              window.__TerminalCanvas.addColoredText('>>> КЛЮЧ ПОДОШЁЛ <<<', '#00FF41');
AudioManager.play('interface_key_success', { volume: 0.5 });
              window.__TerminalCanvas.addColoredText('> Доступ к сектору OBSERVER-7 открыт', '#FFFF00');
            }
            flashGridSuccess();
            keyDegradation = Math.max(0, keyDegradation - 15);
            systemDegradation = Math.max(0, systemDegradation - 10);
          } else {
            if (window.__TerminalCanvas) {
              window.__TerminalCanvas.addColoredText('> Конфигурация не соответствует протоколу', '#FF4444');
              window.__TerminalCanvas.addColoredText(`> Правильных узлов: ${result.correct}/${result.total} | Неправильных: ${lockedCount - result.correct}`, '#FFFF00');
            }
            keyDegradation = Math.min(100, keyDegradation + 2);
            if (window.degradation) {
              window.degradation.addDegradation(2);
            }
          }
        }, 500);
      }
    }

    function flashGridSuccess(){
      let flashCount = 0;
      const flashInterval = setInterval(() => {
        nodes.forEach(n => n.selected = !n.selected);
        flashCount++;
        if (flashCount >= 6) {
          clearInterval(flashInterval);
          nodes.forEach(n => n.selected = false);
          selectedNode = null;
        }
      }, 100);
    }

function updateAutonomousMovement() {
  const now = Date.now();
  const degradation = systemDegradation;
    if (degradation >= 80) nodes.forEach(n => { if (n.locked) n.locked = false; });

  // Обновляем целевые позиции для каждого узла
  for (const n of nodes) {
    // Если узел выбран, заблокирован, или система в критическом состоянии 90-100% - не даём двигаться
    if (n.selected || n.locked || (degradation >= 90 && degradation < 100)) {
      n.targetGx = n.gx;
      n.targetGy = n.gy;
      continue;
    }
    
    // Проверяем, можно ли начать новое движение
    const moveChance = degradation > 80 ? 0.3 : 0.1;
    const moveDelay = degradation > 80 ? 300 : 1500;
    
    if (now - n.lastMove > moveDelay && Math.random() < moveChance) {
      const dirs = [[0,1], [1,0], [0,-1], [-1,0], [1,1], [-1,-1], [1,-1], [-1,1]];
      const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
      const newGx = Math.max(0, Math.min(CELL_COUNT-1, n.gx + dx));
      const newGy = Math.max(0, Math.min(CELL_COUNT-1, n.gy + dy));
      
      // Проверяем, не занята ли целевая ячейка заблокированным узлом
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
  
  // Плавная интерполяция всех узлов к их целевым позициям
  for (const n of nodes) {
    const targetX = gridPoints[n.targetGy][n.targetGx].x;
    const targetY = gridPoints[n.targetGy][n.targetGx].y;
    
    // При деградации 90+ добавляем шум/дрожание
    if (degradation >= 90 && degradation < 100) {
      n.x = targetX + (Math.random() - 0.5) * 15;
      n.y = targetY + (Math.random() - 0.5) * 15;
    } else {
      n.x += (targetX - n.x) * MOVE_SPEED;
      n.y += (targetY - n.y) * MOVE_SPEED;
    }
    
    // Обновляем текущие координаты, если достаточно близко к цели
    if (Math.hypot(targetX - n.x, targetY - n.y) < 1) {
      n.gx = n.targetGx;
      n.gy = n.targetGy;
    }
  }
}

document.addEventListener('keydown', (e) => {
  if (!isGridMode) return;
  
  switch(e.key) {
    case 'Tab':
      e.preventDefault();
      AudioManager.play('grid_select', { volume: 0.5 }); // БЕЗ расширения!
      if (e.shiftKey) selectPrevNode();
      else selectNextNode();
      break;
      
    case ' ':
      e.preventDefault();
      if (selectedNode) {
        if (selectedNode.locked) {
          AudioManager.play('grid_unlock', { volume: 0.6 });
        } else {
          AudioManager.play('grid_lock', { volume: 0.6 });
        }
      }
      toggleLockSelected();
      break;
      
    case 'Escape':
      window.__netGrid.setGridMode(false);
      if (window.__TerminalCanvas) {
		  AudioManager.play('interface_mode_to_terminal', { volume: 0.4 });
        window.__TerminalCanvas.addColoredText('> Выход из режима сетки', '#00FF41');
      }
      break;
      
    case 'w': case 'ц': case 'ArrowUp':
      e.preventDefault();
      AudioManager.play('grid_move', { volume: 0.4 });
      moveSelectedNode(0, -1);
      break;
      
    case 's': case 'ы': case 'ArrowDown':
      e.preventDefault();
      AudioManager.play('grid_move', { volume: 0.4 });
      moveSelectedNode(0, 1);
      break;
      
    case 'a': case 'ф': case 'ArrowLeft':
      e.preventDefault();
      AudioManager.play('grid_move', { volume: 0.4 });
      moveSelectedNode(-1, 0);
      break;
      
    case 'd': case 'в': case 'ArrowRight':
      e.preventDefault();
      AudioManager.play('grid_move', { volume: 0.4 });
      moveSelectedNode(1, 0);
      break;
  }
});

    function selectNextNode() {
      if (!selectedNode || nodes.length === 0) return;
      const currentIndex = nodes.indexOf(selectedNode);
      const nextIndex = (currentIndex + 1) % nodes.length;
      selectedNode.selected = false;
      selectedNode = nodes[nextIndex];
      selectedNode.selected = true;
      updateStatusBar();
    }

    function selectPrevNode() {
      if (!selectedNode || nodes.length === 0) return;
      const currentIndex = nodes.indexOf(selectedNode);
      const prevIndex = currentIndex === 0 ? nodes.length - 1 : currentIndex - 1;
      selectedNode.selected = false;
      selectedNode = nodes[prevIndex];
      selectedNode.selected = true;
      updateStatusBar();
    }

    function drawCleanGrid() {
      mctx.save();
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.globalAlpha = 1;
      mctx.clearRect(0, 0, w, h);

      mctx.fillStyle = 'rgba(2,18,12,0.66)';
      mctx.beginPath();
      mctx.roundRect(0, 0, w, h, 8 * DPR);
      mctx.fill();

      const vig = mctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.06, w/2, h/2, Math.max(w,h)*0.9);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.14)');
      mctx.fillStyle = vig;
      mctx.fillRect(0,0,w,h);

      mctx.strokeStyle = glowColor(0.10, false);
      mctx.lineWidth = 1 * DPR;
      mctx.beginPath();
      for (let i=0;i<CELL_COUNT;i++){
        const x = gridPoints[0][i].x;
        mctx.moveTo(x, gridPoints[0][0].y);
        mctx.lineTo(x, gridPoints[CELL_COUNT-1][0].y);
      }
      for (let j=0;j<CELL_COUNT;j++){
        const y = gridPoints[j][0].y;
        mctx.moveTo(gridPoints[0][0].x, y);
        mctx.lineTo(gridPoints[0][CELL_COUNT-1].x, y);
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
            grad.addColorStop(0, glowColor(baseAlpha, false));
            grad.addColorStop(1, glowColor(baseAlpha * 0.45, false));
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
        const intensity = n.selected ? 1.4 : (n.locked ? 1.2 : 1.0);
        const coreR = (2.2 * DPR + (n.selected ? 1.6*DPR : 0));
        
        mctx.beginPath();
        mctx.fillStyle = n.locked ? redColor(1) : glowColor(1, false);
        mctx.arc(n.x, n.y, coreR, 0, Math.PI*2);
        mctx.fill();
        
        mctx.beginPath();
        mctx.lineWidth = 1 * DPR;
        mctx.strokeStyle = n.selected ? '#FFFFFF' : (n.locked ? redColor(0.92) : glowColor(0.92, false));
        mctx.arc(n.x, n.y, coreR + 1.2*DPR, 0, Math.PI*2);
        mctx.stroke();
      }

      mctx.font = `${10 * DPR}px monospace`;
      mctx.fillStyle = glowColor(0.95, false);
      mctx.textAlign = 'right';
      mctx.fillText('BIOCODE', w - 8*DPR, 12*DPR);

      mctx.restore();
    }

    function drawDegradedGrid(degradationLevel) {
      const effectState = {
        globalAlpha: 1,
        rotation: 0,
        breatheScale: 1,
        nodeScale: 1,
        pulseIntensity: 0.5,
        isVignetteActive: true
      };
      
      if (degradationLevel >= 80 && degradationLevel < 85) {
        effectState.globalAlpha = 0.85 + 0.15 * Math.sin(tick * 0.1);
      }
      
      if (degradationLevel >= 85 && degradationLevel < 90) {
        effectState.rotation = 0.3 * Math.sin(tick * 0.002) * Math.PI / 180;
      }
      
      if (degradationLevel >= 90 && degradationLevel < 95) {
        effectState.breatheScale = 1 + 0.05 * Math.sin(tick * 0.005);
      }
      
      if (degradationLevel >= 95) {
        effectState.globalAlpha = Math.max(0.3, 1 - (degradationLevel - 95) / 5);
        effectState.isVignetteActive = false;
      }
      
      if (effectState.isVignetteActive) {
        const vig = mctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.06, w/2, h/2, Math.max(w,h)*0.9);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.14)');
        mctx.fillStyle = vig;
        mctx.fillRect(0,0,w,h);
      }
      
      mctx.save();
      if (effectState.globalAlpha !== 1) mctx.globalAlpha = effectState.globalAlpha;
      if (effectState.rotation !== 0) {
        mctx.translate(w/2, h/2);
        mctx.rotate(effectState.rotation);
        mctx.translate(-w/2, -h/2);
      }
      if (effectState.breatheScale !== 1) {
        mctx.translate(w/2, h/2);
        mctx.scale(effectState.breatheScale, effectState.breatheScale);
        mctx.translate(-w/2, -h/2);
      }
      
      mctx.strokeStyle = glowColor(0.10, true);
      mctx.lineWidth = 1 * DPR;
      mctx.beginPath();
      for (let i=0;i<CELL_COUNT;i++){
        const x = gridPoints[0][i].x;
        mctx.moveTo(x, gridPoints[0][0].y);
        mctx.lineTo(x, gridPoints[CELL_COUNT-1][0].y);
      }
      for (let j=0;j<CELL_COUNT;j++){
        const y = gridPoints[j][0].y;
        mctx.moveTo(gridPoints[0][0].x, y);
        mctx.lineTo(gridPoints[0][CELL_COUNT-1].x, y);
      }
      mctx.stroke();
      mctx.restore();
      
      mctx.save();
      mctx.lineCap = 'round';
      for (let i=0;i<nodes.length;i++){
        for (let j=i+1;j<nodes.length;j++){
          const A = nodes[i], B = nodes[j];
          const d = Math.hypot(A.x - B.x, A.y - B.y);
          if (d < (w * 0.32)) {
            const baseAlpha = Math.max(0.10, 0.32 - (d / (w*0.9)) * 0.22);
            const grad = mctx.createLinearGradient(A.x, A.y, B.x, B.y);
            grad.addColorStop(0, glowColor(baseAlpha, true));
            grad.addColorStop(1, glowColor(baseAlpha * 0.45, true));
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
        if (degradationLevel >= 85 && degradationLevel < 90) {
          effectState.nodeScale = 0.8 + 0.2 * Math.sin(tick * 0.01 + n.id);
        }
        
        if (degradationLevel >= 80 && degradationLevel < 95) {
          effectState.pulseIntensity = 0.5 + 0.5 * Math.sin((n.id + tick*0.02) * 1.2);
        }
        
        const intensity = n.selected ? 1.4 : (n.locked ? 1.2 : 1.0);
        const glowR = (6 * DPR + effectState.pulseIntensity*3*DPR) * intensity * effectState.nodeScale;
        
        const c = n.locked ? redColor(0.36 * intensity) : glowColor(0.36 * intensity, true);
        const c2 = n.locked ? redColor(0.12 * intensity) : glowColor(0.12 * intensity, true);
        const grd = mctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
        grd.addColorStop(0, c);
        grd.addColorStop(0.6, c2);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grd;
        mctx.fillRect(n.x - glowR, n.y - glowR, glowR*2, glowR*2);
        
        mctx.beginPath();
        const coreR = (2.2 * DPR + (n.selected ? 1.6*DPR : 0)) * effectState.nodeScale;
        mctx.fillStyle = n.locked ? redColor(1) : glowColor(1, true);
        mctx.arc(n.x, n.y, coreR, 0, Math.PI*2);
        mctx.fill();
        
        mctx.beginPath();
        mctx.lineWidth = 1 * DPR;
        mctx.strokeStyle = n.selected ? '#FFFFFF' : (n.locked ? redColor(0.92) : glowColor(0.92, true));
        mctx.arc(n.x, n.y, coreR + 1.2*DPR, 0, Math.PI*2);
        mctx.stroke();
      }
      
      mctx.font = `${10 * DPR}px monospace`;
      mctx.fillStyle = glowColor(0.95, true);
      mctx.textAlign = 'right';
      mctx.fillText('BIOCODE', w - 8*DPR, 12*DPR);
    }

    function draw() {
      mctx.save();
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.globalAlpha = 1;
      mctx.globalCompositeOperation = 'source-over';
      mctx.clearRect(0, 0, w, h);
      mctx.restore();
      
      updateAutonomousMovement();
      tick++;
      
      if (systemDegradation < 80) {
        drawCleanGrid();
      } else {
        drawDegradedGrid(systemDegradation);
      }
    }

    window.addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame(function loop(){
      tick++;
      draw();
      raf = requestAnimationFrame(loop);
    });

    console.log(`[DEBUG] netGrid_v3-FINAL loaded. Canvas: ${w}x${h}, DPR: ${DPR}, Nodes: ${NODE_COUNT}, Grid: ${CELL_COUNT}x${CELL_COUNT}`);

  } catch (err) {
    console.error('[DEBUG] CRITICAL ERROR:', err);
  }
})();
