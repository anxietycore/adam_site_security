// screenCurvature_gl.js — финальная версия без html2canvas
(() => {
  const canvas = document.createElement('canvas');
  canvas.id = 'crt-screen';
  Object.assign(canvas.style, {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 9999,
    pointerEvents: 'none'
  });
  document.body.appendChild(canvas);

  const gl = canvas.getContext('webgl');
  const vertex = `
    attribute vec2 pos;
    varying vec2 uv;
    void main() {
      uv = (pos + 1.0) * 0.5;
      gl_Position = vec4(pos, 0.0, 1.0);
    }
  `;

  const fragment = `
    precision mediump float;
    varying vec2 uv;
    uniform sampler2D scene;
    uniform vec2 resolution;
    uniform float strength;
    uniform float noiseAmount;
    uniform float vignette;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      // преобразуем координаты в [-1,1]
      vec2 p = uv * 2.0 - 1.0;
      float r = length(p);
      // создаём выпуклость
      vec2 curved = p * (1.0 + strength * r * r);
      curved = (curved + 1.0) * 0.5;

      // текстура фона
      vec4 col = texture2D(scene, curved);

      // виньетка
      float dist = distance(uv, vec2(0.5));
      col.rgb *= smoothstep(1.0, vignette, dist);

      // шум по краям
      float n = (rand(uv * resolution.xy) - 0.5) * noiseAmount;
      col.rgb += n;

      gl_FragColor = col;
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uScene = gl.getUniformLocation(program, 'scene');
  const uRes = gl.getUniformLocation(program, 'resolution');
  const uStrength = gl.getUniformLocation(program, 'strength');
  const uNoise = gl.getUniformLocation(program, 'noiseAmount');
  const uVignette = gl.getUniformLocation(program, 'vignette');

  let strength = 0.25;
  let noiseAmount = 0.08;
  let vignette = 0.3;

  const ctx2d = document.createElement('canvas').getContext('2d');
  function render() {
    const w = canvas.width = innerWidth;
    const h = canvas.height = innerHeight;
    ctx2d.canvas.width = w;
    ctx2d.canvas.height = h;
    ctx2d.drawImage(document.documentElement, 0, 0, w, h);

    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1i(uScene, 0);
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uStrength, strength);
    gl.uniform1f(uNoise, noiseAmount);
    gl.uniform1f(uVignette, vignette);

    const img = ctx2d.canvas;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  render();
})();
