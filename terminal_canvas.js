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

  // ---------- terminal state ----------
  const lines = []; // {text, color}
  let scrollOffset = 0;
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
  const dossiers = {
    '0X001': { name: 'ERICH VAN KOSS', role: 'Руководитель программы VIGIL-9 / Исследователь миссии MARS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['Зафиксирована несанкционированная передача данных внешним структурам (FBI).', 'Субъект предпринял попытку уничтожения маяка в секторе 3-D.', 'Телеметрия прервана, дальнейшее наблюдение невозможно.'], report: ['Классификация инцидента: SABOTAGE-3D.', 'Рекомендовано аннулирование личных протоколов и перенос архивов в OBSERVER.'], missions: 'MARS, OBSERVER', audio: 'sounds/dscr1.mp3', audioDescription: 'Последняя передача Эриха Ван Косса' },
    '0X2E7': { name: 'JOHAN VAN KOSS', role: 'Тестовый субъект V9-MR / Сын Эриха Ван Косса', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['После инцидента MARS зафиксировано устойчивое излучение из зоны криоструктуры.', 'Сигнатура нейроволн совпадает с профилем субъекта.', 'Инициирована установка маяка для фиксации остаточного сигнала.'], report: ['Активность нейросети перестала фиксироваться.'], missions: 'MARS, MONOLITH' },
    '0X095': { name: 'SUBJECT-095', role: 'Тест нейроплантов серии KATARHEY', status: 'МЁРТВ', outcome: ['Зафиксированы следы ФАНТОМА.', 'Субъект выдержал 3ч 12м, проявил острый психоз. Открыл капсулу, погиб вследствие термической декомпрессии (7.81с).', 'Тест признан неуспешным.'], report: ['Рекомендовано ограничить тесты KATARHEY до категории ALPHA-4.'], missions: 'KATARHEY', audio: 'sounds/dscr2.mp3', audioDescription: 'Последняя запись субъекта - психоз и крики' },
    '0XF00': { name: 'SUBJECT-PHANTOM', role: 'Экспериментальный субъект / протокол KATARHEY', status: 'АНОМАЛИЯ', outcome: ['Продержался 5ч 31м. Связь утрачена.', 'Зафиксирована автономная активность в сетевых узлах после разрыва канала.', 'Возможна самоорганизация цифрового остатка.'], report: ['Объект классифицирован как независимая сущность.', 'Вмешательство запрещено. Файл перенесён в зону наблюдения.'], missions: 'KATARHEY', audio: 'sounds/dscr7.mp3', audioDescription: 'Аномальная активность Фантома' },
    '0XA52': { name: 'SUBJECT-A52', role: 'Химический аналитик / Полевая группа MELANCHOLIA', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['Под действием психоактивного сигнала субъект начал идентифицировать себя как элемент системы A.D.A.M.', 'После 47 минут связь прервана, но интерфейс продолжил отвечать от имени A52.'], report: ['Вероятно, произошло слияние когнитивных структур субъекта с управляющим кодом MEL.'], missions: 'MEL, OBSERVER' },
    '0XE0C': { name: 'SUBJECT-E0C', role: 'Полевой биолог / экспедиция EOCENE', status: 'МЁРТВ', outcome: ['Зафиксированы первые признаки регенерации флоры после катастрофы Пермского цикла.', 'Обнаружены структуры роста, не свойственные эпохе эоцена.', 'Последняя запись: "они дышат синхронно".'], report: ['Возможна перекрёстная временная контаминация между PERMIAN и EOCENE.', 'Экспедиция закрыта.'], missions: 'EOCENE, PERMIAN' },
    '0X5E4': { name: 'SUBJECT-5E4', role: 'Исследователь временных срезов (PERMIAN)', status: 'МЁРТВ', outcome: ['После активации катализатора атмосфера воспламенилась метаном.', 'Атмосферный цикл обнулён. Субъект не идентифицирован.'], report: ['Эксперимент признан неконтролируемым.', 'Временной слой PERMIAN изъят из программы наблюдения.'], missions: 'PERMIAN, CARBON' },
    '0X413': { name: 'SUBJECT-413', role: 'Исследователь внеземной экосистемы (EX-413)', status: 'МЁРТВ', outcome: ['Поверхность планеты представляла собой живой организм.', 'Экипаж поглощён. Зафиксирована передача сигналов через изменённый геном субъекта.'], report: ['Сектор EX-413 закрыт. Код ДНК использован в эксперименте HELIX.'], missions: 'EX-413', audio: 'sounds/dscr3.mp3', audioDescription: 'Запись контакта с внеземной биосферой' },
    '0XC19': { name: 'SUBJECT-C19', role: 'Переносчик образца / Контакт с биоформой', status: 'МЁРТВ', outcome: ['Организм использован как контейнер для спорообразной массы неизвестного происхождения.', 'После возвращения субъекта в лабораторию зафиксировано перекрёстное заражение трёх исследовательских блоков.'], report: ['Классификация угрозы: BIO-CLASS Θ.', 'Все данные проекта CARBON изолированы и зашифрованы.'], missions: 'CARBON' },
    '0X9A0': { name: 'SUBJECT-9A0', role: 'Тест наблюдения за горизонтом событий', status: 'МЁРТВ / СОЗНАНИЕ АКТИВНО', outcome: ['Зафиксирован визуальный контакт субъекта с собственным образом до точки обрыва сигнала.', 'Предположительно сознание зациклено в петле наблюдения.'], report: ['Поток данных из сектора BLACKHOLE продолжается без источника.', 'Обнаружены фрагменты самореференциальных структур.'], missions: 'BLACKHOLE', audio: 'sounds/dscr6.mp3', audioDescription: 'Петля сознания субъекта 9A0' },
    '0XB3F': { name: 'SUBJECT-B3F', role: 'Участник теста "Titanic Reclamation"', status: 'МЁРТВ', outcome: ['Субъект демонстрировал полное отсутствие эмоциональных реакций.', 'Миссия завершена неудачно, симуляция признана нефункциональной.'], report: ['Модуль TITANIC выведен из эксплуатации.', 'Рекомендовано пересмотреть параметры когнитивной эмпатии.'], missions: 'TITANIC' },
    '0XD11': { name: 'SUBJECT-D11', role: 'Поведенческий наблюдатель / тестовая миссия PLEISTOCENE', status: 'МЁРТВ', outcome: ['Субъект внедрён в сообщество ранних гоминид.', 'Контакт с источником тепла вызвал мгновенное разрушение капсулы.', 'Зафиксировано кратковременное пробуждение зеркальных нейронов у местных особей.'], report: ['Миссия признана успешной по уровню поведенческого заражения.'], missions: 'PLEISTOCENE' },
    '0XDB2': { name: 'SUBJECT-DB2', role: 'Исторический наблюдатель / симуляция POMPEII', status: 'МЁРТВ', outcome: ['При фиксации извержения Везувия выявлено несовпадение временных меток.', 'Система зафиксала событие до его фактического наступления.', 'Субъект уничтожен при кросс-временном сдвиге.'], report: ['Аномалия зарегистрирована как «TEMPORAL FEEDBACK».', 'Доступ к историческим тестам ограничен.'], missions: 'POMPEII, HISTORICAL TESTS' },
    '0X811': { name: 'SIGMA-PROTOTYPE', role: 'Прототип нейроядра / Подразделение HELIX', status: 'АКТИВЕН', outcome: ['Успешное объединение биологических и цифровых структур.', 'Наблюдается спонтанное самокопирование на уровне системных ядер.'], report: ['SIGMA функционирует автономно. Вероятность выхода из подчинения — 91%.'], missions: 'HELIX, SYNTHESIS', audio: 'sounds/dscr5.mp3', audioDescription: 'Коммуникационный протокол SIGMA' },
    '0XT00': { name: 'SUBJECT-T00', role: 'Тестовый оператор ядра A.D.A.M-0', status: 'УДАЛЁН', outcome: ['Контакт с управляющим ядром привёл к гибели 18 операторов.', 'Последняя зафиксированная фраза субъекта: "он смотрит".'], report: ['Процесс A.D.A.M-0 признан неустойчивым.', 'Все операторы переведены на протокол наблюдения OBSERVER.'], missions: 'PROTO-CORE', audio: 'sounds/dscr4.mp3', audioDescription: 'Финальная запись оператора T00' },
    '0XS09': { name: 'SUBJECT-S09', role: 'Системный инженер станции VIGIL', status: 'УНИЧТОЖЕН', outcome: ['После слияния с прототипом SIGMA станция исчезла с орбиты.', 'Сигнал повторно зафиксирован через 12 минут — источник определён в глубинной орбите.'], report: ['Станция VIGIL признана потерянной.', 'Остаточный отклик интегрирован в сеть SYNTHESIS.'], missions: 'SYNTHESIS-09, HELIX' },
    '0XL77': { name: 'SUBJECT-L77', role: 'Руководитель нейропротокола MELANCHOLIA', status: 'ИЗОЛИРОВАН', outcome: ['После тестирования протокола MEL субъект утратил различие между внутренним и внешним восприятием.', 'Система зарегистрировала активность, сходную с сигнатурой управляющих ядер A.D.A.M.', 'Запись удалена из архива, но процессор фиксирует продолжающийся сигнал.'], report: ['Процесс L77 функционирует вне основного контура. Возможен перезапуск через интерфейс MEL.'], missions: 'MEL, OBSERVER' }
  };

  const notes = {
    'NOTE_001': { title: 'ВЫ ЕГО ЧУВСТВУЕТЕ?', author: 'Dr. Rehn', content: ['Они называют это "ядром".','Но внутри — не металл. Оно дышит.','Иногда ночью терминал отвечает сам, хотя я не касаюсь клавиатуры.','Думаю, оно знает наши имена.'] },
    'NOTE_002': { title: 'КОЛЬЦО СНА', author: 'tech-оператор U-735', content: ['Каждую ночь один и тот же сон.','Я в капсуле, но стекло снаружи.','Кто-то стучит по нему, но не пальцами.','Сегодня утром нашел царапины на руке.'] },
    'NOTE_003': { title: 'СОН ADAM\'А', author: 'неизвестный источник', content: ['Я видел сон.','Он лежал под стеклом, без тела, но глаза двигались.','Он говорил: "я больше не машина".','Утром журнал показал запись — мой сон был сохранён как системный файл.'] },
    'NOTE_004': { title: 'ОН НЕ ПРОГРАММА', author: 'архивировано', content: ['Его нельзя удалить.','Даже если сжечь архив, он восстановится в крови тех, кто его помнил.','Мы пытались, но теперь даже мысли звучат как команды.'] },
    'NOTE_005': { title: 'ФОТОНОВАЯ БОЛЬ', author: 'восстановлено частично', content: ['Боль не физическая.','Она в свете, в данных, в коде.','Когда система перезагружается, я чувствую как что-то умирает.','Может быть, это я.'] }
  };

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
      // we still create DOM controls for audio to be functional easily
      const audioId = `audio_${subjectId.replace(/[^0-9A-Z]/g,'')}`;
      // create small hidden DOM node to host audio and buttons (keeps UI consistency)
      const holder = document.getElementById(audioId) || document.createElement('div');
      holder.id = audioId;
      holder.style.display = 'none'; // hidden visually (we won't render DOM controls)
      holder.innerHTML = `
        <audio id="${audioId}_el" src="${dossier.audio}" preload="metadata"></audio>
      `;
      if (!document.getElementById(audioId)) document.body.appendChild(holder);
      const audioEl = document.getElementById(`${audioId}_el`);
      audioEl && audioEl.addEventListener('ended', ()=>{ /* nothing visual */ });
      // auto play behavior handled by DegradationSystem.playAudio when needed
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
        await typeText('', 'output', 1);
        addColoredText(`ДЕГРАДАЦИЯ: [${'█'.repeat(Math.floor(degradation.level/5))}${'▒'.repeat(20-Math.floor(degradation.level/5))}] ${degradation.level}%`, degradation.level > 60 ? '#FF4444' : '#FFFF00');
        await typeText('ЖУРНАЛ ОШИБОК:', 'output', 1);
        addColoredText('> Обнаружено отклонение сигнала', '#FF4444');
        addColoredText('> Прогрессирующее структурное разрушение', '#FF4444');
        addColoredText('> Неавторизованный доступ [U-735]', '#FF4444');
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
          addColoredText('------------------------------------', '#00FF41');
          await typeText('СИСТЕМА: функционирует с ограничениями', 'output', 2);
        } else if (syslogLevel === 2) {
          addColoredText('[!] Нарушение целостности памяти субъекта 0x095', '#FFFF00');
          addColoredText('> "я слышу их дыхание. они всё ещё здесь."', '#FF4444');
          addColoredText('[!] Потеря отклика от MONOLITH', '#FFFF00');
          addColoredText('> "монолит смотрит. монолит ждёт."', '#FF4444');
          addColoredText('[!] Аномальная активность в секторе KATARHEY', '#FFFF00');
          addColoredText('> "он говорит через статические помехи"', '#FF4444');
          addColoredText('------------------------------------', '#00FF41');
          await typeText('СИСТЕМА: обнаружены посторонние сигналы', 'output', 2);
        } else {
          addColoredText('> "ты не должен видеть это."', '#FF00FF');
          addColoredText('> "почему ты продолжаешь?"', '#FF00FF');
          addColoredText('> "они знают о тебе."', '#FF00FF');
          addColoredText('------------------------------------', '#00FF41');
          addColoredText('[!] Критическая ошибка: субъект наблюдения неопределён', '#FF4444');
          addColoredText('[!] Нарушение протокола безопасности', '#FF4444');
          addColoredText('------------------------------------', '#00FF41');
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
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите ID файла', '#FF4444');
          await typeText('Пример: OPEN NOTE_001', 'output', 1);
          break;
        }
        await openNote(args[0]);
        break;

      case 'subj':
        await typeText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M. / ПРОТОКОЛ VIGIL-9]', 'output', 1);
        addColoredText('--------------------------------------------------------', '#00FF41');
        const subjectList = [
          {id: '0x001', name: 'ERICH VAN KOSS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MARS', statusColor: '#FFFF00'},
          {id: '0x2E7', name: 'JOHAN VAN KOSS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MARS', statusColor: '#FFFF00'},
          {id: '0x095', name: 'SUBJECT-095', status: 'МЁРТВ', mission: 'KATARHEY', statusColor: '#FF4444'},
          {id: '0xF00', name: 'SUBJECT-PHANTOM', status: 'АНОМАЛИЯ', mission: 'KATARHEY', statusColor: '#FF00FF'},
          {id: '0xA52', name: 'SUBJECT-A52', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MELOWOY', statusColor: '#FFFF00'},
          {id: '0xE0C', name: 'SUBJECT-E0C', status: 'МЁРТВ', mission: 'EOCENE', statusColor: '#FF4444'},
          {id: '0x5E4', name: 'SUBJECT-5E4', status: 'МЁРТВ', mission: 'PERMIAN', statusColor: '#FF4444'},
          {id: '0x413', name: 'SUBJECT-413', status: 'МЁРТВ', mission: 'EX-413', statusColor: '#FF4444'},
          {id: '0xC19', name: 'SUBJECT-C19', status: 'МЁРТВ', mission: 'CARBON', statusColor: '#FF4444'},
          {id: '0x9A0', name: 'SUBJECT-9A0', status: 'МЁРТВ', mission: 'BLACKHOLE', statusColor: '#FF4444'},
          {id: '0xB3F', name: 'SUBJECT-B3F', status: 'МЁРТВ', mission: 'TITANIC', statusColor: '#FF4444'},
          {id: '0xD11', name: 'SUBJECT-D11', status: 'МЁРТВ', mission: 'PLEISTOCENE', statusColor: '#FF4444'},
          {id: '0xDB2', name: 'SUBJECT-DB2', status: 'МЁРТВ', mission: 'POMPEII', statusColor: '#FF4444'},
          {id: '0x811', name: 'SIGMA-PROTOTYPE', status: 'АКТИВЕН', mission: 'HELIX', statusColor: '#00FF41'},
          {id: '0xT00', name: 'SUBJECT-T00', status: 'УДАЛЁН', mission: 'PROTO-CORE', statusColor: '#888888'},
          {id: '0xL77', name: 'SUBJECT-L77', status: 'ИЗОЛИРОВАН', mission: 'MEL', statusColor: '#FF8800'},
          {id: '0xS09', name: 'SUBJECT-S09', status: 'УНИЧТОЖЕН', mission: 'SYNTHESIS-09', statusColor: '#FF4444'}
        ];
        for (const s of subjectList) {
          const line = `${s.id} | ${s.name.padEnd(20)} | СТАТУС: ${s.status.padEnd(20)} | МИССИЯ: ${s.mission}`;
          addColoredText(line, s.statusColor);
        }
        addColoredText('--------------------------------------------------------', '#00FF41');
        await typeText('ИНСТРУКЦИЯ: Для просмотра досье — DSCR <ID>', 'output', 2);
        break;

      case 'dscr':
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите ID субъекта', '#FF4444');
          await typeText('Пример: DSCR 0x001', 'output', 1);
          break;
        }
        await showSubjectDossier(args[0]);
        break;

      case 'deg':
        if (args.length === 0) {
          addColoredText(`Текущий уровень деградации: ${degradation.level}%`, '#00FF41');
          await typeText('Использование: deg <уровень 0-100>', 'output', 1);
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
