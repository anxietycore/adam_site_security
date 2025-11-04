// screenCurvature.js - Простой и рабочий эффект изогнутого CRT экрана
(() => {
    // Создаем canvas поверх контента
    const canvas = document.createElement('canvas');
    canvas.id = 'curvature-canvas';
    Object.assign(canvas.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: '1000',
        opacity: '0.98'
    });
    
    // Вставляем canvas как первый элемент в body (чтобы он был под всем контентом)
    document.body.insertBefore(canvas, document.body.firstChild);
    
    const ctx = canvas.getContext('2d');
    let width, height;
    
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', resize);
    resize();
    
    // Основная функция рендера эффекта кривизны
    function render() {
        // Очищаем canvas
        ctx.clearRect(0, 0, width, height);
        
        // Создаем градиент для эффекта изогнутости
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Эффект бочкообразного искажения (barrel distortion)
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        
        // Коэффициент искривления (чем больше, тем сильнее изгиб)
        const curvature = 0.08;
        
        // Для оптимизации - рисуем только каждый N пиксель
        const skip = 2;
        
        for (let y = 0; y < height; y += skip) {
            for (let x = 0; x < width; x += skip) {
                // Нормализуем координаты
                const nx = (x - centerX) / centerX;
                const ny = (y - centerY) / centerY;
                
                // Применяем бочкообразное искажение
                const r2 = nx * nx + ny * ny;
                const distortion = 1 - curvature * r2;
                
                // Исходные координаты с искажением
                const sx = Math.floor(centerX + nx * centerX * distortion);
                const sy = Math.floor(centerY + ny * centerY * distortion);
                
                // Проверяем границы
                if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                    // Применяем эффект виньетки (темные углы)
                    const vignette = Math.pow(1 - (Math.min(1, r2) * 0.8), 3);
                    
                    // Рисуем пиксель с эффектом изогнутости и виньетки
                    const index = (y * width + x) * 4;
                    data[index] = 0;     // R
                    data[index + 1] = 0; // G
                    data[index + 2] = 0; // B
                    data[index + 3] = Math.floor(15 * vignette); // Прозрачность для эффекта
                        
                    // Добавляем едва заметный зеленый оттенок по краям для CRT-эффекта
                    if (r2 > 0.7) {
                        data[index] = 0;
                        data[index + 1] = Math.floor(4 * vignette);
                        data[index + 2] = 0;
                    }
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Добавляем очень тонкий контур по краям для эффекта CRT
        ctx.strokeStyle = 'rgba(0, 255, 65, 0.05)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, width - 2, height - 2);
        
        requestAnimationFrame(render);
    }
    
    // Запускаем рендеринг
    render();
    
    console.log('CRT curvature effect loaded successfully');
})();
