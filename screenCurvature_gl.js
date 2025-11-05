// screenCurvature_gl.js
// Finalized CRT curvature overlay with scroll, no-duplicate UI elements, and z-index fixes.
// Replaces visual DOM parts with a single curved WebGL texture while keeping originals interactive.

(() => {
  const FPS = 15;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.30;
  const SMOOTH = true;

  // keep track of original inline styles so destroy() can restore
  const _orig = { bodyOverflow: null, hiddenEls: [], mapStyle: null, degStyle: null, glassStyle: null };

  // === overlay canvas ===
  const outCanvas = document.createElement('canvas');
  outCanvas.id = 'curvatureOverlay';
  Object.assign(outCanvas.style, {
    position: 'fixed',    // fixed is fine if pointer-events:none, allows scroll pass-through
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    zIndex: 2000,         // above most UI so glass can be placed below
    pointerEvents: 'none',
    willChange: 'transform'
  });
  document.body.appendChild(outCanvas);

  // if body/html had overflow hidden, enable scrolling so page is scrollable
  try {
    const bodyStyle = getComputedStyle(document.body);
    const htmlStyle = getComputedStyle(document.documentElement);
    if (bodyStyle.overflow === 'hidden') {
      _orig.bodyOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'auto';
    }
    if (htmlStyle.overflow === 'hidden') {
      // only change if absolutely necessary (rare)
      _orig.htmlOverflow = document.documentElement.style.overflow || '';
      document.documentElement.style.overflow = 'auto';
    }
  } catch (e) { /* ignore */ }

  // === try to move screenGlass under our overlay ===
  const glassEl = document.querySelector('[id*="glass"], [class*="glass"], canvas[id*="glass"], canvas[class*="glass"]');
  if (glassEl) {
    _orig.glassStyle = { zIndex: glassEl.style.zIndex || '', pointerEvents: glassEl.style.pointerEvents || '' };
    // put glass under overlay but above terminal base
    glassEl.style.zIndex = String(parseInt(outCanvas.style.zIndex || '2000', 10) - 1);
    glassEl.style.pointerEvents = 'none';
  }

  // offscreen canvas (we render page content here)
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: false });

  // webgl
  const gl = outCanvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) {
    console.error('WebGL not available for curvature overlay.');
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

  function compile(src, t){
    const s = gl.createShader(t);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
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

  // find UI parts
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

  // Hide originals that we will redraw (but keep pointer-events active)
  try {
    if (mapCanvas) {
      _orig.mapStyle = { opacity: mapCanvas.style.opacity || '', pointerEvents: mapCanvas.style.pointerEvents || '' };
      mapCanvas.style.opacity = '0';
      mapCanvas.style.pointerEvents = 'auto';
    }
    if (degIndicator) {
      _orig.degStyle = { opacity: degIndicator.style.opacity || '', pointerEvents: degIndicator.style.pointerEvents || '' };
      // hide original visual (we will draw it in curved layer), but keep it interactive
      degIndicator.style.opacity = '0';
      degIndicator.style.pointerEvents = 'auto';
    }
  } catch (e) { /* ignore */ }

  // Hide the static terminal lines we redraw, but keep the input-line visible and interactive
  const hiddenSelector = '.output, .command, .prompt, .cmd, .note, .terminal-line, .line';
  if (terminal) {
    const toHide = terminal.querySelectorAll(hiddenSelector);
    toHide.forEach(el => {
      _orig.hiddenEls.push({ el, style: { opacity: el.style.opacity || '', pointerEvents: el.style.pointerEvents || '' } });
      // hide visual copy
      el.style.opacity = '0';
      // let input still receive pointer events through terminal container
      el.style.pointerEvents = 'none';
    });
    // ensure input-line (if exists) stays visible and above
    const input = terminal.querySelector('.input-line, input, textarea, [contenteditable="true"]');
    if (input) {
      input.style.opacity = ''; // keep original
      input.style.pointerEvents = 'auto';
    }
  }

  // render terminal text (excluding input-line)
  function renderTerminalTextInto(ctx, w, h, scale){
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,w,h);

    if (!terminal) return;
    const lines = [];
    // select only non-input lines that we want to render (match our earlier hiddenSelector)
    terminal.querySelectorAll('.output, .command, .prompt, .cmd, .note, .terminal-line, .line').forEach(el => {
      let txt = el.textContent || '';
      if (!txt) return;
      const col = getComputedStyle(el).color || '#00ff41';
      lines.push({ text: txt, color: col });
    });

    // layout
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

    // finally draw the input line AFTER other lines (but not as original DOM duplication)
    const input = terminal.querySelector('.input-line, input, textarea, [contenteditable="true"]');
    if (input && input.textContent !== undefined) {
      const txt = input.value || input.textContent || '';
      ctx.fillStyle = getComputedStyle(input).color || '#00ff41';
      // draw near bottom of current text
      ctx.fillText(txt, 8*scale, y);
    }
  }

  // draw indicator (we will draw it ourselves)
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

  // resize & scroll handling
  function updateCanvasPosition() {
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    // we use fixed position so transform mainly used for pixel offset (shouldn't be strictly necessary)
    outCanvas.style.transform = `translate(${scrollX}px, ${scrollY}px)`;
  }

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
    updateCanvasPosition();
  }

  window.addEventListener('scroll', updateCanvasPosition);
  window.addEventListener('resize', resizeAll);
  resizeAll();
  updateCanvasPosition();

  // main loop
  let lastTick = 0;
  const frameTime = 1000 / FPS;

  function step(ts){
    if (!lastTick) lastTick = ts;
    if (ts - lastTick >= frameTime){
      lastTick = ts;

      const w = off.width, h = off.height, scale = DPR;
      offCtx.clearRect(0,0,w,h);

      // 1) terminal content (rendered)
      renderTerminalTextInto(offCtx, w, h, scale);

      // 2) draw map canvas into correct place (if exists)
      if (mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0) {
        const r = mapCanvas.getBoundingClientRect();
        const dx = Math.round((r.left + window.scrollX) * DPR);
        const dy = Math.round((r.top + window.scrollY) * DPR);
        const dw = Math.round(r.width * DPR);
        const dh = Math.round(r.height * DPR);
        try {
          // draw the mapCanvas into destination at page coordinates (dx,dy)
          offCtx.drawImage(mapCanvas, dx, dy, dw, dh);
        } catch(e){
          // sometimes canvas not ready or cross-origin — ignore
        }
      }

      // 3) draw degradation indicator at its page position
      if (degIndicator) {
        const r = degIndicator.getBoundingClientRect ? degIndicator.getBoundingClientRect() : { left: window.innerWidth - 300, top: 20 };
        const x = Math.round((r.left + window.scrollX) * DPR);
        const y = Math.round((r.top + window.scrollY) * DPR);
        renderIndicatorInto(offCtx, x, y, DPR);
      }

      // upload to webgl texture
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

  // debug / control API: allows runtime adjustments and cleanup
  window.__CRTOverlay = {
    setDistortion(v) {
      gl.uniform1f(uDist, v);
    },
    destroy() {
      // restore hidden originals
      try {
        if (_orig.mapStyle && mapCanvas) {
          mapCanvas.style.opacity = _orig.mapStyle.opacity;
          mapCanvas.style.pointerEvents = _orig.mapStyle.pointerEvents;
        }
        if (_orig.degStyle && degIndicator) {
          degIndicator.style.opacity = _orig.degStyle.opacity;
          degIndicator.style.pointerEvents = _orig.degStyle.pointerEvents;
        }
        _orig.hiddenEls.forEach(item => {
          item.el.style.opacity = item.style.opacity;
          item.el.style.pointerEvents = item.style.pointerEvents;
        });
        if (_orig.bodyOverflow !== null) document.body.style.overflow = _orig.bodyOverflow;
        if (_orig.htmlOverflow !== null) document.documentElement.style.overflow = _orig.htmlOverflow;
        if (_orig.glassStyle && glassEl) {
          glassEl.style.zIndex = _orig.glassStyle.zIndex;
          glassEl.style.pointerEvents = _orig.glassStyle.pointerEvents;
        }
      } catch(e){ console.warn('restore error', e); }
      outCanvas.remove();
    }
  };

})();
