/* terminal_mobile_v2.js — Финальная версия для корректной мобильной работы
   Требование: подключать ПОСЛЕ terminal_canvas.js, netGrid_v3.js, module_audio.js
*/
(function(){
  'use strict';

  const MOBILE_BAR = 64;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(navigator.userAgent) || window.FORCE_MOBILE_TERMINAL;

  // Require mobile or forced mode
  if (!isMobile && !window.FORCE_MOBILE_TERMINAL) {
    console.log('[mobileV2] not mobile, abort');
    return;
  }

  // Wait for terminal object at most 3s
  function whenReady(cb){
    const start = Date.now();
    (function poll(){
      if (window.__TerminalCanvas) return cb();
      if (Date.now() - start > 3000) return cb();
      setTimeout(poll, 60);
    })();
  }

  whenReady(() => {
    const TC = window.__TerminalCanvas || null;
    const NG = window.__netGrid || null;
    const audioMgr = window.audioManager || window.AudioManager || null;
    const degradation = TC && TC.degradation ? TC.degradation : null;

    // --- Create input overlay (append after canvas so it's on top) ---
    const overlay = document.createElement('div');
    overlay.className = 'mobile-input-overlay';
    overlay.setAttribute('role','region');
    overlay.setAttribute('aria-label','mobile terminal controls');

    const input = document.createElement('input');
    input.type = 'text';
    input.autocapitalize = 'none';
    input.spellcheck = false;
    input.placeholder = 'Команда (help)';
    overlay.appendChild(input);

    const sendBtn = document.createElement('button'); sendBtn.textContent = '→';
    const netBtn = document.createElement('button'); netBtn.textContent = 'NET';
    const liteBtn = document.createElement('button'); liteBtn.textContent = 'LITE';

    overlay.appendChild(sendBtn);
    overlay.appendChild(netBtn);
    overlay.appendChild(liteBtn);

    document.body.appendChild(overlay);

    // Ensure overlay is after terminalCanvas in DOM so z-index predictable
    const tc = document.getElementById('terminalCanvas');
    if (tc && tc.nextSibling !== overlay) {
      tc.parentNode.insertBefore(overlay, tc.nextSibling);
    }

    // Make tapping overlay focus input (user gesture)
    overlay.addEventListener('touchstart', (e)=> {
      // stop propagation to canvas below
      e.stopPropagation();
      // focus input only if target isn't button
      if (e.target === overlay || e.target === input) {
        setTimeout(()=> input.focus(), 10);
      }
    }, { passive: true });

    // Prevent canvas capturing pointer when input should receive events:
    input.addEventListener('focus', ()=> {
      if (tc) {
        tc.dataset._origPointer = tc.style.pointerEvents || '';
        tc.style.pointerEvents = 'none';
      }
      document.documentElement.style.scrollPaddingBottom = (MOBILE_BAR + 8) + 'px';
    });
    input.addEventListener('blur', ()=> {
      if (tc) try { tc.style.pointerEvents = tc.dataset._origPointer || ''; } catch(e){}
      document.documentElement.style.scrollPaddingBottom = '';
    });

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
    input.addEventListener('keydown', (e)=> { if (e.key === 'Enter') { e.preventDefault(); submitCommand(input.value); } });

    // Mobile lite toggle
    let mobileLite = true;
    liteBtn.addEventListener('click', ()=> {
      mobileLite = !mobileLite;
      liteBtn.textContent = mobileLite ? 'LITE' : 'FULL';
      applyMobileLite(mobileLite);
    });

    function applyMobileLite(enabled){
      if (!degradation) return;
      if (enabled) {
        if (degradation.level && degradation.level > 60) degradation.level = 60;
        try { if (audioMgr && audioMgr.setBackgroundMusicVolume) audioMgr.setBackgroundMusicVolume(0); } catch(e){}
      } else {
        try { if (audioMgr && audioMgr.setBackgroundMusicVolume) audioMgr.setBackgroundMusicVolume(0.2); } catch(e){}
      }
    }
    applyMobileLite(mobileLite);

    // --- GRID modal ---
    const gridModal = document.createElement('div');
    gridModal.className = 'mobile-grid-modal';
    const panel = document.createElement('div'); panel.className = 'mobile-grid-panel';
    gridModal.appendChild(panel);

    const hdr = document.createElement('div'); hdr.style.fontSize='12px'; hdr.textContent = 'NET GRID';
    panel.appendChild(hdr);

    const mapHolder = document.createElement('div');
    mapHolder.style.flex = '1'; mapHolder.style.position = 'relative'; mapHolder.style.overflow = 'hidden';
    panel.appendChild(mapHolder);

    const ctrlRow = document.createElement('div'); ctrlRow.style.display='flex'; ctrlRow.style.gap='6px'; ctrlRow.style.justifyContent='center';
    panel.appendChild(ctrlRow);

    const closeBtn = document.createElement('button'); closeBtn.textContent = 'CLOSE';
    ctrlRow.appendChild(closeBtn);

    document.body.appendChild(gridModal);

    // Helper to find net canvas
    function findNetCanvas(){
      const byId = document.getElementById('netCanvas') || document.querySelector('canvas.net-grid');
      if (byId) return byId;
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const tc = document.getElementById('terminalCanvas');
      for (const c of canvases) if (c !== tc) return c;
      return null;
    }

    let attachedCanvas = null, originalParent = null, originalStyles = null, degradationElement = null;

    // find common degradation element if present
    function findDegradationEl(){
      try { if (degradation && degradation.indicator) return degradation.indicator; } catch(e){}
      const sel = document.querySelector('.degradation, .degradation-indicator, #degradationIndicator');
      if (sel) return sel;
      return null;
    }

    function openGrid(){
      // hide degradation element
      degradationElement = findDegradationEl();
      if (degradationElement) { degradationElement.dataset._origDisplay = degradationElement.style.display || ''; degradationElement.style.display = 'none'; }

      // show modal
      gridModal.style.display = 'flex';

      // find canvas and attach & resize to holder
      const c = findNetCanvas();
      if (c) {
        attachedCanvas = c;
        originalParent = c.parentNode;
        originalStyles = {
          position: c.style.position || '',
          left: c.style.left || '',
          top: c.style.top || '',
          width: c.style.width || '',
          height: c.style.height || '',
          transform: c.style.transform || '',
          pointerEvents: c.style.pointerEvents || '',
          cssText: c.style.cssText || ''
        };

        // move canvas
        try {
          // set canvas size to mapHolder size using DPR
          const DPR = window.devicePixelRatio || 1;
          const W = Math.max(16, Math.floor(mapHolder.clientWidth));
          const H = Math.max(16, Math.floor(mapHolder.clientHeight));
          c.style.position = 'relative';
          c.style.width = '100%';
          c.style.height = '100%';
          c.style.pointerEvents = 'auto';
          c.style.transform = 'translateZ(0)';
          // set drawing buffer size
          c.width = Math.floor(W * DPR);
          c.height = Math.floor(H * DPR);
          c.style.maxWidth = '100%';
          c.style.maxHeight = '100%';
          // append
          mapHolder.appendChild(c);
          // if NG exposes resize method call it
          if (NG && typeof NG.resize === 'function') {
            try { NG.resize(W, H); } catch(e){ console.warn('NG.resize failed', e); }
          }
        } catch(e){ console.warn('[mobileV2] attach canvas failed', e); }
      }

      // ensure terminal canvas does not intercept touches while modal open
      const tc = document.getElementById('terminalCanvas'); if (tc) { tc.dataset._origPointer = tc.style.pointerEvents || ''; tc.style.pointerEvents = 'none'; }

      try { if (audioMgr && audioMgr.playSound) audioMgr.playSound('interface','interface_mode_to_terminal.mp3', { volume: 0.45 }); } catch(e){}
    }

    function closeGrid(){
      gridModal.style.display = 'none';
      // restore canvas
      if (attachedCanvas && originalParent) {
        try {
          attachedCanvas.style.position = originalStyles.position || '';
          attachedCanvas.style.left = originalStyles.left || '';
          attachedCanvas.style.top = originalStyles.top || '';
          attachedCanvas.style.width = originalStyles.width || '';
          attachedCanvas.style.height = originalStyles.height || '';
          attachedCanvas.style.transform = originalStyles.transform || '';
          attachedCanvas.style.pointerEvents = originalStyles.pointerEvents || '';
          originalParent.appendChild(attachedCanvas);
        } catch(e){ console.warn('[mobileV2] restore canvas failed', e); }
        attachedCanvas = null; originalParent = null; originalStyles = null;
      }
      if (degradationElement) { degradationElement.style.display = degradationElement.dataset._origDisplay || ''; degradationElement = null; }
      // restore terminal canvas pointer
      const tc = document.getElementById('terminalCanvas'); if (tc) try { tc.style.pointerEvents = tc.dataset._origPointer || ''; } catch(e){}
      try { if (audioMgr && audioMgr.playSound) audioMgr.playSound('interface','interface_mode_to_grid.mp3', { volume: 0.45 }); } catch(e){}
    }

    netBtn.addEventListener('click', ()=> {
      if (gridModal.style.display === 'flex') closeGrid(); else openGrid();
    });
    closeBtn.addEventListener('click', closeGrid);

    // touch move gestures in holder -> send arrow keys to netGrid
    let touchStart = null;
    mapHolder.addEventListener('touchstart', (e)=> { if (!attachedCanvas) return; const t = e.touches[0]; touchStart = { x: t.clientX, y: t.clientY }; }, { passive: true });
    mapHolder.addEventListener('touchmove', (e)=> {
      if (!attachedCanvas || !touchStart) return;
      const t = e.touches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      const absX = Math.abs(dx), absY = Math.abs(dy);
      if (Math.max(absX, absY) < 28) return;
      const key = absX > absY ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp');
      const ev = new KeyboardEvent('keydown', { key, bubbles: true });
      document.dispatchEvent(ev);
      touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    mapHolder.addEventListener('touchend', ()=> { touchStart = null; }, { passive: true });

    // safety cap for heavy visual effects (non-destructive)
    if (TC && TC.degradation) {
      const capInterval = setInterval(()=> {
        try { if (mobileLite && TC.degradation.level && TC.degradation.level > 80) { TC.degradation.level = 80; if (TC.degradation.updateIndicator) TC.degradation.updateIndicator(); } } catch(e){}
      }, 1200);
      window.addEventListener('beforeunload', ()=> clearInterval(capInterval));
    }

    // expose API
    window.__MobileTerminalV2 = {
      openGrid, closeGrid, submitCommand, applyMobileLite
    };

    if (TC && TC.addColoredText) TC.addColoredText('> Mobile terminal v2 loaded', '#00FF41');
    console.log('[mobileV2] ready');
  });
})();
