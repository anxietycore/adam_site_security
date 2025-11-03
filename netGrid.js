// netGrid.js — мини-карта сети + нижний статус

(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.25);

  // === создаём canvas ===
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "200px",
    height: "200px",
    pointerEvents: "none",
    zIndex: "5",
    opacity: "0.8",
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let w = 0, h = 0;
  function resize() {
    w = canvas.width = 200 * DPR;
    h = canvas.height = 200 * DPR;
  }
  window.addEventListener("resize", resize);
  resize();

  // === создаём узлы ===
  const nodes = [];
  const count = 10;
  for (let i = 0; i < count; i++) {
    nodes.push({
      x: Math.random() * w,
      y: Math.random() * h,
      phase: Math.random() * Math.PI * 2,
      speed: 0.01 + Math.random() * 0.015
    });
  }

  // === связь ===
  function drawConnections() {
    ctx.strokeStyle = "rgba(0,255,100,0.08)";
    ctx.lineWidth = 1 * DPR;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 90 * DPR) {
          const alpha = 0.12 - dist / (90 * DPR * 1.1);
          ctx.strokeStyle = `rgba(0,255,100,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
  }

  // === узлы ===
  function drawNodes() {
    for (const n of nodes) {
      const pulse = (Math.sin(n.phase) + 1) * 0.5;
      const r = 2.5 * DPR + pulse * 1.5 * DPR;
      const g = 180 + pulse * 75;
      ctx.fillStyle = `rgba(0,${g},0,0.85)`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      n.phase += n.speed;
    }
  }

  // === анимация ===
  function render() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, w, h);

    drawConnections();
    drawNodes();

    requestAnimationFrame(render);
  }
  render();

  // === статус-блок ===
  const status = document.createElement("div");
  Object.assign(status.style, {
    position: "fixed",
    bottom: "10px",
    left: "20px",
    fontFamily: "monospace",
    fontSize: "13px",
    color: "#00ff9c",
    textShadow: "0 0 6px rgba(0,255,100,0.5)",
    letterSpacing: "0.5px",
    zIndex: "6",
    opacity: "0.85",
    userSelect: "none"
  });
  document.body.appendChild(status);

  function updateStatus() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");

    const timeStr = `${dd}.${mm}.${yyyy} | ${hh}:${min}:${ss}`;
    status.innerText = `SESSION: 00:19:47  |  USER: OPERATOR  |  ${timeStr}`;
  }
  updateStatus();
  setInterval(updateStatus, 1000);

})();
