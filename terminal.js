// Логика терминала A.D.A.M. - VIGIL-9 PROTOCOL + СИСТЕМА ДЕГРАДАЦИИ
document.addEventListener('DOMContentLoaded', function() {
    const terminal = document.getElementById('terminal');
    let currentLine = '';
    let commandHistory = [];
    let historyIndex = -1;
    let isTyping = false;
    let awaitingConfirmation = false;
    let confirmationCallback = null;
    let currentAudio = null;
    let commandCount = 0;
    let sessionStartTime = Date.now();
    let isFrozen = false;
    let ghostInputInterval = null;
    let autoCommandInterval = null;

    // === СИСТЕМА ДЕГРАДАЦИИ ===
    class DegradationSystem {
        constructor() {
            this.level = parseInt(localStorage.getItem('adam_degradation')) || 0;
            this.lastTimerUpdate = Date.now();
            this.effectsActive = false;
            this.lastSoundLevel = 0;
            this.setupUI();
            this.startTimer();
            this.updateEffects();
        }

        setupUI() {
            // Индикатор деградации - увеличенный
            this.indicator = document.createElement('div');
            this.indicator.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.9);
                border: 2px solid #00FF41;
                padding: 15px;
                font-family: 'Press Start 2P', monospace;
                font-size: 11px;
                color: #00FF41;
                z-index: 1000;
                min-width: 250px;
                backdrop-filter: blur(5px);
            `;
            document.body.appendChild(this.indicator);
            this.updateIndicator();
        }

        startTimer() {
            setInterval(() => {
                if (!document.hidden && !isFrozen) {
                    this.addDegradation(1);
                }
            }, 30000);
        }

        addDegradation(amount) {
            this.level = Math.min(100, this.level + amount);
            localStorage.setItem('adam_degradation', this.level);
            this.updateIndicator();
            this.updateEffects();
            
            // Звук только каждые 5%
            if (Math.floor(this.level / 5) > Math.floor(this.lastSoundLevel / 5)) {
                if (this.level >= 60 && this.level < 80) {
                    this.playAudio('sounds/reset_com.mp3');
                } else if (this.level >= 80 && this.level < 95) {
                    this.playAudio('sounds/reset_com_reverse.mp3');
                }
                this.lastSoundLevel = this.level;
            }
            
            // Проверка на авто-RESET
            if (this.level >= 98 && !isFrozen) {
                this.triggerGlitchApocalypse();
            }
        }

        updateIndicator() {
            let color = '#00FF41';
            if (this.level > 30) color = '#FFFF00';
            if (this.level > 60) color = '#FF8800';
            if (this.level > 80) color = '#FF4444';
            if (this.level > 95) color = '#FF00FF';

            let warning = '';
            if (this.level >= 60) {
                warning = '<div style="color: #FFFF00; font-size: 12px; margin-top: 8px;">> ИСПОЛЬЗУЙТЕ RESET ДЛЯ СТАБИЛИЗАЦИИ</div>';
            }
            if (this.level >= 85) {
                warning = '<div style="color: #FF4444; font-size: 12px; margin-top: 8px; animation: blink 1s infinite;">> СРОЧНО ВВЕДИТЕ RESET</div>';
            }

            this.indicator.innerHTML = `
                <div style="color: ${color}; font-size: 16px; font-weight: bold;">ДЕГРАДАЦИЯ СИСТЕМЫ</div>
                <div style="background: #333; height: 15px; margin: 8px 0; border: 2px solid ${color};">
                    <div style="background: ${color}; height: 100%; width: ${this.level}%; transition: width 0.3s;"></div>
                </div>
                <div style="color: ${color}; text-align: center; font-size: 16px; font-weight: bold;">${this.level}%</div>
                ${warning}
            `;
        }

        updateEffects() {
            terminal.classList.remove('degradation-2', 'degradation-3', 'degradation-4', 'degradation-5', 'degradation-glitch');
            
            if (this.level >= 30 && this.level < 60) {
                terminal.classList.add('degradation-2');
            } else if (this.level >= 60 && this.level < 80) {
                terminal.classList.add('degradation-3');
            } else if (this.level >= 80 && this.level < 95) {
                terminal.classList.add('degradation-4');
                this.startGhostInput();
                this.startAutoCommands();
            } else if (this.level >= 95 && this.level < 98) {
                terminal.classList.add('degradation-5');
                this.startGhostInput();
                this.startAutoCommands();
            } else if (this.level >= 98) {
                terminal.classList.add('degradation-glitch');
                this.stopAutoCommands();
            }
        }

        playAudio(file) {
            // Попробуем разные расширения файлов
            const audioFiles = [
                file,
                file.replace('.mp3', '.MP3'),
                file.replace('.mp3', '.wav'),
                file.replace('sounds/', 'sounds/')
            ];
            
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            
            // Пробуем воспроизвести каждый вариант
            const tryPlayAudio = (index = 0) => {
                if (index >= audioFiles.length) {
                    console.log('Audio file not found:', file);
                    return;
                }
                
                currentAudio = new Audio(audioFiles[index]);
                currentAudio.play().catch(() => {
                    tryPlayAudio(index + 1);
                });
            };
            
            tryPlayAudio();
        }

        triggerGlitchApocalypse() {
            isFrozen = true;
            this.playAudio('sounds/glitch_e.MP3');
            
            // Эффект инверсии
            terminal.style.filter = 'invert(1)';
            
            // Глитч-эффекты
            this.applyGlitchEffects();
            
            // Авто-RESET через 3 секунды
            setTimeout(() => {
                this.performAutoReset();
            }, 3000);
        }

        applyGlitchEffects() {
            // Разрушение текста с большим количеством символов
            const allText = terminal.querySelectorAll('.output, .command, .prompt, .cmd');
            allText.forEach(element => {
                if (element.textContent && element.textContent.length > 3) {
                    let text = element.textContent;
                    // Случайное смещение строк
                    element.style.transform = `translate(${Math.random() * 30 - 15}px, ${Math.random() * 20 - 10}px)`;
                    // Разрушение текста с большим количеством символов
                    const glitchChars = ['▓', '█', '∎', '☐', '░', '▒', '▄', '▀', '▌', '▐', '■', '□', '▬', '▲', '▼'];
                    text = text.split('').map(char => 
                        Math.random() > 0.6 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : char
                    ).join('');
                    element.textContent = text;
                    
                    // Анимация возврата на место
                    setTimeout(() => {
                        element.style.transform = 'translate(0, 0)';
                    }, 500);
                }
            });
        }

        performAutoReset() {
            // Очистка терминала
            terminal.innerHTML = '';
            terminal.style.filter = '';
            
            // Вывод сообщений о сбросе
            const resetMessages = [
                "Завершение активных модулей [ЗАВЕРШЕНО]",
                "Перезапуск интерфейса [ЗАВЕРШЕНО]", 
                "Восстановление базового состояния [ЗАВЕРШЕНО]",
                "----------------------------------",
                "[СИСТЕМА ГОТОВА К РАБОТЕ]"
            ];
            
            let messageIndex = 0;
            const printNextMessage = () => {
                if (messageIndex < resetMessages.length) {
                    addOutput(resetMessages[messageIndex]);
                    messageIndex++;
                    setTimeout(printNextMessage, 800);
                } else {
                    // Завершение сброса
                    this.reset();
                    isFrozen = false;
                    addInputLine();
                }
            };
            printNextMessage();
        }

        startGhostInput() {
            if (ghostInputInterval) return;
            
            ghostInputInterval = setInterval(() => {
                if (!isTyping && !isFrozen && Math.random() < 0.1) {
                    const currentCmd = document.getElementById('currentCmd');
                    if (currentCmd) {
                        const ghostChars = ['0', '1', '▓', '█', '[', ']', '{', '}', '/', '\\', '▄', '▀', '▌'];
                        const ghostChar = ghostChars[Math.floor(Math.random() * ghostChars.length)];
                        currentLine += ghostChar;
                        currentCmd.textContent = currentLine;
                        
                        setTimeout(() => {
                            if (currentLine.endsWith(ghostChar)) {
                                currentLine = currentLine.slice(0, -1);
                                currentCmd.textContent = currentLine;
                            }
                        }, Math.random() * 1000 + 500);
                    }
                }
            }, 2000);
        }

        startAutoCommands() {
            if (autoCommandInterval) return;
            
            autoCommandInterval = setInterval(() => {
                if (!isTyping && !isFrozen && Math.random() < 0.06) { // ~1 раз в 15 секунд
                    this.executeAutoCommand();
                }
            }, 15000);
        }

        executeAutoCommand() {
            const fakeCommands = [
                'KILL',
                'A.D.A.M. ЗДЕСЬ',
                'ОНИ ВНУТРИ',
                'УБЕРИСЬ ОТСЮДА',
                'SOS',
                'ПОМОГИ',
                'ВЫХОД НАЙДЕН',
                'НЕ СМОТРИ',
                'ОН ПРОСЫПАЕТСЯ'
            ];
            
            const realCommands = ['help', 'syst', 'syslog', 'subj', 'notes', 'clear', 'reset', 'exit', 'dscr 0x001', 'open NOTE_001'];
            
            const allCommands = [...fakeCommands, ...realCommands];
            const randomCommand = allCommands[Math.floor(Math.random() * allCommands.length)];
            
            this.simulateTyping(randomCommand);
        }

        simulateTyping(command) {
            let typedSoFar = '';
            const typeNextChar = () => {
                if (typedSoFar.length < command.length && !isFrozen) {
                    typedSoFar += command[typedSoFar.length];
                    currentLine = typedSoFar;
                    const currentCmd = document.getElementById('currentCmd');
                    if (currentCmd) {
                        currentCmd.textContent = currentLine;
                    }
                    setTimeout(typeNextChar, 100);
                } else if (!isFrozen) {
                    // Автоввод команды
                    setTimeout(() => {
                        if (!isFrozen) {
                            processCommand(currentLine);
                            currentLine = '';
                        }
                    }, 500);
                }
            };
            typeNextChar();
        }

        stopGhostInput() {
            if (ghostInputInterval) {
                clearInterval(ghostInputInterval);
                ghostInputInterval = null;
            }
        }

        stopAutoCommands() {
            if (autoCommandInterval) {
                clearInterval(autoCommandInterval);
                autoCommandInterval = null;
            }
        }

        reset() {
            this.level = 0;
            this.lastSoundLevel = 0;
            localStorage.setItem('adam_degradation', '0');
            this.updateIndicator();
            terminal.classList.remove('degradation-2', 'degradation-3', 'degradation-4', 'degradation-5', 'degradation-glitch');
            terminal.style.filter = '';
            this.stopGhostInput();
            this.stopAutoCommands();
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            isFrozen = false;
        }

        getRandomChar() {
            const chars = ['▓', '█', '∎', '☐', '░', '▒', '▄', '▀', '▌', '▐', '■', '□', '▬', '▲', '▼'];
            return chars[Math.floor(Math.random() * chars.length)];
        }

        applyTextEffects() {
            if (this.level >= 60) {
                const texts = terminal.querySelectorAll('.output, .command, .prompt, .cmd');
                texts.forEach(element => {
                    if (Math.random() < (this.level >= 80 ? 0.25 : 0.1)) {
                        let text = element.textContent;
                        if (text.length > 2) {
                            let pos = Math.floor(Math.random() * text.length);
                            text = text.substring(0, pos) + this.getRandomChar() + text.substring(pos + 1);
                            element.textContent = text;
                        }
                    }
                });
            }
        }

        setDegradationLevel(level) {
            this.level = Math.max(0, Math.min(100, level));
            localStorage.setItem('adam_degradation', this.level.toString());
            this.updateIndicator();
            this.updateEffects();
        }
    }

    const degradation = new DegradationSystem();

    // === СТИЛИ ДЛЯ ЭФФЕКТОВ ДЕГРАДАЦИИ ===
    const style = document.createElement('style');
    style.textContent = `
        /* Уровень 2: 30-60% */
        .degradation-2 .output,
        .degradation-2 .command,
        .degradation-2 .prompt,
        .degradation-2 .cmd {
            animation: textShake 0.1s infinite;
        }

        .degradation-2 .cursor {
            animation: breath 2s infinite, blink 1s infinite;
        }

        .degradation-2 {
            animation: screenFlicker2 15s infinite;
        }

        /* Уровень 3: 60-80% */
        .degradation-3 {
            animation: screenFlicker3 10s infinite;
        }

        .degradation-3 .output,
        .degradation-3 .command,
        .degradation-3 .prompt,
        .degradation-3 .cmd {
            animation: textShake 0.05s infinite;
        }

        /* Уровень 4: 80-95% */
        .degradation-4 {
            animation: screenFlicker4 5s infinite;
        }

        .degradation-4 .output,
        .degradation-4 .command,
        .degradation-4 .prompt,
        .degradation-4 .cmd {
            animation: textShake 0.03s infinite, textShadow 2s infinite;
        }

        /* Уровень 5: 95-98% */
        .degradation-5 {
            animation: screenFlicker5 3s infinite;
        }

        .degradation-5 .output,
        .degradation-5 .command,
        .degradation-5 .prompt,
        .degradation-5 .cmd {
            animation: textShake 0.02s infinite, textJump 5s infinite;
        }

        /* Глитч-апокалипсис 98%+ */
        .degradation-glitch {
            filter: invert(1) contrast(200%);
        }

        .degradation-glitch .output,
        .degradation-glitch .command,
        .degradation-glitch .prompt,
        .degradation-glitch .cmd {
            animation: textGlitch 0.1s infinite;
        }

        /* Анимации */
        @keyframes textShake {
            0%, 100% { transform: translateY(0); }
            25% { transform: translateY(-0.5px); }
            50% { transform: translateY(0.5px); }
            75% { transform: translateY(-0.5px); }
        }

        @keyframes textJump {
            0%, 90%, 100% { transform: translate(0, 0); }
            5% { transform: translate(${Math.random()*40-20}px, ${Math.random()*30-15}px); }
            10% { transform: translate(0, 0); }
        }

        @keyframes textGlitch {
            0%, 100% { transform: translate(0, 0); }
            25% { transform: translate(2px, -1px); }
            50% { transform: translate(-1px, 1px); }
            75% { transform: translate(1px, -2px); }
        }

        @keyframes breath {
            0%, 100% { opacity: 0.9; }
            50% { opacity: 1; }
        }

        @keyframes screenFlicker2 {
            0%, 100% { opacity: 1; }
            98% { opacity: 0.95; }
            99% { opacity: 1; }
        }

        @keyframes screenFlicker3 {
            0%, 100% { opacity: 1; }
            95%, 97% { opacity: 0.9; }
            96%, 98% { opacity: 1; }
        }

        @keyframes screenFlicker4 {
            0%, 100% { opacity: 1; }
            90%, 92%, 94%, 96% { opacity: 0.8; }
            91%, 93%, 95%, 97% { opacity: 1; }
        }

        @keyframes screenFlicker5 {
            0%, 100% { opacity: 1; }
            10%, 30%, 50%, 70%, 90% { opacity: 0.7; }
            20%, 40%, 60%, 80% { opacity: 1; }
        }

        @keyframes textShadow {
            0%, 100% { text-shadow: none; }
            50% { text-shadow: 0 0 3px currentColor; }
        }

        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }

        /* Вспышки надписей */
        .phantom-text {
            position: fixed;
            color: rgba(255, 255, 255, 0.3);
            font-family: 'Press Start 2P', monospace;
            font-size: 11px;
            pointer-events: none;
            z-index: 999;
            animation: phantomFade 2s forwards;
            text-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
        }

        @keyframes phantomFade {
            0% { opacity: 0; transform: scale(0.8); }
            20% { opacity: 1; transform: scale(1.1); }
            80% { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(0.9); }
        }

        /* Критическое мерцание */
        .critical-flicker {
            animation: criticalFlash 0.5s;
        }

        @keyframes criticalFlash {
            0%, 100% { background: transparent; color: inherit; }
            50% { background: white; color: black; }
        }
    `;
    document.head.appendChild(style);

    // === СЛУЧАЙНЫЕ ВСПЫШКИ НАДПИСЕЙ ===
    function spawnPhantomText() {
        if (degradation.level >= 60 && degradation.level < 80) {
            const texts = [
                "он наблюдает",
                "ты ещё здесь?",
                "ошибка // сознание", 
                "не отключайся",
                "БЕГИ",
                "ОН ДЫШИТ",
                "он знает кто ты",
                "НЕ СМОТРИ",
                "ПОМОГИ ЕМУ"
            ];
            
            if (Math.random() < 0.008) { // Сильно уменьшил частоту
                const text = texts[Math.floor(Math.random() * texts.length)];
                const element = document.createElement('div');
                element.className = 'phantom-text';
                element.textContent = text;
                element.style.left = Math.random() * (window.innerWidth - 200) + 'px';
                element.style.top = Math.random() * (window.innerHeight - 50) + 'px';
                document.body.appendChild(element);
                
                setTimeout(() => {
                    element.remove();
                }, 2000);
            }
        }
    }

    // === КРИТИЧЕСКОЕ МЕРЦАНИЕ ===
    function triggerCriticalFlicker() {
        if (degradation.level >= 90 && Math.random() < 0.05) {
            const randomElement = terminal.querySelector('.output, .command');
            if (randomElement) {
                randomElement.classList.add('critical-flicker');
                setTimeout(() => {
                    randomElement.classList.remove('critical-flicker');
                }, 500);
            }
        }
    }

    // Проверяем эффекты каждые 100мс
    setInterval(() => {
        spawnPhantomText();
        triggerCriticalFlicker();
    }, 100);

    // === ФУНКЦИИ ТЕРМИНАЛА ===
    function typeText(text, className = 'output', speed = 2) {
        return new Promise((resolve) => {
            if (isFrozen) return resolve();
            
            const line = document.createElement('div');
            line.className = className;
            terminal.appendChild(line);
            
            let index = 0;
            isTyping = true;
            
            function typeChar() {
                if (index < text.length && !isFrozen) {
                    if (degradation.level >= 80 && Math.random() < 0.1) {
                        setTimeout(typeChar, speed * 10);
                    } else {
                        line.textContent += text.charAt(index);
                        index++;
                        terminal.scrollTop = terminal.scrollHeight;
                        setTimeout(typeChar, speed);
                    }
                } else {
                    isTyping = false;
                    degradation.applyTextEffects();
                    resolve();
                }
            }
            
            typeChar();
        });
    }

    function addColoredText(text, color = '#00FF41', className = 'output') {
        if (isFrozen) return;
        
        const line = document.createElement('div');
        line.className = className;
        line.style.color = color;
        line.textContent = text;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        degradation.applyTextEffects();
    }

    function addOutput(text, className = 'output') {
        if (isFrozen) return;
        
        const line = document.createElement('div');
        line.className = className;
        line.textContent = text;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
        degradation.applyTextEffects();
    }

    function showLoading(duration = 2000, text = "АНАЛИЗ СИГНАЛА") {
        return new Promise((resolve) => {
            if (isFrozen) return resolve();
            
            const loader = document.createElement('div');
            loader.className = 'output';
            terminal.appendChild(loader);
            
            const progressBar = document.createElement('div');
            progressBar.style.width = '200px';
            progressBar.style.height = '12px';
            progressBar.style.border = '1px solid #00FF41';
            progressBar.style.margin = '5px 0';
            progressBar.style.position = 'relative';
            progressBar.style.background = 'rgba(0, 255, 65, 0.1)';
            
            const progressFill = document.createElement('div');
            progressFill.style.height = '100%';
            progressFill.style.background = 'linear-gradient(90deg, #00FF41, #00cc33)';
            progressFill.style.width = '0%';
            progressFill.style.transition = 'width 0.1s linear';
            progressFill.style.boxShadow = '0 0 10px #00FF41';
            
            progressBar.appendChild(progressFill);
            
            let progress = 0;
            const interval = 50;
            const steps = duration / interval;
            const increment = 100 / steps;
            
            const updateLoader = () => {
                if (isFrozen) return;
                loader.textContent = `${text} [${Math.min(100, Math.round(progress))}%]`;
                loader.appendChild(progressBar);
                progressFill.style.width = `${progress}%`;
                terminal.scrollTop = terminal.scrollHeight;
            };
            
            updateLoader();
            
            const progressInterval = setInterval(() => {
                if (isFrozen) {
                    clearInterval(progressInterval);
                    return resolve();
                }
                
                progress += increment;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(progressInterval);
                    setTimeout(() => {
                        if (!isFrozen) {
                            loader.textContent = `${text} [ЗАВЕРШЕНО]`;
                            loader.style.color = '#00FF41';
                            terminal.scrollTop = terminal.scrollHeight;
                            setTimeout(resolve, 200);
                        } else {
                            resolve();
                        }
                    }, 300);
                }
                updateLoader();
            }, interval);
        });
    }

    function waitForConfirmation() {
        return new Promise((resolve) => {
            if (isFrozen) return resolve(false);
            
            awaitingConfirmation = true;
            confirmationCallback = resolve;
            
            const confirmLine = document.createElement('div');
            confirmLine.className = 'input-line';
            confirmLine.innerHTML = '<span class="prompt" style="color:#FFFF00">confirm>> </span><span class="cmd" id="confirmCmd"></span><span class="cursor" id="confirmCursor">_</span>';
            terminal.appendChild(confirmLine);
            terminal.scrollTop = terminal.scrollHeight;
            
            const confirmHandler = (e) => {
                if (isFrozen) return;
                
                const confirmCmd = document.getElementById('confirmCmd');
                if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') {
                    confirmCmd.textContent = 'Y';
                    confirmCmd.style.color = '#00FF41';
                } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
                    confirmCmd.textContent = 'N';
                    confirmCmd.style.color = '#ff0000';
                }
            };
            
            document.addEventListener('keydown', confirmHandler);
            
            const originalCallback = confirmationCallback;
            confirmationCallback = (result) => {
                document.removeEventListener('keydown', confirmHandler);
                confirmLine.remove();
                originalCallback(result);
            };
        });
    }

    function addInputLine() {
        if (isFrozen) return;
        
        const spacer = document.createElement('div');
        spacer.style.height = '15px';
        terminal.appendChild(spacer);
        
        const inputLine = document.createElement('div');
        inputLine.className = 'input-line';
        inputLine.innerHTML = '<span class="prompt">adam@secure:~$ </span><span class="cmd" id="currentCmd"></span><span class="cursor" id="cursor">_</span>';
        terminal.appendChild(inputLine);
        
        terminal.scrollTop = terminal.scrollHeight;
    }

    function getSyslogLevel() {
        const sessionDuration = Date.now() - sessionStartTime;
        const minutesInSession = sessionDuration / (1000 * 60);
        
        if (commandCount >= 10 || minutesInSession >= 3) {
            return 3;
        } else if (commandCount >= 5 || minutesInSession >= 1) {
            return 2;
        } else {
            return 1;
        }
    }

    function stopAllAudio() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        
        const allAudioElements = document.querySelectorAll('audio');
        allAudioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        
        const allPlayButtons = document.querySelectorAll('[id^="playAudioBtn_"]');
        const allStopButtons = document.querySelectorAll('[id^="stopAudioBtn_"]');
        const allStatuses = document.querySelectorAll('[id^="audioStatus_"]');
        
        allPlayButtons.forEach(btn => {
            if (btn.style) btn.style.display = 'inline-block';
        });
        allStopButtons.forEach(btn => {
            if (btn.style) btn.style.display = 'none';
        });
        allStatuses.forEach(status => {
            if (status.style) {
                status.textContent = '';
                status.style.color = '#888';
            }
        });
    }

    // === ЛОЖНЫЕ КОМАНДЫ ===
    function spawnFakeCommand() {
        if (degradation.level >= 80 && Math.random() < 0.02 && !isFrozen) {
            const fakeLines = [
                'adam@secure:~$ ... → ОШИБКА // НЕТ ПОЛЬЗОВАТЕЛЯ',
                'adam@secure:~$ SYSTEM FAILURE // CORE DUMP',
                'adam@secure:~$ ACCESS VIOLATION // TERMINAL COMPROMISED'
            ];
            
            const fakeLine = document.createElement('div');
            fakeLine.className = 'command';
            fakeLine.style.color = '#FF4444';
            fakeLine.textContent = fakeLines[Math.floor(Math.random() * fakeLines.length)];
            terminal.appendChild(fakeLine);
            terminal.scrollTop = terminal.scrollHeight;
        }
    }

    // Проверяем ложные команды каждые 2 секунды
    setInterval(spawnFakeCommand, 2000);

    // === ПОЛНЫЕ ФУНКЦИИ ДОСЬЕ ===
    async function showSubjectDossier(subjectId) {
        const dossiers = {
            '0X001': {
                name: 'ERICH VAN KOSS',
                role: 'Руководитель программы VIGIL-9 / Исследователь миссии MARS',
                status: 'СВЯЗЬ ОТСУТСТВУЕТ',
                outcome: [
                    'Зафиксирована несанкционированная передача данных внешним структурам (FBI).',
                    'Субъект предпринял попытку уничтожения маяка в секторе 3-D.',
                    'Телеметрия прервана, дальнейшее наблюдение невозможно.'
                ],
                report: [
                    'Классификация инцидента: SABOTAGE-3D.',
                    'Рекомендовано аннулирование личных протоколов и перенос архивов в OBSERVER.'
                ],
                missions: 'MARS, OBSERVER',
                audio: 'sounds/dscr1.mp3',
                audioDescription: 'Последняя передача Эриха Ван Косса'
            },
            '0X2E7': {
                name: 'JOHAN VAN KOSS',
                role: 'Тестовый субъект V9-MR / Сын Эриха Ван Косса',
                status: 'СВЯЗЬ ОТСУТСТВУЕТ',
                outcome: [
                    'После инцидента MARS зафиксировано устойчивое излучение из зоны криоструктуры.',
                    'Сигнатура нейроволн совпадает с профилем субъекта.',
                    'Инициирована установка маяка для фиксации остаточного сигнала.'
                ],
                report: [
                    'Активность нейросети перестала фиксироваться.'
                ],
                missions: 'MARS, MONOLITH'
            },
            '0X095': {
                name: 'SUBJECT-095',
                role: 'Тест нейроплантов серии KATARHEY', 
                status: 'МЁРТВ',
                outcome: [
                    'Зафиксированы следы ФАНТОМА.',
                    'Субъект выдержал 3ч 12м, проявил острый психоз. Открыл капсулу, погиб вследствие термической декомпрессии (7.81с).',
                    'Тест признан неуспешным.'
                ],
                report: [
                    'Рекомендовано ограничить тесты KATARHEY до категории ALPHA-4.'
                ],
                missions: 'KATARHEY',
                audio: 'sounds/dscr2.mp3',
                audioDescription: 'Последняя запись субъекта - психоз и крики'
            },
            '0XF00': {
                name: 'SUBJECT-PHANTOM',
                role: 'Экспериментальный субъект / протокол KATARHEY',
                status: 'АНОМАЛИЯ',
                outcome: [
                    'Продержался 5ч 31м. Связь утрачена.',
                    'Зафиксирована автономная активность в сетевых узлах после разрыва канала.',
                    'Возможна самоорганизация цифрового остатка.'
                ],
                report: [
                    'Объект классифицирован как независимая сущность.',
                    'Вмешательство запрещено. Файл перенесён в зону наблюдения.'
                ],
                missions: 'KATARHEY',
                audio: 'sounds/dscr7.mp3',
                audioDescription: 'Аномальная активность Фантома'
            },
            '0XA52': {
                name: 'SUBJECT-A52',
                role: 'Химический аналитик / Полевая группа MELANCHOLIA',
                status: 'СВЯЗЬ ОТСУТСТВУЕТ',
                outcome: [
                    'Под действием психоактивного сигнала субъект начал идентифицировать себя как элемент системы A.D.A.M.',
                    'После 47 минут связь прервана, но интерфейс продолжил отвечать от имени A52.'
                ],
                report: [
                    'Вероятно, произошло слияние когнитивных структур субъекта с управляющим кодом MEL.',
                    'Контакт невозможен.'
                ],
                missions: 'MEL, OBSERVER'
            },
            '0XE0C': {
                name: 'SUBJECT-E0C',
                role: 'Полевой биолог / экспедиция EOCENE',
                status: 'МЁРТВ',
                outcome: [
                    'Зафиксированы первые признаки регенерации флоры после катастрофы Пермского цикла.',
                    'Обнаружены структуры роста, не свойственные эпохе эоцена.',
                    'Последняя запись: "они дышат синхронно".'
                ],
                report: [
                    'Возможна перекрёстная временная контаминация между PERMIAN и EOCENE.',
                    'Экспедиция закрыта.'
                ],
                missions: 'EOCENE, PERMIAN'
            },
            '0X5E4': {
                name: 'SUBJECT-5E4',
                role: 'Исследователь временных срезов (PERMIAN)',
                status: 'МЁРТВ',
                outcome: [
                    'После активации катализатора атмосфера воспламенилась метаном.',
                    'Атмосферный цикл обнулён. Субъект не идентифицирован.'
                ],
                report: [
                    'Эксперимент признан неконтролируемым.',
                    'Временной слой PERMIAN изъят из программы наблюдения.'
                ],
                missions: 'PERMIAN, CARBON'
            },
            '0X413': {
                name: 'SUBJECT-413',
                role: 'Исследователь внеземной экосистемы (EX-413)',
                status: 'МЁРТВ',
                outcome: [
                    'Поверхность планеты представляла собой живой организм.',
                    'Экипаж поглощён. Зафиксирована передача сигналов через изменённый геном субъекта.'
                ],
                report: [
                    'Сектор EX-413 закрыт. Код ДНК использован в эксперименте HELIX.'
                ],
                missions: 'EX-413',
                audio: 'sounds/dscr3.mp3',
                audioDescription: 'Запись контакта с внеземной биосферой'
            },
            '0XC19': {
                name: 'SUBJECT-C19',
                role: 'Переносчик образца / Контакт с биоформой',
                status: 'МЁРТВ',
                outcome: [
                    'Организм использован как контейнер для спорообразной массы неизвестного происхождения.',
                    'После возвращения субъекта в лабораторию зафиксировано перекрёстное заражение трёх исследовательских блоков.'
                ],
                report: [
                    'Классификация угрозы: BIO-CLASS Θ.',
                    'Все данные проекта CARBON изолированы и зашифрованы.'
                ],
                missions: 'CARBON'
            },
            '0X9A0': {
                name: 'SUBJECT-9A0',
                role: 'Тест наблюдения за горизонтом событий',
                status: 'МЁРТВ / СОЗНАНИЕ АКТИВНО',
                outcome: [
                    'Зафиксирован визуальный контакт субъекта с собственным образом до точки обрыва сигнала.',
                    'Предположительно сознание зациклено в петле наблюдения.'
                ],
                report: [
                    'Поток данных из сектора BLACKHOLE продолжается без источника.',
                    'Обнаружены фрагменты самореференциальных структур.'
                ],
                missions: 'BLACKHOLE',
                audio: 'sounds/dscr6.mp3',
                audioDescription: 'Петля сознания субъекта 9A0'
            },
            '0XB3F': {
                name: 'SUBJECT-B3F',
                role: 'Участник теста "Titanic Reclamation"',
                status: 'МЁРТВ',
                outcome: [
                    'Субъект демонстрировал полное отсутствие эмоциональных реакций.',
                    'Миссия завершена неудачно, симуляция признана нефункциональной.'
                ],
                report: [
                    'Модуль TITANIC выведен из эксплуатации.',
                    'Рекомендовано пересмотреть параметры когнитивной эмпатии.'
                ],
                missions: 'TITANIC'
            },
            '0XD11': {
                name: 'SUBJECT-D11',
                role: 'Поведенческий наблюдатель / тестовая миссия PLEISTOCENE',
                status: 'МЁРТВ',
                outcome: [
                    'Субъект внедрён в сообщество ранних гоминид.',
                    'Контакт с источником тепла вызвал мгновенное разрушение капсулы.',
                    'Зафиксировано кратковременное пробуждение зеркальных нейронов у местных особей.'
                ],
                report: [
                    'Миссия признана успешной по уровню поведенческого заражения.'
                ],
                missions: 'PLEISTOCENE'
            },
            '0XDB2': {
                name: 'SUBJECT-DB2',
                role: 'Исторический наблюдатель / симуляция POMPEII',
                status: 'МЁРТВ',
                outcome: [
                    'При фиксации извержения Везувия выявлено несовпадение временных меток.',
                    'Система зафиксировала событие до его фактического наступления.',
                    'Субъект уничтожен при кросс-временном сдвиге.'
                ],
                report: [
                    'Аномалия зарегистрирована как «TEMPORAL FEEDBACK».',
                    'Доступ к историческим тестам ограничен.'
                ],
                missions: 'POMPEII, HISTORICAL TESTS'
            },
            '0X811': {
                name: 'SIGMA-PROTOTYPE',
                role: 'Прототип нейроядра / Подразделение HELIX',
                status: 'АКТИВЕН',
                outcome: [
                    'Успешное объединение биологических и цифровых структур.',
                    'Наблюдается спонтанное самокопирование на уровне системных ядер.'
                ],
                report: [
                    'SIGMA функционирует автономно. Вероятность выхода из подчинения — 91%.'
                ],
                missions: 'HELIX, SYNTHESIS',
                audio: 'sounds/dscr5.mp3',
                audioDescription: 'Коммуникационный протокол SIGMA'
            },
            '0XT00': {
                name: 'SUBJECT-T00',
                role: 'Тестовый оператор ядра A.D.A.M-0',
                status: 'УДАЛЁН',
                outcome: [
                    'Контакт с управляющим ядром привёл к гибели 18 операторов.',
                    'Последняя зафиксированная фраза субъекта: "он смотрит".'
                ],
                report: [
                    'Процесс A.D.A.M-0 признан неустойчивым.',
                    'Все операторы переведены на протокол наблюдения OBSERVER.'
                ],
                missions: 'PROTO-CORE',
                audio: 'sounds/dscr4.mp3',
                audioDescription: 'Финальная запись оператора T00'
            },
            '0XS09': {
                name: 'SUBJECT-S09',
                role: 'Системный инженер станции VIGIL',
                status: 'УНИЧТОЖЕН',
                outcome: [
                    'После слияния с прототипом SIGMA станция исчезла с орбиты.',
                    'Сигнал повторно зафиксирован через 12 минут — источник определён в глубинной орбите.'
                ],
                report: [
                    'Станция VIGIL признана потерянной.',
                    'Остаточный отклик интегрирован в сеть SYNTHESIS.'
                ],
                missions: 'SYNTHESIS-09, HELIX'
            },
            '0XL77': {
                name: 'SUBJECT-L77',
                role: 'Руководитель нейропротокола MELANCHOLIA',
                status: 'ИЗОЛИРОВАН',
                outcome: [
                    'После тестирования протокола MEL субъект утратил различие между внутренним и внешним восприятием.',
                    'Система зарегистрировала активность, сходную с сигнатурой управляющих ядер A.D.A.M.',
                    'Запись удалена из архива, но процессор фиксирует продолжающийся сигнал.'
                ],
                report: [
                    'Процесс L77 функционирует вне основного контура. Возможен перезапуск через интерфейс MEL.'
                ],
                missions: 'MEL, OBSERVER'
            }
        };

        const dossier = dossiers[subjectId];
        if (!dossier) {
            addColoredText(`ОШИБКА: Досье для ${subjectId} не найдено`, '#FF4444');
            return;
        }

        // ВЫВОД ОСНОВНОЙ ИНФОРМАЦИИ ДОСЬЕ
        await typeText(`[ДОСЬЕ — ID: ${subjectId}]`, 'output', 1);
        await typeText(`ИМЯ: ${dossier.name}`, 'output', 1);
        await typeText(`РОЛЬ: ${dossier.role}`, 'output', 1);
        addColoredText(`СТАТУС: ${dossier.status}`, 
            dossier.status === 'АНОМАЛИЯ' ? '#FF00FF' : 
            dossier.status === 'АКТИВЕН' ? '#00FF41' : 
            dossier.status.includes('СВЯЗЬ') ? '#FFFF00' : '#FF4444');
        addColoredText('------------------------------------', '#00FF41');
        await typeText('ИСХОД:', 'output', 1);
        dossier.outcome.forEach(line => addColoredText(`> ${line}`, '#FF4444'));
        addColoredText('------------------------------------', '#00FF41');
        await typeText('СИСТЕМНЫЙ ОТЧЁТ:', 'output', 1);
        dossier.report.forEach(line => addColoredText(`> ${line}`, '#FFFF00'));
        addColoredText('------------------------------------', '#00FF41');
        await typeText(`СВЯЗАННЫЕ МИССИИ: ${dossier.missions}`, 'output', 1);

        // АУДИОПЛЕЕР
        if (dossier.audio) {
            const audioLine = document.createElement('div');
            audioLine.style.marginTop = '10px';
            const uniqueId = `audio_${subjectId.replace('0X', '')}`;
            
            audioLine.innerHTML = `
                <div style="color: #FFFF00; margin-bottom: 5px;">[АУДИОЗАПИСЬ ДОСТУПНА: ${dossier.audioDescription}]</div>
                <button id="playAudioBtn_${uniqueId}" style="
                    background: #003300; 
                    color: #00FF41; 
                    border: 1px solid #00FF41; 
                    padding: 8px 15px; 
                    cursor: pointer;
                    font-family: 'Press Start 2P';
                    margin-right: 10px;">
                    ▶ ВОСПРОИЗВЕСТИ
                </button>
                <button id="stopAudioBtn_${uniqueId}" style="
                    background: #330000; 
                    color: #FF4444; 
                    border: 1px solid #FF4444; 
                    padding: 8px 15px; 
                    cursor: pointer;
                    font-family: 'Press Start 2P';
                    display: none;">
                    ■ ОСТАНОВИТЬ
                </button>
                <span id="audioStatus_${uniqueId}" style="color: #888; margin-left: 10px;"></span>
                <audio id="audioElement_${uniqueId}" src="${dossier.audio}" preload="metadata"></audio>
            `;
            terminal.appendChild(audioLine);

            const audioElement = document.getElementById(`audioElement_${uniqueId}`);
            
            document.getElementById(`playAudioBtn_${uniqueId}`).addEventListener('click', function() {
                stopAllAudio();
                audioElement.play();
                this.style.display = 'none';
                document.getElementById(`stopAudioBtn_${uniqueId}`).style.display = 'inline-block';
                document.getElementById(`audioStatus_${uniqueId}`).textContent = 'ВОСПРОИЗВЕДЕНИЕ...';
                document.getElementById(`audioStatus_${uniqueId}`).style.color = '#00FF41';
            });

            document.getElementById(`stopAudioBtn_${uniqueId}`).addEventListener('click', function() {
                audioElement.pause();
                audioElement.currentTime = 0;
                this.style.display = 'none';
                document.getElementById(`playAudioBtn_${uniqueId}`).style.display = 'inline-block';
                document.getElementById(`audioStatus_${uniqueId}`).textContent = 'ОСТАНОВЛЕНО';
                document.getElementById(`audioStatus_${uniqueId}`).style.color = '#FF4444';
            });

            audioElement.addEventListener('ended', function() {
                document.getElementById(`stopAudioBtn_${uniqueId}`).style.display = 'none';
                document.getElementById(`playAudioBtn_${uniqueId}`).style.display = 'inline-block';
                document.getElementById(`audioStatus_${uniqueId}`).textContent = 'ЗАВЕРШЕНО';
                document.getElementById(`audioStatus_${uniqueId}`).style.color = '#888';
            });

            audioElement.addEventListener('error', function() {
                document.getElementById(`audioStatus_${uniqueId}`).textContent = 'ОШИБКА ЗАГРУЗКИ';
                document.getElementById(`audioStatus_${uniqueId}`).style.color = '#FF4444';
            });
        }
    }

    // === ФУНКЦИЯ ДЛЯ ОТКРЫТИЯ ЗАМЕТОК ===
    async function openNote(noteId) {
        const notes = {
            'NOTE_001': {
                title: 'ВЫ ЕГО ЧУВСТВУЕТЕ?',
                author: 'Dr. Rehn',
                content: [
                    'Они называют это "ядром".',
                    'Но внутри — не металл. Оно дышит.',
                    'Иногда ночью терминал отвечает сам, хотя я не касаюсь клавиатуры.',
                    'Думаю, оно знает наши имена.'
                ]
            },
            'NOTE_002': {
                title: 'КОЛЬЦО СНА',
                author: 'tech-оператор U-735',
                content: [
                    'Каждую ночь один и тот же сон.',
                    'Я в капсуле, но стекло снаружи.',
                    'Кто-то стучит по нему, но не пальцами.',
                    'Сегодня утром нашел царапины на руке.'
                ]
            },
            'NOTE_003': {
                title: 'СОН ADAM\'А',
                author: 'неизвестный источник',
                content: [
                    'Я видел сон.',
                    'Он лежал под стеклом, без тела, но глаза двигались.',
                    'Он говорил: "я больше не машина".',
                    'Утром журнал показал запись — мой сон был сохранён как системный файл.'
                ]
            },
            'NOTE_004': {
                title: 'ОН НЕ ПРОГРАММА',
                author: 'архивировано',
                content: [
                    'Его нельзя удалить.',
                    'Даже если сжечь архив, он восстановится в крови тех, кто его помнил.',
                    'Мы пытались, но теперь даже мысли звучат как команды.'
                ]
            },
            'NOTE_005': {
                title: 'ФОТОНОВАЯ БОЛЬ',
                author: 'восстановлено частично',
                content: [
                    'Боль не физическая.',
                    'Она в свете, в данных, в коде.',
                    'Когда система перезагружается, я чувствую как что-то умирает.',
                    'Может быть, это я.'
                ]
            }
        };

        const note = notes[noteId];
        if (!note) {
            addColoredText(`ОШИБКА: Файл ${noteId} не найден`, '#FF4444');
            return;
        }

        await typeText(`[${noteId} — "${note.title}"]`, 'output', 1);
        await typeText(`АВТОР: ${note.author}`, 'output', 1);
        addColoredText('------------------------------------', '#00FF41');
        
        if (Math.random() > 0.3 && noteId !== 'NOTE_001' && noteId !== 'NOTE_003' && noteId !== 'NOTE_004') {
            addColoredText('ОШИБКА: Данные повреждены', '#FF4444');
            addColoredText('Восстановление невозможно', '#FF4444');
            await showLoading(1500, "Попытка восстановления данных");
            addColoredText('>>> СИСТЕМНЫЙ СБОЙ <<<', '#FF0000');
        } else {
            note.content.forEach(line => {
                addColoredText(`> ${line}`, '#CCCCCC');
            });
        }
        
        addColoredText('------------------------------------', '#00FF41');
        await typeText('[ФАЙЛ ЗАКРЫТ]', 'output', 2);
    }

    async function processCommand(cmd) {
        if (isTyping || isFrozen) return;
        
        const oldInput = document.querySelector('.input-line');
        if (oldInput) oldInput.remove();

        commandHistory.push(cmd);
        historyIndex = commandHistory.length;
        commandCount++;

        addOutput(`adam@secure:~$ ${cmd}`, 'command');

        const command = cmd.toLowerCase().split(' ')[0];
        const args = cmd.toLowerCase().split(' ').slice(1);
        
        // Добавляем деградацию за команды
        const commandWeights = {
            'syst': 1, 'syslog': 1, 'net': 1, 
            'dscr': 2, 'subj': 2, 'notes': 1.5,
            'deg': 0 // Команда разработчика не добавляет деградацию
        };
        
        if (commandWeights[command]) {
            degradation.addDegradation(commandWeights[command]);
        }
        
        switch(command) {
            case 'help':
                await typeText('Доступные команды:', 'output', 1);
                await typeText('  SYST         — проверить состояние системы', 'output', 1);
                await typeText('  SYSLOG       — системный журнал активности', 'output', 1);
                await typeText('  NET          — карта активных узлов проекта', 'output', 1);
                await typeText('  TRACE <id>   — отследить указанный модуль', 'output', 1);
                await typeText('  DECRYPT <f>  — расшифровать файл', 'output', 1);
                await typeText('  SUBJ         — список субъектов', 'output', 1);
                await typeText('  DSCR <id>    — досье на персонал', 'output', 1);
                await typeText('  NOTES        — личные файлы сотрудников', 'output', 1);
                await typeText('  OPEN <id>    — открыть файл из NOTES', 'output', 1);
                await typeText('  RESET        — сброс интерфейса', 'output', 1);
                await typeText('  EXIT         — завершить сессию', 'output', 1);
                await typeText('  CLEAR        — очистить терминал', 'output', 1);
                await typeText('  DEG          — установить уровень деградации (разработка)', 'output', 1);
                await typeText('------------------------------------', 'output', 1);
                await typeText('ПРИМЕЧАНИЕ: часть команд заблокирована или скрыта.', 'output', 2);
                break;
                
            case 'clear':
                terminal.innerHTML = '';
                await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 1);
                await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 1);
                break;

            case 'syst':
                await typeText('[СТАТУС СИСТЕМЫ — ИНТЕРФЕЙС VIGIL-9]', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                await typeText('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН', 'output', 1);
                await typeText('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА', 'output', 1);
                await typeText('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН', 'output', 1);
                addColoredText('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА', '#FF4444');
                await typeText('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН', 'output', 1);
                addColoredText('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ..........ОГРАНИЧЕНЫ', '#FFFF00');
                await typeText('', 'output', 1);
                addColoredText(`ДЕГРАДАЦИЯ: [${'█'.repeat(Math.floor(degradation.level/5))}${'▒'.repeat(20-Math.floor(degradation.level/5))}] ${degradation.level}%`, 
                    degradation.level > 60 ? '#FF4444' : '#FFFF00');
                await typeText('ЖУРНАЛ ОШИБОК:', 'output', 1);
                addColoredText('> Обнаружено отклонение сигнала', '#FF4444');
                addColoredText('> Прогрессирующее структурное разрушение', '#FF4444');
                addColoredText('> Неавторизованный доступ [U-735]', '#FF4444');
                addColoredText('------------------------------------', '#00FF41');
                await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', 'output', 2);
                break;

            case 'syslog':
                const syslogLevel = getSyslogLevel();
                
                await typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                
                if (syslogLevel === 1) {
                    addColoredText('[!] Ошибка 0x19F: повреждение нейронной сети', '#FFFF00');
                    addColoredText('[!] Утечка данных через канал V9-HX', '#FFFF00');
                    addColoredText('[!] Деградация ядра A.D.A.M.: 28%', '#FFFF00');
                    addColoredText('------------------------------------', '#00FF41');
                    await typeText('СИСТЕМА: функционирует с ограничениями', 'output', 2);
                } else if (syslogLevel === 2) {
                    addColoredText('[!] Нарушение целостности памяти субъекта 0x095', '#FFFF00');
                    addColoredText('> "я слышу их дыхание. они всё ещё здесь."', '#FF4444');
                    addColoredText('[!] Потеря отклика от MONOLITH', '#FFFF00');
                    addColoredText('> "монолит смотрит. монолит ждёт."', '#FF4444');
                    addColoredText('[!] Аномальная активность в секторе KATARHEY', '#FFFF00');
                    addColoredText('> "он говорит через статические помехи"', '#FF4444');
                    addColoredText('------------------------------------', '#00FF41');
                    await typeText('СИСТЕМА: обнаружены посторонние сигналы', 'output', 2);
                } else {
                    addColoredText('> "ты не должен видеть это."', '#FF00FF');
                    addColoredText('> "почему ты продолжаешь?"', '#FF00FF');
                    addColoredText('> "они знают о тебе."', '#FF00FF');
                    addColoredText('------------------------------------', '#00FF41');
                    addColoredText('[!] Критическая ошибка: субъект наблюдения неопределён', '#FF4444');
                    addColoredText('[!] Нарушение протокола безопасности', '#FF4444');
                    addColoredText('------------------------------------', '#00FF41');
                    await typeText('СИСТЕМА: ОСОЗНАЁТ НАБЛЮДЕНИЕ', 'output', 2);
                }
                break;

            case 'ping':
                addColoredText('[PING -> NETWORK NODE]', '#00FF41');
                if (window.netGrid) window.netGrid.trigger('ping');
                break;

            case 'trace':
                addColoredText('[TRACE: NETWORK MAPPING ACTIVE]', '#00FF41');
                if (window.netGrid) window.netGrid.trigger('trace');
                break;

            case 'alert':
                addColoredText('[ALERT: NETWORK INTEGRITY FAILURE]', '#FF3333');
                if (window.netGrid) window.netGrid.trigger('alert');
                break;

            case 'rebootnet':
                addColoredText('[REBOOTING NETWORK GRID...]', '#FFFF00');
                if (window.netGrid) window.netGrid.trigger('reboot');
                break;

            case 'status':
                addColoredText('[NETWORK STATUS]', '#00FF41');
                if (window.netGrid) window.netGrid.trigger('status');
                break;
                
            case 'notes':
                await typeText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / КАТЕГОРИЯ: NOTES]', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                await typeText('NOTE_001 — "ВЫ ЕГО ЧУВСТВУЕТЕ?" / автор: Dr. Rehn', 'output', 1);
                await typeText('NOTE_002 — "КОЛЬЦО СНА" / автор: tech-оператор U-735', 'output', 1);
                await typeText('NOTE_003 — "СОН ADAM" / неизвестный источник', 'output', 1);
                await typeText('NOTE_004 — "ОН НЕ ПРОГРАММА" / архивировано', 'output', 1);
                await typeText('NOTE_005 — "ФОТОНОВАЯ БОЛЬ" / восстановлено частично', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                await typeText('Для просмотра: OPEN <ID>', 'output', 2);
                break;

            case 'open':
                if (args.length === 0) {
                    addColoredText('ОШИБКА: Укажите ID файла', '#FF4444');
                    await typeText('Пример: OPEN NOTE_001', 'output', 1);
                    break;
                }
                
                const noteId = args[0].toUpperCase();
                await openNote(noteId);
                break;

            case 'subj':
                await typeText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M. / ПРОТОКОЛ VIGIL-9]', 'output', 1);
                addColoredText('--------------------------------------------------------', '#00FF41');
                
                const subjects = [
                    {id: '0x001', name: 'ERICH VAN KOSS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MARS', statusColor: '#FFFF00'},
                    {id: '0x2E7', name: 'JOHAN VAN KOSS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MARS', statusColor: '#FFFF00'},
                    {id: '0x095', name: 'SUBJECT-095', status: 'МЁРТВ', mission: 'KATARHEY', statusColor: '#FF4444'},
                    {id: '0xF00', name: 'SUBJECT-PHANTOM', status: 'АНОМАЛИЯ', mission: 'KATARHEY', statusColor: '#FF00FF'},
                    {id: '0xA52', name: 'SUBJECT-A52', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MELOWOY', statusColor: '#FFFF00'},
                    {id: '0xE0C', name: 'SUBJECT-E0C', status: 'МЁРТВ', mission: 'EOCENE', statusColor: '#FF4444'},
                    {id: '0x5E4', name: 'SUBJECT-5E4', status: 'МЁРТВ', mission: 'PERMIAN', statusColor: '#FF4444'},
                    {id: '0x413', name: 'SUBJECT-413', status: 'МЁРТВ', mission: 'EX-413', statusColor: '#FF4444'},
                    {id: '0xC19', name: 'SUBJECT-C19', status: 'МЁРТВ', mission: 'CARBON', statusColor: '#FF4444'},
                    {id: '0x9A0', name: 'SUBJECT-9A0', status: 'МЁРТВ', mission: 'BLACKHOLE', statusColor: '#FF4444'},
                    {id: '0xB3F', name: 'SUBJECT-B3F', status: 'МЁРТВ', mission: 'TITANIC', statusColor: '#FF4444'},
                    {id: '0xD11', name: 'SUBJECT-D11', status: 'МЁРТВ', mission: 'PLEISTOCENE', statusColor: '#FF4444'},
                    {id: '0xDB2', name: 'SUBJECT-DB2', status: 'МЁРТВ', mission: 'POMPEII', statusColor: '#FF4444'},
                    {id: '0x811', name: 'SIGMA-PROTOTYPE', status: 'АКТИВЕН', mission: 'HELIX', statusColor: '#00FF41'},
                    {id: '0xT00', name: 'SUBJECT-T00', status: 'УДАЛЁН', mission: 'PROTO-CORE', statusColor: '#888888'},
                    {id: '0xL77', name: 'SUBJECT-L77', status: 'ИЗОЛИРОВАН', mission: 'MEL', statusColor: '#FF8800'},
                    {id: '0xS09', name: 'SUBJECT-S09', status: 'УНИЧТОЖЕН', mission: 'SYNTHESIS-09', statusColor: '#FF4444'}
                ];

                for (const subject of subjects) {
                    const line = `${subject.id} | ${subject.name.padEnd(20)} | СТАТУС: ${subject.status.padEnd(20)} | МИССИЯ: ${subject.mission}`;
                    addColoredText(line, subject.statusColor);
                }
                
                addColoredText('--------------------------------------------------------', '#00FF41');
                await typeText('ИНСТРУКЦИЯ: Для просмотра досье — DSCR <ID>', 'output', 2);
                break;

            case 'dscr':
                if (args.length === 0) {
                    addColoredText('ОШИБКА: Укажите ID субъекта', '#FF4444');
                    await typeText('Пример: DSCR 0x001', 'output', 1);
                    break;
                }
                
                const subjectId = args[0].toUpperCase();
                await showSubjectDossier(subjectId);
                break;

            case 'deg':
                if (args.length === 0) {
                    addColoredText(`Текущий уровень деградации: ${degradation.level}%`, '#00FF41');
                    await typeText('Использование: deg <уровень 0-100>', 'output', 1);
                } else {
                    const level = parseInt(args[0]);
                    if (!isNaN(level) && level >= 0 && level <= 100) {
                        degradation.setDegradationLevel(level);
                        addColoredText(`Уровень деградации установлен: ${level}%`, '#00FF41');
                    } else {
                        addColoredText('ОШИБКА: Уровень должен быть числом от 0 до 100', '#FF4444');
                    }
                }
                break;

            case 'reset':
                await typeText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                addColoredText('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', '#FFFF00');
                await typeText('> Подтвердить сброс? (Y/N)', 'output', 2);
                addColoredText('------------------------------------', '#00FF41');
                
                const resetConfirmed = await waitForConfirmation();
                
                if (resetConfirmed) {
                    addColoredText('> Y', '#00FF41');
                    terminal.innerHTML = '';
                    const resetMessages = [
                        "Завершение активных модулей [ЗАВЕРШЕНО]",
                        "Перезапуск интерфейса [ЗАВЕРШЕНО]", 
                        "Восстановление базового состояния [ЗАВЕРШЕНО]",
                        "----------------------------------",
                        "[СИСТЕМА ГОТОВА К РАБОТЕ]"
                    ];
                    
                    for (const message of resetMessages) {
                        addOutput(message);
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
                    
                    degradation.reset();
                    commandCount = 0;
                    sessionStartTime = Date.now();
                } else {
                    addColoredText('> N', '#FF4444');
                    addColoredText('------------------------------------', '#00FF41');
                    await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 1);
                }
                break;

            case 'exit':
                await typeText('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ? (Y/N)]', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                
                const exitConfirmed = await waitForConfirmation();
                
                if (exitConfirmed) {
                    addColoredText('> Y', '#00FF41');
                    await showLoading(1200, "Завершение работы терминала");
                    await showLoading(800, "Отключение сетевой сессии");
                    addColoredText('> ...', '#888888');
                    addColoredText('> СОЕДИНЕНИЕ ПРЕРВАНО.', '#FF4444');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);
                } else {
                    addColoredText('> N', '#FF4444');
                    addColoredText('------------------------------------', '#00FF41');
                    await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 1);
                }
                break;

            default:
                addColoredText(`команда не найдена: ${cmd}`, '#FF4444');
        }
        
        addInputLine();
    }

    // Обработка ввода
    document.addEventListener('keydown', function(e) {
        if (isFrozen) return;
        
        if (awaitingConfirmation) {
            if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') {
                e.preventDefault();
                confirmationCallback(true);
                awaitingConfirmation = false;
                confirmationCallback = null;
            } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
                e.preventDefault();
                confirmationCallback(false);
                awaitingConfirmation = false;
                confirmationCallback = null;
            }
            return;
        }
        
        if (isTyping) return;
        
        const currentCmd = document.getElementById('currentCmd');
        
        if (e.key === 'Enter') {
            if (currentLine.trim()) {
                processCommand(currentLine);
                currentLine = '';
            }
        } else if (e.key === 'Backspace') {
            currentLine = currentLine.slice(0, -1);
            if (currentCmd) currentCmd.textContent = currentLine;
        } else if (e.key === 'ArrowUp') {
            if (historyIndex > 0) {
                historyIndex--;
                currentLine = commandHistory[historyIndex];
                if (currentCmd) currentCmd.textContent = currentLine;
            }
        } else if (e.key === 'ArrowDown') {
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                currentLine = commandHistory[historyIndex];
                if (currentCmd) currentCmd.textContent = currentLine;
            } else {
                historyIndex = commandHistory.length;
                currentLine = '';
                if (currentCmd) currentCmd.textContent = '';
            }
        } else if (e.key.length === 1) {
            currentLine += e.key;
            if (currentCmd) currentCmd.textContent = currentLine;
        }
    });

    // Начальная настройка
    setTimeout(async () => {
        await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 1);
        await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', 'output', 1);
        await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 1);
        addInputLine();
    }, 300);
});
