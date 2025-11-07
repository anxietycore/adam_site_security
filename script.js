// script.js
// Главная логика + идентичный терминальному WebGL изгиб страницы.
// Заменяет существующий script.js — полностью self-contained.
// Не трогает вашу логику запуска/логина: просто добавляет визуальный слой "изгиба".

const VALID_CREDENTIALS = { username: "qq", password: "ww" };

/* ----------------- НАЧАЛЬНЫЕ UI ФУНКЦИИ (как были) ----------------- */
document.addEventListener('DOMContentLoaded', () => {
  let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
  localStorage.setItem('adam_visits', ++visits);

  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.addEventListener('click', startBootSequence);

  // init curvature overlay after DOM ready
  initCurvatureOverlay();
});

function startBootSequence() {
  const startScreen = document.getElementById('start-screen');
  const bootScreen = document.getElementById('boot-screen');
  if (startScreen) startScreen.classList.add('hidden');
  if (bootScreen) bootScreen.classList.remove('hidden');

  const bootTexts = document.querySelectorAll('#boot-screen .boot-text p');
  let i = 0;
  (function next() {
    if (i < bootTexts.length) {
      bootTexts[i++].style.opacity = 1;
      setTimeout(next, 1000);
    } else setTimeout(showLoginScreen, 1000);
  })();
}

function showLoginScreen() {
  document.getElementById('boot-screen')?.classList.add('hidden');
  document.getElementById('login-screen')?.classList.remove('hidden');
  document.getElementById('username')?.focus();
}

document.getElementById('login-btn')?.addEventListener('click', login);
document.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

function login() {
  const u = document.getElementById('username')?.value;
  const p = document.getElementById('password')?.value;
  const err = document.getElementById('login-error');

  if (u === VALID_CREDENTIALS.username && p === VALID_CREDENTIALS.password) {
    err.textContent = 'ДОСТУП РАЗРЕШЁН';
    err.style.color = '#00FF41';
    err.classList.remove('hidden');
    document.body.style.transition = 'opacity 0.8s ease-in-out';
    document.body.style.opacity = '0';
    setTimeout(() => window.location.href = 'terminal.html', 800);
  } else {
    err.textContent = 'ДОСТУП ЗАПРЕЩЁН';
    err.style.color = '#FF0000';
    err.classList.remove('hidden');
    document.getElementById('password').value = '';
    document.getElementById('username')?.focus();
  }
}

/* ----------------- CURVATURE OVERLAY (WebGL) -----------------
   Подход:
   1) Используем html2canvas, чтобы снимать визуал страницы в offscreen canvas.
   2) Создаём WebGL overlay canvas, запускаем shader barrel-warp как в терминале.
   3) WebGL семплит текстуру из snapshot-canvas и рисует искривлённый результат.
   4) Overlay имеет pointer-events: none, поэтому взаимодействие остаётся с DOM.
   5) Поддержка fallback: если html2canvas не загрузился — применим лёгкий CSS-эффект.
-----------------------------------------------------------------*/

