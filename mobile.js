/**
 * mobile.js - ЧИСТО МОБИЛЬНАЯ ВЕРСИЯ ТЕРМИНАЛА A.D.A.M.
 * 
 * ПРИНЦИП РАБОТЫ:
 * 1. Загружается ПОСЛЕ terminal_canvas.js
 * 2. ПОЛНОСТЬЮ перехватывает управление вводом (заменяет клавиатуру)
 * 3. Использует ТОЛЬКО API терминала (__TerminalCanvas)
 * 4. Не создает параллельных состояний
 * 5. Работает как event-driven адаптер
 */

(() => {
  'use strict';
  
  // ==================== CONFIGURATION ====================
  const UI_CONFIG = {
    inputBarHeight: 70, // px (адаптивная)
    quickBarHeight: 50, // px
    buttonSize: 52,     // px (адаптивная)
    gridModalHeight: 65, // vh
    historyTipDuration: 800, // ms
    scrollSensitivity: 3, // строки
    debounceDelay: 150, // ms для resize
    zIndex: 2147483646
  };
  
  // ==================== MOBILE STATE MANAGER ====================
  const MobileState = {
    // Все состояния хранятся в терминале, здесь только кэши для UI
    cmdHistory: [],
    historyIndex: 0,
    currentLine: '',
    isReady: false,
    isLiteMode: true,
    lastCommandTime: 0,
    
    // Кэш для быстрого доступа
    terminalAPI: null,
    audioAPI: null,
    netGridAPI: null,
    
    init() {
      // Ждём полной загрузки терминала
      const waitForTerminal = setInterval(() => {
        if (window.__TerminalCanvas && window.audioManager && window.__netGrid) {
          this.terminalAPI = window.__TerminalCanvas;
          this.audioAPI = window.audioManager;
          this.netGridAPI = window.__netGrid;
          this.isReady = true;
          clearInterval(waitForTerminal);
          console.log('[mobile] State initialized');
        }
      }, 50);
    }
  };
  
  // ==================== DOM BUILDER (UI) ====================
  const DOMBuilder = {
    create(tag, props = {}, styles = {}) {
      const el = document.createElement(tag);
      Object.assign(el, props);
      Object.assign(el.style, styles);
      return el;
    },
    
    buildUI() {
      // 1. Виртуальная клавиатура
      this._buildInputBar();
      
      // 2. Быстрые команды
      this._buildQuickBar();
      
      // 3. Модальное окно сетки
      this._buildGridModal();
      
      // 4. Подсказка истории
      this._buildHistoryTip();
      
      console.log('[mobile] UI built');
    },
    
    _buildInputBar() {
      const bar = this.create('div', {
        id: 'mobile_input_bar',
        role: 'region',
        'aria-label': 'Mobile terminal input'
      }, {
        position: 'fixed',
        left: '0',
        right: '0',
        bottom: '0',
        height: `${UI_CONFIG.inputBarHeight}px`,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        borderTop: '2px solid #00FF41',
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        gap: '8px',
        zIndex: UI_CONFIG.zIndex,
        transform: 'translateY(0)',
        transition: 'transform 0.3s ease'
      });
      
      // Поле ввода (только для мобильной клавиатуры)
      const input = this.create('input', {
        id: 'mobile_input_field',
        type: 'text',
        placeholder: 'Команда (help)',
        autocapitalize: 'none',
        spellcheck: false,
        autocomplete: 'off'
      }, {
        flex: '1',
        height: '100%',
        background: 'rgba(0, 20, 10, 0.7)',
        color: '#00FF41',
        border: '1px solid rgba(0, 255, 65, 0.4)',
        borderRadius: '8px',
        padding: '10px 12px',
        fontSize: '16px', // Предотвращает zoom на iOS
        fontFamily: 'monospace'
      });
      
      // Кнопка Enter
      const enterBtn = this.create('button', {
        innerText: '⏎',
        title: 'Execute'
      }, {
        width: `${UI_CONFIG.buttonSize}px`,
        height: `${UI_CONFIG.buttonSize}px`,
        background: 'rgba(0, 255, 65, 0.15)',
        color: '#00FF41',
        border: '1px solid #00FF41',
        borderRadius: '8px',
        fontSize: '24px',
        fontFamily: 'monospace'
      });
      
      bar.append(input, enterBtn);
      document.body.appendChild(bar);
      
      // Клик по Enter = отправка команды
      enterBtn.onclick = () => InputManager.submitCommand();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          InputManager.submitCommand();
        }
      });
      
      // Показ/скрытие при открытии клавиатуры
      if (window.visualViewport) {
        let lastHeight = window.visualViewport.height;
        window.visualViewport.addEventListener('resize', () => {
          const currentHeight = window.visualViewport.height;
          if (currentHeight < lastHeight * 0.85) {
            // Клавиатура открылась
            bar.style.transform = `translateY(-${lastHeight - currentHeight}px)`;
          } else {
            // Клавиатура закрылась
            bar.style.transform = 'translateY(0)';
          }
          lastHeight = currentHeight;
          ViewportManager.adjustTerminal();
        });
      }
    },
    
    _buildQuickBar() {
      const quick = this.create('div', { id: 'mobile_quick_bar' }, {
        position: 'fixed',
        left: '8px',
        right: '8px',
        bottom: `${UI_CONFIG.inputBarHeight + 8}px`,
        height: `${UI_CONFIG.quickBarHeight}px`,
        display: 'flex',
        gap: '6px',
        padding: '6px',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        borderRadius: '8px',
        zIndex: UI_CONFIG.zIndex - 1,
        overflowX: 'auto'
      });
      
      const commands = ['help', 'syst', 'net_mode', 'clear', 'reset'];
      commands.forEach(cmd => {
        const btn = this.create('button', {
          innerText: cmd,
          title: `Quick: ${cmd}`
        }, {
          minWidth: '60px',
          height: '100%',
          background: 'rgba(0, 20, 10, 0.6)',
          color: '#00FF41',
          border: '1px solid rgba(0, 255, 65, 0.3)',
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          padding: '0 8px'
        });
        
        btn.onclick = () => {
          InputManager.setCommand(cmd);
          this.showHistoryTip();
        };
        quick.appendChild(btn);
      });
      
      document.body.appendChild(quick);
    },
    
    _buildGridModal() {
      const modal = this.create('div', { id: 'mobile_grid_modal' }, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: UI_CONFIG.zIndex - 2
      });
      
      const panel = this.create('div', { id: 'mobile_grid_panel' }, {
        width: '95%',
        maxWidth: '600px',
        height: `${UI_CONFIG.gridModalHeight}vh`,
        background: 'rgba(0, 10, 6, 0.95)',
        border: '2px solid #00FF41',
        borderRadius: '10px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      });
      
      const header = this.create('div', { innerText: 'NET GRID CONTROL' }, {
        padding: '12px',
        fontSize: '14px',
        textAlign: 'center',
        borderBottom: '1px solid #00FF41',
        background: 'rgba(0, 20, 10, 0.5)'
      });
      
      const map = this.create('div', { id: 'mobile_grid_map' }, {
        flex: '1',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      });
      
      const controls = this.create('div', {}, {
        padding: '12px',
        display: 'flex',
        gap: '8px',
        justifyContent: 'center',
        borderTop: '1px solid #00FF41'
      });
      
      const closeBtn = this.create('button', { innerText: 'CLOSE' }, {
        padding: '10px 20px',
        background: 'rgba(0, 20, 10, 0.7)',
        color: '#00FF41',
        border: '1px solid #00FF41',
        borderRadius: '6px',
        fontSize: '12px'
      });
      
      closeBtn.onclick = () => GridManager.close();
      controls.appendChild(closeBtn);
      panel.append(header, map, controls);
      modal.appendChild(panel);
      document.body.appendChild(modal);
    },
    
    _buildHistoryTip() {
      const tip = this.create('div', { id: 'mobile_history_tip' }, {
        position: 'fixed',
        top: '8px',
        left: '8px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: '#00FF41',
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        zIndex: UI_CONFIG.zIndex,
        display: 'none',
        border: '1px solid #00FF41'
      });
      document.body.appendChild(tip);
    },
    
    showHistoryTip() {
      const tip = document.getElementById('mobile_history_tip');
      tip.textContent = '↑↓ - История | ESC - Очистить';
      tip.style.display = 'block';
      setTimeout(() => tip.style.display = 'none', UI_CONFIG.historyTipDuration);
    }
  };
  
  // ==================== INPUT MANAGER ====================
  const InputManager = {
    submitCommand() {
      if (!MobileState.isReady) return;
      if (MobileState.terminalAPI.isBlocked?.()) return; // Проверка через API
      
      const input = document.getElementById('mobile_input_field');
      const cmd = String(input.value || MobileState.currentLine).trim();
      
      if (!cmd) return;
      
      // Сохраняем в историю
      MobileState.cmdHistory.push(cmd);
      MobileState.historyIndex = MobileState.cmdHistory.length;
      if (MobileState.cmdHistory.length > 50) {
        MobileState.cmdHistory.shift();
      }
      localStorage.setItem('mobile_cmdHistory', JSON.stringify(MobileState.cmdHistory));
      
      // Воспроизводим звук
      MobileState.audioAPI.playKeyPress('enter');
      
      // ОТПРАВЛЯЕМ В ТЕРМИНАЛ ЧЕРЕЗ API
      MobileState.terminalAPI.processCommand(cmd);
      
      // Очищаем поле
      input.value = '';
      MobileState.currentLine = '';
      DOMBuilder.showHistoryTip();
    },
    
    setCommand(cmd) {
      document.getElementById('mobile_input_field').value = cmd;
      MobileState.currentLine = cmd;
    },
    
    // Навигация по истории
    navigateHistory(direction) {
      if (!MobileState.cmdHistory.length) return;
      
      if (direction === 'up') {
        MobileState.historyIndex = Math.max(0, MobileState.historyIndex - 1);
      } else {
        MobileState.historyIndex = Math.min(
          MobileState.cmdHistory.length, 
          MobileState.historyIndex + 1
        );
      }
      
      const cmd = MobileState.cmdHistory[MobileState.historyIndex] || '';
      this.setCommand(cmd);
    }
  };
  
  // ==================== GRID MANAGER ====================
  const GridManager = {
    isOpen: false,
    originalCanvas: null,
    
    open() {
      if (!MobileState.netGridAPI) return;
      
      this.isOpen = true;
      
      // Прячем деградацию индикатор
      try {
        MobileState.terminalAPI.degradation?.indicator?.style?.display = 'none';
      } catch(e) {}
      
      // Показываем модальное окно
      const modal = document.getElementById('mobile_grid_modal');
      modal.style.display = 'flex';
      
      // Находим canvas сетки
      const canvas = document.getElementById('netCanvas') || 
                    document.querySelector('canvas:not(#terminalCanvas)');
      if (!canvas) {
        console.warn('[mobile] Canvas сетки не найден');
        return;
      }
      
      this.originalCanvas = canvas;
      
      // Перемещаем canvas в модальное окно
      const map = document.getElementById('mobile_grid_map');
      map.innerHTML = '';
      canvas.style.position = 'relative';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'auto';
      map.appendChild(canvas);
      
      // Включаем режим сетки
      MobileState.netGridAPI.setGridMode(true);
      
      // Адаптируем размеры
      ViewportManager.adjustTerminal();
    },
    
    close() {
      if (!this.isOpen) return;
      
      this.isOpen = false;
      
      // Возвращаем canvas обратно
      if (this.originalCanvas && this.originalCanvas.parentNode) {
        this.originalCanvas.style.position = '';
        this.originalCanvas.style.width = '';
        this.originalCanvas.style.height = '';
        document.body.appendChild(this.originalCanvas);
      }
      
      // Прячем модальное окно
      document.getElementById('mobile_grid_modal').style.display = 'none';
      
      // Выключаем режим сетки
      MobileState.netGridAPI.setGridMode(false);
      
      // Восстанавливаем деградацию индикатор
      try {
        MobileState.terminalAPI.degradation?.indicator?.style?.display = '';
      } catch(e) {}
      
      ViewportManager.adjustTerminal();
    },
    
    toggle() {
      this.isOpen ? this.close() : this.open();
    }
  };
  
  // ==================== VIEWPORT MANAGER ====================
  const ViewportManager = {
    resizeTimeout: null,
    
    init() {
      this.adjustTerminal();
      
      // Debounced resize handler
      const handler = () => this.scheduleAdjust();
      window.visualViewport?.addEventListener('resize', handler);
      window.addEventListener('orientationchange', () => {
        setTimeout(() => this.adjustTerminal(), 300);
      });
    },
    
    scheduleAdjust() {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.adjustTerminal(), UI_CONFIG.debounceDelay);
    },
    
    adjustTerminal() {
      if (!MobileState.isReady) return;
      
      const vh = window.visualViewport?.height || window.innerHeight;
      const vw = window.innerWidth;
      
      // Резервируем место под UI
      const reservedHeight = UI_CONFIG.inputBarHeight + UI_CONFIG.quickBarHeight + 20;
      const availableHeight = Math.max(200, vh - reservedHeight);
      
      // Вызываем resize через API терминала
      MobileState.terminalAPI.onResize?.(vw, availableHeight);
      
      // Скролл к низу
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  };
  
  // ==================== MOBILE-SAFE AUDIO ====================
  const AudioManager = {
    unlocked: false,
    
    unlock() {
      if (this.unlocked) return;
      
      const unlock = () => {
        if (MobileState.audioAPI?.audioContext?.state === 'suspended') {
          MobileState.audioAPI.audioContext.resume();
        }
        this.unlocked = true;
        document.removeEventListener('touchstart', unlock, { once: true });
        document.removeEventListener('click', unlock, { once: true });
      };
      
      document.addEventListener('touchstart', unlock, { once: true });
      document.addEventListener('click', unlock, { once: true });
    }
  };
  
  // ==================== EVENT BRIDGE ====================
  const EventBridge = {
    subscriptions: new Map(),
    
    subscribe(event, callback) {
      if (!this.subscriptions.has(event)) {
        this.subscriptions.set(event, []);
      }
      this.subscriptions.get(event).push(callback);
    },
    
    emit(event, data) {
      this.subscriptions.get(event)?.forEach(cb => cb(data));
    },
    
    init() {
      // Подписываемся на события терминала (если они есть)
      // И эмитируем свои события
      
      // Пример: когда терминал печатает строку
      const originalPushLine = MobileState.terminalAPI.addOutput || 
                              MobileState.terminalAPI.pushLine;
      if (originalPushLine) {
        MobileState.terminalAPI.addOutput = (...args) => {
          this.emit('lineAdded', args);
          return originalPushLine.apply(MobileState.terminalAPI, args);
        };
      }
    }
  };
  
  // ==================== GLOBAL KEYBOARD EMULATION ====================
  // Это критически важно! Мы превращаем мобильный ввод в keyboard events
  const KeyboardEmulator = {
    dispatchKey(key, type = 'keydown') {
      const event = new KeyboardEvent(type, {
        key: key,
        code: `Key${key.toUpperCase()}`,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      document.dispatchEvent(event);
    },
    
    dispatchEnter() {
      this.dispatchKey('Enter');
    },
    
    dispatchBackspace() {
      this.dispatchKey('Backspace');
    }
  };
  
  // ==================== INITIALIZATION ====================
  function init() {
    // 1. Инициализируем состояние
    MobileState.init();
    
    // 2. Строим UI
    DOMBuilder.buildUI();
    
    // 3. Ждём готовности терминала
    const waitForReady = setInterval(() => {
      if (MobileState.isReady) {
        clearInterval(waitForReady);
        
        // 4. Инициализируем модули
        ViewportManager.init();
        AudioManager.unlock();
        EventBridge.init();
        
        // 5. Перехватываем ввод
        overrideTerminalInput();
        
        // 6. Скрываем оригинальную строку ввода (терминал её рисует сам)
        // Но мы её перерисуем через API
        MobileState.terminalAPI.addOutput?.('', 'output');
        
        console.log('[mobile] Fully initialized');
      }
    }, 50);
  }
  
  // ==================== OVERRIDE TERMINAL INPUT ====================
  function overrideTerminalInput() {
    // Это самое важное: мы НЕ даём терминалу создавать свою строку ввода
    // Вместо этого создаём свою и отправляем команды через API
    
    // Удаляем существующую строку ввода (если есть)
    const lines = MobileState.terminalAPI.lines || [];
    if (lines.length && lines[lines.length - 1]?._isInputLine) {
      lines.pop();
    }
    
    // Создаём нашу строку ввода
    MobileState.terminalAPI.addOutput?.('adam@secure:~$ ', 'input');
  }
  
  // ==================== PUBLIC API ====================
  window.__MobileUI = {
    submitCommand: (cmd) => InputManager.submitCommand(cmd),
    toggleGrid: () => GridManager.toggle(),
    setLiteMode: (enabled) => {
      UI_CONFIG.isLiteMode = enabled;
      // Применяем к терминалу через API
      if (enabled && MobileState.terminalAPI.degradation?.level > 60) {
        MobileState.terminalAPI.degradation.setDegradationLevel(60);
      }
    }
  };
  
  // ==================== AUTO-START ====================
  // Запускаемся сразу
  init();
  
})();
