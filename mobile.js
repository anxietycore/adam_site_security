/* mobile.js — improved:
   - Grid button sends 'net_mode'
   - hides netGrid canvas until setGridMode(true)
   - auto-scales terminal canvas to fit mobile width and enables scrolling
   - hides duplicate "ДЕГРАДАЦИЯ" banner if terminal already provides it
   - uses TC.processCommand when available
*/
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const API_WAIT_MS = 3000;

  function playSound(name){
    try {
      const am = window.audioManager || window.AudioManager || null;
      if (!am) return;
      if (typeof am.playSystemSound === 'function') { am.playSystemSound(name); return; }
      if (typeof am.play === 'function') { am.play(name); return; }
      if (typeof am.playSound === 'function') { am.playSound(name); return; }
      if (typeof am.trigger === 'function') { am.trigger(name); return; }
    } catch(e){ /* ignore */ }
  }

  function whenReady(cb){
    const start = Date.now();
    (function poll(){
      if (window.__TerminalCanvas && typeof window.__TerminalCanvas.processCommand === 'function') return cb(window.__TerminalCanvas);
      if (Date.now() - start > API_WAIT_MS) return cb(window.__TerminalCanvas || null);
      setTimeout(poll, 80);
    })();
  }

  whenReady(init);

  function init(TC){
    const sidePanel = document.getElementById('sidePanel');
    const panelHandle = document.getElementById('panelHandle');
    const subMenu = document.getElementById('subMenu');
    const subMenuItems = document.getElementById('subMenuItems');
    const subMenuClose = document.getElementById('subMenuClose');
    const gridModal = document.getElementById('gridModal');
    const gridClose = document.getElementById('gridClose');
    const mapContainer = document.getElementById('mapContainer');
    const mapPlaceholder = document.getElementById('mapPlaceholder');
    const openGridPanelBtn = document.getElementById('openGridPanel');
    const confirmBox = document.getElementById('confirmBox');
    const confirmText = document.getElementById('confirmText');
    const confirmY = document.getElementById('confirmY');
    const confirmN = document.getElementById('confirmN');
    const confirmClose = document.getElementById('confirmClose');
    const degradationDisplay = document.getElementById('degradationDisplay');

    // default dscr list (can be overridden from TC if API available)
    let DSCR_ITEMS = ['0x001','0x095','0x413','0x811','0x9A0','0xF00'];

    // If terminal exposes dossiers, use them
    try {
      if (TC && typeof TC.listDossiers === 'function') {
        const got = TC.listDossiers();
        if (Array.isArray(got) && got.length) DSCR_ITEMS = got.map(x => String(x));
      } else if (TC && Array.isArray(TC.dossiers)) {
        DSCR_ITEMS = TC.dossiers.map(x => String(x.id || x));
      }
    } catch(e){ console.warn('[mobile] cannot read dossiers', e); }

    // Robust sendCommand: prefer API
    function sendCommand(cmd){
      if (!cmd) return;
      playSound('click');
      const text = String(cmd).trim();
      if (TC && typeof TC.processCommand === 'function') {
        try { TC.processCommand(text); return; } catch(e){ console.warn('[mobile] processCommand failed', e); }
      }
      // fallback simulate typing + Enter
      for (let ch of text) document.dispatchEvent(new KeyboardEvent('keydown', {key: ch, bubbles:true}));
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles:true}));
    }

    function dispatchKey(key, opts){ document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({key:key,bubbles:true,cancelable:true}, opts||{}))); }

    // panel toggle
    panelHandle && panelHandle.addEventListener('click', () => { sidePanel.classList.toggle('collapsed'); playSound('toggle'); });

    // bind side buttons; note: grid button should call 'net_mode'
    sidePanel.querySelectorAll('.cmd').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd');
        const hasSub = btn.getAttribute('data-has-sub') === 'true';
        playSound('click');
        if (hasSub) { openDscrSubmenu(); return; }
        if (!cmd) return;

        if (cmd === 'subj') { sendCommand('subj'); return; }   // exactly 'subj'
        if (cmd === 'netmode' || cmd === 'grid' || cmd.toLowerCase() === 'grid') {
          // legacy mapping -> correct command: 'net_mode'
          openGridModal();
          trySetNetGrid(true);
          sendCommand('net_mode'); // <-- CORRECT COMMAND
          return;
        }
        if (cmd === 'reset') { sendCommand('reset'); showConfirm('Подтвердить reset? (Y/N)'); return; }
        sendCommand(cmd);
      });
    });

    // dscr submenu
    function openDscrSubmenu(){
      playSound('open');
      subMenuItems.innerHTML = '';
      subMenu.querySelector('#subMenuTitle') && (subMenu.querySelector('#subMenuTitle').textContent = 'Выберите dscr');
      DSCR_ITEMS.forEach(id => {
        const el = document.createElement('div'); el.className = 'item'; el.textContent = id;
        el.addEventListener('click', () => { sendCommand(`dscr ${id}`); closeSubmenu(); });
        subMenuItems.appendChild(el);
      });
      subMenu.classList.remove('hidden'); subMenu.setAttribute('aria-hidden','false');
    }
    function closeSubmenu(){ playSound('close'); subMenu.classList.add('hidden'); subMenu.setAttribute('aria-hidden','true'); }
    subMenuClose && subMenuClose.addEventListener('click', closeSubmenu);

    // confirm modal
    function showConfirm(text){ confirmText.textContent = text || 'Подтвердить?'; confirmBox.classList.remove('hidden'); confirmBox.setAttribute('aria-hidden','false'); playSound('prompt'); }
    function hideConfirm(){ confirmBox.classList.add('hidden'); confirmBox.setAttribute('aria-hidden','true'); playSound('close'); }
    confirmY && confirmY.addEventListener('click', () => { if (TC && typeof TC.processCommand === 'function') try{ TC.processCommand('y'); }catch(e){} dispatchKey('y'); hideConfirm(); });
    confirmN && confirmN.addEventListener('click', () => { if (TC && typeof TC.processCommand === 'function') try{ TC.processCommand('n'); }catch(e){} dispatchKey('n'); hideConfirm(); });
    confirmClose && confirmClose.addEventListener('click', hideConfirm);

    // grid modal
    function openGridModal(){
      playSound('open');
      gridModal.classList.remove('hidden'); gridModal.setAttribute('aria-hidden','false');
      trySetNetGrid(true);
      setTimeout(attachMapCanvas, 160);
    }
    function closeGridModal(){
      playSound('close');
      trySetNetGrid(false);
      dispatchKey('Escape');
      // return canvas if we moved it
      const moved = mapContainer.querySelector('canvas');
      if (moved && moved._movedByMobile){
        try { (moved._origParent || document.body).appendChild(moved); } catch(e){}
        moved.style.position=''; moved.style.width=''; moved.style.height=''; moved.style.pointerEvents='none';
        moved._movedByMobile = false;
      }
      gridModal.classList.add('hidden'); gridModal.setAttribute('aria-hidden','true');
    }
    gridClose && gridClose.addEventListener('click', closeGridModal);
    openGridPanelBtn && openGridPanelBtn.addEventListener('click', openGridModal);

    function trySetNetGrid(flag){
      try { if (window.__netGrid && typeof window.__netGrid.setGridMode === 'function') window.__netGrid.setGridMode(!!flag); }
      catch(e){ console.warn('[mobile] __netGrid.setGridMode threw', e); }
    }

    // attach map canvas (only when grid modal opened)
    function attachMapCanvas(){
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const candidate = canvases.find(cv => {
        if (!cv) return false;
        const id = (cv.id||'').toLowerCase();
        if (id.includes('terminal') || id.includes('shader') || id.includes('overlay')) return false;
        return true;
      });
      if (!candidate){ mapPlaceholder.style.display = 'flex'; return; }
      try {
        mapPlaceholder.style.display = 'none';
        candidate._origParent = candidate.parentElement;
        mapContainer.appendChild(candidate);
        candidate.style.position = 'relative';
        candidate.style.width = '100%';
        candidate.style.height = '100%';
        candidate.style.pointerEvents = 'auto';
        candidate._movedByMobile = true;
      } catch(e){ console.warn('[mobile] attachMapCanvas', e); mapPlaceholder.style.display = 'flex'; }
    }

    // grid control bindings
    gridModal.querySelectorAll('.ctrl').forEach(btn => {
      btn.addEventListener('click', () => {
        playSound('click');
        const k = btn.getAttribute('data-key');
        const cmd = btn.getAttribute('data-cmd');
        if (cmd) { sendCommand(cmd); return; }
        if (!k) return;
        if (k === 'Shift+Tab') { dispatchKey('Tab',{shiftKey:true}); return; }
        if (k === ' ') { dispatchKey(' '); return; }
        dispatchKey(k);
      });
    });

    // grid special buttons
    const gridForceResetBtn = document.getElementById('gridForceReset');
    if (gridForceResetBtn){
      gridForceResetBtn.addEventListener('click', () => {
        playSound('danger');
        if (window.__netGrid && typeof window.__netGrid.forceReset === 'function') {
          try { window.__netGrid.forceReset(); return; } catch(e){ console.warn('[mobile] netGrid.forceReset threw', e); }
        }
        sendCommand('reset');
      });
    }
    const gridCheckBtn = document.getElementById('gridCheck');
    if (gridCheckBtn) gridCheckBtn.addEventListener('click', () => { playSound('click'); sendCommand('net_check'); });

    // ===== terminal canvas autoscaling & scroll handling =====
    // Wrap behaviour: #terminal is a scrollable container (CSS). We detect terminal canvas and scale it to fit.
    const termContainer = document.getElementById('terminal');
    function adjustTerminalScaleOnce(){
      if (!termContainer) return;
      // find terminal canvas (exclude meshes/overlays)
      const canvases = Array.from(termContainer.querySelectorAll('canvas'));
      let terminalCanvas = canvases.find(cv => {
        const id = (cv.id||'').toLowerCase();
        if (id.includes('map') || id.includes('grid') || id.includes('net')) return false;
        // prefer first canvas if ambiguous
        return true;
      }) || termContainer.querySelector('canvas') || document.querySelector('canvas');
      if (!terminalCanvas) return;

      // get natural width (try .width property, fallback to bounding box)
      const naturalWidth = terminalCanvas.width || terminalCanvas.getBoundingClientRect().width || (window.innerWidth);
      const naturalHeight = terminalCanvas.height || terminalCanvas.getBoundingClientRect().height || (window.innerHeight);

      if (!naturalWidth) return;

      // compute scale to fit width (but not upscale >1)
      const scale = Math.min(1, window.innerWidth / naturalWidth);

      // apply transform scale and adjust container inner size so scroll works correctly
      terminalCanvas.style.transformOrigin = '0 0';
      terminalCanvas.style.transform = `scale(${scale})`;

      // ensure container accommodates the scaled element for scrolling
      termContainer.style.overflow = 'auto';
      termContainer.style.webkitOverflowScrolling = 'touch';
      termContainer.style.width = '100%';
      termContainer.style.height = '100%';

      // set a wrapper size (so scroll area equals canvas scaled dims)
      try {
        termContainer.style.minWidth = (naturalWidth * scale) + 'px';
        termContainer.style.minHeight = (naturalHeight * scale) + 'px';
      } catch(e){}
    }

    // call once now and on resize
    adjustTerminalScaleOnce();
    window.addEventListener('resize', () => { setTimeout(adjustTerminalScaleOnce, 120); });

    // Also try a MutationObserver to re-adjust when terminal updates DOM/canvas
    const mo = new MutationObserver((mut) => { adjustTerminalScaleOnce(); });
    mo.observe(termContainer || document.body, {childList:true, subtree:true, attributes:true});

    // ===== hide duplicate degradation banner logic =====
    (function resolveDegradationDup(){
      // find any element in document that contains "ДЕГРАДАЦИЯ" (case-insensitive)
      const all = Array.from(document.querySelectorAll('body *'));
      const hasTerminalDeg = all.some(el => {
        try {
          return el !== degradationDisplay && /деградац/i.test(el.innerText || el.textContent || '');
        } catch(e){ return false; }
      });

      if (hasTerminalDeg && degradationDisplay) {
        // terminal already draws its own; hide mobile's
        degradationDisplay.style.display = 'none';
      } else {
        // otherwise keep and update it periodically (we already do elsewhere)
        degradationDisplay.style.display = 'block';
      }
    })();

    // update degradation value from TC if available
    function updateDegradation(){
      try {
        if (TC && TC.degradation && typeof TC.degradation.level === 'number') { degradationDisplay.textContent = `ДЕГРАДАЦИЯ: ${TC.degradation.level}%`; return; }
        const lvl = localStorage.getItem('adam_degradation');
        if (lvl !== null) { degradationDisplay.textContent = `ДЕГРАДАЦИЯ: ${lvl}%`; return; }
      } catch(e){}
      degradationDisplay.textContent = 'ДЕГРАДАЦИЯ: —';
    }
    updateDegradation();
    setInterval(updateDegradation, 2000);

    // click outside submenu closes it
    document.addEventListener('click', (e) => { if (!subMenu.classList.contains('hidden') && !subMenu.contains(e.target) && !e.target.closest('.cmd')) closeSubmenu(); });

    // expose for debugging
    window.__mobileTerminal = { sendCommand, openGridModal, closeGridModal };

    console.log('[mobile] UI ready (TC present:', !!TC, ', netGrid:', !!window.__netGrid, ', audio:', !!window.audioManager, ')');
  } // init end
});
