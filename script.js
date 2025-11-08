// script.js
// Замена: WebGL фон с изгибом (усиленный, диагностический), + сохранение логики старого script.js
// Заменяй полностью этим файлом. После замены — Ctrl+F5. Если изгиба нет — смотри консоль.

const VALID_CREDENTIALS = { username: "qq", password: "ww" };
let needsUniformsUpdate = true;

(() => {
  // ---------- UI (boot / login) ----------
  document.addEventListener('DOMContentLoaded', () => {
    try {
      let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
      localStorage.setItem('adam_visits', ++visits);
    } catch (e) { console.warn('visits localStorage err', e); }

    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', startBootSequence);

    // init shader background AFTER DOM ready
    try { initShaderBackground(); } catch (e) { console.error('initShaderBackground error', e); }
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

  // ---------- Shader background with barrel warp ----------
  function initShaderBackground() {
    const shaderCanvas = document.getElementById('shader-canvas');
    if (!shaderCanvas) {
      console.warn('shader-canvas missing — create <canvas id="shader-canvas"></canvas> in HTML');
      return;
    }

    // ensure canvas is visible behind content (but above page background)
    Object.assign(shaderCanvas.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '0', // we want it behind glassFX (1) and DOM (default >0)
      opacity: '1'
    });

    // ensure body background is transparent so shader is visible
    try {
      const body = document.body;
      if (body) {
        const bg = window.getComputedStyle(body).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          // do not violently overwrite if user intentionally set bg — but make visible
          body.style.background = 'transparent';
          console.info('script.js: body background forced to transparent for shader visibility');
        }
      }
    } catch (e) { /* ignore */ }

    // ensure glassFX exists and is over shader
    const glassFX = document.getElementById('glassFX');
    if (glassFX) {
      glassFX.style.pointerEvents = 'none';
      // put glassFX above shaderCanvas
      try { glassFX.style.zIndex = String(1); } catch(e) {}
    } else {
      console.warn('screenGlass (glassFX) not found — noise layer absent.');
    }

    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    // init WebGL
    const gl = (function() {
      try {
        const g = shaderCanvas.getContext('webgl', { antialias: false }) || shaderCanvas.getContext('experimental-webgl');
        if (!g) throw new Error('WebGL not available');
        return g;
      } catch (e) {
        console.error('WebGL init failed:', e);
        return null;
      }
    })();

    if (!gl) return;

    // resize
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
      needsUniformsUpdate = true;
    }
    window.addEventListener('resize', debounce(resize, 70));
    resize();

    // compile helpers
    function compile(src, type) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    // VS / FS
    const vsSrc = `
      attribute vec2 aPos;
      varying vec2 vUv;
      void main(){ vUv = (aPos + 1.0) * 0.5; gl_Position = vec4(aPos,0.0,1.0); }
    `;

    // Fragment: procedural noise + barrel warp
    const fsSrc = `
      precision mediump float;
      varying vec2 vUv;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform float uDist;
      // hash / noise (cheap)
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i+vec2(1.0,0.0));
        float c = hash(i+vec2(0.0,1.0));
        float d = hash(i+vec2(1.0,1.0));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
      }
      float fbm(vec2 p){
        float v=0.0; float a=0.5;
        for(int i=0;i<5;i++){ v += a*noise(p); p*=2.0; a*=0.5; }
        return v;
      }
      void main(){
        vec2 uv = vUv * 2.0 - 1.0;
        float aspect = uResolution.x / uResolution.y;
        // correct aspect without introducing runaway zoom: scale x by 1/aspect then multiply back after warp
        uv.x *= 1.0 / aspect;
        float r = length(uv);
        vec2 warped = mix(uv, uv * r, uDist);
        // revert aspect correction
        warped.x *= aspect;
        vec2 f = (warped + 1.0) * 0.5;
        f = clamp(f, 0.0, 1.0);

        float t = uTime * 0.12;
        vec2 p = f * 5.0;
        float n1 = fbm(p + vec2(t, t*0.4));
        float n2 = fbm(p * 1.7 - vec2(t*0.6, -t*0.3));
        float val = mix(n1, n2, 0.5);

        float vig = smoothstep(1.0, 0.45, r);
        vec3 base = vec3(0.02,0.04,0.02);
        vec3 accent = vec3(0.0,0.9,0.12) * pow(val, 2.0) * 0.7;
        vec3 col = base + accent;
        col *= 0.5 + 0.5 * vig;
        float glow = exp(-dot(f-0.5,f-0.5)*8.0) * (0.18 + 0.5 * sin(uTime*0.6) * 0.25);
        col += vec3(0.05,0.04,0.03) * glow;
        col = pow(col, vec3(0.95));
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const vs = compile(vsSrc, gl.VERTEX_SHADER);
    const fs = compile(fsSrc, gl.FRAGMENT_SHADER);
    if (!vs || !fs) { console.error('Shader compile failed, curvature disabled'); return; }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    // quad
    const quad = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
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

    // default distortion (stronger so видно сразу)
    let DISTORTION = 0.38;
    window.__ShaderBackground = {
      setDistortion(v){ DISTORTION = v; console.info('Shader distortion set to', v); },
      getDistortion(){ return DISTORTION; }
    };

    let startTime = performance.now();

    function render(now) {
      const t = (now - startTime) / 1000.0;
      if (needsUniformsUpdate) {
        try { gl.uniform2f(uResolution, canvasW || shaderCanvas.width, canvasH || shaderCanvas.height); } catch(e) {}
        needsUniformsUpdate = false;
      }
      try {
        gl.uniform1f(uTime, t);
        gl.uniform1f(uDist, DISTORTION);
        gl.clearColor(0,0,0,1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } catch (e) {
        console.error('GL draw error:', e);
      }
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    console.info('Shader background initialized — distortion default', DISTORTION);
  }

  // ---------- helpers ----------
  function debounce(fn, ms) {
    let t = null;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

})(); // IIFE end

// Quick debug helpers — можно вызвать в консоли:
window.__debugShader = {
  set(v){ if (window.__ShaderBackground && typeof window.__ShaderBackground.setDistortion === 'function') window.__ShaderBackground.setDistortion(v); else console.warn('Shader not ready'); },
  info(){ console.log('has shader?', !!window.__ShaderBackground, 'dist:', window.__ShaderBackground ? window.__ShaderBackground.getDistortion() : 'n/a'); }
};
