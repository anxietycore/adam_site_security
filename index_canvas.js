// index_canvas.js — canvas UI: правильные хитбоксы (логика остаётся), плавность, фокус и gltich
(() => {
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 13; // чуть меньше
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.5);
  const FIELD_PADDING = 12;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  // canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'indexCanvas';
  Object.assign(canvas.style, {
    position: 'fixed', left: '0', top: '0',
    width: '100%', height: '100%',
    zIndex: '50', pointerEvents: 'auto',
    userSelect: 'none', display: 'block'
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });

  // offscreen for glitch rendering
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');

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

  // glitch state
  let glitchActive = false;
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

  function resize() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    off.width = Math.floor(vw);
    off.height = Math.floor(vh);
    offCtx.setTransform(1,0,0,1,0,0);
  }
  window.addEventListener('resize', resize);
  resize();

  function drawText(ctxRef, text, x, y, color = '#00FF41', opacity = 1, align='left') {
    ctxRef.save();
    ctxRef.globalAlpha = opacity;
    ctxRef.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
    ctxRef.fillStyle = color;
    ctxRef.textBaseline = 'top';
    if (align === 'center') {
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        const w = ctxRef.measureText(line).width;
        ctxRef.fillText(line, x - w/2, y + i * LINE_HEIGHT);
      });
    } else {
      text.split('\n').forEach((line, i) => ctxRef.fillText(line, x, y + i * LINE_HEIGHT));
    }
    ctxRef.restore();
  }
  function measure(text) {
    ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
    return ctx.measureText(text).width;
  }
  function inRect(px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }
  function roundRect(ctxRef, x, y, w, h, r) {
    ctxRef.beginPath();
    ctxRef.moveTo(x + r, y);
    ctxRef.arcTo(x + w, y, x + w, y + h, r);
    ctxRef.arcTo(x + w, y + h, x, y + h, r);
    ctxRef.arcTo(x, y + h, x, y, r);
    ctxRef.arcTo(x, y, x + w, y, r);
    ctxRef.closePath();
  }

  // smooth easing for boot lines
  const bootOpacities = new Array(bootLines.length).fill(0);

  function drawStart() {
    ctx.clearRect(0, 0, vw, vh);

    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.35;
    drawText(ctx, logo, logoX, logoY);

    const status = '> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ';
    drawText(ctx, status, vw/2, logoY + 90, '#00FF41', 1, 'center');

    const btnText = 'ЗАПУСТИТЬ СИСТЕМУ';
    const btnW = Math.min(420, measure(btnText) + 70);
    const btnH = 44;
    const btnX = (vw - btnW) / 2;
    const btnY = logoY + 140;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    // button fill (darker green, less neon)
    ctx.save();
    ctx.fillStyle = hovered ? 'rgba(0,140,40,0.95)' : 'rgba(0,110,30,0.85)';
    roundRect(ctx, btnX, btnY, btnW, btnH, 8);
    ctx.fill();

    // subtle border glow only inside
    ctx.strokeStyle = hovered ? 'rgba(120,255,150,0.9)' : 'rgba(70,220,120,0.85)';
    ctx.lineWidth = hovered ? 3 : 2;
    roundRect(ctx, btnX, btnY, btnW, btnH, 8);
    ctx.stroke();
    ctx.restore();

    drawText(ctx, btnText, btnX + btnW/2, btnY + 10, hovered ? '#E8FFE8' : '#DFFFE0', 1, 'center');

    window.__clickZones = { startBtn: { x: btnX, y: btnY, w: btnW, h: btnH } };
  }

  function drawBoot() {
    ctx.clearRect(0, 0, vw, vh);
    const logoW = measure(logo.split('\n')[0]);
    const logoX = (vw - logoW) / 2;
    const logoY = vh * 0.30;
    drawText(ctx, logo, logoX, logoY);

    // increase bootIndex gradually
    if (bootTimer % 45 === 0 && bootIndex < bootLines.length - 1) bootIndex++;
    bootTimer++;

    const startY = logoY + 80;
    bootLines.forEach((line, i) => {
      // target opacity = 1 if revealed, else 0
      const target = i <= bootIndex ? 1 : 0;
      // smooth approach
      bootOpacities[i] += (target - bootOpacities[i]) * 0.15;
      if (bootOpacities[i] > 0.001) {
        drawText(ctx, line, logoX - 30, startY + i * (LINE_HEIGHT + 6), '#00FF41', bootOpacities[i]);
      }
    });

    // when done -> to login
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

    const title = 'ДОСТУП К ТЕРМИНАЛУ';
    drawText(ctx, title, vw/2, centerY - 120, '#00FF41', 1, 'center');

    // USERNAME field
    const userX = (vw - fieldW) / 2;
    const userY = centerY - 30;
    drawText(ctx, 'ИМЯ ПОЛЬЗОВАТЕЛЯ:', userX, userY + labelDy, '#00FF41', 0.9);
    ctx.save();
    ctx.fillStyle = inputField === 'username' ? 'rgba(0,120,40,0.12)' : 'rgba(0,120,40,0.06)';
    roundRect(ctx, userX, userY, fieldW, fieldH, 6);
    ctx.fill();
    ctx.strokeStyle = inputField === 'username' ? '#66ff88' : '#00FF41';
    ctx.lineWidth = inputField === 'username' ? 3 : 2;
    roundRect(ctx, userX, userY, fieldW, fieldH, 6);
    ctx.stroke();
    ctx.restore();

    const userText = username + (cursorBlink % 30 < 15 && inputField === 'username' ? '█' : '');
    drawText(ctx, userText, userX + FIELD_PADDING, userY + 10, '#EAFDF0');

    // PASSWORD field
    const passX = userX;
    const passY = centerY + 40;
    drawText(ctx, 'ПАРОЛЬ:', passX, passY + labelDy, '#00FF41', 0.9);
    ctx.save();
    ctx.fillStyle = inputField === 'password' ? 'rgba(0,120,40,0.12)' : 'rgba(0,120,40,0.06)';
    roundRect(ctx, passX, passY, fieldW, fieldH, 6);
    ctx.fill();
    ctx.strokeStyle = inputField === 'password' ? '#66ff88' : '#00FF41';
    ctx.lineWidth = inputField === 'password' ? 3 : 2;
    roundRect(ctx, passX, passY, fieldW, fieldH, 6);
    ctx.stroke();
    ctx.restore();

    const masked = '*'.repeat(password.length);
    const passText = masked + (cursorBlink % 30 < 15 && inputField === 'password' ? '█' : '');
    drawText(ctx, passText, passX + FIELD_PADDING, passY + 10, '#EAFDF0');

    // AUTH button
    const btnText = 'АУТЕНТИФИКАЦИЯ';
    const btnW = Math.min(420, measure(btnText) + 70);
    const btnH = 38;
    const btnX = (vw - btnW) / 2;
    const btnY = centerY + 100;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    ctx.save();
    ctx.fillStyle = hovered ? 'rgba(0,140,40,0.95)' : 'rgba(0,110,30,0.85)';
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fill();
    ctx.strokeStyle = hovered ? 'rgba(120,255,150,0.9)' : 'rgba(70,220,120,0.85)';
    ctx.lineWidth = hovered ? 3 : 2;
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.stroke();
    ctx.restore();

    drawText(ctx, btnText, btnX + btnW/2, btnY + 9, '#E8FFE8', 1, 'center');

    // messages
    if (errorMsg && errorTimer > 0) {
      drawText(ctx, errorMsg, vw/2, centerY + 160, '#FF6666', 1, 'center');
      errorTimer--;
    }
    if (successMsg && successTimer > 0) {
      drawText(ctx, successMsg, vw/2, centerY + 160, '#BFFFBF', 1, 'center');
      successTimer--;
    }

    // click zones
    window.__clickZones = {
      userField: { x: userX, y: userY, w: fieldW, h: fieldH },
      passField: { x: passX, y: passY, w: fieldW, h: fieldH },
      authBtn: { x: btnX, y: btnY, w: btnW, h: btnH }
    };
  }

  function renderFrame() {
    cursorBlink++;
    // draw normally into offscreen first
    offCtx.clearRect(0, 0, off.width, off.height);

    switch (currentScreen) {
      case screens.START: drawStartTo(offCtx); break;
      case screens.BOOT: drawBootTo(offCtx); break;
      case screens.LOGIN: drawLoginTo(offCtx); break;
    }

    // if glitch active -> perform geometric slice effects when copying to main ctx
    if (glitchActive && glitchTimer > 0) {
      // parameters
      const slices = 10 + Math.floor(Math.random() * 10);
      const maxOffset = 40 + Math.random() * 140;
      // draw base with small shake
      ctx.clearRect(0,0,vw,vh);
      ctx.save();
      const shakeX = (Math.random() - 0.5) * 6;
      const shakeY = (Math.random() - 0.5) * 6;
      ctx.translate(shakeX, shakeY);

      // slice copy
      for (let i=0;i<slices;i++) {
        const h = Math.round(off.height / slices);
        const sy = i * h;
        const dx = (Math.random() - 0.5) * maxOffset * (glitchTimer/60);
        ctx.drawImage(off, 0, sy, off.width, h, dx, sy, off.width, h);
      }
      // overlay heavy color inversion / channel split
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(${40 + Math.random()*50},0,${40 + Math.random()*50},${0.03 + Math.random()*0.05})`;
      ctx.fillRect(0,0,vw,vh);
      ctx.restore();

      glitchTimer--;
      if (glitchTimer <= 0) {
        glitchActive = false;
      }
    } else {
      // normal copy
      ctx.clearRect(0,0,vw,vh);
      ctx.drawImage(off, 0, 0, Math.floor(vw), Math.floor(vh));
    }
    requestAnimationFrame(renderFrame);
  }

  // wrappers so we can reuse existing draw functions but paint into offCtx
  function drawStartTo(ctxTarget) {
    // temporarily swap ctx to the target (monkeypatch drawText etc)
    const oldCtx = ctx;
    // use local functions that accept ctxTarget
    // we'll just reimplement small portion to render into offCtx to avoid complexity
    ctxTarget.save();
    ctxTarget.clearRect(0, 0, off.width, off.height);

    // same logic as drawStart but using ctxTarget
    const logoW = measure(logo.split('\n')[0]);
    const logoX = (off.width - logoW) / 2;
    const logoY = off.height * 0.35;
    drawText(ctxTarget, logo, logoX, logoY);

    const status = '> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ';
    drawText(ctxTarget, status, off.width/2, logoY + 90, '#00FF41', 1, 'center');

    const btnText = 'ЗАПУСТИТЬ СИСТЕМУ';
    const btnW = Math.min(420, measure(btnText) + 70);
    const btnH = 44;
    const btnX = (off.width - btnW) / 2;
    const btnY = logoY + 140;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    ctxTarget.save();
    ctxTarget.fillStyle = hovered ? 'rgba(0,140,40,0.95)' : 'rgba(0,110,30,0.85)';
    roundRect(ctxTarget, btnX, btnY, btnW, btnH, 8);
    ctxTarget.fill();
    ctxTarget.strokeStyle = hovered ? 'rgba(120,255,150,0.9)' : 'rgba(70,220,120,0.85)';
    ctxTarget.lineWidth = hovered ? 3 : 2;
    roundRect(ctxTarget, btnX, btnY, btnW, btnH, 8);
    ctxTarget.stroke();
    ctxTarget.restore();

    drawText(ctxTarget, btnText, btnX + btnW/2, btnY + 10, hovered ? '#E8FFE8' : '#DFFFE0', 1, 'center');

    ctxTarget.restore();
  }

  function drawBootTo(ctxTarget) {
    ctxTarget.save();
    ctxTarget.clearRect(0, 0, off.width, off.height);

    const logoW = measure(logo.split('\n')[0]);
    const logoX = (off.width - logoW) / 2;
    const logoY = off.height * 0.30;
    drawText(ctxTarget, logo, logoX, logoY);

    // update indices
    if (bootTimer % 45 === 0 && bootIndex < bootLines.length - 1) bootIndex++;
    bootTimer++;
    const startY = logoY + 80;
    bootLines.forEach((line, i) => {
      const target = i <= bootIndex ? 1 : 0;
      bootOpacities[i] += (target - bootOpacities[i]) * 0.15;
      if (bootOpacities[i] > 0.001) {
        drawText(ctxTarget, line, logoX - 30, startY + i * (LINE_HEIGHT + 6), '#00FF41', bootOpacities[i]);
      }
    });

    ctxTarget.restore();

    if (bootIndex >= bootLines.length - 1 && bootTimer > 60) {
      setTimeout(() => {
        currentScreen = screens.LOGIN;
        inputField = 'username';
      }, 500);
    }
  }

  function drawLoginTo(ctxTarget) {
    ctxTarget.save();
    ctxTarget.clearRect(0, 0, off.width, off.height);

    const centerY = off.height * 0.45;
    const fieldW = Math.min(420, off.width - 100);
    const fieldH = 42;
    const labelDy = -FIELD_PADDING - 5;
    drawText(ctxTarget, 'ДОСТУП К ТЕРМИНАЛУ', off.width/2, centerY - 120, '#00FF41', 1, 'center');

    const userX = (off.width - fieldW) / 2;
    const userY = centerY - 30;
    drawText(ctxTarget, 'ИМЯ ПОЛЬЗОВАТЕЛЯ:', userX, userY + labelDy, '#00FF41', 0.9);
    ctxTarget.save();
    ctxTarget.fillStyle = inputField === 'username' ? 'rgba(0,120,40,0.12)' : 'rgba(0,120,40,0.06)';
    roundRect(ctxTarget, userX, userY, fieldW, fieldH, 6);
    ctxTarget.fill();
    ctxTarget.strokeStyle = inputField === 'username' ? '#66ff88' : '#00FF41';
    ctxTarget.lineWidth = inputField === 'username' ? 3 : 2;
    roundRect(ctxTarget, userX, userY, fieldW, fieldH, 6);
    ctxTarget.stroke();
    ctxTarget.restore();

    const userText = username + (cursorBlink % 30 < 15 && inputField === 'username' ? '█' : '');
    drawText(ctxTarget, userText, userX + FIELD_PADDING, userY + 10, '#EAFDF0');

    const passX = userX;
    const passY = centerY + 40;
    drawText(ctxTarget, 'ПАРОЛЬ:', passX, passY + labelDy, '#00FF41', 0.9);
    ctxTarget.save();
    ctxTarget.fillStyle = inputField === 'password' ? 'rgba(0,120,40,0.12)' : 'rgba(0,120,40,0.06)';
    roundRect(ctxTarget, passX, passY, fieldW, fieldH, 6);
    ctxTarget.fill();
    ctxTarget.strokeStyle = inputField === 'password' ? '#66ff88' : '#00FF41';
    ctxTarget.lineWidth = inputField === 'password' ? 3 : 2;
    roundRect(ctxTarget, passX, passY, fieldW, fieldH, 6);
    ctxTarget.stroke();
    ctxTarget.restore();

    const masked = '*'.repeat(password.length);
    const passText = masked + (cursorBlink % 30 < 15 && inputField === 'password' ? '█' : '');
    drawText(ctxTarget, passText, passX + FIELD_PADDING, passY + 10, '#EAFDF0');

    // auth button
    const btnText = 'АУТЕНТИФИКАЦИЯ';
    const btnW = Math.min(420, measure(btnText) + 70);
    const btnH = 38;
    const btnX = (off.width - btnW) / 2;
    const btnY = centerY + 100;
    const hovered = inRect(mouseX, mouseY, btnX, btnY, btnW, btnH);

    ctxTarget.save();
    ctxTarget.fillStyle = hovered ? 'rgba(0,140,40,0.95)' : 'rgba(0,110,30,0.85)';
    roundRect(ctxTarget, btnX, btnY, btnW, btnH, 6);
    ctxTarget.fill();
    ctxTarget.strokeStyle = hovered ? 'rgba(120,255,150,0.9)' : 'rgba(70,220,120,0.85)';
    ctxTarget.lineWidth = hovered ? 3 : 2;
    roundRect(ctxTarget, btnX, btnY, btnW, btnH, 6);
    ctxTarget.stroke();
    ctxTarget.restore();

    drawText(ctxTarget, btnText, btnX + btnW/2, btnY + 9, '#E8FFE8', 1, 'center');

    if (errorMsg && errorTimer > 0) {
      drawText(ctxTarget, errorMsg, off.width/2, centerY + 160, '#FF6666', 1, 'center');
      errorTimer--;
    }
    if (successMsg && successTimer > 0) {
      drawText(ctxTarget, successMsg, off.width/2, centerY + 160, '#BFFFBF', 1, 'center');
      successTimer--;
    }

    ctxTarget.restore();
  }

  // event handlers on visible canvas (overlay will map events through to this canvas)
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentScreen === screens.START && window.__clickZones?.startBtn) {
      const b = window.__clickZones.startBtn;
      if (inRect(x, y, b.x, b.y, b.w, b.h)) {
        currentScreen = screens.BOOT;
        bootTimer = 0; bootIndex = -1;
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
      cursorBlink = 0; // immediate cursor reaction
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
    } else if (e.key.length === 1) {
      // ignore pure spaces
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
      }, 600);
    } else {
      // error: trigger heavy glitch
      errorMsg = '> ДОСТУП ЗАПРЕЩЁН';
      errorTimer = 180;
      password = '';
      triggerPanicGlitch();
    }
  }

  function triggerPanicGlitch() {
    glitchActive = true;
    glitchTimer = 50 + Math.floor(Math.random() * 90);
    glitchSeed = Math.random();
  }

  // small utility: immediate focus flag if clicking fields (cursorBlink)
  // start render
  renderFrame();

})();
