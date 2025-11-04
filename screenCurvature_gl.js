// screenCurvature.js - ПРОСТАЯ ИЗОГНУТОСТЬ CRT БЕЗ ЛАГОВ И ГОВНА
(() => {
    // Создаем контейнер для всего контента, который нужно изогнуть
    const terminal = document.getElementById('terminal');
    const screens = [
        document.getElementById('start-screen'),
        document.getElementById('boot-screen'),
        document.getElementById('login-screen')
    ].filter(screen => screen);
    
    // Если это терминал - изгибаем его
    if (terminal) {
        Object.assign(terminal.style, {
            perspective: '1000px',
            transformStyle: 'preserve-3d',
            transform: 'scale3d(1, 1, 0.98) translateZ(-20px)'
        });
    } 
    // Если это главная страница - изгибаем все экраны
    else {
        screens.forEach(screen => {
            Object.assign(screen.style, {
                perspective: '1000px',
                transformStyle: 'preserve-3d',
                transform: 'scale3d(1, 1, 0.98) translateZ(-20px)'
            });
        });
    }
    
    console.log('CRT curvature applied - SIMPLE VERSION');
})();
