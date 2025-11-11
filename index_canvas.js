// index_canvas.js — теперь рисует на offscreen и даёт API window.ADAM_UI
(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 13; // чуть меньше, как просил
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.5);
  const FIELD_PADDING = 12;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  // OFFSCREEN canvas — visible canvas removed to avoid duplication
  const canvas = document.createElement('canvas');
  canvas.id = 'indexCanvasOff'; // not appended
  const ctx = canvas.getContext('2d', { alpha: true });

  let vw = 0, vh = 0;
  let mouseX = 0, mouseY = 0;
  let inputField = null;
  let cursorBlink = 0;

  const screens = { START: 'start', BOOT: 'boot', LOGIN: 'login' };
  let currentScreen = screens.START;
  let username = '', password = '';
  let bootTimer = 0, bootIndex = -1;
  let errorMsg = '', errorTimer = 0;
  let successMsg = '', successTimer = 0;

  // Hitboxes in logical coordinate space (CSS px)
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

  // GLITCH state (control for overlay)
  let glitchStrength = 0;
  let glitchTimer = 0;

  // Noise cache (to keep performance ok) — small canvas tiled
  let noiseCanvas = document.createElement('canvas');
  let noiseCtx = noiseCanvas.getContext('2d');
  let noiseOffsetX = 0, noiseOffsetY = 0;

  function resize() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    noiseCanvas.width = Math.max(256, Math.floor(vw / 2));
    noiseCanvas.height = Math.max(256, Math.floor(vh / 2));
    generateNoise();
  }
  window.addEventListener('resize', resize);
  resize();

  function generateNoise() {
    const w = noiseCanvas.width, h = noiseCanvas.height;
    const id = noiseCtx.createImageData(w, h);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 40 + Math.floor(Math.random() * 40); // темнее
      id.data[i] = v;
      id.data[i+1] = v;
      id.data[i+2] = v;
      id.data[i+3] = 28; // немного прозрачнее
    }
    noiseCtx.putImageData(id, 0, 0);
  }

  function drawNoise(t) {
    // движущийся шум — с небольшой параллаксной скоростью
    noiseOffsetX = (noiseOffsetX + 0.3) % noiseCanvas.width;
    noiseOffsetY = (noiseOffsetY + 0.12) % noiseCanvas.height;
    ctx.save();
    ctx.globalAlpha = 0.14; // тоньше
    for (let x = -noiseCanvas.width; x < vw + noiseCanvas.width; x += noiseCanvas.width) {
      for (let y = -noiseCanvas.height; y < vh + noiseCanvas.height; y += noiseCanvas.height) {
        ctx.drawImage(noiseCanvas, x + Math.floor(noiseOffsetX), y + Math.floor(noiseOffsetY));
      }
    }
    ctx.restore();
  }

  function drawText(text, x, y, color = '#9ee99a', opacity = 1) {
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

  // Smooth alpha helpers
  function lerp(a,b,t){return a + (b-a)*t;}

  // Drawers
  let bootFadeProgress = 0; // smooth appear of boot lines

  function drawStart() {
    ctx.clearRect(0, 0, vw, vh);
    drawNoise();

    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.35;
    drawText(logo, logoX, logoY, '#9ee99a');

    const status = '> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ';
    const statusY = logoY + 90;
    drawText(status, (vw - measure(status)) / 2, statusY, '#9ee99a');

    const btnText = 'ЗАПУСТИТЬ СИСТЕМУ';
    const btnW = measure(btnText) + 56;
    const btnH = 44;
    const btnX = (vw - btnW) / 2;
    const btnY = statusY + 60;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    ctx.save();
    ctx.fillStyle = hovered ? 'rgba(0,160,90,0.07)' : 'rgba(0,120,60,0.035)';
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fill();

    ctx.strokeStyle = hovered ? '#cfffe0' : '#9ee99a';
    ctx.lineWidth = hovered ? 3 : 2;
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.stroke();
    ctx.restore();

    drawText(btnText, btnX + 28, btnY + 10, hovered ? '#cfffe0' : '#9ee99a');

    clickZones = { startBtn: { x: btnX, y: btnY, w: btnW, h: btnH } };
  }

  function drawBoot() {
    ctx.clearRect(0, 0, vw, vh);
    drawNoise();

    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.3;
    drawText(logo, logoX, logoY, '#9ee99a');

    // progress bootIndex smoothly
    bootTimer++;
    if (bootIndex < bootLines.length - 1 && bootTimer % 40 === 0) {
      bootIndex++;
      bootFadeProgress = 0;
    }
    bootFadeProgress = Math.min(1, bootFadeProgress + 0.06);

    const contentY = logoY + 80;
    bootLines.forEach((line, i) => {
      if (i <= bootIndex) {
        const opacity = (i === bootIndex) ? bootFadeProgress : 1;
        drawText(line, logoX - 30, contentY + i * (LINE_HEIGHT + 6), '#9ee99a', opacity);
      }
    });

    if (bootIndex >= bootLines.length - 1 && bootTimer > 120) {
      setTimeout(() => {
        currentScreen = screens.LOGIN;
        inputField = 'username';
      }, 300);
    }
  }

  function drawLogin() {
    ctx.clearRect(0, 0, vw, vh);
    drawNoise();

    const centerY = vh * 0.45;
    const fieldW = Math.min(420, vw - 100);
    const fieldH = 42;
    const labelDy = -FIELD_PADDING - 5;

    const title = 'ДОСТУП К ТЕРМИНАЛУ';
    drawText(title, (vw - measure(title)) / 2, centerY - 120, '#9ee99a');

    // USERNAME
    const userX = (vw - fieldW) / 2;
    const userY = centerY - 30;
    drawText('ИМЯ ПОЛЬЗОВАТЕЛЯ:', userX, userY + labelDy, '#9ee99a', 0.9);

    ctx.save();
    ctx.fillStyle = inputField === 'username' ? 'rgba(0,160,90,0.06)' : 'rgba(0,120,60,0.035)';
    roundRect(ctx, userX, userY, fieldW, fieldH, 6);
    ctx.fill();

    ctx.strokeStyle = inputField === 'username' ? '#cfffe0' : '#9ee99a';
    ctx.lineWidth = inputField === 'username' ? 3 : 2;
    roundRect(ctx, userX, userY, fieldW, fieldH, 6);
    ctx.stroke();
    ctx.restore();

    const userText = username + (cursorBlink % 30 < 15 && inputField === 'username' ? '█' : '');
    drawText(userText, userX + FIELD_PADDING, userY + 10, '#f7f7f7');

    // PASSWORD
    const passX = (vw - fieldW) / 2;
    const passY = centerY + 40;
    drawText('ПАРОЛЬ:', passX, passY + labelDy, '#9ee99a', 0.9);

    ctx.save();
    ctx.fillStyle = inputField === 'password' ? 'rgba(0,160,90,0.06)' : 'rgba(0,120,60,0.035)';
    roundRect(ctx, passX, passY, fieldW, fieldH, 6);
    ctx.fill();

    ctx.strokeStyle = inputField === 'password' ? '#cfffe0' : '#9ee99a';
    ctx.lineWidth = inputField === 'password' ? 3 : 2;
    roundRect(ctx, passX, passY, fieldW, fieldH, 6);
    ctx.stroke();
    ctx.restore();

    const masked = '*'.repeat(password.length);
    const passText = masked + (cursorBlink % 30 < 15 && inputField === 'password' ? '█' : '');
    drawText(passText, passX + FIELD_PADDING, passY + 10, '#f7f7f7');

    // BUTTON
    const btnText = 'АУТЕНТИФИКАЦИЯ';
    const btnW = measure(btnText) + 56;
    const btnH = 38;
    const btnX = (vw - btnW) / 2;
    const btnY = centerY + 100;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    ctx.save();
    ctx.fillStyle = hovered ? 'rgba(0,160,90,0.06)' : 'rgba(0,120,60,0.035)';
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fill();

    ctx.strokeStyle = hovered ? '#cfffe0' : '#9ee99a';
    ctx.lineWidth = hovered ? 3 : 2;
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.stroke();
    ctx.restore();

    drawText(btnText, btnX + 28, btnY + 10, hovered ? '#cfffe0' : '#9ee99a');

    // MESSAGES
    if (errorMsg && errorTimer > 0) {
      // flashing red with strong jitter requested by you
      const jitter = (errorTimer % 6 < 3) ? Math.random()*8-4 : 0;
      ctx.save();
      ctx.translate(jitter,Math.random()*2-1);
      drawText(errorMsg, (vw - measure(errorMsg)) / 2, centerY + 160, '#ff6b6b');
      ctx.restore();
      errorTimer--;
    }
    if (successMsg && successTimer > 0) {
      drawText(successMsg, (vw - measure(successMsg)) / 2, centerY + 160, '#9ee99a');
      successTimer--;
    }

    // CLICK ZONES
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

  // Public API for overlay:
  window.ADAM_UI = {
    // returns the offscreen canvas (overlay will sample from it)
    getSourceCanvas() { return canvas; },

    // called by overlay when mouse moves or clicks (coords in CSS px)
    handlePointer(type, x, y) {
      // update mouse for hover etc.
      mouseX = x; mouseY = y;
      if (type === 'click' || type === 'pointerdown') {
        // immediate focus on pointerdown
        if (currentScreen === screens.START && clickZones.startBtn && inRect(x,y,clickZones.startBtn.x,clickZones.startBtn.y,clickZones.startBtn.w,clickZones.startBtn.h)) {
          currentScreen = screens.BOOT;
          bootTimer = 0; bootIndex = -1;
          return;
        }
        if (currentScreen === screens.LOGIN) {
          if (clickZones.userField && inRect(x,y,clickZones.userField.x,clickZones.userField.y,clickZones.userField.w,clickZones.userField.h)) {
            inputField = 'username';
            return;
          }
          if (clickZones.passField && inRect(x,y,clickZones.passField.x,clickZones.passField.y,clickZones.passField.w,clickZones.passField.h)) {
            inputField = 'password';
            return;
          }
          if (clickZones.authBtn && inRect(x,y,clickZones.authBtn.x,clickZones.authBtn.y,clickZones.authBtn.w,clickZones.authBtn.h)) {
            login();
            return;
          }
          inputField = null;
        }
      }
    },

    handlePointerMove(x,y) {
      mouseX = x; mouseY = y;
    },

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

    // diagnostic: get current click zones (in CSS px)
    getClickZones() { return clickZones; },

    // force a glitch effect (called when login fails)
    triggerGlitch(strength = 1.0, duration = 30) {
      glitchStrength = Math.min(1, strength);
      glitchTimer = Math.max(glitchTimer, duration);
      window.__ADAM_GLITCH = { strength: glitchStrength, timer: glitchTimer };
    },

    // for overlay to read
    _internal: { getState: () => ({currentScreen, username, password, inputField}) }
  };

  // local login logic
  function login() {
    if (username === 'qq' && password === 'ww') {
      successMsg = '> ВХОД УСПЕШНЫЙ';
      successTimer = 90;
      setTimeout(() => {
        window.location.href = 'terminal.html';
      }, 900);
    } else {
      errorMsg = '> ДОСТУП ЗАПРЕЩЁН';
      errorTimer = 60;
      password = '';
      // brutal glitch
      window.ADAM_UI.triggerGlitch(1.0, 70);
    }
  }

  // expose small keyboard/mouse hooks so users can test without overlay
  document.addEventListener('keydown', (e) => {
    if (window.__ADAM_OVERLAY_PRESENT) return;
    window.ADAM_UI.handleKey(e);
  });

  document.addEventListener('pointermove', (e) => {
    if (window.__ADAM_OVERLAY_PRESENT) return;
    window.ADAM_UI.handlePointerMove(e.clientX, e.clientY);
  });
})();
