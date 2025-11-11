// crt_overlay_index_only.js — overlay that samples offscreen index canvas and handles interaction
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const DISTORTION = 0.34; // можно чуть уменьшить
  // wait for ADAM_UI to be ready
  let attempts = 0;
  const checkInterval = setInterval(() => {
    if (window.ADAM_UI && typeof window.ADAM_UI.getSourceCanvas === 'function') {
      clearInterval(checkInterval);
      initOverlay(window.ADAM_UI.getSourceCanvas());
    } else if (++attempts > 60) {
      clearInterval(checkInterval);
      console.warn('ADAM_UI not ready for overlay');
    }
  }, 80);

  function initOverlay(sourceCanvas) {
    const overlay = document.createElement('canvas');
    overlay.id = 'crtOverlayIndex';
    Object.assign(overlay.style, {
      position: 'fixed',
      left: '0', top: '0',
      width: '100vw', height: '100vh',
      zIndex: '1000',
      pointerEvents: 'auto'
    });
    document.body.appendChild(overlay);
    window.__ADAM_OVERLAY_PRESENT = true;

    const gl = overlay.getContext('webgl', { antialias: false });
    if (!gl) { console.warn('WebGL not available'); return; }

    // vertex shader
    const vs = `
      attribute vec2 aPos;
      attribute vec2 aUV;
      varying vec2 vUV;
      void main() {
        vUV = aUV;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;
    // fragment shader: distortion + horizontal band glitch + simple color-split when glitch
    const fs = `
      precision mediump float;
      varying vec2 vUV;
      uniform sampler2D uTex;
      uniform float uDist;
      uniform float uTime;
      uniform float uGlitch; // 0..1
      float rand(float x) { return fract(sin(x)*43758.5453); }
      void main() {
        vec2 uv = vUV * 2.0 - 1.0;
        float r = length(uv);
        vec2 distorted = mix(uv, uv * r, uDist);

        float g = uGlitch;
        if (g > 0.01) {
          float band = floor((uv.y + uTime*0.15) * 60.0);
          float noise = rand(band) * 2.0 - 1.0;
          float shift = noise * 0.04 * g;
          distorted.x += shift * (1.0 - smoothstep(0.0, 0.9, abs(uv.y)*1.2));
        }

        vec2 finalUV = (distorted + 1.0) * 0.5;
        // shader flips vertically before sampling (match original)
        finalUV.y = 1.0 - finalUV.y;

        // basic color split under glitch: sample channels separately
        vec4 col;
        if (g > 0.02) {
          float off = 0.004 * g;
          vec4 rcol = texture2D(uTex, clamp(finalUV + vec2(off,0.0), 0.0,1.0));
          vec4 gcol = texture2D(uTex, clamp(finalUV, 0.0,1.0));
          vec4 bcol = texture2D(uTex, clamp(finalUV - vec2(off,0.0), 0.0,1.0));
          col = vec4(rcol.r, gcol.g, bcol.b, (rcol.a+gcol.a+bcol.a)/3.0);
        } else {
          col = texture2D(uTex, clamp(finalUV, 0.0,1.0));
        }

        // vignette -- subtle
        float vign = 1.0 - 0.25 * pow(length(finalUV - 0.5), 1.5);
        col.rgb *= vign;
        gl_FragColor = col;
      }
    `;

    function compile(src, type) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
      }
      return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
    gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('prog link error', gl.getProgramInfoLog(prog));
    }
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

    const uDistLoc = gl.getUniformLocation(prog, 'uDist');
    const uTimeLoc = gl.getUniformLocation(prog, 'uTime');
    const uGlitchLoc = gl.getUniformLocation(prog, 'uGlitch');

    gl.uniform1f(uDistLoc, DISTORTION);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    function resize() {
      overlay.width = Math.floor(window.innerWidth * DPR);
      overlay.height = Math.floor(window.innerHeight * DPR);
      overlay.style.width = window.innerWidth + 'px';
      overlay.style.height = window.innerHeight + 'px';
      gl.viewport(0, 0, overlay.width, overlay.height);
    }
    window.addEventListener('resize', resize);
    resize();

    let start = performance.now();

    function render() {
      const src = window.ADAM_UI.getSourceCanvas();
      if (src) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
        } catch (err) {
          // fallback omitted for brevity
        }
      }

      const t = (performance.now() - start) * 0.001;
      gl.uniform1f(uTimeLoc, t);

      const gstate = window.__ADAM_GLITCH || { strength: 0, timer: 0 };
      const gval = (gstate.timer && gstate.timer > 0) ?  Math.min(1.0, gstate.strength) : 0.0;
      gl.uniform1f(uGlitchLoc, gval);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    render();

    // EVENTS: overlay grabs events and forwards to ADAM_UI in CSS px (0..window.innerWidth)
    function toLocal(evt) {
      const rect = overlay.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;

      // compute same mapping as shader (JS-side) to convert screen pointer -> source CSS px
      // vUV is in 0..1
      const vux = x / overlay.clientWidth;
      const vuy = y / overlay.clientHeight;
      // uv in -1..1
      let uvx = vux * 2.0 - 1.0;
      let uvy = vuy * 2.0 - 1.0;
      // same math as shader: distorted = mix(uv, uv * r, uDist)
      const rDistorted = Math.hypot(uvx, uvy);
      // compute rd = length(distorted) which is r * (a + b * r) where a = 1-uDist, b = uDist
      const a = 1.0 - DISTORTION;
      const b = DISTORTION;
      // forward: rd = a*r + b*r*r
      // we have rd_forward = rDistorted (that's the length after applying simple formula since shader used r = length(uv) and distorted = uv * (a + b*r) so length(distorted) = r*(a + b*r)
      // BUT here rDistorted is actually length(uv) BEFORE scaling (we computed from vUV). We need to invert the radial scale to find original uv that maps to displayed pixel.
      // HOWEVER simpler: shader mapping from vUV->sampleUV is: compute uv=vUV*2-1; r=length(uv); distorted = uv*(a + b*r); finalUV=(distorted+1)/2; finalUV.y = 1.0 - finalUV.y
      // We want finalUV (source sample coordinate) given vUV pointer — that's direct: we can just compute it like shader forward.
      // So compute r = length(uv); s = a + b*r; distorted = uv * s; finalUV = (distorted + 1)/2; finalUV.y = 1 - finalUV.y
      const r = rDistorted;
      const s = a + b * r;
      const dx = uvx * s;
      const dy = uvy * s;
      let finalU = (dx + 1.0) * 0.5;
      let finalV = (dy + 1.0) * 0.5;
      finalV = 1.0 - finalV; // shader flips
      // clamp
      finalU = Math.min(1, Math.max(0, finalU));
      finalV = Math.min(1, Math.max(0, finalV));
      // convert to CSS px of source / ADAM_UI expectation
      const cssX = finalU * window.innerWidth;
      const cssY = finalV * window.innerHeight;

      return { x: cssX, y: cssY, rawX: x, rawY: y };
    }

    overlay.addEventListener('pointermove', (e) => {
      const p = toLocal(e);
      window.ADAM_UI.handlePointerMove(p.x, p.y);
      e.preventDefault();
    }, { passive: true });

    overlay.addEventListener('pointerdown', (e) => {
      const p = toLocal(e);
      window.ADAM_UI.handlePointer('pointerdown', p.x, p.y);
      e.preventDefault();
    });

    overlay.addEventListener('click', (e) => {
      const p = toLocal(e);
      window.ADAM_UI.handlePointer('click', p.x, p.y);
      e.preventDefault();
    });

    window.addEventListener('keydown', (e) => {
      window.ADAM_UI.handleKey(e);
    });

    window.__ADAM_OVERLAY = { triggerGlitch: (s,d)=>{ window.ADAM_UI.triggerGlitch(s,d);} };

    setInterval(() => {
      if (window.__ADAM_GLITCH && window.__ADAM_GLITCH.timer > 0) {
        window.__ADAM_GLITCH.timer = Math.max(0, window.__ADAM_GLITCH.timer - 1);
        if (window.__ADAM_GLITCH.timer === 0) window.__ADAM_GLITCH.strength = 0;
      }
    }, 33);
  }
})();
