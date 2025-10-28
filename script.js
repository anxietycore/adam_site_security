/* script.js — логика старт/boot/login и управление показом деградации
   Полностью готов к вставке. Работает с terminal.html (редирект).
   ВАЖНО: terminal.js остаётся в проекте и использует localStorage ключи:
     - adam_visits
     - adam_degradation
*/

(function () {
    // конфигурация
    const BOOT_LINES_BASE = [
        ">> ИНИЦИАЛИЗАЦИЯ ПРОТОКОЛА БЕЗОПАСНОСТИ A.D.A.M...",
        ">> ЗАГРУЗКА ПОДСИСТЕМЫ VIGIL-9...",
        ">> ТЕСТ ПАМЯТИ: УСПЕШНО",
        ">> КРИПТОМОДУЛЬ: АКТИВИРОВАН",
        ">> ПОДСИСТЕМА COMM: ГОТОВА",
        ">> СИСТЕМА ГОТОВА"
    ];
    const BOOT_ERRORS = [
        "WARNING: сектор памяти 9F-01 повреждён",
        "WARNING: попытка восстановления...",
        "NOTICE: остаточная деградация обнаружена",
        "ALERT: неопознанный отклик // воспр.",
        "ATTEMPT: эмуляция нейросигнала... [успешно]"
    ];

    const VALID_CREDENTIALS = { username: "qq", password: "ww" };

    // DOM
    const startBtn = document.getElementById('start-btn');
    const startScreen = document.getElementById('start-screen');
    const bootScreen = document.getElementById('boot-screen');
    const loginScreen = document.getElementById('login-screen');
    const bootText = document.getElementById('boot-text');
    const bootBar = document.getElementById('boot-bar');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');
    const degradationFill = document.getElementById('degradation-fill');
    const degradationHint = document.getElementById('degradation-hint');
    const degradationPanel = document.getElementById('degradation-panel');
    const ambientHint = document.getElementById('ambient-hint');

    // state
    let visits = parseInt(localStorage.getItem('adam_visits') || '0', 10);
    visits = isNaN(visits) ? 0 : visits;
    visits++;
    localStorage.setItem('adam_visits', visits);

    let degradation = parseInt(localStorage.getItem('adam_degradation') || '0', 10);
    degradation = isNaN(degradation) ? 0 : degradation;
    setDegradationUI(degradation);

    // Start button
    startBtn.addEventListener('click', () => startBootSequence());
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !bootScreen.classList.contains('hidden') === false) startBootSequence(); });

    // Boot sequence
    function startBootSequence() {
        startScreen.classList.add('hidden');
        bootScreen.classList.remove('hidden');
        bootText.innerHTML = '';
        bootBar.style.width = '0%';

        // create boot lines with a slight randomization based on visits
        const lines = buildBootLines(visits);
        let idx = 0;
        const total = lines.length;

        function step() {
            if (idx >= total) {
                // finished
                setTimeout(() => showLoginScreen(), 700);
                return;
            }
            const line = document.createElement('div');
            line.className = 'boot-line fade-in';
            line.textContent = lines[idx];
            bootText.appendChild(line);
            // progress
            const pct = Math.round(((idx + 1) / total) * 100);
            bootBar.style.width = pct + '%';

            // variable delay (simulate hang sometimes)
            let delay = 800 + Math.floor(Math.random() * 800);
            if (Math.random() < 0.12) delay += 800 + Math.floor(Math.random() * 1200); // rare hang
            idx++;
            setTimeout(step, delay);
        }
        setTimeout(step, 300);
    }

    function buildBootLines(visitsCount) {
        // copy base
        const base = BOOT_LINES_BASE.slice();
        // insert 1-2 error lines randomly
        const add = Math.random() < 0.85 ? 1 : 2;
        for (let i=0;i<add;i++) {
            const pos = 1 + Math.floor(Math.random() * (base.length - 1));
            const err = BOOT_ERRORS[Math.floor(Math.random() * BOOT_ERRORS.length)];
            base.splice(pos, 0, err);
        }
        // customize by visits
        if (visitsCount === 1) base.unshift(">> ПЕРВОЕ ПОДКЛЮЧЕНИЕ: ИНИЦИАЛИЗАЦИЯ ЯДРА...");
        else if (visitsCount === 2) base.unshift(">> ПОВТОРНОЕ ПОДКЛЮЧЕНИЕ ОБНАРУЖЕНО // PROCESS: UNSTABLE");
        else base.unshift(">> ОБНАРУЖЕНО: ПОВТОРНЫЙ ДОСТУП // кто вы? // состав проверяется");

        // Add a small chance to delay on cryptomodule line for drama
        return base;
    }

    // Show login screen
    function showLoginScreen() {
        bootScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        usernameInput.focus();

        // occasional ambient hint — random and subtle
        setTimeout(randomAmbientHint, 2000);

        // if visits big -> wobble UI
        if (visits >= 3) {
            // small visual disturb: show short ambient message
            ambientMessage("A.D.A.M. помнит предыдущие сессии...");
        }
    }

    // Login handling
    loginBtn.addEventListener('click', login);
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !loginScreen.classList.contains('hidden')) login(); });

    let loginBlocked = false;
    function login() {
        if (loginBlocked) return;
        const u = usernameInput.value.trim();
        const p = passwordInput.value;
        loginError.classList.add('hidden');

        // show scanning micro-animation (fake)
        loginBtn.disabled = true;
        loginBtn.textContent = "идентификация...";
        setTimeout(() => {
            if (u === VALID_CREDENTIALS.username && p === VALID_CREDENTIALS.password) {
                // success
                loginError.classList.remove('hidden');
                loginError.style.color = 'rgb(100,255,130)';
                loginError.textContent = 'ИДЕНТИФИКАЦИЯ ПОДТВЕРЖДЕНА // нейроскан завершён';
                // store residual degradation to be used by terminal (already stored)
                // short delay then redirect to terminal.html
                setTimeout(() => {
                    // fade out
                    document.body.style.transition = 'opacity 0.6s ease';
                    document.body.style.opacity = '0';
                    setTimeout(()=> window.location.href = 'terminal.html', 700);
                }, 800);
            } else {
                // fail with "ritual"
                loginError.classList.remove('hidden');
                loginError.style.color = '#D83F47';
                loginError.textContent = 'ИДЕНТИФИКАЦИЯ ОТКЛОНЕНА // след оставлен [#735]';
                // block attempts for 4 sec
                loginBlocked = true;
                loginBtn.textContent = "ОТКАЗ";
                setTimeout(()=> {
                    loginBlocked = false;
                    loginBtn.disabled = false;
                    loginBtn.textContent = "АУТЕНТИФИКАЦИЯ";
                    passwordInput.value = '';
                    usernameInput.focus();
                }, 4000);
            }
        }, 900 + Math.floor(Math.random()*900));
    }

    // Degradation UI helpers
    function setDegradationUI(value) {
        degradation = Math.max(0, Math.min(100, parseInt(value || 0, 10)));
        degradationFill.style.width = `${degradation}%`;
        localStorage.setItem('adam_degradation', degradation);
        // hint visibility from 60%
        if (degradation >= 60) {
            degradationHint.style.opacity = '1';
        } else {
            degradationHint.style.opacity = '0';
        }
    }

    // Ambient messages (random life)
    function randomAmbientHint() {
        const hints = [
            "[отклик неизвестного источника]",
            "[ошибка канала связи]",
            "[пользователь не идентифицирован]"
        ];
        if (Math.random() < 0.45) {
            ambientMessage(hints[Math.floor(Math.random() * hints.length)]);
        }
        // schedule next
        setTimeout(randomAmbientHint, 8000 + Math.random()*12000);
    }

    function ambientMessage(text, ms = 2000) {
        ambientHint.textContent = text;
        ambientHint.classList.remove('hidden');
        ambientHint.style.opacity = '1';
        ambientHint.style.transition = 'opacity 0.2s';
        setTimeout(() => {
            ambientHint.style.opacity = '0';
            setTimeout(()=> ambientHint.classList.add('hidden'), 400);
        }, ms);
    }

    // initial ui apply
    setDegradationUI(degradation);

    // expose to window for debugging (optional)
    window.__ADAM_DEBUG = {
        getVisits: () => visits,
        getDegradation: () => degradation,
        setDegradation: (v) => setDegradationUI(v)
    };

})();
