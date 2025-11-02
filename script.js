// script.js
// 2025-11-02 — Полностью рабочая версия: vanilla WebGL фон + логика A.D.A.M.

// ----------------------
// ЧАСТЬ A: WebGL background (vanilla)
// ----------------------
(() => {
    const canvas = document.getElementById('shader-canvas');
    if (!canvas) {
        console.warn('Canvas #shader-canvas не найден. Фон не будет отображаться.');
        return;
    }

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        console.warn('WebGL не поддерживается в этом браузере — фон не будет отображаться.');
        return;
    }

    // Vertex shader (full-screen quad)
    const vertSrc = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
    `;

    // Safe fragment shader (адаптирован, без динамической индексации)
    const fragSrc = `
    precision mediump float;
    varying vec2 vUv;
    uniform vec3 iResolution;
    uniform float iTime;
    uniform vec4 iMouse;

    #define S(a,b,t) smoothstep(a,b,t)
    #define NUM_LAYERS 3.0

    float N21(vec2 p){
        vec3 a = fract(vec3(p.xyx)*vec3(613.897,553.453,80.098));
        a += dot(a,a.yzx+88.76);
        return fract((a.x+a.y)*a.z);
    }

    vec2 GetPos(vec2 id, vec2 offs, float t){
        float n = N21(id+offs);
        float n1 = fract(n*0.7);
        float n2 = fract(n*79.7);
        float a = t+n;
        return offs + vec2(sin(a*n1), cos(a*n2))*0.5;
    }

    float df_line(vec2 a, vec2 b, vec2 p){
        vec2 pa = p - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
        return length(pa - ba*h);
    }

    float line(vec2 a, vec2 b, vec2 uv){
        float r1 = 0.005;
        float r2 = 0.0001;
        float d = df_line(a,b,uv);
        float d2 = length(a-b);
        float fade = S(0.005,0.05,d2);
        fade += S(0.0005,0.0002,abs(d2-0.025));
        return S(r1,r2,d)*fade;
    }

    float NetLayer(vec2 st, float n, float t){
        vec2 id = floor(st)+n;
        st = fract(st)-0.5;

        // явно вычисляем 9 точек (чтобы избежать динамической индексации)
        vec2 p0 = GetPos(id, vec2(-1.0,-1.0), t);
        vec2 p1 = GetPos(id, vec2( 0.0,-1.0), t);
        vec2 p2 = GetPos(id, vec2( 1.0,-1.0), t);
        vec2 p3 = GetPos(id, vec2(-1.0, 0.0), t);
        vec2 p4 = GetPos(id, vec2( 0.0, 0.0), t);
        vec2 p5 = GetPos(id, vec2( 1.0, 0.0), t);
        vec2 p6 = GetPos(id, vec2(-1.0, 1.0), t);
        vec2 p7 = GetPos(id, vec2( 0.0, 1.0), t);
        vec2 p8 = GetPos(id, vec2( 1.0, 1.0), t);

        // Массив для удобства чтения (индексация в цикле с константным индексом int i)
        vec2 pts0 = p0;
        vec2 pts1 = p1;
        vec2 pts2 = p2;
        vec2 pts3 = p3;
        vec2 pts4 = p4;
        vec2 pts5 = p5;
        vec2 pts6 = p6;
        vec2 pts7 = p7;
        vec2 pts8 = p8;

        float m = 0.0;
        float sparkle = 0.0;

        // Перебираем вручную — это работает стабильно
        {
            vec2 p = pts0;
            m += line(p4,p,st);
            float d = length(st - p);
            float s = 0.002/(d*d + 0.0001);
            s *= S(1.0,0.1,d);
            float pulse = sin((fract(p.x)+fract(p.y)+t)*5.0)*0.4+0.6;
            pulse = pow(pulse,20.0);
            s *= pulse;
            sparkle += s;
        }
        {
            vec2 p = pts1;
            m += line(p4,p,st);
            float d = length(st - p);
            float s = 0.002/(d*d + 0.0001);
            s *= S(1.0,0.1,d);
            float pulse = sin((fract(p.x)+fract(p.y)+t)*5.0)*0.4+0.6;
            pulse = pow(pulse,20.0);
            s *= pulse;
            sparkle += s;
        }
        {
            vec2 p = pts2;
            m += line(p4,p,st);
            float d = length(st - p);
            float s = 0.002/(d*d + 0.0001);
            s *= S(1.0,0.1,d);
            float pulse = sin((fract(p.x)+fract(p.y)+t)*5.0)*0.4+0.6;
            pulse = pow(pulse,20.0);
            s *= pulse;
            sparkle += s;
        }
        {
            vec2 p = pts3;
            m += line(p4,p,st);
            float d = length(st - p);
            float s = 0.002/(d*d + 0.0001);
            s *= S(1.0,0.1,d);
            float pulse = sin((fract(p.x)+fract(p.y)+t)*5.0)*0.4+0.6;
            pulse = pow(pulse,20.0);
            s *= pulse;
            sparkle += s;
        }
        {
            vec2 p = pts4;
            m += line(p4,p,st);
            float d = length(st - p);
            float s = 0.002/(d*d + 0.0001);
            s *= S(1.0,0.1,d);
            float pulse = sin((fract(p.x)+fract(p.y)+t)*5.0)*0.4+0.6;
            pulse = pow(pulse,20.0);
            s *= pulse;
            sparkle += s;
        }
        {
            vec2 p = pts5;
            m += line(p4,p,st);
            float d = length(st - p);
            float s = 0.002/(d*d + 0.0001);
            s *= S(1.0,0.1,d);
            float pulse = sin((fract(p.x)+fract(p.y)+t)*5.0)*0.4+0.6;
            pulse = pow(pulse,20.0);
            s *= pulse;
            sparkle += s;
        }
        {
            vec2 p = pts6;
            m += line(p4,p,st);
            float d = length(st - p);
            float s = 0.002/(d*d + 0.0001);
            s *= S(1.0,0.1,d);
            float pulse = sin((fract(p.x)+fract(p.y)+t)*5.0)*0.4+0.6;
            pulse = pow(pulse,20.0);
            s *= pulse;
            sparkle += s;
        }
        {
            vec2 p = pts7;
            m += line(p4,p,st);
            float d = length(st - p);
            float s = 0.002/(d*d + 0.0001);
            s *= S(1.0,0.1,d);
            float pulse = sin((fract(p.x)+fract(p.y)+t)*5.0)*0.4+0.6;
            pulse = pow(pulse,20.0);
            s *= pulse;
            sparkle += s;
        }
        {
            vec2 p = pts8;
            m += line(p4,p,st);
            float d = length(st - p);
            float s = 0.002/(d*d + 0.0001);
            s *= S(1.0,0.1,d);
            float pulse = sin((fract(p.x)+fract(p.y)+t)*5.0)*0.4+0.6;
            pulse = pow(pulse,20.0);
            s *= pulse;
            sparkle += s;
        }

        m += line(p1,p3,st);
        m += line(p1,p5,st);
        m += line(p7,p5,st);
        m += line(p7,p3,st);

        float sPhase = (sin(t + n) + sin(t * 0.1)) * 0.25 + 0.5;
        sPhase += pow(sin(t * 0.1) * 0.5 + 0.5, 50.0) * 5.0;
        m += sparkle * sPhase;

        return m;
    }

    void main(){
        vec2 fragCoord = vUv * iResolution.xy;
        vec2 uv = (fragCoord - iResolution.xy * 0.5) / iResolution.y;
        vec2 M = iMouse.xy / iResolution.xy - 0.5;
        float t = iTime * 0.0005;

        float s = sin(t);
        float c = cos(t);
        mat2 rot = mat2(c, -s, s, c);
        vec2 st = uv * rot;
        M *= rot;

        float m = 0.0;
        for(float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYERS){
            float z = fract(t + i);
            float size = mix(15.0, 0.0, z);
            float fade = S(0.0, 0.006, z) * S(0.0, 0.08, z);
            m += fade * NetLayer(st * size - M * z, i, iTime);
        }

        vec3 baseCol = vec3(s, cos(t * 0.1), -sin(t * 0.14)) * 0.1 + 0.1;
        vec3 col = baseCol * m;
        col *= 1.0 - dot(uv, uv);
        col *= 2.0;
        col += vec3(0.05, 0.05, 0.08);
        gl_FragColor = vec4(col, 1.0);
    }
    `;

    function compileShader(src, type) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(sh));
            // не печатаем очень длинный шейдер полностью — только короткий превью
            console.log('--- shader preview ---\n' + src.slice(0, 500) + '\n--- end preview ---');
            gl.deleteShader(sh);
            return null;
        }
        return sh;
    }

    const v = compileShader(vertSrc, gl.VERTEX_SHADER);
    const f = compileShader(fragSrc, gl.FRAGMENT_SHADER);
    if (!v || !f) return;

    const program = gl.createProgram();
    gl.attachShader(program, v);
    gl.attachShader(program, f);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return;
    }
    gl.useProgram(program);

    // Fullscreen quad
    const posLoc = gl.getAttribLocation(program, 'aPosition');
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    const uniRes = gl.getUniformLocation(program, 'iResolution');
    const uniTime = gl.getUniformLocation(program, 'iTime');
    const uniMouse = gl.getUniformLocation(program, 'iMouse');

    // Resize handling
    function resizeCanvas() {
        const dpr = 0.5 * (window.devicePixelRatio || 1);
        const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
        const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            gl.viewport(0, 0, width, height);
        }
    }

    function fitCanvas() {
        // canvas styled in CSS to cover; ensure pixel size matches
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        resizeCanvas();
    }
    fitCanvas();
    window.addEventListener('resize', () => { fitCanvas(); });

    // Mouse handling (uniform coords in pixels)
    let mouseX = 0, mouseY = 0, clickX = 0, clickY = 0;
    window.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        mouseX = (e.clientX - rect.left) * dpr;
        // flip Y to match shader coordinate scheme
        mouseY = (rect.height - (e.clientY - rect.top)) * dpr;
    });
    window.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        clickX = (e.clientX - rect.left) * dpr;
        clickY = (rect.height - (e.clientY - rect.top)) * dpr;
    });
    window.addEventListener('mouseup', () => { /* keep last click */ });

    // Animation loop
    let startTime = performance.now();
    let lastFrame = 0;
function render(now) {
    resizeCanvas();
    const delta = now - lastFrame;

    // 🔧 ограничиваем FPS до ~30 (1000 мс / 30 ≈ 33)
    if (delta < 33) {
        requestAnimationFrame(render);
        return;
    }
    lastFrame = now;

    const t = now - startTime;

    if (uniRes) gl.uniform3f(uniRes, canvas.width, canvas.height, 0.0);
    gl.uniform1f(uniTime, t * 0.001);
    if (uniMouse) gl.uniform4f(uniMouse, mouseX, mouseY, clickX, clickY);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}

    requestAnimationFrame(render);
})();

// ----------------------
// ЧАСТЬ B: Original site logic (login / boot / terminal)
// ----------------------

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
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', function() {
            console.log('Кнопка запуска нажата');
            startBootSequence();
        });
    }
});

function startBootSequence() {
    console.log('Запуск последовательности загрузки');
    const startScreen = document.getElementById('start-screen');
    const bootScreen = document.getElementById('boot-screen');
    if (startScreen) startScreen.classList.add('hidden');
    if (bootScreen) bootScreen.classList.remove('hidden');

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
    const bootScreen = document.getElementById('boot-screen');
    const loginScreen = document.getElementById('login-screen');
    if (bootScreen) bootScreen.classList.add('hidden');
    if (loginScreen) loginScreen.classList.remove('hidden');
    const username = document.getElementById('username');
    if (username) username.focus();
}

// Обработка логина
const loginBtn = document.getElementById('login-btn');
if (loginBtn) loginBtn.addEventListener('click', login);
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') login();
});

function login() {
    const usernameEl = document.getElementById('username');
    const passwordEl = document.getElementById('password');
    const errorElement = document.getElementById('login-error');

    const username = usernameEl ? usernameEl.value : '';
    const password = passwordEl ? passwordEl.value : '';

    console.log('=== ПОПЫТКА ВХОДА ===');

    const isUsernameMatch = username === VALID_CREDENTIALS.username;
    const isPasswordMatch = password === VALID_CREDENTIALS.password;

    if (isUsernameMatch && isPasswordMatch) {
        console.log('✅ УСПЕШНЫЙ ВХОД!');
        if (errorElement) {
            errorElement.textContent = 'ДОСТУП РАЗРЕШЁН';
            errorElement.style.color = '#00FF41';
            errorElement.classList.remove('hidden');
        }

        document.body.style.transition = 'opacity 0.8s ease-in-out';
        document.body.style.opacity = '0';
        setTimeout(() => {
            window.location.href = 'terminal.html';
        }, 800);
    } else {
        console.log('❌ ОШИБКА ВХОДА!');
        if (errorElement) {
            errorElement.textContent = 'ДОСТУП ЗАПРЕЩЁН';
            errorElement.style.color = '#ff0000';
            errorElement.classList.remove('hidden');
        }
        if (passwordEl) passwordEl.value = '';
        if (document.getElementById('username')) document.getElementById('username').focus();
    }
}
