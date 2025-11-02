// screenGlass.js — гибридный VHS-шум без лагов
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
  canvas.style.zIndex = "1"; // над фоном, под интерфейсом
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let w = 0, h = 0;
  const resize = () => {
    w = canvas.width = window.innerWidth * DPR;
    h = canvas.height = window.innerHeight * DPR;
  };
  window.addEventListener("resize", resize);
  resize();

  // === подготовка статичных слоёв ===
  // создаём 4 «кадра» VHS-шума
  const frames = [];
  const fw = Math.floor(w * 0.25);
  const fh = Math.floor(h * 0.25);
  for (let f = 0; f < 4; f++) {
    const noiseCanvas = document.createElement("canvas");
    noiseCanvas.width = fw;
    noiseCanvas.height = fh;
    const nctx = noiseCanvas.getContext("2d");
    const imgData = nctx.createImageData(fw, fh);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = Math.random() * 255;
      d[i] = d[i + 1] = d[i + 2] = n;
      d[i + 3] = Math.random() * 160 + 60;
    }
    nctx.putImageData(imgData, 0, 0);
    frames.push(noiseCanvas);
  }

  // царапины
  const scratchCanvas = document.createElement("canvas");
  const sc = scratchCanvas.getContext("2d");
  scratchCanvas.width = w;
  scratchCanvas.height = h;
  const SCRATCH_DENSITY = 0.0015;
  for (let i = 0; i < w * h * SCRATCH_DENSITY; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const l = Math.random() * 40 + 20;
    const o = Math.random() * 0.1 + 0.05;
    sc.beginPath();
    sc.moveTo(x, y);
    sc.lineTo(x, y + l);
    sc.strokeStyle = `rgba(180,255,180,${o})`;
    sc.lineWidth = 0.6 * DPR;
    sc.stroke();
  }

  let t = 0;

  function render() {
    t++;
    ctx.clearRect(0, 0, w, h);

    // виньетка
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.8);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // шум — циклические кадры
    const frame = frames[Math.floor(t / 4) % 4];
    ctx.globalAlpha = 0.28;
    ctx.drawImage(frame, 0, 0, w, h);
    ctx.globalAlpha = 1;

    // царапины
    const offsetY = (t * 0.4) % h;
    ctx.drawImage(scratchCanvas, 0, offsetY - h, w, h);
    ctx.drawImage(scratchCanvas, 0, offsetY, w, h);

    // лампа
    const flicker = 0.4 + Math.sin(t / 50) * 0.05;
    const lampGrad = ctx.createRadialGradient(w / 2, 0, h * 0.05, w / 2, 0, h * 0.6);
    lampGrad.addColorStop(0, `rgba(255,255,255,${0.05 * flicker})`);
    lampGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = lampGrad;
    ctx.fillRect(0, 0, w, h);

    // редкое лёгкое мерцание
    if (t % 600 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(0, 0, w, h);
    }

    requestAnimationFrame(render);
  }

  render();
})();
