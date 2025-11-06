// screenCurvature_gl.js
// Robust CRT curvature overlay with DOM snapshot (SVG foreignObject) + fallback rendering.
// Replaces previous brittle hacks: preserves #terminal DOM, draws curved copy, keeps input interactive.

(() => {
  const FPS = 18;                  // shader draw FPS
  const SNAP_FPS = 6;              // how often to snapshot terminal DOM into a texture (6 fps)
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.30;
  const SMOOTH = true;

  // --- utility ---
  function q(sel){ return document.querySelector(sel); }

  // --- try to find key elements from your project ---
  const terminal = q('#terminal') || q('.terminal');
  const glass = q('#glassFX') || q('[id*="glass"], [class*="glass"], [id*="screen"], [class*="screen"]');
  const mapCanvas = document.querySelector('canvas[style*="right:"]') || Array.from(document.querySelectorAll('canvas')).find(c=>c.id !== 'glassFX' && c.clientWidth>30 && c.clientHeight>30);

  // --- create overlay canvas (fixed, pointer-events none keeps page interactive and scrollable) ---
  const out = document.createElement('canvas');
  out.id = 'curvatureOverlay';
  Object.assign(out.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '9998', // will keep below glassFX by default which is 100 in your file; tweak if needed
    willChange: 'transform'
  });
  document.body.appendChild(out);

  // if we found glass, make sure it's visible and not too strong
  try {
    if (glass) {
      // prefer glass above overlay; reduce its opacity a bit to avoid overbright
      glass.style.zIndex = String(parseInt(out.style.zIndex || '9998', 10) + 2);
      if (!glass.style.opacity) glass.style.opacity = '0.35';
    }
  } catch (e) {}

  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: false });

  const gl = out.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) { console.error('WebGL not available'); return; }

  // --- shaders (simple barrel distortion) ---
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
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
  gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const quad = new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1]);
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

  // uniform for resolution if needed later
  const uRes = gl.getUniformLocation(prog, 'uRes');

  // resize handling
  function resizeAll(){
    const cssW = Math.max(1, Math.floor(window.innerWidth));
    const cssH = Math.max(1, Math.floor(window.innerHeight));
    out.width = Math.floor(cssW * DPR);
    out.height = Math.floor(cssH * DPR);
    out.style.width = cssW + 'px';
    out.style.height = cssH + 'px';
    off.width = out.width;
    off.height = out.height;
    gl.viewport(0,0,out.width, out.height);
    if (uRes) gl.uniform2f(uRes, out.width, out.height);
  }
  window.addEventListener('resize', resizeAll);
  resizeAll();

  // --- snapshot utilities ---
  // 1) svg foreignObject snapshot approach (best chance to capture DOM + CSS)
  async function snapshotTerminalSVG() {
    if (!terminal) return null;
    try {
      // clone terminal node
      const clone = terminal.cloneNode(true);

      // We must add inline styles for fonts that are provided by external CSS? We'll try as-is.
      const serialized = new XMLSerializer().serializeToString(clone);
      const w = Math.max(1, Math.floor(terminal.clientWidth)) || window.innerWidth;
      const h = Math.max(1, Math.floor(terminal.clientHeight)) || window.innerHeight;
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
          <foreignObject width="100%" height="100%">
            ${serialized}
          </foreignObject>
        </svg>
      `.trim();
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const svg64 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      img.src = svg64;
      await new Promise((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('SVG snapshot failed'));
      });
      // draw image into offCtx at terminal position (relative to viewport)
      const rect = terminal.getBoundingClientRect();
      const dx = Math.round(rect.left * DPR);
      const dy = Math.round(rect.top * DPR);
      const dw = Math.round(rect.width * DPR);
      const dh = Math.round(rect.height * DPR);
      offCtx.drawImage(img, dx, dy, dw, dh);
      return true;
    } catch (e) {
      // failed (browser may block foreignObject or external CSS)
      return false;
    }
  }

  // 2) fallback: programmatic text rendering (less perfect, but works)
  function renderTerminalFallback() {
    // draw black background
    offCtx.fillStyle = '#000';
    offCtx.fillRect(0,0,off.width, off.height);
    if (!terminal) return;
    const scale = DPR;
    offCtx.font = `${14 * scale}px "Press Start 2P", monospace`;
    offCtx.textBaseline = 'top';
    let y = 8 * scale;
    const lh = Math.round(14 * scale * 1.2);
    // gather visible lines in order
    const selectors = ['.output', '.command', '.note', '.line', '.terminal-line', '.cmd', '.prompt'];
    const lines = [];
    selectors.forEach(sel=>{
      terminal.querySelectorAll(sel).forEach(el=>{
        const txt = (el.textContent || '').replace(/\s+/g,' ').trim();
        if (txt) lines.push({txt, color: getComputedStyle(el).color || '#00ff41'});
      });
    });
    if (lines.length === 0) {
      // fallback to terminal textContent
      const txt = (terminal.textContent || '').replace(/\s+/g,' ').trim();
      if (txt) lines.push({txt, color:'#00ff41'});
    }
    lines.forEach(l=>{
      offCtx.fillStyle = l.color;
      offCtx.fillText(l.txt, 8 * scale, y);
      y += lh;
      if (y > off.height - lh) return;
    });
    // draw prompt+input single-line
    const pEl = terminal.querySelector('.prompt');
    const iEl = terminal.querySelector('.input-line, input, textarea, [contenteditable="true"]');
    const p = pEl ? (pEl.textContent || '').trim() : '';
    let v = '';
    if (iEl) {
      v = (iEl.value || iEl.textContent || '').trim();
    }
    if (p || v) {
      offCtx.fillStyle = '#00ff41';
      offCtx.fillText(p + (p && v ? ' ' : '') + v, 8 * scale, y);
    }
  }

  // helper draws map and indicator into offCtx at their viewport positions
  function drawMapAndIndicator() {
    // draw map canvas if present
    if (mapCanvas) {
      try {
        const r = mapCanvas.getBoundingClientRect();
        offCtx.drawImage(mapCanvas, Math.round(r.left * DPR), Math.round(r.top * DPR), Math.round(r.width * DPR), Math.round(r.height * DPR));
      } catch (e) {}
    }
    // draw degradation indicator (we render our own curved copy)
    const degElem = Array.from(document.querySelectorAll('div')).find(d => /(дегра|degra|degrad)/i.test(d.innerText || '')) || null;
    let perc = parseInt(localStorage.getItem('adam_degradation')) || 0;
    if (degElem) {
      const match = (degElem.innerText || '').match(/(\d{1,3})\s*%/);
      if (match) perc = parseInt(match[1],10);
    }
    // position top-right fallback
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
    offCtx.fillStyle = 'rgba(0,0,0,0.9)';
    offCtx.fillRect(sx, sy, w, h);
    offCtx.strokeStyle = '#00FF41';
    offCtx.lineWidth = Math.max(1, 2 * DPR);
    offCtx.strokeRect(sx, sy, w, h);
    offCtx.fillStyle = '#00FF41';
    offCtx.font = `${12 * DPR}px "Press Start 2P", monospace`;
    offCtx.fillText('ДЕГРАДАЦИЯ СИСТЕМЫ', sx + 6 * DPR, sy + 6 * DPR);
    const inner = Math.round((w - 12 * DPR) * (Math.max(0, Math.min(100, perc)) / 100));
    offCtx.fillRect(sx + 6 * DPR, sy + 24 * DPR, inner, 10 * DPR);
    offCtx.fillText(`${perc}%`, sx + 6 * DPR, sy + 38 * DPR);
  }

  // --- snapshot loop management ---
  let lastDraw = 0;
  let lastSnap = 0;
  let useSVGSnapshot = true; // try svg first; fallback if fails
  async function doSnapshotIfNeeded(ts) {
    // snapshot at SNAP_FPS
    if (ts - lastSnap < (1000 / SNAP_FPS)) return;
    lastSnap = ts;
    // clear the terminal area on offCtx before drawing snapshot
    offCtx.clearRect(0,0,off.width, off.height);
    if (useSVGSnapshot && terminal) {
      const ok = await snapshotTerminalSVG().catch(()=>false);
      if (!ok) {
        useSVGSnapshot = false;
        // fallback render
        renderTerminalFallback();
      }
    } else {
      // fallback mode: render text programmatically
      renderTerminalFallback();
    }
    // draw map + indicator onto off
    drawMapAndIndicator();
  }

  // --- main render loop ---
  function frame(ts) {
    requestAnimationFrame(frame);
    // snapshot terminal occasionally
    doSnapshotIfNeeded(ts).then(()=>{
      // upload off to GL texture and draw (at FPS)
      if (ts - lastDraw < (1000 / FPS)) return;
      lastDraw = ts;
      try {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } catch (e) {
        // If texImage2D fails (off blank), try render fallback to ensure something drawn
        renderTerminalFallback();
      }
    }).catch(()=>{ /* ignore snapshot errors */ });
    // keep overlay visually aligned with scroll (fixed + pointer-events none means this is mostly cosmetic)
    out.style.transform = `translate(${window.scrollX}px, ${window.scrollY}px)`;
  }
  requestAnimationFrame(frame);

  // expose small API
  window.__CRTOverlay = {
    setDistortion(v){ gl.uniform1f(uDist, v); },
    setGlassOpacity(o){ if (glass) glass.style.opacity = String(o); },
    destroy(){
      try {
        out.remove();
        off.remove();
      } catch(e){}
    }
  };

})();
