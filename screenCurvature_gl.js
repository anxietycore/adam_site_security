// screenCurvature_gl.js
// HARD FIX — Strong CSS hiding of originals, render everything into WebGL offscreen texture
// - hides all visual children inside terminal except real input
// - hides map and deg indicator original visuals (keeps them interactive)
// - overlay is fixed, pointer-events:none so scrolling and clicks pass through
// - tries to keep screenGlass (noise) above overlay so noise is visible
// - destroy() restores original styles where possible

(() => {
  const FPS = 18;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.30;
  const SMOOTH = true;

  // state to restore
  const STATE = { injectedStyle: null, hiddenEls: [], modified: [], outCanvas: null, destroyed: false };

  // remove any previous injector (clean start)
  const prev = document.getElementById('crt-overlay-inject');
  if (prev) prev.remove();

  // inject strict CSS that hides everything INSIDE terminal (except real inputs)
  const css = `
    /* strong rules to hide any visible DOM content inside #terminal or .terminal
       but keep input elements visible and interactive */
    #terminal *, .terminal * { visibility: hidden !important; color: transparent !important; background: transparent !important; }
    /* but keep actual inputs / textareas / contenteditables visible */
    #terminal input, #terminal textarea, #terminal [contenteditable="true"],
    .terminal input, .terminal textarea, .terminal [contenteditable="true"] {
      visibility: visible !important;
      color: inherit !important;
      background: inherit !important;
    }
    /* also keep caret in contenteditable visible */
    #terminal [contenteditable="true"], .terminal [contenteditable="true"] { outline: none !important; }
    /* class to hide originals (map, deg indicator) visually but keep pointer events */
    .crt-hide { visibility: hidden !important; pointer-events: auto !important; }
  `;
  const style = document.createElement('style');
  style.id = 'crt-overlay-inject';
  style.textContent = css;
  document.head.appendChild(style);
  STATE.injectedStyle = style;

  // find elements
  const terminal = document.getElementById('terminal') || document.querySelector('.terminal') || null;
  const mapCanvas = document.querySelector('canvas[style*="right:"]') || Array.from(document.querySelectorAll('canvas')).find(c=>c.clientWidth>30&&c.clientHeight>30) || null;

  // find deg indicator heuristically
  let degIndicator = null;
  Array.from(document.body.querySelectorAll('div,section,aside')).forEach(d=>{
    const text = (d.innerText||'').toUpperCase();
    if (!degIndicator && (text.includes('ДЕГРАДА') || text.includes('DEG') || text.includes('DEGRADE') || text.includes('DEGRAD'))) degIndicator = d;
  });
  if (!degIndicator) {
    degIndicator = Array.from(document.querySelectorAll('div')).find(d => getComputedStyle(d).position === 'fixed' && parseInt(getComputedStyle(d).zIndex||'0',10) > 500) || null;
  }

  // find screenGlass if exists
  const glassEl = document.querySelector('[id*="glass"], [class*="glass"], [class*="screen"], [id*="screen"]') || null;

  // create overlay canvas fixed (pointer-events none so scroll works)
  const outCanvas = document.createElement('canvas');
  outCanvas.id = 'curvatureOverlay';
  Object.assign(outCanvas.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    willChange: 'transform',
    zIndex: '9999'
  });
  document.body.appendChild(outCanvas);
  STATE.outCanvas = outCanvas;

  // put glass above overlay if found (so noise visible)
  if (glassEl) {
    try {
      STATE.modified.push({ el: glassEl, prop: 'zIndex', value: glassEl.style.zIndex || '' });
      glassEl.style.zIndex = String(parseInt(outCanvas.style.zIndex || '9999',10) + 1);
      glassEl.style.pointerEvents = 'none';
    } catch(e){}
  }

  // if body/html overflow hidden -> restore to auto (keep track)
  try {
    const bo = getComputedStyle(document.body).overflow;
    if (bo === 'hidden') {
      STATE.modified.push({ el: document.body, prop: 'overflow', value: document.body.style.overflow || '' });
      document.body.style.overflow = 'auto';
    }
    const hbo = getComputedStyle(document.documentElement).overflow;
    if (hbo === 'hidden') {
      STATE.modified.push({ el: document.documentElement, prop: 'overflow', value: document.documentElement.style.overflow || '' });
      document.documentElement.style.overflow = 'auto';
    }
  } catch(e){}

  // hide originals for map and degIndicator by adding class crt-hide (but keep them interactive)
  try {
    if (mapCanvas) { STATE.hiddenEls.push(mapCanvas); mapCanvas.classList.add('crt-hide'); }
    if (degIndicator) { STATE.hiddenEls.push(degIndicator); degIndicator.classList.add('crt-hide'); }
    // also add crt-hide to terminal container (we still keep real input visible because of CSS exceptions above)
    if (terminal) { STATE.hiddenEls.push(terminal); terminal.classList.add('crt-hide'); }
  } catch(e){}

  // create offscreen canvas
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: false });

  // init webgl
  const gl = outCanvas.getContext('webgl', { antialias:false, preserveDrawingBuffer:false });
  if (!gl) { console.error('WebGL unavailable'); return; }

  const vs = `
    attribute vec2 aPos; attribute vec2 aUV; varying vec2 vUV;
    void main(){ vUV = aUV; gl_Position = vec4(aPos,0.0,1.0); }
  `;
  const fs = `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uTex;
    uniform float uDist;
    void main(){
      vec2 uv = vUV * 2.0 - 1.0;
      float r = length(uv);
      vec2 d = mix(uv, uv * r, uDist);
      vec2 f = (d + 1.0) * 0.5;
      f.y = 1.0 - f.y;
      gl_FragColor = texture2D(uTex, clamp(f, 0.0, 1.0));
    }
  `;
  function compile(src, type){ const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
  gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog); gl.useProgram(prog);

  const quad = new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1]);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos'); const aUV = gl.getAttribLocation(prog,'aUV');
  gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,16,0); gl.vertexAttribPointer(aUV,2,gl.FLOAT,false,16,8);

  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, SMOOTH?gl.LINEAR:gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, SMOOTH?gl.LINEAR:gl.NEAREST);
  const uDist = gl.getUniformLocation(prog,'uDist'); gl.uniform1f(uDist, DISTORTION);

  // resize
  function resize(){
    const vw = Math.max(1, Math.floor(window.innerWidth));
    const vh = Math.max(1, Math.floor(window.innerHeight));
    outCanvas.width = Math.floor(vw * DPR); outCanvas.height = Math.floor(vh * DPR);
    outCanvas.style.width = vw + 'px'; outCanvas.style.height = vh + 'px';
    off.width = outCanvas.width; off.height = outCanvas.height;
    gl.viewport(0,0,outCanvas.width,outCanvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // safe get color
  function safeColor(el){ try{return getComputedStyle(el).color||'#00ff41'}catch(e){return '#00ff41'} }

  // Render terminal: we will compose text from DOM (we hid originals so no duplicates)
  function renderTerminalInto(ctx, w, h, scale){
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h);
    if(!terminal) return;
    // We'll look for elements that are likely to contain visible lines: .output, .command, .note, .line, etc.
    const sel = ['.output','.command','.note','.line','.terminal-line','.cmd','.prompt'];
    const collected = [];
    sel.forEach(s=> {
      terminal.querySelectorAll(s).forEach(el=>{
        const t = (el.textContent||'').replace(/\s+/g,' ').trim();
        if(t) collected.push({text:t, color:safeColor(el)});
      });
    });
    // Fallback: if nothing collected, use textContent of terminal excluding large children (rare)
    if(collected.length===0){
      const txt = (terminal.textContent||'').replace(/\s+/g,' ').trim();
      if(txt) collected.push({text:txt, color:'#00ff41'});
    }
    // draw lines
    const fontBase = Math.max(12, Math.floor(14 * scale));
    ctx.font = `${fontBase}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top';
    let y = 8 * scale;
    const lh = Math.floor(fontBase * 1.25);
    collected.forEach(item=>{
      ctx.fillStyle = item.color || '#00ff41';
      ctx.fillText(item.text, 8*scale, y);
      y += lh;
      if(y > h - lh) return;
    });

    // combine prompt + input into one line
    const promptEl = terminal.querySelector('.prompt');
    const inputEl = terminal.querySelector('.input-line, input, textarea, [contenteditable="true"]');
    let promptText = promptEl ? (promptEl.textContent||'').trim() : '';
    let inputText = '';
    if(inputEl){
      if(inputEl.tagName === 'INPUT' || inputEl.tagName === 'TEXTAREA') inputText = inputEl.value || '';
      else inputText = inputEl.textContent || '';
    }
    const combined = (promptText + (promptText && inputText ? ' ' : '') + inputText).trim();
    if(combined){
      ctx.fillStyle = safeColor(promptEl || inputEl || terminal) || '#00ff41';
      ctx.fillText(combined, 8*scale, y);
    }
  }

  // render indicator box
  function renderIndicator(ctx){
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = vw - 280, y = 20;
    if(degIndicator){
      try{
        const r = degIndicator.getBoundingClientRect();
        if(r.width>8 && r.height>8){ x = Math.round(r.left); y = Math.round(r.top); }
      }catch(e){}
    }
    const sx = Math.round(x * DPR), sy = Math.round(y * DPR);
    const w = Math.round(260 * DPR), h = Math.round(60 * DPR);
    let perc = 34;
    try{
      const m = (degIndicator && degIndicator.innerText) ? degIndicator.innerText.match(/(\d{1,3})\s*%/) : null;
      if(m) perc = Math.max(0, Math.min(100, parseInt(m[1],10)));
      else perc = parseInt(localStorage.getItem('adam_degradation')) || 34;
    }catch(e){}
    ctx.strokeStyle = '#00FF41'; ctx.lineWidth = Math.max(1,2*DPR); ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(sx, sy, w, h); ctx.strokeRect(sx, sy, w, h);
    ctx.fillStyle = '#00FF41';
    const inner = Math.round((w - 12*DPR) * (perc/100));
    ctx.fillRect(sx + 6*DPR, sy + 12*DPR, inner, 12*DPR);
    ctx.font = `${12*DPR}px "Press Start 2P", monospace`;
    ctx.fillText(`${perc}%`, sx + 6*DPR, sy + 30*DPR);
  }

  // main loop
  let last = 0; const frameTime = 1000 / FPS;
  function frame(ts){
    if(!last) last = ts;
    if(ts - last >= frameTime){
      last = ts;
      const w = off.width, h = off.height;
      offCtx.clearRect(0,0,w,h);
      renderTerminalInto(offCtx, w, h, DPR);

      // draw mapCanvas at viewport coords (if exists)
      if(mapCanvas){
        try{
          const r = mapCanvas.getBoundingClientRect();
          offCtx.drawImage(mapCanvas, Math.round(r.left*DPR), Math.round(r.top*DPR), Math.round(r.width*DPR), Math.round(r.height*DPR));
        }catch(e){}
      }

      // draw indicator
      renderIndicator(offCtx);

      // upload to GL
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      try {
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,off);
      } catch(err){
        const id = offCtx.getImageData(0,0,off.width,off.height);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA, off.width, off.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, id.data);
      }
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // overlay follows scroll via transform (fixed pos so viewport coords are consistent)
  function onScroll(){ outCanvas.style.transform = `translate(${window.scrollX}px, ${window.scrollY}px)`; }
  window.addEventListener('scroll', onScroll);

  // resize handler
  function onResize(){
    const vw = Math.max(1, Math.floor(window.innerWidth));
    const vh = Math.max(1, Math.floor(window.innerHeight));
    outCanvas.width = Math.floor(vw * DPR); outCanvas.height = Math.floor(vh * DPR);
    outCanvas.style.width = vw + 'px'; outCanvas.style.height = vh + 'px';
    off.width = outCanvas.width; off.height = outCanvas.height;
    gl.viewport(0,0,outCanvas.width,outCanvas.height);
  }
  window.addEventListener('resize', onResize);
  onResize();

  // expose destroy to revert changes
  window.__CRTOverlay = {
    setDistortion(v){ gl.uniform1f(uDist, v); },
    destroy(){
      if(STATE.destroyed) return; STATE.destroyed = true;
      try {
        // remove hide class from hiddenEls
        STATE.hiddenEls.forEach(el=>el && el.classList && el.classList.remove('crt-hide'));
        // remove injected style
        if(style) style.remove();
        // remove overlay
        if(outCanvas) outCanvas.remove();
        // restore modified props
        STATE.modified && STATE.modified.forEach(m=>{
          try{ if(m.el && m.prop) m.el.style[m.prop] = m.value; }catch(e){}
        });
      }catch(e){ console.warn('CRTOverlay.destroy error', e); }
    }
  };

})();
