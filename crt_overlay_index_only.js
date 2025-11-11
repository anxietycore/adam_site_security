// crt_overlay_index_only.js — умный оверлей: только изгиб, подвижный шум и перенаправление событий
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const DISTORTION = 0.32;        // сила изгиба (можешь подправить)
  const NOISE_INTENSITY = 0.20;   // шум (0..1)
  const BRIGHTNESS = 0.85;        // общая яркость (0..1)
  const SATURATION_GREEN = 0.9;   // уменьшение "ядовитости" зелёного

  // ждём indexCanvas
  let attempts = 0;
  const checkInterval = setInterval(() => {
    const sourceCanvas = document.getElementById('indexCanvas');
    if (sourceCanvas) {
      clearInterval(checkInterval);
      initOverlay(sourceCanvas);
    } else if (++attempts > 80) {
      clearInterval(checkInterval);
      console.warn('indexCanvas not found after 80 attempts');
    }
  }, 80);

  function initOverlay(sourceCanvas) {
    // hide original visually (still usable as tex source)
    sourceCanvas.style.visibility = 'hidden';

    const overlay = document.createElement('canvas');
    overlay.id = 'crtOverlayIndex';
    Object.assign(overlay.style, {
      position: 'fixed',
      left: '0', top: '0',
      width: '100vw', height: '100vh',
      zIndex: '1000',
      pointerEvents: 'auto', // overlay will handle events
      display: 'block'
    });
    document.body.appendChild(overlay);

    const gl = overlay.getContext('webgl', { antialias: true }) || overlay.getContext('experimental-webgl');
    if (!gl) {
      console.error('WebGL is not available');
      return;
    }

    const vs = `
      attribute vec2 aPos;
      attribute vec2 aUV;
      varying vec2 vUV;
      void main() {
        vUV = aUV;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;

    // fragment: samples source texture with radial distortion, overlays animated noise,
    // reduces brightness & green saturation slightly.
    const fs = `
      precision mediump float;
      varying vec2 vUV;
      uniform sampler2D uTex;
      uniform float uDist;
      uniform float uTime;
      uniform float uNoise;
      uniform float uBrightness;
      uniform float uSatG;

      // simple hash / noise
      float hash(vec2 p) {
        p = mod(p, 12345.678);
        return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
      }

      void main() {
        // convert to -1..1
        vec2 uv = vUV * 2.0 - 1.0;
        float r = length(uv);
        vec2 distorted = mix(uv, uv * r, uDist);
        vec2 finalUV = (distorted + 1.0) * 0.5;
        // shader used flipped Y:
        finalUV.y = 1.0 - finalUV.y;

        // sample source
        vec4 col = texture2D(uTex, clamp(finalUV, 0.0, 1.0));

        // apply mild color grading: reduce green saturation to avoid acid-green
        float g = col.g * uSatG;
        col.g = mix(col.g, g, 0.6);

        // brightness clamp
        col.rgb *= uBrightness;

        // moving fine noise (scale & speed tuned)
        float n = noise(finalUV * vec2(800.0, 400.0) + vec2(uTime * 0.4, uTime * 0.1));
        // vertical subtle scanline banding
        float scan = sin((vUV.y + uTime*0.2) * 800.0) * 0.02;
        float combinedNoise = (n - 0.5) * uNoise + scan;

        col.rgb += vec3(combinedNoise);

        // slight vignette
        float vig = smoothstep(0.8, 0.2, r);
        col.rgb *= vig;

        // gamma / clamp
        col = clamp(col, 0.0, 1.0);
        gl_FragColor = col;
      }
    `;

    function compile(src, type) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(s));
      }
      return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
    gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    // quad
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
    const uNoiseLoc = gl.getUniformLocation(prog, 'uNoise');
    const uBrightLoc = gl.getUniformLocation(prog, 'uBrightness');
    const uSatGLoc = gl.getUniformLocation(prog, 'uSatG');

    gl.uniform1f(uDistLoc, DISTORTION);
    gl.uniform1f(uNoiseLoc, NOISE_INTENSITY);
    gl.uniform1f(uBrightLoc, BRIGHTNESS);
    gl.uniform1f(uSatGLoc, SATURATION_GREEN);

    // texture
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
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
      const t = (performance.now() - start) * 0.001;
      gl.uniform1f(uTimeLoc, t);

      // update source texture from hidden sourceCanvas
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
      } catch (err) {
        // some browsers require texImage2D with pixels instead; ignore if fails
      }

      gl.clearColor(0,0,0,1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    render();

    // ---------------------
    // Event mapping: overlay receives pointer events; we compute the sampled sourceUV (same math as shader)
    // and dispatch MouseEvent to sourceCanvas at corresponding client coords.
    // ---------------------

    function overlayToSourceClient(e) {
      // overlay client coords
      const rect = overlay.getBoundingClientRect();
      const ox = (e.clientX - rect.left);
      const oy = (e.clientY - rect.top);
      const vw = rect.width;
      const vh = rect.height;
      // normalized vUV (0..1)
      let vux = ox / vw;
      let vuy = oy / vh;
      // shader maps: uv = vUV*2 -1; distorted = mix(uv, uv * r, uDist) ...
      let uvx = vux * 2.0 - 1.0;
      let uvy = vuy * 2.0 - 1.0;
      // compute distorted exactly as shader (we need finalUV)
      let r = Math.hypot(uvx, uvy);
      let s = 1.0 - DISTORTION + DISTORTION * r;
      let dx = uvx * s;
      let dy = uvy * s;
      let finalX = (dx + 1.0) * 0.5;
      let finalY = (dy + 1.0) * 0.5;
      finalY = 1.0 - finalY; // shader flip

      // convert finalUV to client coords in sourceCanvas space
      const srcRect = sourceCanvas.getBoundingClientRect();
      const clientX = srcRect.left + finalX * srcRect.width;
      const clientY = srcRect.top  + finalY * srcRect.height;
      return { clientX, clientY, srcRect, finalX, finalY };
    }

    function makeMouseEvent(type, originalEvent, clientX, clientY) {
      const ev = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: Math.round(clientX),
        clientY: Math.round(clientY),
        screenX: Math.round(window.screenX + clientX),
        screenY: Math.round(window.screenY + clientY),
        button: originalEvent.button,
        buttons: originalEvent.buttons,
        ctrlKey: originalEvent.ctrlKey,
        shiftKey: originalEvent.shiftKey,
        altKey: originalEvent.altKey,
        metaKey: originalEvent.metaKey
      });
      return ev;
    }

    ['pointerdown','pointerup','pointermove','click','dblclick','contextmenu'].forEach(evtName => {
      overlay.addEventListener(evtName, (ev) => {
        // compute mapped position and dispatch equivalent mouse event on sourceCanvas
        const mapped = overlayToSourceClient(ev);
        const me = makeMouseEvent(evtName === 'pointermove' ? 'mousemove' : evtName, ev, mapped.clientX, mapped.clientY);
        sourceCanvas.dispatchEvent(me);
        // prevent default so page doesn't also use these
        ev.preventDefault();
        ev.stopPropagation();
      }, { passive: false });
    });

    // also forward wheel
    overlay.addEventListener('wheel', (ev) => {
      const mapped = overlayToSourceClient(ev);
      const we = new WheelEvent('wheel', {
        bubbles: true, cancelable: true, deltaX: ev.deltaX, deltaY: ev.deltaY,
        clientX: Math.round(mapped.clientX), clientY: Math.round(mapped.clientY)
      });
      sourceCanvas.dispatchEvent(we);
      ev.preventDefault();
      ev.stopPropagation();
    }, { passive: false });

    // focus: when overlay clicked, try to focus underlying canvas (so keyboard can be used if code expects focus)
    overlay.addEventListener('pointerdown', (ev) => {
      try { sourceCanvas.focus(); } catch (e) {}
    });

    // expose some tuning via window for quick adjustments in dev console
    window.__CRTOverlay = {
      setDist: v => { gl.uniform1f(uDistLoc, v); },
      setNoise: v => { gl.uniform1f(uNoiseLoc, v); },
      setBrightness: v => { gl.uniform1f(uBrightLoc, v); },
      setSatG: v => { gl.uniform1f(uSatGLoc, v); }
    };
  }
})();
