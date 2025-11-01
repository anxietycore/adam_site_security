// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let currentLine = '';
let commandHistory = [];
let historyIndex = -1;
let isTyping = false;
let awaitingConfirmation = false;
let confirmationCallback = null;
let commandCount = 0;
let sessionStartTime = Date.now();
let degradationLevel = 0;
let resetScheduled = false;
let ambientHintTimeout = null;
let memoryEchoInterval = null;

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async function() {
    await loadState();
    startSessionTimer();
    startMemoryEcho();
    startAmbientHints();
    renderDegradationUI();
    await showWelcomeMessage();
    addInputLine();
});

// === ЗАГРУЗКА СОСТОЯНИЯ ===
async function loadState() {
    const saved = localStorage.getItem('vigor_state');
    if (saved) {
        const state = JSON.parse(saved);
        degradationLevel = state.degradationLevel || 0;
        commandCount = state.commandCount || 0;
        sessionStartTime = state.sessionStartTime || Date.now();
    }
}

// === СОХРАНЕНИЕ СОСТОЯНИЯ ===
function saveState() {
    const state = {
        degradationLevel,
        commandCount,
        sessionStartTime
    };
    localStorage.setItem('vigor_state', JSON.stringify(state));
}

// === ТАЙМЕР СЕССИИ (+1% каждые 30 сек) ===
function startSessionTimer() {
    setInterval(() => {
        if (!resetScheduled) {
            increaseDegradation(1, 'session');
        }
    }, 30000);
}

// === УВЕЛИЧЕНИЕ ДЕГРАДАЦИИ ===
function increaseDegradation(amount, source = 'command') {
    if (resetScheduled) return;
    degradationLevel = Math.min(99, degradationLevel + amount);
    saveState();
    renderDegradationUI();
    triggerDegradationEffects();
    if (degradationLevel >= 98) {
        scheduleAutoReset();
    }
}

// === СБРОС ПО ТАЙМЕРУ (98%) ===
function scheduleAutoReset() {
    if (resetScheduled) return;
    resetScheduled = true;
    playAudio('sounds/glich_e.mp3');
    document.body.classList.add('level-5-glitch');
    setTimeout(() => {
        performReset(true);
    }, 4000);
}

// === ВЫПОЛНЕНИЕ RESET ===
function performReset(isAuto = false) {
    if (isAuto) {
        document.body.classList.remove('level-5-glitch');
        addColoredText('> СИСТЕМА ВОССТАНОВЛЕНА', '#00FF41');
        playAudio('sounds/reset_recovery.mp3'); // тихий вдох
    }
    degradationLevel = 0;
    commandCount = 0;
    sessionStartTime = Date.now();
    resetScheduled = false;
    saveState();
    renderDegradationUI();
    clearDegradationEffects();
}

// === ОТОБРАЖЕНИЕ UI ДЕГРАДАЦИИ ===
function renderDegradationUI() {
    document.getElementById('degradation-value').textContent = `${degradationLevel}%`;
    const hintEl = document.getElementById('degradation-hint');
    hintEl.style.opacity = '0';
    hintEl.textContent = '';

    if (degradationLevel >= 60) {
        hintEl.textContent = '> команда RESET рекомендована для стабилизации';
        hintEl.style.opacity = '1';
    }
    if (degradationLevel >= 80) {
        hintEl.textContent = '> срочно введите RESET';
        hintEl.style.animation = 'pulse-cursor 1s infinite';
    }
}

// === ТРИГГЕР ЭФФЕКТОВ ПО УРОВНЯМ ===
function triggerDegradationEffects() {
    const body = document.body;
    body.className = ''; // сброс

    // УРОВЕНЬ 2
    if (degradationLevel >= 30) {
        body.classList.add('level-2');
    }

    // УРОВЕНЬ 3
    if (degradationLevel >= 60) {
        body.classList.add('level-3');
        if (degradationLevel === 70 || degradationLevel === 75) {
            playAudio('sounds/reset_com.mp3');
        }
    }

    // УРОВЕНЬ 4
    if (degradationLevel >= 80) {
        if (degradationLevel === 85 || degradationLevel === 90) {
            playAudio('sounds/reset_com_reverse.mp3');
        }
        // Инверсия раз в 5-10 сек
        if (Math.random() > 0.8 && !body.classList.contains('level-4-invert')) {
            body.classList.add('level-4-invert');
            setTimeout(() => body.classList.remove('level-4-invert'), 1500);
        }
        // Вибрация
        if (Math.random() > 0.7) {
            body.classList.add('level-4-vibrate');
            setTimeout(() => body.classList.remove('level-4-vibrate'), 300);
        }
    }

    // УРОВЕНЬ 5 — уже обрабатывается в scheduleAutoReset
}

// === ОЧИСТКА ЭФФЕКТОВ ===
function clearDegradationEffects() {
    document.body.className = '';
    renderDegradationUI();
}

// === ВОСПРОИЗВЕДЕНИЕ АУДИО ===
function playAudio(src) {
    const audio = new Audio(src);
    audio.volume = 0.7;
    audio.play().catch(e => console.warn('Audio play failed:', e));
}

