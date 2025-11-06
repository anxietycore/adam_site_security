// screenCurvature_gl.js
// Safe CRT overlay: cleans previous injected hacks, uses transparent offscreen canvas,
// draws only visible text (no black fill) so terminal never gets fully covered.

(() => {
  const FPS = 18;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.30;
  const SMOOTH = true;

  // ---------- cleanup any previous injected styles / classes left by older attempts ----------
  try {
    // remove known injected style elements
    ['crt-overlay-inject','crt-overlay-style','crt-overlay-styles','crt-overlay-styles-old','crt-overlay-inject-old'].forEach(id=>{
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    // remove any helper classes that older patches may have added
    document.querySelectorAll('.crt-hide, .crt-hidden-target, .crt-overlay-hide, .crt-hidden, .crt-hide-original').forEach(el=>{
      try { el.classList.remove('crt-hide','crt-hidden-target','crt-overlay-hide','crt-hidden','crt-hide-original'); } catch(e){}
      // also restore inline visibility if present
      try { el.style.visibility = ''; el.style.opacity = ''; el.style.pointerEvents = ''; } catch(e){}
    });
  } catch (e) {
    // ignore
  }

  // ensure scrolling is possible
  try {
    if (getComputedStyle(document.body).overflow === 'hidden') document.body.style.overflow = 'auto';
    if (getComputedStyle(document.documentElement).overflow === 'hidden') document.documentElement.style.overflow = 'auto';
  } catch(e) {}

  // find page elements
  const terminal = document.querySelector('#terminal') || document.querySelector('.terminal');
  const glass = document.querySelector('#glassFX') || document.querySelector('[id*="glass"], [class*="glass"], [id*="screen"], [class*="screen"]');
  const mapCanvas = document.querySelector('canvas[style*="right:"]') || Array.from(document.querySelectorAll('canvas')).find(c=>c.id !== 'glassFX' && c.clientWidth>30 && c.clientHeight>30);

  // create overlay canvas (fixed), but transparent where not drawing
  const out = document.createElement('canvas');
  out.id = 'curvatureOverlay';
  Object.assign(out.style, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '9998',
    willChange: 'transform',
    background: 'transparent'
  });
  document.body.appendChild(out);

  // nudge glass opacity down a bit to avoid over-brightness (you can change later via API)
  if (glass) {
    try {
      if (!glass.style.opacity) glass.style.opacity = '0.25';
      // keep glass above overlay so noise is visible
      glass.style.zIndex = String(Math.max(100, parseInt(out.style.zIndex||'9998',10) + 1));
    } catch(e){}
  }

  // offscreen canvas WITH alpha (so transparent areas remain see-through)
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: true });

  // WebGL setup
  const gl = out.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) {
    console.error('WebGL not available for curvature overlay.');
    return;
  }

  const vs = `
    attribute vec2 aPos;
    attribute vec2 aUV;
    varying vec2 vUV;
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
      vec2 distorted = mix(uv, uv * r, uDist);
      vec2 finalUV = (distorted + 1.0) * 0.5;
      finalUV.y = 1.0 - finalUV.y;
      gl_FragColor = texture2D(uTex, clamp(finalUV, 0.0, 1.0));
    }
  `;
  function compile(src, type){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
  gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const quad = new Float32Array([
    -1,-1, 0,0,
     1,-1, 1,0,
    -1, 1, 0,1,
     1, 1, 1,1
  ]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, 'aPos');
  const aUV  = gl.getAttribLocation(prog, 'aUV');
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(aUV,  2, gl.FLOAT, false, 16, 8);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, SMOOTH ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, SMOOTH ? gl.LINEAR : gl.NEAREST);

  const uDist = gl.getUniformLocation(prog, 'uDist');
  gl.uniform1f(uDist, DISTORTION);

  // resize handling
  function resizeAll(){
    const cssW = Math.max(1, Math.floor(window.innerWidth));
    const cssH = Math.max(1, Math.floor(window.innerHeight));
    out.width  = Math.floor(cssW * DPR);
    out.height = Math.floor(cssH * DPR);
    out.style.width  = cssW + 'px';
    out.style.height = cssH + 'px';
    off.width  = out.width;
    off.height = out.height;
    gl.viewport(0,0,out.width, out.height);
  }
  window.addEventListener('resize', resizeAll);
  resizeAll();

  // safe helpers
  function safeColor(el){ try { return getComputedStyle(el).color || '#00ff41'; } catch(e) { return '#00ff41'; } }

  // render terminal into offCtx WITHOUT filling black background (transparent by default)
  function renderTerminalInto(ctx){
    // clear pixel content but keep alpha transparent
    ctx.clearRect(0,0,off.width, off.height);
    if (!terminal) return;
    const scale = DPR;
    const lineSelectors = ['.output', '.command', '.note', '.line', '.terminal-line', '.cmd'];
    ctx.font = `${14 * scale}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top';
    let y = 8 * scale;
    const lh = Math.round(14 * scale * 1.2);
    // draw available lines (if any)
    let drawnAny = false;
    lineSelectors.forEach(sel => {
      terminal.querySelectorAll(sel).forEach(el => {
        const t = (el.textContent || '').replace(/\s+/g,' ').trim();
        if (!t) return;
        ctx.fillStyle = safeColor(el);
        ctx.fillText(t, 8 * scale, y);
        y += lh;
        drawnAny = true;
      });
    });

    // Always draw prompt + input on one line (so input always visible)
    const promptEl = terminal.querySelector('.prompt');
    const inputEl = terminal.querySelector('.input-line, input, textarea, [contenteditable="true"]');
    const promptText = promptEl ? (promptEl.textContent || '').trim() : '';
    let inputText = '';
    if (inputEl) {
      if (inputEl.tagName === 'INPUT' || inputEl.tagName === 'TEXTAREA') inputText = inputEl.value || '';
      else inputText = inputEl.textContent || '';
    }
    const combined = (promptText + (promptText && inputText ? ' ' : '') + inputText).trim();
    if (combined) {
      ctx.fillStyle = safeColor(promptEl || inputEl || terminal) || '#00ff41';
      ctx.fillText(combined, 8 * scale, y);
      drawnAny = true;
    }

    return drawnAny;
  }

  // draw map and deformation indicator into offCtx
  function drawMapAndIndicator(ctx){
    if (mapCanvas) {
      try {
        const r = mapCanvas.getBoundingClientRect();
        ctx.drawImage(mapCanvas, Math.round(r.left * DPR), Math.round(r.top * DPR), Math.round(r.width * DPR), Math.round(r.height * DPR));
      } catch (e) {}
    }
    // draw degr indicator
    const degElem = Array.from(document.querySelectorAll('div')).find(d => /(дегра|degra|degrad)/i.test(d.innerText || '')) || null;
    let perc = parseInt(localStorage.getItem('adam_degradation')) || 0;
    if (degElem) {
      const m = (degElem.innerText || '').match(/(\d{1,3})\s*%/);
      if (m) perc = parseInt(m[1], 10);
    }
    let x = Math.max(8, window.innerWidth - 280);
    let y = 20;
    if (degElem) {
      try {
        const r = degElem.getBoundingClientRect();
        if (r.width > 8 && r.height > 8) { x = r.left; y = r.top; }
      } catch(e){}
    }
    const sx = Math.round(x * DPR), sy = Math.round(y * DPR);
    const w = Math.round(260 * DPR), h = Math.round(60 * DPR);
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(sx, sy, w, h);
    ctx.strokeStyle = '#00FF41';
    ctx.lineWidth = Math.max(1, 2 * DPR);
    ctx.strokeRect(sx, sy, w, h);
    ctx.fillStyle = '#00FF41';
    ctx.font = `${12 * DPR}px "Press Start 2P", monospace`;
    ctx.fillText('ДЕГРАДАЦИЯ СИСТЕМЫ', sx + 6 * DPR, sy + 6 * DPR);
    const inner = Math.round((w - 12 * DPR) * (Math.max(0, Math.min(100, perc)) / 100));
    ctx.fillRect(sx + 6 * DPR, sy + 24 * DPR, inner, 10 * DPR);
    ctx.fillText(`${perc}%`, sx + 6 * DPR, sy + 38 * DPR);
  }

  // main loop: draw terminal (transparent background) and other elements,
  // only if there's something to draw; otherwise leave texture transparent.
  let lastTick = 0;
  const frameTime = 1000 / FPS;

  function step(ts){
    if (!lastTick) lastTick = ts;
    if (ts - lastTick >= frameTime){
      lastTick = ts;

      // render terminal into offCtx (transparent)
      const drew = renderTerminalInto(offCtx);

      // draw map & indicator on top of terminal rendering
      drawMapAndIndicator(offCtx);

      // upload to GL texture and draw shader quad
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
      } catch(err) {
        // fallback: use ImageData
        try {
          const imgdata = offCtx.getImageData(0,0,off.width,off.height);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, off.width, off.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imgdata.data);
        } catch(e){}
      }

      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    // ensure overlay follows scrolling (keeps viewport-alignment)
    out.style.transform = `translate(${window.scrollX}px, ${window.scrollY}px)`;
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);

  // small API for runtime tweaks
  window.__CRTOverlay = {
    setDistortion(v){ gl.uniform1f(uDist, v); },
    setGlassOpacity(o){ if (glass) glass.style.opacity = String(o); },
    destroy(){ try{ out.remove(); off.remove(); }catch(e){} }
  };

})();
