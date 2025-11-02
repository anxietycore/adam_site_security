// screenGlass.js — белый VHS-шум + периодический всплеск сигнала
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
    zIndex: "1" // под интерфейсом, над WebGL-фоном
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

  // --- четыре кадра шума ---
  const frames = [];
  const fw = Math.floor(w * 0.25);
  const fh = Math.floor(h * 0.25);
  for (let f = 0; f < 4; f++) {
    const ncv = document.createElement("canvas");
    ncv.width = fw; ncv.height = fh;
    const nctx = ncv.getContext("2d");
    const img = nctx.createImageData(fw, fh);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = Math.random() * 255;
      d[i] = d[i + 1] = d[i + 2] = n; // белый шум
      d[i + 3] = 200;                 // плотность
    }
    nctx.putImageData(img, 0, 0);
    frames.push(ncv);
  }

  // --- статические царапины ---
  const scratch = document.createElement("canvas");
  const sc = scratch.getContext("2d");
  scratch.width = w; scratch.height = h;
  const dens = 0.0013;
  for (let i = 0; i < w * h * dens; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const l = Math.random() * 40 + 20;
    const o = Math.random() * 0.1 + 0.05;
    sc.beginPath();
    sc.moveTo(x, y);
    sc.lineTo(x, y + l);
    sc.strokeStyle = `rgba(220,255,220,${o})`;
    sc.lineWidth = 0.6 * DPR;
    sc.stroke();
  }

  let t = 0;
  let spike = 0;

  function render() {
    t++;
    ctx.clearRect(0, 0, w, h);

    // виньетка
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.8);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // вычисляем силу всплеска (раз в ~12 сек)
    if (t % 720 === 0) spike = 1.0;
    if (spike > 0) spike *= 0.85; // быстро гаснет

    // шум
    const frame = frames[Math.floor(t / 4) % 4];
    const baseAlpha = 0.25 + spike * 0.5; // всплеск усиливает альфу
    ctx.globalAlpha = baseAlpha;
    ctx.drawImage(frame, 0, 0, w, h);
    ctx.globalAlpha = 1;

    // царапины
    const offY = (t * 0.4) % h;
    ctx.drawImage(scratch, 0, offY - h, w, h);
    ctx.drawImage(scratch, 0, offY, w, h);

    // лампа
    const fl = 0.4 + Math.sin(t / 50) * 0.05;
    const lamp = ctx.createRadialGradient(w / 2, 0, h * 0.05, w / 2, 0, h * 0.6);
    lamp.addColorStop(0, `rgba(255,255,255,${0.05 * fl})`);
    lamp.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, w, h);

    requestAnimationFrame(render);
  }

  render();
})();
