// screenCurvature_gl.js
// CRT curvature overlay with full debug logs and no visual duplication.
// Original terminal remains interactive but invisible.

(() => {
  console.group("CRTOverlay init");

  const FPS = 18;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.30;
  const SMOOTH = true;

  // === locate elements ===
  const terminal = document.querySelector('#terminal') || document.querySelector('.terminal');
  const glass = document.querySelector('#glassFX');
  const mapCanvas = document.querySelector('canvas[style*="right:"]') || null;
  console.log("Found elements:", { terminal, glass, mapCanvas });

  if (!terminal) {
    console.error("❌ Terminal not found!");
    console.groupEnd();
    return;
  }

  // === overlay canvas ===
  const out = document.createElement('canvas');
  out.id = 'curvatureOverlay';
  Object.assign(out.style, {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 9999,
    pointerEvents: 'none',
    background: 'transparent'
  });
  document.body.appendChild(out);
  console.log("Overlay canvas created.");

  // === offscreen ===
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: true });
  console.log("Offscreen canvas created:", off);

  // === webgl init ===
  const gl = out.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) {
    console.error("WebGL not supported!");
    console.groupEnd();
    return;
  }

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
      vec2 distorted = mix(uv, uv * r, uDist);
      vec2 finalUV = (distorted + 1.0) * 0.5;
      finalUV.y = 1.0 - finalUV.y;
      gl_FragColor = texture2D(uTex, clamp(finalUV, 0.0, 1.0));
    }
  `;

  function compile(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error(gl.getShaderInfoLog(s));
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
  gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    console.error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  console.log("WebGL program linked.");

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
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, SMOOTH ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, SMOOTH ? gl.LINEAR : gl.NEAREST);

  const uDist = gl.getUniformLocation(prog, 'uDist');
  gl.uniform1f(uDist, DISTORTION);

  // === resize ===
  function resize() {
    out.width = Math.floor(window.innerWidth * DPR);
    out.height = Math.floor(window.innerHeight * DPR);
    off.width = out.width;
    off.height = out.height;
    gl.viewport(0, 0, out.width, out.height);
    console.log("Resize:", out.width, out.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // === hide original visually, but keep interaction ===
  terminal.style.opacity = "0";
  terminal.style.pointerEvents = "auto";
  terminal.style.position = "relative";
  console.log("Terminal made invisible but active.");

  // === render ===
  const ctx = offCtx;
  const frameTime = 1000 / FPS;
  let last = 0;

  function drawTerminal() {
    ctx.clearRect(0, 0, off.width, off.height);
    const scale = DPR;
    ctx.font = `${14 * scale}px "Press Start 2P", monospace`;
    ctx.textBaseline = 'top';
    let y = 10 * scale;

    terminal.querySelectorAll('*').forEach(el => {
      const txt = el.textContent?.trim();
      if (!txt) return;
      ctx.fillStyle = getComputedStyle(el).color || '#00FF41';
      ctx.fillText(txt, 10 * scale, y);
      y += 16 * scale;
    });

    // degradation box
    const deg = Array.from(document.querySelectorAll('div'))
      .find(d => /(дегра|degra|degrad)/i.test(d.innerText || ''));
    if (deg) {
      const r = deg.getBoundingClientRect();
      ctx.strokeStyle = '#00FF41';
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(r.left * DPR, r.top * DPR, r.width * DPR, r.height * DPR);
    }

    // minimap
    if (mapCanvas) {
      const r = mapCanvas.getBoundingClientRect();
      ctx.drawImage(mapCanvas, r.left * DPR, r.top * DPR, r.width * DPR, r.height * DPR);
    }
  }

  function loop(ts) {
    if (ts - last >= frameTime) {
      drawTerminal();

      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);

      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      last = ts;
    }
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // === API ===
  window.__CRTOverlay = {
    setDistortion(v){ gl.uniform1f(uDist, v); },
    log(){ console.group("CRTOverlay state"); console.log({ out, off, gl, terminal, mapCanvas }); console.groupEnd(); }
  };

  console.groupEnd();
})();
