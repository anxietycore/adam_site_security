// screenCurvature.js — CRT curvature + glass reflection effect (analog style)
(() => {
  const target = document.getElementById('terminal');
  if (!target) return console.warn('[curvature] #terminal not found');

  // создаём слой
  const canvas = document.createElement('canvas');
  canvas.id = 'crtCurvature';
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '2', // над шумом, но под интерфейсом
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let w = 0, h = 0;
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // временный offscreen-canvas
  const off = document.createElement('canvas');
  const octx = off.getContext('2d');

  function drawCurved() {
    const rect = target.getBoundingClientRect();
    const tw = Math.floor(rect.width);
    const th = Math.floor(rect.height);
    if (tw < 10 || th < 10) return;

    off.width = tw;
    off.height = th;

    // копируем содержимое DOM-элемента как картинку
    html2canvas(target, {
      backgroundColor: null,
      scale: 1,
      logging: false,
      useCORS: true
    }).then(canvasSrc => {
      octx.clearRect(0, 0, tw, th);
      octx.drawImage(canvasSrc, 0, 0, tw, th);

      const img = octx.getImageData(0, 0, tw, th);
      const src = img.data;

      const dest = ctx.getImageData(0, 0, w, h);
      const dst = dest.data;

      // масштаб под экран
      const scaleX = w / tw;
      const scaleY = h / th;
      const scale = Math.min(scaleX, scaleY);

      // искажение — параболическая кривизна
      const cx = w / 2, cy = h / 2;
      const strength = 0.22; // сила выпуклости

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = (x - cx) / cx;
          const ny = (y - cy) / cy;
          const r2 = nx*nx + ny*ny;
          const fx = nx * (1 + strength * r2);
          const fy = ny * (1 + strength * r2);
          const sx = (fx * cx + cx) / scale;
          const sy = (fy * cy + cy) / scale;

          if (sx >= 0 && sy >= 0 && sx < tw && sy < th) {
            const si = ((sy | 0) * tw + (sx | 0)) * 4;
            const di = (y * w + x) * 4;
            dst[di] = src[si];
            dst[di+1] = src[si+1];
            dst[di+2] = src[si+2];
            dst[di+3] = 255;
          }
        }
      }

      // отрисовываем искажённый результат
      ctx.putImageData(dest, 0, 0);

      // лёгкий центральный блик
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, w/1.2);
      grd.addColorStop(0, 'rgba(255,255,255,0.05)');
      grd.addColorStop(0.4, 'rgba(255,255,255,0.02)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      // лёгкая тень по краям (выпуклость)
      const edge = ctx.createRadialGradient(cx, cy, w*0.2, cx, cy, w*0.9);
      edge.addColorStop(0.7, 'rgba(0,0,0,0)');
      edge.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // периодическое обновление (примерно раз в секунду)
  setInterval(drawCurved, 1000);

  console.info('screenCurvature.js initialized — CRT barrel distortion active');
})();
