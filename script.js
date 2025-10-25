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
        // ОШИБКА - АДСКИЙ ГЛИТЧ
        errorElement.textContent = 'ДОСТУП ЗАПРЕЩЁН';
        errorElement.style.color = '#ff0000';
        errorElement.classList.remove('hidden');
        
        // Запускаем АДСКИЙ глитч
        activateHellGlitch();
        
        document.getElementById('password').value = '';
        document.getElementById('username').focus();
    }
}

// Функция АДСКОГО глитча с разрушением окна логина
function activateHellGlitch() {
    const loginForm = document.querySelector('.login-form');
    const errorElement = document.getElementById('login-error');
    
    console.log('❌ АКТИВАЦИЯ АДСКОГО ГЛИТЧА ОКНА ЛОГИНА!');
    
    // ОШИБКА - АДСКИЙ ГЛИТЧ
    errorElement.textContent = 'ДОСТУП ЗАПРЕЩЁН';
    errorElement.style.color = '#ff0000';
    errorElement.classList.remove('hidden');
    
    // Запускаем разрушение окна логина
    destroyLoginForm(loginForm);
    
    // Остальные эффекты глитча
    const layers = [
        createGlitchElement('glitch-layer glitch-layer-1'),
        createGlitchElement('glitch-layer glitch-layer-2'),
        createGlitchElement('digital-noise'),
        createGlitchElement('scanlines'),
        createGlitchElement('flicker')
    ];
    
    // Добавляем тряску экрана
    document.body.classList.add('screen-shake');
    document.body.classList.add('rgb-split');
    
    // Глитч текста ошибки
    errorElement.classList.add('text-glitch');
    errorElement.setAttribute('data-text', errorElement.textContent);
    
    // Звуковой эффект
    playHellSound();
    
    // Случайные вспышки
    const flashInterval = setInterval(() => {
        document.body.style.filter = `hue-rotate(${Math.random() * 360}deg) brightness(${1 + Math.random() * 0.5})`;
        setTimeout(() => {
            document.body.style.filter = 'none';
        }, 50);
    }, 100);
    
    // Убираем эффекты через 1.5 секунды
    setTimeout(() => {
        // Восстанавливаем окно логина
        restoreLoginForm(loginForm);
        
        // Убираем классы
        document.body.classList.remove('screen-shake');
        document.body.classList.remove('rgb-split');
        errorElement.classList.remove('text-glitch');
        
        // Убираем фильтры
        document.body.style.filter = 'none';
        
        // Удаляем созданные элементы
        layers.forEach(layer => {
            if (document.body.contains(layer)) {
                document.body.removeChild(layer);
            }
        });
        
        // Останавливаем интервалы
        clearInterval(flashInterval);
        
    }, 1500);
}

// Разрушение окна логина
function destroyLoginForm(loginForm) {
    if (!loginForm) return;
    
    // Сохраняем оригинальные стили
    loginForm.setAttribute('data-original-style', loginForm.getAttribute('style') || '');
    loginForm.setAttribute('data-original-class', loginForm.className);
    
    // Добавляем класс безумия
    loginForm.className = 'login-form login-form-glitch';
    
    // Глитч всех текстовых элементов
    const textElements = loginForm.querySelectorAll('p, label, button, input');
    textElements.forEach(el => {
        el.classList.add('login-text-glitch');
    });
    
    // Глитч кнопки
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.classList.add('btn-madness');
    }
    
    // Глитч инпутов
    const inputs = loginForm.querySelectorAll('input');
    inputs.forEach(input => {
        input.classList.add('input-madness');
    });
    
    // Создаем осколки окна
    createLoginPieces(loginForm);
}

// Создание осколков окна
function createLoginPieces(loginForm) {
    const rect = loginForm.getBoundingClientRect();
    const pieces = 8; // Количество осколков
    
    for (let i = 0; i < pieces; i++) {
        const piece = document.createElement('div');
        piece.className = 'login-piece';
        
        // Случайные модификаторы для анимации
        piece.style.setProperty('--x-mod', `${Math.random() * 100 - 50}px`);
        piece.style.setProperty('--y-mod', `${Math.random() * 100 - 50}px`);
        piece.style.setProperty('--rot-mod', `${Math.random() * 180 - 90}deg`);
        
        // Случайные размеры и позиция
        const width = rect.width / 3 + Math.random() * 50;
        const height = rect.height / 3 + Math.random() * 30;
        const left = rect.left + Math.random() * rect.width;
        const top = rect.top + Math.random() * rect.height;
        
        piece.style.width = `${width}px`;
        piece.style.height = `${height}px`;
        piece.style.left = `${left}px`;
        piece.style.top = `${top}px`;
        
        document.body.appendChild(piece);
        
        // Удаляем осколок через время
        setTimeout(() => {
            if (document.body.contains(piece)) {
                document.body.removeChild(piece);
            }
        }, 2000);
    }
}

// Восстановление окна логина
function restoreLoginForm(loginForm) {
    if (!loginForm) return;
    
    // Восстанавливаем оригинальные стили
    const originalStyle = loginForm.getAttribute('data-original-style');
    const originalClass = loginForm.getAttribute('data-original-class');
    
    if (originalStyle) {
        loginForm.setAttribute('style', originalStyle);
    } else {
        loginForm.removeAttribute('style');
    }
    
    if (originalClass) {
        loginForm.className = originalClass;
    }
    
    // Убираем классы безумия
    const textElements = loginForm.querySelectorAll('p, label, button, input');
    textElements.forEach(el => {
        el.classList.remove('login-text-glitch');
    });
    
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.classList.remove('btn-madness');
    }
    
    const inputs = loginForm.querySelectorAll('input');
    inputs.forEach(input => {
        input.classList.remove('input-madness');
    });
}

// Создание элемента глитча
function createGlitchElement(className) {
    const element = document.createElement('div');
    element.className = className;
    document.body.appendChild(element);
    return element;
}

// Звуковой эффект ада
function playHellSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Создаем несколько осцилляторов для адского звука
        for (let i = 0; i < 3; i++) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Случайные частоты для хаоса
            const freq = 80 + Math.random() * 200;
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(30, audioContext.currentTime + 0.5);
            
            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
        }
        
    } catch (e) {
        console.log('Audio not supported');
    }
}
