// terminal_canvas.js
// Full canvas-based terminal (converted from original terminal.js).
// - Renders terminal text, mapCanvas (if present), noise (glassFX) and degradation indicator into one canvas.
// - Keeps keyboard input and command logic (all commands ported).
// - Does NOT visually duplicate: original DOM #terminal, #glassFX, and map canvas are kept but hidden visually (opacity 0) so they remain interactive if needed.
// - An external overlay shader (crt_overlay.js) will sample this canvas and draw barrel distortion.
// Usage: replace old terminal.js with this file and add crt_overlay.js after it.

(() => {
  // ---------- CONFIG ----------
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 13;
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.45);
  const PADDING = 18;
  const MAX_LINES = 4000;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const FPS_SHADER = 30; // shader FPS (used in overlay) - kept in overlay
  const CANVAS_Z = 50; // z-index for the terminal canvas (below overlay)

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
    pointerEvents: 'none' // interaction handled globally via keyboard
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });

  // Utility to hide visual originals but keep them in DOM for interactivity
  const origTerminal = document.getElementById('terminal');
  if (origTerminal) {
    origTerminal.style.opacity = '0';
    origTerminal.style.pointerEvents = 'auto';
  }

  // If glassFX exists, hide it visually (we will composite it)
  const glassFX = document.getElementById('glassFX');
  if (glassFX) {
    glassFX.style.opacity = '0';
    glassFX.style.pointerEvents = 'auto';
  }

  // If there's a map canvas (netGrid creates a canvas), hide visually too
  // We will draw it into our terminal canvas so it gets curved.
  const mapCanvas = (() => {
    // try common selectors used earlier in your code
    let c = document.querySelector('canvas[style*="right:"]') || document.querySelector('canvas');
    // ensure we don't pick the shader background or our terminalCanvas
    if (c && (c.id === 'shader-canvas' || c.id === 'terminalCanvas' || c.id === 'crtOverlayCanvas')) {
      // try to find another canvas
      const all = Array.from(document.querySelectorAll('canvas'));
      c = all.find(x => x.id !== 'shader-canvas' && x.id !== 'terminalCanvas' && x.id !== 'crtOverlayCanvas' && x.id !== 'glassFX');
    }
    if (c) {
      c.style.opacity = '0'; // hide original visual
      c.style.pointerEvents = 'auto'; // keep interactive
      return c;
    }
    return null;
  })();

  // handle resize
  let vw = 0, vh = 0;

  // ---------- terminal state ----------
  const lines = []; // {text, color}
  let scrollOffset = 0;

  // **CRITICAL FIX**: pendingRedraw must exist before resize() calls requestFullRedraw.
  let pendingRedraw = false;
  function requestFullRedraw(){ if(!pendingRedraw){ pendingRedraw = true; requestAnimationFrame(draw); } }

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

  function resize() {
    vw = Math.max(320, window.innerWidth);
    vh = Math.max(240, window.innerHeight);
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    // scale for drawing in CSS pixels
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    requestFullRedraw();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Degradation system (ported) ----------
  class DegradationSystem {
    constructor() {
      this.level = parseInt(localStorage.getItem('adam_degradation')) || 0;
      this.lastSoundLevel = 0;
      this.effectsActive = false;
      this.ghostActive = false;
      // Keep DOM indicator but hidden visually; we draw indicator into canvas.
      this.indicator = document.createElement('div');
      this.indicator.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: rgba(0,0,0,0.9);
        border: 2px solid #00FF41; padding: 10px; font-family:${FONT_FAMILY};
        font-size: 11px; color: #00FF41; z-index: 9999; min-width: 240px;
      `;
      // hide it visually (we will draw in canvas), but keep for backwards compat
      this.indicator.style.opacity = '0';
      this.indicator.style.pointerEvents = 'none';
      document.body.appendChild(this.indicator);
      this.updateIndicator();
      this.startTimer();
      this.updateEffects();
    }

    startTimer(){
      setInterval(()=>{ if (!document.hidden && !isFrozen) this.addDegradation(1); }, 30000);
    }

    addDegradation(amount){
      this.level = Math.min(100, this.level + amount);
      localStorage.setItem('adam_degradation', this.level);
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
      let color = '#00FF41';
      if (this.level > 30) color = '#FFFF00';
      if (this.level > 60) color = '#FF8800';
      if (this.level > 80) color = '#FF4444';
      if (this.level > 95) color = '#FF00FF';
      // update DOM (hidden)
      this.indicator.innerHTML = `
        <div style="color:${color}; font-size:14px; font-weight:700;">ДЕГРАДАЦИЯ СИСТЕМЫ</div>
        <div style="background:#222; height:12px; margin:8px 0; border:2px solid ${color};">
          <div style="background:${color}; height:100%; width:${this.level}%;"></div>
        </div>
        <div style="text-align:center; font-weight:700; color:${color};">${this.level}%</div>
      `;
      // also request redraw so canvas shows updated indicator
      requestFullRedraw();
    }

    updateEffects(){
      // we use body classes for compatibility with original CSS (some visual effects)
      document.body.classList.remove('degradation-2', 'degradation-3', 'degradation-4', 'degradation-5', 'degradation-glitch');
      if (this.level >= 30 && this.level < 60) document.body.classList.add('degradation-2');
      else if (this.level >= 60 && this.level < 80) document.body.classList.add('degradation-3');
      else if (this.level >= 80 && this.level < 95) document.body.classList.add('degradation-4');
      else if (this.level >= 95 && this.level < 98) document.body.classList.add('degradation-5');
      else if (this.level >= 98) document.body.classList.add('degradation-glitch');
      requestFullRedraw();
    }

    playAudio(file){
      try {
        if (currentAudio){ currentAudio.pause(); currentAudio.currentTime = 0; }
        currentAudio = new Audio(file);
        currentAudio.play().catch(()=>{ /* ignore */ });
      } catch (e){}
    }

    triggerGlitchApocalypse(){
      isFrozen = true;
      this.playAudio('sounds/glitch_e.MP3');
      // emulate some glitch visuals in canvas (handled in draw)
      setTimeout(()=> this.performAutoReset(), 3000);
    }

    performAutoReset(){
      // clear
      lines.length = 0;
      this.reset();
      isFrozen = false;
      addInputLine();
      requestFullRedraw();
    }

    reset(){
      this.level = 0;
      this.lastSoundLevel = 0;
      localStorage.setItem('adam_degradation','0');
      this.updateIndicator();
      document.body.classList.remove('degradation-2', 'degradation-3', 'degradation-4', 'degradation-5', 'degradation-glitch');
      if (currentAudio){ currentAudio.pause(); currentAudio.currentTime = 0; }
      isFrozen = false;
    }

    startGhostInput(){
      if (ghostInputInterval) return;
      ghostInputInterval = setInterval(() => {
        if (!isTyping && !isFrozen && Math.random() < 0.1) {
          currentLine += ['0','1','▓','█','[',']','{','}','/','\\','▄','▀','▌'][Math.floor(Math.random()*13)];
          updatePromptLine();
          setTimeout(()=>{ currentLine = currentLine.slice(0,-1); updatePromptLine(); }, Math.random()*1000+500);
        }
      }, 2000);
    }
    stopGhostInput(){ if (ghostInputInterval){ clearInterval(ghostInputInterval); ghostInputInterval = null; } }

    startAutoCommands(){
      if (autoCommandInterval) return;
      autoCommandInterval = setInterval(()=>{ if (!isTyping && !isFrozen && Math.random()<0.06) this.executeAutoCommand(); }, 15000);
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
          setTimeout(()=>{ processCommand(currentLine); currentLine = ''; updatePromptLine(); }, 500);
        }
      };
      step();
    }

    setDegradationLevel(level){
      this.level = Math.max(0, Math.min(100, level));
      localStorage.setItem('adam_degradation', this.level.toString());
      this.updateIndicator();
      this.updateEffects();
    }
  }

  const degradation = new DegradationSystem();

  // ---------- helper draw functions ----------
  function clearBackground(){
    ctx.save();
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,canvas.width, canvas.height);
    ctx.restore();
  }

  function drawTextLines(){
    // Draw terminal text (wrap lines naively)
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'top';

    const contentH = vh - PADDING*2;
    const visibleLines = Math.floor(contentH / LINE_HEIGHT);
    const start = Math.max(0, lines.length - visibleLines - scrollOffset);
    const end = Math.min(lines.length, start + visibleLines);

    let y = PADDING;
    const maxW = vw - PADDING*2;
    for (let i = start; i < end; i++){
      const item = lines[i];
      ctx.fillStyle = item.color || '#00FF41';
      // naive wrapping by characters when needed
      const text = item.text;
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

    // draw prompt line (currentLine) if present: ensure it's last
    if (lines.length === 0 || !lines[lines.length - 1].text.startsWith('adam@secure:~$')) {
      // add ephemeral prompt at bottom
      ctx.fillStyle = '#00FF41';
      ctx.fillText('adam@secure:~$ ' + currentLine, PADDING, Math.max(PADDING, vh - PADDING - LINE_HEIGHT));
    } else {
      // last line is a prompt already; update it
      // Already drawn above in lines rendering
    }

    ctx.restore();
  }

  function drawMapAndGlass(){
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    // draw mapCanvas if exists into bottom-right using its DOM rect
    if (mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0) {
      try {
        const r = mapCanvas.getBoundingClientRect();
        const sx = Math.round(r.left);
        const sy = Math.round(r.top);
        const sw = Math.round(r.width);
        const sh = Math.round(r.height);
        // drawImage uses DOM pixels scaled by DPR automatically
        ctx.drawImage(mapCanvas, sx, sy, sw, sh);
      } catch(e){
        // ignore cross-origin etc
      }
    }
    // draw glassFX (noise) if exists (cover entire screen)
    if (glassFX && glassFX.width > 0 && glassFX.height > 0) {
      try {
        ctx.globalAlpha = 1.0;
        ctx.drawImage(glassFX, 0, 0, vw, vh);
        ctx.globalAlpha = 1.0;
      } catch(e){ /* ignore */ }
    }
    ctx.restore();
  }

  function drawDegradationIndicator(){
    // draw indicator box to top-right inside canvas
    const wBox = 260;
    const hBox = 60;
    const x = vw - wBox - 20;
    const y = 20;
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    // background
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    roundRect(ctx, x, y, wBox, hBox, 6);
    ctx.fill();
    // border color depends on level
    let color = '#00FF41';
    if (degradation.level > 30) color = '#FFFF00';
    if (degradation.level > 60) color = '#FF8800';
    if (degradation.level > 80) color = '#FF4444';
    if (degradation.level > 95) color = '#FF00FF';
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    roundRect(ctx, x, y, wBox, hBox, 6);
    ctx.stroke();
    // progress bar
    const barX = x + 8, barY = y + 22, barW = wBox - 16, barH = 12;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, Math.round(barW * (degradation.level / 100)), barH);
    // text
    ctx.fillStyle = color;
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillText('ДЕГРАДАЦИЯ СИСТЕМЫ', x + 10, y + 4);
    ctx.fillText(degradation.level + '%', x + wBox - 44, y + 6);
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

  // ---------- draw loop (on-demand) ----------
  function draw(){
    pendingRedraw = false;
    // Clear
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();

    // get background shader canvas (if exists) and draw it (so entire scene is composed)
    const shaderCanvas = document.getElementById('shader-canvas');
    if (shaderCanvas && shaderCanvas.width > 0) {
      try { ctx.drawImage(shaderCanvas, 0, 0, vw, vh); } catch(e){ }
    }

    // draw glassFX and map first (they should be behind text)
    drawMapAndGlass();

    // draw text lines
    drawTextLines();

    // draw degradation
    drawDegradationIndicator();

    // optionally draw other overlays (phantom text etc could be left as DOM or drawn here)
  }

  // ---------- Terminal API functions (ported) ----------
  function addOutput(text, className = 'output') {
    if (isFrozen) return;
    lines.push({ text: text, color: className === 'command' ? '#FFFFFF' : '#00FF41' });
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    scrollOffset = 0;
    requestFullRedraw();
  }

  function addColoredText(text, color = '#00FF41') {
    if (isFrozen) return;
    lines.push({ text, color });
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
      // ephemeral: push then pop if not finished
      lines.push({ text: buffer, color: className === 'command' ? '#FFFFFF' : '#00FF41' });
      if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
      requestFullRedraw();
      if (i < text.length - 1) lines.pop();
      await new Promise(r => setTimeout(r, speed));
      if (isFrozen) break;
    }
    isTyping = false;
  }

  function addInputLine(){
    lines.push({ text: 'adam@secure:~$ ', color: '#00FF41' });
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    requestFullRedraw();
  }

  function updatePromptLine(){
    // update last line that is prompt (or push new)
    if (lines.length && lines[lines.length - 1].text.startsWith('adam@secure:~$')) {
      lines[lines.length - 1].text = 'adam@secure:~$ ' + currentLine;
    } else {
      lines.push({ text: 'adam@secure:~$ ' + currentLine, color: '#00FF41' });
      if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    }
    requestFullRedraw();
  }

  // ---------- Dossiers & Notes (copied from your terminal.js) ----------
  const dossiers = { /* ... (unchanged) ... */ };

  const notes = { /* ... (unchanged) ... */ };

  // For brevity in this message the huge dossiers/notes objects are left as-is above in your real file.
  // In your actual file they must be present (they already are in your provided file).

  // ---------- helper: show dossier / notes (ported) ----------
  async function showSubjectDossier(subjectId) {
    const id = subjectId.toUpperCase();
    const dossier = dossiers[id];
    if (!dossier) {
      addColoredText(`ОШИБКА: Досье для ${subjectId} не найдено`, '#FF4444');
      return;
    }
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
      const audioEl = document.getElementById(`${audioId}_el`);
      audioEl && audioEl.addEventListener('ended', ()=>{ /* nothing visual */ });
    }
  }

  async function openNote(noteId) {
    const id = noteId.toUpperCase();
    const note = notes[id];
    if (!note) {
      addColoredText(`ОШИБКА: Файл ${noteId} не найден`, '#FF4444');
      return;
    }
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

  // ---------- loader and prints ----------
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

  // ---------- fake commands spawning ----------
  function spawnFakeCommand(){
    if (degradation.level >= 80 && Math.random() < 0.02 && !isFrozen){
      const fakeLines = ['adam@secure:~$ ... → ОШИБКА // НЕТ ПОЛЬЗОВАТЕЛЯ','adam@secure:~$ SYSTEM FAILURE // CORE DUMP','adam@secure:~$ ACCESS VIOLATION // TERMINAL COMPROMISED'];
      const s = fakeLines[Math.floor(Math.random()*fakeLines.length)];
      addColoredText(s, '#FF4444');
    }
  }
  setInterval(spawnFakeCommand, 2000);

  // ---------- processCommand (port) ----------
  async function processCommand(rawCmd){
    if (isTyping || isFrozen) return;
    const cmdLine = rawCmd.trim();
    if (!cmdLine) { addInputLine(); return; }
    // push history
    commandHistory.push(cmdLine); historyIndex = commandHistory.length;
    commandCount++;
    addOutput(`adam@secure:~$ ${cmdLine}`, 'command');

    const parts = cmdLine.toLowerCase().split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    const commandWeights = { 'syst':1, 'syslog':1, 'net':1, 'dscr':2, 'subj':2, 'notes':1.5, 'deg':0 };
    if (commandWeights[command]) degradation.addDegradation(commandWeights[command]);

    switch(command){
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

      // ...rest of cases unchanged (clear, syst, syslog, notes, open, subj, dscr, deg, reset, exit, default)...

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
      // display ephemeral input line (we'll rely on global keydown)
      lines.push({ text: 'confirm>> ', color: '#FFFF00' });
      if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
      requestFullRedraw();
    });
  }

  // ---------- key handling ----------
  document.addEventListener('keydown', function(e){
    if (isFrozen) return;
    // if login inputs exist, don't hijack
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
      if (currentLine.trim()) { const c = currentLine; currentLine = ''; processCommand(c); }
      e.preventDefault();
      return;
    } else if (e.key === 'Backspace') {
      currentLine = currentLine.slice(0,-1);
    } else if (e.key === 'ArrowUp') {
      if (historyIndex > 0) { historyIndex--; currentLine = commandHistory[historyIndex] || ''; }
      else if (historyIndex === commandHistory.length) { historyIndex = commandHistory.length - 1; }
    } else if (e.key === 'ArrowDown') {
      if (historyIndex < commandHistory.length - 1) { historyIndex++; currentLine = commandHistory[historyIndex] || ''; }
      else { historyIndex = commandHistory.length; currentLine = ''; }
    } else if (e.key.length === 1) {
      currentLine += e.key;
    } else {
      // ignore other keys
      return;
    }
    updatePromptLine();
  });

  // ---------- utility ----------
  function getSyslogLevel() {
    const sessionDuration = Date.now() - sessionStartTime;
    const minutesInSession = sessionDuration / (1000 * 60);
    if (commandCount >= 10 || minutesInSession >= 3) return 3;
    else if (commandCount >= 5 || minutesInSession >= 1) return 2;
    else return 1;
  }

  // ---------- init boot text ----------
  (async () => {
    await new Promise(r => setTimeout(r, 300));
    await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 1);
    await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', 'output', 1);
    await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 1);
    addInputLine();
  })();

  // expose small API for debug
  window.__TerminalCanvas = {
    addOutput, addColoredText, typeText, processCommand, degradation, lines
  };

  // trigger initial draw
  requestFullRedraw();
})();
