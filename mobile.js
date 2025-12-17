// mobile.js - МОБИЛЬНАЯ ВЕРСИЯ ТЕРМИНАЛА A.D.A.M. (ТОЛЬКО ДЛЯ ТЕЛЕФОНОВ)
(() => {
  'use strict';
  
  console.log('[MOBILE] Terminal initializing...');
  
  // ==================== КОНФИГУРАЦИЯ ДЛЯ ТЕЛЕФОНОВ ====================
  const CONFIG = {
    MAX_LINES: 300, // Ограничение строк на маленьком экране
    TYPING_SPEED: 14, // Быстрее для мобильных
    FONT_SIZE: '12px', // Минимальный размер для читаемости на телефоне
    COLORS: {
      normal: '#00FF41',
      error: '#FF4444',
      warning: '#FFFF00',
      system: '#FF00FF',
      white: '#FFFFFF',
      gray: '#AAAAAA'
    },
    // Мобильные размеры UI
    UI: {
      statusBarHeight: '40px',
      quickBarHeight: '50px',
      inputPadding: '12px'
    }
  };
  
  // ==================== ДАННЫЕ ТЕРМИНАЛА (ВСЕ ВНУТРИ) ====================
  const DATA = {
    // ДОСЬЕ (Добавь остальные аналогично)
    dossiers: {
      '0X001': {
        name: 'ERICH VAN KOSS',
        role: 'Руководитель программы VIGIL-9',
        status: 'СВЯЗЬ ОТСУТСТВУЕТ',
        outcome: ['Попытка саботажа', 'Маяк уничтожен', 'Телеметрия прервана'],
        report: ['Классификация: SABOTAGE-3D', 'Перенос в OBSERVER'],
        missions: 'MARS, OBSERVER',
        audioDesc: 'Последняя передача'
      },
      // ИНСТРУКЦИЯ: Добавь остальные досье 0X095, 0X413, 0X811, 0X9A0, 0XT00, 0XF00 и т.д.
      // Скопируй полностью из terminal_canvas.js, вставь сюда с соблюдением формата
    },
    
    // ЗАМЕТКИ (Добавь остальные)
    notes: {
      'NOTE_001': {
        title: 'ВЫ ЕГО ЧУВСТВУЕТЕ?',
        author: 'Dr. Rehn',
        content: ['Оно дышит', 'Оно знает имена', 'Терминал отвечает сам']
      },
      // ИНСТРУКЦИЯ: Добавь NOTE_002, NOTE_003, NOTE_004, NOTE_005
    },
    
    // ФАЙЛЫ ДЛЯ РАСШИФРОВКИ (Добавь остальные)
    decryptFiles: {
      '0XA71': {
        title: 'ПЕРВАЯ МИССИЯ',
        accessLevel: 'ALPHA',
        content: [
          '> ОБЪЕКТ: КАПСУЛА-003',
          '> СТАТУС: ЗАВЕРШЕНО С ПОТЕРЯМИ',
          'ОПИСАНИЕ: Тест фазового прыжка',
          'РЕЗУЛЬТАТ: Экипаж утрачен'
        ],
        success: 'Данные восстановлены',
        failure: 'Попытки исчерпаны'
      },
      // ИНСТРУКЦИЯ: Добавь 0XB33, 0XC44, 0XD22, 0XE09, CORE
    }
  };
  
  // ==================== СОСТОЯНИЕ ТЕРМИНАЛА ====================
  const State = {
    lines: [], // История вывода (без истории команд)
    currentLine: '',
    degradation: 0,
    isFrozen: false,
    isTyping: false,
    isConfirming: false,
    confirmCallback: null,
    vigilCodes: { alpha: null, beta: null, gamma: null },
    // Мобильный аудио контекст
    audio: null
  };
  
  // ==================== DOM ЭЛЕМЕНТЫ ====================
  const DOM = {
    terminal: null,
    statusBar: null,
    degradationDisplay: null,
    quickCmds: null,
    hiddenInput: null,
    confirmModal: null,
    confirmText: null,
    confirmY: null,
    confirmN: null
  };
  
  // ==================== ГЛАВНЫЙ ОБЪЕКТ ТЕРМИНАЛА ====================
  const MobileTerminal = {
    // Инициализация (вызывается из HTML)
    async init() {
      console.log('[MOBILE] Setup DOM...');
      this.setupDOM();
      this.setupEventListeners();
      this.setupAudio();
      
      console.log('[MOBILE] Welcome...');
      await this.welcome();
      this.addInputLine();
      
      console.log('[MOBILE] Ready');
    },
    
    setupDOM() {
      DOM.terminal = document.getElementById('terminal');
      DOM.statusBar = document.getElementById('statusBar');
      DOM.degradationDisplay = document.getElementById('degradationDisplay');
      DOM.quickCmds = document.getElementById('quickCommands');
      DOM.hiddenInput = document.getElementById('hiddenInput');
      DOM.confirmModal = document.getElementById('confirmModal');
      DOM.confirmText = document.getElementById('confirmText');
      DOM.confirmY = document.getElementById('confirmY');
      DOM.confirmN = document.getElementById('confirmN');
    },
    
    setupEventListeners() {
      // Клик на терминал = фокус системной клавиатуры
      DOM.terminal.addEventListener('click', () => {
        if (!State.isFrozen) DOM.hiddenInput.focus();
      });
      
      // Обработка ввода из скрытого поля
      DOM.hiddenInput.addEventListener('input', (e) => {
        State.currentLine = e.target.value;
        this.updateInputLine();
      });
      
      // Обработка нажатий клавиш
      DOM.hiddenInput.addEventListener('keydown', (e) => {
        if (State.isConfirming) {
          e.preventDefault();
          return;
        }
        
        // Звук клавиши
        this.playKeySound(e.key);
        
        switch(e.key) {
          case 'Enter':
            e.preventDefault();
            this.submitCommand();
            break;
          case 'Escape':
            e.preventDefault();
            State.currentLine = '';
            DOM.hiddenInput.value = '';
            this.updateInputLine();
            break;
        }
      });
      
      // Быстрые команды
      DOM.quickCmds.addEventListener('click', (e) => {
        if (e.target.dataset.cmd) {
          this.setCommand(e.target.dataset.cmd);
          this.submitCommand();
        }
      });
      
      // Модальное окно подтверждения
      DOM.confirmY.addEventListener('click', () => this.handleConfirm(true));
      DOM.confirmN.addEventListener('click', () => this.handleConfirm(false));
    },
    
    setupAudio() {
      // Активация аудио при первом взаимодействии
      document.addEventListener('click', () => {
        if (!State.audio && window.audioManager) {
          State.audio = window.audioManager;
          if (State.audio.audioContext?.state === 'suspended') {
            State.audio.audioContext.resume();
          }
        }
      }, { once: true });
    },
    
    playKeySound(key) {
      if (!State.audio) return;
      const type = key === 'Enter' ? 'enter' : 
                   key === 'Backspace' ? 'backspace' : 
                   key === ' ' ? 'space' : 'generic';
      State.audio.playKeyPress?.(type);
    },
    
    // ==================== ОТОБРАЖЕНИЕ ====================
    addLine(text, color = CONFIG.COLORS.normal, isInput = false) {
      const line = document.createElement('div');
      line.className = 'line';
      line.style.color = color;
      line.style.fontSize = CONFIG.FONT_SIZE;
      line.style.marginBottom = '6px';
      line.style.wordBreak = 'break-word';
      
      if (isInput) {
        line.innerHTML = `
          <span style="color:${CONFIG.COLORS.normal};">adam@mobile:~$ </span>
          <span class="input-text">${text}</span>
          <span class="cursor" style="display:inline-block;width:6px;height:14px;background:${CONFIG.COLORS.normal};animation:blink 1s infinite;"></span>
        `;
      } else {
        line.textContent = text;
      }
      
      DOM.terminal.appendChild(line);
      State.lines.push({ text, color });
      
      // Ограничение строк
      if (State.lines.length > CONFIG.MAX_LINES) {
        DOM.terminal.removeChild(DOM.terminal.firstChild);
        State.lines.shift();
      }
      
      // Прокрутка вниз
      DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
    },
    
    async typeText(text, color = CONFIG.COLORS.normal) {
      State.isTyping = true;
      const line = document.createElement('div');
      line.className = 'line';
      line.style.color = color;
      line.style.fontSize = CONFIG.FONT_SIZE;
      line.style.marginBottom = '6px';
      DOM.terminal.appendChild(line);
      
      let buffer = '';
      for (let i = 0; i < text.length; i++) {
        buffer += text[i];
        line.textContent = buffer;
        DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
        await this.sleep(CONFIG.TYPING_SPEED);
      }
      
      State.lines.push({ text, color });
      State.isTyping = false;
    },
    
    updateInputLine() {
      const lines = DOM.terminal.querySelectorAll('.line');
      const last = lines[lines.length - 1];
      if (last && last.querySelector('.input-text')) {
        last.querySelector('.input-text').textContent = State.currentLine;
      }
    },
    
    addInputLine() {
      if (!State.isFrozen) this.addLine(State.currentLine, CONFIG.COLORS.normal, true);
    },
    
    clear() {
      DOM.terminal.innerHTML = '';
      State.lines = [];
    },
    
    // ==================== ВВОД И ИСТОРИЯ (УБРАНА) ====================
    setCommand(cmd) {
      State.currentLine = cmd;
      DOM.hiddenInput.value = cmd;
      this.updateInputLine();
    },
    
    async submitCommand() {
      if (State.isFrozen || State.isTyping) return;
      
      const cmdLine = State.currentLine.trim();
      if (!cmdLine) {
        this.addInputLine();
        return;
      }
      
      // Убираем предыдущую строку ввода
      const lines = DOM.terminal.querySelectorAll('.line');
      if (lines.length > 0 && lines[lines.length - 1].querySelector('.input-text')) {
        lines[lines.length - 1].remove();
        State.lines.pop();
      }
      
      // Выводим команду
      this.addLine('adam@mobile:~$ ' + cmdLine, CONFIG.COLORS.white);
      
      // Очищаем поле
      State.currentLine = '';
      DOM.hiddenInput.value = '';
      
      // Обрабатываем
      await this.processCommand(cmdLine);
      this.addInputLine();
    },
    
    // ==================== ОБРАБОТКА КОМАНД ====================
    async processCommand(cmdLine) {
      // Увеличение деградации
      this.addDegradation(1);
      
      // Блокировка при высокой деградации
      if (State.degradation >= 80 && Math.random() < 0.3) {
        this.addLine('> ДОСТУП ЗАПРЕЩЁН: СИСТЕМА ЗАБЛОКИРОВАНА', CONFIG.COLORS.error);
        State.audio?.playCommandSound?.('error');
        return;
      }
      
      const parts = cmdLine.toLowerCase().split(' ').filter(Boolean);
      const cmd = parts[0];
      const args = parts.slice(1);
      
      switch(cmd) {
        case 'help':
          this.cmdHelp();
          break;
        case 'syst':
          this.cmdSyst();
          break;
        case 'syslog':
          this.cmdSyslog();
          break;
        case 'subj':
          this.cmdSubj();
          break;
        case 'notes':
          this.cmdNotes();
          break;
        case 'open':
          if (!args[0]) this.addLine('ОШИБКА: Укажите ID файла', CONFIG.COLORS.error);
          else this.cmdOpen(args[0].toUpperCase());
          break;
        case 'dscr':
          if (!args[0]) this.addLine('ОШИБКА: Укажите ID субъекта', CONFIG.COLORS.error);
          else this.cmdDscr(args[0].toUpperCase());
          break;
        case 'decrypt':
          if (!args[0]) this.addLine('ОШИБКА: Укажите ID файла', CONFIG.COLORS.error);
          else this.cmdDecrypt(args[0].toUpperCase());
          break;
        case 'trace':
          if (!args[0]) this.addLine('ОШИБКА: Укажите цель', CONFIG.COLORS.error);
          else this.cmdTrace(args[0]);
          break;
        case 'playaudio':
          if (!args[0]) this.addLine('ОШИБКА: Укажите ID досье', CONFIG.COLORS.error);
          else this.cmdPlayAudio(args[0].toUpperCase());
          break;
        case 'net_mode':
          this.cmdNetMode();
          break;
        case 'net_check':
          this.cmdNetCheck();
          break;
        case 'clear':
          this.cmdClear();
          break;
        case 'reset':
          this.cmdReset();
          break;
        case 'exit':
          this.cmdExit();
          break;
        case 'deg':
          this.cmdDeg(args[0]);
          break;
        case 'alpha':
        case 'beta':
        case 'gamma':
          this.cmdVigilKey(cmd, args[0]);
          break;
        case 'vigil999':
          this.cmdVigil999();
          break;
        default:
          this.addLine(`команда не найдена: ${cmdLine}`, CONFIG.COLORS.error);
          State.audio?.playCommandSound?.('error');
      }
    },
    
    // ==================== РЕАЛИЗАЦИЯ КАЖДОЙ КОМАНДЫ ====================
    cmdHelp() {
      [
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
        '  NET_MODE       — режим управления сеткой',
        '  NET_CHECK      — проверить конфигурацию',
        '  CLEAR          — очистить терминал',
        '  RESET          — сброс интерфейса',
        '  EXIT           — завершить сессию',
        '  DEG <уровень>  — установить деградацию',
        '  ALPHA/BETA/GAMMA <код> — фиксировать коды',
        '  VIGIL999       — активировать протокол'
      ].forEach(line => this.addLine(line));
    },
    
    cmdSyst() {
      this.addLine('[СТАТУС СИСТЕМЫ — MOBILE V2]');
      this.addLine('------------------------------------');
      this.addLine('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН');
      this.addLine('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА');
      this.addLine('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН');
      this.addLine('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА');
      this.addLine('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН');
      this.addLine(`ДЕГРАДАЦИЯ: ${State.degradation}%`, 
        State.degradation > 80 ? CONFIG.COLORS.error :
        State.degradation > 60 ? CONFIG.COLORS.warning :
        CONFIG.COLORS.normal);
      this.addLine('------------------------------------');
      this.addLine('РЕКОМЕНДАЦИЯ: Поддерживать стабильность');
    },
    
    cmdSyslog() {
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
      const count = Math.min(3 + Math.floor(State.degradation / 30), messages.length);
      for (let i = 0; i < count; i++) {
        this.addLine(messages[i]);
      }
      if (State.degradation > 70) {
        this.addLine('[СИСТЕМНЫЙ ЛОГ: ДОСТУП К ЯДРУ ОГРАНИЧЕН. ИСПОЛЬЗУЙТЕ DECRYPT CORE]');
      }
    },
    
    cmdSubj() {
      this.addLine('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M.]');
      this.addLine('--------------------------------------------------------');
      
      for (const [id, d] of Object.entries(DATA.dossiers)) {
        const color = d.status.includes('МЁРТВ') ? CONFIG.COLORS.error : 
                     d.status === 'АНОМАЛИЯ' ? CONFIG.COLORS.system :
                     d.status === 'АКТИВЕН' ? CONFIG.COLORS.normal : CONFIG.COLORS.warning;
        this.addLine(`${id.toLowerCase()} | ${d.name.padEnd(20)} | СТАТУС: ${d.status}`, color);
      }
      
      this.addLine('--------------------------------------------------------');
      this.addLine('ИНСТРУКЦИЯ: DSCR <ID> для просмотра');
    },
    
    cmdNotes() {
      this.addLine('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / NOTES]');
      this.addLine('------------------------------------');
      Object.keys(DATA.notes).forEach(id => {
        this.addLine(`${id} — "${DATA.notes[id].title}" / ${DATA.notes[id].author}`);
      });
      this.addLine('------------------------------------');
      this.addLine('ИНСТРУКЦИЯ: OPEN <ID>');
    },
    
    cmdOpen(noteId) {
      const note = DATA.notes[noteId];
      if (!note) {
        this.addLine(`ОШИБКА: Файл ${noteId} не найден`, CONFIG.COLORS.error);
        State.audio?.playCommandSound?.('error');
        return;
      }
      
      this.addLine(`[${noteId} — "${note.title}"]`);
      this.addLine(`АВТОР: ${note.author}`);
      this.addLine('------------------------------------');
      
      if (Math.random() > 0.7 && noteId !== 'NOTE_001') {
        this.addLine('ОШИБКА: Данные повреждены', CONFIG.COLORS.error);
        this.addLine('Восстановление невозможно', CONFIG.COLORS.error);
      } else {
        note.content.forEach(line => this.addLine(`> ${line}`));
      }
      
      this.addLine('------------------------------------');
      this.addLine('[ФАЙЛ ЗАКРЫТ]');
    },
    
    cmdDscr(subjectId) {
      const d = DATA.dossiers[subjectId];
      if (!d) {
        this.addLine(`ОШИБКА: Досье ${subjectId} не найдено`, CONFIG.COLORS.error);
        State.audio?.playCommandSound?.('error');
        return;
      }
      
      this.addLine(`[ДОСЬЕ — ID: ${subjectId}]`);
      this.addLine(`ИМЯ: ${d.name}`);
      this.addLine(`РОЛЬ: ${d.role}`);
      
      const color = d.status === 'АНОМАЛИЯ' ? CONFIG.COLORS.system :
                   d.status === 'АКТИВЕН' ? CONFIG.COLORS.normal :
                   d.status.includes('СВЯЗЬ') ? CONFIG.COLORS.warning : CONFIG.COLORS.error;
      this.addLine(`СТАТУС: ${d.status}`, color);
      
      this.addLine('------------------------------------');
      this.addLine('ИСХОД:');
      d.outcome.forEach(line => this.addLine(`> ${line}`, CONFIG.COLORS.error));
      this.addLine('------------------------------------');
      this.addLine('СИСТЕМНЫЙ ОТЧЁТ:');
      d.report.forEach(line => this.addLine(`> ${line}`, CONFIG.COLORS.warning));
      
      if (d.missions) {
        this.addLine('------------------------------------');
        this.addLine(`СВЯЗАННЫЕ МИССИИ: ${d.missions}`);
      }
      
      if (d.audioDesc) {
        this.addLine(`[АУДИО: ${d.audioDesc}]`);
        this.addLine(`> Используйте: PLAYAUDIO ${subjectId}`);
      }
    },
    
    async cmdDecrypt(fileId) {
      const file = DATA.decryptFiles[fileId];
      if (!file) {
        this.addLine(`ОШИБКА: Файл ${fileId} не найден`, CONFIG.COLORS.error);
        State.audio?.playCommandSound?.('error');
        return;
      }
      
      if (fileId === 'CORE' && State.degradation < 50) {
        this.addLine('ОШИБКА: УРОВЕНЬ ДОСТУПА НЕДОСТАТОЧЕН', CONFIG.COLORS.error);
        return;
      }
      
      // Простая мини-игра (упрощенная для мобильных)
      this.addLine('[СИСТЕМА: ЗАПУЩЕН ПРОТОКОЛ РАСШИФРОВКИ]');
      this.addLine(`> ФАЙЛ: ${file.title}`);
      this.addLine(`> УРОВЕНЬ ДОСТУПА: ${file.accessLevel}`);
      
      await this.showLoading(1200, "Расшифровка");
      
      this.addLine('------------------------------------');
      file.content.forEach(line => this.addLine(line));
      this.addLine('------------------------------------');
      this.addLine(`> ${file.success}`, CONFIG.COLORS.normal);
      
      if (fileId === 'CORE') {
        this.addLine('> КЛЮЧ АЛЬФА: 375', CONFIG.COLORS.normal);
        this.addLine('> Используйте команду ALPHA для фиксации ключа', CONFIG.COLORS.warning);
      }
      
      this.addDegradation(-5);
      State.audio?.playOperationSound?.('decrypt_success');
    },
    
    cmdTrace(target) {
      const targets = {
        '0x9a0': { name: 'Субъект из чёрной дыры', status: 'СОЗНАНИЕ ЗАЦИКЛЕНО', risk: 2 },
        '0x095': { name: 'Субъект-095', status: 'МЁРТВ', risk: 1 },
        'signal': { name: 'Коллективное сознание', status: 'АКТИВНО', risk: 2 }
      };
      
      const t = targets[target.toLowerCase()];
      if (!t) {
        this.addLine(`ОШИБКА: Цель не найдена`, CONFIG.COLORS.error);
        return;
      }
      
      this.addLine(`[СИСТЕМА: РАСКРЫТИЕ КАРТЫ]`);
      this.addLine(`> ЦЕЛЬ: ${t.name}`);
      this.addLine(`> СТАТУС: ${t.status}`);
      this.addLine(`> РИСК: ${t.risk === 2 ? 'ВЫСОКИЙ' : 'СРЕДНИЙ'}`);
      
      this.addDegradation(t.risk === 2 ? 2 : -1);
    },
    
    cmdPlayAudio(id) {
      const d = DATA.dossiers[id];
      if (!d?.audioDesc) {
        this.addLine('ОШИБКА: Аудио не найдено', CONFIG.COLORS.error);
        return;
      }
      this.addLine(`[АУДИО: ${d.audioDesc}]`, CONFIG.COLORS.warning);
      this.addLine('> Воспроизведение ограничено на мобильных', CONFIG.COLORS.gray);
    },
    
    cmdNetMode() {
      this.addLine('> Режим управления сеткой...');
      this.addLine('> НЕ ДОСТУПНО НА МОБИЛЬНЫХ', CONFIG.COLORS.warning);
    },
    
    cmdNetCheck() {
      this.addLine('> Проверка конфигурации...');
      this.addLine('> НЕ ДОСТУПНО НА МОБИЛЬНЫХ', CONFIG.COLORS.warning);
      this.addLine(`> Сет. деградация: ${Math.min(85, State.degradation)}%`);
    },
    
    cmdClear() {
      this.clear();
      this.typeText('> ТЕРМИНАЛ ОЧИЩЕН');
    },
    
    async cmdReset() {
      this.addLine('[ПРОТОКОЛ СБРОСА]');
      this.addLine('ВНИМАНИЕ: Операция сбросит сессию.');
      
      const confirmed = await this.showConfirmation('Подтвердить сброс? (Y/N)');
      if (confirmed) {
        this.addLine('> Y');
        await this.showLoading(2000, "Сброс");
        this.clear();
        State.degradation = 0;
        this.updateDegradationDisplay();
        this.welcome();
      } else {
        this.addLine('> N');
        this.addLine('[ОТМЕНА]');
      }
    },
    
    async cmdExit() {
      this.addLine('[ЗАВЕРШЕНИЕ СЕССИИ]');
      
      const confirmed = await this.showConfirmation('Выйти? (Y/N)');
      if (confirmed) {
        this.addLine('> Y');
        await this.showLoading(1000, "Отключение");
        this.addLine('> СОЕДИНЕНИЕ ПРЕРВАНО.');
        setTimeout(() => window.location.href = 'index.html', 2000);
      } else {
        this.addLine('> N');
        this.addLine('[ОТМЕНА]');
      }
    },
    
    cmdDeg(level) {
      const newLevel = parseInt(level);
      if (isNaN(newLevel) || newLevel < 0 || newLevel > 100) {
        this.addLine('ОШИБКА: Уровень 0-100', CONFIG.COLORS.error);
        return;
      }
      State.degradation = newLevel;
      this.updateDegradationDisplay();
      this.addLine(`Уровень деградации: ${newLevel}%`);
    },
    
    cmdVigilKey(key, code) {
      if (!code) {
        this.addLine(`ОШИБКА: Укажите код для ${key.toUpperCase()}`, CONFIG.COLORS.error);
        return;
      }
      State.vigilCodes[key] = code;
      localStorage.setItem('vigilCodes', JSON.stringify(State.vigilCodes));
      this.addLine(`> Код ${key.toUpperCase()} зафиксирован`);
      
      if (State.vigilCodes.alpha && State.vigilCodes.beta && State.vigilCodes.gamma) {
        this.addLine('> Все коды собраны. Введите VIGIL999', CONFIG.COLORS.warning);
      }
    },
    
    async cmdVigil999() {
      this.addLine('ПРОВЕРКА КЛЮЧЕЙ:');
      
      const expected = { alpha: '375', beta: '814', gamma: '291' };
      let allCorrect = true;
      
      for (const key in expected) {
        const value = State.vigilCodes[key];
        if (value === expected[key]) {
          this.addLine(` ${key.toUpperCase()}: ${value} [СОВПАДЕНИЕ]`, CONFIG.COLORS.normal);
        } else {
          this.addLine(` ${key.toUpperCase()}: ${value || 'НЕ ЗАФИКСИРОВАН'} [ОШИБКА]`, CONFIG.COLORS.error);
          allCorrect = false;
        }
      }
      
      if (!allCorrect) {
        this.addLine('ДОСТУП ЗАПРЕЩЁН', CONFIG.COLORS.error);
        return;
      }
      
      this.addLine('>>> ПРОТОКОЛ OBSERVER-7 АКТИВИРОВАН', CONFIG.COLORS.warning);
      
      const confirmed = await this.showConfirmation('Подтвердить активацию? (Y/N)');
      if (confirmed) {
        this.addLine('> Y');
        this.addLine('> ПЕРЕХОД В РЕЖИМ НАБЛЮДЕНИЯ...');
        setTimeout(() => window.location.href = 'observer-7.html', 3000);
      } else {
        this.addLine('> N');
        this.addLine('> АКТИВАЦИЯ ОТМЕНЕНА');
      }
    },
    
    // ==================== УТИЛИТЫ ====================
    addDegradation(amount) {
      State.degradation = Math.max(0, Math.min(100, State.degradation + amount));
      this.updateDegradationDisplay();
    },
    
    updateDegradationDisplay() {
      DOM.degradationDisplay.textContent = `ДЕГРАДАЦИЯ: ${State.degradation}%`;
      let color = CONFIG.COLORS.normal;
      if (State.degradation > 80) color = CONFIG.COLORS.error;
      else if (State.degradation > 60) color = CONFIG.COLORS.warning;
      else if (State.degradation > 30) color = CONFIG.COLORS.warning;
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
        State.isConfirming = true;
        State.confirmCallback = resolve;
        
        DOM.confirmText.textContent = text;
        DOM.confirmModal.style.display = 'block';
        
        // Фокус на скрытое поле для ответа Y/N
        DOM.hiddenInput.focus();
        
        // Обработка через клавиатуру
        const keyHandler = (e) => {
          const key = e.key.toLowerCase();
          if (key === 'y' || key === 'н') {
            document.removeEventListener('keydown', keyHandler);
            this.handleConfirm(true);
          } else if (key === 'n' || key === 'т') {
            document.removeEventListener('keydown', keyHandler);
            this.handleConfirm(false);
          }
        };
        
        document.addEventListener('keydown', keyHandler);
      });
    },
    
    handleConfirm(result) {
      State.isConfirming = false;
      DOM.confirmModal.style.display = 'none';
      if (State.confirmCallback) {
        State.confirmCallback(result);
        State.confirmCallback = null;
      }
    },
    
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  };
  
  // ==================== ЭКСПОРТ ====================
  window.MobileTerminal = MobileTerminal;
  
})();

// ==================== ИНСТРУКЦИЯ ПО ДОБАВЛЕНИЮ ДАННЫХ ====================
// 1. Открой terminal_canvas.js
// 2. Найди константу dossiers = { ... }
// 3. Скопируй ВСЕ содержимое dossiers
// 4. Вставь в mobile.js в объект DATA.dossiers
// 5. То же самое сделай для notes и decryptFiles
// 6. ГОТОВО. Никаких других файлов не нужно.
