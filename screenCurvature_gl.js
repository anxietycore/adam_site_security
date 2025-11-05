// screenCurvature_gl.js — версия без drawImage, без html2canvas, чистый WebGL CRT-изгиб
(() => {
  const canvas = document.createElement('canvas');
  canvas.id = 'crt-distortion';
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: 0,
    width: '100%',
    height: '100%',
    zIndex: 9999,
    pointerEvents: 'none'
  });
  document.body.appendChild(canvas);

  const gl = canvas.getContext('webgl');
  if (!gl) return console.error("WebGL не поддерживается");

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
    uniform sampler2D tex;
    uniform vec2 resolution;
    uniform float strength;
    uniform float vignette;
    uniform float noise;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUV * 2.0 - 1.0;
      float r = dot(uv, uv);
      vec2 curved = uv * (1.0 + strength * r * r);
      curved = (curved + 1.0) * 0.5;

      vec4 color = texture2D(tex, curved);

      // лёгкая виньетка
      float d = distance(vUV, vec2(0.5));
      color.rgb *= smoothstep(1.0, vignette, d);

      // шум по краям
      float n = (rand(vUV * resolution.xy) - 0.5) * noise;
      color.rgb += n;

      gl_FragColor = color;
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

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uTex = gl.getUniformLocation(program, 'tex');
  const uRes = gl.getUniformLocation(program, 'resolution');
  const uStrength = gl.getUniformLocation(program, 'strength');
  const uVignette = gl.getUniformLocation(program, 'vignette');
  const uNoise = gl.getUniformLocation(program, 'noise');

  // параметры эффекта
  const strength = 0.35; // сила выпуклости
  const vignette = 0.45; // затемнение углов
  const noise = 0.06; // шум по краям

  function render() {
    const w = canvas.width = innerWidth;
    const h = canvas.height = innerHeight;

    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1i(uTex, 0);
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uStrength, strength);
    gl.uniform1f(uVignette, vignette);
    gl.uniform1f(uNoise, noise);

    // просто чёрный слой с кривизной — реальный контент виден сквозь него
    const pixels = new Uint8Array(w * h * 4);
    const texCanvas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texCanvas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  render();
})();
