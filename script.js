// script.js
// Full UI renderer for index.html — draws Start / Boot / Login screens into a curved canvas (uiCanvas).
// - Uses shader-canvas (background) and glassFX (noise) if present
// - Leaves DOM interactive but visually hidden (opacity:0, pointer-events:auto)
// - Boot sequence, login logic preserved
// - Exposes window.__UICanvas for overlay/curvature scripts to pick up
// Drop-in replacement for your previous script.js

(() => {
  // ---------- CONFIG ----------
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 14;
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.35);
  const PADDING = 28;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const UI_CANVAS_Z = 200; // sits above shader but below possible global overlay
  const TYPING_SPEED = 22; // ms per char for boot text

  // ---------- DOM refs (originals will be kept interactive but hidden visually) ----------
  const dom = {
    startScreen: document.getElementById('start-screen'),
    bootScreen: document.getElementById('boot-screen'),
    loginScreen: document.getElementById('login-screen'),
    startBtn: document.getElementById('start-btn'),
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    loginBtn: document.getElementById('login-btn'),
    loginError: document.getElementById('login-error'),
    shaderCanvas: document.getElementById('shader-canvas'),
    glassFX: document.getElementById('glassFX')
  };

  // ---------- create main UI canvas ----------
  const uiCanvas = document.createElement('canvas');
  uiCanvas.id = 'uiCanvas';
  Object.assign(uiCanvas.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    zIndex: UI_CANVAS_Z,
    pointerEvents: 'none', // allow underlying (hidden) DOM to receive events
    display: 'block'
  });
  document.body.appendChild(uiCanvas);
  const ctx = uiCanvas.getContext('2d', { alpha: false });

  // expose for overlays / debugging
  window.__UICanvas = uiCanvas;

  // ---------- ensure original DOM is interactive but invisible ----------
  function hideOriginalsButKeepInteractive() {
    Object.values(dom).forEach(el => {
      if (!el || !(el instanceof HTMLElement)) return;
      // don't hide shader and glassFX canvases (we sample them)
      if (el.id === 'shader-canvas' || el.id === 'glassFX') return;
      try {
        el.style.opacity = '0';
        // keep pointer events so original handlers (buttons/inputs) still work
        el.style.pointerEvents = 'auto';
        // keep layout so clicks fall in correct place
      } catch (e) {}
    });
    // For safety: ensure login inputs are focusable while hidden (so keyboard login works)
    if (dom.username) dom.username.tabIndex = 0;
    if (dom.password) dom.password.tabIndex = 0;
  }
  hideOriginalsButKeepInteractive();

  // ---------- sizing ----------
  let vw = 0, vh = 0;
  function resize() {
    vw = Math.max(320, window.innerWidth);
    vh = Math.max(240, window.innerHeight);
    uiCanvas.width = Math.floor(vw * DPR);
    uiCanvas.height = Math.floor(vh * DPR);
    uiCanvas.style.width = vw + 'px';
    uiCanvas.style.height = vh + 'px';
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    requestRender();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- render scheduling ----------
  let _needsRender = false;
  function requestRender(){
    if (!_needsRender){
      _needsRender = true;
      requestAnimationFrame(() => { _needsRender = false; render(); });
    }
  }

  // ---------- State ----------
  const State = {
    screen: 'start', // 'start' | 'boot' | 'login'
    bootTextIndex: 0,
    bootLines: [],
    bootAnimIndex: 0,
    bootVisibleLines: [],
    bootTicking: false,
    bootTimestamps: [],
    bootCompleted: false,
    loginMessageOpacity: 0,
    lastTick: performance.now()
  };

  // Boot text defaults (copied from your index.html boot-text)
  State.bootLines = [
    '> ИНИЦИАЛИЗАЦИЯ ПРОТОКОЛА БЕЗОПАСНОСТИ A.D.A.M...',
    '> ЗАГРУЗКА ПОДСИСТЕМЫ VIGIL-9...',
    '> ТЕСТ ПАМЯТИ: УСПЕШНО',
    '> КРИПТОМОДУЛЬ: АКТИВИРОВАН',
    '> ПРЕДУПРЕЖДЕНИЕ: НЕСАНКЦИОНИРОВАННЫЙ ДОСТУП ЗАПРЕЩЁН',
    '> СИСТЕМА ГОТОВА'
  ];

  // ---------- Helpers for drawing ----------
  function clearUI(){
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,vw,vh);
    ctx.restore();
  }

  function drawBackground(){
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    // shader-canvas drawn full-screen behind UI if present
    if (dom.shaderCanvas && dom.shaderCanvas.width > 0) {
      try { ctx.drawImage(dom.shaderCanvas, 0, 0, vw, vh); } catch(e) {}
    } else {
      // fallback gradient if shader not present
      const g = ctx.createLinearGradient(0,0,0,vh);
      g.addColorStop(0, '#001010');
      g.addColorStop(1, '#000');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,vw,vh);
    }

    // glassFX noise layer — under UI but above shader, subtle
    if (dom.glassFX && dom.glassFX.width > 0) {
      try {
        ctx.globalAlpha = 0.12;
        ctx.drawImage(dom.glassFX, 0, 0, vw, vh);
        ctx.globalAlpha = 1.0;
      } catch(e){}
    }
    ctx.restore();
  }

  function drawCenteredAsciiLogo(y){
    const pre = [
      " \\    _ \\    \\     \\  | ",
      "  _ \\   |  |  _ \\   |\\/ | ",
      " _/  _\\ ___/ _/  _\\ _|  _| "
    ];
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    ctx.fillStyle = '#00FF41';
    ctx.font = `12px ${FONT_FAMILY}`;
    const centerX = vw/2;
    for (let i=0;i<pre.length;i++){
      const text = pre[i];
      const w = ctx.measureText(text).width;
      ctx.fillText(text, centerX - w/2, y + i * (LINE_HEIGHT - 6));
    }
    ctx.restore();
  }

  function drawStartScreen(){
    // visual layout: centered box with ascii + button-like rect + subtitle text
    const boxW = Math.min(760, Math.floor(vw * 0.7));
    const boxH = 220;
    const x = (vw - boxW)/2;
    const y = (vh - boxH)/2 - 40;
    // panel bg
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);

    // panel bg
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, x, y, boxW, boxH, 8);
    ctx.fill();

    // border
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00FF41';
    roundRect(ctx, x, y, boxW, boxH, 8);
    ctx.stroke();

    // ascii
    drawCenteredAsciiLogo(y + 12);

    // title text
    ctx.fillStyle = '#00FF41';
    ctx.font = `14px ${FONT_FAMILY}`;
    const title = '> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ';
    const tw = ctx.measureText(title).width;
    ctx.fillText(title, (vw - tw)/2, y + 100);

    // button look (we will not intercept clicks — underlying DOM button handles that)
    const btnW = 220, btnH = 36;
    const btnX = (vw - btnW)/2;
    const btnY = y + 130;
    // base
    ctx.fillStyle = '#111';
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fill();
    // border
    ctx.strokeStyle = '#00FF41';
    ctx.lineWidth = 1.5;
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.stroke();
    // label
    ctx.fillStyle = '#00FF41';
    ctx.font = `13px ${FONT_FAMILY}`;
    const label = 'ЗАПУСТИТЬ СИСТЕМУ';
    const lw = ctx.measureText(label).width;
    ctx.fillText(label, btnX + (btnW - lw)/2, btnY + (btnH - 12)/2);

    ctx.restore();
  }

  function drawBootScreen(){
    // layout similar to original: center-left box with boot lines appearing
    const boxW = Math.min(820, Math.floor(vw * 0.78));
    const boxH = Math.min(420, Math.floor(vh * 0.6));
    const x = (vw - boxW)/2;
    const y = (vh - boxH)/2 - 20;

    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);

    // panel
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect(ctx, x, y, boxW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = '#00FF41';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, boxW, boxH, 8);
    ctx.stroke();

    // ascii top-left of panel
    ctx.fillStyle = '#00FF41';
    ctx.font = `12px ${FONT_FAMILY}`;
    const logoY = y + 12;
    drawCenteredAsciiLogo(logoY);

    // boot text area
    ctx.fillStyle = '#00FF41';
    ctx.font = `13px ${FONT_FAMILY}`;
    const textX = x + 18;
    let lineY = y + 110;
    const visibleCount = Math.floor((boxH - 120) / LINE_HEIGHT);
    const toShow = State.bootVisibleLines.slice(-visibleCount);
    for (let i = 0; i < toShow.length; i++){
      ctx.fillStyle = '#00FF41';
      ctx.fillText(toShow[i], textX, lineY + i * LINE_HEIGHT);
    }

    ctx.restore();
  }

  function drawLoginScreen(){
    // center small form
    const boxW = Math.min(560, Math.floor(vw * 0.54));
    const boxH = 260;
    const x = (vw - boxW)/2;
    const y = (vh - boxH)/2;

    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);

    // panel
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    roundRect(ctx, x, y, boxW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = '#00FF41';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, boxW, boxH, 8);
    ctx.stroke();

    // title
    ctx.fillStyle = '#00FF41';
    ctx.font = `14px ${FONT_FAMILY}`;
    const title = 'ДОСТУП К ТЕРМИНАЛУ';
    const tw = ctx.measureText(title).width;
    ctx.fillText(title, x + (boxW - tw)/2, y + 14);

    // labels + values (read from DOM inputs so visual reflects actual input values)
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFF00';
    ctx.fillText('ИМЯ ПОЛЬЗОВАТЕЛЯ:', x + 20, y + 54);
    ctx.fillStyle = '#CCCCCC';
    const uname = (dom.username && dom.username.value) ? dom.username.value : '';
    ctx.fillText(uname || ' ', x + 200, y + 54);

    ctx.fillStyle = '#FFFF00';
    ctx.fillText('ПАРОЛЬ:', x + 20, y + 84);
    ctx.fillStyle = '#CCCCCC';
    const pwdMask = (dom.password && dom.password.value) ? '•'.repeat(dom.password.value.length) : '';
    ctx.fillText(pwdMask || ' ', x + 200, y + 84);

    // "button" area visual
    const btnW = 180, btnH = 34;
    const btnX = x + (boxW - btnW)/2;
    const btnY = y + boxH - 56;
    ctx.fillStyle = '#111';
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fill();
    ctx.strokeStyle = '#00FF41';
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.stroke();
    ctx.fillStyle = '#00FF41';
    ctx.font = `13px ${FONT_FAMILY}`;
    const label = 'АУТЕНТИФИКАЦИЯ';
    const lw = ctx.measureText(label).width;
    ctx.fillText(label, btnX + (btnW - lw)/2, btnY + (btnH - 12)/2);

    // error message if exists (read from DOM node)
    if (dom.loginError && !dom.loginError.classList.contains('hidden')) {
      ctx.fillStyle = dom.loginError.style.color || '#FF0000';
      ctx.font = `12px ${FONT_FAMILY}`;
      const errText = dom.loginError.textContent || 'ДОСТУП ЗАПРЕЩЁН';
      ctx.fillText(errText, x + 18, y + boxH - 84);
    }

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- main render ----------
  function render(){
    clearUI();
    drawBackground();

    if (State.screen === 'start') {
      drawStartScreen();
    } else if (State.screen === 'boot') {
      drawBootScreen();
    } else if (State.screen === 'login') {
      drawLoginScreen();
    }

    // request curvature overlay refresh if available (some overlays sample uiCanvas)
    if (window.__CRTOverlay && typeof window.__CRTOverlay.update === 'function') {
      try { window.__CRTOverlay.update(); } catch(e) {}
    }
  }

  // ---------- Boot sequence logic (animated text reveal) ----------
  let _bootTimer = null;
  function startBootSequence() {
    if (State.screen !== 'start') return;
    // reveal DOM boot screen (hidden but interactive)
    if (dom.startScreen) dom.startScreen.classList.add('hidden'); // hide original visual (we render)
    if (dom.bootScreen) dom.bootScreen.classList.remove('hidden'); // keep interactive
    State.screen = 'boot';
    State.bootVisibleLines = [];
    State.bootAnimIndex = 0;
    State.bootTicking = true;
    // animate each line with delay
    const delayBetween = 900;
    State.bootLines.forEach((line, idx) => {
      setTimeout(() => {
        // animate line typing
        animateLineTyping(line, 0, (final) => {
          State.bootVisibleLines.push(final);
          requestRender();
          // if last line, complete boot
          if (idx === State.bootLines.length - 1) {
            setTimeout(() => {
              State.bootCompleted = true;
              // after small pause show login screen
              setTimeout(showLoginScreen, 900);
            }, 600);
          }
        });
      }, idx * delayBetween);
    });
  }

  function animateLineTyping(line, pos, callback){
    const speed = TYPING_SPEED;
    let buf = '';
    function step(){
      if (pos < line.length) {
        buf += line[pos++];
        // keep ephemeral last line visible while typing
        const ephemeralIndex = State.bootVisibleLines._typingIndex;
        // place ephemeral in array to be picked up by draw
        State.bootVisibleLines.push(buf); // push progressively, remove last ephemeral on next tick
        // Keep only the last ephemeral copy while typing by popping previous
        if (State.bootVisibleLines.length > 0 && State.bootVisibleLines._lastEphemeralIdx != null) {
          // remove previous ephemeral (if not yet fixed)
          const idx = State.bootVisibleLines._lastEphemeralIdx;
          if (idx >= 0 && idx < State.bootVisibleLines.length - 1) {
            State.bootVisibleLines.splice(idx, 1);
          }
        }
        State.bootVisibleLines._lastEphemeralIdx = State.bootVisibleLines.length - 1;
        requestRender();
        setTimeout(step, speed);
      } else {
        // finalize
        // remove ephemeral index metadata
        State.bootVisibleLines._lastEphemeralIdx = null;
        callback(line);
      }
    }
    step();
  }

  function showLoginScreen() {
    // switch state
    if (dom.bootScreen) dom.bootScreen.classList.add('hidden');
    if (dom.loginScreen) dom.loginScreen.classList.remove('hidden'); // make interactive
    State.screen = 'login';
    requestRender();
    // auto focus username input (it is invisible but interactive)
    try { dom.username && dom.username.focus(); } catch(e){}
  }

  // ---------- Login logic (keeps original semantics) ----------
  const VALID_CREDENTIALS = { username: "qq", password: "ww" };

  function doLogin() {
    const u = dom.username ? dom.username.value : '';
    const p = dom.password ? dom.password.value : '';
    const err = dom.loginError;
    if (u === VALID_CREDENTIALS.username && p === VALID_CREDENTIALS.password) {
      if (err) { err.textContent = 'ДОСТУП РАЗРЕШЁН'; err.style.color = '#00FF41'; err.classList.remove('hidden'); }
      // fade out whole document visually then redirect to terminal.html
      document.body.style.transition = 'opacity 0.8s ease-in-out';
      document.body.style.opacity = '0';
      setTimeout(() => { window.location.href = 'terminal.html'; }, 800);
    } else {
      if (err) { err.textContent = 'ДОСТУП ЗАПРЕЩЁН'; err.style.color = '#FF0000'; err.classList.remove('hidden'); }
      if (dom.password) dom.password.value = '';
      try { dom.username && dom.username.focus(); } catch(e){}
      requestRender();
    }
  }

  // ---------- events hooking (wire DOM interactions to this canvas-rendered UI) ----------
  // Start button (original DOM button exists but is invisible; keep it clickable)
  if (dom.startBtn) {
    dom.startBtn.addEventListener('click', (e) => {
      e.preventDefault();
      startBootSequence();
    });
  }

  // Login button
  if (dom.loginBtn) {
    dom.loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      doLogin();
    });
  }

  // Enter key triggers login when on login screen (we keep DOM inputs interactive)
  document.addEventListener('keydown', (e) => {
    // if focus is in an input and Enter pressed — let original handler call login; else if login screen active, pressing Enter triggers doLogin
    if (State.screen === 'login' && (e.key === 'Enter')) {
      // allow inputs to handle value first — small timeout
      setTimeout(() => doLogin(), 0);
    }
  });

  // If user clicks visually somewhere, the underlying DOM receives it because uiCanvas pointerEvents:none.
  // However some browsers may not forward keyboard focus — we ensured inputs have tabIndex and we call focus() programmatically.

  // ---------- animation / heartbeat tick ----------
  // separate tick to keep shader / glass / other animations alive and to refresh at ~30fps
  let lastRAF = performance.now();
  (function heartbeat(ts){
    const dt = ts - lastRAF;
    lastRAF = ts;
    // tick some UI things if needed (fade messages etc)
    requestRender(); // keep UI alive; render throttling inside requestRender prevents overdraw
    requestAnimationFrame(heartbeat);
  })(performance.now());

  // ---------- utility: ensure shader/glass updates are sampled ----------
  // If overlay scripts have been loaded earlier and reported "canvas not found", some overlays expect a global to call to re-init.
  // Provide a simple hook they can call in case they were loaded earlier:
  window.__uiCanvasReady = function() {
    // This function exists so external overlays can call it after their init if they checked early and failed.
    // We simply trigger a render and expose the canvas object.
    requestRender();
    return uiCanvas;
  };

  // ---------- initial boot text reveal triggered by clicking start only — but show initial text prompt ----------
  // On load, keep start screen visible (we render start screen). If your DOM already calls startBootSequence, we still handle it.
  // Also render once so overlay picks it up
  requestRender();

  // ---------- final notes ----------
  // Keep the original DOM elements present and interactive but invisible (we already did that).
  // If you find that your curvature overlay (screenCurvature.js / crt_overlay.js) logs "uiCanvas not found",
  // ensure that overlay is included AFTER this script in your HTML, or call overlay re-init manually:
  // if overlay exposes init function, call it. We also expose window.__UICanvas for convenience.

  // done
})();
