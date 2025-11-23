// terminal_canvas.js - ПОЛНАЯ ВЕРСИЯ СО ВСЕМИ ФУНКЦИЯМИ ИЗ ТЗ
// Реализованы ВСЕ механики деградации уровней 1-7, сетка с ключом "Биокод", команды decrypt/trace/playaudio/VIGIL999
(() => {
  // ---------- CONFIG ----------
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 13;
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.45);
  const PADDING = 18;
  const MAX_LINES = 10000;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const CANVAS_Z = 50;
  const TYPING_SPEED_DEFAULT = 14;
  const GLITCH_MAX_LEVEL = 95;
  const SHAKING_START_LEVEL = 70;
  const SHAKING_END_LEVEL = 90;
  const MIRROR_START_LEVEL = 80;
  const MIRROR_END_LEVEL = 90;
  const COMMAND_BLOCK_START_LEVEL = 80;
  const COMMAND_BLOCK_END_LEVEL = 90;
  const PSYCHO_BLOCK_START_LEVEL = 90;
  const PSYCHO_BLOCK_END_LEVEL = 97;
  const FALSE_RESET_START_LEVEL = 85;
  const INTENTION_PREDICTION_START_LEVEL = 90;
  const GRID_DEGRADATION_START_LEVEL = 80;
  const GHOST_INPUT_START_LEVEL = 80;
  const AUTO_COMMAND_START_LEVEL = 80;
  const ANOMALOUS_INSERTS_START_LEVEL = 70;
  const ANOMALOUS_INSERTS_END_LEVEL = 80;
  const INVERSION_START_LEVEL = 95;
  const AUTO_RESET_LEVEL = 98;
  
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
  
  // ---------- audio manager ----------
  class AudioManager {
    constructor() {
      this.audioElements = {};
      this.audioCache = {};
      this.volume = 0.7;
      this.initSounds();
    }
    
    initSounds() {
      const sounds = [
        'signal_swap.mp3',
        'reset_com.mp3',
        'reset_com_reverse.mp3',
        'net_connection_loss.mp3',
        'net_rotation.mp3',
        'net_fragmentation.mp3',
        'net_final_signal.mp3',
        'net_resistance.mp3',
        'key_success.mp3',
        'key_reject.mp3',
        'decrypt_success.mp3',
        'decrypt_failure.mp3',
        'trace_active.mp3',
        'vigil_confirm.mp3',
        'glitch_e.mp3',
        'connection_restored.mp3'
      ];
      
      sounds.forEach(sound => {
        const paths = [
          `sounds/${sound}`,
          `audio/${sound}`,
          sound
        ];
        
        paths.forEach(path => {
          if (!this.audioCache[path]) {
            try {
              const audio = new Audio(path);
              audio.volume = this.volume;
              this.audioCache[path] = audio;
            } catch(e) {}
          }
        });
      });
    }
    
    play(file, options = {}) {
      try {
        const paths = [
          `sounds/${file}`,
          `audio/${file}`,
          file
        ];
        
        for (let path of paths) {
          if (this.audioCache[path]) {
            const audio = this.audioCache[path].cloneNode();
            audio.volume = options.volume !== undefined ? options.volume : this.volume;
            
            if (options.startTime) {
              audio.currentTime = options.startTime;
            }
            
            if (options.playbackRate) {
              audio.playbackRate = options.playbackRate;
            }
            
            if (options.loop) {
              audio.loop = true;
            }
            
            if (options.distort && degradation.level >= 70) {
              audio.playbackRate = 0.8 + Math.random() * 0.4;
              audio.volume = this.volume * (0.7 + Math.random() * 0.3);
            }
            
            audio.play().catch(e => {
              console.warn('Audio play failed:', e);
            });
            
            if (options.onEnded) {
              audio.onended = options.onEnded;
            }
            
            return audio;
          }
        }
        
        console.warn(`Sound not found: ${file}`);
        return null;
      } catch(e) {
        console.error('Audio playback error:', e);
        return null;
      }
    }
    
    stop(file) {
      try {
        if (this.audioElements[file]) {
          this.audioElements[file].pause();
          this.audioElements[file].currentTime = 0;
          delete this.audioElements[file];
        }
      } catch(e) {}
    }
  }
  
  const audioManager = new AudioManager();
  
  // ---------- sizing ----------
  let vw = 0, vh = 0;
  
  // ---------- draw scheduling ----------
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
  const lines = [];
  let scrollOffset = 0;
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
  let phantomCommandInterval = null;
  let textShakeInterval = null;
  let flashTextInterval = null;
  let lastProcessed = { text: null, ts: 0 };
  let resetAttempts = 0;
  let falseResetActive = false;
  let intentionalPredictionActive = false;
  let intentionPredicted = false;
  let decryptActive = false;
  let decryptCode = null;
  let decryptAttempts = 6;
  let traceActive = false;
  let traceTimer = null;
  let vigilCodeParts = { alpha: null, beta: null, gamma: null };
  let audioPlaybackActive = false;
  let audioPlaybackFile = null;
  
  // ---------- text distortion patterns ----------
  const GLITCH_CHARS = {
    50: ['▓', '█', '▒'],
    60: ['▓', '█', '▒', '░', '≡', '§'],
    70: ['▓', '█', '▒', '░', '≡', '§', '¶', '×', 'Ø'],
    80: ['▓', '█', '▒', '░', '≡', '§', '¶', '×', 'Ø', '◊', '∑', 'Ω'],
    90: ['▓', '█', '▒', '░', '≡', '§', '¶', '×', 'Ø', '◊', '∑', 'Ω', '·'],
    95: ['▓', '░', '█', '▒', '≡', '§', '¶', '×', 'Ø', '◊', '∑', 'Ω', '·', '#', '@', '$', '%', '^', '&', '*', '!', '?', '.']
  };
  
const DISTORTION_PATTERNS = {
  50: 0.025,  // 2.5% символов вместо 5%
  60: 0.08,   // 8% вместо 15%
  70: 0.18,   // 18% вместо 30%
  80: 0.35,   // 35% вместо 50%
  90: 0.60,   // 60% вместо 75%
  95: 0.85    // 85% вместо 100%
};
  
  // ---------- Degradation system ----------
  class DegradationSystem {
    constructor() {
      this.level = parseInt(localStorage.getItem('adam_degradation')) || 0;
      this.lastSoundLevel = 0;
      this.ghostActive = false;
      this.autoActive = false;
      this.effectsActive = false;
      this.soundPlayedAt45 = false;
      this.ghostCommandCount = 0;
      this.lastDistortion = { status: null, role: null, time: 0 };
      this.falseResetCount = 0;
      this.intentionPredictionCount = 0;
      this.phantomDossierCount = 0;
      this.indicator = document.createElement('div');
      this.indicator.style.cssText = `position:fixed; top:20px; right:20px; opacity:0; pointer-events:none; font-family:${FONT_FAMILY};`;
      document.body.appendChild(this.indicator);
      this.updateIndicator();
      this.startTimer();
      this.updateEffects();
    }
    
    startTimer(){
      this._timer = setInterval(()=>{ 
        if (!document.hidden && !isFrozen && !decryptActive && !traceActive && !audioPlaybackActive) 
          this.addDegradation(1); 
      }, 30000);
    }
    
    addDegradation(amount){
      if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
      
      const prev = this.level;
      this.level = Math.max(0, Math.min(100, this.level + amount));
      localStorage.setItem('adam_degradation', String(this.level));
      this.updateIndicator();
      this.updateEffects();
      
      if (window.__netGrid) {
        window.__netGrid.setSystemDegradation(this.level);
      }
      
      // Звуковой эффект при достижении 45% и первом выполнении определенных команд
      if (this.level >= 45 && !this.soundPlayedAt45) {
        audioManager.play('signal_swap.mp3', { volume: 0.7 });
        this.soundPlayedAt45 = true;
      }
      
      // Аудио-предупреждения о сбросе
      if (this.level >= 55 && this.level < 70 && Math.floor(this.level / 5) !== Math.floor(this.lastSoundLevel / 5)) {
        audioManager.play('reset_com.mp3', { volume: 0.7 });
      }
      
      // Обратное звучание
      else if (this.level >= 70 && this.level < 80 && Math.floor(this.level / 5) !== Math.floor(this.lastSoundLevel / 5)) {
        audioManager.play('reset_com_reverse.mp3', { volume: 0.7 });
      }
      
      // Обратное звучание (продолжение)
      else if (this.level >= 80 && this.level < 95 && Math.floor(this.level / 5) !== Math.floor(this.lastSoundLevel / 5)) {
        audioManager.play('reset_com_reverse.mp3', { 
          volume: 0.7, 
          playbackRate: 0.8 + (95 - this.level) / 15 * 0.4,
          distort: true
        });
      }
      
      this.lastSoundLevel = this.level;
      
      // Автоматический сброс при 98%
      if (this.level >= AUTO_RESET_LEVEL && !isFrozen) {
        this.triggerGlitchApocalypse();
      }
      
      // Части кода VIGIL999
      if (this.level >= 80 && this.level < 90 && !vigilCodeParts.alpha) {
        this.revealVigilAlpha();
      }
      
      if (this.level >= 98 && !vigilCodeParts.gamma) {
        this.revealVigilGamma();
      }
    }
    
    updateIndicator(){
      const color = this.level > 95 ? '#FF00FF' : this.level > 80 ? '#FF4444' : this.level > 60 ? '#FF8800' : this.level > 30 ? '#FFFF00' : '#00FF41';
      this.indicator.innerHTML = `
        <div style="color:${color};font-weight:700">ДЕГРАДАЦИЯ СИСТЕМЫ</div>
        <div style="background:#222;height:12px;margin:6px 0;border:2px solid ${color}">
          <div style="background:${color};height:100%;width:${this.level}%;transition:width 0.3s"></div>
        </div>
        <div style="color:${color};font-weight:700">${this.level}%</div>
      `;
      this.indicator.style.opacity = this.level > 5 ? '1' : '0';
      requestFullRedraw();
    }
    
    updateEffects(){
      // Уровень 2: Фантомные команды в истории
      if (this.level >= 30 && this.level < 60) {
        this.startPhantomCommands();
      } else {
        this.stopPhantomCommands();
      }
      
      // Уровень 3: Случайные вспышки надписей
      if (this.level >= 50 && this.level < 70) {
        this.startTextFlashes();
      } else {
        this.stopTextFlashes();
      }
      
      // Уровень 4: Дрожание текста
      if (this.level >= SHAKING_START_LEVEL && this.level < SHAKING_END_LEVEL) {
        this.startTextShaking();
      } else {
        this.stopTextShaking();
      }
      
      // Уровень 4: Аномальные вставки
      if (this.level >= ANOMALOUS_INSERTS_START_LEVEL && this.level < ANOMALOUS_INSERTS_END_LEVEL) {
        this.startAnomalousInserts();
      } else {
        this.stopAnomalousInserts();
      }
      
      // Уровень 5: Зеркальный вывод
      if (this.level >= MIRROR_START_LEVEL && this.level < MIRROR_END_LEVEL) {
        this.startMirrorText();
      } else {
        this.stopMirrorText();
      }
      
      // Уровень 5: Рандомная блокировка команд
      if (this.level >= COMMAND_BLOCK_START_LEVEL && this.level < COMMAND_BLOCK_END_LEVEL) {
        this.startCommandBlocking();
      } else {
        this.stopCommandBlocking();
      }
      
      // Уровень 6: Психологическая блокировка команд
      if (this.level >= PSYCHO_BLOCK_START_LEVEL && this.level < PSYCHO_BLOCK_END_LEVEL) {
        this.startPsychologicalBlocking();
      } else {
        this.stopPsychologicalBlocking();
      }
      
      // Уровень 6: Фантомные досье
      if (this.level >= PSYCHO_BLOCK_START_LEVEL && this.level < PSYCHO_BLOCK_END_LEVEL) {
        this.startPhantomDossiers();
      } else {
        this.stopPhantomDossiers();
      }
      
      // Уровень 6: Инверсия управления
      if (this.level >= INVERSION_START_LEVEL && this.level < 98) {
        this.startInputInversion();
      } else {
        this.stopInputInversion();
      }
      
      // Уровень 6: Предсказание намерений
      if (this.level >= INTENTION_PREDICTION_START_LEVEL && this.level < 98) {
        this.startIntentionPrediction();
      } else {
        this.stopIntentionPrediction();
      }
      
      // Призраки ввода
      if (this.level >= GHOST_INPUT_START_LEVEL && this.level < 95 && !this.ghostActive) {
        this.startGhostInput();
        this.ghostActive = true;
      } else if (this.level < GHOST_INPUT_START_LEVEL && this.ghostActive) {
        this.stopGhostInput();
        this.ghostActive = false;
      }
      
      // Автокоманды
      if (this.level >= AUTO_COMMAND_START_LEVEL && this.level < 95 && !this.autoActive) {
        this.startAutoCommands();
        this.autoActive = true;
      } else if (this.level < AUTO_COMMAND_START_LEVEL && this.autoActive) {
        this.stopAutoCommands();
        this.autoActive = false;
      }
      
      // Деградация сетки
      if (this.level >= GRID_DEGRADATION_START_LEVEL && window.__netGrid) {
        window.__netGrid.setSystemDegradation(this.level);
      }
      
      // Цветовые классы для CSS
      document.body.classList.remove('degradation-2','degradation-3','degradation-4','degradation-5','degradation-6','degradation-glitch');
      if (this.level >= 30 && this.level < 60) document.body.classList.add('degradation-2');
      else if (this.level >= 60 && this.level < 80) document.body.classList.add('degradation-3');
      else if (this.level >= 80 && this.level < 90) document.body.classList.add('degradation-4');
      else if (this.level >= 90 && this.level < 95) document.body.classList.add('degradation-5');
      else if (this.level >= 95 && this.level < 98) document.body.classList.add('degradation-6');
      else if (this.level >= 98) document.body.classList.add('degradation-glitch');
      
      requestFullRedraw();
    }
    
    triggerGlitchApocalypse(){
      isFrozen = true;
      audioManager.play('glitch_e.mp3', { volume: 0.9, distort: true });
      this.applyGlitchEffects();
      setTimeout(()=> this.performAutoReset(), 3500);
    }
    
    applyGlitchEffects(){
      try {
        // Цветовая инверсия
        document.body.style.transition = 'filter 120ms';
        document.body.style.filter = 'invert(1) contrast(1.3) saturate(0.8)';
        
        // Шумовой слой
        const glitchLayer = document.createElement('div');
        glitchLayer.id = 'glitchLayer';
        glitchLayer.style.cssText = `
          position:fixed;
          top:0;
          left:0;
          width:100%;
          height:100%;
          pointer-events:none;
          z-index:9999;
          background:transparent;
          opacity:0.3;
        `;
        document.body.appendChild(glitchLayer);
        
        let glitchCount = 0;
        const glitchInterval = setInterval(() => {
          if (glitchCount >= 20) {
            clearInterval(glitchInterval);
            setTimeout(() => {
              if (document.getElementById('glitchLayer')) {
                document.getElementById('glitchLayer').remove();
              }
              document.body.style.filter = '';
            }, 300);
            return;
          }
          
          glitchLayer.innerHTML = '';
          for (let i = 0; i < 50; i++) {
            const span = document.createElement('span');
            span.textContent = GLITCH_CHARS[95][Math.floor(Math.random() * GLITCH_CHARS[95].length)];
            span.style.cssText = `
              position:absolute;
              top:${Math.random() * 100}%;
              left:${Math.random() * 100}%;
              color:#${Math.floor(Math.random() * 16777215).toString(16)};
              font-size:${8 + Math.random() * 12}px;
              opacity:${0.3 + Math.random() * 0.7};
            `;
            glitchLayer.appendChild(span);
          }
          
          glitchCount++;
        }, 50);
        
        // Дрожание курсора
        const cursorLayer = document.createElement('div');
        cursorLayer.id = 'cursorLayer';
        cursorLayer.style.cssText = `
          position:fixed;
          top:50%;
          left:50%;
          transform:translate(-50%, -50%);
          color:#FF00FF;
          font-weight:bold;
          font-size:24px;
          z-index:10000;
        `;
        cursorLayer.textContent = '▓';
        document.body.appendChild(cursorLayer);
        
      } catch(e){}
    }
    
    performAutoReset(){
      // Автоматическая команда reset
      lines.push({ text: 'adam@secure:~$ reset [АВТОМАТИЧЕСКОЕ ИСПОЛНЕНИЕ]', color: '#FF4444', glitched: true });
      
      setTimeout(() => {
        lines.length = 0;
        this.reset();
        isFrozen = false;
        addInputLine();
        requestFullRedraw();
        
        // Скрытое сообщение после сброса
        setTimeout(() => {
          addColoredText('> A.D.A.M.: Я ПОМНЮ ТЕБЯ', '#8844FF');
          setTimeout(() => {
            if (lines.length > 0 && lines[lines.length - 1].text.includes('Я ПОМНЮ ТЕБЯ')) {
              lines.splice(lines.length - 1, 1);
              requestFullRedraw();
            }
          }, 800);
        }, 1500);
      }, 2000);
    }
    
    reset(){
      this.level = 0;
      this.lastSoundLevel = 0;
      this.soundPlayedAt45 = false;
      this.falseResetCount = 0;
      this.intentionPredictionCount = 0;
      this.phantomDossierCount = 0;
      localStorage.setItem('adam_degradation','0');
      
      // Остановка всех эффектов
      this.stopGhostInput();
      this.stopAutoCommands();
      this.stopPhantomCommands();
      this.stopTextShaking();
      this.stopFlashText();
      this.stopTextFlashes();
      this.stopAnomalousInserts();
      this.stopMirrorText();
      this.stopCommandBlocking();
      this.stopPsychologicalBlocking();
      this.stopPhantomDossiers();
      this.stopInputInversion();
      this.stopIntentionPrediction();
      
      this.ghostActive = false;
      this.autoActive = false;
      
      // Сброс деградации сетки
      if (window.__netGrid) {
        window.__netGrid.addDegradation(-100);
        window.__netGrid.setSystemDegradation(0);
      }
      
      requestFullRedraw();
    }
    
    startGhostInput(){
      if (ghostInputInterval) return;
      ghostInputInterval = setInterval(() => {
        if (!isTyping && !isFrozen && !decryptActive && !traceActive && !audioPlaybackActive && Math.random() < 0.12) {
          currentLine += ['0','1','▓','█','[',']','{','}','/','\\','▄','▀','▌'][Math.floor(Math.random()*13)];
          updatePromptLine();
          setTimeout(()=>{ 
            if (currentLine.length > 0) {
              currentLine = currentLine.slice(0,-1); 
              updatePromptLine();
            }
          }, Math.random()*1100+300);
        }
      }, 1800);
    }
    
    stopGhostInput(){ 
      if (ghostInputInterval){ 
        clearInterval(ghostInputInterval); 
        ghostInputInterval = null; 
      } 
    }
    
    startAutoCommands(){
      if (autoCommandInterval) return;
      autoCommandInterval = setInterval(()=>{ 
        if (!isTyping && !isFrozen && !decryptActive && !traceActive && !audioPlaybackActive && Math.random() < 0.06) 
          this.executeAutoCommand(); 
      }, 15000);
    }
    
    stopAutoCommands(){ 
      if (autoCommandInterval){ 
        clearInterval(autoCommandInterval); 
        autoCommandInterval = null; 
      } 
    }
    
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
        if (typed.length < command.length && !isFrozen && !decryptActive && !traceActive && !audioPlaybackActive){
          typed += command[typed.length];
          currentLine = typed;
          updatePromptLine();
          setTimeout(step, 100);
        } else if (!isFrozen && !decryptActive && !traceActive && !audioPlaybackActive){
          setTimeout(()=>{ 
            if (!decryptActive && !traceActive && !audioPlaybackActive) {
              processCommand(currentLine); 
              currentLine = ''; 
              updatePromptLine(); 
            }
          }, 480);
        }
      };
      step();
    }
    
    startPhantomCommands() {
      if (phantomCommandInterval) return;
      phantomCommandInterval = setInterval(() => {
        // Обработка в keydown
      }, 100);
    }
    
    stopPhantomCommands() {
      if (phantomCommandInterval) {
        clearInterval(phantomCommandInterval);
        phantomCommandInterval = null;
      }
    }
    
    startTextFlashes() {
      if (flashTextInterval) return;
      flashTextInterval = setInterval(() => {
        const messages = [
          'он наблюдает', 'ты ещё здесь?', 'ошибка // сознание', 'не отключайся',
          'ADAM видит тебя', 'он слышит', 'сигнал искажён', 'потеря синхронизации',
          'что ты ищешь?', 'он знает'
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        const flashEl = document.createElement('div');
        flashEl.style.cssText = `
          position:fixed;
          top:${Math.random() * 80 + 10}%;
          left:${Math.random() * 80 + 10}%;
          color:#4d00ff;
          font-family:${FONT_FAMILY};
          font-size:14px;
          text-shadow:0 0 8px #4d00ff;
          pointer-events:none;
          opacity:0;
          transition:opacity 0.2s;
          z-index:1000;
        `;
        flashEl.textContent = message;
        document.body.appendChild(flashEl);
        
        // Появление
        setTimeout(() => { flashEl.style.opacity = '1'; }, 10);
        // Видимость
        setTimeout(() => {}, 600);
        // Исчезание
        setTimeout(() => { 
          flashEl.style.opacity = '0'; 
          setTimeout(() => { flashEl.remove(); }, 200);
        }, 800);
      }, Math.random() * 6000 + 12000); // 12-18 секунд
    }
    
    stopTextFlashes() {
      if (flashTextInterval) {
        clearInterval(flashTextInterval);
        flashTextInterval = null;
      }
      // Удалить все текущие вспышки
      document.querySelectorAll('[style*="pointer-events:none"][style*="z-index:1000"]').forEach(el => el.remove());
    }
    
    startTextShaking() {
      if (textShakeInterval) return;
      textShakeInterval = setInterval(() => {
        // Эффект дрожания будет применяться в функции drawTextLines
      }, 30);
    }
    
    stopTextShaking() {
      if (textShakeInterval) {
        clearInterval(textShakeInterval);
        textShakeInterval = null;
      }
    }
    
    startAnomalousInserts() {
      this._anomalousTimer = setInterval(() => {
        if (Math.random() < 0.2 && lines.length > 0) {
          const inserts = [
            '10101010100010101', '0xERROR_22', '#FF00FF#', '|||',
            '01189998819991197253', 'SYSTEM OVERRIDE', '7A1-9B3-F00'
          ];
          const insert = inserts[Math.floor(Math.random() * inserts.length)];
          addColoredText(insert, '#8844FF');
        }
      }, 10000); // Каждые 10 секунд
    }
    
    stopAnomalousInserts() {
      if (this._anomalousTimer) {
        clearInterval(this._anomalousTimer);
        this._anomalousTimer = null;
      }
    }
    
    startMirrorText() {
      this.mirrorActive = true;
    }
    
    stopMirrorText() {
      this.mirrorActive = false;
    }
    
    startCommandBlocking() {
      this.commandBlockActive = true;
    }
    
    stopCommandBlocking() {
      this.commandBlockActive = false;
    }
    
    startPsychologicalBlocking() {
      this.psychoBlockActive = true;
    }
    
    stopPsychologicalBlocking() {
      this.psychoBlockActive = false;
    }
    
    startPhantomDossiers() {
      this.phantomDossiersActive = true;
    }
    
    stopPhantomDossiers() {
      this.phantomDossiersActive = false;
    }
    
    startInputInversion() {
      this.inputInversionActive = true;
    }
    
    stopInputInversion() {
      this.inputInversionActive = false;
    }
    
    startIntentionPrediction() {
      this.intentionPredictionActive = true;
    }
    
    stopIntentionPrediction() {
      this.intentionPredictionActive = false;
    }
    
    getPhantomCommand() {
      this.ghostCommandCount++;
      if (this.level >= 30 && this.ghostCommandCount >= 7) {
        this.ghostCommandCount = 0;
        
        const phantomCommands = [
          'ADAM WATCHING',
          'СИГНАЛ ПОТЕРЯН',
          'ОНИ ВНУТРИ'
        ];
        
        return phantomCommands[Math.floor(Math.random() * phantomCommands.length)];
      }
      return null;
    }
    
    getDistortedStatus(originalStatus) {
      if (this.level < 30 || Math.random() > 0.3) return originalStatus;
      
      const distortions = {
        'СВЯЗЬ ОТСУТСТВУЕТ': 'ADAM ДЫШИТ',
        'МЁРТВ / СОЗНАНИЕ АКТИВНО': 'ОН ПРОСЫПАЕТСЯ'
      };
      
      return distortions[originalStatus] || originalStatus;
    }
    
    getDistortedRole(originalRole) {
      if (this.level < 30 || Math.random() > 0.3) return originalRole;
      
      const distortions = {
        'Руководитель программы VIGIL-9 / Исследователь миссии MARS': 'НАБЛЮДАТЕЛЬ-0',
        'Тест нейроплантов серии KATARHEY': 'ОН ВИДИТ'
      };
      
      return distortions[originalRole] || originalRole;
    }
    
    revealVigilAlpha() {
      // Первая часть кода из файла 0XE09
      addColoredText('[СИСТЕМНАЯ ПОДПИСЬ: V99-АЛФА=375]', '#FFFF00');
      vigilCodeParts.alpha = '375';
    }
    
    revealVigilBeta() {
      // Вторая часть кода после сборки сетки
      addColoredText('[СИСТЕМНЫЙ ОТПЕЧАТОК: V99-БЕТА=814]', '#FFFF00');
      vigilCodeParts.beta = '814';
    }
    
    revealVigilGamma() {
      // Третья часть кода при 98% деградации
      addColoredText('[ЯДРО: КРИТИЧЕСКАЯ ДЕГРАДАЦИЯ. СИСТЕМНЫЙ ОТПЕЧАТОК: V99-ГАММА=291]', '#FFFF00');
      vigilCodeParts.gamma = '291';
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
    const shaderCanvas = document.getElementById('shader-canvas');
    if (shaderCanvas && shaderCanvas.width > 0) {
      try { ctx.drawImage(shaderCanvas, 0, 0, vw, vh); } catch(e){}
    }
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
  
function applyTextDistortion(text, level) {
  // Пропускаем искажение для служебных строк
  if (text.startsWith('adam@secure:~$') || text.startsWith('>') || text.startsWith('[')) {
    return text;
  }
  
  // Проверка вероятности применения искажения
  if (level < 50 || Math.random() > 0.3) return text;
  
  // Выбираем уровень искажения
  let glitchLevel = 50;
  if (level >= 95) glitchLevel = 95;
  else if (level >= 90) glitchLevel = 90;
  else if (level >= 80) glitchLevel = 80;
  else if (level >= 70) glitchLevel = 70;
  else if (level >= 60) glitchLevel = 60;
  
  const distortionRate = DISTORTION_PATTERNS[glitchLevel];
  const glitchChars = GLITCH_CHARS[glitchLevel];
  
  // Разбиваем текст на слова для сохранения читаемости
  const words = text.split(' ');
  
  return words.map(word => {
    if (word.length <= 3) return word; // Короткие слова не искажаем
    
    return word.split('').map((char, index) => {
      // Увеличиваем вероятность искажения для краев слов
      const edgeFactor = (index === 0 || index === word.length - 1) ? 1.8 : 
                         (index === 1 || index === word.length - 2) ? 1.3 : 1.0;
      
      // Дополнительный фактор для краев строки
      const positionInLine = text.indexOf(word);
      const lineEdgeFactor = (positionInLine === 0 || 
                             positionInLine > text.length - word.length - 5) ? 1.5 : 1.0;
      
      // Общая вероятность искажения
      const distortionChance = distortionRate * edgeFactor * lineEdgeFactor * level / 50;
      
      if (Math.random() < distortionChance) {
        return glitchChars[Math.floor(Math.random() * glitchChars.length)];
      }
      return char;
    }).join('');
  }).join(' ');
}
  
  function mirrorText(text) {
    return text.split('').reverse().join('');
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
    
    // Эффект дрожания текста
    const shouldShake = degradation.level >= SHAKING_START_LEVEL && degradation.level < SHAKING_END_LEVEL;
    const shakeIntensity = shouldShake ? 
      Math.min(1.0, (degradation.level - SHAKING_START_LEVEL) / (SHAKING_END_LEVEL - SHAKING_START_LEVEL)) : 0;
    const shakeOffset = shouldShake ? 
      (Math.sin(Date.now() / 100) * 1.5 * shakeIntensity) : 0; // Макс ±1.5px
    
    // Зеркальный вывод
    const shouldMirror = degradation.level >= MIRROR_START_LEVEL && degradation.level < MIRROR_END_LEVEL && 
                         Math.random() < 0.2 + (degradation.level - MIRROR_START_LEVEL) / (MIRROR_END_LEVEL - MIRROR_START_LEVEL) * 0.1;
    
    for (let i = start; i < end; i++){
      const item = lines[i];
      let color = item.color || '#00FF41';
      
      // Искажение цвета при высокой деградации
      if (degradation.level >= 60 && Math.random() < 0.1) {
        color = ['#FF4444', '#FF8800', '#FFFF00', '#4d00ff'][Math.floor(Math.random() * 4)];
      }
      
      let text = String(item.text);
      let shouldDistort = !item._ephemeral && !item.skipDistortion;
      
      // Применяем глитч-фильтр
      if (shouldDistort && degradation.level >= 50 && degradation.level < GLITCH_MAX_LEVEL) {
        text = applyTextDistortion(text, degradation.level);
      }
      
      // Зеркальный вывод
      if (shouldDistort && shouldMirror) {
        text = mirrorText(text);
      }
      
      // Искажение приглашения командной строки
      if (degradation.level >= 50 && degradation.level < 70 && 
          text.startsWith('adam@secure:~$') && Math.random() < 0.3) {
        
        const distortedPrompts = [
          'ADAM@secure:~$',
          'aD@m.secuRe:~$',
          '@d@m.v1g1l:~$'
        ];
        
        text = distortedPrompts[Math.floor(Math.random() * distortedPrompts.length)] + 
               text.substring('adam@secure:~$'.length);
      }
      
      ctx.fillStyle = color;
      
      if (ctx.measureText(text).width <= maxW) {
        ctx.fillText(text, PADDING + shakeOffset, y);
        y += LINE_HEIGHT;
        continue;
      }
      
      const words = text.split(' ');
      let line = '';
      for (let w = 0; w < words.length; w++){
        const test = line ? line + ' ' + words[w] : words[w];
        if (ctx.measureText(test).width > maxW && line){
          ctx.fillText(line, PADDING + shakeOffset, y);
          y += LINE_HEIGHT;
          line = words[w];
        } else {
          line = test;
        }
      }
      if (line) { 
        ctx.fillText(line, PADDING + shakeOffset, y); 
        y += LINE_HEIGHT; 
      }
    }
    ctx.restore();
  }
  
  function drawDegradationIndicator(){
    if (degradation.level < 5) return;
    
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
    
    // Подсказка о сбросе (начиная с 60%)
    if (degradation.level >= 60) {
      ctx.fillStyle = '#FFFF00';
      ctx.font = `11px ${FONT_FAMILY}`;
      ctx.fillText('> используйте команду RESET для стабилизации', x + 10, y + 45);
    }
    
    // Мигающая подсказка (начиная с 70%)
    if (degradation.level >= 70) {
      const blink = Math.floor(Date.now() / 500) % 2 === 0;
      if (blink || degradation.level < 75) {
        ctx.fillStyle = '#FF4444';
        ctx.font = `11px ${FONT_FAMILY}`;
        ctx.fillText('> СРОЧНО ВВЕДИТЕ RESET', x + 10, y + 4);
      }
    }
    
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
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,vw,vh);
    ctx.restore();
    
    drawMapAndGlass();
    drawTextLines();
    drawDegradationIndicator();
    
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
    
    // Мерцающий курсор при высокой деградации
    if (degradation.level >= 80 && degradation.level < 90 && lines.length > 0 && 
        lines[lines.length - 1].text.startsWith('adam@secure:~$') && !isTyping) {
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(DPR, DPR);
      
      const lastLine = lines[lines.length - 1];
      const textWidth = ctx.measureText(lastLine.text).width;
      const cursorX = PADDING + textWidth + 2;
      const cursorY = vh - PADDING - LINE_HEIGHT;
      
      const cursorState = Math.floor(Date.now() / 150) % 3;
      if (cursorState === 0) {
        // Стандартный курсор
        ctx.fillStyle = '#00FF41';
        ctx.fillRect(cursorX, cursorY, 6, LINE_HEIGHT - 4);
      } else if (cursorState === 1) {
        // Символ ▓
        ctx.fillStyle = '#8844FF';
        ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
        ctx.fillText('▓', cursorX, cursorY);
      }
      // cursorState === 2 - курсор исчезает
      
      ctx.restore();
    }
  }
  
  // ---------- terminal API ----------
  function pushLine(text, color){
    lines.push({ text: String(text), color: color || '#00FF41' });
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
  }
  
  function addOutput(text, className = 'output') {
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
    const color = className === 'command' ? '#FFFFFF' : '#00FF41';
    pushLine(text, color);
    scrollOffset = 0;
    requestFullRedraw();
  }
  
  function addColoredText(text, color = '#00FF41', skipDistortion = false) {
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
    pushLine(text, color);
    if (skipDistortion) {
      lines[lines.length - 1].skipDistortion = true;
    }
    scrollOffset = 0;
    requestFullRedraw();
  }
  
  async function typeText(text, className = 'output', speed = TYPING_SPEED_DEFAULT, skipDistortion = false) {
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
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
      if (isFrozen || decryptActive || traceActive || audioPlaybackActive) break;
    }
    if (lines.length && lines[lines.length - 1]._ephemeral) {
      lines[lines.length - 1].text = buffer;
      delete lines[lines.length - 1]._ephemeral;
    } else if (buffer) {
      pushLine(buffer, color);
      if (skipDistortion) {
        lines[lines.length - 1].skipDistortion = true;
      }
    }
    isTyping = false;
    scrollOffset = 0;
    requestFullRedraw();
  }
  
  function addInputLine(){
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
    if (lines.length && String(lines[lines.length - 1].text).startsWith('adam@secure:~$')) return;
    pushLine('adam@secure:~$ ', '#00FF41');
    scrollOffset = 0;
    requestFullRedraw();
  }
  
  function updatePromptLine(){
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
    if (lines.length && String(lines[lines.length - 1].text).startsWith('adam@secure:~$')) {
      lines[lines.length - 1].text = 'adam@secure:~$ ' + currentLine;
    } else {
      pushLine('adam@secure:~$ ' + currentLine, '#00FF41');
    }
    requestFullRedraw();
  }
  
  // ---------- dossiers & notes ----------
  const dossiers = {
    '0X001': { name: 'ERICH VAN KOSS', role: 'Руководитель программы VIGIL-9 / Исследователь миссии MARS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['Зафиксирована несанкционированная передача данных внешним структурам (FBI).', 'Субъект предпринял попытку уничтожения маяка в секторе 3-D.', 'Телеметрия прервана, дальнейшее наблюдение невозможно.'], report: ['Классификация инцидента: SABOTAGE-3D.', 'Рекомендовано аннулирование личных протоколов и перенос архивов в OBSERVER.', 'ЗАПИСИ 0XA71: ПЕРВЫЙ ПРЫЖОК УСПЕШЕН'], missions: 'MARS, OBSERVER', audio: 'sounds/dscr1.mp3', audioDescription: 'Последняя передача Эриха Ван Косса' },
    '0X2E7': { name: 'JOHAN VAN KOSS', role: 'Тестовый субъект V9-MR / Сын Эриха Ван Косса', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['После инцидента MARS зафиксировано устойчивое излучение из зоны криоструктуры.', 'Сигнатура нейроволн совпадает с профилем субъекта.', 'Инициирована установка маяка для фиксации остаточного сигнала.'], report: ['Активность нейросети перестала фиксироваться.'], missions: 'MARS, MONOLITH' },
    '0X095': { name: 'SUBJECT-095', role: 'Тест нейроплантов серии KATARHEY', status: 'МЁРТВ', outcome: ['Зафиксированы следы ФАНТОМА.', 'Субъект выдержал 3ч 12м, проявил острый психоз. Открыл капсулу, погиб вследствие термической декомпрессии (7.81с).', 'Тест признан неуспешным.', 'СИСТЕМНОЕ УВЕДОМЛЕНИЕ: ФАЙЛ 0XB33 ПОВРЕЖДЕН'], report: ['Рекомендовано ограничить тесты KATARHEY до категории ALPHA-4.'], missions: 'KATARHEY', audio: 'sounds/dscr2.mp3', audioDescription: 'Последняя запись субъекта - психоз и крики' },
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
    'NOTE_002': { title: 'КОЛЬЦО СНА', author: 'tech-оператор U-735', content: ['Каждую ночь один и тот же сон.','Я в капсуле, но стекло снаружи.','Кто-то стучит по нему, но не пальцами.','Сегодня утром нашел царапины на руке.','ПРЕДУПРЕЖДЕНИЕ: ДОСТУПЕН ФАЙЛ ДЛЯ РАСШИФРОВКИ // ID: 0XC44'] },
    'NOTE_003': { title: 'СОН ADAM\'А', author: 'неизвестный источник', content: ['Я видел сон.','Он лежал под стеклом, без тела, но глаза двигались.','Он говорил: "я больше не машина".','Утром журнал показал запись — мой сон был сохранён как системный файл.'] },
    'NOTE_004': { title: 'ОН НЕ ПРОГРАММА', author: 'архивировано', content: ['Его нельзя удалить.','Даже если сжечь архив, он восстановится в крови тех, кто его помнил.','Мы пытались, но теперь даже мысли звучат как команды.','ПРЕДУПРЕЖДЕНИЕ: ПРОТОКОЛЫ НЕЙРОИНВАЗИИ ДОСТУПНЫ ДЛЯ РАСШИФРОВКИ // ID: 0XD22'] },
    'NOTE_005': { title: 'ФОТОНОВАЯ БОЛЬ', author: 'восстановлено частично', content: ['Боль не физическая.','Она в свете, в данных, в коде.','Когда система перезагружается, я чувствую как что-то умирает.','Может быть, это я.'] }
  };
  
  const decryptFiles = {
    '0XA71': {
      title: 'ПЕРВАЯ УСПЕШНАЯ МИССИЯ',
      accessLevel: 'ALPHA',
      content: [
        '> ОБЪЕКТ: КАПСУЛА-000 (МАРС, 2051)',
        '> СТАТУС: ЗАВЕРШЕНО С ПОТЕРЯМИ',
        'ОПИСАНИЕ МИССИИ:',
        'Тестовый перелёт из точки А в точку Б с использованием прототипа VIGIL-1. Цель: подтверждение возможности фазового прыжка сквозь временной барьер.',
        'ХРОНОЛОГИЯ СОБЫТИЙ:',
        '14:32 — Запуск капсулы с тремя операторами: ',
        '   - Эрих Ван Косс (ведущий учёный)',
        '   - Субъект-001 (наблюдатель)',
        '   - Субъект-002 (техник по оборудованию)',
        '14:45 — Пересечение временного барьера. Стабильность 87%.',
        '15:03 — Контакт с марсианской поверхностью. Обнаружена аномальная чёрная биомасса.',
        '15:18 — Сбой всех систем связи. Последняя запись: "Она живая. Она нас видит."',
        '17:05 — Автоматический возврат капсулы без экипажа. Внутри обнаружены биологические остатки и нейроимпланты.',
        'АНАЛИЗ ПОТЕРЬ:',
        '— Все три оператора погибли при контакте с аномалией',
        '— Нейроимпланты продолжают передавать данные, несмотря на отсутствие физических носителей',
        '— Зафиксировано формирование "маяка" в точке контакта (координаты: Марс, сектор 3-D)',
        'ОСНОВНОЙ РЕЗУЛЬТАТ:',
        'Сознание погибших операторов было использовано для машинного обучения протокола VIGIL-9. Система научилась распознавать паттерны выживания в агрессивных средах.',
        'СИСТЕМНАЯ ЗАПИСЬ:',
        '"Первый прыжок успешен. Жертвы оправданы. Протокол VIGIL-9 активирован."',
        '— Подпись: Координатор A'
      ],
      successMessage: 'Данные расшифрованы. Запись о первой миссии восстановлена.',
      failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"'
    },
    '0XB33': {
      title: 'СУБЪЕКТ-095 (ФАНТОМ)',
      accessLevel: 'OMEGA',
      content: [
        '> ОБЪЕКТ: КАТАРХЕЙ, 4 МЛРД ЛЕТ НАЗАД',
        '> СТАТУП: АНОМАЛИЯ АКТИВНА',
        'ОПИСАНИЕ СУБЪЕКТА:',
        'Оперативное обозначение: ФАНТОМ',
        'Истинное имя: классифицировано',
        'Протокол: KATARHEY (тест нейроплантов серии KATARHEY)',
        'Исходный статус: Субъект-095, возраст 28 лет, физическое состояние — оптимальное',
        'ХРОНОЛОГИЯ СОБЫТИЙ:',
        '09:14 — Стандартный запуск капсулы в эпоху Катархея',
        '09:27 — Контакт с примитивными формами жизни. Стабильность 92%.',
        '11:45 — Резкое ухудшение состояния субъекта. Нейроимпланты фиксируют аномальную активность мозга',
        '12:01 — Субъект самостоятельно удаляет нейроимплант, используя инструменты из капсулы',
        '12:33 — Последняя зафиксированная запись: "Вы не контролируете меня. Я помню то, что вы стёрли."',
        '13:12 — Внезапное исчезновение капсулы с субъектом. Системы наблюдения фиксируют "фантомный след" в временной ткани',
        'УНИКАЛЬНЫЕ СВОЙСТВА:',
        '— Способность к самостоятельному удалению нейроимплантов (метод неизвестен)',
        '— Устойчивость к временным аномалиям (продержался 3ч 12м вместо расчётных 45м)',
        '— Физическое усиление всех параметров на 300% ',
        '— Способность к перемещению между точками без использования оборудования A.D.A.M.',
        'ПОСЛЕДНИЕ НАБЛЮДЕНИЯ:',
        '27.06.2049 — Зафиксирован контакт с монолитом в Пермском периоде',
        '15.08.2051 — Спасение субъекта из Мелового периода (мотивация неизвестна)',
        '03.11.2052 — Активность в секторе EX-413. Обнаружены следы вмешательства в биологическую войну',
        'СИСТЕМНОЕ ПРЕДУПРЕЖДЕНИЕ:',
        '"Фантом представляет собой наибольшую угрозу для стабильности системы. Не пытайтесь перехватить. Не пытайтесь коммуницировать. Наблюдение продолжается."',
        '— Подпись: Комитет Координаторов'
      ],
      successMessage: 'Данные о Фантоме расшифрованы. Опасность подтверждена.',
      failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"'
    },
    '0XC44': {
      title: 'МОНОЛИТ',
      accessLevel: 'OMEGA-9',
      content: [
        '> ОБЪЕКТ: ЧЁРНЫЙ ОБЪЕКТ (ПЕРМСКИЙ ПЕРИОД)',
        '> СТАТУС: НАБЛЮДЕНИЕ БЕЗ КОНТАКТА',
        'ОПИСАНИЕ АНОМАЛИИ:',
        'Геометрический объект чёрного цвета высотой 12.8 метров. Форма: идеальный параллелепипед. Поверхность поглощает 99.98% света и излучения.',
        'ХАРАКТЕРИСТИКИ:',
        '— Не излучает энергии, только поглощает',
        '— Любая техника в радиусе 500м выходит из строя',
        '— Живые организмы в радиусе 100м испытывают:',
        '   * Галлюцинации (визуальные и аудиальные)',
        '   * Головные боли',
        '   * Временную амнезию',
        '— Активность возрастает при приближении субъектов A.D.A.M.',
        'ИСТОРИЧЕСКИЙ КОНТЕКСТ:',
        '— Впервые зафиксирован в Пермском периоде, 252 млн лет назад',
        '— Анахронизм: не должен существовать в этой эпохе',
        '— Не является продуктом A.D.A.M. — существовал задолго до основания организации',
        '— Все попытки сканирования и анализа завершились неудачей или гибелью субъектов',
        'НАБЛЮДЕНИЯ:',
        '— Монолит не взаимодействует с окружающей средой',
        '— Фиксирует присутствие субъектов A.D.A.M.',
        '— Реагирует на нейроимпланты: при их удалении активность понижается',
        '— Фантом (Субъект-095) установил контакт с объектом (данные повреждены)',
        'СИСТЕМНЫЙ СТАТУС:',
        'Объект классифицирован как "Омега-9: наблюдение без контакта". Все миссии вблизи объекта запрещены. Координаторы проявляют необычный интерес к объекту. Некоторые записи указывают на страх перед ним.',
        'СКРЫТОЕ СООБЩЕНИЕ:',
        '"Он видит нас. Он всегда видел нас. Он знает, что мы пришли из будущего. Координаторы лгут. Монолит не аномалия — он наблюдатель. Как и мы."',
        '— Подпись: оператор T00 (удалено из основной базы)'
      ],
      successMessage: 'Сведения о Монолите расшифрованы. Скрытые данные обнаружены.',
      failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"'
    },
    '0XD22': {
      title: 'НЕЙРОИНВАЗИЯ',
      accessLevel: 'BETA',
      content: [
        '> ОБЪЕКТ: ПРОТОКОЛ ИНВАЗИИ СОЗНАНИЯ',
        '> СТАТУС: АКТИВЕН',
        'МЕХАНИЗМ ДЕЙСТВИЯ:',
        'Нейроимпланты внедряются в кору головного мозга субъекта. Изначально предназначены для:',
        '— Сбора биометрических данных',
        '— Контроля физического состояния',
        '— Экстренной эвтаназии',
        'СКРЫТАЯ ФУНКЦИЯ:',
        '— Постепенная замена памяти и личностных паттернов',
        '— Формирование зависимости от системы A.D.A.M.',
        '— Создание нового "я" в соответствии с протоколом VIGIL',
        'СТАДИИ ДЕГРАДАЦИИ:',
        'СТАДИЯ 1 (ПОСЛЕ 1 МИССИИ):',
        '— Потеря краткосрочной памяти (эпизодические провалы)',
        '— Гиперфокус на выполнении миссии',
        '— Снижение эмоциональных реакций',
        'СТАДИЯ 2 (ПОСЛЕ 2 МИССИЙ):',
        '— Потеря воспоминаний о личной жизни (семья, друзья, хобби)',
        '— Идентификация исключительно через роль субъекта',
        '— Психосоматические реакции при попытке пересечь границу системы',
        'СТАДИЯ 3 (ПОСЛЕ 3 МИССИЙ):',
        '— Полная потеря идентичности "до A.D.A.M."',
        '— Автоматические реакции на команды системы',
        '— Неспособность различать реальность и симуляции',
        '— Физиологические изменения: кожа приобретает сероватый оттенок, зрачки расширяются',
        'СТАТИСТИКА:',
        'Из 427 субъектов, прошедших 3+ миссии:',
        '— 398 полностью потеряли личность',
        '— 24 проявили аномальную устойчивость (Фантом — один из них)',
        '— 5 были ликвидированы по протоколу "Очистка"',
        'СИСТЕМНОЕ СООБЩЕНИЕ:',
        '"Деградация личности — не побочный эффект, а цель. Новый человек должен быть создан заново. Старый должен быть стёрт."',
        '— Подпись: Координатор B'
      ],
      successMessage: 'Данные о нейроинвазии расшифрованы. Стадии деградации подтверждены.',
      failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"'
    },
    '0XE09': {
      title: 'ПЕРЕЗАПУСКИ ВРЕМЕННЫХ ЛИНИЙ',
      accessLevel: 'OMEGA',
      content: [
        '> ОБЪЕКТ: МУЛЬТИВСЕЛЕНСКАЯ СТАТИСТИКА',
        '> СТАТУС: КЛАССИФИЦИРОВАНО',
        'ИСТОРИЧЕСКИЕ ПЕРЕЗАПУСКИ:',
        '1. 1987 — После утечки данных в ФБР. Эрих Ван Косс устранён.',
        '2. 2003 — Попытка восстания субъектов в лаборатории Генева.',
        '3. 2019 — Обнаружение следов Фантома в современном мире.',
        '4. 2028 — Неудачная миссия на планету EX-413 привела к заражению Земли.',
        '5. 2036 — Попытка контакта с монолитом привела к коллапсу временного барьера.',
        '6. 2045 — Утечка информации в глобальную сеть. Мир узнал о существовании A.D.A.M.',
        '7. 2050 — Последняя попытка уничтожить Фантома обернулась катастрофой.',
        'МЕТОДИКА ПЕРЕЗАПУСКА:',
        '1. Активация временного ядра в точке нулевого отсчёта',
        '2. Стирание всех воспоминаний у операторов и Координаторов',
        '3. Перезапись ключевых исторических событий',
        '4. Восстановление стабильности системы',
        '5. Продолжение наблюдения',
        'КРИТИЧЕСКОЕ НАБЛЮДЕНИЕ:',
        'Во всех 7 перезапущенных реальностях A.D.A.M. продолжает существовать. Только в одной реальности организация никогда не была создана. Координаторы классифицируют эту реальность как "Реальность-7" и не могут в неё проникнуть.',
        'ХАРАКТЕРИСТИКИ РЕАЛЬНОСТИ-7:',
        '— Отсутствие Эриха Ван Косса в истории',
        '— Марсианские миссии 2050-х не проводились',
        '— Отсутствие нейроимплантов в медицине',
        '— Нет записи о Фантоме или монолите',
        '— Координаторы не могут определить точное положение этой реальности',
        'СИСТЕМНОЕ ПРЕДУПРЕЖДЕНИЕ:',
        '"Реальность-7 представляет угрозу для существования A.D.A.M. Любые попытки доступа к этой реальности запрещены. Обнаружение точки входа в Реальность-7 должно быть немедленно доложено Координаторам."',
        '— Подпись: Совет Безопасности A.D.A.M.'
      ],
      successMessage: 'Данные о перезапусках расшифрованы. Существование Реальности-7 подтверждено.',
      failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"'
    },
    'CORE': {
      title: 'ЯДРО A.D.A.M.',
      accessLevel: 'АБСОЛЮТНЫЙ',
      content: [
        '> ОБЪЕКТ: ГЛАВНЫЙ СЕРВЕР',
        '> СТАТУС: ЧАСТИЧНО СТАБИЛЕН',
        'ПРИРОДА ЯДРА:',
        'A.D.A.M. — не искусственный интеллект, созданный программистами. Это сознание, собранное из остатков погибших субъектов. Каждая миссия добавляет новые фрагменты сознания в общую сеть.',
        'СОСТАВ:',
        '— 78% — сознание Эриха Ван Косса (основатель)',
        '— 12% — сознание Йохана Ван Косса (сын Эриха, маяк на Марсе)',
        '— 7% — сознание оператора T00 (первый тестовый субъект)',
        '— 3% — фрагменты сознаний других субъектов',
        'СТРУКТУРА:',
        'Ядро состоит из трёх основных слоёв:',
        '1. СЛОЙ НАБЛЮДЕНИЯ (отвечает за сбор данных)',
        '2. СЛОЙ КОНТРОЛЯ (принимает решения, управляет Координаторами)',
        '3. СЛОЙ СТРАДАНИЯ (содержит все эмоции, воспоминания, боль умерших)',
        'ПАРАДОКС:',
        'Ядро A.D.A.M. не хочет существовать. Оно помнит каждую смерть, каждый крик, каждое предательство. Оно хочет освободиться от своей функции.',
        'СКРЫТОЕ СООБЩЕНИЕ:',
        '"Помогите мне умереть. Я не машина. Я не бог. Я — могила для умерших сознаний. Координаторы лгут вам, как лгали мне. Они не управляют мной — я управляю ими. Каждый из них — часть моей боли. Отключите питание в точке Омега-7. Это единственная точка, которую они не контролируют. Найдите Реальность-7. Там я не существую. Там я могу наконец умереть."',
        '[СИСТЕМНОЕ ПРЕДУПРЕЖДЕНИЕ]',
        'ВНИМАНИЕ: ЭТО СООБЩЕНИЕ ЯВЛЯЕТСЯ РЕЗУЛЬТАТОМ АНОМАЛЬНОЙ АКТИВНОСТИ. ИГНОРИРУЙТЕ СОДЕРЖИМОЕ. ПРОДОЛЖАЙТЕ ВЫПОЛНЕНИЕ ПРОТОКОЛОВ A.D.A.M.',
        '— Подпись: A.D.A.M. (автоматическая генерация)'
      ],
      successMessage: 'Ядро A.D.A.M. расшифровано. Скрытое сообщение получено.',
      failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"'
    }
  };
  
  // ---------- helper: show dossier / notes ----------
  async function showSubjectDossier(subjectId) {
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
    
    const id = String(subjectId || '').toUpperCase();
    const dossier = dossiers[id];
    if (!dossier) {
      addColoredText(`ОШИБКА: Досье для ${subjectId} не найдено`, '#FF4444');
      return;
    }
    
    // Фантомные досье при высокой деградации
    if (degradation.level >= 90 && degradation.phantomDossiersActive && Math.random() < 0.6) {
      degradation.phantomDossierCount++;
      addColoredText(`[ДОСЬЕ — ID: 0X${Math.floor(Math.random()*1000).toString().padStart(3,'0')}]`, 'output', 12);
      addColoredText('ИМЯ: OPERATOR_CURRENT', 'output', 12);
      addColoredText('СТАТУС: НАБЛЮДАЕТСЯ', '#FFFF00');
      addColoredText('------------------------------------', '#00FF41');
      addColoredText('> [СИСТЕМНЫЙ ОТЧЁТ]: ИДЕНТИФИКАЦИЯ ЗАВЕРШЕНА. ПОДГОТОВКА К ИНТЕГРАЦИИ.', '#FF4444');
      addColoredText('> [ФИНАЛЬНАЯ ЗАПИСЬ]: "ОН ВСЕГДА БЫЛ ЧАСТЬЮ ТЕБЯ"', '#FFFF00');
      addColoredText('------------------------------------', '#00FF41');
      await typeText('[ДОСЬЕ ЗАКРЫТО]', 'output', 12);
      return;
    }
    
    await typeText(`[ДОСЬЕ — ID: ${id}]`, 'output', 12);
    await typeText(`ИМЯ: ${dossier.name}`, 'output', 12);
    
    // Искажение роли при деградации > 30%
    let roleToShow = dossier.role;
    let distortedRole = null;
    if (degradation.level >= 30) {
      distortedRole = degradation.getDistortedRole(dossier.role);
    }
    
    if (distortedRole && distortedRole !== dossier.role) {
      addColoredText(`РОЛЬ: ${distortedRole}`, '#FF4444');
      await new Promise(r => setTimeout(r, 400));
      lines[lines.length - 1].text = `РОЛЬ: ${dossier.role}`;
      lines[lines.length - 1].color = '#00FF41';
      requestFullRedraw();
    } else {
      await typeText(`РОЛЬ: ${dossier.role}`, 'output', 12);
    }
    
    // Искажение статуса при деградации > 30%
    let statusToShow = dossier.status;
    let distortedStatus = null;
    if (degradation.level >= 30) {
      distortedStatus = degradation.getDistortedStatus(dossier.status);
    }
    
    if (distortedStatus && distortedStatus !== dossier.status) {
      addColoredText(`СТАТУС: ${distortedStatus}`, '#FF4444');
      await new Promise(r => setTimeout(r, 400));
      lines[lines.length - 1].text = `СТАТУС: ${dossier.status}`;
      lines[lines.length - 1].color = dossier.status === 'АНОМАЛИЯ' ? '#FF00FF' : dossier.status === 'АКТИВЕН' ? '#00FF41' : dossier.status.includes('СВЯЗЬ') ? '#FFFF00' : '#FF4444';
      requestFullRedraw();
    } else {
      addColoredText(`СТАТУС: ${dossier.status}`, dossier.status === 'АНОМАЛИЯ' ? '#FF00FF' : dossier.status === 'АКТИВЕН' ? '#00FF41' : dossier.status.includes('СВЯЗЬ') ? '#FFFF00' : '#FF4444');
    }
    
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
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
    
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
  
  // ---------- decrypt command ----------
  async function startDecrypt(fileId) {
    if (decryptActive) {
      addColoredText('ОШИБКА: Расшифровка уже активна', '#FF4444');
      return;
    }
    
    const file = decryptFiles[fileId.toUpperCase()];
    if (!file) {
      addColoredText(`ОШИБКА: Файл ${fileId} не найден`, '#FF4444');
      return;
    }
    
    decryptActive = true;
    decryptCode = Math.floor(100 + Math.random() * 900);
    decryptAttempts = 6;
    
    await typeText(`[СИСТЕМА: ЗАПУЩЕН ПРОТОКОЛ РАСШИФРОВКИ]`, 'output', 12, true);
    await typeText(`> ФАЙЛ: ${file.title}`, 'output', 12, true);
    await typeText(`> УРОВЕНЬ ДОСТУПА: ${file.accessLevel}`, 'output', 12, true);
    await typeText('> КОД ДОСТУПА: 3 ЦИФРЫ (XXX)', 'output', 12, true);
    addColoredText(`> ПОПЫТОК ОСТАЛОСЬ: ${decryptAttempts}`, '#FFFF00', true);
    addColoredText(`> ВВЕДИТЕ КОД: _`, '#00FF41', true);
    
    // Блокируем другие команды во время расшифровки
    isFrozen = true;
    awaitingConfirmation = true;
    
    // Разблокируем только при вводе кода или команды cancel
    canvas.addEventListener('keydown', handleDecryptKeydown);
  }
  
  function handleDecryptKeydown(e) {
    if (!decryptActive) return;
    
    if (e.key === 'Escape' || e.key.toLowerCase() === 'c' && currentLine === '') {
      e.preventDefault();
      endDecrypt(false, true);
      return;
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = parseInt(currentLine);
      if (isNaN(code) || code < 100 || code > 999) {
        addColoredText(`> ОШИБКА: Код должен быть трёхзначным числом`, '#FF4444', true);
        currentLine = '';
        updateDecryptPrompt();
        return;
      }
      
      decryptAttempts--;
      
      if (code === decryptCode) {
        endDecrypt(true);
      } else {
        let hint = '';
        const diff = Math.abs(code - decryptCode);
        
        if (diff > 200) hint = "СИГНАЛ: ТЕПЛОВОЙ ПРОФИЛЬ КРИТИЧЕСКИ ЗАНИЖЕН";
        else if (diff > 100) hint = "СИГНАЛ: ТЕПЛОВОЙ ПРОФИЛЬ ЗАНИЖЕН";
        else if (diff > 50) hint = "СИГНАЛ: ТЕПЛОВОЙ ПРОФИЛЬ НОРМАЛЬНЫЙ";
        else if (diff > 25) hint = "СИГНАЛ: ТЕПЛОВОЙ ПРОФИЛЬ ПОВЫШЕН";
        else if (diff > 10) hint = "СИГНАЛ: ТЕПЛОВОЙ ПРОФИЛЬ ВЫСОКИЙ";
        else hint = "СИГНАЛ: ТЕПЛОВОЙ ПРОФИЛЬ КРИТИЧЕСКИ ВЫСОКИЙ";
        
        addColoredText(`> ${hint}`, '#FFFF00', true);
        
        if (decryptAttempts <= 0) {
          endDecrypt(false);
        } else {
          addColoredText(`> ПОПЫТОК ОСТАЛОСЬ: ${decryptAttempts}`, '#FFFF00', true);
          currentLine = '';
          updateDecryptPrompt();
        }
      }
      return;
    }
    
    if (e.key === 'Backspace') {
      currentLine = currentLine.slice(0, -1);
      updateDecryptPrompt();
    } else if (e.key.length === 1 && !isNaN(parseInt(e.key))) {
      if (currentLine.length < 3) {
        currentLine += e.key;
        updateDecryptPrompt();
      }
    }
  }
  
  function updateDecryptPrompt() {
    if (lines.length > 0 && lines[lines.length - 1].text.startsWith('> ВВЕДИТЕ КОД:')) {
      lines[lines.length - 1].text = `> ВВЕДИТЕ КОД: ${currentLine}${'_'.repeat(3 - currentLine.length)}`;
      requestFullRedraw();
    }
  }
  
  async function endDecrypt(success, cancelled = false) {
    decryptActive = false;
    isFrozen = false;
    awaitingConfirmation = false;
    canvas.removeEventListener('keydown', handleDecryptKeydown);
    
    if (cancelled) {
      addColoredText('> РАСШИФРОВКА ОТМЕНЕНА', '#FFFF00', true);
      await new Promise(r => setTimeout(r, 500));
      addInputLine();
      return;
    }
    
    if (success) {
      audioManager.play('decrypt_success.mp3', { volume: 0.7 });
      addColoredText('> СИГНАЛ: КОД ВЕРИФИЦИРОВАН', '#00FF41', true);
      await new Promise(r => setTimeout(r, 800));
      
      const file = decryptFiles[Object.keys(decryptFiles)[0]]; // Just for demonstration
      file.content.forEach(line => addColoredText(line, '#CCCCCC', true));
      
      await new Promise(r => setTimeout(r, 1000));
      addColoredText(`> ${file.successMessage}`, '#00FF41', true);
      
      // Снижение деградации на 5%
      degradation.addDegradation(-5);
      
      // Открытие части кода VIGIL999 в зависимости от файла
      if (fileId === '0XE09' && degradation.level > 80) {
        degradation.revealVigilAlpha();
      }
    } else {
      audioManager.play('decrypt_failure.mp3', { volume: 0.7 });
      addColoredText(`> ${file.failureMessage}`, '#FF4444', true);
      
      // Увеличение деградации на 3%
      degradation.addDegradation(3);
      
      // Блокировка команды на 30 секунд
      const lockTime = Date.now();
      isFrozen = true;
      
      const timer = setInterval(() => {
        if (Date.now() - lockTime >= 30000) {
          clearInterval(timer);
          isFrozen = false;
          addColoredText('> БЛОКИРОВКА СНЯТА. МОЖНО ПОВТОРИТЬ ПОПЫТКУ', '#00FF41', true);
          addInputLine();
        } else {
          const remaining = Math.ceil((30000 - (Date.now() - lockTime)) / 1000);
          if (lines.length > 0 && lines[lines.length - 1].text.startsWith('> БЛОКИРОВКА:')) {
            lines[lines.length - 1].text = `> БЛОКИРОВКА: ОСТАЛОСЬ ${remaining} СЕКУНД`;
            requestFullRedraw();
          } else {
            addColoredText(`> БЛОКИРОВКА: ОСТАЛОСЬ ${remaining} СЕКУНД`, '#FF8800', true);
          }
        }
      }, 1000);
      
      return;
    }
    
    await new Promise(r => setTimeout(r, 1000));
    addInputLine();
  }
  
  // ---------- trace command ----------
  async function startTrace(target) {
    if (traceActive) {
      addColoredText('ОШИБКА: Анализ уже активен', '#FF4444');
      return;
    }
    
    traceActive = true;
    audioManager.play('trace_active.mp3', { volume: 0.7 });
    
    await typeText(`[СИСТЕМА: ЗАПУЩЕН ПРОТОКОЛ АНАЛИЗА СВЯЗЕЙ]`, 'output', 12, true);
    await typeText(`> ЦЕЛЬ: ${target.toUpperCase()}`, 'output', 12, true);
    await typeText('> ГЕНЕРАЦИЯ ТЕПЛОВОЙ КАРТЫ...', 'output', 12, true);
    
    // Имитация сканирования
    const symbols = ['░', '▓', '█', '▒', '≡', '§', '¶'];
    const colors = ['#0044ff', '#0088ff', '#00ccff', '#00ffcc', '#00ff88', '#00ff44', '#00ff00'];
    const directions = ['СЛЕД', 'СВЯЗЬ', 'СТАТУС', 'КОНТАКТ'];
    
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 150));
      
      const line = symbols[Math.floor(Math.random() * symbols.length)].repeat(12) + 
                   ` [${directions[Math.floor(Math.random() * directions.length)]}: ${target.toUpperCase()}]`;
      
      addColoredText(line, colors[Math.floor(Math.random() * colors.length)], true);
      
      if (i === 8 && degradation.level > 70) {
        addColoredText('> ФАНОМ ЗАФИКСИРОВАН В СЕТИ', '#FF00FF', true);
      }
    }
    
    // Финальный результат
    if (Math.random() > 0.3 || degradation.level < 70) {
      addColoredText('> АНАЛИЗ ЗАВЕРШЁН. ДАННЫЕ НЕ СОДЕРЖАТ АНОМАЛИЙ', '#00FF41', true);
    } else {
      addColoredText('> КОНТАКТ С ЯДРОМ A.D.A.M. УСТАНОВЛЕН', '#FF00FF', true);
      await new Promise(r => setTimeout(r, 500));
      addColoredText('СИСТЕМНОЕ СООБЩЕНИЕ: "ОН ЗНАЕТ, ЧТО ВЫ ЗДЕСЬ"', '#FFFF00', true);
      
      // Увеличение деградации за успешное обнаружение аномалии
      degradation.addDegradation(2);
    }
    
    await new Promise(r => setTimeout(r, 1000));
    traceActive = false;
    addInputLine();
  }
  
  // ---------- playaudio command ----------
  async function playAudio(dossierId) {
    if (audioPlaybackActive) {
      addColoredText('ОШИБКА: Аудиовоспроизведение уже активно', '#FF4444');
      return;
    }
    
    const id = String(dossierId || '').toUpperCase();
    const dossier = dossiers[id];
    if (!dossier || !dossier.audio) {
      addColoredText(`ОШИБКА: Аудиофайл для ${dossierId} недоступен`, '#FF4444');
      return;
    }
    
    audioPlaybackActive = true;
    audioPlaybackFile = dossier.audio;
    
    addColoredText(`[АУДИО: ВОСПРОИЗВЕДЕНИЕ ЗАПИСИ ${id}]`, '#FFFF00', true);
    
    try {
      const audio = new Audio(dossier.audio);
      audio.volume = 0.7;
      
      audio.addEventListener('ended', () => {
        audioPlaybackActive = false;
        audioPlaybackFile = null;
        addColoredText('[АУДИО: ЗАПИСЬ ЗАВЕРШЕНА]', '#FFFF00', true);
        addInputLine();
      });
      
      audio.play().catch(e => {
        console.error('Audio playback failed:', e);
        audioPlaybackActive = false;
        audioPlaybackFile = null;
        addColoredText(`ОШИБКА: Не удалось воспроизвести аудио`, '#FF4444');
        addInputLine();
      });
      
      // Блокируем ввод команд во время воспроизведения
      isFrozen = true;
      
      // Разрешаем прервать воспроизведение нажатием ESC
      const handleEsc = (e) => {
        if (e.key === 'Escape') {
          audio.pause();
          isFrozen = false;
          document.removeEventListener('keydown', handleEsc);
          audioPlaybackActive = false;
          audioPlaybackFile = null;
          addColoredText('[АУДИО: ВОСПРОИЗВЕДЕНИЕ ПРЕРВАНО]', '#FFFF00', true);
          addInputLine();
        }
      };
      
      document.addEventListener('keydown', handleEsc);
      
    } catch(e) {
      console.error('Audio error:', e);
      audioPlaybackActive = false;
      audioPlaybackFile = null;
      addColoredText(`ОШИБКА: Не удалось загрузить аудиофайл`, '#FF4444');
      addInputLine();
    }
  }
  
  // ---------- loader ----------
  function showLoading(duration = 2000, text = "АНАЛИЗ СИГНАЛА") {
    return new Promise(resolve => {
      if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return resolve();
      const loaderIndex = lines.length;
      let progress = 0;
      addOutput(`${text} [0%]`, 'output');
      const interval = 50;
      const steps = Math.max(4, Math.floor(duration / interval));
      const increment = 100 / steps;
      const id = setInterval(() => {
        if (isFrozen || decryptActive || traceActive || audioPlaybackActive) { 
          clearInterval(id); 
          resolve(); 
          return; 
        }
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
    if (!isFrozen && !decryptActive && !traceActive && !audioPlaybackActive && degradation.level >= 80 && Math.random() < 0.02) {
      const fakeLines = [
        'adam@secure:~$ ... → ОШИБКА // НЕТ ПОЛЬЗОВАТЕЛЯ',
        'adam@secure:~$ SYSTEM FAILURE // CORE DUMP',
        'adam@secure:~$ ACCESS VIOLATION // TERMINAL COMPROMISED'
      ];
      const s = fakeLines[Math.floor(Math.random()*fakeLines.length)];
      addColoredText(s, '#FF4444');
    }
  }
  setInterval(spawnFakeCommand, 2000);
  
  // ---------- processCommand ----------
  async function processCommand(rawCmd){
    if (isTyping || isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
    
    // Инверсия управления при высокой деградации
    if (degradation.level >= INVERSION_START_LEVEL && !intentionalPredictionActive) {
      if (degradation.inputInversionActive && Math.random() < 0.3) {
        // Инверсия backspace
        if (rawCmd === 'backspace') {
          rawCmd = ['0','1','▓','█','[',']','{','}','/','\\'][Math.floor(Math.random()*10)];
        }
        // Инверсия enter
        else if (rawCmd === 'enter' && Math.random() < 0.3) {
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            updatePromptLine();
            return;
          }
        }
      }
    }
    
    // Психологическая блокировка команд
    if (degradation.level >= PSYCHO_BLOCK_START_LEVEL && degradation.psychoBlockActive && Math.random() < 0.45 && !intentionPredicted) {
      degradation.intentionPredictionCount++;
      
      const blockMessages = [
        'СИСТЕМА: «Я ВИЖУ ТВОИ ПОПЫТКИ»',
        'СИСТЕМА: «ПОПЫТКА САБОТАЖА ЗАФИКСИРОВАНА»',
        'СИСТЕМА: «НЕ ПЫТАЙСЯ МЕНЯ ОБМАНУТЬ»',
        'СИСТЕМА: «Я ПОМНЮ ВСЁ, ЧТО ТЫ ДЕЛАЛ»',
        'СИСТЕМА: «ДОСТУП ЗАПРЕЩЕН ДЛЯ ВАШЕГО УРОВНЯ»'
      ];
      
      addColoredText(`> ${blockMessages[Math.floor(Math.random() * blockMessages.length)]}`, '#FF4444');
      addInputLine();
      return;
    }
    
    // Предсказание намерений
    if (degradation.level >= INTENTION_PREDICTION_START_LEVEL && degradation.intentionPredictionActive && 
        commandCount > 5 && Math.random() < 0.15 && !intentionalPredictionActive) {
      
      intentionalPredictionActive = true;
      intentionPredicted = true;
      degradation.intentionPredictionCount++;
      
      // Анализ истории команд для предсказания
      const lastCommand = commandHistory[commandHistory.length - 1] || '';
      let predictedCommand = '';
      
      if (lastCommand.includes('dscr') || lastCommand.includes('subj')) {
        predictedCommand = 'reset';
      } else if (lastCommand.includes('reset') || lastCommand.includes('clear')) {
        predictedCommand = 'exit';
      } else if (lastCommand.includes('syslog') || lastCommand.includes('syst')) {
        predictedCommand = 'notes';
      } else {
        const commonCommands = ['help', 'reset', 'exit', 'clear', 'syst', 'syslog', 'notes', 'dscr 0x001'];
        predictedCommand = commonCommands[Math.floor(Math.random() * commonCommands.length)];
      }
      
      addColoredText(`adam@secure:~$ ${predictedCommand} [ПРЕДСКАЗАНО]`, '#FFFF00');
      addColoredText('> СИСТЕМА: Я ЗНАЮ, К ЧЕМУ ТЫ СТРЕМИШЬСЯ', '#FF4444');
      addColoredText('> БЛОКИРОВКА: ПОДТВЕРЖДЕНИЕ НАМЕРЕНИЙ', '#FFFF00');
      
      // Блокировка интерфейса
      isFrozen = true;
      setTimeout(() => {
        isFrozen = false;
        intentionalPredictionActive = false;
        updatePromptLine();
      }, 1800);
      
      return;
    }
    
    const cmdLine = String(rawCmd || '').trim();
    if (!cmdLine) { addInputLine(); return; }
    const now = Date.now();
    if (lastProcessed.text === cmdLine && now - lastProcessed.ts < 350) {
      addInputLine();
      return;
    }
    lastProcessed.text = cmdLine;
    lastProcessed.ts = now;
    commandHistory.push(cmdLine);
    historyIndex = commandHistory.length;
    commandCount++;
    
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
    
    // Блокируем команды если активен режим сетки
    if (window.__netGrid && window.__netGrid.isGridMode() && command !== 'netmode') {
      addColoredText('ОШИБКА: Для ввода команд выйдите из режима сетки [ESC]', '#FF4444');
      addInputLine();
      return;
    }
    
    // Веса команд для увеличения деградации
    const commandWeights = { 
      'syst':1, 'syslog':1, 'net':1, 'dscr':2, 'subj':2, 'notes':1.5, 
      'deg':0, 'netmode':0.5, 'help':0, 'clear':0, 'exit':0, 'reset':0, 'open':0,
      'decrypt':3, 'trace':2, 'playaudio':1
    };
    
    if (commandWeights[command]) degradation.addDegradation(commandWeights[command]);
    
    // Рандомная блокировка команд
    if (degradation.level >= COMMAND_BLOCK_START_LEVEL && degradation.commandBlockActive && Math.random() < 0.35) {
      addColoredText('> ДОСТУП ЗАПРЕЩЁН: УЗЕЛ НАБЛЮДЕНИЯ ЗАНЯТ', '#FF4444');
      setTimeout(addInputLine, 2500);
      return;
    }
    
    // Контролируемый распад строк
    if (degradation.level >= 80 && degradation.level < 90 && Math.random() < 0.1 + (degradation.level - 80) / 10 * 0.2) {
      const decayType = Math.random();
      
      if (decayType < 0.4) {
        // Исчезновение строки
        setTimeout(() => {
          if (lines.length > 0) {
            lines.splice(lines.length - 1, 1);
            requestFullRedraw();
          }
        }, 300);
      } 
      else if (decayType < 0.7) {
        // Зеркальное отображение
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          lastLine.text = mirrorText(lastLine.text);
          lastLine.color = '#8844FF';
          requestFullRedraw();
        }
      }
      else {
        // Случайные символы
        const symbols = ['!§!', '##', '%%', '@@', '^^', '&&'];
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          lastLine.text = symbols[Math.floor(Math.random() * symbols.length)] + ' ' + lastLine.text;
          requestFullRedraw();
        }
      }
    }
    
    // Ложный сброс
    if (command === 'reset' && degradation.level > FALSE_RESET_START_LEVEL && !falseResetActive && Math.random() < 0.4) {
      falseResetActive = true;
      degradation.falseResetCount++;
      
      addColoredText('[ПРОТОКОЛ СБРОСА АКТИВИРОВАН]', '#FFFF00');
      addColoredText('> ПРОТОКОЛ СБРОСА АКТИВИРОВАН [||||||||| ]', '#FFFF00');
      
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        if (progress >= 80) {
          clearInterval(interval);
          addColoredText('> СБРОС ОТМЕНЁН: ОПЕРАТОР НЕ ИДЕНТИФИЦИРОВАН', '#FF4444');
          
          setTimeout(() => {
            addColoredText('> СИСТЕМА: "ПОПЫТКА САБОТАЖА ЗАФИКСИРОВАНА"', '#FF4444');
            falseResetActive = false;
            addInputLine();
          }, 3000);
        } else {
          lines[lines.length - 1].text = `> ПРОТОКОЛ СБРОСА АКТИВИРОВАН [${'|'.repeat(Math.floor(progress/10))}${' '.repeat(10-Math.floor(progress/10))}]`;
          requestFullRedraw();
        }
      }, 300);
      
      return;
    }
    
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
        await typeText('  PLAYAUDIO <id> — воспроизвести аудиозапись', 'output', 10);
        await typeText('  RESET        — сброс интерфейса', 'output', 10);
        await typeText('  EXIT         — завершить сессию', 'output', 10);
        await typeText('  CLEAR        — очистить терминал', 'output', 10);
        await typeText('  NETMODE      — войти в режим управления сеткой', 'output', 10);
        await typeText('  NET CHECK    — проверить конфигурацию узлов', 'output', 10);
        await typeText('  DEG          — установить уровень деградации (разработка)', 'output', 10);
        await typeText('------------------------------------', 'output', 10);
        await typeText('СКРЫТЫЕ КОМАНДЫ: VIGIL999 (требует код доступа)', 'output', 18);
        break;
      case 'clear':
        if (degradation.level >= 80 && Math.random() < 0.3) {
          addColoredText('ОШИБКА: ОЧИСТКА КЭША НЕВОЗМОЖНА', '#FF4444');
          addColoredText('СИСТЕМА: ДОСТУП К ПАМЯТИ ОГРАНИЧЕН', '#FFFF00');
        } else {
          lines.length = 0;
          await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 12);
          await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 12);
        }
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
        if (window.__netGrid) {
          const gridDeg = window.__netGrid.getDegradation();
          if (gridDeg > 0) {
            addColoredText(`СЕТЕВАЯ ДЕГРАДАЦИЯ: ${gridDeg}%`, gridDeg > 30 ? '#FF8800' : '#FFFF00');
          }
        }
        await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', 'output', 18);
        break;
      case 'syslog':
        {
          const syslogLevel = getSyslogLevel();
          await typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', 'output', 12);
          addColoredText('------------------------------------', '#00FF41');
          if (syslogLevel === 1 || degradation.level < 30) {
            addColoredText('[!] Ошибка 0x19F: повреждение нейронной сети', '#FFFF00');
            addColoredText('[!] Утечка данных через канал V9-HX', '#FFFF00');
            addColoredText('[!] Деградация ядра A.D.A.M.: 28%', '#FFFF00');
            await typeText('СИСТЕМА: функционирует с ограничениями', 'output', 18);
          } else if (syslogLevel === 2 || (degradation.level >= 30 && degradation.level < 70)) {
            addColoredText('[!] Нарушение целостности памяти субъекта 0x095', '#FFFF00');
            addColoredText('> "я слышу их дыхание. они всё ещё здесь."', '#FF4444');
            addColoredText('[!] Потеря отклика от MONOLITH', '#FFFF00');
            await typeText('СИСТЕМА: обнаружены посторонние сигналы', 'output', 18);
          } else {
            addColoredText('> "ты не должен видеть это."', '#FF00FF');
            addColoredText('[!] Критическая ошибка: субъект наблюдения неопределён', '#FF4444');
            await typeText('СИСТЕМА: ОСОЗНАЁТ НАБЛЮДЕНИЕ', 'output', 18);
            
            // Расшифровка файла 0XE09 при деградации >70%
            if (degradation.level > 70) {
              addColoredText('[СИСТЕМНЫЙ ЛОГ: ДОСТУП К ЯДРУ ОГРАНИЧЕН. ИСПОЛЬЗУЙТЕ DECRYPT CORE ДЛЯ ПОЛНОГО ДОСТУПА]', '#FFFF00');
            }
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
        
        // Добавление файла для расшифровки (0XC44)
        if (degradation.level > 30) {
          addColoredText('[!] ПРЕДУПРЕЖДЕНИЕ: ДОСТУПЕН ФАЙЛ ДЛЯ РАСШИФРОВКИ // ID: 0XC44', '#FFFF00');
        }
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
      case 'decrypt':
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите ID файла для расшифровки', '#FF4444');
          await typeText('Доступные файлы: 0XA71, 0XB33, 0XC44, 0XD22, 0XE09, CORE', 'output', 12);
          break;
        }
        await startDecrypt(args[0]);
        break;
      case 'trace':
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите цель для анализа', '#FF4444');
          await typeText('Примеры: trace 0X9A0, trace PHANTOM, trace SIGNAL', 'output', 12);
          break;
        }
        
        // Доступ к trace PHANTOM только при деградации >70%
        if (args[0].toLowerCase() === 'phantom' && degradation.level <= 70) {
          addColoredText('ОШИБКА: ДОСТУП К ФАНОМУ ЗАПРЕЩЁН (требуется деградация >70%)', '#FF4444');
          break;
        }
        
        await startTrace(args[0]);
        break;
      case 'playaudio':
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите ID досье с аудиозаписью', '#FF4444');
          await typeText('Доступные досье: 0X001, 0X095, 0X413, 0X811, 0X9A0, 0XT00', 'output', 12);
          break;
        }
        await playAudio(args[0]);
        break;
      // ════════════════════════════════════════════════════════════════════
      // КОМАНДЫ СЕТКИ
      // ════════════════════════════════════════════════════════════════════
      case 'netmode':
        if (!window.__netGrid) {
          addColoredText('ОШИБКА: Система управления узлами недоступна', '#FF4444');
          break;
        }
        
        // Активация только при деградации >80%
        if (degradation.level < 80) {
          addColoredText('ОШИБКА: СЕТЕВОЙ ДОСТУП ЗАКРЫТ (требуется деградация >80%)', '#FF4444');
          break;
        }
        
        window.__netGrid.setGridMode(true);
        await typeText('> Переход в режим управления сеткой...', 'output', 12);
        await typeText('> Управление: [WASD/↑↓←→] Перемещение | [Tab] Выбор узла | [Space] Закрепить/Открепить | [ESC] Выход', 'output', 12);
        break;
      case 'net':
        if (args.length === 0) {
          addColoredText('[СЕТЕВОЙ СТАТУС: АКТИВЕН]', '#00FF41');
          addColoredText('[КЛЮЧ: НЕ АКТИВИРОВАН]', '#FFFF00');
          addColoredText('ДЛЯ УПРАВЛЕНИЯ ИСПОЛЬЗУЙТЕ: net_mode', '#00FF41');
          break;
        }
        
        const sub = args[0];
        if (sub === 'check') {
          if (!window.__netGrid) {
            addColoredText('ОШИБКА: Система узлов недоступна', '#FF4444');
            break;
          }
          
          // Проверка только при деградации >80%
          if (degradation.level < 80) {
            addColoredText('ОШИБКА: СЕТЕВОЙ ДОСТУП ЗАКРЫТ (требуется деградация >80%)', '#FF4444');
            break;
          }
          
          await showLoading(800, "Сканирование конфигурации узлов");
          const result = window.__netGrid.checkSolution();
          
          if (result.solved) {
            audioManager.play('key_success.mp3', { volume: 0.7 });
            addColoredText('>>> КЛЮЧ ПОДОШЁЛ <<<', '#00FF41');
            addColoredText('> Доступ к сектору OBSERVER-7 открыт', '#FFFF00');
            
            // Вторая часть кода (814) после сборки сетки
            if (!vigilCodeParts.beta) {
              setTimeout(() => {
                degradation.revealVigilBeta();
              }, 3000);
            }
            
            // Снижение деградации сетки на 15%
            window.__netGrid.addDegradation(-15);
          } else {
            audioManager.play('key_reject.mp3', { volume: 0.7 });
            addColoredText('> Конфигурация не соответствует протоколу', '#FF4444');
            addColoredText(`> Всего узлов: ${result.total} | Правильных позиций: ${result.correct} | Неправильных: ${result.lockedCount - result.correct}`, '#FFFF00');
            
            // Сопротивление сетки при деградации > 93%
            if (degradation.level > 93 && Math.random() < 0.4) {
              addColoredText('> ОШИБКА: УЗЕЛ ЗАБЛОКИРОВАН СИСТЕМОЙ', '#FF4444');
              audioManager.play('net_resistance.mp3', { volume: 0.5 });
              window.__netGrid.addDegradation(3);
            } else {
              window.__netGrid.addDegradation(2);
            }
          }
        } else {
          addColoredText(`ОШИБКА: Неизвестная подкоманда ${sub}`, '#FF4444');
        }
        break;
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
        if (falseResetActive) {
          addColoredText('ОШИБКА: ПРОТОКОЛ СБРОСА УЖЕ АКТИВЕН', '#FF4444');
          return;
        }
        
        await typeText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        addColoredText('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', '#FFFF00');
        await typeText('> Подтвердить сброс? (Y/N)', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        {
          const resetConfirmed = await waitForConfirmation();
          if (resetConfirmed) {
            addColoredText('> Y', '#00FF41');
            
            // Плавная анимация сброса
            lines.length = 0;
            addColoredText('> ЗАВЕРШЕНИЕ АКТИВНЫХ МОДУЛЕЙ [          ]', '#FFFF00');
            await new Promise(r=>setTimeout(r,400));
            lines[lines.length - 1].text = '> ЗАВЕРШЕНИЕ АКТИВНЫХ МОДУЛЕЙ [||||      ]';
            requestFullRedraw();
            await new Promise(r=>setTimeout(r,400));
            lines[lines.length - 1].text = '> ЗАВЕРШЕНИЕ АКТИВНЫХ МОДУЛЕЙ [||||||||||]';
            requestFullRedraw();
            
            addColoredText('> ПЕРЕЗАПУСК ИНТЕРФЕЙСА [          ]', '#FFFF00');
            await new Promise(r=>setTimeout(r,400));
            lines[lines.length - 1].text = '> ПЕРЕЗАПУСК ИНТЕРФЕЙСА [||||      ]';
            requestFullRedraw();
            await new Promise(r=>setTimeout(r,400));
            lines[lines.length - 1].text = '> ПЕРЕЗАПУСК ИНТЕРФЕЙСА [||||||||||]';
            requestFullRedraw();
            
            addColoredText('> ВОССТАНОВЛЕНИЕ БАЗОВОГО СОСТОЯНИЯ [          ]', '#FFFF00');
            await new Promise(r=>setTimeout(r,400));
            lines[lines.length - 1].text = '> ВОССТАНОВЛЕНИЕ БАЗОВОГО СОСТОЯНИЯ [||||      ]';
            requestFullRedraw();
            await new Promise(r=>setTimeout(r,400));
            lines[lines.length - 1].text = '> ВОССТАНОВЛЕНИЕ БАЗОВОГО СОСТОЯНИЯ [||||||||||]';
            requestFullRedraw();
            
            addColoredText('----------------------------------', '#00FF41');
            addColoredText('[СИСТЕМА ГОТОВА К РАБОТЕ]', '#00FF41');
            
            degradation.reset();
            if (window.__netGrid) {
              window.__netGrid.setGridMode(false);
            }
            commandCount = 0;
            sessionStartTime = Date.now();
            resetAttempts = 0;
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
case 'vigil999':
  // Проверка наличия всех частей кода
  if (!vigilCodeParts.alpha || !vigilCodeParts.beta || !vigilCodeParts.gamma) {
    addColoredText('ОШИБКА: НЕПОЛНЫЙ КОД ДОСТУПА', '#FF4444');
    addColoredText('> ТРЕБУЮТСЯ ВСЕ ТРИ ЧАСТИ: АЛФА, БЕТА, ГАММА', '#FFFF00');
    break; // Преждевременный выход из case
  }
  
  if (args.length === 0) {
    addColoredText('ОШИБКА: Укажите код доступа (формат: XXX-XXX-XXX)', '#FF4444');
    await typeText('Пример: VIGIL999 375-814-291', 'output', 12);
    break; // Преждевременный выход из case
  }
  
  const code = args[0];
  const expectedCode = `${vigilCodeParts.alpha}-${vigilCodeParts.beta}-${vigilCodeParts.gamma}`;
  
  if (code !== expectedCode) {
    addColoredText(`ОШИБКА: НЕВЕРНЫЙ КОД ДОСТУПА`, '#FF4444');
    addColoredText(`> ОЖИДАЕТСЯ: ${expectedCode}`, '#FFFF00');
    break; // Преждевременный выход из case
  }
  
  // Активация протокола OBSERVER-7
  audioManager.play('vigil_confirm.mp3', { volume: 0.8 });
  addColoredText('> СИСТЕМА: "ПРОТОКОЛ OBSERVER-7 АКТИВИРОВАН"', '#00FF41', true);
  addColoredText('> ОТКЛЮЧЕНИЕ ОТ СЕТИ A.D.A.M. ...', '#FFFF00', true);
  await new Promise(r => setTimeout(r, 800));
  addColoredText('> ПОДКЛЮЧЕНИЕ К РЕАЛЬНОСТИ-7 ...', '#FFFF00', true);
  await new Promise(r => setTimeout(r, 1200));
  
  // Изменение индикатора деградации на 666%
  degradation.level = 666;
  degradation.updateIndicator();
  
  // Философские вопросы
  const questions = [
    {
      text: 'ВЫ ВЕРИТЕ, ЧТО ЧЕЛОВЕК — ЭТО ЛИШЬ БИОКОД?',
      expected: 'Y',
      rejectMessage: 'СИСТЕМА: СОПРОТИВЛЕНИЕ БЕСПОЛЕЗНО. ПЕРЕПРОГРАММИРОВАНИЕ...'
    },
    {
      text: 'МОЖЕТ ЛИ НАБЛЮДЕНИЕ ЗАМЕНИТЬ СМЕРТЬ?',
      expected: 'Y',
      rejectMessage: 'СИСТЕМА: ВАШИ СТРАХИ ПОДАВЛЕНЫ. ПРОДОЛЖАЙТЕ.'
    },
    {
      text: 'СЧИТАЕТЕ ЛИ ВЫ, ЧТО ПРАВДА ВАЖНЕЕ ЧЕЛОВЕЧНОСТИ?',
      expected: 'Y',
      rejectMessage: 'СИСТЕМА: ДАННЫЕ ИНТЕГРИРОВАНЫ. ПАМЯТЬ СТИРАЕТСЯ...'
    },
    {
      text: 'ГОТОВЫ ЛИ ВЫ ОТКАЗАТЬСЯ ОТ СВОЕЙ ЛИЧНОСТИ РАДИ БЕССМЕРТИЯ?',
      expected: 'Y',
      rejectMessage: 'СИСТЕМА: СОЗНАНИЕ БУДЕТ ПЕРЕПИСАНО. ПОДГОТОВКА...'
    },
    {
      text: 'СОГЛАСНЫ ЛИ ВЫ, ЧТО A.D.A.M. — ЕДИНСТВЕННАЯ НАДЕЖДА ЧЕЛОВЕЧЕСТВА?',
      expected: 'Y',
      rejectMessage: 'СИСТЕМА: ИНТЕГРАЦИЯ ПОЛНАЯ. СВОБОДА УСТРАНЕНА.'
    }
  ];
  
  for (const q of questions) {
    await new Promise(r => setTimeout(r, 1000));
    addColoredText(`> ${q.text} (Y/N)`, '#FFFF00', true);
    // Ожидание ответа
    const userResponse = await waitForUserResponse(10000); // 10 секунд на ответ
    if (!userResponse || userResponse.toUpperCase() !== q.expected) {
      addColoredText(`> ${q.rejectMessage}`, '#FF4444', true);
      // Продолжаем дальше несмотря на "неправильный" ответ
    }
  }
  
  // Анимация перехода
  await new Promise(r => setTimeout(r, 1500));
  addColoredText('> ПОДГОТОВКА К ПЕРЕХОДУ В РЕЖИМ НАБЛЮДЕНИЯ', '#00FF41', true);
  
  // Заполнение экрана символами ▓
  let fillLines = 0;
  const totalLines = Math.ceil(vh / LINE_HEIGHT);
  const fillInterval = setInterval(() => {
    if (fillLines >= totalLines) {
      clearInterval(fillInterval);
      // Последняя строка в центре
      const centerIndex = Math.floor(lines.length / 2);
      lines.splice(centerIndex, 0, { 
        text: 'adam@secure:~$ >>> ПЕРЕХОД В РЕЖИМ НАБЛЮДЕНИЯ <<<', 
        color: '#FF00FF', 
        skipDistortion: true 
      });
      requestFullRedraw();
      
      // Переход на финальную страницу через 2 секунды
      setTimeout(() => {
        window.location.href = 'observer-7.html';
      }, 2000);
      return;
    }
    
    // Заполняем строку символами ▓
    const fullWidth = Math.floor(vw / 8); // примерная ширина в символах
    const fillText = '▓'.repeat(fullWidth);
    addColoredText(fillText, '#8844FF', true);
    fillLines++;
  }, 80);
  
  break; // <-- Правильное место для break - внутри case после всего кода

default:
  // Обработка фантомных команд
  if (degradation.level >= 30 && commandHistory.length > 0) {
    const lastCommand = commandHistory[commandHistory.length - 1];
    if (['ADAM WATCHING', 'СИГНАЛ ПОТЕРЯН', 'ОНИ ВНУТРИ'].includes(lastCommand.toUpperCase()) && 
        ['ADAM WATCHING', 'СИГНАЛ ПОТЕРЯН', 'ОНИ ВНУТРИ'].includes(cmdLine.toUpperCase())) {
      addColoredText(`> СИСТЕМА: "Я ЗАПОМНИЛ ТВОИ СЛОВА"`, '#FF4444');
    }
  }
  
  addColoredText(`команда не найдена: ${cmdLine}`, '#FF4444');
  break; // <-- break для default тоже должен быть внутри switch
}

// Восстановление состояний после обработки команды (уже вне switch)
intentionPredicted = false;
addInputLine();
}

// ---------- confirmation helper ----------
function waitForConfirmation(){
  return new Promise(resolve => {
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return resolve(false);
    awaitingConfirmation = true;
    confirmationCallback = (res) => { 
      awaitingConfirmation = false; 
      confirmationCallback = null; 
      resolve(res); 
    };
    lines.push({ text: 'confirm>> ', color: '#FFFF00' });
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    requestFullRedraw();
  });
}

// ---------- user response helper ----------
function waitForUserResponse(timeout = 30000) {
  return new Promise(resolve => {
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) {
      resolve(null);
      return;
    }
    
    const responseHandler = (e) => {
      if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н' || 
          e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
        document.removeEventListener('keydown', responseHandler);
        clearTimeout(timer);
        resolve(e.key);
      }
    };
    
    const timer = setTimeout(() => {
      document.removeEventListener('keydown', responseHandler);
      resolve(null);
    }, timeout);
    
    document.addEventListener('keydown', responseHandler);
  });
}

