// screenGlass.js — оптимизированный "грязный аналоговый" экран
// Замена для существующего файла. Поддерживает: царапины, шум по краям,
// ламповый блик, мерцание ~10s, глитч-импульсы, тень/отражение.
// Вставить как отдельный файл и подключить после DOM (или в <head> с DOMContentLoaded).

(function(){
  // ---- конфиг ----
  const DYNAMIC_FPS = 12; // обновления динамики (шум/блик) — низкий FPS для экономии
  const BLINK_INTERVAL = 10000; // мс — мерцание раз в 10 секунд
  const GLITCH_DURATION = 420; // мс — длина глитч-импульса
  const EDGE_NOISE_WIDTH = 140; // px — ширина зоны с пиксельным шумом по краям
  const SCRATCH_DENSITY = 0.9; // 0..2 — влияет на количество царапин
  const SCRATCH_ALPHA = 0.07; // прозрачность царапин
  const GLASS_TINT = 'rgba(0,0,0,0.16)'; // основной тон стекла
  const LAMP_INTENSITY = 0.06; // базовая яркость лампы
  const SHADOW_CSS = '0 40px 60px rgba(0,0,0,0.85)'; // drop-shadow для canvas

  // ---- элементы ----
  const existing = document.getElementById('glassFX');
  if (existing) existing.remove();

  const canvas = document.createElement('canvas');
  canvas.id = 'glassFX';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = 5000;
  // тень и лёгкое отражение (css) — чтобы выглядело как объект над сценой
  canvas.style.filter = `drop-shadow(${SHADOW_CSS})`;
  canvas.style.mixBlendMode = 'screen';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });

  // offscreen buffers
  const staticBuf = document.createElement('canvas'); // базовый стекло + царапины (рисуем 1 раз)
  const staticCtx = staticBuf.getContext('2d', { alpha: true });

  const noiseBuf = document.createElement('canvas'); // шумовая текстура, циклична
  const noiseCtx = noiseBuf.getContext('2d', { alpha: true });

  let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  // state
  let lastDynamicTick = 0;
  let lastBlink = performance.now();
  let glitchUntil = 0;
  let animationRaf = null;
  let mouse = { x: 0, y: 0 };

  // -------- resize / setup --------
  function resizeAll(){
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.floor(window.innerWidth * dpr);
    H = Math.floor(window.innerHeight * dpr);

    canvas.width = W;
    canvas.height = H;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';

    staticBuf.width = W;
    staticBuf.height = H;

    noiseBuf.width = Math.max(512, Math.floor(W/2)); // уменьшенный для производительности
    noiseBuf.height = Math.max(256, Math.floor(H/2));

    buildStatic();
    buildNoiseBase();
  }

  window.addEventListener('resize', () => {
    // throttle resize minimally
    clearTimeout(window._screenGlassResizeTimer);
    window._screenGlassResizeTimer = setTimeout(resizeAll, 80);
  });

  window.addEventListener('mousemove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * dpr;
    mouse.y = (e.clientY - rect.top) * dpr;
  });

  // -------- static layer (draw once) --------
  function buildStatic(){
    // clears
    staticCtx.clearRect(0,0,W,H);

    // glass tint
    staticCtx.fillStyle = GLASS_TINT;
    staticCtx.fillRect(0,0,W,H);

    // slight vignette to darken corners
    const vig = staticCtx.createRadialGradient(W/2, H/2, Math.min(W,H)/6, W/2, H/2, Math.max(W,H)/1.1);
    vig.addColorStop(0, 'rgba(0,0,0,0.00)');
    vig.addColorStop(0.6, 'rgba(0,0,0,0.06)');
    vig.addColorStop(1, 'rgba(0,0,0,0.22)');
    staticCtx.fillStyle = vig;
    staticCtx.fillRect(0,0,W,H);

    // subtle bottom grime (horizontal)
    const grimeGrad = staticCtx.createLinearGradient(0, H*0.7, 0, H);
    grimeGrad.addColorStop(0, 'rgba(0,0,0,0.00)');
    grimeGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
    staticCtx.fillStyle = grimeGrad;
    staticCtx.fillRect(0, H*0.7, W, H*0.3);

    // scratches: procedural thin lines with varying length/angle
    const scratchCount = Math.floor((W+H) * SCRATCH_DENSITY * 0.03);
    staticCtx.lineCap = 'round';
    for (let i=0;i<scratchCount;i++){
      const x = Math.random() * W;
      const y = Math.random() * H;
      const len = (20 + Math.random()*220) * (0.5 + Math.random());
      const angle = (Math.random()-0.5) * Math.PI * 0.6;
      const x2 = x + Math.cos(angle) * len;
      const y2 = y + Math.sin(angle) * len;
      const a = SCRATCH_ALPHA * (0.3 + Math.random()*0.9);
      staticCtx.strokeStyle = `rgba(255,255,255,${a})`;
      staticCtx.lineWidth = 0.6 + Math.random()*1.6;
      staticCtx.beginPath();
      staticCtx.moveTo(x,y);
      staticCtx.lineTo(x2,y2);
      staticCtx.stroke();
    }

    // random small deep scratches (more opaque)
    for (let i=0;i<Math.floor(scratchCount*0.06); i++){
      const x = Math.random()*W;
      const y = Math.random()*H;
      staticCtx.strokeStyle = `rgba(255,255,255,${0.12 + Math.random()*0.16})`;
      staticCtx.lineWidth = 1.4 + Math.random()*3.6;
      staticCtx.beginPath();
      staticCtx.moveTo(x, y);
      staticCtx.lineTo(x + (Math.random()-0.5)*200, y + (Math.random()-0.5)*200);
      staticCtx.stroke();
    }

    // subtle chrome border reflection (top edge)
    const topGrad = staticCtx.createLinearGradient(0,0,0,H*0.35);
    topGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
    topGrad.addColorStop(0.5, 'rgba(255,255,255,0.00)');
    staticCtx.fillStyle = topGrad;
    staticCtx.fillRect(0, 0, W, Math.floor(H*0.35));

    // thin glass edge highlight (very subtle)
    staticCtx.strokeStyle = 'rgba(255,255,255,0.02)';
    staticCtx.lineWidth = Math.max(1, dpr*1.2);
    staticCtx.strokeRect(1,1, W-2, H-2);
  }

  // -------- noise base (precompute tiling noise) --------
  function buildNoiseBase(){
    noiseCtx.clearRect(0,0,noiseBuf.width, noiseBuf.height);
    const imgdata = noiseCtx.createImageData(noiseBuf.width, noiseBuf.height);
    const d = imgdata.data;
    for (let y=0;y<noiseBuf.height;y++){
      for (let x=0;x<noiseBuf.width;x++){
        const i = (y*noiseBuf.width + x)*4;
        // base grayscale noise with bias
        const v = Math.floor( (Math.random()*255) * (0.3 + Math.random()*0.7) );
        d[i] = v;
        d[i+1] = v;
        d[i+2] = v;
        // alpha small so we can blend
        d[i+3] = Math.floor(40 + Math.random()*80);
      }
    }
    noiseCtx.putImageData(imgdata, 0, 0);

    // add some horizontal scanline banding on the noise texture
    noiseCtx.globalCompositeOperation = 'overlay';
    noiseCtx.fillStyle = 'rgba(255,255,255,0.02)';
    for (let y=0;y<noiseBuf.height;y+=2){
      noiseCtx.fillRect(0, y, noiseBuf.width, 1);
    }
    noiseCtx.globalCompositeOperation = 'source-over';
  }

  // -------- helpers --------
  function drawLampReflection(ctxTarget, t){
    // radial gradient lamp slightly moving (simulate small lamp tremble)
    const x = W * 0.5 + Math.cos(t*0.0012)*W*0.02 + (mouse.x - W/2)*0.01;
    const y = H * 0.08 + Math.sin(t*0.0015)*H*0.01 + (mouse.y - H*0.1)*0.02;
    const r = Math.max(W,H) * 0.6;
    const g = ctxTarget.createRadialGradient(x,y, r*0.02, x,y,r);
    g.addColorStop(0, `rgba(255,255,255,${0.18 + LAMP_INTENSITY})`);
    g.addColorStop(0.12, 'rgba(255,255,255,0.06)');
    g.addColorStop(0.32, 'rgba(255,255,255,0.01)');
    g.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctxTarget.fillStyle = g;
    ctxTarget.fillRect(0,0,W,H);
  }

  function blendEdgeNoise(destCtx, noiseCanvas, intensity, seedOffset){
    // We draw the noise Canvas multiple times with offsets and mask it to edges
    destCtx.save();
    destCtx.globalCompositeOperation = 'screen';
    destCtx.globalAlpha = intensity;

    const sw = noiseCanvas.width, sh = noiseCanvas.height;
    // Move / scroll noise to create animation (use seedOffset)
    const ox = Math.floor((seedOffset * 0.3) % sw);
    const oy = Math.floor((seedOffset * 0.6) % sh);

    // draw tiled offsets to cover entire area (noise is smaller)
    for (let y=-sh; y < H + sh; y += sh){
      for (let x=-sw; x < W + sw; x += sw){
        destCtx.drawImage(noiseCanvas, x + ox, y + oy, sw, sh);
      }
    }

    // apply radial mask that fades toward center (so noise strongest on edges)
    const mask = destCtx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.28, W/2, H/2, Math.max(W,H)*0.65);
    mask.addColorStop(0, 'rgba(0,0,0,0)');
    mask.addColorStop(0.6, 'rgba(0,0,0,0.6)');
    mask.addColorStop(1, 'rgba(0,0,0,0.95)');
    // Multiply by mask via globalCompositeOperation trick
    destCtx.globalCompositeOperation = 'destination-in';
    destCtx.fillStyle = mask;
    destCtx.fillRect(0,0,W,H);

    destCtx.restore();
  }

  // glitch draw (short heavy effect, but very short)
  function drawGlitchLayer(ctxTarget, t, intensity){
    // quick RGB shift slices
    const slices = 6 + Math.floor(Math.random()*6);
    for (let i=0;i<slices;i++){
      const h = Math.max(3, Math.floor(Math.random()*(H*0.12)));
      const y = Math.floor(Math.random()*(H-h));
      const shift = (Math.random()*20 - 10) * (0.5 + intensity);
      // copy slice into temporary canvas and paint shifted RGB channels
      // to avoid heavy per-pixel ops we just use composite draws with globalAlpha
      ctxTarget.save();
      ctxTarget.globalCompositeOperation = 'lighter';
      ctxTarget.globalAlpha = 0.85 * intensity;
      ctxTarget.drawImage(canvas, 0, y, W, h, shift, y, W, h);
      ctxTarget.globalAlpha = 0.25 * intensity;
      ctxTarget.fillStyle = `rgba(${60+Math.floor(Math.random()*200)}, 0, ${Math.floor(80+Math.random()*120)}, 0.06)`;
      ctxTarget.fillRect(0, y, W, h);
      ctxTarget.restore();
    }
  }

  // -------- main render loop --------
  function render(now){
    if (!lastDynamicTick) lastDynamicTick = now;
    const delta = now - lastDynamicTick;
    const dynamicInterval = 1000 / DYNAMIC_FPS;

    // clear main canvas
    ctx.clearRect(0,0,W,H);

    // draw static layer (precomputed) — fast copy
    ctx.drawImage(staticBuf, 0, 0, W, H);

    // dynamic updates at low fps
    if (delta >= dynamicInterval){
      lastDynamicTick = now;

      // paint lamp reflection on a temp canvas then composite
      // (we do not alter staticBuf - just composite on main ctx)
      drawLampReflection(ctx, now);

      // edge noise intensity varies slowly — use sin for breathing
      const breath = 0.5 + 0.5 * Math.sin(now * 0.0012);
      const noiseIntensity = 0.06 * (0.6 + breath * 0.8); // base intensity
      blendEdgeNoise(ctx, noiseBuf, noiseIntensity, now * 0.02);

      // small scanline flicker overlay using repeating gradient
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.06 + 0.02*Math.sin(now*0.008);
      for (let y=0;y<H;y+=2*dpr){
        ctx.fillRect(0, y, W, 1*dpr);
      }
      ctx.restore();

      // occasional micro-glitches (subtle) — randomized low probability
      if (Math.random() < 0.08){
        // small horizontal smear
        const y = Math.floor(Math.random()*H);
        const h = Math.min(8*dpr + Math.random()*24*dpr, H);
        ctx.save();
        ctx.globalAlpha = 0.06 + Math.random()*0.12;
        ctx.drawImage(canvas, 0, y, W, h, (Math.random()-0.5)*6*dpr, y, W, h);
        ctx.restore();
      }
    }

    // blink (harder flicker every BLINK_INTERVAL)
    if (now - lastBlink > BLINK_INTERVAL){
      lastBlink = now;
      // quick blink animation via CSS-like fade: apply overlay
      const blinkT = Math.random()*0.25 + 0.15;
      // draw a quick bright flash and then a dark jitter
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255,255,255,${blinkT})`;
      ctx.fillRect(0,0,W,H);
      ctx.restore();
    }

    // glitch if triggered
    if (now < glitchUntil){
      const remaining = (glitchUntil - now) / GLITCH_DURATION;
      const intensity = Math.max(0.15, remaining);
      drawGlitchLayer(ctx, now, intensity);
    }

    // final grain overlay (very subtle full-screen)
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.02;
    ctx.drawImage(noiseBuf, 0, 0, W, H);
    ctx.restore();

    animationRaf = requestAnimationFrame(render);
  }

  // -------- public API: trigger glitch externally --------
  window.triggerGlassGlitch = function(durationMs){
    const now = performance.now();
    glitchUntil = now + (durationMs || GLITCH_DURATION);
    // also slightly rebuild the noise base to keep randomness
    if (Math.random() > 0.6) buildNoiseBase();
  };

  // initial boot
  resizeAll();
  // small stagger to avoid initial jank
  setTimeout(()=> {
    animationRaf = requestAnimationFrame(render);
  }, 60);

  // safety: stop when page hidden
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden){
      if (animationRaf) cancelAnimationFrame(animationRaf);
      animationRaf = null;
    } else {
      if (!animationRaf) animationRaf = requestAnimationFrame(render);
      lastDynamicTick = performance.now();
      lastBlink = performance.now();
    }
  });

  // quick console note for debug
  console.info('screenGlass.js initialized — analog, optimized. API: window.triggerGlassGlitch(ms)');

})();
