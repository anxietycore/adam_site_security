// screenCurvature_gl.js — CRT изгиб для терминала A.D.A.M.
// работает как пост-эффект поверх страницы, без захвата DOM
(() => {
  const canvas = document.createElement('canvas');
  canvas.id = 'crt-curvature';
  Object.assign(canvas.style, {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 99,
    pointerEvents: 'none',
    mixBlendMode: 'screen'
  });
  document.body.appendChild(canvas);

  const gl = canvas.getContext('webgl');
  if (!gl) return console.error('WebGL not supported (CRT curvature)');

  // vertex shader — просто прямоугольник
  const vsSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // fragment shader — делает бочкообразное искажение и затемнение по краям
  const fsSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform float u_time;
    void main() {
      // переводим uv в диапазон [-1,1]
      vec2 uv = v_uv * 2.0 - 1.0;
      float r = length(uv);
      // коэффициенты изгиба
      float distortion = 0.15;
      uv *= 1.0 + distortion * r * r;
      vec2 warped = (uv + 1.0) * 0.5;

      // радиальная виньетка (затемнение по краям)
      float vignette = smoothstep(1.0, 0.4, r);
      // лёгкое пульсирующее свечение
      float glow = 0.02 * sin(u_time * 0.5) + 0.05;

      // CRT-сетка и шум
      float line = sin((warped.y + u_time * 0.2) * 600.0) * 0.04;
      float grain = fract(sin(dot(warped.xy * u_time, vec2(12.9898,78.233))) * 43758.5453);

      // цвет: зелёный с варьирующей прозрачностью
      vec3 color = vec3(0.0, 1.0, 0.25);
      float alpha = (1.0 - vignette) * 0.25 + line * 0.2 + grain * 0.05 + glow;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  // компиляция шейдеров
  function createShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  const vs = createShader(gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  const vertices = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
     1,  1,
  ]);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(program, 'u_time');

  function resize() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  function render(t) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uTime, t * 0.001);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
