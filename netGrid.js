// netGrid_v3.js — VIGIL NET GRID (fixed & visible)
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const SIZE = 220; // pixels
  const COLOR = { r: 6, g: 179, b: 118 }; // deep green
  const MAP_Z = 12;
  const STATUS_Z = 13;

  // ===== КАРТА =====
  const mapCanvas = document.createElement('canvas');
  Object.assign(mapCanvas.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    width: `${SIZE}px`,
    height: `${SIZE}px`,
    pointerEvents: 'none',
    zIndex: MAP_Z,
    borderRadius: '8px',
    boxShadow: '0 0 40px rgba(0,0,0,0.9)',
    backgroundColor: 'rgba(0,12,6,0.28)',
  });
  document.body.appendChild(mapCanvas);
  const mctx = mapCanvas.getContext('2d');

  // ===== СТАТУС =====
  const statusEl = document.createElement('div');
  Object.assign(statusEl.style, {
    position: 'fixed',
    left: '20px',
    bottom: '16px',
    fontFamily: 'Courier, monospace',
    fontSize: '14px',
    color: `rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 1)`,
    textShadow: `0 0 10px rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 0.9)`,
    zIndex: STATUS_Z,
    pointerEvents: 'none',
    userSelect: 'none',
    letterSpacing: '0.6px',
    fontWeight: '600',
    opacity: '1',
  });
  document.body.appendChild(statusEl);

  let bgCanvas = document.createElement('canvas');
  let w = 0, h = 0;

  function resize() {
    const cssW = SIZE, cssH = SIZE;
    mapCanvas.style.width = cssW + 'px';
    mapCanvas.style.height = cssH + 'px';
    w = mapCanvas.width = Math.floor(cssW * DPR);
    h = mapCanvas.height = Math.floor(cssH * DPR);
    buildOffscreen();
  }
  window.addEventListener('resize', resize);
  resize();

  // ===== ОФФСКРИН =====
  let nodePositions = [];
  let connections = [];
  const NODE_COUNT = 28;

  function buildOffscreen() {
    bgCanvas.width = w;
    bgCanvas.height = h;
    const bgctx = bgCanvas.getContext('2d');

    // фон панели
    bgctx.clearRect(0, 0, w, h);
    bgctx.fillStyle = 'rgba(2,18,12,0.65)';
    roundRect(bgctx, 0, 0, w, h, 8 * DPR, true, false);

    const vig = bgctx.createRadialGradient(w/2, h/2, 10, w/2, h/2, Math.max(w,h)*0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.18)');
    bgctx.fillStyle = vig;
    bgctx.fillRect(0, 0, w, h);

    // узлы
    nodePositions = [];
    const margin = 14 * DPR;
    for (let i = 0; i < NODE_COUNT; i++) {
      nodePositions.push({
        x: margin + Math.random() * (w - margin * 2),
        y: margin + Math.random() * (h - margin * 2),
        baseR: (2 + Math.random() * 3) * DPR,
        phase: Math.random() * Math.PI * 2,
        speed: 0.009 + Math.random() * 0.02,
        active: false,
        intensity: 0
      });
    }

    // соединения
    connections = [];
    for (let i = 0; i < nodePositions.length; i++) {
      for (let j = i + 1; j < nodePositions.length; j++) {
        const a = nodePositions[i], b = nodePositions[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < w / 3.3) {
          connections.push({ a: i, b: j, d: dist });
        }
      }
    }

    // сетка
    bgctx.strokeStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.12)`;
    bgctx.lineWidth = 1 * DPR;
    bgctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * w;
      bgctx.moveTo(x, 0);
      bgctx.lineTo(x, h);
    }
    for (let j = 0; j <= 8; j++) {
      const y = (j / 8) * h;
      bgctx.moveTo(0, y);
      bgctx.lineTo(w, y);
    }
    bgctx.stroke();

    // шум
    const speckles = Math.floor(w * h * 0.0004);
    for (let i = 0; i < speckles; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      bgctx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.03 + Math.random() * 0.05})`;
      bgctx.fillRect(x, y, 1 * DPR, 1 * DPR);
    }
  }

  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof radius === 'number') {
      radius = { tl: radius, tr: radius, br: radius, bl: radius };
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // ===== АНИМАЦИЯ =====
  let tick = 0;
  let raf;
  const events = [];

  function glowColor(alpha = 1) {
    return `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${alpha})`;
  }

  function render() {
    tick++;
    mctx.clearRect(0, 0, w, h);
    mctx.drawImage(bgCanvas, 0, 0, w, h);

    for (const n of nodePositions) {
      n.phase += n.speed;
      n.jx = Math.sin(n.phase * 1.2) * 0.8 * DPR;
      n.jy = Math.cos(n.phase * 1.3) * 0.8 * DPR;
      n.intensity *= 0.94;
    }

    // линии
    mctx.save();
    mctx.lineCap = 'round';
    for (const c of connections) {
      const A = nodePositions[c.a], B = nodePositions[c.b];
      const midx = (A.x + B.x) / 2;
      const midy = (A.y + B.y) / 2;
      const grad = mctx.createLinearGradient(A.x, A.y, B.x, B.y);
      grad.addColorStop(0, glowColor(0.18));
      grad.addColorStop(1, glowColor(0.08));
      mctx.strokeStyle = grad;
      mctx.lineWidth = 1.1 * DPR;
      mctx.beginPath();
      mctx.moveTo(A.x + A.jx, A.y + A.jy);
      mctx.quadraticCurveTo(midx, midy, B.x + B.jx, B.y + B.jy);
      mctx.stroke();
    }
    mctx.restore();

    // узлы
    for (const n of nodePositions) {
      const pulse = (Math.sin(n.phase * 1.2) + 1) / 2;
      const base = 0.3 + pulse * 0.5;
      const intensity = Math.min(1.6, base + n.intensity);

      const glowR = (n.baseR * 3.2 + pulse * 2.2 * DPR) * intensity;
      const grd = mctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
      grd.addColorStop(0, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.3 * intensity})`);
      grd.addColorStop(0.6, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.1 * intensity})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = grd;
      mctx.fillRect(n.x - glowR, n.y - glowR, glowR * 2, glowR * 2);

      mctx.beginPath();
      const coreR = n.baseR * (1 + pulse * 0.6);
      mctx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},1)`;
      mctx.arc(n.x + n.jx, n.y + n.jy, coreR, 0, Math.PI * 2);
      mctx.fill();
    }

    raf = requestAnimationFrame(render);
  }

  // ===== API =====
  window.netGrid = window.netGrid || {};
  window.netGrid.trigger = function (name, payload) {
    events.push({ name, payload });
  };

  // ===== СТАТУС =====
  const SESSION = '00:19:47';
  const USER = 'OPERATOR';
  function updateStatus() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    statusEl.textContent = `SESSION: ${SESSION}  |  USER: ${USER}  |  ${dd}.${mm}.${yyyy} | ${hh}:${min}`;
  }
  updateStatus();
  setInterval(updateStatus, 1000);

  buildOffscreen();
  raf = requestAnimationFrame(render);
})();
