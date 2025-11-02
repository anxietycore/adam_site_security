// script.js
// Логика интерфейса A.D.A.M. (главная страница)
const VALID_CREDENTIALS = { username: "qq", password: "ww" };

document.addEventListener('DOMContentLoaded', () => {
    let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
    localStorage.setItem('adam_visits', ++visits);
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', startBootSequence);
});

function startBootSequence() {
    const startScreen = document.getElementById('start-screen');
    const bootScreen = document.getElementById('boot-screen');
    if (startScreen) startScreen.classList.add('hidden');
    if (bootScreen) bootScreen.classList.remove('hidden');
    const bootTexts = document.querySelectorAll('#boot-screen .boot-text p');
    let i = 0;
    (function next() {
        if (i < bootTexts.length) {
            bootTexts[i++].style.opacity = 1;
            setTimeout(next, 1000);
        } else setTimeout(showLoginScreen, 1000);
    })();
}

function showLoginScreen() {
    document.getElementById('boot-screen')?.classList.add('hidden');
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('username')?.focus();
}

document.getElementById('login-btn')?.addEventListener('click', login);
document.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

function login() {
    const u = document.getElementById('username')?.value;
    const p = document.getElementById('password')?.value;
    const err = document.getElementById('login-error');
    if (u === VALID_CREDENTIALS.username && p === VALID_CREDENTIALS.password) {
        err.textContent = 'ДОСТУП РАЗРЕШЁН';
        err.style.color = '#00FF41';
        err.classList.remove('hidden');
        document.body.style.transition = 'opacity 0.8s ease-in-out';
        document.body.style.opacity = '0';
        setTimeout(() => {
            document.body.style.opacity = '1';
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('terminal').classList.remove('hidden');
            if (typeof initTerminal === 'function') {
                initTerminal();
            } else {
                console.error('Функция initTerminal не найдена');
            }
        }, 800);
    } else {
        err.textContent = 'ДОСТУП ЗАПРЕЩЁН';
        err.style.color = '#FF0000';
        err.classList.remove('hidden');
        document.getElementById('password').value = '';
        document.getElementById('username')?.focus();
    }
}
