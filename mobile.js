// mobile.js - МОБИЛЬНАЯ ВЕРСИЯ ТЕРМИНАЛА A.D.A.M. (СТАБИЛЬНАЯ)
(() => {
    'use strict';

    // ==================== КОНФИГУРАЦИЯ ====================
    const CONFIG = {
        MAX_LINES: 300,
        COLORS: {
            normal: '#00FF41',
            error: '#FF4444',
            warning: '#FFFF00',
            system: '#FF00FF',
            white: '#FFFFFF',
            gray: '#AAAAAA'
        }
    };

    // ==================== ДАННЫЕ (ДОБАВЬ ОСТАЛЬНЫЕ) ====================
    // ПРИМЕР ФОРМАТА - ДОБАВЬ ОСТАЛЬНЫЕ ДАННЫЕ ИЗ terminal_canvas.js
    const DATA = {
        dossiers: {
            '0X001': {
                name: 'ERICH VAN KOSS',
                role: 'Руководитель программы VIGIL-9',
                status: 'СВЯЗЬ ОТСУТСТВУЕТ',
                outcome: ['Попытка саботажа', 'Маяк уничтожен', 'Телеметрия прервана'],
                report: ['Классификация: SABOTAGE-3D', 'Перенос в OBSERVER'],
                missions: 'MARS, OBSERVER',
                audioDesc: 'Последняя передача'
            }
            // ИНСТРУКЦИЯ: ВСТАВЬ ОСТАЛЬНЫЕ ДОСЬЕ ИЗ terminal_canvas.js СЮДА
        },
        
        notes: {
            'NOTE_001': {
                title: 'ВЫ ЕГО ЧУВСТВУЕТЕ?',
                author: 'Dr. Rehn',
                content: ['Оно дышит', 'Оно знает имена', 'Терминал отвечает сам']
            }
            // ИНСТРУКЦИЯ: ВСТАВЬ ОСТАЛЬНЫЕ ЗАМЕТКИ СЮДА
        },
        
        decryptFiles: {
            '0XA71': {
                title: 'ПЕРВАЯ МИССИЯ',
                accessLevel: 'ALPHA',
                content: ['> ОБЪЕКТ: КАПСУЛА-003', '> СТАТУС: ЗАВЕРШЕНО С ПОТЕРЯМИ', 'ОПИСАНИЕ: Тест фазового прыжка', 'РЕЗУЛЬТАТ: Экипаж утрачен'],
                success: 'Данные восстановлены',
                failure: 'Попытки исчерпаны'
            }
            // ИНСТРУКЦИЯ: ВСТАВЬ ОСТАЛЬНЫЕ ФАЙЛЫ СЮДА
        }
    };

    // ==================== СОСТОЯНИЕ ====================
    const State = {
        lines: [],
        currentLine: '',
        degradation: parseInt(localStorage.getItem('adam_degradation')) || 0,
        isFrozen: false,
        isTyping: false,
        isConfirming: false,
        confirmCallback: null,
        vigilCodes: JSON.parse(localStorage.getItem('vigilCodes')) || { alpha: null, beta: null, gamma: null }
    };

    // ==================== DOM ЭЛЕМЕНТЫ ====================
    const DOM = {
        terminal: document.getElementById('terminal'),
        statusBar: document.getElementById('statusBar'),
        degradationDisplay: document.getElementById('degradationDisplay'),
        quickCmds: document.getElementById('quickCommands'),
        hiddenInput: document.getElementById('hiddenInput'),
        confirmModal: document.getElementById('confirmModal'),
        confirmText: document.getElementById('confirmText'),
        confirmY: document.getElementById('confirmY'),
        confirmN: document.getElementById('confirmN')
    };

    // ==================== ГЛАВНЫЙ ОБЪЕКТ ====================
    const MobileTerminal = {
        async init() {
            this.setupEventListeners();
            await this.welcome();
            this.updateDegradationDisplay();
            this.addInputLine();
        },

setupEventListeners() {
    // ОТКЛЮЧАЕМ АВТОПРОКРУТКУ БРАУЗЕРА
    document.body.addEventListener('focusin', (e) => {
        if (e.target === DOM.hiddenInput) {
            setTimeout(() => {
                window.scrollTo(0, 0);
                DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
            }, 100);
        }
    });

    // ОБРАБОТКА ВВОДА БЕЗ ИНВЕРСИИ
    let lastValue = '';
    DOM.hiddenInput.addEventListener('input', (e) => {
        if (State.isFrozen) return;
        
        // Берем значение КАК ЕСТЬ, без всяких манипуляций
        State.currentLine = e.target.value;
        this.updateInputLine();
        
        // ПРИНУДИТЕЛЬНО ДЕРЖИМ ВНИЗУ
        DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
    });

    // ОТПРАВКА КОМАНДЫ
    DOM.hiddenInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.submitCommand();
        }
    });

    // БЫСТРЫЕ КНОПКИ
    DOM.quickCmds.addEventListener('click', (e) => {
        if (e.target.dataset.cmd && !State.isFrozen) {
            this.setCommand(e.target.dataset.cmd);
            this.submitCommand();
        }
    });

    // МОДАЛЬНОЕ ОКНО
    DOM.confirmY.addEventListener('click', () => this.handleConfirm(true));
    DOM.confirmN.addEventListener('click', () => this.handleConfirm(false));
}

        // ==================== ОТОБРАЖЕНИЕ ====================
        addLine(text, color = CONFIG.COLORS.normal, isInput = false) {
            const line = document.createElement('div');
            line.className = 'line';
            line.style.color = color;
            line.textContent = text;
            DOM.terminal.appendChild(line);
            State.lines.push({ text, color });

            if (State.lines.length > CONFIG.MAX_LINES) {
                DOM.terminal.removeChild(DOM.terminal.firstChild);
                State.lines.shift();
            }

            // ПРОКРУЧИВАЕМ ВНИЗ, А НЕ ВВЕРХ
            DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
        },

        async typeText(text, color = CONFIG.COLORS.normal) {
            State.isTyping = true;
            const line = document.createElement('div');
            line.className = 'line';
            line.style.color = color;
            DOM.terminal.appendChild(line);

            for (let char of text) {
                line.textContent += char;
                // ПРОКРУЧИВАЕМ ВНИЗ ПРИ ПЕЧАТИ
                DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
                await new Promise(r => setTimeout(r, 30));
            }

            State.lines.push({ text, color });
            State.isTyping = false;
        },

        updateInputLine() {
            const lines = DOM.terminal.querySelectorAll('.line');
            const last = lines[lines.length - 1];
            if (last && last.textContent.startsWith('adam@mobile:~$')) {
                last.textContent = `adam@mobile:~$ ${State.currentLine}`;
            }
        },

        addInputLine() {
            if (!State.isFrozen) this.addLine('adam@mobile:~$ ', CONFIG.COLORS.normal, true);
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

        async submitCommand() {
            if (State.isFrozen || State.isTyping) return;

            const cmdLine = State.currentLine.trim();
            if (!cmdLine) {
                this.addInputLine();
                return;
            }

            // Убираем предыдущую строку ввода
            const lines = DOM.terminal.querySelectorAll('.line');
            if (lines.length > 0 && lines[lines.length - 1].textContent.startsWith('adam@mobile:~$')) {
                lines[lines.length - 1].textContent = `adam@mobile:~$ ${cmdLine}`;
                lines[lines.length - 1].style.color = CONFIG.COLORS.white;
            }

            State.currentLine = '';
            DOM.hiddenInput.value = '';

            // ПРОКРУЧИВАЕМ ВНИЗ ПОСЛЕ КОМАНДЫ
            DOM.terminal.scrollTop = DOM.terminal.scrollHeight;

            this.addDegradation(1);
            await this.processCommand(cmdLine);
            this.addInputLine();
        },

        // ==================== ОБРАБОТКА КОМАНД ====================
        async processCommand(cmdLine) {
            const parts = cmdLine.toLowerCase().split(' ').filter(Boolean);
            const cmd = parts[0];
            const args = parts.slice(1);

            switch(cmd) {
                case 'help': this.cmdHelp(); break;
                case 'syst': this.cmdSyst(); break;
                case 'syslog': this.cmdSyslog(); break;
                case 'subj': this.cmdSubj(); break;
                case 'notes': this.cmdNotes(); break;
                case 'open': await this.cmdOpen(args[0]); break;
                case 'dscr': await this.cmdDscr(args[0]); break;
                case 'decrypt': await this.cmdDecrypt(args[0]); break;
                case 'trace': await this.cmdTrace(args[0]); break;
                case 'playaudio': await this.cmdPlayAudio(args[0]); break;
                case 'net_mode': this.cmdNetMode(); break;
                case 'net_check': this.cmdNetCheck(); break;
                case 'clear': this.cmdClear(); break;
                case 'reset': await this.cmdReset(); break;
                case 'exit': await this.cmdExit(); break;
                case 'deg': this.cmdDeg(args[0]); break;
                case 'alpha': case 'beta': case 'gamma': this.cmdVigilKey(cmd, args[0]); break;
                case 'vigil999': await this.cmdVigil999(); break;
                default: this.addLine(`команда не найдена: ${cmdLine}`, CONFIG.COLORS.error);
            }
        },

        // ==================== КОМАНДЫ ====================
        cmdHelp() {
            const help = [
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
            ];
            help.forEach(line => this.addLine(line));
        },

        cmdSyst() {
            this.addLine('[СТАТУС СИСТЕМЫ — MOBILE V2]');
            this.addLine('------------------------------------');
            this.addLine('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН');
            this.addLine('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА');
            this.addLine('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН');
            this.addLine('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА');
            this.addLine('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН');
            const color = State.degradation > 80 ? CONFIG.COLORS.error :
                         State.degradation > 60 ? CONFIG.COLORS.warning :
                         CONFIG.COLORS.normal;
            this.addLine(`ДЕГРАДАЦИЯ: ${State.degradation}%`, color);
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
                this.addLine(`${id.toLowerCase()} | ${d.name} | СТАТУС: ${d.status}`, color);
            }
            this.addLine('--------------------------------------------------------');
            this.addLine('ИНСТРУКЦИЯ: DSCR <ID> для просмотра');
        },

        cmdNotes() {
            this.addLine('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / NOTES]');
            this.addLine('------------------------------------');
            for (const [id, n] of Object.entries(DATA.notes)) {
                this.addLine(`${id} — "${n.title}" / ${n.author}`);
            }
            this.addLine('------------------------------------');
            this.addLine('ИНСТРУКЦИЯ: OPEN <ID>');
        },

        async cmdOpen(noteId) {
            if (!noteId) {
                this.addLine('ОШИБКА: Укажите ID файла', CONFIG.COLORS.error);
                return;
            }
            const id = noteId.toUpperCase();
            const note = DATA.notes[id];
            if (!note) {
                this.addLine(`ОШИБКА: Файл ${id} не найден`, CONFIG.COLORS.error);
                return;
            }
            this.addLine(`[${id} — "${note.title}"]`);
            this.addLine(`АВТОР: ${note.author}`);
            this.addLine('------------------------------------');
            if (Math.random() > 0.7 && id !== 'NOTE_001') {
                this.addLine('ОШИБКА: Данные повреждены', CONFIG.COLORS.error);
                this.addLine('Восстановление невозможно', CONFIG.COLORS.error);
            } else {
                note.content.forEach(line => this.addLine(`> ${line}`));
            }
            this.addLine('------------------------------------');
            this.addLine('[ФАЙЛ ЗАКРЫТ]');
        },

        async cmdDscr(subjectId) {
            if (!subjectId) {
                this.addLine('ОШИБКА: Укажите ID субъекта', CONFIG.COLORS.error);
                return;
            }
            const id = subjectId.toUpperCase();
            const d = DATA.dossiers[id];
            if (!d) {
                this.addLine(`ОШИБКА: Досье ${id} не найдено`, CONFIG.COLORS.error);
                return;
            }
            this.addLine(`[ДОСЬЕ — ID: ${id}]`);
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
                this.addLine(`> Используйте: PLAYAUDIO ${id}`);
            }
        },

        async cmdDecrypt(fileId) {
            if (!fileId) {
                this.addLine('ОШИБКА: Укажите ID файла', CONFIG.COLORS.error);
                return;
            }
            const id = fileId.toUpperCase();
            const file = DATA.decryptFiles[id];
            if (!file) {
                this.addLine(`ОШИБКА: Файл ${id} не найден`, CONFIG.COLORS.error);
                return;
            }
            if (id === 'CORE' && State.degradation < 50) {
                this.addLine('ОШИБКА: УРОВЕНЬ ДОСТУПА НЕДОСТАТОЧЕН', CONFIG.COLORS.error);
                return;
            }
            
            State.isFrozen = true;
            this.addLine('[СИСТЕМА: ЗАПУЩЕН ПРОТОКОЛ РАСШИФРОВКИ]');
            this.addLine(`> ФАЙЛ: ${file.title}`);
            this.addLine(`> УРОВЕНЬ ДОСТУПА: ${file.accessLevel}`);
            
            // МИНИ-ИГРА: УГАДАЙ ЧИСЛО
            const code = Math.floor(100 + Math.random() * 900);
            let attempts = 5;
            let input = '';
            
            this.addLine(`> КОД ДОСТУПА: 3 ЦИФРЫ`);
            this.addLine(`> ПОПЫТОК ОСТАЛОСЬ: ${attempts}`);
            this.addLine(`> ВВЕДИТЕ КОД: ___`);
            
            const handleInput = (e) => {
                if (e.key === 'Enter') {
                    if (input.length === 3) {
                        const guess = parseInt(input);
                        attempts--;
                        
                        if (guess === code) {
                            // УСПЕХ
                            document.removeEventListener('keydown', handleInput);
                            State.isFrozen = false;
                            this.addLine('> СИГНАЛ: КОД ВЕРИФИЦИРОВАН', CONFIG.COLORS.normal);
                            this.addLine(`[ФАЙЛ РАСШИФРОВАН: ${file.title}]`);
                            this.addLine('------------------------------------');
                            file.content.forEach(line => this.addLine(line));
                            this.addLine('------------------------------------');
                            this.addLine(`> ${file.success}`, CONFIG.COLORS.normal);
                            this.addDegradation(-5);
                            if (id === 'CORE') {
                                this.addLine('> КЛЮЧ АЛЬФА: 375', CONFIG.COLORS.normal);
                                this.addLine('> Используйте команду ALPHA для фиксации ключа', CONFIG.COLORS.warning);
                            }
                        } else {
                            // НЕУДАЧА
                            const diff = Math.abs(guess - code);
                            const hint = guess < code ? '[↑] БОЛЬШЕ' : '[↓] МЕНЬШЕ';
                            this.addLine(`> ${hint}`);
                            
                            if (attempts <= 0) {
                                document.removeEventListener('keydown', handleInput);
                                State.isFrozen = false;
                                this.addLine('> СИСТЕМА: ДОСТУП ЗАПРЕЩЁН', CONFIG.COLORS.error);
                                this.addLine(`> ${file.failure}`, CONFIG.COLORS.error);
                                this.addDegradation(3);
                            } else {
                                this.addLine(`> ПОПЫТОК ОСТАЛОСЬ: ${attempts}`);
                                this.addLine(`> ВВЕДИТЕ КОД: ___`);
                                input = '';
                                DOM.hiddenInput.value = '';
                            }
                        }
                    }
                } else if (e.key === 'Backspace') {
                    input = input.slice(0, -1);
                } else if (/[0-9]/.test(e.key) && input.length < 3) {
                    input += e.key;
                }
            };
            
            document.addEventListener('keydown', handleInput);
        },

        async cmdTrace(target) {
            if (!target) {
                this.addLine('ОШИБКА: Укажите цель', CONFIG.COLORS.error);
                return;
            }
            
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
            
            State.isFrozen = true;
            this.addLine('[СИСТЕМА: РАСКРЫТИЕ КАРТЫ]');
            this.addLine(`> ЦЕЛЬ: ${t.name}`);
            this.addLine(`> СТАТУС: ${t.status}`);
            this.addLine(`> РИСК: ${t.risk === 2 ? 'ВЫСОКИЙ' : 'СРЕДНИЙ'}`);
            
            // АНИМАЦИЯ ЗАГРУЗКИ
            let progress = 0;
            const loading = this.addLine(`> АНАЛИЗ [${' '.repeat(10)}]`, CONFIG.COLORS.normal);
            
            const interval = setInterval(() => {
                progress += 10;
                const filled = Math.floor(progress / 10);
                loading.textContent = `> АНАЛИЗ [${'|'.repeat(filled)}${' '.repeat(10 - filled)}] ${progress}%`;
                
                if (progress >= 100) {
                    clearInterval(interval);
                    State.isFrozen = false;
                    this.addDegradation(t.risk === 2 ? 2 : -1);
                    if (target === 'monolith') {
                        this.addLine('> КЛЮЧ ГАММА: 291', CONFIG.COLORS.normal);
                        this.addLine('> Используйте команду GAMMA для фиксации ключа', CONFIG.COLORS.warning);
                    }
                }
            }, 100);
        },

        async cmdPlayAudio(id) {
            if (!id) {
                this.addLine('ОШИБКА: Укажите ID досье', CONFIG.COLORS.error);
                return;
            }
            const d = DATA.dossiers[id.toUpperCase()];
            if (!d?.audioDesc) {
                this.addLine('ОШИБКА: Аудио не найдено', CONFIG.COLORS.error);
                return;
            }
            this.addLine(`[АУДИО: ${d.audioDesc}]`, CONFIG.COLORS.warning);
            this.addLine('> Воспроизведение ограничено на мобильных', CONFIG.COLORS.gray);
            await this.sleep(1000);
            this.addLine('> [АУДИО: ВОСПРОИЗВЕДЕНИЕ ЗАПИСИ]');
            await this.sleep(2000);
            this.addLine('> [АУДИО: ЗАПИСЬ ЗАВЕРШЕНА]');
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
            this.addLine('> ТЕРМИНАЛ ОЧИЩЕН');
        },

        async cmdReset() {
            const confirmed = await this.showConfirmation('Подтвердить сброс? (Y/N)');
            if (confirmed) {
                this.clear();
                State.degradation = 0;
                this.updateDegradationDisplay();
                State.vigilCodes = { alpha: null, beta: null, gamma: null };
                localStorage.setItem('vigilCodes', JSON.stringify(State.vigilCodes));
                await this.welcome();
            } else {
                this.addLine('[ОТМЕНА]');
            }
        },

        async cmdExit() {
            const confirmed = await this.showConfirmation('Выйти? (Y/N)');
            if (confirmed) {
                this.addLine('> СОЕДИНЕНИЕ ПРЕРВАНО.');
                setTimeout(() => window.location.href = 'index.html', 1500);
            } else {
                this.addLine('[ОТМЕНА]');
            }
        },

        cmdDeg(level) {
            const newLevel = parseInt(level);
            if (isNaN(newLevel) || newLevel < 0 || newLevel > 100) {
                this.addLine('ОШИБКА: Уровень 0-100', CONFIG.COLORS.error);
                return;
            }
            this.setDegradation(newLevel);
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
                this.addLine('> ПЕРЕХОД В РЕЖИМ НАБЛЮДЕНИЯ...');
                setTimeout(() => window.location.href = 'observer-7.html', 3000);
            } else {
                this.addLine('> АКТИВАЦИЯ ОТМЕНЕНА');
            }
        },

        // ==================== УТИЛИТЫ ====================
        addDegradation(amount) {
            this.setDegradation(Math.max(0, Math.min(100, State.degradation + amount)));
        },

        setDegradation(level) {
            State.degradation = level;
            localStorage.setItem('adam_degradation', String(level));
            this.updateDegradationDisplay();
        },

        updateDegradationDisplay() {
            DOM.degradationDisplay.textContent = `ДЕГРАДАЦИЯ: ${State.degradation}%`;
            let color = CONFIG.COLORS.normal;
            if (State.degradation > 80) color = CONFIG.COLORS.error;
            else if (State.degradation > 60) color = CONFIG.COLORS.warning;
            DOM.degradationDisplay.style.color = color;
        },

        async showLoading(duration, text = "ЗАГРУЗКА") {
            const start = Date.now();
            const loading = this.addLine(`> ${text} [          ]`, CONFIG.COLORS.normal);
            
            const interval = setInterval(() => {
                const elapsed = Date.now() - start;
                const progress = Math.min(100, (elapsed / duration) * 100);
                const filled = Math.floor(progress / 10);
                loading.textContent = `> ${text} [${'|'.repeat(filled)}${' '.repeat(10 - filled)}] ${Math.floor(progress)}%`;
                
                if (progress >= 100) {
                    clearInterval(interval);
                    loading.textContent = `> ${text} [ЗАВЕРШЕНО]`;
                }
            }, 50);
            
            await new Promise(r => setTimeout(r, duration));
        },

        showConfirmation(text) {
            return new Promise((resolve) => {
                State.isConfirming = true;
                State.confirmCallback = resolve;
                DOM.confirmText.textContent = text;
                DOM.confirmModal.style.display = 'block';
                DOM.hiddenInput.focus();
                
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
        },

        async welcome() {
            await this.typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН');
            await this.typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР');
            await this.typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД');
        }
    };

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================
    window.MobileTerminal = MobileTerminal;
    document.addEventListener('DOMContentLoaded', () => MobileTerminal.init());
})();

// ==================== ИНСТРУКЦИЯ ПО ДОБАВЛЕНИЮ ДАННЫХ ====================
// 1. Открой terminal_canvas.js
// 2. Найди const dossiers = { ... }
// 3. Скопируй ВСЕ содержимое dossiers
// 4. Вставь в mobile.js в объект DATA.dossiers (после 0X001)
// 5. Тоже самое сделай для notes и decryptFiles
// 6. ГОТОВО. Никаких других файлов не нужно.
