// screenCurvature_gl.js — Real CRT curvature + edge noise (final stable)
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
    mixBlendMode: 'overlay'
  });
  document.body.appendChild(canvas);

  const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
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
    uniform float curvature;
    uniform float vignette;
    uniform float noiseAmount;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUV * 2.0 - 1.0;

      // выпуклость
      float r = dot(uv, uv);
      uv *= 1.0 + curvature * r;

      // затемнение по краям (виньетка)
      float edge = smoothstep(0.7, vignette, length(uv));

      // шум
      float n = (rand(vUV * 800.0) - 0.5) * noiseAmount;

      // полупрозрачный тёмный слой + шум
      float brightness = 1.0 - edge * 0.9 + n * 0.25;
      gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - brightness) * 0.45);
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
    -1,-1, 1,-1, -1,1, 1,1
  ]), gl.STATIC_DRAW);

  const loc = gl.getAttribLocation(program, 'pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uCurvature = gl.getUniformLocation(program, 'curvature');
  const uVignette = gl.getUniformLocation(program, 'vignette');
  const uNoise = gl.getUniformLocation(program, 'noiseAmount');

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function render() {
    const w = canvas.width = innerWidth;
    const h = canvas.height = innerHeight;
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1f(uCurvature, 0.35);   // сила выпуклости
    gl.uniform1f(uVignette, 1.3);     // края затемнения
    gl.uniform1f(uNoise, 0.2);        // шум по краям

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  render();
})();
