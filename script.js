// Данные для входа
const VALID_CREDENTIALS = {
    username: "qq",
    password: "ww"
};

console.log('=== A.D.A.M. DEBUG START ===');
console.log('Ожидаемые данные:', VALID_CREDENTIALS);

// Загрузка системы
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен');
    
    // Обработчик кнопки запуска
    document.getElementById('start-btn').addEventListener('click', function() {
        console.log('Кнопка запуска нажата');
        startBootSequence();
    });
});

function startBootSequence() {
    console.log('Запуск последовательности загрузки');
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('boot-screen').classList.remove('hidden');
    
    const bootTexts = document.querySelectorAll('#boot-screen .boot-text p');
    console.log('Найдено строк загрузки:', bootTexts.length);
    
    let currentIndex = 0;
    
    function showNextLine() {
        if (currentIndex < bootTexts.length) {
            const text = bootTexts[currentIndex];
            text.style.opacity = 1;
            currentIndex++;
            setTimeout(showNextLine, 1000);
        } else {
            setTimeout(showLoginScreen, 1000);
        }
    }
    setTimeout(showNextLine, 500);
}

function showLoginScreen() {
    console.log('Показ экрана логина');
    document.getElementById('boot-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('username').focus();
}

// Обработка логина
document.getElementById('login-btn').addEventListener('click', login);
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') login();
});

function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');
    
    // СБРАСЫВАЕМ ОШИБКУ ПЕРЕД КАЖДОЙ ПРОВЕРКОЙ
    errorElement.classList.add('hidden');
    
    console.log('=== ПОПЫТКА ВХОДА ===');
    console.log('Введён логин:', `"${username}"`);
    console.log('Введён пароль:', `"${password}"`);
    
    const isUsernameMatch = username === VALID_CREDENTIALS.username;
    const isPasswordMatch = password === VALID_CREDENTIALS.password;
    
    if (isUsernameMatch && isPasswordMatch) {
        console.log('✅ УСПЕШНЫЙ ВХОД!');
        // УСПЕХ - плавный переход БЕЗ глитча
        document.body.style.transition = 'opacity 0.8s ease-in-out';
        document.body.style.opacity = '0';
        setTimeout(() => {
            window.location.href = 'terminal.html';
        }, 800);
    } else {
        console.log('❌ ОШИБКА ВХОДА!');
        // ОШИБКА - глитч + сообщение
        errorElement.classList.remove('hidden');
        document.body.classList.add('glitch');
        setTimeout(() => document.body.classList.remove('glitch'), 300);
        
        document.getElementById('password').value = '';
        document.getElementById('username').focus();
    }
}
