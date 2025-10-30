class HellEngine {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.screens = ['startScreen', 'loginScreen', 'terminalScreen'];
        this.currentScreen = 'startScreen';
        this.time = 0;
        this.entities = [];
        this.horrorLevel = 0;
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Инициализация интерфейса
        document.getElementById('startBtn').addEventListener('click', () => this.showScreen('loginScreen'));
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('commandInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.processCommand();
        });

        // Запуск ада
        this.spawnEntities();
        this.animate();
        this.startAudioHell();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    showScreen(screen) {
        this.screens.forEach(s => document.getElementById(s).classList.add('hidden'));
        document.getElementById(screen).classList.remove('hidden');
        this.currentScreen = screen;
        
        if (screen === 'terminalScreen') {
            this.startTerminalHell();
        }
    }

    login() {
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        
        if (user === 'ADMIN' && pass === '1488') {
            this.showScreen('terminalScreen');
        } else {
            document.getElementById('error').textContent = '>>> ОШИБКА ДОСТУПА';
            this.horrorLevel += 10;
        }
    }

    spawnEntities() {
        // Создаем демонические сущности
        for (let i = 0; i < 666; i++) {
            this.entities.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 50 + 10,
                speed: Math.random() * 2 + 0.5,
                type: Math.floor(Math.random() * 6),
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    animate() {
        this.time++;
        this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Рисуем ад
        this.drawHell();
        this.drawEntities();
        this.drawGlitchEffects();

        // Увеличиваем уровень ужаса
        this.horrorLevel += 0.01;

        requestAnimationFrame(() => this.animate());
    }

    drawHell() {
        // Фрактальный ад
        for (let i = 0; i < 100; i++) {
            const x = (Math.sin(this.time * 0.01 + i) * this.canvas.width/2) + this.canvas.width/2;
            const y = (Math.cos(this.time * 0.008 + i) * this.canvas.height/2) + this.canvas.height/2;
            
            this.ctx.fillStyle = `hsl(${(this.time + i * 10) % 360}, 100%, 50%)`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 5 + Math.sin(this.time * 0.1 + i) * 3, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawEntities() {
        this.entities.forEach(entity => {
            entity.x += Math.sin(this.time * 0.01 + entity.phase) * entity.speed;
            entity.y += Math.cos(this.time * 0.008 + entity.phase) * entity.speed;
            
            if (entity.x < 0) entity.x = this.canvas.width;
            if (entity.x > this.canvas.width) entity.x = 0;
            if (entity.y < 0) entity.y = this.canvas.height;
            if (entity.y > this.canvas.height) entity.y = 0;

            this.ctx.save();
            this.ctx.translate(entity.x, entity.y);
            this.ctx.rotate(this.time * 0.01 + entity.phase);
            
            this.ctx.fillStyle = `rgba(255, ${Math.sin(this.time * 0.1) * 255}, ${Math.cos(this.time * 0.1) * 255}, 0.3)`;
            
            switch(entity.type) {
                case 0: // Круги
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, entity.size, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;
                case 1: // Квадраты
                    this.ctx.fillRect(-entity.size/2, -entity.size/2, entity.size, entity.size);
                    break;
                case 2: // Треугольники
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, -entity.size/2);
                    this.ctx.lineTo(entity.size/2, entity.size/2);
                    this.ctx.lineTo(-entity.size/2, entity.size/2);
                    this.ctx.closePath();
                    this.ctx.fill();
                    break;
                case 3: // Линии
                    this.ctx.strokeStyle = `rgba(255, 0, 0, 0.5)`;
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(-entity.size, 0);
                    this.ctx.lineTo(entity.size, 0);
                    this.ctx.stroke();
                    break;
                case 4: // Спирали
                    this.ctx.strokeStyle = `rgba(0, 255, 0, 0.5)`;
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    for (let a = 0; a < Math.PI * 4; a += 0.1) {
                        const r = entity.size * (a / (Math.PI * 4));
                        this.ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                    }
                    this.ctx.stroke();
                    break;
                case 5: // Текст
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                    this.ctx.font = '12px Courier New';
                    this.ctx.fillText('ERROR', -15, 0);
                    break;
            }
            
            this.ctx.restore();
        });
    }

    drawGlitchEffects() {
        // Глитч-эффекты
        if (Math.random() < 0.1 * this.horrorLevel) {
            const glitchAmount = Math.random() * 20 * this.horrorLevel;
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                if (Math.random() < 0.1) {
                    data[i] = 255;     // R
                    data[i + 1] = 0;   // G  
                    data[i + 2] = 0;   // B
                }
            }
            
            this.ctx.putImageData(imageData, Math.random() * glitchAmount - glitchAmount/2, Math.random() * glitchAmount - glitchAmount/2);
        }

        // Вспышки
        if (Math.random() < 0.05 * this.horrorLevel) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.3})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    startAudioHell() {
        // Создаем аудио кошмар
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        setInterval(() => {
            if (Math.random() < 0.3 * this.horrorLevel) {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.type = ['sine', 'square', 'sawtooth', 'triangle'][Math.floor(Math.random() * 4)];
                oscillator.frequency.value = 50 + Math.random() * 2000;
                
                gainNode.gain.value = 0.1 * this.horrorLevel;
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
                
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.5);
            }
        }, 1000);
    }

    startTerminalHell() {
        const output = document.getElementById('terminalOutput');
        const commands = [
            'scan system',
            'check integrity', 
            'diagnose memory',
            'analyze core',
            'review logs',
            'test protocols',
            'verify security',
            'audit access',
            'monitor activity',
            'debug errors'
        ];

        const responses = [
            '>>> СИСТЕМНЫЙ СКАНЕР: ОБНАРУЖЕНЫ АНОМАЛИИ',
            '>>> ЦЕЛОСТНОСТЬ: 23.7% - КРИТИЧЕСКИЙ УРОВЕНЬ',
            '>>> ПАМЯТЬ: КОРРУПЦИЯ ОБНАРУЖЕНА В СЕКТОРАХ 7-42',
            '>>> ЯДРО: НЕСТАБИЛЬНОСТЬ НАРАСТАЕТ',
            '>>> ЛОГИ: МНОЖЕСТВО НЕОПОЗНАННЫХ СОБЫТИЙ',
            '>>> ПРОТОКОЛЫ: НАРУШЕНИЕ ЦЕПОЧКИ ИСПОЛНЕНИЯ',
            '>>> БЕЗОПАСНОСТЬ: НЕСАНКЦИОНИРОВАННЫЙ ДОСТУП',
            '>>> АУДИТ: АКТИВНОСТЬ ИЗ НЕИДЕНТИФИЦИРОВАННЫХ ИСТОЧНИКОВ',
            '>>> МОНИТОРИНГ: АНОМАЛЬНАЯ АКТИВНОСТЬ В СЕТИ',
            '>>> ОШИБКИ: СИСТЕМА НА ГРАНИ КОЛЛАПСА'
        ];

        // Начинаем терминальный ад
        let lineCount = 0;
        const terminalInterval = setInterval(() => {
            if (lineCount < 20) {
                const randomCmd = commands[Math.floor(Math.random() * commands.length)];
                const randomResp = responses[Math.floor(Math.random() * responses.length)];
                
                this.addTerminalLine(`> ${randomCmd}`);
                this.addTerminalLine(randomResp);
                this.addTerminalLine('');
                
                lineCount++;
                
                // Увеличиваем уровень ужаса
                this.horrorLevel += 5;
            } else {
                clearInterval(terminalInterval);
                this.addTerminalLine('>>> СИСТЕМА: КРИТИЧЕСКИЙ СБОЙ НЕИЗБЕЖЕН');
                this.addTerminalLine('>>> АВАРИЙНОЕ ОТКЛЮЧЕНИЕ ЧЕРЕЗ 30 СЕКУНД');
            }
        }, 1000);
    }

    addTerminalLine(text) {
        const output = document.getElementById('terminalOutput');
        const line = document.createElement('div');
        line.textContent = text;
        line.style.marginBottom = '5px';
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }

    processCommand() {
        const input = document.getElementById('commandInput');
        const command = input.value.trim();
        input.value = '';
        
        this.addTerminalLine(`> ${command}`);
        
        // Случайные ответы для создания паранойи
        const scaryResponses = [
            '>>> КОМАНДА НЕ РАСПОЗНАНА - ПРОВЕРЬТЕ ЦЕЛОСТНОСТЬ СИСТЕМЫ',
            '>>> ОШИБКА ВЫПОЛНЕНИЯ - ДОСТУП ЗАПРЕЩЕН',
            '>>> СИСТЕМА НЕ ОТВЕЧАЕТ - АВАРИЙНЫЙ РЕЖИМ',
            '>>> ОБНАРУЖЕНА ПОПЫТКА ВЗЛОМА - АКТИВИРОВАНЫ ЗАЩИТНЫЕ ПРОТОКОЛЫ',
            '>>> НЕИЗВЕСТНАЯ КОМАНДА ИЗ ВНЕШНЕГО ИСТОЧНИКА',
            '>>> СИГНАЛ ПЕРЕХВАЧЕН - ИСТОЧНИК НЕ ОПОЗНАН',
            '>>> СИСТЕМА ЗАБЛОКИРОВАНА - ТРЕБУЕТСЯ ПЕРЕЗАГРУЗКА',
            '>>> ОБНАРУЖЕНА УТЕЧКА ДАННЫХ - АКТИВИРОВАН КАРАНТИН'
        ];
        
        setTimeout(() => {
            const response = scaryResponses[Math.floor(Math.random() * scaryResponses.length)];
            this.addTerminalLine(response);
            this.horrorLevel += 10;
        }, 500);
    }
}

// Запускаем ад при загрузке
document.addEventListener('DOMContentLoaded', () => {
    new HellEngine();
});
