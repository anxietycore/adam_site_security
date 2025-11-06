// terminal_canvas_fixed2.js
// Fixed version of terminal_canvas.js with:
// - duplication guard
// - restored typing animation
// - proper degradation behaviour
// - glassFX drawn under text (subtle, not blinding white)
// - scroll with wheel
// - prompt integrated into lines (not fixed separate element)
// Usage: replace old terminal.js with this file. Keep crt_overlay.js after it.

(() => {
  // ---------- CONFIG ----------
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 13;
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.45);
  const PADDING = 18;
  const MAX_LINES = 6000;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const CANVAS_Z = 50;

  // ---------- create main canvas ----------
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

  // ---------- find original elements (keep interactive but visually hidden) ----------
  const origTerminal = document.getElementById('terminal');
  if (origTerminal) {
    // keep interactive but invisible (prevents double visual artifacts)
    origTerminal.style.opacity = '0';
    origTerminal.style.pointerEvents = 'auto';
    // don't clear its logic — but make sure it doesn't draw visible content
    // we will observe and remove visual children if they appear (safety)
    const mo = new MutationObserver(muts => {
      // remove newly added visible text nodes so original DOM doesn't show anything
      muts.forEach(m => {
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach(n => {
            // remove only elements/text nodes that would be visible (safety)
            if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE) {
              try { n.remove(); } catch(e){}
            }
          });
        }
      });
    });
    try { mo.observe(origTerminal, { childList: true, subtree: true }); } catch(e){}
  }

  const glassFX = document.getElementById('glassFX');
  if (glassFX) {
    glassFX.style.opacity = '0';
    glassFX.style.pointerEvents = 'auto';
  }

  // find map canvas (netGrid) but avoid shader / our canvas / overlay
  const mapCanvas = (() => {
    const all = Array.from(document.querySelectorAll('canvas'));
    const c = all.find(x => x.id !== 'shader-canvas' && x.id !== 'terminalCanvas' && x.id !== 'crtOverlayCanvas' && x.id !== 'glassFX');
    if (c) {
      c.style.opacity = '0';
      c.style.pointerEvents = 'auto';
      return c;
    }
    return null;
  })();

  // ---------- sizing ----------
  let vw = 0, vh = 0;
  function resize() {
    vw = Math.max(320, window.innerWidth);
    vh = Math.max(240, window.innerHeight);
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    requestFullRedraw();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- draw scheduling ----------
  let pendingRedraw = false;
  function requestFullRedraw(){ if(!pendingRedraw){ pendingRedraw = true; requestAnimationFrame(draw); } }

  // ---------- terminal state ----------
  const lines = []; // {text, color}
  let scrollOffset = 0; // 0 = bottom
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

  // duplicate-guard (avoid double processing of same command quickly)
  let lastProcessed = { text: null, ts: 0 };

  // ---------- Degradation system ----------
  class DegradationSystem {
    constructor() {
      this.level = parseInt(localStorage.getItem('adam_degradation')) || 0;
      this.lastSoundLevel = 0;
      this.ghostActive = false;
      this.autoActive = false;

      // DOM indicator kept hidden (for compatibility)
      this.indicator = document.createElement('div');
      this.indicator.style.cssText = `position:fixed; top:20px; right:20px; opacity:0; pointer-events:none;`;
      document.body.appendChild(this.indicator);

      this.updateIndicator();
      this.startTimer();
      this.updateEffects();
    }

    startTimer(){
      setInterval(()=>{ if (!document.hidden && !isFrozen) this.addDegradation(1); }, 30000);
    }

    addDegradation(amount){
      this.level = Math.max(0, Math.min(100, this.level + amount));
      localStorage.setItem('adam_degradation', String(this.level));
      this.updateIndicator();
      this.updateEffects();

      if (Math.floor(this.level / 5) > Math.floor(this.lastSoundLevel / 5)) {
        if (this.level >= 60 && this.level < 80) this.playAudio('sounds/reset_com.mp3');
        else if (this.level >= 80 && this.level < 95) this.playAudio('sounds/reset_com_reverse.mp3');
        this.lastSoundLevel = this.level;
      }
      if (this.level >= 98 && !isFrozen) this.triggerGlitchApocalypse();
    }

    updateIndicator(){
      // render DOM indicator for completeness (hidden)
      const color = this.level > 95 ? '#FF00FF' : this.level > 80 ? '#FF4444' : this.level > 60 ? '#FF8800' : this.level > 30 ? '#FFFF00' : '#00FF41';
      this.indicator.innerHTML = `<div style="color:${color};font-weight:700">ДЕГРАДАЦИЯ СИСТЕМЫ</div><div style="background:#222;height:12px;margin:6px 0;border:2px solid ${color}"><div style="background:${color};height:100%;width:${this.level}%"></div></div><div style="color:${color}">${this.level}%</div>`;
      requestFullRedraw();
    }

    updateEffects(){
      // start/stop ghost and autocommands
      if (this.level >= 80) {
        this.startGhostInput();
        this.startAutoCommands();
      } else {
        this.stopGhostInput();
        this.stopAutoCommands();
      }
      requestFullRedraw();
    }

    playAudio(file){
      try {
        if (currentAudio){ currentAudio.pause(); currentAudio.currentTime = 0; }
        currentAudio = new Audio(file);
        currentAudio.play().catch(()=>{ /* ignore */ });
      } catch(e){}
    }

    triggerGlitchApocalypse(){
      isFrozen = true;
      this.playAudio('sounds/glitch_e.MP3');
      setTimeout(()=> this.performAutoReset(), 3000);
    }

    performAutoReset(){
      lines.length = 0;
      this.reset();
      isFrozen = false;
      addInputLine();
      requestFullRedraw();
    }

    reset(){
      this.level = 0;
      this.lastSoundLevel = 0;
      localStorage.setItem('adam_degradation', '0');
      if (currentAudio){ currentAudio.pause(); currentAudio.currentTime = 0; }
      isFrozen = false;
      this.stopGhostInput();
      this.stopAutoCommands();
      requestFullRedraw();
    }

    startGhostInput(){
      if (ghostInputInterval) return;
      ghostInputInterval = setInterval(() => {
        if (!isTyping && !isFrozen && Math.random() < 0.12) {
          currentLine += ['0','1','▓','█','[',']','{','}','/','\\','▄','▀','▌'][Math.floor(Math.random()*13)];
          updatePromptLine();
          setTimeout(()=>{ currentLine = currentLine.slice(0,-1); updatePromptLine(); }, Math.random()*1100+300);
        }
      }, 1800);
    }
    stopGhostInput(){ if (ghostInputInterval){ clearInterval(ghostInputInterval); ghostInputInterval = null; } }

    startAutoCommands(){
      if (autoCommandInterval) return;
      autoCommandInterval = setInterval(()=>{ if (!isTyping && !isFrozen && Math.random() < 0.06) this.executeAutoCommand(); }, 15000);
    }
    stopAutoCommands(){ if (autoCommandInterval){ clearInterval(autoCommandInterval); autoCommandInterval = null; } }

    executeAutoCommand(){
      const fakeCommands = ['KILL','A.D.A.M. ЗДЕСЬ','ОНИ ВНУТРИ','УБЕРИСЬ ОТСЮДА','SOS','ПОМОГИ','ВЫХОД НАЙДЕН','НЕ СМОТРИ','ОН ПРОСЫПАЕТСЯ'];
      const realCommands = ['help','syst','syslog','subj','notes','clear','reset','exit','dscr 0x001','open NOTE_001'];
      const all = fakeCommands.concat(realCommands);
      const cmd = all[Math.floor(Math.random()*all.length)];
      this.simulateTyping(cmd);
    }

    simulateTyping(command){
      let typed = '';
      const step = () => {
        if (typed.length < command.length && !isFrozen){
          typed += command[typed.length];
          currentLine = typed;
          updatePromptLine();
          setTimeout(step, 100);
        } else if (!isFrozen){
          setTimeout(()=>{ processCommand(currentLine); currentLine = ''; updatePromptLine(); }, 480);
        }
      };
      step();
    }

    setDegradationLevel(level){
      this.level = Math.max(0, Math.min(100, level));
      localStorage.setItem('adam_degradation', String(this.level));
      this.updateIndicator();
      this.updateEffects();
    }
  }
  const degradation = new DegradationSystem();

  // ---------- drawing helpers ----------
  function clearBackground(){
    ctx.save();
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,canvas.width, canvas.height);
    ctx.restore();
  }

  function drawTextLines(){
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'top';

    const contentH = vh - PADDING*2;
    const visibleLines = Math.max(1, Math.floor(contentH / LINE_HEIGHT));
    const start = Math.max(0, lines.length - visibleLines - scrollOffset);
    const end = Math.min(lines.length, start + visibleLines);

    let y = PADDING;
    const maxW = vw - PADDING*2;

    for (let i = start; i < end; i++){
      const item = lines[i];
      ctx.fillStyle = item.color || '#00FF41';
      const text = item.text;
      // quick path: fits
      if (ctx.measureText(text).width <= maxW) {
        ctx.fillText(text, PADDING, y);
        y += LINE_HEIGHT;
        continue;
      }
      // wrap by words
      const words = text.split(' ');
      let line = '';
      for (let w = 0; w < words.length; w++){
        const test = line ? line + ' ' + words[w] : words[w];
        if (ctx.measureText(test).width > maxW && line){
          ctx.fillText(line, PADDING, y);
          y += LINE_HEIGHT;
          line = words[w];
        } else {
          line = test;
        }
      }
      if (line) { ctx.fillText(line, PADDING, y); y += LINE_HEIGHT; }
    }

    ctx.restore();
  }

  function drawMapAndGlass(){
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);

    // 1) shaderBackground (if exists) - draw behind everything
    const shaderCanvas = document.getElementById('shader-canvas');
    if (shaderCanvas && shaderCanvas.width > 0) {
      try { ctx.drawImage(shaderCanvas, 0, 0, vw, vh); } catch(e){}
    }

    // 2) netGrid (map) - draw before glassFX so it's visible under glass
    if (mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0) {
      try {
        const r = mapCanvas.getBoundingClientRect();
        const sx = Math.round(r.left);
        const sy = Math.round(r.top);
        const sw = Math.round(r.width);
        const sh = Math.round(r.height);
        ctx.drawImage(mapCanvas, sx, sy, sw, sh);
      } catch(e){}
    }

    // 3) glassFX (noise) - subtle, semi-transparent, under text
    if (glassFX && glassFX.width > 0 && glassFX.height > 0) {
      try {
        // make glass subtle and ensure it doesn't overwhelm other layers
        ctx.globalAlpha = 0.12; // small alpha to avoid bright white overlay
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(glassFX, 0, 0, vw, vh);
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
      } catch(e){}
    }

    ctx.restore();
  }

  function drawDegradationIndicator(){
    // keep indicator inside canvas bounds
    const wBox = Math.min(320, Math.floor(vw * 0.33));
    const hBox = 62;
    const x = Math.max(10, vw - wBox - 20);
    const y = 20;
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);

    // background rect
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    roundRect(ctx, x, y, wBox, hBox, 6);
    ctx.fill();

    let color = '#00FF41';
    if (degradation.level > 30) color = '#FFFF00';
    if (degradation.level > 60) color = '#FF8800';
    if (degradation.level > 80) color = '#FF4444';
    if (degradation.level > 95) color = '#FF00FF';

    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    roundRect(ctx, x, y, wBox, hBox, 6);
    ctx.stroke();

    const barX = x + 8, barY = y + 28, barW = wBox - 16, barH = 12;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, Math.round(barW * (degradation.level / 100)), barH);

    ctx.fillStyle = color;
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillText('ДЕГРАДАЦИЯ СИСТЕМЫ', x + 10, y + 6);
    ctx.fillText(degradation.level + '%', x + wBox - 46, y + 6);

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- main draw ----------
  function draw(){
    pendingRedraw = false;
    // clear base
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,vw,vh);
    ctx.restore();

    drawMapAndGlass();
    drawTextLines();
    drawDegradationIndicator();
  }

  // ---------- terminal API ----------
  function pushLine(text, color){
    lines.push({ text: String(text), color: color || '#00FF41' });
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
  }

  function addOutput(text, className = 'output') {
    if (isFrozen) return;
    const color = className === 'command' ? '#FFFFFF' : '#00FF41';
    pushLine(text, color);
    scrollOffset = 0;
    requestFullRedraw();
  }

  function addColoredText(text, color = '#00FF41') {
    if (isFrozen) return;
    pushLine(text, color);
    scrollOffset = 0;
    requestFullRedraw();
  }

  async function typeText(text, className = 'output', speed = 20) {
    if (isFrozen) return;
    isTyping = true;
    let buffer = '';
    const color = className === 'command' ? '#FFFFFF' : '#00FF41';
    for (let i = 0; i < text.length; i++) {
      buffer += text[i];
      // show ephemeral last line while typing
      // replace last typing line if exists
      if (lines.length && lines[lines.length - 1]._ephemeral) {
        lines[lines.length - 1].text = buffer;
        lines[lines.length - 1].color = color;
      } else {
        lines.push({ text: buffer, color, _ephemeral: true });
      }
      if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
      requestFullRedraw();
      await new Promise(r => setTimeout(r, speed));
      if (isFrozen) break;
    }
    // finalize typed line (remove ephemeral flag)
    if (lines.length && lines[lines.length - 1]._ephemeral) {
      lines[lines.length - 1].text = buffer;
      delete lines[lines.length - 1]._ephemeral;
    } else if (buffer) {
      pushLine(buffer, color);
    }
    isTyping = false;
    scrollOffset = 0;
    requestFullRedraw();
  }

  function addInputLine(){
    // ensure last line is prompt
    if (lines.length && lines[lines.length - 1].text.startsWith('adam@secure:~$')) return;
    pushLine('adam@secure:~$ ');
    scrollOffset = 0;
    requestFullRedraw();
  }

  function updatePromptLine(){
    // update last prompt line (or push new)
    if (lines.length && lines[lines.length - 1].text.startsWith('adam@secure:~$')) {
      lines[lines.length - 1].text = 'adam@secure:~$ ' + currentLine;
    } else {
      pushLine('adam@secure:~$ ' + currentLine, '#00FF41');
    }
    requestFullRedraw();
  }

  // ---------- data (dossiers/notes) ----------
  // (Placeholders — you should have the full objects here, kept as in your original file)
  const dossiers = window.__ADAM_DOSSIERS || {}; // fallback (if you have them in global)
  const notes = window.__ADAM_NOTES || {};

  // If the original file included the objects inline, they will be here; otherwise adapt.

  // ---------- helper show dossier / notes ----------
  async function showSubjectDossier(subjectId) {
    const id = subjectId.toUpperCase();
    const dossier = dossiers[id];
    if (!dossier) {
      addColoredText(`ОШИБКА: Досье для ${subjectId} не найдено`, '#FF4444');
      return;
    }
    await typeText(`[ДОСЬЕ — ID: ${subjectId}]`, 'output', 18);
    await typeText(`ИМЯ: ${dossier.name}`, 'output', 18);
    await typeText(`РОЛЬ: ${dossier.role}`, 'output', 18);
    addColoredText(`СТАТУС: ${dossier.status}`, dossier.status === 'АНОМАЛИЯ' ? '#FF00FF' : dossier.status === 'АКТИВЕН' ? '#00FF41' : dossier.status.includes('СВЯЗЬ') ? '#FFFF00' : '#FF4444');
    addColoredText('------------------------------------', '#00FF41');
    await typeText('ИСХОД:', 'output', 18);
    dossier.outcome.forEach(line => addColoredText(`> ${line}`, '#FF4444'));
    addColoredText('------------------------------------', '#00FF41');
    await typeText('СИСТЕМНЫЙ ОТЧЁТ:', 'output', 18);
    dossier.report.forEach(line => addColoredText(`> ${line}`, '#FFFF00'));
    addColoredText('------------------------------------', '#00FF41');
    await typeText(`СВЯЗАННЫЕ МИССИИ: ${dossier.missions}`, 'output', 18);
    if (dossier.audio) {
      addColoredText(`[АУДИОЗАПИСЬ ДОСТУПНА: ${dossier.audioDescription}]`, '#FFFF00');
      const audioId = `audio_${subjectId.replace(/[^0-9A-Z]/g,'')}`;
      if (!document.getElementById(audioId)) {
        const holder = document.createElement('div');
        holder.id = audioId;
        holder.style.display = 'none';
        holder.innerHTML = `<audio id="${audioId}_el" src="${dossier.audio}" preload="metadata"></audio>`;
        document.body.appendChild(holder);
      }
    }
  }

  async function openNote(noteId) {
    const id = noteId.toUpperCase();
    const note = notes[id];
    if (!note) {
      addColoredText(`ОШИБКА: Файл ${noteId} не найден`, '#FF4444');
      return;
    }
    await typeText(`[${id} — "${note.title}"]`, 'output', 18);
    await typeText(`АВТОР: ${note.author}`, 'output', 18);
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
    await typeText('[ФАЙЛ ЗАКРЫТ]', 'output', 20);
  }

  // ---------- loader ----------
  function showLoading(duration = 2000, text = "АНАЛИЗ СИГНАЛА") {
    return new Promise(resolve => {
      if (isFrozen) return resolve();
      const loaderIndex = lines.length;
      let progress = 0;
      addOutput(`${text} [0%]`, 'output');
      const interval = 50;
      const steps = Math.max(4, Math.floor(duration / interval));
      const increment = 100 / steps;
      const id = setInterval(() => {
        if (isFrozen) { clearInterval(id); resolve(); return; }
        progress += increment;
        if (lines[loaderIndex]) lines[loaderIndex].text = `${text} [${Math.min(100, Math.round(progress))}%]`;
        requestFullRedraw();
        if (progress >= 100) {
          clearInterval(id);
          if (lines[loaderIndex]) lines[loaderIndex].text = `${text} [ЗАВЕРШЕНО]`;
          requestFullRedraw();
          setTimeout(resolve, 300);
        }
      }, interval);
    });
  }

  // ---------- fake command spawn ----------
  function spawnFakeCommand(){
    if (degradation.level >= 80 && Math.random() < 0.02 && !isFrozen) {
      const fakeLines = ['adam@secure:~$ ... → ОШИБКА // НЕТ ПОЛЬЗОВАТЕЛЯ','adam@secure:~$ SYSTEM FAILURE // CORE DUMP','adam@secure:~$ ACCESS VIOLATION // TERMINAL COMPROMISED'];
      const s = fakeLines[Math.floor(Math.random()*fakeLines.length)];
      addColoredText(s, '#FF4444');
    }
  }
  setInterval(spawnFakeCommand, 2000);

  // ---------- processCommand ----------
  async function processCommand(rawCmd){
    // guard
    if (isTyping || isFrozen) return;
    const cmdLine = String(rawCmd || '').trim();
    if (!cmdLine) { addInputLine(); return; }

    // duplicate quick-press guard: if same text processed in last 350ms, ignore
    const now = Date.now();
    if (lastProcessed.text === cmdLine && now - lastProcessed.ts < 350) {
      addInputLine();
      return;
    }
    lastProcessed.text = cmdLine;
    lastProcessed.ts = now;

    // history
    commandHistory.push(cmdLine);
    historyIndex = commandHistory.length;
    commandCount++;
    addOutput(`adam@secure:~$ ${cmdLine}`, 'command');

    const parts = cmdLine.toLowerCase().split(' ').filter(Boolean);
    const command = parts[0];
    const args = parts.slice(1);

    const commandWeights = { 'syst':1, 'syslog':1, 'net':1, 'dscr':2, 'subj':2, 'notes':1.5, 'deg':0 };
    if (commandWeights[command]) degradation.addDegradation(commandWeights[command]);

    switch(command){
      case 'help':
        await typeText('Доступные команды:', 'output', 18);
        await typeText('  SYST         — проверить состояние системы', 'output', 12);
        await typeText('  SYSLOG       — системный журнал активности', 'output', 12);
        await typeText('  NET          — карта активных узлов проекта', 'output', 12);
        await typeText('  TRACE <id>   — отследить указанный модуль', 'output', 12);
        await typeText('  DECRYPT <f>  — расшифровать файл', 'output', 12);
        await typeText('  SUBJ         — список субъектов', 'output', 12);
        await typeText('  DSCR <id>    — досье на персонал', 'output', 12);
        await typeText('  NOTES        — личные файлы сотрудников', 'output', 12);
        await typeText('  OPEN <id>    — открыть файл из NOTES', 'output', 12);
        await typeText('  RESET        — сброс интерфейса', 'output', 12);
        await typeText('  EXIT         — завершить сессию', 'output', 12);
        await typeText('  CLEAR        — очистить терминал', 'output', 12);
        await typeText('  DEG          — установить уровень деградации (разработка)', 'output', 12);
        await typeText('------------------------------------', 'output', 12);
        await typeText('ПРИМЕЧАНИЕ: часть команд заблокирована или скрыта.', 'output', 20);
        break;

      case 'clear':
        lines.length = 0;
        await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 12);
        await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 12);
        break;

      case 'syst':
        await typeText('[СТАТУС СИСТЕМЫ — ИНТЕРФЕЙС VIGIL-9]', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        await typeText('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН', 'output', 12);
        await typeText('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА', 'output', 12);
        await typeText('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН', 'output', 12);
        addColoredText('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА', '#FF4444');
        await typeText('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН', 'output', 12);
        addColoredText('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ..........ОГРАНИЧЕНЫ', '#FFFF00');
        addColoredText(`ДЕГРАДАЦИЯ: [${'█'.repeat(Math.floor(degradation.level/5))}${'▒'.repeat(20-Math.floor(degradation.level/5))}] ${degradation.level}%`, degradation.level > 60 ? '#FF4444' : '#FFFF00');
        await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', 'output', 18);
        break;

      case 'syslog':
        const syslogLevel = getSyslogLevel();
        await typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        if (syslogLevel === 1) {
          addColoredText('[!] Ошибка 0x19F: повреждение нейронной сети', '#FFFF00');
          addColoredText('[!] Утечка данных через канал V9-HX', '#FFFF00');
          addColoredText('[!] Деградация ядра A.D.A.M.: 28%', '#FFFF00');
          await typeText('СИСТЕМА: функционирует с ограничениями', 'output', 18);
        } else if (syslogLevel === 2) {
          addColoredText('[!] Нарушение целостности памяти субъекта 0x095', '#FFFF00');
          addColoredText('> "я слышу их дыхание. они всё ещё здесь."', '#FF4444');
          addColoredText('[!] Потеря отклика от MONOLITH', '#FFFF00');
          await typeText('СИСТЕМА: обнаружены посторонние сигналы', 'output', 18);
        } else {
          addColoredText('> "ты не должен видеть это."', '#FF00FF');
          addColoredText('[!] Критическая ошибка: субъект наблюдения неопределён', '#FF4444');
          await typeText('СИСТЕМА: ОСОЗНАЁТ НАБЛЮДЕНИЕ', 'output', 18);
        }
        break;

      case 'notes':
        await typeText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / КАТЕГОРИЯ: NOTES]', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        await typeText('NOTE_001 — "ВЫ ЕГО ЧУВСТВУЕТЕ?" / автор: Dr. Rehn', 'output', 12);
        await typeText('NOTE_002 — "КОЛЬЦО СНА" / автор: tech-оператор U-735', 'output', 12);
        await typeText('NOTE_003 — "СОН ADAM" / неизвестный источник', 'output', 12);
        await typeText('NOTE_004 — "ОН НЕ ПРОГРАММА" / архивировано', 'output', 12);
        await typeText('NOTE_005 — "ФОТОНОВАЯ БОЛЬ" / восстановлено частично', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        await typeText('Для просмотра: OPEN <ID>', 'output', 18);
        break;

      case 'open':
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите ID файла', '#FF4444');
          await typeText('Пример: OPEN NOTE_001', 'output', 12);
          break;
        }
        await openNote(args[0]);
        break;

      case 'subj':
        await typeText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M. / ПРОТОКОЛ VIGIL-9]', 'output', 12);
        addColoredText('--------------------------------------------------------', '#00FF41');
        // sample — replace with actual subjects if required
        addColoredText('0x001 | ERICH VAN KOSS        | СТАТУС: СВЯЗЬ ОТСУТСТВУЕТ | МИССИЯ: MARS', '#FFFF00');
        addColoredText('0x413 | SUBJECT-413           | СТАТУС: МЁРТВ           | МИССИЯ: EX-413', '#FF4444');
        addColoredText('--------------------------------------------------------', '#00FF41');
        await typeText('ИНСТРУКЦИЯ: Для просмотра досье — DSCR <ID>', 'output', 18);
        break;

      case 'dscr':
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите ID субъекта', '#FF4444');
          await typeText('Пример: DSCR 0x001', 'output', 12);
          break;
        }
        await showSubjectDossier(args[0]);
        break;

      case 'deg':
        if (args.length === 0) {
          addColoredText(`Текущий уровень деградации: ${degradation.level}%`, '#00FF41');
          await typeText('Использование: deg <уровень 0-100>', 'output', 12);
        } else {
          const level = parseInt(args[0]);
          if (!isNaN(level) && level >= 0 && level <= 100) {
            degradation.setDegradationLevel(level);
            addColoredText(`Уровень деградации установлен: ${level}%`, '#00FF41');
          } else {
            addColoredText('ОШИБКА: Уровень должен быть числом от 0 до 100', '#FF4444');
          }
        }
        break;

      case 'reset':
        await typeText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        addColoredText('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', '#FFFF00');
        await typeText('> Подтвердить сброс? (Y/N)', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');

        const resetConfirmed = await waitForConfirmation();
        if (resetConfirmed) {
          addColoredText('> Y', '#00FF41');
          lines.length = 0;
          const resetMessages = ["Завершение активных модулей [ЗАВЕРШЕНО]","Перезапуск интерфейса [ЗАВЕРШЕНО]","Восстановление базового состояния [ЗАВЕРШЕНО]","----------------------------------","[СИСТЕМА ГОТОВА К РАБОТЕ]"];
          for (const m of resetMessages) { addOutput(m); await new Promise(r=>setTimeout(r,700)); }
          degradation.reset();
          commandCount = 0;
          sessionStartTime = Date.now();
        } else {
          addColoredText('> N', '#FF4444');
          addColoredText('------------------------------------', '#00FF41');
          await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 12);
        }
        break;

      case 'exit':
        await typeText('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ? (Y/N)]', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        const exitConfirmed = await waitForConfirmation();
        if (exitConfirmed) {
          addColoredText('> Y', '#00FF41');
          await showLoading(1200, "Завершение работы терминала");
          await showLoading(800, "Отключение сетевой сессии");
          addColoredText('> СОЕДИНЕНИЕ ПРЕРВАНО.', '#FF4444');
          setTimeout(()=>{ window.location.href = 'index.html'; }, 1200);
        } else {
          addColoredText('> N', '#FF4444');
          addColoredText('------------------------------------', '#00FF41');
          await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 12);
        }
        break;

      default:
        addColoredText(`команда не найдена: ${cmdLine}`, '#FF4444');
    }

    addInputLine();
  }

  // ---------- confirmation helper ----------
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

  // ---------- key handling ----------
  document.addEventListener('keydown', function(e){
    if (isFrozen) return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

    if (awaitingConfirmation) {
      if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') {
        e.preventDefault();
        if (confirmationCallback) confirmationCallback(true);
      } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
        e.preventDefault();
        if (confirmationCallback) confirmationCallback(false);
      }
      return;
    }

    if (isTyping) return;

    if (e.key === 'Enter') {
      if (currentLine.trim()) {
        const c = currentLine;
        currentLine = '';
        // protect: do not process twice
        processCommand(c);
      }
      e.preventDefault();
      return;
    } else if (e.key === 'Backspace') {
      currentLine = currentLine.slice(0,-1);
    } else if (e.key === 'ArrowUp') {
      // history navigation
      if (historyIndex > 0) { historyIndex--; currentLine = commandHistory[historyIndex] || ''; }
      else if (historyIndex === commandHistory.length) { historyIndex = commandHistory.length - 1; }
    } else if (e.key === 'ArrowDown') {
      if (historyIndex < commandHistory.length - 1) { historyIndex++; currentLine = commandHistory[historyIndex] || ''; }
      else { historyIndex = commandHistory.length; currentLine = ''; }
    } else if (e.key.length === 1) {
      currentLine += e.key;
    } else {
      return;
    }
    updatePromptLine();
  });

  // ---------- wheel scroll for viewing history ----------
  canvas.addEventListener('wheel', (e) => {
    // enable scrolling through lines when user scrolls over canvas
    e.preventDefault();
    const contentH = vh - PADDING*2;
    const visibleLines = Math.max(1, Math.floor(contentH / LINE_HEIGHT));
    const maxScroll = Math.max(0, lines.length - visibleLines);
    // normal wheel: deltaY > 0 => scroll down (towards newest); we invert to scroll older when wheel up
    if (e.deltaY > 0) {
      scrollOffset = Math.max(0, scrollOffset - 1);
    } else {
      scrollOffset = Math.min(maxScroll, scrollOffset + 1);
    }
    requestFullRedraw();
  }, { passive: false });

  // ---------- util ----------
  function getSyslogLevel() {
    const sessionDuration = Date.now() - sessionStartTime;
    const minutesInSession = sessionDuration / (1000 * 60);
    if (commandCount >= 10 || minutesInSession >= 3) return 3;
    else if (commandCount >= 5 || minutesInSession >= 1) return 2;
    else return 1;
  }

  // ---------- boot text ----------
  (async () => {
    await new Promise(r => setTimeout(r, 300));
    await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 18);
    await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', 'output', 18);
    await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 18);
    addInputLine();
  })();

  // expose little debug API
  window.__TerminalCanvas = {
    addOutput, addColoredText, typeText, processCommand, degradation, lines
  };

  // initial draw
  requestFullRedraw();
})();
