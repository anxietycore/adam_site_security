// screenCurvature_gl.js
// Live WebGL barrel-distortion of #terminal text. Draws terminal text into offscreen canvas,
// uploads as texture and warps in GPU with chroma + edge noise. Lightweight, updates only on change.

(() => {
  const term = document.getElementById('terminal');
  if (!term) { console.warn('crtGL: #terminal not found'); return; }

  // CONFIG (tweakable via window.crtGL.set({...}))
  const cfg = {
    strength: 0.7,        // 0..1.2 - distortion strength
    chroma: 6.0,          // px chromatic offset
    noiseAmount: 0.12,    // 0..0.5 - edge noise intensity
    vignette: 0.5,        // 0..1
    fontSize: 18,         // px for drawing text
    fontFamily: 'Courier New, monospace',
    color: '#00FF41',
    bg: 'rgba(0,0,0,0)',  // background for offscreen (we keep transparent)
    dprLimit: 1.5
  };

  // DPI
  const DPR = Math.min(window.devicePixelRatio || 1, cfg.dprLimit);

  // --- create full-screen WebGL canvas overlay ---
  const canvas = document.createElement('canvas');
  canvas.id = 'crt-gl-overlay';
  Object.assign(canvas.style, {
    position: 'fixed',
    left: '0', top: '0',
    width: '100%', height: '100%',
    pointerEvents: 'none',
    zIndex: 9999
  });
  document.body.appendChild(canvas);

  // get GL
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true });
  if (!gl) { console.error('crtGL: WebGL not available'); return; }

  // resize canvas
  function resizeGL() {
    const w = Math.floor(window.innerWidth * DPR);
    const h = Math.floor(window.innerHeight * DPR);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0,0,w,h);
    }
  }
  resizeGL();
  window.addEventListener('resize', resizeGL);

  // --- Offscreen 2D canvas for terminal texture ---
  const off = document.createElement('canvas');
  const octx = off.getContext('2d');
  function resizeOffscreen() {
    // size offscreen to terminal bounding box in CSS pixels * DPR
    const r = term.getBoundingClientRect();
    const w = Math.max(32, Math.floor(r.width * DPR));
    const h = Math.max(32, Math.floor(r.height * DPR));
    if (off.width !== w || off.height !== h) {
      off.width = w; off.height = h;
      // set smoothing off
      octx.imageSmoothingEnabled = false;
    }
    return { w,h, left: r.left, top: r.top, cssW: r.width, cssH: r.height };
  }

  // draw terminal content into offscreen canvas (we render text lines)
  function drawTerminalToOffscreen() {
    const { w, h } = resizeOffscreen();
    // clear
    octx.clearRect(0,0,w,h);
    // background transparent
    octx.fillStyle = cfg.bg;
    octx.fillRect(0,0,w,h);

    // set font scaled by DPR
    const fontPx = cfg.fontSize * DPR;
    octx.font = `${fontPx}px ${cfg.fontFamily}`;
    octx.textBaseline = 'top';
    octx.fillStyle = cfg.color;

    // We will take innerText lines — preserving newlines
    // If terminal uses <div class="output"> etc., better to read rendered text lines; we'll use textContent split by \n
    // Get visible text via computed style lines: simplest approach - use innerText which keeps visual line breaks
    const text = term.innerText || term.textContent || '';
    const lines = text.replace(/\r/g,'').split('\n');

    const lineHeight = Math.ceil(fontPx * 1.05);
    // draw each line: left padding ~ 8*DPR
    const padLeft = Math.max(6*DPR, Math.round(8*DPR));
    for (let i=0;i<lines.length;i++){
      const y = i * lineHeight + (4*DPR);
      // stop if overflow
      if (y > h) break;
      // draw shadow to simulate glow
      octx.fillStyle = 'rgba(0,40,0,0.0)';
      // main text
      octx.fillStyle = cfg.color;
      octx.fillText(lines[i], padLeft, y);
    }
    // optional: small scanlines overlay (subtle)
    const scanOpacity = 0.02;
    octx.fillStyle = `rgba(0,0,0,${scanOpacity})`;
    for (let y=0; y<h; y+=Math.round(3*DPR)) {
      octx.fillRect(0, y, w, 1*DPR);
    }
  }

  // --- WebGL helpers: compile shader, program ---
  function compileShader(src, type) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  // vertex shader (fullscreen quad)
  const vsrc = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main(){
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos,0.0,1.0);
    }
  `;
  // fragment shader: barrel distortion + chroma + vignette + border noise
  const fsrc = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec2 uTexSize; // texture (terminal) in pixels
    uniform vec2 uScreen;  // screen size in pixels
    uniform vec2 uOffset;  // terminal top-left in screen CSS px
    uniform float uStrength; // distortion strength
    uniform float uChroma;
    uniform float uNoise;
    uniform float uVignette;
    uniform float uTime;
    // barrel distortion helper
    vec2 barrel(vec2 uv, float k) {
      vec2 cc = uv - 0.5;
      float r = length(cc);
      vec2 res = uv + cc * k * r * r;
      return res;
    }
    // random
    float rand(vec2 co){ return fract(sin(dot(co.xy,vec2(12.9898,78.233))) * 43758.5453); }

    void main(){
      // Map screen UV to terminal UV: we only distort terminal region; outside, output transparent
      vec2 screenPos = vUv * uScreen; // pixels
      // check if inside terminal rect
      vec2 tl = uOffset;
      vec2 br = uOffset + uTexSize;
      if (screenPos.x < tl.x || screenPos.x > br.x || screenPos.y < tl.y || screenPos.y > br.y) {
        // outside terminal area: draw nothing (so underlying DOM visible)
        gl_FragColor = vec4(0.0,0.0,0.0,0.0);
        return;
      }
      // compute local uv inside terminal
      vec2 local = (screenPos - tl) / uTexSize; // 0..1 inside terminal
      // apply barrel distortion centered in texture
      float k = uStrength * 0.9; // scale
      vec2 d = barrel(local, k);

      // chroma: sample R,G,B at slightly shifted coords
      float co = uChroma * 0.001; // scale to uv space small
      vec2 shift = (d - 0.5) * co * 0.5;
      vec4 cr = texture2D(uTex, d + vec2(-shift.x, -shift.y));
      vec4 cg = texture2D(uTex, d);
      vec4 cb = texture2D(uTex, d + vec2(shift.x, shift.y));
      vec4 color = vec4(cr.r, cg.g, cb.b, cg.a);

      // vignette by radius (so edges darker)
      vec2 cc = local - 0.5;
      float r = length(cc);
      float vig = smoothstep(0.8 + uVignette*0.08, 0.45 + uVignette*0.02, r);
      color.rgb *= (1.0 - 0.45 * vig);

      // edge noise: stronger near corners
      float edgeFactor = smoothstep(0.5, 0.95, r);
      float n = (rand(vec2(uTime*0.1, screenPos.x*0.12 + screenPos.y*0.17)) - 0.5) * uNoise * edgeFactor;
      color.rgb += n;

      // subtle final gamma
      color.rgb = pow(color.rgb, vec3(0.95));

      gl_FragColor = color;
    }
  `;

  const vs = compileShader(vsrc, gl.VERTEX_SHADER);
  const fs = compileShader(fsrc, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);

  // setup quad
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1,  1,-1,  -1,1,
    -1,1,   1,-1,   1,1
  ]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // create GL texture for offscreen canvas
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // uniforms
  const uTex = gl.getUniformLocation(prog, 'uTex');
  const uTexSize = gl.getUniformLocation(prog, 'uTexSize');
  const uScreen = gl.getUniformLocation(prog, 'uScreen');
  const uOffset = gl.getUniformLocation(prog, 'uOffset');
  const uStrength = gl.getUniformLocation(prog, 'uStrength');
  const uChroma = gl.getUniformLocation(prog, 'uChroma');
  const uNoise = gl.getUniformLocation(prog, 'uNoise');
  const uVignette = gl.getUniformLocation(prog, 'uVignette');
  const uTime = gl.getUniformLocation(prog, 'uTime');

  // initial draw of terminal content
  drawTerminalToOffscreen();
  // initial upload
  function uploadTexture() {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    } catch(e) {
      // fallback: use ImageBitmap for some browsers
      createImageBitmap(off).then(bitmap => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);
        bitmap.close && bitmap.close();
      }).catch(err => console.warn('crtGL: bitmap err',err));
    }
  }
  uploadTexture();

  // track terminal position
  function termRect() {
    const r = term.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  // render loop
  let start = performance.now();
  function render() {
    resizeGL(); // ensure GL canvas matches screen
    // upload texture only if dirty (we set flag elsewhere)
    if (textureDirty) { uploadTexture(); textureDirty = false; }

    gl.useProgram(prog);
    // bind texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(uTex, 0);

    // set uniforms
    const tr = termRect();
    const texW = off.width; const texH = off.height;
    gl.uniform2f(uTexSize, texW, texH);
    gl.uniform2f(uScreen, canvas.width / DPR, canvas.height / DPR);
    gl.uniform2f(uOffset, tr.left, tr.top);
    gl.uniform1f(uStrength, cfg.strength * 0.9);
    gl.uniform1f(uChroma, cfg.chroma);
    gl.uniform1f(uNoise, cfg.noiseAmount);
    gl.uniform1f(uVignette, cfg.vignette);
    gl.uniform1f(uTime, (performance.now() - start) * 0.001);

    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
  }

  // Observers: redraw offscreen when terminal content changes
  let textureDirty = true;
  const mo = new MutationObserver(mutations => {
    // redraw on content change
    drawTerminalToOffscreen();
    textureDirty = true;
  });
  mo.observe(term, { childList: true, subtree: true, characterData: true });

  // Also update when window resizes or scrolls (terminal might move)
  window.addEventListener('resize', () => { drawTerminalToOffscreen(); textureDirty = true; });
  window.addEventListener('scroll', () => { textureDirty = true; });

  // Also capture keystrokes to update quickly when typing (for snappy response)
  window.addEventListener('keydown', (e) => {
    // small delay to let terminal script update DOM
    setTimeout(() => { drawTerminalToOffscreen(); textureDirty = true; }, 8);
  });
  window.addEventListener('keyup', (e) => { setTimeout(()=>{ drawTerminalToOffscreen(); textureDirty = true; }, 8); });

  // start loop
  requestAnimationFrame(render);

  // Expose API
  window.crtGL = window.crtGL || {};
  window.crtGL.set = (opts = {}) => {
    Object.assign(cfg, opts);
    // immediate update visual
    drawTerminalToOffscreen();
    textureDirty = true;
  };
  window.crtGL.disable = () => {
    // stop loop and cleanup
    mo.disconnect();
    window.removeEventListener('resize', resizeGL);
    window.removeEventListener('resize', ()=>{});
    window.removeEventListener('scroll', ()=>{});
    // remove canvas
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    console.info('crtGL disabled');
  };

  console.info('crtGL initialized — use window.crtGL.set({strength:0.8, chroma:6, noiseAmount:0.12})');
})();
