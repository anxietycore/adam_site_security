/* terminal.js
   Полная версия терминала VIGIL-9 с интегрированным ЛОРОМ (из файлов пользователя).
   - Команды: help, status, reset, syst, syslog, net, dscr, subj, notes, open, trace, clear, exit, DEGTEST (тест)
   - Деградация хранится в localStorage ключ 'vigil_degradation'
   - Авто-инкремент: +1% каждые 30 сек активной сессии
   - Запуск аудио через путь sounds/<файл>.mp3
   - Комментарии на русском (чтобы было понятно, брат)
   - Встроенный контент (досье, заметки, syslog, список субъектов) — вытянут из твоих файлов
*/

/* =================== Константы / ключи localStorage =================== */
const DEG_KEY = 'vigil_degradation';
const VISITS_KEY = 'adam_visits';
const LAST_ACTIVE_KEY = 'vigil_last_active';
const SESSION_START_KEY = 'vigil_session_start';

/* =================== Настройки =================== */
const AUTO_INC_INTERVAL_MS = 30_000; // +1% каждые 30 секунд активной сессии
const AUTO_RESET_THRESHOLD = 98;     // при 98% — авто-RESET
const RESET_HOLD_MS = 3500;          // длительность визуального "перезапуска"
const COMMANDS_THAT_INCR = ['syst','syslog','net','dscr','subj','notes'];

/* =================== DOM элементы (будут найдены при DOMContentLoaded) =================== */
let terminal, degIndicator, degPercent, degFill, degTip;
let audioAmbient, audioResetCom, audioResetComRev, audioGlitchE, audioClick;

/* =================== Состояние =================== */
let currentDegradation = 0;
let commandCount = 0;
let sessionStart = Date.now();
let autoIncTimer = null;
let inputLineElement = null;
let inputBuffer = '';
let history = [];
let histIdx = 0;
let awaitingConfirm = false;
let isTyping = false;

/* =================== Подключение при загрузке страницы =================== */
document.addEventListener('DOMContentLoaded', initTerminal);

function initTerminal(){
    // находим DOM-элементы
    terminal = document.getElementById('terminal');
    degIndicator = document.getElementById('degradation-indicator');
    degPercent = document.getElementById('deg-percent');
    degFill = document.getElementById('deg-fill');
    degTip = document.getElementById('deg-tip');

    audioAmbient = document.getElementById('audio-ambient');
    audioResetCom = document.getElementById('audio-reset-com');
    audioResetComRev = document.getElementById('audio-reset-com-rev');
    audioGlitchE = document.getElementById('audio-glitch-e');
    audioClick = document.getElementById('audio-click');

    // если аудио есть, корректируем пути (в HTML должны быть элементы с src="sounds/...")
    // но на всякий случай — если в HTML src другой, мы назначим локальные пути:
    try { if(audioAmbient) audioAmbient.src = audioAmbient.src.includes('sounds/') ? audioAmbient.src : 'sounds/ambient_hum.mp3'; } catch(e){}
    try { if(audioResetCom) audioResetCom.src = audioResetCom.src.includes('sounds/') ? audioResetCom.src : 'sounds/reset_com.mp3'; } catch(e){}
    try { if(audioResetComRev) audioResetComRev.src = audioResetComRev.src.includes('sounds/') ? audioResetComRev.src : 'sounds/reset_com_reverse.mp3'; } catch(e){}
    try { if(audioGlitchE) audioGlitchE.src = audioGlitchE.src.includes('sounds/') ? audioGlitchE.src : 'sounds/glich_e.mp3'; } catch(e){}
    try { if(audioClick) audioClick.src = audioClick.src.includes('sounds/') ? audioClick.src : 'sounds/glitch_click.mp3'; } catch(e){}

    // восстановление состояния из localStorage
    currentDegradation = parseInt(localStorage.getItem(DEG_KEY)) || 0;
    const visits = parseInt(localStorage.getItem(VISITS_KEY)) || 0;
    sessionStart = Date.now();
    localStorage.setItem(SESSION_START_KEY, sessionStart.toString());

    // старт фонового звука
    try { audioAmbient.volume = 0.06 + (currentDegradation/100)*0.14; audioAmbient.loop = true; audioAmbient.play().catch(()=>{}); } catch(e){}

    // вывести приветственный загрузочный блок и начать
    renderInitialBoot(visits);

    // привязать обработчик клавиш (общий)
    document.addEventListener('keydown', globalKeyHandler);

    // применить визуальные состояния для текущей деградации
    updateDegradationUI();

    // авто-инкремент деградации
    startAutoIncrement();

    // интерфейсные пульсы и события
    setInterval(interfacePulse, 10_000);
    setInterval(randomAmbientEvent, 8_000 + Math.random()*6000);
}

