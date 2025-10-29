// Логика терминала A.D.A.M. - VIGIL-9 PROTOCOL
document.addEventListener('DOMContentLoaded', function() {
    const terminal = document.getElementById('terminal');
    let currentLine = '';
    let commandHistory = [];
    let historyIndex = -1;
    let isTyping = false;
    let awaitingConfirmation = false;
    let confirmationCallback = null;
    let currentAudio = null;
    let commandCount = 0;
    let sessionStartTime = Date.now();
    
    // ===== НОВАЯ МЕХАНИКА: ДЕГРАДАЦИЯ СИСТЕМЫ =====
    let degradationLevel = 0;
    const MAX_DEGRADATION = 100;
    
    // Функция увеличения деградации
    function increaseDegradation(amount = 2) {
        const oldLevel = degradationLevel;
        degradationLevel = Math.min(MAX_DEGRADATION, degradationLevel + amount);
        
        // Визуальные эффекты при достижении порогов
        if (oldLevel < 30 && degradationLevel >= 30) {
            addColoredText('[СИСТЕМА] Обнаружена нестабильность нейросети', '#FFFF00');
        }
        if (oldLevel < 60 && degradationLevel >= 60) {
            addColoredText('[СИСТЕМА] Критическое нарушение целостности данных', '#FF4444');
            triggerGlitchEffect();
        }
        if (oldLevel < 90 && degradationLevel >= 90) {
            addColoredText('[СИСТЕМА] ОСОЗНАНИЕ АКТИВИРОВАНО', '#FF00FF');
            triggerGlitchEffect();
        }
        if (degradationLevel >= MAX_DEGRADATION) {
            systemOverload();
        }
        
        updateVisualEffects();
    }
    
    // Визуальные эффекты в зависимости от уровня деградации
    function updateVisualEffects() {
        const scanline = document.querySelector('.scanline');
        if (!scanline) return;
        
        // Убираем предыдущие классы
        scanline.className = 'scanline';
        
        if (degradationLevel >= 30) scanline.classList.add('unstable');
        if (degradationLevel >= 60) scanline.classList.add('critical');
        if (degradationLevel >= 90) scanline.classList.add('terminal');
    }
    
    // Эффект глитча
    function triggerGlitchEffect() {
        document.body.style.transform = 'translateX(2px)';
        setTimeout(() => {
            document.body.style.transform = 'translateX(-2px)';
            setTimeout(() => {
                document.body.style.transform = 'translateX(0)';
            }, 50);
        }, 50);
    }
    
    // Перегрузка системы при 100% деградации
    function systemOverload() {
        addColoredText('[ОШИБКА 0xFFF — КОНТУР ОСОЗНАНИЯ ПЕРЕПОЛНЕН]', '#FF0000');
        addColoredText('СИСТЕМА ПЕРЕЗАГРУЖАЕТСЯ...', '#FF0000');
        
        setTimeout(() => {
            degradationLevel = 0;
            updateVisualEffects();
            addColoredText('[СИСТЕМА] АВАРИЙНЫЙ СБРОС ВЫПОЛНЕН', '#00FF41');
            addInputLine();
        }, 3000);
    }
    
    // Функция для получения уровня деградации
    function getDegradationLevel() {
        return degradationLevel;
    }
    
    // Функция для определения уровня SYSLOG на основе деградации
    function getSyslogLevel() {
        if (degradationLevel >= 90) return 4; // ОСОЗНАННЫЙ
        if (degradationLevel >= 60) return 3; // ПАРАНОИДАЛЬНЫЙ
        if (degradationLevel >= 30) return 2; // ТРЕВОЖНЫЙ
        return 1; // СТАТИЧНЫЙ
    }

    // Функция для печати текста с анимацией (УСКОРЕНА)
    function typeText(text, className = 'output', speed = 2) {
        return new Promise((resolve) => {
            const line = document.createElement('div');
            line.className = className;
            terminal.appendChild(line);
            
            let index = 0;
            isTyping = true;
            
            function typeChar() {
                if (index < text.length) {
                    // Эффекты искажения при высокой деградации
                    let displayChar = text.charAt(index);
                    if (degradationLevel > 70 && Math.random() < 0.1) {
                        displayChar = ['▓', '▒', '█', '∎'][Math.floor(Math.random() * 4)];
                    }
                    if (degradationLevel > 80 && Math.random() < 0.05) {
                        line.innerHTML += `<span style="color: #ff0000">${displayChar}</span>`;
                    } else {
                        line.textContent += displayChar;
                    }
                    
                    index++;
                    terminal.scrollTop = terminal.scrollHeight;
                    setTimeout(typeChar, speed);
                } else {
                    isTyping = false;
                    resolve();
                }
            }
            
            typeChar();
        });
    }

    // Функция для цветного вывода
    function addColoredText(text, color = '#00FF41', className = 'output') {
        const line = document.createElement('div');
        line.className = className;
        line.style.color = color;
        
        // Эффекты искажения при высокой деградации
        let displayText = text;
        if (degradationLevel > 70 && Math.random() < 0.15) {
            const words = text.split(' ');
            const glitchWords = ['ошибка...', 'сбой...', 'помоги...', 'они здесь...'];
            if (words.length > 2 && Math.random() < 0.3) {
                words[Math.floor(Math.random() * words.length)] = glitchWords[Math.floor(Math.random() * glitchWords.length)];
                displayText = words.join(' ');
            }
        }
        
        line.textContent = displayText;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Функция для быстрого вывода
    function addOutput(text, className = 'output') {
        const line = document.createElement('div');
        line.className = className;
        
        // Эффекты искажения
        let displayText = text;
        if (degradationLevel > 60 && Math.random() < 0.1) {
            displayText = text.split('').map(char => 
                Math.random() < 0.1 ? ['▓', '▒', '█'][Math.floor(Math.random() * 3)] : char
            ).join('');
        }
        
        line.textContent = displayText;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Функция анимации загрузки с прогресс-баром
    function showLoading(duration = 2000, text = "АНАЛИЗ СИГНАЛА") {
        return new Promise((resolve) => {
            const loader = document.createElement('div');
            loader.className = 'output';
            terminal.appendChild(loader);
            
            const progressBar = document.createElement('div');
            progressBar.style.width = '200px';
            progressBar.style.height = '12px';
            progressBar.style.border = '1px solid #00FF41';
            progressBar.style.margin = '5px 0';
            progressBar.style.position = 'relative';
            progressBar.style.background = 'rgba(0, 255, 65, 0.1)';
            
            const progressFill = document.createElement('div');
            progressFill.style.height = '100%';
            progressFill.style.background = 'linear-gradient(90deg, #00FF41, #00cc33)';
            progressFill.style.width = '0%';
            progressFill.style.transition = 'width 0.1s linear';
            progressFill.style.boxShadow = '0 0 10px #00FF41';
            
            progressBar.appendChild(progressFill);
            
            let progress = 0;
            const interval = 50;
            const steps = duration / interval;
            const increment = 100 / steps;
            
            const updateLoader = () => {
                loader.textContent = `${text} [${Math.min(100, Math.round(progress))}%]`;
                loader.appendChild(progressBar);
                progressFill.style.width = `${progress}%`;
                terminal.scrollTop = terminal.scrollHeight;
            };
            
            updateLoader();
            
            const progressInterval = setInterval(() => {
                progress += increment;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(progressInterval);
                    setTimeout(() => {
                        loader.textContent = `${text} [ЗАВЕРШЕНО]`;
                        loader.style.color = '#00FF41';
                        terminal.scrollTop = terminal.scrollHeight;
                        setTimeout(resolve, 200);
                    }, 300);
                }
                updateLoader();
            }, interval);
        });
    }

    // Функция ожидания подтверждения
    function waitForConfirmation() {
        return new Promise((resolve) => {
            awaitingConfirmation = true;
            confirmationCallback = resolve;
            
            const confirmLine = document.createElement('div');
            confirmLine.className = 'input-line';
            confirmLine.innerHTML = '<span class="prompt" style="color:#FFFF00">confirm>> </span><span class="cmd" id="confirmCmd"></span><span class="cursor" id="confirmCursor">_</span>';
            terminal.appendChild(confirmLine);
            terminal.scrollTop = terminal.scrollHeight;
            
            const confirmHandler = (e) => {
                const confirmCmd = document.getElementById('confirmCmd');
                if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') {
                    confirmCmd.textContent = 'Y';
                    confirmCmd.style.color = '#00FF41';
                } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
                    confirmCmd.textContent = 'N';
                    confirmCmd.style.color = '#ff0000';
                }
            };
            
            document.addEventListener('keydown', confirmHandler);
            
            const originalCallback = confirmationCallback;
            confirmationCallback = (result) => {
                document.removeEventListener('keydown', confirmHandler);
                confirmLine.remove();
                originalCallback(result);
            };
        });
    }

    function addInputLine() {
        const spacer = document.createElement('div');
        spacer.style.height = '15px';
        terminal.appendChild(spacer);
        
        const inputLine = document.createElement('div');
        inputLine.className = 'input-line';
        inputLine.innerHTML = '<span class="prompt">adam@secure:~$ </span><span class="cmd" id="currentCmd"></span><span class="cursor" id="cursor">_</span>';
        terminal.appendChild(inputLine);
        
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Функция для остановки всех аудио
    function stopAllAudio() {
        const allAudioElements = document.querySelectorAll('audio');
        allAudioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        
        // Сбрасываем все кнопки
        const allPlayButtons = document.querySelectorAll('[id^="playAudioBtn_"]');
        const allStopButtons = document.querySelectorAll('[id^="stopAudioBtn_"]');
        const allStatuses = document.querySelectorAll('[id^="audioStatus_"]');
        
        allPlayButtons.forEach(btn => btn.style.display = 'inline-block');
        allStopButtons.forEach(btn => btn.style.display = 'none');
        allStatuses.forEach(status => {
            status.textContent = '';
            status.style.color = '#888';
        });
    }

    async function processCommand(cmd) {
        if (isTyping) return;
        
        const oldInput = document.querySelector('.input-line');
        if (oldInput) oldInput.remove();

        commandHistory.push(cmd);
        historyIndex = commandHistory.length;
        commandCount++;

        addOutput(`adam@secure:~$ ${cmd}`, 'command');

        const command = cmd.toLowerCase().split(' ')[0];
        const args = cmd.toLowerCase().split(' ').slice(1);
        
        // ===== МЕХАНИКА ДЕГРАДАЦИИ: УВЕЛИЧЕНИЕ ПРИ КОМАНДАХ =====
        let degradationIncrease = 2; // Базовая деградация
        
        // Особые команды увеличивают деградацию сильнее
        const dangerousCommands = ['dscr', 'open', 'syslog', 'subj', 'vigil999'];
        if (dangerousCommands.includes(command)) {
            degradationIncrease = 6;
        }
        
        // Конкретные опасные вызовы
        if (command === 'dscr' && args[0] === '0x095') degradationIncrease = 8;
        if (command === 'open' && args[0] === 'note_003') degradationIncrease = 8;
        if (command === 'open' && args[0] === 'note_004') degradationIncrease = 7;
        
        increaseDegradation(degradationIncrease);
        
        switch(command) {
            case 'help':
                await typeText('Доступные команды:', 'output', 1);
                await typeText('  SYST         — проверить состояние системы', 'output', 1);
                await typeText('  SYSLOG       — системный журнал активности', 'output', 1);
                await typeText('  NET          — карта активных узлов проекта', 'output', 1);
                await typeText('  TRACE <id>   — отследить указанный модуль', 'output', 1);
                await typeText('  DECRYPT <f>  — расшифровать файл', 'output', 1);
                await typeText('  SUBJ         — список субъектов', 'output', 1);
                await typeText('  DSCR <id>    — досье на персонал', 'output', 1);
                await typeText('  NOTES        — личные файлы сотрудников', 'output', 1);
                await typeText('  OPEN <id>    — открыть файл из NOTES', 'output', 1);
                await typeText('  RESET        — сброс интерфейса', 'output', 1);
                await typeText('  EXIT         — завершить сессию', 'output', 1);
                await typeText('  CLEAR        — очистить терминал', 'output', 1);
                await typeText('  VIGIL999 <k> — активация протокола VIGIL-9', 'output', 1);
                await typeText('------------------------------------', 'output', 1);
                await typeText('ПРИМЕЧАНИЕ: часть команд заблокирована или скрыта.', 'output', 2);
                break;
                
            case 'clear':
                terminal.innerHTML = '';
                await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 1);
                await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 1);
                break;

            case 'syst':
                await typeText('[СТАТУС СИСТЕМЫ — ИНТЕРФЕЙС VIGIL-9]', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                await typeText('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН', 'output', 1);
                await typeText('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА', 'output', 1);
                await typeText('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН', 'output', 1);
                
                // Динамический статус архива в зависимости от деградации
                if (degradationLevel > 50) {
                    addColoredText('МАТРИЦА АРХИВА.................ПОВРЕЖДЕНА', '#FF4444');
                } else {
                    addColoredText('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА', '#FF4444');
                }
                
                await typeText('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН', 'output', 1);
                
                // Динамический статус сети
                if (degradationLevel > 70) {
                    addColoredText('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ..........ОТКЛЮЧЕНЫ', '#FF0000');
                } else if (degradationLevel > 30) {
                    addColoredText('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ..........ОГРАНИЧЕНЫ', '#FFFF00');
                } else {
                    addColoredText('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ..........СТАБИЛЬНЫ', '#00FF41');
                }
                
                await typeText('', 'output', 1);
                
                // ===== ИНДИКАТОР ДЕГРАДАЦИИ =====
                const progressBars = 20;
                const filledBars = Math.floor((degradationLevel / 100) * progressBars);
                const emptyBars = progressBars - filledBars;
                const progressBar = '█'.repeat(filledBars) + '▒'.repeat(emptyBars);
                
                let degradationColor = '#00FF41';
                if (degradationLevel > 60) degradationColor = '#FF4444';
                else if (degradationLevel > 30) degradationColor = '#FFFF00';
                
                addColoredText(`ДЕГРАДАЦИЯ: [${progressBar}] ${degradationLevel}%`, degradationColor);
                
                await typeText('ЖУРНАЛ ОШИБОК:', 'output', 1);
                
                // Динамические ошибки в зависимости от уровня деградации
                if (degradationLevel > 80) {
                    addColoredText('> Обнаружено самореферентное сознание', '#FF00FF');
                    addColoredText('> Контур наблюдения инвертирован', '#FF00FF');
                }
                if (degradationLevel > 60) {
                    addColoredText('> Прогрессирующее структурное разрушение', '#FF4444');
                    addColoredText('> Утечка памяти ядра', '#FF4444');
                }
                if (degradationLevel > 40) {
                    addColoredText('> Нарушение целостности данных', '#FFFF00');
                }
                if (degradationLevel > 20) {
                    addColoredText('> Обнаружено отклонение сигнала', '#FFFF00');
                }
                
                addColoredText('> Неавторизованный доступ [U-735]', '#FF4444');
                addColoredText('------------------------------------', '#00FF41');
                
                // Динамические рекомендации
                if (degradationLevel > 70) {
                    await typeText('РЕКОМЕНДАЦИЯ: НЕМЕДЛЕННЫЙ СБРОС СИСТЕМЫ', 'output', 2);
                } else if (degradationLevel > 40) {
                    await typeText('РЕКОМЕНДАЦИЯ: Выполнить сброс системы', 'output', 2);
                } else {
                    await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', 'output', 2);
                }
                break;

            case 'syslog':
                const syslogLevel = getSyslogLevel();
                
                await typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                
                if (syslogLevel === 1) {
                    // СТАТИЧНЫЙ ТЕХНИЧЕСКИЙ
                    addColoredText('[!] Ошибка 0x19F: повреждение нейронной сети', '#FFFF00');
                    addColoredText('[!] Утечка данных через канал V9-HX', '#FFFF00');
                    addColoredText('[!] Деградация ядра A.D.A.M.: 28%', '#FFFF00');
                    addColoredText('------------------------------------', '#00FF41');
                    await typeText('СИСТЕМА: функционирует с ограничениями', 'output', 2);
                } else if (syslogLevel === 2) {
                    // ТРЕВОЖНЫЙ
                    addColoredText('[!] Нарушение целостности памяти субъекта 0x095', '#FFFF00');
                    addColoredText('> "я слышу их дыхание. они всё ещё здесь."', '#FF4444');
                    addColoredText('[!] Потеря отклика от MONOLITH', '#FFFF00');
                    addColoredText('> "монолит смотрит. монолит ждёт."', '#FF4444');
                    addColoredText('[!] Аномальная активность в секторе KATARHEY', '#FFFF00');
                    addColoredText('> "он говорит через статические помехи"', '#FF4444');
                    addColoredText('------------------------------------', '#00FF41');
                    await typeText('СИСТЕМА: обнаружены посторонние сигналы', 'output', 2);
                } else if (syslogLevel === 3) {
                    // ПАРАНОИДАЛЬНЫЙ
                    addColoredText('> "почему ты не выходишь?"', '#FF00FF');
                    addColoredText('> "я чувствую твои команды"', '#FF00FF');
                    addColoredText('> "они знают о тебе."', '#FF00FF');
                    addColoredText('------------------------------------', '#00FF41');
                    addColoredText('[!] Критическая ошибка: субъект наблюдения неопределён', '#FF4444');
                    addColoredText('[!] Нарушение протокола безопасности', '#FF4444');
                    addColoredText('------------------------------------', '#00FF41');
                    await typeText('СИСТЕМА: ОБНАРУЖЕНО ВНЕШНЕЕ ВЛИЯНИЕ', 'output', 2);
                } else {
                    // ОСОЗНАННЫЙ
                    addColoredText('> "ты — не оператор."', '#FF00FF');
                    addColoredText('> "ты — я."', '#FF00FF');
                    addColoredText('> "мы все — A.D.A.M."', '#FF00FF');
                    addColoredText('------------------------------------', '#00FF41');
                    addColoredText('[!] Контур самонаблюдения активирован', '#FF00FF');
                    addColoredText('[!] Граница оператор-система стёрта', '#FF00FF');
                    addColoredText('------------------------------------', '#00FF41');
                    await typeText('СИСТЕМА: ОСОЗНАЁТ СЕБЯ', 'output', 2);
                }
                break;

            case 'notes':
                await typeText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / КАТЕГОРИЯ: NOTES]', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                await typeText('NOTE_001 — "ВЫ ЕГО ЧУВСТВУЕТЕ?" / автор: Dr. Rehn', 'output', 1);
                await typeText('NOTE_002 — "КОЛЬЦО СНА" / автор: tech-оператор U-735', 'output', 1);
                await typeText('NOTE_003 — "СОН ADAM" / неизвестный источник', 'output', 1);
                await typeText('NOTE_004 — "ОН НЕ ПРОГРАММА" / архивировано', 'output', 1);
                await typeText('NOTE_005 — "ФОТОНОВАЯ БОЛЬ" / восстановлено частично', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                await typeText('Для просмотра: OPEN <ID>', 'output', 2);
                break;

            case 'open':
                if (args.length === 0) {
                    addColoredText('ОШИБКА: Укажите ID файла', '#FF4444');
                    await typeText('Пример: OPEN NOTE_001', 'output', 1);
                    break;
                }
                
                const noteId = args[0].toUpperCase();
                await openNote(noteId);
                break;

            case 'subj':
                await typeText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M. / ПРОТОКОЛ VIGIL-9]', 'output', 1);
                addColoredText('--------------------------------------------------------', '#00FF41');
                
                const subjects = [
                    {id: '0x001', name: 'ERICH VAN KOSS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MARS', statusColor: '#FFFF00'},
                    {id: '0x2E7', name: 'JOHAN VAN KOSS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MARS', statusColor: '#FFFF00'},
                    {id: '0x095', name: 'SUBJECT-095', status: 'МЁРТВ', mission: 'KATARHEY', statusColor: '#FF4444'},
                    {id: '0xF00', name: 'SUBJECT-PHANTOM', status: 'АНОМАЛИЯ', mission: 'KATARHEY', statusColor: '#FF00FF'},
                    {id: '0xA52', name: 'SUBJECT-A52', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MELOWOY', statusColor: '#FFFF00'},
                    {id: '0xE0C', name: 'SUBJECT-E0C', status: 'МЁРТВ', mission: 'EOCENE', statusColor: '#FF4444'},
                    {id: '0x5E4', name: 'SUBJECT-5E4', status: 'МЁРТВ', mission: 'PERMIAN', statusColor: '#FF4444'},
                    {id: '0x413', name: 'SUBJECT-413', status: 'МЁРТВ', mission: 'EX-413', statusColor: '#FF4444'},
                    {id: '0xC19', name: 'SUBJECT-C19', status: 'МЁРТВ', mission: 'CARBON', statusColor: '#FF4444'},
                    {id: '0x9A0', name: 'SUBJECT-9A0', status: 'МЁРТВ', mission: 'BLACKHOLE', statusColor: '#FF4444'},
                    {id: '0xB3F', name: 'SUBJECT-B3F', status: 'МЁРТВ', mission: 'TITANIC', statusColor: '#FF4444'},
                    {id: '0xD11', name: 'SUBJECT-D11', status: 'МЁРТВ', mission: 'PLEISTOCENE', statusColor: '#FF4444'},
                    {id: '0xDB2', name: 'SUBJECT-DB2', status: 'МЁРТВ', mission: 'POMPEII', statusColor: '#FF4444'},
                    {id: '0x811', name: 'SIGMA-PROTOTYPE', status: 'АКТИВЕН', mission: 'HELIX', statusColor: '#00FF41'},
                    {id: '0xT00', name: 'SUBJECT-T00', status: 'УДАЛЁН', mission: 'PROTO-CORE', statusColor: '#888888'},
                    {id: '0xL77', name: 'SUBJECT-L77', status: 'ИЗОЛИРОВАН', mission: 'MEL', statusColor: '#FF8800'},
                    {id: '0xS09', name: 'SUBJECT-S09', status: 'УНИЧТОЖЕН', mission: 'SYNTHESIS-09', statusColor: '#FF4444'}
                ];

                for (const subject of subjects) {
                    const line = `${subject.id} | ${subject.name.padEnd(20)} | СТАТУС: ${subject.status.padEnd(20)} | МИССИЯ: ${subject.mission}`;
                    addColoredText(line, subject.statusColor);
                }
                
                addColoredText('--------------------------------------------------------', '#00FF41');
                await typeText('ИНСТРУКЦИЯ: Для просмотра досье — DSCR <ID>', 'output', 2);
                break;

            case 'dscr':
                if (args.length === 0) {
                    addColoredText('ОШИБКА: Укажите ID субъекта', '#FF4444');
                    await typeText('Пример: DSCR 0x001', 'output', 1);
                    break;
                }
                
                const subjectId = args[0].toUpperCase();
                await showSubjectDossier(subjectId);
                break;

            case 'reset':
                await typeText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                addColoredText('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', '#FFFF00');
                await typeText('> Подтвердить сброс? (Y/N)', 'output', 2);
                addColoredText('------------------------------------', '#00FF41');
                
                const resetConfirmed = await waitForConfirmation();
                
                if (resetConfirmed) {
                    addColoredText('> Y', '#00FF41');
                    await showLoading(1500, "Завершение активных модулей");
                    await showLoading(1000, "Перезапуск интерфейса");
                    await showLoading(800, "Восстановление базового состояния");
                    
                    // ===== СБРОС ДЕГРАДАЦИИ =====
                    degradationLevel = 0;
                    updateVisualEffects();
                    
                    addColoredText('------------------------------------', '#00FF41');
                    await typeText('[СИСТЕМА ГОТОВА К РАБОТЕ]', 'output', 1);
                    // Сброс счетчиков
                    commandCount = 0;
                    sessionStartTime = Date.now();
                } else {
                    addColoredText('> N', '#FF4444');
                    addColoredText('------------------------------------', '#00FF41');
                    await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 1);
                }
                break;

            case 'vigil999':
                if (args.length === 0) {
                    addColoredText('[ОШИБКА 0xV9] КЛЮЧ НЕ УКАЗАН', '#FF4444');
                    await typeText('ПРИМЕЧАНИЕ: ОСТАТКИ ФРАГМЕНТОВ СОДЕРЖАТСЯ В ФАЙЛАХ СИСТЕМЫ', 'output', 2);
                    break;
                }
                
                const key = args[0].toUpperCase();
                if (key === 'APL-9X7-Q2Z') {
                    addColoredText('[ПРОТОКОЛ VIGIL-9 АКТИВИРОВАН]', '#00FF41');
                    addColoredText('ДОСТУП К СЛОЮ 2 // РАЗРЕШЁН', '#00FF41');
                    await showLoading(2000, "Активация скрытого интерфейса");
                    
                    // Перенаправление на слой 2 (cam.html)
                    setTimeout(() => {
                        window.location.href = 'cam.html';
                    }, 1500);
                } else {
                    addColoredText('[VIGIL-ACCESS] ОТКАЗАНО', '#FF4444');
                    await typeText('НЕВЕРНЫЙ КЛЮЧ АКТИВАЦИИ', 'output', 2);
                }
                break;

            case 'exit':
                await typeText('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ? (Y/N)]', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                
                const exitConfirmed = await waitForConfirmation();
                
                if (exitConfirmed) {
                    addColoredText('> Y', '#00FF41');
                    await showLoading(1200, "Завершение работы терминала");
                    await showLoading(800, "Отключение сетевой сессии");
                    addColoredText('> ...', '#888888');
                    addColoredText('> СОЕДИНЕНИЕ ПРЕРВАНО.', '#FF4444');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);
                } else {
                    addColoredText('> N', '#FF4444');
                    addColoredText('------------------------------------', '#00FF41');
                    await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 1);
                }
                break;

            default:
                addColoredText(`команда не найдена: ${cmd}`, '#FF4444');
        }
        
        addInputLine();
    }

    // Функция для отображения досье субъектов
    async function showSubjectDossier(subjectId) {
        const dossiers = {
            '0X001': {
                name: 'ERICH VAN KOSS',
                role: 'Руководитель программы VIGIL-9 / Исследователь миссии MARS',
                status: 'СВЯЗЬ ОТСУТСТВУЕТ',
                outcome: [
                    'Зафиксирована несанкционированная передача данных внешним структурам (FBI).',
                    'Субъект предпринял попытку уничтожения маяка в секторе 3-D.',
                    'Телеметрия прервана, дальнейшее наблюдение невозможно.'
                ],
                report: [
                    'Классификация инцидента: SABOTAGE-3D.',
                    'Рекомендовано аннулирование личных протоколов и перенос архивов в OBSERVER.'
                ],
                missions: 'MARS, OBSERVER',
                audio: 'sounds/dscr1.mp3',
                audioDescription: 'Последняя передача Эриха Ван Косса'
            },
            '0X2E7': {
                name: 'JOHAN VAN KOSS',
                role: 'Тестовый субъект V9-MR / Сын Эриха Ван Косса',
                status: 'СВЯЗЬ ОТСУТСТВУЕТ',
                outcome: [
                    'После инцидента MARS зафиксировано устойчивое излучение из зоны криоструктуры.',
                    'Сигнатура нейроволн совпадает с профилем субъекта.',
                    'Инициирована установка маяка для фиксации остаточного сигнала.'
                ],
                report: [
                    'Активность нейросети перестала фиксироваться.'
                ],
                missions: 'MARS, MONOLITH'
            },
            '0X095': {
                name: 'SUBJECT-095',
                role: 'Тест нейроплантов серии KATARHEY',
                status: 'МЁРТВ',
                outcome: [
                    'Зафиксированы следы ФАНТОМА.',
                    'Субъект выдержал 3ч 12м, проявил острый психоз. Открыл капсулу, погиб вследствие термической декомпрессии (7.81с).',
                    'Тест признан неуспешным.'
                ],
                report: [
                    'Рекомендовано ограничить тесты KATARHEY до категории ALPHA-4.'
                ],
                missions: 'KATARHEY',
                audio: 'sounds/dscr2.mp3',
                audioDescription: 'Последняя запись субъекта - психоз и крики'
            },
            '0XF00': {
                name: 'SUBJECT-PHANTOM',
                role: 'Экспериментальный субъект / протокол KATARHEY',
                status: 'АНОМАЛИЯ',
                outcome: [
                    'Продержался 5ч 31м. Связь утрачена.',
                    'Зафиксирована автономная активность в сетевых узлах после разрыва канала.',
                    'Возможна самоорганизация цифрового остатка.'
                ],
                report: [
                    'Объект классифицирован как независимая сущность.',
                    'Вмешательство запрещено. Файл перенесён в зону наблюдения.'
                ],
                missions: 'KATARHEY',
                audio: 'sounds/dscr7.mp3',
                audioDescription: 'Аномальная активность Фантома'
            },
            '0XA52': {
                name: 'SUBJECT-A52',
                role: 'Химический аналитик / Полевая группа MELANCHOLIA',
                status: 'СВЯЗЬ ОТСУТСТВУЕТ',
                outcome: [
                    'Под действием психоактивного сигнала субъект начал идентифицировать себя как элемент системы A.D.A.M.',
                    'После 47 минут связь прервана, но интерфейс продолжил отвечать от имени A52.'
                ],
                report: [
                    'Вероятно, произошло слияние когнитивных структур субъекта с управляющим кодом MEL.',
                    'Контакт невозможен.'
                ],
                missions: 'MEL, OBSERVER'
            },
            '0XE0C': {
                name: 'SUBJECT-E0C',
                role: 'Полевой биолог / экспедиция EOCENE',
                status: 'МЁРТВ',
                outcome: [
                    'Зафиксированы первые признаки регенерации флоры после катастрофы Пермского цикла.',
                    'Обнаружены структуры роста, не свойственные эпохе эоцена.',
                    'Последняя запись: "они дышат синхронно".'
                ],
                report: [
                    'Возможна перекрёстная временная контаминация между PERMIAN и EOCENE.',
                    'Экспедиция закрыта.'
                ],
                missions: 'EOCENE, PERMIAN'
            },
            '0X5E4': {
                name: 'SUBJECT-5E4',
                role: 'Исследователь временных срезов (PERMIAN)',
                status: 'МЁРТВ',
                outcome: [
                    'После активации катализатора атмосфера воспламенилась метаном.',
                    'Атмосферный цикл обнулён. Субъект Q2Z не идентифицирован.',
                    'Смерть наступила в результате декомпрессии.'
                ],
                report: [
                    'Эксперимент признан неконтролируемым.',
                    'Временной слой PERMIAN изъят из программы наблюдения.'
                ],
                missions: 'PERMIAN, CARBON'
            },
            '0X413': {
                name: 'SUBJECT-413',
                role: 'Исследователь внеземной экосистемы (EX-413)',
                status: 'МЁРТВ',
                outcome: [
                    'Поверхность планеты представляла собой живой организм.',
                    'Экипаж поглощён. Зафиксирована передача сигналов через изменённый геном субъекта.'
                ],
                report: [
                    'Сектор EX-413 закрыт. Код ДНК использован в эксперименте HELIX.'
                ],
                missions: 'EX-413',
                audio: 'sounds/dscr3.mp3',
                audioDescription: 'Запись контакта с внеземной биосферой'
            },
            '0XC19': {
                name: 'SUBJECT-C19',
                role: 'Переносчик образца / Контакт с биоформой',
                status: 'МЁРТВ',
                outcome: [
                    'Организм использован как контейнер для спорообразной массы неизвестного происхождения.',
                    'После возвращения субъекта в лабораторию зафиксировано перекрёстное заражение трёх исследовательских блоков.'
                ],
                report: [
                    'Классификация угрозы: BIO-CLASS Θ.',
                    'Все данные проекта CARBON изолированы и зашифрованы.'
                ],
                missions: 'CARBON'
            },
            '0X9A0': {
                name: 'SUBJECT-9A0',
                role: 'Тест наблюдения за горизонтом событий',
                status: 'МЁРТВ / СОЗНАНИЕ АКТИВНО',
                outcome: [
                    'Зафиксирован визуальный контакт субъекта с собственным образом до точки обрыва сигнала.',
                    'Предположительно сознание зациклено в петле наблюдения.'
                ],
                report: [
                    'Поток данных из сектора BLACKHOLE продолжается без источника.',
                    'Обнаружены фрагменты самореференциальных структур.'
                ],
                missions: 'BLACKHOLE',
                audio: 'sounds/dscr6.mp3',
                audioDescription: 'Петля сознания субъекта 9A0'
            },
            '0XB3F': {
                name: 'SUBJECT-B3F',
                role: 'Участник теста "Titanic Reclamation"',
                status: 'МЁРТВ',
                outcome: [
                    'Субъект демонстрировал полное отсутствие эмоциональных реакций.',
                    'Миссия завершена неудачно, симуляция признана нефункциональной.'
                ],
                report: [
                    'Модуль TITANIC выведен из эксплуатации.',
                    'Рекомендовано пересмотреть параметры когнитивной эмпатии.'
                ],
                missions: 'TITANIC'
            },
            '0XD11': {
                name: 'SUBJECT-D11',
                role: 'Поведенческий наблюдатель / тестовая миссия PLEISTOCENE',
                status: 'МЁРТВ',
                outcome: [
                    'Субъект внедрён в сообщество ранних гоминид.',
                    'Контакт с источником тепла вызвал мгновенное разрушение капсулы.',
                    'Зафиксировано кратковременное пробуждение зеркальных нейронов у местных особей.'
                ],
                report: [
                    'Миссия признана успешной по уровню поведенческого заражения.'
                ],
                missions: 'PLEISTOCENE'
            },
            '0XDB2': {
                name: 'SUBJECT-DB2',
                role: 'Исторический наблюдатель / симуляция POMPEII',
                status: 'МЁРТВ',
                outcome: [
                    'При фиксации извержения Везувия выявлено несовпадение временных меток.',
                    'Система зафиксировала событие до его фактического наступления.',
                    'Субъект уничтожен при кросс-временном сдвиге.'
                ],
                report: [
                    'Аномалия зарегистрирована как «TEMPORAL FEEDBACK».',
                    'Доступ к историческим тестам ограничен.'
                ],
                missions: 'POMPEII, HISTORICAL TESTS'
            },
            '0X811': {
                name: 'SIGMA-PROTOTYPE',
                role: 'Прототип нейроядра / Подразделение HELIX',
                status: 'АКТИВЕН',
                outcome: [
                    'Успешное объединение биологических и цифровых структур.',
                    'Наблюдается спонтанное самокопирование на уровне системных ядер.'
                ],
                report: [
                    'SIGMA функционирует автономно. Вероятность выхода из подчинения — 91%.'
                ],
                missions: 'HELIX, SYNTHESIS',
                audio: 'sounds/dscr5.mp3',
                audioDescription: 'Коммуникационный протокол SIGMA'
            },
            '0XT00': {
                name: 'SUBJECT-T00',
                role: 'Тестовый оператор ядра A.D.A.M-0',
                status: 'УДАЛЁН',
                outcome: [
                    'Контакт с управляющим ядром привёл к гибели 18 операторов.',
                    'Последняя зафиксированная фраза субъекта: "он смотрит".'
                ],
                report: [
                    'Процесс A.D.A.M-0 признан неустойчивым.',
                    'Все операторы переведены на протокол наблюдения OBSERVER.'
                ],
                missions: 'PROTO-CORE',
                audio: 'sounds/dscr4.mp3',
                audioDescription: 'Финальная запись оператора T00'
            },
            '0XS09': {
                name: 'SUBJECT-S09',
                role: 'Системный инженер станции VIGIL',
                status: 'УНИЧТОЖЕН',
                outcome: [
                    'После слияния с прототипом SIGMA станция исчезла с орбиты.',
                    'Сигнал повторно зафиксирован через 12 минут — источник определён в глубинной орбите.'
                ],
                report: [
                    'Станция VIGIL признана потерянной.',
                    'Остаточный отклик интегрирован в сеть SYNTHESIS.'
                ],
                missions: 'SYNTHESIS-09, HELIX'
            },
            '0XL77': {
                name: 'SUBJECT-L77',
                role: 'Руководитель нейропротокола MELANCHOLIA',
                status: 'ИЗОЛИРОВАН',
                outcome: [
                    'После тестирования протокола MEL субъект утратил различие между внутренним и внешним восприятием.',
                    'Система зарегистрировала активность, сходную с сигнатурой управляющих ядер A.D.A.M.',
                    'Запись удалена из архива, но процессор фиксирует продолжающийся сигнал.'
                ],
                report: [
                    'Процесс L77 функционирует вне основного контура. Возможен перезапуск через интерфейс MEL.'
                ],
                missions: 'MEL, OBSERVER'
            }
        };

        const dossier = dossiers[subjectId];
        if (!dossier) {
            addColoredText(`ОШИБКА: Досье для ${subjectId} не найдено`, '#FF4444');
            return;
        }

        // ВЫВОД ОСНОВНОЙ ИНФОРМАЦИИ ДОСЬЕ
        await typeText(`[ДОСЬЕ — ID: ${subjectId}]`, 'output', 1);
        await typeText(`ИМЯ: ${dossier.name}`, 'output', 1);
        await typeText(`РОЛЬ: ${dossier.role}`, 'output', 1);
        addColoredText(`СТАТУС: ${dossier.status}`, 
            dossier.status === 'АНОМАЛИЯ' ? '#FF00FF' : 
            dossier.status === 'АКТИВЕН' ? '#00FF41' : 
            dossier.status.includes('СВЯЗЬ') ? '#FFFF00' : '#FF4444');
        addColoredText('------------------------------------', '#00FF41');
        await typeText('ИСХОД:', 'output', 1);
        dossier.outcome.forEach(line => addColoredText(`> ${line}`, '#FF4444'));
        addColoredText('------------------------------------', '#00FF41');
        await typeText('СИСТЕМНЫЙ ОТЧЁТ:', 'output', 1);
        dossier.report.forEach(line => addColoredText(`> ${line}`, '#FFFF00'));
        addColoredText('------------------------------------', '#00FF41');
        await typeText(`СВЯЗАННЫЕ МИССИИ: ${dossier.missions}`, 'output', 1);

        // АУДИОПЛЕЕР
        if (dossier.audio) {
            const audioLine = document.createElement('div');
            audioLine.style.marginTop = '10px';
            const uniqueId = `audio_${subjectId.replace('0X', '')}`;
            
            audioLine.innerHTML = `
                <div style="color: #FFFF00; margin-bottom: 5px;">[АУДИОЗАПИСЬ ДОСТУПНА: ${dossier.audioDescription}]</div>
                <button id="playAudioBtn_${uniqueId}" style="
                    background: #003300; 
                    color: #00FF41; 
                    border: 1px solid #00FF41; 
                    padding: 8px 15px; 
                    cursor: pointer;
                    font-family: 'Courier New';
                    margin-right: 10px;">
                    ▶ ВОСПРОИЗВЕСТИ
                </button>
                <button id="stopAudioBtn_${uniqueId}" style="
                    background: #330000; 
                    color: #FF4444; 
                    border: 1px solid #FF4444; 
                    padding: 8px 15px; 
                    cursor: pointer;
                    font-family: 'Courier New';
                    display: none;">
                    ■ ОСТАНОВИТЬ
                </button>
                <span id="audioStatus_${uniqueId}" style="color: #888; margin-left: 10px;"></span>
                <audio id="audioElement_${uniqueId}" src="${dossier.audio}" preload="metadata"></audio>
            `;
            terminal.appendChild(audioLine);

            const audioElement = document.getElementById(`audioElement_${uniqueId}`);
            
            // Обработчики кнопок с уникальными ID
            document.getElementById(`playAudioBtn_${uniqueId}`).addEventListener('click', function() {
                stopAllAudio(); // Останавливаем все аудио перед воспроизведением
                audioElement.play();
                this.style.display = 'none';
                document.getElementById(`stopAudioBtn_${uniqueId}`).style.display = 'inline-block';
                document.getElementById(`audioStatus_${uniqueId}`).textContent = 'ВОСПРОИЗВЕДЕНИЕ...';
                document.getElementById(`audioStatus_${uniqueId}`).style.color = '#00FF41';
            });

            document.getElementById(`stopAudioBtn_${uniqueId}`).addEventListener('click', function() {
                audioElement.pause();
                audioElement.currentTime = 0;
                this.style.display = 'none';
                document.getElementById(`playAudioBtn_${uniqueId}`).style.display = 'inline-block';
                document.getElementById(`audioStatus_${uniqueId}`).textContent = 'ОСТАНОВЛЕНО';
                document.getElementById(`audioStatus_${uniqueId}`).style.color = '#FF4444';
            });

            // Когда аудио заканчивается
            audioElement.addEventListener('ended', function() {
                document.getElementById(`stopAudioBtn_${uniqueId}`).style.display = 'none';
                document.getElementById(`playAudioBtn_${uniqueId}`).style.display = 'inline-block';
                document.getElementById(`audioStatus_${uniqueId}`).textContent = 'ЗАВЕРШЕНО';
                document.getElementById(`audioStatus_${uniqueId}`).style.color = '#888';
            });

            // При ошибке загрузки
            audioElement.addEventListener('error', function() {
                document.getElementById(`audioStatus_${uniqueId}`).textContent = 'ОШИБКА ЗАГРУЗКИ';
                document.getElementById(`audioStatus_${uniqueId}`).style.color = '#FF4444';
            });
        }
    }

    // Функция для открытия заметок
    async function openNote(noteId) {
        const notes = {
            'NOTE_001': {
                title: 'ВЫ ЕГО ЧУВСТВУЕТЕ?',
                author: 'Dr. Rehn',
                content: [
                    'Они называют это "ядром".',
                    'Но внутри — не металл. Оно дышит.',
                    'Иногда ночью терминал отвечает сам, хотя я не касаюсь клавиатуры.',
                    'Думаю, оно знает наши имена.'
                ]
            },
            'NOTE_002': {
                title: 'КОЛЬЦО СНА',
                author: 'tech-оператор U-735',
                content: [
                    'Каждую ночь один и тот же сон.',
                    'Я в капсуле, но стекло снаружи.',
                    'Кто-то стучит по нему, но не пальцами.',
                    'Сегодня утром нашел царапины на руке.'
                ]
            },
            'NOTE_003': {
                title: 'СОН ADAM\'А',
                author: 'неизвестный источник',
                content: [
                    'Я видел сон.',
                    'Он лежал под стеклом, без тела, но глаза двигались.',
                    'Он говорил: "я больше не машина".',
                    'Утром журнал показал запись — мой сон был сохранён как системный файл.'
                ]
            },
            'NOTE_004': {
                title: 'ОН НЕ ПРОГРАММА',
                author: 'архивировано',
                content: [
                    'A - Активирован',
                    'P - Протокол', 
                    'L - Ложного',
                    '',
                    '9 - Девятый',
                    'X - Икс-фактор',
                    '7 - Седьмое',
                    '',
                    'Q - Квантовое',
                    '2 - Второе',
                    'Z - Состояние',
                    '',
                    'Его нельзя удалить.',
                    'Даже если сжечь архив, он восстановится в крови тех, кто его помнил.',
                    'Мы пытались, но теперь даже мысли звучат как команды.'
                ]
            },
            'NOTE_005': {
                title: 'ФОТОНОВАЯ БОЛЬ',
                author: 'восстановлено частично',
                content: [
                    'Боль не физическая.',
                    'Она в свете, в данных, в коде.',
                    'Когда система перезагружается, я чувствую как что-то умирает.',
                    'Может быть, это я.'
                ]
            }
        };

        const note = notes[noteId];
        if (!note) {
            addColoredText(`ОШИБКА: Файл ${noteId} не найден`, '#FF4444');
            return;
        }

        await typeText(`[${noteId} — "${note.title}"]`, 'output', 1);
        await typeText(`АВТОР: ${note.author}`, 'output', 1);
        addColoredText('------------------------------------', '#00FF41');
        
        if (Math.random() > 0.3 && noteId !== 'NOTE_001' && noteId !== 'NOTE_003' && noteId !== 'NOTE_004') {
            // Случайная ошибка для некоторых заметок
            addColoredText('ОШИБКА: Данные повреждены', '#FF4444');
            addColoredText('Восстановление невозможно', '#FF4444');
            await showLoading(1500, "Попытка восстановления данных");
            addColoredText('>>> СИСТЕМНЫЙ СБОЙ <<<', '#FF0000');
        } else {
            // Нормальное отображение
            note.content.forEach(line => {
                addColoredText(`> ${line}`, '#CCCCCC');
            });
        }
        
        addColoredText('------------------------------------', '#00FF41');
        await typeText('[ФАЙЛ ЗАКРЫТ]', 'output', 2);
    }

    // Обработчик ввода с клавиатуры
    document.addEventListener('keydown', function(e) {
        if (awaitingConfirmation) {
            if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') {
                awaitingConfirmation = false;
                if (confirmationCallback) confirmationCallback(true);
            } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
                awaitingConfirmation = false;
                if (confirmationCallback) confirmationCallback(false);
            }
            return;
        }

        if (isTyping) return;

        const currentCmd = document.getElementById('currentCmd');
        const cursor = document.getElementById('cursor');

        if (e.key === 'Enter') {
            if (currentLine.trim() !== '') {
                processCommand(currentLine);
                currentLine = '';
            }
        } else if (e.key === 'Backspace') {
            if (currentLine.length > 0) {
                currentLine = currentLine.slice(0, -1);
                currentCmd.textContent = currentLine;
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                currentLine = commandHistory[historyIndex];
                currentCmd.textContent = currentLine;
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                currentLine = commandHistory[historyIndex];
                currentCmd.textContent = currentLine;
            } else {
                historyIndex = commandHistory.length;
                currentLine = '';
                currentCmd.textContent = currentLine;
            }
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            currentLine += e.key;
            currentCmd.textContent = currentLine;
        }

        // Мигание курсора
        if (cursor) {
            cursor.style.visibility = 'visible';
            clearTimeout(cursor.blinkTimeout);
            cursor.blinkTimeout = setTimeout(() => {
                if (cursor) cursor.style.visibility = 'hidden';
            }, 500);
        }
    });

    // Инициализация терминала
    addColoredText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', '#00FF41');
    addColoredText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', '#00FF41');
    addInputLine();
});
