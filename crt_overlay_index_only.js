// crt_overlay_index_only.js — WebGL-оверлей с barrel-искажением,
// правильным преобразованием координат и смешиванием шумового слоя
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const DISTORTION = 0.32;
  const NOISE_OPACITY = 0.18; // 🔧 Контроль яркости шума (0..1)

  let attempts = 0;
  const checkInterval = setInterval(() => {
    if (window.ADAM_UI && typeof window.ADAM_UI.getSourceCanvas === 'function') {
      clearInterval(checkInterval);
      initOverlay();
    } else if (++attempts > 80) {
      clearInterval(checkInterval);
      console.warn('crt_overlay: ADAM_UI timeout');
    }
  }, 60);

  function initOverlay() {
    const sourceCanvas = window.ADAM_UI.getSourceCanvas();
    const noiseCanvas = document.getElementById('glassFX');
    
    if (!noiseCanvas) {
      console.warn('crt_overlay: noise canvas not found');
      return;
    }

    const overlay = document.createElement('canvas');
    overlay.id = 'crtOverlayIndex';
    Object.assign(overlay.style, {
      position: 'fixed', left: '0', top: '0',
      width: '100vw', height: '100vh',
      zIndex: '1000', pointerEvents: 'auto'
    });
    document.body.appendChild(overlay);
    window.__ADAM_OVERLAY_PRESENT = true;

    const gl = overlay.getContext('webgl', { antialias: false });
    if (!gl) { console.warn('WebGL unavailable'); return; }

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
      uniform sampler2D uNoiseTex;
      uniform sampler2D uTex;
      uniform float uDist;
      uniform float uNoiseOpacity;
      uniform float uTime;
      uniform float uGlitch;
      
      float rand(float x) { return fract(sin(x) * 43758.5453); }
      
      void main() {
        vec2 uv = vUV * 2.0 - 1.0;
        float r = length(uv);
        vec2 distorted = mix(uv, uv * r, uDist);
        
        // Glitch-эффект
        float g = uGlitch;
        if (g > 0.01) {
          float band = floor(uv.y * 40.0 + uTime * 50.0);
          float noise = rand(band) * 2.0 - 1.0;
          float shift = noise * 0.03 * g;
          distorted.x += shift * (1.0 - smoothstep(0.0, 0.9, abs(uv.y) * 1.2));
        }
        
        vec2 finalUV = (distorted + 1.0) * 0.5;
        finalUV.y = 1.0 - finalUV.y;
        
        vec4 noise = texture2D(uNoiseTex, vUV);
        vec4 ui = texture2D(uTex, clamp(finalUV, 0.0, 1.0));
        
        // Смешивание: если UI-канал прозрачный, показываем шум
        gl_FragColor = mix(noise, ui, ui.a);
        gl_FragColor.a = 1.0; // Всегда непрозрачный выход
        
        // Виньетка для погружения
        float vign = 1.0 - 0.2 * pow(length(vUV - 0.5), 1.5);
        gl_FragColor.rgb *= vign;
        
        // Применяем opacity к шуму отдельно
        if (ui.a < 0.5) {
          gl_FragColor.rgb = mix(noise.rgb, gl_FragColor.rgb, uNoiseOpacity);
        }
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
    const uNoiseOpacityLoc = gl.getUniformLocation(prog, 'uNoiseOpacity');
    const uTimeLoc = gl.getUniformLocation(prog, 'uTime');
    const uGlitchLoc = gl.getUniformLocation(prog, 'uGlitch');

    gl.uniform1f(uDistLoc, DISTORTION);
    gl.uniform1f(uNoiseOpacityLoc, NOISE_OPACITY);

    // Текстура шума
    const noiseTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Текстура UI
    const uiTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, uiTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.uniform1i(gl.getUniformLocation(prog, 'uNoiseTex'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 1);

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
      // Обновляем текстуры
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, noiseTex);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, noiseCanvas); } catch(e) {}

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, uiTex);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas); } catch(e) {}

      const t = (performance.now() - start) * 0.001;
      gl.uniform1f(uTimeLoc, t);

      const gstate = window.__ADAM_GLITCH || { strength: 0, timer: 0 };
      const gval = (gstate.timer && gstate.timer > 0) ? Math.min(1.0, gstate.strength) : 0.0;
      gl.uniform1f(uGlitchLoc, gval);

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    render();

    // 🔧 Точное преобразование координат с учётом искажения
    function screenToSourceCoords(screenX, screenY) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      // Нормализуем в [-1, 1]
      let x = (screenX / vw) * 2 - 1;
      let y = (screenY / vh) * 2 - 1;
      
      // Обратное баррель-искажение
      const r = Math.hypot(x, y);
      if (r > 0) {
        const factor = 1 - DISTORTION + DISTORTION * r;
        x = x / factor;
        y = y / factor;
      }
      
      // Обратно в пиксели
      return {
        x: ((x + 1) * 0.5) * vw,
        y: ((1 - (y + 1) * 0.5)) * vh
      };
    }

    function toLocal(evt) {
      const rect = overlay.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      return screenToSourceCoords(x, y);
    }

    overlay.addEventListener('pointermove', (e) => {
      const p = toLocal(e);
      window.ADAM_UI.handlePointerMove(p.x, p.y);
    }, { passive: true });

    overlay.addEventListener('pointerdown', (e) => {
      const p = toLocal(e);
      window.ADAM_UI.handlePointer('pointerdown', p.x, p.y);
    });

    overlay.addEventListener('click', (e) => {
      const p = toLocal(e);
      window.ADAM_UI.handlePointer('click', p.x, p.y);
    });

    window.addEventListener('keydown', (e) => window.ADAM_UI.handleKey(e));

    window.__ADAM_OVERLAY = {
      triggerGlitch: (s, d) => window.ADAM_UI.triggerGlitch(s, d)
    };

    // Синхронизация таймера глитча
    setInterval(() => {
      if (window.__ADAM_GLITCH && window.__ADAM_GLITCH.timer > 0) {
        window.__ADAM_GLITCH.timer--;
        if (window.__ADAM_GLITCH.timer === 0) window.__ADAM_GLITCH.strength = 0;
      }
    }, 33);
  }
})();
