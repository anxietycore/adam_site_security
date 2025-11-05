// screenCurvature.js - Простой WebGL шейдер для изогнутости экрана (CRT effect)
(() => {
    // Создаем canvas и WebGL контекст
    const canvas = document.createElement('canvas');
    canvas.id = 'curvature-canvas';
    Object.assign(canvas.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none', // Не мешаем кликам по интерфейсу
        zIndex: 0 // На заднем плане, под всем остальным
    });
    document.body.appendChild(canvas);

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        console.error('WebGL не поддерживается вашим браузером.');
        return;
    }

    // Вершинный шейдер (определяет форму)
    const vertexShaderSource = `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;

        uniform vec2 u_resolution;
        uniform float u_time; // Используем время для очень легкого дрожания, если нужно

        varying vec2 v_texCoord;

        void main() {
            // Преобразуем позицию из пикселей в нормализованные координаты (-1, 1)
            vec2 zeroToOne = a_position / u_resolution;
            vec2 twoZeroToOne = zeroToOne * 2.0 - 1.0;
            vec2 clipSpace = twoZeroToOne * vec2(1, -1); // Y-ось вверх

            // Применяем изогнутость
            float curvature = 0.05; // Степень изгиба. Уменьши, если хочешь меньше изгиба.
            float aspect = u_resolution.x / u_resolution.y;

            // Легкий изгиб по X и Y
            vec2 curvedPos = clipSpace;
            curvedPos.x += curvature * sin(clipSpace.y * 3.14159);
            curvedPos.y += curvature * sin(clipSpace.x * 3.14159);

            gl_Position = vec4(curvedPos, 0, 1);
            v_texCoord = a_texCoord;
        }
    `;

    // Фрагментный шейдер (определяет цвет каждого пикселя)
    const fragmentShaderSource = `
        precision mediump float;

        uniform sampler2D u_image;
        uniform vec2 u_resolution;

        varying vec2 v_texCoord;

        void main() {
            // Получаем цвет из текстуры (это весь контент страницы)
            vec2 texCoord = v_texCoord;

            // Просто выводим цвет без изменений
            gl_FragColor = texture2D(u_image, texCoord);
        }
    `;

    // Компиляция шейдеров
    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.log(`Ошибка компиляции шейдера: ${gl.getShaderInfoLog(shader)}`);
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    // Создание программы
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.log(`Ошибка линковки программы: ${gl.getProgramInfoLog(program)}`);
        return;
    }

    // Атрибуты и униформы
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const texCoordAttributeLocation = gl.getAttribLocation(program, "a_texCoord");
    const resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    const timeUniformLocation = gl.getUniformLocation(program, "u_time");

    // Создаем буфер для вершин
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
        0, 0,
        gl.canvas.width, 0,
        0, gl.canvas.height,
        0, gl.canvas.height,
        gl.canvas.width, 0,
        gl.canvas.width, gl.canvas.height
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Создаем буфер для координат текстуры
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    const texCoords = new Float32Array([
        0, 0,
        1, 0,
        0, 1,
        0, 1,
        1, 0,
        1, 1
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    // Создаем текстуру для рендеринга всего контента страницы
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

    // Создаем фреймбуфер для рендеринга в текстуру
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    // Функция для ресайза
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    window.addEventListener('resize', resize);
    resize();

    // Главный цикл рендеринга
    function render(time) {
        time *= 0.001; // Переводим в секунды

        // Рендерим всё содержимое страницы в текстуру
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Рисуем контент страницы (это будет сделано через CSS, но мы его "перехватываем")
        // Для этого мы используем trick: рисуем черный прямоугольник, а потом применяем шейдер
        gl.useProgram(program);
        gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
        gl.uniform1f(timeUniformLocation, time);

        // Включаем атрибуты
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(texCoordAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        // Привязываем текстуру
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);

        // Рисуем
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Теперь рисуем на основной канве (экран)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Рисуем текстуру с изогнутым шейдером
        gl.useProgram(program);
        gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
        gl.uniform1f(timeUniformLocation, time);

        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(texCoordAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
    }

    // Запускаем рендеринг
    requestAnimationFrame(render);

})();
