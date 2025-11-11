// index_canvas.js — рисует UI в offscreen canvas и предоставляет window.ADAM_UI
(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 11; // 🔧 Уменьшен для терминального стиля
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.4);
  const FIELD_PADDING = 12;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  const canvas = document.createElement('canvas');
  canvas.id = 'indexCanvasOff';
  const ctx = canvas.getContext('2d', { alpha: true });

  let vw = 0, vh = 0;
  let mouseX = -9999, mouseY = -9999;
  let inputField = null;
  let cursorBlink = 0;

  const screens = { START: 'start', BOOT: 'boot', LOGIN: 'login' };
  let currentScreen = screens.START;
  let username = '', password = '';
  let bootTimer = 0, bootIndex = -1;
  let errorMsg = '', errorTimer = 0;
  let successMsg = '', successTimer = 0;

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

  let glitchStrength = 0;
  let glitchTimer = 0;

  // 🔧 Новая функция для затемнённой цветовой палитры
  const COLORS = {
    primary: '#4a6b4a',      // Тусклый зелёный
    bright: '#6b8a6b',       // Яркий для hover
    dim: '#3a5a3a',          // Тусклый для неактивных
    error: '#aa5555',        // Тусклый красный
    success: '#5a8a5a',      // Тусклый зелёный
    text: '#5a7a5a',         // Текст
    border: '#4a5a4a'        // Рамки
  };

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

  function drawText(text, x, y, color = COLORS.text) {
    ctx.save();
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

  function drawStart() {
    ctx.clearRect(0, 0, vw, vh);
    
    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.35;
    drawText(logo, logoX, logoY, COLORS.primary);

    const status = '> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ';
    const statusY = logoY + 90;
    drawText(status, (vw - measure(status)) / 2, statusY, COLORS.primary);

    // 🔧 Упрощённая кнопка с точными хитбоксами
    const btnText = 'ЗАПУСТИТЬ СИСТЕМУ';
    const btnW = measure(btnText) + 60;
    const btnH = 40;
    const btnX = (vw - btnW) / 2;
    const btnY = statusY + 60;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    ctx.save();
    ctx.fillStyle = hovered ? COLORS.dim : 'rgba(42,62,42,0.08)';
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fill();

    ctx.strokeStyle = hovered ? COLORS.bright : COLORS.border;
    ctx.lineWidth = hovered ? 2 : 1;
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.stroke();
    ctx.restore();

    drawText(btnText, btnX + 30, btnY + 10, hovered ? COLORS.bright : COLORS.text);

    clickZones = { startBtn: { x: btnX, y: btnY, w: btnW, h: btnH } };
  }

  function drawBoot() {
    ctx.clearRect(0, 0, vw, vh);

    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.30;
    drawText(logo, logoX, logoY, COLORS.primary);

    bootTimer++;
    if (bootIndex < bootLines.length - 1 && bootTimer % 40 === 0) {
      bootIndex++;
    }

    const contentY = logoY + 80;
    bootLines.forEach((line, i) => {
      if (i <= bootIndex) {
        drawText(line, logoX - 30, contentY + i * (LINE_HEIGHT + 6), COLORS.text);
      }
    });

    if (bootIndex >= bootLines.length - 1 && bootTimer > 120) {
      setTimeout(() => { currentScreen = screens.LOGIN; inputField = 'username'; }, 300);
    }
  }

  function drawLogin() {
    ctx.clearRect(0, 0, vw, vh);

    const centerY = vh * 0.45;
    const fieldW = Math.min(380, vw - 100);
    const fieldH = 36;
    const labelDy = -FIELD_PADDING - 4;

    const title = 'ДОСТУП К ТЕРМИНАЛУ';
    drawText(title, (vw - measure(title)) / 2, centerY - 110, COLORS.primary);

    // USERNAME
    const userX = (vw - fieldW) / 2;
    const userY = centerY - 40;
    drawText('ИМЯ ПОЛЬЗОВАТЕЛЯ:', userX, userY + labelDy, COLORS.dim);

    ctx.save();
    ctx.fillStyle = inputField === 'username' ? 'rgba(42,82,62,0.08)' : 'rgba(22,52,42,0.05)';
    roundRect(ctx, userX, userY, fieldW, fieldH, 5);
    ctx.fill();

    ctx.strokeStyle = inputField === 'username' ? COLORS.bright : COLORS.border;
    ctx.lineWidth = inputField === 'username' ? 2 : 1;
    roundRect(ctx, userX, userY, fieldW, fieldH, 5);
    ctx.stroke();
    ctx.restore();

    const userText = username + (cursorBlink % 30 < 15 && inputField === 'username' ? '█' : '');
    drawText(userText, userX + FIELD_PADDING, userY + 8, COLORS.text);

    // PASSWORD
    const passX = (vw - fieldW) / 2;
    const passY = centerY + 20;
    drawText('ПАРОЛЬ:', passX, passY + labelDy, COLORS.dim);

    ctx.save();
    ctx.fillStyle = inputField === 'password' ? 'rgba(42,82,62,0.08)' : 'rgba(22,52,42,0.05)';
    roundRect(ctx, passX, passY, fieldW, fieldH, 5);
    ctx.fill();

    ctx.strokeStyle = inputField === 'password' ? COLORS.bright : COLORS.border;
    ctx.lineWidth = inputField === 'password' ? 2 : 1;
    roundRect(ctx, passX, passY, fieldW, fieldH, 5);
    ctx.stroke();
    ctx.restore();

    const masked = '*'.repeat(password.length);
    const passText = masked + (cursorBlink % 30 < 15 && inputField === 'password' ? '█' : '');
    drawText(passText, passX + FIELD_PADDING, passY + 8, COLORS.text);

    // BUTTON
    const btnText = 'АУТЕНТИФИКАЦИЯ';
    const btnW = measure(btnText) + 50;
    const btnH = 34;
    const btnX = (vw - btnW) / 2;
    const btnY = centerY + 80;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    ctx.save();
    ctx.fillStyle = hovered ? 'rgba(42,82,62,0.08)' : 'rgba(22,52,42,0.05)';
    roundRect(ctx, btnX, btnY, btnW, btnH, 5);
    ctx.fill();

    ctx.strokeStyle = hovered ? COLORS.bright : COLORS.border;
    ctx.lineWidth = hovered ? 2 : 1;
    roundRect(ctx, btnX, btnY, btnW, btnH, 5);
    ctx.stroke();
    ctx.restore();

    drawText(btnText, btnX + 25, btnY + 8, hovered ? COLORS.bright : COLORS.text);

    // MESSAGES
    if (errorMsg && errorTimer > 0) {
      const jitter = (errorTimer % 6 < 3) ? (Math.random() * 6 - 3) : 0;
      ctx.save();
      ctx.translate(jitter, 0);
      drawText(errorMsg, (vw - measure(errorMsg)) / 2, centerY + 140, COLORS.error);
      ctx.restore();
      errorTimer--;
    }
    if (successMsg && successTimer > 0) {
      drawText(successMsg, (vw - measure(successMsg)) / 2, centerY + 140, COLORS.success);
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

    switch (currentScreen) {
      case screens.START: drawStart(); break;
      case screens.BOOT: drawBoot(); break;
      case screens.LOGIN: drawLogin(); break;
    }
    requestAnimationFrame(render);
  }
  render();

  window.ADAM_UI = {
    getSourceCanvas() { return canvas; },
    
    handlePointer(type, x, y) {
      mouseX = x; mouseY = y;
      if (type === 'click' || type === 'pointerdown') {
        if (currentScreen === screens.START && clickZones.startBtn && inRect(x, y, clickZones.startBtn.x, clickZones.startBtn.y, clickZones.startBtn.w, clickZones.startBtn.h)) {
          currentScreen = screens.BOOT;
          bootTimer = 0; bootIndex = -1;
          return;
        }
        if (currentScreen === screens.LOGIN) {
          if (clickZones.userField && inRect(x, y, clickZones.userField.x, clickZones.userField.y, clickZones.userField.w, clickZones.userField.h)) {
            inputField = 'username'; return;
          }
          if (clickZones.passField && inRect(x, y, clickZones.passField.x, clickZones.passField.y, clickZones.passField.w, clickZones.passField.h)) {
            inputField = 'password'; return;
          }
          if (clickZones.authBtn && inRect(x, y, clickZones.authBtn.x, clickZones.authBtn.y, clickZones.authBtn.w, clickZones.authBtn.h)) {
            login(); return;
          }
          inputField = null;
        }
      }
    },

    handlePointerMove(x, y) { mouseX = x; mouseY = y; },

    handleKey(ev) {
      if (currentScreen !== screens.LOGIN || !inputField) return;
      if (ev.key === 'Enter') { login(); }
      else if (ev.key === 'Tab') { ev.preventDefault(); inputField = inputField === 'username' ? 'password' : 'username'; cursorBlink = 0; }
      else if (ev.key === 'Backspace') {
        if (inputField === 'username') username = username.slice(0, -1);
        if (inputField === 'password') password = password.slice(0, -1);
      } else if (ev.key.length === 1) {
        if (inputField === 'username') username += ev.key;
        if (inputField === 'password') password += ev.key;
      }
    },

    getClickZones() { return clickZones; },
    
    triggerGlitch(strength = 1.0, duration = 30) {
      glitchStrength = Math.min(1, strength);
      glitchTimer = Math.max(glitchTimer, duration);
      window.__ADAM_GLITCH = { strength: glitchStrength, timer: glitchTimer };
    },

    _internal: { getState: () => ({ currentScreen, username, password, inputField }) }
  };

  function login() {
    if (username === 'qq' && password === 'ww') {
      successMsg = '> ВХОД УСПЕШНЫЙ'; successTimer = 90;
      setTimeout(() => { window.location.href = 'terminal.html'; }, 900);
    } else {
      errorMsg = '> ДОСТУП ЗАПРЕЩЁН'; errorTimer = 60; password = '';
      window.ADAM_UI.triggerGlitch(1.0, 50);
    }
  }

  document.addEventListener('keydown', (e) => {
    if (window.__ADAM_OVERLAY_PRESENT) return;
    window.ADAM_UI.handleKey(e);
  });
  document.addEventListener('pointermove', (e) => {
    if (window.__ADAM_OVERLAY_PRESENT) return;
    window.ADAM_UI.handlePointerMove(e.clientX, e.clientY);
  });
})();
