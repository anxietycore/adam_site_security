// screenCurvature.js - ЛЕГКИЙ CRT ЭФФЕКТ БЕЗ ЛАГОВ
(() => {
    // Создаем просто DIV с градиентами для имитации изогнутости
    const curvature = document.createElement('div');
    curvature.id = 'crt-curvature';
    Object.assign(curvature.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: '10',
        background: `
            radial-gradient(
                ellipse at center,
                transparent 0%,
                rgba(0, 0, 0, 0.15) 70%,
                rgba(0, 20, 0, 0.35) 100%
            ),
            radial-gradient(
                circle at 10% 20%,
                rgba(0, 50, 0, 0.1) 0%,
                transparent 20%
            ),
            radial-gradient(
                circle at 90% 80%,
                rgba(0, 50, 0, 0.1) 0%,
                transparent 20%
            )
        `,
        mixBlendMode: 'multiply',
        opacity: '0.7'
    });
    
    // Добавляем тонкую зеленую рамку по краям (CRT glow)
    const glow = document.createElement('div');
    Object.assign(glow.style, {
        position: 'fixed',
        top: '1px',
        left: '1px',
        right: '1px',
        bottom: '1px',
        pointerEvents: 'none',
        border: '1px solid rgba(0, 255, 65, 0.1)',
        borderRadius: '3px',
        zIndex: '11',
        boxShadow: '0 0 15px rgba(0, 255, 65, 0.2)'
    });
    
    document.body.appendChild(curvature);
    document.body.appendChild(glow);
    
    console.log('CRT curvature effect loaded - LITE VERSION');
})();