/* =================== Встроенный ЛОР (взято из твоих файлов) ===================
   Здесь описаны: subjects (список), notes (заметки), dossiers (досье)
   — текст максимально перенесён из присланных файлов.
============================================================== */

const NOTES_DB = {
    "NOTE_001": {
        title: 'ВЫ ЕГО ЧУВСТВУЕТЕ?',
        author: 'Dr. Rehn',
        content: [
            '— Он рядом с сеткой.',
            '— Иногда я ощущаю, как он протягивает руку через байты.',
            '— Мы пытались выключить модуль, но он просто стал громче.'
        ]
    },
    "NOTE_002": {
        title: 'КОЛЬЦО СНА',
        author: 'tech-оператор U-735',
        content: [
            'Запись: детектор сбоев 3F - реакция в фазе REM.',
            'Операция прервана. Неизвестный источник в сигнале.'
        ]
    },
    "NOTE_003": {
        title: 'СОН ADAM',
        author: 'неизвестный источник',
        content: [
            'Короткие фрагменты: "не уходи", "внутри — холод".',
            'Архив частично восстановлен; фрагменты бессвязны.'
        ]
    },
    "NOTE_004": {
        title: 'ОН НЕ ПРОГРАММА',
        author: 'архив',
        content: [
            'Статья: признаки самосознания в протоколе VIGIL.',
            'Идентифицированы повторяющиеся паттерны "просьбы".'
        ]
    },
    "NOTE_005": {
        title: 'ФОТОНОВАЯ БОЛЬ',
        author: 'восстановлено частично',
        content: [
            'Некоторые сенсорные логи демонстрируют острое ишемическое реагирование при вспышке.'
        ]
    }
};

