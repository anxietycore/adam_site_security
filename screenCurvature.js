// screenCurvature.js — CRT curvature applied only to #terminal area (fixed, non-destructive)
(() => {
  const TERM_ID = 'terminal';
  const target = document.getElementById(TERM_ID);
  if (!target) {
    console.warn('[curvature] #terminal not found — skip curvature layer.');
    return;
  }

  // create overlay canvas sized & positioned over the terminal element (not full-screen)
  const canvas = document.createElement('canvas');
  canvas.id = 'crtCurvature';
  Object.assign(canvas.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    pointerEvents: 'none',
    zIndex: '60', // above terminal but below UI controls if needed
    mixBlendMode: 'screen' // optional, can change or remove
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // offscreen canvas for html2canvas source (will match terminal size)
  const off = document.createElement('canvas');
  const octx = off.getContext('2d');

  // config
  const UPDATE_MS = 900;      // how often to refresh the capture (ms)
  const STRENGTH = 0.20;      // barrel distortion strength (0..0.5 typical)
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  // utility to update canvas position & size to match terminal rect
  function fitToTarget() {
    const rect = target.getBoundingClientRect();
    const cssW = Math.max(8, Math.floor(rect.width));
    const cssH = Math.max(8, Math.floor(rect.height));
    // set CSS position
    canvas.style.left = rect.left + 'px';
    canvas.style.top = rect.top + 'px';
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    // set pixel buffer sized by DPR
    canvas.width = Math.max(2, Math.floor(cssW * DPR));
    canvas.height = Math.max(2, Math.floor(cssH * DPR));
    off.width = Math.max(2, Math.floor(cssW * DPR));
    off.height = Math.max(2, Math.floor(cssH * DPR));
    // scale drawing contexts
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(1,1);
  }

  // core distortion draw: given off canvas contains source pixels (sx,sy) sized W x H,
  // we map them to dest canvas same size applying barrel distortion
  function drawDistorted() {
    const W = off.width;
    const H = off.height;
    if (W === 0 || H === 0) return;

    // get source pixel buffer
    let src;
    try {
      src = octx.getImageData(0, 0, W, H);
    } catch(e) {
      // IE/security problems — bail
      console.warn('[curvature] getImageData failed', e);
      return;
    }
    const sdata = src.data;

    // prepare destination ImageData
    const dest = ctx.createImageData(W, H);
    const ddata = dest.data;

    // center coords in normalized (-1..1)
    const cx = W * 0.5;
    const cy = H * 0.5;
    const invCx = 1 / cx;
    const invCy = 1 / cy;
    const strength = STRENGTH; // curvature

    // fill destination with transparent first (already zeroed)
    // map each dest pixel back to source
    for (let j = 0; j < H; j++) {
      // precompute ny
      const ny = (j - cy) * invCy;
      for (let i = 0; i < W; i++) {
        const nx = (i - cx) * invCx;
        const r2 = nx * nx + ny * ny;
        // barrel distortion mapping (inverse map)
        const k = 1 + strength * r2;
        const sx = (nx / k) * cx + cx;
        const sy = (ny / k) * cy + cy;
        const sx_i = Math.floor(sx);
        const sy_i = Math.floor(sy);
        if (sx_i >= 0 && sy_i >= 0 && sx_i < W && sy_i < H) {
          const si = (sy_i * W + sx_i) * 4;
          const di = (j * W + i) * 4;
          ddata[di]   = sdata[si];
          ddata[di+1] = sdata[si+1];
          ddata[di+2] = sdata[si+2];
          ddata[di+3] = sdata[si+3];
        } // else leave transparent
      }
    }

    // clear overlay canvas and putImageData scaled to CSS size
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(dest, 0, 0);

    // add soft central highlight and vignette on top of distorted image
    const Wpx = canvas.width;
    const Hpx = canvas.height;
    const cxpx = Wpx/2, cypx = Hpx/2;

    // central sheen
    const sheen = ctx.createRadialGradient(cxpx, cypx, Math.min(Wpx,Hpx)*0.02, cxpx, cypx, Math.max(Wpx,Hpx)*0.9);
    sheen.addColorStop(0, 'rgba(255,255,255,0.05)');
    sheen.addColorStop(0.4, 'rgba(255,255,255,0.015)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0,0,Wpx,Hpx);

    // outer dark vignette
    const vig = ctx.createRadialGradient(cxpx, cypx, Math.min(Wpx,Hpx)*0.25, cxpx, cypx, Math.max(Wpx,Hpx));
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vig;
    ctx.fillRect(0,0,Wpx,Hpx);
  }

  // capture DOM of target to off canvas using html2canvas and then distort-draw
  let running = false;
  async function captureAndDraw() {
    if (running) return;
    running = true;
    try {
      const rect = target.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) { running = false; return; }
      // ensure sizes are up-to-date
      fitToTarget();

      // use html2canvas to render target to temporary canvas
      const opts = {
        backgroundColor: null,
        scale: DPR,
        logging: false,
        useCORS: true,
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight
      };

      // html2canvas returns a canvas
      const snapshotCanvas = await html2canvas(target, opts);
      // draw snapshot into off canvas (off is sized by DPR*css)
      octx.clearRect(0,0,off.width, off.height);
      octx.drawImage(snapshotCanvas, 0, 0, off.width, off.height);

      // now distort and draw onto overlay canvas
      drawDistorted();
    } catch (err) {
      console.warn('[curvature] capture failed', err);
    } finally {
      running = false;
    }
  }

  // schedule repeated updates
  let timer = null;
  function scheduleLoop() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => { captureAndDraw(); }, UPDATE_MS);
  }

  // initial fit + draw
  fitToTarget();
  captureAndDraw();
  scheduleLoop();

  // also update on resize / scroll / mutation (terminal content change)
  let resizeTimeout = null;
  window.addEventListener('resize', () => { if (resizeTimeout) clearTimeout(resizeTimeout); resizeTimeout = setTimeout(()=>{ fitToTarget(); captureAndDraw(); }, 160); });
  window.addEventListener('scroll', () => { if (resizeTimeout) clearTimeout(resizeTimeout); resizeTimeout = setTimeout(()=>{ fitToTarget(); captureAndDraw(); }, 160); });

  // if terminal changes dynamically (new text), better to trigger capture after commands
  // expose helper for manual refresh
  window.crtCurvatureRefresh = () => { captureAndDraw(); };

  console.info('screenCurvature.js initialized — terminal curvature overlay active');
})();
