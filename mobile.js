/**
 * MOBILE TERMINAL A.D.A.M. v2.2 — ФИКС playSound
 * ВСЕ методы внутри класса!
 */

(() => {
  'use strict';

  const CONFIG = {
    WAIT_FOR_TERMINAL: 5000,
    BUTTON_SIZE: 44,
  };

  console.log('[Mobile] START: Начинаем инициализацию...');

  class MobileTerminal {
    constructor() {
      this.state = {
        isInitialized: false,
        apiReady: false,
        commands: [],
        dossierIds: [],
      };
      
      this.elements = {};
      this.api = {};
      
      console.log('[Mobile] Constructor: Объект создан');
    }

    async start() {
      console.log('[Mobile] start() вызван');
      this.cacheElements();
      await this.waitForApi();
      await this.loadData();
      this.generateUI();
      this.hideNetGridInitially();

      this.state.isInitialized = true;
      console.log('[Mobile] ✅ Инициализация завершена!');
    }

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
            this.api.audio = window.audioManager || { playSystemSound: () => {} };
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
      
      btn.addEventListener('click', () => {
        console.log(`[Mobile] 🔘 Нажата: "${label}"`);
        this.playSound('click');
        onClick();
      });
      
      return btn;
    }

    bindUI() {
      // Сворачивание панели
      this.elements.panelHandle.addEventListener('click', () => {
        this.elements.sidePanel.classList.toggle('collapsed');
        console.log('[Mobile] Панель свёрнута');
      });

      // Закрытие сетки
      document.getElementById('gridClose').addEventListener('click', () => {
        this.closeGridModal();
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

    // === СЕТКА ===
    hideNetGridInitially() {
      const netCanvas = document.querySelector('canvas:not(#terminalCanvas)');
      if (netCanvas) {
        netCanvas.style.display = 'none';
        console.log('[Mobile] 🌐 Сетка скрыта');
      }
    }

    openGridModal() {
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
      this.api.netGrid.setGridMode(false);
      this.elements.gridModal.classList.add('hidden');
      
      const netCanvas = document.querySelector('canvas:not(#terminalCanvas)');
      if (netCanvas) {
        netCanvas.style.display = 'none';
        document.body.appendChild(netCanvas);
      }
      
      this.playSound('close');
    }

    // === ЗВУК ===
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
