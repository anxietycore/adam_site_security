/* terminal_mobile_v2.js — Mobile wrapper (updated)
   Исправления (по запросу пользователя):
   - Решена проблема: нельзя печатать с телефона (canvas перехватывал тачи)
     Решение: input фиксирован поверх canvas, при фокусе временно отключаем pointer-events у терминального canvas
   - Сетка NET больше не занимает весь экран — модальное окно 64% высоты, canvas сетки масштабируется внутри контейнера
   - Окно деградации корректно скрывается (универсальный поиск индикатора) и восстанавливается без налезания
   - Доп. улучшения: быстрый фокус по тапу, явное управление pointer-events, мобильный LITE режим, оптимизации

   Подключение: подключать этот файл как отдельный <script> после terminal_canvas.js, netGrid_v3.js, module_audio.js
*/
(function(){
  'use strict';

  const UID = 'terminalMobileV2';
  const MOBILE_BAR = 64; // px
  const BTN_SIZE = 54;
  const MOBILE_LITE_DEFAULT = true;

  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(navigator.userAgent) || window.FORCE_MOBILE_TERMINAL;
  if (!isMobile && !window.FORCE_MOBILE_TERMINAL) {
    console.log('[mobileV2] Пропускаем — не мобильное устройство');
    return;
  }

  function whenReady(cb){
    const start = Date.now();
    const timeout = 3000;
    (function poll(){
      // не требуем audioManager или netGrid сразу, но желательно
      if (window.__TerminalCanvas) return cb();
      if (Date.now() - start > timeout) return cb();
      setTimeout(poll, 60);
    })();
  }

  whenReady(() => {
    const TC = window.__TerminalCanvas || null;
    const NG = window.__netGrid || null;
    const audioMgr = window.audioManager || window.AudioManager || null;
    const degradation = TC && TC.degradation ? TC.degradation : null;

    // контейнер панели ввода — фиксирован внизу, всегда поверх canvas
    const container = document.createElement('div');
    container.id = UID;
    Object.assign(container.style, {
      position: 'fixed', left: '8px', right: '8px', bottom: 'env(safe-area-inset-bottom, 8px)', height: MOBILE_BAR + 'px',
      zIndex: 999999999, display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 10px', boxSizing: 'border-box',
      background: 'linear-gradient(0deg, rgba(0,0,0,0.6), rgba(0,0,0,0.12))', borderRadius: '12px',
      WebkitTapHighlightColor: 'transparent', backdropFilter: 'blur(4px)'
    });
    document.body.appendChild(container);

    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Команда (help)';
    input.autocapitalize = 'none';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'terminal command input');
    Object.assign(input.style, {
      flex: '1', height: (MOBILE_BAR - 16) + 'px', borderRadius: '10px', padding: '10px 12px',
      fontSize: '15px', fontFamily: "monospace", background: 'rgba(0,0,0,0.6)', color: '#00FF41',
      border: '1px solid rgba(255,255,255,0.04)', outline: 'none', zIndex: 2147483001,
      position: 'relative'
    });
    container.appendChild(input);

    function makeBtn(label){
      const b = document.createElement('button'); b.type = 'button'; b.innerText = label;
      Object.assign(b.style, { minWidth: BTN_SIZE + 'px', height: (MOBILE_BAR - 12) + 'px', borderRadius: '10px', fontFamily: "monospace", fontSize: '14px', background: 'rgba(0,0,0,0.6)', color: '#00FF41', border: '1px solid rgba(255,255,255,0.04)', zIndex: 2147483001 });
      return b;
    }

    const sendBtn = makeBtn('→');
    const gridBtn = makeBtn('NET');
    const liteBtn = makeBtn(MOBILE_LITE_DEFAULT ? 'LITE ON' : 'LITE OFF');
    container.appendChild(sendBtn);
    container.appendChild(gridBtn);
    container.appendChild(liteBtn);

    // ensure input is focusable by tap and visible above keyboard
    input.addEventListener('focus', ()=>{
      document.documentElement.style.scrollPaddingBottom = (MOBILE_BAR + 12) + 'px';
      document.body.style.paddingBottom = `env(safe-area-inset-bottom, ${MOBILE_BAR}px)`;
      // temporarily disable pointer events on terminal canvas so taps go directly to input (fix for some phones)
      const tc = document.getElementById('terminalCanvas');
      if (tc) {
        tc.dataset._origPointer = tc.style.pointerEvents || '';
        tc.style.pointerEvents = 'none';
      }
      // try to restore after some time too
      setTimeout(()=>{ try{ if (tc) tc.style.pointerEvents = tc.dataset._origPointer || ''; }catch(e){} }, 2500);
    });
    input.addEventListener('blur', ()=>{
      document.documentElement.style.scrollPaddingBottom = '';
      document.body.style.paddingBottom = '';
      const tc = document.getElementById('terminalCanvas'); if (tc) try{ tc.style.pointerEvents = tc.dataset._origPointer || ''; }catch(e){}
    });

    // Submit command helper
    function submitCommand(text){
      const cmd = String(text || '').trim();
      if (!cmd) return;
      try { if (audioMgr && audioMgr.playSound) audioMgr.playSound('interface','interface_key_press_01.mp3', { volume: 0.5 }); } catch(e){}
      if (TC && TC.processCommand) {
        try { TC.processCommand(cmd); } catch(e){ console.warn('[mobileV2] processCommand failed', e); }
      } else {
        try { window.currentLine = cmd; } catch(e){}
        const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        document.dispatchEvent(ev);
      }
      input.value = '';
      input.blur();
    }

    sendBtn.addEventListener('click', ()=> submitCommand(input.value));
    input.addEventListener('keydown', (e)=>{ if (e.key === 'Enter'){ e.preventDefault(); submitCommand(input.value); } });

    // Mobile LITE
    let mobileLite = MOBILE_LITE_DEFAULT; let mobileLiteTimer = null;
    function applyMobileLite(enabled){
      mobileLite = !!enabled;
      if (!degradation) return;
      if (mobileLite) {
        if (mobileLiteTimer) clearInterval(mobileLiteTimer);
        mobileLiteTimer = setInterval(()=>{
          try { if (degradation.level && degradation.level > 60) { degradation.level = 60; if (degradation.updateIndicator) degradation.updateIndicator(); } } catch(e){}
          try { if (audioMgr && audioMgr.setBackgroundMusicVolume) audioMgr.setBackgroundMusicVolume(0); } catch(e){}
        }, 900);
      } else {
        if (mobileLiteTimer) { clearInterval(mobileLiteTimer); mobileLiteTimer = null; }
        try { if (audioMgr && audioMgr.setBackgroundMusicVolume) audioMgr.setBackgroundMusicVolume(0.2); } catch(e){}
      }
    }
    applyMobileLite(mobileLite);
    liteBtn.addEventListener('click', ()=>{ mobileLite = !mobileLite; liteBtn.innerText = mobileLite ? 'LITE ON' : 'LITE OFF'; applyMobileLite(mobileLite); });

    // Grid modal — теперь 64% высоты, центрированный, с overflow hidden
    const gridModal = document.createElement('div');
    Object.assign(gridModal.style, { position: 'fixed', left: '0', right: '0', top: '0', bottom: '0', zIndex: 999999998, display: 'none', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' });
    document.body.appendChild(gridModal);

    const panel = document.createElement('div');
    Object.assign(panel.style, { width: '94%', maxWidth: '420px', height: '64%', borderRadius: '12px', padding: '8px', boxSizing: 'border-box', background: '#030807', color: '#00FF41', display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: "monospace", overflow: 'hidden' });
    gridModal.appendChild(panel);

    const header = document.createElement('div'); header.innerText = 'NET GRID — управление'; header.style.fontSize = '12px'; panel.appendChild(header);

    const mapHolder = document.createElement('div');
    Object.assign(mapHolder.style, { flex: '1', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' });
    panel.appendChild(mapHolder);

    const controls = document.createElement('div'); Object.assign(controls.style, { display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' });
    panel.appendChild(controls);

    const up = makeBtn('↑'); const down = makeBtn('↓'); const left = makeBtn('←'); const right = makeBtn('→'); const sel = makeBtn('TAB'); const lock = makeBtn('␣'); const esc = makeBtn('ESC');
    [up, down, left, right, sel, lock, esc].forEach(b=>controls.appendChild(b));

    // Поиск canvas сетки: сначала по id/class, затем по heuristics
    function findNetCanvas(){
      const byId = document.getElementById('netCanvas') || document.querySelector('canvas.net-grid');
      if (byId) return byId;
      // иначе вернуть canvas отличающийся от терминала
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const tc = document.getElementById('terminalCanvas');
      for (const c of canvases){ if (c !== tc) return c; }
      return null;
    }

    let attachedCanvas = null; let originalParent = null; let originalStyles = null; let degradationElement = null;

    // находим индикатор деградации (универсально)
    function findDegradationElement(){
      try{
        if (degradation && degradation.indicator) return degradation.indicator;
      }catch(e){}
      const candidates = ['#degradationIndicator', '.degradation', '.degrade-indicator', '.degradation-indicator', '.deg-ind'];
      for (const sel of candidates){ const el = document.querySelector(sel); if (el) return el; }
      // последний шанс - найти элемент с текстом "degrad" (нечёткий поиск)
      const all = Array.from(document.body.querySelectorAll('div,span'));
      for (const el of all){ try{ if (el.innerText && /degra|degrad|degen|deg/i.test(el.innerText)) return el; }catch(e){} }
      return null;
    }

    function openGrid(){
      // найдём/скроем индикатор деградации
      degradationElement = findDegradationElement();
      if (degradationElement){ degradationElement.dataset._origDisplay = degradationElement.style.display || ''; degradationElement.style.display = 'none'; }

      if (NG && NG.setGridMode) NG.setGridMode(true);
      gridModal.style.display = 'flex';

      const c = findNetCanvas();
      if (c){
        attachedCanvas = c; originalParent = c.parentNode; originalStyles = { position: c.style.position || '', width: c.style.width || '', height: c.style.height || '', left: c.style.left || '', top: c.style.top || '', right: c.style.right || '', bottom: c.style.bottom || '', pointerEvents: c.style.pointerEvents || '', transform: c.style.transform || '', maxWidth: c.style.maxWidth || '', maxHeight: c.style.maxHeight || '' };
        // обезопасим: перенастроим под наш контейнер
        try{
          c.style.position = 'relative'; c.style.pointerEvents = 'auto'; c.style.maxWidth = '100%'; c.style.maxHeight = '100%'; c.style.width = '100%'; c.style.height = '100%'; c.style.transform = 'translateZ(0)';
          mapHolder.appendChild(c);
        }catch(e){ console.warn('[mobileV2] attach canvas failed', e); }
      }

      // отключаем pointer events у терминального canvas чтобы не мешал взаимодействию
      const tc = document.getElementById('terminalCanvas'); if (tc){ tc.dataset._origPointer = tc.style.pointerEvents || ''; tc.style.pointerEvents = 'none'; }

      try{ if (audioMgr && audioMgr.playSound) audioMgr.playSound('interface','interface_mode_to_terminal.mp3', { volume: 0.45 }); }catch(e){}
    }

    function closeGrid(){
      gridModal.style.display = 'none';
      if (NG && NG.setGridMode) NG.setGridMode(false);
      if (attachedCanvas && originalParent){
        try{ Object.assign(attachedCanvas.style, originalStyles || {}); originalParent.appendChild(attachedCanvas); }catch(e){ console.warn('[mobileV2] restore canvas failed', e); }
        attachedCanvas = null; originalParent = null; originalStyles = null;
      }
      if (degradationElement) { degradationElement.style.display = degradationElement.dataset._origDisplay || ''; degradationElement = null; }
      const tc = document.getElementById('terminalCanvas'); if (tc) try{ tc.style.pointerEvents = tc.dataset._origPointer || ''; }catch(e){}
      try{ if (audioMgr && audioMgr.playSound) audioMgr.playSound('interface','interface_mode_to_grid.mp3', { volume: 0.45 }); }catch(e){}
    }

    gridBtn.addEventListener('click', ()=>{ if (gridModal.style.display === 'flex') closeGrid(); else openGrid(); });
    esc.addEventListener('click', ()=> closeGrid());

    function dispatchKey(key){ const ev = new KeyboardEvent('keydown', { key, bubbles: true }); document.dispatchEvent(ev); }
    sel.addEventListener('click', ()=> dispatchKey('Tab')); lock.addEventListener('click', ()=> dispatchKey(' ')); up.addEventListener('click', ()=> dispatchKey('ArrowUp')); down.addEventListener('click', ()=> dispatchKey('ArrowDown')); left.addEventListener('click', ()=> dispatchKey('ArrowLeft')); right.addEventListener('click', ()=> dispatchKey('ArrowRight'));

    // touch gestures для mapHolder
    let touchStart = null;
    mapHolder.addEventListener('touchstart', (e)=>{ if (!attachedCanvas) return; const t = e.touches[0]; touchStart = { x: t.clientX, y: t.clientY }; }, { passive: true });
    mapHolder.addEventListener('touchmove', (e)=>{
      if (!attachedCanvas || !touchStart) return; const t = e.touches[0]; const dx = t.clientX - touchStart.x; const dy = t.clientY - touchStart.y; const absX = Math.abs(dx); const absY = Math.abs(dy); if (Math.max(absX, absY) < 28) return; if (absX > absY) { dx > 0 ? dispatchKey('ArrowRight') : dispatchKey('ArrowLeft'); } else { dy > 0 ? dispatchKey('ArrowDown') : dispatchKey('ArrowUp'); } touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    mapHolder.addEventListener('touchend', ()=>{ touchStart = null; }, { passive: true });

    // фокус input при тапе по нижней зоне терминала (быстрый переход к печати)
    const terminalCanvas = document.getElementById('terminalCanvas');
    if (terminalCanvas){
      terminalCanvas.addEventListener('touchstart', (e)=>{
        const y = e.touches && e.touches[0] ? e.touches[0].clientY : 0;
        // если тап близко к низу экрана — фокусируем input
        if (window.innerHeight - y < (MOBILE_BAR * 2.3)) { setTimeout(()=> input.focus(), 50); }
      }, { passive: true });
    }

    // Safety cap для фоновых эффектов
    if (TC && TC.degradation){
      const capInterval = setInterval(()=>{ try{ if (mobileLite && TC.degradation.level > 75) { TC.degradation.level = 75; if (TC.degradation.updateIndicator) TC.degradation.updateIndicator(); } }catch(e){} }, 1200);
      window.addEventListener('beforeunload', ()=> clearInterval(capInterval));
    }

    // expose API for debugging
    window.__MobileTerminalV2 = { openGrid, closeGrid, submitCommand, applyMobileLite };
    if (TC && TC.addColoredText) TC.addColoredText('> Mobile terminal v2 (fixed) loaded', '#00FF41');
    console.log('[mobileV2] upgraded — input focus fixes, grid modal limited, degradation hiding');
  });
})();
