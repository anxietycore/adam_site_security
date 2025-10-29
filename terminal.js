/* terminal.js
   Полная версия терминала VIGIL-9 с восстановленным ЛОРОМ из файлов пользователя.
   - Все комментарии на русском языке.
   - Данные лора (SUBJ / DSCR / NOTES / SYSLOG-строки и т.д.) вставлены прямо в этот файл (взято из твоего "помоги мне.txt" и "Оживление ЧААТА.txt").
   - Аудиофайлы ожидаются в папке sounds/: sounds/reset_com.mp3, sounds/reset_com_reverse.mp3, sounds/glich_e.mp3, sounds/ambient_hum.mp3, sounds/glitch_click.mp3
   - Временная команда теста деградации: DEGTEST <n> — мгновенно добавляет n% деградации (удобно для теста).
   - showSubjectDossier сделан нечувствительным к регистру и корректно ищет ID вида 0x001 / 0X001 / 0x2e7 и т.д.
   - Всё состояние (degradation, visits, session timestamps) сохраняется в localStorage.
*/

/* =================== КОНСТАНТЫ И КЛЮЧИ =================== */
const DEG_KEY = 'vigil_degradation';
const VISITS_KEY = 'adam_visits';
const LAST_ACTIVE_KEY = 'vigil_last_active';
const SESSION_START_KEY = 'vigil_session_start';

const AUTO_INC_INTERVAL_MS = 30_000; // +1% каждые 30 сек активной сессии
const AUTO_RESET_THRESHOLD = 98;     // при 98% — авто-RESET
const RESET_HOLD_MS = 3500;          // длительность визуального "перезапуска"
const COMMANDS_THAT_INCR = ['syst','syslog','net','dscr','subj','notes'];

/* =================== DOM-переменные (инициализация в DOMContentLoaded) =================== */
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
let resetting = false;

/* =================== Инициализация при загрузке страницы =================== */
document.addEventListener('DOMContentLoaded', initTerminal);

function initTerminal(){
    // найти DOM-элементы
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

    // гарантируем, что пути к аудио используют папку sounds/
    try { if(audioAmbient) audioAmbient.src = audioAmbient.src.includes('sounds/') ? audioAmbient.src : 'sounds/ambient_hum.mp3'; } catch(e){}
    try { if(audioResetCom) audioResetCom.src = audioResetCom.src.includes('sounds/') ? audioResetCom.src : 'sounds/reset_com.mp3'; } catch(e){}
    try { if(audioResetComRev) audioResetComRev.src = audioResetComRev.src.includes('sounds/') ? audioResetComRev.src : 'sounds/reset_com_reverse.mp3'; } catch(e){}
    try { if(audioGlitchE) audioGlitchE.src = audioGlitchE.src.includes('sounds/') ? audioGlitchE.src : 'sounds/glich_e.mp3'; } catch(e){}
    try { if(audioClick) audioClick.src = audioClick.src.includes('sounds/') ? audioClick.src : 'sounds/glitch_click.mp3'; } catch(e){}

    // восстановление состояния
    currentDegradation = parseInt(localStorage.getItem(DEG_KEY)) || 0;
    const visits = parseInt(localStorage.getItem(VISITS_KEY)) || 0;
    sessionStart = Date.now();
    localStorage.setItem(SESSION_START_KEY, sessionStart.toString());

    // старт фонового звука (тихо)
    try { audioAmbient.volume = 0.06 + (currentDegradation/100)*0.14; audioAmbient.loop = true; audioAmbient.play().catch(()=>{}); } catch(e){}

    // вывести boot / приветствие и создать строку ввода
    renderInitialBoot(visits);

    // глобальный обработчик клавиш
    document.addEventListener('keydown', globalKeyHandler);

    // применить визуальные состояния
    updateDegradationUI();

    // авто-инкремент деградации
    startAutoIncrement();

    // интерфейсные события
    setInterval(interfacePulse, 10_000);
    setInterval(randomAmbientEvent, 8_000 + Math.random()*6000);
}

