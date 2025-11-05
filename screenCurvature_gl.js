// screenCurvature_gl.js
// Curvature overlay: mirror terminal + map + degradation indicator into offscreen canvas,
// feed to WebGL shader that applies barrel distortion only (no scanlines, no noise).
(() => {
  const FPS = 15;            // <--- можно менять: 8..30 (производительность)
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.30;  // сила искривления; 0 = нет, ~0.25..0.4 — CRT-like
  const SMOOTH = true;      // для плавной интерполяции текстуры

  // overlay canvas visible to user
  const outCanvas = document.createElement('canvas');
  outCanvas.id = 'curvatureOverlay';
Object.assign(outCanvas.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    zIndex: 999,          // ниже screenGlass.js, выше терминала
    pointerEvents: 'none'
});

  document.body.appendChild(outCanvas);

  // офскрин — сюда мы рендерим terminal+map+indicator
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: false });

  // WebGL setup
  const gl = outCanvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) {
    console.error('WebGL not available for curvature overlay.');
    return;
  }

  // простая вершинка (покрывает экран)
  const vs = `
    attribute vec2 aPos;
    attribute vec2 aUV;
    varying vec2 vUV;
    void main(){ vUV = aUV; gl_Position = vec4(aPos,0.0,1.0); }
  `;

  // фрагмент: берем текстуру и применяем barrel distortion (без прочих эффектов)
 const fs = `
  precision mediump float;
  varying vec2 vUV;
  uniform sampler2D uTex;
  uniform float uDist;
  uniform vec2 uRes;

  void main(){
      // нормализация координат
      vec2 uv = vUV * 2.0 - 1.0;
      float r = length(uv);
      // создаём искажение
      vec2 distorted = mix(uv, uv * r, uDist);
      // возвращаем в [0..1]
      vec2 finalUV = (distorted + 1.0) * 0.5;
      // инвертируем по Y — это устраняет переворот
      finalUV.y = 1.0 - finalUV.y;
      // читаем цвет
      vec4 col = texture2D(uTex, clamp(finalUV, 0.0, 1.0));
      gl_FragColor = col;
  }
`;


  function compile(shaderSource, type){
    const s = gl.createShader(type);
    gl.shaderSource(s, shaderSource);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
  gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
    console.error(gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);

  // fullscreen quad
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

  // texture
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, SMOOTH ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, SMOOTH ? gl.LINEAR : gl.NEAREST);

  // uniforms
  const uDist = gl.getUniformLocation(prog, 'uDist');
  const uRes  = gl.getUniformLocation(prog, 'uRes');
  gl.uniform1f(uDist, DISTORTION);

  // util: find elements
  const terminal = document.getElementById('terminal');
  // mapCanvas: ищем canvas рядом по селектору (netGrid создаёт canvas в body)
  const mapCanvas = document.querySelector('canvas[style*="right:"]') || document.querySelector('canvas');
  // degradation indicator — создаётся в runtime как div (у terminal.js в DegradationSystem.setupUI)
  // мы попытаемся найти элемент с текстом "ДЕГРАДАЦИЯ" или просто последний fixed div с границами #00FF41
  let degIndicator = null;
  Array.from(document.body.querySelectorAll('div')).forEach(d => {
    const s = getComputedStyle(d);
    if (s.position === 'fixed' && s.border && (d.innerText || '').toLowerCase().includes('деграда')) {
      degIndicator = d;
    }
  });
  // fallback: ищем самый верхний fixed div (скорее всего индикатор)
  if (!degIndicator) {
    degIndicator = Array.from(document.body.querySelectorAll('div')).find(d => getComputedStyle(d).position === 'fixed' && getComputedStyle(d).zIndex >= '1000');
  }

  // helper: render terminal DOM text into offCtx (fast because monospace)
  function renderTerminalTextInto(ctx, w, h, scale){
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,w,h);

    if (!terminal) return;
    const lines = [];
    // берем только текстовые строки (output/command/input-line)
    terminal.querySelectorAll('.output, .command, .input-line, .prompt, .cmd').forEach(el => {
      // preserve color and text content
      let txt = el.textContent || '';
      const col = getComputedStyle(el).color || '#00ff41';
      lines.push({ text: txt, color: col, el });
    });

    // font sizing
    const fontSize = Math.max(10, Math.floor(14 * scale)); // базовый
    ctx.font = `${fontSize}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top';
    let y = 8 * scale;
    const lineHeight = Math.round(fontSize * 1.2);

    lines.forEach(l => {
      ctx.fillStyle = l.color;
      // draw text; use fillText (no extra effects)
      const maxW = w - 16*scale;
      // wrap manually if needed (simple)
      if (ctx.measureText(l.text).width <= maxW) {
        ctx.fillText(l.text, 8*scale, y);
        y += lineHeight;
      } else {
        // naive cut
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
  }

  // helper: draw degradation indicator
  function renderIndicatorInto(ctx, offsetX, offsetY, scale){
    if (!degIndicator) return;
    // попробуем извлечь процент из innerText
    const raw = degIndicator.innerText || '';
    const m = raw.match(/(\d{1,3})\s*%/);
    const perc = m ? Math.max(0, Math.min(100, parseInt(m[1],10))) : parseInt(localStorage.getItem('adam_degradation')) || 0;

    // draw box:
    const w = 260 * scale;
    const h = 60 * scale;
    ctx.strokeStyle = '#00FF41';
    ctx.lineWidth = Math.max(1, 2*scale);
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(offsetX, offsetY, w, h);
    ctx.strokeRect(offsetX, offsetY, w, h);
    // progress bar
    ctx.fillStyle = '#00FF41';
    const innerW = (w - 12*scale) * (perc/100);
    ctx.fillRect(offsetX + 6*scale, offsetY + 12*scale, innerW, 12*scale);
    // percent text
    ctx.font = `${12 * scale}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#00FF41';
    ctx.fillText(`${perc}%`, offsetX + 6*scale, offsetY + 30*scale);
  }

  // main render loop: update offscreen, upload texture, draw shader quad
  let lastTick = 0;
  let frameTime = 1000 / FPS;

  function resizeAll(){
    const cssW = Math.max(1, Math.floor(window.innerWidth));
    const cssH = Math.max(1, Math.floor(window.innerHeight));
    outCanvas.width  = Math.floor(cssW * DPR);
    outCanvas.height = Math.floor(cssH * DPR);
    outCanvas.style.width  = cssW + 'px';
    outCanvas.style.height = cssH + 'px';
    gl.viewport(0,0,outCanvas.width, outCanvas.height);
    gl.uniform2f(uRes, outCanvas.width, outCanvas.height);
    // offscreen mirrors viewport for simplicity
    off.width  = Math.floor(cssW * DPR);
    off.height = Math.floor(cssH * DPR);
  }
  function updateCanvasPosition() {
  const scrollX = window.scrollX || 0;
  const scrollY = window.scrollY || 0;
  outCanvas.style.transform = `translate(${scrollX}px, ${scrollY}px)`;
}
  window.addEventListener('scroll', updateCanvasPosition);
  window.addEventListener('resize', resizeAll);
  resizeAll();

  function step(ts){
    if (!lastTick) lastTick = ts;
    if (ts - lastTick >= frameTime){
      lastTick = ts;
      // 1) render terminal text into off
      const w = off.width, h = off.height;
      const scale = DPR;
      // clear
      offCtx.clearRect(0,0,w,h);
      // render terminal area (left area) — for simplicity we render whole viewport:
      renderTerminalTextInto(offCtx, w, h, scale);

      // 2) draw mapCanvas on the bottom-right if exists
      if (mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0){
        // get DOM rect and draw scaled into off
        const r = mapCanvas.getBoundingClientRect();
        const sx = Math.round(r.left * DPR), sy = Math.round(r.top * DPR);
        const sw = Math.round(r.width * DPR), sh = Math.round(r.height * DPR);
        try {
          offCtx.drawImage(mapCanvas, sx, sy, sw, sh);
        } catch(e){
          // sometimes cross-origin or not ready — ignore
        }
      }

      // 3) draw degradation indicator into off at its fixed position (top-right)
      if (degIndicator){
        // try to detect its bounding rect; if absent, draw top-right
        const r = degIndicator.getBoundingClientRect ? degIndicator.getBoundingClientRect() : { left: window.innerWidth - 300, top: 20 };
        const x = Math.round((r.left + window.scrollX) * DPR);
        const y = Math.round((r.top + window.scrollY) * DPR);
        renderIndicatorInto(offCtx, x, y, DPR);
      }

      // 4) upload off to texture
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
      } catch(err) {
        // fallback: use ImageData
        const imgdata = offCtx.getImageData(0,0,off.width,off.height);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, off.width, off.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imgdata.data);
      }

      // 5) draw full quad (shader)
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);

  // IMPORTANT: hide the original terminal visually but keep it interactive.
  // This prevents double-drawing and keeps keyboard / mouse events working.
  if (terminal) {
    terminal.style.transition = 'opacity 0.15s linear';
    terminal.style.opacity = '0'; // remains in DOM, still interactive
    // ensure pointer events still reach terminal
    terminal.style.pointerEvents = 'auto';
  }

  // expose simple API to adjust distortion at runtime
  window.__CRTOverlay = {
    setDistortion(v){ gl.uniform1f(uDist, v); },
    setFPS(f){ /* not implemented dynamic here, could be added */ },
    destroy(){ outCanvas.remove(); if (terminal) terminal.style.opacity = ''; }
  };

})();
