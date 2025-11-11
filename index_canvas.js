// index_canvas_final.js — ЕДИНЫЙ файл: шум + UI + изгиб + события
(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 14;
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.5);
  const FIELD_PADDING = 12;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const NOISE_DPR = Math.min(DPR, 1.25);

  // === КОНФИГ НАСТРОЙКИ (меняйте тут, если что-то не нравится) ===
  const CONFIG = {
    noiseOpacity: 0.12,      // Если слишком ярко — уменьшите до 0.08
    noiseBrightness: { min: 40, max: 120 }, // Диапазон цвета шума
    glitchDuration: 1000,    // Длительность глитча в ms
    uiColor: '#00FF41',
    uiHoverColor: '#00FF88',
    uiErrorColor: '#FF4444'
  };

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
  let inputField = null;
  let cursorBlink = 0;

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

  // === ШУМ (встроенный) ===
  const noise = {
    frames: [], fw: 0, fh: 0, t: 0, scratch: null,
    init(w, h) {
      this.fw = Math.floor(w * 0.8);
      this.fh = Math.floor(h * 0.8);
      for (let f = 0; f < 15; f++) {
        const c = document.createElement('canvas');
        c.width = this.fw; c.height = this.fh;
        const nctx = c.getContext('2d');
        const img = nctx.createImageData(this.fw, this.fh);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const n = CONFIG.noiseBrightness.min + Math.random() * (CONFIG.noiseBrightness.max - CONFIG.noiseBrightness.min);
          d[i] = d[i + 1] = d[i + 2] = n;
          d[i + 3] = 255;
        }
        nctx.putImageData(img, 0, 0);
        this.frames.push(c);
      }
      const sc = document.createElement('canvas');
      const sctx = sc.getContext('2d');
      sc.width = w; sc.height = h;
      for (let i = 0; i < w * h * 0.00065; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const l = Math.random() * 40 + 20;
        const o = Math.random() * 0.018 + 0.01;
        sctx.beginPath(); sctx.moveTo(x, y); sctx.lineTo(x, y + l);
        sctx.strokeStyle = `rgba(255,255,255,${o})`;
        sctx.lineWidth = 0.5 * NOISE_DPR;
        sctx.stroke();
      }
      this.scratch = sc;
    },
    render(ctx, w, h) {
      const g = ctx.createRadialGradient(w/2, h/2, h*0.1, w/2, h/2, h*0.8);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      const cycle = 720;
      const phase = this.t % cycle;
      let spike = 1.0;
      if (phase < 180) spike = 1 + phase / 180;
      else if (phase < 360) spike = 2 - (phase - 180) / 180;

      const frame = this.frames[Math.floor(this.t / 4) % 15];
      ctx.globalAlpha = CONFIG.noiseOpacity * spike;
      ctx.drawImage(frame, 0, 0, w, h);
      ctx.globalAlpha = 1;

      const offY = (this.t * 0.4) % h;
      ctx.drawImage(this.scratch, 0, offY - h, w, h);
      ctx.drawImage(this.scratch, 0, offY, w, h);

      const fl = 0.4 + Math.sin(this.t / 50) * 0.05;
      const lamp = ctx.createRadialGradient(w/2, 0, h*0.05, w/2, 0, h*0.6);
      lamp.addColorStop(0, `rgba(255,255,255,${0.04 * fl})`);
      lamp.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);

      this.t++;
    }
  };

  function resize() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    noise.init(canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  function drawText(text, x, y, color = CONFIG.uiColor, opacity = 1) {
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

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const UI_COLORS = {
    base: CONFIG.uiColor,
    hover: CONFIG.uiHoverColor,
    error: CONFIG.uiErrorColor,
    bg: 'rgba(0, 255, 65, 0.08)',
    bgHover: 'rgba(0, 255, 65, 0.15)'
  };

  function drawStart() {
    ctx.clearRect(0, 0, vw, vh);
    noise.render(ctx, canvas.width, canvas.height);

    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.35;
    drawText(logo, logoX, logoY);

    const statusY = logoY + 90;
    drawText('> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ', (vw - measure('> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ')) / 2, statusY);

    const btnText = 'ЗАПУСТИТЬ СИСТЕМУ';
    const btnW = measure(btnText) + 60;
    const btnH = 45;
    const btnX = (vw - btnW) / 2;
    const btnY = statusY + 60;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);
    
    ctx.save();
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fillStyle = hovered ? UI_COLORS.bgHover : UI_COLORS.bg;
    ctx.fill();
    
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeStyle = hovered ? UI_COLORS.hover : UI_COLORS.base;
    ctx.stroke();
    ctx.restore();
    
    drawText(btnText, btnX + 30, btnY + 12, hovered ? UI_COLORS.hover : UI_COLORS.base);

    window.__clickZones = { startBtn: { x: btnX, y: btnY, w: btnW, h: btnH } };
  }

  function drawBoot() {
    ctx.clearRect(0, 0, vw, vh);
    noise.render(ctx, canvas.width, canvas.height);

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
        drawText(line, logoX - 30, contentY + i * (LINE_HEIGHT + 5), CONFIG.uiColor, opacity);
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
    noise.render(ctx, canvas.width, canvas.height);

    const centerY = vh * 0.45;
    const fieldW = Math.min(420, vw - 100);
    const fieldH = 42;
    const labelDy = -FIELD_PADDING - 5;

    const title = 'ДОСТУП К ТЕРМИНАЛУ';
    drawText(title, (vw - measure(title)) / 2, centerY - 120);

    const userX = (vw - fieldW) / 2;
    const userY = centerY - 30;
    drawText('ИМЯ ПОЛЬЗОВАТЕЛЯ:', userX, userY + labelDy, UI_COLORS.base, 0.85);
    
    ctx.save();
    const userHovered = inRect(mouseX, mouseY, userX, userY, fieldW, fieldH) || inputField === 'username';
    roundRect(ctx, userX, userY, fieldW, fieldH, 6);
    ctx.fillStyle = userHovered ? UI_COLORS.bgHover : UI_COLORS.bg;
    ctx.fill();
    
    ctx.lineWidth = userHovered ? 3 : 2;
    ctx.strokeStyle = userHovered ? UI_COLORS.hover : UI_COLORS.base;
    ctx.stroke();
    ctx.restore();
    
    const userText = username + (cursorBlink % 30 < 15 && inputField === 'username' ? '█' : '');
    drawText(userText, userX + FIELD_PADDING, userY + 10, '#FFFFFF');

    const passX = (vw - fieldW) / 2;
    const passY = centerY + 40;
    drawText('ПАРОЛЬ:', passX, passY + labelDy, UI_COLORS.base, 0.85);
    
    ctx.save();
    const passHovered = inRect(mouseX, mouseY, passX, passY, fieldW, fieldH) || inputField === 'password';
    roundRect(ctx, passX, passY, fieldW, fieldH, 6);
    ctx.fillStyle = passHovered ? UI_COLORS.bgHover : UI_COLORS.bg;
    ctx.fill();
    
    ctx.lineWidth = passHovered ? 3 : 2;
    ctx.strokeStyle = passHovered ? UI_COLORS.hover : UI_COLORS.base;
    ctx.stroke();
    ctx.restore();
    
    const masked = '*'.repeat(password.length);
    const passText = masked + (cursorBlink % 30 < 15 && inputField === 'password' ? '█' : '');
    drawText(passText, passX + FIELD_PADDING, passY + 10, '#FFFFFF');

    const btnText = 'АУТЕНТИФИКАЦИЯ';
    const btnW = measure(btnText) + 60;
    const btnH = 38;
    const btnX = (vw - btnW) / 2;
    const btnY = centerY + 100;
    const btnHovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);
    
    ctx.save();
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fillStyle = btnHovered ? UI_COLORS.bgHover : UI_COLORS.bg;
    ctx.fill();
    
    ctx.lineWidth = btnHovered ? 3 : 2;
    ctx.strokeStyle = btnHovered ? UI_COLORS.hover : UI_COLORS.base;
    ctx.stroke();
    ctx.restore();
    
    drawText(btnText, btnX + 30, btnY + 10, btnHovered ? UI_COLORS.hover : UI_COLORS.base);

    if (errorMsg && errorTimer > 0) {
      drawText(errorMsg, (vw - measure(errorMsg)) / 2, centerY + 160, UI_COLORS.error);
      errorTimer--;
      if (errorTimer === errorMsg.length * 2 + 5) {
        document.body.classList.add('glitch-active');
        setTimeout(() => document.body.classList.remove('glitch-active'), CONFIG.glitchDuration);
      }
    }
    if (successMsg && successTimer > 0) {
      drawText(successMsg, (vw - measure(successMsg)) / 2, centerY + 160, UI_COLORS.base);
      successTimer--;
    }

    window.__clickZones = {
      userField: { x: userX, y: userY, w: fieldW, h: fieldH },
      passField: { x: passX, y: passY, w: fieldW, h: fieldH },
      authBtn: { x: btnX, y: btnY, w: btnW, h: btnH }
    };
  }

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

  // === СОБЫТИЯ (100% работают, т.к. нет overlay) ===
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentScreen === screens.START && window.__clickZones?.startBtn) {
      const b = window.__clickZones.startBtn;
      if (inRect(x, y, b.x, b.y, b.w, b.h)) currentScreen = screens.BOOT;
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
      cursorBlink = 0;
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
      cursorBlink = 0;
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
      document.body.classList.add('glitch-active');
      setTimeout(() => document.body.classList.remove('glitch-active'), CONFIG.glitchDuration);
    }
  }
})();
