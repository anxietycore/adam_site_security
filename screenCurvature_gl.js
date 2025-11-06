// screenCurvature_gl.js
// Minimal CRT curvature without observers or heavy loops.
// Safe: no duplication, no lag, scroll works.

(() => {
  const FPS = 10;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.3;
  const SMOOTH = true;

  const term = document.querySelector('#terminal');
  if (!term) return console.warn('No #terminal found.');

  const glass = document.querySelector('#glassFX');
  if (glass) glass.style.zIndex = '1';

  const out = document.createElement('canvas');
  Object.assign(out.style, {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    zIndex: 999,
    pointerEvents: 'none'
  });
  document.body.appendChild(out);

  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: true });

  const gl = out.getContext('webgl', { antialias: false });
  if (!gl) return console.error('WebGL not supported');

  const vs = `
    attribute vec2 aPos;
    attribute vec2 aUV;
    varying vec2 vUV;
    void main(){vUV=aUV;gl_Position=vec4(aPos,0.,1.);}
  `;
  const fs = `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uTex;
    uniform float uDist;
    void main(){
      vec2 uv=vUV*2.-1.;
      float r=length(uv);
      vec2 d=mix(uv,uv*r,uDist);
      vec2 f=(d+1.)*0.5;
      f.y=1.-f.y;
      gl_FragColor=texture2D(uTex,clamp(f,0.,1.));
    }
  `;
  function shader(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(vs, gl.VERTEX_SHADER));
  gl.attachShader(prog, shader(fs, gl.FRAGMENT_SHADER));
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
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, SMOOTH ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, SMOOTH ? gl.LINEAR : gl.NEAREST);
  const uDist = gl.getUniformLocation(prog, 'uDist');
  gl.uniform1f(uDist, DISTORTION);

  function resize() {
    out.width = window.innerWidth * DPR;
    out.height = window.innerHeight * DPR;
    off.width = out.width;
    off.height = out.height;
    gl.viewport(0, 0, out.width, out.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // hide visual terminal (still interactive)
  term.style.opacity = '0';
  term.style.pointerEvents = 'auto';

  function drawFrame() {
    offCtx.clearRect(0, 0, off.width, off.height);
    offCtx.fillStyle = '#000';
    offCtx.fillRect(0, 0, off.width, off.height);
    offCtx.scale(DPR, DPR);
    offCtx.fillStyle = '#00FF41';
    offCtx.font = '14px monospace';
    offCtx.textBaseline = 'top';

    let y = 10;
    term.querySelectorAll('.output, .command, .input-line, .prompt').forEach(el => {
      const text = el.textContent || '';
      offCtx.fillText(text, 10, y);
      y += 18;
    });
    offCtx.setTransform(1, 0, 0, 1, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  setInterval(drawFrame, 1000 / FPS);
})();
