// screenCurvature_gl.js
// Robust CRT curvature overlay — hides originals with strong CSS, keeps input live,
// places overlay above indicator and below/above glass as found, draws prompt+input on one line.

(() => {
  const FPS = 15;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.30;
  const SMOOTH = true;

  // --- helpers / state for restore ---
  const STATE = {
    addedStyleEl: null,
    terminalHadClass: false,
    restored: false,
    saved: {
      bodyOverflow: null,
      glassZ: null,
      overlayZ: null,
      targets: []
    }
  };

  // inject strong CSS rules we will use to hide originals (important to override inline)
  function injectHideCSS() {
    const style = document.createElement('style');
    style.id = 'crt-overlay-styles';
    style.textContent = `
      /* hide static terminal lines when terminal has class 'crt-overlay-hide' */
      .crt-overlay-hide .output,
      .crt-overlay-hide .command,
      .crt-overlay-hide .prompt,
      .crt-overlay-hide .cmd,
      .crt-overlay-hide .note,
      .crt-overlay-hide .terminal-line,
      .crt-overlay-hide .line {
        opacity: 0 !important;
        color: transparent !important;
        background: transparent !important;
        pointer-events: none !important;
      }
      /* hide any element we add class 'crt-hidden-target' to */
      .crt-hidden-target {
        opacity: 0 !important;
        color: transparent !important;
        background: transparent !important;
        pointer-events: auto !important; /* keep interactive */
      }
    `;
    document.head.appendChild(style);
    STATE.addedStyleEl = style;
  }

  injectHideCSS();

  // create overlay canvas
  const outCanvas = document.createElement('canvas');
  outCanvas.id = 'curvatureOverlay';
  Object.assign(outCanvas.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    zIndex: '10000', // temporary, will be adjusted below
    pointerEvents: 'none',
    willChange: 'transform'
  });
  document.body.appendChild(outCanvas);

  // ensure page scrollable — save and set if body overflow is 'hidden'
  try {
    const bodyStyle = getComputedStyle(document.body);
    if (bodyStyle.overflow === 'hidden') {
      STATE.saved.bodyOverflow = document.body.style.overflow || '';
      document.body.style.overflow = 'auto';
    }
  } catch (e) {}

  // locate elements we care about
  const terminal = document.getElementById('terminal') || document.querySelector('.terminal') || null;
  const mapCanvas = document.querySelector('canvas[style*="right:"]') || Array.from(document.querySelectorAll('canvas')).find(c => c.clientWidth > 50 && c.clientHeight > 50) || null;

  // find degradation indicator element heuristically
  let degIndicator = null;
  // try common: element containing "ДЕГРАДА" or "DEG" or "ДЕГРАДАЦ"
  Array.from(document.body.querySelectorAll('div,section,aside')).forEach(d => {
    const text = (d.innerText || '').toUpperCase();
    if (!degIndicator && (text.includes('ДЕГРАДА') || text.includes('DEGRA') || text.includes('DEG'))) {
      degIndicator = d;
    }
  });
  // fallback: highest fixed element with bright border
  if (!degIndicator) {
    degIndicator = Array.from(document.querySelectorAll('div'))
      .filter(d => getComputedStyle(d).position === 'fixed')
      .sort((a,b) => (parseInt(getComputedStyle(b).zIndex||0) - parseInt(getComputedStyle(a).zIndex||0)))[0] || null;
  }

  // find glass/noise element (if exists) by class/id containing 'glass' or 'screen' - optional
  const glassEl = document.querySelector('[id*="glass"], [class*="glass"], [class*="screen"], [id*="screen"]') || null;

  // compute z-index adjustments: put overlay above degIndicator; then put glass above overlay if found
  try {
    const degZ = degIndicator ? parseInt(getComputedStyle(degIndicator).zIndex || '1000', 10) : 1000;
    const targetOverlayZ = degZ + 1;
    outCanvas.style.zIndex = String(targetOverlayZ);
    STATE.saved.overlayZ = targetOverlayZ;

    if (glassEl) {
      STATE.saved.glassZ = glassEl.style.zIndex || '';
      // put glass above overlay so noise is visible on top
      glassEl.style.zIndex = String(targetOverlayZ + 1);
      glassEl.style.pointerEvents = 'none';
    }
  } catch (e) {}

  // mark originals to hide (add class crt-hidden-target)
  function hideOriginals() {
    const targets = [];
    try {
      if (mapCanvas) {
        mapCanvas.classList.add('crt-hidden-target');
        targets.push(mapCanvas);
      }
      if (degIndicator) {
        degIndicator.classList.add('crt-hidden-target');
        targets.push(degIndicator);
      }
      // mark terminal to hide static lines but keep input
      if (terminal) {
        terminal.classList.add('crt-overlay-hide');
        STATE.terminalHadClass = true;
      }
    } catch (e) {}
    STATE.saved.targets = targets;
  }
  hideOriginals();

  // offscreen canvas for composition
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: false });

  // WebGL init
  const gl = outCanvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) {
    console.error('WebGL not available for CRT overlay');
    return;
  }

  // shaders (simple barrel distortion, flip Y)
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

  function compile(src, type) {
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
  const aUV = gl.getAttribLocation(prog, 'aUV');
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, SMOOTH ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, SMOOTH ? gl.LINEAR : gl.NEAREST);

  const uDist = gl.getUniformLocation(prog, 'uDist');
  gl.uniform1f(uDist, DISTORTION);

  // resize handling
  function resizeAll() {
    const cssW = Math.max(1, Math.floor(window.innerWidth));
    const cssH = Math.max(1, Math.floor(window.innerHeight));
    outCanvas.width = Math.floor(cssW * DPR);
    outCanvas.height = Math.floor(cssH * DPR);
    outCanvas.style.width = cssW + 'px';
    outCanvas.style.height = cssH + 'px';
    gl.viewport(0, 0, outCanvas.width, outCanvas.height);
    off.width = outCanvas.width;
    off.height = outCanvas.height;
  }
  window.addEventListener('resize', resizeAll);
  resizeAll();

  // render terminal lines (we hide originals, so we must draw the text)
  function renderTerminalTextInto(ctx, w, h, scale) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    if (!terminal) return;

    // collect static lines (output/command/etc.)
    const staticSelectors = ['.output', '.command', '.prompt', '.cmd', '.note', '.terminal-line', '.line'];
    const lines = [];
    staticSelectors.forEach(sel => {
      terminal.querySelectorAll(sel).forEach(el => {
        const t = (el.textContent || '').replace(/\r?\n/g, ' ').trim();
        if (t) lines.push({ text: t, color: getComputedStyle(el).color || '#00ff41' });
      });
    });

    // draw lines
    const fontSize = Math.max(10, Math.floor(14 * scale));
    ctx.font = `${fontSize}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top';
    let y = 8 * scale;
    const lineHeight = Math.round(fontSize * 1.2);
    lines.forEach(l => {
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, 8 * scale, y);
      y += lineHeight;
    });

    // Now assemble prompt + input into single line and draw it at current y
    let promptText = '';
    const promptEl = terminal.querySelector('.prompt');
    if (promptEl) promptText = (promptEl.textContent || '').trim();
    // find input element - several possibilities
    let inputText = '';
    const inputEl = terminal.querySelector('.input-line, input, textarea, [contenteditable="true"]');
    if (inputEl) {
      if (inputEl.tagName === 'INPUT' || inputEl.tagName === 'TEXTAREA') inputText = inputEl.value || '';
      else inputText = inputEl.textContent || '';
    } else {
      // fallback: try last child text
      const last = terminal.lastElementChild;
      if (last) inputText = (last.textContent || '').trim();
    }
    const combined = (promptText + (promptText && inputText ? ' ' : '') + inputText).trim();
    if (combined) {
      ctx.fillStyle = '#00ff41';
      ctx.fillText(combined, 8 * scale, y);
    }
  }

  // draw degradation indicator box
  function renderIndicatorInto(ctx, x, y, scale) {
    const raw = degIndicator ? (degIndicator.innerText || '') : '';
    const m = raw.match(/(\d{1,3})\s*%/);
    const perc = m ? Math.max(0, Math.min(100, parseInt(m[1], 10))) : (parseInt(localStorage.getItem('adam_degradation')) || 34);

    const w = 260 * scale;
    const h = 60 * scale;
    ctx.strokeStyle = '#00FF41';
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#00FF41';
    const innerW = (w - 12 * scale) * (perc / 100);
    ctx.fillRect(x + 6 * scale, y + 12 * scale, innerW, 12 * scale);
    ctx.font = `${12 * scale}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#00FF41';
    ctx.fillText(`${perc}%`, x + 6 * scale, y + 30 * scale);
  }

  // main loop
  let lastTick = 0;
  const frameTime = 1000 / FPS;

  function step(ts) {
    if (!lastTick) lastTick = ts;
    if (ts - lastTick >= frameTime) {
      lastTick = ts;

      const w = off.width, h = off.height, scale = DPR;
      offCtx.clearRect(0, 0, w, h);

      // 1) terminal static text + prompt+input combined
      renderTerminalTextInto(offCtx, w, h, scale);

      // 2) draw mapCanvas by viewport coords (no scroll offset needed for fixed overlay)
      if (mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0) {
        try {
          const r = mapCanvas.getBoundingClientRect();
          offCtx.drawImage(mapCanvas, r.left * DPR, r.top * DPR, r.width * DPR, r.height * DPR);
        } catch (e) { /* ignore */ }
      }

      // 3) draw degradation indicator at its viewport location; fallback to top-right
      if (degIndicator) {
        try {
          const r = degIndicator.getBoundingClientRect();
          // if bounding box invalid (e.g., 0,0), fallback to fixed top-right
          let x = (r.left && r.width > 10) ? Math.round(r.left * DPR) : Math.round((window.innerWidth - 280) * DPR);
          let y = (r.top && r.height > 6) ? Math.round(r.top * DPR) : Math.round(20 * DPR);
          renderIndicatorInto(offCtx, x, y, DPR);
        } catch (e) {
          renderIndicatorInto(offCtx, Math.round((window.innerWidth - 280) * DPR), Math.round(20 * DPR), DPR);
        }
      }

      // upload and draw
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
      } catch (err) {
        const imgdata = offCtx.getImageData(0, 0, off.width, off.height);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, off.width, off.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imgdata.data);
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);

  // API to adjust and destroy (restore page)
  window.__CRTOverlay = {
    setDistortion(v) {
      gl.uniform1f(uDist, v);
    },
    destroy() {
      if (STATE.restored) return;
      STATE.restored = true;
      try {
        // remove hide class from terminal
        if (terminal && STATE.terminalHadClass) terminal.classList.remove('crt-overlay-hide');
        // remove crt-hidden-target class from targets
        STATE.saved.targets && STATE.saved.targets.forEach(el => el.classList.remove('crt-hidden-target'));
        // restore glass z
        if (glassEl && STATE.saved.glassZ !== null) glassEl.style.zIndex = STATE.saved.glassZ;
        // restore body overflow
        if (STATE.saved.bodyOverflow !== null) document.body.style.overflow = STATE.saved.bodyOverflow;
        // remove injected style
        if (STATE.addedStyleEl) STATE.addedStyleEl.remove();
      } catch (e) { console.warn('CRTOverlay.restore error', e); }
      try { outCanvas.remove(); } catch (e) {}
    }
  };

})();
