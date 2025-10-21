// Данные для входа (потом можно усложнить)
const VALID_CREDENTIALS = {
    username: "operator",
    password: "vigil9"
};

// Загрузка системы
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(showLoginScreen, 6000); // Через 6 сек показываем логин
});

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
        document.getElementById('username').value = '';
        document.getElementById('username').focus();
    }
}
