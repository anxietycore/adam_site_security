// Звуковые эффекты
const sounds = {
    typewriter: new Audio('sounds/typewriter.wav'),
    glitch: new Audio('sounds/glitch.wav'),
    access_denied: new Audio('sounds/access_denied.wav'),
    access_granted: new Audio('sounds/access_granted.wav'),
    beep: new Audio('sounds/beep.wav'),
    boot_sound: new Audio('sounds/boot_sound.wav')
};

// Настройки громкости (от 0 до 1)
Object.entries(sounds).forEach(([name, sound]) => {
    if (name === 'boot_sound') {
        sound.volume = 0.4;
        sound.loop = false;
    } else {
        sound.volume = 0.3;
    }
});

// Данные для входа (спрятать в видео!)
const VALID_CREDENTIALS = {
    username: "van_koss",
    password: "johan734"
};

// Загрузка системы
document.addEventListener('DOMContentLoaded', function() {
    // Запускаем звук загрузки
    sounds.boot_sound.play().catch(e => {
        console.log('Автовоспроизведение заблокировано');
    });
    
    // Анимация печати с звуком
    const bootTexts = document.querySelectorAll('.boot-text p');
    bootTexts.forEach((text, index) => {
        setTimeout(() => {
            text.style.opacity = 1;
            sounds.typewriter.currentTime = 0;
            sounds.typewriter.play();
        }, 500 + (index * 1000));
    });
    
    // Показываем логин через 6 секунд
    setTimeout(showLoginScreen, 6000);
});

function showLoginScreen() {
    // Останавливаем звук загрузки
    sounds.boot_sound.pause();
    sounds.boot_sound.currentTime = 0;
    
    document.getElementById('boot-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    
    // Фокус на поле ввода
    document.getElementById('username').focus();
}

// Звук при вводе в поля
document.getElementById('username').addEventListener('input', () => {
    sounds.typewriter.currentTime = 0;
    sounds.typewriter.play();
});

document.getElementById('password').addEventListener('input', () => {
    sounds.typewriter.currentTime = 0;
    sounds.typewriter.play();
});

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
