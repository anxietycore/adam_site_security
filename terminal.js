// Логика терминала
document.addEventListener('DOMContentLoaded', function() {
    const terminal = document.getElementById('terminal');
    let currentLine = '';
    let commandHistory = [];
    let historyIndex = -1;
    let isTyping = false;

    // Функция для печати текста с анимацией
    function typeText(text, className = 'output', speed = 5) {
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

    // Функция анимации загрузки с прогресс-баром
    function showLoading(duration = 2000, text = "АНАЛИЗ СИГНАЛА") {
        return new Promise((resolve) => {
            const loader = document.createElement('div');
            loader.className = 'output';
            terminal.appendChild(loader);
            
            const progressBar = document.createElement('div');
            progressBar.style.width = '200px';
            progressBar.style.height = '12px';
            progressBar.style.border = '1px solid #00FF41';
            progressBar.style.margin = '5px 0';
            progressBar.style.position = 'relative';
            
            const progressFill = document.createElement('div');
            progressFill.style.height = '100%';
            progressFill.style.background = '#00FF41';
            progressFill.style.width = '0%';
            progressFill.style.transition = 'width 0.1s linear';
            
            progressBar.appendChild(progressFill);
            
            let progress = 0;
            const interval = 50;
            const steps = duration / interval;
            const increment = 100 / steps;
            
            const updateLoader = () => {
                loader.textContent = `${text} [${Math.min(100, Math.round(progress))}%]`;
                loader.appendChild(progressBar);
                progressFill.style.width = `${progress}%`;
                terminal.scrollTop = terminal.scrollHeight;
            };
            
            updateLoader();
            
            const progressInterval = setInterval(() => {
                progress += increment;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(progressInterval);
                    setTimeout(() => {
                        // Убираем прогресс-бар после завершения
                        loader.textContent = `${text} [ЗАВЕРШЕНО]`;
                        terminal.scrollTop = terminal.scrollHeight;
                        setTimeout(resolve, 300);
                    }, 300);
                }
                updateLoader();
            }, interval);
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
                await typeText('Доступные команды:', 'output', 5);
                await typeText('  SYST         — проверить состояние системы', 'output', 2);
                await typeText('  NET          — карта активных узлов проекта', 'output', 2);
                await typeText('  TRACE <id>   — отследить указанный модуль', 'output', 2);
                await typeText('  DECRYPT <f>  — расшифровать файл', 'output', 2);
                await typeText('  REPORT       — список отчётов проекта', 'output', 2);
                await typeText('  SUBJ         — список субъектов', 'output', 2);
                await typeText('  DSCR <id>    — досье на персонал', 'output', 2);
                await typeText('  ARCH         — архив проекта', 'output', 2);
                await typeText('  RESET        — сброс интерфейса', 'output', 2);
                await typeText('  EXIT         — завершить сессию', 'output', 2);
                await typeText('  CLEAR        — очистить терминал', 'output', 2);
                await typeText('------------------------------------', 'output', 1);
                await typeText('ПРИМЕЧАНИЕ: часть команд заблокирована или скрыта.', 'output', 5);
                break;
                
            case 'clear':
                terminal.innerHTML = '';
                await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 5);
                await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 5);
                break;

            case 'syst':
                await typeText('[СТАТУС СИСТЕМЫ — ИНТЕРФЕЙС VIGIL-9]', 'output', 5);
                await typeText('------------------------------------', 'output', 1);
                await typeText('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН', 'output', 3);
                await typeText('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА', 'output', 3);
                await typeText('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН', 'output', 3);
                await typeText('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА', 'output', 3);
                await typeText('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН', 'output', 3);
                await typeText('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ..........ОГРАНИЧЕНЫ', 'output', 3);
                await typeText('', 'output', 2);
                await typeText('ДЕГРАДАЦИЯ: [███▒▒▒▒▒▒▒▒▒▒] 27%', 'output', 5);
                await typeText('ЖУРНАЛ ОШИБОК:', 'output', 5);
                await typeText('> Обнаружено отклонение сигнала', 'output', 8);
                await typeText('> Прогрессирующее структурное разрушение', 'output', 8);
                await typeText('> Неавторизованный доступ [U-735]', 'output', 8);
                await typeText('------------------------------------', 'output', 1);
                await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', 'output', 5);
                break;

            case 'net':
                await typeText('[КАРТА СЕТИ — АКТИВНЫЕ РЕЛЕЙНЫЕ МОДУЛИ]', 'output', 5);
                await typeText('------------------------------------', 'output', 1);
                await typeText('[V9-HX] / МОДУЛЬ: HELIX.................ОТВЕТ НЕСТАБИЛЕН', 'output', 3);
                await typeText('[V9-MR] / МОДУЛЬ: MARS.................ПЕРЕДАЧА ПРЕРВАНА', 'output', 3);
                await typeText('[V9-OR] / МОДУЛЬ: ОРБИТАЛЬНЫЙ РЕЛЕЙ....СИГНАЛ ИСКАЖЁН', 'output', 3);
                await typeText('[V9-LT] / МОДУЛЬ: LITHIUM CORE.........ДОСТУП ОГРАНИЧЕН', 'output', 3);
                await typeText('[V9-TN] / МОДУЛЬ: TERMINAL-9............ОТКЛИК НОРМАЛЬНЫЙ', 'output', 3);
                await typeText('[V9-ML] / МОДУЛЬ: MONOLITH..............АКТИВНОСТЬ: ПОДАВЛЕНА', 'output', 3);
                await typeText('------------------------------------', 'output', 1);
                await typeText('ДОСТУПНЫЕ ЦЕЛИ ДЛЯ TRACE:', 'output', 5);
                await typeText('> TRACE V9-HX', 'output', 8);
                await typeText('> TRACE V9-MR', 'output', 8);
                await typeText('> TRACE V9-LT', 'output', 8);
                await typeText('> TRACE V9-ML', 'output', 8);
                await typeText('------------------------------------', 'output', 1);
                await typeText('СОСТОЯНИЕ СЕТИ: ДЕГРАДИРОВАНО', 'output', 5);
                break;

            case 'trace':
                if (args.length === 0) {
                    await typeText('ОШИБКА: Укажите модуль для отслеживания', 'error', 5);
                    await typeText('Пример: TRACE V9-HX', 'output', 5);
                    break;
                }
                
                const module = args[0].toUpperCase();
                
                switch(module) {
                    case 'V9-HX':
                        await typeText('[ЖУРНАЛ СЛЕЖЕНИЯ — МОДУЛЬ: HELIX]', 'output', 5);
                        await typeText('------------------------------------', 'output', 1);
                        await typeText('СИГНАЛ: ЗАФИКСИРОВАН', 'output', 5);
                        await typeText('ЛОКАЦИЯ: 54.0072°N / 23.0199°E', 'output', 5);
                        await typeText('СТАТУС: АНОМАЛИЯ / БИОАКТИВНОСТЬ', 'output', 5);
                        await typeText('------------------------------------', 'output', 1);
                        await typeText('ПОСЛЕДНЯЯ ПЕРЕДАЧА:', 'output', 5);
                        await typeText('> "матрица биополя изменилась. клетки больше не подчиняются."', 'output', 8);
                        await typeText('> "оператор 04 сообщил, что ткань двигалась после смерти субъекта."', 'output', 8);
                        await typeText('------------------------------------', 'output', 1);
                        await typeText('ПОДКЛЮЧЕНИЕ К АРХИВУ...', 'output', 5);
                        await typeText('> ЗАПИСЬ REPORT-413 [ДОСТУП ОГРАНИЧЕН]', 'output', 8);
                        await showLoading(3000, "ОБНАРУЖЕНА МИКРОАКТИВНОСТЬ В КАНАЛЕ");
                        await typeText('> источник неизвестен', 'output', 8);
                        await typeText('> возможно, остаточный отклик органического интерфейса', 'output', 8);
                        await typeText('------------------------------------', 'output', 1);
                        await typeText('СТАТУС: СИГНАЛ НЕСТАБИЛЕН', 'output', 5);
                        break;
                        
                    case 'V9-MR':
                        await typeText('[ЖУРНАЛ СЛЕЖЕНИЯ — МОДУЛЬ: MARS]', 'output', 5);
                        await typeText('------------------------------------', 'output', 1);
                        await typeText('ИСТОЧНИК СИГНАЛА: 04°N / 136°E', 'output', 5);
                        await typeText('СТАТУС: МЁРТВЫЙ УЗЕЛ', 'output', 5);
                        await typeText('ПОСЛЕДНЯЯ АКТИВНОСТЬ: 213 ДНЕЙ НАЗАД', 'output', 5);
                        await typeText('------------------------------------', 'output', 1);
                        await typeText('ФРАГМЕНТ СООБЩЕНИЯ:', 'output', 5);
                        await typeText('> "...время растянуто. мы не чувствуем тел. свет неподвижен."', 'output', 8);
                        await typeText('> "...идентификатор ADAM/MR-002 перестал отвечать."', 'output', 8);
                        await typeText('------------------------------------', 'output', 1);
                        await showLoading(4000, "ПОПЫТКА ВОССТАНОВЛЕНИЯ ЛОГА");
                        await typeText('> НАЙДЕН ФАЙЛ: /storage/logs/mars413.enc', 'output', 8);
                        await typeText('> Используйте команду: DECRYPT mars413.enc', 'output', 8);
                        await typeText('------------------------------------', 'output', 1);
                        await typeText('ОШИБКА: СЕГМЕНТ ПАМЯТИ ПОВРЕЖДЁН', 'error', 5);
                        await typeText('СИГНАЛ: ПОЛНОСТЬЮ ПОТЕРЯН', 'error', 5);
                        break;
                        
                    case 'V9-LT':
                        await typeText('[ЖУРНАЛ СЛЕЖЕНИЯ — МОДУЛЬ: LITHIUM CORE]', 'output', 5);
                        await typeText('------------------------------------', 'output', 1);
                        await typeText('СОЕДИНЕНИЕ: ПОДТВЕРЖДЕНО', 'output', 5);
                        await typeText('ДОСТУП: ОГРАНИЧЕН / ТОЛЬКО ДЛЯ ТЕХПЕРСОНАЛА', 'output', 5);
                        await typeText('ЭНЕРГЕТИЧЕСКИЙ ПОТОК: НОРМА / НЕСТАБИЛЬНОСТЬ 4%', 'output', 5);
                        await typeText('------------------------------------', 'output', 1);
                        await typeText('СИСТЕМНОЕ СООБЩЕНИЕ:', 'output', 5);
                        await typeText('> "перегрузка по каналу 02C. требуется перезапуск реактора."', 'output', 8);
                        await typeText('> "неопознанный импульс зафиксирован в цикле охлаждения."', 'output', 8);
                        await typeText('------------------------------------', 'output', 1);
                        await showLoading(2500, "ПРОВЕРКА СИГНАЛОВ СВЯЗАННЫХ МОДУЛЕЙ");
                        await typeText('> HELIX — обратная активация', 'output', 8);
                        await typeText('> MONOLITH — связь отсутствует', 'output', 8);
                        await typeText('------------------------------------', 'output', 1);
                        await typeText('СТАТУС: ФУНКЦИОНИРУЕТ С ОТКЛОНЕНИЯМИ', 'output', 5);
                        break;
                        
                    case 'V9-ML':
                        await typeText('[ЖУРНАЛ СЛЕЖЕНИЯ — МОДУЛЬ: MONOLITH]', 'output', 5);
                        await typeText('------------------------------------', 'output', 1);
                        await typeText('СИГНАЛ: СЛАБЫЙ / ИСКАЖЁННЫЙ', 'output', 5);
                        await typeText('ЛОКАЦИЯ: [ДАННЫЕ УДАЛЕНЫ]', 'output', 5);
                        await typeText('АКТИВНОСТЬ: ПОДАВЛЕНА', 'output', 5);
                        await typeText('------------------------------------', 'output', 1);
                        await typeText('ФРАГМЕНТ ОТКЛИКА:', 'output', 5);
                        await typeText('> "……"', 'output', 10);
                        await typeText('> "……мы не камень. мы — память."', 'output', 10);
                        await typeText('> "……верни их внутрь."', 'output', 10);
                        await typeText('------------------------------------', 'output', 1);
                        await showLoading(5000, "ПОПЫТКА АНАЛИЗА СИГНАЛА");
                        await typeText('> тип данных нераспознан', 'output', 8);
                        await typeText('> структура ответа несовместима с протоколом', 'output', 8);
                        await typeText('------------------------------------', 'output', 1);
                        await showLoading(3000, "СИСТЕМА ЗАФИКСИРОВАЛА ВХОДНОЙ ПАКЕТ");
                        await typeText('> неизвестное происхождение', 'output', 8);
                        await typeText('> метка времени: НЕ СООТВЕТСТВУЕТ ТЕКУЩЕЙ', 'output', 8);
                        await typeText('------------------------------------', 'output', 1);
                        await typeText('СТАТУС: ОБЪЕКТ ПРОДОЛЖАЕТ ПЕРЕДАЧУ', 'output', 5);
                        break;
                        
                    default:
                        await typeText(`ОШИБКА: Модуль ${module} не найден`, 'error', 5);
                }
                break;

            case 'decrypt':
                if (args.length === 0) {
                    await typeText('ОШИБКА: Укажите файл для расшифровки', 'error', 5);
                    await typeText('Пример: DECRYPT mars413.enc', 'output', 5);
                    break;
                }
                
                const file = args[0];
                
                if (file === 'mars413.enc') {
                    await typeText('[МОДУЛЬ РАСШИФРОВКИ — СИСТЕМА A.D.A.M / VIGIL-9]', 'output', 5);
                    await typeText('------------------------------------', 'output', 1);
                    await typeText('ФАЙЛ: mars413.enc', 'output', 5);
                    await typeText('ТИП ШИФРА: LATTICE-KEY / SIGMA 19', 'output', 5);
                    await typeText('ПРОГРЕСС: [██████████▒▒▒▒▒▒▒▒] 65%', 'output', 5);
                    await typeText('> частичный ключ подтверждён', 'output', 8);
                    await typeText('> извлечены фрагменты данных', 'output', 8);
                    await typeText('------------------------------------', 'output', 1);
                    await showLoading(6000, "РАСШИФРОВКА ДАННЫХ");
                    await typeText('РАСШИФРОВАННЫЙ ФРАГМЕНТ:', 'output', 5);
                    await typeText('[ОТЧЁТ — ИНЦИДЕНТ MARS]', 'output', 8);
                    await typeText('> "...тела без теней. Освещение исправно. Биосенсоры не фиксируют сигналов."', 'output', 10);
                    await typeText('> "...идентификатор ADAM/MR-002 прекратил отклик через 14 минут после активации..."', 'output', 10);
                    await typeText('------------------------------------', 'output', 1);
                    await typeText('КОНЕЦ ДАННЫХ / ФАЙЛ НЕПОЛОН', 'output', 5);
                } else {
                    await typeText(`ОШИБКА: Файл ${file} не найден или поврежден`, 'error', 5);
                }
                break;

            case 'reset':
                await typeText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', 'output', 5);
                await typeText('------------------------------------', 'output', 1);
                await typeText('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', 'output', 5);
                await typeText('> Подтвердить сброс? (Y/N)', 'output', 8);
                await typeText('------------------------------------', 'output', 1);
                await typeText('> Y', 'output', 10);
                await showLoading(2000, "Завершение активных модулей");
                await showLoading(1500, "Перезапуск интерфейса");
                await showLoading(1000, "Восстановление базового состояния");
                await typeText('------------------------------------', 'output', 1);
                await typeText('[СИСТЕМА ГОТОВА К РАБОТЕ]', 'output', 5);
                break;

            case 'exit':
                await typeText('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ? (Y/N)]', 'output', 5);
                await typeText('------------------------------------', 'output', 1);
                await typeText('> Y', 'output', 10);
                await showLoading(1500, "Завершение работы терминала");
                await showLoading(1000, "Отключение сетевой сессии");
                await typeText('> ...', 'output', 10);
                await typeText('> СОЕДИНЕНИЕ ПРЕРВАНО.', 'output', 10);
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
                break;

            case 'visits':
                const userVisits = localStorage.getItem('adam_visits') || 1;
                await typeText(`ВАШИ ПОСЕЩЕНИЯ СИСТЕМЫ: ${userVisits}`, 'output', 5);
                await typeText('СТАТИСТИКА ПО ВСЕМ ОПЕРАТОРАМ: [ЗАСЕКРЕЧЕНО]', 'output', 5);
                break;
                
            default:
                await typeText(`команда не найдена: ${cmd}`, 'error', 5);
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
        await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 5);
        await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', 'output', 5);
        await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 5);
        addInputLine();
    }, 500);
});
