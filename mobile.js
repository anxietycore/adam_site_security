/* mobile_fixed_v2.js
   Надёжная мобильная обёртка для terminal_canvas + netGrid + audio + visual overlays.
   Подключать ПОСЛЕ:
     module_audio.js
     netGrid_v3.js
     terminal_canvas.js
     crt_overlay.js (если есть)
     screenGlass.js (если есть)
*/

(function(){
  'use strict';

  const INPUT_BAR_H = 64;           // высота панели ввода (px)
  const GRID_MODAL_VH = 64;         // сколько vh занимает сетка
  const HIGH_Z = 2147483647;        // гарантированный верхний z-index
  const QUICK_CMDS = ['help','syslog','net_mode','clear','reset'];

  // detect mobile (you can force on desktop via window.FORCE_MOBILE_TERMINAL = true)
  const IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(navigator.userAgent) || !!window.FORCE_MOBILE_TERMINAL;

  // inject minimal CSS we need (isolated)
  const css = `
    html,body{height:100%;margin:0;background:#000;overflow:auto;-webkit-text-size-adjust:100%}
    #terminalCanvas{display:block; width:100%; background:#000; touch-action:auto; -webkit-user-select:none; user-select:none; }
    .mf2-bar{position:fixed;left:8px;right:8px;bottom:env(safe-area-inset-bottom,8px);height:${INPUT_BAR_H}px;display:flex;gap:8px;align-items:center;padding:8px;border-radius:12px;background:rgba(0,0,0,0.55);box-sizing:border-box;z-index:${HIGH_Z};backdrop-filter:blur(4px)}
    .mf2-input{flex:1;height:100%;border-radius:10px;padding:10px 12px;background:rgba(0,0,0,0.66);color:#00FF41;border:1px solid rgba(255,255,255,0.04);outline:none;font-family:monospace;font-size:15px}
    .mf2-btn{min-width:48px;height:calc(100% - 6px);border-radius:8px;background:rgba(0,0,0,0.6);color:#00FF41;border:1px solid rgba(255,255,255,0.04);font-family:monospace}
    .mf2-quick{position:fixed;left:8px;bottom:calc(${INPUT_BAR_H + 18}px);display:flex;gap:8px;padding:6px;border-radius:10px;background:rgba(0,0,0,0.45);z-index:${HIGH_Z - 1}}
    .mf2-grid-modal{position:fixed;left:0;right:0;top:0;bottom:0;background:rgba(0,0,0,0.55);display:none;align-items:center;justify-content:center;z-index:${HIGH_Z - 2}}
    .mf2-grid-panel{width:94%;max-width:520px;height:${GRID_MODAL_VH}vh;border-radius:12px;background:#030807;overflow:hidden;display:flex;flex-direction:column;padding:8px;box-sizing:border-box;color:#00FF41}
    .mf2-grid-map{flex:1;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .mf2-history{position:fixed;left:10px;top:10px;background:rgba(0,0,0,0.4);color:#00FF41;padding:6px;border-radius:8px;z-index:${HIGH_Z};display:none;font-size:12px}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // helper to wait for Terminal API
  function waitTerminal(cb, timeout=4000){
    const start = Date.now();
    (function loop(){
      if (window.__TerminalCanvas) return cb(window.__TerminalCanvas);
      if (Date.now() - start > timeout) return cb(window.__TerminalCanvas || null);
      setTimeout(loop, 60);
    })();
  }

  waitTerminal((TC) => {
    const NG = window.__netGrid || null;
    const audioMgr = window.audioManager || window.AudioManager || null;
    const degradation = TC && TC.degradation ? TC.degradation : null;

    // Elements
    const overlay = document.createElement('div'); overlay.className = 'mf2-bar';
    const input = document.createElement('input'); input.className = 'mf2-input'; input.type='text'; input.placeholder='Команда (help)'; input.autocapitalize='none'; input.spellcheck=false;
    const send = document.createElement('button'); send.className='mf2-btn'; send.innerText='→';
    const net = document.createElement('button'); net.className='mf2-btn'; net.innerText='NET';
    const lite = document.createElement('button'); lite.className='mf2-btn'; lite.innerText='LITE';
    // Y/N quick
    const ybtn = document.createElement('button'); ybtn.className='mf2-btn'; ybtn.style.minWidth='44px'; ybtn.innerText='Y';
    const nbtn = document.createElement('button'); nbtn.className='mf2-btn'; nbtn.style.minWidth='44px'; nbtn.innerText='N';

    overlay.appendChild(input); overlay.appendChild(send); overlay.appendChild(net); overlay.appendChild(lite); overlay.appendChild(ybtn); overlay.appendChild(nbtn);
    document.body.appendChild(overlay);

    // quick commands
    const qrow = document.createElement('div'); qrow.className = 'mf2-quick';
    QUICK_CMDS.forEach(k => { const b = document.createElement('button'); b.className='mf2-btn'; b.innerText=k; b.onclick=()=> submit(k); qrow.appendChild(b); });
    document.body.appendChild(qrow);

    // grid modal
    const gmodal = document.createElement('div'); gmodal.className='mf2-grid-modal';
    const gpanel = document.createElement('div'); gpanel.className='mf2-grid-panel';
    const ghead = document.createElement('div'); ghead.innerText = 'NET GRID';
    const gmap = document.createElement('div'); gmap.className='mf2-grid-map';
    const gctrl = document.createElement('div'); gctrl.style.display='flex'; gctrl.style.justifyContent='center'; gctrl.style.gap='8px'; gctrl.style.marginTop='6px';
    const gclose = document.createElement('button'); gclose.className='mf2-btn'; gclose.innerText='Close';
    gctrl.appendChild(gclose);
    gpanel.appendChild(ghead); gpanel.appendChild(gmap); gpanel.appendChild(gctrl); gmodal.appendChild(gpanel);
    document.body.appendChild(gmodal);

    // history tip
    const hist = document.createElement('div'); hist.className='mf2-history'; hist.innerText='UP/DOWN — история команд'; document.body.appendChild(hist);

    // ensure overlay above CRT/glass and other canvases
    // If crt_overlay or screenGlass exist, lower their z or disable pointer events to not block input
    (function normalizeVisualOverlays(){
      try {
        const crt = document.getElementById('crtOverlayCanvas');
        if (crt) { crt.style.zIndex = (HIGH_Z - 100).toString(); crt.style.pointerEvents = 'none'; }
        const glass = document.getElementById('glassFX');
        if (glass) { glass.style.zIndex = (HIGH_Z - 110).toString(); glass.style.pointerEvents = 'none'; }
        // any other canvas that's visually above terminal but not interactive
        const canvases = Array.from(document.querySelectorAll('canvas'));
        canvases.forEach(c => {
          if (c.id && (c.id === 'terminalCanvas')) return;
          // don't drop the terminalCanvas
          if (!c.closest('.mf2-bar') && c.style && parseInt(c.style.zIndex || '0') > (HIGH_Z - 200)) {
            c.style.zIndex = (HIGH_Z - 200).toString();
            c.style.pointerEvents = 'none';
          }
        });
      } catch(e){ console.warn('[mf2] normalizeVisualOverlays err', e); }
    })();

    // helper: set canvas buffer size (DPR aware) and CSS size
    function setCanvasBuffer(canvas, w, h){
      if (!canvas) return;
      const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      // call terminal resize API if exists
      try { if (TC && typeof TC.onResize === 'function') TC.onResize(w, h); } catch(e){}
    }

    // compute available height for terminal
    function availableHeight(){
      const vh = window.innerHeight;
      // consider quick row + input + margins
      const qh = qrow.getBoundingClientRect ? qrow.getBoundingClientRect().height : 0;
      const reserved = INPUT_BAR_H + qh + 28;
      return Math.max(120, Math.floor(vh - reserved));
    }

    // resize terminal canvas to availableHeight
    const termCanvas = document.getElementById('terminalCanvas');
    function adjustTerminal(){
      if (!termCanvas) return;
      const w = Math.max(320, Math.floor(window.innerWidth));
      const h = availableHeight();
      setCanvasBuffer(termCanvas, w, h);
      // ensure body allows scrolling if output longer than viewport
      document.documentElement.style.height = '100%';
      document.body.style.minHeight = '100vh';
      // scroll to bottom to show prompt after resize
      setTimeout(()=> window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 120);
    }

    // initial adjust + listeners
    adjustTerminal();
    window.addEventListener('resize', adjustTerminal);
    window.addEventListener('orientationchange', ()=> setTimeout(adjustTerminal, 120));

    // attach grid: move net canvas to modal map and resize its buffer
    let attachedGrid = null, attachedGridOrigParent = null, attachedGridOrigStyles = null;
    function findNetCanvas(){
      const byId = document.getElementById('netCanvas') || document.querySelector('canvas.net-grid');
      if (byId) return byId;
      const canv = Array.from(document.querySelectorAll('canvas'));
      for (const c of canv) if (c !== termCanvas) return c;
      return null;
    }
    function openGrid(){
      // hide degradation indicator if present
      try { if (degradation && degradation.indicator) degradation.indicator.style.display = 'none'; } catch(e){}
      gmodal.style.display = 'flex';
      const c = findNetCanvas();
      if (!c) return;
      attachedGrid = c; attachedGridOrigParent = c.parentNode; attachedGridOrigStyles = c.style.cssText || '';
      // compute map size
      const W = Math.max(160, gmap.clientWidth || Math.floor(window.innerWidth * 0.9));
      const H = Math.max(120, gmap.clientHeight || Math.floor(window.innerHeight * (GRID_MODAL_VH / 100)) - 80);
      // reparent and resize buffer
      try {
        c.style.position = 'relative';
        c.style.width = '100%';
        c.style.height = '100%';
        c.style.pointerEvents = 'auto';
        setCanvasBuffer(c, W, H);
        gmap.appendChild(c);
        // call netGrid API if available
        if (NG && typeof NG.resize === 'function') { try { NG.resize(W, H); } catch(e){} }
      } catch(err){ console.warn('[mf2] attach grid error', err); }
      // disable terminal pointer so interactions are clean
      if (termCanvas) termCanvas.style.pointerEvents = 'none';
    }
    function closeGrid(){
      gmodal.style.display = 'none';
      if (attachedGrid && attachedGridOrigParent) {
        try {
          attachedGrid.style.cssText = attachedGridOrigStyles || '';
          attachedGridOrigParent.appendChild(attachedGrid);
        } catch(e){ console.warn('[mf2] restore grid', e); }
      }
      attachedGrid = null; attachedGridOrigParent = null; attachedGridOrigStyles = null;
      if (termCanvas) termCanvas.style.pointerEvents = 'auto';
      try { if (degradation && degradation.indicator) degradation.indicator.style.display = ''; } catch(e){}
    }
    net.addEventListener('click', ()=> { if (gmodal.style.display === 'flex') closeGrid(); else openGrid(); });
    gclose.addEventListener('click', closeGrid);

    // send command
    function submit(cmd){
      if (!cmd || !String(cmd).trim()) return;
      const c = String(cmd).trim();
      // history saved in terminal if desired — we also keep local
      try {
        if (window.__MobileTermHistory === undefined) window.__MobileTermHistory = [];
        if (window.__MobileTermHistory.length === 0 || window.__MobileTermHistory[window.__MobileTermHistory.length-1] !== c) window.__MobileTermHistory.push(c);
      } catch(e){}
      // play key
      try { if (audioMgr && audioMgr.playSound) audioMgr.playSound('interface','interface_key_press_01.mp3', { volume: 0.5 }); } catch(e){}
      // dispatch to terminal API or fallback
      if (TC && typeof TC.processCommand === 'function') {
        try { TC.processCommand(c); } catch(e){ console.warn('[mf2] TC.processCommand failed', e); }
      } else {
        try { window.currentLine = c; } catch(e){}
        const ev = new KeyboardEvent('keydown', { key:'Enter', bubbles:true }); document.dispatchEvent(ev);
      }
      input.value = '';
      input.blur();
      // ensure we can view latest output
      setTimeout(()=> window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' }), 120);
      hist.style.display = 'none';
    }

    send.addEventListener('click', ()=> submit(input.value));
    input.addEventListener('keydown', (e)=> {
      if (e.key === 'Enter') { e.preventDefault(); submit(input.value); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); const H = window.__MobileTermHistory || []; if (H.length){ input.value = H[Math.max(0,H.length-1)]; hist.style.display='block'; setTimeout(()=> hist.style.display='none',800);} return; }
    });

    // quick Y/N buttons: dispatch key events (many terminals listen)
    function dispatchKey(k){ const ev = new KeyboardEvent('keydown', { key:k, bubbles:true }); document.dispatchEvent(ev); }
    ybtn.addEventListener('click', ()=> { dispatchKey('y'); dispatchKey('Y'); });
    nbtn.addEventListener('click', ()=> { dispatchKey('n'); dispatchKey('N'); });

    // lite toggle: soft cap degradation + mute background music if possible
    let isLite = true;
    lite.addEventListener('click', ()=> {
      isLite = !isLite;
      lite.innerText = isLite ? 'LITE' : 'FULL';
      try {
        if (degradation && degradation.level) {
          if (isLite && degradation.level > 60) degradation.level = 60;
        }
        if (audioMgr && typeof audioMgr.setBackgroundMusicVolume === 'function') {
          audioMgr.setBackgroundMusicVolume(isLite ? 0 : 0.2);
        }
      } catch(e){}
    });

    // ensure overlay focus behavior: when input focuses, scroll page so prompt visible
    input.addEventListener('focus', ()=> {
      // try to scroll terminal into view (terminalCanvas top may be off)
      setTimeout(()=> {
        try { window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' }); } catch(e){}
      }, 80);
    });

    // touch pan: allow dragging canvas to scroll page
    let pan = null;
    function touchStart(e){ if (!e.touches || e.touches.length !== 1) return; pan = { y: e.touches[0].clientY, startScroll: window.scrollY }; }
    function touchMove(e){ if (!pan || !e.touches || e.touches.length !== 1) return; const dy = e.touches[0].clientY - pan.y; window.scrollTo({ top: Math.max(0, pan.startScroll - dy) }); }
    function touchEnd(){ pan = null; }
    if (termCanvas) {
      termCanvas.addEventListener('touchstart', touchStart, { passive:true });
      termCanvas.addEventListener('touchmove', touchMove, { passive:false });
      termCanvas.addEventListener('touchend', touchEnd, { passive:true });
    }

    // on resize/orientation -> recalc canvas sizes and if grid open resize it
    function onResize(){
      adjustTerminal();
      if (attachedGrid && gmap) {
        try {
          const W = gmap.clientWidth || Math.floor(window.innerWidth * 0.9);
          const H = gmap.clientHeight || Math.floor(window.innerHeight * (GRID_MODAL_VH/100)) - 80;
          setCanvasBuffer(attachedGrid, W, H);
          if (NG && typeof NG.resize === 'function') NG.resize(W, H);
        } catch(e){}
      }
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', ()=> setTimeout(onResize, 120));

    // initial adjust, small delay to allow terminal to initialise
    setTimeout(()=> { try { adjustTerminal(); console.log('[mf2] mobile_fixed_v2 initialized'); if (TC && TC.addColoredText) TC.addColoredText('Mobile interface ready', '#00FF41'); } catch(e){ } }, 200);

  }); // end waitTerminal

})(); // end IIFE
