// index_canvas.js — исправленные хитбоксы, плавность, переход

(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE = 12;
  const LINE_HEIGHT = Math.round(FONT_SIZE * 1.45);
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const CANVAS_Z = 50;

  const canvas = document.createElement('canvas');
  canvas.id = 'indexCanvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    left: '0', top: '0',
    width: '100%', height: '100%',
    zIndex: CANVAS_Z,
    pointerEvents: 'auto'
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });

  let vw = 0, vh = 0;
  let mouseX = 0, mouseY = 0;
  let isHoveringButton = false;
  let glitchActive = false;
  let glitchTimer = 0;

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

  // Состояния
  const screens = { START: 'start', BOOT: 'boot', LOGIN: 'login' };
  let currentScreen = screens.START;
  let bootTextIndex = -1; // -1 = ещё не начали
  let bootTimer = 0;
  
  const logoText = `    \\    _ \\    \\     \\  | 
   _ \\   |  |  _ \\   |\\/ | 
 _/  _\\ ___/ _/  _\\ _|  _| `;

  const bootTexts = [
    '> ИНИЦИАЛИЗАЦИЯ ПРОТОКОЛА БЕЗОПАСНОСТИ A.D.A.M...',
    '> ЗАГРУЗКА ПОДСИСТЕМЫ VIGIL-9...',
    '> ТЕСТ ПАМЯТИ: УСПЕШНО',
    '> КРИПТОМОДУЛЬ: АКТИВИРОВАН',
    '> ПРЕДУПРЕЖДЕНИЕ: НЕСАНКЦИОНИРОВАННЫЙ ДОСТУП ЗАПРЕЩЁН',
    '> СИСТЕМА ГОТОВА'
  ];

  let username = '', password = '';
  let inputField = 'username';
  let cursorBlink = 0;
  let errorMessage = '';
  let errorTimer = 0;
  let successMessage = '';
  let successTimer = 0;

  // VHS-глитч
  let glitchOffset = 0;
  let glitchLines = [];
  
  function startGlitch() {
    glitchActive = true;
    glitchTimer = 30;
    glitchOffset = (Math.random() - 0.5) * 20;
    glitchLines = [];
    for (let i = 0; i < 8; i++) {
      glitchLines.push({
        y: Math.random() * vh,
        height: Math.random() * 3 + 1,
        offset: (Math.random() - 0.5) * 40
      });
    }
  }

  function updateGlitch() {
    if (glitchTimer > 0) {
      glitchTimer--;
      if (glitchTimer === 0) {
        glitchActive = false;
        glitchOffset = 0;
        glitchLines = [];
      }
    }
  }

  // Рисование
  function drawText(text, x, y, color = '#00FF41', opacity = 1) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    const lines = text.split('\n');
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * LINE_HEIGHT));
    ctx.restore();
  }

  function measureText(text) {
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    return ctx.measureText(text).width;
  }

  // Проверка ховера (ВАЖНО: используем CSS-пиксели, не DPR!)
  function checkHover(x, y, w, h) {
    return mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
  }

  // Экран старта
  function drawStartScreen() {
    if (glitchActive) {
      ctx.save();
      ctx.filter = `contrast(1.5) brightness(1.5) hue-rotate(${Math.random() * 30 - 15}deg)`;
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    // Логотип
    const logoWidth = measureText(logoText.split('\n')[0]);
    const logoX = (vw - logoWidth) / 2;
    const logoY = vh / 2 - 80;
    drawText(logoText, logoX, logoY);

    // Статус
    const statusText = '> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ';
    drawText(statusText, (vw - measureText(statusText)) / 2, logoY + 70);

    // Кнопка
    const btnText = 'ЗАПУСТИТЬ СИСТЕМУ';
    const btnWidth = measureText(btnText) + 40;
    const btnHeight = 40;
    const btnX = (vw - btnWidth) / 2;
    const btnY = logoY + 110;

    // Ховер (проверяем в CSS-пикселях!)
    isHoveringButton = checkHover(btnX, btnY, btnWidth, btnHeight);
    
    // Рамка
    ctx.strokeStyle = isHoveringButton ? '#00FF88' : '#00FF41';
    ctx.lineWidth = isHoveringButton ? 2 : 1;
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

    // Текст
    drawText(btnText, btnX + 20, btnY + 12, isHoveringButton ? '#00FF88' : '#00FF41');

    if (glitchActive) ctx.restore();

    // Сохраняем кнопку для кликов
    window.__buttonArea = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };
  }

  // Экран загрузки
  function drawBootScreen() {
    // Появление каждой строки строго через 1 секунду
    if (bootTimer % 60 === 0 && bootTextIndex < bootTexts.length - 1) {
      bootTextIndex++;
    }
    bootTimer++;

    // Плавное появление текущей строки
    const currentLineProgress = (bootTimer % 60) / 60;
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    // Логотип
    const logoWidth = measureText(logoText.split('\n')[0]);
    const logoX = (vw - logoWidth) / 2;
    const logoY = vh / 2 - 100;
    drawText(logoText, logoX, logoY);

    // Тексты (предыдущие строки — полностью видны, текущая — плавно)
    bootTexts.forEach((text, i) => {
      if (i < bootTextIndex) {
        drawText(text, logoX - 20, logoY + 70 + i * (LINE_HEIGHT + 5));
      } else if (i === bootTextIndex) {
        drawText(text, logoX - 20, logoY + 70 + i * (LINE_HEIGHT + 5), '#00FF41', currentLineProgress);
      }
    });

    // Переход к логину через 500ms после последней строки
    if (bootTextIndex >= bootTexts.length - 1 && bootTimer > 60) {
      setTimeout(() => {
        currentScreen = screens.LOGIN;
        bootTimer = 0;
        bootTextIndex = -1;
      }, 500);
    }
  }

  // Экран логина
  function drawLoginScreen() {
    // Глитч-эффект
    if (glitchActive) {
      ctx.save();
      ctx.filter = `contrast(1.5) brightness(1.5) hue-rotate(${Math.random() * 30 - 15}deg)`;
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    // Заголовок
    const title = 'ДОСТУП К ТЕРМИНАЛУ';
    drawText(title, (vw - measureText(title)) / 2, vh / 2 - 80);

    // Username
    const userLabel = 'ИМЯ ПОЛЬЗОВАТЕЛЯ:';
    const userFieldX = (vw - 260) / 2;
    const userFieldY = vh / 2 - 30;
    const userFieldW = 260;
    const userFieldH = 30;
    
    ctx.strokeStyle = inputField === 'username' ? '#00FF88' : '#00FF41';
    ctx.lineWidth = inputField === 'username' ? 2 : 1;
    ctx.strokeRect(userFieldX, userFieldY, userFieldW, userFieldH);

    drawText(userLabel, userFieldX, userFieldY - LINE_HEIGHT - 5);
    
    const userFieldText = `${username}${cursorBlink % 30 < 15 && inputField === 'username' ? '█' : ''}`;
    drawText(userFieldText, userFieldX + 5, userFieldY + 6, '#FFFFFF');

    // Password
    const passLabel = 'ПАРОЛЬ:';
    const passFieldX = (vw - 260) / 2;
    const passFieldY = vh / 2 + 10;
    const passFieldW = 260;
    const passFieldH = 30;
    
    ctx.strokeStyle = inputField === 'password' ? '#00FF88' : '#00FF41';
    ctx.lineWidth = inputField === 'password' ? 2 : 1;
    ctx.strokeRect(passFieldX, passFieldY, passFieldW, passFieldH);

    drawText(passLabel, passFieldX, passFieldY - LINE_HEIGHT - 5);
    
    const masked = '*'.repeat(password.length);
    const passFieldText = `${masked}${cursorBlink % 30 < 15 && inputField === 'password' ? '█' : ''}`;
    drawText(passFieldText, passFieldX + 5, passFieldY + 6, '#FFFFFF');

    // Кнопка
    const btnText = 'АУТЕНТИФИКАЦИЯ';
    const btnWidth = measureText(btnText) + 40;
    const btnHeight = 35;
    const btnX = (vw - btnWidth) / 2;
    const btnY = vh / 2 + 60;

    isHoveringButton = checkHover(btnX, btnY, btnWidth, btnHeight);
    
    ctx.strokeStyle = isHoveringButton ? '#00FF88' : '#00FF41';
    ctx.lineWidth = isHoveringButton ? 2 : 1;
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);
    drawText(btnText, btnX + 20, btnY + 10, isHoveringButton ? '#00FF88' : '#00FF41');

    // Сообщения
    if (errorMessage && errorTimer > 0) {
      drawText(errorMessage, (vw - measureText(errorMessage)) / 2, vh / 2 + 110, '#FF0000');
      errorTimer--;
    }

    if (successMessage && successTimer > 0) {
      drawText(successMessage, (vw - measureText(successMessage)) / 2, vh / 2 + 110, '#00FF41');
      successTimer--;
    }

    // Сохраняем области
    window.__buttonArea = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };
    window.__userFieldArea = { x: userFieldX, y: userFieldY, w: userFieldW, h: userFieldH };
    window.__passFieldArea = { x: passFieldX, y: passFieldY, w: passFieldW, h: passFieldH };

    if (glitchActive) ctx.restore();
  }

  // Главный цикл
  function render() {
    cursorBlink++;
    updateGlitch();
    
    switch(currentScreen) {
      case screens.START: drawStartScreen(); break;
      case screens.BOOT: drawBootScreen(); break;
      case screens.LOGIN: drawLoginScreen(); break;
    }
    requestAnimationFrame(render);
  }
  render();

  // Переходы
  window.__startBoot = () => {
    currentScreen = screens.BOOT;
    bootTextIndex = -1;
    bootTimer = 0;
  };

  window.__login = () => {
    if (username === 'qq' && password === 'ww') {
      successMessage = '> ВХОД УСПЕШНЫЙ';
      successTimer = 60;
      setTimeout(() => {
        document.body.style.transition = 'opacity 0.8s ease-in-out';
        document.body.style.opacity = '0';
        setTimeout(() => window.location.href = 'terminal.html', 800);
      }, 1000);
    } else {
      startGlitch();
      errorMessage = '> ДОСТУП ЗАПРЕЩЁН';
      errorTimer = 120;
      password = '';
    }
  };

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    const btn = window.__buttonArea;
    if (btn && mouseX >= btn.x && mouseX <= btn.x + btn.w && 
        mouseY >= btn.y && mouseY <= btn.y + btn.h) {
      if (currentScreen === screens.START) window.__startBoot();
      else if (currentScreen === screens.LOGIN) window.__login();
    }

    // Клик в поля
    if (currentScreen === screens.LOGIN) {
      if (checkHover(window.__userFieldArea.x, window.__userFieldArea.y, 
                     window.__userFieldArea.w, window.__userFieldArea.h)) {
        inputField = 'username';
      } else if (checkHover(window.__passFieldArea.x, window.__passFieldArea.y, 
                            window.__passFieldArea.w, window.__passFieldArea.h)) {
        inputField = 'password';
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  document.addEventListener('keydown', (e) => {
    if (currentScreen !== screens.LOGIN) return;
    
    if (e.key === 'Enter') {
      window.__login();
    } else if (e.key === 'Backspace') {
      inputField === 'username' ? username = username.slice(0, -1) : password = password.slice(0, -1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      inputField = inputField === 'username' ? 'password' : 'username';
    } else if (e.key.length === 1) {
      inputField === 'username' ? username += e.key : password += e.key;
    }
  });
})();