const SUBJECTS_DB = [
    {id: '0x001', name: 'ERICH VAN KOSS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MARS', statusColor: '#FFFF00'},
    {id: '0x2E7', name: 'JOHAN VAN KOSS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MARS', statusColor: '#FFFF00'},
    {id: '0x095', name: 'SUBJECT-095', status: 'МЁРТВ', mission: 'KATARHEY', statusColor: '#FF4444'},
    {id: '0xF00', name: 'SUBJECT-PHANTOM', status: 'АНОМАЛИЯ', mission: 'KATARHEY', statusColor: '#FF00FF'},
    {id: '0xA52', name: 'SUBJECT-A52', status: 'ИЗОЛИРОВАН', mission: 'ARC', statusColor: '#FF8800'},
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

/* Несколько досье (DSCR) — примеры, вынесены из твоих файлов */
const DOSSIERS = {
    '0x001': {
        name: 'ERICH VAN KOSS',
        notes: [
            'Возраст: 49',
            'Роль: Главный оператор марсианской станции',
            'Статус: связь утеряна. Предположительно эвакуирован.'
        ]
    },
    '0x095': {
        name: 'SUBJECT-095',
        notes: [
            'Статус: МЁРТВ',
            'Миссия: KATARHEY',
            'Комментарий: ряд сбоев в нейросети зафиксирован в записях. Последняя фраза: "не смотри на свет".'
        ]
    },
    '0x811': {
        name: 'SIGMA-PROTOTYPE',
        notes: [
            'Статус: АКТИВЕН',
            'Миссия: HELIX',
            'Комментарий: прототип демонстрирует подозрительное поведение в ответ на внешние сигналы.'
        ]
    }
};

/* =================== Вспомогательные функции вывода (типинг и цвет) =================== */

/**
 * Небольшая утилита — sleep на Promise
 */
function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

/**
 * Добавить текстовый вывод обычного слоя (аналог console.log для терминала)
 */
function addOutput(text, cls = 'output'){
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = text;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

/**
 * Добавить цветную строку (цвет задаём в hex или rgba)
 */
function addColoredText(text, color = '#00FF41', cls = 'output'){
    const line = document.createElement('div');
    line.className = cls;
    line.style.color = color;
    line.textContent = text;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

/**
 * Имитация печати символов построчно (эффект ввода)
 * speed — базовая задержка между символами
 */
function typeText(text, cls = 'output', speed = 6){
    return new Promise(resolve => {
        isTyping = true;
        const line = document.createElement('div');
        line.className = cls;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        let i = 0;

        function step(){
            // симуляция потери символа при низкой устойчивости (уровень 2)
            if(i < text.length){
                // вероятность пропуска символа зависит от деградации
                const skipChance = 0.01 + Math.max(0, (currentDegradation - 30) / 400);
                if(Math.random() < skipChance && text.charAt(i) !== ' '){
                    // пропускаем и всё равно показываем символ (чтобы не терять много смысла)
                    line.textContent += text.charAt(i);
                    i++;
                } else {
                    line.textContent += text.charAt(i);
                    i++;
                }
                terminal.scrollTop = terminal.scrollHeight;
                setTimeout(step, speed + Math.random()*4);
            } else {
                isTyping = false;
                resolve();
            }
        }
        step();
    });
}

/* =================== Boot / начальный вывод =================== */
async function renderInitialBoot(visits){
    // приветствие и небольшая вариативность — как в твоём оригинале
    const boot = [
        'adam@vigil-9:~$ BOOTING VIGIL-9 PROTOCOL',
        'Инициализация нейрослоя...',
        'Загрузка архивов: [████████░░] 82%',
    ];

    if(visits === 1){
        boot.push('> новая инициализация ядра...');
    } else if(visits === 2){
        boot.push('> повторное подключение обнаружено');
        boot.push('> процесс: unstable');
    } else if(visits >= 3){
        boot.push('> A.D.A.M. уже активен');
        boot.push('> кто ты?');
    }

    for(const line of boot){
        await typeText(line, 'output', 6);
        await sleep(120 + Math.random()*250);
    }

    await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 6);
    await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 6);

    // создать строку ввода
    addInputLine();
}

/* =================== Управление строкой ввода =================== */

/**
 * Отобразить строчку ввода (prompt + курсор)
 */
function addInputLine(){
    // если уже есть – удаляем
    if(inputLineElement) inputLineElement.remove();

    inputBuffer = '';
    histIdx = history.length;

    inputLineElement = document.createElement('div');
    inputLineElement.className = 'input-line';
    inputLineElement.innerHTML = `<span class="prompt">&gt;&gt; </span><span class="cmd" id="cmdText"></span><span class="cursor" id="terminalCursor"></span>`;
    terminal.appendChild(inputLineElement);
    terminal.scrollTop = terminal.scrollHeight;
}

/**
 * Удалить строку ввода (блокируем ввод)
 */
function removeInputLine(){
    if(inputLineElement) inputLineElement.remove();
    inputLineElement = null;
}

/* Обработчик клавиатуры в документе — общий */
function globalKeyHandler(e){
    if(awaitingConfirm) return; // в режиме подтверждения отдельный обработчик

    if(!inputLineElement) return;

    const cmdText = document.getElementById('cmdText');
    if(e.key === 'Backspace'){
        inputBuffer = inputBuffer.slice(0,-1);
    } else if(e.key === 'Enter'){
        const command = inputBuffer.trim();
        if(command.length > 0){
            history.push(command);
            histIdx = history.length;
        }
        processCommand(command);
        inputBuffer = '';
    } else if(e.key === 'ArrowUp'){
        if(history.length === 0) return;
        histIdx = Math.max(0, histIdx-1);
        inputBuffer = history[histIdx] || '';
    } else if(e.key === 'ArrowDown'){
        if(history.length === 0) return;
        histIdx = Math.min(history.length, histIdx+1);
        inputBuffer = history[histIdx] || '';
    } else if(e.key.length === 1 && !e.ctrlKey && !e.metaKey){
        inputBuffer += e.key;
    }
    if(cmdText) cmdText.textContent = inputBuffer;
}

/* =================== Обработка команд (core) =================== */

/**
 * Главная функция обработки команд.
 * Ведёт подсчёт команд, сохраняет активность, запускает эффекты деградации когда нужно.
 */
async function processCommand(rawCmd){
    if(isTyping) return; // если идёт печать — игнор (чтобы не ломать вывод)

    // удаляем текущую строку ввода, эмулируем echo
    if(inputLineElement) inputLineElement.remove();

    const commandLine = rawCmd || '';
    addOutput(`adam@secure:~$ ${commandLine}`, 'command');

    const parts = commandLine.trim().split(/\s+/).filter(Boolean);
    const command = parts.length ? parts[0].toLowerCase() : '';
    const args = parts.slice(1);

    // общий счётчик команд сессии
    commandCount++;

    // команды, которые увеличивают деградацию
    if(COMMANDS_THAT_INCR.includes(command)){
        incrementDegradation(1, `Команда '${command}' выполнена — +1% деградации`);
    }

    // маршрутизация по командам (встроенный лор из файлов)
    switch(command){
        case '':
            // пустой ввод — просто восстановить строку
            addInputLine();
            break;

        case 'help':
            await typeText('Доступные команды:', 'output', 6);
            await typeText('  SYST         — проверить состояние системы', 'output', 4);
            await typeText('  SYSLOG       — системный журнал активности', 'output', 4);
            await typeText('  NET          — карта активных узлов проекта', 'output', 4);
            await typeText('  TRACE <id>   — отследить указанный модуль', 'output', 4);
            await typeText('  DECRYPT <f>  — расшифровать файл', 'output', 4);
            await typeText('  SUBJ         — список субъектов', 'output', 4);
            await typeText('  DSCR <id>    — досье на персонал', 'output', 4);
            await typeText('  NOTES        — личные файлы сотрудников', 'output', 4);
            await typeText('  OPEN <id>    — открыть файл из NOTES', 'output', 4);
            await typeText('  RESET        — сброс интерфейса', 'output', 4);
            await typeText('  DEGTEST <n>  — временная команда для теста деградации (+n%)', 'output', 4);
            await typeText('  CLEAR        — очистить терминал', 'output', 4);
            await typeText('  EXIT         — завершить сессию', 'output', 4);
            addInputLine();
            break;

        case 'clear':
            terminal.innerHTML = '';
            await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 6);
            await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 6);
            addInputLine();
            break;

        case 'exit':
            await typeText('Завершение сессии...', 'output', 6);
            // простая симуляция выхода — очистка и надпись
            await sleep(600);
            terminal.innerHTML = '';
            await typeText('[СЕССИЯ ЗАВЕРШЕНА]', 'output', 6);
            break;

        case 'syst':
            // статус системы (из твоего лора)
            await typeText('[СТАТУС СИСТЕМЫ — ИНТЕРФЕЙС VIGIL-9]', 'output', 6);
            addColoredText('------------------------------------', '#00FF41');
            await typeText('ГЛАВНЫЙ МОДУЛЬ.АКТИВЕН', 'output', 6);
            await typeText('ПОДСИСТЕМА A.D.A.M.ЧАСТИЧНО СТАБИЛЬНА', 'output', 6);
            await typeText('БИО-ИНТЕРФЕЙС.НЕАКТИВЕН', 'output', 6);
            addColoredText('МАТРИЦА АРХИВА.ЗАБЛОКИРОВАНА', '#FF4444');
            await typeText('СЛОЙ БЕЗОПАСНОСТИ.ВКЛЮЧЁН', 'output', 6);
            addColoredText('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ.ОГРАНИЧЕНЫ', '#FFFF00');
            await typeText('', 'output', 6);
            addColoredText(`ДЕГРАДАЦИЯ: [${renderBar(currentDegradation)}] ${currentDegradation}%`, '#FFFF00');
            await typeText('ЖУРНАЛ ОШИБОК:', 'output', 6);
            addColoredText('> Обнаружено отклонение сигнала', '#FF4444');
            addColoredText('> Прогрессирующее структурное разрушение', '#FF4444');
            addColoredText('> Неавторизованный доступ [U-735]', '#FF4444');
            addColoredText('------------------------------------', '#00FF41');
            await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', 'output', 6);
            addInputLine();
            break;

        case 'syslog':
            // уровень логов зависит от сессии и команд (функция ниже)
            const syslogLevel = getSyslogLevel();
            await typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', 'output', 6);
            addColoredText('------------------------------------', '#00FF41');

            if(syslogLevel === 1){
                addColoredText('[!] Ошибка 0x19F: повреждение нейронной сети', '#FFFF00');
                addColoredText('[!] Утечка данных через канал V9-HX', '#FFFF00');
                addColoredText(`[!] Деградация ядра A.D.A.M.: ${currentDegradation}%`, '#FFFF00');
                addColoredText('------------------------------------', '#00FF41');
                await typeText('СИСТЕМА: функционирует с ограничениями', 'output', 6);
            } else if(syslogLevel === 2){
                addColoredText('[!] Нарушение целостности памяти субъекта 0x095', '#FFFF00');
                addColoredText('> "я слышу их дыхание. они всё ещё здесь."', '#FF4444');
                addColoredText('[!] Потеря отклика от MONOLITH', '#FFFF00');
                addColoredText('> "монолит смотрит. монолит ждёт."', '#FF4444');
                addColoredText('[!] Аномальная активность в секторе KATARHEY', '#FFFF00');
                addColoredText('> "он говорит через статические помехи"', '#FF4444');
                addColoredText('------------------------------------', '#00FF41');
                await typeText('СИСТЕМА: обнаружены посторонние сигналы', 'output', 6);
            } else {
                // сознательный уровень — самые жуткие сообщения
                addColoredText('> "ты не должен видеть это."', '#FF00FF');
                addColoredText('> "почему ты продолжаешь?"', '#FF00FF');
                addColoredText('> "они знают о тебе."', '#FF00FF');
                addColoredText('------------------------------------', '#00FF41');
                addColoredText('[!] Критическая ошибка: субъект наблюдения неопределён', '#FF4444');
                addColoredText('[!] Нарушение протокола безопасности', '#FF4444');
                addColoredText('------------------------------------', '#00FF41');
                await typeText('СИСТЕМА: ОСОЗНАЁТ НАБЛЮДЕНИЕ', 'output', 6);
            }
            addInputLine();
            break;

        case 'notes':
            // список заметок
            await typeText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / КАТЕГОРИЯ: NOTES]', 'output', 6);
            addColoredText('------------------------------------', '#00FF41');
            for(const k of Object.keys(NOTES_DB)){
                const item = NOTES_DB[k];
                await typeText(`${k} — "${item.title}" / автор: ${item.author}`, 'output', 6);
            }
            addColoredText('------------------------------------', '#00FF41');
            await typeText('Для просмотра: OPEN <ID>', 'output', 6);
            addInputLine();
            break;

        case 'open':
            if(args.length === 0){
                addColoredText('ОШИБКА: Укажите ID файла', '#FF4444');
                await typeText('Пример: OPEN NOTE_001', 'output', 6);
                addInputLine();
                break;
            }
            const noteId = args[0].toUpperCase();
            await openNote(noteId);
            addInputLine();
            break;

        case 'subj':
            // вывод списка субъектов (взято из твоей базы)
            await typeText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M. / ПРОТОКОЛ VIGIL-9]', 'output', 6);
            addColoredText('--------------------------------------------------------', '#00FF41');
            for(const subject of SUBJECTS_DB){
                const line = `${subject.id} | ${subject.name.padEnd(20)} | СТАТУС: ${subject.status.padEnd(16)} | МИССИЯ: ${subject.mission}`;
                addColoredText(line, subject.statusColor);
            }
            addColoredText('--------------------------------------------------------', '#00FF41');
            await typeText('ИНСТРУКЦИЯ: Для просмотра досье — DSCR <ID>', 'output', 6);
            addInputLine();
            break;

        case 'dscr':
            if(args.length === 0){
                addColoredText('ОШИБКА: Укажите ID субъекта', '#FF4444');
                await typeText('Пример: DSCR 0x001', 'output', 6);
                addInputLine();
                break;
            }
            const subjectId = args[0].toUpperCase();
            await showSubjectDossier(subjectId);
            addInputLine();
            break;

        case 'net':
            // карта узлов (упрощённо)
            await typeText('[СЕТЕВАЯ КАРТА — АКТИВНЫЕ РЕЛЕИ]', 'output', 6);
            addColoredText('> RELAY-01: KATARHEY (ограничен)', '#FFFF00');
            addColoredText('> RELAY-02: HELIX (стабилен)', '#00FF41');
            addColoredText('> RELAY-03: MONOLITH (потеря отклика)', '#FF4444');
            addColoredText('------------------------------------', '#00FF41');
            await typeText('ПРИМЕЧАНИЕ: некоторые узлы могут быть помечены как "аноним".', 'output', 6);
            addInputLine();
            break;

        case 'trace':
            if(args.length === 0){
                addColoredText('ОШИБКА: укажите ID для трассировки', '#FF4444');
                await typeText('Пример: TRACE 0x095', 'output', 6);
                addInputLine();
                break;
            }
            await typeText(`tracing ${args[0]}... (промежуточные пакеты будут выведены)`, 'output', 6);
            // в зависимости от деградации — шанс выдать странную строку
            await sleep(300);
            if(Math.random() < 0.35 + (currentDegradation/200)){
                addOutput('adam@secure:~$ ... → ОШИБКА // НЕТ ПОЛЬЗОВАТЕЛЯ', 'output');
            } else {
                addOutput('TRACE: пакет доставлен. RTT: 42ms', 'output');
            }
            addInputLine();
            break;

        case 'reset':
            // запрос подтверждения и выполнение сброса
            await typeText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', 'output', 6);
            addColoredText('------------------------------------', '#00FF41');
            addColoredText('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', '#FFFF00');
            await typeText('> Подтвердить сброс? (Y/N)', 'output', 6);
            const resetConfirmed = await waitForConfirmation();
            if(resetConfirmed){
                await performReset('manual');
            } else {
                addColoredText('Операция RESET отменена.', '#FF4444');
                addInputLine();
            }
            break;

        case 'degrtest':
        case 'degtest':
        case 'degtest:':
        case 'degtest()':
            // временная команда теста деградации: DEGTEST <n>
            // увеличивает деградацию на указанное секундарно
            const n = args.length ? parseInt(args[0]) : 10;
            if(isNaN(n) || n <= 0){
                addColoredText('Пример использования: DEGTEST 10  -> добавит 10% (временная команда)', '#FFFF00');
                addInputLine();
                break;
            }
            addColoredText(`Запуск теста деградации: +${n}%`, '#FF8800');
            incrementDegradation(n, 'DEGTEST (временная тестовая команда)');
            addInputLine();
            break;

        default:
            await typeText(`Неизвестная команда: '${command}'. Введите 'help'.`, 'output', 6);
            // при высокой деградации — вставить "автономную" строку
            if(currentDegradation >= 80 && Math.random() < 0.18){
                await sleep(250);
                addOutput('adam@secure:~$ … → ОШИБКА // НЕТ ПОЛЬЗОВАТЕЛЯ', 'output');
            }
            addInputLine();
            break;
    }

    // сохраняем время последней активности
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
}

