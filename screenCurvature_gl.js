// screenCurvature_gl.js
// Robust CRT overlay with MutationObserver + strong CSS hiding + full console logging.
// Replace your existing file with this one.

(() => {
  const NAME = 'CRTOverlay';
  const FPS = 18;
  const SNAP_FPS = 6;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DIST = 0.30;
  const SMOOTH = true;

  // ---------- logging helpers ----------
  let LOG = true;
  function lg(...a){ if(LOG) console.log('%cCRT›','background:#0f0;color:#002;font-weight:700;padding:2px 6px;border-radius:3px;',...a); }
  function lge(...a){ if(LOG) console.error('%cCRT ERR›','background:#f33;color:#fff;font-weight:700;padding:2px 6px;border-radius:3px;',...a); }
  function lgd(...a){ if(LOG) console.debug('%cCRT DBG›','background:#222;color:#9f9;padding:2px 6px;border-radius:3px;',...a); }

  lg(`${NAME} init — DPR=${DPR} FPS=${FPS}`);

  // ---------- find page elements ----------
  const terminal = document.querySelector('#terminal') || document.querySelector('.terminal');
  const glass = document.querySelector('#glassFX') || document.querySelector('[id*="glass"], [class*="glass"], [id*="screen"], [class*="screen"]');
  const mapCanvas = document.querySelector('canvas[style*="right:"]') || Array.from(document.querySelectorAll('canvas')).find(c=>c.id!=='glassFX' && c.clientWidth>30);

  if (!terminal) {
    lge('Terminal element not found. Aborting overlay.');
    return;
  }
  lg('Found elements',{terminal, glass, mapCanvas});

  // ---------- inject robust CSS that cannot be easily overridden ----------
  const STYLE_ID = 'crt-overlay-strong-style';
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  // We hide visual children of #terminal by default but keep inputs/contenteditable visible (class .crt-keep)
  style.textContent = `
    /* hide everything inside #terminal visually unless explicitly kept */
    #terminal *:not(.crt-keep) { 
      opacity: 0 !important;
      visibility: hidden !important;
      color: transparent !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    /* keep actual input elements visible and interactive */
    #terminal .crt-keep { 
      opacity: 1 !important; visibility: visible !important; color: inherit !important; 
      background: inherit !important; pointer-events: auto !important;
    }
    /* helper class to visually hide other originals while keeping them interactive */
    .crt-hide-visual { opacity: 0 !important; visibility: hidden !important; pointer-events: auto !important; }
  `;
  document.head.appendChild(style);
  lg('Injected strong CSS');

  // ---------- ensure the input (or contenteditable) remains interactive and visible ----------
  function markInputsKeep(){
    try{
      const inputs = terminal.querySelectorAll('input, textarea, [contenteditable="true"], .input-line');
      inputs.forEach(i => {
        i.classList.add('crt-keep');
      });
      // also add to potential caret elements
      const prompt = terminal.querySelector('.prompt');
      if (prompt) prompt.classList.add('crt-keep');
      lgd('Marked inputs with .crt-keep', inputs.length);
    }catch(e){ lge('markInputsKeep error', e); }
  }
  markInputsKeep();

  // ---------- create overlay canvas (fixed) ----------
  const out = document.createElement('canvas');
  out.id = 'curvatureOverlay';
  Object.assign(out.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none', // let events pass to invisible original
    zIndex: 9998,
    willChange: 'transform',
    background: 'transparent'
  });
  document.body.appendChild(out);
  lg('Overlay canvas appended', out);

  // Lower glass opacity a bit so it's not blinding (we keep it above overlay by default)
  if (glass) {
    try {
      glass.style.zIndex = String(parseInt(out.style.zIndex,10) + 2);
      if (!glass.style.opacity) glass.style.opacity = '0.25';
      lg('Adjusted glass (noise) layering and opacity', {glassZ: glass.style.zIndex, opacity: glass.style.opacity});
    } catch(e){ lge('glass adjust error', e); }
  }

  // ---------- offscreen canvas (transparent) ----------
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: true });

  // ---------- webgl ----------
  const gl = out.getContext('webgl', { antialias:false, preserveDrawingBuffer:false });
  if (!gl) { lge('WebGL not available.'); return; }
  lg('WebGL context created');

  const VS = `attribute vec2 aPos; attribute vec2 aUV; varying vec2 vUV; void main(){ vUV = aUV; gl_Position = vec4(aPos,0.,1.); }`;
  const FS = `precision mediump float; varying vec2 vUV; uniform sampler2D uTex; uniform float uDist; void main(){ vec2 uv=vUV*2.0-1.0; float r=length(uv); vec2 d=mix(uv,uv*r,uDist); vec2 f=(d+1.0)*0.5; f.y=1.0-f.y; gl_FragColor = texture2D(uTex, clamp(f,0.,1.)); }`;
  function compile(src,type){ const s = gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) lge('Shader compile error', gl.getShaderInfoLog(s)); return s; }
  const prog = gl.createProgram(); gl.attachShader(prog, compile(VS, gl.VERTEX_SHADER)); gl.attachShader(prog, compile(FS, gl.FRAGMENT_SHADER)); gl.linkProgram(prog); gl.useProgram(prog);
  lg('Shaders compiled & program linked');

  const quad = new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1]);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos'); const aUV = gl.getAttribLocation(prog, 'aUV');
  gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aUV); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0); gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, SMOOTH ? gl.LINEAR : gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, SMOOTH ? gl.LINEAR : gl.NEAREST);
  const uDist = gl.getUniformLocation(prog, 'uDist'); gl.uniform1f(uDist, DIST);

  // ---------- resize ----------
  function resizeAll(){
    const w = Math.max(1, Math.floor(window.innerWidth * DPR));
    const h = Math.max(1, Math.floor(window.innerHeight * DPR));
    out.width = w; out.height = h; out.style.width = `${window.innerWidth}px`; out.style.height = `${window.innerHeight}px`;
    off.width = w; off.height = h;
    gl.viewport(0,0,w,h);
    lgd('resize applied', {w,h});
  }
  window.addEventListener('resize', resizeAll);
  resizeAll();

  // ---------- ensure terminal visuals stay hidden (robust) ----------
  function enforceHideOnce(){
    try{
      // apply class to terminal children (so our CSS rules apply stably)
      Array.from(terminal.children).forEach(ch => {
        if (!ch.classList.contains('crt-keep')) ch.classList.add('crt-hide-visual');
      });
      // re-mark inputs
      markInputsKeep();
      lgd('enforceHideOnce applied');
    }catch(e){ lge('enforceHideOnce failed', e); }
  }

  // call markInputsKeep again (in case dynamic creation)
  function markInputsKeep(){
    try{
      const inputs = terminal.querySelectorAll('input, textarea, [contenteditable="true"], .input-line');
      inputs.forEach(i => i.classList.add('crt-keep'));
      const prompt = terminal.querySelector('.prompt'); if (prompt) prompt.classList.add('crt-keep');
      lgd('markInputsKeep executed', inputs.length);
    }catch(e){ lge('markInputsKeep error', e); }
  }

  enforceHideOnce();

  // ---------- MutationObserver to watch for other scripts changing DOM/styles ----------
  const mo = new MutationObserver((mutations) => {
    let changed = false;
    for (const m of mutations) {
      // if someone touches terminal subtree, reapply hide/keep classes
      if (m.target && (m.target === terminal || terminal.contains(m.target))) {
        changed = true;
      }
      // if glass or body changed, log it
      if (m.target && (m.target === glass || (glass && glass.contains(m.target)))) {
        lgd('glass changed', m);
      }
    }
    if (changed) {
      lgd('MutationObserver: terminal subtree changed, reapplying hide/marks');
      try { enforceHideOnce(); } catch(e){ lge('MO enforce error', e); }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class','style'] });
  lg('MutationObserver attached to body');

  // ---------- helper render fallback (safe) ----------
  function safeColor(el){ try{ return getComputedStyle(el).color || '#00ff41'; } catch(e){ return '#00ff41'; } }
  function renderTerminalFallback(ctx){
    // clear transparent (do not fill black)
    ctx.clearRect(0,0,off.width, off.height);
    if (!terminal) return;
    const scale = DPR;
    ctx.font = `${14 * scale}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top';
    let y = 8 * scale;
    const selector = ['.output','.command','.note','.line','.cmd','.terminal-line'];
    let any = false;
    selector.forEach(s=>{
      terminal.querySelectorAll(s).forEach(el=>{
        const t = (el.textContent || '').replace(/\s+/g,' ').trim();
        if (!t) return;
        ctx.fillStyle = safeColor(el);
        ctx.fillText(t, 8*scale, y);
        y += Math.round(14 * scale * 1.25);
        any = true;
      });
    });
    // prompt + input combined (guaranteed visible)
    const prompt = terminal.querySelector('.prompt');
    const inp = terminal.querySelector('.input-line, input, textarea, [contenteditable="true"]');
    const p = prompt ? (prompt.textContent||'').trim() : '';
    let v = '';
    if (inp) v = inp.value || inp.textContent || '';
    const combined = (p + (p && v ? ' ' : '') + v).trim();
    if (combined) {
      ctx.fillStyle = '#00ff41';
      ctx.fillText(combined, 8 * scale, y);
      any = true;
    }
    return any;
  }

  // draw map & indicator
  function drawMapAndIndicator(ctx){
    // map
    if (mapCanvas) {
      try {
        const r = mapCanvas.getBoundingClientRect();
        ctx.drawImage(mapCanvas, Math.round(r.left * DPR), Math.round(r.top * DPR), Math.round(r.width * DPR), Math.round(r.height * DPR));
      } catch(e){ lgd('draw map error', e); }
    }
    // indicator
    const deg = Array.from(document.querySelectorAll('div')).find(d=>/(дегра|degra|degrad)/i.test(d.innerText||'')) || null;
    let perc = parseInt(localStorage.getItem('adam_degradation')) || 0;
    if (deg) {
      const m = (deg.innerText||'').match(/(\d{1,3})\s*%/);
      if (m) perc = parseInt(m[1],10);
    }
    // fallback position top-right
    let x = Math.max(8, window.innerWidth - 280), y = 20;
    if (deg) { try { const r = deg.getBoundingClientRect(); if (r.width>8) { x = r.left; y = r.top; } } catch(e){} }
    const sx = Math.round(x * DPR), sy = Math.round(y * DPR), w = Math.round(260 * DPR), h = Math.round(60 * DPR);
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(sx, sy, w, h);
    ctx.strokeStyle = '#00FF41'; ctx.lineWidth = Math.max(1, 2 * DPR); ctx.strokeRect(sx, sy, w, h);
    ctx.fillStyle = '#00FF41'; ctx.font = `${12 * DPR}px "Press Start 2P", monospace`;
    // place label with safe offsets so it doesn't overflow
    ctx.fillText('ДЕГРАДАЦИЯ СИСТЕМЫ', sx + 6 * DPR, sy + 6 * DPR);
    const inner = Math.round((w - 12 * DPR) * (Math.max(0, Math.min(100, perc)) / 100));
    ctx.fillRect(sx + 6 * DPR, sy + 28 * DPR, inner, 10 * DPR);
    ctx.fillText(`${perc}%`, sx + 6 * DPR, sy + 42 * DPR);
  }

  // ---------- core loop ----------
  let lastFrame = 0;
  const frameInterval = 1000 / FPS;
  function step(ts){
    requestAnimationFrame(step);
    if (ts - lastFrame < frameInterval) return;
    lastFrame = ts;

    // 1) clear transparent
    offCtx.clearRect(0,0,off.width,off.height);

    // 2) render terminal fallback (catch)
    const drew = renderTerminalFallback(offCtx);

    // 3) draw map + indicator (overlay copy)
    drawMapAndIndicator(offCtx);

    // 4) upload to GL texture
    try{
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }catch(e){
      lge('GL tex upload/draw error', e);
    }
  }
  requestAnimationFrame(step);

  // ---------- make sure overlay follows scroll (keeps alignment) ----------
  window.addEventListener('scroll', () => {
    out.style.transform = `translate(${window.scrollX}px, ${window.scrollY}px)`;
  });

  // ---------- watch degradation changes specifically (so we can log and react) ----------
  let lastDeg = parseInt(localStorage.getItem('adam_degradation')) || 0;
  const degWatch = setInterval(()=>{
    const cur = parseInt(localStorage.getItem('adam_degradation')) || 0;
    if (cur !== lastDeg) {
      lg(`degradation changed: ${lastDeg} → ${cur}`);
      lastDeg = cur;
      // if gltch threshold, re-enforce hiding (other scripts may toggle classes)
      if (cur >= 98) {
        lg('deg >=98: re-enforce hide class and dim glass');
        enforceHideOnce();
        if (glass) try { glass.style.opacity = '0.15'; } catch(e){}
      }
    }
  }, 400);

  // ---------- API & cleanup ----------
  window.__CRTOverlay = {
    setDistortion(v){ try{ gl.uniform1f(uDist, v); lg('distortion set', v);}catch(e){lge(e);} },
    setGlassOpacity(o){ if (glass) { glass.style.opacity = String(o); lg('glass opacity set', o); } },
    toggleLogs(v){ LOG = !!v; lg('logging', LOG); },
    destroy(){
      try{
        mo.disconnect();
        clearInterval(degWatch);
        style.remove();
        out.remove();
        off.remove();
        lg('CRTOverlay destroyed and cleaned.');
      }catch(e){ lge('destroy error', e); }
    },
    debugState(){ console.log({ terminal, glass, mapCanvas, out, off, DPR, DIST }); }
  };

  lg('CRTOverlay ready. Use __CRTOverlay.* API (setDistortion, setGlassOpacity, toggleLogs, destroy).');

})();
