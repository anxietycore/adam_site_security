// Логика терминала
document.addEventListener('DOMContentLoaded', function() {
    const terminal = document.getElementById('terminal');
    let currentLine = '';
    let commandHistory = [];
    let historyIndex = -1;
    let isTyping = false;

    // Функция для печати текста с анимацией
    function typeText(text, className = 'output', speed = 10) {
        return new Promise((resolve) => {
            const line = document.createElement('div');
            line.className = className;
            terminal.appendChild(line);
            
            let index = 0;
            isTyping = true;
            
            function typeChar() {
                if (index < text.length) {
                    line.textContent += text.charAt(index);
                    index++;
                    terminal.scrollTop = terminal.scrollHeight;
                    setTimeout(typeChar, speed);
                } else {
                    isTyping = false;
                    resolve();
                }
            }
            
            typeChar();
        });
    }

    // Функция для быстрого вывода (без анимации)
    function addOutput(text, className = 'output') {
        const line = document.createElement('div');
        line.className = className;
        line.textContent = text;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Функция анимации загрузки
    function showLoading(duration = 2000, text = "ПОПЫТКА АНАЛИЗА СИГНАЛА") {
        return new Promise((resolve) => {
            const loader = document.createElement('div');
            loader.className = 'output';
            loader.textContent = text;
            terminal.appendChild(loader);
            
            let dots = 0;
            const maxDots = 3;
            const interval = setInterval(() => {
                dots = (dots + 1) % (maxDots + 1);
                loader.textContent = text + ' '.repeat(3) + '.'.repeat(dots);
                terminal.scrollTop = terminal.scrollHeight;
            }, 500);
            
            setTimeout(() => {
                clearInterval(interval);
                resolve();
            }, duration);
        });
    }

    function addInputLine() {
        const spacer = document.createElement('div');
        spacer.style.height = '15px';
        terminal.appendChild(spacer);
        
        const inputLine = document.createElement('div');
        inputLine.className = 'input-line';
        inputLine.innerHTML = '<span class="prompt">adam@secure:~$ </span><span class="cmd" id="currentCmd"></span><span class="cursor" id="cursor">_</span>';
        terminal.appendChild(inputLine);
        
        terminal.scrollTop = terminal.scrollHeight;
    }

    async function processCommand(cmd) {
        if (isTyping) return;
        
        // Удаляем старую строку ввода
        const oldInput = document.querySelector('.input-line');
        if (oldInput) oldInput.remove();

        // Добавляем в историю
        commandHistory.push(cmd);
        historyIndex = commandHistory.length;

        // Показываем введённую команду
        addOutput(`adam@secure:~$ ${cmd}`, 'command');

        // Обрабатываем команду
        const command = cmd.toLowerCase().split(' ')[0];
        const args = cmd.toLowerCase().split(' ').slice(1);
        
        switch(command) {
            case 'help':
                await typeText('Доступные команды:', 'output', 20);
                await typeText('  SYST         — проверить состояние системы', 'output', 10);
                await typeText('  NET          — карта активных узлов проекта', 'output', 10);
                await typeText('  TRACE <id>   — отследить указанный модуль', 'output', 10);
                await typeText('  DECRYPT <f>  — расшифровать файл', 'output', 10);
                await typeText('  REPORT       — список отчётов проекта', 'output', 10);
                await typeText('  SUBJ         — список субъектов', 'output', 10);
                await typeText('  DSCR <id>    — досье на персонал', 'output', 10);
                await typeText('  ARCH         — архив проекта', 'output', 10);
                await typeText('  RESET        — сброс интерфейса', 'output', 10);
                await typeText('  EXIT         — завершить сессию', 'output', 10);
                await typeText('  CLEAR        — очистить терминал', 'output', 10);
                await typeText('------------------------------------', 'output', 5);
                await typeText('ПРИМЕЧАНИЕ: часть команд заблокирована или скрыта.', 'output', 20);
                break;
                
            case 'clear':
                terminal.innerHTML = '';
                await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 20);
                await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 20);
                break;

            case 'syst':
                await typeText('[СТАТУС СИСТЕМЫ — ИНТЕРФЕЙС VIGIL-9]', 'output', 20);
                await typeText('------------------------------------', 'output', 5);
                await typeText('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН', 'output', 15);
                await typeText('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА', 'output', 15);
                await typeText('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН', 'output', 15);
                await typeText('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА', 'output', 15);
                await typeText('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН', 'output', 15);
                await typeText('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ..........ОГРАНИЧЕНЫ', 'output', 15);
                await typeText('', 'output', 10);
                await typeText('ДЕГРАДАЦИЯ: [███▒▒▒▒▒▒▒▒▒▒] 27%', 'output', 20);
                await typeText('ЖУРНАЛ ОШИБОК:', 'output', 20);
                await typeText('> Обнаружено отклонение сигнала', 'output', 25);
                await typeText('> Прогрессирующее структурное разрушение', 'output', 25);
                await typeText('> Неавторизованный доступ [U-735]', 'output', 25);
                await typeText('------------------------------------', 'output', 5);
                await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', 'output', 20);
                break;

            case 'net':
                await typeText('[КАРТА СЕТИ — АКТИВНЫЕ РЕЛЕЙНЫЕ МОДУЛИ]', 'output', 20);
                await typeText('------------------------------------', 'output', 5);
                await typeText('[V9-HX] / МОДУЛЬ: HELIX.................ОТВЕТ НЕСТАБИЛЕН', 'output', 15);
                await typeText('[V9-MR] / МОДУЛЬ: MARS.................ПЕРЕДАЧА ПРЕРВАНА', 'output', 15);
                await typeText('[V9-OR] / МОДУЛЬ: ОРБИТАЛЬНЫЙ РЕЛЕЙ....СИГНАЛ ИСКАЖЁН', 'output', 15);
                await typeText('[V9-LT] / МОДУЛЬ: LITHIUM CORE.........ДОСТУП ОГРАНИЧЕН', 'output', 15);
                await typeText('[V9-TN] / МОДУЛЬ: TERMINAL-9............ОТКЛИК НОРМАЛЬНЫЙ', 'output', 15);
                await typeText('[V9-ML] / МОДУЛЬ: MONOLITH..............АКТИВНОСТЬ: ПОДАВЛЕНА', 'output', 15);
                await typeText('------------------------------------', 'output', 5);
                await typeText('ДОСТУПНЫЕ ЦЕЛИ ДЛЯ TRACE:', 'output', 20);
                await typeText('> TRACE V9-HX', 'output', 25);
                await typeText('> TRACE V9-MR', 'output', 25);
                await typeText('> TRACE V9-LT', 'output', 25);
                await typeText('> TRACE V9-ML', 'output', 25);
                await typeText('------------------------------------', 'output', 5);
                await typeText('СОСТОЯНИЕ СЕТИ: ДЕГРАДИРОВАНО', 'output', 20);
                break;

            case 'trace':
                if (args.length === 0) {
                    await typeText('ОШИБКА: Укажите модуль для отслеживания', 'error', 20);
                    await typeText('Пример: TRACE V9-HX', 'output', 20);
                    break;
                }
                
                const module = args[0].toUpperCase();
                
                switch(module) {
                    case 'V9-HX':
                        await typeText('[ЖУРНАЛ СЛЕЖЕНИЯ — МОДУЛЬ: HELIX]', 'output', 20);
                        await typeText('------------------------------------', 'output', 5);
                        await typeText('СИГНАЛ: ЗАФИКСИРОВАН', 'output', 20);
                        await typeText('ЛОКАЦИЯ: 54.0072°N / 23.0199°E', 'output', 20);
                        await typeText('СТАТУС: АНОМАЛИЯ / БИОАКТИВНОСТЬ', 'output', 20);
                        await typeText('------------------------------------', 'output', 5);
                        await typeText('ПОСЛЕДНЯЯ ПЕРЕДАЧА:', 'output', 20);
                        await typeText('> "матрица биополя изменилась. клетки больше не подчиняются."', 'output', 25);
                        await typeText('> "оператор 04 сообщил, что ткань двигалась после смерти субъекта."', 'output', 25);
                        await typeText('------------------------------------', 'output', 5);
                        await typeText('ПОДКЛЮЧЕНИЕ К АРХИВУ...', 'output', 20);
                        await typeText('> ЗАПИСЬ REPORT-413 [ДОСТУП ОГРАНИЧЕН]', 'output', 25);
                        await showLoading(3000, "ОБНАРУЖЕНА МИКРОАКТИВНОСТЬ В КАНАЛЕ");
                        await typeText('> источник неизвестен', 'output', 25);
                        await typeText('> возможно, остаточный отклик органического интерфейса', 'output', 25);
                        await typeText('------------------------------------', 'output', 5);
                        await typeText('СТАТУС: СИГНАЛ НЕСТАБИЛЕН', 'output', 20);
                        break;
                        
                    case 'V9-MR':
                        await typeText('[ЖУРНАЛ СЛЕЖЕНИЯ — МОДУЛЬ: MARS]', 'output', 20);
                        await typeText('------------------------------------', 'output', 5);
                        await typeText('ИСТОЧНИК СИГНАЛА: 04°N / 136°E', 'output', 20);
                        await typeText('СТАТУС: МЁРТВЫЙ УЗЕЛ', 'output', 20);
                        await typeText('ПОСЛЕДНЯЯ АКТИВНОСТЬ: 213 ДНЕЙ НАЗАД', 'output', 20);
                        await typeText('------------------------------------', 'output', 5);
                        await typeText('ФРАГМЕНТ СООБЩЕНИЯ:', 'output', 20);
                        await typeText('> "...время растянуто. мы не чувствуем тел. свет неподвижен."', 'output', 25);
                        await typeText('> "...идентификатор ADAM/MR-002 перестал отвечать."', 'output', 25);
                        await typeText('------------------------------------', 'output', 5);
                        await showLoading(4000, "ПОПЫТКА ВОССТАНОВЛЕНИЯ ЛОГА");
                        await typeText('> НАЙДЕН ФАЙЛ: /storage/logs/mars413.enc', 'output', 25);
                        await typeText('> Используйте команду: DECRYPT mars413.enc', 'output', 25);
                        await typeText('------------------------------------', 'output', 5);
                        await typeText('ОШИБКА: СЕГМЕНТ ПАМЯТИ ПОВРЕЖДЁН', 'error', 20);
                        await typeText('СИГНАЛ: ПОЛНОСТЬЮ ПОТЕРЯН', 'error', 20);
                        break;
                        
                    case 'V9-LT':
                        await typeText('[ЖУРНАЛ СЛЕЖЕНИЯ — МОДУЛЬ: LITHIUM CORE]', 'output', 20);
                        await typeText('------------------------------------', 'output', 5);
                        await typeText('СОЕДИНЕНИЕ: ПОДТВЕРЖДЕНО', 'output', 20);
                        await typeText('ДОСТУП: ОГРАНИЧЕН / ТОЛЬКО ДЛЯ ТЕХПЕРСОНАЛА', 'output', 20);
                        await typeText('ЭНЕРГЕТИЧЕСКИЙ ПОТОК: НОРМА / НЕСТАБИЛЬНОСТЬ 4%', 'output', 20);
                        await typeText('------------------------------------', 'output', 5);
                        await typeText('СИСТЕМНОЕ СООБЩЕНИЕ:', 'output', 20);
                        await typeText('> "перегрузка по каналу 02C. требуется перезапуск реактора."', 'output', 25);
                        await typeText('> "неопознанный импульс зафиксирован в цикле охлаждения."', 'output', 25);
                        await typeText('------------------------------------', 'output', 5);
                        await showLoading(2500, "ПРОВЕРКА СИГНАЛОВ СВЯЗАННЫХ МОДУЛЕЙ");
                        await typeText('> HELIX — обратная активация', 'output', 25);
                        await typeText('> MONOLITH — связь отсутствует', 'output', 25);
                        await typeText('------------------------------------', 'output', 5);
                        await typeText('СТАТУС: ФУНКЦИОНИРУЕТ С ОТКЛОНЕНИЯМИ', 'output', 20);
                        break;
                        
                    case 'V9-ML':
                        await typeText('[ЖУРНАЛ СЛЕЖЕНИЯ — МОДУЛЬ: MONOLITH]', 'output', 20);
                        await typeText('------------------------------------', 'output', 5);
                        await typeText('СИГНАЛ: СЛАБЫЙ / ИСКАЖЁННЫЙ', 'output', 20);
                        await typeText('ЛОКАЦИЯ: [ДАННЫЕ УДАЛЕНЫ]', 'output', 20);
                        await typeText('АКТИВНОСТЬ: ПОДАВЛЕНА', 'output', 20);
                        await typeText('------------------------------------', 'output', 5);
                        await typeText('ФРАГМЕНТ ОТКЛИКА:', 'output', 20);
                        await typeText('> "……"', 'output', 30);
                        await typeText('> "……мы не камень. мы — память."', 'output', 30);
                        await typeText('> "……верни их внутрь."', 'output', 30);
                        await typeText('------------------------------------', 'output', 5);
                        await showLoading(5000, "ПОПЫТКА АНАЛИЗА СИГНАЛА");
                        await typeText('> тип данных нераспознан', 'output', 25);
                        await typeText('> структура ответа несовместима с протоколом', 'output', 25);
                        await typeText('------------------------------------', 'output', 5);
                        await showLoading(3000, "СИСТЕМА ЗАФИКСИРОВАЛА ВХОДНОЙ ПАКЕТ");
                        await typeText('> неизвестное происхождение', 'output', 25);
                        await typeText('> метка времени: НЕ СООТВЕТСТВУЕТ ТЕКУЩЕЙ', 'output', 25);
                        await typeText('------------------------------------', 'output', 5);
                        await typeText('СТАТУС: ОБЪЕКТ ПРОДОЛЖАЕТ ПЕРЕДАЧУ', 'output', 20);
                        break;
                        
                    default:
                        await typeText(`ОШИБКА: Модуль ${module} не найден`, 'error', 20);
                }
                break;

            case 'decrypt':
                if (args.length === 0) {
                    await typeText('ОШИБКА: Укажите файл для расшифровки', 'error', 20);
                    await typeText('Пример: DECRYPT mars413.enc', 'output', 20);
                    break;
                }
                
                const file = args[0];
                
                if (file === 'mars413.enc') {
                    await typeText('[МОДУЛЬ РАСШИФРОВКИ — СИСТЕМА A.D.A.M / VIGIL-9]', 'output', 20);
                    await typeText('------------------------------------', 'output', 5);
                    await typeText('ФАЙЛ: mars413.enc', 'output', 20);
                    await typeText('ТИП ШИФРА: LATTICE-KEY / SIGMA 19', 'output', 20);
                    await typeText('ПРОГРЕСС: [██████████▒▒▒▒▒▒▒▒] 65%', 'output', 20);
                    await typeText('> частичный ключ подтверждён', 'output', 25);
                    await typeText('> извлечены фрагменты данных', 'output', 25);
                    await typeText('------------------------------------', 'output', 5);
                    await showLoading(6000, "РАСШИФРОВКА ДАННЫХ");
                    await typeText('РАСШИФРОВАННЫЙ ФРАГМЕНТ:', 'output', 20);
                    await typeText('[ОТЧЁТ — ИНЦИДЕНТ MARS]', 'output', 25);
                    await typeText('> "...тела без теней. Освещение исправно. Биосенсоры не фиксируют сигналов."', 'output', 30);
                    await typeText('> "...идентификатор ADAM/MR-002 прекратил отклик через 14 минут после активации..."', 'output', 30);
                    await typeText('------------------------------------', 'output', 5);
                    await typeText('КОНЕЦ ДАННЫХ / ФАЙЛ НЕПОЛОН', 'output', 20);
                } else {
                    await typeText(`ОШИБКА: Файл ${file} не найден или поврежден`, 'error', 20);
                }
                break;

            case 'reset':
                await typeText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', 'output', 20);
                await typeText('------------------------------------', 'output', 5);
                await typeText('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', 'output', 20);
                await typeText('> Подтвердить сброс? (Y/N)', 'output', 25);
                await typeText('------------------------------------', 'output', 5);
                await typeText('> Y', 'output', 30);
                await showLoading(2000, "Завершение активных модулей");
                await showLoading(1500, "Перезапуск интерфейса");
                await showLoading(1000, "Восстановление базового состояния");
                await typeText('------------------------------------', 'output', 5);
                await typeText('[СИСТЕМА ГОТОВА К РАБОТЕ]', 'output', 20);
                break;

            case 'exit':
                await typeText('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ? (Y/N)]', 'output', 20);
                await typeText('------------------------------------', 'output', 5);
                await typeText('> Y', 'output', 30);
                await showLoading(1500, "Завершение работы терминала");
                await showLoading(1000, "Отключение сетевой сессии");
                await typeText('> ...', 'output', 30);
                await typeText('> СОЕДИНЕНИЕ ПРЕРВАНО.', 'output', 30);
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
                break;

            case 'visits':
                const userVisits = localStorage.getItem('adam_visits') || 1;
                await typeText(`ВАШИ ПОСЕЩЕНИЯ СИСТЕМЫ: ${userVisits}`, 'output', 20);
                await typeText('СТАТИСТИКА ПО ВСЕМ ОПЕРАТОРАМ: [ЗАСЕКРЕЧЕНО]', 'output', 20);
                break;
                
            default:
                await typeText(`команда не найдена: ${cmd}`, 'error', 20);
        }
        
        // Добавляем новую строку для ввода
        addInputLine();
    }

    // Обработка ввода
    document.addEventListener('keydown', function(e) {
        if (isTyping) return;
        
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
    setTimeout(async () => {
        await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 20);
        await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', 'output', 20);
        await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 20);
        addInputLine();
    }, 500);
});
