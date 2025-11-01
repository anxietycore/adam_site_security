// Данные для входа
const VALID_CREDENTIALS = {
    username: "qq",
    password: "ww"
};

document.addEventListener('DOMContentLoaded', function() {
    let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
    visits++;
    localStorage.setItem('adam_visits', visits);

    document.getElementById('start-btn').addEventListener('click', function() {
        startBootSequence(visits);
    });
});

function startBootSequence(visits) {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('boot-screen').classList.remove('hidden');

    let bootLines = [
        "> ИНИЦИАЛИЗАЦИЯ ПРОТОКОЛА БЕЗОПАСНОСТИ A.D.A.M...",
        "> ЗАГРУЗКА ПОДСИСТЕМЫ VIGIL-9...",
        "> ТЕСТ ПАМЯТИ: УСПЕШНО"
    ];

    // Вариативность загрузки
    if (visits === 1) {
        bootLines.push("> новая инициализация ядра...");
    } else if (visits === 2) {
        bootLines.push("> повторное подключение обнаружено");
        bootLines.push("> процесс: unstable");
    } else {
        bootLines.push("> A.D.A.M. уже активен");
        bootLines.push("> кто ты?");
    }

    bootLines.push(
        "> КРИПТОМОДУЛЬ: АКТИВИРОВАН",
        "> ПРЕДУПРЕЖДЕНИЕ: НЕСАНКЦИОНИРОВАННЫЙ ДОСТУП ЗАПРЕЩЁН",
        "> СИСТЕМА ГОТОВА"
    );

    // Случайные ошибки
    if (Math.random() > 0.5) {
        const errIdx = Math.floor(Math.random() * (bootLines.length - 2)) + 1;
        bootLines.splice(errIdx, 0,
            "> WARNING: сектор памяти 9F-01 повреждён",
            "> попытка восстановления...",
            "> [успешно]"
        );
    }

    let currentIndex = 0;
    function showNextLine() {
        if (currentIndex < bootLines.length) {
            const p = document.createElement('p');
            p.textContent = bootLines[currentIndex];
            p.style.opacity = '0';
            document.querySelector('.boot-text').appendChild(p);
            setTimeout(() => {
                p.style.transition = 'opacity 0.4s';
                p.style.opacity = '1';
                currentIndex++;
                setTimeout(showNextLine, 800);
            }, 100);
        } else {
            setTimeout(showLoginScreen, 1000);
        }
    }
    showNextLine();
}

function showLoginScreen() {
    document.getElementById('boot-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('username').focus();
}

function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');

    const isMatch = username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password;

    if (isMatch) {
        errorElement.textContent = 'идентификация подтверждена';
        errorElement.style.color = 'rgb(100, 255, 130)';
        errorElement.classList.remove('hidden');
        playAudio('sounds/scanner.mp3'); // звук сканера
        setTimeout(() => {
            errorElement.textContent = 'нейроскан завершён';
            setTimeout(() => {
                errorElement.textContent = 'добро пожаловать обратно, оператор';
                setTimeout(() => {
                    document.body.style.opacity = '0';
                    setTimeout(() => {
                        window.location.href = 'terminal.html';
                    }, 800);
                }, 1200);
            }, 800);
        }, 800);
    } else {
        // Глючащий логин
        errorElement.textContent = 'идентификация...';
        errorElement.style.color = 'rgb(100, 255, 130)';
        errorElement.classList.remove('hidden');
        document.getElementById('login-btn').disabled = true;
        setTimeout(() => {
            errorElement.textContent = 'отказ системы';
            errorElement.style.color = '#D83F47';
            setTimeout(() => {
                errorElement.textContent = 'вторжение зафиксировано';
                document.body.style.opacity = '0.3';
                setTimeout(() => {
                    document.body.style.opacity = '1';
                    document.getElementById('login-btn').disabled = false;
                    document.getElementById('password').value = '';
                    document.getElementById('username').focus();
                }, 500);
            }, 600);
        }, 2500);
    }
}

function playAudio(src) {
    const audio = new Audio(src);
    audio.volume = 0.6;
    audio.play().catch(e => {});
}

// Обработчики
document.getElementById('login-btn').addEventListener('click', login);
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') login();
});
