// index_canvas.js — финальная версия с улучшенным UI и двойным глитчем
(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE = 12;
  const LINE_HEIGHT = Math.round(FONT_SIZE * 1.45);
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const NOISE_OPACITY_BASE = 0.0336;

  // === АНИМИРОВАННЫЙ ШУМ ===
  const noiseFrames = [];
  let noiseTick = 0;
  let glitchIntensity = 0;
  let localGlitchIntensity = 0; // Новый: локальный глитч для UI-элементов
  let exitFade = 0;

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
  let currentScreen = 'confirm';
  let bootTextIndex = 0;
  let bootTimer = 0;
  let secretCode = '';
  let codeInputFocused = false;
  let showErrorMessage = false;
  let showSuccessMessage = false; // Новый флаг
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

  function drawText(text, x, y, color = '#00FF41', opacity = 1, glitchOffset = 0) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'top';
    
    // Локальный глитч: RGB сдвиг
    if (glitchOffset > 0) {
      // Красный канал смещён влево
      ctx.fillStyle = 'rgba(255,0,0,0.8)';
      ctx.fillText(text, x - glitchOffset, y);
      // Зелёный канал смещён вправо
      ctx.fillStyle = 'rgba(0,255,0,0.8)';
      ctx.fillText(text, x + glitchOffset, y);
      // Синий канал смещён вверх
      ctx.fillStyle = 'rgba(0,0,255,0.8)';
      ctx.fillText(text, x, y - glitchOffset);
    }
    
    // Основной текст
    ctx.fillStyle = color;
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

  function triggerGlobalGlitch() {
    glitchIntensity = 1.0;
    showErrorMessage = true;
    messageTimer = 60;
    
    const fadeOut = () => {
      glitchIntensity = Math.max(0, glitchIntensity - 0.08);
      if (glitchIntensity > 0) requestAnimationFrame(fadeOut);
    };
    setTimeout(fadeOut, 150);
  }

  // Новая функция: локальный глитч для UI-элементов
  function triggerLocalGlitch() {
    localGlitchIntensity = 1.0;
    const fadeOut = () => {
      localGlitchIntensity = Math.max(0, localGlitchIntensity - 0.15);
      if (localGlitchIntensity > 0) requestAnimationFrame(fadeOut);
    };
    fadeOut();
  }

  function drawConfirmScreen() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    ctx.globalAlpha = NOISE_OPACITY_BASE * (1 - exitFade);
    const frame = noiseFrames[noiseTick % noiseFrames.length];
    ctx.drawImage(frame, 0, 0, vw, vh);
    ctx.restore();

    const logoText = `    \\    _ \\    \\     \\  | 
   _ \\   |  |  _ \\   |\\/ | 
 _/  _\\ ___/ _/  _\\ _|  _| `;
    
    const logoWidth = measureText(logoText.split('\n')[0]);
    const logoX = (vw - logoWidth) / 2;
    const logoY = vh / 2 - 90;
    drawText(logoText, logoX, logoY, '#00FF41', 1 - exitFade);

    const promptText = 'ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ';
    const promptX = (vw - measureText(promptText)) / 2;
    drawText(promptText, promptX, logoY + 70, '#00FF41', 0.9 * (1 - exitFade));

    const instruction = '[Y/Н] - ПОДТВЕРДИТЬ | [N/Т] - ОТМЕНА';
    const instructionX = (vw - measureText(instruction)) / 2;
    drawText(instruction, instructionX, logoY + 100, '#00FF41', 0.8 * (1 - exitFade));

    if (exitFade > 0.5) {
      const exitMsg = '> ДОСТУП ЗАПРЕЩЁН';
      drawText(exitMsg, (vw - measureText(exitMsg)) / 2, vh / 2, '#FF0000', (exitFade - 0.5) * 2);
    }
  }

  function drawBootScreen() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    ctx.globalAlpha = NOISE_OPACITY_BASE;
    const frame = noiseFrames[noiseTick % noiseFrames.length];
    ctx.drawImage(frame, 0, 0, vw, vh);
    ctx.restore();

    const logoText = `    \\    _ \\    \\     \\  | 
   _ \\   |  |  _ \\   |\\/ | 
 _/  _\\ ___/ _/  _\\ _|  _| `;
    
    const logoWidth = measureText(logoText.split('\n')[0]);
    const logoX = (vw - logoWidth) / 2;
    const logoY = vh / 2 - 100;
    drawText(logoText, logoX, logoY);

    if (bootTextIndex < bootTexts.length) {
      const textX = (vw - measureText(currentText)) / 2;
      const textY = logoY + 70;
      drawText(currentText, textX, textY);
    }
  }

  function drawCodeScreen() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    // === ГЛОБАЛЬНЫЙ ГЛИТЧ ===
    if (glitchIntensity > 0) {
      ctx.save();
      ctx.globalAlpha = glitchIntensity * 0.3;
      const offset = glitchIntensity * 3;
      ctx.fillStyle = 'rgba(255,0,0,0.5)';
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = glitchIntensity * 0.2;
      const frame = noiseFrames[noiseTick % noiseFrames.length];
      ctx.drawImage(frame, -offset, -offset, vw, vh);
      ctx.drawImage(frame, offset, offset, vw, vh);
      ctx.restore();
      
      ctx.save();
      ctx.globalAlpha = glitchIntensity * 0.6;
      const noiseFrame = noiseFrames[(noiseTick * 3) % noiseFrames.length];
      ctx.drawImage(noiseFrame, 0, 0, vw, vh);
      ctx.restore();
    }

    // Обычный шум
    ctx.save();
    ctx.globalAlpha = NOISE_OPACITY_BASE * (1 + glitchIntensity);
    const frame = noiseFrames[noiseTick % noiseFrames.length];
    ctx.drawImage(frame, 0, 0, vw, vh);
    ctx.restore();

    // === ВЫРОВНЕННЫЙ ЗАГОЛОВОК ===
    const title = 'ВХОД В ТЕРМИНАЛ';
    // Выравниваем по центру поля ввода (200px ширина)
    const titleX = (vw - measureText(title)) / 2;
    drawText(title, titleX, vh / 2 - 60, '#00FF41', 1, localGlitchIntensity);

    // === ПОЛЕ ВВОДА ===
    const codeFieldX = (vw - 200) / 2;
    const codeFieldY = vh / 2 - 20;
    const codeFieldW = 200;
    const codeFieldH = 30;
    
    // Мерцание поля при глитче
    const fieldColor = glitchIntensity > 0.5 ? '#FF0044' : (codeInputFocused ? '#00FF88' : '#00FF41');
    ctx.strokeStyle = fieldColor;
    ctx.lineWidth = codeInputFocused ? 2 : 1;
    ctx.strokeRect(codeFieldX, codeFieldY, codeFieldW, codeFieldH);
    
    // === ВЫРОВНЕННАЯ ПОДПИСЬ ===
    const labelText = 'СЕКРЕТНЫЙ КОД:';
    // Центрируем над полем ввода
    const labelX = codeFieldX + (codeFieldW - measureText(labelText)) / 2;
    drawText(labelText, labelX, codeFieldY - LINE_HEIGHT - 5, '#00FF41', 0.85, localGlitchIntensity);
    
    // Код с курсором
    const blinkSpeed = glitchIntensity > 0 ? 8 : 15;
    const codeFieldText = secretCode + (cursorBlink % blinkSpeed < blinkSpeed/2 ? '█' : '');
    drawText(codeFieldText, codeFieldX + 5, codeFieldY + 6, '#FFFFFF', 1, localGlitchIntensity);

    // === СООБЩЕНИЯ ===
    if (showErrorMessage && messageTimer > 0) {
      const msg = '> ДОСТУП ЗАПРЕЩЁН';
      drawText(msg, (vw - measureText(msg)) / 2, vh / 2 + 60, '#FF0000', 0.9 + glitchIntensity * 0.1);
      messageTimer--;
    }

    // === НОВОЕ: СООБЩЕНИЕ ОБ УСПЕХЕ ===
    if (showSuccessMessage) {
      const successMsg = '> УСПЕШНЫЙ ВХОД';
      drawText(successMsg, (vw - measureText(successMsg)) / 2, vh / 2 + 60, '#00FF41', 1);
    }
  }

  function updateBootAnimation() {
    if (currentScreen !== 'boot' || bootTextIndex >= bootTexts.length) return;
    
    const targetText = bootTexts[bootTextIndex];
    
    if (bootTimer % 2 === 0 && currentCharIndex < targetText.length) {
      if (Math.random() > 0.5) {
        const randomChar = randomChars.charAt(Math.floor(Math.random() * randomChars.length));
        currentText = targetText.substring(0, currentCharIndex) + randomChar;
      }
      currentText = targetText.substring(0, currentCharIndex + 1);
      currentCharIndex++;
    }
    
    if (currentCharIndex >= targetText.length && bootTimer % 35 === 0) {
      bootTextIndex++;
      currentCharIndex = 0;
      currentText = '';
      
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
    
    updateBootAnimation();
    
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
        const fadeOut = () => {
          exitFade += 0.04;
          if (exitFade < 1) {
            requestAnimationFrame(fadeOut);
          } else {
            setTimeout(() => {
              window.location.href = 'about:blank';
            }, 2000);
          }
        };
        fadeOut();
      }
    } else if (currentScreen === 'code' && codeInputFocused) {
      if (e.key === 'Enter') {
        if (secretCode === 'test') {
          // Запускаем локальный глитч для UI-элементов
          triggerLocalGlitch();
          
          // Показываем сообщение об успехе
          showSuccessMessage = true;
          
          // Плавный переход через 1.5 секунды
          setTimeout(() => {
            document.body.style.transition = 'opacity 0.8s ease-in-out';
            document.body.style.opacity = '0';
          }, 800);
          
          setTimeout(() => {
            window.location.href = 'terminal.html';
          }, 1600);
        } else {
          triggerGlobalGlitch();
          triggerLocalGlitch(); // Дополнительный локальный глитч
          secretCode = '';
        }
      } else if (e.key === 'Backspace') {
        secretCode = secretCode.slice(0, -1);
      } else if (e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
        secretCode += e.key;
      }
    }
  });

  render();
})();
