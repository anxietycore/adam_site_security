(() => {
  try {
    // ----- CONFIG -----
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const SIZE_CSS = 300;
    const COLOR = { r: 6, g: 160, b: 118 };
    const MAP_Z = 40;
    const STATUS_Z = 45;

    // Добавляем внутрь CRT-контейнера
    const container = document.getElementById('crt-wrap') || document.body;

    // ----- DOM -----
    const mapCanvas = document.createElement('canvas');
    Object.assign(mapCanvas.style, {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      width: `${SIZE_CSS}px`,
      height: `${SIZE_CSS}px`,
      pointerEvents: 'auto',
      zIndex: MAP_Z,
      borderRadius: '8px',
      boxShadow: '0 18px 40px rgba(0,0,0,0.9)',
      backgroundColor: 'rgba(0,10,6,0.28)',
      cursor: 'default'
    });
    container.appendChild(mapCanvas);
    const mctx = mapCanvas.getContext('2d');

    const statusEl = document.createElement('div');
    Object.assign(statusEl.style, {
      position: 'fixed',
      left: '18px',
      bottom: '12px',
      fontFamily: 'Courier, monospace',
      fontSize: '13px',
      color: `rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 1)`,
      textShadow: `0 0 10px rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 0.9)`,
      zIndex: STATUS_Z,
      pointerEvents: 'none',
      userSelect: 'none',
      letterSpacing: '0.6px',
      fontWeight: '700',
      opacity: '1',
    });
    container.appendChild(statusEl);

    const victoryEl = document.createElement('div');
    Object.assign(victoryEl.style, {
      pointerEvents: 'none',
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%,-50%)',
      color: `rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 1)`,
      fontSize: '36px',
      fontWeight: '900',
      textShadow: `0 0 18px rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 0.85)`,
      zIndex: 80,
      display: 'none',
      textAlign: 'center',
      padding: '10px 20px',
      borderRadius: '8px',
      background: 'rgba(0,0,0,0.35)'
    });
    victoryEl.textContent = 'Ура, победил!';
    container.appendChild(victoryEl);

    const controls = document.createElement('div');
    Object.assign(controls.style, {
      position: 'fixed',
      right: '20px',
      bottom: `${20 + SIZE_CSS + 12}px`,
      display: 'flex',
      gap: '8px',
      zIndex: MAP_Z + 1,
      alignItems: 'center'
    });
    container.appendChild(controls);

    // (всё остальное оставь без изменений — остальной код тот же)
    // …
  } catch (err) {
    console.error('netGrid_v4 error', err);
  }
})();
