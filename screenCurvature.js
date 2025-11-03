// screenCurvature.js — CRT curvature warp (distortion overlay, no glare)

(() => {
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: 0,
    width: '100%',
    height: '100%',
    zIndex: 100,
    pointerEvents: 'none',
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  function warp() {
    const imgData = ctx.getImageData(0, 0, w, h);
    const src = imgData.data;

    const temp = new Uint8ClampedArray(src);
    const cx = w / 2;
    const cy = h / 2;
    const strength = 0.0000025; // увеличь если хочешь сильнее изгиб

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Геометрическая выпуклость
        const offset = dist * dist * strength;

        const srcX = Math.round(x + dx * offset);
        const srcY = Math.round(y + dy * offset);

        if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
          const dstIndex = (y * w + x) * 4;
          const srcIndex = (srcY * w + srcX) * 4;
          src[dstIndex] = temp[srcIndex];
          src[dstIndex + 1] = temp[srcIndex + 1];
          src[dstIndex + 2] = temp[srcIndex + 2];
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  function render() {
    try {
      ctx.clearRect(0, 0, w, h);

      // Чуть затемняем края (эмуляция стекла без блика)
      const grd = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 0.85);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      warp();
    } catch (e) {
      console.warn('CRT warp error:', e);
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
