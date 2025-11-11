// crt_overlay_index_only.js — overlay с искажением + форвардингом событий
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const DISTORTION = 0.32;

  // ждём indexCanvas
  let attempts = 0;
  const checkInterval = setInterval(() => {
    const sourceCanvas = document.getElementById('indexCanvas');
    if (sourceCanvas) {
      clearInterval(checkInterval);
      initOverlay(sourceCanvas);
    } else if (++attempts > 50) {
      clearInterval(checkInterval);
      console.warn('indexCanvas not found after 50 attempts');
    }
  }, 100);

  function initOverlay(sourceCanvas) {
    // Скрываем визуал оригинального canvas, но оставляем его рендерить и принимать programmatic events
    sourceCanvas.style.opacity = '0';      // визуально невидим, но рендерится и доступен для событий
    sourceCanvas.style.pointerEvents = 'none'; // мы будем форвардить события вручную

    const overlay = document.createElement('canvas');
    overlay.id = 'crtOverlayIndex';
    Object.assign(overlay.style, {
      position: 'fixed',
      left: '0', top: '0',
      width: '100vw', height: '100vh',
      zIndex: '1000',
      pointerEvents: 'auto',   // ловим события здесь
      display: 'block'
    });
    document.body.appendChild(overlay);

    // webgl с альфой, чтобы фон (шум, scanline div и т.д.) был виден
    const gl = overlay.getContext('webgl', { antialias: false, alpha: true });
    if (!gl) {
      console.error('WebGL not available');
      return;
    }

    gl.clearColor(0, 0, 0, 0);

    // vertex + fragment
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
      void main() {
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
      console.error(gl.getProgramInfoLog(prog));
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
    gl.uniform1f(uDistLoc, DISTORTION);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Размеры
    function resize() {
      const cw = Math.max(1, overlay.clientWidth);
      const ch = Math.max(1, overlay.clientHeight);
      overlay.width = Math.floor(cw * DPR);
      overlay.height = Math.floor(ch * DPR);
      overlay.style.width = cw + 'px';
      overlay.style.height = ch + 'px';
      gl.viewport(0, 0, overlay.width, overlay.height);
    }
    window.addEventListener('resize', resize);
    resize();

    // Рендер: копируем источник в текстуру и рисуем искажение
    function render() {
      if (!sourceCanvas) return;
      // обновляем текстуру из source (source может быть скрыт визуально, но он рендерится)
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
      } catch (e) {
        // некоторые браузеры могут кидать если размеры 0, игнорируем
      }
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    render();

    // --- Форвардинг событий ---
    // Принцип: при событии на overlay вычисляем vUV = (clientX/clientWidth, clientY/clientHeight)
    // затем повторяем ту же математику из шейдера, чтобы найти координату в текстуре (sourceCanvas).
    // и создаем ивент на sourceCanvas с клиентскими координатами, соответствующими sourceCanvas.
    function screenToTexUV(clientX, clientY) {
      const rect = overlay.getBoundingClientRect();
      // нормализуем в [0,1]
      const vx = (clientX - rect.left) / rect.width;
      const vy = (clientY - rect.top) / rect.height;
      // vUV -> uv in [-1,1]
      const ux = vx * 2.0 - 1.0;
      const uy = vy * 2.0 - 1.0;
      const r = Math.hypot(ux, uy);
      const s = 1.0 - DISTORTION + DISTORTION * r;
      // distorted = uv * s
      const dx = ux * s;
      const dy = uy * s;
      // finalUV = (distorted + 1)/2 ; then shader did finalUV.y = 1.0 - finalUV.y before sampling
      const finalX = (dx + 1.0) * 0.5;
      const finalY = (dy + 1.0) * 0.5;
      const texX = finalX;
      const texY = 1.0 - finalY; // flipped
      return { texX: clamp(texX, 0, 1), texY: clamp(texY, 0, 1) };
    }

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function forwardMouseEvent(originalEvent, eventType) {
      if (!sourceCanvas) return;
      const uv = screenToTexUV(originalEvent.clientX, originalEvent.clientY);
      const srcRect = sourceCanvas.getBoundingClientRect();
      // client coords on sourceCanvas
      const clientX = srcRect.left + uv.texX * srcRect.width;
      const clientY = srcRect.top + uv.texY * srcRect.height;

      // Если sourceCanvas получает реальные events from user normally, it uses clientX/clientY.
      const evt = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: clientX,
        clientY: clientY,
        screenX: window.screenX + clientX,
        screenY: window.screenY + clientY,
        button: originalEvent.button,
        buttons: originalEvent.buttons,
        ctrlKey: originalEvent.ctrlKey,
        shiftKey: originalEvent.shiftKey,
        altKey: originalEvent.altKey,
        metaKey: originalEvent.metaKey
      });
      sourceCanvas.dispatchEvent(evt);
    }

    // For touch events support (mobile) — map first touch
    function forwardTouchEvent(originalEvent, type) {
      if (!sourceCanvas) return;
      if (!originalEvent.touches || originalEvent.touches.length === 0) {
        // use changedTouches fallback
        const list = originalEvent.changedTouches || [];
        if (list.length === 0) return;
        const t = list[0];
        const uv = screenToTexUV(t.clientX, t.clientY);
        const srcRect = sourceCanvas.getBoundingClientRect();
        const clientX = srcRect.left + uv.texX * srcRect.width;
        const clientY = srcRect.top + uv.texY * srcRect.height;
        const simulated = new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: [],
          targetTouches: [],
          changedTouches: [new Touch({
            identifier: Date.now(),
            target: sourceCanvas,
            clientX: clientX,
            clientY: clientY,
            screenX: clientX,
            screenY: clientY,
            pageX: clientX,
            pageY: clientY
          })]
        });
        sourceCanvas.dispatchEvent(simulated);
        return;
      }
      // for simplicity forward only first touch point
      const t = originalEvent.touches[0];
      const uv = screenToTexUV(t.clientX, t.clientY);
      const srcRect = sourceCanvas.getBoundingClientRect();
      const clientX = srcRect.left + uv.texX * srcRect.width;
      const clientY = srcRect.top + uv.texY * srcRect.height;
      const simulated = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: [new Touch({
          identifier: Date.now(),
          target: sourceCanvas,
          clientX: clientX,
          clientY: clientY,
          screenX: clientX,
          screenY: clientY,
          pageX: clientX,
          pageY: clientY
        })],
        targetTouches: [],
        changedTouches: []
      });
      sourceCanvas.dispatchEvent(simulated);
    }

    // capture mousemove, mousedown, mouseup, click and forward
    overlay.addEventListener('mousemove', (e) => { forwardMouseEvent(e, 'mousemove'); });
    overlay.addEventListener('mousedown', (e) => { forwardMouseEvent(e, 'mousedown'); });
    overlay.addEventListener('mouseup', (e) => { forwardMouseEvent(e, 'mouseup'); });
    overlay.addEventListener('click', (e) => { forwardMouseEvent(e, 'click'); });

    // pointer events as fallback
    overlay.addEventListener('pointermove', (e) => { forwardMouseEvent(e, 'mousemove'); });
    overlay.addEventListener('pointerdown', (e) => { forwardMouseEvent(e, 'mousedown'); });
    overlay.addEventListener('pointerup', (e) => { forwardMouseEvent(e, 'mouseup'); });

    // touch forwarding (basic)
    overlay.addEventListener('touchstart', (e) => { forwardTouchEvent(e, 'touchstart'); e.preventDefault(); }, { passive: false });
    overlay.addEventListener('touchmove', (e) => { forwardTouchEvent(e, 'touchmove'); e.preventDefault(); }, { passive: false });
    overlay.addEventListener('touchend', (e) => { forwardTouchEvent(e, 'touchend'); e.preventDefault(); }, { passive: false });

    // доп. — если кто-то (другой код) пытается выставить pointer-events:none на overlay - восстановим
    const obs = new MutationObserver(() => {
      if (overlay && overlay.style && overlay.style.pointerEvents !== 'auto') {
        overlay.style.pointerEvents = 'auto';
      }
    });
    obs.observe(overlay, { attributes: true, attributeFilter: ['style'] });

    // Для отладки:
    // window._crtOverlay = { overlay, sourceCanvas, gl };
  }
})();
