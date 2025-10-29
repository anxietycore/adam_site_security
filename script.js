/* script.js - логика загрузки, логина и начальной инициализации
   Включает: visits counter, boot sequence, переход к login, настройки аудио и базовый degradation init.
   Оставлен простой и понятный код, чтобы можно было сразу использовать. */

/* Данные для входа (оставляем как в исходнике) */
const VALID_CREDENTIALS = {
    username: "qq",
    password: "ww"
};

console.log('=== A.D.A.M. DEBUG START ===');
console.log('Ожидаемые данные:', VALID_CREDENTIALS);

/* LocalStorage ключи */
const LS_VISITS = 'adam_visits';
const LS_DEG = 'vigil_degradation';
const LS_LAST_TS = 'vigil_lastTimestamp';
const LS_CMD_COUNT = 'vigil_command_count';
const LS_PREFS = 'vigil_prefs';

/* Audio engine placeholders - аудио не будет играть до первого клика */
const AUDIO_FILES = {
    ambient: 'sounds/ambient_loop.mp3',
    glitch_short: 'sounds/glitch_short.mp3',
    reset_com: 'sounds/reset_com.mp3',
    reset_com_reverse: 'sounds/reset_com_reverse.mp3',
    glitch_e: 'sounds/glich_e.mp3'
};

let audioElements = {};
let audioInitialized = false;

/* Инициализация при загрузке страницы */
document.addEventListener('DOMContentLoaded', function() {
    // СЧЁТЧИК ПОСЕЩЕНИЙ
    let visits = parseInt(localStorage.getItem(LS_VISITS)) || 0;
    visits++;
    localStorage.setItem(LS_VISITS, visits);
    console.log(`Посещений A.D.A.M.: ${visits}`);

    // Инициализация degradation, если нет — поставить 0
    if (localStorage.getItem(LS_DEG) === null) {
        localStorage.setItem(LS_DEG, '0');
    }

    // Привязка кнопки запуска
    const startBtn = document.getElementById('start-btn');
    startBtn.addEventListener('click', function() {
        // Инициализируем аудио после первого клика (блок автоплея)
        initAudioEngine();
        startBootSequence();
    });

    // keyboard Enter on login
    document.getElementById('login-btn').addEventListener('click', login);
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            // если форма логина видима - пробуем логин
            const loginScreen = document.getElementById('login-screen');
            if (!loginScreen.classList.contains('hidden')) {
                login();
            }
        }
    });

    // Показать стартовый экран (по умолчанию)
    document.getElementById('start-screen').classList.remove('hidden');
});

/* Boot sequence: печать строк и переход на login */
function startBootSequence() {
    console.log('Запуск последовательности загрузки');
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('boot-screen').classList.remove('hidden');

    const bootTexts = document.querySelectorAll('#boot-screen .boot-text p');
    let currentIndex = 0;

    function showNextLine() {
        if (currentIndex < bootTexts.length) {
            const text = bootTexts[currentIndex];
            text.style.opacity = 1;
            currentIndex++;
            // вариативность: случайная задержка для "живости"
            const delay = 700 + Math.random() * 800;
            setTimeout(showNextLine, delay);
        } else {
            setTimeout(showLoginScreen, 800);
        }
    }
    setTimeout(showNextLine, 400);
}

/* Переход к экрану логина */
function showLoginScreen() {
    console.log('Показ экрана логина');
    document.getElementById('boot-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('username').focus();
}

/* Простая авторизация - ритуал */
function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');

    console.log('=== ПОПЫТКА ВХОДА ===');

    const isUsernameMatch = username === VALID_CREDENTIALS.username;
    const isPasswordMatch = password === VALID_CREDENTIALS.password;

    if (isUsernameMatch && isPasswordMatch) {
        console.log('✅ УСПЕШНЫЙ ВХОД!');
        errorElement.textContent = 'ДОСТУП РАЗРЕШЁН';
        errorElement.style.color = '#00FF41';
        errorElement.classList.remove('hidden');

        document.body.style.transition = 'opacity 0.8s ease-in-out';
        document.body.style.opacity = '0';
        setTimeout(() => {
            window.location.href = 'terminal.html';
        }, 800);
    } else {
        console.log('❌ ОШИБКА ВХОДА!');
        // театральная задержка и сообщение
        errorElement.textContent = 'ДОСТУП ЗАПРЕЩЁН';
        errorElement.style.color = '#ff0000';
        errorElement.classList.remove('hidden');

        // Блокировка кнопки на 5 секунд (ритуал)
        const loginBtn = document.getElementById('login-btn');
        loginBtn.disabled = true;
        setTimeout(() => {
            loginBtn.disabled = false;
        }, 5000);

        document.getElementById('password').value = '';
        document.getElementById('username').focus();
    }
}

/* Audio engine инициализация: создаём элементы audio, но не включаем их сразу */
function initAudioEngine() {
    if (audioInitialized) return;
    audioInitialized = true;

    audioElements.ambient = new Audio(AUDIO_FILES.ambient);
    audioElements.ambient.loop = true;
    audioElements.ambient.volume = 0.0; // будет регулироваться по деградации

    audioElements.glitch_short = new Audio(AUDIO_FILES.glitch_short);
    audioElements.reset_com = new Audio(AUDIO_FILES.reset_com);
    audioElements.reset_com_reverse = new Audio(AUDIO_FILES.reset_com_reverse);
    audioElements.glitch_e = new Audio(AUDIO_FILES.glitch_e);

    // set preload to metadata to reduce load
    for (const key in audioElements) {
        try {
            audioElements[key].preload = 'metadata';
        } catch (e) { /* ignore */ }
    }

    // стартовать фон после маленькой задержки (чтобы дать UX)
    setTimeout(() => {
        try { audioElements.ambient.play(); } catch (e) { /* браузер может запретить авто-плей */ }
    }, 300);
}

/* Utility: получить текущую деградацию */
function getDegradation() {
    return parseFloat(localStorage.getItem(LS_DEG) || '0');
}

/* Utility: сохранить деградацию и обновить UI (только basic here; terminal.js будет синхронизировать дальше) */
function setDegradation(value) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    localStorage.setItem(LS_DEG, String(clamped));
    // обновляем индикатор, если он есть на странице
    const fill = document.querySelector('.degradation-fill');
    const hint = document.querySelector('.degradation-hint');
    if (fill) {
        fill.style.width = `${clamped}%`;
        // меняем цвета по порогам
        if (clamped < 30) {
            fill.style.background = 'linear-gradient(90deg, #64FF82, #00FF41)';
        } else if (clamped < 60) {
            fill.style.background = 'linear-gradient(90deg, #EFD76C, #E0C65A)';
        } else if (clamped < 80) {
            fill.style.background = 'linear-gradient(90deg, #FF9A6B, #D83F47)';
        } else {
            fill.style.background = 'linear-gradient(90deg, #D83F47, #C000FF)';
        }
    }
    if (hint) {
        hint.style.display = clamped >= 60 ? 'block' : 'none';
    }
}

/* Инициализируем индикатор при загрузке страницы, если он есть */
document.addEventListener('DOMContentLoaded', function() {
    setDegradation(getDegradation());
});
