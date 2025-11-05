// screenCurvature_gl.js
// Требует html2canvas (подключаем CDN перед этим скриптом).
// Делает снимок body -> загружает как WebGL текстуру -> применяет barrel distortion shader.
// Автор: твой помощник. Настройки — дальше в коде.

(() => {
  // Настройки (подправь при необходимости)
  const UPDATE_INTERVAL = 700; // мс — как часто обновлять снимок (700ms — достаточно)
  const MAX_DOWNSCALE = 1;     // уменьшение размера снимка для производительности (1 = оригинал, 0.7 уменьшить)
  const DISTORTION_STRENGTH = 0.35; // 0..1 - сила изгиба (0.35 — мягко, 0.6 — сильно)

  // Создаём overlay canvas (полноэкранный) — поверх всего
  const overlay = document.createElement('canvas');
  overlay.id = 'crt-curvature-canvas';
  overlay.style.position = 'fixed';
  overlay.style.left = '0';
  overlay.style.top = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '99999';
  overlay.style.mixBlendMode = 'normal';
  document.body.appendChild(overlay);

  // WebGL контекст
  const gl = overlay.getContext('webgl') || overlay.getContext('experimental-webgl');
  if (!gl) {
    console.warn('WebGL не доступен — CRT изгиб отключён.');
    return;
  }

  // Подгонка размера канваса под устройство (CSS -> pixels)
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(window.innerWidth * dpr));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (overlay.width !== width || overlay.height !== height) {
      overlay.width = width;
      overlay.height = height;
      gl.viewport(0, 0, width, height);
    }
  }
  resizeCanvas();
  window.addEventListener('resize', () => { resizeCanvas(); scheduleCapture(); });

  // Вершинный шейдер (простая full-screen quad)
  const vsSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // Фрагментный шейдер — barrel distortion
  const fsSource = `
    precision mediump float;
    uniform sampler2D u_tex;
    uniform float u_strength;
    uniform vec2 u_resolution;
    varying vec2 v_uv;

    // Barrel distortion function
    vec2 barrel(vec2 uv, float amt) {
      // центрирование
      vec2 cc = uv - 0.5;
      float dist = length(cc);
      // коэффициент (настраиваем форму)
      float k = 1.0 + amt * (dist * dist);
      return 0.5 + cc / k;
    }

    void main() {
      vec2 uv = v_uv;
      vec2 d = barrel(uv, u_strength);
      // если вышли за область, просто сдвигаем в сторону края
      if (d.x < 0.0 || d.x > 1.0 || d.y < 0.0 || d.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      } else {
        vec4 color = texture2D(u_tex, d);
        gl_FragColor = color;
      }
    }
  `;

  // Утилиты: компиляция шейдера / линковка программы
  function compileShader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function createProgram(vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  const vs = compileShader(gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return;
  const program = createProgram(vs, fs);
  gl.useProgram(program);

  // Атрибуты / uniform'ы
  const posLoc = gl.getAttribLocation(program, 'a_position');
  const strengthLoc = gl.getUniformLocation(program, 'u_strength');
  const resLoc = gl.getUniformLocation(program, 'u_resolution');
  const texLoc = gl.getUniformLocation(program, 'u_tex');

  // Fullscreen quad
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  const quadVerts = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Текстура для снимка
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // стартовые параметры
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Функция отрисовки: рендерим quad с текстурой
  function render() {
    resizeCanvas();
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.uniform1f(strengthLoc, DISTORTION_STRENGTH);
    gl.uniform2f(resLoc, overlay.width, overlay.height);

    // Текстурный юнит 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(texLoc, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // Захват текущей страницы в изображение и загрузка в текстуру
  let lastCapture = 0;
  let scheduled = false;
  function captureAndUpload() {
    scheduled = false;
    // делаем снимок всей страницы (body)
    const scale = MAX_DOWNSCALE;
    html2canvas(document.body, { scale: scale, useCORS: true }).then(canvas => {
      // загружаем картинку в WebGL текстуру
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // flipped because html2canvas и текстурные координаты совпадают — не нужно переворачивать
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      } catch (e) {
        console.error('Ошибка загрузки текстуры:', e);
      }
      render();
      lastCapture = performance.now();
    }).catch(err => {
      console.error('html2canvas error:', err);
    });
  }

  // Планирование захвата с интервалом
  let intervalId = null;
  function scheduleCapture() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      captureAndUpload();
      // далее повторяем каждые UPDATE_INTERVAL
      if (intervalId === null) {
        intervalId = setInterval(captureAndUpload, UPDATE_INTERVAL);
      }
    }, 50);
  }

  // Первый захват
  scheduleCapture();

  // Если много перфоманса — можно вручную остановить обновления
  // Добавим слушатель видимости: если вкладка неактивна — стопим интервалы
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
    } else {
      if (intervalId === null) { scheduleCapture(); }
    }
  });

  // Немного UX: если пользователь хочет выключить эффект — нажать клавишу "c"
  let enabled = true;
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'c') {
      enabled = !enabled;
      overlay.style.display = enabled ? 'block' : 'none';
    }
  });

})();
