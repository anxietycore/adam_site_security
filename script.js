// script.js
// ВЕРСИЯ: интеграция шейдера (vanilla WebGL) + оригинальная логика A.D.A.M.

// ----------------------
// ЧАСТЬ A: WebGL background (vanilla)
// ----------------------
(() => {
    const canvas = document.getElementById('shader-canvas');
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

    // Fragment shader: адаптация твоего шейдера (с минимальными правками)
    const fragSrc = `
    precision highp float;
    varying vec2 vUv;
    uniform vec3 iResolution;
    uniform float iTime;
    uniform vec4 iMouse;

    #define S(a, b, t) smoothstep(a, b, t)
    #define NUM_LAYERS 4.

    float N21(vec2 p) {
        vec3 a = fract(vec3(p.xyx) * vec3(613.897, 553.453, 80.098));
        a += dot(a, a.yzx + 88.76);
        return fract((a.x + a.y) * a.z);
    }

    vec2 GetPos(vec2 id, vec2 offs, float t) {
        float n = N21(id+offs);
        float n1 = fract(n*0.7);
        float n2 = fract(n*79.7);
        float a = t+n;
        return offs + vec2(sin(a*n1), cos(a*n2))*0.5;
    }

    float df_line( in vec2 a, in vec2 b, in vec2 p)
    {
        vec2 pa = p - a, ba = b - a;
        float h = clamp(dot(pa,ba) / dot(ba,ba), 0., 1.);    
        return length(pa - ba * h);
    }

    float line(vec2 a, vec2 b, vec2 uv) {
        float r1 = 0.005;
        float r2 = .0001;

        float d = df_line(a, b, uv);
        float d2 = length(a-b);
        float fade = S(0.005, .05, d2);

        fade += S(.0005, .0002, abs(d2-.025));
        return S(r1, r2, d)*fade;
    }

    float NetLayer(vec2 st, float n, float t) {
        vec2 id = floor(st)+n;

        st = fract(st)-.5;

        vec2 p[9];
        int i=0;
        for(float y=-1.; y<=1.; y++) {
            for(float x=-1.; x<=1.; x++) {
                p[i++] = GetPos(id, vec2(x,y), t);
            }
        }

        float m = 0.;
        float sparkle = 0.;

        for(int i=0; i<9; i++) {
            m += line(p[4], p[i], st);

            float d = length(st-p[i]);

            float s = (.002/(d*d));
            s *= S(1., .1, d);
            float pulse = sin((fract(p[i].x)+fract(p[i].y)+t)*5.)*.4+.6;
            pulse = pow(pulse, 20.);

            s *= pulse;
            sparkle += s;
        }

        m += line(p[1], p[3], st);
        m += line(p[1], p[5], st);
        m += line(p[7], p[5], st);
        m += line(p[7], p[3], st);

        float sPhase = (sin(t+n)+sin(t*.1))*.25+.5;
        sPhase += pow(sin(t*.1)*.5+.5, 50.)*5.;
        m += sparkle*sPhase;

        return m;
    }

    void main() {
        vec2 fragCoord = vUv * iResolution.xy;
        vec2 uv = (fragCoord-iResolution.xy*.5)/iResolution.y;
        vec2 M = iMouse.xy / iResolution.xy - .5;

        float t = iTime * .0005;

        float s = sin(t);
        float c = cos(t);
        mat2 rot = mat2(c, -s, s, c);
        vec2 st = uv*rot;  
        M *= rot*1.;

        float m = 0.;
        for(float i=0.; i<1.; i+=1./NUM_LAYERS) {
            float z = fract(t+i);
            float size = mix(15., .0, z);
            float fade = S(0., .006, z)*S(0., .08, z);

            m += fade * NetLayer(st*size-M*z, i, iTime);
        }

        // fft из iChannel0 был в оригинале — здесь отключаем, ставим 0.
        float fft = 0.0;
        float glow = -uv.y*fft*2.;

        vec3 baseCol = vec3(s, cos(t*.1), -sin(t*.14))*.1+.1;
        vec3 col = baseCol*m;
        col += baseCol*glow;

        col *= 1.-dot(uv,uv);
        t = mod(iTime, 330.);

        // Небольшая мягкая контрастная подстройка
        col *= S(0., 20., t)*S(224., 100., t);

        gl_FragColor = vec4(col,1.0);
    }
    `;

    function compileShader(src, type) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(sh));
            console.log('Source:\n', src);
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
    // two triangles forming full screen quad
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
        const dpr = window.devicePixelRatio || 1;
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
    // Keep canvas covering whole window
    function fitCanvas() {
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        resizeCanvas();
    }
    fitCanvas();
    window.addEventListener('resize', () => { fitCanvas(); });

    // Mouse handling
    let mouseX = 0, mouseY = 0, clickX = 0, clickY = 0;
    window.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) * (window.devicePixelRatio || 1);
        mouseY = (rect.height - (e.clientY - rect.top)) * (window.devicePixelRatio || 1); // flip y to match shader coords
    });
    window.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        clickX = (e.clientX - rect.left) * (window.devicePixelRatio || 1);
        clickY = (rect.height - (e.clientY - rect.top)) * (window.devicePixelRatio || 1);
    });
    window.addEventListener('mouseup', () => {
        // if you want click to reset, uncomment:
        // clickX = clickY = 0;
    });

    // Animation loop
    let startTime = performance.now();
    function render(now) {
        resizeCanvas();
        const t = now - startTime;

        // set uniforms
        gl.uniform3f(uniRes, canvas.width, canvas.height, 0.0);
        gl.uniform1f(uniTime, t);
        gl.uniform4f(uniMouse, mouseX, mouseY, clickX, clickY);

        // draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// ----------------------
// ЧАСТЬ B: ORIGINAl site logic (login / boot / terminal)
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
const loginBtn = document.getElementById('login-btn');
if (loginBtn) loginBtn.addEventListener('click', login);
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
        // ОШИБКА - просто показываем ошибку
        errorElement.textContent = 'ДОСТУП ЗАПРЕЩЁН';
        errorElement.style.color = '#ff0000';
        errorElement.classList.remove('hidden');

        document.getElementById('password').value = '';
        document.getElementById('username').focus();
    }
}
