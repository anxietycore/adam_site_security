// index_canvas.js — теперь рисует на offscreen и даёт API window.ADAM_UI
(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 12; // <--- МЕНЬШЕ ШРИФТ
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.5);
  const FIELD_PADDING = 12;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  // Цветовая палитра
  const COLOR_PRIMARY = '#00FF88';
  const COLOR_SECONDARY = '#00AA55';
  const COLOR_HOVER = '#88FFAA';
  const COLOR_LOCKED = '#FF5555';

  // OFFSCREEN canvas — not appended to DOM
  const canvas = document.createElement('canvas');
  canvas.id = 'indexCanvasOff';
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

  // GLITCH state
  let glitchStrength = 0;
  let glitchTimer = 0;

  // Noise cache
  let noiseCanvas = document.createElement('canvas');
  let noiseCtx = noiseCanvas.getContext('2d');

  function resize() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    noiseCanvas.width = Math.max(256, Math.floor(vw/2));
    noiseCanvas.height = Math.max(256, Math.floor(vh/2));
    generateNoise();
  }
  window.addEventListener('resize', resize);
  resize();

  function generateNoise() {
    const w = noiseCanvas.width, h = noiseCanvas.height;
    const id = noiseCtx.createImageData(w, h);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 60 + Math.floor(Math.random() * 60);
      id.data[i] = v;
      id.data[i+1] = v;
      id.data[i+2] = v;
      id.data[i+3] = 18;
    }
    noiseCtx.putImageData(id, 0, 0);
  }

  function drawNoise() {
    const pat = ctx.createPattern(noiseCanvas, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }

  function drawText(text, x, y, color = COLOR_SECONDARY, opacity = 1) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
    ctx.fillStyle = color || COLOR_SECONDARY;
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
    drawNoise();

    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.35;
    drawText(logo, logoX, logoY, COLOR_PRIMARY);

    const status = '> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ';
    const statusY = logoY + 90;
    drawText(status, (vw - measure(status)) / 2, statusY, COLOR_PRIMARY);

    const btnText = 'ЗАПУСТИТЬ СИСТЕМУ';
    const btnW = measure(btnText) + 60;
    const btnH = 40; // <-- МЕНЬШЕ ВЫСОТА
    const btnX = (vw - btnW) / 2;
    const btnY = statusY + 50; // <-- БЛИЖЕ
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    // Установка курсора через API
    if (window.ADAM_UI && window.ADAM_UI.setCursor) {
      window.ADAM_UI.setCursor(hovered ? 'pointer' : 'default');
    }

    // Рисуем кнопку с градиентом
    ctx.save();
    const gradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
    if (hovered) {
      gradient.addColorStop(0, 'rgba(0,255,136,0.15)');
      gradient.addColorStop(1, 'rgba(0,170,85,0.25)');
      ctx.shadowColor = COLOR_HOVER;
      ctx.shadowBlur = 8;
    } else {
      gradient.addColorStop(0, 'rgba(0,170,85,0.05)');
      gradient.addColorStop(1, 'rgba(0,100,50,0.1)');
    }
    ctx.fillStyle = gradient;
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fill();

    ctx.strokeStyle = hovered ? COLOR_PRIMARY : COLOR_SECONDARY;
    ctx.lineWidth = hovered ? 2 : 1;
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.stroke();
    ctx.restore();

    drawText(btnText, btnX + 30, btnY + 10, hovered ? COLOR_HOVER : COLOR_PRIMARY);

    clickZones = { startBtn: { x: btnX, y: btnY, w: btnW, h: btnH } };
  }

  function drawBoot() {
    ctx.clearRect(0, 0, vw, vh);
    drawNoise();

    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.3;
    drawText(logo, logoX, logoY, COLOR_PRIMARY);

    bootTimer++;
    if (bootIndex < bootLines.length - 1 && bootTimer % 40 === 0) {
      bootIndex++;
      bootFadeProgress = 0;
    }
    bootFadeProgress = Math.min(1, bootFadeProgress + 0.05);

    const contentY = logoY + 80;
    bootLines.forEach((line, i) => {
      if (i <= bootIndex) {
        const opacity = (i === bootIndex) ? bootFadeProgress : 1;
        drawText(line, logoX - 30, contentY + i * (LINE_HEIGHT + 5), COLOR_PRIMARY, opacity);
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
    const fieldH = 38; // <-- МЕНЬШЕ ВЫСОТА
    const labelDy = -FIELD_PADDING - 5;

    const title = 'ДОСТУП К ТЕРМИНАЛУ';
    drawText(title, (vw - measure(title)) / 2, centerY - 120, COLOR_PRIMARY);

    // USERNAME field
    const userX = (vw - fieldW) / 2;
    const userY = centerY - 30;
    drawText('ИМЯ ПОЛЬЗОВАТЕЛЯ:', userX, userY + labelDy, COLOR_SECONDARY, 0.9);

    ctx.save();
    const userGradient = ctx.createLinearGradient(userX, userY, userX, userY + fieldH);
    if (inputField === 'username') {
      userGradient.addColorStop(0, 'rgba(0,255,136,0.1)');
      userGradient.addColorStop(1, 'rgba(0,170,85,0.15)');
      ctx.shadowColor = COLOR_PRIMARY;
      ctx.shadowBlur = 6;
    } else {
      userGradient.addColorStop(0, 'rgba(0,170,85,0.05)');
      userGradient.addColorStop(1, 'rgba(0,100,50,0.08)');
    }
    ctx.fillStyle = userGradient;
    roundRect(ctx, userX, userY, fieldW, fieldH, 6);
    ctx.fill();

    ctx.strokeStyle = inputField === 'username' ? COLOR_PRIMARY : COLOR_SECONDARY;
    ctx.lineWidth = inputField === 'username' ? 2 : 1;
    roundRect(ctx, userX, userY, fieldW, fieldH, 6);
    ctx.stroke();
    ctx.restore();

    const userText = username + (cursorBlink % 30 < 15 && inputField === 'username' ? '█' : '');
    drawText(userText, userX + FIELD_PADDING, userY + 10, '#f7f7f7');

    // PASSWORD field
    const passX = (vw - fieldW) / 2;
    const passY = centerY + 40;
    drawText('ПАРОЛЬ:', passX, passY + labelDy, COLOR_SECONDARY, 0.9);

    ctx.save();
    const passGradient = ctx.createLinearGradient(passX, passY, passX, passY + fieldH);
    if (inputField === 'password') {
      passGradient.addColorStop(0, 'rgba(0,255,136,0.1)');
      passGradient.addColorStop(1, 'rgba(0,170,85,0.15)');
      ctx.shadowColor = COLOR_PRIMARY;
      ctx.shadowBlur = 6;
    } else {
      passGradient.addColorStop(0, 'rgba(0,170,85,0.05)');
      passGradient.addColorStop(1, 'rgba(0,100,50,0.08)');
    }
    ctx.fillStyle = passGradient;
    roundRect(ctx, passX, passY, fieldW, fieldH, 6);
    ctx.fill();

    ctx.strokeStyle = inputField === 'password' ? COLOR_PRIMARY : COLOR_SECONDARY;
    ctx.lineWidth = inputField === 'password' ? 2 : 1;
    roundRect(ctx, passX, passY, fieldW, fieldH, 6);
    ctx.stroke();
    ctx.restore();

    const masked = '*'.repeat(password.length);
    const passText = masked + (cursorBlink % 30 < 15 && inputField === 'password' ? '█' : '');
    drawText(passText, passX + FIELD_PADDING, passY + 10, '#f7f7f7');

    // AUTH BUTTON
    const btnText = 'АУТЕНТИФИКАЦИЯ';
    const btnW = measure(btnText) + 60;
    const btnH = 36; // <-- МЕНЬШЕ ВЫСОТА
    const btnX = (vw - btnW) / 2;
    const btnY = centerY + 100;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    // Установка курсора
    if (window.ADAM_UI && window.ADAM_UI.setCursor) {
      const anyHover = hovered || inputField;
      window.ADAM_UI.setCursor(anyHover ? 'pointer' : 'default');
    }

    ctx.save();
    const btnGradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
    if (hovered) {
      btnGradient.addColorStop(0, 'rgba(0,255,136,0.15)');
      btnGradient.addColorStop(1, 'rgba(0,170,85,0.25)');
      ctx.shadowColor = COLOR_HOVER;
      ctx.shadowBlur = 8;
    } else {
      btnGradient.addColorStop(0, 'rgba(0,170,85,0.05)');
      btnGradient.addColorStop(1, 'rgba(0,100,50,0.1)');
    }
    ctx.fillStyle = btnGradient;
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fill();

    ctx.strokeStyle = hovered ? COLOR_PRIMARY : COLOR_SECONDARY;
    ctx.lineWidth = hovered ? 2 : 1;
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.stroke();
    ctx.restore();

    drawText(btnText, btnX + 30, btnY + 10, hovered ? COLOR_HOVER : COLOR_PRIMARY);

    // MESSAGES
    if (errorMsg && errorTimer > 0) {
      const jitter = (errorTimer % 6 < 3) ? Math.random()*4-2 : 0;
      ctx.save();
      ctx.translate(jitter,0);
      drawText(errorMsg, (vw - measure(errorMsg)) / 2, centerY + 160, '#ff6b6b');
      ctx.restore();
      errorTimer--;
    }
    if (successMsg && successTimer > 0) {
      drawText(successMsg, (vw - measure(successMsg)) / 2, centerY + 160, COLOR_PRIMARY);
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

  // Public API
  window.ADAM_UI = {
    getSourceCanvas() { return canvas; },
    
    handlePointer(type, x, y) {
      mouseX = x; mouseY = y;
      if (type === 'click' || type === 'pointerdown') {
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

    getClickZones() { return clickZones; },
    
    _internal: { getState: () => ({currentScreen, username, password, inputField}) },
    
    // API для смены курсора
    setCursor(cursor) {
      const overlay = document.getElementById('crtOverlayIndex');
      if (overlay) overlay.style.cursor = cursor;
    }
  };

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
      window.ADAM_UI.triggerGlitch(1.0, 50);
    }
  }

  document.addEventListener('keydown', (e) => {
    if (window.__ADAM_OVERLAY_PRESENT) return;
    window.ADAM_UI.handleKey(e);
  });

  document.addEventListener('pointermove', (e) => {
    if (window.__ADAM_OVERLAY_PRESENT) return;
    const rect = { left:0, top:0 };
    window.ADAM_UI.handlePointerMove(e.clientX - rect.left, e.clientY - rect.top);
  });
})();
