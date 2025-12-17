// mobile_terminal_v2.js - Чистая мобильная версия терминала A.D.A.M.
(() => {
  'use strict';
  
  // ==================== КОНФИГУРАЦИЯ ====================
  const CONFIG = {
    MAX_LINES: 500,
    TYPING_SPEED: 16,
    FONT_FAMILY: "'Press Start 2P', monospace",
    COLORS: {
      normal: '#00FF41',
      error: '#FF4444',
      warning: '#FFFF00',
      system: '#FF00FF'
    }
  };
  
  // ==================== СОСТОЯНИЕ ====================
  const State = {
    terminal: null,          // Ссылка на __TerminalCanvas
    audio: null,             // Ссылка на audioManager
    lines: [],               // Массив строк для отображения
    currentLine: '',         // Текущая строка ввода
    history: [],             // История команд
    historyIndex: -1,
    isFrozen: false,
    isTyping: false,
    awaitingConfirmation: false,
    confirmationCallback: null,
    // Данные из terminal_canvas.js
    dossiers: {},
    notes: {},
    decryptFiles: {},
    // Деградация (упрощенная)
    degradationLevel: 0,
    // VIGIL999
    vigilCodeParts: { alpha: null, beta: null, gamma: null }
  };
  
  // ==================== DOM ЭЛЕМЕНТЫ ====================
  const DOM = {
    terminal: null,
    keyboard: null,
    quickCommands: null,
    statusBar: null,
    degradationDisplay: null
  };
  
  // ==================== ИНИЦИАЛИЗАЦИЯ ====================
  const MobileTerminal = {
    async init() {
      console.log('[MOBILE] Initializing...');
      
      // Получаем DOM элементы
      DOM.terminal = document.getElementById('terminal');
      DOM.keyboard = document.getElementById('keyboard');
      DOM.quickCommands = document.getElementById('quickCommands');
      DOM.statusBar = document.getElementById('statusBar');
      DOM.degradationDisplay = document.getElementById('degradationDisplay');
      
      // Ждем загрузки terminal_canvas.js
      await this.waitForTerminal();
      
      // Загружаем данные из terminal_canvas.js
      this.loadData();
      
      // Настраиваем UI
      this.setupKeyboard();
      this.setupQuickCommands();
      
      // Инициализируем аудио (требует первого взаимодействия)
      this.initAudio();
      
      // Приветствие
      await this.welcome();
      
      // Добавляем строку ввода
      this.addInputLine();
      
      console.log('[MOBILE] Ready');
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
      // Экспортируем данные из terminal_canvas.js
      if (State.terminal) {
        State.dossiers = JSON.parse(JSON.stringify(State.terminal.dossiers || {}));
        State.notes = JSON.parse(JSON.stringify(State.terminal.notes || {}));
        // Копируем decryptFiles из глобальной области
        State.decryptFiles = window.decryptFiles || {};
      }
      
      // Загружаем VIGIL999 ключи из localStorage
      const saved = localStorage.getItem('vigilCodeParts');
      if (saved) {
        State.vigilCodeParts = JSON.parse(saved);
      }
    },
    
    setupKeyboard() {
      DOM.keyboard.addEventListener('click', (e) => {
        if (e.target.classList.contains('kb-key')) {
          const key = e.target.dataset.key;
          this.handleKey(key);
        }
      });
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
    
    initAudio() {
      // Аудио инициализируется при первом взаимодействии
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
        lineDiv.innerHTML = `<span class="prompt">adam@mobile:~$ </span><span class="input-text">${text}</span><span class="cursor"></span>`;
      } else {
        lineDiv.textContent = text;
      }
      
      DOM.terminal.appendChild(lineDiv);
      State.lines.push({ text, color, isInput });
      
      // Ограничиваем количество строк
      if (State.lines.length > CONFIG.MAX_LINES) {
        State.lines.shift();
        DOM.terminal.removeChild(DOM.terminal.firstChild);
      }
      
      // Прокрутка вниз
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
      if (lastLine && lastLine.querySelector('.input-text')) {
        lastLine.querySelector('.input-text').textContent = State.currentLine;
      }
    },
    
    clear() {
      DOM.terminal.innerHTML = '';
      State.lines = [];
    },
    
    // ==================== ВВОД ====================
    handleKey(key) {
      if (State.isFrozen || State.isTyping) return;
      
      // Звук клавиши (если аудио доступно)
      if (State.audio && State.audio.playKeyPress) {
        State.audio.playKeyPress(key.length === 1 ? 'generic' : key);
      }
      
      switch(key) {
        case 'Backspace':
          State.currentLine = State.currentLine.slice(0, -1);
          break;
        case 'Enter':
          this.submitCommand();
          return;
        case 'Escape':
          State.currentLine = '';
          break;
        case 'Tab':
          // Циклический выбор быстрых команд
          const buttons = Array.from(DOM.quickCommands.querySelectorAll('.quick-btn'));
          const currentIndex = buttons.findIndex(btn => btn.dataset.cmd === State.currentLine);
          const nextIndex = (currentIndex + 1) % buttons.length;
          this.setCommand(buttons[nextIndex].dataset.cmd);
          return;
        case 'ArrowUp':
          this.navigateHistory('up');
          return;
        case 'ArrowDown':
          this.navigateHistory('down');
          return;
        default:
          if (key.length === 1 || key === ' ') {
            State.currentLine += key;
          }
      }
      
      this.updateInputLine();
    },
    
    navigateHistory(dir) {
      if (State.history.length === 0) return;
      
      if (dir === 'up') {
        State.historyIndex = Math.max(0, State.historyIndex - 1);
      } else {
        State.historyIndex = Math.min(State.history.length - 1, State.historyIndex + 1);
      }
      
      State.currentLine = State.history[State.historyIndex] || '';
      this.updateInputLine();
    },
    
    setCommand(cmd) {
      State.currentLine = cmd;
      this.updateInputLine();
    },
    
    async submitCommand() {
      const cmdLine = State.currentLine.trim();
      if (!cmdLine) {
        this.addInputLine();
        return;
      }
      
      // Убираем строку ввода и выводим команду
      const lines = DOM.terminal.querySelectorAll('.line');
      if (lines.length > 0) {
        lines[lines.length - 1].remove();
        State.lines.pop();
      }
      
      this.addLine('adam@mobile:~$ ' + cmdLine, '#FFFFFF');
      State.history.push(cmdLine);
      State.historyIndex = State.history.length;
      State.currentLine = '';
      
      // Обработка команды
      await this.processCommand(cmdLine);
    },
    
    // ==================== ОБРАБОТКА КОМАНД ====================
    async processCommand(cmdLine) {
      const parts = cmdLine.toLowerCase().split(' ').filter(Boolean);
      const command = parts[0];
      const args = parts.slice(1);
      
      // Увеличиваем деградацию
      this.addDegradation(1);
      
      // Проверка блокировки команд при высокой деградации
      if (State.degradationLevel >= 80 && Math.random() < 0.3) {
        this.addLine('> ДОСТУП ЗАПРЕЩЁН: СИСТЕМА ЗАБЛОКИРОВАНА', CONFIG.COLORS.error);
        this.addInputLine();
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
      
      this.addInputLine();
    },
    
    // ==================== КОМАНДЫ ====================
    async cmdHelp() {
      const helpText = [
        'Доступные команды:',
        '  SYST           — проверить состояние системы',
        '  SYSLOG         — системный журнал активности',
        '  SUBJ           — список субъектов',
        '  DSCR <id>      — досье на персонал',
        '  NOTES          — личные файлы сотрудников',
        '  OPEN <id>      — открыть файл из NOTES',
        '  DECRYPT <f>    — расшифровать файл (0XA71, 0XB33, 0XC44, 0XD22, 0XE09, CORE)',
        '  TRACE <id>     — отследить указанный модуль',
        '  PLAYAUDIO <id> — воспроизвести аудиозапись',
        '  NET_MODE       — войти в режим управления сеткой (НЕ ДОСТУПНО НА МОБИЛЬНЫХ)',
        '  NET_CHECK      — проверить конфигурацию узлов (НЕ ДОСТУПНО НА МОБИЛЬНЫХ)',
        '  CLEAR          — очистить терминал',
        '  RESET          — сброс интерфейса',
        '  EXIT           — завершить сессию',
        '  DEG <level>    — установить уровень деградации (0-100)',
        '  ALPHA/BETA/GAMMA <code> — фиксировать коды VIGIL999'
      ];
      
      for (const line of helpText) {
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
      this.addLine(`ДЕГРАДАЦИЯ: ${State.degradationLevel}%`, State.degradationLevel > 60 ? CONFIG.COLORS.error : CONFIG.COLORS.warning);
      this.addLine('------------------------------------');
      this.addLine('РЕКОМЕНДАЦИЯ: Поддерживать стабильность');
    },
    
    async cmdSyslog() {
      const messages = [
        '[!] Ошибка 0x19F: повреждение нейронной сети',
        '[!] Утечка данных через канал V9-HX',
        '[!] Деградация ядра A.D.A.M.: 28%',
        '> "я слышу их дыхание. они всё ещё здесь."',
        '[!] Потеря отклика от MONOLITH',
        '> "ты не должен видеть это."',
        '[!] Критическая ошибка: субъект наблюдения неопределён'
      ];
      
      this.addLine('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]');
      this.addLine('------------------------------------');
      
      const count = Math.min(3 + Math.floor(State.degradationLevel / 30), messages.length);
      for (let i = 0; i < count; i++) {
        this.addLine(messages[i]);
        if (i === 2 && State.degradationLevel > 70) {
          this.addLine('[СИСТЕМНЫЙ ЛОГ: ДОСТУП К ЯДРУ ОГРАНИЧЕН]');
        }
      }
    },
    
    async cmdSubj() {
      this.addLine('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M.]');
      this.addLine('--------------------------------------------------------');
      
      for (const [id, dossier] of Object.entries(State.dossiers)) {
        const color = dossier.status.includes('МЁРТВ') ? CONFIG.COLORS.error : 
                     dossier.status === 'АНОМАЛИЯ' ? CONFIG.COLORS.system : 
                     dossier.status === 'АКТИВЕН' ? CONFIG.COLORS.normal : CONFIG.COLORS.warning;
        
        const line = `${id.toLowerCase()} | ${dossier.name.padEnd(20)} | СТАТУС: ${dossier.status}`;
        this.addLine(line, color);
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
      
      if (Math.random() > 0.3 && noteId.toUpperCase() !== 'NOTE_001') {
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
                         dossier.status.includes('СВЯЗЬ') ? CONFIG.COLORS.warning : CONFIG.COLORS.error;
      this.addLine(`СТАТУС: ${dossier.status}`, statusColor);
      
      this.addLine('------------------------------------');
      this.addLine('ИСХОД:');
      dossier.outcome.forEach(line => {
        this.addLine(`> ${line}`, CONFIG.COLORS.error);
      });
      
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
      
      // Простая мини-игра: угадай код (3 попытки)
      const code = Math.floor(100 + Math.random() * 900);
      let attempts = 3;
      
      this.addLine('[СИСТЕМА: ЗАПУЩЕН ПРОТОКОЛ РАСШИФРОВКИ]');
      this.addLine(`> ФАЙЛ: ${file.title}`);
      this.addLine(`> УРОВЕНЬ ДОСТУПА: ${file.accessLevel}`);
      this.addLine(`> КОД ДОСТУПА: 3 ЦИФРЫ (XXX)`);
      
      // Для простоты: сразу показываем контент (в реальном terminal_canvas.js это сложнее)
      // В мобильной версии упрощаем
      this.addLine('------------------------------------');
      this.addLine('[УПРОЩЕННАЯ РАСШИФРОВКА]');
      
      for (const line of file.content) {
        this.addLine(line);
        await this.sleep(30);
      }
      
      this.addLine('------------------------------------');
      this.addLine(`> ${file.successMessage}`);
      
      // Для CORE показываем ключ Альфа
      if (id === 'CORE') {
        this.addLine('> КЛЮЧ АЛЬФА: 375');
        this.addLine('> Используйте команду ALPHA для фиксации ключа', CONFIG.COLORS.warning);
      }
    },
    
    async cmdTrace(target) {
      const targetData = {
        '0x9a0': { label: 'Субъект из чёрной дыры', status: 'СОЗНАНИЕ ЗАЦИКЛЕНО' },
        '0x095': { label: 'Субъект-095', status: 'МЁРТВ' },
        'signal': { label: 'Коллективное сознание', status: 'АКТИВНО' }
      };
      
      const data = targetData[target.toLowerCase()];
      if (!data) {
        this.addLine(`ОШИБКА: Цель ${target} не найдена`, CONFIG.COLORS.error);
        return;
      }
      
      this.addLine(`[СИСТЕМА: РАСКРЫТИЕ КАРТЫ КОНТРОЛЯ]`);
      this.addLine(`> ЦЕЛЬ: ${data.label}`);
      
      // Симулируем анимацию загрузки
      await this.showLoading(1500, "Сканирование связей");
      
      this.addLine(`> СТАТУС: ${data.status}`);
      this.addLine('> Подключение: ТРЕБУЕТСЯ ДОСТУП УРОВНЯ OMEGA');
      
      // Награда/наказание
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
      
      // На мобильных просто показываем сообщение
      // (реальное воспроизведение сложно из-за ограничений браузеров)
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
      
      // Но показываем статус
      const gridDeg = State.degradationLevel > 80 ? 85 : State.degradationLevel;
      if (gridDeg > 0) {
        this.addLine(`> СЕТЕВАЯ ДЕГРАДАЦИЯ: ${gridDeg}%`, gridDeg > 50 ? CONFIG.COLORS.error : CONFIG.COLORS.warning);
      }
    },
    
    async cmdClear() {
      this.clear();
      await this.typeText('> ТЕРМИНАЛ ОЧИЩЕН');
    },
    
    async cmdReset() {
      this.addLine('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]');
      this.addLine('ВНИМАНИЕ: операция приведёт к очистке сессии.');
      
      const confirmed = await this.waitForConfirmation();
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
      const confirmed = await this.waitForConfirmation();
      if (confirmed) {
        this.addLine('> Y');
        await this.showLoading(1000, "Отключение");
        this.addLine('> СОЕДИНЕНИЕ ПРЕРВАНО.');
        // Через 2 секунды возвращаем на главную
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
      
      // Все ключи верны - активируем протокол
      this.addLine('>>> ПРОТОКОЛ OBSERVER-7 АКТИВИРОВАН', CONFIG.COLORS.warning);
      this.addLine('Подтвердите активацию? (Y/N)');
      
      const confirmed = await this.waitForConfirmation();
      if (confirmed) {
        this.addLine('> Y');
        this.addLine('> ПЕРЕХОД В РЕЖИМ НАБЛЮДЕНИЯ...');
        // Через 3 секунды переходим
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
      
      // Цвет в зависимости от уровня
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
        
        // Обновляем последнюю строку
        const lines = DOM.terminal.querySelectorAll('.line');
        if (lines.length > 0 && lines[lines.length - 1].textContent.includes('[')) {
          lines[lines.length - 1].textContent = `> ${text} ${bar}`;
        } else {
          this.addLine(`> ${text} ${bar}`);
        }
        
        if (progress >= 100) {
          clearInterval(interval);
          const finalLines = DOM.terminal.querySelectorAll('.line');
          if (finalLines.length > 0) {
            finalLines[finalLines.length - 1].textContent = `> ${text} [ЗАВЕРШЕНО]`;
          }
        }
      }, 100);
      
      await this.sleep(duration);
      clearInterval(interval);
    },
    
    waitForConfirmation() {
      return new Promise(resolve => {
        const handler = (e) => {
          if (e.key) {
            const key = e.key.toLowerCase();
            if (key === 'y' || key === 'н') {
              document.removeEventListener('keydown', handler);
              resolve(true);
            } else if (key === 'n' || key === 'т') {
              document.removeEventListener('keydown', handler);
              resolve(false);
            }
          }
        };
        
        // Также работает с виртуальной клавиатурой
        const kbHandler = (e) => {
          if (e.target.classList.contains('kb-key') && e.target.dataset.key === 'Y') {
            DOM.keyboard.removeEventListener('click', kbHandler);
            resolve(true);
          } else if (e.target.classList.contains('kb-key') && e.target.dataset.key === 'N') {
            DOM.keyboard.removeEventListener('click', kbHandler);
            resolve(false);
          }
        };
        
        document.addEventListener('keydown', handler);
        DOM.keyboard.addEventListener('click', kbHandler);
      });
    },
    
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  };
  
  // Экспорт глобально
  window.MobileTerminal = MobileTerminal;
})();
