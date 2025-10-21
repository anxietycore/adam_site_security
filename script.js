// Данные для входа
const VALID_CREDENTIALS = {
    username: "11",
    password: "11"
};

// Загрузка системы
document.addEventListener('DOMContentLoaded', function() {
    // Обработчик кнопки запуска
    document.getElementById('start-btn').addEventListener('click', function() {
        startBootSequence();
    });
});

function startBootSequence() {
    // Скрываем стартовый экран, показываем загрузку
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('boot-screen').classList.remove('hidden');
    
    const bootTexts = document.querySelectorAll('#boot-screen .boot-text p');
    let currentIndex = 0;
    
    // Функция для показа следующей строки
    function showNextLine() {
        if (currentIndex < bootTexts.length) {
            const text = bootTexts[currentIndex];
            text.style.opacity = 1;
            currentIndex++;
            
            // Запускаем следующую строку через 1 секунду
            setTimeout(showNextLine, 1000);
        } else {
            // Все строки показаны, переходим к логину
            setTimeout(showLoginScreen, 1000);
        }
    }
    
    // Начинаем показ строк через 0.5 секунды
    setTimeout(showNextLine, 500);
}

function showLoginScreen() {
    document.getElementById('boot-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    
    // Фокус на поле ввода
    document.getElementById('username').focus();
}

// Обработка логина
document.getElementById('login-btn').addEventListener('click', login);
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        login();
    }
});

function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');
    
    if (username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password) {
        // Успешный вход
        document.body.classList.add('glitch');
        setTimeout(() => {
            window.location.href = 'terminal.html';
        }, 1000);
    } else {
        // Неверные данные
        errorElement.classList.remove('hidden');
        document.body.classList.add('glitch');
        setTimeout(() => document.body.classList.remove('glitch'), 300);
        
        // Очистка полей
        document.getElementById('password').value = '';
        document.getElementById('username').focus();
    }
}
