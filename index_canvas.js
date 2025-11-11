// index_canvas.js — полностью canvas-рендеринг для index.html

(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE = 12;
  const LINE_HEIGHT = Math.round(FONT_SIZE * 1.45);
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const CANVAS_Z = 50;

  // Canvas
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

  // Размеры
  let vw = 0, vh = 0;

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

  // Состояние
  const screens = {
    START: 'start',
    BOOT: 'boot',
    LOGIN: 'login'
  };
  
  let currentScreen = screens.START;
  let bootTextIndex = 0;
  let bootTimer = null;
  let typingTimer = null;

  // Данные
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

  // Ввод
  let username = '';
  let password = '';
  let inputField = 'username'; // 'username' или 'password'
  let cursorBlink = 0;
  let errorMessage = '';
  let errorTimer = 0;

  // Рисование текста
  function drawText(text, x, y, color = '#00FF41') {
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    
    // Разбиваем на строки
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y + i * LINE_HEIGHT);
    });
  }

  function measureText(text) {
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    return ctx.measureText(text).width;
  }

  // Экран старта
  function drawStartScreen() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    // Логотип
    const logoWidth = measureText(logoText.split('\n')[0]);
    const logoX = (vw - logoWidth) / 2;
    const logoY = vh / 2 - 80;
    drawText(logoText, logoX, logoY);

    // Текст
    const text = '> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ';
    const textWidth = measureText(text);
    drawText(text, (vw - textWidth) / 2, logoY + 70);

    // Кнопка
    const btnText = 'ЗАПУСТИТЬ СИСТЕМУ';
    const btnWidth = measureText(btnText) + 40;
    const btnHeight = 40;
    const btnX = (vw - btnWidth) / 2;
    const btnY = logoY + 110;

    // Рамка кнопки
    ctx.strokeStyle = '#00FF41';
    ctx.lineWidth = 1;
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

    // Текст кнопки
    drawText(btnText, btnX + 20, btnY + 12);

    // Интерактивная область
    window.__buttonArea = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };
  }

  // Экран загрузки
  function drawBootScreen() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    // Логотип
    const logoWidth = measureText(logoText.split('\n')[0]);
    const logoX = (vw - logoWidth) / 2;
    const logoY = vh / 2 - 100;
    drawText(logoText, logoX, logoY);

    // Тексты загрузки
    bootTexts.forEach((text, i) => {
      if (i <= bootTextIndex) {
        drawText(text, logoX - 20, logoY + 70 + i * (LINE_HEIGHT + 5));
      }
    });
  }

  // Экран логина
  function drawLoginScreen() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    // Заголовок
    const title = 'ДОСТУП К ТЕРМИНАЛУ';
    const titleWidth = measureText(title);
    drawText(title, (vw - titleWidth) / 2, vh / 2 - 80);

    // Username
    const userLabel = 'ИМЯ ПОЛЬЗОВАТЕЛЯ:';
    drawText(userLabel, (vw - 260) / 2, vh / 2 - 30);
    
    const userField = `_ ${username}${cursorBlink % 30 < 15 && inputField === 'username' ? '█' : ''}`;
    drawText(userField, (vw - 260) / 2 + measureText(userLabel) + 10, vh / 2 - 30, '#FFFFFF');

    // Password
    const passLabel = 'ПАРОЛЬ:';
    drawText(passLabel, (vw - 260) / 2, vh / 2 + 10);
    
    const masked = '*'.repeat(password.length);
    const passField = `_ ${masked}${cursorBlink % 30 < 15 && inputField === 'password' ? '█' : ''}`;
    drawText(passField, (vw - 260) / 2 + measureText(passLabel) + 10, vh / 2 + 10, '#FFFFFF');

    // Кнопка входа
    const btnText = 'АУТЕНТИФИКАЦИЯ';
    const btnWidth = measureText(btnText) + 40;
    const btnHeight = 35;
    const btnX = (vw - btnWidth) / 2;
    const btnY = vh / 2 + 60;

    ctx.strokeStyle = '#00FF41';
    ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);
    drawText(btnText, btnX + 20, btnY + 10);

    // Ошибка
    if (errorMessage && errorTimer > 0) {
      drawText(errorMessage, (vw - measureText(errorMessage)) / 2, vh / 2 + 110, '#FF0000');
      errorTimer--;
    }

    window.__buttonArea = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };
  }

  // Главный рендер
  function render() {
    cursorBlink++;
    
    switch(currentScreen) {
      case screens.START:
        drawStartScreen();
        break;
      case screens.BOOT:
        drawBootScreen();
        break;
      case screens.LOGIN:
        drawLoginScreen();
        break;
    }
    
    requestAnimationFrame(render);
  }
  render();

  // Переходы
  window.__startBoot = function() {
    currentScreen = screens.BOOT;
    bootTextIndex = 0;
    
    bootTimer = setInterval(() => {
      bootTextIndex++;
      if (bootTextIndex >= bootTexts.length) {
        clearInterval(bootTimer);
        setTimeout(() => {
          currentScreen = screens.LOGIN;
          inputField = 'username';
        }, 1000);
      }
    }, 1000);
  };

  window.__login = function() {
    if (username === 'qq' && password === 'ww') {
      document.body.style.transition = 'opacity 0.8s ease-in-out';
      document.body.style.opacity = '0';
      setTimeout(() => window.location.href = 'terminal.html', 800);
    } else {
      errorMessage = 'ДОСТУП ЗАПРЕЩЁН';
      errorTimer = 120;
      password = '';
    }
  };

  // Клики
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentScreen === screens.START) {
      const btn = window.__buttonArea;
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        window.__startBoot();
      }
    } else if (currentScreen === screens.LOGIN) {
      const btn = window.__buttonArea;
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        window.__login();
      }
    }
  });

  // Клавиатура
  document.addEventListener('keydown', (e) => {
    if (currentScreen !== screens.LOGIN) return;

    if (e.key === 'Enter') {
      window.__login();
    } else if (e.key === 'Backspace') {
      if (inputField === 'username') {
        username = username.slice(0, -1);
      } else {
        password = password.slice(0, -1);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      inputField = inputField === 'username' ? 'password' : 'username';
    } else if (e.key.length === 1) {
      if (inputField === 'username') {
        username += e.key;
      } else {
        password += e.key;
      }
    }
  });
})();