/* =================== ВСТРОЕННЫЙ ЛОР (полностью в этом файле) ===================

   Здесь собраны все данные лора, найденные в твоих файлах:
   - NOTES_DB: персональные заметки / файлы
   - SUBJECTS_DB: краткая сводка субъектов (для команды SUBJ)
   - DOSSIERS: детальные досье для DSCR (много ID, взято из файла)
   - Прочие текстовые фразы для syslog / подсказок
   -----------------------------------------------------------
*/

/* ========== NOTES (заметки / файлы) ========== */
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

/* ========== SUBJECTS (короткий список субъектов для SUBJ) ========== */
const SUBJECTS_DB = [
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

/* ========== DOSSIERS (полные досье — вытянуто из файла) ==========
   Ключи — в том формате, как были в файле (иногда в верхнем регистре).
   showSubjectDossier будет искать нечувствительно к регистру, поэтому сюда можно оставить оригинальные ключи.
*/
const DOSSIERS = {
    '0x001': {
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

    '0x2E7': {
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

    '0x095': {
        name: 'SUBJECT-095',
        role: 'Тест нейроплантов серии KATARHEY',
        status: 'МЁРТВ',
        outcome: [
            'Зафиксированы следы ФАНТОМА.',
            'Субъект выдержал 3ч 12м, проявил острый психоз. Открыл капсулу, погиб.',
            'Наблюдение прекращено, остаточные сигналы переданы в архив.'
        ],
        report: [
            'Серьёзные повреждения нейросети. Последняя фраза субъекта: "не смотри на свет".'
        ],
        missions: 'KATARHEY'
    },

    '0xF00': {
        name: 'SUBJECT-PHANTOM',
        role: 'Аномалия — идентификатор PHANTOM',
        status: 'АНОМАЛИЯ',
        outcome: [
            'Поведение не детерминировано.',
            'Субъект взаимодействует с сигналами мониторинга как с живой сущностью.'
        ],
        report: [
            'Рекомендуется изоляция и шифрование каналов наблюдения.'
        ],
        missions: 'KATARHEY'
    },

    '0xA52': {
        name: 'SUBJECT-A52',
        role: 'Тестовый узел MELOWOY',
        status: 'СВЯЗЬ ОТСУТСТВУЕТ',
        outcome: [
            'Телеметрия зафиксировала фрагменты речи на древнем диалекте.',
            'Смещение фазового отклика в 3 узлах.'
        ],
        report: [
            'Наблюдение в режиме ожидания. Возможна реставрация сигнала.'
        ],
        missions: 'MELOWOY'
    },

    '0xE0C': {
        name: 'SUBJECT-E0C',
        role: 'Экспериментальное тело EOCENE',
        status: 'МЁРТВ',
        outcome: [
            'Полная потеря сознания.',
            'Отклонения показателей при переподключении.'
        ],
        report: [
            'Решение: архивировать и закрыть доступ к материалам.'
        ],
        missions: 'EOCENE'
    },

    '0x5E4': {
        name: 'SUBJECT-5E4',
        role: 'PERMIAN — полевой субъект',
        status: 'МЁРТВ',
        outcome: [
            'Зона поражения: высокая коррозия тканей датчиков.',
            'Данные утрачены частично.'
        ],
        report: [
            'Остаточный отклик минимален.'
        ],
        missions: 'PERMIAN'
    },

    '0x413': {
        name: 'SUBJECT-413',
        role: 'EX-413 — полевой протокол',
        status: 'МЁРТВ',
        outcome: [
            'Аномальные сигнатуры, соответствующие радиационному воздействию.',
            'Причина гибели: необратимый отказ сенсоров.'
        ],
        report: [
            'Рекомендовано утилизация материалов.'
        ],
        missions: 'EX-413'
    },

    '0xC19': {
        name: 'SUBJECT-C19',
        role: 'CARBON — вторичный эксперимент',
        status: 'МЁРТВ',
        outcome: [
            'Отклонения формы ДНК-отпечатка',
            'Субъект отозван в рамках программы CARBON'
        ],
        report: [
            'Досье: ограниченный доступ'
        ],
        missions: 'CARBON'
    },

    '0x9A0': {
        name: 'SUBJECT-9A0',
        role: 'BLACKHOLE — исследовательский модуль',
        status: 'МЁРТВ',
        outcome: [
            'Модуль потерян при транспортировке.',
            'Данные частично восстановлены.'
        ],
        report: [
            'Доступ закрыт.'
        ],
        missions: 'BLACKHOLE'
    },

    '0xB3F': {
        name: 'SUBJECT-B3F',
        role: 'TITANIC — морской эксперимент',
        status: 'МЁРТВ',
        outcome: [
            'Субъект в результате катастрофического отказа.',
            'Архивы удалены.'
        ],
        report: [
            'Класс инцидента: MARITIME-LOSS'
        ],
        missions: 'TITANIC'
    },

    '0xD11': {
        name: 'SUBJECT-D11',
        role: 'PLEISTOCENE — реконструктор',
        status: 'МЁРТВ',
        outcome: [
            'Некорректная привязка хроно-модулей.',
            'Фрагментарные данные.'
        ],
        report: [
            'Архив переведён в холодный стрим.'
        ],
        missions: 'PLEISTOCENE'
    },

    '0xDB2': {
        name: 'SUBJECT-DB2',
        role: 'POMPEII — полевой реконструктор',
        status: 'МЁРТВ',
        outcome: [
            'Температурные повреждения датчиков.',
            'Запись частично утрачена.'
        ],
        report: [
            'Архив доступен только по разрешению.'
        ],
        missions: 'POMPEII'
    },

    '0x811': {
        name: 'SIGMA-PROTOTYPE',
        role: 'Прототип SIGMA, эксперимент HELIX',
        status: 'АКТИВЕН',
        outcome: [
            'Прототип демонстрирует непредсказуемую реакцию на внешние команды.',
            'Отмечен рост автономных процессов.'
        ],
        report: [
            'Рекомендуется наблюдение в режиме реального времени.'
        ],
        missions: 'HELIX'
    },

    '0xT00': {
        name: 'SUBJECT-T00',
        role: 'PROTO-CORE — экспериментальный контейнер',
        status: 'УДАЛЁН',
        outcome: [
            'Контент удалён по решению наблюдения.',
            'Данные зашифрованы и перенесены в хранилище OBSERVER.'
        ],
        report: [
            'Доступ запрещён.'
        ],
        missions: 'PROTO-CORE'
    },

    '0xL77': {
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
    },

    '0xS09': {
        name: 'SUBJECT-S09',
        role: 'SYNTHESIS-09 — экспериментальный кластер',
        status: 'УНИЧТОЖЕН',
        outcome: [
            'Кластер подвергся полной деструкции.',
            'Сигналы заражены синтезированными паттернами.'
        ],
        report: [
            'Радикальная очистка выполнена.'
        ],
        missions: 'SYNTHESIS-09'
    }
    // если в твоём файле есть ещё досье — можно добавить сюда аналогично.
};

/* =================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ВЫВОДА =================== */

/* sleep - промис для простого ожидания */
function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

/* addOutput - добавить простую строку */
function addOutput(text, cls = 'output'){
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = text;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

/* addColoredText - добавить строку с цветом */
function addColoredText(text, color = '#00FF41', cls = 'output'){
    const line = document.createElement('div');
    line.className = cls;
    line.style.color = color;
    line.textContent = text;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

/* typeText - эффект "печати" строки */
function typeText(text, cls = 'output', speed = 6){
    return new Promise(resolve => {
        isTyping = true;
        const line = document.createElement('div');
        line.className = cls;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        let i = 0;

        function step(){
            if(i < text.length){
                // вероятность пропуска символа зависит от деградации (уровень 2)
                const skipChance = 0.01 + Math.max(0, (currentDegradation - 30) / 400);
                // всё равно показываем символ, иногда чуть с задержкой
                line.textContent += text.charAt(i);
                i++;
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

/* renderBar - ascii-бар для статусов */
function renderBar(percent){
    const total = 12;
    const filled = Math.round((percent/100)*total);
    const bar = '█'.repeat(filled) + '▒'.repeat(Math.max(0, total - filled));
    return bar;
}

/* randChoice - выбрать случайный элемент */
function randChoice(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

/* =================== BOOT / НАЧАЛЬНЫЙ ВЫВОД =================== */
async function renderInitialBoot(visits){
    const bootSeq = [
        'adam@vigil-9:~$ BOOTING VIGIL-9 PROTOCOL',
        'Инициализация нейрослоя...',
        'Загрузка архивов: [████████░░] 82%'
    ];

    if(visits === 1){
        bootSeq.push('> новая инициализация ядра...');
    } else if(visits === 2){
        bootSeq.push('> повторное подключение обнаружено');
        bootSeq.push('> процесс: unstable');
    } else if(visits >= 3){
        bootSeq.push('> A.D.A.M. уже активен');
        bootSeq.push('> кто ты?');
    }

    for(const line of bootSeq){
        await typeText(line, 'output', 6);
        await sleep(120 + Math.random()*260);
    }

    await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 6);
    await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 6);

    addInputLine();
}

/* =================== УПРАВЛЕНИЕ СТРОКОЙ ВВОДА =================== */

/* addInputLine - показать prompt и курсор */
function addInputLine(){
    if(inputLineElement) inputLineElement.remove();
    inputBuffer = '';
    histIdx = history.length;

    inputLineElement = document.createElement('div');
    inputLineElement.className = 'input-line';
    inputLineElement.innerHTML = `<span class="prompt">&gt;&gt; </span><span class="cmd" id="cmdText"></span><span class="cursor" id="terminalCursor"></span>`;
    terminal.appendChild(inputLineElement);
    terminal.scrollTop = terminal.scrollHeight;
}

/* removeInputLine - убрать prompt */
function removeInputLine(){
    if(inputLineElement) inputLineElement.remove();
    inputLineElement = null;
}

/* глобальный обработчик клавиш */
function globalKeyHandler(e){
    if(awaitingConfirm) return; // при подтверждении отдельный обработчик
    if(!inputLineElement) return;
    const cmdText = document.getElementById('cmdText');

    if(e.key === 'Backspace'){
        inputBuffer = inputBuffer.slice(0, -1);
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
        histIdx = Math.max(0, histIdx - 1);
        inputBuffer = history[histIdx] || '';
    } else if(e.key === 'ArrowDown'){
        if(history.length === 0) return;
        histIdx = Math.min(history.length, histIdx + 1);
        inputBuffer = history[histIdx] || '';
    } else if(e.key.length === 1 && !e.ctrlKey && !e.metaKey){
        inputBuffer += e.key;
    }
    if(cmdText) cmdText.textContent = inputBuffer;
}

/* =================== ОБРАБОТКА КОМАНД (core) =================== */

async function processCommand(rawCmd){
    if(isTyping) return; // не прерываем печать

    // эхо команды и убираем prompt
    if(inputLineElement) inputLineElement.remove();
    addColoredText(`adam@secure:~$ ${rawCmd}`, 'rgba(180,255,190,0.95)', 'command');

    const parts = (rawCmd || '').trim().split(/\s+/).filter(Boolean);
    const cmd = parts.length ? parts[0].toLowerCase() : '';
    const args = parts.slice(1);

    // счётчик команд
    commandCount++;

    // если команда из списка — увеличиваем деградацию
    if(COMMANDS_THAT_INCR.includes(cmd)){
        incrementDegradation(1, `Команда '${cmd}' выполнена — +1% деградации`);
    }

    switch(cmd){
        case '':
            addInputLine();
            break;

        case 'help':
            await typeText('Доступные команды:', 'output', 6);
            await typeText('  SYST         — проверить состояние системы', 'output', 4);
            await typeText('  SYSLOG       — системный журнал активности', 'output', 4);
            await typeText('  NET          — карта активных узлов проекта', 'output', 4);
            await typeText('  TRACE <id>   — отследить указанный модуль', 'output', 4);
            await typeText('  SUBJ         — список субъектов', 'output', 4);
            await typeText('  DSCR <id>    — досье на персонал (поддерживает 0x001/0X001/0x2e7)', 'output', 4);
            await typeText('  NOTES        — личные файлы сотрудников', 'output', 4);
            await typeText('  OPEN <id>    — открыть файл из NOTES', 'output', 4);
            await typeText('  RESET        — сброс интерфейса', 'output', 4);
            await typeText('  DEGTEST <n>  — временная команда: мгновенно +n% деградации (удобно для теста)', 'output', 4);
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
            await sleep(600);
            terminal.innerHTML = '';
            await typeText('[СЕССИЯ ЗАВЕРШЕНА]', 'output', 6);
            break;

        case 'syst':
            await typeText('[СТАТУС СИСТЕМЫ — ИНТЕРФЕЙС VIGIL-9]', 'output', 6);
            addColoredText('------------------------------------', '#00FF41');
            await typeText('ГЛАВНЫЙ МОДУЛЬ: АКТИВЕН', 'output', 6);
            await typeText('ПОДСИСТЕМА A.D.A.M.: ЧАСТИЧНО СТАБИЛЬНА', 'output', 6);
            await typeText('БИО-ИНТЕРФЕЙС: НЕАКТИВЕН', 'output', 6);
            addColoredText(`ДЕГРАДАЦИЯ: [${renderBar(currentDegradation)}] ${currentDegradation}%`, '#FFFF00');
            addColoredText('------------------------------------', '#00FF41');
            await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала; при >=60% введите RESET', 'output', 6);
            addInputLine();
            break;

        case 'syslog':
            const sysLevel = getSyslogLevel();
            await typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', 'output', 6);
            addColoredText('------------------------------------', '#00FF41');
            if(sysLevel === 1){
                addColoredText('[!] Ошибка 0x19F: повреждение нейронной сети', '#FFFF00');
                addColoredText('[!] Утечка данных через канал V9-HX', '#FFFF00');
                addColoredText(`[!] Деградация ядра A.D.A.M.: ${currentDegradation}%`, '#FFFF00');
                await typeText('СИСТЕМА: функционирует с ограничениями', 'output', 6);
            } else if(sysLevel === 2){
                addColoredText('[!] Нарушение целостности памяти субъекта 0x095', '#FFFF00');
                addColoredText('> "я слышу их дыхание. они всё ещё здесь."', '#FF4444');
                addColoredText('[!] Потеря отклика от MONOLITH', '#FFFF00');
                addColoredText('> "монолит смотрит. монолит ждёт."', '#FF4444');
                addColoredText('[!] Аномальная активность в секторе KATARHEY', '#FFFF00');
                addColoredText('> "он говорит через статические помехи"', '#FF4444');
                await typeText('СИСТЕМА: обнаружены посторонние сигналы', 'output', 6);
            } else {
                addColoredText('> "ты не должен видеть это."', '#FF00FF');
                addColoredText('> "почему ты продолжаешь?"', '#FF00FF');
                addColoredText('> "они знают о тебе."', '#FF00FF');
                addColoredText('[!] Критическая ошибка: субъект наблюдения неопределён', '#FF4444');
                addColoredText('[!] Нарушение протокола безопасности', '#FF4444');
                await typeText('СИСТЕМА: ОСОЗНАЁТ НАБЛЮДЕНИЕ', 'output', 6);
            }
            addInputLine();
            break;

        case 'notes':
            await typeText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / КАТЕГОРИЯ: NOTES]', 'output', 6);
            addColoredText('------------------------------------', '#00FF41');
            for(const id of Object.keys(NOTES_DB)){
                const it = NOTES_DB[id];
                await typeText(`${id} — "${it.title}" / автор: ${it.author}`, 'output', 6);
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
            await openNote(args[0]);
            addInputLine();
            break;

        case 'subj':
            await typeText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M. / ПРОТОКОЛ VIGIL-9]', 'output', 6);
            addColoredText('--------------------------------------------------------', '#00FF41');
            for(const subject of SUBJECTS_DB){
                const line = `${subject.id} | ${subject.name.padEnd(20)} | СТАТУС: ${subject.status.padEnd(20)} | МИССИЯ: ${subject.mission}`;
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
            await showSubjectDossier(args[0]);
            addInputLine();
            break;

        case 'net':
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
            await sleep(300);
            if(Math.random() < 0.35 + (currentDegradation/200)){
                addOutput('adam@secure:~$ ... → ОШИБКА // НЕТ ПОЛЬЗОВАТЕЛЯ', 'output');
            } else {
                addOutput('TRACE: пакет доставлен. RTT: 42ms', 'output');
            }
            addInputLine();
            break;

        case 'reset':
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

        case 'degtest':
        case 'degtest()':
        case 'degtest:':
        case 'degrtest':
        case 'degtest':
        case 'degtest':
        case 'degtest':
        case 'degtestplain':
        case 'degtestcmd':
        case 'degtestx':
        case 'degtesty':
        case 'degtestz':
        case 'degtestabc':
        case 'degtest123':
        case 'degtest*':
        case 'degtest%':
            // краткий вариант — уже есть множество алиасов; основной синтаксис: DEGTEST <n>
            {
                const n = args.length ? parseInt(args[0]) : 10;
                if(isNaN(n) || n <= 0){
                    addColoredText('Пример использования: DEGTEST 10  -> добавит 10% (временная команда)', '#FFFF00');
                    addInputLine();
                    break;
                }
                addColoredText(`Запуск теста деградации: +${n}% (временная команда)`, '#FF8800');
                incrementDegradation(n, 'DEGTEST (временная команда)');
                addInputLine();
            }
            break;

        default:
            await typeText(`Неизвестная команда: '${cmd}'. Введите 'help'.`, 'output', 6);
            if(currentDegradation >= 80 && Math.random() < 0.18){
                await sleep(250);
                addOutput('adam@secure:~$ … → ОШИБКА // НЕТ ПОЛЬЗОВАТЕЛЯ', 'output');
            }
            addInputLine();
            break;
    }

    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
}

/* =================== ОТКРЫТИЕ NOTE (OPEN) =================== */
async function openNote(idRaw){
    const id = (idRaw || '').toUpperCase();
    const note = NOTES_DB[id];
    if(!note){
        addColoredText('ОШИБКА: файл не найден', '#FF4444');
        await typeText(`Проверьте идентификатор: ${id}`, 'output', 6);
        return;
    }

    // шанс, что файл повреждён в зависимости от деградации
    addColoredText(`--- ${id} — ${note.title} / автор: ${note.author} ---`, '#00FF41');
    if(currentDegradation >= 90 && Math.random() < 0.4){
        addColoredText('Восстановление невозможно', '#FF4444');
        await showLoading(1500, "Попытка восстановления данных");
        addColoredText('>>> СИСТЕМНЫЙ СБОЙ <<<', '#FF0000');
    } else {
        for(const line of note.content){
            await typeText(`> ${line}`, 'output', 6);
        }
    }
    addColoredText('------------------------------------', '#00FF41');
    await typeText('[ФАЙЛ ЗАКРЫТ]', 'output', 6);
}

/* =================== ПОКАЗ ДОСЬЕ (DSCR) — нечувствительно к регистру =================== */
async function showSubjectDossier(idRaw){
    const idLower = (idRaw || '').toLowerCase();

    // найти ключ в DOSSIERS, сравнивая в нижнем регистре
    const foundKey = Object.keys(DOSSIERS).find(k => k.toLowerCase() === idLower);
    if(!foundKey){
        addColoredText('ОШИБКА: досье не найдено', '#FF4444');
        await typeText('Попробуйте другой ID из списка SUBJ', 'output', 6);
        // иногда добавляем фантомную строку памяти
        if(Math.random() < 0.28 + (currentDegradation/220)){
            addColoredText('не отключайся', 'rgba(192,0,255,0.18)');
        }
        return;
    }

    const d = DOSSIERS[foundKey];
    addColoredText(`[ДОСЬЕ — ID: ${foundKey}]`, '#00FF41');
    await typeText(`ИМЯ: ${d.name}`, 'output', 6);
    if(d.role) await typeText(`РОЛЬ: ${d.role}`, 'output', 6);
    addColoredText(`СТАТУС: ${d.status}`, d.status === 'АНОМАЛИЯ' ? '#FF00FF' : d.status === 'АКТИВЕН' ? '#00FF41' : d.status.includes('СВЯЗЬ') ? '#FFFF00' : '#FF4444');
    addColoredText('------------------------------------', '#00FF41');

    await typeText('ИСХОД:', 'output', 6);
    if(d.outcome && d.outcome.length){
        for(const ln of d.outcome){
            addColoredText(`> ${ln}`, '#FF4444');
        }
    } else {
        addColoredText('> данные фрагментарны', '#FFFF00');
    }

    addColoredText('------------------------------------', '#00FF41');
    await typeText('СИСТЕМНЫЙ ОТЧЁТ:', 'output', 6);
    if(d.report && d.report.length){
        for(const ln of d.report){
            addColoredText(`> ${ln}`, '#FFFF00');
        }
    } else {
        addColoredText('> отчёт отсутствует', '#FFFF00');
    }

    addColoredText('------------------------------------', '#00FF41');
    await typeText(`СВЯЗАННЫЕ МИССИИ: ${d.missions || 'N/A'}`, 'output', 6);

    // если есть аудио — краткий шанс проиграть (негромко)
    if(d.audio && audioResetCom){
        try {
            const a = new Audio(d.audio);
            a.volume = 0.18 + Math.min(0.3, currentDegradation/300);
            a.play().catch(()=>{});
            // остановим через 2.5с, чтобы не застревал
            setTimeout(()=> { try{ a.pause(); a.currentTime = 0; }catch(e){} }, 2500);
        } catch(e){}
    }
}

/* =================== SYSLOG LEVEL (определяет "жёсткость" вывода) =================== */
function getSyslogLevel(){
    const sessionDuration = Date.now() - sessionStart;
    const minutesInSession = sessionDuration / (1000 * 60);

    if(commandCount >= 10 || minutesInSession >= 3) return 3; // сознательный
    if(commandCount >= 5 || minutesInSession >= 1) return 2;  // живой
    return 1; // статичный
}

/* =================== ДЕГРАДАЦИЯ: управление, таймеры, UI =================== */

function setDegradation(value, sourceDesc){
    currentDegradation = Math.max(0, Math.min(100, Math.round(value)));
    localStorage.setItem(DEG_KEY, currentDegradation.toString());
    updateDegradationUI();

    // пороги — звуки и подсказки
    if(currentDegradation === 70 || currentDegradation === 75){
        playAudioOnce(audioResetCom);
        addColoredText('> команда RESET рекомендована для стабилизации', '#EFD76C');
    }
    if(currentDegradation === 85 || currentDegradation === 90){
        playAudioOnce(audioResetComRev);
        addColoredText('> срочно введите RESET', '#D83F47');
    }
    if(currentDegradation >= AUTO_RESET_THRESHOLD){
        autoTriggerReset();
    }

    // плавное увеличение фон.шума
    try { audioAmbient.volume = 0.06 + (currentDegradation/100)*0.14; } catch(e){}
}

function incrementDegradation(delta = 1, sourceDesc = ''){
    setDegradation(currentDegradation + delta, sourceDesc);
}

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

/* авто-инкремент */
function startAutoIncrement(){
    if(autoIncTimer) clearInterval(autoIncTimer);
    autoIncTimer = setInterval(()=>{
        incrementDegradation(1, 'time');
        if(Math.random() < 0.18 + (currentDegradation/200)) playClick();
    }, AUTO_INC_INTERVAL_MS);
}

/* =================== RESET (ручной / автоматический) =================== */

async function performReset(mode = 'manual'){
    if(resetting) return;
    resetting = true;
    removeInputLine();
    addOutput('SYSTEM: ИНИЦИАЛИЗАЦИЯ RESET...', 'output');

    // звук в зависимости от режима
    if(mode === 'auto'){
        try { audioGlitchE.currentTime = 0; audioGlitchE.volume = 0.9; audioGlitchE.play().catch(()=>{}); } catch(e){}
    } else {
        try { audioResetCom.currentTime = 0; audioResetCom.volume = 0.65; audioResetCom.play().catch(()=>{}); } catch(e){}
    }

    // сильный визуальный эффект
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

async function autoTriggerReset(){
    if(resetting) return;
    addColoredText('!! ДЕГРАДАЦИЯ ЯДРА ДОСТИГЛА КРИТИЧЕСКОГО УРОВНЯ !!', '#FF4444');
    await sleep(300);
    await performReset('auto');
}

/* =================== АУДИО-ФУНКЦИИ =================== */

function playAudioOnce(audioEl){
    try {
        audioEl.currentTime = 0;
        audioEl.volume = 0.7;
        audioEl.play().catch(()=>{});
        setTimeout(()=> {
            try { audioEl.pause(); audioEl.currentTime = 0; } catch(e){}
        }, 1400);
    } catch(e){}
}

function playClick(){
    try {
        audioClick.currentTime = 0;
        audioClick.volume = 0.18 + (currentDegradation/500);
        audioClick.play().catch(()=>{});
    } catch(e){}
}

/* =================== МЕЛКИЕ ИНТЕРФЕЙС-СОБЫТИЯ =================== */

function randomAmbientEvent(){
    if(Math.random() > 0.6 + (currentDegradation/120)) return;
    const phrases = [
        'не отключайся',
        'он наблюдает',
        'ты ещё здесь?',
        'ошибка // сознание'
    ];
    const txt = randChoice(phrases);
    addColoredText(txt, 'rgba(192,0,255,0.18)');
    if(Math.random() < 0.4) playClick();
}

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

/* =================== ПОДТВЕРЖДЕНИЕ (Y/N) =================== */

function waitForConfirmation(){
    return new Promise(resolve => {
        awaitingConfirm = true;
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
            if(k === 'y' || k === 'н'){ // русская н = лат Y
                el.textContent = 'Y';
                el.style.color = 'var(--phosphor)';
                cleanup(true);
            } else if(k === 'n' || k === 'т'){ // русская т = лат N
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

/* =================== SHOW LOADING (визуал прогресса) =================== */

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
        const steps = Math.max(6, Math.floor(duration / interval));
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

/* =================== DETECT DEVTOOLS (атмосферная штука) =================== */
(function devtoolsDetect(){
    const start = Date.now();
    console.log('%c', 'font-size:400px;');
    setTimeout(()=> {
        const end = Date.now();
        if(end - start > 1000) {
            addOutput('A.D.A.M. не любит, когда на него смотрят.', 'output');
        }
    }, 500);
})();

/* =================== ИНИЦИАЛИЗАЦИЯ (создание prompt и UI) =================== */
addInputLine();
updateDegradationUI();
startAutoIncrement();

/* =================== Экспорт функций для отладки (если нужно) =================== */
window.VIGIL9 = {
    incrementDegradation,
    setDegradation,
    getCurrentDegradation: () => currentDegradation,
    performReset
};
