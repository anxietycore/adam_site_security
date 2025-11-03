// screenCurvature.js — Draw terminal text to an offscreen canvas, apply barrel distortion
// No html2canvas, no DOM snapshot, only text replication for distortion.
// Place this file AFTER terminal.js so #terminal content exists.

(() => {
  const TERM_ID = 'terminal';
  const target = document.getElementById(TERM_ID);
  if (!target) {
    console.warn('[curvature] #terminal not found — abort.');
    return;
  }

  // Config: tweak these to taste
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const UPDATE_FPS = 18;         // how many updates per second (lower = less CPU)
  const STRENGTH = 0.28;        // barrel distortion strength (0..0.6). Increase to stronger bulge.
  const VIGNETTE = 0.36;        // vignette darkness 0..1
  const FONT_SCALE = 1.0;       // multiplier for font-size when rendering to canvas (1 = keep)

  // overlay canvas (full window to handle cases where terminal moves)
  const overlay = document.createElement('canvas');
  overlay.id = 'crtCurvatureOverlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: 999,
    pointerEvents: 'none'
  });
  document.body.appendChild(overlay);
  const octx = overlay.getContext('2d');

  // source canvas (sizes to terminal rect * DPR)
  const src = document.createElement('canvas');
  const sctx = src.getContext('2d');

  // helper: get terminal lines and computed style
  function fetchTerminalTextAndStyle() {
    // prefer visible lines, split by \n; fallback to innerText
    const text = target.innerText || '';
    const lines = text.split('\n');

    const computed = getComputedStyle(target);
    // pick a monospace fallback
    const fontFamily = computed.fontFamily || "'Courier New', monospace";
    // parse font-size, fallback 16px
    const fontSize = parseFloat(computed.fontSize) || 16;
    const color = computed.color || '#00FF41';

    return { lines, fontSize: fontSize * FONT_SCALE, fontFamily, color };
  }

  function fitSizes() {
    const rect = target.getBoundingClientRect();
    const cssW = Math.max(8, Math.floor(rect.width));
    const cssH = Math.max(8, Math.floor(rect.height));

    // overlay is full window; ensure pixel buffer matches DPR
    overlay.width = Math.max(2, Math.floor(window.innerWidth * DPR));
    overlay.height = Math.max(2, Math.floor(window.innerHeight * DPR));
    overlay.style.width = window.innerWidth + 'px';
    overlay.style.height = window.innerHeight + 'px';

    // src matches terminal area (we'll render text into src and map to overlay at terminal position)
    src.width = Math.max(2, Math.floor(cssW * DPR));
    src.height = Math.max(2, Math.floor(cssH * DPR));
    src.style.width = cssW + 'px';
    src.style.height = cssH + 'px';
  }

  // barrel distortion mapping from src -> overlay (draw only inside terminal rect on overlay)
  function drawDistortedToOverlay() {
    const rect = target.getBoundingClientRect();
    const termX = Math.round(rect.left * DPR);
    const termY = Math.round(rect.top * DPR);
    const W = src.width;
    const H = src.height;
    if (W <= 0 || H <= 0) return;

    // read source pixels once
    let srcImg;
    try {
      srcImg = sctx.getImageData(0, 0, W, H);
    } catch (e) {
      // security/taint issues — bail
      console.warn('[curvature] cannot read src canvas', e);
      return;
    }
    const sdata = srcImg.data;

    // create dest buffer equal to terminal area size in overlay pixel space
    const dest = octx.createImageData(W, H);
    const ddata = dest.data;

    const cx = W / 2;
    const cy = H / 2;
    const invCx = 1 / cx;
    const invCy = 1 / cy;
    const strength = STRENGTH;

    // inverse mapping: for each dest pixel compute src coords
    for (let j = 0; j < H; j++) {
      const ny = (j - cy) * invCy;
      for (let i = 0; i < W; i++) {
        const nx = (i - cx) * invCx;
        const r2 = nx * nx + ny * ny;
        const k = 1.0 + strength * r2;
        const sx = (nx / k) * cx + cx;
        const sy = (ny / k) * cy + cy;
        const sxi = Math.floor(sx);
        const syi = Math.floor(sy);
        const di = (j * W + i) * 4;
        if (sxi >= 0 && syi >= 0 && sxi < W && syi < H) {
          const si = (syi * W + sxi) * 4;
          ddata[di] = sdata[si];
          ddata[di+1] = sdata[si+1];
          ddata[di+2] = sdata[si+2];
          ddata[di+3] = sdata[si+3];
        } else {
          // outside source -> transparent (keep 0)
          ddata[di+3] = 0;
        }
      }
    }

    // clear only the terminal area on overlay where we'll draw
    octx.clearRect(termX, termY, W, H);
    // putImageData at terminal position (in overlay pixel coords)
    octx.putImageData(dest, termX, termY);

    // apply vignette on top of the terminal area
    octx.save();
    octx.globalCompositeOperation = 'multiply';
    const gx = octx.createRadialGradient(termX + W/2, termY + H/2, Math.min(W,H)*0.25, termX + W/2, termY + H/2, Math.max(W,H)*0.7);
    gx.addColorStop(0, `rgba(0,0,0,0)`);
    gx.addColorStop(1, `rgba(0,0,0,${VIGNETTE})`);
    octx.fillStyle = gx;
    octx.fillRect(termX, termY, W, H);
    octx.restore();
  }

  // render terminal text into src canvas (monospace)
  function renderTerminalTextToSrc() {
    // clear
    sctx.clearRect(0, 0, src.width, src.height);
    // background transparent (we want underlying page to show through around terminal)
    // but to make text contrast we can paint slight dark overlay if desired:
    // sctx.fillStyle = 'rgba(0,0,0,0.0)'; sctx.fillRect(0,0,src.width,src.height);

    const { lines, fontSize, fontFamily, color } = fetchTerminalTextAndStyle();
    const scaledFontSize = Math.max(8, Math.floor(fontSize * DPR));
    sctx.fillStyle = color || '#00FF41';
    sctx.font = `${scaledFontSize}px ${fontFamily}`;
    sctx.textBaseline = 'top';
    // calculate line height: try to get from computed or approximate
    const lineHeight = Math.ceil(scaledFontSize * 1.15);

    // left padding from terminal style (if any)
    const padLeft = 4 * DPR;
    const padTop = 4 * DPR;

    // draw each line
    for (let i = 0; i < lines.length; i++) {
      const y = padTop + i * lineHeight;
      // clip if beyond src height
      if (y > src.height) break;
      // optionally add slight chroma-offset duplicates to simulate CRT chromatic aberration
      // main green
      sctx.fillStyle = color || '#00FF41';
      sctx.fillText(lines[i], padLeft, y);
      // slight red ghost (very subtle)
      sctx.fillStyle = 'rgba(180,30,30,0.06)';
      sctx.fillText(lines[i], padLeft + 0.6 * DPR, y);
      // slight blue ghost
      sctx.fillStyle = 'rgba(30,80,200,0.04)';
      sctx.fillText(lines[i], padLeft - 0.6 * DPR, y);
    }
  }

  // full update: render text -> distort -> draw overlay
  function fullUpdate() {
    // ensure sizes match
    fitSizes(); // define below
    renderTerminalTextToSrc();
    drawDistortedToOverlay();
  }

  // fitSizes function: sets src/overlay pixel sizes according to terminal rect and window
  function fitSizes() {
    const rect = target.getBoundingClientRect();
    // overlay already set to full window - actual pixel buffer:
    overlay.width = Math.max(2, Math.floor(window.innerWidth * DPR));
    overlay.height = Math.max(2, Math.floor(window.innerHeight * DPR));
    overlay.style.width = window.innerWidth + 'px';
    overlay.style.height = window.innerHeight + 'px';

    src.width = Math.max(2, Math.floor(rect.width * DPR));
    src.height = Math.max(2, Math.floor(rect.height * DPR));
    // no need to set css for src
  }

  // schedule loop
  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!last) last = now;
    const elapsed = now - last;
    const period = 1000 / UPDATE_FPS;
    if (elapsed < period) return;
    last = now;
    // update sizes, text and overlay
    fullUpdate();
  }

  // initial
  fitSizes();
  fullUpdate();
  requestAnimationFrame(loop);

  // update when terminal layout changes: resize/scroll/visibility
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { fitSizes(); fullUpdate(); }, 160);
  });
  window.addEventListener('scroll', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { fitSizes(); fullUpdate(); }, 160);
  });

  // expose quick API
  window.crtCurvature = {
    refresh: () => fullUpdate(),
    setStrength: (v) => { STRENGTH = Math.max(0, Math.min(0.6, +v)); },
    setFPS: (f) => { /* can't change const; left as exercise */ }
  };

  console.info('screenCurvature.js initialized — text-based barrel distortion active');
})();
