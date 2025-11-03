// screenCurvature.js — safe pseudo-CRT curvature (overlay, no DOM clones, no heavy ops)
(() => {
  const cfg = {
    strength: 0.9,    // perceptual strength 0.3..1.3
    chromaOffset: 6,  // px color ghost offset
    vignette: 0.36,   // 0..0.6 darkness
    wrapZ: 1100,      // z-index for overlay
    breathSpeed: 0.8, // breathing animation speed
    breatheAmount: 0.02 // tiny periodic modulation
  };

  const term = document.getElementById('terminal');
  if (!term) { console.warn('[crt] #terminal missing — curvature not applied'); return; }

  // create overlay container that sits exactly over terminal (pointer-events:none)
  function createOverlay() {
    const rect = term.getBoundingClientRect();

    const ov = document.createElement('div');
    ov.id = 'crt-overlay';
    Object.assign(ov.style, {
      position: 'absolute',
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
      pointerEvents: 'none',
      zIndex: String(cfg.wrapZ),
      overflow: 'visible'
    });
    document.body.appendChild(ov);

    // base inner area (transparent)
    const inner = document.createElement('div');
    inner.style.position = 'absolute';
    inner.style.left = '0'; inner.style.top = '0';
    inner.style.right = '0'; inner.style.bottom = '0';
    inner.style.overflow = 'hidden';
    inner.style.borderRadius = '4px';
    ov.appendChild(inner);

    // subtle left/red chroma
    const leftChroma = document.createElement('div');
    Object.assign(leftChroma.style, {
      position: 'absolute', left: '-30px', top: '0',
      width: 'calc(100% + 60px)', height: '100%',
      pointerEvents: 'none',
      mixBlendMode: 'screen',
      opacity: '0.18',
      background: `linear-gradient(90deg, rgba(180,40,40,0.55), rgba(0,0,0,0) 35%)`,
      transform: `translate3d(-${cfg.chromaOffset}px, -${Math.round(cfg.chromaOffset/4)}px, 0)`,
      filter: 'blur(2px)'
    });
    inner.appendChild(leftChroma);

    // subtle right/blue chroma
    const rightChroma = document.createElement('div');
    Object.assign(rightChroma.style, {
      position: 'absolute', left: '-30px', top: '0',
      width: 'calc(100% + 60px)', height: '100%',
      pointerEvents: 'none',
      mixBlendMode: 'screen',
      opacity: '0.12',
      background: `linear-gradient(90deg, rgba(0,0,0,0) 65%, rgba(40,120,220,0.5))`,
      transform: `translate3d(${cfg.chromaOffset}px, ${Math.round(cfg.chromaOffset/4)}px, 0)`,
      filter: 'blur(2px)'
    });
    inner.appendChild(rightChroma);

    // central subtle dark elliptical mask to imitate bulge shadow (lighter center, darker edges)
    const mask = document.createElement('div');
    Object.assign(mask.style, {
      position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
      pointerEvents: 'none',
      background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${30 + Math.round(cfg.strength*2)}%, rgba(0,0,0,${cfg.vignette}) 100%)`,
      mixBlendMode: 'multiply',
      opacity: '1'
    });
    inner.appendChild(mask);

    // micro-noise texture (to read as "screen")
    const noise = document.createElement('div');
    Object.assign(noise.style, {
      position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
      pointerEvents: 'none',
      backgroundImage: 'url("data:image/svg+xml;utf8, \
        <svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'><filter id=\'n\'><feTurbulence baseFrequency=\'0.9\' numOctaves=\'1\' stitchTiles=\'stitch\'/></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23n)\' opacity=\'0.02\'/></svg>")',
      opacity: '0.9',
      mixBlendMode: 'overlay'
    });
    inner.appendChild(noise);

    // inner inset border to simulate bezel depth
    const innerEdge = document.createElement('div');
    Object.assign(innerEdge.style, {
      position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
      pointerEvents: 'none',
      boxShadow: 'inset 0 18px 40px rgba(0,0,0,0.28)',
      borderRadius: '4px'
    });
    inner.appendChild(innerEdge);

    return { ov, leftChroma, rightChroma, mask, noise, innerEdge };
  }

  // create overlay and elements
  let overlayParts = null;
  function mountOverlay() {
    // remove old overlay if exists
    const old = document.getElementById('crt-overlay');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    overlayParts = createOverlay();
  }
  mountOverlay();

  // animate tiny breathing + parallax on mouse to enhance bulge sensation
  let t = 0;
  let mouse = {x:0,y:0};
  function onMouse(e) { mouse.x = e.clientX; mouse.y = e.clientY; }
  window.addEventListener('mousemove', onMouse);

  function tick() {
    t += 0.016 * cfg.breathSpeed;
    // subtle breathing scale factor
    const breathe = 1 + Math.sin(t) * cfg.breatheAmount;

    // compute normalized mouse offset relative to overlay center
    const ov = overlayParts && overlayParts.ov;
    if (ov) {
      const r = ov.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dx = (mouse.x - cx) / Math.max(1, r.width) ;
      const dy = (mouse.y - cy) / Math.max(1, r.height) ;

      // apply transforms to chroma layers (tiny parallax)
      const ox = dx * cfg.chromaOffset * cfg.strength * 0.8;
      const oy = dy * cfg.chromaOffset * cfg.strength * 0.5;

      overlayParts.leftChroma.style.transform = `translate3d(${-cfg.chromaOffset + ox}px, ${-cfg.chromaOffset/4 + oy}px, 0) scale(${1 * breathe})`;
      overlayParts.rightChroma.style.transform = `translate3d(${cfg.chromaOffset + ox}px, ${cfg.chromaOffset/4 + oy}px, 0) scale(${1 * breathe})`;

      // tweak mask opacity/shape slightly with mouse distance for perceived curvature
      const dist = Math.min(1, Math.hypot(dx, dy) * 1.6);
      const maskPct = 30 + Math.round(cfg.strength * 2) + dist * 12;
      overlayParts.mask.style.background = `radial-gradient(ellipse at ${50 + dx*16}% ${50 + dy*12}%, rgba(0,0,0,0) ${maskPct}%, rgba(0,0,0,${cfg.vignette}) 100%)`;
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // on resize or terminal move, reposition overlay
  let resizeTimer = null;
  function reposition() {
    const old = document.getElementById('crt-overlay');
    if (!old) return;
    const rect = term.getBoundingClientRect();
    old.style.left = rect.left + 'px';
    old.style.top = rect.top + 'px';
    old.style.width = rect.width + 'px';
    old.style.height = rect.height + 'px';
  }
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(reposition, 120); });
  // also monitor scroll/layout changes
  window.addEventListener('scroll', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(reposition, 120); });

  // expose API to tweak quickly
  window.crt = window.crt || {};
  window.crt.set = function(opts = {}) {
    Object.assign(cfg, opts);
    // refresh overlay immediately
    if (overlayParts) {
      overlayParts.leftChroma.style.opacity = `${0.18 * Math.max(0.2, cfg.strength)}`;
      overlayParts.rightChroma.style.opacity = `${0.12 * Math.max(0.2, cfg.strength)}`;
      overlayParts.mask.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,0) ${30 + Math.round(cfg.strength*2)}%, rgba(0,0,0,${cfg.vignette}) 100%)`;
    }
  };
  window.crt.remove = function() {
    const el = document.getElementById('crt-overlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    window.removeEventListener('mousemove', onMouse);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition);
    console.info('[crt] overlay removed');
  };

  console.info('[crt] safe overlay curvature applied — use window.crt.set({strength:0.8}) or window.crt.remove()');
})();
