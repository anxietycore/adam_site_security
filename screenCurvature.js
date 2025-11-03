// screenCurvature.js — CRT curvature overlay (no DOM snapshot, no html2canvas, no reflections)

(() => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  Object.assign(canvas.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 999,
    pointerEvents: "none",
  });

  document.body.appendChild(canvas);

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  function render() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Тёмная виньетка по краям (оптическая выпуклость)
    const vignette = ctx.createRadialGradient(
      w / 2,
      h / 2,
      w * 0.3,
      w / 2,
      h / 2,
      w * 0.9
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.7, "rgba(0,0,0,0.08)");
    vignette.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // Геометрическое искажение: затемнение углов как будто экран выгнут
    const gradX = ctx.createLinearGradient(0, 0, w, 0);
    gradX.addColorStop(0, "rgba(0,0,0,0.25)");
    gradX.addColorStop(0.5, "rgba(0,0,0,0)");
    gradX.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = gradX;
    ctx.fillRect(0, 0, w, h);

    const gradY = ctx.createLinearGradient(0, 0, 0, h);
    gradY.addColorStop(0, "rgba(0,0,0,0.2)");
    gradY.addColorStop(0.5, "rgba(0,0,0,0)");
    gradY.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = gradY;
    ctx.fillRect(0, 0, w, h);

    requestAnimationFrame(render);
  }

  render();
})();
