// screenCurvature.js — GPU-based pseudo-CRT curvature using wrapper + transforms
// Fast, no html2canvas, no heavy pixel ops. Applies a convincing "выпуклый экран" look.
// Put this AFTER terminal.js in terminal.html

(() => {
  // config (tянется через window.crt later)
  const cfg = {
    strength: 0.85,    // 0.4..1.2 — визуальная сила выпуклости (higher = stronger)
    bulgeDepth: 24,    // px perceived depth (translateZ)
    perspective: 900,  // px perspective distance
    chroma: 0.9,       // 0..2 — chromatic aberration intensity
    vignette: 0.32,    // 0..0.6
    wrapZIndex: 1200,  // z-index for wrapper (above UI)
  };

  const term = document.getElementById('terminal');
  if (!term) {
    console.warn('[crt] #terminal not found — curvature not applied');
    return;
  }

  // If already wrapped, don't double-wrap
  if (term.parentElement && term.parentElement.classList.contains('crt-wrap')) {
    console.info('[crt] terminal already wrapped — skipping wrapper creation');
  } else {
    // create wrapper
    const wrap = document.createElement('div');
    wrap.className = 'crt-wrap';
    // copy computed position/size context by inserting wrapper where term was
    term.parentNode.insertBefore(wrap, term);
    wrap.appendChild(term);
    // wrapper styles (absolute relative to viewport)
    Object.assign(wrap.style, {
      position: 'relative',
      display: 'block',
      width: term.style.width || (term.getBoundingClientRect().width ? term.getBoundingClientRect().width + 'px' : '100%'),
      height: term.style.height || (term.getBoundingClientRect().height ? term.getBoundingClientRect().height + 'px' : '100%'),
      transformStyle: 'preserve-3d',
      zIndex: cfg.wrapZIndex.toString(),
      pointerEvents: 'auto'
    });

    // ensure terminal takes full size of wrap
    Object.assign(term.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      transformOrigin: '50% 50%',
      backfaceVisibility: 'hidden'
    });

    // create overlay layers: chroma layers + vignette mask
    // 1) chroma left (red), 2) chroma right (blue) — duplicated term clones visually only
    const chromaR = document.createElement('div');
    const chromaB = document.createElement('div');
    chromaR.className = 'crt-chroma-r';
    chromaB.className = 'crt-chroma-b';
    [chromaR, chromaB].forEach(el => {
      Object.assign(el.style, {
        position: 'absolute',
        left: '0', top: '0', right: '0', bottom: '0',
        pointerEvents: 'none',
        zIndex: cfg.wrapZIndex + 2,
        mixBlendMode: 'screen',
        opacity: '0.35',
        overflow: 'hidden'
      });
      wrap.appendChild(el);
    });

    // Put clones of terminal content into chroma layers but invisible to events.
    // We clone visually by cloning the node and removing interactive attributes.
    function createVisualClone(sourceEl) {
      // deep clone
      const clone = sourceEl.cloneNode(true);
      // remove ids to avoid dupes
      clone.removeAttribute && clone.removeAttribute('id');
      // disable pointer events on whole clone
      clone.querySelectorAll && clone.querySelectorAll('*').forEach(n => {
        n.style && (n.style.pointerEvents = 'none');
      });
      clone.style.pointerEvents = 'none';
      // simplify heavy elements: remove video/canvas elements to avoid cost (if present)
      clone.querySelectorAll && clone.querySelectorAll('video,canvas').forEach(n => n.remove());
      return clone;
    }

    // Maintain clones for chroma effect
    let cloneR = createVisualClone(term);
    let cloneB = createVisualClone(term);
    // colorize clones with CSS filters
    cloneR.style.filter = 'sepia(1) saturate(1.6) hue-rotate(-20deg) contrast(1.05)';
    cloneB.style.filter = 'sepia(1) saturate(0.4) hue-rotate(160deg) contrast(1.05)';
    // set blend mode and slight blur for ghosting
    cloneR.style.opacity = '0.85';
    cloneB.style.opacity = '0.85';
    cloneR.style.transform = 'translate3d(0,0,0)'; cloneB.style.transform = 'translate3d(0,0,0)';
    // ensure clones fill area
    Object.assign(cloneR.style, { width: '100%', height: '100%' });
    Object.assign(cloneB.style, { width: '100%', height: '100%' });

    chromaR.appendChild(cloneR);
    chromaB.appendChild(cloneB);

    // create vignette overlay
    const vig = document.createElement('div');
    vig.className = 'crt-vignette';
    Object.assign(vig.style, {
      position: 'absolute',
      left: '0', top: '0', right: '0', bottom: '0',
      pointerEvents: 'none',
      zIndex: cfg.wrapZIndex + 3,
      background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,${cfg.vignette}) 100%)`
    });
    wrap.appendChild(vig);

    // create a subtle mask to give "curved edge" effect — we use CSS clip-path ellipse
    // also create an inner shadow via pseudo overlay
    const edge = document.createElement('div');
    Object.assign(edge.style, {
      position: 'absolute',
      left: '0', top: '0', right: '0', bottom: '0',
      pointerEvents: 'none',
      zIndex: cfg.wrapZIndex + 4,
      borderRadius: '6px',
      boxShadow: 'inset 0 18px 40px rgba(0,0,0,0.28)',
      mixBlendMode: 'multiply'
    });
    wrap.appendChild(edge);

    // create a subtle curvature transform applied to the inner terminal element
    function applyTransforms(str) {
      // str in 0..1 normalized for intensity; map to translateZ and scale
      const s = Math.max(0, Math.min(2, str));
      const depth = cfg.bulgeDepth * s; // px
      const scale = 1 + 0.02 * s; // small scale to emphasize center
      // perspective is on wrapper; we transform the terminal inner content
      term.style.transform = `perspective(${cfg.perspective}px) translateZ(${depth}px) scale(${scale})`;
      // chroma offsets: move clones slightly left/right as ghost
      const chromaOff = Math.max(0, cfg.chroma * s * 1.8);
      chromaR.style.transform = `translate3d(${-chromaOff}px, ${-chromaOff/3}px, 0) scale(${1 + 0.001*s})`;
      chromaB.style.transform = `translate3d(${chromaOff}px, ${chromaOff/3}px, 0) scale(${1 + 0.001*s})`;
      chromaR.style.opacity = `${0.28 + 0.18 * s}`;
      chromaB.style.opacity = `${0.22 + 0.14 * s}`;
      // subtle overall brightness decrease when stronger
      term.style.filter = `brightness(${1 - 0.02 * s})`;
    }

    // initial transforms
    // ensure wrapper has perspective (on parent)
    wrap.style.perspective = `${cfg.perspective}px`;
    wrap.style.perspectiveOrigin = '50% 50%';
    applyTransforms(cfg.strength);

    // animate subtle breathing to feel alive
    let t = 0;
    let anim = true;
    function tick() {
      if (!anim) return;
      t += 0.016;
      // small periodic modulation
      const mod = 0.02 * Math.sin(t * 0.9) + 0.01 * Math.sin(t * 0.2);
      applyTransforms(cfg.strength + mod);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // expose API to control
    window.crt = window.crt || {};
    window.crt.setStrength = function(v) {
      cfg.strength = Number(v) || 0;
      applyTransforms(cfg.strength);
    };
    window.crt.enable = function() { anim = true; requestAnimationFrame(tick); wrap.style.display = ''; };
    window.crt.disable = function() { anim = false; term.style.transform = ''; chromaR.remove(); chromaB.remove(); vig.remove(); edge.remove(); wrap.style.boxShadow = ''; };
    window.crt.getConfig = () => ({...cfg});
    window.crt._internal = { wrap, term, chromaR, chromaB, vig, edge };

    // After layout changes we must sync clones (to reflect new terminal content)
    // We'll do a lightweight refresh: replace clone nodes with fresh clones
    function refreshClones() {
      // remove old clones
      chromaR.innerHTML = '';
      chromaB.innerHTML = '';
      cloneR = createVisualClone(term);
      cloneB = createVisualClone(term);
      cloneR.style.filter = 'sepia(1) saturate(1.6) hue-rotate(-20deg) contrast(1.05)';
      cloneB.style.filter = 'sepia(1) saturate(0.4) hue-rotate(160deg) contrast(1.05)';
      Object.assign(cloneR.style, { width:'100%', height:'100%', pointerEvents:'none' });
      Object.assign(cloneB.style, { width:'100%', height:'100%', pointerEvents:'none' });
      chromaR.appendChild(cloneR);
      chromaB.appendChild(cloneB);
    }

    // Monitor terminal content changes and refresh clones occasionally
    const mo = new MutationObserver(() => {
      // debounce brief changes
      if (window._crtRefreshTimeout) clearTimeout(window._crtRefreshTimeout);
      window._crtRefreshTimeout = setTimeout(()=> {
        try { refreshClones(); } catch(e){/*ignore*/ }
      }, 220);
    });
    mo.observe(term, { childList: true, subtree: true, characterData: true });

    // keep wrapper sizing consistent with terminal (in case terminal is absolute positioned)
    function syncWrapSize() {
      const r = term.getBoundingClientRect();
      // position wrap at same flow as term (wrap already contains term so usually okay)
      // but if terminal was absolutely positioned, ensure wrap follows that
      // We only set inline sizes if they are zero
      if (!wrap.style.width || wrap.style.width === '0px') wrap.style.width = r.width + 'px';
      if (!wrap.style.height || wrap.style.height === '0px') wrap.style.height = r.height + 'px';
    }
    window.addEventListener('resize', syncWrapSize);
    syncWrapSize();

    console.info('[crt] curvature wrapper applied — use window.crt.setStrength(value) to tweak (e.g. 0.6)');
  }

})();
