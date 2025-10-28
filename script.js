(function () {
    'use strict';

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
    const ambientHint = document.getElementById('ambient-hint');
    const echoMemory = document.getElementById('echo-memory');

    let visits = parseInt(localStorage.getItem('adam_visits') || '0', 10) || 0;
    visits++;
    localStorage.setItem('adam_visits', visits);

    let degradation = parseInt(localStorage.getItem('adam_degradation') || '0', 10) || 0;
    setDegradationUI(degradation);

    const ECHO_PHRASES = ["load consciousness...", "subject lost...", "не смотри", "they remember", "я помню тебя"];
    function spawnEchoPhrase() {
        if (!echoMemory) return;
        const s = document.createElement('span');
        s.className = 'echo-phrase';
        s.textContent = ECHO_PHRASES[Math.floor(Math.random() * ECHO_PHRASES.length)];
        s.style.left = (10 + Math.random() * 80) + '%';
        s.style.top = (10 + Math.random() * 80) + '%';
        s.style.fontSize = (12 + Math.floor(Math.random() * 10)) + 'px';
        echoMemory.appendChild(s);
        setTimeout(() => s.remove(), 3200 + Math.random() * 2000);
    }
    (function scheduleEchoes() {
        spawnEchoPhrase();
        setTimeout(scheduleEchoes, 5000 + Math.random() * 15000);
    })();

    if (startBtn) startBtn.addEventListener('click', startBootSequence);
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter') && startScreen && !startScreen.classList.contains('hidden')) {
            startBootSequence();
        }
    });

    function startBootSequence() {
        startScreen.classList.add('hidden');
        bootScreen.classList.remove('hidden');
        bootText.innerHTML = '';
        bootBar.style.width = '0%';

        const lines = buildBootLines(visits);
        let idx = 0;
        const total = lines.length;

        function step() {
            if (idx >= total) {
                setTimeout(showLoginScreen, 700);
                return;
            }
            const line = document.createElement('div');
            line.className = 'boot-line fade-in';
            line.textContent = lines[idx];
            bootText.appendChild(line);
            const pct = Math.round(((idx + 1) / total) * 100);
            bootBar.style.width = pct + '%';

            let delay = 700 + Math.floor(Math.random() * 800);
            if (lines[idx].toLowerCase().includes('крипто') && Math.random() < 0.6) delay += 800;
            if (Math.random() < 0.08) delay += 1000;

            idx++;
            setTimeout(step, delay);
        }
        setTimeout(step, 300);
    }

    function buildBootLines(visitsCount) {
        const base = BOOT_LINES_BASE.slice();
        const add = Math.random() < 0.85 ? 1 : 2;
        for (let i = 0; i < add; i++) {
            const pos = 1 + Math.floor(Math.random() * (base.length - 1));
            const err = BOOT_ERRORS[Math.floor(Math.random() * BOOT_ERRORS.length)];
            base.splice(pos, 0, err);
        }
        if (visitsCount === 1) base.unshift(">> ПЕРВОЕ ПОДКЛЮЧЕНИЕ: ИНИЦИАЛИЗАЦИЯ ЯДРА...");
        else if (visitsCount === 2) base.unshift(">> ПОВТОРНОЕ ПОДКЛЮЧЕНИЕ ОБНАРУЖЕНО // PROCESS: UNSTABLE");
        else base.unshift(">> ОБНАРУЖЕНО: ПОВТОРНЫЙ ДОСТУП // кто вы? // состав проверяется");
        return base;
    }

    function showLoginScreen() {
        bootScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        if (usernameInput) usernameInput.focus();
        setTimeout(randomAmbientHint, 1600);
        if (visits >= 3) ambientMessage("A.D.A.M. помнит предыдущие сессии...");
    }

    if (loginBtn) loginBtn.addEventListener('click', login);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && loginScreen && !loginScreen.classList.contains('hidden')) login();
    });

    let loginBlocked = false;
    function login() {
        if (loginBlocked) return;
        const u = usernameInput ? usernameInput.value.trim() : '';
        const p = passwordInput ? passwordInput.value : '';
        if (loginError) loginError.classList.add('hidden');

        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = "идентификация...";
        }

        setTimeout(() => {
            if (u === VALID_CREDENTIALS.username && p === VALID_CREDENTIALS.password) {
                if (loginError) {
                    loginError.classList.remove('hidden');
                    loginError.style.color = '#8aff99';
                    loginError.textContent = 'ИДЕНТИФИКАЦИЯ ПОДТВЕРЖДЕНА // нейроскан завершён';
                }
                setTimeout(() => {
                    document.body.style.transition = 'opacity 0.6s ease';
                    document.body.style.opacity = '0';
                    setTimeout(() => window.location.href = 'terminal.html', 700);
                }, 700);
            } else {
                if (loginError) {
                    loginError.classList.remove('hidden');
                    loginError.style.color = '#D83F47';
                    loginError.textContent = 'ИДЕНТИФИКАЦИЯ ОТКЛОНЕНА // след оставлен [#735]';
                }
                loginBlocked = true;
                if (loginBtn) loginBtn.textContent = "ОТКАЗ";
                setTimeout(() => {
                    loginBlocked = false;
                    if (loginBtn) {
                        loginBtn.disabled = false;
                        loginBtn.textContent = "АУТЕНТИФИКАЦИЯ";
                    }
                    if (passwordInput) passwordInput.value = '';
                    if (usernameInput) usernameInput.focus();
                }, 4000);
            }
        }, 900 + Math.floor(Math.random() * 900));
    }

    function setDegradationUI(value) {
        degradation = Math.max(0, Math.min(100, parseInt(value || 0, 10)));
        if (degradationFill) degradationFill.style.width = `${degradation}%`;
        localStorage.setItem('adam_degradation', String(degradation));
        if (degradationHint) {
            degradationHint.style.opacity = (degradation >= 60) ? '1' : '0';
        }
    }

    function randomAmbientHint() {
        const hints = ["[отклик неизвестного источника]", "[ошибка канала связи]", "[пользователь не идентифицирован]"];
        if (Math.random() < 0.45) {
            ambientMessage(hints[Math.floor(Math.random() * hints.length)]);
        }
        setTimeout(randomAmbientHint, 8000 + Math.random() * 12000);
    }

    function ambientMessage(text, ms = 2000) {
        if (!ambientHint) return;
        ambientHint.textContent = text;
        ambientHint.classList.remove('hidden');
        ambientHint.style.opacity = '1';
        setTimeout(() => {
            ambientHint.style.opacity = '0';
            setTimeout(() => ambientHint.classList.add('hidden'), 400);
        }, ms);
    }

    setDegradationUI(degradation);

    window.__ADAM_DEBUG = {
        getVisits: () => visits,
        getDegradation: () => degradation,
        setDegradation: (v) => setDegradationUI(v)
    };
})();
