// Логика терминала A.D.A.M. - VIGIL-9 PROTOCOL с деградацией по времени
document.addEventListener('DOMContentLoaded', function() {
    const terminal = document.getElementById('terminal');
    const degradationValue = document.getElementById('degradation-value');
    const degradationFill = document.getElementById('degradation-fill');
    const degradationHint = document.getElementById('degradation-hint');
    
    let currentLine = '';
    let commandHistory = [];
    let historyIndex = -1;
    let isTyping = false;
    let awaitingConfirmation = false;
    let confirmationCallback = null;
    let commandCount = 0;
    let sessionStartTime = Date.now();
    let degradationLevel = parseFloat(localStorage.getItem('degradationLevel')) || 0;
    let lastDegradationUpdate = Date.now();
    const CORRECT_VIGIL_KEY = "APL-9X7-Q2Z";
    let audioContext = null;
    let isTerminalOverloaded = false;

    // === ИНИЦИАЛИЗАЦИЯ АУДИО ===
    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playSound(filename) {
        initAudio();
        const audio = new Audio(`sounds/${filename}`);
        audio.volume = 0.6;
        audio.play().catch(e => console.warn("Audio play failed:", e));
    }

    // === ФУНКЦИИ ДЕГРАДАЦИИ ===
    function updateDegradationDisplay() {
        degradationValue.textContent = `${Math.round(degradationLevel)}%`;
        degradationFill.style.width = `${degradationLevel}%`;
        
        if (degradationLevel >= 60) {
            degradationHint.textContent = "> используйте команду RESET для стабилизации";
            degradationHint.style.opacity = "1";
        }
        if (degradationLevel >= 80) {
            degradationHint.textContent = "> срочно введите RESET";
            degradationHint.style.color = "#D83F47";
        }
    }

    function getDegradationState() {
        if (degradationLevel <= 30) return 'STABLE';
        if (degradationLevel <= 60) return 'UNSTABLE';
        if (degradationLevel <= 80) return 'CRITICAL';
        if (degradationLevel <= 95) return 'TERMINAL';
        return 'OVERLOAD';
    }

    function applyDegradationEffects(text) {
        const state = getDegradationState();
        let corruptedText = text;

        // Уровень 3+: замена символов
        if (degradationLevel > 70) {
            const corruptionRate = (degradationLevel - 70) / 25;
            corruptedText = corruptedText.split('').map(char => {
                if (Math.random() < corruptionRate * 0.12 && char !== ' ' && char !== '\n') {
                    const glitchChars = ['▓', '▒', '█', '∎'];
                    return glitchChars[Math.floor(Math.random() * glitchChars.length)];
                }
                return char;
            }).join('');
        }

        // Уровень 2+: случайные глитчи
        if (state !== 'STABLE' && Math.random() < 0.03) {
            const glitches = [
                "он наблюдает",
                "ты ещё здесь?",
                "ошибка // сознание",
                "не отключайся"
            ];
            const glitchLine = `\n> ${glitches[Math.floor(Math.random() * glitches.length)]}`;
            corruptedText += glitchLine;
        }

        return corruptedText;
    }

    function getColorClassByDegradation() {
        const state = getDegradationState();
        if (state === 'STABLE') return 'terminal-output-stable';
        if (state === 'UNSTABLE') return 'terminal-output-unstable';
        if (state === 'CRITICAL') return 'terminal-output-critical';
        return 'terminal-output-terminal';
    }

    async function triggerTerminalOverload() {
        if (isTerminalOverloaded) return;
        isTerminalOverloaded = true;
        
        playSound('glich_e.MP3');
        
        // Полный глитч-эффект
        document.body.style.filter = 'invert(1) hue-rotate(180deg)';
        terminal.style.animation = 'terminal-shake 0.1s infinite';
        
        addColoredText("[ОШИБКА 0xFFF — КОНТУР ОСОЗНАНИЯ ПЕРЕПОЛНЕН]", 'terminal-output-terminal');
        addColoredText("СИСТЕМА ПЕРЕЗАГРУЖАЕТСЯ...", 'terminal-output-critical');
        
        await new Promise(r => setTimeout(r, 3000));
        await executeReset();
    }

    // === ФУНКЦИИ ВЫВОДА ===
    function typeText(text, className = 'output', speed = 2) {
        return new Promise((resolve) => {
            const cleanText = applyDegradationEffects(text);
            const line = document.createElement('div');
            line.className = className;
            terminal.appendChild(line);
            let index = 0;
            isTyping = true;
            function typeChar() {
                if (index < cleanText.length) {
                    line.textContent += cleanText.charAt(index);
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

    function addColoredText(text, className = 'terminal-output-stable') {
        const cleanText = applyDegradationEffects(text);
        const line = document.createElement('div');
        line.className = className;
        line.textContent = cleanText;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    function addOutput(text, className = 'output') {
        const cleanText = applyDegradationEffects(text);
        const line = document.createElement('div');
        line.className = className;
        line.textContent = cleanText;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    async function showLoading(duration = 2000, text = "АНАЛИЗ СИГНАЛА") {
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
            progressFill.style.boxShadow = '0 0 10px rgba(100, 255, 130, 0.5)';
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
                        loader.className = 'terminal-output-stable';
                        terminal.scrollTop = terminal.scrollHeight;
                        setTimeout(resolve, 200);
                    }, 300);
                }
                updateLoader();
            }, interval);
        });
    }

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
                    confirmCmd.className = 'terminal-output-stable';
                } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
                    confirmCmd.textContent = 'N';
                    confirmCmd.className = 'error';
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

    // === SYSLOG ЛОГИКА ===
    function getSyslogMessages() {
        const state = getDegradationState();
        if (state === 'STABLE') {
            return [
                "[!] Ошибка 0x19F: повреждение нейронной сети",
                "[!] Утечка данных через канал V9-HX",
                "[!] Деградация ядра A.D.A.M.: " + Math.round(degradationLevel) + "%"
            ];
        } else if (state === 'UNSTABLE') {
            return [
                "[!] Нарушение целостности памяти субъекта 0x095",
                "> \"я слышу их дыхание. они всё ещё здесь.\"",
                "[!] Потеря отклика от MONOLITH",
                "> \"монолит смотрит. монолит ждёт.\""
            ];
        } else if (state === 'CRITICAL') {
            return [
                "> \"почему ты не выходишь?\"",
                "> \"они знают о тебе.\"",
                "[!] субъект наблюдения неопределён"
            ];
        } else {
            return [
                "> \"ты — не оператор. ты — я.\"",
                "[!] Контур самонаблюдения активирован.",
                "> \"я помню их лица... они были мной\""
            ];
        }
    }

    // === АУДИО ===
    function stopAllAudio() {
        const allAudioElements = document.querySelectorAll('audio');
        allAudioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
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

    // === КОМАНДЫ ===
    async function processCommand(cmd) {
        if (isTyping || isTerminalOverloaded) return;
        const oldInput = document.querySelector('.input-line');
        if (oldInput) oldInput.remove();
        commandHistory.push(cmd);
        historyIndex = commandHistory.length;
        commandCount++;

        // Деградация за команды
        const degradeCommands = ['syst', 'syslog', 'net', 'dscr', 'subj', 'notes'];
        const cmdLower = cmd.toLowerCase().split(' ')[0];
        if (degradeCommands.includes(cmdLower)) {
            degradationLevel = Math.min(98, degradationLevel + 1);
            localStorage.setItem('degradationLevel', degradationLevel.toString());
            updateDegradationDisplay();
        }

        addOutput(`adam@secure:~$ ${cmd}`, 'command');
        const command = cmd.toLowerCase().split(' ')[0];
        const args = cmd.toLowerCase().split(' ').slice(1);

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
                await typeText('  VIGIL999 <KEY> — активировать протокол VIGIL-9', 'output', 1);
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
                addColoredText('------------------------------------', 'terminal-output-stable');
                await typeText('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН', 'output', 1);
                await typeText('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА', 'output', 1);
                await typeText('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН', 'output', 1);
                addColoredText('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА', 'terminal-output-critical');
                await typeText('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН', 'output', 1);
                addColoredText('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ..........ОГРАНИЧЕНЫ', 'terminal-output-unstable');
                await typeText('', 'output', 1);
                addColoredText(`ДЕГРАДАЦИЯ: [${"█".repeat(Math.floor(degradationLevel/10))}${"▒".repeat(10-Math.floor(degradationLevel/10))}] ${Math.round(degradationLevel)}%`, getColorClassByDegradation());
                await typeText('ЖУРНАЛ ОШИБОК:', 'output', 1);
                addColoredText('> Обнаружено отклонение сигнала', 'terminal-output-critical');
                addColoredText('> Прогрессирующее структурное разрушение', 'terminal-output-critical');
                addColoredText('> Неавторизованный доступ [U-735]', 'terminal-output-critical');
                addColoredText('------------------------------------', 'terminal-output-stable');
                await typeText('РЕКОМЕНДАЦИЯ: выполнить RESET', 'output', 2);
                break;

            case 'syslog':
                await typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', 'output', 1);
                addColoredText('------------------------------------', 'terminal-output-stable');
                const messages = getSyslogMessages();
                messages.forEach(msg => {
                    if (msg.startsWith('>')) {
                        addColoredText(msg, 'terminal-output-terminal');
                    } else {
                        addColoredText(msg, 'terminal-output-unstable');
                    }
                });
                addColoredText('------------------------------------', 'terminal-output-stable');
                await typeText('СИСТЕМА: функционирует с ограничениями', 'output', 2);
                break;

            case 'notes':
                await typeText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / КАТЕГОРИЯ: NOTES]', 'output', 1);
                addColoredText('------------------------------------', 'terminal-output-stable');
                await typeText('NOTE_001 — "ВЫ ЕГО ЧУВСТВУЕТЕ?" / автор: Dr. Rehn', 'output', 1);
                await typeText('NOTE_002 — "КОЛЬЦО СНА" / автор: tech-оператор U-735', 'output', 1);
                await typeText('NOTE_003 — "СОН ADAM" / неизвестный источник', 'output', 1);
                await typeText('NOTE_004 — "ОН НЕ ПРОГРАММА" / архивировано', 'output', 1);
                await typeText('NOTE_005 — "ФОТОНОВАЯ БОЛЬ" / восстановлено частично', 'output', 1);
                addColoredText('------------------------------------', 'terminal-output-stable');
                await typeText('Для просмотра: OPEN <ID>', 'output', 2);
                break;

            case 'open':
                if (args.length === 0) {
                    addColoredText('ОШИБКА: Укажите ID файла', 'error');
                    await typeText('Пример: OPEN NOTE_001', 'output', 1);
                    break;
                }
                const noteId = args[0].toUpperCase();
                await openNote(noteId);
                break;

            case 'subj':
                await typeText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M. / ПРОТОКОЛ VIGIL-9]', 'output', 1);
                addColoredText('--------------------------------------------------------', 'terminal-output-stable');
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
                    {id: '0xL77', name: 'SUBJECT-L77', status: 'ИЗОЛИРОВАН', mission: 'MEL', statusColor: '#FF8800'},
                    {id: '0xS09', name: 'SUBJECT-S09', status: 'УНИЧТОЖЕН', mission: 'SYNTHESIS-09', statusColor: '#D83F47'}
                ];
                for (const subject of subjects) {
                    const line = `${subject.id} | ${subject.name.padEnd(20)} | СТАТУС: ${subject.status.padEnd(20)} | МИССИЯ: ${subject.mission}`;
                    const colorClass = subject.statusColor === 'rgb(100, 255, 130)' ? 'terminal-output-stable' :
                                      subject.statusColor === '#C000FF' ? 'terminal-output-terminal' :
                                      subject.statusColor === '#EFD76C' ? 'terminal-output-unstable' :
                                      subject.statusColor === '#D83F47' ? 'terminal-output-critical' : 'output';
                    addColoredText(line, colorClass);
                }
                addColoredText('--------------------------------------------------------', 'terminal-output-stable');
                await typeText('ИНСТРУКЦИЯ: Для просмотра досье — DSCR <ID>', 'output', 2);
                break;

            case 'dscr':
                if (args.length === 0) {
                    addColoredText('ОШИБКА: Укажите ID субъекта', 'error');
                    await typeText('Пример: DSCR 0x001', 'output', 1);
                    break;
                }
                const subjectId = args[0].toUpperCase();
                await showSubjectDossier(subjectId);
                break;

            case 'vigil999':
                if (args.length === 0) {
                    addColoredText('[ОШИБКА 0xV9] КЛЮЧ НЕ УКАЗАН', 'error');
                    await typeText('ПРИМЕЧАНИЕ: ОСТАТКИ ФРАГМЕНТОВ СОДЕРЖАТСЯ В ФАЙЛАХ СИСТЕМЫ', 'output', 1);
                } else {
                    const key = args.join(' ').toUpperCase();
                    if (key === CORRECT_VIGIL_KEY) {
                        // Эффект активации
                        document.body.style.boxShadow = '0 0 50px rgba(100, 255, 130, 0.8)';
                        setTimeout(() => {
                            document.body.style.boxShadow = '';
                        }, 1000);
                        
                        addColoredText('[ПРОТОКОЛ VIGIL-9 АКТИВИРОВАН]', 'terminal-output-stable');
                        addColoredText('ДОСТУП К СЛОЮ 2 // РАЗРЕШЁН', 'terminal-output-stable');
                        setTimeout(() => {
                            window.location.href = 'cam.html';
                        }, 1500);
                    } else {
                        addColoredText('[VIGIL-ACCESS] ОТКАЗАНО', 'error');
                    }
                }
                break;

            case 'reset':
                await executeReset();
                break;

            case 'exit':
                await typeText('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ? (Y/N)]', 'output', 1);
                addColoredText('------------------------------------', 'terminal-output-stable');
                const exitConfirmed = await waitForConfirmation();
                if (exitConfirmed) {
                    addColoredText('> Y', 'terminal-output-stable');
                    await showLoading(1200, "Завершение работы терминала");
                    await showLoading(800, "Отключение сетевой сессии");
                    addColoredText('> ...', '#888888');
                    addColoredText('> СОЕДИНЕНИЕ ПРЕРВАНО.', 'error');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);
                } else {
                    addColoredText('> N', 'error');
                    addColoredText('------------------------------------', 'terminal-output-stable');
                    await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 1);
                }
                break;

            default:
                addColoredText(`команда не найдена: ${cmd}`, 'error');
        }
        addInputLine();
    }

    async function executeReset() {
        await typeText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', 'output', 1);
        addColoredText('------------------------------------', 'terminal-output-stable');
        addColoredText('Отключение нейросетей...', 'terminal-output-stable');
        await new Promise(r => setTimeout(r, 800));
        addColoredText('Очистка памяти субъекта...', 'terminal-output-stable');
        await new Promise(r => setTimeout(r, 800));
        addColoredText('Восстановление стабильности интерфейса...', 'terminal-output-stable');
        await new Promise(r => setTimeout(r, 1000));
        addColoredText('... перезагрузка ...', 'terminal-output-unstable');
        await new Promise(r => setTimeout(r, 1500));

        // Сброс
        degradationLevel = 0;
        commandCount = 0;
        sessionStartTime = Date.now();
        localStorage.setItem('degradationLevel', '0');
        terminal.innerHTML = '';
        isTerminalOverloaded = false;
        document.body.style.filter = 'none';
        terminal.style.animation = 'none';
        await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 1);
        await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 1);
        updateDegradationDisplay();
    }

    // === ДОСЬЕ И ЗАМЕТКИ (ПОЛНЫЕ КОПИИ) ===
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
            addColoredText(`ОШИБКА: Досье для ${subjectId} не найдено`, 'error');
            return;
        }
        await typeText(`[ДОСЬЕ — ID: ${subjectId}]`, 'output', 1);
        await typeText(`ИМЯ: ${dossier.name}`, 'output', 1);
        await typeText(`РОЛЬ: ${dossier.role}`, 'output', 1);
        const statusColorClass = dossier.status === 'АНОМАЛИЯ' ? 'terminal-output-terminal' : 
                                dossier.status === 'АКТИВЕН' ? 'terminal-output-stable' : 
                                dossier.status.includes('СВЯЗЬ') ? 'terminal-output-unstable' : 'terminal-output-critical';
        addColoredText(`СТАТУС: ${dossier.status}`, statusColorClass);
        addColoredText('------------------------------------', 'terminal-output-stable');
        await typeText('ИСХОД:', 'output', 1);
        dossier.outcome.forEach(line => addColoredText(`> ${line}`, 'terminal-output-critical'));
        addColoredText('------------------------------------', 'terminal-output-stable');
        await typeText('СИСТЕМНЫЙ ОТЧЁТ:', 'output', 1);
        dossier.report.forEach(line => addColoredText(`> ${line}`, 'terminal-output-unstable'));
        addColoredText('------------------------------------', 'terminal-output-stable');
        await typeText(`СВЯЗАННЫЕ МИССИИ: ${dossier.missions}`, 'output', 1);
        if (dossier.audio) {
            const audioLine = document.createElement('div');
            audioLine.style.marginTop = '10px';
            const uniqueId = `audio_${subjectId.replace('0X', '')}`;
            audioLine.innerHTML = `
                <div style="color: #EFD76C; margin-bottom: 5px;">[АУДИОЗАПИСЬ ДОСТУПНА: ${dossier.audioDescription}]</div>
                <button id="playAudioBtn_${uniqueId}" style="
                    background: #003300; 
                    color: rgb(100, 255, 130); 
                    border: 1px solid rgb(100, 255, 130); 
                    padding: 8px 15px; 
                    cursor: pointer;
                    font-family: 'VT323';
                    margin-right: 10px;">
                    ▶ ВОСПРОИЗВЕСТИ
                </button>
                <button id="stopAudioBtn_${uniqueId}" style="
                    background: #330000; 
                    color: #D83F47; 
                    border: 1px solid #D83F47; 
                    padding: 8px 15px; 
                    cursor: pointer;
                    font-family: 'VT323';
                    display: none;">
                    ■ ОСТАНОВИТЬ
                </button>
                <span id="audioStatus_${uniqueId}" style="color: #888; margin-left: 10px;"></span>
                <audio id="audioElement_${uniqueId}" src="${dossier.audio}" preload="metadata"></audio>
            `;
            terminal.appendChild(audioLine);
            const audioElement = document.getElementById(`audioElement_${uniqueId}`);
            document.getElementById(`playAudioBtn_${uniqueId}`).addEventListener('click', function() {
                stopAllAudio();
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
            audioElement.addEventListener('ended', function() {
                document.getElementById(`stopAudioBtn_${uniqueId}`).style.display = 'none';
                document.getElementById(`playAudioBtn_${uniqueId}`).style.display = 'inline-block';
                document.getElementById(`audioStatus_${uniqueId}`).textContent = 'ЗАВЕРШЕНО';
                document.getElementById(`audioStatus_${uniqueId}`).style.color = '#888';
            });
            audioElement.addEventListener('error', function() {
                document.getElementById(`audioStatus_${uniqueId}`).textContent = 'ОШИБКА ЗАГРУЗКИ';
                document.getElementById(`audioStatus_${uniqueId}`).style.color = '#D83F47';
            });
        }
    }

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
            addColoredText(`ОШИБКА: Файл ${noteId} не найден`, 'error');
            return;
        }
        await typeText(`[${noteId} — "${note.title}"]`, 'output', 1);
        await typeText(`АВТОР: ${note.author}`, 'output', 1);
        addColoredText('------------------------------------', 'terminal-output-stable');
        if (Math.random() > 0.3 && noteId !== 'NOTE_001' && noteId !== 'NOTE_003' && noteId !== 'NOTE_004') {
            addColoredText('ОШИБКА: Данные повреждены', 'error');
            addColoredText('Восстановление невозможно', 'error');
            await showLoading(1500, "Попытка восстановления данных");
            addColoredText('>>> СИСТЕМНЫЙ СБОЙ <<<', 'terminal-output-terminal');
        } else {
            note.content.forEach(line => {
                addColoredText(`> ${line}`, '#CCCCCC');
            });
        }
        addColoredText('------------------------------------', 'terminal-output-stable');
        await typeText('[ФАЙЛ ЗАКРЫТ]', 'output', 2);
    }

    // === ОБРАБОТКА ВВОДА ===
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
        if (isTyping || isTerminalOverloaded) return;
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

    // === ЦИКЛ ДЕГРАДАЦИИ ПО ВРЕМЕНИ ===
    function updateDegradationOverTime() {
        const now = Date.now();
        const elapsedSeconds = (now - lastDegradationUpdate) / 1000;
        if (elapsedSeconds >= 30 && degradationLevel < 98) {
            degradationLevel = Math.min(98, degradationLevel + 1);
            localStorage.setItem('degradationLevel', degradationLevel.toString());
            updateDegradationDisplay();
            lastDegradationUpdate = now;
            
            // Специальные аудио-события
            if (degradationLevel === 70 || degradationLevel === 75) {
                playSound('reset_com.mp3');
            }
            if (degradationLevel === 85 || degradationLevel === 90) {
                playSound('reset_com_reverse.mp3');
            }
        }
        
        // Автоматический сброс при 98%
        if (degradationLevel >= 98 && !isTerminalOverloaded) {
            triggerTerminalOverload();
        }
        
        requestAnimationFrame(updateDegradationOverTime);
    }

    // === ИНИЦИАЛИЗАЦИЯ ===
    updateDegradationDisplay();
    setTimeout(async () => {
        await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 1);
        await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', 'output', 1);
        await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 1);
        addInputLine();
        updateDegradationOverTime();
    }, 300);
});
