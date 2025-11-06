(() => {
  const filter = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  filter.setAttribute("style", `
    position: fixed;
    top: 0; left: 0;
    width: 0; height: 0;
    pointer-events: none;
  `);
  filter.innerHTML = `
    <defs>
      <filter id="crtCurvature">
        <feImage result="source" preserveAspectRatio="none" xlink:href="">
          <animate attributeName="xlink:href" dur="0s" repeatCount="indefinite" />
        </feImage>
        <feDisplacementMap in="SourceGraphic" in2="map" scale="50" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="screenWarp" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.0005" numOctaves="1" result="warp" />
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="35" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  `;
  document.body.appendChild(filter);

  // создаём слой с фильтром поверх страницы
  const warpLayer = document.createElement('div');
  Object.assign(warpLayer.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: '9999',
    pointerEvents: 'none',
    backdropFilter: 'url(#screenWarp)',
    WebkitBackdropFilter: 'url(#screenWarp)'
  });
  document.body.appendChild(warpLayer);

  console.info('screenCurvature.js — curvature filter active');
})();
