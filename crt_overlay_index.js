// crt_overlay_safe.js — безопасный изгиб для index.html
// НЕ клонирует DOM, НЕ создаёт дубликаты

(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const DISTORTION = 0.28;

  // Создаём overlay поверх всего
  const overlay = document.createElement('canvas');
  overlay.id = 'crtOverlayCanvas';
  Object.assign(overlay.style, {
    position: 'fixed',
    left: '0', top: '0',
    width: '100%', height: '100%',
    zIndex: '1000',
    pointerEvents: 'none', // не блокирует клики
    mixBlendMode: 'normal'
  });
  document.body.appendChild(overlay);

  const gl = overlay.getContext('webgl', { antialias: false });
  if (!gl) return;

  // Шейдеры
  const vs = `
    attribute vec2 aPos;
    attribute vec2 aUV;
    varying vec2 vUV;
    void main() {
      vUV = aUV;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const fs = `
    precision mediump float;
    varying vec2 vUV;
    uniform float uDist;
    
    void main() {
      vec2 uv = vUV * 2.0 - 1.0;
      float r = length(uv);
      vec2 distorted = mix(uv, uv * r, uDist);
      vec2 finalUV = (distorted + 1.0) * 0.5;
      finalUV.y = 1.0 - finalUV.y;
      gl_FragColor = vec4(0.0, finalUV.x, finalUV.y, 0.08); // прозрачный
    }
  `;

  function compile(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
  gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const quad = new Float32Array([
    -1, -1, 0, 0,
     1, -1, 1, 0,
    -1,  1, 0, 1,
     1,  1, 1, 1
  ]);
  
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, 'aPos');
  const aUV = gl.getAttribLocation(prog, 'aUV');
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);

  gl.uniform1f(gl.getUniformLocation(prog, 'uDist'), DISTORTION);

  function resize() {
    overlay.width = Math.floor(window.innerWidth * DPR);
    overlay.height = Math.floor(window.innerHeight * DPR);
    gl.viewport(0, 0, overlay.width, overlay.height);
  }
  window.addEventListener('resize', resize);
  resize();

  function render() {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  render();
})();
