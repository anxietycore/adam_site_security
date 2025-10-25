// Данные для входа
const VALID_CREDENTIALS = {
    username: "qq",
    password: "ww"
};

console.log('=== A.D.A.M. DEBUG START ===');
console.log('Ожидаемые данные:', VALID_CREDENTIALS);

// Загрузка системы
document.addEventListener('DOMContentLoaded', function() {
    // === СЧЁТЧИК ПОСЕЩЕНИЙ ===
    let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
    visits++;
    localStorage.setItem('adam_visits', visits);
    console.log(`Посещений A.D.A.M.: ${visits}`);
    // === КОНЕЦ СЧЁТЧИКА ===
    
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
    
    const isUsernameMatch = username === VALID_CREDENTIALS.username;
    const isPasswordMatch = password === VALID_CREDENTIALS.password;
    
    if (isUsernameMatch && isPasswordMatch) {
        console.log('✅ УСПЕШНЫЙ ВХОД!');
        // УСПЕХ - показываем "ДОСТУП РАЗРЕШЁН" зелёным
        errorElement.textContent = 'ДОСТУП РАЗРЕШЁН';
        errorElement.style.color = '#00FF41';
        errorElement.classList.remove('hidden');
        
        document.body.style.transition = 'opacity 0.8s ease-in-out';
        document.body.style.opacity = '0';
        setTimeout(() => {
            window.location.href = 'terminal.html';
        }, 800);
    } else {
        console.log('❌ ОШИБКА ВХОДА!');
        // ОШИБКА - МЕГА-ГЛИТЧ + "ДОСТУП ЗАПРЕЩЁН" красным
        errorElement.textContent = 'ДОСТУП ЗАПРЕЩЁН';
        errorElement.style.color = '#ff0000';
        errorElement.classList.remove('hidden');
        
        // Запускаем убер-глитч
        document.body.classList.add('glitch');
        
        // Добавляем звуковой эффект (опционально)
        playErrorSound();
        
        // Увеличиваем время глитча и добавляем доп эффекты
        setTimeout(() => {
            document.body.classList.remove('glitch');
            // Добавляем дополнительную тряску после глитча
            document.body.style.animation = 'screen-shake 0.3s';
            setTimeout(() => {
                document.body.style.animation = '';
            }, 300);
        }, 800); // Глитч длится 0.8 секунд
        
        document.getElementById('password').value = '';
        document.getElementById('username').focus();
    }
}

// Функция для звукового эффекта (опционально)
function playErrorSound() {
    try {
        // Создаем бип-звук через Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.log('Audio not supported');
    }
}
