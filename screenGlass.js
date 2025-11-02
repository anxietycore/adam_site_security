// screenGlass.js — чистое аналоговое стекло с VHS шумом и мягким бликом
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.25);
  const canvas = document.createElement("canvas");
  canvas.id = "glassFX";
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "1"; // под интерфейсом, но над WebGL
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  let w = 0, h = 0;
  const resize = () => {
    w = canvas.width = window.innerWidth * DPR;
    h = canvas.height = window.innerHeight * DPR;
  };
  window.addEventListener("resize", resize);
  resize();

  const SCRATCH_DENSITY = 0.0018;
  const scratches = [];
  for (let i = 0; i < w * h * SCRATCH_DENSITY; i++) {
    scratches.push({
      x: Math.random() * w,
      y: Math.random() * h,
      l: Math.random() * 50 + 20,
      s: Math.random() * 0.3 + 0.2,
      o: Math.random() * 0.15 + 0.05
    });
  }

  let t = 0;
  function draw() {
    t += 1;

    ctx.clearRect(0, 0, w, h);

    // Виньетка
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.8);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // VHS шум по краям
    const noiseSize = 0.4; // зона шума по краям
    const imgData = ctx.createImageData(w, h);
    const d = imgData.data;
    for (let y = 0; y < h; y++) {
      const edgeFactor = Math.min(y / (h * noiseSize), (h - y) / (h * noiseSize), 1);
      for (let x = 0; x < w; x++) {
        const xf = Math.min(x / (w * noiseSize), (w - x) / (w * noiseSize), 1);
        const fade = Math.min(edgeFactor, xf);
        if (fade < 0.8) {
          const i = (y * w + x) * 4;
          const n = Math.random() * 255;
          d[i] = d[i + 1] = d[i + 2] = n * (0.25 + (0.75 - fade));
          d[i + 3] = 255 * (0.25 + (0.5 - fade));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Царапины — тонкие, редкие
    ctx.lineWidth = 0.6 * DPR;
    for (const s of scratches) {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x, s.y + s.l);
      ctx.strokeStyle = `rgba(200,255,200,${s.o})`;
      ctx.stroke();
      s.y += s.s;
      if (s.y > h) s.y = -s.l;
    }

    // Отблеск от лампы (мягкий)
    const flicker = 0.4 + Math.sin(t / 50) * 0.05;
    const lampGrad = ctx.createRadialGradient(w / 2, 0, h * 0.05, w / 2, 0, h * 0.6);
    lampGrad.addColorStop(0, `rgba(255,255,255,${0.05 * flicker})`);
    lampGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = lampGrad;
    ctx.fillRect(0, 0, w, h);

    // Периодическое лёгкое мерцание
    if (t % 600 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(0, 0, w, h);
    }

    requestAnimationFrame(draw);
  }

  draw();
})();
