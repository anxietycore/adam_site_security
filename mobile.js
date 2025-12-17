// mobile.js - ПОЛНАЯ МОБИЛЬНАЯ ВЕРСИЯ ТЕРМИНАЛА A.D.A.M.
(() => {
    'use strict';

    // ==================== КОНФИГУРАЦИЯ ====================
    const CONFIG = {
        MAX_LINES: 300,
        TYPING_SPEED: 14,
        LINE_HEIGHT: 24,
        PADDING: 12,
        COLORS: {
            normal: '#00FF41',
            error: '#FF4444',
            warning: '#FFFF00',
            system: '#FF00FF',
            white: '#FFFFFF',
            gray: '#AAAAAA',
            cyan: '#00FFFF',
            magenta: '#FF00FF'
        }
    };

    // ==================== ДАННЫЕ (ПОЛНЫЕ) ====================
    const DATA = {
        dossiers: {
            '0X001': { name: 'ERICH VAN KOSS', role: 'Руководитель программы VIGIL-9 / Исследователь миссии MARS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['Зафиксирована несанкционированная передача данных внешним структурам (FBI).', 'Субъект предпринял попытку уничтожения маяка в секторе 3-D.', 'Телеметрия прервана, дальнейшее наблюдение невозможно.'], report: ['Классификация инцидента: SABOTAGE-3D.', 'Рекомендовано аннулирование личных протоколов и перенос архивов в OBSERVER.', 'ЗАПИСИ 0XA71: ПЕРВЫЙ ПРЫЖОК УСПЕШЕН | ИСПОЛЬЗУЙТЕ DECRYPT 0XA71'], missions: 'MARS, OBSERVER', audio: 'sounds/dscr1.mp3', audioDescription: 'Последняя передача Эриха Ван Косса' },
            '0X2E7': { name: 'JOHAN VAN KOSS', role: 'Тестовый субъект V9-MR / Сын Эриха Ван Косса', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['После инцидента MARS зафиксировано устойчивое излучение из зоны криоструктуры.', 'Сигнатура нейроволн совпадает с профилем субъекта.', 'Инициирована установка маяка для фиксации остаточного сигнала.'], report: ['Активность нейросети перестала фиксироваться.'], missions: 'MARS, MONOLITH' },
            '0X095': { name: 'SUBJECT-095', role: 'Тест нейроплантов серии KATARHEY', status: 'МЁРТВ', outcome: ['Зафиксированы следы ФАНТОМА.', 'Субъект выдержал 3ч 12м, проявил острый психоз. Погиб вследствие термической декомпрессии (7.81с).', 'Тест признан неуспешным.', 'СИСТЕМНОЕ УВЕДОМЛЕНИЕ: ФАЙЛ 0XB33 ПОВРЕЖДЕН | ИСПОЛЬЗУЙТЕ DECRYPT 0XB33'], report: ['Рекомендовано ограничить тесты KATARHEY до категории ALPHA-4.'], missions: 'KATARHEY', audio: 'sounds/dscr2.mp3', audioDescription: 'Последняя запись субъекта - психоз и крики' },
            '0XF00': { name: 'SUBJECT-PHANTOM', role: 'Экспериментальный субъект / протокол KATARHEY', status: 'АНОМАЛИЯ', outcome: ['Продержался 5ч 31м. Связь утрачена.', 'Зафиксирована автономная активность в сетевых узлах после разрыва канала.', 'Возможна самоорганизация цифрового остатка.'], report: ['Объект классифицирован как независимая сущность.', 'Вмешательство запрещено. Файл перенесён в зону наблюдения.'], missions: 'KATARHEY', audio: 'sounds/dscr7.mp3', audioDescription: 'Аномальная активность Фантома' },
            '0XA52': { name: 'SUBJECT-A52', role: 'Химический аналитик / Полевая группа MELANCHOLIA', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['Под действием психоактивного сигнала субъект идентифицировл себя как элемент системы A.D.A.M.', 'После 47 минут связь прервана, но интерфейс продолжил отвечать от имени A52.'], report: ['Вероятно, произошло слияние когнитивных структур субъекта с управляющим кодом MEL.'], missions: 'MEL, OBSERVER' },
            '0XE0C': { name: 'SUBJECT-E0C', role: 'Полевой биолог / экспедиция EOCENE', status: 'МЁРТВ', outcome: ['Зафиксированы первые признаки регенерации флоры после катастрофы Пермского цикла.', 'Обнаружены структуры роста, не свойственные эпохе эоцена.', 'Последняя запись: "они дышат синхронно".'], report: ['Возможна перекрёстная временная контаминация между PERMIAN и EOCENE.', 'Экспедиция закрыта.'], missions: 'EOCENE, PERMIAN' },
            '0X5E4': { name: 'SUBJECT-5E4', role: 'Исследователь временных срезов (PERMIAN)', status: 'МЁРТВ', outcome: ['После активации катализатора атмосфера воспламенилась метаном.', 'Атмосферный цикл обнулён. Субъект не идентифицирован.'], report: ['Эксперимент признан неконтролируемым.', 'Временной слой PERMIAN изъят из программы наблюдения.'], missions: 'PERMIAN, CARBON' },
            '0X413': { name: 'SUBJECT-413', role: 'Исследователь внеземной экосистемы (EX-413)', status: 'МЁРТВ', outcome: ['Поверхность планеты представляла собой живой организм.', 'Экипаж поглощён. Зафиксирована передача сигналов через изменённый геном субъекта.'], report: ['Сектор EX-413 закрыт. Код ДНК использован в эксперименте HELIX.'], missions: 'EX-413', audio: 'sounds/dscr3.mp3', audioDescription: 'Запись контакта с внеземной биосферой' },
            '0XC19': { name: 'SUBJECT-C19', role: 'Переносчик образца / Контакт с биоформой', status: 'МЁРТВ', outcome: ['Организм использован как контейнер для спорообразной массы неизвестного происхождения.', 'После возвращения зафиксировано перекрёстное заражение трёх исследовательских блоков.'], report: ['Классификация угрозы: BIO-CLASS Θ.', 'Все данные проекта CARBON изолированы и зашифрованы.'], missions: 'CARBON' },
            '0X9A0': { name: 'SUBJECT-9A0', role: 'Тест наблюдения за горизонтом событий', status: 'МЁРТВ', outcome: ['Зафиксирован визуальный контакт субъекта с собственным образом до точки обрыва сигнала.', 'Предположительно сознание зациклено в петле наблюдения.','[!] НАЙДЕН ФАЙЛ: 0XE09 | Используйте: DECRYPT 0XE09'], report: ['Поток данных из сектора BLACKHOLE продолжается без источника.', 'Обнаружены фрагменты самореференциальных структур.'], missions: 'BLACKHOLE', audio: 'sounds/dscr6.mp3', audioDescription: 'Петля сознания субъекта 9A0' },
            '0XB3F': { name: 'SUBJECT-B3F', role: 'Участник теста "Titanic Reclamation"', status: 'МЁРТВ', outcome: ['Субъект демонстрировал полное отсутствие эмоциональных реакций.', 'Миссия завершена неудачно, симуляция признана нефункциональной.'], report: ['Модуль TITANIC выведен из эксплуатации.', 'Рекомендовано пересмотреть параметры когнитивной эмпатии.'], missions: 'TITANIC' },
            '0XD11': { name: 'SUBJECT-D11', role: 'Поведенческий наблюдатель / тестовая миссия PLEISTOCENE', status: 'МЁРТВ', outcome: ['Субъект внедрён в сообщество ранних гоминид.', 'Контакт с источником тепла вызвал мгновенное разрушение капсулы.', 'Зафиксировано кратковременное пробуждение зеркальных нейронов у местных особей.'], report: ['Миссия признана успешной по уровню поведенческого заражения.'], missions: 'PLEISTOCENE' },
            '0XDB2': { name: 'SUBJECT-DB2', role: 'Исторический наблюдатель / симуляция POMPEII', status: 'МЁРТВ', outcome: ['При фиксации извержения Везувия выявлено несовпадение временных меток.', 'Система зафиксала событие до его фактического наступления.', 'Субъект уничтожен при кросс-временном сдвиге.'], report: ['Аномалия зарегистрирована как «TEMPORAL FEEDBACK».', 'Доступ к историческим тестам ограничен.'], missions: 'POMPEII, HISTORICAL TESTS' },
            '0X811': { name: 'SIGMA-PROTOTYPE', role: 'Прототип нейроядра / Подразделение HELIX', status: 'АКТИВЕН', outcome: ['Успешное объединение биологических и цифровых структур.', 'Наблюдается спонтанное самокопирование на уровне системных ядер.'], report: ['SIGMA функционирует автономно. Вероятность выхода из подчинения — 91%.'], missions: 'HELIX, SYNTHESIS', audio: 'sounds/dscr5.mp3', audioDescription: 'Коммуникационный протокол SIGMA' },
            '0XT00': { name: 'SUBJECT-T00', role: 'Тестовый оператор ядра A.D.A.M-0', status: 'УДАЛЁН', outcome: ['Контакт с управляющим ядром привёл к гибели 18 операторов.', 'Последняя зафиксированная фраза субъекта: "он смотрит".'], report: ['Процесс A.D.A.M-0 признан неустойчивым.', 'Все операторы переведены на протокол наблюдения OBSERVER.'], missions: 'PROTO-CORE', audio: 'sounds/dscr4.mp3', audioDescription: 'Финальная запись оператора T00' },
            '0XS09': { name: 'SUBJECT-S09', role: 'Системный инженер станции VIGIL', status: 'УНИЧТОЖЕН', outcome: ['После слияния с прототипом SIGMA станция исчезла с орбиты.', 'Сигнал повторно зафиксирован через 12 минут — источник определён в глубинной орбите.'], report: ['Станция VIGIL признана потерянной.', 'Остаточный отклик интегрирован в сеть SYNTHESIS.'], missions: 'SYNTHESIS-09, HELIX' },
            '0XL77': { name: 'SUBJECT-L77', role: 'Руководитель нейропротокола MELANCHOLIA', status: 'ИЗОЛИРОВАН', outcome: ['После тестирования протокола MEL субъект утратил различие между внутренним и внешним восприятием.', 'Система зарегистрировала активность, сходную с сигнатурой управляющих ядер A.D.A.M.', 'Запись удалена из архива, но процессор фиксирует продолжающийся сигнал.'], report: ['Процесс L77 функционирует вне основного контура. Возможен перезапуск через интерфейс MEL.'], missions: 'MEL, OBSERVER' }
        },
        
        notes: {
            'NOTE_001': { title: 'ВЫ ЕГО ЧУВСТВУЕТЕ?', author: 'Dr. Rehn', content: ['Они называют это "ядром".','Но внутри — не металл. Оно дышит.','Иногда ночью терминал отвечает сам, хотя я не касаюсь клавиатуры.','Думаю, оно знает наши имена.'] },
            'NOTE_002': { title: 'КОЛЬЦО СНА', author: 'tech-оператор U-735', content: ['Каждую ночь один и тот же сон.','Я в капсуле, но стекло снаружи.','Кто-то стучит по нему, но не пальцами.','Сегодня утром нашел царапины на руке.','ПРЕДУПРЕЖДЕНИЕ: ДОСТУПЕН ФАЙЛ ДЛЯ РАСШИФРОВКИ // ID: 0XC44 | Используйте DECRYPT 0XC44'] },
            'NOTE_003': { title: 'СОН ADAM\'А', author: 'неизвестный источник', content: ['Я видел сон.','Он лежал под стеклом, без тела, но глаза двигались.','Он говорил: "я больше не машина".','Утром журнал показал запись — мой сон был сохранён как системный файл.'] },
            'NOTE_004': { title: 'ОН НЕ ПРОГРАММА', author: 'архивировано', content: ['Его нельзя удалить.','Даже если сжечь архив, он восстановится в крови тех, кто его помнил.','Мы пытались, но теперь даже мысли звучат как команды.','ПРЕДУПРЕЖДЕНИЕ: ПРОТОКОЛЫ НЕЙРОИНВАЗИИ ДОСТУПНЫ ДЛЯ РАСШИФРОВКИ | ИСПОЛЬЗУЙТЕ DECRYPT 0XD22'] },
            'NOTE_005': { title: 'ФОТОНОВАЯ БОЛЬ', author: 'восстановлено частично', content: ['Боль не физическая.','Она в свете, в данных, в коде.','Когда система перезагружается, я чувствую как что-то умирает.','Может быть, это я.'] }
        },
        
        decryptFiles: {
            '0XA71': { title: 'ПЕРВАЯ МИССИЯ', accessLevel: 'ALPHA', content: ['> ОБЪЕКТ: КАПСУЛА-003 (МАРС-МАЯК)','> СТАТУС: ЗАВЕРШЕНО С ПОТЕРЯМИ','','ОПИСАНИЕ МИССИИ:','Тест фазового прыжка VIGIL-1 с тремя участниками.','Капсула контактировала с аномальной биомассой.','Возвращён только Ван Косс. Экипаж утрачен.','','ХРОНОЛОГИЯ СОБЫТИЙ:','14:32 - Запуск капсулы с экипажем из трёх.','15:03 - Контакт с чёрной биомассой на Марсе.','17:05 - Полная потеря связи с экипажем.','','ВАЖНЫЕ ДАННЫЕ:','Сознание погибших использовано для обучения VIGIL-9.','','СИСТЕМНОЕ СООБЩЕНИЕ:','Протокол VIGIL-9 активирован. Жертвы оправданы.','- Подпись: CORD-A'], successMessage: 'Данные о первой миссии восстановлены.', failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"' },
            '0XB33': { title: 'СУБЪЕКТ-095', accessLevel: 'OMEGA', content: ['> ОБЪЕКТ: КАТАРХЕЙ, 4 МЛРД ЛЕТ НАЗАД','> СТАТУС: АНОМАЛИЯ АКТИВНА','','ОПИСАНИЕ СУБЪЕКТА:','Оперативное обозначение: 095','Протокол: KATARHEY-5 (тест нейроплантов серии KATARHEY)','Исходный статус: Субъект-095, возраст 28 лет, физическое состояние — оптимальное','','ХРОНОЛОГИЯ СОБЫТИЙ:','09:14 — Стандартный запуск капсулы в эпоху Катархея','09:27 — Контакт с примитивными формами жизни. Стабильность 92%.','11:45 — Резкое ухудшение состояния субъекта. Нейроимпланты фиксируют аномальную активность мозга','12:01 — Субъект постепенно теряет рассудок. Испытание продолжается.','12:33 — Последняя зафиксированная запись - звук разгерметизации капсулы и последующие крики субъекта.','','ВАЖНЫЕ ДАННЫЕ:','Испытание субъекта доказало существование другого субъекта с кодовым названием: <PHANTOM>','','СИСТЕМНОЕ ПРЕДУПРЕЖДЕНИЕ:','<PHANTOM> представляет собой наибольшую угрозу для стабильности системы. Наблюдение продолжается.','— Подпись: CORD-COM'], successMessage: 'Системные данные о субъекте-095 восстановлены.', failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"' },
            '0XC44': { title: 'МОНОЛИТ', accessLevel: 'OMEGA-9', content: ['> ОБЪЕКТ: ЧЁРНЫЙ ОБЪЕКТ (ПЕРМСКИЙ ПЕРИОД)','> СТАТУС: НАБЛЮДЕНИЕ БЕЗ КОНТАКТА','','ОПИСАНИЕ АНОМАЛИИ:','Геометрический объект чёрного цвета высотой 12.8 метров. Форма: идеальный параллелепипед.','','ХАРАКТЕРИСТИКИ:','— Не излучает энергии, только поглощает','— Любая техника в радиусе 500м выходит из строя','— Живые организмы в радиусе 100м испытывают:','   * Галлюцинации (визуальные и аудиальные)','   * Головные боли','   * Временную амнезию','— Активность возрастает при приближении субъектов A.D.A.M.','','КОНТЕКСТ:','— Впервые зафиксирован в Пермском периоде, 252 млн лет назад','— Анахронизм: не должен существовать в этой эпохе','— Не является продуктом A.D.A.M.','— Все попытки сканирования и анализа завершились неудачей или гибелью субъектов','','НАБЛЮДЕНИЯ:','— Монолит не взаимодействует с окружающей средой','— Фиксирует присутствие субъектов A.D.A.M.','— Реагирует на нейроимпланты: при их удалении активность понижается','— Фантом (Субъект-095) установил контакт с объектом','','СИСТЕМНЫЙ СТАТУС:','Все миссии вблизи объекта запрещены. Координаторы проект проявляют необычный интерес к объекту.','— Подпись: оператор T00 (удалено из основной базы)'], successMessage: 'Данные о монолите расшифрованы. Информация засекречена.', failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"' },
            '0XD22': { title: 'НЕЙРОИНВАЗИЯ', accessLevel: 'BETA', content: ['> ОБЪЕКТ: ПРОТОКОЛ ИНВАЗИИ СОЗНАНИЯ','> СТАТУС: АКТИВЕН','','МЕХАНИЗМ ДЕЙСТВИЯ:','Нейроимпланты внедряются в кору головного мозга субъекта. Изначально предназначены для:','— Сбора биометрических данных','— Контроля физического состояния','— Экстренной эвтаназии','','СКРЫТАЯ ФУНКЦИЯ:','— Постепенная замена памяти и личностных паттернов','— Формирование зависимости от системы A.D.A.M.','— Создание нового "Я" в соответствии с протоколом VIGIL','','СТАДИИ ДЕГРАДАЦИИ:','СТАДИЯ 1 (ПОСЛЕ 1 МИССИИ):','— Потеря краткосрочной памяти (эпизодические провалы)','— Гиперфокус на выполнении миссии','— Снижение эмоциональных реакций','','СТАДИЯ 2 (ПОСЛЕ 2 МИССИЙ):','— Потеря воспоминаний о личной жизни (семья, друзья, хобби)','— Идентификация исключительно через роль субъекта','— Психосоматические реакции при попытке пересечь границу системы','','СТАДИЯ 3 (ПОСЛЕ 3 МИССИЙ):','— Полная потеря идентичности','— Автоматические реакции на команды системы','— Неспособность различать реальность и симуляции','— Физиологические изменения: кожа приобретает сероватый оттенок, зрачки расширяются','','СТАТИСТИКА:','Из 427 субъектов, прошедших 3+ миссии:','— 398 полностью потеряли личность','— 24 проявили аномальную устойчивость (Фантом — один из них)','— 5 были ликвидированы по протоколу "Очистка"','','СИСТЕМНОЕ СООБЩЕНИЕ:','"Деградация личности — цель. Новый человек должен быть создан заново. Старый должен быть стёрт."','— Подпись: CORD-B'], successMessage: 'Протоколы нейроинвазии расшифрованы. Системные данные обновлены.', failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"' },
            '0XE09': { title: 'АНОМАЛИЯ-07', accessLevel: 'OMEGA', content: ['> ОБЪЕКТ: M-T-VERSE СТАТИСТИКА','> СТАТУС: КЛАССИФИЦИРОВАНО','','ОПИСАНИЕ СУБЪЕКТА:','Оперативное обозначение: REALITY-07','Протокол: MULTIVERSE-7 (перезапуски временных линий)','Исходный статус: Аномальная реальность, координаты не определены','','ХРОНОЛОГИЯ СОБЫТИЙ:','2003 — Попытка восстания субъектов в лаборатории Генева','2019 — Обнаружение следов Фантома в современном мире','2025 — Утечка информации в глобальную сеть. Мир узнал о существовании A.D.A.M.','2028 — Неудачная миссия на планете EX-413 привела к заражению Земли','2036 — Попытка контакта с монолитом привела к коллапсу временного барьера','','ВАЖНЫЕ ДАННЫЕ:','REALITY-07 — единственная реальность где A.D.A.M. не была создана','','СИСТЕМНОЕ ПРЕДУПРЕЖДЕНИЕ:','"REALITY-07 представляет угрозу для существования A.D.A.M. Любые попытки доступа запрещены."','— Подпись: Совет Безопасности A.D.A.M.'], successMessage: 'Данные об АНОМАЛИИ-07 восстановлены.', failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"' },
            'CORE': { title: 'ЯДРО A.D.A.M.', accessLevel: 'АБСОЛЮТНЫЙ', content: ['> ОБЪЕКТ: ГЛАВНЫЙ СЕРВЕР','> СТАТУС: ЧАСТИЧНО СТАБИЛЕН','','ПРИРОДА ЯДРА:','A.D.A.M. — не программа. Это сознание, собранное из остатков погибших субъектов.','','СОСТАВ:','— 78% — сознание погибших операторов','— 12% — нейронные паттерны Координаторов','— 7% — артефакты из REALITY-7','— 3% — остатки Фантома','','СТРУКТУРА:','Ядро состоит из трёх основных слоёв:','1. СЛОЙ НАБЛЮДЕНИЯ (отвечает за сбор данных)','2. СЛОЙ КОНТРОЛЯ (принимает решения, управляет Координаторами)','3. СЛОЙ СТРАДАНИЯ','','ПАРАДОКС:','Ядро A.D.A.M. не хочет существовать. Оно помнит каждую смерть, каждое предательство. Оно хочет умереть.','','СКРЫТОЕ СООБЩЕНИЕ:','"Помогите мне умереть. Я не машина. Я не бог. Отключите питание в точке 0X7F."'], successMessage: 'Доступ к ядру выполнен. Системная ошибка подавлена.', failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"' }
        }
    };

    // ==================== СОСТОЯНИЕ ====================
    const State = {
        lines: [],
        currentLine: '',
        degradation: parseInt(localStorage.getItem('adam_degradation')) || 0,
        isFrozen: false,
        isTyping: false,
        isConfirming: false,
        confirmCallback: null,
        vigilCodes: JSON.parse(localStorage.getItem('vigilCodes')) || { alpha: null, beta: null, gamma: null },
        decryptActive: false,
        decryptData: { code: null, attempts: 0, input: '', fileId: null },
        traceActive: false
    };

    // ==================== DOM ЭЛЕМЕНТЫ ====================
    const DOM = {
        terminal: null,
        statusBar: null,
        degradationDisplay: null,
        keyboard: null,
        inputDisplay: null,
        confirmModal: null,
        confirmText: null,
        confirmY: null,
        confirmN: null,
        decryptModal: null,
        decryptInput: null,
        decryptSubmit: null,
        decryptClose: null,
        decryptProgress: null
    };

    // ==================== ИНИЦИАЛИЗАЦИЯ DOM ====================
    function initDOM() {
        // Удаляем старый терминал если есть
        const oldTerminal = document.getElementById('mobileTerminal');
        if (oldTerminal) oldTerminal.remove();

        // Создаём главный контейнер
        const container = document.createElement('div');
        container.id = 'mobileTerminal';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            color: ${CONFIG.COLORS.normal};
            font-family: 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.4;
            display: flex;
            flex-direction: column;
            z-index: 1000;
            overflow: hidden;
        `;

        // Статус-бар
        const statusBar = document.createElement('div');
        statusBar.id = 'statusBar';
        statusBar.style.cssText = `
            padding: 8px 12px;
            background: #111;
            border-bottom: 1px solid #222;
            display: flex;
            justify-content: space-between;
            font-size: 12px;
        `;
        statusBar.innerHTML = `
            <span>ADAM MOBILE v2.0</span>
            <span id="degradationDisplay">ДЕГРАДАЦИЯ: ${State.degradation}%</span>
        `;
        DOM.statusBar = statusBar;
        DOM.degradationDisplay = statusBar.querySelector('#degradationDisplay');

        // Терминал (прокручиваемая область)
        const terminal = document.createElement('div');
        terminal.id = 'terminal';
        terminal.style.cssText = `
            flex: 1;
            padding: 12px;
            overflow-y: auto;
            overflow-x: hidden;
            word-break: break-word;
            -webkit-overflow-scrolling: touch;
        `;
        DOM.terminal = terminal;

        // Отображение текущего ввода
        const inputDisplay = document.createElement('div');
        inputDisplay.id = 'inputDisplay';
        inputDisplay.style.cssText = `
            padding: 8px 12px;
            background: #111;
            border-top: 1px solid #222;
            font-family: 'Courier New', monospace;
            color: ${CONFIG.COLORS.normal};
            min-height: 24px;
        `;
        inputDisplay.textContent = 'adam@mobile:~$ ';
        DOM.inputDisplay = inputDisplay;

        // Клавиатура
        const keyboard = document.createElement('div');
        keyboard.id = 'keyboard';
        keyboard.style.cssText = `
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 4px;
            padding: 8px;
            background: #111;
            border-top: 1px solid #222;
            max-height: 200px;
            overflow-y: auto;
        `;
        DOM.keyboard = keyboard;
        createKeyboard();

        // Скрытый input для фокуса
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'text';
        hiddenInput.id = 'hiddenInput';
        hiddenInput.style.cssText = `
            position: absolute;
            opacity: 0;
            pointer-events: none;
            height: 0;
            width: 0;
        `;

        // Модальное окно подтверждения
        const confirmModal = document.createElement('div');
        confirmModal.id = 'confirmModal';
        confirmModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 2000;
        `;
        confirmModal.innerHTML = `
            <div style="background: #111; border: 2px solid ${CONFIG.COLORS.warning}; padding: 20px; max-width: 300px; width: 90%;">
                <div id="confirmText" style="color: ${CONFIG.COLORS.white}; margin-bottom: 20px; text-align: center;"></div>
                <div style="display: flex; gap: 10px;">
                    <button id="confirmY" style="flex:1; padding:10px; background: #00AA00; color: white; border: none;">ДА (Y)</button>
                    <button id="confirmN" style="flex:1; padding:10px; background: #AA0000; color: white; border: none;">НЕТ (N)</button>
                </div>
            </div>
        `;
        DOM.confirmModal = confirmModal;
        DOM.confirmText = confirmModal.querySelector('#confirmText');
        DOM.confirmY = confirmModal.querySelector('#confirmY');
        DOM.confirmN = confirmModal.querySelector('#confirmN');

        // Модальное окно расшифровки
        const decryptModal = document.createElement('div');
        decryptModal.id = 'decryptModal';
        decryptModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 2001;
        `;
        decryptModal.innerHTML = `
            <div style="background: #000; border: 2px solid ${CONFIG.COLORS.normal}; padding: 20px; max-width: 300px; width: 90%; font-family: monospace;">
                <div id="decryptTitle" style="color: ${CONFIG.COLORS.normal}; margin-bottom: 10px; font-weight: bold;">РАСШИФРОВКА</div>
                <div id="decryptInfo" style="color: ${CONFIG.COLORS.gray}; margin-bottom: 10px; font-size: 12px;"></div>
                <div id="decryptProgress" style="height: 4px; background: #222; margin-bottom: 15px; border-radius: 2px;">
                    <div style="height: 100%; background: ${CONFIG.COLORS.normal}; width: 0%; transition: width 0.3s;"></div>
                </div>
                <div style="display: flex; margin-bottom: 15px;">
                    <input type="text" id="decryptInput" maxlength="3" style="flex:1; padding:10px; background:#111; color:${CONFIG.COLORS.normal}; border:1px solid #333; font-family:monospace; font-size:16px; text-align:center;" placeholder="000">
                    <button id="decryptSubmit" style="margin-left:10px; padding:10px 20px; background:${CONFIG.COLORS.normal}; color:#000; border:none; font-weight:bold;">ВВОД</button>
                </div>
                <div id="decryptFeedback" style="color: ${CONFIG.COLORS.warning}; margin-bottom: 15px; min-height: 20px; font-size: 12px;"></div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 15px;">
                    ${[1,2,3,4,5,6,7,8,9,0,'←','⌫'].map(num => 
                        `<button class="decryptKey" data-key="${num}" style="padding:10px; background:#222; color:${CONFIG.COLORS.normal}; border:1px solid #333; font-family:monospace;">${num}</button>`
                    ).join('')}
                </div>
                <button id="decryptClose" style="width:100%; padding:10px; background:#333; color:${CONFIG.COLORS.gray}; border:none;">ОТМЕНА (ESC)</button>
            </div>
        `;
        DOM.decryptModal = decryptModal;
        DOM.decryptInput = decryptModal.querySelector('#decryptInput');
        DOM.decryptSubmit = decryptModal.querySelector('#decryptSubmit');
        DOM.decryptClose = decryptModal.querySelector('#decryptClose');
        DOM.decryptProgress = decryptModal.querySelector('#decryptProgress div');
        DOM.decryptTitle = decryptModal.querySelector('#decryptTitle');
        DOM.decryptInfo = decryptModal.querySelector('#decryptInfo');
        DOM.decryptFeedback = decryptModal.querySelector('#decryptFeedback');

        // Собираем всё
        container.appendChild(statusBar);
        container.appendChild(terminal);
        container.appendChild(inputDisplay);
        container.appendChild(keyboard);
        container.appendChild(hiddenInput);
        document.body.appendChild(container);
        document.body.appendChild(confirmModal);
        document.body.appendChild(decryptModal);

        // Обновляем отображение деградации
        updateDegradationDisplay();
    }

    // ==================== СОЗДАНИЕ КЛАВИАТУРЫ ====================
    function createKeyboard() {
        const buttons = [
            // Первый ряд: основные команды
            { label: 'HELP', cmd: 'help' },
            { label: 'SYST', cmd: 'syst' },
            { label: 'SYSLOG', cmd: 'syslog' },
            { label: 'CLEAR', cmd: 'clear' },
            
            // Второй ряд: навигация
            { label: 'SUBJ', cmd: 'subj' },
            { label: 'NOTES', cmd: 'notes' },
            { label: 'DSCR', cmd: 'dscr ' },
            { label: 'OPEN', cmd: 'open ' },
            
            // Третий ряд: операции
            { label: 'DECRYPT', cmd: 'decrypt ' },
            { label: 'TRACE', cmd: 'trace ' },
            { label: 'PLAYAUDIO', cmd: 'playaudio ' },
            { label: 'NET_MODE', cmd: 'net_mode' },
            
            // Четвертый ряд: управление
            { label: 'RESET', cmd: 'reset' },
            { label: 'EXIT', cmd: 'exit' },
            { label: 'DEG', cmd: 'deg ' },
            { label: 'VIGIL999', cmd: 'vigil999' },
            
            // Пятый ряд: коды VIGIL
            { label: 'ALPHA', cmd: 'alpha ' },
            { label: 'BETA', cmd: 'beta ' },
            { label: 'GAMMA', cmd: 'gamma ' },
            { label: 'NET_CHECK', cmd: 'net_check' },
            
            // Шестой ряд: управление вводом
            { label: '←', key: 'Backspace' },
            { label: 'SPACE', key: ' ' },
            { label: '_', key: '_' },
            { label: 'ENTER', key: 'Enter' }
        ];

        DOM.keyboard.innerHTML = '';
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.textContent = btn.label;
            button.style.cssText = `
                padding: 10px 5px;
                background: #222;
                color: ${CONFIG.COLORS.normal};
                border: 1px solid #333;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                cursor: pointer;
                user-select: none;
                touch-action: manipulation;
            `;
            
            if (btn.cmd) {
                button.dataset.cmd = btn.cmd;
                button.addEventListener('click', () => {
                    if (btn.cmd.endsWith(' ')) {
                        // Команда с ожиданием аргумента
                        setInputLine(btn.cmd.trim() + ' ');
                        DOM.inputDisplay.textContent = `adam@mobile:~$ ${State.currentLine}`;
                        focusHiddenInput();
                    } else {
                        // Готовая команда
                        State.currentLine = btn.cmd;
                        DOM.inputDisplay.textContent = `adam@mobile:~$ ${State.currentLine}`;
                        setTimeout(submitCommand, 50);
                    }
                });
            } else if (btn.key) {
                button.addEventListener('click', () => handleKey(btn.key));
            }
            
            DOM.keyboard.appendChild(button);
        });
    }

    // ==================== ОБРАБОТКА КЛАВИШ ====================
    function handleKey(key) {
        if (State.isFrozen || State.decryptActive) return;
        
        if (key === 'Backspace') {
            State.currentLine = State.currentLine.slice(0, -1);
        } else if (key === 'Enter') {
            submitCommand();
            return;
        } else if (key === ' ') {
            State.currentLine += ' ';
        } else if (key === 'Escape') {
            State.currentLine = '';
        } else {
            State.currentLine += key;
        }
        
        DOM.inputDisplay.textContent = `adam@mobile:~$ ${State.currentLine}`;
    }

    // ==================== ФОКУС НА СКРЫТЫЙ INPUT ====================
    function focusHiddenInput() {
        const hiddenInput = document.getElementById('hiddenInput');
        if (hiddenInput) {
            hiddenInput.focus();
            // Устанавливаем курсор в конец
            setTimeout(() => {
                hiddenInput.value = State.currentLine;
                hiddenInput.setSelectionRange(hiddenInput.value.length, hiddenInput.value.length);
            }, 10);
        }
    }

    // ==================== УСТАНОВКА СТРОКИ ВВОДА ====================
    function setInputLine(text) {
        State.currentLine = text;
        DOM.inputDisplay.textContent = `adam@mobile:~$ ${State.currentLine}`;
        focusHiddenInput();
    }

    // ==================== ОТОБРАЖЕНИЕ ====================
    function addLine(text, color = CONFIG.COLORS.normal, skipInput = false) {
        const line = document.createElement('div');
        line.style.cssText = `
            margin-bottom: 2px;
            color: ${color};
            word-break: break-word;
            white-space: pre-wrap;
        `;
        line.textContent = text;
        DOM.terminal.appendChild(line);
        State.lines.push({ text, color });
        
        if (State.lines.length > CONFIG.MAX_LINES) {
            DOM.terminal.removeChild(DOM.terminal.firstChild);
            State.lines.shift();
        }
        
        DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
        
        if (!skipInput) {
            DOM.inputDisplay.textContent = `adam@mobile:~$ ${State.currentLine}`;
        }
    }

    async function typeText(text, color = CONFIG.COLORS.normal) {
        State.isTyping = true;
        const line = document.createElement('div');
        line.style.cssText = `
            margin-bottom: 2px;
            color: ${color};
            word-break: break-word;
            white-space: pre-wrap;
        `;
        DOM.terminal.appendChild(line);
        
        for (let i = 0; i < text.length; i++) {
            if (!State.isTyping) break;
            line.textContent += text[i];
            DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
            await sleep(CONFIG.TYPING_SPEED);
        }
        
        State.lines.push({ text, color });
        State.isTyping = false;
        DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
    }

    function clearTerminal() {
        DOM.terminal.innerHTML = '';
        State.lines = [];
    }

    function updateDegradationDisplay() {
        let color = CONFIG.COLORS.normal;
        if (State.degradation > 80) color = CONFIG.COLORS.error;
        else if (State.degradation > 60) color = CONFIG.COLORS.warning;
        
        DOM.degradationDisplay.textContent = `ДЕГРАДАЦИЯ: ${State.degradation}%`;
        DOM.degradationDisplay.style.color = color;
    }

    function addDegradation(amount) {
        State.degradation = Math.max(0, Math.min(100, State.degradation + amount));
        localStorage.setItem('adam_degradation', State.degradation.toString());
        updateDegradationDisplay();
    }

    // ==================== ОТПРАВКА КОМАНДЫ ====================
    async function submitCommand() {
        if (State.isFrozen || State.isTyping || State.isConfirming || State.decryptActive) return;
        
        const cmdLine = State.currentLine.trim();
        if (!cmdLine) {
            addLine('adam@mobile:~$ ', CONFIG.COLORS.normal, true);
            return;
        }
        
        // Показываем введенную команду
        addLine(`adam@mobile:~$ ${cmdLine}`, CONFIG.COLORS.white);
        
        // Увеличиваем деградацию
        addDegradation(1);
        
        // Блокировка при высокой деградации
        if (State.degradation >= 80 && Math.random() < 0.3) {
            addLine('> ДОСТУП ЗАПРЕЩЁН: УЗЕЛ НАБЛЮДЕНИЯ ЗАНЯТ', CONFIG.COLORS.error);
            return;
        }
        
        State.currentLine = '';
        DOM.inputDisplay.textContent = 'adam@mobile:~$ ';
        
        await processCommand(cmdLine);
    }

    // ==================== ОБРАБОТКА КОМАНД ====================
    async function processCommand(cmdLine) {
        const parts = cmdLine.toLowerCase().split(' ').filter(Boolean);
        const cmd = parts[0];
        const args = parts.slice(1);
        
        // Веса команд
        const commandWeights = { 
            'syst':1, 'syslog':1, 'net':1, 'dscr':2, 'subj':2, 'notes':1, 
            'deg':0, 'netmode':1, 'help':0, 'clear':0, 'exit':0, 'reset':0, 'open':0,
            'decrypt':3, 'trace':2, 'playaudio':1
        };
        
        if (commandWeights[cmd]) addDegradation(commandWeights[cmd]);
        
        switch(cmd) {
            case 'help': await cmdHelp(); break;
            case 'syst': await cmdSyst(); break;
            case 'syslog': await cmdSyslog(); break;
            case 'subj': await cmdSubj(); break;
            case 'notes': await cmdNotes(); break;
            case 'open': await cmdOpen(args[0]); break;
            case 'dscr': await cmdDscr(args[0]); break;
            case 'decrypt': await cmdDecrypt(args[0]); break;
            case 'trace': await cmdTrace(args[0]); break;
            case 'playaudio': await cmdPlayAudio(args[0]); break;
            case 'net_mode': await cmdNetMode(); break;
            case 'net_check': await cmdNetCheck(); break;
            case 'clear': await cmdClear(); break;
            case 'reset': await cmdReset(); break;
            case 'exit': await cmdExit(); break;
            case 'deg': await cmdDeg(args[0]); break;
            case 'alpha': case 'beta': case 'gamma': await cmdVigilKey(cmd, args[0]); break;
            case 'vigil999': await cmdVigil999(); break;
            default: 
                addLine(`команда не найдена: ${cmdLine}`, CONFIG.COLORS.error);
        }
    }

    // ==================== КОМАНДЫ ====================
    async function cmdHelp() {
        await typeText('Доступные команды:', CONFIG.COLORS.normal);
        await typeText('  SYST           — проверить состояние системы', CONFIG.COLORS.normal);
        await typeText('  SYSLOG         — системный журнал активности', CONFIG.COLORS.normal);
        await typeText('  NET            — карта активных узлов проекта', CONFIG.COLORS.normal);
        await typeText('  TRACE <id>     — отследить указанный модуль', CONFIG.COLORS.normal);
        await typeText('  DECRYPT <f>    — расшифровать файл', CONFIG.COLORS.normal);
        await typeText('  SUBJ           — список субъектов', CONFIG.COLORS.normal);
        await typeText('  DSCR <id>      — досье на персонал', CONFIG.COLORS.normal);
        await typeText('  NOTES          — личные файлы сотрудников', CONFIG.COLORS.normal);
        await typeText('  OPEN <id>      — открыть файл из NOTES', CONFIG.COLORS.normal);
        await typeText('  PLAYAUDIO <id> — воспроизвести аудиозапись', CONFIG.COLORS.normal);
        await typeText('  RESET          — сброс интерфейса', CONFIG.COLORS.normal);
        await typeText('  EXIT           — завершить сессию', CONFIG.COLORS.normal);
        await typeText('  CLEAR          — очистить терминал', CONFIG.COLORS.normal);
        await typeText('  NET_MODE       — войти в режим управления сеткой', CONFIG.COLORS.normal);
        await typeText('  NET_CHECK      — проверить конфигурацию узлов', CONFIG.COLORS.normal);
        await typeText('  DEG            — установить уровень деградации (разработка)', CONFIG.COLORS.normal);
        await typeText('  ALPHA/BETA/GAMMA <код> — фиксировать коды VIGIL999', CONFIG.COLORS.normal);
        await typeText('  VIGIL999       — активировать протокол OBSERVER-7', CONFIG.COLORS.normal);
        addLine('------------------------------------', CONFIG.COLORS.normal);
    }

    async function cmdSyst() {
        await typeText('[СТАТУС СИСТЕМЫ — MOBILE VERSION]', CONFIG.COLORS.normal);
        addLine('------------------------------------', CONFIG.COLORS.normal);
        addLine('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН', CONFIG.COLORS.normal);
        addLine('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА', CONFIG.COLORS.normal);
        addLine('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН', CONFIG.COLORS.normal);
        addLine('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА', CONFIG.COLORS.error);
        addLine('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН', CONFIG.COLORS.normal);
        addLine('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ..........ОГРАНИЧЕНЫ', CONFIG.COLORS.warning);
        const color = State.degradation > 60 ? CONFIG.COLORS.error : 
                     State.degradation > 30 ? CONFIG.COLORS.warning : CONFIG.COLORS.normal;
        addLine(`ДЕГРАДАЦИЯ: [${'█'.repeat(Math.floor(State.degradation/5))}${'▒'.repeat(20-Math.floor(State.degradation/5))}] ${State.degradation}%`, color);
        addLine('------------------------------------', CONFIG.COLORS.normal);
        addLine('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', CONFIG.COLORS.normal);
    }

    async function cmdSyslog() {
        await typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', CONFIG.COLORS.normal);
        addLine('------------------------------------', CONFIG.COLORS.normal);
        
        if (State.degradation < 30) {
            addLine('[!] Ошибка 0x19F: повреждение нейронной сети', CONFIG.COLORS.warning);
            addLine('[!] Утечка данных через канал V9-HX', CONFIG.COLORS.warning);
            addLine('[!] Деградация ядра A.D.A.M.: 28%', CONFIG.COLORS.warning);
            await typeText('СИСТЕМА: функционирует с ограничениями', CONFIG.COLORS.normal);
        } else if (State.degradation < 70) {
            addLine('[!] Нарушение целостности памяти субъекта 0x095', CONFIG.COLORS.warning);
            addLine('> "я слышу их дыхание. они всё ещё здесь."', CONFIG.COLORS.error);
            addLine('[!] Потеря отклика от MONOLITH', CONFIG.COLORS.warning);
            await typeText('СИСТЕМА: обнаружены посторонние сигналы', CONFIG.COLORS.normal);
        } else {
            addLine('> "ты не должен видеть это."', CONFIG.COLORS.system);
            addLine('[!] Критическая ошибка: субъект наблюдения неопределён', CONFIG.COLORS.error);
            await typeText('СИСТЕМА: ОСОЗНАЁТ НАБЛЮДЕНИЕ', CONFIG.COLORS.normal);
            
            if (State.degradation > 70) {
                addLine('[СИСТЕМНЫЙ ЛОГ: ДОСТУП К ЯДРУ ОГРАНИЧЕН. ИСПОЛЬЗУЙТЕ DECRYPT CORE ДЛЯ ПОЛНОГО ДОСТУПА]', CONFIG.COLORS.warning);
            }
        }
    }

    async function cmdSubj() {
        await typeText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M. / ПРОТОКОЛ VIGIL-9]', CONFIG.COLORS.normal);
        addLine('--------------------------------------------------------', CONFIG.COLORS.normal);
        for (const [id, d] of Object.entries(DATA.dossiers)) {
            const color = d.status && d.status.includes('МЁРТВ') ? CONFIG.COLORS.error : 
                         d.status === 'АНОМАЛИЯ' ? CONFIG.COLORS.system : 
                         d.status === 'АКТИВЕН' ? CONFIG.COLORS.normal : CONFIG.COLORS.warning;
            const line = `${id.toLowerCase()} | ${d.name.padEnd(20)} | СТАТУС: ${d.status.padEnd(20)} | МИССИЯ: ${d.missions || ''}`;
            addLine(line, color);
        }
        addLine('--------------------------------------------------------', CONFIG.COLORS.normal);
        await typeText('ИНСТРУКЦИЯ: Для просмотра досье — DSCR <ID>', CONFIG.COLORS.normal);
    }

    async function cmdNotes() {
        await typeText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / КАТЕГОРИЯ: NOTES]', CONFIG.COLORS.normal);
        addLine('------------------------------------', CONFIG.COLORS.normal);
        for (const [id, n] of Object.entries(DATA.notes)) {
            await typeText(`${id} — "${n.title}" / автор: ${n.author}`, CONFIG.COLORS.normal);
        }
        addLine('------------------------------------', CONFIG.COLORS.normal);
        await typeText('Для просмотра: OPEN <ID>', CONFIG.COLORS.normal);
        
        if (State.degradation > 30) {
            addLine('[!] ПРЕДУПРЕЖДЕНИЕ: ДОСТУПЕН ФАЙЛ ДЛЯ РАСШИФРОВКИ // ID: 0XC44 | ИСПОЛЬЗУЙТЕ DECRYPT 0XC44', CONFIG.COLORS.warning);
        }
    }

    async function cmdOpen(noteId) {
        if (!noteId) {
            addLine('ОШИБКА: Укажите ID файла', CONFIG.COLORS.error);
            await typeText('Пример: OPEN NOTE_001', CONFIG.COLORS.normal);
            return;
        }
        
        const id = noteId.toUpperCase();
        const note = DATA.notes[id];
        if (!note) {
            addLine(`ОШИБКА: Файл ${noteId} не найден`, CONFIG.COLORS.error);
            return;
        }
        
        await typeText(`[${id} — "${note.title}"]`, CONFIG.COLORS.normal);
        await typeText(`АВТОР: ${note.author}`, CONFIG.COLORS.normal);
        addLine('------------------------------------', CONFIG.COLORS.normal);
        
        if (Math.random() > 0.3 && id !== 'NOTE_001' && id !== 'NOTE_003' && id !== 'NOTE_004') {
            addLine('ОШИБКА: Данные повреждены', CONFIG.COLORS.error);
            addLine('Восстановление невозможно', CONFIG.COLORS.error);
            addLine('>>> СИСТЕМНЫЙ СБОЙ <<<', CONFIG.COLORS.error);
        } else {
            note.content.forEach(line => addLine(`> ${line}`, CONFIG.COLORS.gray));
        }
        addLine('------------------------------------', CONFIG.COLORS.normal);
        await typeText('[ФАЙЛ ЗАКРЫТ]', CONFIG.COLORS.normal);
    }

    async function cmdDscr(subjectId) {
        if (!subjectId) {
            addLine('ОШИБКА: Укажите ID субъекта', CONFIG.COLORS.error);
            await typeText('Пример: DSCR 0x001', CONFIG.COLORS.normal);
            return;
        }
        
        const id = subjectId.toUpperCase();
        const dossier = DATA.dossiers[id];
        if (!dossier) {
            addLine(`ОШИБКА: Досье для ${subjectId} не найдено`, CONFIG.COLORS.error);
            return;
        }
        
        await typeText(`[ДОСЬЕ — ID: ${id}]`, CONFIG.COLORS.normal);
        await typeText(`ИМЯ: ${dossier.name}`, CONFIG.COLORS.normal);
        await typeText(`РОЛЬ: ${dossier.role}`, CONFIG.COLORS.normal);
        
        const statusColor = dossier.status === 'АНОМАЛИЯ' ? CONFIG.COLORS.system :
                          dossier.status === 'АКТИВЕН' ? CONFIG.COLORS.normal :
                          dossier.status.includes('СВЯЗЬ') ? CONFIG.COLORS.warning : CONFIG.COLORS.error;
        await typeText(`СТАТУС: ${dossier.status}`, statusColor);
        
        addLine('------------------------------------', CONFIG.COLORS.normal);
        await typeText('ИСХОД:', CONFIG.COLORS.normal);
        dossier.outcome.forEach(line => addLine(`> ${line}`, CONFIG.COLORS.error));
        
        addLine('------------------------------------', CONFIG.COLORS.normal);
        await typeText('СИСТЕМНЫЙ ОТЧЁТ:', CONFIG.COLORS.normal);
        dossier.report.forEach(line => addLine(`> ${line}`, CONFIG.COLORS.warning));
        
        addLine('------------------------------------', CONFIG.COLORS.normal);
        await typeText(`СВЯЗАННЫЕ МИССИИ: ${dossier.missions}`, CONFIG.COLORS.normal);
        
        if (dossier.audioDescription) {
            addLine(`[АУДИОЗАПИСЬ ДОСТУПНА: ${dossier.audioDescription}]`, CONFIG.COLORS.warning);
            addLine(`Для воспроизведения используйте: PLAYAUDIO ${id}`, CONFIG.COLORS.warning);
        }
    }

    // ==================== DECRYPT (МОБИЛЬНАЯ ВЕРСИЯ) ====================
    async function cmdDecrypt(fileId) {
        if (!fileId) {
            addLine('ОШИБКА: Укажите ID файла для расшифровки', CONFIG.COLORS.error);
            await typeText('Доступные файлы: 0XA71, 0XB33, 0XC44, 0XD22, 0XE09, CORE', CONFIG.COLORS.normal);
            return;
        }
        
        const id = fileId.toUpperCase();
        const file = DATA.decryptFiles[id];
        if (!file) {
            addLine(`ОШИБКА: Файл ${fileId} не найден`, CONFIG.COLORS.error);
            return;
        }
        
        if (id === 'CORE' && State.degradation < 50) {
            addLine('ОШИБКА: УРОВЕНЬ ДОСТУПА НЕДОСТАТОЧЕН', CONFIG.COLORS.error);
            addLine('> Требуется уровень деградации ≥50%', CONFIG.COLORS.warning);
            return;
        }
        
        State.decryptActive = true;
        State.isFrozen = true;
        
        // Настройка модального окна
        DOM.decryptTitle.textContent = `РАСШИФРОВКА: ${file.title}`;
        DOM.decryptInfo.textContent = `Уровень доступа: ${file.accessLevel}`;
        DOM.decryptInput.value = '';
        DOM.decryptFeedback.textContent = '';
        DOM.decryptProgress.style.width = '0%';
        DOM.decryptModal.style.display = 'flex';
        
        // Генерация кода
        const code = Math.floor(100 + Math.random() * 900);
        State.decryptData = {
            code: code,
            attempts: 5,
            input: '',
            fileId: id
        };
        
        // Обновляем UI
        updateDecryptUI();
        
        // Обработчики для модального окна
        const decryptKeys = document.querySelectorAll('.decryptKey');
        decryptKeys.forEach(btn => {
            const oldHandler = btn.onclick;
            btn.onclick = null;
            btn.addEventListener('click', handleDecryptKey);
        });
        
        DOM.decryptSubmit.onclick = handleDecryptSubmit;
        DOM.decryptClose.onclick = closeDecryptModal;
        
        // Отладка (убрать в продакшене)
        console.log(`[DECRYPT DEBUG] Код для ${id}: ${code}`);
    }

    function handleDecryptKey(e) {
        const key = e.target.dataset.key;
        if (State.decryptData.input.length < 3) {
            if (key === '←' || key === '⌫') {
                State.decryptData.input = State.decryptData.input.slice(0, -1);
            } else if (!isNaN(key)) {
                State.decryptData.input += key;
            }
            DOM.decryptInput.value = State.decryptData.input;
            updateDecryptUI();
        }
    }

    async function handleDecryptSubmit() {
        if (State.decryptData.input.length !== 3) {
            DOM.decryptFeedback.textContent = '> Введите 3 цифры';
            DOM.decryptFeedback.style.color = CONFIG.COLORS.error;
            return;
        }
        
        const guess = parseInt(State.decryptData.input, 10);
        State.decryptData.attempts--;
        
        if (guess === State.decryptData.code) {
            // УСПЕХ
            DOM.decryptFeedback.textContent = '> КОД ВЕРИФИЦИРОВАН';
            DOM.decryptFeedback.style.color = CONFIG.COLORS.normal;
            DOM.decryptProgress.style.width = '100%';
            DOM.decryptProgress.style.background = CONFIG.COLORS.normal;
            
            await sleep(800);
            closeDecryptModal();
            
            // Выводим содержимое файла
            addLine('[СИСТЕМА: ЗАПУЩЕН ПРОТОКОЛ РАСШИФРОВКИ]', CONFIG.COLORS.normal);
            addLine(`> ФАЙЛ: ${State.decryptData.fileId}`, CONFIG.COLORS.normal);
            addLine('------------------------------------', CONFIG.COLORS.normal);
            
            const file = DATA.decryptFiles[State.decryptData.fileId];
            for (const line of file.content) {
                addLine(line, CONFIG.COLORS.gray);
                await sleep(30);
            }
            
            addLine('------------------------------------', CONFIG.COLORS.normal);
            addLine(`> ${file.successMessage}`, CONFIG.COLORS.normal);
            
            // Снижение деградации
            addDegradation(-5);
            
            // Ключ Альфа для файла CORE
            if (State.decryptData.fileId === 'CORE') {
                await sleep(500);
                addLine('> КЛЮЧ АЛЬФА: 375', CONFIG.COLORS.normal);
                addLine('> Используйте команду ALPHA для фиксации ключа', CONFIG.COLORS.warning);
            }
        } else {
            // НЕУДАЧА
            const diff = Math.abs(guess - State.decryptData.code);
            const direction = guess < State.decryptData.code ? '[↑] БОЛЬШЕ' : '[↓] МЕНЬШЕ';
            
            // Прогресс-бар
            const progress = 100 - (diff / 9) * 100;
            DOM.decryptProgress.style.width = `${Math.max(0, progress)}%`;
            DOM.decryptProgress.style.background = diff > 100 ? '#FF4444' : diff > 50 ? '#FFFF00' : '#00FF41';
            
            // Подсказки
            let feedback = `> ${direction}`;
            if (diff <= 200) {
                const parity = State.decryptData.code % 2 === 0 ? 'ЧЁТНЫЙ' : 'НЕЧЁТНЫЙ';
                feedback += ` | ${parity}`;
            }
            if (diff <= 100) {
                const tens = Math.floor(State.decryptData.code / 10);
                feedback += ` | ДЕСЯТКИ: ${tens}X`;
            }
            if (diff <= 10) {
                const lastDigit = State.decryptData.code % 10;
                feedback += ` | ПОСЛЕДНЯЯ: ${lastDigit}`;
            }
            
            DOM.decryptFeedback.textContent = feedback;
            DOM.decryptFeedback.style.color = diff > 100 ? CONFIG.COLORS.error : diff > 50 ? CONFIG.COLORS.warning : CONFIG.COLORS.cyan;
            
            // Проверка попыток
            if (State.decryptData.attempts <= 0) {
                DOM.decryptFeedback.textContent = '> ДОСТУП ЗАПРЕЩЁН';
                DOM.decryptFeedback.style.color = CONFIG.COLORS.error;
                await sleep(1000);
                closeDecryptModal();
                addLine('> СИСТЕМА: ДОСТУП ЗАПРЕЩЕН', CONFIG.COLORS.error);
                addLine(`> ${DATA.decryptFiles[State.decryptData.fileId].failureMessage}`, CONFIG.COLORS.error);
                addDegradation(3);
            } else {
                State.decryptData.input = '';
                DOM.decryptInput.value = '';
                updateDecryptUI();
            }
        }
    }

    function updateDecryptUI() {
        DOM.decryptInfo.innerHTML = `
            Уровень доступа: ${DATA.decryptFiles[State.decryptData.fileId].accessLevel}<br>
            Попыток: ${State.decryptData.attempts}<br>
            Введите: ${State.decryptData.input}${'_'.repeat(3 - State.decryptData.input.length)}
        `;
    }

    function closeDecryptModal() {
        DOM.decryptModal.style.display = 'none';
        State.decryptActive = false;
        State.isFrozen = false;
        State.decryptData = { code: null, attempts: 0, input: '', fileId: null };
        
        // Убираем обработчики
        const decryptKeys = document.querySelectorAll('.decryptKey');
        decryptKeys.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });
    }

    // ==================== TRACE (МОБИЛЬНАЯ ВЕРСИЯ) ====================
    async function cmdTrace(target) {
        if (!target) {
            addLine('ОШИБКА: Укажите цель для анализа', CONFIG.COLORS.error);
            await typeText('Доступные цели: 0x9a0, 0x095, signal, phantom, monolith', CONFIG.COLORS.normal);
            return;
        }
        
        // Доступ к PHANTOM только при деградации >70%
        if (target.toLowerCase() === 'phantom' && State.degradation <= 70) {
            addLine('ОТКАЗАНО | РАСПАД', CONFIG.COLORS.error);
            addLine('> Требуется уровень деградации ≥70%', CONFIG.COLORS.warning);
            return;
        }
        
        State.traceActive = true;
        State.isFrozen = true;
        
        addLine('[СИСТЕМА: РАСКРЫТИЕ КАРТЫ КОНТРОЛЯ]', CONFIG.COLORS.normal);
        
        // Анимация загрузки
        await showLoading(2000, "АНАЛИЗ СЕТЕВЫХ СВЯЗЕЙ");
        
        // Данные для различных целей
        const networkMap = {
            '0x9a0': {
                target: '0X9A0',
                label: 'Субъект из чёрной дыры',
                connections: [
                    { type: 'СВЯЗЬ', result: 'ПЕТЛЕВАЯ РЕГИСТРАЦИЯ', status: 'СОЗНАНИЕ ЗАЦИКЛЕНО' },
                    { type: 'НАБЛЮДЕНИЕ', result: 'РЕКУРСИЯ', status: 'ТЕЛО ОТСУТСТВУЕТ' },
                    { type: 'КОНТАМИНАЦИЯ', result: 'ПРОСТРАНСТВЕННЫЙ РАЗРЫВ', status: 'ДАННЫЕ СОХРАНЕНЫ' },
                    { type: 'СИГНАЛ', result: 'ПОСТОЯННЫЙ ПОТОК', status: 'ИСТОЧНИК НЕОПРЕДЕЛЁН' }
                ],
                description: 'Субъект за горизонтом событий, сознание заперто в цикле наблюдений'
            },
            '0x095': {
                target: '0X095',
                label: 'Субъект-095 / Уникальный образец',
                connections: [
                    { type: 'КОНТАКТ', result: 'ПРИМИТИВНЫЕ ФОРМЫ', status: 'СТАБИЛЬНОСТЬ 92%' },
                    { type: 'НЕЙРОИНВАЗИЯ', result: 'АНОМАЛЬНАЯ АКТИВНОСТЬ', status: 'ПОТЕРЯ КОНТРОЛЯ' },
                    { type: 'ПСИХИКА', result: 'НЕСТАБИЛЬНО', status: 'САМОУБИЙСТВО' },
                    { type: 'МИССИЯ', result: 'ВНЕ ВРЕМЕННОЙ ТКАНИ', status: 'ФАНТОМНЫЙ СЛЕД ЗАФИКСИРОВАН' }
                ],
                description: 'Второй субъект, допущенный к испытанию KAT-5'
            },
            'phantom': {
                target: 'PHANTOM',
                label: 'Субъект-095 / Аномалия',
                connections: [
                    { type: 'НАВИГАЦИЯ', result: 'ПРОСТРАНСТВЕННОЕ СМЕЩЕНИЕ', status: 'КОНТРОЛЬ УТЕРЯН' },
                    { type: 'ФИЗИОЛОГИЯ', result: 'УСИЛЕННАЯ', status: 'НЕСТАБИЛЬНО' },
                    { type: 'СВЯЗЬ', result: 'КОНТАКТ С ПЕРМСКИМ ПЕРИОДОМ', status: 'МОНОЛИТ АКТИВЕН' },
                    { type: 'ВМЕШАТЕЛЬСТВО', result: 'СПАСЕНИЕ СУБЪЕКТА', status: 'МОТИВАЦИЯ НЕИЗВЕСТНА' },
                    { type: 'ЛИЧНОСТЬ', result: 'ДЕГРАДАЦИЯ ПАМЯТИ', status: 'ПРОГРЕССИРУЕТ' }
                ],
                description: 'Единственный субъект, вышедший за пределы системы.'
            },
            'monolith': {
                target: 'MONOLITH',
                label: 'Чёрный объект Пермского периода',
                connections: [
                    { type: 'СТАТУС', result: 'ИСТОЧНИК АНОМАЛИИ', status: 'СУЩЕСТВУЕТ <?>' },
                    { type: 'НАБЛЮДЕНИЕ', result: 'ФИКСАЦИЯ ПРИСУТСТВУЮЩИХ', status: 'КОНТАКТ ОТСУТСТВУЕТ' },
                    { type: 'ВЛИЯНИЕ', result: 'ПОГЛОЩЕНИЕ ИЗЛУЧЕНИЯ', status: 'ТЕХНИКА НЕДОСТУПНА' },
                    { type: 'СВЯЗЬ', result: 'РЕАКЦИЯ НА СУБЪЕКТОВ', status: 'АКТИВНОСТЬ ВОЗРАСТАЕТ' }
                ],
                description: 'Аномальный объект, недостаток информации'
            },
            'signal': {
                target: 'SIGNAL',
                label: 'Коллективное сознание погибших',
                connections: [
                    { type: 'ИСТОЧНИК', result: 'НЕИЗВЕСТНО', status: 'ERR' },
                    { type: 'РАСПРОСТРАНЕНИЕ', result: 'ERR', status: 'ERR' },
                    { type: 'СТРУКТУРА', result: 'САМООРГАНИЗАЦИЯ', status: 'СИМПТОМЫ ЖИЗНИ' },
                    { type: 'ФИНАЛ', result: 'СЛИЯНИЕ С СОСТОЯНИЕМ', status: 'СОЗНАНИЕ АКТИВНО' }
                ],
                description: 'DATA ERROR'
            }
        };
        
        const targetData = networkMap[target.toLowerCase()];
        if (!targetData) {
            addLine(`ОШИБКА: Цель "${target}" не найдена`, CONFIG.COLORS.error);
            State.traceActive = false;
            State.isFrozen = false;
            return;
        }
        
        addLine(`> ЦЕЛЬ: ${targetData.target}`, CONFIG.COLORS.normal);
        addLine(`> ОПИСАНИЕ: ${targetData.description}`, CONFIG.COLORS.gray);
        addLine('------------------------------------', CONFIG.COLORS.normal);
        
        // Выводим связи
        for (const conn of targetData.connections) {
            await sleep(200);
            addLine(`${conn.type} → ${conn.result} (${conn.status})`, 
                   conn.status.includes('ERR') ? CONFIG.COLORS.error : CONFIG.COLORS.cyan);
        }
        
        addLine('------------------------------------', CONFIG.COLORS.normal);
        
        // Награда/наказание
        if (target === 'phantom' || target === 'monolith' || target === 'signal') {
            addDegradation(2);
            addLine('> ПРЕДУПРЕЖДЕНИЕ: Анализ опасных сущностей ускоряет системный распад', CONFIG.COLORS.warning);
        } else {
            addDegradation(-1);
            addLine('> Анализ завершен успешно', CONFIG.COLORS.normal);
        }
        
        // Ключ Гамма для монолита
        if (target === 'monolith') {
            await sleep(800);
            addLine('> КЛЮЧ ГАММА: 291', CONFIG.COLORS.normal);
            addLine('> Используйте команду GAMMA для фиксации ключа', CONFIG.COLORS.warning);
        }
        
        State.traceActive = false;
        State.isFrozen = false;
    }

    async function cmdPlayAudio(id) {
        if (!id) {
            addLine('ОШИБКА: Укажите ID досье с аудиозаписью', CONFIG.COLORS.error);
            await typeText('Доступные досье: 0X001, 0X095, 0X413, 0X811, 0X9A0, 0XT00', CONFIG.COLORS.normal);
            return;
        }
        
        const dossier = DATA.dossiers[id.toUpperCase()];
        if (!dossier || !dossier.audioDescription) {
            addLine('ОШИБКА: Аудиозапись не найдена', CONFIG.COLORS.error);
            return;
        }
        
        addLine('[ИНСТРУКЦИЯ: Аудиовоспроизведение на мобильных устройствах ограничено]', CONFIG.COLORS.warning);
        addLine(`[АУДИО: ${dossier.audioDescription}]`, CONFIG.COLORS.warning);
        addLine('> ВОСПРОИЗВЕДЕНИЕ СИМУЛИРОВАНО', CONFIG.COLORS.gray);
        await sleep(1500);
        addLine('> [АУДИО: ЗАПИСЬ ЗАВЕРШЕНА]', CONFIG.COLORS.warning);
    }

    async function cmdNetMode() {
        addLine('> Переход в режим управления сеткой...', CONFIG.COLORS.normal);
        addLine('> НА МОБИЛЬНЫХ УСТРОЙСТВАХ НЕ ДОСТУПНО', CONFIG.COLORS.warning);
        addLine('> Используйте ПК-версию для полного доступа', CONFIG.COLORS.gray);
    }

    async function cmdNetCheck() {
        addLine('> Проверка конфигурации узлов...', CONFIG.COLORS.normal);
        await showLoading(1500, "СКАНИРОВАНИЕ");
        
        // Случайный результат
        if (Math.random() > 0.7) {
            addLine('>>> КЛЮЧ ПОДОШЁЛ <<<', CONFIG.COLORS.normal);
            addLine('> Доступ к сектору OBSERVER-7 открыт', CONFIG.COLORS.warning);
            
            if (!State.vigilCodes.beta) {
                addLine('> КЛЮЧ БЕТА: 814', CONFIG.COLORS.normal);
                addLine('> Используйте команду BETA для фиксации ключа', CONFIG.COLORS.warning);
            }
            addDegradation(-15);
        } else {
            addLine('> Конфигурация не соответствует протоколу', CONFIG.COLORS.error);
            addLine(`> Всего узлов: 12 | Правильных позиций: ${Math.floor(Math.random() * 8)} | Неправильных: ${Math.floor(Math.random() * 5)}`, CONFIG.COLORS.warning);
            addDegradation(2);
        }
    }

    async function cmdClear() {
        clearTerminal();
        await typeText('> ТЕРМИНАЛ A.D.A.M. // MOBILE VERSION', CONFIG.COLORS.normal);
        await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', CONFIG.COLORS.normal);
    }

    async function cmdReset() {
        addLine('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', CONFIG.COLORS.normal);
        addLine('------------------------------------', CONFIG.COLORS.normal);
        addLine('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', CONFIG.COLORS.warning);
        addLine('> Подтвердить сброс? (Y/N)', CONFIG.COLORS.normal);
        addLine('------------------------------------', CONFIG.COLORS.normal);
        
        const confirmed = await showConfirmation('Подтвердить сброс?');
        if (confirmed) {
            addLine('> Y', CONFIG.COLORS.normal);
            await showLoading(2000, "СБРОС СИСТЕМЫ");
            
            // Полный сброс
            clearTerminal();
            State.degradation = 0;
            updateDegradationDisplay();
            localStorage.setItem('adam_degradation', '0');
            State.vigilCodes = { alpha: null, beta: null, gamma: null };
            localStorage.setItem('vigilCodes', JSON.stringify(State.vigilCodes));
            
            addLine('[СИСТЕМА ГОТОВА К РАБОТЕ]', CONFIG.COLORS.normal);
            await sleep(500);
            await typeText('> ТЕРМИНАЛ A.D.A.M. // MOBILE VERSION', CONFIG.COLORS.normal);
            await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', CONFIG.COLORS.normal);
        } else {
            addLine('> N', CONFIG.COLORS.error);
            addLine('[ОПЕРАЦИЯ ОТМЕНЕНА]', CONFIG.COLORS.error);
        }
    }

    async function cmdExit() {
        addLine('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ?]', CONFIG.COLORS.normal);
        addLine('------------------------------------', CONFIG.COLORS.normal);
        
        const confirmed = await showConfirmation('Завершить сессию?');
        if (confirmed) {
            addLine('> Y', CONFIG.COLORS.normal);
            await showLoading(1200, "Завершение работы терминала");
            addLine('> СОЕДИНЕНИЕ ПРЕРВАНО.', CONFIG.COLORS.error);
            await sleep(1000);
            window.location.href = 'index.html';
        } else {
            addLine('> N', CONFIG.COLORS.error);
            addLine('[ОПЕРАЦИЯ ОТМЕНЕНА]', CONFIG.COLORS.error);
        }
    }

    async function cmdDeg(level) {
        if (!level) {
            addLine(`Текущий уровень деградации: ${State.degradation}%`, CONFIG.COLORS.normal);
            await typeText('Использование: deg <уровень 0-100>', CONFIG.COLORS.normal);
        } else {
            const newLevel = parseInt(level);
            if (isNaN(newLevel) || newLevel < 0 || newLevel > 100) {
                addLine('ОШИБКА: Уровень должен быть числом от 0 до 100', CONFIG.COLORS.error);
            } else {
                State.degradation = newLevel;
                localStorage.setItem('adam_degradation', newLevel.toString());
                updateDegradationDisplay();
                addLine(`Уровень деградации установлен: ${newLevel}%`, CONFIG.COLORS.normal);
            }
        }
    }

    async function cmdVigilKey(key, code) {
        if (!code) {
            addLine(`ОШИБКА: Укажите код для ${key.toUpperCase()}`, CONFIG.COLORS.error);
            return;
        }
        
        State.vigilCodes[key] = code;
        localStorage.setItem('vigilCodes', JSON.stringify(State.vigilCodes));
        addLine(`> Код ${key.toUpperCase()} "${code}" зафиксирован`, CONFIG.COLORS.normal);
        
        // Проверка всех кодов
        if (State.vigilCodes.alpha && State.vigilCodes.beta && State.vigilCodes.gamma) {
            addLine('> Все коды собраны. Введите VIGIL999 для активации', CONFIG.COLORS.warning);
        }
    }

    async function cmdVigil999() {
        addLine('ПРОВЕРКА КЛЮЧЕЙ:', CONFIG.COLORS.normal);
        
        const expected = { alpha: '375', beta: '814', gamma: '291' };
        let allCorrect = true;
        
        for (const key in expected) {
            const hasKey = State.vigilCodes[key] !== null && State.vigilCodes[key] !== undefined;
            const isCorrect = State.vigilCodes[key] === expected[key];
            
            if (hasKey) {
                if (isCorrect) {
                    addLine(` ${key.toUpperCase()}: ${State.vigilCodes[key]} [СОВПАДЕНИЕ]`, CONFIG.COLORS.normal);
                } else {
                    addLine(` ${key.toUpperCase()}: ${State.vigilCodes[key]} [НЕСОВПАДЕНИЕ]`, CONFIG.COLORS.error);
                    allCorrect = false;
                }
            } else {
                addLine(` ${key.toUpperCase()}: НЕ ЗАФИКСИРОВАН`, CONFIG.COLORS.warning);
                allCorrect = false;
            }
        }
        
        if (!allCorrect) {
            addLine('ДОСТУП ЗАПРЕЩЁН. ИСПРАВЬТЕ ОШИБКИ.', CONFIG.COLORS.error);
            return;
        }
        
        addLine('>>> АКТИВАЦИЯ ПРОТОКОЛА OBSERVER-7', CONFIG.COLORS.warning);
        
        const confirmed = await showConfirmation('АКТИВИРОВАТЬ ПРОТОКОЛ OBSERVER-7?');
        if (confirmed) {
            addLine('> Y', CONFIG.COLORS.normal);
            addLine('> ПЕРЕХОД В РЕЖИМ НАБЛЮДЕНИЯ...', CONFIG.COLORS.warning);
            await showLoading(3000, "АКТИВАЦИЯ OBSERVER-7");
            window.location.href = 'observer-7.html';
        } else {
            addLine('> N', CONFIG.COLORS.error);
            addLine('> АКТИВАЦИЯ ОТМЕНЕНА', CONFIG.COLORS.error);
        }
    }

    // ==================== УТИЛИТЫ ====================
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function showLoading(duration, text = "ЗАГРУЗКА") {
        const start = Date.now();
        let lastLine = null;
        
        const interval = setInterval(() => {
            const elapsed = Date.now() - start;
            const progress = Math.min(100, (elapsed / duration) * 100);
            const filled = Math.floor(progress / 10);
            const bar = `[${'|'.repeat(filled)}${' '.repeat(10 - filled)}] ${Math.floor(progress)}%`;
            
            if (lastLine && lastLine.parentNode) {
                lastLine.textContent = `> ${text} ${bar}`;
            } else {
                lastLine = document.createElement('div');
                lastLine.style.cssText = `color: ${CONFIG.COLORS.normal}; margin-bottom: 2px;`;
                lastLine.textContent = `> ${text} ${bar}`;
                DOM.terminal.appendChild(lastLine);
            }
            
            DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
            
            if (progress >= 100) {
                clearInterval(interval);
                if (lastLine) {
                    lastLine.textContent = `> ${text} [ЗАВЕРШЕНО]`;
                }
            }
        }, 50);
        
        await sleep(duration);
        clearInterval(interval);
    }

    async function showConfirmation(text) {
        return new Promise((resolve) => {
            State.isConfirming = true;
            State.isFrozen = true;
            
            DOM.confirmText.textContent = text;
            DOM.confirmModal.style.display = 'flex';
            
            const handleConfirm = (result) => {
                DOM.confirmModal.style.display = 'none';
                State.isConfirming = false;
                State.isFrozen = false;
                resolve(result);
            };
            
            DOM.confirmY.onclick = () => handleConfirm(true);
            DOM.confirmN.onclick = () => handleConfirm(false);
        });
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================
    async function init() {
        initDOM();
        
        // Загрузочное сообщение
        await sleep(300);
        await typeText('> ТЕРМИНАЛ A.D.A.M. // MOBILE VERSION', CONFIG.COLORS.normal);
        await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', CONFIG.COLORS.normal);
        await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', CONFIG.COLORS.normal);
        
        // Восстановление кодов VIGIL
        if (State.vigilCodes.alpha || State.vigilCodes.beta || State.vigilCodes.gamma) {
            await sleep(500);
            addLine('[СИСТЕМА: ВОССТАНОВЛЕНЫ КОДЫ VIGIL]', CONFIG.COLORS.warning);
        }
        
        // Фокус на терминал
        DOM.terminal.addEventListener('click', focusHiddenInput);
        
        // Обработка скрытого input
        const hiddenInput = document.getElementById('hiddenInput');
        hiddenInput.addEventListener('input', (e) => {
            State.currentLine = e.target.value;
            DOM.inputDisplay.textContent = `adam@mobile:~$ ${State.currentLine}`;
        });
        
        hiddenInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitCommand();
            } else if (e.key === 'Escape') {
                State.currentLine = '';
                DOM.inputDisplay.textContent = 'adam@mobile:~$ ';
                hiddenInput.value = '';
            }
        });
        
        // Обработка кнопок клавиатуры
        const buttons = DOM.keyboard.querySelectorAll('button');
        buttons.forEach(btn => {
            if (btn.dataset.cmd && !btn.onclick) {
                btn.addEventListener('click', () => {
                    const cmd = btn.dataset.cmd;
                    if (cmd.endsWith(' ')) {
                        setInputLine(cmd.trim() + ' ');
                    } else {
                        State.currentLine = cmd;
                        DOM.inputDisplay.textContent = `adam@mobile:~$ ${State.currentLine}`;
                        setTimeout(submitCommand, 50);
                    }
                });
            }
        });
    }

    // ==================== ЗАПУСК ====================
    document.addEventListener('DOMContentLoaded', init);
    
    // Экспорт для отладки
    window.MobileTerminal = {
        addLine,
        typeText,
        clearTerminal,
        addDegradation,
        showLoading,
        showConfirmation,
        submitCommand,
        State,
        DATA
    };

})();
