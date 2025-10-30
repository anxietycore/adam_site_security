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

    // СИСТЕМА ДЕГРАДАЦИИ
    let degradationLevel = parseInt(localStorage.getItem('adam_degradation')) || 0;
    let degradationTimer = null;
    let isDegradationActive = true;
    let phantomCursorElement = null;
    let degradationIndicator = null;
    let degradationFill = null;
    let degradationHint = null;

    // Инициализация системы деградации
    function initDegradationSystem() {
        createDegradationIndicator();
        startDegradationTimer();
        updateDegradationVisuals();
        
        // Добавляем CRT оверлей
        const crtOverlay = document.createElement('div');
        crtOverlay.className = 'crt-overlay';
        document.body.appendChild(crtOverlay);

        // Добавляем VHS статику
        const vhsStatic = document.createElement('div');
        vhsStatic.className = 'vhs-static';
        document.body.appendChild(vhsStatic);

        // Добавляем дыхание интерфейса
        terminal.classList.add('terminal-breathing');
    }

    // Создание индикатора деградации
    function createDegradationIndicator() {
        degradationIndicator = document.createElement('div');
        degradationIndicator.className = 'degradation-indicator';
        degradationIndicator.innerHTML = `
            <div>ДЕГРАДАЦИЯ: <span id="degradationPercent">${degradationLevel}%</span></div>
            <div class="degradation-bar">
                <div class="degradation-fill" id="degradationFill"></div>
            </div>
            <div class="degradation-hint" id="degradationHint"></div>
        `;
        document.body.appendChild(degradationIndicator);
        
        degradationFill = document.getElementById('degradationFill');
        degradationHint = document.getElementById('degradationHint');
        
        updateDegradationDisplay();
    }

    // Таймер деградации
    function startDegradationTimer() {
        degradationTimer = setInterval(() => {
            if (isDegradationActive && degradationLevel < 98) {
                degradationLevel++;
                localStorage.setItem('adam_degradation', degradationLevel);
                updateDegradationSystem();
                
                if (degradationLevel >= 98) {
                    triggerForcedReset();
                }
            }
        }, 30000); // +1% каждые 30 секунд
    }

    // Обновление всей системы деградации
    function updateDegradationSystem() {
        updateDegradationDisplay();
        updateDegradationVisuals();
        playDegradationSounds();
        spawnDegradationEffects();
    }

    // Обновление отображения
    function updateDegradationDisplay() {
        if (degradationFill) {
            degradationFill.style.width = `${degradationLevel}%`;
        }
        
        const percentElement = document.getElementById('degradationPercent');
        if (percentElement) {
            percentElement.textContent = `${degradationLevel}%`;
        }

        // Подсказка RESET
        if (degradationHint) {
            if (degradationLevel >= 60 && degradationLevel < 80) {
                degradationHint.textContent = '> используйте команду RESET для стабилизации';
                degradationHint.style.opacity = '1';
            } else if (degradationLevel >= 80) {
                degradationHint.textContent = '> срочно введите RESET';
                degradationHint.style.opacity = '1';
                degradationHint.style.animation = 'cursor-blink 0.5s infinite';
            } else {
                degradationHint.style.opacity = '0';
            }
        }
    }

    // Визуальные эффекты по уровням
    function updateDegradationVisuals() {
        // Убираем все уровни
        terminal.classList.remove('degradation-level-1', 'degradation-level-2', 'degradation-level-3', 'degradation-level-4', 'degradation-level-5');
        
        if (degradationLevel <= 30) {
            // Уровень 1: 0-30% - стабильно
            terminal.classList.add('degradation-level-1');
        } else if (degradationLevel <= 60) {
            // Уровень 2: 30-60% - начальная нестабильность
            terminal.classList.add('degradation-level-2');
            createPhantomCursor();
        } else if (degradationLevel <= 80) {
            // Уровень 3: 60-80% - сбой протоколов
            terminal.classList.add('degradation-level-3');
            createPhantomCursor();
        } else if (degradationLevel <= 95) {
            // Уровень 4: 80-95% - разрушение
            terminal.classList.add('degradation-level-4');
            createPhantomCursor();
        } else {
            // Уровень 5: 95-100% - полная деградация
            terminal.classList.add('degradation-level-5');
        }
    }

    // Создание фантомного курсора
    function createPhantomCursor() {
        if (phantomCursorElement) {
            phantomCursorElement.remove();
        }
        
        if (degradationLevel >= 30) {
            phantomCursorElement = document.createElement('div');
            phantomCursorElement.className = 'phantom-cursor';
            
            // Случайная позиция в терминале
            const randomLine = Math.floor(Math.random() * terminal.children.length);
            const lineElement = terminal.children[randomLine];
            if (lineElement) {
                const rect = lineElement.getBoundingClientRect();
                const terminalRect = terminal.getBoundingClientRect();
                
                phantomCursorElement.style.left = (rect.left - terminalRect.left + rect.width) + 'px';
                phantomCursorElement.style.top = (rect.top - terminalRect.top) + 'px';
                terminal.appendChild(phantomCursorElement);
            }
        }
    }

    // Звуковые эффекты деградации
    function playDegradationSounds() {
        if (degradationLevel === 70 || degradationLevel === 75) {
            playAudio('sounds/reset_com.mp3', 0.3);
        } else if (degradationLevel === 85 || degradationLevel === 90) {
            playAudio('sounds/reset_com_reverse.mp3', 0.3);
        }
    }

    // Спаун случайных эффектов
    function spawnDegradationEffects() {
        if (degradationLevel >= 60 && Math.random() < 0.1) {
            createPhantomText();
        }
        
        if (degradationLevel >= 80 && Math.random() < 0.05) {
            createFalseInput();
        }
        
        if (degradationLevel >= 30 && Math.random() < 0.02) {
            createImpulse();
        }
    }

    // Создание аномального текста
    function createPhantomText() {
        const texts = [
            "он наблюдает",
            "ты ещё здесь?",
            "ошибка // сознание", 
            "не отключайся",
            "они знают",
            "смотри behind you",
            "memory leak detected",
            "кто ты?"
        ];
        
        const text = texts[Math.floor(Math.random() * texts.length)];
        const phantom = document.createElement('div');
        phantom.className = 'phantom-text';
        phantom.textContent = text;
        
        phantom.style.left = Math.random() * (terminal.offsetWidth - 100) + 'px';
        phantom.style.top = Math.random() * (terminal.offsetHeight - 20) + 'px';
        
        terminal.appendChild(phantom);
        
        setTimeout(() => {
            phantom.remove();
        }, 300);
    }

    // Ложный ввод от системы
    function createFalseInput() {
        const falseLine = document.createElement('div');
        falseLine.className = 'command';
        falseLine.textContent = 'adam@secure:~$ ...';
        
        terminal.appendChild(falseLine);
        
        setTimeout(() => {
            const errorLine = document.createElement('div');
            errorLine.className = 'error';
            errorLine.textContent = 'ОШИБКА // НЕТ ПОЛЬЗОВАТЕЛЯ';
            terminal.appendChild(errorLine);
            terminal.scrollTop = terminal.scrollHeight;
        }, 1000);
    }

    // Импульсный разряд
    function createImpulse() {
        const impulse = document.createElement('div');
        impulse.className = 'impulse';
        impulse.style.top = Math.random() * terminal.offsetHeight + 'px';
        impulse.style.left = Math.random() * 100 + 'px';
        
        terminal.appendChild(impulse);
        
        setTimeout(() => {
            impulse.remove();
        }, 100);
    }

    // Принудительный сброс
    function triggerForcedReset() {
        if (degradationLevel >= 98) {
            isDegradationActive = false;
            playAudio('sounds/glich_e.mp3', 0.5);
            
            setTimeout(() => {
                resetDegradationSystem();
                addOutput('[АВТОМАТИЧЕСКИЙ СБРОС]', 'output');
                addOutput('[СИСТЕМА ВОССТАНОВЛЕНА]', 'output');
                addInputLine();
            }, 3000);
        }
    }

    // Воспроизведение аудио
    function playAudio(src, volume = 1.0) {
        try {
            const audio = new Audio(src);
            audio.volume = volume;
            audio.play().catch(e => console.log('Audio play failed:', e));
        } catch (e) {
            console.log('Audio error:', e);
        }
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
                    // Эффект пропуска символов при деградации
                    if (degradationLevel >= 30 && Math.random() < 0.02) {
                        index++;
                    }
                    
                    line.textContent += text.charAt(index);
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
    function addColoredText(text, color = 'rgb(100, 255, 130)', className = 'output') {
        const line = document.createElement('div');
        line.className = className;
        line.style.color = color;
        line.textContent = text;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Функция для быстрого вывода
    function addOutput(text, className = 'output') {
        const line = document.createElement('div');
        line.className = className;
        line.textContent = text;
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
            progressBar.style.border = '1px solid rgb(100, 255, 130)';
            progressBar.style.margin = '5px 0';
            progressBar.style.position = 'relative';
            progressBar.style.background = 'rgba(100, 255, 130, 0.1)';
            
            const progressFill = document.createElement('div');
            progressFill.style.height = '100%';
            progressFill.style.background = 'linear-gradient(90deg, rgb(100, 255, 130), #00cc33)';
            progressFill.style.width = '0%';
            progressFill.style.transition = 'width 0.1s linear';
            progressFill.style.boxShadow = '0 0 10px rgb(100, 255, 130)';
            
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
                        loader.style.color = 'rgb(100, 255, 130)';
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
            confirmLine.innerHTML = '<span class="prompt" style="color:#EFD76C">confirm>> </span><span class="cmd" id="confirmCmd"></span><span class="cursor" id="confirmCursor">_</span>';
            terminal.appendChild(confirmLine);
            terminal.scrollTop = terminal.scrollHeight;
            
            const confirmHandler = (e) => {
                const confirmCmd = document.getElementById('confirmCmd');
                if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') {
                    confirmCmd.textContent = 'Y';
                    confirmCmd.style.color = 'rgb(100, 255, 130)';
                } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
                    confirmCmd.textContent = 'N';
                    confirmCmd.style.color = '#D83F47';
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

    // Функция для определения уровня SYSLOG
    function getSyslogLevel() {
        const sessionDuration = Date.now() - sessionStartTime;
        const minutesInSession = sessionDuration / (1000 * 60);
        
        if (commandCount >= 10 || minutesInSession >= 3) {
            return 3; // СОЗНАТЕЛЬНЫЙ
        } else if (commandCount >= 5 || minutesInSession >= 1) {
            return 2; // ЖИВОЙ
        } else {
            return 1; // СТАТИЧНЫЙ
        }
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

    // Сброс системы деградации
    function resetDegradationSystem() {
        degradationLevel = 0;
        localStorage.setItem('adam_degradation', degradationLevel);
        isDegradationActive = true;
        updateDegradationSystem();
        
        if (phantomCursorElement) {
            phantomCursorElement.remove();
            phantomCursorElement = null;
        }
        
        playAudio('sounds/recovery_beep.mp3', 0.2);
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
        
        // Увеличение деградации за команды
        if (['syst', 'syslog', 'net', 'dscr', 'subj', 'notes'].includes(command)) {
            if (degradationLevel < 98) {
                degradationLevel++;
                localStorage.setItem('adam_degradation', degradationLevel);
                updateDegradationSystem();
            }
        }
        
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
                addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                await typeText('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН', 'output', 1);
                await typeText('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА', 'output', 1);
                await typeText('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН', 'output', 1);
                addColoredText('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА', '#D83F47');
                await typeText('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН', 'output', 1);
                addColoredText('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ..........ОГРАНИЧЕНЫ', '#EFD76C');
                await typeText('', 'output', 1);
                addColoredText(`ДЕГРАДАЦИЯ: [${'█'.repeat(Math.floor(degradationLevel/5))}${'▒'.repeat(20-Math.floor(degradationLevel/5))}] ${degradationLevel}%`, '#EFD76C');
                await typeText('ЖУРНАЛ ОШИБОК:', 'output', 1);
                addColoredText('> Обнаружено отклонение сигнала', '#D83F47');
                addColoredText('> Прогрессирующее структурное разрушение', '#D83F47');
                addColoredText('> Неавторизованный доступ [U-735]', '#D83F47');
                addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', 'output', 2);
                break;

            case 'syslog':
                const syslogLevel = getSyslogLevel();
                
                await typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', 'output', 1);
                addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                
                if (syslogLevel === 1) {
                    // СТАТИЧНЫЙ ТЕХНИЧЕСКИЙ
                    addColoredText('[!] Ошибка 0x19F: повреждение нейронной сети', '#EFD76C');
                    addColoredText('[!] Утечка данных через канал V9-HX', '#EFD76C');
                    addColoredText('[!] Деградация ядра A.D.A.M.: 28%', '#EFD76C');
                    addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                    await typeText('СИСТЕМА: функционирует с ограничениями', 'output', 2);
                } else if (syslogLevel === 2) {
                    // ЖИВОЙ
                    addColoredText('[!] Нарушение целостности памяти субъекта 0x095', '#EFD76C');
                    addColoredText('> "я слышу их дыхание. они всё ещё здесь."', '#D83F47');
                    addColoredText('[!] Потеря отклика от MONOLITH', '#EFD76C');
                    addColoredText('> "монолит смотрит. монолит ждёт."', '#D83F47');
                    addColoredText('[!] Аномальная активность в секторе KATARHEY', '#EFD76C');
                    addColoredText('> "он говорит через статические помехи"', '#D83F47');
                    addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                    await typeText('СИСТЕМА: обнаружены посторонние сигналы', 'output', 2);
                } else {
                    // СОЗНАТЕЛЬНЫЙ
                    addColoredText('> "ты не должен видеть это."', '#C000FF');
                    addColoredText('> "почему ты продолжаешь?"', '#C000FF');
                    addColoredText('> "они знают о тебе."', '#C000FF');
                    addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                    addColoredText('[!] Критическая ошибка: субъект наблюдения неопределён', '#D83F47');
                    addColoredText('[!] Нарушение протокола безопасности', '#D83F47');
                    addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                    await typeText('СИСТЕМА: ОСОЗНАЁТ НАБЛЮДЕНИЕ', 'output', 2);
                }
                break;

            case 'notes':
                await typeText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / КАТЕГОРИЯ: NOTES]', 'output', 1);
                addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                await typeText('NOTE_001 — "ВЫ ЕГО ЧУВСТВУЕТЕ?" / автор: Dr. Rehn', 'output', 1);
                await typeText('NOTE_002 — "КОЛЬЦО СНА" / автор: tech-оператор U-735', 'output', 1);
                await typeText('NOTE_003 — "СОН ADAM" / неизвестный источник', 'output', 1);
                await typeText('NOTE_004 — "ОН НЕ ПРОГРАММА" / архивировано', 'output', 1);
                await typeText('NOTE_005 — "ФОТОНОВАЯ БОЛЬ" / восстановлено частично', 'output', 1);
                addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                await typeText('Для просмотра: OPEN <ID>', 'output', 2);
                break;

            case 'open':
                if (args.length === 0) {
                    addColoredText('ОШИБКА: Укажите ID файла', '#D83F47');
                    await typeText('Пример: OPEN NOTE_001', 'output', 1);
                    break;
                }
                
                const noteId = args[0].toUpperCase();
                await openNote(noteId);
                break;

            case 'subj':
                await typeText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M. / ПРОТОКОЛ VIGIL-9]', 'output', 1);
                addColoredText('--------------------------------------------------------', 'rgb(100, 255, 130)');
                
                const subjects = [
                    {id: '0x001', name: 'ERICH VAN KOSS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MARS', statusColor: '#EFD76C'},
                    {id: '0x2E7', name: 'JOHAN VAN KOSS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MARS', statusColor: '#EFD76C'},
                    {id: '0x095', name: 'SUBJECT-095', status: 'МЁРТВ', mission: 'KATARHEY', statusColor: '#D83F47'},
                    {id: '0xF00', name: 'SUBJECT-PHANTOM', status: 'АНОМАЛИЯ', mission: 'KATARHEY', statusColor: '#C000FF'},
                    {id: '0xA52', name: 'SUBJECT-A52', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MELOWOY', statusColor: '#EFD76C'},
                    {id: '0xE0C', name: 'SUBJECT-E0C', status: 'МЁРТВ', mission: 'EOCENE', statusColor: '#D83F47'},
                    {id: '0x5E4', name: 'SUBJECT-5E4', status: 'МЁРТВ', mission: 'PERMIAN', statusColor: '#D83F47'},
                    {id: '0x413', name: 'SUBJECT-413', status: 'МЁРТВ', mission: 'EX-413', statusColor: '#D83F47'},
                    {id: '0xC19', name: 'SUBJECT-C19', status: 'МЁРТВ', mission: 'CARBON', statusColor: '#D83F47'},
                    {id: '0x9A0', name: 'SUBJECT-9A0', status: 'МЁРТВ', mission: 'BLACKHOLE', statusColor: '#D83F47'},
                    {id: '0xB3F', name: 'SUBJECT-B3F', status: 'МЁРТВ', mission: 'TITANIC', statusColor: '#D83F47'},
                    {id: '0xD11', name: 'SUBJECT-D11', status: 'МЁРТВ', mission: 'PLEISTOCENE', statusColor: '#D83F47'},
                    {id: '0xDB2', name: 'SUBJECT-DB2', status: 'МЁРТВ', mission: 'POMPEII', statusColor: '#D83F47'},
                    {id: '0x811', name: 'SIGMA-PROTOTYPE', status: 'АКТИВЕН', mission: 'HELIX', statusColor: 'rgb(100, 255, 130)'},
                    {id: '0xT00', name: 'SUBJECT-T00', status: 'УДАЛЁН', mission: 'PROTO-CORE', statusColor: '#888888'},
                    {id: '0xL77', name: 'SUBJECT-L77', status: 'ИЗОЛИРОВАН', mission: 'MEL', statusColor: '#EFD76C'},
                    {id: '0xS09', name: 'SUBJECT-S09', status: 'УНИЧТОЖЕН', mission: 'SYNTHESIS-09', statusColor: '#D83F47'}
                ];

                for (const subject of subjects) {
                    const line = `${subject.id} | ${subject.name.padEnd(20)} | СТАТУС: ${subject.status.padEnd(20)} | МИССИЯ: ${subject.mission}`;
                    addColoredText(line, subject.statusColor);
                }
                
                addColoredText('--------------------------------------------------------', 'rgb(100, 255, 130)');
                await typeText('ИНСТРУКЦИЯ: Для просмотра досье — DSCR <ID>', 'output', 2);
                break;

            case 'dscr':
                if (args.length === 0) {
                    addColoredText('ОШИБКА: Укажите ID субъекта', '#D83F47');
                    await typeText('Пример: DSCR 0x001', 'output', 1);
                    break;
                }
                
                const subjectId = args[0].toUpperCase();
                await showSubjectDossier(subjectId);
                break;

            case 'reset':
                await typeText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', 'output', 1);
                addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                addColoredText('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', '#EFD76C');
                await typeText('> Подтвердить сброс? (Y/N)', 'output', 2);
                addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                
                const resetConfirmed = await waitForConfirmation();
                
                if (resetConfirmed) {
                    addColoredText('> Y', 'rgb(100, 255, 130)');
                    await showLoading(1500, "Завершение активных модулей");
                    await showLoading(1000, "Перезапуск интерфейса");
                    await showLoading(800, "Восстановление базового состояния");
                    addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                    await typeText('[СИСТЕМА ГОТОВА К РАБОТЕ]', 'output', 1);
                    
                    // Сброс системы деградации
                    resetDegradationSystem();
                    commandCount = 0;
                    sessionStartTime = Date.now();
                } else {
                    addColoredText('> N', '#D83F47');
                    addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                    await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 1);
                }
                break;

            case 'exit':
                await typeText('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ? (Y/N)]', 'output', 1);
                addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                
                const exitConfirmed = await waitForConfirmation();
                
                if (exitConfirmed) {
                    addColoredText('> Y', 'rgb(100, 255, 130)');
                    await showLoading(1200, "Завершение работы терминала");
                    await showLoading(800, "Отключение сетевой сессии");
                    addColoredText('> ...', '#888888');
                    addColoredText('> СОЕДИНЕНИЕ ПРЕРВАНО.', '#D83F47');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);
                } else {
                    addColoredText('> N', '#D83F47');
                    addColoredText('------------------------------------', 'rgb(100, 255, 130)');
                    await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 1);
                }
                break;

            default:
                addColoredText(`команда не найдена: ${cmd}`, '#D83F47');
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
                    'Атмосферный цикл обнулён. Субъект не идентифицирован.'
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
            addColoredText(`ОШИБКА: Досье для ${subjectId} не найдено`, '#D83F47');
            return;
        }

        // ВЫВОД ОСНОВНОЙ ИНФОРМАЦИИ ДОСЬЕ
        await typeText(`[ДОСЬЕ — ID: ${subjectId}]`, 'output', 1);
        await typeText(`ИМЯ: ${dossier.name}`, 'output', 1);
        await typeText(`РОЛЬ: ${dossier.role}`, 'output', 1);
        addColoredText(`СТАТУС: ${dossier.status}`, 
            dossier.status === 'АНОМАЛИЯ' ? '#C000FF' : 
            dossier.status === 'АКТИВЕН' ? 'rgb(100, 255, 130)' : 
            dossier.status.includes('СВЯЗЬ') ? '#EFD76C' : '#D83F47');
        addColoredText('------------------------------------', 'rgb(100, 255, 130)');
        await typeText('ИСХОД:', 'output', 1);
        dossier.outcome.forEach(line => addColoredText(`> ${line}`, '#D83F47'));
        addColoredText('------------------------------------', 'rgb(100, 255, 130)');
        await typeText('СИСТЕМНЫЙ ОТЧЁТ:', 'output', 1);
        dossier.report.forEach(line => addColoredText(`> ${line}`, '#EFD76C'));
        addColoredText('------------------------------------', 'rgb(100, 255, 130)');
        await typeText(`СВЯЗАННЫЕ МИССИИ: ${dossier.missions}`, 'output', 1);

        // АУДИОПЛЕЕР
        if (dossier.audio) {
            const audioLine = document.createElement('div');
            audioLine.style.marginTop = '10px';
            const uniqueId = `audio_${subjectId.replace('0X', '')}`;
            
            audioLine.innerHTML = `
                <div style="color: #EFD76C; margin-bottom: 5px;">[АУДИОЗАПИСЬ ДОСТУПНА: ${dossier.audioDescription}]</div>
                <button id="playAudioBtn_${uniqueId}" style="
                    background: rgba(0, 51, 0, 0.8); 
                    color: rgb(100, 255, 130); 
                    border: 1px solid rgb(100, 255, 130); 
                    padding: 8px 15px; 
                    cursor: pointer;
                    font-family: 'Press Start 2P', 'Courier New', monospace;
                    font-size: 10px;
                    margin-right: 10px;">
                    ▶ ВОСПРОИЗВЕСТИ
                </button>
                <button id="stopAudioBtn_${uniqueId}" style="
                    background: rgba(51, 0, 0, 0.8); 
                    color: #D83F47; 
                    border: 1px solid #D83F47; 
                    padding: 8px 15px; 
                    cursor: pointer;
                    font-family: 'Press Start 2P', 'Courier New', monospace;
                    font-size: 10px;
                    display: none;">
                    ■ ОСТАНОВИТЬ
                </button>
                <span id="audioStatus_${uniqueId}" style="color: #888; margin-left: 10px; font-size: 10px;"></span>
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
                document.getElementById(`audioStatus_${uniqueId}`).style.color = 'rgb(100, 255, 130)';
            });

            document.getElementById(`stopAudioBtn_${uniqueId}`).addEventListener('click', function() {
                audioElement.pause();
                audioElement.currentTime = 0;
                this.style.display = 'none';
                document.getElementById(`playAudioBtn_${uniqueId}`).style.display = 'inline-block';
                document.getElementById(`audioStatus_${uniqueId}`).textContent = 'ОСТАНОВЛЕНО';
                document.getElementById(`audioStatus_${uniqueId}`).style.color = '#D83F47';
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
                document.getElementById(`audioStatus_${uniqueId}`).style.color = '#D83F47';
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
            addColoredText(`ОШИБКА: Файл ${noteId} не найден`, '#D83F47');
            return;
        }

        await typeText(`[${noteId} — "${note.title}"]`, 'output', 1);
        await typeText(`АВТОР: ${note.author}`, 'output', 1);
        addColoredText('------------------------------------', 'rgb(100, 255, 130)');
        
        if (Math.random() > 0.3 && noteId !== 'NOTE_001' && noteId !== 'NOTE_003' && noteId !== 'NOTE_004') {
            // Случайная ошибка для некоторых заметок
            addColoredText('ОШИБКА: Данные повреждены', '#D83F47');
            addColoredText('Восстановление невозможно', '#D83F47');
            await showLoading(1500, "Попытка восстановления данных");
            addColoredText('>>> СИСТЕМНЫЙ СБОЙ <<<', '#D83F47');
        } else {
            // Нормальное отображение
            note.content.forEach(line => {
                addColoredText(`> ${line}`, '#CCCCCC');
            });
        }
        
        addColoredText('------------------------------------', 'rgb(100, 255, 130)');
        await typeText('[ФАЙЛ ЗАКРЫТ]', 'output', 2);
    }

    // Обработка ввода
    document.addEventListener('keydown', function(e) {
        if (awaitingConfirmation) {
            if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') {
                e.preventDefault();
                confirmationCallback(true);
                awaitingConfirmation = false;
                confirmationCallback = null;
            } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
                e.preventDefault();
                confirmationCallback(false);
                awaitingConfirmation = false;
                confirmationCallback = null;
            }
            return;
        }
        
        if (isTyping) return;
        
        const currentCmd = document.getElementById('currentCmd');
        
        if (e.key === 'Enter') {
            if (currentLine.trim()) {
                processCommand(currentLine);
                currentLine = '';
            }
        } else if (e.key === 'Backspace') {
            currentLine = currentLine.slice(0, -1);
            currentCmd.textContent = currentLine;
        } else if (e.key === 'ArrowUp') {
            if (historyIndex > 0) {
                historyIndex--;
                currentLine = commandHistory[historyIndex];
                currentCmd.textContent = currentLine;
            }
        } else if (e.key === 'ArrowDown') {
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                currentLine = commandHistory[historyIndex];
                currentCmd.textContent = currentLine;
            } else {
                historyIndex = commandHistory.length;
                currentLine = '';
                currentCmd.textContent = '';
            }
        } else if (e.key.length === 1) {
            currentLine += e.key;
            currentCmd.textContent = currentLine;
        }
    });

    // Начальная настройка
    setTimeout(async () => {
        await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 1);
        await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', 'output', 1);
        await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 1);
        
        // Инициализация системы деградации
        initDegradationSystem();
        
        addInputLine();
    }, 300);
});
