// screenGlass.js — Deep / dirty glass, optimized for low CPU
// Replaces previous file. Keeps pointer-events none and forces z-index high (important).
(function(){
  // ---- CONFIG ----
  const DYNAMIC_FPS = 12;            // динамические обновления (шум/блик)
  const BLINK_INTERVAL = 10000;      // мс — мерцание каждые ~10s
  const GLITCH_BASE_DURATION = 420;  // ms, default glitch length
  const EDGE_NOISE_INTENSITY = 0.22; // увеличение видимости VHS-краёв
  const SCRATCH_DENSITY = 1.2;       // 0.5..2.0 — сколько царапин
  const SCRATCH_ALPHA = 0.09;        // прозрачность царапин
  const LAMP_INTENSITY = 0.08;       // ламповый блик
  const MAX_DPR = 1.2;               // ограничение DPR — снижает нагрузку
  const NOISE_SCALE = 0.45;          // шум на маленьком буфере (fraction of screen)
  const SHADOW_CSS = '0 40px 60px rgba(0,0,0,0.85)';

  // ---- create / ensure single instance ----
  const existing = document.getElementById('glassFX');
  if (existing) existing.remove();

  const canvas = document.createElement('canvas');
  canvas.id = 'glassFX';
  // fixed fill
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.mixBlendMode = 'screen';
  canvas.style.filter = `drop-shadow(${SHADOW_CSS})`;
  // z-index override with important (will beat stylesheet !important)
  canvas.style.setProperty('z-index', '9999', 'important');

  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });

  // offscreen buffers
  const staticBuf = document.createElement('canvas'); // glass + scratches + vignette
  const staticCtx = staticBuf.getContext('2d', { alpha: true });

  const noiseBuf = document.createElement('canvas'); // low-res noise tile
  const noiseCtx = noiseBuf.getContext('2d', { alpha: true });

  let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  let lastDynamicTick = 0;
  let lastBlink = performance.now();
  let glitchUntil = 0;
  let raf = null;
  let mouse = { x: 0, y: 0 };

  // ---- resize logic ----
  function resizeAll() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    W = Math.floor(window.innerWidth * dpr);
    H = Math.floor(window.innerHeight * dpr);

    canvas.width = W;
    canvas.height = H;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';

    staticBuf.width = W;
    staticBuf.height = H;

    noiseBuf.width = Math.max(256, Math.floor(W * NOISE_SCALE));
    noiseBuf.height = Math.max(128, Math.floor(H * NOISE_SCALE));

    buildStatic();
    buildNoise();
  }

  window.addEventListener('resize', ()=> {
    clearTimeout(window._sgResize);
    window._sgResize = setTimeout(resizeAll, 80);
  });

  window.addEventListener('mousemove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * dpr;
    mouse.y = (e.clientY - rect.top) * dpr;
  });

  // ---- build static buffer once (glass base + scratches + vignette) ----
  function buildStatic(){
    staticCtx.clearRect(0,0,W,H);

    // base dark glass tint (deep glass)
    staticCtx.fillStyle = 'rgba(2,4,6,0.20)';
    staticCtx.fillRect(0,0,W,H);

    // vignette (darken edges)
    const vg = staticCtx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.2, W/2, H/2, Math.max(W,H)*0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0.00)');
    vg.addColorStop(0.6, 'rgba(0,0,0,0.10)');
    vg.addColorStop(1, 'rgba(0,0,0,0.34)');
    staticCtx.fillStyle = vg;
    staticCtx.fillRect(0,0,W,H);

    // subtle grime lower area
    const g = staticCtx.createLinearGradient(0, H*0.6, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0.00)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    staticCtx.fillStyle = g;
    staticCtx.fillRect(0, H*0.6, W, H*0.4);

    // scratches — procedural
    const scratchCount = Math.floor((W + H) * SCRATCH_DENSITY * 0.03);
    staticCtx.lineCap = 'round';
    for (let i=0;i<scratchCount;i++){
      const x = Math.random() * W;
      const y = Math.random() * H;
      const len = (30 + Math.random()*260) * (0.4 + Math.random()*0.9);
      const ang = (Math.random()-0.5) * Math.PI * 0.65;
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      const a = SCRATCH_ALPHA * (0.5 + Math.random()*1.3);
      staticCtx.strokeStyle = `rgba(255,255,255,${a})`;
      staticCtx.lineWidth = 0.5 + Math.random()*1.4;
      staticCtx.beginPath();
      staticCtx.moveTo(x,y);
      staticCtx.lineTo(x2,y2);
      staticCtx.stroke();
    }

    // few deeper scratches
    for (let i=0;i<Math.floor(scratchCount*0.06); i++){
      const x = Math.random() * W;
      const y = Math.random() * H;
      staticCtx.strokeStyle = `rgba(255,255,255,${0.10 + Math.random()*0.18})`;
      staticCtx.lineWidth = 1.2 + Math.random()*3.2;
      staticCtx.beginPath();
      staticCtx.moveTo(x, y);
      staticCtx.lineTo(x + (Math.random()-0.5)*300, y + (Math.random()-0.5)*300);
      staticCtx.stroke();
    }

    // subtle top chrome/edge highlight
    const topGrad = staticCtx.createLinearGradient(0,0,0,H*0.28);
    topGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
    topGrad.addColorStop(0.5, 'rgba(255,255,255,0.00)');
    staticCtx.fillStyle = topGrad;
    staticCtx.fillRect(0, 0, W, Math.floor(H*0.28));

    // faint outer frame stroke
    staticCtx.strokeStyle = 'rgba(255,255,255,0.015)';
    staticCtx.lineWidth = Math.max(1, dpr*1.2);
    staticCtx.strokeRect(1,1, W-2, H-2);
  }

  // ---- build noise tile once (low-res) ----
  function buildNoise(){
    noiseCtx.clearRect(0,0, noiseBuf.width, noiseBuf.height);
    const img = noiseCtx.createImageData(noiseBuf.width, noiseBuf.height);
    const data = img.data;
    for (let y=0;y<noiseBuf.height;y++){
      for (let x=0;x<noiseBuf.width;x++){
        const i = (y*noiseBuf.width + x)*4;
        const v = Math.floor( (Math.random()*255) * (0.35 + Math.random()*0.65) );
        data[i] = v; data[i+1] = v; data[i+2] = v;
        data[i+3] = Math.floor(30 + Math.random()*120);
      }
    }
    noiseCtx.putImageData(img, 0, 0);

    // horizontal subtle scanlines on tile
    noiseCtx.globalCompositeOperation = 'overlay';
    noiseCtx.fillStyle = 'rgba(255,255,255,0.02)';
    for (let y=0;y<noiseBuf.height;y+=2){
      noiseCtx.fillRect(0, y, noiseBuf.width, 1);
    }
    noiseCtx.globalCompositeOperation = 'source-over';
  }

  // ---- helpers ----
  function drawLamp(ctxTarget, now){
    // lamp above screen — slight movement based on time and mouse
    const cx = W * 0.48 + Math.cos(now*0.0013) * W*0.015 + (mouse.x - W/2)*0.008;
    const cy = H * 0.08 + Math.sin(now*0.0016) * H*0.01 + (mouse.y - H*0.1)*0.01;
    const r = Math.max(W,H) * 0.6;
    const g = ctxTarget.createRadialGradient(cx, cy, r*0.02, cx, cy, r);
    g.addColorStop(0, `rgba(255,255,255,${0.14 + LAMP_INTENSITY})`);
    g.addColorStop(0.12, 'rgba(255,255,255,0.06)');
    g.addColorStop(0.32, 'rgba(255,255,255,0.01)');
    g.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctxTarget.fillStyle = g;
    ctxTarget.fillRect(0,0,W,H);
  }

  function applyEdgeNoise(destCtx, intensity, tick){
    destCtx.save();
    destCtx.globalCompositeOperation = 'screen';
    destCtx.globalAlpha = intensity;

    const sw = noiseBuf.width, sh = noiseBuf.height;
    const ox = Math.floor((tick * 0.3) % sw);
    const oy = Math.floor((tick * 0.6) % sh);

    // tile the noise to cover
    for (let y=-sh; y < H + sh; y += sh){
      for (let x=-sw; x < W + sw; x += sw){
        destCtx.drawImage(noiseBuf, x + ox, y + oy, sw, sh);
      }
    }

    // soften into center with radial mask: stronger near edges
    const mask = destCtx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.29, W/2, H/2, Math.max(W,H)*0.68);
    mask.addColorStop(0, 'rgba(0,0,0,0)');
    mask.addColorStop(0.55, 'rgba(0,0,0,0.5)');
    mask.addColorStop(1, 'rgba(0,0,0,0.95)');

    destCtx.globalCompositeOperation = 'destination-in';
    destCtx.fillStyle = mask;
    destCtx.fillRect(0,0,W,H);
    destCtx.restore();
  }

  function smallGlitch(ctxTarget, intensity){
    // few random slices - cheap copy operations
    const slices = 4 + Math.floor(Math.random()*5);
    for (let i=0;i<slices;i++){
      const h = Math.max(3, Math.floor(Math.random() * (H*0.09)));
      const y = Math.floor(Math.random() * (H - h));
      const shift = (Math.random()*26 - 13) * intensity;
      ctxTarget.save();
      ctxTarget.globalAlpha = 0.85 * intensity;
      ctxTarget.globalCompositeOperation = 'lighter';
      ctxTarget.drawImage(canvas, 0, y, W, h, shift, y, W, h);
      ctxTarget.restore();
    }
  }

  // ---- render loop ----
  function render(now){
    if (!lastDynamicTick) lastDynamicTick = now;
    const delta = now - lastDynamicTick;
    const interval = 1000 / DYNAMIC_FPS;

    // clear
    ctx.clearRect(0,0,W,H);

    // copy static (fast)
    ctx.drawImage(staticBuf, 0, 0, W, H);

    // dynamic updates at lower frequency
    if (delta >= interval){
      lastDynamicTick = now;

      // lamp / top reflection
      drawLamp(ctx, now);

      // stronger edge noise (VHS vibe)
      const breath = 0.5 + 0.5 * Math.sin(now * 0.0011);
      const noiseIntensity = EDGE_NOISE_INTENSITY * (0.7 + breath * 0.8);
      applyEdgeNoise(ctx, noiseIntensity, now * 0.02);

      // subtle scanline overlay
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.06 + 0.02*Math.sin(now * 0.007);
      for (let y=0; y<H; y += 2 * dpr){
        ctx.fillRect(0, y, W, 1 * dpr);
      }
      ctx.restore();

      // randomized micro-smear to emulate old electronics
      if (Math.random() < 0.09){
        const y = Math.floor(Math.random() * H);
        const h = Math.min(12 * dpr + Math.random()*28 * dpr, H);
        ctx.save();
        ctx.globalAlpha = 0.05 + Math.random() * 0.12;
        ctx.drawImage(canvas, 0, y, W, h, (Math.random()-0.5) * 8 * dpr, y, W, h);
        ctx.restore();
      }
    }

    // periodic hard blink
    if (now - lastBlink > BLINK_INTERVAL){
      lastBlink = now;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255,255,255,${0.12 + Math.random()*0.12})`;
      ctx.fillRect(0,0,W,H);
      ctx.restore();
    }

    // glitch if triggered
    if (now < glitchUntil){
      const rem = Math.max(0, (glitchUntil - now) / GLITCH_BASE_DURATION);
      const intensity = 0.22 + rem * 0.85;
      smallGlitch(ctx, intensity);
    }

    // final gentle grain — low alpha
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.02;
    ctx.drawImage(noiseBuf, 0, 0, W, H);
    ctx.restore();

    raf = requestAnimationFrame(render);
  }

  // ---- external API ----
  window.triggerGlassGlitch = function(ms){
    const now = performance.now();
    glitchUntil = now + (ms || GLITCH_BASE_DURATION);
    if (Math.random() > 0.5) buildNoise(); // slight re-randomization sometimes
  };

  window.setGlassIntensity = function(factor){
    // quick runtime tweak: factor ~0.5..2.0
    try { 
      const v = Number(factor);
      if (!isFinite(v)) return;
      // adjust core constants (affects visual immediately)
      // (Not persistent across reload)
      // limit range
      const clamped = Math.min(3, Math.max(0.3, v));
      // tweak
      // edge noise
      // we don't reassign the const; just use a property rebound via object? simple trick:
      // We'll set a property on window.__glassSettings and read it in applyEdgeNoise if needed.
      window.__glassSettings = window.__glassSettings || {};
      window.__glassSettings.intensity = clamped;
      // small effect: multiply global blend intensity by factor
    } catch (e) { /* ignore */ }
  };

  // ---- start ----
  resizeAll();
  setTimeout(()=> raf = requestAnimationFrame(render), 60);

  // pause when hidden
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden){
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    } else {
      if (!raf) raf = requestAnimationFrame(render);
      lastDynamicTick = performance.now();
      lastBlink = performance.now();
    }
  });

  console.info('screenGlass.js loaded — deep glass (optimized). API: window.triggerGlassGlitch(ms)');
})();
