// script_curved.js
// Curved / warped main-screen script (replacement for script.js)
// - Draws Start/Boot/Login screens into a canvas 'interfaceCanvas'
// - Applies WebGL barrel-curvature overlay sampling that canvas
// - Keeps DOM inputs interactive but visually hidden (so keyboard works naturally)
// - Behaviors match original script.js (boot sequence, login, redirect)
// Usage: replace old script.js with this file in index.html

(() => {
  // ---------- CONFIG ----------
  const FONT_FAMILY = "'Press Start 2P', monospace, monospace";
  const BG_COLOR = '#000';
  const TEXT_COLOR = '#00FF41';
  const ERROR_COLOR = '#FF4444';
  const SUCCESS_COLOR = '#00FF41';
  const BOOT_LINE_DELAY = 1000; // ms between boot lines
  const CANVAS_DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.32; // barrel distortion amount; tweak for more/less bend
  const OVERLAY_FPS = 30;
  const CANVAS_Z = 900; // over everything
  const INTERFACE_PADDING = 28;
  let _needsRender = true;

  // ---------- helpers ----------
  function q(id){ return document.getElementById(id); }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  // ---------- find existing DOM elements ----------
  const startScreen = q('start-screen');
  const bootScreen = q('boot-screen');
  const loginScreen = q('login-screen');
  const usernameInput = q('username');
  const passwordInput = q('password');
  const startBtn = q('start-btn');
  const loginBtn = q('login-btn');
  const bootTextNodeList = document.querySelectorAll('#boot-screen .boot-text p');

  // If any of required DOM is missing, we still proceed but log warnings.
  if (!startScreen || !bootScreen || !loginScreen) {
    console.warn('script_curved: one or more screens not found — falling back to minimal behavior.');
  }

  // Keep original inputs interactive but hide them visually (so native focus/IME works).
  if (usernameInput) { usernameInput.style.opacity = '0'; usernameInput.style.pointerEvents = 'auto'; }
  if (passwordInput) { passwordInput.style.opacity = '0'; passwordInput.style.pointerEvents = 'auto'; }
  if (startBtn) { startBtn.style.opacity = '0'; startBtn.style.pointerEvents = 'auto'; }
  if (loginBtn) { loginBtn.style.opacity = '0'; loginBtn.style.pointerEvents = 'auto'; }

  // ---------- create interface canvas ----------
  const interfaceCanvas = document.createElement('canvas');
  interfaceCanvas.id = 'interfaceCanvas';
  Object.assign(interfaceCanvas.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    zIndex: CANVAS_Z,
    pointerEvents: 'none',
    // we draw our own visuals; interactions still go to hidden DOM inputs
  });
  document.body.appendChild(interfaceCanvas);
  const ictx = interfaceCanvas.getContext('2d', { alpha: false });

  // ---------- sizing ----------
  let vw = Math.max(320, window.innerWidth);
  let vh = Math.max(240, window.innerHeight);
  function resizeCanvas() {
    vw = Math.max(320, window.innerWidth);
    vh = Math.max(240, window.innerHeight);
    interfaceCanvas.width = Math.floor(vw * CANVAS_DPR);
    interfaceCanvas.height = Math.floor(vh * CANVAS_DPR);
    interfaceCanvas.style.width = vw + 'px';
    interfaceCanvas.style.height = vh + 'px';
    ictx.setTransform(CANVAS_DPR,0,0,CANVAS_DPR,0,0);
    requestRender();
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ---------- state (for screens) ----------
  let currentScreen = 'start'; // 'start'|'boot'|'login'
  let bootLineIndex = 0;
  let bootAnimating = false;
  function requestRender(){ _needsRender = true; }
  function clearRenderFlag(){ _needsRender = false; }

  // ---------- draw primitives ----------
  function clearInterface() {
    ictx.save();
    ictx.setTransform(CANVAS_DPR,0,0,CANVAS_DPR,0,0);
    ictx.fillStyle = BG_COLOR;
    ictx.fillRect(0,0,vw, vh);
    ictx.restore();
  }

  function drawLogo(x,y,scale=1) {
    // draws the ASCII block logo used in index.html (scaled)
    // We'll render using monospace and maintain proportions
    const lines = [
      "\\    _ \\    \\     \\  | ",
      "   _ \\   |  |  _ \\   |\\/ | ",
      " _/  _\\ ___/ _/  _\\ _|  _| "
    ];
    const fontSize = 12 * scale;
    ictx.save();
    ictx.font = `${fontSize}px ${FONT_FAMILY}`;
    ictx.fillStyle = TEXT_COLOR;
    ictx.textBaseline = 'top';
    for (let i=0;i<lines.length;i++){
      ictx.fillText(lines[i], x, y + i * (fontSize + 2));
    }
    ictx.restore();
  }

  function drawButtonRect(x,y,w,h,text,opts={bg:'#111',border:'#00FF41',textColor:TEXT_COLOR}) {
    ictx.save();
    ictx.globalAlpha = 1;
    ictx.fillStyle = opts.bg;
    roundRect(ictx, x, y, w, h, 6);
    ictx.fill();
    ictx.lineWidth = 2;
    ictx.strokeStyle = opts.border;
    roundRect(ictx, x, y, w, h, 6);
    ictx.stroke();
    ictx.font = `12px ${FONT_FAMILY}`;
    ictx.fillStyle = opts.textColor;
    ictx.textBaseline = 'middle';
    ictx.textAlign = 'center';
    ictx.fillText(text, x + w/2, y + h/2);
    ictx.restore();
  }

  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function drawStartScreen(){
    clearInterface();
    const pad = INTERFACE_PADDING;
    // Logo top-left
    drawLogo(pad, pad, 1.25);
    // Message center-left
    ictx.save();
    ictx.font = `14px ${FONT_FAMILY}`;
    ictx.fillStyle = TEXT_COLOR;
    ictx.textBaseline = 'top';
    const msg = '> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ';
    ictx.fillText(msg, pad, pad + 80);
    ictx.restore();

    // big start button centered
    const bw = 220, bh = 44;
    const bx = (vw - bw) / 2;
    const by = vh - 140;
    drawButtonRect(bx, by, bw, bh, '> ЗАПУСТИТЬ СИСТЕМУ', {bg:'#050505', border:'#00FF41', textColor:TEXT_COLOR});
  }

  function drawBootScreen(){
    clearInterface();
    const pad = INTERFACE_PADDING;
    drawLogo(pad, pad, 1);
    ictx.save();
    ictx.font = `14px ${FONT_FAMILY}`;
    ictx.fillStyle = TEXT_COLOR;
    ictx.textBaseline = 'top';
    const instructions = [
      '> ИНИЦИАЛИЗАЦИЯ ПРОТОКОЛА БЕЗОПАСНОСТИ A.D.A.M...',
      '> ЗАГРУЗКА ПОДСИСТЕМЫ VIGIL-9...',
      '> ТЕСТ ПАМЯТИ: УСПЕШНО',
      '> КРИПТОМОДУЛЬ: АКТИВИРОВАН',
      '> ПРЕДУПРЕЖДЕНИЕ: НЕСАНКЦИОНИРОВАННЫЙ ДОСТУП ЗАПРЕЩЁН',
      '> СИСТЕМА ГОТОВА'
    ];
    // draw up to bootLineIndex (animated)
    for (let i=0;i<bootLineIndex && i<instructions.length;i++){
      ictx.fillText(instructions[i], pad, pad + 70 + i * 22);
    }
    ictx.restore();
  }

  function drawLoginScreen() {
    clearInterface();
    const pad = INTERFACE_PADDING;
    drawLogo(pad, pad, 1);
    ictx.save();
    ictx.font = `14px ${FONT_FAMILY}`;
    ictx.fillStyle = TEXT_COLOR;
    ictx.textBaseline = 'top';
    ictx.fillText('> ДОСТУП К ТЕРМИНАЛУ', pad, pad + 70);

    // Draw username field representation
    const fieldW = 360, fieldH = 36;
    const fx = (vw - fieldW) / 2;
    const usernameY = vh/2 - 36;
    const passwordY = vh/2 + 8;

    // Username label
    ictx.font = `10px ${FONT_FAMILY}`;
    ictx.fillStyle = '#999';
    ictx.fillText('ИМЯ ПОЛЬЗОВАТЕЛЯ:', fx, usernameY - 18);

    // username box
    ictx.globalAlpha = 1;
    ictx.fillStyle = '#070707';
    roundRect(ictx, fx, usernameY, fieldW, fieldH, 4);
    ictx.fill();
    ictx.lineWidth = 2;
    ictx.strokeStyle = '#00FF41';
    ictx.stroke();

    // show typed username from hidden input if present
    const uval = (usernameInput && usernameInput.value) ? usernameInput.value : '';
    ictx.font = `12px ${FONT_FAMILY}`;
    ictx.fillStyle = TEXT_COLOR;
    ictx.textBaseline = 'middle';
    ictx.fillText(uval || '', fx + 10, usernameY + fieldH/2);

    // password label
    ictx.font = `10px ${FONT_FAMILY}`;
    ictx.fillStyle = '#999';
    ictx.fillText('ПАРОЛЬ:', fx, passwordY - 18);

    // password box
    ictx.fillStyle = '#070707';
    roundRect(ictx, fx, passwordY, fieldW, fieldH, 4);
    ictx.fill();
    ictx.lineWidth = 2;
    ictx.strokeStyle = '#00FF41';
    ictx.stroke();

    // show masked password
    const pval = (passwordInput && passwordInput.value) ? '*'.repeat(passwordInput.value.length) : '';
    ictx.font = `12px ${FONT_FAMILY}`;
    ictx.fillStyle = TEXT_COLOR;
    ictx.fillText(pval || '', fx + 10, passwordY + fieldH/2);

    // login button
    drawButtonRect(fx + fieldW + 14, passwordY, 120, fieldH, 'АУТЕНТИФИКАЦИЯ', {bg:'#050505', border:'#00FF41', textColor:TEXT_COLOR});

    ictx.restore();
  }

  // ---------- boot animation control ----------
  function startBootSequenceCurved() {
    currentScreen = 'boot';
    bootAnimating = true;
    bootLineIndex = 0;
    // ensure DOM classes as original script did
    if (startScreen) startScreen.classList.add('hidden');
    if (bootScreen) bootScreen.classList.remove('hidden');
    // start stepping
    const linesTotal = bootTextNodeList && bootTextNodeList.length ? bootTextNodeList.length : 6;
    (function step() {
      bootLineIndex++;
      requestRender();
      if (bootLineIndex < linesTotal) {
        setTimeout(step, BOOT_LINE_DELAY);
      } else {
        bootAnimating = false;
        setTimeout(showLoginScreenCurved, 800);
      }
    })();
  }

  function showLoginScreenCurved() {
    currentScreen = 'login';
    if (bootScreen) bootScreen.classList.add('hidden');
    if (loginScreen) loginScreen.classList.remove('hidden');
    // focus real input so keyboard works
    usernameInput && usernameInput.focus();
    requestRender();
  }

  // ---------- login logic (mirrors original) ----------
  const VALID_CREDENTIALS = { username: "qq", password: "ww" };
  function attemptLogin() {
    const u = usernameInput ? usernameInput.value : '';
    const p = passwordInput ? passwordInput.value : '';
    const loginError = q('login-error');
    if (u === VALID_CREDENTIALS.username && p === VALID_CREDENTIALS.password) {
      if (loginError) {
        loginError.textContent = 'ДОСТУП РАЗРЕШЁН';
        loginError.style.color = SUCCESS_COLOR;
        loginError.classList.remove('hidden');
      }
      // fade out body like original
      document.body.style.transition = 'opacity 0.8s ease-in-out';
      document.body.style.opacity = '0';
      setTimeout(() => {
        try { window.location.href = 'terminal.html'; } catch(e){ console.warn(e); }
      }, 800);
    } else {
      if (loginError) {
        loginError.textContent = 'ДОСТУП ЗАПРЕЩЁН';
        loginError.style.color = ERROR_COLOR;
        loginError.classList.remove('hidden');
      }
      if (passwordInput) passwordInput.value = '';
      if (usernameInput) usernameInput.focus();
      requestRender();
    }
  }

  // ---------- hook up original DOM events to our curved UI ----------
  if (startBtn) startBtn.addEventListener('click', startBootSequenceCurved);
  // keyboard press Enter should trigger login if on login screen
  document.addEventListener('keydown', (e) => {
    // don't hijack if focus in other inputs intentionally
    if (currentScreen === 'start') {
      if (e.key === 'Enter') {
        // simulate start button
        e.preventDefault();
        startBootSequenceCurved();
      }
    } else if (currentScreen === 'login') {
      if (e.key === 'Enter') {
        e.preventDefault();
        attemptLogin();
      }
    }
  });
  if (loginBtn) loginBtn.addEventListener('click', attemptLogin);

  // Also keep direct click on canvas mapped to underlying buttons:
  // (since original DOM buttons are opacity:0 but pointerEvents:auto, clicks fall through;
  //  still implement a fallback so clicking on visual button triggers start/login)
  interfaceCanvas.addEventListener('click', (e) => {
    const rect = interfaceCanvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left);
    const cy = (e.clientY - rect.top);
    // map to Start button position
    if (currentScreen === 'start') {
      const bw = 220, bh = 44;
      const bx = (vw - bw) / 2;
      const by = vh - 140;
      if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh) {
        // trigger original start btn if exists
        if (startBtn) startBtn.click();
        else startBootSequenceCurved();
      }
    } else if (currentScreen === 'login') {
      // login button area (drawn near password field)
      const fieldW = 360, fieldH = 36;
      const fx = (vw - fieldW) / 2;
      const passwordY = vh/2 + 8;
      const lbx = fx + fieldW + 14;
      const lby = passwordY;
      const lbw = 120, lbh = fieldH;
      if (cx >= lbx && cx <= lbx + lbw && cy >= lby && cy <= lby + lbh) {
        if (loginBtn) loginBtn.click();
        else attemptLogin();
      }
    }
  });

  // ---------- render loop for interface canvas ----------
  function renderInterface() {
    if (!_needsRender) return;
    clearRenderFlag();
    if (currentScreen === 'start') drawStartScreen();
    else if (currentScreen === 'boot') drawBootScreen();
    else if (currentScreen === 'login') drawLoginScreen();
    else clearInterface();
  }

  // ---------- WebGL overlay (barrel distortion) ----------
  // We'll create a full-screen overlay canvas that samples interfaceCanvas and warps it.
  const overlay = document.createElement('canvas');
  overlay.id = 'interfaceOverlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    zIndex: CANVAS_Z + 1,
    pointerEvents: 'none'
  });
  document.body.appendChild(overlay);

  const gl = overlay.getContext('webgl', { antialias: false });
  if (!gl) {
    console.error('script_curved: WebGL not available; falling back to direct canvas (no curvature).');
    // If no WebGL, just show interfaceCanvas above everything and hide overlay.
    overlay.remove();
    interfaceCanvas.style.zIndex = CANVAS_Z + 1;
    // schedule render loop
    requestAnimationFrame(tick);
  } else {
    // resize overlay
    function resizeOverlay() {
      overlay.width = Math.floor(window.innerWidth * CANVAS_DPR);
      overlay.height = Math.floor(window.innerHeight * CANVAS_DPR);
      overlay.style.width = window.innerWidth + 'px';
      overlay.style.height = window.innerHeight + 'px';
      gl.viewport(0,0,overlay.width, overlay.height);
    }
    window.addEventListener('resize', resizeOverlay);
    resizeOverlay();

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
    function compileShader(src, type) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('shader compile error', gl.getShaderInfoLog(s));
      }
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(vs, gl.VERTEX_SHADER));
    gl.attachShader(prog, compileShader(fs, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('shader link error', gl.getProgramInfoLog(prog));
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
    const aUV = gl.getAttribLocation(prog, 'aUV');
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);

    // texture from interfaceCanvas
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const uDistLoc = gl.getUniformLocation(prog, 'uDist');
    gl.uniform1f(uDistLoc, DISTORTION);

    function updateTextureFromInterface() {
      try {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, interfaceCanvas);
      } catch (e) {
        // fail silently (cross-origin or other)
      }
    }

    // overlay draw
    function drawOverlay() {
      updateTextureFromInterface();
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // run overlay at fixed FPS to avoid overtaxing
    let lastOverlayTick = 0;
    const overlayFrameMs = 1000 / OVERLAY_FPS;
    function overlayTick(ts) {
      if (!lastOverlayTick) lastOverlayTick = ts;
      const dt = ts - lastOverlayTick;
      if (dt >= overlayFrameMs) {
        lastOverlayTick = ts;
        drawOverlay();
      }
      requestAnimationFrame(overlayTick);
    }
    requestAnimationFrame(overlayTick);
  }

  // ---------- main tick: keep canvas updated when needed ----------
  let rafId = null;
  function tick(ts) {
    renderInterface();
    rafId = requestAnimationFrame(tick);
  }
  // start tick to ensure interface canvas is always up-to-date with DOM changes/inputs
  rafId = requestAnimationFrame(tick);

  // ---------- initial states mirror original script.js ----------
  // visits count as original
  try {
    let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
    localStorage.setItem('adam_visits', ++visits);
  } catch(e){}

  // show start by default, hide others visually to avoid double visuals (but keep them in DOM)
  if (startScreen) startScreen.classList.remove('hidden');
  if (bootScreen) bootScreen.classList.add('hidden');
  if (loginScreen) loginScreen.classList.add('hidden');
  currentScreen = 'start';
  requestRender();

  // ---------- small API (for debugging) ----------
  window.__ScriptCurved = {
    startBoot: startBootSequenceCurved,
    showLogin: showLoginScreenCurved,
    attemptLogin,
    requestRender,
    setDistortion(v){ 
      const nv = Number(v);
      if (!isNaN(nv)) {
        try { 
          const loc = window.__ScriptCurved._uDistLoc;
          // if we had exposed location, set uniform; else we can store for next overlay render
        } catch(e){}
      }
    }
  };

  // ---------- expose readiness ----------
  console.info('script_curved: interface canvas + curvature overlay initialized.');

})();
