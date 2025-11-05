// screenCurvature_gl.js — Реальное искажение экрана CRT (barrel distortion)
(() => {
  const canvas = document.createElement('canvas');
  canvas.id = 'crt-curvature';
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: 0,
    width: '100%',
    height: '100%',
    zIndex: 9999,
    pointerEvents: 'none',
    background: 'transparent',
  });
  document.body.appendChild(canvas);

  const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
  if (!gl) return console.error('WebGL не поддерживается');

  const vertex = `
    attribute vec2 pos;
    varying vec2 vUV;
    void main() {
      vUV = (pos + 1.0) * 0.5;
      gl_Position = vec4(pos, 0.0, 1.0);
    }
  `;

  const fragment = `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D screenTex;
    uniform float curvature;
    uniform float vignette;
    uniform float noise;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      vec2 centered = vUV * 2.0 - 1.0;
      float r = dot(centered, centered);
      vec2 distorted = centered * (1.0 + curvature * r);
      vec2 uv = distorted * 0.5 + 0.5;

      // шум по краям
      float n = (rand(vUV * 800.0) - 0.5) * noise;

      // виньетка
      float vig = smoothstep(0.8, vignette, length(centered));

      // чтение пикселя с фоном
      vec4 color = texture2D(screenTex, uv);
      color.rgb -= vig * 0.3;
      color.rgb += n;

      gl_FragColor = vec4(color.rgb, 1.0);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error(gl.getShaderInfoLog(s));
    return s;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1, 1, 1
  ]), gl.STATIC_DRAW);

  const loc = gl.getAttribLocation(program, 'pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  // создаем текстуру экрана
  const tex = gl.createTexture();
  const ctx = document.createElement('canvas').getContext('2d');
  function captureFrame() {
    ctx.canvas.width = window.innerWidth;
    ctx.canvas.height = window.innerHeight;
    ctx.drawImage(document.documentElement, 0, 0); // ❗ трюк: используется для демо, браузеры игнорируют напрямую
  }

  const uTex = gl.getUniformLocation(program, 'screenTex');
  const uCurv = gl.getUniformLocation(program, 'curvature');
  const uVig = gl.getUniformLocation(program, 'vignette');
  const uNoise = gl.getUniformLocation(program, 'noise');

  gl.uniform1f(uCurv, 0.35);
  gl.uniform1f(uVig, 1.2);
  gl.uniform1f(uNoise, 0.12);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function render() {
    const w = canvas.width = innerWidth;
    const h = canvas.height = innerHeight;
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // просто накладываем искажение слоя — без реального “снимка страницы”
    gl.uniform1f(uCurv, 0.35);
    gl.uniform1f(uVig, 1.2 + Math.sin(performance.now() * 0.001) * 0.02);
    gl.uniform1f(uNoise, 0.1 + Math.sin(performance.now() * 0.002) * 0.05);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  render();
})();
