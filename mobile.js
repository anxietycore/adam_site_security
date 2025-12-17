// mobile.js - Рабочая мобильная версия терминала A.D.A.M.
(() => {
  'use strict';
  
  console.log('[MOBILE] mobile.js loaded');
  
  // ==================== КОНФИГУРАЦИЯ ====================
  const CONFIG = {
    MAX_LINES: 500,
    TYPING_SPEED: 16,
    FONT_FAMILY: "'Press Start 2P', monospace",
    COLORS: {
      normal: '#00FF41',
      error: '#FF4444',
      warning: '#FFFF00',
      system: '#FF00FF',
      white: '#FFFFFF'
    }
  };
  
  // ==================== СОСТОЯНИЕ ====================
  const State = {
    terminal: null,
    audio: null,
    lines: [],
    currentLine: '',
    history: [],
    historyIndex: -1,
    isFrozen: false,
    isTyping: false,
    isInputMode: false,
    awaitingConfirmation: false,
    confirmationCallback: null,
    // Данные из terminal_canvas.js
    dossiers: {},
    notes: {},
    decryptFiles: {},
    // Деградация
    degradationLevel: 0,
    // VIGIL999
    vigilCodeParts: { alpha: null, beta: null, gamma: null }
  };
  
  // ==================== DOM ЭЛЕМЕНТЫ ====================
  const DOM = {
    terminal: null,
    quickCommands: null,
    statusBar: null,
    degradationDisplay: null,
    hiddenInput: null,
    confirmModal: null,
    confirmText: null,
    confirmY: null,
    confirmN: null
  };
  
  // ==================== ГЛАВНЫЙ ОБЪЕКТ ====================
  const MobileTerminal = {
    async init() {
      console.log('[MOBILE] Initializing terminal...');
      
      // Получаем DOM элементы
      DOM.terminal = document.getElementById('terminal');
      DOM.quickCommands = document.getElementById('quickCommands');
      DOM.statusBar = document.getElementById('statusBar');
      DOM.degradationDisplay = document.getElementById('degradationDisplay');
      DOM.hiddenInput = document.getElementById('hiddenInput');
      DOM.confirmModal = document.getElementById('confirmModal');
      DOM.confirmText = document.getElementById('confirmText');
      DOM.confirmY = document.getElementById('confirmY');
      DOM.confirmN = document.getElementById('confirmN');
      
      // Ждем загрузки terminal_canvas.js
      await this.waitForTerminal();
      
      // Загружаем данные
      this.loadData();
      
      // Настраиваем UI
      this.setupQuickCommands();
      this.setupConfirmationModal();
      this.setupHiddenInput();
      
      // Инициализируем аудио
      this.initAudio();
      
      // Приветствие
      await this.welcome();
      
      // Добавляем строку ввода
      this.addInputLine();
      
      console.log('[MOBILE] Terminal ready');
    },
    
    waitForTerminal() {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (window.__TerminalCanvas && window.audioManager) {
            State.terminal = window.__TerminalCanvas;
            State.audio = window.audioManager;
            clearInterval(check);
            resolve();
          }
        }, 50);
      });
    },
    
    loadData() {
      if (State.terminal) {
        State.dossiers = JSON.parse(JSON.stringify(State.terminal.dossiers || {}));
        State.notes = JSON.parse(JSON.stringify(State.terminal.notes || {}));
      }
      State.decryptFiles = window.decryptFiles || {};
      
      const saved = localStorage.getItem('vigilCodeParts');
      if (saved) {
        State.vigilCodeParts = JSON.parse(saved);
      }
    },
    
    setupQuickCommands() {
      DOM.quickCommands.addEventListener('click', (e) => {
        if (e.target.classList.contains('quick-btn')) {
          const cmd = e.target.dataset.cmd;
          this.setCommand(cmd);
          this.submitCommand();
        }
      });
    },
    
    setupConfirmationModal() {
      DOM.confirmY.addEventListener('click', () => this.handleConfirm(true));
      DOM.confirmN.addEventListener('click', () => this.handleConfirm(false));
    },
    
    setupHiddenInput() {
      // Клик на терминал фокусирует скрытое поле
      DOM.terminal.addEventListener('click', () => {
        if (!State.isFrozen && !State.isTyping) {
          DOM.hiddenInput.focus();
          console.log('[MOBILE] Focused hidden input');
        }
      });
      
      // Обработка ввода
      DOM.hiddenInput.addEventListener('input', (e) => {
        State.currentLine = e.target.value;
        this.updateInputLine();
      });
      
      // Обработка нажатий клавиш (Enter, Backspace и т.д.)
      DOM.hiddenInput.addEventListener('keydown', (e) => {
        if (State.awaitingConfirmation) {
          e.preventDefault();
          return;
        }
        
        // Звук клавиши
        if (State.audio && State.audio.playKeyPress) {
          const keyType = e.key === 'Enter' ? 'enter' : 
                         e.key === 'Backspace' ? 'backspace' : 
                         e.key === ' ' ? 'space' : 'generic';
          State.audio.playKeyPress(keyType);
        }
        
        // Обработка специальных клавиш
        switch(e.key) {
          case 'Enter':
            e.preventDefault();
            this.submitCommand();
            break;
          case 'ArrowUp':
            e.preventDefault();
            this.navigateHistory('up');
            break;
          case 'ArrowDown':
            e.preventDefault();
            this.navigateHistory('down');
            break;
          case 'Escape':
            e.preventDefault();
            State.currentLine = '';
            DOM.hiddenInput.value = '';
            this.updateInputLine();
            break;
        }
      });
      
      // После ввода очищаем поле
      DOM.hiddenInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          DOM.hiddenInput.value = '';
        }
      });
      
      // Блокируем ввод когда нужно
      document.addEventListener('keydown', (e) => {
        if (State.isFrozen && e.key !== 'Escape') {
          e.preventDefault();
        }
      });
    },
    
    initAudio() {
      document.addEventListener('click', () => {
        if (State.audio && State.audio.audioContext && State.audio.audioContext.state === 'suspended') {
          State.audio.audioContext.resume();
        }
      }, { once: true });
    },
    
    async welcome() {
      await this.typeText('> ТЕРМИНАЛ A.D.A.M. // MOBILE V2');
      await this.typeText('> VIGIL-9 АКТИВЕН');
      await this.typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД');
    },
    
    // ==================== ОТОБРАЖЕНИЕ ====================
    addLine(text, color = CONFIG.COLORS.normal, isInput = false) {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'line';
      lineDiv.style.color = color;
      
      if (isInput) {
        const prompt = document.createElement('span');
        prompt.className = 'prompt';
        prompt.textContent = 'adam@mobile:~$ ';
        
        const inputText = document.createElement('span');
        inputText.className = 'input-text';
        inputText.textContent = text;
        
        const cursor = document.createElement('span');
        cursor.className = 'cursor';
        
        lineDiv.appendChild(prompt);
        lineDiv.appendChild(inputText);
        lineDiv.appendChild(cursor);
      } else {
        lineDiv.textContent = text;
      }
      
      DOM.terminal.appendChild(lineDiv);
      State.lines.push({ text, color, isInput });
      
      if (State.lines.length > CONFIG.MAX_LINES) {
        State.lines.shift();
        DOM.terminal.removeChild(DOM.terminal.firstChild);
      }
      
      DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
    },
    
    async typeText(text, color = CONFIG.COLORS.normal) {
      State.isTyping = true;
      const lineDiv = document.createElement('div');
      lineDiv.className = 'line';
      lineDiv.style.color = color;
      DOM.terminal.appendChild(lineDiv);
      
      let buffer = '';
      for (let i = 0; i < text.length; i++) {
        buffer += text[i];
        lineDiv.textContent = buffer;
        DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
        await this.sleep(CONFIG.TYPING_SPEED);
      }
      
      State.lines.push({ text, color });
      State.isTyping = false;
    },
    
    addInputLine() {
      if (State.isFrozen) return;
      this.addLine(State.currentLine, CONFIG.COLORS.normal, true);
    },
    
    updateInputLine() {
      const lines = DOM.terminal.querySelectorAll('.line');
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        const inputText = lastLine.querySelector('.input-text');
        if (inputText) {
          inputText.textContent = State.currentLine;
        }
      }
    },
    
    clear() {
      DOM.terminal.innerHTML = '';
      State.lines = [];
    },
    
    // ==================== ВВОД ====================
    setCommand(cmd) {
      State.currentLine = cmd;
      DOM.hiddenInput.value = cmd;
      this.updateInputLine();
    },
    
    navigateHistory(dir) {
      if (State.history.length === 0) return;
      
      if (dir === 'up') {
        State.historyIndex = Math.max(0, State.historyIndex - 1);
      } else {
        State.historyIndex = Math.min(State.history.length - 1, State.historyIndex + 1);
      }
      
      const cmd = State.history[State.historyIndex] || '';
      this.setCommand(cmd);
    },
    
    async submitCommand() {
      if (State.isFrozen || State.isTyping) return;
      
      const cmdLine = State.currentLine.trim();
      if (!cmdLine) {
        this.addInputLine();
        return;
      }
      
      // Убираем строку ввода
      const lines = DOM.terminal.querySelectorAll('.line');
      if (lines.length > 0 && lines[lines.length - 1].querySelector('.prompt')) {
        lines[lines.length - 1].remove();
        State.lines.pop();
      }
      
      // Выводим команду
      this.addLine('adam@mobile:~$ ' + cmdLine, CONFIG.COLORS.white);
      
      // Сохраняем в историю
      State.history.push(cmdLine);
      State.historyIndex = State.history.length;
      
      // Очищаем поле ввода
      State.currentLine = '';
      DOM.hiddenInput.value = '';
      
      // Обрабатываем команду
      await this.processCommand(cmdLine);
      
      // Добавляем новую строку ввода
      this.addInputLine();
    },
    
    // ==================== ОБРАБОТКА КОМАНД ====================
    async processCommand(cmdLine) {
      const parts = cmdLine.toLowerCase().split(' ').filter(Boolean);
      const command = parts[0];
      const args = parts.slice(1);
      
      // Увеличиваем деградацию
      this.addDegradation(1);
      
      // Блокировка команд при высокой деградации
      if (State.degradationLevel >= 80 && Math.random() < 0.3) {
        this.addLine('> ДОСТУП ЗАПРЕЩЁН: СИСТЕМА ЗАБЛОКИРОВАНА', CONFIG.COLORS.error);
        return;
      }
      
      switch(command) {
        case 'help':
          await this.cmdHelp();
          break;
        case 'syst':
          await this.cmdSyst();
          break;
        case 'syslog':
          await this.cmdSyslog();
          break;
        case 'subj':
          await this.cmdSubj();
          break;
        case 'notes':
          await this.cmdNotes();
          break;
        case 'open':
          if (args.length === 0) {
            this.addLine('ОШИБКА: Укажите ID файла', CONFIG.COLORS.error);
          } else {
            await this.cmdOpen(args[0]);
          }
          break;
        case 'dscr':
          if (args.length === 0) {
            this.addLine('ОШИБКА: Укажите ID субъекта', CONFIG.COLORS.error);
          } else {
            await this.cmdDscr(args[0]);
          }
          break;
        case 'decrypt':
          if (args.length === 0) {
            this.addLine('ОШИБКА: Укажите ID файла', CONFIG.COLORS.error);
          } else {
            await this.cmdDecrypt(args[0]);
          }
          break;
        case 'trace':
          if (args.length === 0) {
            this.addLine('ОШИБКА: Укажите цель', CONFIG.COLORS.error);
          } else {
            await this.cmdTrace(args[0]);
          }
          break;
        case 'playaudio':
          if (args.length === 0) {
            this.addLine('ОШИБКА: Укажите ID досье', CONFIG.COLORS.error);
          } else {
            await this.cmdPlayAudio(args[0]);
          }
          break;
        case 'net_mode':
          await this.cmdNetMode();
          break;
        case 'net_check':
          await this.cmdNetCheck();
          break;
        case 'clear':
          await this.cmdClear();
          break;
        case 'reset':
          await this.cmdReset();
          break;
        case 'exit':
          await this.cmdExit();
          break;
        case 'deg':
          if (args.length === 0) {
            this.addLine(`Текущий уровень деградации: ${State.degradationLevel}%`);
          } else {
            const level = parseInt(args[0]);
            if (!isNaN(level) && level >= 0 && level <= 100) {
              State.degradationLevel = level;
              this.updateDegradationDisplay();
              this.addLine(`Уровень деградации установлен: ${level}%`);
            } else {
              this.addLine('ОШИБКА: Уровень должен быть 0-100', CONFIG.COLORS.error);
            }
          }
          break;
        case 'alpha':
        case 'beta':
        case 'gamma':
          if (args.length === 0) {
            this.addLine(`ОШИБКА: Укажите код для ${command.toUpperCase()}`, CONFIG.COLORS.error);
          } else {
            State.vigilCodeParts[command] = args[0];
            localStorage.setItem('vigilCodeParts', JSON.stringify(State.vigilCodeParts));
            this.addLine(`> Код ${command.toUpperCase()} зафиксирован`);
            
            if (State.vigilCodeParts.alpha && State.vigilCodeParts.beta && State.vigilCodeParts.gamma) {
              this.addLine('> Все коды собраны. Введите VIGIL999 для активации', CONFIG.COLORS.warning);
            }
          }
          break;
        case 'vigil999':
          await this.cmdVigil999();
          break;
        default:
          this.addLine(`команда не найдена: ${cmdLine}`, CONFIG.COLORS.error);
      }
    },
    
    // ==================== РЕАЛИЗАЦИЯ КОМАНД ====================
    async cmdHelp() {
      const helpLines = [
        'Доступные команды:',
        '  SYST           — проверить состояние системы',
        '  SYSLOG         — системный журнал активности',
        '  SUBJ           — список субъектов',
        '  DSCR <id>      — досье на персонал',
        '  NOTES          — личные файлы сотрудников',
        '  OPEN <id>      — открыть файл из NOTES',
        '  DECRYPT <f>    — расшифровать файл',
        '  TRACE <id>     — отследить указанный модуль',
        '  PLAYAUDIO <id> — воспроизвести аудиозапись',
        '  NET_MODE       — войти в режим управления сеткой (НЕ ДОСТУПНО)',
        '  NET_CHECK      — проверить конфигурацию узлов (НЕ ДОСТУПНО)',
        '  CLEAR          — очистить терминал',
        '  RESET          — сброс интерфейса',
        '  EXIT           — завершить сессию',
        '  DEG <level>    — установить уровень деградации',
        '  ALPHA/BETA/GAMMA <code> — фиксировать коды VIGIL999'
      ];
      
      for (const line of helpLines) {
        this.addLine(line);
      }
    },
    
    async cmdSyst() {
      this.addLine('[СТАТУС СИСТЕМЫ — MOBILE V2]');
      this.addLine('------------------------------------');
      this.addLine('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН');
      this.addLine('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА');
      this.addLine('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН');
      this.addLine('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА');
      this.addLine('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН');
      this.addLine(`ДЕГРАДАЦИЯ: ${State.degradationLevel}%`, 
        State.degradationLevel > 80 ? CONFIG.COLORS.error :
        State.degradationLevel > 60 ? CONFIG.COLORS.warning :
        CONFIG.COLORS.normal);
      this.addLine('------------------------------------');
      this.addLine('РЕКОМЕНДАЦИЯ: Поддерживать стабильность');
    },
    
    async cmdSyslog() {
      this.addLine('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]');
      this.addLine('------------------------------------');
      
      const messages = [
        '[!] Ошибка 0x19F: повреждение нейронной сети',
        '[!] Утечка данных через канал V9-HX',
        '[!] Деградация ядра A.D.A.M.: 28%',
        '> "я слышу их дыхание. они всё ещё здесь."',
        '[!] Потеря отклика от MONOLITH',
        '> "ты не должен видеть это."',
        '[!] Критическая ошибка: субъект наблюдения неопределён'
      ];
      
      const count = Math.min(3 + Math.floor(State.degradationLevel / 30), messages.length);
      for (let i = 0; i < count; i++) {
        this.addLine(messages[i]);
      }
      
      if (State.degradationLevel > 70) {
        this.addLine('[СИСТЕМНЫЙ ЛОГ: ДОСТУП К ЯДРУ ОГРАНИЧЕН. ИСПОЛЬЗУЙТЕ DECRYPT CORE]');
      }
    },
    
    async cmdSubj() {
      this.addLine('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M.]');
      this.addLine('--------------------------------------------------------');
      
      for (const [id, dossier] of Object.entries(State.dossiers)) {
        const color = dossier.status.includes('МЁРТВ') ? CONFIG.COLORS.error : 
                     dossier.status === 'АНОМАЛИЯ' ? CONFIG.COLORS.system :
                     dossier.status === 'АКТИВЕН' ? CONFIG.COLORS.normal : 
                     CONFIG.COLORS.warning;
        
        this.addLine(`${id.toLowerCase()} | ${dossier.name.padEnd(20)} | СТАТУС: ${dossier.status}`, color);
      }
      
      this.addLine('--------------------------------------------------------');
      this.addLine('ИНСТРУКЦИЯ: DSCR <ID> для просмотра досье');
    },
    
    async cmdNotes() {
      this.addLine('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / NOTES]');
      this.addLine('------------------------------------');
      this.addLine('NOTE_001 — "ВЫ ЕГО ЧУВСТВУЕТЕ?"');
      this.addLine('NOTE_002 — "КОЛЬЦО СНА"');
      this.addLine('NOTE_003 — "СОН ADAM"');
      this.addLine('NOTE_004 — "ОН НЕ ПРОГРАММА"');
      this.addLine('NOTE_005 — "ФОТОНОВАЯ БОЛЬ"');
      this.addLine('------------------------------------');
      this.addLine('ИНСТРУКЦИЯ: OPEN <ID>');
    },
    
    async cmdOpen(noteId) {
      const note = State.notes[noteId.toUpperCase()];
      if (!note) {
        this.addLine(`ОШИБКА: Файл ${noteId} не найден`, CONFIG.COLORS.error);
        return;
      }
      
      this.addLine(`[${noteId.toUpperCase()} — "${note.title}"]`);
      this.addLine(`АВТОР: ${note.author}`);
      this.addLine('------------------------------------');
      
      if (Math.random() > 0.7 && noteId.toUpperCase() !== 'NOTE_001') {
        this.addLine('ОШИБКА: Данные повреждены', CONFIG.COLORS.error);
        this.addLine('Восстановление невозможно', CONFIG.COLORS.error);
      } else {
        note.content.forEach(line => {
          this.addLine(`> ${line}`);
        });
      }
      
      this.addLine('------------------------------------');
      this.addLine('[ФАЙЛ ЗАКРЫТ]');
    },
    
    async cmdDscr(subjectId) {
      const id = subjectId.toUpperCase();
      const dossier = State.dossiers[id];
      if (!dossier) {
        this.addLine(`ОШИБКА: Досье ${subjectId} не найдено`, CONFIG.COLORS.error);
        return;
      }
      
      this.addLine(`[ДОСЬЕ — ID: ${id}]`);
      this.addLine(`ИМЯ: ${dossier.name}`);
      this.addLine(`РОЛЬ: ${dossier.role}`);
      
      const statusColor = dossier.status === 'АНОМАЛИЯ' ? CONFIG.COLORS.system :
                         dossier.status === 'АКТИВЕН' ? CONFIG.COLORS.normal :
                         dossier.status.includes('СВЯЗЬ') ? CONFIG.COLORS.warning :
                         CONFIG.COLORS.error;
      
      this.addLine(`СТАТУС: ${dossier.status}`, statusColor);
      this.addLine('------------------------------------');
      this.addLine('ИСХОД:');
      
      dossier.outcome.forEach(line => {
        this.addLine(`> ${line}`, CONFIG.COLORS.error);
      });
      
      this.addLine('------------------------------------');
      this.addLine('СИСТЕМНЫЙ ОТЧЁТ:');
      
      dossier.report.forEach(line => {
        this.addLine(`> ${line}`, CONFIG.COLORS.warning);
      });
      
      this.addLine('------------------------------------');
      this.addLine(`СВЯЗАННЫЕ МИССИИ: ${dossier.missions || 'НЕТ'}`);
      
      if (dossier.audio) {
        this.addLine(`[АУДИОЗАПИСЬ: ${dossier.audioDescription}]`);
        this.addLine(`> Используйте: PLAYAUDIO ${id}`);
      }
    },
    
    async cmdDecrypt(fileId) {
      const id = fileId.toUpperCase();
      const file = State.decryptFiles[id];
      
      if (!file) {
        this.addLine(`ОШИБКА: Файл ${fileId} не найден`, CONFIG.COLORS.error);
        return;
      }
      
      if (id === 'CORE' && State.degradationLevel < 50) {
        this.addLine('ОШИБКА: УРОВЕНЬ ДОСТУПА НЕДОСТАТОЧЕН', CONFIG.COLORS.error);
        return;
      }
      
      // Упрощенная мини-игра
      this.addLine('[СИСТЕМА: ЗАПУЩЕН ПРОТОКОЛ РАСШИФРОВКИ]');
      this.addLine(`> ФАЙЛ: ${file.title}`);
      this.addLine(`> УРОВЕНЬ ДОСТУПА: ${file.accessLevel}`);
      
      await this.showLoading(1000, "Расшифровка");
      
      this.addLine('------------------------------------');
      file.content.forEach(line => {
        this.addLine(line);
      });
      this.addLine('------------------------------------');
      this.addLine(`> ${file.successMessage}`, CONFIG.COLORS.normal);
      
      if (id === 'CORE') {
        this.addLine('> КЛЮЧ АЛЬФА: 375', CONFIG.COLORS.normal);
        this.addLine('> Используйте команду ALPHA для фиксации ключа', CONFIG.COLORS.warning);
      }
      
      this.addDegradation(-5);
    },
    
    async cmdTrace(target) {
      const targetData = {
        '0x9a0': { label: 'Субъект из чёрной дыры', status: 'СОЗНАНИЕ ЗАЦИКЛЕНО' },
        '0x095': { label: 'Субъект-095', status: 'МЁРТВ' },
        'signal': { label: 'Коллективное сознание', status: 'АКТИВНО' },
        'phantom': { label: 'Субъект-095 / Аномалия', status: 'НЕДОСТУПНО' }
      };
      
      const data = targetData[target.toLowerCase()];
      if (!data) {
        this.addLine(`ОШИБКА: Цель ${target} не найдена`, CONFIG.COLORS.error);
        this.addLine('Доступные: 0x9a0, 0x095, signal', CONFIG.COLORS.warning);
        return;
      }
      
      if (target.toLowerCase() === 'phantom' && State.degradationLevel < 70) {
        this.addLine('ОТКАЗАНО | ТРЕБУЕТСЯ ДЕГРАДАЦИЯ >70%', CONFIG.COLORS.error);
        return;
      }
      
      this.addLine(`[СИСТЕМА: РАСКРЫТИЕ КАРТЫ КОНТРОЛЯ]`);
      this.addLine(`> ЦЕЛЬ: ${data.label}`);
      
      await this.showLoading(1500, "Сканирование");
      
      this.addLine(`> СТАТУС: ${data.status}`);
      this.addLine('> СВЯЗИ: ОБНАРУЖЕНЫ АНОМАЛИИ');
      
      if (target === 'signal') {
        this.addDegradation(2);
      } else {
        this.addDegradation(-1);
      }
    },
    
    async cmdPlayAudio(dossierId) {
      const id = dossierId.toUpperCase();
      const dossier = State.dossiers[id];
      
      if (!dossier || !dossier.audio) {
        this.addLine(`ОШИБКА: Аудиозапись ${dossierId} не найдена`, CONFIG.COLORS.error);
        return;
      }
      
      this.addLine(`[АУДИО: ВОСПРОИЗВЕДЕНИЕ ${id}]`, CONFIG.COLORS.warning);
      this.addLine(`> ${dossier.audioDescription}`);
      this.addLine('[ИНСТРУКЦИЯ: Аудио ограничено на мобильных устройствах]');
    },
    
    async cmdNetMode() {
      this.addLine('> Переход в режим управления сеткой...');
      this.addLine('> ЭТА ФУНКЦИЯ НЕДОСТУПНА НА МОБИЛЬНЫХ УСТРОЙСТВАХ', CONFIG.COLORS.warning);
      this.addLine('> Используйте десктопную версию для полного доступа');
    },
    
    async cmdNetCheck() {
      this.addLine('> Проверка конфигурации узлов...');
      this.addLine('> ФУНКЦИЯ НЕ ДОСТУПНА НА МОБИЛЬНЫХ', CONFIG.COLORS.warning);
      
      if (State.degradationLevel > 0) {
        this.addLine(`> СЕТЕВАЯ ДЕГРАДАЦИЯ: ${Math.min(85, State.degradationLevel)}%`);
      }
    },
    
    async cmdClear() {
      this.clear();
      await this.typeText('> ТЕРМИНАЛ ОЧИЩЕН');
    },
    
    async cmdReset() {
      this.addLine('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]');
      this.addLine('ВНИМАНИЕ: операция приведёт к очистке сессии.');
      
      const confirmed = await this.showConfirmation('Подтвердить сброс? (Y/N)');
      if (confirmed) {
        this.addLine('> Y');
        this.addLine('> ВОССТАНОВЛЕНИЕ БАЗОВОГО СОСТОЯНИЯ...');
        await this.showLoading(2000, "Сброс");
        this.clear();
        this.addDegradation(-State.degradationLevel);
        await this.welcome();
      } else {
        this.addLine('> N');
        this.addLine('[ОПЕРАЦИЯ ОТМЕНЕНА]');
      }
    },
    
    async cmdExit() {
      this.addLine('[ЗАВЕРШЕНИЕ СЕССИИ]');
      
      const confirmed = await this.showConfirmation('Подтвердить выход? (Y/N)');
      if (confirmed) {
        this.addLine('> Y');
        await this.showLoading(1000, "Отключение");
        this.addLine('> СОЕДИНЕНИЕ ПРЕРВАНО.');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 2000);
      } else {
        this.addLine('> N');
        this.addLine('[ОТМЕНА]');
      }
    },
    
    async cmdVigil999() {
      this.addLine('ПРОВЕРКА КЛЮЧЕЙ:');
      
      const expected = { alpha: '375', beta: '814', gamma: '291' };
      let allCorrect = true;
      
      for (const key in expected) {
        const value = State.vigilCodeParts[key];
        if (value === expected[key]) {
          this.addLine(` ${key.toUpperCase()}: ${value} [СОВПАДЕНИЕ]`, CONFIG.COLORS.normal);
        } else {
          this.addLine(` ${key.toUpperCase()}: ${value || 'НЕ ЗАФИКСИРОВАН'} [ОШИБКА]`, CONFIG.COLORS.error);
          allCorrect = false;
        }
      }
      
      if (!allCorrect) {
        this.addLine('ДОСТУП ЗАПРЕЩЁН. ИСПРАВЬТЕ ОШИБКИ.', CONFIG.COLORS.error);
        return;
      }
      
      this.addLine('>>> ПРОТОКОЛ OBSERVER-7 АКТИВИРОВАН', CONFIG.COLORS.warning);
      
      const confirmed = await this.showConfirmation('Подтвердить активацию? (Y/N)');
      if (confirmed) {
        this.addLine('> Y');
        this.addLine('> ПЕРЕХОД В РЕЖИМ НАБЛЮДЕНИЯ...');
        setTimeout(() => {
          window.location.href = 'observer-7.html';
        }, 3000);
      } else {
        this.addLine('> N');
        this.addLine('> АКТИВАЦИЯ ОТМЕНЕНА');
      }
    },
    
    // ==================== УТИЛИТЫ ====================
    addDegradation(amount) {
      State.degradationLevel = Math.max(0, Math.min(100, State.degradationLevel + amount));
      this.updateDegradationDisplay();
    },
    
    updateDegradationDisplay() {
      DOM.degradationDisplay.textContent = `ДЕГРАДАЦИЯ: ${State.degradationLevel}%`;
      
      let color = '#00FF41';
      if (State.degradationLevel > 80) color = '#FF4444';
      else if (State.degradationLevel > 60) color = '#FF8800';
      else if (State.degradationLevel > 30) color = '#FFFF00';
      
      DOM.degradationDisplay.style.color = color;
    },
    
    async showLoading(duration, text = "ЗАГРУЗКА") {
      const start = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - start;
        const progress = Math.min(100, (elapsed / duration) * 100);
        const filled = Math.floor(progress / 10);
        const bar = `[${'|'.repeat(filled)}${' '.repeat(10 - filled)}] ${Math.floor(progress)}%`;
        
        const lines = DOM.terminal.querySelectorAll('.line');
        if (lines.length > 0 && lines[lines.length - 1].textContent.includes('[')) {
          lines[lines.length - 1].textContent = `> ${text} ${bar}`;
        } else {
          this.addLine(`> ${text} ${bar}`);
        }
        
        if (progress >= 100) {
          clearInterval(interval);
        }
      }, 50);
      
      await this.sleep(duration);
      clearInterval(interval);
      
      const lines = DOM.terminal.querySelectorAll('.line');
      if (lines.length > 0) {
        lines[lines.length - 1].textContent = `> ${text} [ЗАВЕРШЕНО]`;
      }
    },
    
    showConfirmation(text) {
      return new Promise((resolve) => {
        State.awaitingConfirmation = true;
        State.confirmationCallback = resolve;
        
        DOM.confirmText.textContent = text;
        DOM.confirmModal.style.display = 'block';
        
        // Обработчики кнопок
        const handleY = () => {
          DOM.confirmModal.style.display = 'none';
          State.awaitingConfirmation = false;
          resolve(true);
        };
        
        const handleN = () => {
          DOM.confirmModal.style.display = 'none';
          State.awaitingConfirmation = false;
          resolve(false);
        };
        
        DOM.confirmY.onclick = handleY;
        DOM.confirmN.onclick = handleN;
        
        // Обработка клавиатуры
        const keyHandler = (e) => {
          if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') {
            document.removeEventListener('keydown', keyHandler);
            handleY();
          } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
            document.removeEventListener('keydown', keyHandler);
            handleN();
          }
        };
        
        // Даем время отрисоваться, затем фокусируем скрытое поле
        setTimeout(() => {
          document.addEventListener('keydown', keyHandler);
          DOM.hiddenInput.focus();
        }, 100);
      });
    },
    
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  };
  
  // Экспорт в глобальную область
  window.MobileTerminal = MobileTerminal;
  
  console.log('[MOBILE] mobile.js defined');
})();
