// screenCurvature_gl.js — CRT curvature overlay (финальная версия)
(() => {
  const canvas = document.createElement('canvas');
  canvas.id = 'crt-distortion';
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: 0,
    width: '100%',
    height: '100%',
    zIndex: 9999,
    pointerEvents: 'none',
    background: 'transparent'
  });
  document.body.appendChild(canvas);

  const gl = canvas.getContext('webgl', { alpha: true });
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
    uniform float strength;
    uniform float vignette;
    uniform float noise;

    // генератор шума
    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUV * 2.0 - 1.0;
      float r = dot(uv, uv);
      vec2 curved = uv * (1.0 + strength * r * r);
      curved = (curved + 1.0) * 0.5;

      // прозрачность + виньетка
      float edge = smoothstep(0.9, vignette, length(uv));
      float n = (rand(vUV * 800.0) - 0.5) * noise;

      vec3 tint = vec3(0.0, 1.0, 0.5); // зелёный оттенок по краям
      gl_FragColor = vec4(tint * (1.0 - edge + n * 0.4), 0.22); // альфа-прозрачный слой
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
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uStrength = gl.getUniformLocation(program, 'strength');
  const uVignette = gl.getUniformLocation(program, 'vignette');
  const uNoise = gl.getUniformLocation(program, 'noise');

  function render() {
    const w = canvas.width = innerWidth;
    const h = canvas.height = innerHeight;

    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1f(uStrength, 0.35);  // сила выпуклости
    gl.uniform1f(uVignette, 1.4);   // плавное затемнение по краям
    gl.uniform1f(uNoise, 0.18);     // шум по краям

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  render();
})();
