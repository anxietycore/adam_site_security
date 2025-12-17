/* mobile.js — Полная мобильная версия для терминала
   Подключать ПОСЛЕ: module_audio.js, netGrid_v3.js, terminal_canvas.js
   Что делает:
    - Надёжный input overlay + кнопки Y/N + быстрые команды
    - История команд (up/down)
    - NET grid в модальном окне с корректным ресайзом canvas
    - Масштабирование терминала (zoom)
    - mobileLite режим (ограничивает деградацию/звук)
   Примечание: файл НЕ трогает исходные файлы терминала — использует их публичное API (processCommand, degradation, и т.д.) когда доступно.
*/

(function(){
  'use strict';

  // ========== Настройки ==========
  const MOBILE_BAR_HEIGHT = 64; // высота панели ввода (px)
  const GRID_MODAL_HEIGHT_PERC = 64; // % высоты экрана для модалки сетки
  const DEFAULT_MOBILE_LITE = true;
  const INITIAL_SCALE = 1.0;
  const SCALE_STEP = 0.08;
  const MAX_SCALE = 1.6;
  const MIN_SCALE = 0.6;

  // быстрые команды — можно расширить
  const QUICK_COMMANDS = [
    {label: 'help', cmd: 'help'},
    {label: 'syslog', cmd: 'syslog'},
    {label: 'net_mode', cmd: 'net_mode'},
    {label: 'clear', cmd: 'clear'},
    {label: 'reset', cmd: 'reset'}
  ];

  // проверка мобильного устройства (для развития/тестирования можно поставить window.FORCE_MOBILE = true)
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(navigator.userAgent) || !!window.FORCE_MOBILE;

  if (!isMobile && !window.FORCE_MOBILE) {
    console.log('[mobile.js] not mobile (use FORCE_MOBILE=true to force)');
    // всё равно можно подключить — dev может тестировать
  }

  // ========== Утилиты ==========
  function $(sel, ctx=document) { return ctx.querySelector(sel); }
  function $all(sel, ctx=document) { return Array.from(ctx.querySelectorAll(sel)); }
  function make(tag, attrs={}, styles={}) {
    const el = document.createElement(tag);
    Object.assign(el, attrs);
    Object.assign(el.style, styles);
    return el;
  }

  // Ожидаем, что terminal API появится. Но не блокируем навсегда.
  function whenTerminalReady(cb, timeout=3000){
    const start = Date.now();
    (function poll(){
      if (window.__TerminalCanvas) return cb(window.__TerminalCanvas);
      if (Date.now() - start > timeout) return cb(null);
      setTimeout(poll, 60);
    })();
  }

  whenTerminalReady((TC) => {

    const NG = window.__netGrid || null;
    const audioMgr = window.audioManager || window.AudioManager || null;
    const degradation = TC && TC.degradation ? TC.degradation : null;

    // ========== Добавляем стили (изолированно) ==========
    const style = make('style');
    style.textContent = `
      .mob-term-overlay{ position: fixed; left: 8px; right: 8px; bottom: env(safe-area-inset-bottom,8px); height: ${MOBILE_BAR_HEIGHT}px; z-index:2147483647; display:flex; gap:8px; align-items:center; padding:8px; box-sizing:border-box; border-radius:12px; background: rgba(0,0,0,0.55); backdrop-filter: blur(4px); font-family: monospace; }
      .mob-term-input{ flex:1; height:100%; border-radius:10px; padding:10px 12px; font-size:15px; background: rgba(0,0,0,0.65); color:#00FF41; border:1px solid rgba(255,255,255,0.04); outline:none; -webkit-appearance:none; }
      .mob-btn{ min-width:44px; height: calc(100% - 6px); border-radius:8px; font-family:monospace; font-size:13px; color:#00FF41; background: rgba(0,0,0,0.65); border:1px solid rgba(255,255,255,0.04); }
      .mob-quick-row{ position: fixed; left:8px; bottom: calc(${MOBILE_BAR_HEIGHT + 18}px); z-index:2147483646; display:flex; gap:8px; padding:6px; border-radius:10px; background: rgba(0,0,0,0.45); }
      .mob-yn{ display:flex; gap:6px; align-items:center; }
      .mob-yn .mob-yn-btn{ min-width:40px; height:36px; border-radius:8px; }
      .mob-grid-modal{ position:fixed; left:0; right:0; top:0; bottom:0; background: rgba(0,0,0,0.55); display:none; align-items:center; justify-content:center; z-index:2147483645; }
      .mob-grid-panel{ width:94%; max-width:520px; height: ${GRID_MODAL_HEIGHT_PERC}vh; border-radius:12px; background:#030807; overflow:hidden; display:flex; flex-direction:column; padding:8px; box-sizing:border-box; color:#00FF41; }
      .mob-grid-map{ flex:1; position:relative; display:flex; align-items:center; justify-content:center; overflow:hidden; }
      .mob-scale-controls{ position:fixed; right:10px; bottom: calc(${MOBILE_BAR_HEIGHT + 18}px); display:flex; gap:6px; z-index:2147483646; }
      .mob-history-tip{ position: fixed; left: 10px; top: 10px; background: rgba(0,0,0,0.5); color: #00FF41; font-size: 12px; padding: 6px; border-radius: 8px; z-index: 2147483648; display:none; }
    `;
    document.head.appendChild(style);

    // ========== Создаём элементы UI ==========
    const overlay = make('div', { className: 'mob-term-overlay' });
    const input = make('input', { className: 'mob-term-input', type:'text', placeholder: 'Команда (help)', autocomplete:'off', autocorrect:'off', spellcheck:false });
    overlay.appendChild(input);

    const sendBtn = make('button', { className:'mob-btn', innerText:'→', title:'Send' });
    overlay.appendChild(sendBtn);

    // quick commands row (above overlay)
    const quickRow = make('div', { className:'mob-quick-row' });
    QUICK_COMMANDS.forEach(q => {
      const b = make('button', { className:'mob-btn', innerText: q.label, title: q.cmd });
      b.addEventListener('click', ()=> submitCommand(q.cmd));
      quickRow.appendChild(b);
    });
    document.body.appendChild(quickRow);

    // Y/N small buttons (to the right of input)
    const ynWrap = make('div', { className:'mob-yn' });
    const yBtn = make('button', { className:'mob-btn mob-yn-btn', innerText:'Y' });
    const nBtn = make('button', { className:'mob-btn mob-yn-btn', innerText:'N' });
    ynWrap.appendChild(yBtn); ynWrap.appendChild(nBtn);
    overlay.appendChild(ynWrap);

    // scale controls
    const scaleControls = make('div', { className:'mob-scale-controls' });
    const zoomIn = make('button', { className:'mob-btn', innerText:'+' });
    const zoomOut = make('button', { className:'mob-btn', innerText:'-' });
    const resetZoom = make('button', { className:'mob-btn', innerText:'1x' });
    scaleControls.appendChild(zoomIn); scaleControls.appendChild(resetZoom); scaleControls.appendChild(zoomOut);
    document.body.appendChild(scaleControls);

    // grid modal
    const gridModal = make('div', { className:'mob-grid-modal' });
    const gridPanel = make('div', { className:'mob-grid-panel' });
    gridModal.appendChild(gridPanel);
    const gridHeader = make('div', {}, { fontSize:'12px', marginBottom:'6px' }); gridHeader.innerText = 'NET GRID';
    gridPanel.appendChild(gridHeader);
    const gridMap = make('div', { className:'mob-grid-map' });
    gridPanel.appendChild(gridMap);
    const gridControls = make('div', {}, { display:'flex', gap:'8px', marginTop:'6px', justifyContent:'center' });
    const closeGridBtn = make('button', { className:'mob-btn', innerText:'Close' });
    gridControls.appendChild(closeGridBtn);
    gridPanel.appendChild(gridControls);
    document.body.appendChild(gridModal);

    // history tip
    const historyTip = make('div', { className:'mob-history-tip' }); historyTip.innerText = 'UP/DOWN — история команд';
    document.body.appendChild(historyTip);

    // добавим overlay в DOM (после canvas чтобы быть наверху)
    const termCanvas = document.getElementById('terminalCanvas');
    document.body.appendChild(overlay); // просто в body, стиль позиционирует

    // ========== State ==========
    let mobileLite = DEFAULT_MOBILE_LITE;
    let commandHistory = [];
    let historyIndex = -1;
    let currentScale = INITIAL_SCALE;
    let attachedGridCanvas = null;
    let originalGridParent = null;
    let originalGridStyles = null;
    let degradationElement = null;

    // ========== Полезные функции ==========
    function dispatchKey(key){
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      document.dispatchEvent(ev);
    }

    function submitCommand(text){
      const cmd = String(text || '').trim();
      if (!cmd) return;
      // Save history
      if (!commandHistory.length || commandHistory[commandHistory.length-1] !== cmd) {
        commandHistory.push(cmd);
        if (commandHistory.length > 200) commandHistory.shift();
      }
      historyIndex = commandHistory.length;
      // Play key sound if available
      try { if (audioMgr && audioMgr.playSound) audioMgr.playSound('interface','interface_key_press_01.mp3', { volume: 0.5 }); } catch(e){}
      // Use terminal API if exists
      if (TC && typeof TC.processCommand === 'function') {
        try { TC.processCommand(cmd); } catch(e){ console.warn('[mobile.js] TC.processCommand failed', e); }
      } else {
        // fallback: set currentLine and dispatch Enter
        try { window.currentLine = cmd; } catch(e){}
        dispatchKey('Enter');
      }
      input.value = '';
      input.blur();
      hideHistoryTipSoon();
    }

    function showHistoryTip(){
      historyTip.style.display = 'block';
      setTimeout(()=> historyTip.style.opacity = '1', 20);
    }
    function hideHistoryTipSoon(){ historyTip.style.opacity = '0'; setTimeout(()=> historyTip.style.display='none', 300); }

    // ========== Input behavior ==========
    sendBtn.addEventListener('click', ()=> submitCommand(input.value));
    input.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter'){ e.preventDefault(); submitCommand(input.value); return; }
      if (e.key === 'ArrowUp'){ e.preventDefault(); if (commandHistory.length){ historyIndex = Math.max(0, historyIndex - 1); input.value = commandHistory[historyIndex] || ''; showHistoryTip(); } return; }
      if (e.key === 'ArrowDown'){ e.preventDefault(); if (commandHistory.length){ historyIndex = Math.min(commandHistory.length, historyIndex + 1); input.value = commandHistory[historyIndex] || ''; showHistoryTip(); } return; }
    });

    // focus helpers: when focusing input, ensure terminal canvas won't steal touches
    input.addEventListener('focus', ()=>{
      if (termCanvas) {
        termCanvas.dataset._origPointer = termCanvas.style.pointerEvents || '';
        termCanvas.style.pointerEvents = 'none';
      }
      document.documentElement.style.scrollPaddingBottom = (MOBILE_BAR_HEIGHT + 12) + 'px';
    });
    input.addEventListener('blur', ()=>{
      if (termCanvas) try { termCanvas.style.pointerEvents = termCanvas.dataset._origPointer || ''; } catch(e){}
      document.documentElement.style.scrollPaddingBottom = '';
    });

    // Y/N buttons — посылаем keydown как ответ пользователю
    yBtn.addEventListener('click', ()=> { dispatchKey('y'); dispatchKey('Y'); });
    nBtn.addEventListener('click', ()=> { dispatchKey('n'); dispatchKey('N'); });

    // ========== Zoom controls ==========
    function applyScale(scale){
      currentScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
      if (termCanvas) {
        termCanvas.style.transformOrigin = 'left top';
        termCanvas.style.transform = `scale(${currentScale})`;
        // Ensure canvas still covers viewport after scaling (may leave space) — center if needed
        // If desired, can also adjust canvas width/height attributes but we avoid touching draw buffer.
      }
    }
    zoomIn.addEventListener('click', ()=> applyScale(currentScale + SCALE_STEP));
    zoomOut.addEventListener('click', ()=> applyScale(currentScale - SCALE_STEP));
    resetZoom.addEventListener('click', ()=> applyScale(1));

    applyScale(INITIAL_SCALE);

    // ========== GRID modal handling (attach/detach net canvas safely) ==========
    function findNetCanvas(){
      // try common ids/classes first
      let c = document.getElementById('netCanvas') || document.querySelector('canvas.net-grid');
      if (c) return c;
      // fallback: pick canvas that is not terminalCanvas (first one)
      const canvases = $all('canvas');
      for (const v of canvases) {
        if (v !== termCanvas) return v;
      }
      return null;
    }

    function findDegradationElement(){
      try { if (degradation && degradation.indicator) return degradation.indicator; } catch(e){}
      const candidates = ['#degradationIndicator', '.degradation', '.degradation-indicator', '.deg-ind'];
      for (const s of candidates) {
        const el = document.querySelector(s);
        if (el) return el;
      }
      // quick fuzzy search
      const all = Array.from(document.querySelectorAll('div,span'));
      for (const el of all) {
        try { if (el.innerText && /degra|degen|deg\\b/i.test(el.innerText)) return el; } catch(e){}
      }
      return null;
    }

    function openGrid(){
      // hide degradation
      degradationElement = findDegradationElement();
      if (degradationElement) { degradationElement.dataset._origDisplay = degradationElement.style.display || ''; degradationElement.style.display = 'none'; }

      gridModal.style.display = 'flex';

      const c = findNetCanvas();
      if (!c) return;
      attachedGridCanvas = c;
      originalGridParent = c.parentNode;
      originalGridStyles = {
        cssText: c.style.cssText || '',
        width: c.style.width || '',
        height: c.style.height || '',
        left: c.style.left || '',
        top: c.style.top || '',
        position: c.style.position || '',
        pointerEvents: c.style.pointerEvents || ''
      };

      // append canvas to gridMap and resize buffer by DPR
      try {
        const DPR = window.devicePixelRatio || 1;
        const W = Math.max(16, Math.floor(gridMap.clientWidth));
        const H = Math.max(16, Math.floor(gridMap.clientHeight));
        c.style.position = 'relative';
        c.style.width = '100%';
        c.style.height = '100%';
        c.style.pointerEvents = 'auto';
        c.style.maxWidth = '100%';
        c.style.maxHeight = '100%';
        c.width = Math.floor(W * DPR);
        c.height = Math.floor(H * DPR);
        gridMap.appendChild(c);
        // try to signal netGrid to resize if it gives API
        if (NG && typeof NG.resize === 'function') {
          try { NG.resize(W, H); } catch(e){ console.warn('[mobile.js] NG.resize failed', e); }
        } else if (NG && typeof NG.setSize === 'function') {
          try { NG.setSize(W, H); } catch(e){} 
        }
      } catch(e){ console.warn('[mobile.js] attach grid canvas error', e); }

      // disable terminal canvas pointer events so underlying canvas doesn't intercept gestures
      if (termCanvas) { termCanvas.dataset._origPointer = termCanvas.style.pointerEvents || ''; termCanvas.style.pointerEvents = 'none'; }
    }

    function closeGrid(){
      gridModal.style.display = 'none';
      if (attachedGridCanvas && originalGridParent) {
        try {
          attachedGridCanvas.style.cssText = originalGridStyles.cssText || '';
          attachedGridCanvas.width = attachedGridCanvas.width; // no-op to keep buffer? (keeps it safe)
          originalGridParent.appendChild(attachedGridCanvas);
        } catch(e){ console.warn('[mobile.js] restore grid canvas failed', e); }
      }
      attachedGridCanvas = null;
      originalGridParent = null;
      originalGridStyles = null;

      if (degradationElement) { degradationElement.style.display = degradationElement.dataset._origDisplay || ''; degradationElement = null; }
      if (termCanvas) try { termCanvas.style.pointerEvents = termCanvas.dataset._origPointer || ''; } catch(e){}
    }

    // open/close handlers
    closeGridBtn.addEventListener('click', closeGrid);

    // bind a quick toggle (we add a button to quickRow)
    const netToggleBtn = make('button', { className:'mob-btn', innerText:'NET' });
    netToggleBtn.addEventListener('click', ()=> {
      if (gridModal.style.display === 'flex') closeGrid(); else openGrid();
    });
    quickRow.appendChild(netToggleBtn);

    // touch gestures inside gridMap to move nodes -> dispatch arrow keys
    let touchStart = null;
    gridMap.addEventListener('touchstart', (e)=> { if (!attachedGridCanvas) return; const t=e.touches[0]; touchStart={x:t.clientX,y:t.clientY}; }, { passive:true });
    gridMap.addEventListener('touchmove', (e)=> {
      if (!attachedGridCanvas || !touchStart) return;
      const t=e.touches[0]; const dx=t.clientX-touchStart.x; const dy=t.clientY-touchStart.y;
      const absX=Math.abs(dx), absY=Math.abs(dy);
      if (Math.max(absX,absY) < 28) return;
      const key = absX>absY ? (dx>0 ? 'ArrowRight' : 'ArrowLeft') : (dy>0 ? 'ArrowDown' : 'ArrowUp');
      dispatchKey(key);
      touchStart={x:t.clientX,y:t.clientY};
    }, { passive:true });
    gridMap.addEventListener('touchend', ()=> touchStart=null, { passive:true });

    // ========== MobileLite behavior ==========
    function applyMobileLite(enabled){
      mobileLite = !!enabled;
      if (!degradation) return;
      if (mobileLite) {
        // cap degradation level
        try { if (degradation.level && degradation.level > 60) { degradation.level = 60; if (degradation.updateIndicator) degradation.updateIndicator(); } } catch(e){}
        // mute background music softly
        try { if (audioMgr && audioMgr.setBackgroundMusicVolume) audioMgr.setBackgroundMusicVolume(0); } catch(e){}
      } else {
        try { if (audioMgr && audioMgr.setBackgroundMusicVolume) audioMgr.setBackgroundMusicVolume(0.2); } catch(e){}
      }
    }

    applyMobileLite(DEFAULT_MOBILE_LITE);

    // add mobileLite toggle to quickRow
    const liteBtn = make('button', { className:'mob-btn', innerText: mobileLite ? 'LITE' : 'FULL' });
    liteBtn.addEventListener('click', ()=> { applyMobileLite(!mobileLite); liteBtn.innerText = mobileLite ? 'FULL' : 'LITE'; });
    quickRow.appendChild(liteBtn);

    // ========== Accessibility: quick Y/N hotkeys via long press Enter (optional) ==========
    // Long press send => toggle history tip / helpful actions
    let sendPressTimer = null;
    sendBtn.addEventListener('touchstart', ()=> {
      sendPressTimer = setTimeout(()=> { showHistoryTip(); }, 600);
    }, { passive:true });
    sendBtn.addEventListener('touchend', ()=> { clearTimeout(sendPressTimer); }, { passive:true });

    // ========== Expose API for debug/test ==========
    window.__MobileTerminal = {
      submit: submitCommand,
      openGrid,
      closeGrid,
      applyMobileLite,
      setScale: applyScale => applyScale(currentScale) // placeholder
    };

    // Log ready
    try { if (TC && typeof TC.addColoredText === 'function') TC.addColoredText('> Mobile UI loaded', '#00FF41'); } catch(e){}
    console.log('[mobile.js] Mobile UI loaded');
  });

})();
