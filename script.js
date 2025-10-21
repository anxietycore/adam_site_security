// Звуковые эффекты
const sounds = {
    glitch: new Audio('sounds/glitch.wav'),
    access_denied: new Audio('sounds/access_denied.wav'),
    access_granted: new Audio('sounds/access_granted.wav'),
    beep: new Audio('sounds/beep.wav'),
    boot_sound: new Audio('sounds/boot_sound.wav')
};

// Настройки громкости
Object.values(sounds).forEach(sound => {
    sound.volume = 0.3;
});

// Данные для входа
const VALID_CREDENTIALS = {
    username: "van_koss",
    password: "johan734"
};

// Загрузка системы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Страница загружена, запускаем загрузку...');
    startBootSequence();
});

function startBootSequence() {
    console.log('Запуск последовательности загрузки...');
    
    const bootTexts = document.querySelectorAll('.boot-text p');
    console.log('Найдено строк:', bootTexts.length);
    
    let currentIndex = 0;
    
    // Запускаем звук загрузки
    setTimeout(() => {
        console.log('Запуск звука загрузки...');
        sounds.boot_sound.play().catch(e => {
            console.log('Звук загрузки не запустился:', e);
        });
    }, 500);
    
    // Функция для показа следующей строки
    function showNextLine() {
        console.log('Показ строки', currentIndex);
        
        if (currentIndex < bootTexts.length) {
            const text = bootTexts[currentIndex];
            text.classList.remove('hidden');
            currentIndex++;
            
            // Запускаем следующую строку через 1 секунду
            setTimeout(showNextLine, 1000);
        } else {
            // Все строки показаны, переходим к логину
            console.log('Все строки показаны, переход к логину...');
            setTimeout(showLoginScreen, 1000);
        }
    }
    
    // Начинаем показ строк через 1 секунду
    setTimeout(showNextLine, 1000);
}

function showLoginScreen() {
    console.log('Показ экрана логина...');
    
    // Останавливаем звук загрузки
    sounds.boot_sound.pause();
    sounds.boot_sound.currentTime = 0;
    
    document.getElementById('boot-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    
    // Фокус на поле ввода
    document.getElementById('username').focus();
}

// Обработка логина
document.getElementById('login-btn').addEventListener('click', login);
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        sounds.beep.play();
        login();
    }
});

function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');
    
    if (username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password) {
        // Успешный вход
        sounds.access_granted.play();
        document.body.classList.add('glitch');
        setTimeout(() => {
            window.location.href = 'terminal.html';
        }, 1000);
    } else {
        // Неверные данные
        sounds.access_denied.play();
        sounds.glitch.play();
        errorElement.classList.remove('hidden');
        document.body.classList.add('glitch');
        setTimeout(() => document.body.classList.remove('glitch'), 300);
        
        // Очистка полей
        document.getElementById('password').value = '';
        document.getElementById('username').focus();
    }
}