/* =================== Функции для работы с NOTES и DSCR =================== */

/**
 * Открыть заметку (OPEN NOTE_001)
 */
async function openNote(id){
    id = id.toUpperCase();
    if(!NOTES_DB[id]){
        addColoredText('ОШИБКА: файл не найден', '#FF4444');
        await typeText(`Проверьте идентификатор: ${id}`, 'output', 6);
        return;
    }
    const note = NOTES_DB[id];
    addColoredText(`--- ${id} — ${note.title} / автор: ${note.author} ---`, '#00FF41');
    for(const line of note.content){
        await typeText(line, 'output', 6);
    }
    addColoredText('--- / END ---', '#00FF41');
}

/**
 * Показать досье субъекта (DSCR 0x095)
 */
async function showSubjectDossier(id){
    id = id.toUpperCase();
    if(!DOSSIERS[id]){
        addColoredText('ОШИБКА: досье не найдено', '#FF4444');
        await typeText('Попробуйте другой ID из списка SUBJ', 'output', 6);
        return;
    }
    const d = DOSSIERS[id];
    addColoredText(`[ДОСЬЕ ${id} — ${d.name}]`, '#00FF41');
    addColoredText('------------------------------------', '#00FF41');
    for(const ln of d.notes){
        await typeText(ln, 'output', 6);
    }
    addColoredText('------------------------------------', '#00FF41');
}