function initCurvatureOverlay() {
  // конфиг
  const SNAP_FPS = 15; // сколько снимков в секунду (15 — безопасный баланс). Подними/понизь по необходимости.
  const DISTORTION = 0.32; // как в терминале, можно менять: 0..0.6
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  // контейнер, который мы хотим "изогнуть". Можно заменить на '#start-screen' или 'body' — я беру body
  const SNAP_TARGET = document.body;

  // 1) скрытый canvas для снимка (источник текстуры)
  const snapshotCanvas = document.createElement('canvas');
  snapshotCanvas.id = 'uiSnapshotCanvas';
  snapshotCanvas.style.display = 'none';
  document.body.appendChild(snapshotCanvas);
  const snapCtx = snapshotCanvas.getContext('2d', { alpha: true });

  // 2) overlay canvas (WebGL) — поверх всего, pointer-events none
  const overlay = document.createElement('canvas');
  overlay.id = 'uiWarpOverlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    zIndex: 9999, // поверх всего
    pointerEvents: 'none',
    display: 'block'
  });
  document.body.appendChild(overlay);

  // 3) try to create webgl context
  const gl = overlay.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) {
    console.warn('Curvature overlay: WebGL not available — applying CSS fallback');
    applyCssFallback();
    return;
  }

  // resize helper
  let vw = Math.max(320, window.innerWidth);
  let vh = Math.max(240, window.innerHeight);
  function resizeAll() {
    vw = Math.max(320, window.innerWidth);
    vh = Math.max(240, window.innerHeight);
    overlay.width = Math.floor(vw * DPR);
    overlay.height = Math.floor(vh * DPR);
    overlay.style.width = vw + 'px';
    overlay.style.height = vh + 'px';
    // match snapshot canvas size to viewport too (html2canvas will produce its own size but we copy into snapshot)
    snapshotCanvas.width = Math.floor(vw * DPR);
    snapshotCanvas.height = Math.floor(vh * DPR);
    snapCtx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener('resize', resizeAll);
  resizeAll();

  // 4) compile simple passthrough vertex + barrel distortion fragment (same idea as crt_overlay)
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
      vec2 d = mix(uv, uv * r, uDist);
      vec2 f = (d + 1.0) * 0.5;
      f.y = 1.0 - f.y;
      vec4 c = texture2D(uTex, clamp(f, 0.0, 1.0));
      gl_FragColor = c;
    }
  `;
  function compile(src, type){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('shader compile error', gl.getShaderInfoLog(s));
    }
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
  gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('program link error', gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);

  // quad
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
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uDist = gl.getUniformLocation(prog, 'uDist');
  gl.uniform1f(uDist, DISTORTION);

  function updateTextureFromSnapshot(sourceCanvas) {
    try {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // Note: use the source canvas directly (it must be same-origin). html2canvas produces a same-origin canvas.
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    } catch (e) {
      // could fail if canvas size 0 or context lost
    }
  }

  function renderGL() {
    gl.viewport(0,0,overlay.width, overlay.height);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // 5) html2canvas loader + snapshot loop
  let html2canvasLoaded = false;
  let html2canvasFn = null;
  function loadHtml2Canvas(cb) {
    if (window.html2canvas) { html2canvasLoaded = true; html2canvasFn = window.html2canvas; cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => {
      html2canvasLoaded = true;
      html2canvasFn = window.html2canvas || window.html2canvas;
      cb();
    };
    s.onerror = () => {
      console.warn('Curvature overlay: failed to load html2canvas. Falling back to CSS transform.');
      cb();
    };
    document.head.appendChild(s);
  }

  // snapshot and copy into snapshotCanvas
  async function takeSnapshotAndCopy() {
    if (!html2canvasLoaded || !html2canvasFn) return false;
    try {
      // request html2canvas to render the SNAP_TARGET
      const options = {
        backgroundColor: null,
        scale: DPR,
        logging: false,
        // allowTaint and useCORS help with remote images, but your assets should be same-origin
        useCORS: true
      };
      const rendered = await html2canvasFn(SNAP_TARGET, options);
      // rendered is a canvas; draw it into our snapshotCanvas (may be already DPR-scaled)
      // ensure sizes match
      snapshotCanvas.width = rendered.width;
      snapshotCanvas.height = rendered.height;
      // copy pixels
      snapCtx.setTransform(1,0,0,1,0,0); // drawImage uses CSS px if not scaled; we set raw pixel copy
      snapCtx.clearRect(0,0,snapshotCanvas.width, snapshotCanvas.height);
      snapCtx.drawImage(rendered, 0, 0);
      // now update GL texture
      updateTextureFromSnapshot(snapshotCanvas);
      return true;
    } catch (e) {
      console.warn('Curvature overlay: snapshot failed', e);
      return false;
    }
  }

  // main loop: take snapshots at SNAP_FPS and render GL overlay every frame (requestAnimationFrame)
  let lastSnap = 0;
  const snapInterval = 1000 / SNAP_FPS;
  let isRunning = true;

  async function mainLoop(ts) {
    if (!isRunning) return;
    // take snapshot at throttled rate
    if (!lastSnap || (ts - lastSnap) >= snapInterval) {
      lastSnap = ts;
      const ok = await takeSnapshotAndCopy();
      if (!ok) {
        // fallback: if snapshot fails first time, try to continue, but if html2canvas not loaded -> apply CSS fallback once
        if (!html2canvasLoaded) {
          applyCssFallback();
          return;
        }
      }
    }
    // render gl overlay
    renderGL();
    requestAnimationFrame(mainLoop);
  }

  // start: load html2canvas then start loop
  loadHtml2Canvas(() => {
    // do an initial snapshot attempt (non-blocking)
    takeSnapshotAndCopy().then(() => {
      requestAnimationFrame(mainLoop);
    }).catch(() => {
      if (!html2canvasLoaded) applyCssFallback();
      else requestAnimationFrame(mainLoop);
    });
  });

  // expose control for debugging in console
  window.__Curvature = {
    setDistortion(v){
      const nv = Number(v) || 0;
      gl.useProgram(prog);
      gl.uniform1f(uDist, nv);
    },
    stop(){
      isRunning = false;
      overlay.remove();
      snapshotCanvas.remove();
    }
  };

  // CSS fallback: if html2canvas / WebGL can't be used, do a cheap CSS transform on a wrapper
  // This is a last-resort visual; it DOES NOT equal shader warp, but keeps UX intact.
  function applyCssFallback() {
    overlay.remove();
    snapshotCanvas.remove();
    const wrapper = document.createElement('div');
    wrapper.id = 'curvatureFallbackWrapper';
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.zIndex = 9999;
    // use subtle CSS perspective + transform to simulate curvature
    wrapper.style.transformOrigin = '50% 50%';
    wrapper.style.transform = 'perspective(900px) rotateX(1.5deg) rotateY(0deg) scale(1)';
    wrapper.style.filter = 'contrast(1.02) saturate(1.02)';
    document.body.appendChild(wrapper);
    // put a translucent gradient to emulate barrel
    const g = document.createElement('div');
    g.style.position = 'absolute';
    g.style.left = '0';
    g.style.top = '0';
    g.style.right = '0';
    g.style.bottom = '0';
    g.style.background = 'radial-gradient(ellipse at center, rgba(255,255,255,0) 40%, rgba(0,0,0,0.25) 100%)';
    g.style.mixBlendMode = 'overlay';
    wrapper.appendChild(g);
    console.warn('Curvature overlay: html2canvas/WebGL unavailable — CSS fallback applied.');
  }
}
