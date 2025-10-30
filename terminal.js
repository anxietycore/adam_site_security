/* terminal.js - VIGIL-9 Protocol
   Implements degradation increments:
   - +1% every 30 seconds of active session (page visible)
   - +1% per command: syst, syslog, net, dscr, subj, notes
   Saves state in localStorage:
   - vigil_degradation (0-100)
   - vigil_session_start (timestamp)
   - adam_visits (kept by index)
   Auto RESET at >=98%
   Block commands at >=95% except forced system behaviors during RESET
   Visual + audio effects synchronized with levels:
     0-30% level1, 30-60% level2, 60-80% level3, 80-95% level4, 95-100% level5
*/

document.addEventListener('DOMContentLoaded', () => {
    const terminal = document.getElementById('terminal');
    const ambient = document.getElementById('ambientHum');
    const audio_reset = document.getElementById('reset_com');
    const audio_reverse = document.getElementById('reset_com_reverse');
    const audio_glich = document.getElementById('glich_e');
    const percentEl = document.getElementById('degradation-percent');
    const barFill = document.querySelector('#degradation-bar > i');
    const hintEl = document.getElementById('degradation-hint');
    const rgbOverlay = document.getElementById('rgb-shift-overlay');

    // state
    let currentLine = '';
    let commandHistory = [];
    let historyIndex = -1;
    let isTyping = false;
    let awaitingConfirmation = false;
    let confirmationCallback = null;
    let commandCount = 0;
    let sessionStartTime = Date.now();
    // restore degradation
    let degradation = parseInt(localStorage.getItem('vigil_degradation') || '27', 10);
    if (isNaN(degradation)) degradation = 0;
    // Ensure session start saved if none
    if (!localStorage.getItem('vigil_session_start')) localStorage.setItem('vigil_session_start', Date.now().toString());

    // helpers
    function saveState() {
        localStorage.setItem('vigil_degradation', String(Math.min(100, Math.max(0, Math.round(degradation)))));
        localStorage.setItem('vigil_session_start', String(sessionStartTime));
    }

    function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }

    function setDegradation(v, reason='') {
        const prev = degradation;
        degradation = clamp(v);
        saveState();
        updateIndicator();
        // if thresholds reached, trigger events
        // 70 and 75 -> reset_com
        if ((prev < 70 && degradation >= 70) || (prev < 75 && degradation >= 75)) {
            // play reset_com for 70 and 75
            playOneShot(audio_reset);
            showEphemeral('[аудио: reset_com]', 1200);
        }
        // 85 and 90 -> reverse
        if ((prev < 85 && degradation >= 85) || (prev < 90 && degradation >= 90)) {
            playOneShot(audio_reverse);
            showEphemeral('[аудио: reset_com_reverse]', 1200);
        }
        // >=98 -> auto RESET
        if (degradation >= 98) {
            // block commands and run automatic reset
            autoResetProcedure();
        }
        // update body class for visual levels
        applyVisualLevelClass();
    }

    function increaseDegradation(by = 1, reason='cmd') {
        setDegradation(degradation + by, reason);
    }

    function decreaseDegradation(by = 10) {
        setDegradation(degradation - by, 'manual-reset');
    }

    function playOneShot(el) {
        try {
            if (!el) return;
            el.currentTime = 0;
            el.volume = Math.min(1, 0.45 + degradation/250); // louder when more degraded
            el.play().catch(()=>{});
        } catch(e){}
    }

    function updateAmbient() {
        if (!ambient) return;
        try {
            ambient.volume = 0.02 + (degradation/100)*0.18; // from 0.02 to 0.2
            if (document.visibilityState === 'visible') {
                if (ambient.paused) ambient.play().catch(()=>{});
            } else {
                ambient.pause();
            }
        } catch(e){}
    }

    function updateIndicator() {
        const d = clamp(degradation);
        percentEl.textContent = `${d}%`;
        barFill.style.width = `${d}%`;
        // color shift by percent
        if (d < 30) {
            barFill.style.background = 'linear-gradient(90deg, rgba(100,255,130,0.95), rgba(0,180,60,0.6))';
            hintEl.style.display = 'none';
        } else if (d < 60) {
            barFill.style.background = 'linear-gradient(90deg, rgba(255,220,120,0.95), rgba(200,160,30,0.6))';
            hintEl.style.display = 'none';
        } else {
            barFill.style.background = 'linear-gradient(90deg, rgba(216,63,71,0.95), rgba(150,30,40,0.6))';
            hintEl.style.display = 'block';
        }
    }

    function applyVisualLevelClass() {
        const root = document.body;
        root.classList.remove('level-l1','level-l2','level-l3','level-l4','level-l5');
        if (degradation < 30) root.classList.add('level-l1');
        else if (degradation < 60) root.classList.add('level-l2');
        else if (degradation < 80) root.classList.add('level-l3');
        else if (degradation < 95) root.classList.add('level-l4');
        else root.classList.add('level-l5');
        // apply rgb shift intensity to overlay
        const intensity = Math.min(18, Math.floor((degradation/100) * 18));
        rgbOverlay.style.background = `radial-gradient(circle at 20% 20%, rgba(255,0,0,${intensity/120}) 0, transparent 40%),
                                       radial-gradient(circle at 80% 80%, rgba(0,255,0,${intensity/150}) 0, transparent 35%),
                                       radial-gradient(circle at 50% 50%, rgba(0,0,255,${intensity/180}) 0, transparent 30%)`;
        rgbOverlay.style.mixBlendMode = 'screen';
        rgbOverlay.style.opacity = (degradation/100) * 0.12;
    }

    // ephemeral floating message below indicator
    function showEphemeral(text, ttl = 1000) {
        const el = document.createElement('div');
        el.className = 'output';
        el.style.color = '#FFFF66';
        el.style.opacity = '0.95';
        el.textContent = text;
        // place right below indicator
        el.style.position = 'fixed';
        el.style.right = '12px';
        el.style.top = '80px';
        el.style.zIndex = 70;
        el.style.background = 'rgba(0,0,0,0.6)';
        el.style.padding = '6px 8px';
        el.style.border = '1px solid rgba(100,255,130,0.06)';
        el.style.borderRadius = '3px';
        document.body.appendChild(el);
        setTimeout(()=>{ el.style.transition = 'opacity .4s'; el.style.opacity = '0'; }, ttl-300);
        setTimeout(()=>{ el.remove(); }, ttl);
    }

    // Auto reset routine invoked at >=98%
    let autoResetRunning = false;
    async function autoResetProcedure() {
        if (autoResetRunning) return;
        autoResetRunning = true;
        // block inputs visually
        showSystemLine('[АВТОМАТИЧЕСКИЙ СБРОС: ЗАПУСК...]', '#FF4444');
        // play glitched long noise
        playOneShot(audio_glich);
        // heavy visual distort
        document.body.classList.add('flash-invert');
        setTimeout(()=> document.body.classList.remove('flash-invert'), 300);
        // demand forced wait
        await delay(1500);
        // perform resets
        document.body.style.pointerEvents = 'none';
        await showLoading(1200, "СИСТЕМА: подготовка к восстановлению");
        // reset degradation to 0-5 depending random small leftover
        degradation = Math.floor(Math.random() * 3); // 0..2
        saveState();
        updateIndicator();
        applyVisualLevelClass();
        playOneShot(audio_reset);
        showSystemLine('[СИСТЕМА: ВОССТАНОВЛЕНА]', '#00FF41');
        document.body.style.pointerEvents = '';
        autoResetRunning = false;
    }

    // simple delay
    function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

    // show a system line (immediate)
    function showSystemLine(text, color='#CCCCCC') {
        const line = document.createElement('div');
        line.className = 'output';
        line.style.color = color;
        line.textContent = text;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Typing routine with occasional skips and glitched characters depending on degradation
    async function typeText(text, className='output', speed = 8) {
        return new Promise((resolve) => {
            const line = document.createElement('div');
            line.className = className;
            terminal.appendChild(line);
            let i = 0;
            const baseSkipChance = Math.min(0.18, degradation / 260); // up to ~0.18
            const glitchCharSet = ['▓','█','∎','☐'];
            function nextChar() {
                if (i >= text.length) { resolve(); return; }
                // chance to skip or replace characters
                const ch = text[i];
                let outputCh = ch;
                // if degradation moderate, random skip chars
                if (Math.random() < baseSkipChance) {
                    // skip 1-2 chars
                    if (Math.random() < 0.6) {
                        i += 1;
                        // small visible glitch char inserted maybe
                        if (Math.random() < 0.5) {
                            outputCh = glitchCharSet[Math.floor(Math.random()*glitchCharSet.length)];
                        } else {
                            outputCh = '';
                        }
                    }
                } else {
                    // rare ghost overlay letters appear as secondary span (parasitic reflection)
                    if (degradation >= 60 && Math.random() < 0.02) {
                        const ghost = document.createElement('span');
                        ghost.className = 'ghost-line';
                        ghost.textContent = text.substring(i, Math.min(text.length, i+5));
                        ghost.style.position = 'absolute';
                        ghost.style.left = Math.random()*40 + 'px';
                        ghost.style.top = (Math.random()*6 - 3) + 'px';
                        ghost.style.pointerEvents = 'none';
                        ghost.style.opacity = 0.12;
                        line.appendChild(ghost);
                        setTimeout(()=> ghost.remove(), 900 + Math.random()*1500);
                    }
                }

                // append char
                if (outputCh) line.textContent += outputCh;
                i++;
                terminal.scrollTop = terminal.scrollHeight;

                // blinking cursor mimic by occasionally adding tiny shift when high degradation
                if (degradation >= 80 && Math.random() < 0.02) {
                    line.style.transform = `translateY(${(Math.random()*2-1).toFixed(2)}px)`;
                    setTimeout(()=> line.style.transform = '', 120 + Math.random()*180);
                }
                setTimeout(nextChar, speed + Math.random()*speed);
            }
            nextChar();
        });
    }

    // Loading bar used by RESET etc.
    function showLoading(duration = 1200, text = "АНАЛИЗ СИГНАЛА") {
        return new Promise((resolve) => {
            const loader = document.createElement('div');
            loader.className = 'output';
            loader.style.marginTop = '8px';
            const progressBar = document.createElement('div');
            progressBar.style.width = '220px';
            progressBar.style.height = '12px';
            progressBar.style.border = '1px solid rgba(100,255,130,0.08)';
            progressBar.style.background = 'rgba(0,0,0,0.35)';
            progressBar.style.position = 'relative';
            const fill = document.createElement('div');
            fill.style.height = '100%';
            fill.style.width = '0%';
            fill.style.background = 'linear-gradient(90deg,#64ff82,#2db04a)';
            fill.style.boxShadow = '0 0 8px rgba(100,255,130,0.08) inset';
            progressBar.appendChild(fill);
            loader.textContent = `${text} [0%]`;
            loader.appendChild(progressBar);
            terminal.appendChild(loader);
            terminal.scrollTop = terminal.scrollHeight;

            const interval = 50;
            const steps = Math.max(6, Math.floor(duration/interval));
            let prog = 0;
            const inc = 100/steps;
            const pid = setInterval(() => {
                prog += inc;
                if (prog >= 100) { prog = 100; clearInterval(pid); setTimeout(()=> { loader.textContent = `${text} [ЗАВЕРШЕНО]`; resolve(); }, 300); }
                loader.textContent = `${text} [${Math.min(100, Math.round(prog))}%]`;
                if (progressBar.firstChild) progressBar.firstChild.style.width = `${prog}%`;
                terminal.scrollTop = terminal.scrollHeight;
            }, interval);
        });
    }

    // Confirmation prompt simple
    function waitForConfirmation() {
        return new Promise((resolve) => {
            awaitingConfirmation = true;
            const confirmLine = document.createElement('div');
            confirmLine.className = 'input-line';
            confirmLine.innerHTML = '<span class="prompt" style="color:#FFFF00">confirm&gt;&gt; </span><span class="cmd" id="confirmCmd"></span><span class="cursor" id="confirmCursor">_</span>';
            terminal.appendChild(confirmLine);
            terminal.scrollTop = terminal.scrollHeight;
            const keyHandler = (e) => {
                if (!awaitingConfirmation) return;
                if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') {
                    document.getElementById('confirmCmd').textContent = 'Y';
                    document.getElementById('confirmCmd').style.color = '#00FF41';
                    awaitingConfirmation = false;
                    document.removeEventListener('keydown', keyHandler);
                    confirmLine.remove();
                    resolve(true);
                } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
                    document.getElementById('confirmCmd').textContent = 'N';
                    document.getElementById('confirmCmd').style.color = '#FF4444';
                    awaitingConfirmation = false;
                    document.removeEventListener('keydown', keyHandler);
                    confirmLine.remove();
                    resolve(false);
                }
            };
            document.addEventListener('keydown', keyHandler);
        });
    }

    // Process commands (keeps backward-compatible command set)
    async function processCommand(cmdRaw) {
        if (isTyping) return;
        if (degradation >= 95) {
            showSystemLine('> ОШИБКА: ЯДРО НЕ ДОСТУПНО — ДЕГРАДАЦИЯ >= 95%', '#FF4444');
            return;
        }
        commandHistory.push(cmdRaw);
        historyIndex = commandHistory.length;
        commandCount++;
        const line = document.createElement('div');
        line.className = 'command';
        line.textContent = `adam@secure:~$ ${cmdRaw}`;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;

        const cmd = cmdRaw.trim().split(' ')[0].toLowerCase();
        const args = cmdRaw.trim().split(' ').slice(1);

        // commands that increase degradation by +1 when executed
        const degrCommands = ['syst','syslog','net','dscr','subj','notes'];
        if (degrCommands.includes(cmd)) increaseDegradation(1, `cmd:${cmd}`);

        switch (cmd) {
            case 'help':
                await typeText('Доступные команды:', 'output', 6);
                await typeText('  SYST    — проверить состояние системы', 'output', 4);
                await typeText('  SYSLOG  — системный журнал активности', 'output', 4);
                await typeText('  NET     — карта активных узлов проекта', 'output', 4);
                await typeText('  TRACE <id> — отследить модуль', 'output', 4);
                await typeText('  DECRYPT <f> — расшифровать файл', 'output', 4);
                await typeText('  SUBJ    — список субъектов', 'output', 4);
                await typeText('  DSCR <id>— досье', 'output', 4);
                await typeText('  NOTES   — список notes', 'output', 4);
                await typeText('  OPEN <id>— открыть note', 'output', 4);
                await typeText('  RESET   — сброс интерфейса', 'output', 4);
                await typeText('  EXIT    — завершить сессию', 'output', 4);
                await typeText('  CLEAR   — очистить терминал', 'output', 4);
                break;
            case 'clear':
                terminal.innerHTML = '';
                await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 4);
                await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 4);
                break;
            case 'syst':
                await typeText('[СТАТУС СИСТЕМЫ — ИНТЕРФЕЙС VIGIL-9]', 'output', 6);
                addColored('------------------------------------', '#64ff82');
                await typeText('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН', 'output', 4);
                await typeText('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА', 'output', 4);
                addColored('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА', '#ff4444');
                addColored(`ДЕГРАДАЦИЯ: [${progressBarText(degradation)}] ${degradation}%`, '#FFFF00');
                addColored('------------------------------------', '#64ff82');
                await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', 'output', 8);
                break;
            case 'syslog':
                await typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', 'output', 6);
                addColored('------------------------------------', '#64ff82');
                const level = getSyslogLevel();
                if (level === 1) {
                    addColored('[!] Ошибка 0x19F: повреждение нейронной сети', '#FFFF00');
                    addColored('[!] Деградация ядра A.D.A.M.: ' + degradation + '%', '#FFFF00');
                    await typeText('СИСТЕМА: функционирует с ограничениями', 'output', 8);
                } else if (level === 2) {
                    addColored('[!] Нарушение целостности памяти субъекта 0x095', '#FFFF00');
                    addColored('> "я слышу их дыхание. они всё ещё здесь."', '#FF4444');
                    await typeText('СИСТЕМА: обнаружены посторонние сигналы', 'output', 8);
                } else {
                    addColored('> "ты не должен видеть это."', '#FF00FF');
                    addColored('[!] Критическая ошибка: субъект наблюдения неопределён', '#FF4444');
                    await typeText('СИСТЕМА: ОСОЗНАЁТ НАБЛЮДЕНИЕ', 'output', 8);
                }
                break;
            case 'notes':
                await typeText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / NOTES]', 'output', 6);
                addColored('------------------------------------', '#64ff82');
                await typeText('NOTE_001 — "ВЫ ЕГО ЧУВСТВУЕТЕ?" / Dr. Rehn', 'output', 6);
                await typeText('NOTE_002 — "КОЛЬЦО СНА" / tech-op U-735', 'output', 6);
                await typeText('NOTE_003 — "СОН ADAM" / неизвестный', 'output', 6);
                addColored('------------------------------------', '#64ff82');
                await typeText('Для просмотра: OPEN <ID>', 'output', 6);
                break;
            case 'open':
                if (!args[0]) {
                    addColored('ОШИБКА: Укажите ID файла', '#FF4444');
                } else {
                    await openNote(args[0].toUpperCase());
                }
                break;
            case 'subj':
                await typeText('[СПИСОК СУБЪЕКТОВ — VIGIL-9]', 'output', 6);
                addColored('--------------------------------------------------------', '#64ff82');
                // small list
                addColored('0x095 | SUBJECT-095 | СТАТУС: МЁРТВ | МИССИЯ: KATARHEY', '#FF4444');
                addColored('0x811 | SIGMA-PROTOTYPE | СТАТУС: АКТИВЕН | МИССИЯ: HELIX', '#00FF41');
                addColored('0x9A0 | SUBJECT-9A0 | СТАТУС: МЁРТВ/СОЗНАНИЕ АКТИВНО | МИССИЯ: BLACKHOLE', '#FF4444');
                addColored('--------------------------------------------------------', '#64ff82');
                await typeText('ИНСТРУКЦИЯ: DSCR <ID>', 'output', 6);
                break;
            case 'dscr':
                if (!args[0]) {
                    addColored('ОШИБКА: Укажите ID субъекта', '#FF4444');
                } else {
                    await showSubjectDossier(args[0].toUpperCase());
                }
                break;
            case 'reset':
                await typeText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', 'output', 6);
                addColored('------------------------------------', '#64ff82');
                addColored('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', '#FFFF00');
                await typeText('> Подтвердить сброс? (Y/N)', 'output', 6);
                addColored('------------------------------------', '#64ff82');
                const resetConfirmed = await waitForConfirmation();
                if (resetConfirmed) {
                    addColored('> Y', '#00FF41');
                    await showLoading(1500, "Завершение активных модулей");
                    await showLoading(1000, "Перезапуск интерфейса");
                    await showLoading(800, "Восстановление базового состояния");
                    addColored('------------------------------------', '#64ff82');
                    await typeText('[СИСТЕМА ГОТОВА К РАБОТЕ]', 'output', 6);
                    // full reset
                    commandCount = 0;
                    sessionStartTime = Date.now();
                    setDegradation(0, 'manual-reset');
                } else {
                    addColored('> N', '#FF4444');
                    addColored('------------------------------------', '#64ff82');
                    await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 6);
                }
                break;
            case 'exit':
                await typeText('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ? (Y/N)]', 'output', 6);
                addColored('------------------------------------', '#64ff82');
                const exitConfirmed = await waitForConfirmation();
                if (exitConfirmed) {
                    addColored('> Y', '#00FF41');
                    await showLoading(1200, "Завершение работы терминала");
                    await showLoading(800, "Отключение сетевой сессии");
                    addColored('> СОЕДИНЕНИЕ ПРЕРВАНО.', '#FF4444');
                    setTimeout(()=> location.href = 'index.html', 1200);
                } else {
                    addColored('> N', '#FF4444');
                    addColored('------------------------------------', '#64ff82');
                    await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 6);
                }
                break;
            default:
                addColored(`команда не найдена: ${cmdRaw}`, '#FF4444');
        }

        addInputLine();
    }

    // helpers to add colored text
    function addColored(text, color='#64ff82') {
        const d = document.createElement('div');
        d.className = 'output';
        d.style.color = color;
        d.textContent = text;
        terminal.appendChild(d);
        terminal.scrollTop = terminal.scrollHeight;
    }

    function progressBarText(p) {
        // simple textual bar for output
        const filled = Math.round((p/100) * 10);
        return '█'.repeat(filled) + '▒'.repeat(10-filled);
    }

    // show subject dossier minimal (can be extended)
    async function showSubjectDossier(id) {
        const dossiers = { '0X095': { name:'SUBJECT-095', status:'МЁРТВ', report:['Зафиксированы следы ФАНТОМА.'] } };
        const d = dossiers[id];
        if (!d) {
            addColored(`ОШИБКА: Досье для ${id} не найдено`, '#FF4444');
            return;
        }
        await typeText(`[ДОСЬЕ — ID: ${id}]`, 'output', 6);
        await typeText(`ИМЯ: ${d.name}`, 'output', 6);
        addColored(`СТАТУС: ${d.status}`, d.status === 'МЁРТВ' ? '#FF4444' : '#00FF41');
        addColored('------------------------------------', '#64ff82');
        await typeText('СИСТЕМНЫЙ ОТЧЁТ:', 'output', 6);
        d.report.forEach(line => addColored(`> ${line}`, '#FFFF00'));
    }

    // note opener
    async function openNote(id) {
        const notes = {
            'NOTE_001': { title: 'ВЫ ЕГО ЧУВСТВУЕТЕ?', author: 'Dr. Rehn', content:['Они называют это "ядром".','Иногда терминал отвечает сам.'] }
        };
        const n = notes[id];
        if (!n) { addColored(`ОШИБКА: Файл ${id} не найден`, '#FF4444'); return; }
        await typeText(`[${id} — "${n.title}"]`, 'output', 6);
        await typeText(`АВТОР: ${n.author}`, 'output', 6);
        addColored('------------------------------------', '#64ff82');
        n.content.forEach(line => addColored(`> ${line}`, '#CCCCCC'));
        addColored('------------------------------------', '#64ff82');
        await typeText('[ФАЙЛ ЗАКРЫТ]', 'output', 6);
    }

    // add input line UI
    function addInputLine() {
        const spacer = document.createElement('div');
        spacer.style.height = '12px';
        terminal.appendChild(spacer);
        const inputLine = document.createElement('div');
        inputLine.className = 'input-line';
        inputLine.innerHTML = '<span class="prompt">adam@secure:~$ </span><span class="cmd" id="currentCmd"></span><span class="cursor" id="cursor">_</span>';
        terminal.appendChild(inputLine);
        terminal.scrollTop = terminal.scrollHeight;
        // occasionally spawn phantom cursor if degraded
        if (degradation >= 60 && Math.random() < 0.25) spawnPhantomCursor();
    }

    function spawnPhantomCursor() {
        // creates second ghost cursor in a random position above
        const ghost = document.createElement('div');
        ghost.className = 'output';
        ghost.style.opacity = '0.12';
        ghost.style.color = 'rgba(255,255,255,0.9)';
        ghost.textContent = 'adam@secure:~$ _';
        terminal.appendChild(ghost);
        setTimeout(()=> ghost.remove(), 1200 + Math.random()*1200);
    }

    // Determine "syslog level" from session state
    function getSyslogLevel() {
        const minutes = (Date.now() - sessionStartTime) / (1000*60);
        if (commandCount >= 10 || minutes >= 3) return 3;
        if (commandCount >= 5 || minutes >= 1) return 2;
        return 1;
    }

    // stop audio utility
    function stopAllAudio() {
        [ambient, audio_reset, audio_reverse, audio_glich].forEach(a => {
            try { if (a && !a.paused) { a.pause(); a.currentTime = 0; } } catch(e) {}
        });
    }

    // Input handling
    document.addEventListener('keydown', (e) => {
        if (awaitingConfirmation) return; // confirmation handled separately
        const currentCmdEl = document.getElementById('currentCmd');
        if (!currentCmdEl) return;
        if (isTyping) return;
        if (e.key === 'Enter') {
            if (currentLine.trim()) {
                processCommand(currentLine);
                currentLine = '';
                currentCmdEl.textContent = '';
            }
        } else if (e.key === 'Backspace') {
            currentLine = currentLine.slice(0, -1);
            currentCmdEl.textContent = currentLine;
        } else if (e.key === 'ArrowUp') {
            if (historyIndex > 0) { historyIndex--; currentLine = commandHistory[historyIndex] || ''; currentCmdEl.textContent = currentLine; }
        } else if (e.key === 'ArrowDown') {
            if (historyIndex < commandHistory.length - 1) { historyIndex++; currentLine = commandHistory[historyIndex] || ''; currentCmdEl.textContent = currentLine; }
            else { historyIndex = commandHistory.length; currentLine = ''; currentCmdEl.textContent = ''; }
        } else if (e.key.length === 1) {
            currentLine += e.key;
            currentCmdEl.textContent = currentLine;
        }
    });

    // Periodic degradation increment (+1% per 30 sec active)
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            // count as active time
            increaseDegradation(0); // ensure visuals update
            // increment based on last tick
            const lastTick = parseInt(localStorage.getItem('vigil_last_tick') || '0',10);
            const now = Date.now();
            if (!lastTick || now - lastTick >= 30000) {
                // increment once per 30s
                setDegradation(degradation + 1, 'time');
                localStorage.setItem('vigil_last_tick', String(now));
            }
            updateAmbient();
        } else {
            updateAmbient();
        }
    }, 5000);

    // also update visual +/- every second
    setInterval(()=> {
        updateIndicator();
        applyVisualLevelClass();
    }, 900);

    // initial boot terminal text
    (async function initTerminal() {
        await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 6);
        await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', 'output', 6);
        await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 6);
        addInputLine();
        // apply initial visuals
        updateIndicator();
        applyVisualLevelClass();
        updateAmbient();
    })();

    // Protect from devtools open vibe (simple detection - non foolproof, atmospheric)
    let devtoolsOpen = false;
    setInterval(() => {
        const threshold = 160;
        if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
            if (!devtoolsOpen) {
                devtoolsOpen = true;
                // show a paranoid message
                showSystemLine('[ВНИМАНИЕ: A.D.A.M. не любит, когда на него смотрят.]', '#FF4444');
            }
        } else {
            devtoolsOpen = false;
        }
    }, 1000);
});
