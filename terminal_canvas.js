// terminal_canvas_final.js
// Полностью объединённый файл с командами сетки: netmode, net check, net status
// + деградация сетки. Остальной функционал не тронут.
(() => {
  // ---------- CONFIG ----------
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 13;
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.45);
  const PADDING = 18;
  const MAX_LINES = 10000;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const CANVAS_Z = 50;
  const TYPING_SPEED_DEFAULT = 14; // ms per char

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
    pointerEvents: 'none',
    userSelect: 'none'
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });

  // ---------- find original elements (keep interactive but visually hidden) ----------
  const origTerminal = document.getElementById('terminal');
  if (origTerminal) {
    origTerminal.style.opacity = '0';
    origTerminal.style.pointerEvents = 'auto';
    // keep DOM interactive but remove stray visual children to avoid duplication
    try {
      const mo = new MutationObserver(muts => {
        muts.forEach(m => {
          if (m.addedNodes) {
            m.addedNodes.forEach(n => {
              if (n && (n.nodeType === 1 || n.nodeType === 3)) {
                try { n.remove(); } catch(e){}
              }
            });
          }
        });
      });
      mo.observe(origTerminal, { childList: true, subtree: true });
    } catch(e){}
  }

  const glassFX = document.getElementById('glassFX');
  if (glassFX) {
    glassFX.style.opacity = '0';
    glassFX.style.pointerEvents = 'auto';
  }

  // find map canvas (netGrid) but avoid shader and overlay canvas
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

  // ---------- draw scheduling ----------
  // CRITICAL: pendingRedraw must exist before any resize()/requestFullRedraw() calls
  let pendingRedraw = false;
  function requestFullRedraw(){
    if (!pendingRedraw) {
      pendingRedraw = true;
      requestAnimationFrame(() => {
        pendingRedraw = false;
        try { draw(); } catch(e){ console.error('draw error', e); }
      });
    }
  }

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

  // ---------- terminal state ----------
  const lines = []; // {text, color, _ephemeral}
  let scrollOffset = 0; // 0 = bottom (latest)
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

  // ---------- Degradation system (robust version) ----------
  class DegradationSystem {
    constructor() {
      this.level = parseInt(localStorage.getItem('adam_degradation')) || 0;
      this.lastSoundLevel = 0;
      this.ghostActive = false;
      this.autoActive = false;
      this.effectsActive = false;

      // Keep a DOM indicator hidden (compat); we draw indicator into canvas as visual source of truth.
      this.indicator = document.createElement('div');
      this.indicator.style.cssText = `position:fixed; top:20px; right:20px; opacity:0; pointer-events:none; font-family:${FONT_FAMILY};`;
      document.body.appendChild(this.indicator);

      this.updateIndicator();
      this.startTimer();
      this.updateEffects();
    }

    startTimer(){
      // increment even if site idle; keep backgroundTick alive separately
      this._timer = setInterval(()=>{ if (!document.hidden && !isFrozen) this.addDegradation(1); }, 30000);
    }

    addDegradation(amount){
      const prev = this.level;
      this.level = Math.max(0, Math.min(100, this.level + amount));
      localStorage.setItem('adam_degradation', String(this.level));
      this.updateIndicator();
      this.updateEffects();

      // audio cues when thresholds crossed
      if (Math.floor(this.level / 5) > Math.floor(this.lastSoundLevel / 5)) {
        if (this.level >= 60 && this.level < 80) this.playAudio('sounds/reset_com.mp3');
        else if (this.level >= 80 && this.level < 95) this.playAudio('sounds/reset_com_reverse.mp3');
        this.lastSoundLevel = this.level;
      }

      if (this.level >= 98 && !isFrozen) {
        this.triggerGlitchApocalypse();
      }
    }

    updateIndicator(){
      // DOM indicator (hidden) for compatibility; canvas draws everything visible
      const color = this.level > 95 ? '#FF00FF' : this.level > 80 ? '#FF4444' : this.level > 60 ? '#FF8800' : this.level > 30 ? '#FFFF00' : '#00FF41';
      this.indicator.innerHTML = `
        <div style="color:${color};font-weight:700">ДЕГРАДАЦИЯ СИСТЕМЫ</div>
        <div style="background:#222;height:12px;margin:6px 0;border:2px solid ${color}">
          <div style="background:${color};height:100%;width:${this.level}%;transition:width 0.3s"></div>
        </div>
        <div style="color:${color};font-weight:700">${this.level}%</div>
      `;
      requestFullRedraw();
    }

    updateEffects(){
      // manage ghost typing and auto-commands
      if (this.level >= 80 && !this.ghostActive) {
        this.startGhostInput();
        this.ghostActive = true;
      } else if (this.level < 80 && this.ghostActive) {
        this.stopGhostInput();
        this.ghostActive = false;
      }

      if (this.level >= 80 && !this.autoActive) {
        this.startAutoCommands();
        this.autoActive = true;
      } else if (this.level < 80 && this.autoActive) {
        this.stopAutoCommands();
        this.autoActive = false;
      }

      // body classes kept for compatibility (if CSS relies on them)
      document.body.classList.remove('degradation-2','degradation-3','degradation-4','degradation-5','degradation-glitch');
      if (this.level >= 30 && this.level < 60) document.body.classList.add('degradation-2');
      else if (this.level >= 60 && this.level < 80) document.body.classList.add('degradation-3');
      else if (this.level >= 80 && this.level < 95) document.body.classList.add('degradation-4');
      else if (this.level >= 95 && this.level < 98) document.body.classList.add('degradation-5');
      else if (this.level >= 98) document.body.classList.add('degradation-glitch');

      requestFullRedraw();
    }

    // more robust audio: try list of possible filenames (case-insensitive fallback)
    playAudio(file){
      try {
        if (currentAudio){ try { currentAudio.pause(); currentAudio.currentTime = 0; } catch(e){} }
        const audioFiles = [file];
        // also fallback lower/upper if exists logic desired
        const tryPlayAudio = (index) => {
          if (index >= audioFiles.length) return;
          try {
            currentAudio = new Audio(audioFiles[index]);
            currentAudio.play().catch(()=>{ tryPlayAudio(index+1); });
          } catch(e){ tryPlayAudio(index+1); }
        };
        tryPlayAudio(0);
      } catch(e){}
    }

    triggerGlitchApocalypse(){
      // freeze input, play glitch sound, flash effects and reset after timeout
      isFrozen = true;
      this.playAudio('sounds/glitch_e.MP3');
      this.applyGlitchEffects();
      setTimeout(()=> this.performAutoReset(), 3000);
    }

    applyGlitchEffects(){
      // apply temporary body filter (kept minimal) but avoid permanent changes
      try {
        document.body.style.transition = 'filter 120ms';
        document.body.style.filter = 'contrast(1.2) saturate(0.8)';
        setTimeout(()=>{ document.body.style.filter = ''; }, 1200);
      } catch(e){}
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
      localStorage.setItem('adam_degradation','0');
      if (currentAudio){ try { currentAudio.pause(); currentAudio.currentTime = 0; } catch(e){} }
      isFrozen = false;
      this.stopGhostInput();
      this.stopAutoCommands();
      this.ghostActive = false;
      this.autoActive = false;
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

  function drawMapAndGlass(){
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);

    // shader-canvas (background) - behind everything
    const shaderCanvas = document.getElementById('shader-canvas');
    if (shaderCanvas && shaderCanvas.width > 0) {
      try { ctx.drawImage(shaderCanvas, 0, 0, vw, vh); } catch(e){ /* ignore */ }
    }

    // netGrid map - draw before glass so visible under glass
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

    // glassFX - subtle noise under text (prevent blinding white)
    if (glassFX && glassFX.width > 0 && glassFX.height > 0) {
      try {
        ctx.globalAlpha = 0.12;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(glassFX, 0, 0, vw, vh);
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
      } catch(e){}
    }

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
    const maxScroll = Math.max(0, lines.length - visibleLines);
    const start = Math.max(0, lines.length - visibleLines - scrollOffset);
    const end = Math.min(lines.length, start + visibleLines);

    let y = PADDING;
    const maxW = vw - PADDING*2;

    for (let i = start; i < end; i++){
      const item = lines[i];
      let color = item.color || '#00FF41';
      ctx.fillStyle = color;
      const text = String(item.text);

      // wrap by words
      if (ctx.measureText(text).width <= maxW) {
        ctx.fillText(text, PADDING, y);
        y += LINE_HEIGHT;
        continue;
      }
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

  function drawDegradationIndicator(){
    // draw indicator box to top-right inside canvas and clamp to viewport
    const wBox = Math.min(360, Math.floor(vw * 0.34));
    const hBox = 62;
    const x = Math.max(10, vw - wBox - 20);
    const y = 20;

    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);

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
    let label = 'ДЕГРАДАЦИЯ СИСТЕМЫ';
    ctx.fillText(label, x + 10, y + 18);
    ctx.fillText(degradation.level + '%', x + wBox - 46, y + 18);

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
    // clear base
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,vw,vh);
    ctx.restore();

    // compose
    drawMapAndGlass();
    drawTextLines();
    drawDegradationIndicator();

    // optional freeze/glitch overlay
    if (isFrozen) {
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#FFF';
      for (let i = 0; i < 6; i++) {
        const rx = Math.random() * vw;
        const ry = Math.random() * vh;
        const rw = Math.random() * 120;
        const rh = Math.random() * 40;
        ctx.fillRect(rx, ry, rw, rh);
      }
      ctx.restore();
    }
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

  async function typeText(text, className = 'output', speed = TYPING_SPEED_DEFAULT) {
    if (isFrozen) return;
    isTyping = true;
    let buffer = '';
    const color = className === 'command' ? '#FFFFFF' : '#00FF41';
    for (let i = 0; i < text.length; i++) {
      buffer += text[i];
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
    if (lines.length && String(lines[lines.length - 1].text).startsWith('adam@secure:~$')) return;
    pushLine('adam@secure:~$ ', '#00FF41');
    scrollOffset = 0;
    requestFullRedraw();
  }

  function updatePromptLine(){
    if (lines.length && String(lines[lines.length - 1].text).startsWith('adam@secure:~$')) {
      lines[lines.length - 1].text = 'adam@secure:~$ ' + currentLine;
    } else {
      pushLine('adam@secure:~$ ' + currentLine, '#00FF41');
    }
    requestFullRedraw();
  }

  // ---------- dossiers & notes (ПОЛНОЕ СОДЕРЖИМОЕ БЕЗ ИЗМЕНЕНИЙ ----------
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

  // ---------- helper: show dossier / notes ----------
  async function showSubjectDossier(subjectId) {
    const id = String(subjectId || '').toUpperCase();
    const dossier = dossiers[id];
    if (!dossier) {
      addColoredText(`ОШИБКА: Досье для ${subjectId} не найдено`, '#FF4444');
      return;
    }
    await typeText(`[ДОСЬЕ — ID: ${id}]`, 'output', 12);
    await typeText(`ИМЯ: ${dossier.name}`, 'output', 12);
    await typeText(`РОЛЬ: ${dossier.role}`, 'output', 12);
    addColoredText(`СТАТУС: ${dossier.status}`, dossier.status === 'АНОМАЛИЯ' ? '#FF00FF' : dossier.status === 'АКТИВЕН' ? '#00FF41' : dossier.status.includes('СВЯЗЬ') ? '#FFFF00' : '#FF4444');
    addColoredText('------------------------------------', '#00FF41');
    await typeText('ИСХОД:', 'output', 12);
    dossier.outcome.forEach(line => addColoredText(`> ${line}`, '#FF4444'));
    addColoredText('------------------------------------', '#00FF41');
    await typeText('СИСТЕМНЫЙ ОТЧЁТ:', 'output', 12);
    dossier.report.forEach(line => addColoredText(`> ${line}`, '#FFFF00'));
    addColoredText('------------------------------------', '#00FF41');
    await typeText(`СВЯЗАННЫЕ МИССИИ: ${dossier.missions}`, 'output', 12);
    if (dossier.audio) {
      addColoredText(`[АУДИОЗАПИСЬ ДОСТУПНА: ${dossier.audioDescription}]`, '#FFFF00');
      const audioId = `audio_${id.replace(/[^0-9A-Z]/g,'')}`;
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
    const id = String(noteId || '').toUpperCase();
    const note = notes[id];
    if (!note) {
      addColoredText(`ОШИБКА: Файл ${noteId} не найден`, '#FF4444');
      return;
    }
    await typeText(`[${id} — "${note.title}"]`, 'output', 12);
    await typeText(`АВТОР: ${note.author}`, 'output', 12);
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
    await typeText('[ФАЙЛ ЗАКРЫТ]', 'output', 12);
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

  // ---------- fake spawn ----------
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
    if (isTyping || isFrozen) return;
    const cmdLine = String(rawCmd || '').trim();
    if (!cmdLine) { addInputLine(); return; }

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

    // If prompt exists, replace with echoed white command to avoid duplicate prompt + command
    if (lines.length && String(lines[lines.length - 1].text).startsWith('adam@secure:~$')) {
      lines[lines.length - 1].text = 'adam@secure:~$ ' + cmdLine;
      lines[lines.length - 1].color = '#FFFFFF';
      delete lines[lines.length - 1]._ephemeral;
      requestFullRedraw();
    } else {
      addOutput(`adam@secure:~$ ${cmdLine}`, 'command');
    }

    const parts = cmdLine.toLowerCase().split(' ').filter(Boolean);
    const command = parts[0];
    const args = parts.slice(1);

    const commandWeights = { 'syst':1, 'syslog':1, 'net':1, 'dscr':2, 'subj':2, 'notes':1.5, 'deg':0 };
    if (commandWeights[command]) degradation.addDegradation(commandWeights[command]);

    switch(command){
      case 'help':
        await typeText('Доступные команды:', 'output', 12);
        await typeText('  SYST         — проверить состояние системы', 'output', 10);
        await typeText('  SYSLOG       — системный журнал активности', 'output', 10);
        await typeText('  NET          — карта активных узлов проекта', 'output', 10);
        await typeText('  TRACE <id>   — отследить указанный модуль', 'output', 10);
        await typeText('  DECRYPT <f>  — расшифровать файл', 'output', 10);
        await typeText('  SUBJ         — список субъектов', 'output', 10);
        await typeText('  DSCR <id>    — досье на персонал', 'output', 10);
        await typeText('  NOTES        — личные файлы сотрудников', 'output', 10);
        await typeText('  OPEN <id>    — открыть файл из NOTES', 'output', 10);
        await typeText('  RESET        — сброс интерфейса', 'output', 10);
        await typeText('  EXIT         — завершить сессию', 'output', 10);
        await typeText('  CLEAR        — очистить терминал', 'output', 10);
        await typeText('  DEG          — установить уровень деградации (разработка)', 'output', 10);
        await typeText('------------------------------------', 'output', 10);
        await typeText('ПРИМЕЧАНИЕ: часть команд заблокирована или скрыта.', 'output', 18);
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
        // Добавляем деградацию сетки если она активна
        if (window.__netGrid) {
          const gridDeg = window.__netGrid.getDegradation();
          if (gridDeg > 0) {
            addColoredText(`СЕТЕВАЯ ДЕГРАДАЦИЯ: ${gridDeg.toFixed(1)}%`, gridDeg > 30 ? '#FF8800' : '#FFFF00');
          }
        }
        await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', 'output', 18);
        break;

      case 'syslog':
        {
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
        for (const k of Object.keys(dossiers)) {
          const d = dossiers[k];
          const color = d.status && d.status.includes('МЁРТВ') ? '#FF4444' : d.status === 'АНОМАЛИЯ' ? '#FF00FF' : d.status === 'АКТИВЕН' ? '#00FF41' : '#FFFF00';
          const line = `${k.toLowerCase()} | ${d.name.padEnd(20)} | СТАТУС: ${d.status.padEnd(20)} | МИССИЯ: ${d.missions || ''}`;
          addColoredText(line, color);
        }
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

      // ════════════════════════════════════════════════════════════════════
      // КОМАНДЫ СЕТКИ (НОВЫЕ)
      // ════════════════════════════════════════════════════════════════════
      case 'netmode':
        if (!window.__netGrid) {
          addColoredText('ОШИБКА: Система управления узлами недоступна', '#FF4444');
          break;
        }
        window.__netGrid.setGridMode(true);
        await typeText('> Переход в режим управления сеткой...', 'output', 12);
        await typeText('> Управление: [WASD/↑↓←→] Перемещение | [Tab] Выбор узла | [Space] Закрепить/Открепить | [ESC] Выход', 'output', 12);
        break;

      case 'net':
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите подкоманду', '#FF4444');
          await typeText('Доступные подкоманды: check, status', 'output', 12);
          break;
        }
        const sub = args[0];
        switch(sub) {
          case 'check':
            if (!window.__netGrid) {
              addColoredText('ОШИБКА: Система узлов недоступна', '#FF4444');
              break;
            }
            await showLoading(800, "Сканирование конфигурации узлов");
            const result = window.__netGrid.checkSolution();
            if (result.solved) {
              addColoredText('>>> КОРЕКТНЫЙ КЛЕЙМО АКТИВИРОВАН <<<', '#00FF41');
              addColoredText('> Доступ к сектору OBSERVER-7 открыт', '#FFFF00');
              degradation.playAudio('sounds/success.mp3');
            } else {
              addColoredText('> Конфигурация не соответствует протоколу', '#FF4444');
              addColoredText(`> Всего узлов: ${result.total} | Правильных позиций: ${result.correct} | Неправильных: ${result.lockedCount - result.correct}`, '#FFFF00');
              degradation.playAudio('sounds/reject.mp3');
              window.__netGrid.addDegradation(2);
            }
            break;
          case 'status':
            if (!window.__netGrid) {
              addColoredText('ОШИБКА: Система узлов недоступна', '#FF4444');
              break;
            }
            const gridDegradation = window.__netGrid.getDegradation().toFixed(1);
            await typeText('[СТАТУС СЕТКИ УЗЛОВ]', 'output', 12);
            addColoredText('------------------------------------', '#00FF41');
            window.__netGrid.status(); // Это вызовет вывод в статус-баре
            await typeText(`Уровень деградации сетки: ${gridDegradation}%`, gridDegradation > 30 ? '#FF4444' : '#FFFF00');
            break;
          default:
            addColoredText(`ОШИБКА: Неизвестная подкоманда ${sub}`, '#FF4444');
        }
        break;
      // ════════════════════════════════════════════════════════════════════
      // КОНЕЦ КОМАНД СЕТКИ
      // ════════════════════════════════════════════════════════════════════

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

        {
          const resetConfirmed = await waitForConfirmation();
          if (resetConfirmed) {
            addColoredText('> Y', '#00FF41');
            lines.length = 0;
            const resetMessages = ["Завершение активных модулей [ЗАВЕРШЕНО]","Перезапуск интерфейса [ЗАВЕРШЕНО]","Восстановление базового состояния [ЗАВЕРШЕНО]","----------------------------------","[СИСТЕМА ГОТОВА К РАБОТЕ]"];
            for (const m of resetMessages) { addOutput(m); await new Promise(r=>setTimeout(r,700)); }
            degradation.reset();
            if (window.__netGrid) {
              // Сбрасываем и сетку
              window.__netGrid.addDegradation(-100);
              window.__netGrid.setGridMode(false);
            }
            commandCount = 0;
            sessionStartTime = Date.now();
          } else {
            addColoredText('> N', '#FF4444');
            addColoredText('------------------------------------', '#00FF41');
            await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 12);
          }
        }
        break;

      case 'exit':
        await typeText('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ? (Y/N)]', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        {
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
        processCommand(c);
      } else {
        addInputLine();
      }
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
      return;
    }
    updatePromptLine();
  });

  // ---------- wheel scroll for viewing history ----------
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const contentH = vh - PADDING*2;
    const visibleLines = Math.max(1, Math.floor(contentH / LINE_HEIGHT));
    const maxScroll = Math.max(0, lines.length - visibleLines);
    if (e.deltaY < 0) {
      scrollOffset = Math.min(maxScroll, scrollOffset + 1);
    } else {
      scrollOffset = Math.max(0, scrollOffset - 1);
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
    await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 12);
    await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', 'output', 12);
    await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 12);
    addInputLine();
  })();

  // ---------- background animation tick ----------
  let lastTick = performance.now();
  function backgroundTick(ts) {
    const dt = ts - lastTick;
    lastTick = ts;
    if (!backgroundTick._acc) backgroundTick._acc = 0;
    backgroundTick._acc += dt;
    if (backgroundTick._acc >= (1000 / 30)) {
      backgroundTick._acc = 0;
      // keep degradation timer and other visuals alive even when user idle
      requestFullRedraw();
    }
    requestAnimationFrame(backgroundTick);
  }
  requestAnimationFrame(backgroundTick);

  // expose debug API
  window.__TerminalCanvas = {
    addOutput, addColoredText, typeText, processCommand, degradation, lines
  };

  // initial draw
  requestFullRedraw();
})();