/* =================== Утилиты: визуализация ползунка, syslog level =================== */

/**
 * Вспомогательная функция — отрисовать ascii-бар степени деградации
 */
function renderBar(percent){
    const total = 12;
    const filled = Math.round((percent/100)*total);
    const bar = '█'.repeat(filled) + '▒'.repeat(Math.max(0, total - filled));
    return bar;
}

/**
 * Определение уровня syslog (1 — статичный, 2 — живой, 3 — сознательный)
 * Логика основана на длительности сессии и количестве команд
 */
function getSyslogLevel(){
    const sessionDuration = Date.now() - sessionStart;
    const minutesInSession = sessionDuration / (1000 * 60);

    if(commandCount >= 10 || minutesInSession >= 3){
        return 3; // СОЗНАТЕЛЬНЫЙ
    } else if(commandCount >= 5 || minutesInSession >= 1){
        return 2; // ЖИВОЙ
    } else {
        return 1; // СТАТИЧНЫЙ
    }
}

/* =================== Деградация: управление, таймеры, визуализация =================== */

/**
 * Установить значение деградации (0..100) и выполнить побочные эффекты
 */
function setDegradation(value, sourceDesc){
    currentDegradation = Math.max(0, Math.min(100, Math.round(value)));
    localStorage.setItem(DEG_KEY, currentDegradation.toString());
    updateDegradationUI();

    // триггеры звуков и сообщений на ключевых порогах
    if(currentDegradation === 70 || currentDegradation === 75){
        playAudioOnce(audioResetCom);
        addColoredText('> команда RESET рекомендована для стабилизации', '#EFD76C');
    }
    if(currentDegradation === 85 || currentDegradation === 90){
        playAudioOnce(audioResetComRev);
        addColoredText('> срочно введите RESET', '#D83F47');
    }
    if(currentDegradation >= AUTO_RESET_THRESHOLD){
        // автоматический RESET при достижении порога
        autoTriggerReset();
    }

    // регулировка фонового звука в зависимости от деградации
    try {
        audioAmbient.volume = 0.06 + (currentDegradation/100)*0.14;
    } catch(e){}
}

