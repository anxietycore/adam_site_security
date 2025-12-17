/* terminal_mobile.js — мобильный фронтенд для terminal_canvas.js
   Требования: отдельный файл, не менять terminal_canvas.js, netGrid_v3.js и module_audio.js.
   Что делает:
   - Упрощённый мобильный ввод команд (использует processCommand из terminal_canvas.js)
   - Сенсорное управление net grid (включает/выключает режим сетки и показывает удобную панель управления)
   - Оптимизация для мобильных (режим "mobileLite" — снижает деградацию и выключает тяжёлые фоновые звуки)
   - Использует существующие API: window.__TerminalCanvas.processCommand, window.__netGrid.setGridMode и audioManager методы.

   Зависимости: terminal_canvas.js, netGrid_v3.js, module_audio.js подключены в странице ДО этого скрипта.
*/
(function(){
  'use strict';

  // === Конфигурация ===
  const MOBILE_BAR_HEIGHT = 72; // px
  const BUTTON_SIZE = 56; // px
  const MOBILE_LITE_DEFAULT = true; // по умолчанию включаем облегчённый режим

  // Простая проверка — показывать только на мобильных
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(navigator.userAgent);

  // Если разработчик хочет принудительно загрузить — можно выставить window.FORCE_MOBILE_TERMINAL = true
  if (!isMobile && !window.FORCE_MOBILE_TERMINAL) {
    console.log('[terminal_mobile] Не мобильное устройство — mobile UI пропущен');
    return;
  }

  // Ждём, пока центральный терминал будет готов
  function whenReady(cb){
    const max = 2000; // 2s
    const start = Date.now();
    (function poll(){
      if (window.__TerminalCanvas && window.__TerminalCanvas.processCommand && window.__netGrid && window.__TerminalCanvas.degradation) return cb();
      if (Date.now() - start > max) return cb();
      setTimeout(poll, 80);
    })();
  }

  whenReady(() => {
    const TC = window.__TerminalCanvas || null;
    const NG = window.__netGrid || null;
    const degradation = TC ? TC.degradation : null;
    const audio = window.audioManager || (window.AudioManager && new window.AudioManager()) || null; // fallback

    if (!TC) {
      console.warn('[terminal_mobile] window.__TerminalCanvas не найден — всё ещё попробую создать интерфейс, но processCommand отсутствует');
    }

    // Создаём контейнер
    const container = document.createElement('div');
    container.id = 'mobileTerminalUI';
    Object.assign(container.style, {
      position: 'fixed',
      left: '0',
      right: '0',
      bottom: '0',
      height: MOBILE_BAR_HEIGHT + 'px',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      padding: '8px',
      boxSizing: 'border-box',
      gap: '8px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.0), rgba(0,0,0,0.5))'
    });
    document.body.appendChild(container);

    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Введите команду... (help)';
    Object.assign(input.style, {
      flex: '1',
      height: (MOBILE_BAR_HEIGHT - 16) + 'px',
      borderRadius: '8px',
      padding: '10px 12px',
      fontSize: '15px',
      fontFamily: "'Press Start 2P', monospace, monospace",
      outline: 'none',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(0,0,0,0.6)',
      color: '#00FF41'
    });
    container.appendChild(input);

    // Send button
    const sendBtn = document.createElement('button');
    sendBtn.innerText = '→';
    Object.assign(sendBtn.style, {
      width: BUTTON_SIZE + 'px',
      height: BUTTON_SIZE + 'px',
      borderRadius: '10px',
      fontSize: '22px',
      fontFamily: "'Press Start 2P', monospace",
      background: 'rgba(0,0,0,0.7)',
      color: '#00FF41',
      border: '1px solid rgba(255,255,255,0.04)'
    });
    container.appendChild(sendBtn);

    // Grid toggle
    const gridBtn = document.createElement('button');
    gridBtn.innerText = 'NET';
    Object.assign(gridBtn.style, sendBtn.style);
    container.appendChild(gridBtn);

    // Lite toggle
    const liteBtn = document.createElement('button');
    liteBtn.innerText = MOBILE_LITE_DEFAULT ? 'LITE ON' : 'LITE OFF';
    Object.assign(liteBtn.style, sendBtn.style);
    container.appendChild(liteBtn);

    // Helper: safe call processCommand
    function submitCommand(cmd){
      const text = String(cmd || '').trim();
      if (!text) return;
      // play minimal key sound if available
      try{ if (audio && audio.playSound) audio.playSound('interface','interface_key_press_01.mp3', { volume: 0.5 }); }catch(e){}

      if (TC && TC.processCommand) {
        TC.processCommand(text);
      } else {
        // fallback: try dispatching Enter key events to terminal canvas
        const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        // set a temporary currentLine if terminal expects it
        if (window.currentLine !== undefined) window.currentLine = text;
        document.dispatchEvent(ev);
      }
      input.value = '';
      input.blur();
    }

    sendBtn.addEventListener('click', () => submitCommand(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitCommand(input.value);
      }
    });

    // GRID modal
    const gridModal = document.createElement('div');
    Object.assign(gridModal.style, {
      position: 'fixed', left: '0', right: '0', top: '0', bottom: '0', zIndex: 999998,
      display: 'none', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)'
    });
    document.body.appendChild(gridModal);

    const gridPanel = document.createElement('div');
    Object.assign(gridPanel.style, {
      width: '92%', maxWidth: '420px', height: '64%', borderRadius: '12px', padding: '12px',
      boxSizing: 'border-box', background: 'rgba(1,8,6,0.95)', color: '#00FF41', display: 'flex', flexDirection: 'column', gap: '8px'
    });
    gridModal.appendChild(gridPanel);

    const gridHeader = document.createElement('div');
    gridHeader.innerText = 'NET GRID — управление';
    Object.assign(gridHeader.style, { fontFamily: "'Press Start 2P', monospace", fontSize: '12px' });
    gridPanel.appendChild(gridHeader);

    // mapCanvas area — если netGrid создал canvas (mapCanvas), мы переместим его внутрь панели
    function attachMapCanvas(){
      // netGrid_v3 создаёт canvas и добавляет в body; мы попытаемся найти этот canvas
      const possible = Array.from(document.querySelectorAll('canvas')).find(c => c !== document.getElementById('terminalCanvas') && c.id !== 'shader-canvas' && c.id !== 'crtOverlayCanvas' && c.id !== 'glassFX');
      if (possible) {
        // клонировать ноду нежелательно — переместим оригинал и сохраним reference
        possible.style.width = '100%';
        possible.style.height = 'calc(100% - 120px)';
        possible.style.pointerEvents = 'auto';
        possible.style.right = 'auto';
        possible.style.bottom = 'auto';
        possible.style.left = '4%';
        possible.style.top = '56px';
        possible.style.position = 'relative';
        possible.style.borderRadius = '8px';
        gridPanel.appendChild(possible);
        return possible;
      }
      return null;
    }

    let mapCanvasAttached = null;

    // Touch controls area
    const controls = document.createElement('div');
    Object.assign(controls.style, { display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' });

    const leftGroup = document.createElement('div');
    leftGroup.style.display = 'flex'; leftGroup.style.gap = '6px';

    const upBtn = createBigBtn('↑');
    const downBtn = createBigBtn('↓');
    const leftBtn = createBigBtn('←');
    const rightBtn = createBigBtn('→');
    const selectBtn = createBigBtn('TAB');
    const lockBtn = createBigBtn('␣');
    const exitBtn = createBigBtn('ESC');

    leftGroup.appendChild(upBtn); leftGroup.appendChild(downBtn); leftGroup.appendChild(leftBtn); leftGroup.appendChild(rightBtn);

    const rightGroup = document.createElement('div');
    rightGroup.style.display = 'flex'; rightGroup.style.gap = '6px';
    rightGroup.appendChild(selectBtn); rightGroup.appendChild(lockBtn); rightGroup.appendChild(exitBtn);

    controls.appendChild(leftGroup); controls.appendChild(rightGroup);
    gridPanel.appendChild(controls);

    // helper to dispatch keyboard events (used because netGrid listens for keydown)
    function dispatchKey(key){
      const ev = new KeyboardEvent('keydown', { key, bubbles: true });
      document.dispatchEvent(ev);
    }

    upBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); dispatchKey('ArrowUp'); });
    downBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); dispatchKey('ArrowDown'); });
    leftBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); dispatchKey('ArrowLeft'); });
    rightBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); dispatchKey('ArrowRight'); });
    selectBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); dispatchKey('Tab'); });
    lockBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); dispatchKey(' '); });
    exitBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); closeGridModal(); dispatchKey('Escape'); });

    // swipe support for the whole modal
    let touchStart = null;
    gridModal.addEventListener('touchstart', (e)=>{ if (e.touches && e.touches[0]) touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; });
    gridModal.addEventListener('touchend', (e)=>{
      if (!touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.x; const dy = t.clientY - touchStart.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30) dispatchKey('ArrowRight'); else if (dx < -30) dispatchKey('ArrowLeft');
      } else {
        if (dy > 30) dispatchKey('ArrowDown'); else if (dy < -30) dispatchKey('ArrowUp');
      }
      touchStart = null;
    });

    function openGridModal(){
      if (!NG) {
        if (TC && TC.addColoredText) TC.addColoredText('ОШИБКА: NET GRID не загружен', '#FF4444');
        return;
      }

      // попросим netGrid включиться
      try{ NG.setGridMode(true); } catch(e){}
      gridModal.style.display = 'flex';
      mapCanvasAttached = attachMapCanvas();

      // play small transition sound
      try{ if (audio && audio.playSound) audio.playSound('interface','interface_mode_to_terminal.mp3', { volume: 0.4 }); }catch(e){}
    }

    function closeGridModal(){
      gridModal.style.display = 'none';
      try{ NG.setGridMode(false); }catch(e){}
      // If we moved the canvas inside gridPanel, try to restore it to body: easiest is reload page or do nothing — netGrid remains functional
    }

    gridBtn.addEventListener('click', ()=>{
      if (gridModal.style.display === 'flex') closeGridModal(); else openGridModal();
    });

    liteBtn.addEventListener('click', ()=>{
      mobileLite = !mobileLite; liteBtn.innerText = mobileLite ? 'LITE ON' : 'LITE OFF';
      applyMobileLite();
    });

    let mobileLite = MOBILE_LITE_DEFAULT;
    function applyMobileLite(){
      if (!degradation) return;
      if (mobileLite) {
        // Ограничиваем автоматический рост деградации и приглушаем фон
        degradation.addDegradation = degradation.addDegradation || function(){}; // safe
        // Более безопасный вариант — задаём cap: периодически опускаем выше порога
        if (mobileLiteTimer) clearInterval(mobileLiteTimer);
        mobileLiteTimer = setInterval(()=>{
          if (degradation.level > 60) {
            degradation.level = 60;
            try{ if (degradation.updateIndicator) degradation.updateIndicator(); }catch(e){}
          }
          // выключаем тяжёлые ambient звуки
          try{ if (audio && audio.stopBackgroundMusic) audio.stopBackgroundMusic(); }catch(e){}
        }, 1200);
      } else {
        if (mobileLiteTimer) { clearInterval(mobileLiteTimer); mobileLiteTimer = null; }
      }
    }

    let mobileLiteTimer = null;
    applyMobileLite();

    // Вспомогательная кнопка создания большого элемента
    function createBigBtn(text){
      const b = document.createElement('button');
      b.innerText = text;
      Object.assign(b.style, {
        width: BUTTON_SIZE + 'px', height: BUTTON_SIZE + 'px', borderRadius: '10px', fontSize: '18px',
        fontFamily: "'Press Start 2P', monospace", background: 'rgba(0,0,0,0.6)', color: '#00FF41', border: '1px solid rgba(255,255,255,0.04)'
      });
      return b;
    }

    // Небольшие подсказки: longpress на send запускает last command / quicknet
    let sendPressTimer = null;
    sendBtn.addEventListener('touchstart', ()=>{
      sendPressTimer = setTimeout(()=>{ submitCommand('net_mode'); }, 700);
    });
    sendBtn.addEventListener('touchend', ()=>{ if (sendPressTimer) clearTimeout(sendPressTimer); sendPressTimer = null; });

    // Убираем системную подсветку клавиатуры на iOS
    input.addEventListener('focus', ()=>{ document.body.style.paddingBottom = MOBILE_BAR_HEIGHT + 'px'; });
    input.addEventListener('blur', ()=>{ document.body.style.paddingBottom = ''; });

    // небольшой экспортер состояния для отладки
    window.__MobileTerminal = {
      openGridModal, closeGridModal, submitCommand, applyMobileLite
    };

    // Сигнал пользователю
    if (TC && TC.addColoredText) TC.addColoredText('> Mobile terminal loaded', '#00FF41');
    console.log('[terminal_mobile] интерфейс создан (mobileLite=', mobileLite, ')');

  });
})();
