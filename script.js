// script.js — МИНИМАЛЬНЫЙ ТЕСТ
function initCurvedShaderBackground() {
  const canvas = document.getElementById('shader-canvas');
  const gl = canvas.getContext('webgl');
  if (!gl) return console.error('WebGL not supported');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const vsSrc = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = (aPos + 1.0) * 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const fsSrc = `
    precision mediump float;
    varying vec2 vUv;
    uniform vec2 uRes;
    uniform float uTime;

    void main() {
      vec2 uv = vUv * 2.0 - 1.0;
      uv.x *= uRes.x / uRes.y;
      
      // === СИЛЬНЫЙ ИЗГИБ (должно быть ОЧЕВИДНО) ===
      float r = length(uv);
      uv *= 1.0 + 0.8 * r; // 0.8 = очень сильный эффект
      
      vec2 f = (uv / vec2(uRes.x/uRes.y, 1.0) + 1.0) * 0.5;
      
      // Простой красный цвет для теста
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
  `;

  function compile(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(vsSrc, gl.VERTEX_SHADER));
  gl.attachShader(prog, compile(fsSrc, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(gl.getAttribLocation(prog, 'aPos'));
  gl.vertexAttribPointer(gl.getAttribLocation(prog, 'aPos'), 2, gl.FLOAT, false, 0, 0);

  gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.width, canvas.height);

  function loop(now) {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

initCurvedShaderBackground();