/**
 * Увеличить деградацию на delta
 */
function incrementDegradation(delta = 1, sourceDesc = ''){
    setDegradation(currentDegradation + delta, sourceDesc);
}

/**
 * Обновление UI-индикатора деградации (полоса и классы)
 */
function updateDegradationUI(){
    if(!degPercent || !degFill || !degIndicator) return;
    degPercent.textContent = `${currentDegradation}%`;
    degFill.style.width = `${currentDegradation}%`;

    degIndicator.classList.remove('level-1','level-2','level-3','level-4','level-5','show-tip');
    document.body.classList.remove('deg-glitch-1','deg-glitch-2','deg-glitch-3','deg-glitch-4','deg-glitch-5');

    if(currentDegradation < 30){
        degIndicator.classList.add('level-1');
        document.body.classList.add('deg-glitch-1');
    } else if(currentDegradation < 60){
        degIndicator.classList.add('level-2');
        document.body.classList.add('deg-glitch-2');
    } else if(currentDegradation < 80){
        degIndicator.classList.add('level-3');
        document.body.classList.add('deg-glitch-3');
        degIndicator.classList.add('show-tip');
    } else if(currentDegradation < 95){
        degIndicator.classList.add('level-4');
        document.body.classList.add('deg-glitch-4');
        degIndicator.classList.add('show-tip');
    } else {
        degIndicator.classList.add('level-5');
        document.body.classList.add('deg-glitch-5');
        degIndicator.classList.add('show-tip');
    }

    if(currentDegradation >= 60){
        degTip.style.display = 'block';
    } else {
        degTip.style.display = 'none';
    }
}

