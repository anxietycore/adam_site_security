// index_canvas.js — финальная версия с прозрачным фоном, точными хитбоксами, без дублирования

(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 14;
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.5);
  const FIELD_PADDING = 12;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  const canvas = document.createElement('canvas');
  canvas.id = 'indexCanvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    left: '0', top: '0',
    width: '100%', height: '100%',
    zIndex: '50',
    pointerEvents: 'auto',
    userSelect: 'none',
    display: 'block'
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });

  let vw = 0, vh = 0;
  let mouseX = 0, mouseY = 0;
  let inputField = null; // 'username' | 'password' | null

  // Состояния
  const screens = { START: 'start', BOOT: 'boot', LOGIN: 'login' };
  let currentScreen = screens.START;
  let username = '', password = '';
  let bootTimer = 0, bootIndex = -1;
  let errorMsg = '', errorTimer = 0;
  let successMsg = '', successTimer = 0;

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

  // ======== РАЗМЕР ========
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

  // ======== УТИЛИТЫ ========
  function drawText(text, x, y, color = '#00FF41', opacity = 1) {
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

  // ======== РЕНДЕР ЭКРАНОВ ========
  function drawStart() {
    ctx.clearRect(0, 0, vw, vh); // ПРОЗРАЧНАЯ очистка!
    
    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.35;
    drawText(logo, logoX, logoY);

    const statusY = logoY + 90;
    drawText('> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ', (vw - measure('> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ')) / 2, statusY);

    // КНОПКА
    const btnText = 'ЗАПУСТИТЬ СИСТЕМУ';
    const btnW = measure(btnText) + 60;
    const btnH = 45;
    const btnX = (vw - btnW) / 2;
    const btnY = statusY + 60;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);
    
    ctx.strokeStyle = hovered ? '#00FF88' : '#00FF41';
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    drawText(btnText, btnX + 30, btnY + 12, hovered ? '#00FF88' : '#00FF41');

    window.__clickZones = { startBtn: { x: btnX, y: btnY, w: btnW, h: btnH } };
  }

  function drawBoot() {
    ctx.clearRect(0, 0, vw, vh);
    
    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.3;
    drawText(logo, logoX, logoY);

    if (bootTimer % 60 === 0 && bootIndex < bootLines.length - 1) bootIndex++;
    bootTimer++;

    const contentY = logoY + 80;
    bootLines.forEach((line, i) => {
      if (i <= bootIndex) {
        const opacity = i === bootIndex ? (bootTimer % 60) / 60 : 1;
        drawText(line, logoX - 30, contentY + i * (LINE_HEIGHT + 5), '#00FF41', opacity);
      }
    });

    if (bootIndex >= bootLines.length - 1 && bootTimer > 60) {
      setTimeout(() => {
        currentScreen = screens.LOGIN;
        inputField = 'username';
      }, 500);
    }
  }

  function drawLogin() {
    ctx.clearRect(0, 0, vw, vh);
    
    const centerY = vh * 0.45;
    const fieldW = Math.min(420, vw - 100);
    const fieldH = 42;
    const labelDy = -FIELD_PADDING - 5;

    // Заголовок
    const title = 'ДОСТУП К ТЕРМИНАЛУ';
    drawText(title, (vw - measure(title)) / 2, centerY - 120);

    // USERNAME
    const userX = (vw - fieldW) / 2;
    const userY = centerY - 30;
    drawText('ИМЯ ПОЛЬЗОВАТЕЛЯ:', userX, userY + labelDy, '#00FF41', 0.85);
    ctx.strokeStyle = inputField === 'username' ? '#00FF88' : '#00FF41';
    ctx.lineWidth = inputField === 'username' ? 3 : 2;
    ctx.strokeRect(userX, userY, fieldW, fieldH);
    const userText = username + (cursorBlink % 30 < 15 && inputField === 'username' ? '█' : '');
    drawText(userText, userX + FIELD_PADDING, userY + 10, '#FFFFFF');

    // PASSWORD
    const passX = (vw - fieldW) / 2;
    const passY = centerY + 40;
    drawText('ПАРОЛЬ:', passX, passY + labelDy, '#00FF41', 0.85);
    ctx.strokeStyle = inputField === 'password' ? '#00FF88' : '#00FF41';
    ctx.lineWidth = inputField === 'password' ? 3 : 2;
    ctx.strokeRect(passX, passY, fieldW, fieldH);
    const masked = '*'.repeat(password.length);
    const passText = masked + (cursorBlink % 30 < 15 && inputField === 'password' ? '█' : '');
    drawText(passText, passX + FIELD_PADDING, passY + 10, '#FFFFFF');

    // КНОПКА
    const btnText = 'АУТЕНТИФИКАЦИЯ';
    const btnW = measure(btnText) + 60;
    const btnH = 38;
    const btnX = (vw - btnW) / 2;
    const btnY = centerY + 100;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);
    
    ctx.strokeStyle = hovered ? '#00FF88' : '#00FF41';
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    drawText(btnText, btnX + 30, btnY + 10, hovered ? '#00FF88' : '#00FF41');

    // Сообщения
    if (errorMsg && errorTimer > 0) {
      drawText(errorMsg, (vw - measure(errorMsg)) / 2, centerY + 160, '#FF0000');
      errorTimer--;
    }
    if (successMsg && successTimer > 0) {
      drawText(successMsg, (vw - measure(successMsg)) / 2, centerY + 160, '#00FF41');
      successTimer--;
    }

    // Зоны клика
    window.__clickZones = {
      userField: { x: userX, y: userY, w: fieldW, h: fieldH },
      passField: { x: passX, y: passY, w: fieldW, h: fieldH },
      authBtn: { x: btnX, y: btnY, w: btnW, h: btnH }
    };
  }

  // ======== ЦИКЛ ========
  let cursorBlink = 0;
  function render() {
    cursorBlink++;
    switch(currentScreen) {
      case screens.START: drawStart(); break;
      case screens.BOOT: drawBoot(); break;
      case screens.LOGIN: drawLogin(); break;
    }
    requestAnimationFrame(render);
  }
  render();

  // ======== СОБЫТИЯ ========
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentScreen === screens.START && window.__clickZones?.startBtn) {
      const b = window.__clickZones.startBtn;
      if (inRect(x, y, b.x, b.y, b.w, b.h)) {
        currentScreen = screens.BOOT;
      }
    }

    if (currentScreen === screens.LOGIN && window.__clickZones?.userField) {
      const z = window.__clickZones;
      if (inRect(x, y, z.userField.x, z.userField.y, z.userField.w, z.userField.h)) {
        inputField = 'username';
      } else if (inRect(x, y, z.passField.x, z.passField.y, z.passField.w, z.passField.h)) {
        inputField = 'password';
      } else if (inRect(x, y, z.authBtn.x, z.authBtn.y, z.authBtn.w, z.authBtn.h)) {
        login();
      } else {
        inputField = null;
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  document.addEventListener('keydown', (e) => {
    if (currentScreen !== screens.LOGIN || !inputField) return;
    
    if (e.key === 'Enter') {
      login();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      inputField = inputField === 'username' ? 'password' : 'username';
    } else if (e.key === 'Backspace') {
      if (inputField === 'username') username = username.slice(0, -1);
      if (inputField === 'password') password = password.slice(0, -1);
    } else if (e.key.length === 1 && e.key !== ' ') {
      if (inputField === 'username') username += e.key;
      if (inputField === 'password') password += e.key;
    }
  });

  function login() {
    if (username === 'qq' && password === 'ww') {
      successMsg = '> ВХОД УСПЕШНЫЙ';
      successTimer = 90;
      setTimeout(() => {
        document.body.style.transition = 'opacity 0.8s';
        document.body.style.opacity = '0';
        setTimeout(() => window.location.href = 'terminal.html', 800);
      }, 1000);
    } else {
      errorMsg = '> ДОСТУП ЗАПРЕЩЁН';
      errorTimer = 120;
      password = '';
    }
  }

  // ======== УМЕНЬШЕНИЕ ШУМА ТОЛЬКО НА ГЛАВНОЙ ========
  window.addEventListener('load', () => {
    const glass = document.getElementById('glassFX');
    if (glass) {
      // Уменьшаем яркость в 3 раза по сравнению с терминалом
      glass.style.opacity = '0.08';
    }
  });
})();
