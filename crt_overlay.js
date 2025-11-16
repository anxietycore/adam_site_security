// crt_overlay.js
// Simple WebGL overlay that warps terminalCanvas with barrel distortion.
// Place this <script> after terminal_canvas.js in your HTML.

(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.28; // tweak: 0 = no warp, 0.25..0.45 typical CRT look
  const FPS = 30;

  const src = document.getElementById('terminalCanvas');
  if (!src) {
    console.warn('crt_overlay: terminalCanvas not found — overlay disabled.');
    return;
  }

  const overlay = document.createElement('canvas');
  overlay.id = 'crtOverlayCanvas';
  Object.assign(overlay.style, {
    position: 'fixed', left: '0', top: '0', width: '100%', height: '100%',
    zIndex: 1000, pointerEvents: 'none'
  });
  document.body.appendChild(overlay);

  const gl = overlay.getContext('webgl', { antialias: false });
  if (!gl) { console.error('WebGL unavailable'); return; }

  function resize() {
    overlay.width = Math.floor(window.innerWidth * DPR);
    overlay.height = Math.floor(window.innerHeight * DPR);
    overlay.style.width = window.innerWidth + 'px';
    overlay.style.height = window.innerHeight + 'px';
    gl.viewport(0,0,overlay.width, overlay.height);
  }
  window.addEventListener('resize', resize);
  resize();

  const vs = `
    attribute vec2 aPos;
    attribute vec2 aUV;
    varying vec2 vUV;
    void main(){ vUV = aUV; gl_Position = vec4(aPos,0.0,1.0); }
  `;
  const fs = `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uTex;
    uniform float uDist;
    void main(){
      vec2 uv = vUV * 2.0 - 1.0;
      float r = length(uv);
      vec2 d = mix(uv, uv * r, uDist);
      vec2 f = (d + 1.0) * 0.5;
      f.y = 1.0 - f.y; // match canvas orientation
      vec4 c = texture2D(uTex, clamp(f, 0.0, 1.0));
      gl_FragColor = c;
    }
  `;

  function compile(src, type){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
  gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const quad = new Float32Array([
    -1,-1, 0,0,
     1,-1, 1,0,
    -1, 1, 0,1,
     1, 1, 1,1
  ]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, 'aPos');
  const aUV  = gl.getAttribLocation(prog, 'aUV');
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(aUV,  2, gl.FLOAT, false, 16, 8);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uDist = gl.getUniformLocation(prog, 'uDist');
  gl.uniform1f(uDist, DISTORTION);

  function updateTexture(){
    try {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    } catch (e) {
      // ignore
    }
  }

  let lastTick = 0;
  const frameTime = 1000 / FPS;
  function step(ts){
    if (!lastTick) lastTick = ts;
    if (ts - lastTick >= frameTime){
      lastTick = ts;
      updateTexture();
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  window.__CRTOverlay = {
    setDistortion(v){ if (uDist) gl.uniform1f(uDist, v); },
    destroy(){ overlay.remove(); }
  };
})();
