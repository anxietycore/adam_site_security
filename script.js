// Данные для входа
const VALID_CREDENTIALS = {
    username: "qq",
    password: "ww"
};

// Загрузка системы
document.addEventListener('DOMContentLoaded', function() {
    // === СЧЁТЧИК ПОСЕЩЕНИЙ ===
    let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
    visits++;
    localStorage.setItem('adam_visits', visits);

    // Обработчик кнопки запуска
    document.getElementById('start-btn').addEventListener('click', function() {
        startBootSequence(visits);
    });
});

function startBootSequence(visits) {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('boot-screen').classList.remove('hidden');
    
    // Генерация вариативной загрузки
    const baseLines = [
        "> ИНИЦИАЛИЗАЦИЯ ПРОТОКОЛА БЕЗОПАСНОСТИ A.D.A.M...",
        "> ЗАГРУЗКА ПОДСИСТЕМЫ VIGIL-9...",
        "> ТЕСТ ПАМЯТИ: УСПЕШНО",
        "> КРИПТОМОДУЛЬ: АКТИВИРОВАН",
        "> ПРЕДУПРЕЖДЕНИЕ: НЕСАНКЦИОНИРОВАННЫЙ ДОСТУП ЗАПРЕЩЁН",
        "> СИСТЕМА ГОТОВА"
    ];
    
    // Добавляем вариативные строки
    const variantLines = [
        "> WARNING: сектор памяти 9F-01 повреждён",
        "> попытка восстановления...",
        "> [успешно]",
        "> синхронизация с MONOLITH...",
        "> нейроскан активирован"
    ];
    
    let bootLines = [...baseLines];
    if (visits > 1) {
        // Вставляем 1-2 случайные строки
        const insertCount = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < insertCount; i++) {
            const randomLine = variantLines[Math.floor(Math.random() * variantLines.length)];
            const insertPos = Math.floor(Math.random() * (bootLines.length - 1)) + 1;
            bootLines.splice(insertPos, 0, randomLine);
        }
    }
    
    // Обновляем DOM
    const bootTextContainer = document.querySelector('#boot-screen .boot-text');
    bootTextContainer.innerHTML = '';
    bootLines.forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        p.style.opacity = '0';
        bootTextContainer.appendChild(p);
    });
    
    const bootTexts = document.querySelectorAll('#boot-screen .boot-text p');
    let currentIndex = 0;
    function showNextLine() {
        if (currentIndex < bootTexts.length) {
            const text = bootTexts[currentIndex];
            text.style.opacity = 1;
            
            // Эффект подвисания на строке "КРИПТОМОДУЛЬ"
            if (text.textContent.includes("КРИПТОМОДУЛЬ")) {
                setTimeout(() => {
                    currentIndex++;
                    setTimeout(showNextLine, 300);
                }, 1500);
            } else {
                currentIndex++;
                setTimeout(showNextLine, 800 + Math.random() * 400);
            }
        } else {
            setTimeout(showLoginScreen, 1000);
        }
    }
    setTimeout(showNextLine, 500);
}

function showLoginScreen() {
    document.getElementById('boot-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('username').focus();
    
    // Реакция на число посещений
    const loginPrompt = document.querySelector('.login-prompt');
    const visits = parseInt(localStorage.getItem('adam_visits')) || 0;
    if (visits === 1) {
        loginPrompt.textContent = "ДОСТУП К ТЕРМИНАЛУ";
    } else if (visits === 2) {
        loginPrompt.textContent = "ПОВТОРНОЕ ПОДКЛЮЧЕНИЕ";
    } else {
        loginPrompt.textContent = "A.D.A.M. УЖЕ АКТИВЕН";
        // Добавляем подсказку
        const hint = document.createElement('p');
        hint.textContent = "> кто ты?";
        hint.style.color = "rgb(100, 255, 130)";
        hint.style.fontSize = "14px";
        hint.style.marginTop = "10px";
        document.querySelector('.login-form').appendChild(hint);
    }
}

// Обработка логина
let loginAttempts = 0;
let loginBlockedUntil = 0;

document.getElementById('login-btn').addEventListener('click', login);
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') login();
});

function login() {
    const now = Date.now();
    if (now < loginBlockedUntil) {
        return;
    }
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');
    
    const isUsernameMatch = username === VALID_CREDENTIALS.username;
    const isPasswordMatch = password === VALID_CREDENTIALS.password;
    
    if (isUsernameMatch && isPasswordMatch) {
        // УСПЕХ
        errorElement.textContent = 'идентификация подтверждена';
        errorElement.style.color = 'rgb(100, 255, 130)';
        errorElement.classList.remove('hidden');
        
        // Эффект нейроскана
        setTimeout(() => {
            errorElement.textContent = 'нейроскан завершён';
            setTimeout(() => {
                errorElement.textContent = 'добро пожаловать обратно, оператор';
                document.body.style.transition = 'opacity 0.8s ease-in-out';
                document.body.style.opacity = '0';
                setTimeout(() => {
                    window.location.href = 'terminal.html';
                }, 800);
            }, 800);
        }, 500);
    } else {
        // ОШИБКА
        loginAttempts++;
        errorElement.textContent = 'идентификация...';
        errorElement.style.color = '#888';
        errorElement.classList.remove('hidden');
        
        // Имитация сканирования
        setTimeout(() => {
            if (loginAttempts >= 3) {
                errorElement.textContent = 'вторжение зафиксировано';
                errorElement.style.color = '#D83F47';
                loginBlockedUntil = now + 5000;
                document.getElementById('login-btn').disabled = true;
                setTimeout(() => {
                    document.getElementById('login-btn').disabled = false;
                    errorElement.classList.add('hidden');
                    document.getElementById('password').value = '';
                }, 5000);
            } else {
                errorElement.textContent = 'отказ системы';
                errorElement.style.color = '#D83F47';
                setTimeout(() => {
                    // Эффект глюка
                    document.body.style.opacity = '0.3';
                    setTimeout(() => {
                        document.body.style.opacity = '1';
                        errorElement.classList.add('hidden');
                        document.getElementById('password').value = '';
                        document.getElementById('username').focus();
                    }, 500);
                }, 1000);
            }
        }, 2000);
    }
}
