// crt_overlay_index_only.js — видимый overlay, берёт offscreen canvas и делает изгиб + глитч
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const DISTORTION = 0.34;

  // ждём ADAM_UI
  let attempts = 0;
  const checkInterval = setInterval(() => {
    if (window.ADAM_UI && typeof window.ADAM_UI.getSourceCanvas === 'function') {
      clearInterval(checkInterval);
      initOverlay(window.ADAM_UI.getSourceCanvas());
    } else if (++attempts > 80) {
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
      pointerEvents: 'auto',
      display: 'block'
    });
    document.body.appendChild(overlay);
    window.__ADAM_OVERLAY_PRESENT = true;

    const gl = overlay.getContext('webgl', { antialias: false });
    if (!gl) { console.warn('WebGL not available'); return; }

    // shaders (vertex simple, fragment: distortion + horizontal band glitch)
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
      uniform sampler2D uTex;
      uniform float uDist;
      uniform float uTime;
      uniform float uGlitch;
      float rand(float x){ return fract(sin(x)*43758.5453); }
      void main(){
        vec2 uv = vUV * 2.0 - 1.0;
        float r = length(uv);
        vec2 distorted = mix(uv, uv * r, uDist);

        // apply subtle horizontal glitch bands when glitch>0
        float g = uGlitch;
        if (g > 0.01) {
          float bands = 40.0;
          float band = floor((uv.y + 1.0) * 0.5 * bands + uTime * 10.0);
          float n = rand(band);
          float shift = (n * 2.0 - 1.0) * 0.03 * g;
          // fade shift near top/bottom
          float fall = 1.0 - smoothstep(-1.0, 1.0, abs(uv.y) * 1.2);
          distorted.x += shift * fall;
        }

        vec2 finalUV = (distorted + 1.0) * 0.5;
        finalUV.y = 1.0 - finalUV.y;

        vec4 col = texture2D(uTex, clamp(finalUV, 0.0, 1.0));
        // slight vignette so edges darker but subtle
        float vig = 1.0 - 0.18 * pow(length(finalUV - 0.5), 1.6);
        col.rgb *= vig;
        gl_FragColor = col;
      }
    `;

    function compile(src, type) {
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
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error('prog link', gl.getProgramInfoLog(prog));
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
          // ignore fallback — should not occur for typical canvases
        }
      }

      const t = (performance.now() - start) * 0.001;
      gl.uniform1f(uTimeLoc, t);

      const gstate = window.__ADAM_GLITCH || { strength: 0, timer: 0 };
      const gval = (gstate.timer && gstate.timer > 0) ? Math.min(1.0, gstate.strength) : 0.0;
      gl.uniform1f(uGlitchLoc, gval);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    render();

    // ---------- pointer mapping: map overlay (screen) coords -> source (CSS) coords
    // We invert the shader's radial distortion (analytic scalar solution).
    function screenToSource(x,y) {
      // overlay size in CSS px
      const W = window.innerWidth, H = window.innerHeight;
      // finalUV (the shader formed finalUV then flipped y): finalUV = (distorted+1)/2 ; finalUV.y flipped
      // For a pixel (x,y) on screen, finalUV = (x/W, 1 - y/H)
      const fx = x / W;
      const fy = 1 - (y / H);
      // uv_t (distorted) in -1..1 space
      const uv_tx = fx * 2 - 1;
      const uv_ty = fy * 2 - 1;
      const ut_len = Math.hypot(uv_tx, uv_ty);

      // Solve scalar s for relation: distorted = uv_src * s, where s = 1 + d*(r_src - 1)
      // and |distorted| = |uv_src| * s  => letting |uv_src| = r_src, |distorted| = ut_len
      // we get quadratic: s^2 - (1-d)*s - d*ut_len = 0
      const d = DISTORTION;
      // prevent negative ut_len tiny
      const eps = 1e-6;
      const a = 1.0;
      const b = -(1 - d);
      const c = -d * Math.max(ut_len, eps);
      // solve s = ( (1-d) + sqrt( (1-d)^2 + 4*d*|u_t| ) ) / 2  (positive root)
      const disc = Math.max(0, (1 - d)*(1 - d) + 4 * d * Math.max(ut_len, eps));
      const s = ((1 - d) + Math.sqrt(disc)) * 0.5;

      // original uv (approx) = uv_t / s
      const ux = uv_tx / s;
      const uy = uv_ty / s;
      const src_fx = (ux + 1) * 0.5;
      const src_fy = 1 - ((uy + 1) * 0.5); // remember shader flips y at end for sampling
      // map to CSS px of source canvas (which is full-window in our UI)
      const sx = src_fx * window.innerWidth;
      const sy = (1 - src_fy) * window.innerHeight; // convert back (double flip)
      // Note: because we inverted the shader chain carefully, this gives CSS px coords for ADAM_UI
      // But to be safe, clamp
      return {
        x: Math.max(0, Math.min(window.innerWidth, sx)),
        y: Math.max(0, Math.min(window.innerHeight, sy))
      };
    }

    // Convert a pointer event to mapped coords and forward
    function forwardPointerEvent(evtType, ev) {
      const rect = overlay.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      const mapped = screenToSource(cx, cy);
      // Forward CSS px coords
      if (evtType === 'move') window.ADAM_UI.handlePointerMove(mapped.x, mapped.y);
      else window.ADAM_UI.handlePointer(evtType, mapped.x, mapped.y);
    }

    overlay.addEventListener('pointermove', (e) => { forwardPointerEvent('move', e); }, { passive: true });
    overlay.addEventListener('pointerdown', (e) => { forwardPointerEvent('pointerdown', e); e.preventDefault(); });
    overlay.addEventListener('click', (e) => { forwardPointerEvent('click', e); e.preventDefault(); });

    window.addEventListener('keydown', (e) => { window.ADAM_UI.handleKey(e); });

    // expose small api
    window.__ADAM_OVERLAY = { triggerGlitch: (s,d)=>{ window.ADAM_UI.triggerGlitch(s,d); } };

    // local decrement of global glitch timer (ADAM_UI sets it)
    setInterval(() => {
      if (window.__ADAM_GLITCH && window.__ADAM_GLITCH.timer > 0) {
        window.__ADAM_GLITCH.timer = Math.max(0, window.__ADAM_GLITCH.timer - 1);
        if (window.__ADAM_GLITCH.timer === 0) window.__ADAM_GLITCH.strength = 0;
      }
    }, 33);
  }
})();
