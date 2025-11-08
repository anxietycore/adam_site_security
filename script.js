// script.js
// Главный скрипт страницы + WebGL фон с изгибом (identical CRT-style curvature to terminal)
// Заменяет старый script.js — сохраняет ваши кнопки/логин/boot логику и добавляет shader для изгиба.

// --- конфиги / переменные, доступные раньше, чем функции (fix for "before initialization") ---
let needsUniformsUpdate = true; // объявлено заранее чтобы initShaderBackground мог его читать
const VALID_CREDENTIALS = { username: "qq", password: "ww" };

(() => {
  // ----------------- UI logic (как в старом script.js) -----------------
  document.addEventListener('DOMContentLoaded', () => {
    let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
    localStorage.setItem('adam_visits', ++visits);

    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', startBootSequence);

    // init shader background (after DOM is ready)
    initShaderBackground();
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

  // ----------------- WebGL Shader Background with curvature -----------------
  // Goal: ровно такой же изгиб / дисторсия как в терминале (barrel warp), плавный шум,
  // без html2canvas, без перехвата DOM — фон рисуется отдельно

  function initShaderBackground() {
    const shaderCanvas = document.getElementById('shader-canvas');
    if (!shaderCanvas) {
      console.warn('shader-canvas not found — shader background disabled.');
      return;
    }

    // ensure proper style: behind glassFX and DOM
    Object.assign(shaderCanvas.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 0, // under glassFX (glassFX has zIndex:1 in your screenGlass.js)
      opacity: '1'
    });

    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    // WebGL setup
    const gl = (function initGL() {
      try {
        const g = shaderCanvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false }) ||
                  shaderCanvas.getContext('experimental-webgl');
        if (!g) throw new Error('WebGL not available');
        return g;
      } catch (e) {
        console.error('WebGL init failed:', e);
        return null;
      }
    })();

    if (!gl) return;

    // resize handler
    let canvasW = 0, canvasH = 0;
    function resize() {
      const w = Math.max(320, window.innerWidth);
      const h = Math.max(240, window.innerHeight);
      shaderCanvas.width = Math.floor(w * DPR);
      shaderCanvas.height = Math.floor(h * DPR);
      shaderCanvas.style.width = w + 'px';
      shaderCanvas.style.height = h + 'px';
      canvasW = shaderCanvas.width;
      canvasH = shaderCanvas.height;
      gl.viewport(0, 0, canvasW, canvasH);
      // flag to update uniform/resolution
      needsUniformsUpdate = true;
    }
    window.addEventListener('resize', debounce(resize, 80));
    resize();

    // compile shader helpers
    function compileShader(src, type) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    // vertex shader: draws full-screen quad
    const vsSrc = `
      attribute vec2 aPos;
      varying vec2 vUv;
      void main(){
        vUv = (aPos + 1.0) * 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;

    // fragment shader: procedural animated noise + barrel distortion (curvature)
    const fsSrc = `
      precision mediump float;
      varying vec2 vUv;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform float uDist; // distortion amount
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p){
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
      }
      float fbm(vec2 p){
        float v = 0.0;
        float a = 0.5;
        for(int i=0;i<5;i++){
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }
      void main(){
        vec2 uv = vUv * 2.0 - 1.0;
        float aspect = uResolution.x / uResolution.y;
        uv.x *= aspect;
        float r = length(uv);
        vec2 warped = mix(uv, uv * r, uDist);
        vec2 f = (warped / vec2(aspect,1.0) + 1.0) * 0.5;
        f = clamp(f, 0.0, 1.0);
        float t = uTime * 0.12;
        vec2 p = f * 6.0;
        float n = fbm(p + vec2(t, t * 0.4));
        float n2 = fbm(p * 1.7 - vec2(t*0.6, -t*0.3));
        float val = mix(n, n2, 0.5);
        float vig = smoothstep(1.0, 0.45, r);
        vec3 col = vec3(0.02, 0.04, 0.02) + vec3(0.0, 0.9, 0.12) * pow(val, 2.0) * 0.65;
        col *= 0.5 + 0.5 * vig;
        float glow = exp(-dot(f - 0.5, f - 0.5) * 8.0) * (0.2 + 0.8 * sin(uTime * 0.6) * 0.25);
        col += vec3(0.05, 0.04, 0.03) * glow;
        col = pow(col, vec3(0.9));
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const vs = compileShader(vsSrc, gl.VERTEX_SHADER);
    const fs = compileShader(fsSrc, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    // full-screen quad
    const quad = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // uniforms
    const uResolution = gl.getUniformLocation(prog, 'uResolution');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uDist = gl.getUniformLocation(prog, 'uDist');

    // default distortion — match terminal overlay typical value
    let DISTORTION = 0.32; // tweakable; 0 = none, 0.25..0.45 typical
    window.__ShaderBackground = { setDistortion(v) { DISTORTION = v; } };

    // animation loop
    let startTime = performance.now();

    function renderFrame(now) {
      const t = (now - startTime) / 1000;
      if (needsUniformsUpdate) {
        gl.uniform2f(uResolution, canvasW || shaderCanvas.width, canvasH || shaderCanvas.height);
        needsUniformsUpdate = false;
      }
      gl.uniform1f(uTime, t);
      gl.uniform1f(uDist, DISTORTION);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(renderFrame);
    }
    requestAnimationFrame(renderFrame);
  }

  // ----------------- small util -----------------
  function debounce(fn, ms) {
    let t = null;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(()=> fn.apply(this, args), ms);
    };
  }

})(); 