// === ЭХО-ПАМЯТИ (ПРИЗРАКИ ТЕКСТА) ===
function startMemoryEcho() {
    const phrases = [
        'load consciousness…',
        'subject lost…',
        'не смотри',
        'он наблюдает',
        'ты ещё здесь?',
        'ошибка // сознание',
        'не отключайся'
    ];
    memoryEchoInterval = setInterval(() => {
        if (degradationLevel < 30) return;
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        const ghost = document.createElement('div');
        ghost.className = 'memory-ghost';
        ghost.textContent = phrase;
        ghost.style.top = `${Math.random() * 80 + 10}%`;
        ghost.style.left = `${Math.random() * 80 + 10}%`;
        ghost.style.opacity = '0';
        document.getElementById('memory-echo').appendChild(ghost);
        // Появление и исчезновение
        setTimeout(() => ghost.style.opacity = '0.2', 10);
        setTimeout(() => {
            ghost.style.opacity = '0';
            setTimeout(() => ghost.remove(), 300);
        }, 300);
    }, 18000); // раз в 15-25 сек
}

// === АМБИЕНТНЫЕ СООБЩЕНИЯ ===
function startAmbientHints() {
    const hints = [
        '[ошибка канала связи]',
        '[отклик неизвестного источника]',
        '[пользователь не идентифицирован]'
    ];
    function showRandomHint() {
        if (Math.random() > 0.3) return;
        const hint = hints[Math.floor(Math.random() * hints.length)];
        const el = document.getElementById('ambient-hint');
        el.textContent = hint;
        el.style.opacity = '1';
        setTimeout(() => {
            el.style.opacity = '0';
        }, 1500);
        ambientHintTimeout = setTimeout(showRandomHint, 60000 + Math.random() * 120000);
    }
    ambientHintTimeout = setTimeout(showRandomHint, 30000);
}

// === ПЕЧАТЬ ТЕКСТА ===
function typeText(text, className = 'output', speed = 15) {
    return new Promise((resolve) => {
        const line = document.createElement('div');
        line.className = className;
        document.getElementById('terminal').appendChild(line);
        let index = 0;
        isTyping = true;
        function typeChar() {
            if (index < text.length) {
                // Пропуск символов (Уровень 2+)
                if (degradationLevel >= 30 && Math.random() > 0.98) {
                    index++;
                } else {
                    line.textContent += text.charAt(index);
                    index++;
                }
                document.getElementById('terminal').scrollTop = document.getElementById('terminal').scrollHeight;
                setTimeout(typeChar, speed);
            } else {
                isTyping = false;
                resolve();
            }
        }
        typeChar();
    });
}

// === ЦВЕТНОЙ ВЫВОД ===
function addColoredText(text, color = 'rgb(100, 255, 130)', className = 'output') {
    const line = document.createElement('div');
    line.className = className;
    line.style.color = color;
    line.textContent = text;
    document.getElementById('terminal').appendChild(line);
    document.getElementById('terminal').scrollTop = document.getElementById('terminal').scrollHeight;
}

// === БЫСТРЫЙ ВЫВОД ===
function addOutput(text, className = 'output') {
    const line = document.createElement('div');
    line.className = className;
    line.textContent = text;
    document.getElementById('terminal').appendChild(line);
    document.getElementById('terminal').scrollTop = document.getElementById('terminal').scrollHeight;
}

// === ВВОД КОМАНДЫ ===
function addInputLine() {
    const spacer = document.createElement('div');
    spacer.style.height = '12px';
    document.getElementById('terminal').appendChild(spacer);
    const inputLine = document.createElement('div');
    inputLine.className = 'input-line';
    inputLine.innerHTML = '<span class="prompt">adam@secure:~$ </span><span class="cmd" id="currentCmd"></span><span class="cursor" id="cursor"></span>';
    document.getElementById('terminal').appendChild(inputLine);
    document.getElementById('terminal').scrollTop = document.getElementById('terminal').scrollHeight;
}

// === ОБРАБОТКА КОМАНД ===
async function processCommand(cmd) {
    if (isTyping || resetScheduled) return;
    const oldInput = document.querySelector('.input-line');
    if (oldInput) oldInput.remove();
    commandHistory.push(cmd);
    historyIndex = commandHistory.length;
    commandCount++;
    saveState();

    // Увеличение деградации за команды
    const degradeCommands = ['syst', 'syslog', 'net', 'dscr', 'subj', 'notes'];
    if (degradeCommands.includes(cmd.toLowerCase().split(' ')[0])) {
        increaseDegradation(1, 'command');
    }

    addOutput(`adam@secure:~$ ${cmd}`, 'command');
    const command = cmd.toLowerCase().split(' ')[0];
    const args = cmd.toLowerCase().split(' ').slice(1);

    switch(command) {
        case 'reset':
            performReset(false);
            break;
        case 'help':
        case 'clear':
        case 'syst':
        case 'syslog':
        case 'notes':
        case 'open':
        case 'subj':
        case 'dscr':
        case 'exit':
            // Здесь остается ваша существующая логика команд
            // (для краткости не дублирую, но она должна быть вставлена)
            // ВАЖНО: все вызовы typeText/addOutput должны использовать новые функции выше
            break;
        default:
            addColoredText(`команда не найдена: ${cmd}`, '#D83F47');
    }
    addInputLine();
}

// === ОБРАБОТКА КЛАВИАТУРЫ ===
document.addEventListener('keydown', function(e) {
    if (awaitingConfirmation) return;
    if (isTyping || resetScheduled) return;
    const currentCmd = document.getElementById('currentCmd');
    if (!currentCmd) return;

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

// === ПРИВЕТСТВИЕ ===
async function showWelcomeMessage() {
    await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 10);
    await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', 'output', 10);
    await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 10);
}
