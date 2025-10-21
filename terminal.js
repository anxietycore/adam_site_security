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
        const spacer = document.createElement('div');
        spacer.style.height = '15px';
        terminal.appendChild(spacer);
        
        const inputLine = document.createElement('div');
        inputLine.className = 'input-line';
        inputLine.innerHTML = '<span class="prompt">adam@secure:~$ </span><span class="cmd" id="currentCmd"></span><span class="cursor" id="cursor">_</span>';
        terminal.appendChild(inputLine);
        
        terminal.scrollTop = terminal.scrollHeight;
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
                addOutput('Доступные команды:');
                addOutput('  help     - Показать справку');
                addOutput('  clear    - Очистить терминал');
                addOutput('  status   - Статус протокола');
                addOutput('  subjects - Список субъектов');
                addOutput('  erich    - Досье Эриха Ван Косса');
                addOutput('  johan    - Данные субъекта 734');
                addOutput('  mars     - Отчёт об инциденте на Марсе');
                addOutput('  logout   - Завершить сеанс');
                break;
                
            case 'clear':
                terminal.innerHTML = '';
                addOutput('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН');
                addOutput('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД');
                break;
                
            case 'status':
                addOutput('ПРОТОКОЛ VIGIL-9: АКТИВЕН');
                addOutput('НАБЛЮДЕНИЕ: В РЕЖИМЕ РЕАЛЬНОГО ВРЕМЕНИ');
                addOutput('ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ: ' + new Date().toLocaleString('ru-RU'));
                break;
                
            case 'subjects':
                addOutput('АКТИВНЫЕ СУБЪЕКТЫ: 734');
                addOutput('ЛИКВИДИРОВАНЫ: 1289');
                addOutput('МАЯКИ: 47');
                addOutput('АНОМАЛИИ: 3');
                break;

            case 'erich':
                addOutput('ЭРИХ ВАН КОСС - КООРДИНАТОР УРОВНЯ 9');
                addOutput('СТАТУС: ПРОПАВШИЙ БЕЗ ВЕСТИ');
                addOutput('ПОСЛЕДНЕЕ МЕСТОПОЛОЖЕНИЕ: СЕКТОР 3-D МАРС');
                addOutput('ЗАМЕТКИ: ОСНОВАТЕЛЬ. ВОЗМОЖНЫЙ ПРЕДАТЕЛЬ.');
                addOutput('ДОПУСК: ОТОЗВАН');
                break;

            case 'johan':
                addOutput('СУБЪЕКТ 734: ЙОХАН ВАН КОСС');
                addOutput('СТАТУС: ПРЕОБРАЖЁН В МАЯК');
                addOutput('МЕСТОПОЛОЖЕНИЕ: СЕКТОР 3-D МАРС');
                addOutput('МИССИЯ: ИССЛЕДОВАНИЕ АНОМАЛИИ МАРС');
                addOutput('ЗАМЕТКИ: СЫН ЭРИХА ВАН КОССА');
                addOutput('БИОЛОГИЧЕСКИЙ СТАТУС: НЕИЗВЕСТЕН');
                break;

            case 'mars':
                addOutput('ОТЧЁТ ОБ ИНЦИДЕНТЕ: СЕКТОР 3-D МАРС');
                addOutput('ДАТА: [ЗАСЕКРЕЧЕНО]');
                addOutput('СУБЪЕКТЫ: 4 ЗАДЕЙСТВОВАНЫ, 1 ПОТЕРЯН');
                addOutput('АНОМАЛИЯ: ОБНАРУЖЕНА ЧЁРНАЯ БИОМАССА');
                addOutput('СТАТУС: КАРАНТИН АКТИВЕН');
                addOutput('МАЯК_734: АКТИВНОЕ НАБЛЮДЕНИЕ');
                break;
                
            case 'logout':
                addOutput('ЗАВЕРШЕНИЕ СЕАНСА...');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
                break;
                
            default:
                addOutput(`команда не найдена: ${cmd}`, 'error');
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
    addOutput('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН');
    addOutput('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР');
    addOutput('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД');
    addInputLine();
});
