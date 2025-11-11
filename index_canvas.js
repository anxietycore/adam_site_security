// index_canvas.js — полностью переписанная версия с исправленными хитбоксами, фоном и фокусом

(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 14; // увеличил для лучшей читаемости
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.5);
  const PADDING = 30;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const CANVAS_Z = 50;

  const canvas = document.createElement('canvas');
  canvas.id = 'indexCanvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    left: '0', top: '0',
    width: '100%', height: '100%',
    zIndex: CANVAS_Z,
    pointerEvents: 'auto',
    userSelect: 'none',
    display: 'block'
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true }); // alpha: true для прозрачности

  let vw = 0, vh = 0;
  let mouseX = 0, mouseY = 0;
  let inputField = 'username';
  let cursorBlink = 0;
  let isFrozen = false;

  // Состояния экрана
  const screens = { START: 'start', BOOT: 'boot', LOGIN: 'login' };
  let currentScreen = screens.START;

  // Данные
  let username = '', password = '';
  let bootTimer = 0, bootIndex = -1;
  let errorMessage = '', successMessage = '';
  let errorTimer = 0, successTimer = 0;

  const logoText = `    \\    _ \\    \\     \\  | 
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

  // ======== РЕНДЕРИНГ ========
  function resize() {
    vw = Math.max(320, window.innerWidth);
    vh = Math.max(240, window.innerHeight);
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

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

  // ======== ХИТБОКСЫ (фикс) ========
  // Все координаты в CSS-пикселях, как и события мыши
  function isInRect(px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }

  // ======== ЭКРАНЫ ========
  function drawStart() {
    ctx.clearRect(0, 0, vw, vh); // ПРОЗРАЧНАЯ ОЧИСТКА, не чёрная!
    
    const logoW = measure(logoText.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.35;
    
    drawText(logoText, logoX, logoY, '#00FF41', 0.95);
    
    const statusY = logoY + 100;
    drawText('> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ', (vw - measure('> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ')) / 2, statusY);

    // КНОПКА
    const btnText = 'ЗАПУСТИТЬ СИСТЕМУ';
    const btnW = measure(btnText) + 60;
    const btnH = 45;
    const btnX = (vw - btnW) / 2;
    const btnY = statusY + 70;
    
    const hovered = isInRect(mouseX, mouseY, btnX, btnY, btnW, btnH);
    
    ctx.strokeStyle = hovered ? '#00FF88' : '#00FF41';
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    
    drawText(btnText, btnX + 30, btnY + 12, hovered ? '#00FF88' : '#00FF41', 1);

    // Сохраняем для кликов
    window.__btnArea = { x: btnX, y: btnY, w: btnW, h: btnH };
    window.__inputAreas = null;
  }

  function drawBoot() {
    ctx.clearRect(0, 0, vw, vh);
    
    const logoW = measure(logoText.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.3;
    
    drawText(logoText, logoX, logoY);

    // Появление строк через 1 секунду
    if (bootTimer % 60 === 0 && bootIndex < bootLines.length - 1) {
      bootIndex++;
    }
    bootTimer++;

    const contentY = logoY + 90;
    bootLines.forEach((line, i) => {
      if (i <= bootIndex) {
        const opacity = i === bootIndex ? (bootTimer % 60) / 60 : 1;
        drawText(line, logoX - 30, contentY + i * (LINE_HEIGHT + 6), '#00FF41', opacity);
      }
    });

    // Переход к логину
    if (bootIndex >= bootLines.length - 1 && bootTimer > 60) {
      setTimeout(() => {
        currentScreen = screens.LOGIN;
        bootTimer = 0;
        bootIndex = -1;
      }, 500);
    }
  }

  function drawLogin() {
    ctx.clearRect(0, 0, vw, vh);

    const centerY = vh * 0.45;
    const fieldW = Math.min(400, vw * 0.8);
    const fieldH = 40;
    const labelOffset = 28;
    const fieldSpacing = 70;
    
    // Заголовок
    const title = 'ДОСТУП К ТЕРМИНАЛУ';
    drawText(title, (vw - measure(title)) / 2, centerY - 140);

    // USERNAME
    const userLabel = 'ИМЯ ПОЛЬЗОВАТЕЛЯ:';
    const userFieldX = (vw - fieldW) / 2;
    const userFieldY = centerY - 40;
    
    drawText(userLabel, userFieldX, userFieldY - labelOffset, '#00FF41', 0.8);
    
    ctx.strokeStyle = inputField === 'username' ? '#00FF88' : '#00FF41';
    ctx.lineWidth = inputField === 'username' ? 3 : 2;
    ctx.strokeRect(userFieldX, userFieldY, fieldW, fieldH);
    
    const userText = username + (cursorBlink % 30 < 15 && inputField === 'username' ? '█' : '');
    drawText(userText, userFieldX + 10, userFieldY + 10, '#FFFFFF', 1);

    // PASSWORD
    const passLabel = 'ПАРОЛЬ:';
    const passFieldX = (vw - fieldW) / 2;
    const passFieldY = centerY + 30;
    
    drawText(passLabel, passFieldX, passFieldY - labelOffset, '#00FF41', 0.8);
    
    ctx.strokeStyle = inputField === 'password' ? '#00FF88' : '#00FF41';
    ctx.lineWidth = inputField === 'password' ? 3 : 2;
    ctx.strokeRect(passFieldX, passFieldY, fieldW, fieldH);
    
    const masked = '*'.repeat(password.length);
    const passText = masked + (cursorBlink % 30 < 15 && inputField === 'password' ? '█' : '');
    drawText(passText, passFieldX + 10, passFieldY + 10, '#FFFFFF', 1);

    // КНОПКА
    const btnText = 'АУТЕНТИФИКАЦИЯ';
    const btnW = measure(btnText) + 60;
    const btnH = 38;
    const btnX = (vw - btnW) / 2;
    const btnY = centerY + 110;
    
    const hovered = isInRect(mouseX, mouseY, btnX, btnY, btnW, btnH);
    
    ctx.strokeStyle = hovered ? '#00FF88' : '#00FF41';
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    
    drawText(btnText, btnX + 30, btnY + 10, hovered ? '#00FF88' : '#00FF41', 1);

    // Сообщения
    if (errorMessage && errorTimer > 0) {
      drawText(errorMessage, (vw - measure(errorMessage)) / 2, centerY + 170, '#FF0000', 1);
      errorTimer--;
    }
    if (successMessage && successTimer > 0) {
      drawText(successMessage, (vw - measure(successMessage)) / 2, centerY + 170, '#00FF41', 1);
      successTimer--;
    }

    // Сохраняем области
    window.__inputAreas = {
      user: { x: userFieldX, y: userFieldY, w: fieldW, h: fieldH },
      pass: { x: passFieldX, y: passFieldY, w: fieldW, h: fieldH },
      btn: { x: btnX, y: btnY, w: btnW, h: btnH }
    };
  }

  // ======== ЦИКЛ ========
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

    if (currentScreen === screens.START && window.__btnArea) {
      const b = window.__btnArea;
      if (isInRect(x, y, b.x, b.y, b.w, b.h)) {
        currentScreen = screens.BOOT;
        bootTimer = 0;
        bootIndex = -1;
      }
    }

    if (currentScreen === screens.LOGIN && window.__inputAreas) {
      const a = window.__inputAreas;
      if (isInRect(x, y, a.user.x, a.user.y, a.user.w, a.user.h)) {
        inputField = 'username';
      } else if (isInRect(x, y, a.pass.x, a.pass.y, a.pass.w, a.pass.h)) {
        inputField = 'password';
      } else if (isInRect(x, y, a.btn.x, a.btn.y, a.btn.w, a.btn.h)) {
        authenticate();
      } else {
        inputField = null; // снимаем фокус
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  document.addEventListener('keydown', (e) => {
    if (currentScreen !== screens.LOGIN || isFrozen) return;
    
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputField === 'username' || inputField === 'password') {
        authenticate();
      }
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

  function authenticate() {
    if (username === 'qq' && password === 'ww') {
      successMessage = '> ВХОД УСПЕШНЫЙ';
      successTimer = 90;
      isFrozen = true;
      setTimeout(() => {
        document.body.style.transition = 'opacity 0.8s ease';
        document.body.style.opacity = '0';
        setTimeout(() => window.location.href = 'terminal.html', 800);
      }, 1000);
    } else {
      errorMessage = '> ДОСТУП ЗАПРЕЩЁН';
      errorTimer = 120;
      password = '';
    }
  }

  // ======== ИНИЦИАЛИЗАЦИЯ ========
  window.addEventListener('load', () => {
    // Убеждаемся, что glassFX под нами
    const glass = document.getElementById('glassFX');
    if (glass) {
      glass.style.zIndex = '1';
      glass.style.pointerEvents = 'none';
    }
  });
})();
