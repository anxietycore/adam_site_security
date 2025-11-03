// screenCurvature.js
// Real-time DOM distortion using SVG feTurbulence + feDisplacementMap
// - no html2canvas, no getImageData/putImageData, no DOM cloning
// - applies filter directly to #terminal, leaving input and focus intact
// - adjustable: strength, scale, chroma

(() => {
  const term = document.getElementById('terminal');
  if (!term) {
    console.warn('[crt-svg] #terminal not found — abort');
    return;
  }

  // CONFIG default
  const cfg = {
    strength: 30,      // displacement amplitude in px (0..120) — higher = stronger warp
    baseFreq: 0.8,     // turbulence baseFrequency — controls grain scale (0.1..2)
    speed: 0.35,       // animation speed multiplier (0..2)
    chroma: 1.6,       // chroma offset factor (1 = normal, >1 stronger)
    enabled: true
  };

  // create unique ids to avoid clashes
  const ID = 'crtSvgFilter_' + Math.floor(Math.random() * 99999);
  const turbId = ID + '_turb';
  const dispId = ID + '_disp';
  const chromaRId = ID + '_r';
  const chromaBId = ID + '_b';

  // create <svg> defs (insert into document.body)
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width','0'); svg.setAttribute('height','0'); svg.style.position='absolute'; svg.style.left='0'; svg.style.top='0';
  svg.setAttribute('aria-hidden','true');

  const defs = document.createElementNS(svgNS, 'defs');

  // main turbulence for displacement map
  const feTurb = document.createElementNS(svgNS, 'feTurbulence');
  feTurb.setAttribute('type','fractalNoise');
  feTurb.setAttribute('baseFrequency', String(cfg.baseFreq));
  feTurb.setAttribute('numOctaves','2');
  feTurb.setAttribute('result', turbId);
  feTurb.setAttribute('seed', String(Math.floor(Math.random()*10000)));
  defs.appendChild(feTurb);

  // scale the turbulence into displacement map
  const feDispl = document.createElementNS(svgNS, 'feDisplacementMap');
  feDispl.setAttribute('in', 'SourceGraphic'); // will be used in separate filter composition
  feDispl.setAttribute('in2', turbId);
  feDispl.setAttribute('scale', String(cfg.strength)); // controls amplitude
  feDispl.setAttribute('xChannelSelector','R');
  feDispl.setAttribute('yChannelSelector','G');
  feDispl.setAttribute('result', dispId);
  // NOTE: We'll actually build filter nodes below per-filter

  // We'll create three filters:
  // 1) mainFilter — slight displacement applied to the element itself
  // 2) chromaR — displacement + slight translate (red ghost)
  // 3) chromaB — displacement + slight translate (blue ghost)
  function makeFilter(filterId, translateX=0, translateY=0, extraScale=0) {
    const f = document.createElementNS(svgNS, 'filter');
    f.setAttribute('id', filterId);
    f.setAttribute('x','-50%'); f.setAttribute('y','-50%'); f.setAttribute('width','200%'); f.setAttribute('height','200%');
    // turbulence (we will reuse the same feTurb source via <feImage>? Can't — so re-declare small feTurbRef using <feTurbulence> that references same parameters)
    const ft = document.createElementNS(svgNS, 'feTurbulence');
    ft.setAttribute('type','fractalNoise');
    ft.setAttribute('baseFrequency', String(cfg.baseFreq));
    ft.setAttribute('numOctaves','2');
    ft.setAttribute('seed', String(Math.floor(Math.random()*10000)));
    ft.setAttribute('result', filterId + '_turb');

    const fdm = document.createElementNS(svgNS, 'feDisplacementMap');
    fdm.setAttribute('in','SourceGraphic');
    fdm.setAttribute('in2', filterId + '_turb');
    // scale equals cfg.strength scaled by extraScale factor
    fdm.setAttribute('scale', String(Math.max(0, cfg.strength * (1 + extraScale))));
    fdm.setAttribute('xChannelSelector','R');
    fdm.setAttribute('yChannelSelector','G');
    fdm.setAttribute('result', filterId + '_disp');

    // translate using feOffset if requested
    if (translateX !== 0 || translateY !== 0) {
      const off = document.createElementNS(svgNS, 'feOffset');
      off.setAttribute('dx', String(translateX));
      off.setAttribute('dy', String(translateY));
      off.setAttribute('in', filterId + '_disp');
      off.setAttribute('result', filterId + '_off');
      f.appendChild(ft);
      f.appendChild(fdm);
      f.appendChild(off);
      // composite to return final
      const comp = document.createElementNS(svgNS, 'feComposite');
      comp.setAttribute('in', filterId + '_off');
      comp.setAttribute('in2', 'SourceGraphic');
      comp.setAttribute('operator','over');
      comp.setAttribute('result', filterId + '_out');
      f.appendChild(comp);
      // out will be comp result
    } else {
      f.appendChild(ft);
      f.appendChild(fdm);
    }

    // final merge: if off used, output result, else pass-through (sourcegraphic already modified)
    // Some browsers require an feBlend to force proper output; we keep it simple: return f
    return f;
  }

  // build filters
  const mainFilterId = ID + '_main';
  const rFilterId = ID + '_rghost';
  const bFilterId = ID + '_bghost';

  const mainF = makeFilter(mainFilterId, 0, 0, 0.0);
  const rF = makeFilter(rFilterId, -cfg.chroma, -cfg.chroma*0.25, 0.03);
  const bF = makeFilter(bFilterId, cfg.chroma, cfg.chroma*0.25, -0.02);

  defs.appendChild(mainF);
  defs.appendChild(rF);
  defs.appendChild(bF);

  svg.appendChild(defs);
  document.body.appendChild(svg);

  // APPLYING: we'll use layered approach:
  // - Keep original element untouched visually, but apply mainFilter directly.
  // - Add two lightweight pseudo-layers (position:absolute) that reference the element via CSS 'filter' + 'backdrop-filter' impossible.
  // Trick: instead of cloning heavy DOM, we will use CSS filter chaining:
  // 1) Apply main filter to the element: element.style.filter = 'url(#mainFilterId)';
  // 2) For chromatic ghosting, we create two <div>s that visually overlay the element and use mix-blend to create colored ghosts.
  // These overlay divs will not clone DOM content (that would freeze input). Instead they use CSS 'backdrop-filter' which is not widely supported for displacement.
  // So to keep DOM live and still have visible chroma, we'll do subtle CSS shadows as ghosting.

  // Apply main filter to terminal
  term.style.filter = `url(#${mainFilterId})`;
  term.style.willChange = 'filter, transform';
  term.style.transformOrigin = '50% 50%';

  // Create chroma overlay (lightweight) — we do NOT clone the DOM text. Instead create colored blurred rect that slightly offsets to emulate ghosts.
  const chromaWrap = document.createElement('div');
  Object.assign(chromaWrap.style, {
    position: 'absolute',
    pointerEvents: 'none',
    left: '0', top: '0',
    width: '100%', height: '100%',
    zIndex: getEffectiveZ(term) + 1,
    mixBlendMode: 'screen',
    opacity: '1'
  });
  // We need chromaWrap to be aligned exactly over terminal in viewport coords
  document.body.appendChild(chromaWrap);

  function positionChroma() {
    const r = term.getBoundingClientRect();
    chromaWrap.style.left = r.left + 'px';
    chromaWrap.style.top = r.top + 'px';
    chromaWrap.style.width = r.width + 'px';
    chromaWrap.style.height = r.height + 'px';
  }
  positionChroma();
  window.addEventListener('resize', positionChroma);
  window.addEventListener('scroll', positionChroma);

  // create two colored layers inside chromaWrap (large gradients blurred, so cheap)
  const redLayer = document.createElement('div');
  const blueLayer = document.createElement('div');
  for (const el of [redLayer, blueLayer]) {
    Object.assign(el.style, {
      position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
      pointerEvents: 'none',
      filter: 'blur(6px) contrast(1.05)',
      mixBlendMode: 'screen',
      opacity: '0.18'
    });
    chromaWrap.appendChild(el);
  }
  redLayer.style.background = `linear-gradient(90deg, rgba(255,60,60,0.9), rgba(0,0,0,0) 30%)`;
  blueLayer.style.background = `linear-gradient(90deg, rgba(0,120,255,0.85), rgba(0,0,0,0) 70%)`;
  // offset them slightly
  redLayer.style.transform = `translate(${-cfg.chroma}px, ${-cfg.chroma*0.25}px)`;
  blueLayer.style.transform = `translate(${cfg.chroma}px, ${cfg.chroma*0.25}px)`;

  // helper to get effective z-index of element in document
  function getEffectiveZ(el) {
    try {
      const z = window.getComputedStyle(el).zIndex;
      return (isNaN(parseInt(z)) ? 1000 : parseInt(z));
    } catch(e){ return 1000; }
  }

  // animate turbulence baseFrequency to create movement, and optionally animate scale (strength)
  let animId = null;
  let last = performance.now();
  function animate() {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    // increase/decrease baseFrequency slightly for 'breathe'
    const bf = cfg.baseFreq * (0.85 + 0.25 * Math.sin(now * 0.001 * cfg.speed));
    // update all feTurbulence inside defs (they were created each for filters)
    const turbNodes = svg.querySelectorAll('feTurbulence');
    turbNodes.forEach((n, idx) => {
      // random phase per node for richness
      n.setAttribute('baseFrequency', String(bf * (0.6 + (idx % 3) * 0.25)));
      // slight seed jitter to avoid perfect loops
      n.setAttribute('seed', String(1000 + Math.floor(now * 0.02) % 10000));
    });

    // optionally pulse strength slightly for breathing
    const sPulse = cfg.strength * (1 + 0.06 * Math.sin(now * 0.002 * cfg.speed));
    // update feDisplacementMap scales (we created them with attributes; set new ones)
    const disps = svg.querySelectorAll('feDisplacementMap');
    disps.forEach((d, i) => {
      // slight per-filter scale tweak
      const extra = (i % 2 === 0) ? 0 : (i % 3 === 0 ? 0.02 : -0.02);
      d.setAttribute('scale', String(Math.max(0, sPulse * (1 + extra))));
    });

    // update chroma overlay position (small parallax)
    const rect = term.getBoundingClientRect();
    redLayer.style.transform = `translate(${-cfg.chroma}px, ${-cfg.chroma*0.25}px)`;
    blueLayer.style.transform = `translate(${cfg.chroma}px, ${cfg.chroma*0.25}px)`;

    animId = requestAnimationFrame(animate);
  }
  animId = requestAnimationFrame(animate);

  // expose API
  window.crt = window.crt || {};
  window.crt.set = (opts={}) => {
    Object.assign(cfg, opts);
    // re-apply immediate small changes
    redLayer.style.transform = `translate(${-cfg.chroma}px, ${-cfg.chroma*0.25}px)`;
    blueLayer.style.transform = `translate(${cfg.chroma}px, ${cfg.chroma*0.25}px)`;
    const disps = svg.querySelectorAll('feDisplacementMap');
    disps.forEach((d) => d.setAttribute('scale', String(cfg.strength)));
  };
  window.crt.disable = () => {
    term.style.filter = '';
    if (chromaWrap && chromaWrap.parentNode) chromaWrap.parentNode.removeChild(chromaWrap);
    if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
    if (animId) cancelAnimationFrame(animId);
    window.removeEventListener('resize', positionChroma);
    window.removeEventListener('scroll', positionChroma);
    console.info('[crt] disabled');
  };
  window.crt.enable = () => {
    term.style.filter = `url(#${mainFilterId})`; // re-apply if needed
    if (!document.body.contains(chromaWrap)) document.body.appendChild(chromaWrap);
    if (!document.body.contains(svg)) document.body.appendChild(svg);
    if (!animId) { last = performance.now(); animId = requestAnimationFrame(animate); }
  };

  console.info('[crt-svg] applied — use window.crt.set({strength:40, baseFreq:0.9, chroma:6}) or window.crt.disable() to remove');

})();
