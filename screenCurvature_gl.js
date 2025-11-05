// screenCurvature_gl.js
// Final fix: fixed overlay, no-input duplication, correct viewport coords, don't touch screenGlass

(() => {
  const FPS = 15;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.30;
  const SMOOTH = true;

  const _orig = { bodyOverflow: null, hiddenEls: [], mapStyle: null, degStyle: null };

  // overlay canvas (fixed)
  const outCanvas = document.createElement('canvas');
  outCanvas.id = 'curvatureOverlay';
  Object.assign(outCanvas.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    zIndex: 2000,
    pointerEvents: 'none',
    willChange: 'transform'
  });
  document.body.appendChild(outCanvas);

  // ensure scrolling is possible if previously hidden
  try {
    const bodyStyle = getComputedStyle(document.body);
    if (bodyStyle.overflow === 'hidden') {
      _orig.bodyOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'auto';
    }
  } catch(e){}

  // offscreen canvas for composing viewport content
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: false });

  const gl = outCanvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) {
    console.error('WebGL not available');
    return;
  }

  // shaders
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
    uniform vec2 uRes;
    void main(){
      vec2 uv = vUV * 2.0 - 1.0;
      float r = length(uv);
      vec2 distorted = mix(uv, uv * r, uDist);
      vec2 finalUV = (distorted + 1.0) * 0.5;
      finalUV.y = 1.0 - finalUV.y;
      vec4 col = texture2D(uTex, clamp(finalUV, 0.0, 1.0));
      gl_FragColor = col;
    }
  `;

  function compile(src, type){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
  gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
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
  const uRes  = gl.getUniformLocation(prog, 'uRes');
  gl.uniform1f(uDist, DISTORTION);

  // page elements
  const terminal = document.getElementById('terminal') || document.querySelector('.terminal') || null;
  const mapCanvas = document.querySelector('canvas[style*="right:"]') || document.querySelector('canvas');
  let degIndicator = null;
  Array.from(document.body.querySelectorAll('div')).forEach(d => {
    const s = getComputedStyle(d);
    if (s.position === 'fixed' && s.border && (d.innerText || '').toLowerCase().includes('деграда')) degIndicator = d;
  });
  if (!degIndicator) {
    degIndicator = Array.from(document.body.querySelectorAll('div')).find(d => getComputedStyle(d).position === 'fixed' && getComputedStyle(d).zIndex >= '1000');
  }

  // hide originals we will paint (so no visual duplication),
  // but keep input visible and interactive
  try {
    // Hide output lines and other static terminal lines; keep input
    if (terminal) {
      const toHide = terminal.querySelectorAll('.output, .command, .prompt, .cmd, .note, .terminal-line, .line');
      toHide.forEach(el => {
        _orig.hiddenEls.push({ el, style: { opacity: el.style.opacity || '', pointerEvents: el.style.pointerEvents || '' } });
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      });
      // ensure input remains visible (don't touch it)
      const input = terminal.querySelector('.input-line, input, textarea, [contenteditable="true"]');
      if (input) {
        input.style.opacity = '';
        input.style.pointerEvents = 'auto';
      }
    }

    if (mapCanvas) {
      _orig.mapStyle = { opacity: mapCanvas.style.opacity || '', pointerEvents: mapCanvas.style.pointerEvents || '' };
      mapCanvas.style.opacity = '0';
      mapCanvas.style.pointerEvents = 'auto';
    }

    if (degIndicator) {
      _orig.degStyle = { opacity: degIndicator.style.opacity || '', pointerEvents: degIndicator.style.pointerEvents || '' };
      degIndicator.style.opacity = '0';
      degIndicator.style.pointerEvents = 'auto';
    }
  } catch(e){ /* ignore */ }

  // render terminal static text (EXCLUDE the input-line entirely)
  function renderTerminalTextInto(ctx, w, h, scale){
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,w,h);
    if (!terminal) return;

    const lines = [];
    terminal.querySelectorAll('.output, .command, .prompt, .cmd, .note, .terminal-line, .line').forEach(el => {
      const txt = (el.textContent || '').trim();
      if (!txt) return;
      const col = getComputedStyle(el).color || '#00ff41';
      lines.push({ text: txt, color: col });
    });

    const fontSize = Math.max(10, Math.floor(14 * scale));
    ctx.font = `${fontSize}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top';
    let y = 8 * scale;
    const lineHeight = Math.round(fontSize * 1.2);

    lines.forEach(l => {
      ctx.fillStyle = l.color;
      const maxW = w - 16*scale;
      if (ctx.measureText(l.text).width <= maxW) {
        ctx.fillText(l.text, 8*scale, y);
        y += lineHeight;
      } else {
        let t = l.text;
        while (t.length) {
          let i = t.length;
          while (i>0 && ctx.measureText(t.slice(0,i)).width > maxW) i--;
          if (i === 0) break;
          ctx.fillText(t.slice(0,i), 8*scale, y);
          t = t.slice(i);
          y += lineHeight;
        }
      }
    });

    // DO NOT draw input here — input is live in DOM (prevents duplicate)
  }

  function renderIndicatorInto(ctx, offsetX, offsetY, scale){
    if (!degIndicator) return;
    const raw = degIndicator.innerText || '';
    const m = raw.match(/(\d{1,3})\s*%/);
    const perc = m ? Math.max(0, Math.min(100, parseInt(m[1],10))) : parseInt(localStorage.getItem('adam_degradation')) || 0;

    const w = 260 * scale;
    const h = 60 * scale;
    ctx.strokeStyle = '#00FF41';
    ctx.lineWidth = Math.max(1, 2*scale);
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(offsetX, offsetY, w, h);
    ctx.strokeRect(offsetX, offsetY, w, h);
    ctx.fillStyle = '#00FF41';
    const innerW = (w - 12*scale) * (perc/100);
    ctx.fillRect(offsetX + 6*scale, offsetY + 12*scale, innerW, 12*scale);
    ctx.font = `${12 * scale}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#00FF41';
    ctx.fillText(`${perc}%`, offsetX + 6*scale, offsetY + 30*scale);
  }

  // resize
  function resizeAll(){
    const cssW = Math.max(1, Math.floor(window.innerWidth));
    const cssH = Math.max(1, Math.floor(window.innerHeight));
    outCanvas.width  = Math.floor(cssW * DPR);
    outCanvas.height = Math.floor(cssH * DPR);
    outCanvas.style.width  = cssW + 'px';
    outCanvas.style.height = cssH + 'px';
    gl.viewport(0,0,outCanvas.width, outCanvas.height);
    gl.uniform2f(uRes, outCanvas.width, outCanvas.height);
    off.width  = Math.floor(cssW * DPR);
    off.height = Math.floor(cssH * DPR);
  }

  window.addEventListener('resize', resizeAll);
  resizeAll();

  let lastTick = 0;
  const frameTime = 1000 / FPS;

  function step(ts){
    if (!lastTick) lastTick = ts;
    if (ts - lastTick >= frameTime){
      lastTick = ts;
      const w = off.width, h = off.height, scale = DPR;
      offCtx.clearRect(0,0,w,h);
      renderTerminalTextInto(offCtx, w, h, scale);

      // draw map (viewport coordinates — no scroll offset, because overlay is fixed)
      if (mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0) {
        const r = mapCanvas.getBoundingClientRect();
        const dx = Math.round(r.left * DPR);
        const dy = Math.round(r.top * DPR);
        const dw = Math.round(r.width * DPR);
        const dh = Math.round(r.height * DPR);
        try {
          offCtx.drawImage(mapCanvas, dx, dy, dw, dh);
        } catch(e){}
      }

      // draw degradation indicator at viewport position
      if (degIndicator) {
        const r = degIndicator.getBoundingClientRect ? degIndicator.getBoundingClientRect() : { left: window.innerWidth - 300, top: 20 };
        const x = Math.round(r.left * DPR);
        const y = Math.round(r.top * DPR);
        renderIndicatorInto(offCtx, x, y, DPR);
      }

      // upload to GL
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
      } catch(err) {
        const imgdata = offCtx.getImageData(0,0,off.width,off.height);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, off.width, off.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imgdata.data);
      }

      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);

  // API
  window.__CRTOverlay = {
    setDistortion(v){ gl.uniform1f(uDist, v); },
    destroy(){
      try {
        _orig.hiddenEls.forEach(item => {
          item.el.style.opacity = item.style.opacity;
          item.el.style.pointerEvents = item.style.pointerEvents;
        });
        if (_orig.mapStyle && mapCanvas) {
          mapCanvas.style.opacity = _orig.mapStyle.opacity;
          mapCanvas.style.pointerEvents = _orig.mapStyle.pointerEvents;
        }
        if (_orig.degStyle && degIndicator) {
          degIndicator.style.opacity = _orig.degStyle.opacity;
          degIndicator.style.pointerEvents = _orig.degStyle.pointerEvents;
        }
        if (_orig.bodyOverflow !== null) document.body.style.overflow = _orig.bodyOverflow;
      } catch(e){ console.warn(e); }
      outCanvas.remove();
    }
  };
})();
