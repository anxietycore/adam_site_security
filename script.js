/* Global site logic: boot sequence, visits, login, and passing stored degradation state to terminal
   Сохраняет: adam_visits, vigil_degradation, vigil_session_start, vigil_lockedUntil (для блокировок)
*/

const VALID_CREDENTIALS = { username: "qq", password: "ww" };

document.addEventListener('DOMContentLoaded', () => {
    // visits counter
    const visits = parseInt(localStorage.getItem('adam_visits') || '0', 10) + 1;
    localStorage.setItem('adam_visits', visits);
    const visitNote = document.getElementById('visit-note');
    if (visitNote) {
        if (visits === 1) visitNote.textContent = 'Новая инициализация ядра...';
        else if (visits === 2) visitNote.textContent = 'Повторное подключение обнаружено — процесс: unstable';
        else if (visits >= 3) visitNote.textContent = 'A.D.A.M. уже активен. кто ты?';
    }

    // start button
    const startBtn = document.getElementById('start-btn');
    startBtn.addEventListener('click', () => {
        startBootSequence();
    });

    // login handling (boot -> login -> terminal)
    window.showLoginScreen = function() {
        document.getElementById('boot-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        const uname = document.getElementById('username');
        if (uname) uname.focus();
    };

    const loginBtn = document.getElementById('login-btn');
    loginBtn.addEventListener('click', tryLogin);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            // If login-screen visible -> try login
            if (!document.getElementById('login-screen').classList.contains('hidden')) tryLogin();
        }
    });

    function tryLogin() {
        const username = document.getElementById('username').value || '';
        const password = document.getElementById('password').value || '';
        const errorEl = document.getElementById('login-error');

        // Fake delay and "neuroscan"
        errorEl.classList.add('hidden');
        errorEl.textContent = 'ДОСТУП ЗАПРЕЩЁН';
        // show scanning loader with slight suspense
        setTimeout(() => {
            if (username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password) {
                // success
                errorEl.textContent = 'ДОСТУП РАЗРЕШЁН';
                errorEl.style.color = '#64ff82';
                errorEl.classList.remove('hidden');
                // fade and go to terminal.html
                document.body.style.transition = 'opacity 0.9s ease';
                document.body.style.opacity = '0';
                setTimeout(() => location.href = 'terminal.html', 900);
            } else {
                // failure: show paranoid behavior
                errorEl.textContent = 'ИДЕНТИФИКАЦИЯ ОТКЛОНЕНА';
                errorEl.style.color = '#ff4444';
                errorEl.classList.remove('hidden');
                // "след оставлен" message and temporary lockout
                const attempts = parseInt(localStorage.getItem('adam_bad_attempts') || '0', 10) + 1;
                localStorage.setItem('adam_bad_attempts', attempts);
                if (attempts >= 3) {
                    errorEl.textContent = 'ОТКАЗ СИСТЕМЫ — повтор через 10 сек...';
                    // disable button for 5 seconds
                    loginBtn.disabled = true;
                    setTimeout(() => { loginBtn.disabled = false; }, 5000);
                } else {
                    // brief blink and re-focus
                    setTimeout(() => {
                        document.getElementById('password').value = '';
                        document.getElementById('username').focus();
                    }, 400);
                }
            }
        }, 800 + Math.random() * 800);
    }
});

function startBootSequence() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('boot-screen').classList.remove('hidden');

    const bootText = document.querySelectorAll('#boot-text p');
    // shuffle 1-2 lines each load for variability
    const randomReplacements = [
        '&gt; WARNING: сектор памяти 9F-01 повреждён',
        '&gt; попытка восстановления...',
        '&gt; [успешно]',
        '&gt; КРИПТОМОДУЛЬ: ПОДВИСАНИЕ',
        '&gt; КРИПТОМОДУЛЬ: АКТИВИРОВАН'
    ];
    // occasionally replace one line
    if (Math.random() > 0.4) {
        const i = Math.floor(Math.random() * bootText.length);
        bootText[i].innerHTML = randomReplacements[Math.floor(Math.random() * randomReplacements.length)];
    }

    let idx = 0;
    function showLine() {
        if (idx < bootText.length) {
            bootText[idx].style.opacity = 1;
            // occasional "hang" on a line to mimic freeze
            if (Math.random() > 0.85) {
                setTimeout(() => { idx++; showLine(); }, 900 + Math.random()*2000);
            } else {
                idx++;
                setTimeout(showLine, 900 + Math.random()*300);
            }
        } else {
            setTimeout(() => {
                // short glitch fade
                const boot = document.getElementById('boot-screen');
                boot.style.opacity = '0.0';
                setTimeout(() => { boot.style.display='none'; showLoginScreen(); }, 260);
            }, 500);
        }
    }
    setTimeout(showLine, 400);
}