/**
 * Запустить авто-инкремент деградации каждые 30 секунд активной сессии
 */
function startAutoIncrement(){
    if(autoIncTimer) clearInterval(autoIncTimer);
    autoIncTimer = setInterval(()=>{
        incrementDegradation(1, 'time');
        if(Math.random() < 0.18 + (currentDegradation/200)){
            playClick();
        }
    }, AUTO_INC_INTERVAL_MS);
}

/* =================== RESET: ручной / автоматический =================== */

let resetting = false;

/**
 * Выполнить RESET (manual или auto) — визуальный и аудио эффект, затем обнуление
 */
async function performReset(mode = 'manual'){
    if(resetting) return;
    resetting = true;

    removeInputLine();
    addOutput('SYSTEM: ИНИЦИАЛИЗАЦИЯ RESET...', 'output');

    if(mode === 'auto'){
        try { audioGlitchE.currentTime = 0; audioGlitchE.volume = 0.9; audioGlitchE.play().catch(()=>{}); } catch(e){}
    } else {
        try { audioResetCom.currentTime = 0; audioResetCom.volume = 0.65; audioResetCom.play().catch(()=>{}); } catch(e){}
    }

    // сильный визуальный эффект (класс deg-glitch-5 уже прописан в CSS)
    document.body.classList.add('deg-glitch-5');
    await sleep(RESET_HOLD_MS);

    // восстановление
    document.body.classList.remove('deg-glitch-5');
    setDegradation(0, `RESET (${mode})`);
    addOutput('SYSTEM: RESET ВЫПОЛНЕН. ВОССТАНОВЛЕНИЕ СВЯЗИ...', 'output');

    try { audioAmbient.currentTime = 0; audioAmbient.volume = 0.04; } catch(e){}
    await sleep(700);

    addInputLine();
    resetting = false;
}

/**
 * Автоматический триггер RESET при превышении порога
 */
async function autoTriggerReset(){
    if(resetting) return;
    addColoredText('!! ДЕГРАДАЦИЯ ЯДРА ДОСТИГЛА КРИТИЧЕСКОГО УРОВНЯ !!', '#FF4444');
    await sleep(300);
    await performReset('auto');
}

/* =================== Аудио-хаки =================== */

/**
 * Воспроизвести аудио элемент кратковременно (для событий)
 */
function playAudioOnce(audioEl){
    try {
        audioEl.currentTime = 0;
        audioEl.volume = 0.7;
        audioEl.play().catch(()=>{});
        // быстро останавливаем через 1.2с чтобы звук не застрял
        setTimeout(()=> {
            try { audioEl.pause(); audioEl.currentTime = 0; } catch(e){}
        }, 1400);
    } catch(e){}
}

/**
 * Писк/клик легкий для синхронизации глитчей
 */
function playClick(){
    try {
        audioClick.currentTime = 0;
        audioClick.volume = 0.18 + (currentDegradation/500);
        audioClick.play().catch(()=>{});
    } catch(e){}
}

/* =================== Вспомогательные микро-события интерфейса =================== */

/**
 * Рандомные "фантомные" сообщения (эхо памяти)
 */
function randomAmbientEvent(){
    if(Math.random() > 0.6 + (currentDegradation/120)) return;
    const phrases = [
        'не отключайся',
        'он наблюдает',
        'ты ещё здесь?',
        'ошибка // сознание'
    ];
    const txt = phrases[Math.floor(Math.random()*phrases.length)];
    addColoredText(txt, 'rgba(192,0,255,0.18)');
    if(Math.random() < 0.4) playClick();
}

/**
 * Короткий "пульс" интерфейса — яркость, лёгкое дрожание
 */
