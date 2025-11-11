// crt_overlay_index_only.js — overlay that samples offscreen index canvas and handles interaction
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const DISTORTION = 0.34;

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
      float rand(float x) { return fract(sin(x)*43758.5453); }
      void main() {
        vec2 uv = vUV * 2.0 - 1.0;
        float r = length(uv);
        vec2 distorted = mix(uv, uv * r, uDist);
        float g = uGlitch;
        if (g > 0.01) {
          float band = floor(uv.y * 40.0 + uTime * 50.0);
          float noise = rand(band) * 2.0 - 1.0;
          float shift = noise * 0.02 * g;
          distorted.x += shift * (1.0 - smoothstep(0.0, 0.9, abs(uv.y)*1.2));
        }
        vec2 finalUV = (distorted + 1.0) * 0.5;
        finalUV.y = 1.0 - finalUV.y;
        vec4 col = texture2D(uTex, clamp(finalUV, 0.0, 1.0));
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
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, src.width, src.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          const temp = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, temp);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
          const ctx2 = document.createElement('canvas').getContext('2d');
          ctx2.canvas.width = src.width;
          ctx2.canvas.height = src.height;
          ctx2.drawImage(src, 0, 0);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx2.canvas);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
      }

      const t = (performance.now() - start) * 0.001;
      gl.uniform1f(uTimeLoc, t);

      const gstate = window.__ADAM_GLITCH || { strength: 0, timer: 0 };
      const gval = gstate.timer > 0 ? Math.min(1.0, gstate.strength) : 0.0;
      gl.uniform1f(uGlitchLoc, gval);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    render();

    // === ИСПРАВЛЕНО: события теперь в CSS px, как ожидает ADAM_UI ===
    function toLocal(evt) {
      const rect = overlay.getBoundingClientRect();
      return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
      };
    }

    overlay.addEventListener('pointermove', (e) => {
      const p = toLocal(e);
      window.ADAM_UI.handlePointerMove(p.x, p.y);
    }, { passive: false });

    overlay.addEventListener('pointerdown', (e) => {
      const p = toLocal(e);
      window.ADAM_UI.handlePointer('pointerdown', p.x, p.y);
    });

    overlay.addEventListener('click', (e) => {
      const p = toLocal(e);
      window.ADAM_UI.handlePointer('click', p.x, p.y);
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
