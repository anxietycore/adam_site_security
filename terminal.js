// Логика терминала
document.addEventListener('DOMContentLoaded', function() {
    const terminal = document.getElementById('terminal');
    let currentLine = '';
    let commandHistory = [];
    let historyIndex = -1;

    function addOutput(text, className = 'output') {
        const line = document.createElement('div');
        line.className = className;
        line.textContent = text;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    function addInputLine() {
        // Добавляем пустую строку перед новым вводом
        addOutput('', 'spacer');
        
        const inputLine = document.createElement('div');
        inputLine.className = 'input-line';
        inputLine.innerHTML = '<span class="prompt">adam@secure:~$ </span><span class="cmd" id="currentCmd"></span><span class="cursor" id="cursor">_</span>';
        terminal.appendChild(inputLine);
        
        terminal.scrollTop = terminal.scrollHeight;
        document.getElementById('currentCmd').focus();
    }

    function processCommand(cmd) {
        // Удаляем старую строку ввода
        const oldInput = document.querySelector('.input-line');
        if (oldInput) oldInput.remove();

        // Добавляем в историю
        commandHistory.push(cmd);
        historyIndex = commandHistory.length;

        // Показываем введённую команду
        addOutput(`adam@secure:~$ ${cmd}`, 'command');

        // Обрабатываем команду
        switch(cmd.toLowerCase()) {
            case 'help':
                addOutput('Available commands:');
                addOutput('  help     - Show this help');
                addOutput('  clear    - Clear terminal');
                addOutput('  status   - Show protocol status');
                addOutput('  subjects - List active subjects');
                addOutput('  erich    - Erich Van Koss dossier');
                addOutput('  johan    - Subject 734 data');
                addOutput('  mars     - Mars incident report');
                addOutput('  logout   - End session');
                break;
                
            case 'clear':
                terminal.innerHTML = '';
                addOutput('> A.D.A.M. TERMINAL // VIGIL-9 ACTIVE');
                addOutput('> TYPE "help" FOR AVAILABLE COMMANDS');
                break;
                
            case 'status':
                addOutput('PROTOCOL VIGIL-9: ACTIVE');
                addOutput('OBSERVATION: ONGOING');
                addOutput('LAST UPDATE: ' + new Date().toLocaleString());
                break;
                
            case 'subjects':
                addOutput('ACTIVE SUBJECTS: 734');
                addOutput('TERMINATED: 1289');
                addOutput('MAYAKS: 47');
                addOutput('ANOMALIES: 3');
                break;

            case 'erich':
                addOutput('ERICH VAN KOSS - COORDINATOR LEVEL 9');
                addOutput('STATUS: MISSING/Presumed DEAD');
                addOutput('LAST KNOWN LOCATION: MARS_SECTOR_3D');
                addOutput('NOTES: FOUNDER. POSSIBLE TRAITOR.');
                addOutput('SECURITY CLEARANCE: REVOKED');
                break;

            case 'johan':
                addOutput('SUBJECT 734: JOHAN VAN KOSS');
                addOutput('STATUS: CONVERTED_TO_MAYAK');
                addOutput('LOCATION: MARS_SECTOR_3D');
                addOutput('MISSION: MARS_ANOMALY_RESEARCH');
                addOutput('NOTES: SON OF ERICH VAN KOSS');
                addOutput('BIOLOGICAL STATUS: UNKNOWN');
                break;

            case 'mars':
                addOutput('INCIDENT REPORT: MARS_SECTOR_3D');
                addOutput('DATE: [REDACTED]');
                addOutput('SUBJECTS: 4 DEPLOYED, 1 LOST');
                addOutput('ANOMALY: BLACK BIOMASS DETECTED');
                addOutput('STATUS: QUARANTINE ACTIVE');
                addOutput('MAYAK_734: ACTIVE_OBSERVATION');
                break;
                
            case 'logout':
                addOutput('ENDING SESSION...');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
                break;
                
            default:
                addOutput(`command not found: ${cmd}`, 'error');
        }
        
        // Добавляем новую строку для ввода
        addInputLine();
    }

    // Обработка ввода
    document.addEventListener('keydown', function(e) {
        const currentCmd = document.getElementById('currentCmd');
        
        if (e.key === 'Enter') {
            if (currentLine.trim()) {
                processCommand(currentLine);
                currentLine = '';
            }
        } else if (e.key === 'Backspace') {
            currentLine = currentLine.slice(0, -1);
            currentCmd.textContent = currentLine;
        } else if (e.key === 'ArrowUp') {
            if (historyIndex > 0) {
                historyIndex--;
                currentLine = commandHistory[historyIndex];
                currentCmd.textContent = currentLine;
            }
        } else if (e.key === 'ArrowDown') {
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                currentLine = commandHistory[historyIndex];
                currentCmd.textContent = currentLine;
            } else {
                historyIndex = commandHistory.length;
                currentLine = '';
                currentCmd.textContent = '';
            }
        } else if (e.key.length === 1) {
            currentLine += e.key;
            currentCmd.textContent = currentLine;
        }
    });

    // Начальная настройка
    addOutput('> A.D.A.M. TERMINAL // VIGIL-9 ACTIVE');
    addOutput('> WELCOME, OPERATOR');
    addOutput('> TYPE "help" FOR AVAILABLE COMMANDS');
    addInputLine();
});
