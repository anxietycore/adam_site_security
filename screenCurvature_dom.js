document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.getElementById('crt-wrapper');
  if (!wrapper) return;

  wrapper.classList.add('curved');

  const updateScale = () => {
    const w = Math.max(window.innerWidth, 800);
    let scale = Math.round(Math.min(80, w * 0.01)); // уменьшаем силу!
    if (scale < 6) scale = 6;
    if (scale > 30) scale = 30; // максимум 30 для стабильности DOM
    const fdm = document.querySelector('#barrelFilter feDisplacementMap');
    if (fdm) fdm.setAttribute('scale', String(scale));
  };

  updateScale();
  window.addEventListener('resize', updateScale);
});
