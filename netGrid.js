// netGrid_v2.js — V I G I L  N E T  G R I D  v2.0
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const SIZE = 200; // px on CSS (will be scaled by DPR internally)
  const COLOR = { r: 6, g: 179, b: 118 }; // deep, non-acid green (#06b376-ish)
  const MAP_Z = 12;
  const STATUS_Z = 13;

  // -------- create canvas container (map) ----------
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
    boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
    backdropFilter: 'none',
  });
  document.body.appendChild(mapCanvas);
  const mctx = mapCanvas.getContext('2d');

  // -------- create status element (bottom-left) ----------
  const statusEl = document.createElement('div');
  Object.assign(statusEl.style, {
    position: 'fixed',
    left: '20px',
    bottom: '14px',
    fontFamily: 'Courier, monospace',
    fontSize: '13px',
    color: `rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 0.95)`,
    textShadow: `0 0 8px rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 0.25)`,
    zIndex: STATUS_Z,
    pointerEvents: 'none',
    userSelect: 'none',
    letterSpacing: '0.6px',
  });
  document.body.appendChild(statusEl);

  // -------- sizing ----------
  let w = 0, h = 0;
  function resize() {
    const cssW = SIZE, cssH = SIZE;
    mapCanvas.style.width = cssW + 'px';
    mapCanvas.style.height = cssH + 'px';
    w = mapCanvas.width = Math.floor(cssW * DPR);
    h = mapCanvas.height = Math.floor(cssH * DPR);
    // redraw static background if needed
    buildOffscreen();
  }
  window.addEventListener('resize', () => { resize(); });
  resize();

  // -------- offscreen bg to reduce per-frame cost ----------
  let bgCanvas = null;
  let nodePositions = [];
  let connections = [];
  const NODE_COUNT = 26;

  function buildOffscreen() {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = w; bgCanvas.height = h;
    const bgctx = bgCanvas.getContext('2d');

    // faint dark translucent rounded panel
    bgctx.clearRect(0,0,w,h);
    bgctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(bgctx, 0, 0, w, h, 8 * DPR, true, false);
    // inner subtle vignette
    const vig = bgctx.createRadialGradient(w/2,h/2, Math.min(w,h)*0.05, w/2,h/2, Math.max(w,h)*0.8);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.20)');
    bgctx.fillStyle = vig;
    bgctx.fillRect(0,0,w,h);

    // generate nodes positions (poisson-ish)
    nodePositions = [];
    const margin = 12 * DPR;
    for (let i=0;i<NODE_COUNT;i++){
      nodePositions.push({
        x: margin + Math.random() * (w - margin*2),
        y: margin + Math.random() * (h - margin*2),
        baseR: (1.6 + Math.random()*2.6) * DPR,
        phase: Math.random() * Math.PI * 2,
        speed: 0.008 + Math.random() * 0.02,
        active: false,
        intensity: 0
      });
    }

    // compute connections (connect near nodes)
    connections = [];
    for (let i=0;i<nodePositions.length;i++){
      for (let j=i+1;j<nodePositions.length;j++){
        const a = nodePositions[i], b = nodePositions[j];
        const dist = Math.hypot(a.x-b.x, a.y-b.y);
        if (dist < (w/3)) {
          connections.push({ a:i, b:j, d:dist });
        }
      }
    }

    // subtle grid overlay (pre-draw faint lines)
    bgctx.strokeStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.03)`;
    bgctx.lineWidth = 1 * DPR;
    bgctx.beginPath();
    for (let i=0;i<8;i++){
      const x = (i/7)*w;
      bgctx.moveTo(x, 0);
      bgctx.lineTo(x, h);
    }
    for (let j=0;j<8;j++){
      const y = (j/7)*h;
      bgctx.moveTo(0, y);
      bgctx.lineTo(w, y);
    }
    bgctx.stroke();

    // small noise speckle to pop foreground (cheap)
    const speckles = Math.floor(w*h*0.0003);
    for (let i=0;i<speckles;i++){
      const x = Math.random()*w, y = Math.random()*h;
      bgctx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.02+Math.random()*0.04})`;
      bgctx.fillRect(x, y, 1*DPR, 1*DPR);
    }
  }

  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof stroke === 'undefined') stroke = true;
    if (typeof radius === 'undefined') radius = 5;
    if (typeof radius === 'number') {
      radius = {tl: radius, tr: radius, br: radius, bl: radius};
    } else {
      var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
      for (var side in defaultRadius) radius[side] = radius[side] || defaultRadius[side];
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

  // -------- animation state ----------
  let raf = null;
  let tick = 0;
  // global pulse for periodic 'network pulse'
  let networkPulse = { t: 0, active: false, duration: 300, max: 1.6 }; // duration in frames-ish (we'll scale)
  // event queue
  const events = [];

  // ---- helper: color string ----
  function glowColor(alpha=1){ return `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${alpha})`; }

  // -------- render loop ----------
  function render() {
    tick++;
    mctx.clearRect(0,0,w,h);
    if (bgCanvas) mctx.drawImage(bgCanvas, 0, 0, w, h);

    // slightly animate nodes: small position jitter for life
    for (const n of nodePositions) {
      n.phase += n.speed;
      n.jx = Math.sin(n.phase*1.2) * 0.6 * DPR;
      n.jy = Math.cos(n.phase*1.4) * 0.6 * DPR;
      // passive intensity decay
      n.intensity *= 0.94;
    }

    // handle events
    if (events.length>0) {
      const ev = events.shift();
      handleEvent(ev);
    }

    // periodic network pulse (every ~15s) — trigger externally via setInterval below
    if (networkPulse.active) {
      networkPulse.t++;
      if (networkPulse.t > networkPulse.duration) {
        networkPulse.active = false;
        networkPulse.t = 0;
      }
    }

    // draw connections with glow based on proximity + pulse
    mctx.save();
    mctx.lineCap = 'round';
    for (const c of connections) {
      const A = nodePositions[c.a], B = nodePositions[c.b];
      const midx = (A.x+B.x)/2 + (Math.sin(tick*0.01 + c.a)*2) * DPR;
      const midy = (A.y+B.y)/2 + (Math.cos(tick*0.01 + c.b)*2) * DPR;
      // distance-based alpha
      const dist = c.d;
      let a = 0.08 - (dist / (w*0.9)) * 0.06;
      if (a < 0) a = 0;
      // boost with node intensity or network pulse
      const boost = (A.intensity + B.intensity) * 0.35;
      const pulseBoost = networkPulse.active ? (1 + (1 - Math.abs(networkPulse.t - networkPulse.duration/2) / (networkPulse.duration/2)) * (networkPulse.max-1)) : 1;
      const alpha = Math.min(0.95, Math.max(0.01, a + boost)) * pulseBoost;
      // gradient line
      const grad = mctx.createLinearGradient(A.x, A.y, B.x, B.y);
      grad.addColorStop(0, glowColor(alpha));
      grad.addColorStop(1, glowColor(alpha*0.4));
      mctx.strokeStyle = grad;
      mctx.lineWidth = 1.0 * DPR;
      mctx.beginPath();
      mctx.moveTo(A.x + A.jx, A.y + A.jy);
      // use quadratic curve to make lines organic
      mctx.quadraticCurveTo(midx, midy, B.x + B.jx, B.y + B.jy);
      mctx.stroke();
    }
    mctx.restore();

    // draw nodes with glow
    for (const n of nodePositions) {
      const pulse = (Math.sin(n.phase*1.2)+1)/2;
      // compute intensity combining base, active, networkPulse
      const base = 0.2 + pulse*0.4;
      const activeBoost = n.intensity || 0;
      const pulseBoost = networkPulse.active ? (1 + (1 - Math.abs(networkPulse.t - networkPulse.duration/2) / (networkPulse.duration/2)) * (networkPulse.max-1)) : 1;
      const intensity = Math.min(1.6, base + activeBoost) * pulseBoost;

      // outer glow
      mctx.beginPath();
      const glowR = (n.baseR*3.6 + pulse*2.2*DPR) * intensity;
      const grd = mctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
      grd.addColorStop(0, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.28*intensity})`);
      grd.addColorStop(0.5, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.12*intensity})`);
      grd.addColorStop(1, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0)`);
      mctx.fillStyle = grd;
      mctx.fillRect(n.x - glowR, n.y - glowR, glowR*2, glowR*2);

      // core
      mctx.beginPath();
      const coreR = n.baseR * (1 + pulse*0.6);
      mctx.fillStyle = `rgba(20,30,20,1)`; // dark core for contrast
      mctx.arc(n.x + n.jx, n.y + n.jy, coreR, 0, Math.PI*2);
      mctx.fill();

      // thin rim
      mctx.beginPath();
      mctx.lineWidth = 1 * DPR;
      mctx.strokeStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.9 * Math.min(1.0, intensity)})`;
      mctx.arc(n.x + n.jx, n.y + n.jy, coreR + 1.2*DPR, 0, Math.PI*2);
      mctx.stroke();
    }

    // accent top-right small label (mini title)
    mctx.save();
    mctx.font = `${10 * DPR}px monospace`;
    mctx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.9)`;
    mctx.textAlign = 'right';
    mctx.fillText('VIGIL NET', w - 8*DPR, 12*DPR);
    mctx.restore();

    raf = requestAnimationFrame(render);
  }

  // -------- event handlers (API reactions) ----------
  function handleEvent(ev) {
    const name = ev.name;
    const payload = ev.payload;
    switch(name) {
      case 'ping':
        // find nearest node to payload.x/y or random
        {
          const idx = (payload && payload.nodeIndex != null) ? payload.nodeIndex : Math.floor(Math.random()*nodePositions.length);
          pulseNode(idx, 0.9);
        }
        break;
      case 'connect':
        // flash path between two random nodes or provided
        {
          const a = (payload && payload.a != null) ? payload.a : Math.floor(Math.random()*nodePositions.length);
          const b = (payload && payload.b != null) ? payload.b : Math.floor(Math.random()*nodePositions.length);
          pathWave(a,b, 220);
        }
        break;
      case 'trace':
        traceScan(600);
        break;
      case 'alert':
        // strong red-ish flash across map
        networkPulse.active = true;
        networkPulse.duration = 120;
        networkPulse.max = 2.6;
        // temporary red overlay via quick canvas fill
        flashAlert();
        break;
      case 'reboot':
        // dim nodes then rebuild
        for (const n of nodePositions) n.intensity = 0;
        networkPulse.active = true;
        networkPulse.duration = 160;
        networkPulse.max = 0.6;
        setTimeout(()=> {
          // reshuffle nodes a bit
          for (const n of nodePositions) {
            n.x += (Math.random()-0.5) * 14 * DPR;
            n.y += (Math.random()-0.5) * 14 * DPR;
          }
        }, 800);
        break;
      case 'status':
        // show small digital labels for few seconds
        showLabels();
        break;
      default:
        break;
    }
  }

  // helper: pulse node
  function pulseNode(i, amount=1.0) {
    const n = nodePositions[i];
    if (!n) return;
    n.intensity = Math.max(n.intensity, amount);
  }

  // helper: wave along path a->b
  function pathWave(aIdx, bIdx, dur=300) {
    const visited = [];
    // naive path: BFS via nearest nodes (cheap)
    const start = nodePositions[aIdx];
    const target = nodePositions[bIdx];
    // create simple path by greedy nearest
    let currentIdx = aIdx;
    visited.push(currentIdx);
    for (let step=0; step<12; step++){
      // find connection neighbors
      let best = null;
      let bestD = Infinity;
      for (const c of connections) {
        let other = null;
        if (c.a === currentIdx) other = c.b;
        else if (c.b === currentIdx) other = c.a;
        if (other == null) continue;
        if (visited.includes(other)) continue;
        const dd = Math.hypot(nodePositions[other].x - target.x, nodePositions[other].y - target.y);
        if (dd < bestD) { bestD = dd; best = other; }
      }
      if (best == null) break;
      visited.push(best);
      currentIdx = best;
      if (best === bIdx) break;
    }
    // animate wave across visited
    let step = 0;
    const stepDur = Math.max(8, Math.floor(dur / (visited.length+1)));
    const waveInterval = setInterval(()=> {
      if (step >= visited.length) { clearInterval(waveInterval); return; }
      pulseNode(visited[step], 1.0);
      step++;
    }, stepDur);
  }

  // helper: trace scan (radial)
  function traceScan(durationFrames=600) {
    networkPulse.active = true;
    networkPulse.duration = durationFrames;
    networkPulse.max = 1.8;
    // also pulse some nodes randomly during trace
    const rr = setInterval(()=> {
      const idx = Math.floor(Math.random()*nodePositions.length);
      pulseNode(idx, 0.9);
    }, 120);
    setTimeout(()=> { clearInterval(rr); }, durationFrames* (1000/60));
  }

  // helper: temporary alert flash (red wash)
  function flashAlert() {
    const overlay = document.createElement('canvas');
    overlay.width = w; overlay.height = h;
    overlay.style.position = 'absolute';
    overlay.style.left = '0'; overlay.style.top = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = '0.0';
    overlay.style.zIndex = MAP_Z + 1;
    mapCanvas.parentNode.appendChild(overlay);
    const octx = overlay.getContext('2d');
    let step=0;
    const frames = 18;
    const anim = () => {
      step++;
      octx.clearRect(0,0,w,h);
      const a = Math.max(0, 0.8 * (1 - step/frames));
      octx.fillStyle = `rgba(255,40,40,${a})`;
      octx.fillRect(0,0,w,h);
      overlay.style.opacity = a;
      if (step < frames) requestAnimationFrame(anim);
      else { overlay.remove(); }
    };
    anim();
  }

  // helper: labels for nodes
  function showLabels() {
    // draw labels on main canvas for short time by pushing a small event
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = w; labelCanvas.height = h;
    const lctx = labelCanvas.getContext('2d');
    lctx.font = `${9*DPR}px monospace`;
    lctx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.95)`;
    for (let i=0;i<Math.min(6,nodePositions.length);i++){
      const n = nodePositions[Math.floor(Math.random()*nodePositions.length)];
      lctx.fillText('N'+Math.floor(Math.random()*999), n.x+6*DPR, n.y-6*DPR);
    }
    // render this canvas temporarily on top
    const overlay = document.createElement('canvas');
    overlay.width = w; overlay.height = h;
    overlay.style.position = 'absolute';
    overlay.style.left = '0'; overlay.style.top = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = MAP_Z + 1;
    mapCanvas.parentNode.appendChild(overlay);
    const octx = overlay.getContext('2d');
    octx.drawImage(labelCanvas,0,0);
    setTimeout(()=> overlay.remove(), 1200);
  }

  // -------- expose API ----------
  window.netGrid = window.netGrid || {};
  window.netGrid.trigger = function(name, payload) {
    events.push({ name, payload });
  };
  window.netGrid.pulse = function() {
    networkPulse.active = true;
    networkPulse.duration = 240;
    networkPulse.max = 1.4;
  };
  window.netGrid.destroy = function() {
    if (raf) cancelAnimationFrame(raf);
    try { mapCanvas.remove(); statusEl.remove(); } catch(e){}
  };

  // -------- status update (left-bottom) ----------
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

  // -------- small auto-pulse scheduler to keep it alive ----------
  setInterval(()=> {
    // trigger regular soft network pulse every ~15 seconds
    networkPulse.active = true;
    networkPulse.duration = 320;
    networkPulse.max = 1.2;
  }, 15000);

  // initial build + run
  buildOffscreen();
  raf = requestAnimationFrame(render);

  // expose some extra helpers for console tinkering
  window.netGrid._internal = {
    nodePositions,
    connections,
    triggerLocal: (n) => events.push({name:n})
  };

  // small helpful console note
  console.info('netGrid_v2 initialized — API: window.netGrid.trigger(name,payload) (ping,connect,trace,alert,reboot,status)');
})();
