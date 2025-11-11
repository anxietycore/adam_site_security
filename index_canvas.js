// index_canvas.js — логика, хитбоксы, плавность, шум-фон и глитч
(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 13;
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.45);
  const FIELD_PADDING = 12;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  const canvas = document.createElement('canvas');
  canvas.id = 'indexCanvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    left: '0', top: '0',
    width: '100%', height: '100%',
    zIndex: '10',          // оставляем под overlay
    pointerEvents: 'none', // НЕ получать реальные pointer-события от браузера
    userSelect: 'none',
    display: 'block',
    opacity: '0'           // прячем оригинал (визуально), но он нужен для логики и как источник текстуры
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });

  // tiny noise canvas for performance (scaled up)
  const noiseW = 160, noiseH = 90;
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = noiseW;
  noiseCanvas.height = noiseH;
  const noiseCtx = noiseCanvas.getContext('2d');

  let vw = 0, vh = 0;
  let mouseX = 9999, mouseY = 9999; // updated via synthetic events from overlay
  let inputField = null;
  let cursorBlink = 0;

  const screens = { START: 'start', BOOT: 'boot', LOGIN: 'login' };
  let currentScreen = screens.START;
  let username = '', password = '';
  let bootTimer = 0, bootIndex = -1;
  let bootOpacities = [];
  let errorMsg = '', errorTimer = 0;
  let successMsg = '', successTimer = 0;
  let glitchTimer = 0;
  let glitchSeed = 0;

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
  bootOpacities = new Array(bootLines.length).fill(0);

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

  function lerp(a,b,t){return a+(b-a)*t;}

  function drawText(text, x, y, color = '#00d058', opacity = 1) {
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

  function roundRect(ctx2, x, y, w, h, r) {
    ctx2.beginPath();
    ctx2.moveTo(x + r, y);
    ctx2.arcTo(x + w, y, x + w, y + h, r);
    ctx2.arcTo(x + w, y + h, x, y + h, r);
    ctx2.arcTo(x, y + h, x, y, r);
    ctx2.arcTo(x, y, x + w, y, r);
    ctx2.closePath();
  }

  // draw noise background (fast: draw small noise canvas and scale up)
  function regenerateNoise() {
    const img = noiseCtx.createImageData(noiseW, noiseH);
    const data = img.data;
    for (let i=0;i<noiseW*noiseH;i++){
      const v = (Math.random()*255)|0;
      const j = i*4;
      // subtle green tint: slightly higher green channel
      data[j] = v * 0.08;        // r low
      data[j+1] = v * 0.12;      // g slightly stronger
      data[j+2] = v * 0.07;      // b low
      data[j+3] = 255;
    }
    noiseCtx.putImageData(img,0,0);
  }

  // GLITCH trigger - big geometric distortion for short time
  function triggerGlitch(intensity = 1.0, duration = 600) {
    glitchTimer = duration; // ms
    glitchSeed = Math.random() * 1000;
    errorMsg = '> ОШИБКА: ОТКАЗ ВХОДА';
    errorTimer = 180;
  }

  function drawStart() {
    // clear with very dark greenish background
    ctx.fillStyle = '#070807';
    ctx.fillRect(0,0,vw,vh);

    // draw moving noise
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.drawImage(noiseCanvas, -10, -10, vw+20, vh+20);
    ctx.restore();

    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.35;
    drawText(logo, logoX, logoY, '#00c76a', 0.95);

    const status = '> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ';
    const statusY = logoY + 90;
    drawText(status, (vw - measure(status)) / 2, statusY, '#00d058', 0.95);

    const btnText = 'ЗАПУСТИТЬ СИСТЕМУ';
    const btnW = measure(btnText) + 60;
    const btnH = 45;
    const btnX = (vw - btnW) / 2;
    const btnY = statusY + 60;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    ctx.save();
    ctx.globalAlpha = hovered ? 1 : 0.9;
    ctx.fillStyle = hovered ? 'rgba(8,120,48,0.95)' : 'rgba(6,90,35,0.85)';
    roundRect(ctx, btnX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeStyle = hovered ? '#1cff8a' : '#00c76a';
    roundRect(ctx, btnX, btnY, btnW, btnH, 8);
    ctx.stroke();
    ctx.restore();

    drawText(btnText, btnX + 30, btnY + 10, hovered ? '#dfffe8' : '#d7ffe0');

    window.__clickZones = { startBtn: { x: btnX, y: btnY, w: btnW, h: btnH } };
  }

  function drawBoot(dt) {
    ctx.fillStyle = '#040504';
    ctx.fillRect(0,0,vw,vh);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.drawImage(noiseCanvas, -10, -10, vw+20, vh+20);
    ctx.restore();

    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.3;
    drawText(logo, logoX, logoY, '#00c76a', 0.95);

    // boot timing: each line fades in smoothly
    bootTimer += dt;
    if (bootTimer > 300 && bootIndex < bootLines.length-1) {
      bootIndex++;
    }

    for (let i=0;i<bootLines.length;i++){
      const target = i <= bootIndex ? 1 : 0;
      bootOpacities[i] = lerp(bootOpacities[i], target, 0.06);
      if (bootOpacities[i] > 0.001) {
        drawText(bootLines[i], logoX - 30, logoY + 80 + i * (LINE_HEIGHT + 5), '#00d058', bootOpacities[i]);
      }
    }

    // once finished move to login
    if (bootIndex >= bootLines.length - 1 && bootTimer > 1000) {
      currentScreen = screens.LOGIN;
      inputField = 'username';
    }
  }

  function drawLogin(dt) {
    // base background
    ctx.fillStyle = '#050605';
    ctx.fillRect(0,0,vw,vh);

    // animated noise
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.drawImage(noiseCanvas, Math.sin(perfNow*0.001)*8 - 8, Math.cos(perfNow*0.001)*6 - 6, vw+20, vh+20);
    ctx.restore();

    const centerY = vh * 0.45;
    const fieldW = Math.min(420, vw - 100);
    const fieldH = 42;
    const labelDy = -FIELD_PADDING - 5;

    const title = 'ДОСТУП К ТЕРМИНАЛУ';
    drawText(title, (vw - measure(title)) / 2, centerY - 120, '#00c76a', 0.95);

    // USERNAME
    const userX = (vw - fieldW) / 2;
    const userY = centerY - 30;
    drawText('ИМЯ ПОЛЬЗОВАТЕЛЯ:', userX, userY + labelDy, '#00d058', 0.85);

    ctx.save();
    ctx.fillStyle = inputField === 'username' ? 'rgba(6,120,46,0.95)' : 'rgba(6,80,30,0.7)';
    roundRect(ctx, userX, userY, fieldW, fieldH, 6);
    ctx.fill();
    ctx.strokeStyle = inputField === 'username' ? '#00ff88' : '#00c76a';
    ctx.lineWidth = inputField === 'username' ? 3 : 2;
    roundRect(ctx, userX, userY, fieldW, fieldH, 6);
    ctx.stroke();
    ctx.restore();

    const userText = username + (cursorBlink % 30 < 15 && inputField === 'username' ? '█' : '');
    drawText(userText, userX + FIELD_PADDING, userY + 10, '#e8ffee');

    // PASSWORD
    const passX = userX;
    const passY = centerY + 40;
    drawText('ПАРОЛЬ:', passX, passY + labelDy, '#00d058', 0.85);

    ctx.save();
    ctx.fillStyle = inputField === 'password' ? 'rgba(6,120,46,0.95)' : 'rgba(6,80,30,0.7)';
    roundRect(ctx, passX, passY, fieldW, fieldH, 6);
    ctx.fill();
    ctx.strokeStyle = inputField === 'password' ? '#00ff88' : '#00c76a';
    ctx.lineWidth = inputField === 'password' ? 3 : 2;
    roundRect(ctx, passX, passY, fieldW, fieldH, 6);
    ctx.stroke();
    ctx.restore();

    const masked = '*'.repeat(password.length);
    const passText = masked + (cursorBlink % 30 < 15 && inputField === 'password' ? '█' : '');
    drawText(passText, passX + FIELD_PADDING, passY + 10, '#e8ffee');

    // BUTTON
    const btnText = 'АУТЕНТИФИКАЦИЯ';
    const btnW = measure(btnText) + 60;
    const btnH = 38;
    const btnX = (vw - btnW) / 2;
    const btnY = centerY + 100;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    ctx.save();
    ctx.globalAlpha = hovered ? 1 : 0.95;
    ctx.fillStyle = hovered ? 'rgba(6,140,56,0.95)' : 'rgba(6,100,40,0.85)';
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fill();
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeStyle = hovered ? '#bbffcf' : '#00c76a';
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.stroke();
    ctx.restore();

    drawText(btnText, btnX + 30, btnY + 10, hovered ? '#f7fff8' : '#e9fff1');

    // MESSAGES
    if (errorMsg && errorTimer > 0) {
      drawText(errorMsg, (vw - measure(errorMsg)) / 2, centerY + 160, '#ff6060', 1);
      errorTimer--;
    }
    if (successMsg && successTimer > 0) {
      drawText(successMsg, (vw - measure(successMsg)) / 2, centerY + 160, '#aaffc8', 1);
      successTimer--;
    }

    // CLICK ZONES
    window.__clickZones = {
      userField: { x: userX, y: userY, w: fieldW, h: fieldH },
      passField: { x: passX, y: passY, w: fieldW, h: fieldH },
      authBtn: { x: btnX, y: btnY, w: btnW, h: btnH }
    };

    // GLITCH rendering overlay on top if triggered
    if (glitchTimer > 0) {
      const t = glitchTimer / 600;
      const slices = 6 + Math.floor((1 - t) * 12);
      for (let i=0;i<slices;i++){
        const sx = Math.random()*vw;
        const sy = Math.random()*vh;
        const sw = Math.random()*(vw*0.6) + 20;
        const sh = Math.random()*(vh*0.12) + 10;
        const dx = sx + (Math.random() - 0.5) * 40 * (1/t);
        const dy = sy + (Math.random() - 0.5) * 30 * (1/t);
        ctx.drawImage(canvas, sx, sy, sw, sh, dx, dy, sw, sh);
      }
    }
  }

  // timing & render loop
  let last = performance.now();
  let accumulator = 0;
  let perfNow = 0;
  function frame(now) {
    const dt = now - last;
    perfNow = now;
    last = now;
    accumulator += dt;

    // regenerate noise a few times per second for animation
    if (Math.random() < 0.12) regenerateNoise();

    cursorBlink++;
    if (currentScreen === screens.BOOT) drawBoot(dt);
    else if (currentScreen === screens.START) drawStart();
    else if (currentScreen === screens.LOGIN) drawLogin(dt);

    // glitch timer
    if (glitchTimer > 0) {
      glitchTimer -= dt;
      if (glitchTimer <= 0) {
        glitchTimer = 0;
      }
    }

    requestAnimationFrame(frame);
  }
  frame(performance.now());

  // EVENTS: these will be triggered by overlay dispatching synthetic mouse events
  // (we DON'T listen to real browser events because overlay handles them)
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);

    if (currentScreen === screens.START && window.__clickZones?.startBtn) {
      const b = window.__clickZones.startBtn;
      if (inRect(x, y, b.x, b.y, b.w, b.h)) {
        currentScreen = screens.BOOT;
        bootTimer = 0;
        bootIndex = -1;
        bootOpacities.fill(0);
        return;
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
      cursorBlink = 0;
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left);
    mouseY = (e.clientY - rect.top);
  });

  // keyboard
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
    } else if (e.key.length === 1) {
      // avoid spaces
      if (e.key !== ' ') {
        if (inputField === 'username') username += e.key;
        if (inputField === 'password') password += e.key;
      }
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
      }, 400);
    } else {
      // full-on glitch
      triggerGlitch(1.0, 700);
      password = '';
    }
  }

  // PUBLIC helper: overlay will dispatch synthetic mousemove to keep hover state updated
  // Nothing else required here.
})();
