// netGrid_v3.js — VIGIL NET GRID v3 (BEAUTIFUL WORKING VERSION)
(() => {
  try {
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const SIZE_CSS = 200;
    const COLOR = { r: 6, g: 160, b: 118 };
    const MAP_Z = 40;
    const STATUS_Z = 45;

    // ---- create map canvas ----
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
      backgroundColor: 'rgba(0,10,6,0.28)'
    });
    document.body.appendChild(mapCanvas);
    const mctx = mapCanvas.getContext('2d');

    // ---- status element ----
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

    const bgCanvas = document.createElement('canvas');
    let w = 0, h = 0;
    let nodePositions = [];
    let connections = [];
    const NODE_COUNT = 26;

    function resize() {
      const cssW = SIZE_CSS, cssH = SIZE_CSS;
      mapCanvas.style.width = cssW + 'px';
      mapCanvas.style.height = cssH + 'px';
      w = mapCanvas.width = Math.max(100, Math.floor(cssW * DPR));
      h = mapCanvas.height = Math.max(100, Math.floor(cssH * DPR));
      buildOffscreen();
    }

    function buildOffscreen() {
      bgCanvas.width = w;
      bgCanvas.height = h;
      const bgctx = bgCanvas.getContext('2d');
      bgctx.clearRect(0, 0, w, h);

      // Фон с закругленными углами (простая версия)
      bgctx.fillStyle = 'rgba(2,18,12,0.66)';
      bgctx.fillRect(0, 0, w, h);

      // Виньетка
      const vig = bgctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.06, w/2, h/2, Math.max(w,h)*0.9);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.14)');
      bgctx.fillStyle = vig;
      bgctx.fillRect(0, 0, w, h);

      // Генерация узлов
      nodePositions = [];
      const margin = 12 * DPR;
      for (let i = 0; i < NODE_COUNT; i++) {
        nodePositions.push({
          x: margin + Math.random() * (w - margin * 2),
          y: margin + Math.random() * (h - margin * 2),
          baseR: (2 + Math.random() * 3) * DPR,
          phase: Math.random() * Math.PI * 2,
          speed: 0.008 + Math.random() * 0.02,
          intensity: 0
        });
      }

      // Соединения
      connections = [];
      for (let i = 0; i < nodePositions.length; i++) {
        for (let j = i + 1; j < nodePositions.length; j++) {
          const a = nodePositions[i], b = nodePositions[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < (w * 0.34)) connections.push({ a:i, b:j, d:dist });
        }
      }

      // Сетка
      bgctx.strokeStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.10)`;
      bgctx.lineWidth = 1 * DPR;
      bgctx.beginPath();
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * w;
        bgctx.moveTo(x, 0);
        bgctx.lineTo(x, h);
      }
      for (let j = 0; j <= steps; j++) {
        const y = (j / steps) * h;
        bgctx.moveTo(0, y);
        bgctx.lineTo(w, y);
      }
      bgctx.stroke();
    }

    window.addEventListener('resize', resize);
    resize();

    let raf = null;
    let tick = 0;
    let networkPulse = { active:false, t:0, duration:0, max:1.0 };

    function glowColor(a=1){ return `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${a})`; }

    function render() {
      tick++;
      mctx.clearRect(0,0,w,h);
      mctx.drawImage(bgCanvas, 0, 0, w, h);

      // Обновление узлов
      for (const n of nodePositions) {
        n.phase += n.speed;
        n.jx = Math.sin(n.phase*1.2) * 0.7 * DPR;
        n.jy = Math.cos(n.phase*1.4) * 0.7 * DPR;
        n.intensity *= 0.92;
      }

      if (networkPulse.active) {
        networkPulse.t++;
        if (networkPulse.t > networkPulse.duration) { 
          networkPulse.active = false; 
          networkPulse.t = 0; 
        }
      }

      // Соединения с градиентами
      mctx.save();
      mctx.lineCap = 'round';
      for (const c of connections) {
        const A = nodePositions[c.a], B = nodePositions[c.b];
        const baseAlpha = Math.max(0.04, 0.14 - (c.d / (w*0.9)) * 0.12);
        const boost = (A.intensity + B.intensity) * 0.35;
        const pulseFactor = networkPulse.active ? 1 + (1 - Math.abs(networkPulse.t - networkPulse.duration/2)/(networkPulse.duration/2)) * (networkPulse.max - 1) : 1;
        const alpha = Math.min(1, (baseAlpha + boost)) * pulseFactor;
        
        // Градиент для соединений
        const grad = mctx.createLinearGradient(A.x, A.y, B.x, B.y);
        grad.addColorStop(0, glowColor(alpha));
        grad.addColorStop(1, glowColor(alpha*0.45));
        mctx.strokeStyle = grad;
        mctx.lineWidth = 1.0 * DPR;
        mctx.beginPath();
        
        // Изогнутые линии
        const midx = (A.x + B.x)/2 + Math.sin(tick * 0.008 + c.a)*1.2*DPR;
        const midy = (A.y + B.y)/2 + Math.cos(tick * 0.01 + c.b)*1.0*DPR;
        mctx.moveTo(A.x + A.jx, A.y + A.jy);
        mctx.quadraticCurveTo(midx, midy, B.x + B.jx, B.y + B.jy);
        mctx.stroke();
      }
      mctx.restore();

      // Узлы с свечением
      for (const n of nodePositions) {
        const pulse = (Math.sin(n.phase*1.2) + 1) / 2;
        const base = 0.25 + pulse*0.5;
        const intensity = Math.min(1.8, base + n.intensity);
        const glowR = (n.baseR * 3.2 + pulse * 2.2 * DPR) * intensity;

        // Свечение
        const grd = mctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
        grd.addColorStop(0, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.34 * intensity})`);
        grd.addColorStop(0.6, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.12 * intensity})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grd;
        mctx.fillRect(n.x - glowR, n.y - glowR, glowR*2, glowR*2);

        // Ядро
        mctx.beginPath();
        const coreR = n.baseR * (1 + pulse*0.6);
        mctx.fillStyle = glowColor(1);
        mctx.arc(n.x + n.jx, n.y + n.jy, coreR, 0, Math.PI*2);
        mctx.fill();

        // Обводка
        mctx.beginPath();
        mctx.lineWidth = 1 * DPR;
        mctx.strokeStyle = glowColor(0.9 * Math.min(1.0, intensity));
        mctx.arc(n.x + n.jx, n.y + n.jy, coreR + 1.2*DPR, 0, Math.PI*2);
        mctx.stroke();
      }

      // Заголовок
      mctx.save();
      mctx.font = `${10 * DPR}px monospace`;
      mctx.fillStyle = glowColor(0.95);
      mctx.textAlign = 'right';
      mctx.fillText('VIGIL NET', w - 8*DPR, 12*DPR);
      mctx.restore();

      raf = requestAnimationFrame(render);
    }

    // ---- API ----
    window.netGrid = window.netGrid || {};
    window.netGrid.pulse = function() { 
      networkPulse.active = true; 
      networkPulse.duration = 240; 
      networkPulse.max = 1.35; 
    };

    // ---- status text ----
    const SESSION = '00:19:47';
    const USER = 'OPERATOR';
    function updateStatus() {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2,'0');
      const mm = String(now.getMonth()+1).padStart(2,'0');
      const yyyy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2,'0');
      const min = String(now.getMinutes()).padStart(2,'0');
      statusEl.textContent = `SESSION: ${SESSION}  |  USER: ${USER}  |  ${dd}.${mm}.${yyyy} | ${hh}:${min}`;
    }
    updateStatus();
    setInterval(updateStatus, 1000);

    // ---- Автопульс ----
    setInterval(()=> { 
      networkPulse.active = true; 
      networkPulse.duration = 320; 
      networkPulse.max = 1.12; 
    }, 15000);

    // ---- Запуск ----
    buildOffscreen();
    raf = requestAnimationFrame(render);

    console.info('netGrid_v3 loaded — BEAUTIFUL WORKING VERSION');
  } catch (err) {
    console.error('netGrid_v3 error', err);
  }
})();