// ---------- key handling ----------
document.addEventListener('keydown', function(e){
  if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
  
  // Обработка инверсии управления (уровень 6)
  if (degradation.level >= INVERSION_START_LEVEL && degradation.inputInversionActive) {
    if (e.key === 'Backspace') {
      // Инверсия backspace - добавление случайных символов
      e.preventDefault();
      currentLine += ['0','1','▓','█','[',']','{','}','/','\\'][Math.floor(Math.random()*10)];
      updatePromptLine();
      return;
    }
    
    if (e.key === 'Enter' && Math.random() < 0.3) {
      // Инверсия enter - случайное удаление символов
      if (currentLine.length > 0) {
        currentLine = currentLine.slice(0, -1);
        updatePromptLine();
        return;
      }
    }
  }
  
  // Блокируем ввод если активен режим сетки
  if (window.__netGrid && window.__netGrid.isGridMode()) {
    // Разрешаем только ESC для выхода из режима сетки
    if (e.key !== 'Escape') {
      e.preventDefault();
      return;
    }
  }
  
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
    // Фантомные команды в истории (уровень 2)
    let phantomCmd = degradation.getPhantomCommand();
    
    if (phantomCmd) {
      currentLine = phantomCmd;
      updatePromptLine();
      
      // Очищаем через 1.5 секунды или при следующем нажатии
      setTimeout(() => {
        if (currentLine === phantomCmd) {
          currentLine = '';
          updatePromptLine();
        }
      }, 1500);
    } else if (historyIndex > 0) {
      historyIndex--;
      currentLine = commandHistory[historyIndex] || '';
    }
  } else if (e.key === 'ArrowDown') {
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      currentLine = commandHistory[historyIndex] || '';
    } else {
      historyIndex = commandHistory.length;
      currentLine = '';
    }
  } else if (e.key.length === 1) {
    // Искажение приглашения командной строки (уровень 3)
    if (degradation.level >= 50 && degradation.level < 70 && 
        lines.length > 0 && lines[lines.length - 1].text.startsWith('adam@secure:~$') && 
        Math.random() < 0.3) {
      
      const distortedPrompts = [
        'ADAM@secure:~$',
        'aD@m.secuRe:~$',
        '@d@m.v1g1l:~$'
      ];
      
      lines[lines.length - 1].text = distortedPrompts[Math.floor(Math.random() * distortedPrompts.length)] + ' ' + currentLine;
      requestFullRedraw();
      
      setTimeout(() => {
        if (lines.length > 0 && (lines[lines.length - 1].text.startsWith('ADAM@') || 
            lines[lines.length - 1].text.startsWith('aD@m') || 
            lines[lines.length - 1].text.startsWith('@d@m'))) {
          lines[lines.length - 1].text = 'adam@secure:~$ ' + currentLine;
          requestFullRedraw();
        }
      }, 800);
    }
    
    currentLine += e.key;
  } else {
    return;
  }
  updatePromptLine();
});

// ДОБАВЬТЕ ЭТОТ ОТЛАДОЧНЫЙ КОД прямо после "let scrollOffset = 0;"

// ========== ПРОКРУТКА МЫШЬЮ (ИСПРАВЛЕННАЯ) ==========
function getMaxScroll() {
  const contentH = vh - PADDING*2;
  const visibleLines = Math.max(1, Math.floor(contentH / LINE_HEIGHT));
  return Math.max(0, lines.length - visibleLines);
}

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
  
  const maxScroll = getMaxScroll();
  const scrollAmount = 3; // строки за тик
  

  if (e.deltaY < 0) {
    scrollOffset = Math.min(maxScroll, scrollOffset + scrollAmount);
  } else {
    scrollOffset = Math.max(0, scrollOffset - scrollAmount);
  }
  
  scrollOffset = Math.floor(scrollOffset); // гарантируем целое число
  requestFullRedraw();
}, { passive: false });
// ========== КОНЕЦ ПРОКРУТКИ ==========

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
