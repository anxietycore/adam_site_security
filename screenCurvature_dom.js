// screenCurvature_dom.js
document.addEventListener('DOMContentLoaded', () => {
  // Какие элементы мы хотим "гнуть" — стартуем с terminal + фоновый canvas + весь body
  const targets = [];
  const term = document.getElementById('terminal');
  const shader = document.getElementById('shader-canvas');
  if (term) targets.push(term);
  if (shader) targets.push(shader);
  // также хотим, чтобы полноэкранные UI-экраны (start/boot/login) были искривлены
  ['start-screen','boot-screen','login-screen','#start-screen','#boot-screen','#login-screen'].forEach(id => {
    const el = document.querySelector(id);
    if (el) targets.push(el);
  });
  // если целевые элементы не найдены — применяем к body как запасной вариант
  if (targets.length === 0) {
    targets.push(document.body);
  }

  // применяем класс
  targets.forEach(el => el.classList.add('curved'));

  // утилита: обновляет силу фильтра в зависимости от размера окна
  const updateScale = () => {
    // подбиваем базовую силу: при больших экранах чуть сильнее
    const w = Math.max(window.innerWidth, 800);
    // эмпирическая формула — поменяй 0.018 на меньшее/большее для слабее/сильнее эффекта
    let scale = Math.round(Math.min(80, w * 0.018));
    // минимальная читаемость — не меньше 6
    if (scale < 6) scale = 6;
    // На старте для терминала обычно нежелательно очень сильное искривление — ограничим
    if (scale > 50) scale = 50;

    // находим feDisplacementMap внутри фильтра и задаём scale
    const fdm = document.querySelector('#barrelFilter feDisplacementMap');
    if (fdm) fdm.setAttribute('scale', String(scale));
  };

  // initial
  updateScale();
  // пересчитываем при ресайзе
  window.addEventListener('resize', () => {
    // debounce лёгкий
    clearTimeout(window._curvDeb);
    window._curvDeb = setTimeout(updateScale, 80);
  });
});
