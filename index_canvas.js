// index_canvas.js — рисует UI в offscreen canvas и предоставляет window.ADAM_UI
(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 13; // чуть меньше
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.4);
  const FIELD_PADDING = 12;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  // offscreen canvas (not inserted into DOM)
  const canvas = document.createElement('canvas');
  canvas.id = 'indexCanvasOff';
  const ctx = canvas.getContext('2d', { alpha: true });

  let vw = 0, vh = 0;
  let mouseX = -9999, mouseY = -9999; // hover pos in CSS px
  let inputField = null;
  let cursorBlink = 0;

  const screens = { START: 'start', BOOT: 'boot', LOGIN: 'login' };
  let currentScreen = screens.START;
  let username = '', password = '';
  let bootTimer = 0, bootIndex = -1;
  let errorMsg = '', errorTimer = 0;
  let successMsg = '', successTimer = 0;

  // click zones (CSS px)
  let clickZones = {};

  const logo = `    \\    _ \\    \\     \\  | 
   _ \\   |  |  _ \\   |\\/ | 
 _/  _\\ ___/ _/  _\\ _|  _| `;

  const bootLines = [
    '> ИНИЦИАЛИЗАЦИЯ ПРОТОКОЛА БЕЗОПАСНОСТИ A.D.A.M...',
    '> ЗАГРУЗКА ПОДСИСТЕМЫ VIGIL-9...',
    '> ТЕСТ ПАМЯТИ: УСПЕШНО',
    '> КРИПТОМОДУЛЬ: АКТИВИРОВАН',
    '> ПРЕДУПРЕЖДЕНИЕ: НЕСАНКЦИОНИРОВАННЫЙ ДОСТУП ЗАПРЕЩЁН',
    '> СИСТЕМА ГОТОВА'
  ];

  // glitch state (for overlay reading)
  let glitchStrength = 0;
  let glitchTimer = 0;

  function resize() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function drawText(text, x, y, color = '#9aaf8a', opacity = 1) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    text.split('\n').forEach((line, i) => ctx.fillText(line, x, y + i * LINE_HEIGHT));
    ctx.restore();
  }

  function measure(text) {
    ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
    return ctx.measureText(text).width;
  }

  function inRect(px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }

  function roundRect(ctx_, x, y, w, h, r) {
    ctx_.beginPath();
    ctx_.moveTo(x + r, y);
    ctx_.arcTo(x + w, y, x + w, y + h, r);
    ctx_.arcTo(x + w, y + h, x, y + h, r);
    ctx_.arcTo(x, y + h, x, y, r);
    ctx_.arcTo(x, y, x + w, y, r);
    ctx_.closePath();
  }

  // Smooth lerp helper
  function lerp(a,b,t){return a + (b-a)*t;}

  // Boot fade progress for smooth appearance
  let bootFadeProgress = 0;

  function drawStart() {
    ctx.clearRect(0,0,vw,vh);

    // NO noise here — screenGlass.js provides global noise background.
    // Draw logo and status
    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.35;
    drawText(logo, logoX, logoY, '#9aaf8a');

    const status = '> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ';
    const statusY = logoY + 90;
    drawText(status, (vw - measure(status)) / 2, statusY, '#9aaf8a');

    // button
    const btnText = 'ЗАПУСТИТЬ СИСТЕМУ';
    const btnW = measure(btnText) + 60;
    const btnH = 44;
    const btnX = (vw - btnW) / 2;
    const btnY = statusY + 60;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    ctx.save();
    ctx.fillStyle = hovered ? 'rgba(20,120,70,0.12)' : 'rgba(20,120,70,0.08)';
    roundRect(ctx, btnX, btnY, btnW, btnH, 8);
    ctx.fill();

    ctx.strokeStyle = hovered ? '#cfeee0' : '#a7caa0';
    ctx.lineWidth = hovered ? 3 : 2;
    roundRect(ctx, btnX, btnY, btnW, btnH, 8);
    ctx.stroke();
    ctx.restore();

    drawText(btnText, btnX + 30, btnY + 12, hovered ? '#cfeee0' : '#9aaf8a');

    clickZones = { startBtn: { x: btnX, y: btnY, w: btnW, h: btnH } };
  }

  function drawBoot() {
    ctx.clearRect(0,0,vw,vh);

    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.30;
    drawText(logo, logoX, logoY, '#9aaf8a');

    // progress lines appear smoothly
    bootTimer++;
    if (bootIndex < bootLines.length - 1 && bootTimer % 40 === 0) {
      bootIndex++;
      bootFadeProgress = 0;
    }
    bootFadeProgress = Math.min(1, bootFadeProgress + 0.06);

    const contentY = logoY + 80;
    bootLines.forEach((line,i) => {
      if (i <= bootIndex) {
        const opacity = (i === bootIndex) ? bootFadeProgress : 1;
        drawText(line, logoX - 30, contentY + i * (LINE_HEIGHT + 6), '#9aaf8a', opacity);
      }
    });

    if (bootIndex >= bootLines.length - 1 && bootTimer > 120) {
      setTimeout(()=>{ currentScreen = screens.LOGIN; inputField = 'username'; }, 300);
    }
  }

  function drawLogin() {
    ctx.clearRect(0,0,vw,vh);

    const centerY = vh * 0.45;
    const fieldW = Math.min(420, vw - 100);
    const fieldH = 42;
    const labelDy = -FIELD_PADDING - 5;

    const title = 'ДОСТУП К ТЕРМИНАЛУ';
    drawText(title, (vw - measure(title)) / 2, centerY - 120, '#9aaf8a');

    // USERNAME
    const userX = (vw - fieldW) / 2;
    const userY = centerY - 30;
    drawText('ИМЯ ПОЛЬЗОВАТЕЛЯ:', userX, userY + labelDy, '#9aaf8a', 0.92);

    ctx.save();
    ctx.fillStyle = inputField === 'username' ? 'rgba(18,120,70,0.08)' : 'rgba(12,80,50,0.05)';
    roundRect(ctx, userX, userY, fieldW, fieldH, 6);
    ctx.fill();

    ctx.strokeStyle = inputField === 'username' ? '#cfeee0' : '#9aaf8a';
    ctx.lineWidth = inputField === 'username' ? 3 : 2;
    roundRect(ctx, userX, userY, fieldW, fieldH, 6);
    ctx.stroke();
    ctx.restore();

    const userText = username + (cursorBlink % 30 < 15 && inputField === 'username' ? '█' : '');
    drawText(userText, userX + FIELD_PADDING, userY + 10, '#f2f2f2');

    // PASSWORD
    const passX = (vw - fieldW) / 2;
    const passY = centerY + 40;
    drawText('ПАРОЛЬ:', passX, passY + labelDy, '#9aaf8a', 0.92);

    ctx.save();
    ctx.fillStyle = inputField === 'password' ? 'rgba(18,120,70,0.08)' : 'rgba(12,80,50,0.05)';
    roundRect(ctx, passX, passY, fieldW, fieldH, 6);
    ctx.fill();

    ctx.strokeStyle = inputField === 'password' ? '#cfeee0' : '#9aaf8a';
    ctx.lineWidth = inputField === 'password' ? 3 : 2;
    roundRect(ctx, passX, passY, fieldW, fieldH, 6);
    ctx.stroke();
    ctx.restore();

    const masked = '*'.repeat(password.length);
    const passText = masked + (cursorBlink % 30 < 15 && inputField === 'password' ? '█' : '');
    drawText(passText, passX + FIELD_PADDING, passY + 10, '#f2f2f2');

    // BUTTON
    const btnText = 'АУТЕНТИФИКАЦИЯ';
    const btnW = measure(btnText) + 60;
    const btnH = 38;
    const btnX = (vw - btnW) / 2;
    const btnY = centerY + 100;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    ctx.save();
    ctx.fillStyle = hovered ? 'rgba(18,120,70,0.08)' : 'rgba(12,80,50,0.05)';
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fill();

    ctx.strokeStyle = hovered ? '#cfeee0' : '#9aaf8a';
    ctx.lineWidth = hovered ? 3 : 2;
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.stroke();
    ctx.restore();

    drawText(btnText, btnX + 30, btnY + 10, hovered ? '#cfeee0' : '#9aaf8a');

    // messages
    if (errorMsg && errorTimer > 0) {
      // jitter + strong red for failure; glitch will be triggered externally
      const jitter = (errorTimer % 6 < 3) ? (Math.random()*6-3) : 0;
      ctx.save();
      ctx.translate(jitter, 0);
      drawText(errorMsg, (vw - measure(errorMsg)) / 2, centerY + 160, '#ff7b7b');
      ctx.restore();
      errorTimer--;
    }
    if (successMsg && successTimer > 0) {
      drawText(successMsg, (vw - measure(successMsg)) / 2, centerY + 160, '#9aaf8a');
      successTimer--;
    }

    clickZones = {
      userField: { x: userX, y: userY, w: fieldW, h: fieldH },
      passField: { x: passX, y: passY, w: fieldW, h: fieldH },
      authBtn: { x: btnX, y: btnY, w: btnW, h: btnH }
    };
  }

  function render() {
    cursorBlink++;
    if (glitchTimer > 0) { glitchTimer--; if (glitchTimer === 0) glitchStrength = 0; }

    switch(currentScreen) {
      case screens.START: drawStart(); break;
      case screens.BOOT: drawBoot(); break;
      case screens.LOGIN: drawLogin(); break;
    }
    requestAnimationFrame(render);
  }
  render();

  // ------------ Public API for overlay and keyboard ------------
  window.ADAM_UI = {
    // returns the offscreen canvas (overlay will sample from it)
    getSourceCanvas() { return canvas; },

    // pointer events forwarded by overlay - coords are CSS px already
    handlePointer(type, x, y) {
      // update hover position
      mouseX = x; mouseY = y;

      if (type === 'click' || type === 'pointerdown') {
        if (currentScreen === screens.START && clickZones.startBtn && inRect(x,y,clickZones.startBtn.x,clickZones.startBtn.y,clickZones.startBtn.w,clickZones.startBtn.h)) {
          currentScreen = screens.BOOT;
          bootTimer = 0; bootIndex = -1; bootFadeProgress = 0;
          return;
        }
        if (currentScreen === screens.LOGIN) {
          if (clickZones.userField && inRect(x,y,clickZones.userField.x,clickZones.userField.y,clickZones.userField.w,clickZones.userField.h)) {
            inputField = 'username'; return;
          }
          if (clickZones.passField && inRect(x,y,clickZones.passField.x,clickZones.passField.y,clickZones.passField.w,clickZones.passField.h)) {
            inputField = 'password'; return;
          }
          if (clickZones.authBtn && inRect(x,y,clickZones.authBtn.x,clickZones.authBtn.y,clickZones.authBtn.w,clickZones.authBtn.h)) {
            login(); return;
          }
          inputField = null;
        }
      }
    },

    handlePointerMove(x,y) { mouseX = x; mouseY = y; },

    handleKey(ev) {
      if (currentScreen !== screens.LOGIN || !inputField) return;
      if (ev.key === 'Enter') { login(); }
      else if (ev.key === 'Tab') { ev.preventDefault(); inputField = inputField === 'username' ? 'password' : 'username'; cursorBlink = 0; }
      else if (ev.key === 'Backspace') {
        if (inputField === 'username') username = username.slice(0,-1);
        if (inputField === 'password') password = password.slice(0,-1);
      } else if (ev.key.length === 1 && ev.key !== ' ') {
        if (inputField === 'username') username += ev.key;
        if (inputField === 'password') password += ev.key;
      }
    },

    // For overlay debugging: click zones in CSS px
    getClickZones() { return clickZones; },

    // trigger glitch from overlay or other
    triggerGlitch(strength = 1.0, duration = 30) {
      glitchStrength = Math.min(1, strength);
      glitchTimer = Math.max(glitchTimer, duration);
      window.__ADAM_GLITCH = { strength: glitchStrength, timer: glitchTimer };
    },

    _internal: { getState: () => ({ currentScreen, username, password, inputField }) }
  };

  // --------------- login logic ---------------
  function login() {
    if (username === 'qq' && password === 'ww') {
      successMsg = '> ВХОД УСПЕШНЫЙ'; successTimer = 90;
      setTimeout(()=>{ window.location.href = 'terminal.html'; }, 900);
    } else {
      errorMsg = '> ДОСТУП ЗАПРЕЩЁН'; errorTimer = 60; password = '';
      window.ADAM_UI.triggerGlitch(1.0, 50);
    }
  }

  // fallback if overlay absent - forward keyboard etc.
  document.addEventListener('keydown', (e) => {
    if (window.__ADAM_OVERLAY_PRESENT) return;
    window.ADAM_UI.handleKey(e);
  });
  document.addEventListener('pointermove', (e) => {
    if (window.__ADAM_OVERLAY_PRESENT) return;
    window.ADAM_UI.handlePointerMove(e.clientX, e.clientY);
  });

})();
