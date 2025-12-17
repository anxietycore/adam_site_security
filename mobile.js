/* terminal_mobile_v2.js — Улучшенная мобильная обёртка для terminal_canvas.js
   - Отдельный файл, НЕ меняет terminal_canvas.js, netGrid_v3.js или module_audio.js
   - Исправляет: печать с телефона, сетка не на весь экран, окно деградации не налезает, оптимизация для мобильных
   - Требование: подключите этот файл после terminal_canvas.js, netGrid_v3.js, module_audio.js

   Ключевые идеи:
   - Всю логику ввода отдать локальному input и вызывать window.__TerminalCanvas.processCommand(cmd) если доступен.
   - При открытии сетки: перемещаем canvas netGrid внутрь модального окна и скрываем индикатор деградации терминала, затем восстанавливаем.
   - mobileLite: кап деградации + приглушение фоновой музыки через audioManager API (если доступно).
   - Сенсорные элементы: кнопки управления сеткой, свайпы для перемещения узла (простой implementation).

   Не трогать: terminal_canvas.js, netGrid_v3.js, module_audio.js
*/
(function(){
  'use strict';

  const UID = 'terminalMobileV2';
  const MOBILE_BAR = 64; // px
  const BTN_SIZE = 54;
  const MOBILE_LITE_DEFAULT = true;
  const MIN_MOBILE_WIDTH = 320;

  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(navigator.userAgent) || window.FORCE_MOBILE_TERMINAL;
  if (!isMobile && !window.FORCE_MOBILE_TERMINAL) {
    console.log('[mobileV2] Пропускаем — не мобильное устройство');
    return;
  }

  // wait until core objects exist (but don't block forever)
  function whenReady(cb) {
    const start = Date.now();
    const timeout = 3000;
    (function poll(){
      if (window.__TerminalCanvas && window.__netGrid && (window.audioManager || window.AudioManager)) return cb();
      if (Date.now() - start > timeout) return cb();
      setTimeout(poll, 80);
    })();
  }

  whenReady(() => {
    const TC = window.__TerminalCanvas || null;             // terminal api
    const NG = window.__netGrid || null;                    // net grid api
    const audioMgr = window.audioManager || window.AudioManager || null; // audio manager instance/class
    const degradation = TC && TC.degradation ? TC.degradation : null;

    // Main container (kept simple, high z-index)
    const container = document.createElement('div');
    container.id = UID;
    Object.assign(container.style, {
      position: 'fixed', left: '0', right: '0', bottom: '0', height: MOBILE_BAR + 'px',
      zIndex: 2147483000, display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 10px', boxSizing: 'border-box',
      background: 'linear-gradient(0deg, rgba(0,0,0,0.6), rgba(0,0,0,0.15))',
      WebkitTapHighlightColor: 'transparent'
    });
    document.body.appendChild(container);

    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Команда (help)';
    input.autocapitalize = 'none';
    input.spellcheck = false;
    Object.assign(input.style, {
      flex: '1', height: (MOBILE_BAR - 16) + 'px', borderRadius: '10px', padding: '10px 12px',
      fontSize: '15px', fontFamily: "'Press Start 2P', monospace", background: 'rgba(0,0,0,0.65)', color: '#00FF41',
      border: '1px solid rgba(255,255,255,0.04)', outline: 'none', zIndex: 2147483001
    });
    container.appendChild(input);

    // Buttons: send, net, lite
    function makeBtn(label){
      const b = document.createElement('button'); b.type = 'button'; b.innerText = label;
      Object.assign(b.style, { width: BTN_SIZE + 'px', height: BTN_SIZE + 'px', borderRadius: '10px', fontFamily: "'Press Start 2P', monospace", fontSize: '16px', background: 'rgba(0,0,0,0.6)', color: '#00FF41', border: '1px solid rgba(255,255,255,0.04)', zIndex: 2147483001 });
      return b;
    }

    const sendBtn = makeBtn('→');
    const gridBtn = makeBtn('NET');
    const liteBtn = makeBtn(MOBILE_LITE_DEFAULT ? 'LITE ON' : 'LITE OFF');

    container.appendChild(sendBtn);
    container.appendChild(gridBtn);
    container.appendChild(liteBtn);

    // Accessibility: touch area larger
    [sendBtn, gridBtn, liteBtn].forEach(b => { b.style.padding = '6px'; b.style.touchAction = 'manipulation'; });

    // Ensure input above terminal canvas and focusable
    input.addEventListener('focus', () => {
      // add bottom padding so terminal content isn't covered by keyboard
      document.documentElement.style.scrollPaddingBottom = (MOBILE_BAR + 6) + 'px';
      // Apple safe area
      document.body.style.paddingBottom = `env(safe-area-inset-bottom, ${MOBILE_BAR}px)`;
      // scroll a little to expose canvas
      try { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); } catch(e){}
    });
    input.addEventListener('blur', () => {
      document.documentElement.style.scrollPaddingBottom = '';
      document.body.style.paddingBottom = '';
    });

    // Submit command helper
    function submitCommand(text){
      const cmd = String(text || '').trim();
      if (!cmd) return;
      // play key sound if available
      try { if (audioMgr && audioMgr.playSound) audioMgr.playSound('interface','interface_key_press_01.mp3', { volume: 0.5 }); } catch(e){}

      if (TC && TC.processCommand) {
        try {
          TC.processCommand(cmd);
        } catch(e){
          console.warn('[mobileV2] processCommand failed', e);
        }
      } else {
        // fallback: set global currentLine and dispatch Enter
        try { window.currentLine = cmd; } catch(e){}
        const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        document.dispatchEvent(ev);
      }
      input.value = '';
      input.blur();
    }

    sendBtn.addEventListener('click', () => submitCommand(input.value));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitCommand(input.value); } });

    // MOBILE LITE behavior: cap degradation + mute heavy ambient
    let mobileLite = MOBILE_LITE_DEFAULT;
    let mobileLiteTimer = null;
    function applyMobileLite(enabled){
      mobileLite = !!enabled;
      if (!degradation) return;
      if (mobileLite) {
        // cap level periodically and mute background music
        if (mobileLiteTimer) clearInterval(mobileLiteTimer);
        mobileLiteTimer = setInterval(()=>{
          try {
            if (degradation.level > 60) { degradation.level = 60; if (degradation.updateIndicator) degradation.updateIndicator(); }
          } catch(e){}
          try { if (audioMgr && audioMgr.setBackgroundMusicVolume) audioMgr.setBackgroundMusicVolume(0); } catch(e){}
        }, 900);
      } else {
        if (mobileLiteTimer) { clearInterval(mobileLiteTimer); mobileLiteTimer = null; }
        try { if (audioMgr && audioMgr.setBackgroundMusicVolume) audioMgr.setBackgroundMusicVolume(0.2); } catch(e){}
      }
    }
    applyMobileLite(mobileLite);

    liteBtn.addEventListener('click', ()=>{ mobileLite = !mobileLite; liteBtn.innerText = mobileLite ? 'LITE ON' : 'LITE OFF'; applyMobileLite(mobileLite); });

    // Grid modal (smaller than full-screen so terminal remains visible)
    const gridModal = document.createElement('div');
    Object.assign(gridModal.style, { position: 'fixed', left: '0', right: '0', top: '0', bottom: '0', zIndex: 2147482999, display: 'none', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' });
    document.body.appendChild(gridModal);

    const panel = document.createElement('div');
    Object.assign(panel.style, { width: '94%', maxWidth: '420px', height: '72%', borderRadius: '12px', padding: '10px', boxSizing: 'border-box', background: 'rgba(0,8,6,0.98)', color: '#00FF41', display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: "'Press Start 2P', monospace" });
    gridModal.appendChild(panel);

    const header = document.createElement('div'); header.innerText = 'NET GRID — управление'; header.style.fontSize = '12px'; panel.appendChild(header);

    // area where we'll attach net grid canvas
    const mapHolder = document.createElement('div');
    Object.assign(mapHolder.style, { flex: '1', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' });
    panel.appendChild(mapHolder);

    const controls = document.createElement('div'); Object.assign(controls.style, { display: 'flex', gap: '6px', justifyContent: 'center' });
    panel.appendChild(controls);

    const up = makeBtn('↑'); const down = makeBtn('↓'); const left = makeBtn('←'); const right = makeBtn('→'); const sel = makeBtn('TAB'); const lock = makeBtn('␣'); const esc = makeBtn('ESC');
    controls.appendChild(up); controls.appendChild(down); controls.appendChild(left); controls.appendChild(right); controls.appendChild(sel); controls.appendChild(lock); controls.appendChild(esc);

    // helper to find net grid canvas (not terminal canvas)
    function findNetCanvas(){
      const canvases = Array.from(document.querySelectorAll('canvas'));
      return canvases.find(c => c.id !== 'terminalCanvas' && c.style && c.style.pointerEvents !== 'none' );
    }

    let originalParent = null, attachedCanvas = null, originalStyles = null;

    function openGrid(){
      if (!NG) { if (TC && TC.addColoredText) TC.addColoredText('ОШИБКА: NET GRID не загружен', '#FF4444'); return; }
      // hide terminal degradation indicator to avoid overlap
      if (degradation && degradation.indicator) degradation.indicator.style.opacity = '0';

      NG.setGridMode(true);
      gridModal.style.display = 'flex';

      // attach canvas
      const c = findNetCanvas();
      if (c && c !== attachedCanvas) {
        attachedCanvas = c;
        originalParent = c.parentNode;
        // save styles we will change
        originalStyles = { position: c.style.position || '', right: c.style.right || '', bottom: c.style.bottom || '', width: c.style.width || '', height: c.style.height || '', pointerEvents: c.style.pointerEvents || '' };
        c.style.position = 'relative'; c.style.width = '100%'; c.style.height = '100%'; c.style.pointerEvents = 'auto'; c.style.right = 'auto'; c.style.bottom = 'auto'; c.style.maxWidth = '100%'; c.style.maxHeight = '100%';
        mapHolder.appendChild(c);
      }

      // play small sound if available
      try { if (audioMgr && audioMgr.playSound) audioMgr.playSound('interface','interface_mode_to_terminal.mp3', { volume: 0.45 }); } catch(e){}
    }

    function closeGrid(){
      gridModal.style.display = 'none';
      NG.setGridMode(false);
      if (attachedCanvas && originalParent) {
        // restore styles
        Object.assign(attachedCanvas.style, originalStyles || {});
        originalParent.appendChild(attachedCanvas);
        attachedCanvas = null; originalParent = null; originalStyles = null;
      }
      // restore degradation indicator
      if (degradation && degradation.indicator) degradation.indicator.style.opacity = '1';
      try { if (audioMgr && audioMgr.playSound) audioMgr.playSound('interface','interface_mode_to_grid.mp3', { volume: 0.45 }); } catch(e){}
    }

    gridBtn.addEventListener('click', () => { if (gridModal.style.display === 'flex') closeGrid(); else openGrid(); });

    esc.addEventListener('click', () => closeGrid());
    sel.addEventListener('click', ()=> dispatchKey('Tab'));
    lock.addEventListener('click', ()=> dispatchKey(' '));
    up.addEventListener('click', ()=> dispatchKey('ArrowUp'));
    down.addEventListener('click', ()=> dispatchKey('ArrowDown'));
    left.addEventListener('click', ()=> dispatchKey('ArrowLeft'));
    right.addEventListener('click', ()=> dispatchKey('ArrowRight'));

    function dispatchKey(key){ const ev = new KeyboardEvent('keydown', { key, bubbles: true }); document.dispatchEvent(ev); }

    // simple swipe to move nodes: when attachedCanvas exists, listen to touchmove
    let touchStart = null;
    function onTouchStart(e){ if (!attachedCanvas) return; const t = e.touches[0]; touchStart = { x: t.clientX, y: t.clientY }; }
    function onTouchMove(e){ if (!attachedCanvas || !touchStart) return; const t = e.touches[0]; const dx = t.clientX - touchStart.x; const dy = t.clientY - touchStart.y; const absX = Math.abs(dx); const absY = Math.abs(dy); if (Math.max(absX, absY) < 24) return; // threshold
      if (absX > absY) { if (dx > 0) dispatchKey('ArrowRight'); else dispatchKey('ArrowLeft'); }
      else { if (dy > 0) dispatchKey('ArrowDown'); else dispatchKey('ArrowUp'); }
      touchStart = { x: t.clientX, y: t.clientY };
    }
    function onTouchEnd(e){ touchStart = null; }

    mapHolder.addEventListener('touchstart', onTouchStart, { passive: true });
    mapHolder.addEventListener('touchmove', onTouchMove, { passive: true });
    mapHolder.addEventListener('touchend', onTouchEnd, { passive: true });

    // Fix: some phones block input because canvas captures touch — ensure input is on top and clickable
    container.addEventListener('touchstart', (e)=>{ /* allow focusing input by tap */ }, { passive: true });

    // small exporter for debug
    window.__MobileTerminalV2 = { openGrid, closeGrid, submitCommand, applyMobileLite };

    // hide native on-screen typing issues: make sure terminal listens to commands when we call processCommand
    if (TC && TC.addColoredText) TC.addColoredText('> Mobile terminal v2 loaded', '#00FF41');
    console.log('[mobileV2] loaded — mobileLite=', mobileLite);

    // Optional: ensure input focus when tapping terminal canvas area near bottom
    const terminalCanvas = document.getElementById('terminalCanvas');
    if (terminalCanvas) {
      terminalCanvas.addEventListener('touchstart', (e)=>{
        // if touch near bottom area, focus input for quick typing
        const y = e.touches && e.touches[0] ? e.touches[0].clientY : 0;
        if (window.innerHeight - y < (MOBILE_BAR * 3)) {
          setTimeout(()=> input.focus(), 50);
        }
      }, { passive: true });
    }

    // Safety: prevent heavy canvas effects by setting global flags if available
    try {
      if (TC && TC.degradation) {
        // if there are heavy intervals, capping will reduce load
        const capInterval = setInterval(()=>{
          try { if (TC.degradation.level > 75 && mobileLite) { TC.degradation.level = 75; if (TC.degradation.updateIndicator) TC.degradation.updateIndicator(); } } catch(e){}
        }, 1100);
        // allow clearing on page unload
        window.addEventListener('beforeunload', ()=> clearInterval(capInterval));
      }
    } catch(e){ /* ignore */ }

  });
})();
