// screenCurvature.js
// CRT-style convex screen illusion without touching DOM or text clarity
// Creates a gentle barrel distortion & vignette on a transparent canvas overlay

(() => {
  const overlay = document.createElement('canvas');
  overlay.id = 'crt-curvature-overlay';
  overlay.style.position = 'fixed';
  overlay.style.left = '0';
  overlay.style.top = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '9999';
  overlay.style.mixBlendMode = 'overlay'; // subtle blending
  overlay.style.opacity = '0.55';
  document.body.appendChild(overlay);

  const ctx = overlay.getContext('2d');
  const DPR = window.devicePixelRatio || 1;

  function resize() {
    overlay.width = window.innerWidth * DPR;
    overlay.height = window.innerHeight * DPR;
    ctx.scale(DPR, DPR);
  }

  resize();
  window.addEventListener('resize', resize);

  function drawCurvature() {
    const w = overlay.width / DPR;
    const h = overlay.height / DPR;
    const centerX = w / 2;
    const centerY = h / 2;
    const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);

    // очистка
    ctx.clearRect(0, 0, w, h);

    // лёгкое затемнение краёв — имитация стекла
    const vignette = ctx.createRadialGradient(centerX, centerY, w * 0.2, centerX, centerY, w * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // эффект выпуклости: светлая "бочка" в центре
    const curve = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, w * 0.8);
    curve.addColorStop(0, 'rgba(255,255,255,0.07)');
    curve.addColorStop(0.4, 'rgba(255,255,255,0.03)');
    curve.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = curve;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    // шум по краям — тот “песок”, который ты хотел оставить
    const noiseDensity = 0.15; // уменьшить = меньше песка
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const x = ((i / 4) % w);
      const y = Math.floor((i / 4) / w);
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      if (dist > 0.75 && Math.random() < noiseDensity * dist) {
        const val = 50 + Math.random() * 205;
        d[i] = d[i+1] = d[i+2] = val;
        d[i+3] = 80;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  drawCurvature();
})();
