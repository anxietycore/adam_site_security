/* terminal.js
   Протокол деградации: VIGIL-9
   - Деградация хранится в localStorage по ключу 'vigil_degradation'
   - Увеличение: +1% каждые 30сек активной сессии; +1% при выполнении команд: syst, syslog, net, dscr, subj, notes
   - При достижении 98% - автоматический RESET
   - Поддержка reset команды
   - Визуальные и аудио-эффекты синхронизированы с уровнем деградации
   - Все состояния сохраняются (посещения, последние изменения, таймеры)
*/

/* =================== SETTINGS =================== */
const DEG_KEY = 'vigil_degradation';
const VISITS_KEY = 'adam_visits';
const LAST_ACTIVE_KEY = 'vigil_last_active';
const SESSION_START_KEY = 'vigil_session_start';

const AUTO_INC_INTERVAL_MS = 30_000; // 30 секунд
const COMMANDS_THAT_INCR = ['syst','syslog','net','dscr','subj','notes'];
const AUTO_RESET_THRESHOLD = 98;
const RESET_HOLD_MS = 3500; // visual reset length

/* =================== DOM references =================== */
document.addEventListener('DOMContentLoaded', initTerminal);

function initTerminal(){
    // 1. Получи элементы DOM
    window.terminal = document.getElementById('terminal');
    window.degIndicator = document.getElementById('degradation-indicator');
    window.degPercent = document.getElementById('deg-percent');
    window.degFill = document.getElementById('deg-fill');
    window.degTip = document.getElementById('deg-tip');

    // 2. Получи аудио-элементы
    window.audioAmbient = document.getElementById('audio-ambient');
    window.audioResetCom = document.getElementById('audio-reset-com');
    window.audioResetComRev = document.getElementById('audio-reset-com-rev');
    window.audioGlitchE = document.getElementById('audio-glitch-e');
    window.audioClick = document.getElementById('audio-click');

    // 3. Инициализируй состояние — ВКЛЮЧАЯ currentDegradation
    window.currentDegradation = parseInt(localStorage.getItem(DEG_KEY)) || 0;
    window.commandCount = 0;
    window.sessionStart = Date.now();
    localStorage.setItem(SESSION_START_KEY, window.sessionStart);

    // 4. ТОЛЬКО ТЕПЕРЬ можно рисовать canvas — потому что currentDegradation уже существует
    initNeuralCanvas();

    // restore visits and show boot-ish lines
    const visits = parseInt(localStorage.getItem(VISITS_KEY)) || 0;
    renderInitialBoot(visits);

    // input handling
    setupInputHandling();

    // apply visuals according to currentDegradation
    applyDegradationVisuals(currentDegradation);

    // start auto-increment timer
    startAutoIncrement();

    // also run periodic micro-pulse to simulate 'pulse of interface'
    setInterval(interfacePulse, 10_000);

    // small "life" micro-events
    setInterval(randomAmbientEvent, 8_000 + Math.random()*6000);
}

/* ================ NEURAL CANVAS ================ */
function initNeuralCanvas(){
    const canvas = document.getElementById('neural-canvas');
    if(!canvas) return;
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const ctx = canvas.getContext('2d');

    // draw slow pulsing "EEG/roots" lines
    function draw(){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        const t = Date.now() * 0.0005;
        const baseOpacity = 0.06 + (currentDegradation/100)*0.12;
        for(let i=0;i<6;i++){
            ctx.beginPath();
            const ySeed = (i+1) * (canvas.height / 7);
            for(let x=0;x<canvas.width;x+=10){
                const y = ySeed + Math.sin((x*0.004) + t*(0.5+i*0.2)) * (8 + i*2) + Math.sin(x*0.02 + t*0.8) * 2;
                if(x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
            }
            ctx.strokeStyle = `rgba(100,255,130,${baseOpacity * (0.7 - i*0.08)})`;
            ctx.lineWidth = 1 - i*0.08;
            ctx.stroke();
        }
        // occasional pulse line
        if(Math.random() < 0.02 + (currentDegradation/400)) {
            ctx.fillStyle = `rgba(255,255,255,${0.02 + (currentDegradation/1000)})`;
            ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 1, canvas.height*0.001);
        }
        requestAnimationFrame(draw);
    }
    draw();

    // handle resize
    window.addEventListener('resize', ()=>{
        canvas.width = innerWidth;
        canvas.height = innerHeight;
    });
}

