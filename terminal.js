// Звуковые эффекты для терминала
const sounds = {
    typewriter: new Audio('sounds/typewriter.wav'),
    glitch: new Audio('sounds/glitch.wav'),
    beep: new Audio('sounds/beep.wav'),
    error: new Audio('sounds/access_denied.wav')
};

Object.values(sounds).forEach(sound => {
    sound.volume = 0.3;
});

// Логика терминала
document.addEventListener('DOMContentLoaded', function() {
    const terminal = document.getElementById('terminal');
    let currentLine = '';
    
    // Звук при загрузке терминала
    setTimeout(() => sounds.beep.play(), 500);
    
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
                sounds.beep.play();
                break;
                
            case 'clear':
                terminal.innerHTML = '';
                sounds.beep.play();
                break;
                
            case 'status':
                addOutput('PROTOCOL VIGIL-9: ACTIVE');
                addOutput('OBSERVATION: ONGOING');
                addOutput('LAST UPDATE: ' + new Date().toLocaleString());
                sounds.beep.play();
                break;
                
            case 'subjects':
                addOutput('ACTIVE SUBJECTS: 734');
                addOutput('TERMINATED: 1289');
                addOutput('MAYAKS: 47');
                sounds.beep.play();
                break;
                
            case 'logout':
                addOutput('ENDING SESSION...');
                sounds.beep.play();
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
                break;
                
            case '734':
                addOutput('SUBJECT 734: JOHAN VAN KOSS');
                addOutput('STATUS: CONVERTED_TO_MAYAK');
                addOutput('LOCATION: MARS_SECTOR_3D');
                addOutput('NOTES: SON OF E. VAN KOSS');
                sounds.beep.play();
                break;
                
            default:
                addOutput(`command not found: ${cmd}`);
                sounds.error.play(); // Звук ошибки для неверной команды
        }
        
        addInputLine();
    }
    
    function addInputLine() {
        currentLine = '';
        document.getElementById('currentCmd').textContent = '';
    }
    
    // Обработка ввода с звуками
    document.addEventListener('keydown', function(e) {
        const currentCmd = document.getElementById('currentCmd');
        
        if (e.key === 'Enter') {
            sounds.beep.play();
            if (currentLine.trim()) {
                processCommand(currentLine);
            } else {
                addInputLine();
            }
        } else if (e.key === 'Backspace') {
            currentLine = currentLine.slice(0, -1);
            currentCmd.textContent = currentLine;
            sounds.typewriter.currentTime = 0;
            sounds.typewriter.play();
        } else if (e.key.length === 1) {
            currentLine += e.key;
            currentCmd.textContent = currentLine;
            sounds.typewriter.currentTime = 0;
            sounds.typewriter.play();
        }
    });
    
    // Случайные глитчи со звуком
    setInterval(() => {
        if (Math.random() < 0.1) {
            document.body.classList.add('glitch');
            sounds.glitch.currentTime = 0;
            sounds.glitch.play();
            setTimeout(() => document.body.classList.remove('glitch'), 100);
        }
    }, 5000);
});
