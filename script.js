// script.js — ОТЛАДОЧНАЯ ВЕРСИЯ С КОНСОЛЬЮ
const VALID_CREDENTIALS = { username: "qq", password: "ww" };

document.addEventListener('DOMContentLoaded', () => {
  console.log("✅ script.js загружен!");
  let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
  localStorage.setItem('adam_visits', ++visits);

  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.addEventListener('click', startBootSequence);

  console.log("🚀 Запускаем шейдер...");
  initCurvedShaderBackground();
});

// ... (весь остальной код остается таким же, как в предыдущей версии) ...

function initCurvedShaderBackground() {
  const canvas = document.getElementById('shader-canvas');
  if (!canvas) {
    console.error("❌ Canvas #shader-canvas не найден!");
    return;
  }

  console.log("✅ Canvas найден, инициализируем WebGL...");

  Object.assign(canvas.style, {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 0,
  });

  const gl = canvas.getContext('webgl', { antialias: false });
  if (!gl) {
    console.error('❌ WebGL не поддерживается');
    return;
  }

  console.log("✅ WebGL контекст получен");

  const vsSrc = `...`; // (оставь твой вершинный шейдер)

  const fsSrc = `
    precision mediump float;
    varying vec2 vUv;
    uniform vec2 uRes;
    uniform float uTime;

    float hash(vec2 p){return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
      vec2 i=floor(p), f=fract(p);
      float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
      vec2 u=f*f*(3.0-2.0*f);
      return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
    }
    float fbm(vec2 p){
      float v=0.0,a=0.5;
      for(int i=0;i<5;i++){v+=a*noise(p);p*=2.0;a*=0.5;}
      return v;
    }

    void main() {
      vec2 uv = vUv * 2.0 - 1.0;
      float aspect = uRes.x/uRes.y;
      uv.x *= aspect;
      
      // === ИЗГИБ КАК В ТЕРМИНАЛЕ ===
      float r = dot(uv, uv);
      uv *= 1.0 + 0.32 * r;
      
      vec2 f = (uv/vec2(aspect,1.0) + 1.0) * 0.5;
      float t = uTime * 0.12;
      float n = fbm(f*6.0 + vec2(t, t*0.5));
      float v = smoothstep(1.0,0.45,length(uv));
      vec3 col = vec3(0.01,0.02,0.015) + vec3(0.0,0.8,0.1)*pow(n,2.0)*0.7;
      col *= 0.5 + 0.5 * v;
      gl_FragColor = vec4(pow(col, vec3(0.9)),1.0);
    }
  `;

  function compile(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('❌ Shader compile error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(vsSrc, gl.VERTEX_SHADER);
  const fs = compile(fsSrc, gl.FRAGMENT_SHADER);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('❌ Program link error:', gl.getProgramInfoLog(prog));
    return;
  }
  
  console.log("✅ Шейдер скомпилирован успешно!");

  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
    console.log(`📐 Resize: ${w}x${h}`);
  }
  window.addEventListener('resize', resize);
  resize();

  let start = performance.now();
  function loop(now) {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  console.log("✅ Анимация шейдера запущена!");
}
