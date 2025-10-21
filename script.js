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
    
    console.log('=== ПОПЫТКА ВХОДА ===');
    console.log('Введён логин:', `"${username}"`, 'тип:', typeof username, 'длина:', username.length);
    console.log('Введён пароль:', `"${password}"`, 'тип:', typeof password, 'длина:', password.length);
    console.log('Ожидаемый логин:', `"${VALID_CREDENTIALS.username}"`, 'тип:', typeof VALID_CREDENTIALS.username, 'длина:', VALID_CREDENTIALS.username.length);
    console.log('Ожидаемый пароль:', `"${VALID_CREDENTIALS.password}"`, 'тип:', typeof VALID_CREDENTIALS.password, 'длина:', VALID_CREDENTIALS.password.length);
    
    // Проверка посимвольно
    console.log('Символы логина:', Array.from(username).map(c => c.charCodeAt(0)));
    console.log('Символы пароля:', Array.from(password).map(c => c.charCodeAt(0)));
    
    const isUsernameMatch = username === VALID_CREDENTIALS.username;
    const isPasswordMatch = password === VALID_CREDENTIALS.password;
    
    console.log('Логин совпадает:', isUsernameMatch);
    console.log('Пароль совпадает:', isPasswordMatch);
    
    if (isUsernameMatch && isPasswordMatch) {
        console.log('✅ УСПЕШНЫЙ ВХОД!');
        document.body.classList.add('glitch');
        setTimeout(() => {
            window.location.href = 'terminal.html';
        }, 1000);
    } else {
        console.log('❌ ОШИБКА ВХОДА!');
        errorElement.classList.remove('hidden');
        document.body.classList.add('glitch');
        setTimeout(() => document.body.classList.remove('glitch'), 300);
        
        document.getElementById('password').value = '';
        document.getElementById('username').focus();
    }
}
