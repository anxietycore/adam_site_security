// Логика терминала (упрощенная версия)
document.addEventListener('DOMContentLoaded', function() {
    const terminal = document.getElementById('terminal');
    let currentLine = '';
    
    function addOutput(text) {
        const line = document.createElement('div');
        line.className = 'output';
        line.textContent = text;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }
    
    function processCommand(cmd) {
        addOutput(`adam@secure:~$ ${cmd}`);
        
        switch(cmd.toLowerCase()) {
            case 'help':
                addOutput('Available commands:');
                addOutput('  help     - Show this help');
                addOutput('  clear    - Clear terminal');
                addOutput('  status   - Show protocol status');
                addOutput('  subjects - List active subjects');
                addOutput('  logout   - End session');
                break;
                
            case 'clear':
                terminal.innerHTML = '';
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
                break;
                
            case 'logout':
                addOutput('ENDING SESSION...');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
                break;
                
            case '734':
                addOutput('SUBJECT 734: JOHAN VAN KOSS');
                addOutput('STATUS: CONVERTED_TO_MAYAK');
                addOutput('LOCATION: MARS_SECTOR_3D');
                addOutput('NOTES: SON OF E. VAN KOSS');
                break;
                
            default:
                addOutput(`command not found: ${cmd}`);
        }
        
        // Добавляем новую строку ввода
        addInputLine();
    }
    
    function addInputLine() {
        currentLine = '';
        document.getElementById('currentCmd').textContent = '';
    }
    
    // Обработка ввода
    document.addEventListener('keydown', function(e) {
        const currentCmd = document.getElementById('currentCmd');
        
        if (e.key === 'Enter') {
            if (currentLine.trim()) {
                processCommand(currentLine);
            }
        } else if (e.key === 'Backspace') {
            currentLine = currentLine.slice(0, -1);
            currentCmd.textContent = currentLine;
        } else if (e.key.length === 1) {
            currentLine += e.key;
            currentCmd.textContent = currentLine;
        }
    });
    
    // Случайные глитчи
    setInterval(() => {
        if (Math.random() < 0.1) {
            document.body.classList.add('glitch');
            setTimeout(() => document.body.classList.remove('glitch'), 100);
        }
    }, 5000);
});
