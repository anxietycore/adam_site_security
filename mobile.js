/**
 * MOBILE TERMINAL A.D.A.M. v3.3 — ПОЛНАЯ МОБИЛЬНАЯ АДАПТАЦИЯ
 */

(() => {
  'use strict';

  const CONFIG = {
    WAIT_FOR_TERMINAL: 5000,
    BUTTON_SIZE: 56,
    PANEL_WIDTH: 140,
  };

  class ConfirmationPanel {
    constructor(mobileTerminal) {
      this.mobile = mobileTerminal;
      this.isOpen = false;
      this.element = null;
      this.callback = null;
    }

    show(message, onSelect) {
      if (this.isOpen) this.hide();
      
      this.isOpen = true;
      this.callback = onSelect;
      
      this.element = document.createElement('div');
      this.element.id = 'confirmationPanel';
      this.element.className = 'selection-panel confirmation-panel';
      
      this.element.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(1, 8, 6, 0.97);
        border: 2px solid rgba(0, 255, 65, 0.15);
        border-radius: 12px;
        padding: 8px;
        z-index: 99999;
        min-width: 280px;
        max-width: 90vw;
        font-family: 'Press Start 2P', monospace;
        color: #00FF41;
      `;

      const header = document.createElement('div');
      header.style.cssText = 'font-size: 11px; margin-bottom: 10px; text-align: center; color: #FFFF00; padding-bottom: 8px; border-bottom: 1px solid #00FF41;';
      header.textContent = message;
      this.element.appendChild(header);

      const buttonsContainer = document.createElement('div');
      buttonsContainer.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;';

      const yesBtn = document.createElement('button');
      yesBtn.className = 'submenu-item';
      yesBtn.textContent = 'Y';
      yesBtn.style.color = '#00FF41';
      yesBtn.style.borderColor = 'rgba(0, 255, 65, 0.25)';
      yesBtn.addEventListener('click', () => {
        this.mobile.playSound('click');
        const cb = this.callback;
        this.hide();
        if (cb) cb(true);
      });
      buttonsContainer.appendChild(yesBtn);

      const noBtn = document.createElement('button');
      noBtn.className = 'submenu-item';
      noBtn.textContent = 'N';
      noBtn.style.color = '#FF4444';
      noBtn.style.borderColor = 'rgba(255, 80, 80, 0.25)';
      noBtn.addEventListener('click', () => {
        this.mobile.playSound('close');
        const cb = this.callback;
        this.hide();
        if (cb) cb(false);
      });
      buttonsContainer.appendChild(noBtn);

      this.element.appendChild(buttonsContainer);
      document.body.appendChild(this.element);

      this.escHandler = (e) => {
        if (e.key === 'Escape') {
          const cb = this.callback;
          this.hide();
          if (cb) cb(false);
        }
      };
      document.addEventListener('keydown', this.escHandler);
    }

    hide() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.callback = null;
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
      document.removeEventListener('keydown', this.escHandler);
    }
  }

  class SelectionPanel {
    constructor(mobileTerminal) {
      this.mobile = mobileTerminal;
      this.isOpen = false;
      this.element = null;
    }

    show(options, title, onSelect) {
      if (this.isOpen) this.hide();
      
      this.isOpen = true;
      this.element = document.createElement('div');
      this.element.id = 'selectionPanel';
      this.element.className = 'selection-panel';
      
      this.element.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(1, 8, 6, 0.97);
        border: 2px solid rgba(0, 255, 65, 0.15);
        border-radius: 12px;
        padding: 8px;
        z-index: 99999;
        min-width: 280px;
        max-width: 90vw;
        max-height: 60vh;
        overflow-y: auto;
        font-family: 'Press Start 2P', monospace;
        color: #00FF41;
      `;

      const header = document.createElement('div');
      header.style.cssText = 'font-size: 11px; margin-bottom: 10px; text-align: center; color: #FFFF00; padding-bottom: 8px; border-bottom: 1px solid #00FF41;';
      header.textContent = title;
      this.element.appendChild(header);

      const container = document.createElement('div');
      container.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

      const firstRow = document.createElement('div');
      firstRow.style.cssText = 'display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px;';

      const secondRow = document.createElement('div');
      secondRow.style.cssText = 'display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px;';

      const firstRowOptions = options.slice(0, 8);
      const secondRowOptions = options.slice(8);

      firstRowOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'submenu-item';
        btn.textContent = opt.label;
        
        if (opt.description) {
          btn.innerHTML += `<div style="font-size: 8px; color: #888; margin-top: 4px;">${opt.description}</div>`;
        }
        
        btn.addEventListener('click', () => {
          this.mobile.playSound('click');
          const cb = onSelect;
          this.hide();
          cb(opt.value);
        });
        
        firstRow.appendChild(btn);
      });

      secondRowOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'submenu-item';
        btn.textContent = opt.label;
        
        if (opt.description) {
          btn.innerHTML += `<div style="font-size: 8px; color: #888; margin-top: 4px;">${opt.description}</div>`;
        }
        
        btn.addEventListener('click', () => {
          this.mobile.playSound('click');
          const cb = onSelect;
          this.hide();
          cb(opt.value);
        });
        
        secondRow.appendChild(btn);
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'submenu-item';
      cancelBtn.style.color = '#FF4444';
      cancelBtn.style.borderColor = 'rgba(255, 80, 80, 0.25)';
      cancelBtn.textContent = 'ОТМЕНА';
      cancelBtn.addEventListener('click', () => {
        this.mobile.playSound('close');
        this.hide();
        this.mobile.addInputLine();
      });
      
      if (secondRowOptions.length === 0) {
        firstRow.appendChild(cancelBtn);
      } else {
        secondRow.appendChild(cancelBtn);
      }

      container.appendChild(firstRow);
      if (secondRowOptions.length > 0 || secondRow.children.length > 0) {
        container.appendChild(secondRow);
      }

      this.element.appendChild(container);
      document.body.appendChild(this.element);

      this.escHandler = (e) => {
        if (e.key === 'Escape') {
          this.hide();
          this.mobile.addInputLine();
        }
      };
      document.addEventListener('keydown', this.escHandler);
    }

    hide() {
      if (!this.isOpen) return;
      this.isOpen = false;
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
      document.removeEventListener('keydown', this.escHandler);
    }
  }

  class NumericKeypad {
    constructor(mobileTerminal) {
      this.mobile = mobileTerminal;
      this.isOpen = false;
      this.element = null;
    }

show() {
  if (this.isOpen) this.hide();
  
  this.isOpen = true;
  
  this.element = document.createElement('div');
  this.element.id = 'numericKeypad';
  this.element.className = 'numeric-keypad';
  
  this.element.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.95);
    border: 2px solid rgba(0, 255, 65, 0.2);
    border-radius: 14px;
    padding: 12px;
    z-index: 99998;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    min-width: 280px;
    max-width: 90vw;
  `;

  const mobile = this.mobile;

  // Ряд 1-3: 1 2 3 4 5 6 7 8 9
  for (let i = 1; i <= 9; i++) {
    const btn = this.createButton(i.toString(), () => this.sendKey(i.toString()));
    this.element.appendChild(btn);
  }

  // Ряд 4: 0 ⌫ ⏎
  const zeroBtn = this.createButton('0', () => this.sendKey('0'));
  this.element.appendChild(zeroBtn);

  const backBtn = this.createButton('⌫', () => this.sendKey('Backspace'));
  backBtn.style.color = '#FFFF00';
  backBtn.style.borderColor = 'rgba(255, 255, 0, 0.25)';
  this.element.appendChild(backBtn);

  const enterBtn = this.createButton('⏎', () => this.sendKey('Enter'));
  enterBtn.style.color = '#00FF41';
  enterBtn.style.borderColor = 'rgba(0, 255, 65, 0.25)';
  this.element.appendChild(enterBtn);

  // Пустой элемент для выравнивания (5-й ряд, первая колонка)
  const dummy = document.createElement('div');
  dummy.style.visibility = 'hidden';
  this.element.appendChild(dummy);

  // Пустой элемент (5-й ряд, вторая колонка)
  const dummy2 = document.createElement('div');
  dummy2.style.visibility = 'hidden';
  this.element.appendChild(dummy2);

  // Ряд 5: ESC на всю ширину
  const escBtn = this.createButton('ESC', () => {
    this.hide();
    setTimeout(() => this.sendKey('Escape'), 50);
  });
  escBtn.style.color = '#FF4444';
  escBtn.style.borderColor = 'rgba(255, 80, 80, 0.25)';
  escBtn.style.gridColumn = '1 / -1'; // На всю ширину
  this.element.appendChild(escBtn);

  document.body.appendChild(this.element);
}

    createButton(label, onClick) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        min-height: 54px;
        background: rgba(0, 0, 0, 0.6);
        color: #00FF41;
        border: 1px solid rgba(0, 255, 65, 0.15);
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        font-family: 'Press Start 2P', monospace;
      `;
      btn.onclick = () => {
        this.mobile.playSound('click');
        onClick();
      };
      return btn;
    }

    sendKey(key) {
      const mobile = this.mobile;
      mobile.playSound('click');
      const event = new KeyboardEvent('keydown', { key: key, bubbles: true });
      document.dispatchEvent(event);
    }

    hide() {
      if (!this.isOpen) return;
      this.isOpen = false;
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
    }
  }

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
      this.selectionPanel = new SelectionPanel(this);
      this.numericKeypad = new NumericKeypad(this);
      this.confirmationPanel = new ConfirmationPanel(this);
    }

    async start() {
      this.cacheElements();
      await this.waitForApi();
      await this.loadData();
      this.generateUI();
      this.hideNetGridInitially();
      this.setupDecryptListener();
      this.state.isInitialized = true;
    }

    cacheElements() {
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
      }
    }

    async waitForApi() {
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 50;
        
        const check = setInterval(() => {
          attempts++;
          
          const hasTerminal = !!window.__TerminalCanvas;
          const hasNetGrid = !!window.__netGrid;
          
          if (hasTerminal && hasNetGrid) {
            this.api.terminal = window.__TerminalCanvas;
            this.api.netGrid = window.__netGrid;
            this.api.audio = window.audioManager || { playSystemSound: () => {} };
            this.state.apiReady = true;
            clearInterval(check);
            resolve();
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }

    async loadData() {
      if (!this.state.apiReady) return;
      
      const cmds = this.api.terminal.commandsList || 
                   (this.api.terminal.commands || ['help', 'syst', 'syslog', 'subj', 'dscr', 'notes', 'clear', 'reset', 'net_check', 'deg', 'vigil999', 'alpha', 'gamma', 'beta']);
      this.state.commands = cmds.map(String);

      const dossiers = this.api.terminal.dossiers || {};
      this.state.dossierIds = Object.keys(dossiers).map(String);
    }

    generateUI() {
      if (!this.elements.panelContent) return;
      
      this.generateCommandButtons();
      this.bindUI();
    }

    generateCommandButtons() {
      const baseCommands = [
        { cmd: 'help', label: 'help' },
        { cmd: 'syst', label: 'syst' },
        { cmd: 'syslog', label: 'syslog' },
        { cmd: 'subj', label: 'subj' },
        { cmd: 'notes', label: 'notes' },
        { cmd: 'clear', label: 'clear' },
        { cmd: 'reset', label: 'reset', danger: true },
      ];

baseCommands.forEach(btn => {
  const button = this.createButton(btn.label, () => {
    this.playSound('click');
    if (btn.cmd === 'reset') {
      // 1. СНАЧАЛА выполняем reset (появится в терминале)
      this.executeCommand('reset');
      // 2. ПОТОМ показываем окно подтверждения
      this.showConfirmation(
        'Подтвердить сброс? (Y/N)',
        (confirmed) => {
          if (confirmed) {
            // 3. Отправляем Y в терминал
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y' }));
          } else {
            // 4. Отправляем N в терминал
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
          }
        }
      );
    } else {
      this.executeCommand(btn.cmd);
    }
  }, btn.danger);
  this.elements.panelContent.appendChild(button);
});

      // DSCR с панелью выбора
      if (this.state.dossierIds.length > 0) {
        const dscrBtn = this.createButton('dscr ▶', () => this.openDscrPanel());
        this.elements.panelContent.appendChild(dscrBtn);
      }

      // TRACE с панелью выбора
      const traceBtn = this.createButton('trace ▶', () => this.openTraceMenu());
      this.elements.panelContent.appendChild(traceBtn);

      // OPEN с панелью выбора
      const openBtn = this.createButton('open ▶', () => this.openNoteMenu());
      this.elements.panelContent.appendChild(openBtn);

      // DECRYPT с панелью выбора
      const decryptBtn = this.createButton('decrypt ▶', () => this.openDecryptMenu());
        this.elements.panelContent.appendChild(decryptBtn);

      // PLAYAUDIO с панелью выбора
      const audioIds = this.getAudioIds();
      if (audioIds.length > 0) {
        const audioBtn = this.createButton('playaudio ▶', () => this.openAudioMenu());
        this.elements.panelContent.appendChild(audioBtn);
      }

      // ESC кнопка
      const escBtn = this.createButton('esc', () => {
        this.playSound('click');
        const event = new KeyboardEvent('keydown', { key: 'Escape' });

        document.dispatchEvent(event);
      });
      escBtn.style.color = '#FF4444';
      escBtn.style.borderColor = 'rgba(255, 80, 80, 0.25)';
      this.elements.panelContent.appendChild(escBtn);

      const spacer = document.createElement('div');
      spacer.className = 'spacer';
      this.elements.panelContent.appendChild(spacer);
    }

    getAudioIds() {
      const dossiers = this.api.terminal.dossiers || {};
      return Object.keys(dossiers).filter(id => dossiers[id].audio);
    }

    getNoteIds() {
      return ['NOTE_001', 'NOTE_002', 'NOTE_003', 'NOTE_004', 'NOTE_005'];
    }

    getTraceTargets() {
      return [
        { value: '0x9a0', label: '0x9a0' },
        { value: '0x095', label: '0x095' },
        { value: 'signal', label: 'SIGNAL' },
        { value: 'phantom', label: 'PHANTOM' },
        { value: 'monolith', label: 'MONOLITH' }
      ];
    }

    createButton(label, onClick, isDanger = false) {
      const btn = document.createElement('button');
      btn.className = isDanger ? 'cmd danger' : 'cmd';
      btn.textContent = label;
      btn.style.minHeight = `${CONFIG.BUTTON_SIZE}px`;
      btn.style.fontFamily = "'Press Start 2P', monospace";
      
      btn.addEventListener('click', () => {
        this.playSound('click');
        onClick();
      });
      
      return btn;
    }

    bindUI() {
      this.elements.panelHandle.addEventListener('click', () => {
        this.elements.sidePanel.classList.toggle('collapsed');
      });

      document.getElementById('gridClose').addEventListener('click', () => {
        this.closeGridModal();
      });
    }

    showConfirmation(message, callback) {
      this.confirmationPanel.show(message, callback);
    }

    openDscrPanel() {
      const options = this.state.dossierIds.map(id => ({
        value: id,
        label: id.toLowerCase()
      }));

      this.selectionPanel.show(
        options,
        'ВЫБЕРИТЕ ДОСЬЕ',
        (dossierId) => this.executeCommand(`dscr ${dossierId}`)
      );
    }

    openTraceMenu() {
      this.selectionPanel.show(
        this.getTraceTargets(),
        'ВЫБЕРИТЕ ЦЕЛЬ ДЛЯ TRACE',
        (target) => this.executeCommand(`trace ${target}`)
      );
    }

    openNoteMenu() {
      const options = this.getNoteIds().map(id => ({
        value: id,
        label: id.toLowerCase()
      }));

      this.selectionPanel.show(
        options,
        'ВЫБЕРИТЕ NOTE ФАЙЛ',
        (noteId) => this.executeCommand(`open ${noteId}`)
      );
    }

    openDecryptMenu() {
      const options = [
        { value: '0XA71', label: '0xa71' },
        { value: '0XB33', label: '0xb33' },
        { value: '0XC44', label: '0xc44' },
        { value: '0XD22', label: '0xd22' },
        { value: '0XE09', label: '0xe09' },
        { value: 'CORE', label: 'core' }
      ];

      this.selectionPanel.show(
        options,
        'ВЫБЕРИТЕ ФАЙЛ ДЛЯ РАСШИФРОВКИ',
        (fileId) => this.executeCommand(`decrypt ${fileId}`)
      );
    }

    openAudioMenu() {
      const audioIds = this.getAudioIds();
      const options = audioIds.map(id => ({
        value: id,
        label: id.toLowerCase()
      }));

      if (options.length === 0) {
        this.addColoredText('ОШИБКА: Нет доступных аудиозаписей', '#FF4444');
        return;
      }

      this.selectionPanel.show(
        options,
        'ВЫБЕРИТЕ АУДИОЗАПИСЬ',
        (audioId) => this.executeCommand(`playaudio ${audioId}`)
      );
    }

setupDecryptListener() {
  setInterval(() => {
    if (window.__TerminalCanvas?.isDecryptActive?.()) {
      if (!this.numericKeypad.isOpen) {
        this.numericKeypad.show();
      }
    } else if (this.numericKeypad.isOpen) {
      this.numericKeypad.hide();
    }
  }, 200);
}

    executeCommand(cmd) {
      if (!this.api.terminal?.processCommand) return;
      this.api.terminal.processCommand(cmd);
    }

    addColoredText(text, color = '#00FF41') {
      if (this.api.terminal) {
        this.api.terminal.addColoredText(text, color, true);
      }
    }

    addInputLine() {
      if (this.api.terminal) {
        this.api.terminal.addInputLine();
      }
    }

    hideNetGridInitially() {
      const netCanvas = document.querySelector('canvas:not(#terminalCanvas)');
      if (netCanvas) {
        netCanvas.style.display = 'none';
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

    playSound(type) {
      if (this.api.audio?.playSystemSound) {
        this.api.audio.playSystemSound(type);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const mobile = new MobileTerminal();
    mobile.start();
    window.__MobileTerminal = mobile;
  });
// ✅ ПОКАЗ МОДАЛЬНОГО ОКНА ПРЕДУПРЕЖДЕНИЯ
function showDesktopModeWarning() {
  const warningEl = document.getElementById('mobileWarning');
  const okBtn = document.getElementById('okContinueBtn');
  
  // Проверяем, является ли устройство мобильным
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  
  // Показываем окно ВСЕГДА для телефонов (даже с desktop mode)
  if (isMobile) {
    warningEl.classList.remove('hidden');
    
    // Кнопка ПРОДОЛЖИТЬ — закрывает окно
    okBtn.onclick = () => {
      warningEl.classList.add('hidden');
    };
  } else {
    // Не мобильное устройство — окно не показываем
    warningEl.classList.add('hidden');
  }
}
})();
