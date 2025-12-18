/**
 * MOBILE TERMINAL A.D.A.M. v2.3 — ПОЛНАЯ ВЕРСИЯ
 * ДЛЯ МОБИЛЬНЫХ УСТРОЙСТВ
 */

(() => {
  'use strict';

  const CONFIG = {
    WAIT_FOR_TERMINAL: 5000,
    BUTTON_SIZE: 44,
  };

  console.log('[Mobile] START: Начинаем инициализацию...');

  // Проверяем, мобильное ли устройство
  const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                    window.innerWidth <= 768;
  
  // Если это ПК - выходим
  if (!IS_MOBILE) {
    console.log('[Mobile] ПК устройство, мобильный скрипт не нужен');
    return;
  }

  console.log('[Mobile] Мобильное устройство обнаружено');

  class MobileTerminal {
    constructor() {
      this.state = {
        isInitialized: false,
        apiReady: false,
        commands: [],
        dossierIds: [],
        isDragging: false,
        startX: 0,
        startY: 0,
        translateX: 0,
        translateY: 0,
        scale: 1
      };
      
      this.elements = {};
      this.api = {};
      
      console.log('[Mobile] Constructor: Объект создан');
    }

    async start() {
      console.log('[Mobile] start() вызван');
      this.cacheElements();
      
      // Сначала инициализируем панорамирование
      this.initPanZoom();
      
      await this.waitForApi();
      await this.loadData();
      this.generateUI();
      this.hideNetGridInitially();
      
      // Добавляем навигационные кнопки для масштабирования
      this.addNavigationButtons();

      this.state.isInitialized = true;
      console.log('[Mobile] ✅ Инициализация завершена!');
    }

    // ==================== ПАНОРАМИРОВАНИЕ И ZOOM ====================
    initPanZoom() {
      console.log('[Mobile] Инициализация панорамирования...');
      
      // Создаем контейнер для трансформаций
      const terminal = document.getElementById('terminal');
      if (!terminal) {
        console.error('[Mobile] Нет элемента #terminal');
        return;
      }
      
      // Создаем wrapper для панорамирования
      const wrapper = document.createElement('div');
      wrapper.id = 'terminal-wrapper';
      wrapper.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 200vw;
        height: 200vh;
        transform-origin: 0 0;
        transform: translate(0, 0) scale(0.8);
        will-change: transform;
        transition: transform 0.1s ease-out;
      `;
      
      // Перемещаем terminal внутрь wrapper
      if (terminal.parentNode) {
        terminal.parentNode.insertBefore(wrapper, terminal);
        wrapper.appendChild(terminal);
      }
      
      // Добавляем стили для wrapper
      const style = document.createElement('style');
      style.textContent = `
        #terminal-wrapper {
          touch-action: none;
          user-select: none;
        }
        .grabbing {
          cursor: grabbing !important;
        }
        .nav-btn {
          width: 44px;
          height: 44px;
          background: rgba(0, 0, 0, 0.8);
          color: #00FF41;
          border: 1px solid rgba(0, 255, 65, 0.3);
          border-radius: 50%;
          font-family: 'Press Start 2P';
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100001;
        }
        .nav-btn:active {
          background: rgba(0, 255, 65, 0.2);
        }
      `;
      document.head.appendChild(style);
      
      this.elements.wrapper = wrapper;
      
      // Устанавливаем начальный масштаб и позицию
      this.state.scale = 0.8;
      this.state.translateX = (window.innerWidth - (window.innerWidth * 2 * this.state.scale)) / 2;
      this.state.translateY = (window.innerHeight - (window.innerHeight * 2 * this.state.scale)) / 2;
      this.updateTransform();
      
      // Биндим события
      this.bindPanEvents();
    }

    bindPanEvents() {
      if (!this.elements.wrapper) return;

      const wrapper = this.elements.wrapper;

      // Touch события
      wrapper.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
      wrapper.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
      wrapper.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });

      // Для десктопа (на случай эмуляции)
      wrapper.addEventListener('mousedown', this.handleMouseDown.bind(this));
      wrapper.addEventListener('mousemove', this.handleMouseMove.bind(this));
      wrapper.addEventListener('mouseup', this.handleMouseUp.bind(this));
      wrapper.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    handleTouchStart(e) {
      if (e.touches.length === 1) {
        this.state.isDragging = true;
        const touch = e.touches[0];
        this.state.startX = touch.clientX - this.state.translateX;
        this.state.startY = touch.clientY - this.state.translateY;
        this.elements.wrapper.style.transition = 'none';
        document.body.classList.add('grabbing');
      }
      e.preventDefault();
    }

    handleTouchMove(e) {
      if (!this.state.isDragging || e.touches.length !== 1) return;
      
      const touch = e.touches[0];
      this.state.translateX = touch.clientX - this.state.startX;
      this.state.translateY = touch.clientY - this.state.startY;
      
      this.updateTransform();
      e.preventDefault();
    }

    handleTouchEnd() {
      this.state.isDragging = false;
      this.elements.wrapper.style.transition = 'transform 0.1s ease-out';
      document.body.classList.remove('grabbing');
    }

    handleMouseDown(e) {
      if (e.button !== 0) return;
      
      this.state.isDragging = true;
      this.state.startX = e.clientX - this.state.translateX;
      this.state.startY = e.clientY - this.state.translateY;
      document.body.classList.add('grabbing');
      
      e.preventDefault();
    }

    handleMouseMove(e) {
      if (!this.state.isDragging) return;
      
      this.state.translateX = e.clientX - this.state.startX;
      this.state.translateY = e.clientY - this.state.startY;
      this.updateTransform();
      
      e.preventDefault();
    }

    handleMouseUp() {
      this.state.isDragging = false;
      document.body.classList.remove('grabbing');
    }

    handleWheel(e) {
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoomAt(zoomFactor, e.clientX, e.clientY);
      e.preventDefault();
    }

    zoomAt(zoomFactor, centerX, centerY) {
      const newScale = this.state.scale * zoomFactor;
      
      // Ограничиваем зум
      if (newScale < 0.3 || newScale > 2) return;
      
      // Вычисляем смещение для зума относительно центра
      const scaleChange = newScale / this.state.scale;
      this.state.translateX = centerX - (centerX - this.state.translateX) * scaleChange;
      this.state.translateY = centerY - (centerY - this.state.translateY) * scaleChange;
      
      this.state.scale = newScale;
      this.updateTransform();
    }

    updateTransform() {
      if (!this.elements.wrapper) return;
      
      this.elements.wrapper.style.transform = `
        translate(${this.state.translateX}px, ${this.state.translateY}px)
        scale(${this.state.scale})
      `;
    }

    addNavigationButtons() {
      const nav = document.createElement('div');
      nav.id = 'zoom-nav';
      nav.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        z-index: 100001;
        display: flex;
        flex-direction: column;
        gap: 8px;
        opacity: 0.7;
        transition: opacity 0.3s;
      `;
      
      nav.innerHTML = `
        <button class="nav-btn" data-action="zoom-in">+</button>
        <button class="nav-btn" data-action="zoom-out">-</button>
        <button class="nav-btn" data-action="center">⌂</button>
        <button class="nav-btn" data-action="reset">↺</button>
      `;
      
      document.body.appendChild(nav);
      
      // Обработчики кнопок
      nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.nav-btn');
        if (!btn) return;
        
        const action = btn.dataset.action;
        switch(action) {
          case 'zoom-in':
            this.zoomAt(1.2, window.innerWidth / 2, window.innerHeight / 2);
            break;
          case 'zoom-out':
            this.zoomAt(0.8, window.innerWidth / 2, window.innerHeight / 2);
            break;
          case 'center':
            this.centerContent();
            break;
          case 'reset':
            this.state.scale = 0.8;
            this.state.translateX = (window.innerWidth - (window.innerWidth * 2 * this.state.scale)) / 2;
            this.state.translateY = (window.innerHeight - (window.innerHeight * 2 * this.state.scale)) / 2;
            this.updateTransform();
            break;
        }
      });
      
      // Автоскрытие кнопок
      let hideTimer;
      nav.addEventListener('touchstart', () => clearTimeout(hideTimer));
      nav.addEventListener('touchend', () => {
        hideTimer = setTimeout(() => nav.style.opacity = '0.3', 2000);
      });
      
      // Показываем кнопки при первом касании
      document.addEventListener('touchstart', () => {
        nav.style.opacity = '0.7';
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => nav.style.opacity = '0.3', 3000);
      }, { once: true });
    }

    centerContent() {
      this.state.translateX = (window.innerWidth - (window.innerWidth * 2 * this.state.scale)) / 2;
      this.state.translateY = (window.innerHeight - (window.innerHeight * 2 * this.state.scale)) / 2;
      this.updateTransform();
    }

    // ==================== ОРИГИНАЛЬНЫЙ КОД ====================
    cacheElements() {
      console.log('[Mobile] cacheElements: Ищем DOM элементы...');
      
      const required = {
        sidePanel: 'sidePanel',
        panelContent: 'panelContent',
        panelHandle: 'panelHandle',
        gridModal: 'gridModal',
        mapContainer: 'mapContainer',
        keyboard: 'virtualKeyboard',
      };

      for (const [key, id] of Object.entries(required)) {
        this.elements[key] = document.getElementById(id);
        if (!this.elements[key]) {
          console.error(`[Mobile] ❌ Элемент #${id} не найден!`);
        } else {
          console.log(`[Mobile] ✅ Элемент #${id} найден`);
        }
      }
    }

    async waitForApi() {
      console.log('[Mobile] waitForApi: Ждём API...');
      
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 50;
        
        const check = setInterval(() => {
          attempts++;
          
          const hasTerminal = !!window.__TerminalCanvas;
          const hasNetGrid = !!window.__netGrid;
          
          console.log(`[Mobile] Проверка #${attempts}: terminal=${hasTerminal}, netGrid=${hasNetGrid}`);
          
          if (hasTerminal && hasNetGrid) {
            this.api.terminal = window.__TerminalCanvas;
            this.api.netGrid = window.__netGrid;
            this.api.audio = window.audioManager || { 
              playSystemSound: () => console.log('[Audio] Заглушка')
            };
            this.state.apiReady = true;
            clearInterval(check);
            console.log('[Mobile] ✅ API загружено!');
            resolve();
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(check);
            console.error('[Mobile] ❌ Таймаут ожидания API!');
            resolve();
          }
        }, 100);
      });
    }

    async loadData() {
      if (!this.state.apiReady) {
        console.warn('[Mobile] loadData: API не готово');
        return;
      }
      
      console.log('[Mobile] loadData: Загружаем данные...');
      
      // Загружаем команды
      const cmds = this.api.terminal.commandsList || 
                   this.api.terminal.commands || 
                   ['help', 'syst', 'syslog', 'subj', 'dscr', 'notes', 'net_mode', 'net_check', 'clear', 'reset', 'exit'];
      this.state.commands = cmds.map(String);
      console.log('[Mobile] ✅ Команды:', this.state.commands);

      // Загружаем досье
      const dossiers = this.api.terminal.dossiers || {};
      this.state.dossierIds = Object.keys(dossiers).map(String);
      console.log('[Mobile] ✅ Досье:', this.state.dossierIds);
    }

    generateUI() {
      console.log('[Mobile] generateUI: Создаём кнопки...');
      
      if (!this.elements.panelContent) {
        console.error('[Mobile] ❌ Нет panelContent!');
        return;
      }
      
      // Очищаем панель
      this.elements.panelContent.innerHTML = '';
      
      this.generateCommandButtons();
      this.bindUI();
      console.log('[Mobile] ✅ UI создан!');
    }

    generateCommandButtons() {
      console.log('[Mobile] generateCommandButtons: Генерируем кнопки...');
      
      // Базовые команды
      const baseCommands = [
        { cmd: 'help', label: 'help' },
        { cmd: 'syst', label: 'syst' },
        { cmd: 'syslog', label: 'syslog' },
        { cmd: 'subj', label: 'subj' },
        { cmd: 'notes', label: 'notes' },
        { cmd: 'net_mode', label: 'NET MODE' },
        { cmd: 'net_check', label: 'NET CHECK' },
        { cmd: 'clear', label: 'clear' },
        { cmd: 'reset', label: 'reset', danger: true },
        { cmd: 'exit', label: 'exit' },
      ];

      baseCommands.forEach(btn => {
        const button = this.createButton(btn.label, () => {
          this.executeCommand(btn.cmd);
        }, btn.danger);
        this.elements.panelContent.appendChild(button);
      });

      // DSCR с подменю
      if (this.state.dossierIds.length > 0) {
        const dscrBtn = this.createButton('dscr ▶', () => this.openDscrMenu());
        this.elements.panelContent.appendChild(dscrBtn);
      }

      // Grid
      const gridBtn = this.createButton('Grid', () => this.openGridModal());
      this.elements.panelContent.appendChild(gridBtn);

      // Заполнитель
      const spacer = document.createElement('div');
      spacer.className = 'spacer';
      this.elements.panelContent.appendChild(spacer);
    }

    createButton(label, onClick, isDanger = false) {
      const btn = document.createElement('button');
      btn.className = isDanger ? 'cmd danger' : 'cmd';
      btn.textContent = label;
      btn.style.minHeight = `${CONFIG.BUTTON_SIZE}px`;
      
      btn.addEventListener('touchstart', (e) => {
        e.stopPropagation(); // Чтобы не запускалось панорамирование
      }, { passive: true });
      
      btn.addEventListener('click', () => {
        console.log(`[Mobile] 🔘 Нажата: "${label}"`);
        this.playSound('click');
        onClick();
      });
      
      return btn;
    }

    bindUI() {
      // Сворачивание панели
      if (this.elements.panelHandle) {
        this.elements.panelHandle.addEventListener('click', () => {
          this.elements.sidePanel.classList.toggle('collapsed');
          console.log('[Mobile] Панель свёрнута');
        });
      }

      // Закрытие сетки
      const gridCloseBtn = document.getElementById('gridClose');
      if (gridCloseBtn) {
        gridCloseBtn.addEventListener('click', () => {
          this.closeGridModal();
        });
      }
      
      // Управление сеткой
      const gridControls = document.querySelectorAll('.ctrl');
      gridControls.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const action = e.target.dataset.action;
          this.handleGridControl(action);
        });
      });
    }

    openDscrMenu() {
      console.log('[Mobile] openDscrMenu');
      
      const oldMenu = document.getElementById('dscrSubMenu');
      if (oldMenu) oldMenu.remove();

      if (this.state.dossierIds.length === 0) {
        console.warn('[Mobile] Нет досье!');
        return;
      }

      const menu = document.createElement('div');
      menu.id = 'dscrSubMenu';
      menu.className = 'submenu';
      
      this.state.dossierIds.forEach(id => {
        const item = document.createElement('button');
        item.className = 'submenu-item';
        item.textContent = id.toLowerCase();
        item.addEventListener('click', () => {
          this.executeCommand(`dscr ${id}`);
          menu.remove();
        });
        menu.appendChild(item);
      });

      this.elements.sidePanel.appendChild(menu);
    }

    executeCommand(cmd) {
      if (!this.api.terminal?.processCommand) {
        console.error('[Mobile] ❌ Нет processCommand!');
        return;
      }
      console.log('[Mobile] Выполнение:', cmd);
      this.api.terminal.processCommand(cmd);
    }

    // ==================== СЕТКА ====================
    hideNetGridInitially() {
      const netCanvas = document.querySelector('canvas:not(#terminalCanvas)');
      if (netCanvas) {
        netCanvas.style.display = 'none';
        console.log('[Mobile] 🌐 Сетка скрыта');
      }
    }

    openGridModal() {
      if (!this.api.netGrid) {
        console.error('[Mobile] Нет доступа к сетке');
        return;
      }
      
      this.api.netGrid.setGridMode(true);
      this.elements.gridModal.classList.remove('hidden');
      
      const netCanvas = document.querySelector('canvas:not(#terminalCanvas)');
      if (netCanvas && this.elements.mapContainer) {
        netCanvas.style.display = 'block';
        this.elements.mapContainer.appendChild(netCanvas);
      }
      
      this.playSound('open');
      this.executeCommand('net_mode');
    }

    closeGridModal() {
      if (!this.api.netGrid) return;
      
      this.api.netGrid.setGridMode(false);
      this.elements.gridModal.classList.add('hidden');
      
      const netCanvas = document.querySelector('canvas:not(#terminalCanvas)');
      if (netCanvas) {
        netCanvas.style.display = 'none';
        document.body.appendChild(netCanvas);
      }
      
      this.playSound('close');
    }

    handleGridControl(action) {
      if (!this.api.netGrid) return;
      
      console.log('[Mobile] Grid control:', action);
      
      switch(action) {
        case 'up':
          this.api.netGrid.moveCursor('up');
          break;
        case 'down':
          this.api.netGrid.moveCursor('down');
          break;
        case 'left':
          this.api.netGrid.moveCursor('left');
          break;
        case 'right':
          this.api.netGrid.moveCursor('right');
          break;
        case 'lock':
          this.api.netGrid.toggleLock();
          break;
        case 'check':
          this.executeCommand('net_check');
          break;
        case 'reset':
          this.api.netGrid.reset();
          break;
        case 'exit':
          this.closeGridModal();
          break;
        case 'prev':
        case 'next':
          // Навигация по узлам
          const nodes = this.api.netGrid.getNodes ? this.api.netGrid.getNodes() : [];
          if (nodes.length > 0) {
            const currentIndex = nodes.findIndex(n => n.selected);
            let newIndex = action === 'prev' ? currentIndex - 1 : currentIndex + 1;
            if (newIndex < 0) newIndex = nodes.length - 1;
            if (newIndex >= nodes.length) newIndex = 0;
            
            if (this.api.netGrid.selectNode) {
              this.api.netGrid.selectNode(nodes[newIndex].id);
            }
          }
          break;
      }
    }

    // ==================== ЗВУК ====================
    playSound(type) {
      if (this.api.audio?.playSystemSound) {
        this.api.audio.playSystemSound(type);
      } else {
        console.log('[Mobile] 🔊 Звук (заглушка):', type);
      }
    }
  }

  // --- СТАРТ ---
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Mobile] DOM загружен, создаём MobileTerminal...');
    const mobile = new MobileTerminal();
    mobile.start();
  });

})();
