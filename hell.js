// PS1 STYLE HORROR ENGINE
class PS1Horror {
    constructor() {
        this.canvas = document.getElementById('crt');
        this.ctx = this.canvas.getContext('2d');
        this.output = document.getElementById('output');
        this.input = document.getElementById('input');
        this.time = 0;
        this.glitchTime = 0;
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // CRT эффекты
        this.createCRTEffect();
        
        // Терминал
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.processCommand();
        });

        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createCRTEffect() {
        // Эффект ЭЛТ-монитора
        const scanlines = document.createElement('style');
        scanlines.textContent = `
            body::before {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    to bottom,
                    transparent 50%,
                    rgba(0, 0, 0, 0.1) 50%
                );
                background-size: 100% 4px;
                pointer-events: none;
                z-index: 9999;
            }
        `;
        document.head.appendChild(scanlines);
    }

    animate() {
        this.time++;
        this.glitchTime++;

        // Очистка с эффектом выгорания
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Случайные глитчи PS1 стиля
        if (Math.random() < 0.02) {
            this.drawPS1Glitch();
        }

        // Мерцание как у старого монитора
        if (Math.random() < 0.01) {
            this.ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Временные аномалии (редкие)
        if (Math.random() < 0.005) {
            this.drawTemporalAnomaly();
        }

        requestAnimationFrame(() => this.animate());
    }

    drawPS1Glitch() {
        // Глитчи в стиле PS1 - текстуры съезжают
        const glitchX = Math.random() * 20 - 10;
        const glitchY = Math.random() * 20 - 10;
        
        this.ctx.save();
        this.ctx.translate(glitchX, glitchY);
        
        // Рисуем смещенную копию интерфейса
        const terminal = document.getElementById('terminal');
        if (!terminal.classList.contains('hidden')) {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            this.ctx.fillRect(50 + glitchX, 50 + glitchY, this.canvas.width - 100, this.canvas.height - 100);
        }
        
        this.ctx.restore();
    }

    drawTemporalAnomaly() {
        // Редкие временные аномалии
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        setTimeout(() => {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }, 50);
    }

    addLine(text, color = '#00ff00') {
        const line = document.createElement('div');
        line.textContent = text;
        line.style.color = color;
        line.style.marginBottom = '2px';
        this.output.appendChild(line);
        this.output.scrollTop = this.output.scrollHeight;
    }

    processCommand() {
        const cmd = this.input.value.trim().toLowerCase();
        this.input.value = '';
        
        this.addLine(`> ${cmd}`);

        // Системные команды
        const responses = {
            'status': '>>> СТАТУС: КРИТИЧЕСКИЙ СБОЙ\n>>> ЦЕЛОСТНОСТЬ: 34.7%\n>>> ПАМЯТЬ: КОРРУПЦИЯ ОБНАРУЖЕНА',
            'scan': '>>> СКАНИРОВАНИЕ: ОБНАРУЖЕНЫ АНОМАЛЬНЫЕ СИГНАЛЫ\n>>> ИСТОЧНИК: НЕ ОПРЕДЕЛЕН',
            'log': '>>> ЛОГ СИСТЕМЫ:\n>>> 23:47:11 - НЕОПОЗНАННАЯ АКТИВНОСТЬ\n>>> 23:47:23 - СБОЙ ПАМЯТИ\n>>> 23:47:45 - ВНЕШНЕЕ ВМЕШАТЕЛЬСТВО',
            'help': '>>> ДОСТУПНЫЕ КОМАНДЫ: STATUS, SCAN, LOG, DIAG, REBOOT',
            'diag': '>>> ДИАГНОСТИКА:\n>>> ЯДРО: НЕСТАБИЛЬНО\n>>> СЕТЬ: ПРЕРЫВИСТЫЙ СИГНАЛ\n>>> БЕЗОПАСНОСТЬ: СКОМПРОМЕТИРОВАНА',
            'reboot': '>>> ПЕРЕЗАГРУЗКА НЕВОЗМОЖНА\n>>> СИСТЕМА ЗАБЛОКИРОВАНА'
        };

        if (responses[cmd]) {
            setTimeout(() => {
                this.addLine(responses[cmd]);
                
                // Случайные страшные события после команд
                if (Math.random() < 0.3) {
                    setTimeout(() => {
                        this.addLine('>>> ПРЕДУПРЕЖДЕНИЕ: ОБНАРУЖЕНА ПОДОЗРИТЕЛЬНАЯ АКТИВНОСТЬ', '#ff0000');
                    }, 1000);
                }
            }, 500);
        } else {
            setTimeout(() => {
                this.addLine('>>> ОШИБКА: КОМАНДА НЕ РАСПОЗНАНА', '#ff0000');
                
                // Иногда после ошибки - страшные сообщения
                if (Math.random() < 0.4) {
                    setTimeout(() => {
                        const horrors = [
                            '>>> СИСТЕМА: КТО-ТО СЛЕДИТ ЗА НАМИ',
                            '>>> ПРЕДУПРЕЖДЕНИЕ: ОНИ ЗДЕСЬ',
                            '>>> ОШИБКА: ОН ВИДИТ ТЕБЯ',
                            '>>> СБОЙ: НЕ СМОТРИ НА ЭКРАН',
                            '>>> ТРЕВОГА: ОН ПРИБЛИЖАЕТСЯ'
                        ];
                        this.addLine(horrors[Math.floor(Math.random() * horrors.length)], '#ff0000');
                    }, 800);
                }
            }, 500);
        }
    }
}

// Логин система
function login() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    const error = document.getElementById('error');

    if (user === 'ADMIN' && pass === '1488') {
        document.getElementById('login').classList.add('hidden');
        document.getElementById('terminal').classList.remove('hidden');
        
        // Запускаем хоррор движок
        const horror = new PS1Horror();
        
        // Начальные сообщения терминала
        setTimeout(() => horror.addLine('>>> СИСТЕМА A.D.A.M. ЗАПУЩЕНА'), 100);
        setTimeout(() => horror.addLine('>>> СТАТУС: КРИТИЧЕСКИЙ СБОЙ ОБНАРУЖЕН'), 800);
        setTimeout(() => horror.addLine('>>> ПРЕДУПРЕЖДЕНИЕ: АНОМАЛЬНАЯ АКТИВНОСТЬ'), 1500);
        setTimeout(() => horror.addLine('>>> РЕКОМЕНДАЦИЯ: ВЫПОЛНИТЕ ДИАГНОСТИКУ'), 2200);
        setTimeout(() => horror.addLine(''), 3000);
        
        // Фокус на инпут
        document.getElementById('input').focus();
    } else {
        error.textContent = '>>> ОШИБКА ДОСТУПА';
        
        // При ошибке логина - добавляем страха
        setTimeout(() => {
            error.textContent = '>>> СИСТЕМА: ОНИ ЗНАЮТ О ТВОЕЙ ПОПЫТКЕ';
        }, 2000);
    }
}

// Автофокус на логин
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('user').focus();
});
