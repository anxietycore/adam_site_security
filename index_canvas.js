// index_canvas.js — простая версия без зависаний
(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE = 12;
  const LINE_HEIGHT = Math.round(FONT_SIZE * 1.45);
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const NOISE_OPACITY_BASE = 0.0336; // 0.28 × 0.12

  // === АНИМИРОВАННЫЙ ШУМ ===
  const noiseFrames = [];
  let noiseTick = 0;
  
  function generateNoiseFrames() {
    const fw = Math.max(256, Math.floor(vw * 0.8));
    const fh = Math.max(256, Math.floor(vh * 0.8));
    noiseFrames.length = 0;
    
    for (let f = 0; f < 8; f++) {
      const c = document.createElement('canvas');
      c.width = fw;
      c.height = fh;
      const nctx = c.getContext('2d');
      const img = nctx.createImageData(fw, fh);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255;
        d[i] = d[i+1] = d[i+2] = v;
        d[i+3] = 255;
      }
      nctx.putImageData(img, 0, 0);
      noiseFrames.push(c);
    }
  }

  // === Canvas setup ===
  const canvas = document.createElement('canvas');
  canvas.id = 'indexCanvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    left: '0', top: '0',
    width: '100%', height: '100%',
    zIndex: '50',
    pointerEvents: 'auto'
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });

  let vw = 0, vh = 0;
  let mouseX = 0, mouseY = 0;
  let currentScreen = 'confirm'; // confirm, boot, code
  let bootTextIndex = 0;
  let bootTimer = 0;
  let secretCode = '';
  let codeInputFocused = false;
  let showErrorMessage = false;
  let messageTimer = 0;
  let cursorBlink = 0;
  let currentText = '';
  let currentCharIndex = 0;
  let randomChars = '01#$%&*+-=?@[]{}<>~^';

  function resize() {
    vw = Math.max(320, window.innerWidth);
    vh = Math.max(240, window.innerHeight);
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    generateNoiseFrames();
  }
  window.addEventListener('resize', resize);
  resize();

  // Строчки загрузки
  const bootTexts = [
    '> ИНИЦИАЛИЗАЦИЯ КВАНТОВЫХ ЯДЕР...',
    '> СИНХРОНИЗАЦИЯ ВРЕМЕННЫХ СВЯЗЕЙ...',
    '> АКТИВАЦИЯ НЕЙРОИНТЕРФЕЙСА...',
    '> ЗАПУСК ПРОТОКОЛА THETA-7...',
    '> УСТАНОВКА СЕТИ НАБЛЮДЕНИЯ...',
    '> ДЕКОДИРОВАНИЕ ПРОТОКОЛОВ...',
    '> ПОДКЛЮЧЕНИЕ К СОЗНАНИЮ A.D.A.M...',
    '> ФИНАЛИЗАЦИЯ ПАРАМЕТРОВ ДОСТУПА...'
  ];

  function drawText(text, x, y, color = '#00FF41', opacity = 1) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    text.split('\n').forEach((line, i) => ctx.fillText(line, x, y + i * LINE_HEIGHT));
    ctx.restore();
  }

  function measureText(text) {
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    return ctx.measureText(text).width;
  }

  function startBootSequence() {
    currentScreen = 'boot';
    bootTextIndex = 0;
    currentText = '';
    currentCharIndex = 0;
    bootTimer = 0;
  }

  function drawConfirmScreen() {
    // Фон
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    // Шум (без пульсации!)
    ctx.save();
    ctx.globalAlpha = NOISE_OPACITY_BASE;
    const frame = noiseFrames[noiseTick % noiseFrames.length];
    ctx.drawImage(frame, 0, 0, vw, vh);
    ctx.restore();

    // Логотип
    const logoText = `    \\    _ \\    \\     \\  | 
   _ \\   |  |  _ \\   |\\/ | 
 _/  _\\ ___/ _/  _\\ _|  _| `;
    
    const logoWidth = measureText(logoText.split('\n')[0]);
    const logoX = (vw - logoWidth) / 2;
    const logoY = vh / 2 - 90;
    drawText(logoText, logoX, logoY, '#00FF41', 1);

    // Приглашение
    const promptText = 'ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ';
    const promptX = (vw - measureText(promptText)) / 2;
    drawText(promptText, promptX, logoY + 70, '#00FF41', 0.9);

    // Инструкция
    const instruction = '[Y/Н] - ПОДТВЕРДИТЬ | [N/Т] - ОТМЕНА';
    const instructionX = (vw - measureText(instruction)) / 2;
    drawText(instruction, instructionX, logoY + 100, '#00FF41', 0.8);
  }

  function drawBootScreen() {
    // Фон
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    // Шум (без пульсации)
    ctx.save();
    ctx.globalAlpha = NOISE_OPACITY_BASE;
    const frame = noiseFrames[noiseTick % noiseFrames.length];
    ctx.drawImage(frame, 0, 0, vw, vh);
    ctx.restore();

    // Логотип
    const logoText = `    \\    _ \\    \\     \\  | 
   _ \\   |  |  _ \\   |\\/ | 
 _/  _\\ ___/ _/  _\\ _|  _| `;
    
    const logoWidth = measureText(logoText.split('\n')[0]);
    const logoX = (vw - logoWidth) / 2;
    const logoY = vh / 2 - 100;
    drawText(logoText, logoX, logoY);

    // Текущая строка загрузки
    if (bootTextIndex < bootTexts.length) {
      const textX = (vw - measureText(currentText)) / 2;
      const textY = logoY + 70;
      drawText(currentText, textX, textY);
    }
  }

  function drawCodeScreen() {
    // Фон
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    // Шум (без пульсации)
    ctx.save();
    ctx.globalAlpha = NOISE_OPACITY_BASE;
    const frame = noiseFrames[noiseTick % noiseFrames.length];
    ctx.drawImage(frame, 0, 0, vw, vh);
    ctx.restore();

    // Заголовок
    const title = 'ВХОД В ТЕРМИНАЛ';
    drawText(title, (vw - measureText(title)) / 2, vh / 2 - 60);

    // Поле ввода
    const codeFieldX = (vw - 200) / 2;
    const codeFieldY = vh / 2 - 20;
    const codeFieldW = 200;
    const codeFieldH = 30;
    
    ctx.strokeStyle = codeInputFocused ? '#00FF88' : '#00FF41';
    ctx.lineWidth = codeInputFocused ? 2 : 1;
    ctx.strokeRect(codeFieldX, codeFieldY, codeFieldW, codeFieldH);
    
    drawText('СЕКРЕТНЫЙ КОД:', codeFieldX, codeFieldY - LINE_HEIGHT - 5, '#00FF41', 0.85);
    
    // Код с курсором
    const codeFieldText = secretCode + (cursorBlink % 30 < 15 ? '█' : '');
    drawText(codeFieldText, codeFieldX + 5, codeFieldY + 6, '#FFFFFF');

    // Сообщение об ошибке
    if (showErrorMessage && messageTimer > 0) {
      const msg = '> ДОСТУП ЗАПРЕЩЁН';
      drawText(msg, (vw - measureText(msg)) / 2, vh / 2 + 60, '#FF0000', 0.9);
      messageTimer--;
    }
  }

  function updateBootAnimation() {
    if (currentScreen !== 'boot' || bootTextIndex >= bootTexts.length) return;
    
    const targetText = bootTexts[bootTextIndex];
    
    if (bootTimer % 2 === 0 && currentCharIndex < targetText.length) {
      // Рандомный символ перед правильным
      if (Math.random() > 0.5) {
        const randomChar = randomChars.charAt(Math.floor(Math.random() * randomChars.length));
        currentText = targetText.substring(0, currentCharIndex) + randomChar;
      }
      // Правильный символ (в 5 раз быстрее)
      currentText = targetText.substring(0, currentCharIndex + 1);
      currentCharIndex++;
    }
    
    if (currentCharIndex >= targetText.length && bootTimer % 35 === 0) {
      // Переход к следующей строке
      bootTextIndex++;
      currentCharIndex = 0;
      currentText = '';
      
      // Если все строки отображены - переход к коду
      if (bootTextIndex >= bootTexts.length) {
        setTimeout(() => {
          currentScreen = 'code';
          codeInputFocused = true;
        }, 300);
      }
    }
    
    bootTimer++;
  }

  function render() {
    cursorBlink++;
    noiseTick++;
    
    // Обновление анимации загрузки
    updateBootAnimation();
    
    // Отрисовка текущего экрана
    switch(currentScreen) {
      case 'confirm': drawConfirmScreen(); break;
      case 'boot': drawBootScreen(); break;
      case 'code': drawCodeScreen(); break;
    }
    
    requestAnimationFrame(render);
  }

  document.addEventListener('keydown', (e) => {
    if (currentScreen === 'confirm') {
      if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') {
        startBootSequence();
      } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
        try { window.close(); } catch (err) { location.reload(); }
      }
    } else if (currentScreen === 'code' && codeInputFocused) {
      if (e.key === 'Enter') {
        // Проверка кода
        if (secretCode === 'test') {
          document.body.style.transition = 'opacity 0.8s ease-in-out';
          document.body.style.opacity = '0';
          setTimeout(() => window.location.href = 'terminal.html', 800);
        } else {
          // Простой глитч при ошибке
          showErrorMessage = true;
          messageTimer = 60;
          secretCode = '';
        }
      } else if (e.key === 'Backspace') {
        secretCode = secretCode.slice(0, -1);
      } else if (e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
        secretCode += e.key;
      }
    }
  });

  // Начало анимации
  render();
})();
