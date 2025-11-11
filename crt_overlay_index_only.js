// crt_overlay_index_only.js — single interactive curvature overlay
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  // Параметры визуала
  const BASE_DISTORTION = 0.28;   // основной изгиб
  const DARKEN = 0.85;           // уменьшает яркость (0..1)
  const CHROMA = 0.012;          // хроматическая аберрация
  const VIGNETTE = 0.55;         // силу виниетки (0..1)

  // ждём появления исходного canvas (indexCanvas)
  let attempts = 0;
  const check = setInterval(() => {
    const source = document.getElementById('indexCanvas');
    if (source) {
      clearInterval(check);
      init(source);
    } else if (++attempts > 80) {
      clearInterval(check);
      console.warn('crt_overlay: indexCanvas not found');
    }
  }, 80);

  function compile(gl, src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  function init(sourceCanvas) {
    // Создаём overlay canvas (он будет единственным видимым слоем с искажением)
    const overlay = document.createElement('canvas');
    overlay.id = 'crtOverlayIndex';
    overlay.tabIndex = 0; // чтобы можно было сфокусировать при необходимости
    Object.assign(overlay.style, {
      position: 'fixed',
      left: '0', top: '0',
      width: '100vw', height: '100vh',
      zIndex: '9999',
      pointerEvents: 'auto',
      background: 'transparent'
    });
    document.body.appendChild(overlay);

    // Скрываем оригинальный canvas визуально, но не удаляем его — логика остаётся
    sourceCanvas.style.opacity = '0';
    sourceCanvas.style.pointerEvents = 'none';
    sourceCanvas.style.userSelect = 'none';

    // Инициализация WebGL с прозрачным фоном
    const gl = overlay.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) {
      console.error('crt_overlay: WebGL not available');
      return;
    }
    gl.clearColor(0.0, 0.0, 0.0, 0.0); // прозрачный

    // Вертекс
    const vs = `
      attribute vec2 aPos;
      attribute vec2 aUV;
      varying vec2 vUV;
      void main() {
        vUV = aUV;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;

    // Фрагмент: искажение + хроматич.аберрация + виниетка + затемнение
    const fs = `
      precision mediump float;
      varying vec2 vUV;
      uniform sampler2D uTex;
      uniform float uDist;
      uniform float uDark;
      uniform float uChroma;
      uniform float uVignette;
      uniform vec2 uRes;
      uniform float uTime;
      uniform float uGlitch; // 0..1
      float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

      void main() {
        vec2 uv = vUV * 2.0 - 1.0;
        float r = length(uv);
        // radial distortion
        vec2 distorted = mix(uv, uv * r, uDist);

        // glitch displacement (fast jitter when uGlitch>0)
        if (uGlitch > 0.01) {
          float g = uGlitch;
          float jitter = (rand(vec2(uTime, r)) - 0.5) * 0.12 * g;
          distorted.x += jitter * sign(uv.x);
          distorted.y += jitter * 0.03 * g;
        }

        vec2 finalUV = (distorted + 1.0) * 0.5;
        finalUV.y = 1.0 - finalUV.y;

        // chromatic samples
        vec2 off = (distorted) * uChroma;
        vec4 colR = texture2D(uTex, clamp(finalUV + off, 0.0, 1.0));
        vec4 colG = texture2D(uTex, clamp(finalUV, 0.0, 1.0));
        vec4 colB = texture2D(uTex, clamp(finalUV - off, 0.0, 1.0));
        vec3 color = vec3(colR.r, colG.g, colB.b);

        // vignette
        float vig = smoothstep(0.8, 0.0, r);
        color *= mix(1.0 - uVignette*0.5, 1.0, vig);

        // slight desaturate on strong glitch
        float lum = dot(color, vec3(0.2126,0.7152,0.0722));
        color = mix(vec3(lum), color, 0.95);

        // darken
        color *= uDark;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, vs, gl.VERTEX_SHADER));
    gl.attachShader(prog, compile(gl, fs, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog);
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

    // uniforms
    const locDist = gl.getUniformLocation(prog, 'uDist');
    const locDark = gl.getUniformLocation(prog, 'uDark');
    const locChroma = gl.getUniformLocation(prog, 'uChroma');
    const locVig = gl.getUniformLocation(prog, 'uVignette');
    const locRes = gl.getUniformLocation(prog, 'uRes');
    const locTime = gl.getUniformLocation(prog, 'uTime');
    const locGlitch = gl.getUniformLocation(prog, 'uGlitch');

    gl.uniform1f(locDist, BASE_DISTORTION);
    gl.uniform1f(locDark, DARKEN);
    gl.uniform1f(locChroma, CHROMA);
    gl.uniform1f(locVig, VIGNETTE);

    // texture
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // ensure the shader uses texture unit 0
    const texLoc = gl.getUniformLocation(prog, 'uTex');
    gl.uniform1i(texLoc, 0);

    let width = 0, height = 0;
    function resize() {
      width = Math.floor(window.innerWidth * DPR);
      height = Math.floor(window.innerHeight * DPR);
      overlay.width = width;
      overlay.height = height;
      overlay.style.width = window.innerWidth + 'px';
      overlay.style.height = window.innerHeight + 'px';
      gl.viewport(0, 0, width, height);
      gl.uniform2f(locRes, width || 1, height || 1);
    }
    window.addEventListener('resize', resize);
    resize();

    // Forward input events from overlay to the source canvas (so хитбоксы/логика в оригинале остаются)
    const forwardTypes = ['mousemove', 'mousedown', 'mouseup', 'click', 'dblclick'];
    forwardTypes.forEach(t => {
      overlay.addEventListener(t, (ev) => {
        // dispatch event to sourceCanvas with same client coords
        const se = new MouseEvent(ev.type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: ev.clientX,
          clientY: ev.clientY,
          button: ev.button,
          buttons: ev.buttons,
          ctrlKey: ev.ctrlKey,
          shiftKey: ev.shiftKey,
          altKey: ev.altKey,
          metaKey: ev.metaKey
        });
        sourceCanvas.dispatchEvent(se);
      });
    });

    // also forward pointerleave to simulate mouseout
    overlay.addEventListener('mouseleave', () => {
      const se = new MouseEvent('mousemove', {bubbles:true,cancelable:true,view:window,clientX:-9999,clientY:-9999});
      sourceCanvas.dispatchEvent(se);
    });

    // keyboard: focus overlay so user interactions don't get lost (original listeners use document anyway)
    overlay.addEventListener('click', () => {
      try { overlay.focus(); } catch (e) {}
    });

    // Glitch controller
    let glitch = 0;
    let glitchTimeout = null;
    let startTime = performance.now();
    function triggerGlitch(intensity = 1.0, duration = 450) {
      glitch = Math.min(1, intensity);
      gl.uniform1f(locGlitch, glitch);
      if (glitchTimeout) clearTimeout(glitchTimeout);
      glitchTimeout = setTimeout(() => {
        // smooth decay
        const decayStart = performance.now();
        const decay = () => {
          const t = (performance.now() - decayStart) / 400;
          glitch = Math.max(0, glitch * (1 - t));
          gl.uniform1f(locGlitch, glitch);
          if (glitch > 0.02) requestAnimationFrame(decay); else {
            glitch = 0;
            gl.uniform1f(locGlitch, 0);
          }
        };
        requestAnimationFrame(decay);
      }, duration);
    }

    // expose to window so other scripts can call it (e.g. on login failure)
    window.triggerLoginGlitch = function() {
      // call several bursts
      triggerGlitch(1.4, 260);
      setTimeout(() => triggerGlitch(0.9, 160), 70);
      setTimeout(() => triggerGlitch(1.8, 320), 170);
    };

    // render loop
    function render(t) {
      // update texture from sourceCanvas
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try {
        // use the canvas content as source; works even if sourceCanvas is not visible
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
      } catch (e) {
        // safety: if texImage fails (cross-origin rare case), skip
      }

      // animate slight breathing or tiny time-based variations
      const now = t * 0.001;
      gl.uniform1f(locTime, now);

      // subtle dynamic distortion modulation (not too aggressive)
      const mod = BASE_DISTORTION * (1 + Math.sin(now * 0.8) * 0.01);
      gl.uniform1f(locDist, mod);
      gl.uniform1f(locDark, DARKEN);
      gl.uniform1f(locChroma, CHROMA);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    // Helpful safety: if user wants to see original for debug, press Ctrl+Shift+O toggle
    let debug = false;
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'o') {
        debug = !debug;
        if (debug) {
          sourceCanvas.style.opacity = '1';
          overlay.style.display = 'none';
        } else {
          sourceCanvas.style.opacity = '0';
          overlay.style.display = 'block';
        }
      }
    });

    console.log('crt_overlay: ready — overlay created and events forwarded.');
  }
})();
