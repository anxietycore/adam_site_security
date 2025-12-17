/* mobile.js — мобильная обёртка, совместимая с terminal_canvas.js, когда в нём доступен __TerminalCanvas.onResize
   Подключать ПОСЛЕ:
     - module_audio.js (опционально)
     - netGrid_v3.js (опционально)
     - terminal_canvas.js  (обязательно; в нём должна быть __TerminalCanvas.onResize)
     - crt_overlay.js / screenGlass.js (если есть)
*/

(function(){
  'use strict';

  // -------- Config --------
  const INPUT_BAR_H = 64;           // px - высота панели ввода
  const GRID_MODAL_VH = 64;         // сетка занимает %vh внутри модалки
  const Z_TOP = 2147483646;         // очень большой z-index для UI
  const QUICK_CMD_LIST = ['help','syslog','net_mode','clear','reset']; // кнопки быстрого доступа

  // If you want to force mobile UI on desktop for testing:
  const FORCE = !!window.FORCE_MOBILE_TERMINAL || !!window.FORCE_MOBILE;

  const IS_MOBILE = FORCE || /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(navigator.userAgent);

  // If not mobile and not forced, still load (for easier dev), but UI is meant for phones.
  // -------- Helpers --------
  const $ = (s, ctx=document) => ctx.querySelector(s);
  const make = (tag, props={}, styles={})=>{
    const el = document.createElement(tag);
    Object.assign(el, props);
    Object.assign(el.style, styles);
    return el;
  };

  // Prevent double-insert if script runs multiple times
  if (document.getElementById('mobile_ui_overlay_v1')) {
    console.log('[mobile.js] mobile UI already present');
    return;
  }

  // -------- Inject minimal CSS --------
  const css = `
  #mobile_ui_overlay_v1{ position:fixed; left:8px; right:8px; bottom:env(safe-area-inset-bottom,8px); height:${INPUT_BAR_H}px; display:flex; gap:8px; align-items:center; padding:8px; box-sizing:border-box; border-radius:12px; background: rgba(0,0,0,0.56); z-index:${Z_TOP}; font-family: monospace; -webkit-tap-highlight-color: transparent; }
  #mobile_ui_overlay_v1 input{ flex:1; height:100%; border-radius:10px; padding:10px 12px; background: rgba(0,0,0,0.66); color:#00FF41; border:1px solid rgba(255,255,255,0.04); outline:none; font-size:15px; }
  .mobile_ui_btn{ min-width:48px; height: calc(100% - 6px); border-radius:8px; background: rgba(0,0,0,0.6); color:#00FF41; border:1px solid rgba(255,255,255,0.04); font-family: monospace; }
  #mobile_ui_quick{ position:fixed; left:8px; bottom:calc(${INPUT_BAR_H + 18}px); display:flex; gap:8px; padding:6px; border-radius:10px; background: rgba(0,0,0,0.45); z-index:${Z_TOP - 1}; }
  #mobile_ui_grid_modal{ position:fixed; left:0; right:0; top:0; bottom:0; background: rgba(0,0,0,0.55); display:none; align-items:center; justify-content:center; z-index:${Z_TOP - 2}; }
  #mobile_ui_grid_panel{ width:94%; max-width:520px; height:${GRID_MODAL_VH}vh; border-radius:12px; background:#030807; overflow:hidden; display:flex; flex-direction:column; padding:8px; box-sizing:border-box; color:#00FF41; }
  #mobile_ui_grid_map{ flex:1; position:relative; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  #mobile_ui_history_tip{ position:fixed; left:10px; top:10px; background: rgba(0,0,0,0.45); color:#00FF41; padding:6px; border-radius:8px; z-index:${Z_TOP}; display:none; font-size:12px; }
  `;

  const styleTag = document.createElement('style');
  styleTag.innerText = css;
  document.head.appendChild(styleTag);

  // -------- Build UI --------
  const overlay = make('div', { id: 'mobile_ui_overlay_v1', role:'region', 'aria-label':'mobile terminal controls' });
  const input = make('input', { type:'text', placeholder: 'Команда (help)', id:'mobile_input_v1', autocapitalize:'none', spellcheck:false });
  const sendBtn = make('button', { innerText: '→', title:'Send' }, { });
  sendBtn.className = 'mobile_ui_btn';
  const netBtn = make('button', { innerText: 'NET', title:'Open NET grid' }, {});
  netBtn.className = 'mobile_ui_btn';
  const liteBtn = make('button', { innerText: 'LITE', title:'Mobile Lite' }, {});
  liteBtn.className = 'mobile_ui_btn';
  const yBtn = make('button', { innerText: 'Y', title:'Yes' }, {}); yBtn.className='mobile_ui_btn';
  const nBtn = make('button', { innerText: 'N', title:'No' }, {}); nBtn.className='mobile_ui_btn';
  overlay.appendChild(input);
  overlay.appendChild(sendBtn);
  overlay.appendChild(netBtn);
  overlay.appendChild(liteBtn);
  overlay.appendChild(yBtn);
  overlay.appendChild(nBtn);
  overlay.id = 'mobile_ui_overlay_v1';

  const quick = make('div', { id:'mobile_ui_quick' });
  QUICK_LOOP: for (const q of QUICK_CMD_LIST) {
    const b = make('button', { innerText: q, title:q }, {});
    b.className = 'mobile_ui_btn';
    b.addEventListener('click', ()=> submitCommand(q));
    quick.appendChild(b);
  }

  const gridModal = make('div', { id:'mobile_ui_grid_modal' });
  const gridPanel = make('div', { id:'mobile_ui_grid_panel' });
  const gridHead = make('div', {}, { fontSize:'12px', marginBottom:'6px' }); gridHead.innerText = 'NET GRID';
  const gridMap = make('div', { id:'mobile_ui_grid_map' });
  const gridControls = make('div', {}, { display:'flex', justifyContent:'center', gap:'8px', marginTop:'6px' });
  const gridClose = make('button', { innerText:'Close' }); gridClose.className='mobile_ui_btn';
  gridControls.appendChild(gridClose);
  gridPanel.appendChild(gridHead);
  gridPanel.appendChild(gridMap);
  gridPanel.appendChild(gridControls);
  gridModal.appendChild(gridPanel);

  const historyTip = make('div', { id:'mobile_ui_history_tip' }); historyTip.innerText = 'UP/DOWN — история команд';

  document.body.appendChild(overlay);
  document.body.appendChild(quick);
  document.body.appendChild(gridModal);
  document.body.appendChild(historyTip);

  // ensure overlays are after terminal canvas, to sit visually above
  const termCanvas = document.getElementById('terminalCanvas');
  if (termCanvas && termCanvas.parentNode) {
    // move overlays after canvas node so stacking is predictable
    termCanvas.parentNode.appendChild(overlay);
    termCanvas.parentNode.appendChild(quick);
    termCanvas.parentNode.appendChild(gridModal);
    termCanvas.parentNode.appendChild(historyTip);
  }

  // -------- State --------
  let cmdHistory = [];
  let histIndex = 0;
  let mobileLite = true;
  let attachedGridCanvas = null;
  let attachedGridOrigParent = null;
  let attachedGridOrigStyles = null;

  const audioMgr = window.audioManager || window.AudioManager || null;
  const NG = window.__netGrid || null;
  const TC = window.__TerminalCanvas || window.__terminalCanvas || null; // patched terminal should expose __TerminalCanvas

  // Utility: safe call onResize
  function safeOnResize(w,h){
    try {
      if (window.__TerminalCanvas && typeof window.__TerminalCanvas.onResize === 'function') {
        window.__TerminalCanvas.onResize(w,h);
      } else {
        // fallback: dispatch resize so terminal's own handler can pick it up if present
        window.dispatchEvent(new Event('resize'));
      }
    } catch(e){
      console.warn('[mobile.js] onResize failed', e);
    }
  }

  // Use visualViewport if present to measure available height (better for keyboard)
  function getViewportHeight(){
    if (window.visualViewport && typeof window.visualViewport.height === 'number') {
      return Math.floor(window.visualViewport.height);
    }
    return Math.floor(window.innerHeight);
  }

  function getAvailableHeightForTerminal(){
    // reserve space for quick row and input bar visually: allow some margin
    const vh = getViewportHeight();
    const quickRect = quick.getBoundingClientRect ? quick.getBoundingClientRect() : { height: 0 };
    const reserved = INPUT_BAR_H + (quickRect.height || 0) + 20;
    return Math.max(120, vh - reserved);
  }

  // adjust main terminal when viewport changes
  function adjustTerminal(){
    const width = Math.max(320, Math.floor(window.innerWidth));
    const height = getAvailableHeightForTerminal();
    safeOnResize(width, height);
    // ensure we can scroll to bottom if needed
    setTimeout(()=> { try { window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' }); } catch(e){} }, 150);
  }

  // initial adjust
  setTimeout(adjustTerminal, 120);

  // react to viewport changes (keyboard appear/hide etc)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', ()=> {
      // small delay to allow layout to settle
      setTimeout(adjustTerminal, 80);
    });
    window.visualViewport.addEventListener('scroll', ()=> {
      // if viewport scrolled, recalc terminal
      setTimeout(adjustTerminal, 60);
    });
  } else {
    window.addEventListener('resize', ()=> setTimeout(adjustTerminal, 80));
    window.addEventListener('orientationchange', ()=> setTimeout(adjustTerminal, 120));
  }

  // safe attach listeners to input: on focus/blur call onResize with available area
  input.addEventListener('focus', ()=>{
    // after keyboard opens, visualViewport.innerHeight updates; wait a bit
    setTimeout(()=> {
      adjustTerminal();
    }, 360);
  });
  input.addEventListener('blur', ()=> {
    setTimeout(()=> adjustTerminal(), 200);
  });

  // Keyboard send
  function submitCommand(text){
    const cmd = String(text || '').trim();
    if (!cmd) return;
    // record history
    if (!cmdHistory.length || cmdHistory[cmdHistory.length-1] !== cmd) cmdHistory.push(cmd);
    histIndex = cmdHistory.length;
    // play key sound (if available)
    try { if (audioMgr && audioMgr.playSound) audioMgr.playSound('interface','interface_key_press_01.mp3', { volume: 0.5 }); } catch(e){}
    // try terminal API
    try {
      if (window.__TerminalCanvas && typeof window.__TerminalCanvas.processCommand === 'function') {
        window.__TerminalCanvas.processCommand(cmd);
      } else {
        // fallback: set currentLine + dispatch Enter
        window.currentLine = cmd;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
    } catch(e){
      console.warn('[mobile.js] submitCommand failed', e);
    }
    input.value = '';
    input.blur();
    // after submit, scroll to bottom
    setTimeout(()=> { try { window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth' }); } catch(e){} }, 120);
  }

  sendBtn.addEventListener('click', ()=> submitCommand(input.value));
  input.addEventListener('keydown', (e)=> {
    if (e.key === 'Enter') { e.preventDefault(); submitCommand(input.value); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (cmdHistory.length){ histIndex = Math.max(0, histIndex - 1); input.value = cmdHistory[histIndex] || ''; showHistoryTip(); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (cmdHistory.length){ histIndex = Math.min(cmdHistory.length, histIndex + 1); input.value = cmdHistory[histIndex] || ''; } return; }
  });

  function showHistoryTip(){ historyTip.style.display = 'block'; setTimeout(()=> historyTip.style.display = 'none', 900); }

  // Y/N buttons (simulate keypress)
  function dispatchKey(k){
    try { document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); } catch(e){}
  }
  yBtn.addEventListener('click', ()=> { dispatchKey('y'); dispatchKey('Y'); });
  nBtn.addEventListener('click', ()=> { dispatchKey('n'); dispatchKey('N'); });

  // quick cmd buttons handled earlier; but allow programmatic call too
  function submitQuick(cmd){ submitCommand(cmd); }

  // LITE toggle: soft-cap degradation and mute background music if available
  liteBtn.addEventListener('click', ()=>{
    mobileToggleLite();
  });
  let _isLite = mobileLite;
  function mobileToggleLite(){
    _isLite = !_isLite;
    liteBtn.innerText = _isLite ? 'LITE' : 'FULL';
    try {
      if (window.__TerminalCanvas && window.__TerminalCanvas.degradation) {
        if (_isLite && window.__TerminalCanvas.degradation.level && window.__TerminalCanvas.degradation.level > 60) {
          window.__TerminalCanvas.degradation.level = 60;
          if (typeof window.__TerminalCanvas.degradation.updateIndicator === 'function')
            window.__TerminalCanvas.degradation.updateIndicator();
        }
      }
      if (audioMgr && typeof audioMgr.setBackgroundMusicVolume === 'function') {
        audioMgr.setBackgroundMusicVolume(_isLite ? 0 : 0.2);
      }
    } catch(e){ console.warn('[mobile.js] mobileLite toggle error', e); }
  }

  // -------- GRID handling (move grid canvas into modal and resize) --------
  function findNetCanvas(){
    const byId = document.getElementById('netCanvas') || document.querySelector('canvas.net-grid');
    if (byId) return byId;
    const canvases = Array.from(document.querySelectorAll('canvas'));
    for (const c of canvases) {
      if (c !== termCanvas) return c;
    }
    return null;
  }

  function setCanvasBuffer(canvas, w, h){
    if (!canvas) return;
    const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  function openGrid(){
    // hide degradation if exists
    try { if (window.__TerminalCanvas && window.__TerminalCanvas.degradation && window.__TerminalCanvas.degradation.indicator) window.__TerminalCanvas.degradation.indicator.style.display = 'none'; } catch(e){}
    gridModal.style.display = 'flex';
    const c = findNetCanvas();
    if (!c) return;
    attachedGridCanvas = c;
    attachedGridOrigParent = c.parentNode;
    attachedGridOrigStyles = c.style.cssText || '';
    // compute panel inner size
    const W = Math.max(160, gridMap.clientWidth || Math.floor(window.innerWidth * 0.9));
    const H = Math.max(120, gridMap.clientHeight || Math.floor(window.innerHeight * (GRID_MODAL_VH / 100)) - 80);
    // attach and buffer-size
    try {
      c.style.position = 'relative';
      c.style.width = '100%';
      c.style.height = '100%';
      c.style.pointerEvents = 'auto';
      setCanvasBuffer(c, W, H);
      gridMap.appendChild(c);
      if (NG && typeof NG.resize === 'function') {
        try { NG.resize(W, H); } catch(e){ console.warn('[mobile.js] NG.resize failed', e); }
      }
    } catch(err){ console.warn('[mobile.js] attach net canvas error', err); }
    // shrink main terminal so it doesn't overlap (ask terminal to resize to smaller height)
    setTimeout(()=> adjustTerminal(), 60);
    // disable main terminal pointer to avoid conflict
    if (termCanvas) termCanvas.style.pointerEvents = 'none';
  }

  function closeGrid(){
    gridModal.style.display = 'none';
    if (attachedGridCanvas && attachedGridOrigParent) {
      try {
        attachedGridCanvas.style.cssText = attachedGridOrigStyles || '';
        attachedGridOrigParent.appendChild(attachedGridCanvas);
      } catch(e){ console.warn('[mobile.js] restore net canvas failed', e); }
    }
    attachedGridCanvas = null; attachedGridOrigParent = null; attachedGridOrigStyles = null;
    if (termCanvas) termCanvas.style.pointerEvents = 'auto';
    try { if (window.__TerminalCanvas && window.__TerminalCanvas.degradation && window.__TerminalCanvas.degradation.indicator) window.__TerminalCanvas.degradation.indicator.style.display = ''; } catch(e){}
    // restore terminal size
    setTimeout(()=> adjustTerminal(), 80);
  }

  netBtn.addEventListener('click', ()=> {
    if (gridModal.style.display === 'flex') closeGrid(); else openGrid();
  });
  gridClose.addEventListener('click', closeGrid);

  // allow scrolling by dragging the canvas (touch pan)
  let touchPan = null;
  function onCanvasTouchStart(e){
    if (!e.touches || e.touches.length !== 1) return;
    touchPan = { y: e.touches[0].clientY, scroll: window.scrollY };
  }
  function onCanvasTouchMove(e){
    if (!touchPan || !e.touches || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - touchPan.y;
    window.scrollTo({ top: Math.max(0, touchPan.scroll - dy) });
  }
  function onCanvasTouchEnd(){ touchPan = null; }
  if (termCanvas) {
    termCanvas.addEventListener('touchstart', onCanvasTouchStart, { passive:true });
    termCanvas.addEventListener('touchmove', onCanvasTouchMove, { passive:false });
    termCanvas.addEventListener('touchend', onCanvasTouchEnd, { passive:true });
  }

  // if CRT/Glass overlays exist, lower their pointer-events / z so overlay input works
  (function normalizeVisuals(){
    try {
      const crt = document.getElementById('crtOverlayCanvas');
      if (crt) { crt.style.zIndex = (Z_TOP - 100).toString(); crt.style.pointerEvents = 'none'; }
      const glass = document.getElementById('glassFX') || document.querySelector('.screenGlass');
      if (glass && glass.style) { glass.style.zIndex = (Z_TOP - 110).toString(); glass.style.pointerEvents = 'none'; }
    } catch(e){ /* ignore */ }
  })();

  // expose API for dev / debugging
  window.__MobileUI = {
    submitCommand,
    openGrid,
    closeGrid,
    adjustTerminal,
    setLite: (v)=> { _isLite = !!v; mobileToggleLite(); }
  };

  // auto-adjust on load (give terminal a little time to init)
  setTimeout(()=> {
    try { adjustTerminal(); } catch(e){ console.warn('[mobile.js] initial adjust failed', e); }
  }, 220);

  console.log('[mobile.js] mobile UI loaded');

})();
