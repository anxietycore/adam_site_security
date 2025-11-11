// crt_overlay_index_only.js — overlay: distortion + event forwarding (with inverse mapping)
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const DISTORTION = 0.34; // tweak if you want stronger/weaker bend

  // wait for ADAM_UI to be ready
  let attempts = 0;
  const checkInterval = setInterval(() => {
    if (window.ADAM_UI && typeof window.ADAM_UI.getSourceCanvas === 'function') {
      clearInterval(checkInterval);
      initOverlay();
    } else if (++attempts > 60) {
      clearInterval(checkInterval);
      console.warn('ADAM_UI not ready for overlay');
    }
  }, 80);

  function initOverlay() {
    const sourceCanvas = window.ADAM_UI.getSourceCanvas();
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
      void main() {
        vec2 uv = vUV * 2.0 - 1.0; // -1..1
        float r = length(uv);
        vec2 distorted = mix(uv, uv * r, uDist);

        // glitch bands
        float g = uGlitch;
        if (g > 0.01) {
          float band = floor((uv.y + 1.0)*20.0 + uTime * 40.0);
          float n = rand(band);
          float shift = (n * 2.0 - 1.0) * 0.03 * g;
          distorted.x += shift * (1.0 - smoothstep(0.0, 0.9, abs(uv.y)));
        }

        vec2 finalUV = (distorted + 1.0) * 0.5;
        finalUV.y = 1.0 - finalUV.y;

        vec4 col = texture2D(uTex, clamp(finalUV, 0.0, 1.0));

        // mild vignette so edges are not too bright
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
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error('prog link error', gl.getProgramInfoLog(prog));
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
          // ignore
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

    // keep glitch timer ticking down (shared state)
    setInterval(() => {
      if (window.__ADAM_GLITCH && window.__ADAM_GLITCH.timer > 0) {
        window.__ADAM_GLITCH.timer = Math.max(0, window.__ADAM_GLITCH.timer - 1);
        if (window.__ADAM_GLITCH.timer === 0) window.__ADAM_GLITCH.strength = 0;
      }
    }, 33);

    // --- CORE: map pointer from screen -> SOURCE coords by INVERTING distortion ---
    // Shader mapping chain (forward): vUV (0..1) -> uv=(-1..1) -> distorted = mix(uv, uv*r, d)
    // -> finalUV = (distorted+1)/2 ; finalUV.y = 1 - finalUV.y
    // So to get sourceUV, we:
    // 1) take screen vUV = (x/w, y/h)
    // 2) flip y: s = vec2(vUV.x, 1 - vUV.y)
    // 3) d = s*2 - 1  (this is the "distorted" target)
    // 4) find u such that mix(u, u*length(u), dParam) == d  (solve iteratively)
    // 5) sourceUV = (u + 1) * 0.5
    function invertDistortion(targetX, targetY, distParam) {
      // targetX,Y in CSS px relative to viewport
      const sx = targetX / window.innerWidth;
      const sy = targetY / window.innerHeight;
      // flip y to match shader
      let sX = sx;
      let sY = 1.0 - sy;
      // map to -1..1
      let dX = sX * 2.0 - 1.0;
      let dY = sY * 2.0 - 1.0;

      // initial guess for u is d
      let ux = dX;
      let uy = dY;

      // iterative refinement (fixed-point style). Should converge in ~5-8 iters.
      for (let i = 0; i < 7; i++) {
        const r = Math.sqrt(Math.max(0.000001, ux*ux + uy*uy));
        // forward mapping f(u) = mix(u, u*r, dist)
        const fx = ux * (1.0 - distParam) + (ux * r) * distParam;
        const fy = uy * (1.0 - distParam) + (uy * r) * distParam;
        // error
        const ex = dX - fx;
        const ey = dY - fy;
        // relax update (empirically stable)
        ux += ex * 0.75;
        uy += ey * 0.75;
      }

      // convert back to 0..1 texture UV and flip y back
      const sourceU = (ux + 1.0) * 0.5;
      const sourceV = 1.0 - ((uy + 1.0) * 0.5);
      // clamp
      return {
        x: Math.max(0, Math.min(1, sourceU)) * window.innerWidth,
        y: Math.max(0, Math.min(1, sourceV)) * window.innerHeight
      };
    }

    // convert pointer coordinates and forward to ADAM_UI
    function toLocalCoords(evt) {
      const rect = overlay.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      // invert distortion to get where in source canvas that pixel came from
      const mapped = invertDistortion(x, y, DISTORTION);
      return mapped;
    }

    overlay.addEventListener('pointermove', (e) => {
      const p = toLocalCoords(e);
      window.ADAM_UI.handlePointerMove(p.x, p.y);
      // do not prevent default — allow normal cursor
    }, { passive: true });

    overlay.addEventListener('pointerdown', (e) => {
      const p = toLocalCoords(e);
      window.ADAM_UI.handlePointer('pointerdown', p.x, p.y);
      e.preventDefault();
    });

    overlay.addEventListener('click', (e) => {
      const p = toLocalCoords(e);
      window.ADAM_UI.handlePointer('click', p.x, p.y);
      e.preventDefault();
    });

    window.addEventListener('keydown', (e) => {
      window.ADAM_UI.handleKey(e);
    });

    // expose console control
    window.__ADAM_OVERLAY = { triggerGlitch: (s,d)=>{ window.ADAM_UI.triggerGlitch(s,d); } };
  }
})();
