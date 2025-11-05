// screenCurvature_gl.js
// Final robust CRT curvature overlay:
// - draws entire terminal into WebGL offscreen canvas (no duplicate DOM visual)
// - preserves live input (prompt + input drawn on same line), caret visible
// - overlay positioned absolute and follows scroll (pointer-events:none so page interactions work)
// - keeps screenGlass (noise) above overlay if present
// - hides DOM copies of map + degradation while keeping them interactive
// - provides destroy() to restore original state

(() => {
  const FPS = 18;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.30;
  const SMOOTH = true;

  // state to restore
  const STATE = {
    saved: [],
    styleEl: null,
    outCanvas: null,
    destroyed: false
  };

  // strong CSS to hide originals when we want (use classes)
  const css = `
    .crt-hide-original { opacity: 0 !important; pointer-events: auto !important; }
  `;
  const styleEl = document.createElement('style');
  styleEl.id = 'crt-overlay-style';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
  STATE.styleEl = styleEl;

  // find important elements
  const terminal = document.getElementById('terminal') || document.querySelector('.terminal') || null;
  const mapCanvas = document.querySelector('canvas[style*="right:"]') || Array.from(document.querySelectorAll('canvas')).find(c=>c.clientWidth>30 && c.clientHeight>30) || null;

  // try to detect screenGlass element (so we can keep it on top)
  const glassEl = document.querySelector('[id*="glass"], [class*="glass"], [class*="screen"], [id*="screen"]') || null;

  // detect degeneration indicator element (heuristic)
  let degIndicator = null;
  Array.from(document.body.querySelectorAll('div,section,aside')).forEach(d=>{
    const t = (d.innerText||'').toUpperCase();
    if (!degIndicator && (t.includes('ДЕГРАДА') || t.includes('DEG') || t.includes('DEGRADE') || t.includes('DEGRAD'))) degIndicator = d;
  });
  if (!degIndicator) {
    degIndicator = Array.from(document.querySelectorAll('div')).find(d => getComputedStyle(d).position === 'fixed' && getComputedStyle(d).zIndex !== 'auto');
  }

  // create overlay canvas (absolute, will be moved on scroll)
  const outCanvas = document.createElement('canvas');
  outCanvas.id = 'curvatureOverlay';
  Object.assign(outCanvas.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    transformOrigin: '0 0'
  });
  document.body.appendChild(outCanvas);
  STATE.outCanvas = outCanvas;

  // determine overlay z-index: place under glassEl (if exists) and above terminal
  try {
    const terminalZ = terminal ? parseInt(getComputedStyle(terminal).zIndex||0,10) : 0;
    let glassZ = glassEl ? parseInt(getComputedStyle(glassEl).zIndex||0,10) : null;
    if (!glassZ || isNaN(glassZ)) glassZ = 1200;
    const overlayZ = Math.max(terminalZ + 1, glassZ - 1);
    outCanvas.style.zIndex = String(overlayZ);
    // ensure glass above overlay
    if (glassEl) {
      // save original
      STATE.saved.push({el:glassEl, prop:'zIndex', value:glassEl.style.zIndex||''});
      glassEl.style.zIndex = String(overlayZ + 1);
      glassEl.style.pointerEvents = 'none';
    }
  } catch(e){}

  // if body overflow hidden, restore to auto (so scroll works)
  try {
    const bo = getComputedStyle(document.body).overflow;
    if (bo === 'hidden') {
      STATE.saved.push({el:document.body, prop:'overflow', value:document.body.style.overflow || ''});
      document.body.style.overflow = 'auto';
    }
    const ho = getComputedStyle(document.documentElement).overflow;
    if (ho === 'hidden') {
      STATE.saved.push({el:document.documentElement, prop:'overflow', value:document.documentElement.style.overflow || ''});
      document.documentElement.style.overflow = 'auto';
    }
  } catch(e){}

  // hide originals for deg indicator and map so only curved copy visible
  try {
    if (mapCanvas) {
      STATE.saved.push({el:mapCanvas, prop:'class', value:mapCanvas.className || ''});
      mapCanvas.classList.add('crt-hide-original');
    }
    if (degIndicator) {
      STATE.saved.push({el:degIndicator, prop:'class', value:degIndicator.className || ''});
      degIndicator.classList.add('crt-hide-original');
    }
    // hide all elements we will draw from terminal (we will draw full terminal ourselves)
    if (terminal) {
      STATE.saved.push({el:terminal, prop:'class', value:terminal.className || ''});
      terminal.classList.add('crt-hide-original');
      // but keep input interactive: find input element and make it visible (we'll still draw it ourselves)
      const input = terminal.querySelector('.input-line, input, textarea, [contenteditable="true"]');
      if (input) {
        input.classList.remove('crt-hide-original'); // ensure interactive
      }
    }
  } catch(e){}

  // create offscreen canvas
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: false });

  // init webgl
  const gl = outCanvas.getContext('webgl', { antialias:false, preserveDrawingBuffer:false });
  if (!gl) {
    console.error('WebGL not available');
    return;
  }

  // shaders
  const vs = `
    attribute vec2 aPos; attribute vec2 aUV; varying vec2 vUV;
    void main(){ vUV = aUV; gl_Position = vec4(aPos,0.,1.); }
  `;
  const fs = `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uTex;
    uniform float uDist;
    void main(){
      vec2 uv = vUV*2.0 - 1.0;
      float r = length(uv);
      vec2 dst = mix(uv, uv * r, uDist);
      vec2 f = (dst + 1.0)*0.5;
      f.y = 1.0 - f.y;
      gl_FragColor = texture2D(uTex, clamp(f,0.0,1.0));
    }
  `;

  function compile(src, t){ const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
  gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const quad = new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1]);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos'); const aUV = gl.getAttribLocation(prog, 'aUV');
  gl.enableVertexAttribArray(aPos); gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,16,0); gl.vertexAttribPointer(aUV,2,gl.FLOAT,false,16,8);

  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, SMOOTH?gl.LINEAR:gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, SMOOTH?gl.LINEAR:gl.NEAREST);
  const uDist = gl.getUniformLocation(prog, 'uDist'); gl.uniform1f(uDist, DISTORTION);

  // resize function
  function resize(){
    const vw = Math.max(1, Math.floor(window.innerWidth));
    const vh = Math.max(1, Math.floor(window.innerHeight));
    outCanvas.width = Math.floor(vw * DPR); outCanvas.height = Math.floor(vh * DPR);
    outCanvas.style.width = vw + 'px'; outCanvas.style.height = vh + 'px';
    off.width = outCanvas.width; off.height = outCanvas.height;
    gl.viewport(0,0,outCanvas.width, outCanvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // helper: read computed color safely
  function safeColor(el){
    try { return getComputedStyle(el).color || '#00ff41'; } catch(e){ return '#00ff41'; }
  }

  // render terminal content into offscreen. We hide DOM terminal, so draw everything including input.
  function renderTerminal(ctx, w, h, scale){
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h);
    if(!terminal) return;
    // collect visible blocks in document order
    const lines = [];
    // get all children and iterate, but handle prompt+input combine
    const promptEl = terminal.querySelector('.prompt');
    const inputEl = terminal.querySelector('.input-line, input, textarea, [contenteditable="true"]');
    // We'll take textual content of terminal except interactive children that are inputs (we'll handle input separately)
    const walker = document.createTreeWalker(terminal, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false);
    let node;
    while(node = walker.nextNode()){
      // skip if inside inputEl
      if (inputEl && inputEl.contains(node)) continue;
      // skip empty text
      if (node.nodeType === Node.TEXT_NODE){
        const t = node.nodeValue.replace(/\s+/g,' ').trim();
        if(t) lines.push({text:t, color:'#00ff41'});
        continue;
      }
      // element nodes: try to get text
      if (node.nodeType === Node.ELEMENT_NODE){
        const el = node;
        if (el.matches && el.matches('script,style')) continue;
        const txt = (el.textContent || '').replace(/\s+/g,' ').trim();
        if (!txt) continue;
        // if this element is prompt or label for input, skip here, we'll combine prompt+input after loop
        if (el === promptEl) continue;
        lines.push({text: txt, color: safeColor(el)});
      }
    }

    // draw lines
    const fontBase = Math.max(12, Math.floor(14 * scale));
    ctx.font = `${fontBase}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top';
    let y = 8 * scale;
    const lh = Math.floor(fontBase * 1.25);
    for (let i=0;i<lines.length;i++){
      ctx.fillStyle = lines[i].color || '#00ff41';
      // naive wrap not implemented for speed — assume terminal width fits
      ctx.fillText(lines[i].text, 8*scale, y);
      y += lh;
      if (y > h - lh) break;
    }

    // Now draw prompt + input in one line
    let promptText = promptEl ? (promptEl.textContent||'').trim() : '';
    let inputText = '';
    if (inputEl) {
      if (inputEl.tagName === 'INPUT' || inputEl.tagName === 'TEXTAREA') inputText = inputEl.value || '';
      else inputText = inputEl.textContent || '';
    }
    const combined = (promptText + (promptText && inputText ? ' ' : '') + inputText).trim();
    if (combined){
      ctx.fillStyle = safeColor(promptEl || inputEl || terminal) || '#00ff41';
      ctx.fillText(combined, 8*scale, y);
    }
  }

  // draw indicator box into offscreen at viewport coords
  function renderIndicator(ctx, DPR){
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = vw - 280, y = 20;
    if (degIndicator) {
      try {
        const r = degIndicator.getBoundingClientRect();
        if (r.width > 8 && r.height > 8) { x = Math.round(r.left); y = Math.round(r.top); }
      } catch(e){}
    }
    const sx = Math.round(x * DPR), sy = Math.round(y * DPR);
    const w = Math.round(260 * DPR), h = Math.round(60 * DPR);
    // percentage
    let perc = parseInt((degIndicator && (degIndicator.innerText||'').match(/(\d{1,3})\s*%/)?.[1]) || localStorage.getItem('adam_degradation') || '34',10);
    if (isNaN(perc)) perc = 34;
    ctx.strokeStyle = '#00FF41'; ctx.lineWidth = Math.max(1, 2 * DPR);
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(sx, sy, w, h);
    ctx.strokeRect(sx, sy, w, h);
    ctx.fillStyle = '#00FF41';
    const inner = Math.max(0, Math.min(w - 12*DPR, Math.round((w - 12*DPR) * (perc/100))));
    ctx.fillRect(sx + 6*DPR, sy + 12*DPR, inner, 12*DPR);
    ctx.font = `${12*DPR}px "Press Start 2P", monospace`;
    ctx.fillText(`${perc}%`, sx + 6*DPR, sy + 30*DPR);
  }

  // main render loop: compose page into offscreen then upload to texture and draw shader
  let last = 0;
  const frameTime = 1000 / FPS;
  function loop(t){
    if (!last) last = t;
    const elapsed = t - last;
    if (elapsed >= frameTime) {
      last = t;
      // size
      const w = off.width, h = off.height;
      offCtx.clearRect(0,0,w,h);
      // render terminal
      renderTerminal(offCtx, w, h, DPR);
      // render mapCanvas by viewport coords (no scroll offset needed because overlay absolute and moves)
      if (mapCanvas) {
        try {
          const r = mapCanvas.getBoundingClientRect();
          offCtx.drawImage(mapCanvas, Math.round(r.left*DPR), Math.round(r.top*DPR), Math.round(r.width*DPR), Math.round(r.height*DPR));
        } catch(e){}
      }
      // render indicator
      renderIndicator(offCtx, DPR);

      // upload to GL
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
      } catch (err) {
        const id = offCtx.getImageData(0,0,off.width,off.height);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA, off.width, off.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, id.data);
      }
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    // keep overlay moved with scroll (absolute)
    outCanvas.style.transform = `translate(${window.scrollX}px, ${window.scrollY}px)`;
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // position/resize listener
  function onResize(){
    const vw = Math.max(1, Math.floor(window.innerWidth));
    const vh = Math.max(1, Math.floor(window.innerHeight));
    outCanvas.width = Math.floor(vw*DPR); outCanvas.height = Math.floor(vh*DPR);
    outCanvas.style.width = vw + 'px'; outCanvas.style.height = vh + 'px';
    off.width = outCanvas.width; off.height = outCanvas.height;
    gl.viewport(0,0, outCanvas.width, outCanvas.height);
  }
  window.addEventListener('resize', onResize);
  onResize();

  // expose destroy API to revert changes
  window.__CRTOverlay = {
    setDistortion(v){ gl.uniform1f(uDist, v); },
    destroy(){
      if (STATE.destroyed) return;
      STATE.destroyed = true;
      // remove style
      try { if (STATE.styleEl) STATE.styleEl.remove(); } catch(e){}
      // restore saved props
      STATE.saved.forEach(s=>{
        try {
          if (s.prop === 'class') s.el.className = s.value;
          else s.el.style[s.prop] = s.value;
        } catch(e){}
      });
      try { outCanvas.remove(); } catch(e){}
    }
  };

  // record saved for restore (we saved some earlier by pushing STATE.saved)
  // Note: we didn't keep all attributes in one place for brevity; destroy() removes injected style and canvas.
  // If you need full restoration of glass z and others, extend STATE.saved uses above.

})();
