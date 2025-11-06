// terminal_canvas_fix.js
// Fixed canvas terminal (all-screen capture rendering + scroll + stable input).
// Replace old terminal_canvas.js with this file. Keep crt_overlay.js after it.

(() => {
  let pendingRedraw = false; 
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 13;
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.45);
  const PADDING = 18;
  const MAX_LINES = 6000;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const CANVAS_Z = 50;
  const REDRAW_FPS = 30; // keeps background/overlay animating

  // create canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'terminalCanvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    zIndex: CANVAS_Z,
    pointerEvents: 'none'
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });

  // Hide originals visually but keep them in DOM for JS logic where needed.
  const origTerminal = document.getElementById('terminal');
  if (origTerminal) {
    // visually hide but keep layout: use visibility+pointer none to avoid original key handlers receiving events via focus
    origTerminal.style.opacity = '0';
    origTerminal.style.pointerEvents = 'none';
    origTerminal.setAttribute('data-hidden-by', 'terminal_canvas_fix');
  }

  const glassFX = document.getElementById('glassFX');
  if (glassFX) {
    glassFX.style.opacity = '0';
    glassFX.style.pointerEvents = 'none';
    glassFX.setAttribute('data-hidden-by', 'terminal_canvas_fix');
  }

  // mapCanvas detection (netGrid). Hide visually but keep interactive flag off.
  let mapCanvas = (() => {
    const all = Array.from(document.querySelectorAll('canvas'));
    // prefer any canvas that is not shader-canvas and not ours
    const candidates = all.filter(c => !['shader-canvas', 'terminalCanvas', 'crtOverlayCanvas'].includes(c.id));
    if (candidates.length) {
      const c = candidates[0];
      c.style.opacity = '0';
      c.style.pointerEvents = 'none';
      c.setAttribute('data-hidden-by', 'terminal_canvas_fix');
      return c;
    }
    return null;
  })();

  // state
  let vw = Math.max(320, window.innerWidth);
  let vh = Math.max(240, window.innerHeight);

  function resize() {
    vw = Math.max(320, window.innerWidth);
    vh = Math.max(240, window.innerHeight);
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    // scale for drawing
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    requestFullRedraw();
  }
  window.addEventListener('resize', resize);
  resize();

  // lines buffer
  const lines = []; // { text, color }
  let scrollOffset = 0; // 0 = bottom
  let pendingRedraw = false;
  function requestFullRedraw() {
    if (!pendingRedraw) {
      pendingRedraw = true;
      requestAnimationFrame(draw);
    }
  }

  // input + state flags
  let currentLine = '';
  let commandHistory = [];
  let historyIndex = -1;
  let isTyping = false;
  let awaitingConfirmation = false;
  let confirmationCallback = null;
  let currentAudio = null;
  let commandCount = 0;
  let sessionStartTime = Date.now();
  let isFrozen = false;
  let ghostInputInterval = null;
  let autoCommandInterval = null;

  // Degradation system (keeps indicator and logic)
  class DegradationSystem {
    constructor() {
      this.level = parseInt(localStorage.getItem('adam_degradation')) || 0;
      this.lastSoundLevel = 0;
      this.startTimer();
      this.updateIndicator(); // initial draw
    }
    startTimer() {
      // independent timer, increases even if nothing typed; respects document.hidden
      setInterval(() => {
        if (!document.hidden && !isFrozen) this.addDegradation(1);
      }, 30000);
    }
    addDegradation(amount) {
      this.level = Math.min(100, this.level + amount);
      localStorage.setItem('adam_degradation', this.level);
      this.updateIndicator();
      this.updateEffects();
      // sound triggers
      if (Math.floor(this.level / 5) > Math.floor(this.lastSoundLevel / 5)) {
        if (this.level >= 60 && this.level < 80) this.playAudio('sounds/reset_com.mp3');
        else if (this.level >= 80 && this.level < 95) this.playAudio('sounds/reset_com_reverse.mp3');
        this.lastSoundLevel = this.level;
      }
      if (this.level >= 98 && !isFrozen) this.triggerGlitchApocalypse();
    }
    updateIndicator() {
      // request redraw to show updated indicator on canvas
      requestFullRedraw();
    }
    updateEffects() {
      // keep backwards-compatible classes on body for CSS that may exist
      document.body.classList.remove('degradation-2','degradation-3','degradation-4','degradation-5','degradation-glitch');
      if (this.level >= 30 && this.level < 60) document.body.classList.add('degradation-2');
      else if (this.level >= 60 && this.level < 80) document.body.classList.add('degradation-3');
      else if (this.level >= 80 && this.level < 95) document.body.classList.add('degradation-4');
      else if (this.level >= 95 && this.level < 98) document.body.classList.add('degradation-5');
      else if (this.level >= 98) document.body.classList.add('degradation-glitch');
      requestFullRedraw();
    }
    playAudio(file) {
      try {
        if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
        currentAudio = new Audio(file);
        currentAudio.play().catch(()=>{});
      } catch(e){}
    }
    triggerGlitchApocalypse() {
      isFrozen = true;
      this.playAudio('sounds/glitch_e.MP3');
      setTimeout(()=> this.performAutoReset(), 3000);
    }
    performAutoReset() {
      lines.length = 0;
      this.reset();
      isFrozen = false;
      addInputLine();
      requestFullRedraw();
    }
    reset() {
      this.level = 0;
      this.lastSoundLevel = 0;
      localStorage.setItem('adam_degradation','0');
      document.body.classList.remove('degradation-2','degradation-3','degradation-4','degradation-5','degradation-glitch');
      if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
      isFrozen = false;
      requestFullRedraw();
    }
    // ghost/auto kept for completeness
    startGhostInput(){ if (ghostInputInterval) return; ghostInputInterval = setInterval(()=>{ if (!isTyping && !isFrozen && Math.random()<0.1){ currentLine += '▓'; updatePromptLine(); setTimeout(()=>{ currentLine = currentLine.slice(0,-1); updatePromptLine(); }, 800+Math.random()*800); } }, 2000); }
    stopGhostInput(){ if (ghostInputInterval){ clearInterval(ghostInputInterval); ghostInputInterval = null; } }
    startAutoCommands(){ if (autoCommandInterval) return; autoCommandInterval = setInterval(()=>{ if (!isTyping && !isFrozen && Math.random()<0.06) this.executeAutoCommand(); }, 15000); }
    stopAutoCommands(){ if (autoCommandInterval){ clearInterval(autoCommandInterval); autoCommandInterval = null; } }
    executeAutoCommand(){ const fake = ['KILL','A.D.A.M. ЗДЕСЬ','ОНИ ВНУТРИ','SOS']; const real = ['help','syst','syslog','subj','notes','clear','reset']; const all = fake.concat(real); this.simulateTyping(all[Math.floor(Math.random()*all.length)]); }
    simulateTyping(cmd){ let t=''; const step=()=>{ if (t.length<cmd.length && !isFrozen){ t+=cmd[t.length]; currentLine=t; updatePromptLine(); setTimeout(step,100); } else if(!isFrozen){ setTimeout(()=>{ processCommand(currentLine); currentLine=''; updatePromptLine(); }, 400); } }; step(); }
    setDegradationLevel(level){ this.level = Math.max(0, Math.min(100, level)); localStorage.setItem('adam_degradation', this.level.toString()); this.updateIndicator(); this.updateEffects(); }
  }
  const degradation = new DegradationSystem();

  // draw helpers
  function clearBackground() {
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }

  function drawMapAndGlass() {
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    // map canvas
    if (mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0) {
      try {
        const r = mapCanvas.getBoundingClientRect();
        ctx.drawImage(mapCanvas, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height));
      } catch(e){}
    }
    // glassFX noise: draw with modest alpha to avoid whiteness
    if (glassFX && glassFX.width > 0 && glassFX.height > 0) {
      try {
        ctx.globalAlpha = 0.45;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(glassFX, 0, 0, vw, vh);
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
      } catch(e){}
    }
    ctx.restore();
  }

  function drawTextLines() {
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'top';

    const contentH = vh - PADDING*2;
    const visibleLines = Math.floor(contentH / LINE_HEIGHT);
    // start index takes into account scrollOffset (scrollOffset = number of lines scrolled up)
    const start = Math.max(0, lines.length - visibleLines - scrollOffset);
    const end = Math.min(lines.length, start + visibleLines);

    let y = PADDING;
    const maxW = vw - PADDING*2;
    for (let i = start; i < end; i++) {
      const item = lines[i];
      ctx.fillStyle = item.color || '#00FF41';
      const text = String(item.text);
      // simple wrap by words
      if (ctx.measureText(text).width <= maxW) {
        ctx.fillText(text, PADDING, y);
        y += LINE_HEIGHT;
        continue;
      }
      const words = text.split(' ');
      let line = '';
      for (let w = 0; w < words.length; w++) {
        const test = line ? line + ' ' + words[w] : words[w];
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, PADDING, y);
          y += LINE_HEIGHT;
          line = words[w];
        } else {
          line = test;
        }
      }
      if (line) { ctx.fillText(line, PADDING, y); y += LINE_HEIGHT; }
    }

    // prompt at bottom if not present already
    const bottomY = Math.max(PADDING, vh - PADDING - LINE_HEIGHT);
    const lastIsPrompt = lines.length && String(lines[lines.length-1].text).startsWith('adam@secure:~$');
    if (!lastIsPrompt) {
      ctx.fillStyle = '#00FF41';
      ctx.fillText('adam@secure:~$ ' + currentLine, PADDING, bottomY);
    }

    ctx.restore();
  }

  function drawDegradationIndicator() {
    const wBox = Math.min(280, Math.floor(vw * 0.35));
    const hBox = 60;
    const x = vw - wBox - 20;
    const y = 20;
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);

    // background rounded rect
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    roundRectPath(ctx, x, y, wBox, hBox, 6);
    ctx.fill();

    let color = '#00FF41';
    if (degradation.level > 30) color = '#FFFF00';
    if (degradation.level > 60) color = '#FF8800';
    if (degradation.level > 80) color = '#FF4444';
    if (degradation.level > 95) color = '#FF00FF';

    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    roundRectPath(ctx, x, y, wBox, hBox, 6);
    ctx.stroke();

    const barX = x + 8, barY = y + 22, barW = wBox - 16, barH = 12;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, Math.round(barW * (degradation.level / 100)), barH);

    ctx.fillStyle = color;
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillText('ДЕГРАДАЦИЯ СИСТЕМЫ', x + 10, y + 4);
    ctx.fillText(degradation.level + '%', x + wBox - 44, y + 6);

    ctx.restore();
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // main draw
  function draw() {
    pendingRedraw = false;
    clearBackground();

    // draw shader-canvas background (if present)
    const shaderCanvas = document.getElementById('shader-canvas');
    if (shaderCanvas && shaderCanvas.width > 0) {
      try { ctx.drawImage(shaderCanvas, 0, 0, vw, vh); } catch(e) {}
    }

    // map + glass
    drawMapAndGlass();

    // text
    drawTextLines();

    // degradation box
    drawDegradationIndicator();
  }

  // API functions
  function addOutput(text, className = 'output') {
    if (isFrozen) return;
    lines.push({ text: String(text), color: className === 'command' ? '#FFFFFF' : '#00FF41' });
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    scrollOffset = 0;
    requestFullRedraw();
  }

  function addColoredText(text, color = '#00FF41') {
    if (isFrozen) return;
    lines.push({ text: String(text), color });
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    scrollOffset = 0;
    requestFullRedraw();
  }

  async function typeText(text, className = 'output', speed = 2) {
    if (isFrozen) return;
    isTyping = true;
    let buffer = '';
    for (let i = 0; i < text.length; i++) {
      buffer += text[i];
      lines.push({ text: buffer, color: className === 'command' ? '#FFFFFF' : '#00FF41' });
      if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
      requestFullRedraw();
      if (i < text.length - 1) lines.pop();
      await new Promise(r => setTimeout(r, speed));
      if (isFrozen) break;
    }
    isTyping = false;
  }

  function addInputLine() {
    lines.push({ text: 'adam@secure:~$ ', color: '#00FF41' });
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    scrollOffset = 0;
    requestFullRedraw();
  }

  function updatePromptLine() {
    if (lines.length && String(lines[lines.length - 1].text).startsWith('adam@secure:~$')) {
      lines[lines.length - 1].text = 'adam@secure:~$ ' + currentLine;
    } else {
      lines.push({ text: 'adam@secure:~$ ' + currentLine, color: '#00FF41' });
      if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    }
    requestFullRedraw();
  }

  // wheel & keyboard scrolling
  function clampScrollOffset(v) {
    const contentH = vh - PADDING*2;
    const visibleLines = Math.floor(contentH / LINE_HEIGHT);
    const maxOffset = Math.max(0, lines.length - visibleLines);
    return Math.max(0, Math.min(maxOffset, v));
  }
  window.addEventListener('wheel', function(e){
    // only when mouse over canvas area (full-screen) - canvas is full-screen so it's fine
    if (e.deltaY === 0) return;
    // if user focuses input-like elements, don't hijack
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    scrollOffset = clampScrollOffset(scrollOffset + Math.sign(e.deltaY) * 3);
    requestFullRedraw();
    e.preventDefault();
  }, { passive: false });

  // key handling (capture to prevent duplicate handlers in original terminal.js)
  document.addEventListener('keydown', function(e){
    if (isFrozen) return;
    // if focused input/textarea/contentEditable -> allow normal behavior
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

    // capture and stop propagation to avoid original terminal also handling keys
    // but allow certain navigation keys to pass? we stopPropagation to prevent duplication
    // only if our handler will process it
    const navigationKeys = ['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'];
    if (awaitingConfirmation) {
      if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') { e.preventDefault(); e.stopPropagation(); if (confirmationCallback) confirmationCallback(true); }
      else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') { e.preventDefault(); e.stopPropagation(); if (confirmationCallback) confirmationCallback(false); }
      return;
    }

    if (isTyping) {
      // let typing finish — still we intercept characters to keep canvas in control
      if (e.key.length === 1) { currentLine += e.key; updatePromptLine(); e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'Backspace') { currentLine = currentLine.slice(0,-1); updatePromptLine(); e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'Enter') { if (currentLine.trim()){ const c = currentLine; currentLine=''; processCommand(c);} e.preventDefault(); e.stopPropagation(); }
      return;
    }

    // normal handling
    if (e.key === 'Enter') {
      if (currentLine.trim()) { const c = currentLine; currentLine = ''; processCommand(c); }
      e.preventDefault(); e.stopPropagation();
      return;
    } else if (e.key === 'Backspace') {
      currentLine = currentLine.slice(0, -1);
      e.preventDefault(); e.stopPropagation();
    } else if (e.key === 'ArrowUp') {
      // if user holds Shift -> scroll history; otherwise navigate history
      if (historyIndex > 0) { historyIndex--; currentLine = commandHistory[historyIndex] || ''; }
      else if (historyIndex === commandHistory.length) { historyIndex = commandHistory.length - 1; }
      updatePromptLine();
      e.preventDefault(); e.stopPropagation();
    } else if (e.key === 'ArrowDown') {
      if (historyIndex < commandHistory.length - 1) { historyIndex++; currentLine = commandHistory[historyIndex] || ''; }
      else { historyIndex = commandHistory.length; currentLine = ''; }
      updatePromptLine();
      e.preventDefault(); e.stopPropagation();
    } else if (e.key === 'PageUp') {
      scrollOffset = clampScrollOffset(scrollOffset + Math.floor((vh - PADDING*2) / LINE_HEIGHT)); requestFullRedraw(); e.preventDefault(); e.stopPropagation();
    } else if (e.key === 'PageDown') {
      scrollOffset = clampScrollOffset(scrollOffset - Math.floor((vh - PADDING*2) / LINE_HEIGHT)); requestFullRedraw(); e.preventDefault(); e.stopPropagation();
    } else if (e.key === 'Home') {
      scrollOffset = clampScrollOffset(lines.length); requestFullRedraw(); e.preventDefault(); e.stopPropagation();
    } else if (e.key === 'End') {
      scrollOffset = 0; requestFullRedraw(); e.preventDefault(); e.stopPropagation();
    } else if (e.key.length === 1) {
      currentLine += e.key;
      updatePromptLine();
      e.preventDefault(); e.stopPropagation();
    } else {
      // ignore other keys
    }
  }, { capture: true }); // capture to stop other handlers early

  // basic helper: show loading
  function showLoading(duration = 2000, text = "АНАЛИЗ СИГНАЛА") {
    return new Promise(resolve => {
      if (isFrozen) return resolve();
      const loaderIndex = lines.length;
      let progress = 0;
      addOutput(`${text} [0%]`);
      const interval = 50;
      const steps = Math.max(4, Math.floor(duration / interval));
      const increment = 100 / steps;
      const id = setInterval(() => {
        if (isFrozen) { clearInterval(id); resolve(); return; }
        progress += increment;
        lines[loaderIndex].text = `${text} [${Math.min(100, Math.round(progress))}%]`;
        requestFullRedraw();
        if (progress >= 100) {
          clearInterval(id);
          lines[loaderIndex].text = `${text} [ЗАВЕРШЕНО]`;
          requestFullRedraw();
          setTimeout(resolve, 300);
        }
      }, interval);
    });
  }

  // fake commands spawn (kept)
  function spawnFakeCommand(){
    if (degradation.level >= 80 && Math.random() < 0.02 && !isFrozen){
      const fakeLines = ['adam@secure:~$ ... → ОШИБКА // НЕТ ПОЛЬЗОВАТЕЛЯ','adam@secure:~$ SYSTEM FAILURE // CORE DUMP','adam@secure:~$ ACCESS VIOLATION // TERMINAL COMPROMISED'];
      const s = fakeLines[Math.floor(Math.random()*fakeLines.length)];
      addColoredText(s, '#FF4444');
    }
  }
  setInterval(spawnFakeCommand, 2000);

  // ----- INSERT YOUR dossiers & notes OBJECTS HERE (they were in your original file) -----
  const dossiers = {/* put full object here (unchanged) */};
  const notes = {/* put full object here (unchanged) */};

  // show dossier / note helpers (ported)
  async function showSubjectDossier(subjectId) {
    const id = subjectId.toUpperCase();
    const dossier = dossiers[id];
    if (!dossier) { addColoredText(`ОШИБКА: Досье для ${subjectId} не найдено`, '#FF4444'); return; }
    await typeText(`[ДОСЬЕ — ID: ${subjectId}]`, 'output', 1);
    await typeText(`ИМЯ: ${dossier.name}`, 'output', 1);
    await typeText(`РОЛЬ: ${dossier.role}`, 'output', 1);
    addColoredText(`СТАТУС: ${dossier.status}`, dossier.status === 'АНОМАЛИЯ' ? '#FF00FF' : dossier.status === 'АКТИВЕН' ? '#00FF41' : dossier.status.includes('СВЯЗЬ') ? '#FFFF00' : '#FF4444');
    addColoredText('------------------------------------', '#00FF41');
    await typeText('ИСХОД:', 'output', 1);
    dossier.outcome.forEach(line => addColoredText(`> ${line}`, '#FF4444'));
    addColoredText('------------------------------------', '#00FF41');
    await typeText('СИСТЕМНЫЙ ОТЧЁТ:', 'output', 1);
    dossier.report.forEach(line => addColoredText(`> ${line}`, '#FFFF00'));
    addColoredText('------------------------------------', '#00FF41');
    await typeText(`СВЯЗАННЫЕ МИССИИ: ${dossier.missions}`, 'output', 1);
    if (dossier.audio) {
      addColoredText(`[АУДИОЗАПИСЬ ДОСТУПНА: ${dossier.audioDescription}]`, '#FFFF00');
      const audioId = `audio_${subjectId.replace(/[^0-9A-Z]/g,'')}`;
      const holder = document.getElementById(audioId) || document.createElement('div');
      holder.id = audioId;
      holder.style.display = 'none';
      holder.innerHTML = `<audio id="${audioId}_el" src="${dossier.audio}" preload="metadata"></audio>`;
      if (!document.getElementById(audioId)) document.body.appendChild(holder);
    }
  }

  async function openNote(noteId) {
    const id = noteId.toUpperCase();
    const note = notes[id];
    if (!note) { addColoredText(`ОШИБКА: Файл ${noteId} не найден`, '#FF4444'); return; }
    await typeText(`[${id} — "${note.title}"]`, 'output', 1);
    await typeText(`АВТОР: ${note.author}`, 'output', 1);
    addColoredText('------------------------------------', '#00FF41');
    if (Math.random() > 0.3 && id !== 'NOTE_001' && id !== 'NOTE_003' && id !== 'NOTE_004') {
      addColoredText('ОШИБКА: Данные повреждены', '#FF4444');
      addColoredText('Восстановление невозможно', '#FF4444');
      await showLoading(1500, "Попытка восстановления данных");
      addColoredText('>>> СИСТЕМНЫЙ СБОЙ <<<', '#FF0000');
    } else {
      note.content.forEach(line => addColoredText(`> ${line}`, '#CCCCCC'));
    }
    addColoredText('------------------------------------', '#00FF41');
    await typeText('[ФАЙЛ ЗАКРЫТ]', 'output', 2);
  }

  // processCommand (port)
  async function processCommand(rawCmd) {
    if (isTyping || isFrozen) return;
    const cmdLine = rawCmd.trim();
    if (!cmdLine) { addInputLine(); return; }
    commandHistory.push(cmdLine); historyIndex = commandHistory.length;
    commandCount++;
    addOutput(`adam@secure:~$ ${cmdLine}`, 'command');

    const parts = cmdLine.toLowerCase().split(' ').filter(Boolean);
    const command = parts[0] || '';
    const args = parts.slice(1);

    const commandWeights = { 'syst':1, 'syslog':1, 'net':1, 'dscr':2, 'subj':2, 'notes':1.5, 'deg':0 };
    if (commandWeights[command]) degradation.addDegradation(commandWeights[command]);

    switch(command) {
      case 'help':
        await typeText('Доступные команды:', 'output', 1);
        await typeText('  SYST         — проверить состояние системы', 'output', 1);
        await typeText('  SYSLOG       — системный журнал активности', 'output', 1);
        await typeText('  NET          — карта активных узлов проекта', 'output', 1);
        await typeText('  TRACE <id>   — отследить указанный модуль', 'output', 1);
        await typeText('  DECRYPT <f>  — расшифровать файл', 'output', 1);
        await typeText('  SUBJ         — список субъектов', 'output', 1);
        await typeText('  DSCR <id>    — досье на персонал', 'output', 1);
        await typeText('  NOTES        — личные файлы сотрудников', 'output', 1);
        await typeText('  OPEN <id>    — открыть файл из NOTES', 'output', 1);
        await typeText('  RESET        — сброс интерфейса', 'output', 1);
        await typeText('  EXIT         — завершить сессию', 'output', 1);
        await typeText('  CLEAR        — очистить терминал', 'output', 1);
        await typeText('  DEG          — установить уровень деградации (разработка)', 'output', 1);
        await typeText('------------------------------------', 'output', 1);
        await typeText('ПРИМЕЧАНИЕ: часть команд заблокирована или скрыта.', 'output', 2);
        break;

      case 'clear':
        lines.length = 0;
        await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 1);
        await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 1);
        break;

      case 'syst':
        await typeText('[СТАТУС СИСТЕМЫ — ИНТЕРФЕЙС VIGIL-9]', 'output', 1);
        addColoredText('------------------------------------', '#00FF41');
        await typeText('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН', 'output', 1);
        await typeText('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА', 'output', 1);
        await typeText('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН', 'output', 1);
        addColoredText('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА', '#FF4444');
        await typeText('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН', 'output', 1);
        addColoredText('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ..........ОГРАНИЧЕНЫ', '#FFFF00');
        addColoredText(`ДЕГРАДАЦИЯ: [${'█'.repeat(Math.floor(degradation.level/5))}${'▒'.repeat(20-Math.floor(degradation.level/5))}] ${degradation.level}%`, degradation.level > 60 ? '#FF4444' : '#FFFF00');
        addColoredText('------------------------------------', '#00FF41');
        await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', 'output', 2);
        break;

      case 'syslog':
        const syslogLevel = getSyslogLevel();
        await typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', 'output', 1);
        addColoredText('------------------------------------', '#00FF41');
        if (syslogLevel === 1) {
          addColoredText('[!] Ошибка 0x19F: повреждение нейронной сети', '#FFFF00');
          addColoredText('[!] Утечка данных через канал V9-HX', '#FFFF00');
          addColoredText('[!] Деградация ядра A.D.A.M.: 28%', '#FFFF00');
          await typeText('СИСТЕМА: функционирует с ограничениями', 'output', 2);
        } else if (syslogLevel === 2) {
          addColoredText('[!] Нарушение целостности памяти субъекта 0x095', '#FFFF00');
          addColoredText('> "я слышу их дыхание. они всё ещё здесь."', '#FF4444');
          addColoredText('[!] Потеря отклика от MONOLITH', '#FFFF00');
          addColoredText('------------------------------------', '#00FF41');
          await typeText('СИСТЕМА: обнаружены посторонние сигналы', 'output', 2);
        } else {
          addColoredText('> "ты не должен видеть это."', '#FF00FF');
          addColoredText('[!] Критическая ошибка: субъект наблюдения неопределён', '#FF4444');
          await typeText('СИСТЕМА: ОСОЗНАЁТ НАБЛЮДЕНИЕ', 'output', 2);
        }
        break;

      case 'notes':
        await typeText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / КАТЕГОРИЯ: NOTES]', 'output', 1);
        addColoredText('------------------------------------', '#00FF41');
        await typeText('NOTE_001 — "ВЫ ЕГО ЧУВСТВУЕТЕ?" / автор: Dr. Rehn', 'output', 1);
        await typeText('NOTE_002 — "КОЛЬЦО СНА" / автор: tech-оператор U-735', 'output', 1);
        await typeText('NOTE_003 — "СОН ADAM" / неизвестный источник', 'output', 1);
        await typeText('NOTE_004 — "ОН НЕ ПРОГРАММА" / архивировано', 'output', 1);
        await typeText('NOTE_005 — "ФОТОНОВАЯ БОЛЬ" / восстановлено частично', 'output', 1);
        addColoredText('------------------------------------', '#00FF41');
        await typeText('Для просмотра: OPEN <ID>', 'output', 2);
        break;

      case 'open':
        if (args.length === 0) { addColoredText('ОШИБКА: Укажите ID файла', '#FF4444'); await typeText('Пример: OPEN NOTE_001', 'output', 1); break; }
        await openNote(args[0]);
        break;

      case 'subj':
        await typeText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M. / ПРОТОКОЛ VIGIL-9]', 'output', 1);
        addColoredText('--------------------------------------------------------', '#00FF41');
        // minimal sample; your full list should be in dossiers object
        addColoredText('0x001 | ERICH VAN KOSS | СТАТУС: СВЯЗЬ ОТСУТСТВУЕТ | МИССИЯ: MARS', '#FFFF00');
        addColoredText('--------------------------------------------------------', '#00FF41');
        await typeText('ИНСТРУКЦИЯ: Для просмотра досье — DSCR <ID>', 'output', 2);
        break;

      case 'dscr':
        if (args.length === 0) { addColoredText('ОШИБКА: Укажите ID субъекта', '#FF4444'); await typeText('Пример: DSCR 0x001', 'output', 1); break; }
        await showSubjectDossier(args[0]);
        break;

      case 'deg':
        if (args.length === 0) { addColoredText(`Текущий уровень деградации: ${degradation.level}%`, '#00FF41'); await typeText('Использование: deg <уровень 0-100>', 'output', 1); }
        else {
          const level = parseInt(args[0]);
          if (!isNaN(level) && level >= 0 && level <= 100) { degradation.setDegradationLevel(level); addColoredText(`Уровень деградации установлен: ${level}%`, '#00FF41'); }
          else addColoredText('ОШИБКА: Уровень должен быть числом от 0 до 100', '#FF4444');
        }
        break;

      case 'reset':
        await typeText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', 'output', 1);
        addColoredText('------------------------------------', '#00FF41');
        addColoredText('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', '#FFFF00');
        await typeText('> Подтвердить сброс? (Y/N)', 'output', 2);
        addColoredText('------------------------------------', '#00FF41');
        const resetConfirmed = await waitForConfirmation();
        if (resetConfirmed) {
          addColoredText('> Y', '#00FF41');
          lines.length = 0;
          const resetMessages = ["Завершение активных модулей [ЗАВЕРШЕНО]","Перезапуск интерфейса [ЗАВЕРШЕНО]","Восстановление базового состояния [ЗАВЕРШЕНО]","----------------------------------","[СИСТЕМА ГОТОВА К РАБОТЕ]"];
          for (const m of resetMessages) { addOutput(m); await new Promise(r=>setTimeout(r,800)); }
          degradation.reset();
          commandCount = 0;
          sessionStartTime = Date.now();
        } else {
          addColoredText('> N', '#FF4444');
          addColoredText('------------------------------------', '#00FF41');
          await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 1);
        }
        break;

      case 'exit':
        await typeText('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ? (Y/N)]', 'output', 1);
        addColoredText('------------------------------------', '#00FF41');
        const exitConfirmed = await waitForConfirmation();
        if (exitConfirmed) {
          addColoredText('> Y', '#00FF41');
          await showLoading(1200, "Завершение работы терминала");
          await showLoading(800, "Отключение сетевой сессии");
          addColoredText('> ...', '#888888');
          addColoredText('> СОЕДИНЕНИЕ ПРЕРВАНО.', '#FF4444');
          setTimeout(()=>{ window.location.href = 'index.html'; }, 1500);
        } else {
          addColoredText('> N', '#FF4444');
          addColoredText('------------------------------------', '#00FF41');
          await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 1);
        }
        break;

      default:
        addColoredText(`команда не найдена: ${cmdLine}`, '#FF4444');
    }

    addInputLine();
  }

  // confirmation helper
  function waitForConfirmation(){
    return new Promise(resolve => {
      if (isFrozen) return resolve(false);
      awaitingConfirmation = true;
      confirmationCallback = (res) => { awaitingConfirmation = false; confirmationCallback = null; resolve(res); };
      lines.push({ text: 'confirm>> ', color: '#FFFF00' });
      if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
      requestFullRedraw();
    });
  }

  function getSyslogLevel() {
    const sessionDuration = Date.now() - sessionStartTime;
    const minutesInSession = sessionDuration / (1000 * 60);
    if (commandCount >= 10 || minutesInSession >= 3) return 3;
    else if (commandCount >= 5 || minutesInSession >= 1) return 2;
    else return 1;
  }

  // boot
  (async () => {
    await new Promise(r => setTimeout(r, 300));
    await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 1);
    await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', 'output', 1);
    await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 1);
    addInputLine();
  })();

  // expose for debug
  window.__TerminalCanvas = { addOutput, addColoredText, typeText, processCommand, degradation, lines };

  // ensure continuous redraw so overlay and shader-canvas animations remain visible
  setInterval(()=>{ requestFullRedraw(); }, Math.round(1000/REDRAW_FPS));

  // initial draw
  requestFullRedraw();
})();
