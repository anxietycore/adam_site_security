// mobile.js - КНОПОЧНАЯ ВЕРСИЯ БЕЗ ВВОДА С КЛАВИАТУРЫ
(() => {
    'use strict';

    // ==================== КОНФИГУРАЦИЯ ====================
    const CONFIG = {
        COLORS: {
            normal: '#00FF41', error: '#FF4444', warning: '#FFFF00', 
            system: '#FF00FF', white: '#FFFFFF', gray: '#AAAAAA'
        }
    };

    // ==================== ДАННЫЕ (ВСТАВЬ ОСТАЛЬНЫЕ) ====================
    const DATA = {
        dossiers: {
            '0X001': {
                name: 'ERICH VAN KOSS', role: 'Руководитель программы VIGIL-9',
                status: 'СВЯЗЬ ОТСУТСТВУЕТ', missions: 'MARS, OBSERVER',
                outcome: ['Попытка саботажа', 'Маяк уничтожен', 'Телеметрия прервана'],
                report: ['Классификация: SABOTAGE-3D', 'Перенос в OBSERVER']
            }
            // ИНСТРУКЦИЯ: ВСТАВЬ ОСТАЛЬНЫЕ ДОСЬЕ ИЗ terminal_canvas.js СЮДА
        },
        notes: {
            'NOTE_001': {
                title: 'ВЫ ЕГО ЧУВСТВУЕТЕ?', author: 'Dr. Rehn',
                content: ['Оно дышит', 'Оно знает имена', 'Терминал отвечает сам']
            }
            // ИНСТРУКЦИЯ: ВСТАВЬ ОСТАЛЬНЫЕ ЗАМЕТКИ СЮДА
        },
        decryptFiles: {
            '0XA71': {
                title: 'ПЕРВАЯ МИССИЯ', accessLevel: 'ALPHA',
                content: ['> ОБЪЕКТ: КАПСУЛА-003', '> СТАТУС: ЗАВЕРШЕНО С ПОТЕРЯМИ'],
                success: 'Данные восстановлены', failure: 'Попытки исчерпаны'
            }
            // ИНСТРУКЦИЯ: ВСТАВЬ ОСТАЛЬНЫЕ ФАЙЛЫ СЮДА
        }
    };

    // ==================== СОСТОЯНИЕ ====================
    const State = {
        lines: [],
        degradation: parseInt(localStorage.getItem('adam_degradation')) || 0,
        vigilCodes: JSON.parse(localStorage.getItem('vigilCodes')) || { alpha: null, beta: null, gamma: null },
        decryptBuffer: '', // буфер для ввода кода в DECRYPT
        decryptAttempts: 0,
        decryptCode: 0
    };

    // ==================== DOM ЭЛЕМЕНТЫ ====================
    const DOM = {
        terminal: document.getElementById('terminal'),
        statusBar: document.getElementById('statusBar'),
        degradationDisplay: document.getElementById('degradationDisplay'),
        buttonContainer: null // будем создавать динамически
    };

    // ==================== ГЛАВНЫЙ ОБЪЕКТ ====================
    const MobileTerminal = {
        init() {
            this.renderMainMenu();
            this.welcome();
            this.updateDegradationDisplay();
        },

        // ==================== РЕНДЕРИНГ КНОПОК ====================
        renderMainMenu() {
            // Удаляем старое меню если есть
            if (DOM.buttonContainer) DOM.buttonContainer.remove();
            
            DOM.buttonContainer = document.createElement('div');
            DOM.buttonContainer.id = 'quickCommands';
            DOM.buttonContainer.innerHTML = `
                <button class="quick-btn" data-cmd="DOSSIERS">ДОСЬЕ</button>
                <button class="quick-btn" data-cmd="FILES">ФАЙЛЫ</button>
                <button class="quick-btn" data-cmd="SYSTEM">СИСТЕМА</button>
                <button class="quick-btn" data-cmd="DECRYPT">ДЕКРИПТ</button>
                <button class="quick-btn" data-cmd="VIGIL999">VIGIL999</button>
            `;
            document.body.appendChild(DOM.buttonContainer);
            
            DOM.buttonContainer.addEventListener('click', (e) => {
                if (e.target.dataset.cmd) this.handleButtonClick(e.target.dataset.cmd);
            });
        },

        renderSubMenu(type, items) {
            // Удаляем главное меню
            DOM.buttonContainer.remove();
            
            let title = '';
            let buttons = '';
            
            if (type === 'DOSSIERS') {
                title = 'ВЫБЕРИ ДОСЬЕ:';
                for (const id in DATA.dossiers) {
                    buttons += `<button class="quick-btn" data-cmd="DSCR ${id}">${id}</button>`;
                }
            } else if (type === 'FILES') {
                title = 'ВЫБЕРИ ФАЙЛ:';
                for (const id in DATA.notes) {
                    buttons += `<button class="quick-btn" data-cmd="OPEN ${id}">${id}</button>`;
                }
            }
            
            DOM.buttonContainer = document.createElement('div');
            DOM.buttonContainer.id = 'quickCommands';
            DOM.buttonContainer.innerHTML = `
                <div class="menu-title">${title}</div>
                <div class="menu-buttons">${buttons}</div>
                <button class="quick-btn back-btn" data-cmd="BACK">НАЗАД</button>
            `;
            document.body.appendChild(DOM.buttonContainer);
            
            DOM.buttonContainer.addEventListener('click', (e) => {
                if (e.target.dataset.cmd) this.handleButtonClick(e.target.dataset.cmd);
            });
        },

        renderDecryptKeyboard() {
            // Удаляем главное меню
            DOM.buttonContainer.remove();
            
            DOM.buttonContainer = document.createElement('div');
            DOM.buttonContainer.id = 'quickCommands';
            DOM.buttonContainer.innerHTML = `
                <div class="menu-title">ВВЕДИТЕ КОД:</div>
                <div class="code-display">_ _ _</div>
                <div class="digit-grid">
                    <button class="digit-btn" data-digit="1">1</button>
                    <button class="digit-btn" data-digit="2">2</button>
                    <button class="digit-btn" data-digit="3">3</button>
                    <button class="digit-btn" data-digit="4">4</button>
                    <button class="digit-btn" data-digit="5">5</button>
                    <button class="digit-btn" data-digit="6">6</button>
                    <button class="digit-btn" data-digit="7">7</button>
                    <button class="digit-btn" data-digit="8">8</button>
                    <button class="digit-btn" data-digit="9">9</button>
                    <button class="digit-btn" data-digit="0">0</button>
                </div>
                <button class="quick-btn" data-cmd="DECRYPT_OK">ПОДТВЕРДИТЬ</button>
                <button class="quick-btn back-btn" data-cmd="BACK">НАЗАД</button>
            `;
            document.body.appendChild(DOM.buttonContainer);
            
            DOM.buttonContainer.addEventListener('click', (e) => {
                if (e.target.dataset.digit) {
                    this.addDecryptDigit(e.target.dataset.digit);
                } else if (e.target.dataset.cmd) {
                    this.handleButtonClick(e.target.dataset.cmd);
                }
            });
        },

        addDecryptDigit(digit) {
            if (State.decryptBuffer.length < 3) {
                State.decryptBuffer += digit;
                const display = document.querySelector('.code-display');
                display.textContent = State.decryptBuffer.padEnd(3, ' _').split('').join(' ');
            }
        },

        // ==================== ОБРАБОТКА КНОПОК ====================
        handleButtonClick(cmd) {
            if (cmd === 'BACK') {
                this.renderMainMenu();
                return;
            }
            
            if (cmd === 'DOSSIERS') {
                this.renderSubMenu('DOSSIERS');
                return;
            }
            
            if (cmd === 'FILES') {
                this.renderSubMenu('FILES');
                return;
            }
            
            if (cmd === 'SYSTEM') {
                this.cmdSyst();
                return;
            }
            
            if (cmd === 'DECRYPT') {
                this.startDecryptGame();
                return;
            }
            
            if (cmd === 'DECRYPT_OK') {
                this.finishDecryptGame();
                return;
            }
            
            if (cmd === 'VIGIL999') {
                this.cmdVigil999();
                return;
            }
            
            // Обработка команд с аргументами (DSCR 0X001)
            const parts = cmd.split(' ');
            if (parts[0] === 'DSCR' || parts[0] === 'OPEN') {
                this.processCommand(parts[0], parts[1]);
                this.renderMainMenu(); // возвращаемся в главное меню
            }
        },

        // ==================== ИГРА DECRYPT ====================
        startDecryptGame() {
            State.decryptBuffer = '';
            State.decryptAttempts = 5;
            State.decryptCode = Math.floor(100 + Math.random() * 900);
            this.renderDecryptKeyboard();
            this.addLine('[СИСТЕМА: ВВЕДИТЕ 3-Х ЗНАЧНЫЙ КОД]');
        },

        finishDecryptGame() {
            if (State.decryptBuffer.length !== 3) {
                this.addLine('ОШИБКА: Введите 3 цифры', CONFIG.COLORS.error);
                return;
            }
            
            const guess = parseInt(State.decryptBuffer);
            State.decryptAttempts--;
            
            if (guess === State.decryptCode) {
                this.addLine('> СИГНАЛ: КОД ВЕРИФИЦИРОВАН', CONFIG.COLORS.normal);
                this.addLine('> ДОСТУП ОТКРЫТ', CONFIG.COLORS.normal);
                this.addDegradation(-5);
            } else {
                this.addLine('> НЕПРАВИЛЬНЫЙ КОД', CONFIG.COLORS.error);
                if (State.decryptAttempts <= 0) {
                    this.addLine('> ДОСТУП ЗАПРЕЩЁН', CONFIG.COLORS.error);
                    this.addDegradation(3);
                } else {
                    this.addLine(`> ПОПЫТОК ОСТАЛОСЬ: ${State.decryptAttempts}`);
                    State.decryptBuffer = '';
                    document.querySelector('.code-display').textContent = '_ _ _';
                    return; // не возвращаемся в меню
                }
            }
            
            // Возвращаемся в главное меню
            this.renderMainMenu();
        },

        // ==================== ВЫПОЛНЕНИЕ КОМАНД ====================
        processCommand(cmd, arg) {
            switch(cmd) {
                case 'DSCR': this.cmdDscr(arg); break;
                case 'OPEN': this.cmdOpen(arg); break;
            }
        },

        // ==================== САМИ КОМАНДЫ ====================
        cmdDscr(id) {
            if (!id || !DATA.dossiers[id]) {
                this.addLine('ОШИБКА: Досье не найдено', CONFIG.COLORS.error);
                return;
            }
            const d = DATA.dossiers[id];
            this.addLine(`[ДОСЬЕ — ${id}]`);
            this.addLine(`ИМЯ: ${d.name}`);
            this.addLine(`СТАТУС: ${d.status}`);
            this.addLine('------------------------------------');
            d.outcome.forEach(line => this.addLine(`> ${line}`, CONFIG.COLORS.error));
        },

        cmdOpen(id) {
            if (!id || !DATA.notes[id]) {
                this.addLine('ОШИБКА: Файл не найден', CONFIG.COLORS.error);
                return;
            }
            const n = DATA.notes[id];
            this.addLine(`[${id} — ${n.title}]`);
            this.addLine(`АВТОР: ${n.author}`);
            this.addLine('------------------------------------');
            n.content.forEach(line => this.addLine(`> ${line}`));
        },

        cmdSyst() {
            this.addLine('[СТАТУС СИСТЕМЫ]');
            this.addLine(`ДЕГРАДАЦИЯ: ${State.degradation}%`);
            this.addLine('> ОЖИДАЕТСЯ КОМАНДА');
        },

        cmdVigil999() {
            const keys = State.vigilCodes;
            this.addLine('ПРОВЕРКА КЛЮЧЕЙ:');
            this.addLine(`ALPHA: ${keys.alpha || '—'}`);
            this.addLine(`BETA: ${keys.beta || '—'}`);
            this.addLine(`GAMMA: ${keys.gamma || '—'}`);
            
            if (keys.alpha === '375' && keys.beta === '814' && keys.gamma === '291') {
                this.addLine('> ДОСТУП РАЗРЕШЁН', CONFIG.COLORS.normal);
                setTimeout(() => window.location.href = 'observer-7.html', 2000);
            } else {
                this.addLine('> ДОСТУП ЗАПРЕЩЁН', CONFIG.COLORS.error);
            }
        },

        // ==================== УТИЛИТЫ ====================
        addLine(text, color = CONFIG.COLORS.normal) {
            const line = document.createElement('div');
            line.className = 'line';
            line.style.color = color;
            line.textContent = text;
            DOM.terminal.appendChild(line);
            State.lines.push({ text, color });
            
            if (State.lines.length > 300) {
                DOM.terminal.removeChild(DOM.terminal.firstChild);
                State.lines.shift();
            }
            
            DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
        },

        addDegradation(amount) {
            State.degradation = Math.max(0, Math.min(100, State.degradation + amount));
            localStorage.setItem('adam_degradation', String(State.degradation));
            this.updateDegradationDisplay();
        },

        updateDegradationDisplay() {
            DOM.degradationDisplay.textContent = `ДЕГРАДАЦИЯ: ${State.degradation}%`;
        },

        welcome() {
            this.addLine('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН');
            this.addLine('> ВВЕДИТЕ "help" ЧЕРЕЗ КНОПКИ СНИЗУ');
        }
    };

    // ==================== СТИЛИ ДЛЯ НОВЫХ ЭЛЕМЕНТОВ ====================
    const style = document.createElement('style');
    style.textContent = `
        .menu-title { text-align: center; margin-bottom: 10px; font-size: 11px; color: #FFFF00; }
        .menu-buttons { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
        .digit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin: 10px 0; }
        .digit-btn { background: rgba(0, 20, 10, 0.8); border: 1px solid #00FF41; color: #00FF41; font-family: 'Press Start 2P'; font-size: 16px; padding: 15px; border-radius: 6px; cursor: pointer; }
        .digit-btn:active { background: rgba(0, 255, 65, 0.3); }
        .code-display { text-align: center; font-size: 20px; letter-spacing: 5px; margin: 10px 0; color: #00FF41; }
        .back-btn { background: rgba(100, 0, 0, 0.5) !important; border-color: #FF4444 !important; color: #FF4444 !important; }
    `;
    document.head.appendChild(style);

    // ==================== ЗАПУСК ====================
    document.addEventListener('DOMContentLoaded', () => MobileTerminal.init());
})();
