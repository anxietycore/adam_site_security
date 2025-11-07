// script.js
// Логика интерфейса A.D.A.M. (главная страница + изгиб и стекло)

const VALID_CREDENTIALS = { username: "qq", password: "ww" };

document.addEventListener('DOMContentLoaded', () => {
    // Подсчёт посещений
    let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
    localStorage.setItem('adam_visits', ++visits);

    // Инициализация изгиба
    initScreenCurvature();

    // Инициализация стеклянного блика
    initScreenGlass();

    // Кнопка запуска
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
        setTimeout(() => window.location.href = 'terminal.html', 800);
    } else {
        err.textContent = 'ДОСТУП ЗАПРЕЩЁН';
        err.style.color = '#FF0000';
        err.classList.remove('hidden');
        document.getElementById('password').value = '';
        document.getElementById('username')?.focus();
    }
}

// === ЭФФЕКТ ИЗГИБА ЭКРАНА ===
function initScreenCurvature() {
    const screens = [
        document.getElementById('start-screen'),
        document.getElementById('boot-screen'),
        document.getElementById('login-screen')
    ].filter(Boolean);

    document.body.style.perspective = '1200px';
    document.body.style.transformStyle = 'preserve-3d';

    screens.forEach(screen => {
        screen.style.transform = 'rotateX(2.3deg) scale(0.985)';
        screen.style.filter = 'brightness(0.9) contrast(1.1)';
        screen.style.borderRadius = '6px';
        screen.style.boxShadow = '0 0 40px rgba(0,255,50,0.15) inset';
        screen.style.transition = 'transform 0.6s ease, filter 0.6s ease';
    });

    // Небольшая динамика изгиба при движении мыши
    document.addEventListener('mousemove', e => {
        const midX = window.innerWidth / 2;
        const midY = window.innerHeight / 2;
        const rotY = (e.clientX - midX) / midX * 2;
        const rotX = -(e.clientY - midY) / midY * 2;
        screens.forEach(screen => {
            screen.style.transform = `rotateX(${2.3 + rotX * 0.5}deg) rotateY(${rotY * 0.5}deg) scale(0.985)`;
        });
    });
}

// === ЭФФЕКТ СТЕКЛА (блик) ===
function initScreenGlass() {
    const glass = document.createElement('div');
    glass.classList.add('screen-glass');
    document.body.appendChild(glass);

    // Эффект параллакса
    document.addEventListener('mousemove', e => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        glass.style.background = `
            radial-gradient(
                circle at ${x * 100}% ${y * 100}%,
                rgba(255,255,255,0.10),
                rgba(255,255,255,0) 60%
            )
        `;
    });

    // Немного живого блика
    setInterval(() => {
        glass.style.opacity = (0.8 + Math.random() * 0.2).toFixed(2);
    }, 1200);
}
