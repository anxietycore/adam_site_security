// netGrid_v3.js — VIGIL NET GRID v3 (WORKING FIXED VERSION)
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

      bgctx.fillStyle = 'rgba(2,18,12,0.66)';
      bgctx.fillRect(0, 0, w, h);

      const vig = bgctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.06, w/2, h/2, Math.max(w,h)*0.9);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.14)');
      bgctx.fillStyle = vig;
      bgctx.fillRect(0, 0, w, h);

      // generate nodes
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

      // compute connections
      connections = [];
      for (let i = 0; i < nodePositions.length; i++) {
        for (let j = i + 1; j < nodePositions.length; j++) {
          const a = nodePositions[i], b = nodePositions[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < (w * 0.34)) connections.push({ a:i, b:j, d:dist });
        }
      }

      // grid lines
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
    const events = [];
    let networkPulse = { active:false, t:0, duration:0, max:1.0 };

    function glowColor(a=1){ return `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${a})`; }

    function render() {
      tick++;
      mctx.clearRect(0,0,w,h);
      mctx.drawImage(bgCanvas, 0, 0, w, h);

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

      // draw connections
      mctx.save();
      mctx.lineCap = 'round';
      for (const c of connections) {
        const A = nodePositions[c.a], B = nodePositions[c.b];
        const baseAlpha = Math.max(0.04, 0.14 - (c.d / (w*0.9)) * 0.12);
        const boost = (A.intensity + B.intensity) * 0.35;
        const pulseFactor = networkPulse.active ? 1 + (1 - Math.abs(networkPulse.t - networkPulse.duration/2)/(networkPulse.duration/2)) * (networkPulse.max - 1) : 1;
        const alpha = Math.min(1, (baseAlpha + boost)) * pulseFactor;
        
        mctx.strokeStyle = glowColor(alpha);
        mctx.lineWidth = 1.0 * DPR;
        mctx.beginPath();
        mctx.moveTo(A.x + A.jx, A.y + A.jy);
        mctx.lineTo(B.x + B.jx, B.y + B.jy);
        mctx.stroke();
      }
      mctx.restore();

      // draw nodes
      for (const n of nodePositions) {
        const pulse = (Math.sin(n.phase*1.2) + 1) / 2;
        const intensity = Math.min(1.8, 0.25 + pulse*0.5 + n.intensity);
        
        mctx.beginPath();
        const coreR = n.baseR * (1 + pulse*0.6);
        mctx.fillStyle = glowColor(1);
        mctx.arc(n.x + n.jx, n.y + n.jy, coreR, 0, Math.PI*2);
        mctx.fill();
      }

      raf = requestAnimationFrame(render);
    }

    // ---- start ----
    buildOffscreen();
    raf = requestAnimationFrame(render);

    console.info('netGrid_v3 loaded — MINIMAL WORKING VERSION');
  } catch (err) {
    console.error('netGrid_v3 error', err);
  }
})();
