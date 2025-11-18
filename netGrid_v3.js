// netGrid_calibrator.js — paste into console on your page
(function(){
  if (window.netGridCalibrator) {
    console.warn('netGridCalibrator already loaded — reusing instance.');
    return;
  }
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const state = {
    active: true,
    calibrated: false,
    calibrating: false,
    calPoints: [], // {sx,sy, mx,my}
    H: null, // 3x3 homography: maps screen -> map-local
    showOverlay: true,
    radius: 8 * DPR
  };

  // find mapCanvas heuristically
  function findMapCanvas() {
    return document.querySelector('#netGrid_map') 
        || document.querySelector('#netGridMapCanvas')
        || document.querySelector('canvas[id^="netGrid"]')
        || Array.from(document.querySelectorAll('canvas')).find(c => c.width <= 1024 && c.height <= 1024 && getComputedStyle(c).position === 'fixed') 
        || document.querySelector('canvas');
  }
  const mapCanvas = findMapCanvas();
  if (!mapCanvas) {
    console.error('netGridCalibrator: mapCanvas not found on page.');
    return;
  }
  // overlay canvas for debug visuals
  const overlay = document.createElement('canvas');
  overlay.id = 'netGrid_calib_overlay';
  overlay.style.position = 'fixed';
  overlay.style.left = '0';
  overlay.style.top = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = 2147483647; // top
  document.body.appendChild(overlay);
  const octx = overlay.getContext('2d');

  function resizeOverlay(){
    overlay.width = Math.round(window.innerWidth * DPR);
    overlay.height = Math.round(window.innerHeight * DPR);
    overlay.style.width = window.innerWidth + 'px';
    overlay.style.height = window.innerHeight + 'px';
    octx.setTransform(1,0,0,1,0,0);
    octx.scale(DPR, DPR);
  }
  window.addEventListener('resize', resizeOverlay, {passive:true});
  resizeOverlay();

  // utility: map map-local (device px of mapCanvas) -> client screen coordinates (for drawing points)
  function mapLocalToClient(mx, my){
    // use bounding rect of mapCanvas (CSS) then scale
    const r = mapCanvas.getBoundingClientRect();
    const cx = r.left + (mx / mapCanvas.width) * r.width;
    const cy = r.top + (my / mapCanvas.height) * r.height;
    return {cx, cy};
  }

  // draw overlay: grid intersections guessed + calibration points + error vectors
  function drawOverlay(){
    if (!state.showOverlay) { octx.clearRect(0,0,overlay.width,overlay.height); return; }
    octx.clearRect(0,0,overlay.width,overlay.height);
    octx.save();
    octx.scale(1/DPR, 1/DPR); // we'll draw in CSS px coordinates
    // draw all grid intersections predicted by mapCanvas layout
    try {
      const cssRect = mapCanvas.getBoundingClientRect();
      const mapW = mapCanvas.width, mapH = mapCanvas.height;
      // compute grid points in map-local then map to client
      const margin = 12 * DPR;
      const innerW = mapW - margin*2;
      const innerH = mapH - margin*2;
      octx.lineWidth = 1;
      // small dots for intersections
      for (let r=0;r<=6;r++){
        for (let c=0;c<=6;c++){
          const mx = margin + (c/6)*innerW;
          const my = margin + (r/6)*innerH;
          const client = mapLocalToClient(mx,my);
          octx.beginPath();
          octx.fillStyle = 'rgba(0,255,128,0.9)';
          octx.arc(client.cx, client.cy, 3, 0, Math.PI*2);
          octx.fill();
        }
      }
    } catch(e){}
    // draw calibration points and lines
    octx.font = '12px monospace';
    for (let i=0;i<state.calPoints.length;i++){
      const p = state.calPoints[i];
      octx.fillStyle = 'rgba(255,200,0,0.95)';
      octx.beginPath(); octx.arc(p.sx, p.sy, state.radius/2,0,Math.PI*2); octx.fill();
      octx.fillStyle = '#fff';
      octx.fillText(`${i+1}`, p.sx+8, p.sy+4);
      // show vector to mapped map-local
      if (p.mx!=null){
        octx.strokeStyle = 'rgba(255,120,40,0.95)';
        octx.beginPath(); octx.moveTo(p.sx,p.sy); octx.lineTo(p.mxClient, p.myClient); octx.stroke();
        octx.fillStyle = 'rgba(255,120,40,0.95)';
        octx.beginPath(); octx.arc(p.mxClient,p.myClient,4,0,Math.PI*2); octx.fill();
      }
    }
    // if calibrated, show test cursor positions and small legend
    if (state.calibrated){
      octx.fillStyle = 'rgba(0,0,0,0.6)';
      octx.fillRect(8,8,220,60);
      octx.fillStyle = '#fff'; octx.fillText('netGridCalibrator: CALIBRATED', 14, 26);
      octx.fillStyle = '#ddd'; octx.fillText('Click "toggle" to disable overlay.', 14, 42);
    } else if (state.calibrating){
      octx.fillStyle = 'rgba(0,0,0,0.6)'; octx.fillRect(8,8,260,36);
      octx.fillStyle = '#fff'; octx.fillText('Calibration mode: click 4 visible intersections', 14, 28);
    } else {
      octx.fillStyle = 'rgba(0,0,0,0.6)'; octx.fillRect(8,8,260,36);
      octx.fillStyle = '#fff'; octx.fillText('netGridCalibrator loaded. Press calibrate()', 14, 28);
    }
    octx.restore();
  }

  // ---- linear solver for 8x8 (gauss) used for 4-point homography ----
  function solveLinear(A, b){
    // A: n x n, b: n
    const n = A.length;
    // build augmented matrix
    const M = new Array(n);
    for (let i=0;i<n;i++){
      M[i] = new Float64Array(n+1);
      for (let j=0;j<n;j++) M[i][j] = A[i][j];
      M[i][n] = b[i];
    }
    // gaussian elimination
    for (let k=0;k<n;k++){
      // pivot
      let maxRow = k;
      let maxVal = Math.abs(M[k][k]);
      for (let r=k+1;r<n;r++){
        const v = Math.abs(M[r][k]);
        if (v > maxVal){ maxVal = v; maxRow = r; }
      }
      if (maxVal === 0) return null; // singular
      if (maxRow !== k){
        const tmp = M[k]; M[k] = M[maxRow]; M[maxRow] = tmp;
      }
      // normalize row
      const pivot = M[k][k];
      for (let c=k;c<=n;c++) M[k][c] /= pivot;
      // eliminate
      for (let r=0;r<n;r++){
        if (r===k) continue;
        const f = M[r][k];
        if (f === 0) continue;
        for (let c=k;c<=n;c++) M[r][c] -= f * M[k][c];
      }
    }
    const x = new Array(n);
    for (let i=0;i<n;i++) x[i] = M[i][n];
    return x;
  }

  // compute homography H (3x3) mapping screen (sx,sy) -> mapLocal (mx,my)
  // require exactly 4 correspondences in pts: [{sx,sy,mx,my}, ...]
  function computeHomography(pts){
    if (!pts || pts.length < 4) return null;
    // build 8x8 system for 4 points: Ah = b  (h vector has 8 unknowns, h33=1)
    const A = [];
    const B = [];
    for (let i=0;i<4;i++){
      const p = pts[i];
      const x = p.sx, y = p.sy;
      const u = p.mx, v = p.my;
      // row for u: [ x y 1 0 0 0 -u*x -u*y ] * h = u
      A.push([x, y, 1, 0, 0, 0, -u*x, -u*y]);
      B.push(u);
      // row for v: [0 0 0 x y 1 -v*x -v*y] * h = v
      A.push([0,0,0, x, y, 1, -v*x, -v*y]);
      B.push(v);
    }
    const h8 = solveLinear(A, B);
    if (!h8) return null;
    // build full 3x3 H
    const H = [
      [h8[0], h8[1], h8[2]],
      [h8[3], h8[4], h8[5]],
      [h8[6], h8[7], 1]
    ];
    return H;
  }

  function applyHomography(H, x, y){
    const denom = H[2][0]*x + H[2][1]*y + H[2][2];
    if (!denom) return {x:0,y:0};
    const nx = (H[0][0]*x + H[0][1]*y + H[0][2]) / denom;
    const ny = (H[1][0]*x + H[1][1]*y + H[1][2]) / denom;
    return {x: nx, y: ny};
  }

  // capture screen click for calibration
  function onOverlayClick(ev){
    if (!state.calibrating) return;
    // use client coords in CSS pixels (not device)
    const sx = ev.clientX, sy = ev.clientY;
    // determine nearest visible intersection (ask user to click visible intersection)
    // compute corresponding map-local guess by mapping screen->map-local using existing best effort:
    // simplest: find which intersection (gridPoints) is closest in client space, and record its map-local coords.
    const rect = mapCanvas.getBoundingClientRect();
    // build map-local gridPoints (device pixels)
    const mapW = mapCanvas.width, mapH = mapCanvas.height;
    const margin = 12 * DPR;
    const innerW = mapW - margin*2;
    const innerH = mapH - margin*2;
    // compute all intersections and map to client coords; choose the one nearest to clicked sx,sy
    let best = { r:0, c:0, d:Infinity, mx:0, my:0, cx:0, cy:0};
    for (let r=0;r<=6;r++){
      for (let c=0;c<=6;c++){
        const mx = margin + (c/6)*innerW;
        const my = margin + (r/6)*innerH;
        const client = mapLocalToClient(mx,my);
        const d = Math.hypot(client.cx - sx, client.cy - sy);
        if (d < best.d){ best = {r,c,d,mx,my,cx:client.cx,cy:client.cy}; }
      }
    }
    // register calibration: screen point (sx,sy) maps to map-local device px (best.mx, best.my)
    const p = { sx: sx, sy: sy, mx: best.mx, my: best.my, mxClient: best.cx, myClient: best.cy };
    state.calPoints.push(p);
    console.log('Calibration point added:', p);
    drawOverlay();
    if (state.calPoints.length >= 4){
      // compute homography using first 4 points
      const H = computeHomography(state.calPoints.slice(0,4));
      if (!H){
        console.error('Homography computation failed (singular). Try different points.');
        return;
      }
      state.H = H;
      state.calibrated = true;
      state.calibrating = false;
      console.log('Calibration complete. Homography:', H);
      // compute and show mapping error
      let totalErr = 0;
      for (let i=0;i<state.calPoints.length;i++){
        const cp = state.calPoints[i];
        const mapped = applyHomography(H, cp.sx, cp.sy);
        const err = Math.hypot(mapped.x - cp.mx, mapped.y - cp.my);
        totalErr += err;
        cp.mxClient = mapLocalToClient(cp.mx, cp.my).cx;
        cp.myClient = mapLocalToClient(cp.mx, cp.my).cy;
        console.log(`Pt ${i+1} error: ${err.toFixed(2)} px (map-local)`);
      }
      console.log('Average mapping error (map-local px):', (totalErr / state.calPoints.length).toFixed(2));
      drawOverlay();
      // enable mapping in input handler by setting window.netGridCalibrator.applyMapping = true
    }
  }

  // install overlay click handler (will receive events because pointer-events none on overlay; we need actual pointer capture)
  // create a hidden full-screen pointer-capturer element to receive clicks during calibration
  const pointerCatcher = document.createElement('div');
  pointerCatcher.style.position = 'fixed';
  pointerCatcher.style.left = '0'; pointerCatcher.style.top = '0';
  pointerCatcher.style.width = '100%'; pointerCatcher.style.height = '100%';
  pointerCatcher.style.zIndex = 2147483646;
  pointerCatcher.style.pointerEvents = 'none'; // normally none; we will enable when calibrating
  document.body.appendChild(pointerCatcher);

  pointerCatcher.addEventListener('click', function(ev){
    if (state.calibrating){
      onOverlayClick(ev);
    }
  }, true);

  // Public API functions:
  const API = {
    startCalibration: function(){
      state.calPoints = [];
      state.calibrating = true;
      state.calibrated = false;
      pointerCatcher.style.pointerEvents = 'auto';
      drawOverlay();
      console.log('Calibration started — click 4 visible intersections on the page (prefer corners).');
    },
    cancelCalibration: function(){
      state.calibrating = false;
      pointerCatcher.style.pointerEvents = 'none';
      console.log('Calibration cancelled.');
      drawOverlay();
    },
    clearCalibration: function(){
      state.calPoints = [];
      state.H = null;
      state.calibrated = false;
      pointerCatcher.style.pointerEvents = 'none';
      console.log('Calibration cleared.');
      drawOverlay();
    },
    toggleOverlay: function(){ state.showOverlay = !state.showOverlay; drawOverlay(); },
    isCalibrated: function(){ return state.calibrated; },
    getHomography: function(){ return state.H; },
    applyMappingToEvent: function(ev){
      // ev.clientX, ev.clientY -> map-local device px
      if (state.calibrated && state.H){
        const mapped = applyHomography(state.H, ev.clientX, ev.clientY);
        return { x: mapped.x, y: mapped.y };
      }
      // fallback: direct mapCanvas bounding rect
      const rect = mapCanvas.getBoundingClientRect();
      const rawX = (ev.clientX - rect.left) * (mapCanvas.width / rect.width);
      const rawY = (ev.clientY - rect.top) * (mapCanvas.height / rect.height);
      return { x: rawX, y: rawY };
    },
    showState: function(){ return JSON.parse(JSON.stringify({calibrated: state.calibrated, points: state.calPoints})); },
    destroy: function(){
      window.removeEventListener('resize', resizeOverlay);
      pointerCatcher.remove();
      overlay.remove();
      delete window.netGridCalibrator;
      console.log('netGridCalibrator removed.');
    }
  };

  // Intercept global mouse mapping if user chooses to enable; we will not override your netGrid automatically.
  // But we provide helper to monkey-patch a function name: pass the name of function used by your netGrid to convert events to map-local coords.
  // Example usage after loading: netGridCalibrator.hook('getMousePosOnCanvas');
  API.hook = function(functionName){
    // find target function in global scope
    // look for window[functionName] OR in window.netGrid.* or in any script property
    const targetCandidates = [];
    if (typeof window[functionName] === 'function') targetCandidates.push({root: window, name: functionName});
    if (window.netGrid && typeof window.netGrid[functionName] === 'function') targetCandidates.push({root: window.netGrid, name: functionName});
    // if multiple, prefer netGrid namespace
    let chosen = null;
    for (const c of targetCandidates){ if (c.root === window.netGrid) { chosen = c; break; } }
    if (!chosen && targetCandidates.length>0) chosen = targetCandidates[0];
    if (!chosen){
      console.warn('Hook failed: function not found. Provide function name that maps mouse event to map-local coords (global or in window.netGrid).');
      return false;
    }
    const root = chosen.root, name = chosen.name;
    const orig = root[name];
    root[name] = function(ev){
      const mapped = API.applyMappingToEvent(ev);
      return mapped;
    };
    // store reference so user can restore if needed
    API._hooked = {root, name, orig};
    console.log(`netGridCalibrator: hooked ${name} — calls now return calibrated map-local coords.`);
    return true;
  };
  API.unhook = function(){
    if (API._hooked){
      API._hooked.root[API._hooked.name] = API._hooked.orig;
      console.log('netGridCalibrator: unhooked and restored original function.');
      API._hooked = null;
      return true;
    }
    console.warn('Nothing to unhook.');
    return false;
  };

  // initial draw
  drawOverlay();

  // expose globally
  window.netGridCalibrator = API;
  console.log('netGridCalibrator loaded. Use netGridCalibrator.startCalibration() then click 4 visible intersections. After that call netGridCalibrator.hook("getMousePosOnCanvas") to switch mapping.');
})();
