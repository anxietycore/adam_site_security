// script.js
// 2025-11-02 — Финальная оптимизированная версия: WebGL фон + логика A.D.A.M.

(() => {
    const canvas = document.getElementById('shader-canvas');
    if (!canvas) {
        console.warn('Canvas #shader-canvas не найден — фон не отображается.');
        return;
    }

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        console.warn('WebGL не поддерживается — фон отключён.');
        return;
    }

    // ---------- ВЕРШИННЫЙ ШЕЙДЕР ----------
    const vertSrc = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
    }
    `;

    // ---------- ФРАГМЕНТНЫЙ ШЕЙДЕР ----------
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

        vec2 p[9];
        p[0] = GetPos(id, vec2(-1.0,-1.0), t);
        p[1] = GetPos(id, vec2( 0.0,-1.0), t);
        p[2] = GetPos(id, vec2( 1.0,-1.0), t);
        p[3] = GetPos(id, vec2(-1.0, 0.0), t);
        p[4] = GetPos(id, vec2( 0.0, 0.0), t);
        p[5] = GetPos(id, vec2( 1.0, 0.0), t);
        p[6] = GetPos(id, vec2(-1.0, 1.0), t);
        p[7] = GetPos(id, vec2( 0.0, 1.0), t);
        p[8] = GetPos(id, vec2( 1.0, 1.0), t);

        float m = 0.0;
        float sparkle = 0.0;
        for (int i = 0; i < 9; i++) {
            vec2 pt = p[i];
            m += line(p[4], pt, st);
            float d = length(st - pt);
            float s = 0.002/(d*d + 0.0001);
            s *= S(1.0,0.1,d);
            float pulse = sin((fract(pt.x)+fract(pt.y)+t)*5.0)*0.4+0.6;
            pulse = pow(pulse,20.0);
            s *= pulse;
            sparkle += s;
        }

        m += line(p[1],p[3],st);
        m += line(p[1],p[5],st);
        m += line(p[7],p[5],st);
        m += line(p[7],p[3],st);

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

        // ✨ ЯРКОСТЬ УВЕЛИЧЕНА ×3
        vec3 baseCol = vec3(s, cos(t * 0.1), -sin(t * 0.14)) * 0.3 + 0.3;
        vec3 col = baseCol * m;
        col *= 1.0 - dot(uv, uv);
        col *= 2.0;
        col += vec3(0.12, 0.12, 0.15);
        gl_FragColor = vec4(col, 1.0);
    }
    `;

    // ---------- КОМПИЛЯЦИЯ ----------
    function compileShader(src, type) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(sh));
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

    // ---------- ПОЛНОЭКРАННЫЙ КВАД ----------
    const posLoc = gl.getAttribLocation(program, 'aPosition');
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1,  -1,  1,
        -1,  1,  1, -1,   1,  1
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // ---------- UNIFORMS ----------
    const uniRes = gl.getUniformLocation(program, 'iResolution');
    const uniTime = gl.getUniformLocation(program, 'iTime');
    const uniMouse = gl.getUniformLocation(program, 'iMouse');

    // ---------- ОПТИМИЗИРОВАННЫЙ resize ----------
    function resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
        const width = Math.floor(canvas.clientWidth * dpr);
        const height = Math.floor(canvas.clientHeight * dpr);
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            gl.viewport(0, 0, width, height);
        }
    }
    function fitCanvas() {
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        resizeCanvas();
    }
    fitCanvas();
    window.addEventListener('resize', fitCanvas);

    // ---------- МЫШЬ ----------
    let mouseX = 0, mouseY = 0, clickX = 0, clickY = 0;
    window.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        mouseX = (e.clientX - rect.left) * dpr;
        mouseY = (rect.height - (e.clientY - rect.top)) * dpr;
    });
    window.addEventListener('mousedown', e => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        clickX = (e.clientX - rect.left) * dpr;
        clickY = (rect.height - (e.clientY - rect.top)) * dpr;
    });

    // ---------- АНИМАЦИЯ (FPS ~30) ----------
    let startTime = performance.now();
    let lastFrame = 0;
    function render(now) {
        const delta = now - lastFrame;
        if (delta < 33) { requestAnimationFrame(render); return; } // ~30fps
        lastFrame = now;

        resizeCanvas();
        const t = now - startTime;

        gl.uniform3f(uniRes, canvas.width, canvas.height, 0.0);
        gl.uniform1f(uniTime, t * 0.001);
        gl.uniform4f(uniMouse, mouseX, mouseY, clickX, clickY);

        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// ==========================================================
// ЧАСТЬ B: ЛОГИКА САЙТА A.D.A.M.
// ==========================================================
const VALID_CREDENTIALS = { username: "qq", password: "ww" };

document.addEventListener('DOMContentLoaded', () => {
    let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
    localStorage.setItem('adam_visits', ++visits);
    console.log(\`Посещений A.D.A.M.: \${visits}\`);

    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', startBootSequence);
});

function startBootSequence() {
    const startScreen = document.getElementById('start-screen');
    const bootScreen = document.getElementById('boot-screen');
    if (startScreen) startScreen.classList.add('hidden');
    if (bootScreen) bootScreen.classList.remove('hidden');

    const bootTexts = document.querySelectorAll('#boot-screen .boot-text p');
    let i = 0;
    (function next() {
        if (i < bootTexts.length) {
            bootTexts[i++].style.opacity = 1;
            setTimeout(next, 1000);
        } else setTimeout(showLoginScreen, 1000);
    })();
}

function showLoginScreen() {
    document.getElementById('boot-screen')?.classList.add('hidden');
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('username')?.focus();
}

document.getElementById('login-btn')?.addEventListener('click', login);
document.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

function login() {
    const u = document.getElementById('username')?.value;
    const p = document.getElementById('password')?.value;
    const err = document.getElementById('login-error');

    if (u === VALID_CREDENTIALS.username && p === VALID_CREDENTIALS.password) {
        err.textContent = 'ДОСТУП РАЗРЕШЁН';
        err.style.color = '#00FF41';
        err.classList.remove('hidden');
        document.body.style.transition = 'opacity 0.8s ease-in-out';
        document.body.style.opacity = '0';
        setTimeout(() => window.location.href = 'terminal.html', 800);
    } else {
        err.textContent = 'ДОСТУП ЗАПРЕЩЁН';
        err.style.color = '#FF0000';
        err.classList.remove('hidden');
        document.getElementById('password').value = '';
        document.getElementById('username')?.focus();
    }
}