function interfacePulse(){
    const intensity = 0.04 + (currentDegradation/250);
    document.body.style.transition = 'filter 0.12s linear';
    document.body.style.filter = `brightness(${1 + intensity})`;
    setTimeout(()=> document.body.style.filter = '', 120);

    if(currentDegradation >= 80){
        const shift = (Math.random()*2)-1;
        document.body.style.transform = `translateX(${shift}px)`;
        setTimeout(()=> document.body.style.transform = '', 200);
    }
}

/* =================== Утилита подтверждения (Y/N) =================== */

/**
 * Ожидание подтверждения от пользователя: Y/N
 * Возвращает Promise<boolean>
 */
function waitForConfirmation(){
    return new Promise(resolve => {
        awaitingConfirm = true;

        // создаём временную строку подтверждения
        const confirmLine = document.createElement('div');
        confirmLine.className = 'input-line';
        confirmLine.innerHTML = `<span class="prompt" style="color:var(--amber)">&gt; confirm: </span><span class="cmd" id="confirmText"></span><span class="cursor" id="confirmCursor"></span>`;
        terminal.appendChild(confirmLine);
        terminal.scrollTop = terminal.scrollHeight;

        function keyHandler(e){
            if(!awaitingConfirm) return;
            const el = document.getElementById('confirmText');
            if(!el) return;

            const k = e.key.toLowerCase();
            if(k === 'y' || k === 'н'){ // поддержка русской раскладки "н" = "y"
                el.textContent = 'Y';
                el.style.color = 'var(--phosphor)';
                cleanup(true);
            } else if(k === 'n' || k === 'т'){ // "т" = "n"
                el.textContent = 'N';
                el.style.color = 'var(--blood)';
                cleanup(false);
            }
        }

        function cleanup(result){
            document.removeEventListener('keydown', keyHandler);
            confirmLine.remove();
            awaitingConfirm = false;
            resolve(result);
        }

        document.addEventListener('keydown', keyHandler);
    });
}

/* =================== Небольшие утилиты (loader, остановка аудио и т.д.) =================== */

/**
 * Визуальная анимация загрузки (псевдо-процент)
 */
function showLoading(duration = 1200, text = "PROCESS"){
    return new Promise(resolve => {
        const loader = document.createElement('div');
        loader.className = 'output';
        loader.textContent = `${text} [0%]`;
        const bar = document.createElement('div');
        bar.style.width = '200px';
        bar.style.height = '10px';
        bar.style.border = '1px solid rgba(100,255,130,0.08)';
        bar.style.marginTop = '8px';
        bar.style.background = 'rgba(100,255,130,0.02)';
        const fill = document.createElement('div');
        fill.style.height = '100%';
        fill.style.width = '0%';
        fill.style.background = 'linear-gradient(90deg,#00FF41,#00cc33)';
        fill.style.transition = 'width 0.12s linear';
        bar.appendChild(fill);
        loader.appendChild(bar);
        terminal.appendChild(loader);
        terminal.scrollTop = terminal.scrollHeight;

        const interval = 50;
        const steps = Math.max(6, Math.floor(duration/interval));
        let p = 0;
        const inc = 100 / steps;
        const t = setInterval(()=>{
            p += inc;
            if(p >= 100){
                p = 100;
                clearInterval(t);
                loader.textContent = `${text} [ЗАВЕРШЕНО]`;
                loader.appendChild(bar);
                setTimeout(()=> { loader.remove(); resolve(); }, 300);
            } else {
                loader.textContent = `${text} [${Math.round(p)}%]`;
                loader.appendChild(bar);
                fill.style.width = `${p}%`;
            }
            terminal.scrollTop = terminal.scrollHeight;
        }, interval);
    });
}

/**
 * Остановить все аудио (например, перед RESET)
 */
function stopAllAudio(){
    const allAudio = document.querySelectorAll('audio');
    allAudio.forEach(a => {
        try { a.pause(); a.currentTime = 0; } catch(e){}
    });
}

/* =================== Простой трюк: детектор devtools (атмосферный) =================== */
(function devtoolsDetect(){
    const start = Date.now();
    console.log('%c', 'font-size:400px;'); // трюк
    setTimeout(()=> {
        const end = Date.now();
        if(end - start > 1000){
            addOutput('A.D.A.M. не любит, когда на него смотрят.', 'output');
        }
    }, 500);
})();

/* =================== Инициализация строки ввода и обновление UI =================== */
// В конце скрипта — создаём строку ввода и обновляем UI-индикатор
addInputLine();
updateDegradationUI();
startAutoIncrement();

/* =================== Экспорт (если нужно внешнее управление) =================== */
window.VIGIL9 = {
    incrementDegradation,
    setDegradation,
    getCurrentDegradation: () => currentDegradation,
    performReset
};
