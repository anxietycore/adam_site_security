// crt_overlay_index.js — полноценный barrel distortion для index.html
// Работает точно так же, как для терминала, но захватывает всю страницу

(() => {
  // Константы — идентичные terminal-версии
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.32;
  const FPS = 30;

  // Ищем canvas для захвата
  // На index.html нет terminalCanvas, поэтому будем захватывать document.body
  const sourceCanvas = (() => {
    // Пробуем найти terminalCanvas (на всякий случай)
    let c = document.getElementById('terminalCanvas');
    if (c) return c;
    
    // Создаём скрытый canvas для захвата страницы
    const capture = document.createElement('canvas');
    capture.id = 'captureCanvas';
    Object.assign(capture.style, {
      position: 'fixed',
      top: '-9999px',
      left: '-9999px',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none'
    });
    document.body.appendChild(capture);
    return capture;
  })();

  // Основной overlay canvas
  const overlay = document.createElement('canvas');
  overlay.id = 'crtOverlayCanvas';
  Object.assign(overlay.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '1000',
    pointerEvents: 'none'
  });
  document.body.appendChild(overlay);

  const gl = overlay.getContext('webgl', { antialias: false });
  if (!gl) {
    console.warn('WebGL не поддерживается — изгиб отключён');
    return;
  }

  // Шейдеры — ИДЕНТИЧНЫ terminal-версии
  const vertexShaderSource = `
    attribute vec2 aPos;
    attribute vec2 aUV;
    varying vec2 vUV;
    void main() {
      vUV = aUV;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
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

  function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compileShader(vertexShaderSource, gl.VERTEX_SHADER));
  gl.attachShader(program, compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program error:', gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  // Квад
  const quadVertices = new Float32Array([
    -1, -1,  0, 0,
     1, -1,  1, 0,
    -1,  1,  0, 1,
     1,  1,  1, 1
  ]);
  
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(program, 'aPos');
  const aUV = gl.getAttribLocation(program, 'aUV');
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);

  const uDist = gl.getUniformLocation(program, 'uDist');
  gl.uniform1f(uDist, DISTORTION);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Ресайз
  function resize() {
    overlay.width = Math.floor(window.innerWidth * DPR);
    overlay.height = Math.floor(window.innerHeight * DPR);
    gl.viewport(0, 0, overlay.width, overlay.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // Захват страницы
  function capturePage() {
    try {
      // Если есть terminalCanvas — используем его напрямую
      if (sourceCanvas.id === 'terminalCanvas') {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
        return;
      }

      // Для index.html — делаем скриншот document.body
      // Рисуем на скрытом canvas, затем используем его как текстуру
      const ctx = sourceCanvas.getContext('2d', { alpha: true });
      
      // Устанавливаем размеры
      const width = Math.floor(window.innerWidth * DPR);
      const height = Math.floor(window.innerHeight * DPR);
      
      if (sourceCanvas.width !== width || sourceCanvas.height !== height) {
        sourceCanvas.width = width;
        sourceCanvas.height = height;
      }

      // Очищаем и делаем скриншот
      ctx.clearRect(0, 0, width, height);
      
      // Пытаемся нарисовать содержимое страницы
      // Это самый надёжный метод для index.html
      const html Element = document.documentElement;
      const body = document.body;
      
      // Создаём временный контейнер для рендеринга
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.top = '0';
      tempDiv.style.left = '0';
      tempDiv.style.width = width + 'px';
      tempDiv.style.height = height + 'px';
      tempDiv.style.overflow = 'hidden';
      tempDiv.style.zIndex = '-9999';
      
      // Клонируем видимую часть body
      const clonedBody = body.cloneNode(true);
      // Удаляем из клона наш overlay, чтобы не было рекурсии
      const overlayClone = clonedBody.querySelector('#crtOverlayCanvas');
      if (overlayClone) overlayClone.remove();
      const captureClone = clonedBody.querySelector('#captureCanvas');
      if (captureClone) captureClone.remove();
      
      tempDiv.appendChild(clonedBody);
      document.body.appendChild(tempDiv);
      
      // Рендерим в canvas
      try {
        // Это не всегда работает с кросс-доменными стилями, но для index.html должен работать
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);
        
        // Рисуем DOM
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <foreignObject width="100%" height="100%">
              ${new XMLSerializer().serializeToString(htmlElement)}
            </foreignObject>
          </svg>
        `;
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
          document.body.removeChild(tempDiv);
          // Теперь используем canvas как текстуру
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
        };
        img.onerror = () => {
          // Если не получилось — просто рисуем прямоугольники
          document.body.removeChild(tempDiv);
          drawFallbackScene(ctx, width, height);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      } catch (e) {
        // Резервный метод — рисуем вручную
        document.body.removeChild(tempDiv);
        drawFallbackScene(ctx, width, height);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
      }
    } catch (e) {
      console.warn('capturePage error:', e);
    }
  }

  // Резервный рендер для index.html
  function drawFallbackScene(ctx, width, height) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // Рисуем логотип A.D.A.M. (как в index.html)
    ctx.font = `${12 * DPR}px 'Press Start 2P', monospace`;
    ctx.fillStyle = '#00FF41';
    const logo = `
\\    _ \\    \\     \\  | 
   _ \\   |  |  _ \\   |\\/ | 
 _/  _\\ ___/ _/  _\\ _|  _|`;
    const lines = logo.split('\n');
    const startY = height / 2 - 60 * DPR;
    lines.forEach((line, i) => {
      ctx.fillText(line, (width - ctx.measureText(line).width) / 2, startY + i * 16 * DPR);
    });
    
    // Добавляем текст "СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ"
    ctx.font = `${11 * DPR}px 'Press Start 2P', monospace`;
    const text = '> СИСТЕМА A.D.A.M. ГОТОВА К ЗАПУСКУ';
    const textWidth = ctx.measureText(text).width;
    ctx.fillText(text, (width - textWidth) / 2, startY + 80 * DPR);
    
    // Кнопка (упрощённо)
    ctx.strokeStyle = '#00FF41';
    ctx.lineWidth = 2 * DPR;
    const btnX = width / 2 - 100 * DPR;
    const btnY = startY + 110 * DPR;
    const btnW = 200 * DPR;
    const btnH = 40 * DPR;
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    ctx.fillText('ЗАПУСТИТЬ СИСТЕМУ', width / 2 - 80 * DPR, btnY + 24 * DPR);
  }

  // Анимация
  let lastFrame = 0;
  function render(timestamp) {
    const delta = timestamp - lastFrame;
    if (delta >= (1000 / FPS)) {
      lastFrame = timestamp;
      capturePage();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // Очистка при выходе со страницы
  window.addEventListener('beforeunload', () => {
    if (overlay) overlay.remove();
    if (sourceCanvas && sourceCanvas.id === 'captureCanvas') sourceCanvas.remove();
  });
})();
