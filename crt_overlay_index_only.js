// crt_overlay_index_only_fixed.js — исправлена математика обратного искажения
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const DISTORTION = 0.32;

  let sourceCanvas = null;
  const checkInterval = setInterval(() => {
    sourceCanvas = document.getElementById('indexCanvas');
    if (sourceCanvas) {
      clearInterval(checkInterval);
      initOverlay();
    }
  }, 50);

  function initOverlay() {
    sourceCanvas.style.opacity = '0';
    sourceCanvas.style.pointerEvents = 'none';

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

    const gl = overlay.getContext('webgl', { antialias: false, alpha: true });
    if (!gl) return console.error('WebGL not available');

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
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
    gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const quad = new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1]);
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

    function render() {
      if (!sourceCanvas) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
      } catch (e) {}
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    render();

    // === ИСПРАВЛЕННАЯ МАТЕМАТИКА ОБРАТНОГО ИСКАЖЕНИЯ ===
    function screenToTexUV(clientX, clientY) {
      const rect = overlay.getBoundingClientRect();
      const vx = (clientX - rect.left) / rect.width;
      const vy = (clientY - rect.top) / rect.height;
      // нормализуем в [-1,1]
      let ux = vx * 2.0 - 1.0;
      let uy = vy * 2.0 - 1.0;
      const r = Math.hypot(ux, uy);
      // обратное искажение: uv = distorted / (1 + dist * (r - 1))
      const denom = 1.0 + DISTORTION * (r - 1.0);
      if (denom > 0) {
        ux = ux / denom;
        uy = uy / denom;
      }
      // переводим обратно в [0,1] для текстуры
      const finalX = (ux + 1.0) * 0.5;
      const finalY = (uy + 1.0) * 0.5;
      const srcRect = sourceCanvas.getBoundingClientRect();
      return {
        texX: Math.max(0, Math.min(1, finalX)),
        texY: Math.max(0, Math.min(1, finalY))
      };
    }

    function forwardEvent(originalEvent, eventType) {
      if (!sourceCanvas) return;
      const uv = screenToTexUV(originalEvent.clientX, originalEvent.clientY);
      const srcRect = sourceCanvas.getBoundingClientRect();
      const clientX = srcRect.left + uv.texX * srcRect.width;
      const clientY = srcRect.top + uv.texY * srcRect.height;
      const evt = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: clientX,
        clientY: clientY,
        button: originalEvent.button,
        buttons: originalEvent.buttons,
        ctrlKey: originalEvent.ctrlKey,
        shiftKey: originalEvent.shiftKey,
        altKey: originalEvent.altKey,
        metaKey: originalEvent.metaKey
      });
      sourceCanvas.dispatchEvent(evt);
    }

    overlay.addEventListener('mousemove', e => forwardEvent(e, 'mousemove'));
    overlay.addEventListener('mousedown', e => forwardEvent(e, 'mousedown'));
    overlay.addEventListener('mouseup', e => forwardEvent(e, 'mouseup'));
    overlay.addEventListener('click', e => forwardEvent(e, 'click'));
  }
})();
