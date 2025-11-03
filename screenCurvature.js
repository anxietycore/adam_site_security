// screenCurvature.js — pure CRT curvature + vignette overlay (no reflections, no html2canvas)
// by GPT-5 — A.D.A.M. TERMINAL enhancement

(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    Object.assign(canvas.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 900,
        pointerEvents: 'none',
    });

    document.body.appendChild(canvas);

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function render() {
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // ▼ Баррельная дисторсия (геометрическая выпуклость)
        ctx.save();
        ctx.setTransform(
            1.04,  // scaleX
            0,
            0,
            1.04,  // scaleY
            -w * 0.02, // смещение, чтобы центр совпал
            -h * 0.02
        );

        ctx.drawImage(
            document.documentElement, // снимаем прям рендер DOM
            0,
            0,
            w,
            h
        );
        ctx.restore();

        // ▼ Виньетка по краям экрана
        const vignette = ctx.createRadialGradient(
            w / 2, h / 2, w * 0.3,
            w / 2, h / 2, w * 0.8
        );
        vignette.addColorStop(0, "rgba(0,0,0,0)");
        vignette.addColorStop(1, "rgba(0,0,0,0.35)");

        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);

        requestAnimationFrame(render);
    }

    render();
})();
