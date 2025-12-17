/* mobile_fixed.js — исправленная мобильная обёртка
   Основные цели:
   - корректный ресайз canvas под viewport (без CSS transform)
   - canvas занимает видимую область (viewport minus UI), можно скроллить
   - сетка NET в модалке 64% высоты с ресайзом её canvas (DPR-aware)
   - поддержка прокрутки/панорамирования тачем по canvas (если нужно)
   - удобная панель ввода, Y/N, быстрые команды; не перекрывает терминал вывод
   Подключать ПОСЛЕ: module_audio.js, netGrid_v3.js, terminal_canvas.js
*/

(function(){
  'use strict';

  const BAR_H = 64; // px input bar height
  const GRID_H_PCT = 64; // grid modal height in vh
  const QUICK = ['help','syslog','net_mode','clear','reset'];
  const IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(navigator.userAgent) || !!window.FORCE_MOBILE_TERMINAL;
  // Allow devs to test on desktop by forcing:
  // window.FORCE_MOBILE_TERMINAL = true;

  // Minimal CSS injected
  const _css = `
    html,body{height:100%;margin:0;background:#000;color:#00FF41;overflow:auto;touch-action:none;}
    #terminalCanvas{display:block; width:100%; height:100%; background:#000; touch-action:auto; -webkit-user-select:none; user-select:none; }
    .mf-input-bar{position:fixed;left:8px;right:8px;bottom:env(safe-area-inset-bottom,8px);height:${BAR_H}px;z-index:2147483647;display:flex;gap:8px;align-items:center;padding:8px;border-radius:12px;background:rgba(0,0,0,0.55);box-sizing:border-box;}
    .mf-input{flex:1;height:100%;border-radius:10px;padding:10px 12px;background:rgba(0,0,0,0.66);color:#00FF41;border:1px solid rgba(255,255,255,0.04);outline:none;font-family:monospace;font-size:15px}
    .mf-btn{min-width:48px;height:calc(100% - 6px);border-radius:8px;background:rgba(0,0,0,0.6);color:#00FF41;border:1px solid rgba(255,255,255,0.04);font-family:monospace}
    .mf-quick{position:fixed;left:8px;bottom:calc(${BAR_H + 18}px);z-index:2147483646;display:flex;gap:8px;padding:6px;border-radius:10px;background:rgba(0,0,0,0.45);backdrop-filter: blur(2px);}
    .mf-grid-modal{position:fixed;left:0;right:0;top:0;bottom:0;background:rgba(0,0,0,0.55);display:none;align-items:center;justify-content:center;z-index:2147483645}
    .mf-grid-panel{width:94%;max-width:520px;height:${GRID_H_PCT}vh;border-radius:12px;background:#030807;overflow:hidden;display:flex;flex-direction:column;padding:8px;box-sizing:border-box;color:#00FF41}
    .mf-grid-map{flex:1;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .mf-scale{position:fixed;right:10px;bottom:calc(${BAR_H + 18}px);display:flex;gap:6px;z-index:2147483646}
    .mf-history-tip{position:fixed;left:10px;top:10px;background:rgba(0,0,0,0.45);color:#00FF41;padding:6px;border-radius:8px;z-index:2147483648;display:none;font-size:12px}
  `;
  const style = document.createElement('style');
  style.innerText = _css;
  document.head.appendChild(style);

  // wait briefly for terminal to exist (but continue even if not found)
  function whenReady(cb, delay=40, max=3000){
    const start = Date.now();
    (function poll(){
      if (window.__TerminalCanvas) return cb(window.__TerminalCanvas);
      if (Date.now() - start > max) return cb(window.__TerminalCanvas || null);
      setTimeout(poll, delay);
    })();
  }

  whenReady((TC) => {
    const NG = window.__netGrid || null;
    const audioMgr = window.audioManager || window.AudioManager || null;
    const degradation = TC && TC.degradation ? TC.degradation : null;

    // create UI elements
    const overlay = document.createElement('div'); overlay.className = 'mf-input-bar';
    const input = document.createElement('input'); input.type='text'; input.className='mf-input'; input.placeholder='Команда (help)'; input.autocapitalize='none'; input.spellcheck=false;
    const send = document.createElement('button'); send.className='mf-btn'; send.innerText='→';
    const netBtn = document.createElement('button'); netBtn.className='mf-btn'; netBtn.innerText='NET';
    const lite = document.createElement('button'); lite.className='mf-btn'; lite.innerText='LITE';

    const ynWrapper = document.createElement('div'); ynWrapper.style.display='flex'; ynWrapper.style.gap='6px';
    const yBtn = document.createElement('button'); yBtn.className='mf-btn'; yBtn.style.minWidth='40px'; yBtn.innerText='Y';
    const nBtn = document.createElement('button'); nBtn.className='mf-btn'; nBtn.style.minWidth='40px'; nBtn.innerText='N';
    ynWrapper.appendChild(yBtn); ynWrapper.appendChild(nBtn);

    overlay.appendChild(input); overlay.appendChild(send); overlay.appendChild(netBtn); overlay.appendChild(lite); overlay.appendChild(ynWrapper);
    document.body.appendChild(overlay);

    // quick command row
    const quick = document.createElement('div'); quick.className='mf-quick';
    QUICK.forEach(k => { const b = document.createElement('button'); b.className='mf-btn'; b.innerText=k; b.onclick=()=> submit(k); quick.appendChild(b); });
    document.body.appendChild(quick);

    // scale helpers (kept minimal and visible)
    const scaleBox = document.createElement('div'); scaleBox.className='mf-scale';
    const zin = document.createElement('button'); zin.className='mf-btn'; zin.innerText='+'; const zout = document.createElement('button'); zout.className='mf-btn'; zout.innerText='-';
    scaleBox.appendChild(zin); scaleBox.appendChild(zout); document.body.appendChild(scaleBox);

    // history tip
    const hTip = document.createElement('div'); hTip.className='mf-history-tip'; hTip.innerText='UP/DOWN — история'; document.body.appendChild(hTip);

    // grid modal
    const gModal = document.createElement('div'); gModal.className='mf-grid-modal';
    const gPanel = document.createElement('div'); gPanel.className='mf-grid-panel';
    const gHeader = document.createElement('div'); gHeader.innerText='NET GRID';
    const gMap = document.createElement('div'); gMap.className='mf-grid-map';
    const gControls = document.createElement('div'); gControls.style.display='flex'; gControls.style.justifyContent='center'; gControls.style.gap='8px'; gControls.style.marginTop='6px';
    const gClose = document.createElement('button'); gClose.className='mf-btn'; gClose.innerText='Close';
    gControls.appendChild(gClose);
    gPanel.appendChild(gHeader); gPanel.appendChild(gMap); gPanel.appendChild(gControls); gModal.appendChild(gPanel);
    document.body.appendChild(gModal);

    // ensure terminalCanvas exists and is last in DOM order before overlays
    const termCanvas = document.getElementById('terminalCanvas');
    if (!termCanvas) {
      console.warn('[mobile_fixed] terminalCanvas not found in DOM (expected id="terminalCanvas")');
    } else {
      // move overlays after canvas to ensure they appear above
      termCanvas.parentNode.appendChild(overlay);
      termCanvas.parentNode.appendChild(quick);
      termCanvas.parentNode.appendChild(scaleBox);
      termCanvas.parentNode.appendChild(hTip);
      termCanvas.parentNode.appendChild(gModal);
    }

    // state
    let history = [], hIndex = 0;
    let currentDPR = window.devicePixelRatio || 1;
    let gridAttached = null, gridOrigParent = null, gridOrigStyles = null;
    let mobileLite = true;

    // helper: set canvas buffer to size (DPR-aware)
    function setCanvasSize(canvas, w, h){
      if (!canvas) return;
      const DPR = window.devicePixelRatio || 1;
      // set drawing buffer
      canvas.width = Math.max(1, Math.floor(w * DPR));
      canvas.height = Math.max(1, Math.floor(h * DPR));
      // set CSS size
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      // if terminal has resize API, call it (best-effort)
      try { if (NG && typeof NG.resize === 'function') NG.resize(Math.floor(w), Math.floor(h)); } catch(e){}
      try { if (TC && typeof TC.onResize === 'function') TC.onResize(Math.floor(w), Math.floor(h)); } catch(e){}
    }

    // compute available height for terminal canvas: viewport height minus input bar and quickRow margins
    function availableTerminalHeight(){
      const vh = window.innerHeight;
      // reserve space for quick row at bottom (it sits above input)
      const quickH = quick ? quick.getBoundingClientRect().height + 8 : 0;
      const bottomReserved = BAR_H + quickH + 28; // extra margin
      return Math.max(80, vh - bottomReserved);
    }

    // resize terminal canvas to available space
    function resizeTerminalCanvas(){
      if (!termCanvas) return;
      const availH = availableTerminalHeight();
      const width = Math.max(320, Math.min(window.innerWidth, document.documentElement.clientWidth));
      setCanvasSize(termCanvas, width, availH);
      // ensure body height is at least viewport -> allow scrolling for small keyboards
      document.documentElement.style.height = '100%';
      document.body.style.minHeight = '100vh';
    }

    // attach/detach grid canvas into modal and resize it
    function findNetCanvas(){
      // try known ids/classes
      let c = document.getElementById('netCanvas') || document.querySelector('canvas.net-grid');
      if (c) return c;
      // otherwise choose first canvas that isn't terminalCanvas
      const canvases = Array.from(document.querySelectorAll('canvas'));
      for (const cv of canvases){
        if (cv !== termCanvas) return cv;
      }
      return null;
    }

    function openGrid(){
      // hide any degradation element (best-effort)
      try {
        if (degradation && degradation.indicator) degradation.indicator.style.display = 'none';
      } catch(e){}
      gModal.style.display = 'flex';
      const c = findNetCanvas();
      if (!c) return;
      gridAttached = c; gridOrigParent = c.parentNode; gridOrigStyles = c.style.cssText || '';
      // compute panel inner size
      const rect = gMap.getBoundingClientRect ? gMap.getBoundingClientRect() : gMap.getClientRects()[0] || { width: gMap.clientWidth, height: gMap.clientHeight };
      // attach and set buffer
      try {
        // set to panel inner size (use clientWidth/clientHeight)
        const W = gMap.clientWidth || rect.width || Math.floor(window.innerWidth * 0.9);
        const H = gMap.clientHeight || Math.floor(window.innerHeight * (GRID_H_PCT/100)) - 80;
        c.style.position = 'relative';
        c.style.width = '100%';
        c.style.height = '100%';
        c.style.maxWidth = '100%';
        c.style.maxHeight = '100%';
        c.style.pointerEvents = 'auto';
        setCanvasSize(c, W, H);
        gMap.appendChild(c);
      } catch(err){ console.warn('[mobile_fixed] attach grid canvas error', err); }
      // prevent terminal canvas from intercepting touches while grid open
      if (termCanvas) { termCanvas.style.pointerEvents = 'none'; }
    }

    function closeGrid(){
      gModal.style.display = 'none';
      if (gridAttached && gridOrigParent){
        try {
          gridAttached.style.cssText = gridOrigStyles || '';
          gridOrigParent.appendChild(gridAttached);
        } catch(e){ console.warn('[mobile_fixed] restore grid failed', e); }
      }
      gridAttached = null; gridOrigParent = null; gridOrigStyles = null;
      if (termCanvas) { termCanvas.style.pointerEvents = 'auto'; }
      // restore degradation indicator if any
      try { if (degradation && degradation.indicator) degradation.indicator.style.display = ''; } catch(e){}
    }

    // touch-pan implementation for canvas: drag vertically to scroll page
    let panStart = null;
    function canvasTouchStart(e){
      if (!e.touches || e.touches.length !== 1) return;
      panStart = { y: e.touches[0].clientY, tScroll: window.scrollY };
    }
    function canvasTouchMove(e){
      if (!panStart || !e.touches || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - panStart.y;
      // invert dy so finger drag up scrolls down
      window.scrollTo({ top: Math.max(0, panStart.tScroll - dy) });
    }
    function canvasTouchEnd(){ panStart = null; }

    if (termCanvas){
      termCanvas.addEventListener('touchstart', canvasTouchStart, { passive:true });
      termCanvas.addEventListener('touchmove', canvasTouchMove, { passive:false }); // preventDefault not used, but allow custom scrolling
      termCanvas.addEventListener('touchend', canvasTouchEnd, { passive:true });
    }

    // input behaviors
    function submit(cmd){
      if (!cmd) return;
      // push history
      if (!history.length || history[history.length-1] !== cmd) history.push(cmd);
      hIndex = history.length;
      // attempt to use API
      try { if (TC && typeof TC.processCommand === 'function') { TC.processCommand(cmd); } else { window.currentLine = cmd; dispatchKey('Enter'); } } catch(e){ console.warn('[mobile_fixed] submit error', e); }
      input.value = '';
      input.blur();
      // after submitting scroll a bit to show latest output
      setTimeout(()=> window.scrollTo({ top: document.body.scrollHeight }), 150);
    }

    send.addEventListener('click', ()=> submit(input.value));
    input.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter'){ e.preventDefault(); submit(input.value); return; }
      if (e.key === 'ArrowUp'){ e.preventDefault(); if (history.length){ hIndex = Math.max(0, hIndex - 1); input.value = history[hIndex] || ''; hTip.style.display='block'; setTimeout(()=>hTip.style.display='none', 900); } }
      if (e.key === 'ArrowDown'){ e.preventDefault(); if (history.length){ hIndex = Math.min(history.length, hIndex + 1); input.value = history[hIndex] || ''; } }
    });

    // Y/N buttons: dispatch key events (compatible with many terminal confirmations)
    function dispatchKey(k){ const ev = new KeyboardEvent('keydown', { key:k, bubbles:true }); document.dispatchEvent(ev); }
    yBtn.addEventListener('click', ()=> { dispatchKey('y'); dispatchKey('Y'); });
    nBtn.addEventListener('click', ()=> { dispatchKey('n'); dispatchKey('N'); });

    // NET open/close
    netBtn.addEventListener('click', ()=> { if (gModal.style.display === 'flex') closeGrid(); else openGrid(); });
    gClose.addEventListener('click', closeGrid);

    // lite toggle: soft cap degradation + mute bg
    lite.addEventListener('click', ()=> {
      mobileLiteToggle();
      lite.innerText = mobileLite? 'LITE' : 'FULL';
    });
    function mobileLiteToggle(){
      mobileLite = !mobileLite;
      if (!degradation) return;
      try { if (mobileLite) { if (degradation.level && degradation.level > 60) degradation.level = 60; if (audioMgr && audioMgr.setBackgroundMusicVolume) audioMgr.setBackgroundMusicVolume(0); } else { if (audioMgr && audioMgr.setBackgroundMusicVolume) audioMgr.setBackgroundMusicVolume(0.2); } } catch(e){}
    }
    let mobileLite = true;

    // scale controls: instead of CSS transform we do not scale; zoom buttons try to reduce font via terminal API if exists
    zin.addEventListener('click', ()=> { try { if (TC && typeof TC.setFontScale === 'function') TC.setFontScale( (TC.fontScale || 1) + 0.1 ); else alert('Zoom in unavailable'); } catch(e){ console.warn(e); } });
    zout.addEventListener('click', ()=> { try { if (TC && typeof TC.setFontScale === 'function') TC.setFontScale( (TC.fontScale || 1) - 0.1 ); else alert('Zoom out unavailable'); } catch(e){ console.warn(e); } });

    // window resize / orientation change handling
    function handleResize(){
      resizeTerminalCanvas();
      // if grid open, resize attached grid canvas to modal size
      if (gridAttached && gMap) {
        try {
          const W = gMap.clientWidth, H = gMap.clientHeight;
          setCanvasSize(gridAttached, W, H);
        } catch(e){}
      }
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', ()=> setTimeout(handleResize, 120));

    // initial layout
    // small safety: ensure body scroll enabled so user can scroll terminal if needed
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';

    // run initial sizing a bit delayed to allow fonts/canvas init
    setTimeout(()=> {
      handleResize();
      // scroll to bottom so prompt visible
      window.scrollTo({ top: document.body.scrollHeight });
      console.log('[mobile_fixed] initialized');
      try { if (TC && typeof TC.addColoredText === 'function') TC.addColoredText('Mobile interface ready', '#00FF41'); } catch(e){}
    }, 160);

  });

})();
