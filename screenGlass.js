// screenGlass.js — чистый белый шум + плавный "сбой сигнала"
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.25);
  const canvas = document.createElement("canvas");
  canvas.id = "glassFX";
  Object.assign(canvas.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: "1" // под интерфейсом, над WebGL
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let w = 0, h = 0;
  function resize() {
    w = canvas.width = window.innerWidth * DPR;
    h = canvas.height = window.innerHeight * DPR;
  }
  window.addEventListener("resize", resize);
  resize();

  // === создаём 4 кадра настоящего белого шума ===
  const frames = [];
  const fw = Math.floor(w * 0.15);
  const fh = Math.floor(h * 0.15);
  for (let f = 0; f < 15; f++) {
    const c = document.createElement("canvas");
    c.width = fw; c.height = fh;
    const nctx = c.getContext("2d");
    const img = nctx.createImageData(fw, fh);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = Math.random() * 255;
      d[i] = d[i + 1] = d[i + 2] = n;
      d[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
    frames.push(c);
  }

  // === тонкие царапины ===
  const scratch = document.createElement("canvas");
  const sc = scratch.getContext("2d");
  scratch.width = w; scratch.height = h;
  const dens = 0.0013;
  for (let i = 0; i < w * h * dens; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const l = Math.random() * 40 + 20;
    const o = Math.random() * 0.08 + 0.03;
    sc.beginPath();
    sc.moveTo(x, y);
    sc.lineTo(x, y + l);
    sc.strokeStyle = `rgba(255,255,255,${o})`;
    sc.lineWidth = 0.5 * DPR;
    sc.stroke();
  }

  let t = 0;

  function render() {
    t++;
    ctx.clearRect(0, 0, w, h);

    // виньетка
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.8);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // фаза всплеска (12с цикл)
    const cycle = 720; // ~12 сек
    const phase = t % cycle;
    let spike = 1.0;
    if (phase < 180) spike = 1 + phase / 180;        // плавное усиление
    else if (phase < 360) spike = 2 - (phase - 180) / 180; // плавное затухание
    else spike = 1;

    // шум
    const frame = frames[Math.floor(t / 4) % 4];
    ctx.globalAlpha = 0.28 * spike;
    ctx.drawImage(frame, 0, 0, w, h);
    ctx.globalAlpha = 1;

    // царапины
    const offY = (t * 0.4) % h;
    ctx.drawImage(scratch, 0, offY - h, w, h);
    ctx.drawImage(scratch, 0, offY, w, h);

    // лёгкий бликовый градиент сверху
    const fl = 0.4 + Math.sin(t / 50) * 0.05;
    const lamp = ctx.createRadialGradient(w / 2, 0, h * 0.05, w / 2, 0, h * 0.6);
    lamp.addColorStop(0, `rgba(255,255,255,${0.04 * fl})`);
    lamp.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, w, h);

    requestAnimationFrame(render);
  }

  render();
})();
