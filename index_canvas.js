// index_canvas.js — финальная версия с ОБЕИМИ функциями
(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE = 12;
  const LINE_HEIGHT = Math.round(FONT_SIZE * 1.45);
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const NOISE_OPACITY_BASE = 0.0336;
  const MAX_CODE_LENGTH = 12;

  // === АНИМИРОВАННЫЙ ШУМ ===
  const noiseFrames = [];
  let noiseTick = 0;
  let glitchIntensity = 0;
  let localGlitchIntensity = 0;
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
  let showSuccessMessage = false;
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

  // === БАЗОВАЯ функция рисования (для обычного текста) ===
  function drawText(text, x, y, color = '#00FF41', opacity = 1) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    text.split('\n').forEach((line, i) => ctx.fillText(line, x, y + i * LINE_HEIGHT));
    ctx.restore();
  }

  // === ГЛИТЧ-функция для UI-элементов (отдельный эффект) ===
  function drawGlitchText(text, x, y, color = '#00FF41', opacity = 1, intensity = 0) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'top';
    
    if (intensity > 0) {
      // RGB-сдвиг с дрожанием
      const offset = intensity * 2.5;
      
      ctx.fillStyle = 'rgba(255,0,0,0.9)';
      ctx.fillText(text, x - offset + Math.random()*2, y + Math.random()*2);
      
      ctx.fillStyle = 'rgba(0,255,0,0.9)';
      ctx.fillText(text, x + offset + Math.random()*2, y - Math.random()*2);
      
      ctx.fillStyle = 'rgba(0,100,255,0.9)';
      ctx.fillText(text, x + Math.random()*2, y - offset);
    }
    
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
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

  function triggerLocalGlitch() {
    localGlitchIntensity = 1.0;
    const fadeOut = () => {
      localGlitchIntensity = Math.max(0, localGlitchIntensity - 0.15);
      if (localGlitchIntensity > 0) requestAnimationFrame(fadeOut);
    };
    setTimeout(fadeOut, 100);
  }

  function drawConfirmScreen() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    ctx.clearRect(0, 0, vw, vh); // Фикс наложения
    
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

    // Глобальный глитч
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

    // Базовый шум
    ctx.save();
    ctx.globalAlpha = NOISE_OPACITY_BASE * (1 + glitchIntensity);
    const frame = noiseFrames[noiseTick % noiseFrames.length];
    ctx.drawImage(frame, 0, 0, vw, vh);
    ctx.restore();

    // === UI-ЭЛЕМЕНТЫ с ЛОКАЛЬНЫМ ГЛИТЧЕМ ===
    const fieldWidth = 200;
    const fieldX = (vw - fieldWidth) / 2;
    const fieldY = vh / 2 - 20;

    // Заголовок (глитч)
    const title = 'ВХОД В ТЕРМИНАЛ';
    const titleX = (vw - measureText(title)) / 2;
    drawGlitchText(title, titleX, fieldY - 60, '#00FF41', 1, localGlitchIntensity);

    // Подпись (глитч)
    const labelText = 'СЕКРЕТНЫЙ КОД:';
    const labelX = fieldX + (fieldWidth - measureText(labelText)) / 2;
    drawGlitchText(labelText, labelX, fieldY - LINE_HEIGHT - 8, '#00FF41', 0.85, localGlitchIntensity);

    // Поле
    const fieldColor = glitchIntensity > 0.5 ? '#FF0044' : (codeInputFocused ? '#00FF88' : '#00FF41');
    ctx.strokeStyle = fieldColor;
    ctx.lineWidth = codeInputFocused ? 2 : 1;
    ctx.strokeRect(fieldX, fieldY, fieldWidth, 30);

    // Текст в поле (ограниченный, с глитчем)
    const displayCode = secretCode.slice(-MAX_CODE_LENGTH);
    const blinkSpeed = glitchIntensity > 0 ? 8 : 15;
    const codeWithCursor = displayCode + (cursorBlink % blinkSpeed < blinkSpeed/2 ? '█' : '');
    drawGlitchText(codeWithCursor, fieldX + 5, fieldY + 6, '#FFFFFF', 1, localGlitchIntensity);

    // Сообщения
    if (showErrorMessage && messageTimer > 0) {
      const msg = '> ДОСТУП ЗАПРЕЩЁН';
      drawText(msg, (vw - measureText(msg)) / 2, fieldY + 50, '#FF0000', 0.9 + glitchIntensity * 0.1);
      messageTimer--;
    }

    if (showSuccessMessage) {
      const successMsg = '> УСПЕШНЫЙ ВХОД';
      drawText(successMsg, (vw - measureText(successMsg)) / 2, fieldY + 50, '#00FF41', 1);
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
          triggerLocalGlitch();
          showSuccessMessage = true;
          
          setTimeout(() => {
            document.body.style.transition = 'opacity 0.8s ease-in-out';
            document.body.style.opacity = '0';
          }, 800);
          
          setTimeout(() => {
            window.location.href = 'terminal.html';
          }, 1600);
        } else {
          triggerGlobalGlitch();
          triggerLocalGlitch(); // <-- ВОТ ЭТОТ ВЫЗОВ ДЛЯ UI-ГЛИТЧА
          secretCode = '';
        }
      } else if (e.key === 'Backspace') {
        secretCode = secretCode.slice(0, -1);
      } else if (e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
        if (secretCode.length < MAX_CODE_LENGTH) {
          secretCode += e.key;
        }
      }
    }
  });

  render();
})();