/* ================ BOOT / INITIAL TEXT ================ */
function renderInitialBoot(visits) {
    const bootSequence = [
        "adam@vigil-9:~$ BOOTING VIGIL-9 PROTOCOL",
        "Инициализация нейрослоя...",
        "Загрузка архивов: [████████░░] 82%",
    ];

    // customize based on visits
    if(visits === 1){
        bootSequence.push("> новая инициализация ядра...");
    } else if(visits === 2) {
        bootSequence.push("> повторное подключение обнаружено");
        bootSequence.push("> процесс: unstable");
    } else if(visits >= 3) {
        bootSequence.push("> A.D.A.M. уже активен");
        bootSequence.push("> кто ты?");
    }

    (async function playBoot(){
        for(const line of bootSequence){
            await typeText(line, 'output', 6);
            await sleep(120 + Math.random()*300);
        }
        await typeText("> Интерфейс готов. Введите 'help' для списка команд.", 'output', 6);
        await sleep(200);
        // create input prompt
        addInputLine();
    })();
}

/* ================ TYPING / OUTPUT HELPERS ================ */
let isTyping = false;
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function typeText(text, className='output', speed=4, allowGlitch=false){
    return new Promise(resolve=>{
        const line = document.createElement('div');
        line.className = className;
        terminal.appendChild(line);
        let idx = 0;
        isTyping = true;
        function step(){
            if(idx < text.length){
                // occasionally skip a character at low levels (level 2)
                if(Math.random() < 0.02 + (Math.max(0,currentDegradation-30)/200)) {
                    // simulate rare skip
                    line.textContent += text.charAt(idx);
                    idx++;
                } else {
                    line.textContent += text.charAt(idx);
                    idx++;
                }
                terminal.scrollTop = terminal.scrollHeight;
                setTimeout(step, speed + (Math.random()*3));
            } else {
                isTyping = false;
                resolve();
            }
        }
        step();
    });
}

