// netGrid_v3.js — VIGIL NET GRID v3 (WORKING)
// Drop this file as netGrid_v3.js and refresh page (Ctrl+F5)

(() => {
  try {
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const SIZE_CSS = 200; // visible size in px
    const COLOR = { r: 6, g: 160, b: 118 }; // deep green, not sickly
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

    // ---- status element (bottom-left) ----
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

    // ---- offscreen bg canvas ----
    const bgCanvas = document.createElement('canvas');

    let w = 0, h = 0;
    function resize() {
      const cssW = SIZE_CSS, cssH = SIZE_CSS;
      mapCanvas.style.width = cssW + 'px';
      mapCanvas.style.height = cssH + 'px';
      w = mapCanvas.width = Math.max(100, Math.floor(cssW * DPR));
      h = mapCanvas.height = Math.max(100, Math.floor(cssH * DPR));
      buildOffscreen();
    }
    window.addEventListener('resize', resize);
    resize();

    // ---- nodes & connections ----
    let nodePositions = [];
    let connections = [];
    const NODE_COUNT = 26;

    function buildOffscreen() {
      bgCanvas.width = w;
      bgCanvas.height = h;
      const bgctx = bgCanvas.getContext('2d');
      bgctx.clearRect(0, 0, w, h);

      // panel background (stronger green tint)
      bgctx.fillStyle = 'rgba(2,18,12,0.66)';
      roundRect(bgctx, 0, 0, w, h, 10 * DPR, true, false);

      // soft inner vignette
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

      // compute connections (nearby)
      connections = [];
      for (let i = 0; i < nodePositions.length; i++) {
        for (let j = i + 1; j < nodePositions.length; j++) {
          const a = nodePositions[i], b = nodePositions[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < (w * 0.34)) connections.push({ a:i, b:j, d:dist });
        }
      }

      // faint grid lines (make slightly visible)
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

      // speckles
      const speckles = Math.floor(w*h*0.0005);
      for (let i=0;i<speckles;i++){
        const x = Math.random()*w, y = Math.random()*h;
        bgctx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.02 + Math.random()*0.05})`;
        bgctx.fillRect(x, y, 1*DPR, 1*DPR);
      }
    }

    function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
      if (typeof radius === 'number') radius = {tl: radius, tr: radius, br: radius, bl: radius};
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

    // ---- animation ----
    let raf = null;
    let tick = 0;
    const events = [];
    let networkPulse = { active:false, t:0, duration:0, max:1.0 };

    function glowColor(a=1){ return `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${a})`; }

    function render() {
      tick++;
      mctx.clearRect(0,0,w,h);
      // draw bg pre-render
      mctx.drawImage(bgCanvas, 0, 0, w, h);

      // update nodes
      for (const n of nodePositions) {
        n.phase += n.speed;
        n.jx = Math.sin(n.phase*1.2) * 0.7 * DPR;
        n.jy = Math.cos(n.phase*1.4) * 0.7 * DPR;
        n.intensity *= 0.92;
      }

      // process queued events (one per frame)
      if (events.length > 0) {
        const ev = events.shift();
        handleEvent(ev);
      }

      if (networkPulse.active) {
        networkPulse.t++;
        if (networkPulse.t > networkPulse.duration) { networkPulse.active = false; networkPulse.t = 0; }
      }

      // draw connections
      mctx.save();
      mctx.lineCap = 'round';
      for (const c of connections) {
        const A = nodePositions[c.a], B = nodePositions[c.b];
        // alpha by distance and node intensity
        const baseAlpha = Math.max(0.04, 0.14 - (c.d / (w*0.9)) * 0.12);
        const boost = (A.intensity + B.intensity) * 0.35;
        const pulseFactor = networkPulse.active ? 1 + (1 - Math.abs(networkPulse.t - networkPulse.duration/2)/(networkPulse.duration/2)) * (networkPulse.max - 1) : 1;
        const alpha = Math.min(1, (baseAlpha + boost)) * pulseFactor;
        const grad = mctx.createLinearGradient(A.x, A.y, B.x, B.y);
        grad.addColorStop(0, glowColor(alpha));
        grad.addColorStop(1, glowColor(alpha*0.45));
        mctx.strokeStyle = grad;
        mctx.lineWidth = 1.0 * DPR;
        mctx.beginPath();
        const midx = (A.x + B.x)/2 + Math.sin(tick * 0.008 + c.a)*1.2*DPR;
        const midy = (A.y + B.y)/2 + Math.cos(tick * 0.01 + c.b)*1.0*DPR;
        mctx.moveTo(A.x + A.jx, A.y + A.jy);
        mctx.quadraticCurveTo(midx, midy, B.x + B.jx, B.y + B.jy);
        mctx.stroke();
      }
      mctx.restore();

      // draw nodes
      for (const n of nodePositions) {
        const pulse = (Math.sin(n.phase*1.2) + 1) / 2;
        const base = 0.25 + pulse*0.5;
        const intensity = Math.min(1.8, base + n.intensity);
        const glowR = (n.baseR * 3.2 + pulse * 2.2 * DPR) * intensity;

        const grd = mctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
        grd.addColorStop(0, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.34 * intensity})`);
        grd.addColorStop(0.6, `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.12 * intensity})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grd;
        mctx.fillRect(n.x - glowR, n.y - glowR, glowR*2, glowR*2);

        // core
        mctx.beginPath();
        const coreR = n.baseR * (1 + pulse*0.6);
        mctx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},1)`;
        mctx.arc(n.x + n.jx, n.y + n.jy, coreR, 0, Math.PI*2);
        mctx.fill();

        // thin rim
        mctx.beginPath();
        mctx.lineWidth = 1 * DPR;
        mctx.strokeStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${0.9 * Math.min(1.0, intensity)})`;
        mctx.arc(n.x + n.jx, n.y + n.jy, coreR + 1.2*DPR, 0, Math.PI*2);
        mctx.stroke();
      }

      // small title
      mctx.save();
      mctx.font = `${10 * DPR}px monospace`;
      mctx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.95)`;
      mctx.textAlign = 'right';
      mctx.fillText('VIGIL NET', w - 8*DPR, 12*DPR);
      mctx.restore();

      raf = requestAnimationFrame(render);
    }

    // ---- API / events ----
    function handleEvent(ev) {
      if (!ev) return;
      const { name, payload } = ev;
      switch(name) {
        case 'ping': {
          const idx = (payload && Number.isFinite(payload.nodeIndex)) ? payload.nodeIndex % nodePositions.length : Math.floor(Math.random()*nodePositions.length);
          pulseNode(idx, 1.1);
          break;
        }
        case 'connect': {
          const a = (payload && payload.a!=null) ? payload.a % nodePositions.length : Math.floor(Math.random()*nodePositions.length);
          const b = (payload && payload.b!=null) ? payload.b % nodePositions.length : Math.floor(Math.random()*nodePositions.length);
          pathWave(a,b, 260);
          break;
        }
        case 'trace': {
          traceScan(520);
          break;
        }
        case 'alert': {
          networkPulse.active = true;
          networkPulse.duration = 90;
          networkPulse.max = 2.4;
          flashAlert();
          break;
        }
        case 'reboot': {
          for (const n of nodePositions) n.intensity = 0;
          networkPulse.active = true;
          networkPulse.duration = 150;
          networkPulse.max = 0.8;
          setTimeout(()=> {
            for (const n of nodePositions) {
              n.x += (Math.random()-0.5) * 12 * DPR;
              n.y += (Math.random()-0.5) * 12 * DPR;
            }
          }, 700);
          break;
        }
        case 'status': {
          showLabels();
          break;
        }
        default: break;
      }
    }

    function pulseNode(i, amount=1.0) {
      const n = nodePositions[i];
      if (!n) return;
      n.intensity = Math.max(n.intensity, amount);
    }

    function pathWave(aIdx, bIdx, dur=300) {
      const visited = [];
      visited.push(aIdx);
      // greedy path
      let current = aIdx;
      for (let step=0; step<15; step++) {
        let best=null, bestD=Infinity;
        for (const c of connections) {
          let other = null;
          if (c.a === current) other = c.b;
          else if (c.b === current) other = c.a;
          if (other==null || visited.includes(other)) continue;
          const dd = Math.hypot(nodePositions[other].x - nodePositions[bIdx].x, nodePositions[other].y - nodePositions[bIdx].y);
          if (dd < bestD) { bestD = dd; best = other; }
        }
        if (best==null) break;
        visited.push(best);
        current = best;
        if (best === bIdx) break;
      }
      let step = 0;
      const stepDur = Math.max(12, Math.floor(dur / Math.max(1, visited.length)));
      const iv = setInterval(()=> {
        if (step >= visited.length) { clearInterval(iv); return; }
        pulseNode(visited[step], 1.1);
        step++;
      }, stepDur);
    }

    function traceScan(durationFrames=600) {
      networkPulse.active = true;
      networkPulse.duration = durationFrames;
      networkPulse.max = 1.8;
      const rr = setInterval(()=> {
        const idx = Math.floor(Math.random()*nodePositions.length);
        pulseNode(idx, 0.9);
      }, 120);
      setTimeout(()=> clearInterval(rr), Math.floor(durationFrames * (1000/60)));
    }

    function flashAlert() {
      const overlay = document.createElement('canvas');
      overlay.width = w; overlay.height = h;
      Object.assign(overlay.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        pointerEvents: 'none',
        zIndex: MAP_Z + 2
      });
      mapCanvas.parentNode.appendChild(overlay);
      const octx = overlay.getContext('2d');
      let step = 0;
      const frames = 20;
      function anim() {
        step++;
        octx.clearRect(0,0,w,h);
        const a = Math.max(0, 0.85 * (1 - step/frames));
        octx.fillStyle = `rgba(255,40,40,${a})`;
        octx.fillRect(0,0,w,h);
        if (step < frames) requestAnimationFrame(anim);
        else overlay.remove();
      }
      anim();
    }

    function showLabels() {
      const overlay = document.createElement('canvas');
      overlay.width = w; overlay.height = h;
      Object.assign(overlay.style, { position:'absolute', left:'0', top:'0', pointerEvents:'none', zIndex:MAP_Z+2 });
      mapCanvas.parentNode.appendChild(overlay);
      const octx = overlay.getContext('2d');
      octx.font = `${9*DPR}px monospace`;
      octx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},0.95)`;
      for (let i=0;i<6;i++){
        const n = nodePositions[Math.floor(Math.random()*nodePositions.length)];
        octx.fillText('N'+Math.floor(Math.random()*999), n.x+6*DPR, n.y-6*DPR);
      }
      setTimeout(()=> overlay.remove(), 1200);
    }

    // ---- expose API ----
    window.netGrid = window.netGrid || {};
    window.netGrid.trigger = function(name, payload) { events.push({name, payload}); };
    window.netGrid.pulse = function() { networkPulse.active = true; networkPulse.duration = 240; networkPulse.max = 1.35; };
    window.netGrid.destroy = function() { if (raf) cancelAnimationFrame(raf); try { mapCanvas.remove(); statusEl.remove(); } catch(e){} };

    // ---- status text (session & time) ----
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

    // ---- keep alive soft pulse every ~15s ----
    setInterval(()=> { networkPulse.active = true; networkPulse.duration = 320; networkPulse.max = 1.12; }, 15000);

    // ---- start ----
    buildOffscreen();
    raf = requestAnimationFrame(render);

    console.info('netGrid_v3 loaded — API: window.netGrid.trigger(name,payload) (ping,connect,trace,alert,reboot,status)');
  } catch (err) {
    console.error('netGrid_v3 error', err);
  }
})();