function addColoredText(text, color, cls='output'){
    const line = document.createElement('div');
    line.className = cls;
    line.style.color = color;
    line.textContent = text;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

function addOutput(text, cls='output'){
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = text;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

/* ================ INPUT LINE HANDLING ================ */
let inputLineElement = null;
let inputBuffer = '';
let history = [];
let histIdx = -1;

function addInputLine(){
    inputLineElement = document.createElement('div');
    inputLineElement.className = 'input-line';
    inputLineElement.innerHTML = `<span class="prompt">&gt;&gt; </span><span class="cmd" id="cmdText"></span><span class="cursor" id="terminalCursor"></span>`;
    terminal.appendChild(inputLineElement);
    terminal.scrollTop = terminal.scrollHeight;
    inputBuffer = '';
    histIdx = history.length;
    // focus via keydown listener
}

function removeInputLine(){
    if(inputLineElement) inputLineElement.remove();
    inputLineElement = null;
}

/* key handling for terminal */
document.addEventListener('keydown', function(e){
    // if awaiting special confirm, ignore
    if(awaitingConfirm) return;
    // ignore when typing animation is active? still accept keys.
    if(!inputLineElement) return;
    const cmdText = document.getElementById('cmdText');
    if(e.key === 'Backspace'){
        inputBuffer = inputBuffer.slice(0,-1);
    } else if(e.key === 'Enter'){
        const command = inputBuffer.trim();
        if(command.length > 0) {
            history.push(command);
            histIdx = history.length;
        }
        executeCommand(command);
        inputBuffer = '';
    } else if(e.key === 'ArrowUp'){
        if(history.length === 0) return;
        histIdx = Math.max(0, histIdx-1);
        inputBuffer = history[histIdx] || '';
    } else if(e.key === 'ArrowDown'){
        if(history.length === 0) return;
        histIdx = Math.min(history.length, histIdx+1);
        inputBuffer = history[histIdx] || '';
    } else if(e.key.length === 1 && !e.ctrlKey && !e.metaKey){
        inputBuffer += e.key;
    }
    if(cmdText) cmdText.textContent = inputBuffer;
});

/* ================ COMMAND EXECUTION ================ */
let awaitingConfirm = false;
let confirmResolver = null;

async function executeCommand(raw){
    // echo the command as a command line
    removeInputLine();
    if(raw && raw.length>0){
        addColoredText(`> ${raw}`, 'var(--phosphor)', 'output');
    } else {
        addOutput('');
    }

    const parts = (raw||'').trim().split(/\s+/);
    const cmd = parts[0] ? parts[0].toLowerCase() : '';

    // increment commandCount
    if(cmd) commandCount++;

    // Check commands that increase degradation
    if(COMMANDS_THAT_INCR.includes(cmd)){
        incrementDegradation(1, `Команда '${cmd}' увеличила деградацию`);
    }

    // handle built-in commands
    switch(cmd){
        case '':
            // blank - just recreate input
            addInputLine();
            break;
        case 'help':
            await typeText("Доступные команды: help, status, reset, syst, syslog, net, dscr, subj, notes, clear, trace", 'output', 6);
            addInputLine();
            break;
        case 'status':
            showStatus();
            addInputLine();
            break;
        case 'clear':
            terminal.innerHTML = '';
            addInputLine();
            break;
        case 'syst':
        case 'syslog':
        case 'net':
        case 'dscr':
        case 'subj':
        case 'notes':
            // simulate heavier operations
            await typeText(`Выполнение ${cmd.toUpperCase()}...`, 'output', 5);
            await showLoading(900 + Math.random()*1200, "АНАЛИЗ СИГНАЛА");
            // random short ambient click
            playClick();
            // small extra text
            addOutput(`[${cmd.toUpperCase()}] отчёт: состояние в норме (прибавлена деградация)`);
            addInputLine();
            break;
        case 'trace':
            await typeText("tracing network... (промежуточные пакеты будут выведены)", 'output', 6);
            await sleep(300);
            // insert occasional false lines to create paranoia
            if(Math.random() < 0.35 + (currentDegradation/200)){
                addOutput("adam@secure:~$ ... → ОШИБКА // НЕТ ПОЛЬЗОВАТЕЛЯ", 'output');
            }
            addInputLine();
            break;
        case 'reset':
            // do confirmation
            await typeText("Подтвердите RESET: (Y/N)", 'output', 6);
            const ok = await waitForConfirmation();
            if(ok){
                await performReset('manual');
            } else {
                addOutput("RESET отменён.", 'output');
                addInputLine();
            }
            break;
        default:
            // unknown: small chance of fake autonomous text insertion if high degradation
            await typeText(`Неизвестная команда: '${cmd}'. Введите 'help'.`, 'output', 6);
            if(currentDegradation >= 80 && Math.random() < 0.18){
                await sleep(250);
                addOutput("adam@secure:~$ … → ОШИБКА // НЕТ ПОЛЬЗОВАТЕЛЯ", 'output');
            }
            addInputLine();
            break;
    }

    // store last active time
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
}

/* ================ CONFIRMATION HANDLER ================ */
function waitForConfirmation(){
    return new Promise(resolve => {
        awaitingConfirm = true;
        // show a small confirm prompt (Y/N)
        const confirmLine = document.createElement('div');
        confirmLine.className = 'input-line';
        confirmLine.innerHTML = `<span class="prompt" style="color:var(--amber)">&gt; confirm: </span><span class="cmd" id="confirmText"></span><span class="cursor" id="confirmCursor"></span>`;
        terminal.appendChild(confirmLine);
        terminal.scrollTop = terminal.scrollHeight;
        let confirmBuffer = '';

        function keyHandler(e){
            if(!awaitingConfirm) return;
            const el = document.getElementById('confirmText');
            if(!el) return;
            if(e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н'){
                el.textContent = 'Y';
                el.style.color = 'var(--phosphor)';
                cleanup(true);
            } else if(e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т'){
                el.textContent = 'N';
                el.style.color = 'var(--blood)';
                cleanup(false);
            }
        }

        function cleanup(result){
            document.removeEventListener('keydown', keyHandler);
            confirmLine.remove();
            awaitingConfirm = false;
            resolve(result);
        }

        document.addEventListener('keydown', keyHandler);
    });
}

/* ================ LOADING WIDGET ================ */
function showLoading(duration=1200, text="ANALYSIS"){
    return new Promise(resolve=>{
        const loader = document.createElement('div');
        loader.className = 'output';
        loader.textContent = `${text} [0%]`;
        const bar = document.createElement('div');
        bar.style.width = '200px';
        bar.style.height = '10px';
        bar.style.border = '1px solid rgba(100,255,130,0.08)';
        bar.style.marginTop = '8px';
        bar.style.background = 'rgba(100,255,130,0.02)';
        const fill = document.createElement('div');
        fill.style.height = '100%';
        fill.style.width = '0%';
        fill.style.background = 'linear-gradient(90deg,#00FF41,#00cc33)';
        fill.style.transition = 'width 0.12s linear';
        bar.appendChild(fill);
        loader.appendChild(bar);
        terminal.appendChild(loader);
        terminal.scrollTop = terminal.scrollHeight;
        const interval = 50;
        const steps = Math.max(6, Math.floor(duration/interval));
        let p = 0;
        const inc = 100/steps;
        const t = setInterval(()=>{
            p += inc;
            if(p >= 100){
                p = 100;
                clearInterval(t);
                loader.textContent = `${text} [ЗАВЕРШЕНО]`;
                loader.style.color = 'var(--phosphor)';
                loader.appendChild(bar);
                setTimeout(()=> { loader.remove(); resolve(); }, 300);
            } else {
                loader.textContent = `${text} [${Math.round(p)}%]`;
                loader.appendChild(bar);
                fill.style.width = `${p}%`;
            }
            terminal.scrollTop = terminal.scrollHeight;
        }, interval);
    });
}

/* ================ DEGRADATION MANAGEMENT ================ */
function setDegradation(value, sourceDesc){
    window.currentDegradation = Math.max(0, Math.min(100, Math.round(value)));
    localStorage.setItem(DEG_KEY, window.currentDegradation.toString());
    updateDegradationUI();

    // audio/visual triggers for certain thresholds
    if(window.currentDegradation === 70 || window.currentDegradation === 75){
        playAudioOnce(audioResetCom);
    }
    if(window.currentDegradation === 85 || window.currentDegradation === 90){
        playAudioOnce(audioResetComRev);
    }
    if(window.currentDegradation >= AUTO_RESET_THRESHOLD){
        // prevent further increases and trigger automatic reset
        autoTriggerReset();
    }
    // slight ambient volume increase with degradation
    try {
        audioAmbient.volume = 0.06 + (window.currentDegradation/100)*0.14;
    } catch(e){}
    console.log(`DEGRADATION SET: ${window.currentDegradation}%`, sourceDesc || '');
}

function incrementDegradation(delta=1, sourceDesc='manual'){
    setDegradation(window.currentDegradation + delta, sourceDesc);
}

function updateDegradationUI(){
    degPercent.textContent = `${window.currentDegradation}%`;
    degFill.style.width = `${window.currentDegradation}%`;
    // levels mapping
    const el = degIndicator;
    el.classList.remove('level-1','level-2','level-3','level-4','level-5');
    document.body.classList.remove('deg-glitch-1','deg-glitch-2','deg-glitch-3','deg-glitch-4','deg-glitch-5');
    if(window.currentDegradation < 30){
        el.classList.add('level-1');
        document.body.classList.add('deg-glitch-1');
        degTip.classList.remove('visible');
        el.classList.remove('show-tip');
    } else if(window.currentDegradation < 60){
        el.classList.add('level-2');
        document.body.classList.add('deg-glitch-2');
        if(window.currentDegradation >= 60) el.classList.add('show-tip');
    } else if(window.currentDegradation < 80){
        el.classList.add('level-3');
        document.body.classList.add('deg-glitch-3');
        el.classList.add('show-tip');
    } else if(window.currentDegradation < 95){
        el.classList.add('level-4');
        document.body.classList.add('deg-glitch-4');
        el.classList.add('show-tip');
    } else {
        el.classList.add('level-5');
        document.body.classList.add('deg-glitch-5');
        el.classList.add('show-tip');
    }

    // show tip starting from 60%
    if(window.currentDegradation >= 60){
        degTip.style.display = 'block';
    } else {
        degTip.style.display = 'none';
    }
}

/* ================ AUTO-INCREMENT TIMER ================ */
let autoIncTimer = null;
function startAutoIncrement(){
    // compute time since last active to resume stable behavior
    const lastActive = parseInt(localStorage.getItem(LAST_ACTIVE_KEY)) || Date.now();
    const elapsed = Date.now() - lastActive;
    // we will not increment retroactively beyond current session: increments happen only in active session every 30s
    if(autoIncTimer) clearInterval(autoIncTimer);
    autoIncTimer = setInterval(()=>{
        incrementDegradation(1, 'time');
        // small chance to produce an ambient click
        if(Math.random() < 0.18 + (currentDegradation/200)){
            playClick();
        }
    }, AUTO_INC_INTERVAL_MS);
}

/* ================ RESET logic ================ */
let resetting = false;
async function performReset(mode='auto'){
    if(resetting) return;
    resetting = true;
    // block input
    removeInputLine();
    addOutput('SYSTEM: ИНИЦИАЛИЗАЦИЯ RESET...', 'output');
    // play appropriate audio (if auto vs manual)
    if(mode === 'auto'){
        try { audioGlitchE.currentTime = 0; audioGlitchE.volume = 0.9; audioGlitchE.play().catch(()=>{}); } catch(e){}
    } else {
        try { audioResetCom.currentTime = 0; audioResetCom.volume = 0.65; audioResetCom.play().catch(()=>{}); } catch(e){}
    }

    // heavy visual distort for a few seconds
    document.body.classList.add('deg-glitch-5');
    await sleep(RESET_HOLD_MS);

    // restore interface
    document.body.classList.remove('deg-glitch-5');
    // reset values
    setDegradation(0, `RESET (${mode})`);
    localStorage.setItem(DEG_KEY, '0');
    addOutput('SYSTEM: RESET ВЫПОЛНЕН. ВОССТАНОВЛЕНИЕ СВЯЗИ...', 'output');
    // soft restore sound
    try {
        audioAmbient.currentTime = 0;
        audioAmbient.volume = 0.04;
    } catch(e){}
    setTimeout(()=> {
        addInputLine();
        resetting = false;
    }, 700);
}

async function autoTriggerReset(){
    // if already resetting, ignore
    if(resetting) return;
    addOutput('!! ДЕГРАДАЦИЯ ЯДРА ДОСТИГЛА КРИТИЧЕСКОГО УРОВНЯ !!', 'output');
    // short delay then reset automatically
    await sleep(300);
    await performReset('auto');
}

/* ================ AUDIO helpers ================ */
function playAudioOnce(audioEl){
    try {
        audioEl.currentTime = 0;
        audioEl.volume = 0.7;
        audioEl.play().catch(()=>{});
        setTimeout(()=> {
            // fade out shortly
            try { audioEl.pause(); audioEl.currentTime = 0; } catch(e){}
        }, 1400);
    } catch(e){}
}

function playClick(){
    try {
        audioClick.currentTime = 0;
        audioClick.volume = 0.18 + (currentDegradation/500);
        audioClick.play().catch(()=>{});
    } catch(e){}
}

/* ================ Small ambient events ================ */
function randomAmbientEvent(){
    if(Math.random() > 0.6 + (currentDegradation/120)) return;
    const phrases = [
        "не отключайся",
        "он наблюдает",
        "ты ещё здесь?",
        "ошибка // сознание"
    ];
    const txt = randChoice(phrases);
    // transient ghost line
    const ghost = document.getElementById('memory-ghost-temp');
    addColoredText(txt, 'rgba(192,0,255,0.18)', 'output');
    // short glitch sound
    if(Math.random() < 0.4) playClick();
}

/* ================ Interface pulse =================== */
function interfacePulse(){
    // brief flash, more intense with degradation
    const intensity = 0.04 + (currentDegradation/250);
    document.body.style.transition = 'filter 0.12s linear';
    document.body.style.filter = `brightness(${1 + intensity})`;
    setTimeout(()=> document.body.style.filter = '', 120);
    // also small vibration in higher levels
    if(currentDegradation >= 80){
        const shift = (Math.random()*2)-1;
        document.body.style.transform = `translateX(${shift}px)`;
        setTimeout(()=> document.body.style.transform = '', 200);
    }
}

/* ================ STATUS command =================== */
async function showStatus(){
    addColoredText(`VIGIL-9 STATUS REPORT`, 'var(--phosphor)', 'output');
    addOutput(`- DEGRADED: ${currentDegradation}%`, 'output');
    addOutput(`- SESSION TIME: ${Math.round((Date.now()-window.sessionStart)/1000)}s`, 'output');
    addOutput(`- COMMANDS RUN: ${commandCount}`, 'output');
    if(currentDegradation >= 60){
        addColoredText("> команда RESET рекомендована для стабилизации", 'rgba(255,210,120,0.9)', 'output');
    }
}

/* ================ Misc helpers ================ */
function randChoice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

/* ================ SVG filter injection for RGB shift ================ */
(function ensureSvgFilter(){
    // add small filter used in CSS if not present
    if(document.getElementById('vigil-filters')) {
        return;
    }
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS,'svg');
    svg.setAttribute('height','0');
    svg.setAttribute('width','0');
    svg.id = 'vigil-filters';
    svg.innerHTML = `
      <filter id="rgb-shift">
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
        <feOffset dx="1" dy="0" result="o1"/>
        <feOffset dx="-1" dy="0" result="o2"/>
        <feBlend in="o1" in2="o2" mode="screen"/>
      </filter>
    `;
    document.body.appendChild(svg);
})();

/* ================ Protect devtools small trick (purely atmospheric) ================ */
(function devtoolsDetect(){
    // Not reliable but adds atmosphere. We won't block anything.
    const start = Date.now();
    const div = document.createElement('div');
    div.innerHTML = ' ';
    div.style.display = 'none';
    console.log('%c', 'font-size:400px;');
    setTimeout(()=> {
        const end = Date.now();
        if(end - start > 1000) {
            addOutput('A.D.A.M. не любит, когда на него смотрят.', 'output');
        }
    }, 500);
})();
