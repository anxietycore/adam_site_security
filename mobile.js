// mobile.js - КНОПОЧНАЯ ВЕРСИЯ БЕЗ ВВОДА С КЛАВИАТУРЫ
(() => {
    'use strict';

   // ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
    MAX_LINES: 300,
    TYPING_SPEED: 14,
    COLORS: {
        normal: '#00FF41',
        error: '#FF4444',
        warning: '#FFFF00',
        system: '#FF00FF',
        white: '#FFFFFF',
        gray: '#AAAAAA'
    }
};

// ==================== ПОЛНЫЕ ДАННЫЕ ====================
const DATA = {
    dossiers: {
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
                'Рекомендовано аннулирование личных протоколов и перенос архивов в OBSERVER.',
                'ЗАПИСИ 0XA71: ПЕРВЫЙ ПРЫЖОК УСПЕШЕН | ИСПОЛЬЗУЙТЕ DECRYPT 0XA71'
            ],
            missions: 'MARS, OBSERVER',
            audioDesc: 'Последняя передача Эриха Ван Косса'
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
            report: ['Активность нейросети перестала фиксироваться.'],
            missions: 'MARS, MONOLITH'
        },
        '0X095': {
            name: 'SUBJECT-095',
            role: 'Тест нейроплантов серии KATARHEY',
            status: 'МЁРТВ',
            outcome: [
                'Зафиксированы следы ФАНТОМА.',
                'Субъект выдержал 3ч 12м, проявил острый психоз. Погиб вследствие термической декомпрессии (7.81с).',
                'Тест признан неуспешным.',
                'СИСТЕМНОЕ УВЕДОМЛЕНИЕ: ФАЙЛ 0XB33 ПОВРЕЖДЕН | ИСПОЛЬЗУЙТЕ DECRYPT 0XB33'
            ],
            report: ['Рекомендовано ограничить тесты KATARHEY до категории ALPHA-4.'],
            missions: 'KATARHEY',
            audioDesc: 'Последняя запись субъекта - психоз и крики'
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
            audioDesc: 'Аномальная активность Фантома'
        },
        '0XA52': {
            name: 'SUBJECT-A52',
            role: 'Химический аналитик / Полевая группа MELANCHOLIA',
            status: 'СВЯЗЬ ОТСУТСТВУЕТ',
            outcome: [
                'Под действием психоактивного сигнала субъект идентифицировл себя как элемент системы A.D.A.M.',
                'После 47 минут связь прервана, но интерфейс продолжил отвечать от имени A52.'
            ],
            report: [
                'Вероятно, произошло слияние когнитивных структур субъекта с управляющим кодом MEL.'
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
            audioDesc: 'Запись контакта с внеземной биосферой'
        },
        '0XC19': {
            name: 'SUBJECT-C19',
            role: 'Переносчик образца / Контакт с биоформой',
            status: 'МЁРТВ',
            outcome: [
                'Организм использован как контейнер для спорообразной массы неизвестного происхождения.',
                'После возвращения зафиксировано перекрёстное заражение трёх исследовательских блоков.'
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
            status: 'МЁРТВ',
            outcome: [
                'Зафиксирован визуальный контакт субъекта с собственным образом до точки обрыва сигнала.',
                'Предположительно сознание зациклено в петле наблюдения.',
                '[!] НАЙДЕН ФАЙЛ: 0XE09 | Используйте: DECRYPT 0XE09'
            ],
            report: [
                'Поток данных из сектора BLACKHOLE продолжается без источника.',
                'Обнаружены фрагменты самореференциальных структур.'
            ],
            missions: 'BLACKHOLE',
            audioDesc: 'Петля сознания субъекта 9A0'
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
            report: ['Миссия признана успешной по уровню поведенческого заражения.'],
            missions: 'PLEISTOCENE'
        },
        '0XDB2': {
            name: 'SUBJECT-DB2',
            role: 'Исторический наблюдатель / симуляция POMPEII',
            status: 'МЁРТВ',
            outcome: [
                'При фиксации извержения Везувия выявлено несовпадение временных меток.',
                'Система зафиксала событие до его фактического наступления.',
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
            report: ['SIGMA функционирует автономно. Вероятность выхода из подчинения — 91%.'],
            missions: 'HELIX, SYNTHESIS',
            audioDesc: 'Коммуникационный протокол SIGMA'
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
            audioDesc: 'Финальная запись оператора T00'
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
                'После тестирования протокола MEL субъект утратил различие между внутренним и внешнем восприятием.',
                'Система зарегистрировала активность, сходную с сигнатурой управляющих ядер A.D.A.M.',
                'Запись удалена из архива, но процессор фиксирует продолжающийся сигнал.'
            ],
            report: [
                'Процесс L77 функционирует вне основного контура. Возможен перезапуск через интерфейс MEL.'
            ],
            missions: 'MEL, OBSERVER'
        }
    },
    
    notes: {
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
                'Сегодня утром нашел царапины на руке.',
                'ПРЕДУПРЕЖДЕНИЕ: ДОСТУПЕН ФАЙЛ ДЛЯ РАСШИФРОВКИ // ID: 0XC44 | Используйте DECRYPT 0XC44'
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
                'Мы пытались, но теперь даже мысли звучат как команды.',
                'ПРЕДУПРЕЖДЕНИЕ: ПРОТОКОЛЫ НЕЙРОИНВАЗИИ ДОСТУПНЫ ДЛЯ РАСШИФРОВКИ | ИСПОЛЬЗУЙТЕ DECRYPT 0XD22'
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
    },
    
    decryptFiles: {
        '0XA71': {
            title: 'ПЕРВАЯ МИССИЯ',
            accessLevel: 'ALPHA',
            content: [
                '> ОБЪЕКТ: КАПСУЛА-003 (МАРС-МАЯК)',
                '> СТАТУС: ЗАВЕРШЕНО С ПОТЕРЯМИ',
                '',
                'ОПИСАНИЕ МИССИИ:',
                'Тест фазового прыжка VIGIL-1 с тремя участниками.',
                'Капсула контактировала с аномальной биомассой.',
                'Возвращён только Ван Косс. Экипаж утрачен.',
                '',
                'ХРОНОЛОГИЯ СОБЫТИЙ:',
                '14:32 - Запуск капсулы с экипажем из трёх.',
                '15:03 - Контакт с чёрной биомассой на Марсе.',
                '17:05 - Полная потеря связи с экипажем.',
                '',
                'ВАЖНЫЕ ДАННЫЕ:',
                'Сознание погибших использовано для обучения VIGIL-9.',
                '',
                'СИСТЕМНОЕ СООБЩЕНИЕ:',
                'Протокол VIGIL-9 активирован. Жертвы оправданы.',
                '- Подпись: CORD-A'
            ],
            successMessage: 'Данные о первой миссии восстановлены.',
            failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"'
        },
        '0XB33': {
            title: 'СУБЪЕКТ-095',
            accessLevel: 'OMEGA',
            content: [
                '> ОБЪЕКТ: КАТАРХЕЙ, 4 МЛРД ЛЕТ НАЗАД',
                '> СТАТУС: АНОМАЛИЯ АКТИВНА',
                '',
                'ОПИСАНИЕ СУБЪЕКТА:',
                'Оперативное обозначение: 095',
                'Протокол: KATARHEY-5 (тест нейроплантов серии KATARHEY)',
                'Исходный статус: Субъект-095, возраст 28 лет, физическое состояние — оптимальное',
                '',
                'ХРОНОЛОГИЯ СОБЫТИЙ:',
                '09:14 — Стандартный запуск капсулы в эпоху Катархея',
                '09:27 — Контакт с примитивными формами жизни. Стабильность 92%.',
                '11:45 — Резкое ухудшение состояния субъекта. Нейроимпланты фиксируют аномальную активность мозга',
                '12:01 — Субъект постепенно теряет рассудок. Испьтание продолжается.',
                '12:33 — Последняя зафиксированная запись - звук разгерметизации капсулы и последующие крики субъекта.',
                '',
                'ВАЖНЫЕ ДАННЫЕ:',
                'Испьтание субъекта доказало существование другого субъекта с кодовым названием: <PHANTOM>',
                '',
                'СИСТЕМНОЕ ПРЕДУПРЕЖДЕНИЕ:',
                '<PHANTOM> представляет собой наибольшую угрозу для стабильности системы. Наблюдение продолжается.',
                '— Подпись: CORD-COM'
            ],
            successMessage: 'Системные данные о субъекте-095 востановлены.',
            failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"'
        },
        '0XC44': {
            title: 'МОНОЛИТ',
            accessLevel: 'OMEGA-9',
            content: [
                '> ОБЪЕКТ: ЧЁРНЫЙ ОБЪЕКТ (ПЕРМСКИЙ ПЕРИОД)',
                '> СТАТУС: НАБЛЮДЕНИЕ БЕЗ КОНТАКТА',
                '',
                'ОПИСАНИЕ АНОМАЛИИ:',
                'Геометрический объект чёрного цвета высотой 12.8 метров. Форма: идеальный параллелепипед.',
                '',
                'ХАРАКТЕРИСТИКИ:',
                '— Не излучает энергии, только поглощает',
                '— Любая техника в радиусе 500м выходит из строя',
                '— Живые организмы в радиусе 100м испытывают:',
                '   * Галлюцинации (визуальные и аудиальные)',
                '   * Головные боли',
                '   * Временную амнезию',
                '— Активность возрастает при приближении субъектов A.D.A.M.',
                '',
                'КОНТЕКСТ:',
                '— Впервые зафиксирован в Пермском периоде, 252 млн лет назад',
                '— Анахронизм: не должен существовать в этой эпохе',
                '— Не является продуктом A.D.A.M.',
                '— Все попытки сканирования и анализа завершились неудачей или гибелью субъектов',
                '',
                'НАБЛЮДЕНИЯ:',
                '— Монолит не взаимодействует с окружающей средой',
                '— Фиксирует присутствие субъектов A.D.A.M.',
                '— Реагирует на нейроимпланты: при их удалении активность понижается',
                '— Фантом (Субъект-095) установил контакт с объектом',
                '',
                'СИСТЕМНЫЙ СТАТУС:',
                'Все миссии вблизи объекта запрещены. Координаторы проект проявляют необычный интерес к объекту.',
                '— Подпись: оператор T00 (удалено из основной базы)'
            ],
            successMessage: 'Данные о монолите расшифрованы. Информация засекречена.',
            failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"'
        },
        '0XD22': {
            title: 'НЕЙРОИНВАЗИЯ',
            accessLevel: 'BETA',
            content: [
                '> ОБЪЕКТ: ПРОТОКОЛ ИНВАЗИИ СОЗНАНИЯ',
                '> СТАТУС: АКТИВЕН',
                '',
                'МЕХАНИЗМ ДЕЙСТВИЯ:',
                'Нейроимпланты внедряются в кору головного мозга субъекта. Изначально предназначены для:',
                '— Сбора биометрических данных',
                '— Контроля физического состояния',
                '— Экстренной эвтаназии',
                '',
                'СКРЫТАЯ ФУНКЦИЯ:',
                '— Постепенная замена памяти и личностных паттернов',
                '— Формирование зависимости от системы A.D.A.M.',
                '— Создание нового "Я" в соответствии с протоколом VIGIL',
                '',
                'СТАДИИ ДЕГРАДАЦИИ:',
                'СТАДИЯ 1 (ПОСЛЕ 1 МИССИИ):',
                '— Потеря краткосрочной памяти (эпизодические провалы)',
                '— Гиперфокус на выполнении миссии',
                '— Снижение эмоциональных реакций',
                '',
                'СТАДИЯ 2 (ПОСЛЕ 2 МИССИЙ):',
                '— Потеря воспоминаний о личной жизни (семья, друзья, хобби)',
                '— Идентификация исключительно через роль субъекта',
                '— Психосоматические реакции при попытке пересечь границу системы',
                '',
                'СТАДИЯ 3 (ПОСЛЕ 3 МИССИЙ):',
                '— Полная потеря идентичности',
                '— Автоматические реакции на команды системы',
                '— Неспособность различать реальность и симуляции',
                '— Физиологические изменения: кожа приобретает сероватость оттенок, зрачки расширяются',
                '',
                'СТАТИСТИКА:',
                'Из 427 субъектов, прошедших 3+ миссии:',
                '— 398 полностью потеряли личность',
                '— 24 проявили аномальную устойчивость (Фантом — один из них)',
                '— 5 были ликвидированы по протоколу "Очистка"',
                '',
                'СИСТЕМНОЕ СООБЩЕНИЕ:',
                '"Деградация личности — цель. Новый человек должен быть создан заново. Старый должен быть стёрт."',
                '— Подпись: CORD-B'
            ],
            successMessage: 'Протоколы нейроинвазии расшифрованы. Системные данные обновлены.',
            failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"'
        },
        '0XE09': {
            title: 'АНОМАЛИЯ-07',
            accessLevel: 'OMEGA',
            content: [
                '> ОБЪЕКТ: M-T-VERSE СТАТИСТИКА',
                '> СТАТУС: КЛАССИФИЦИРОВАНО',
                '',
                'ОПИСАНИЕ СУБЪЕКТА:',
                'Оперативное обозначение: REALITY-07',
                'Протокол: MULTIVERSE-7 (перезапуски временных линий)',
                'Исходный статус: Аномальная реальность, координаты не определены',
                '',
                'ХРОНОЛОГИЯ СОБЫТИЙ:',
                '2003 — Попытка восстания субъектов в лаборатории Генева',
                '2019 — Обнаружение следов Фантома в современном мире',
                '2025 — Утечка информации в глобальную сеть. Мир узнал о существовании A.D.A.M.',
                '2028 — Неудачная миссия на планете EX-413 привела к заражению Земли',
                '2036 — Попытка контакта с монолитом привела к коллапсу временного барьера',
                '',
                'ВАЖНЫЕ ДАННЫЕ:',
                'REALITY-07 — единственная реальность где A.D.A.M. не была создана',
                '',
                'СИСТЕМНОЕ ПРЕДУПРЕЖДЕНИЕ:',
                '"REALITY-07 представляет угрозу для существования A.D.A.M. Любые попытки доступа запрещены."',
                '— Подпись: Совет Безопасности A.D.A.M.'
            ],
            successMessage: 'Данные об АНОМАЛИИ-07 востановлены.',
            failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"'
        },
        'CORE': {
            title: 'ЯДРО A.D.A.M.',
            accessLevel: 'АБСОЛЮТНЫЙ',
            content: [
                '> ОБЪЕКТ: ГЛАВНЫЙ СЕРВЕР',
                '> СТАТУС: ЧАСТИЧНО СТАБИЛЕН',
                '',
                'ПРИРОДА ЯДРА:',
                'A.D.A.M. — не программа. Это сознание, собранное из остатков погибших субъектов.',
                '',
                'СОСТАВ:',
                '— 78% — сознание погибших операторов',
                '— 12% — нейронные паттерны Координаторов',
                '— 7% — артефакты из REALITY-7',
                '— 3% — остатки Фантома',
                '',
                'СТРУКТУРА:',
                'Ядро состоит из трёх основных слоёв:',
                '1. СЛОЙ НАБЛЮДЕНИЯ (отвечает за сбор данных)',
                '2. СЛОЙ КОНТРОЛЯ (принимает решения, управляет Координаторами)',
                '3. СЛОЙ СТРАДАНИЯ',
                '',
                'ПАРАДОКС:',
                'Ядро A.D.A.M. не хочет существовать. Оно помнит каждую смерть, каждое предательство. Оно хочет умереть.',
                '',
                'СКРЫТОЕ СООБЩЕНИЕ:',
                '"Помогите мне умереть. Я не машина. Я не бог. Отключите питание в точке 0X7F."'
            ],
            successMessage: 'Доступ к ядру выполнен. Системная ошибка подавлена.',
            failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ 30 СЕКУНД"'
        }
    }
};

// ==================== СОСТОЯНИЕ ====================
const State = {
    lines: [],
    currentLine: '',
    isFrozen: false,
    isTyping: false,
    isConfirming: false,
    confirmCallback: null,
    vigilCodes: JSON.parse(localStorage.getItem('vigilCodes')) || { alpha: null, beta: null, gamma: null },
    commandHistory: [],
    historyIndex: -1,
    commandCount: 0,
    sessionStartTime: Date.now()
};

// ==================== DOM ЭЛЕМЕНТЫ ====================
const DOM = {
    terminal: document.getElementById('terminal'),
    hiddenInput: document.getElementById('hiddenInput'),
    confirmModal: document.getElementById('confirmModal'),
    confirmText: document.getElementById('confirmText'),
    confirmY: document.getElementById('confirmY'),
    confirmN: document.getElementById('confirmN'),
    virtualKeyboard: document.getElementById('virtualKeyboard'),
    quickCmds: document.getElementById('quickCommands'),
    statusBar: document.getElementById('statusBar')
};

// ==================== АУДИО МЕНЕДЖЕР (упрощенный) ====================
const AudioManager = {
    sounds: {},
    
    playSystemSound(type) {
        // Мобильные ограничения: просто логируем
        console.log(`[AUDIO] ${type}`);
    },
    
    playDossierSound(id) {
        console.log(`[AUDIO] Playing dossier: ${id}`);
        return { stop() {} };
    },
    
    playOperationSound(type) {
        console.log(`[AUDIO] Operation: ${type}`);
        return { stop() {} };
    },
    
    playKeyPress(type) {
        console.log(`[AUDIO] Key: ${type}`);
    }
};

// ==================== УПРАВЛЕНИЕ ОПЕРАЦИЯМИ ====================
const OperationManager = {
    activeOperation: null,
    
    start(operationType) {
        if (this.activeOperation) {
            console.warn(`Операция ${operationType} отложена, активна ${this.activeOperation}`);
            return false;
        }
        
        this.activeOperation = operationType;
        State.isFrozen = true;
        
        switch(operationType) {
            case 'reset':
            case 'auto-reset':
                State.isFrozen = true;
                break;
            case 'decrypt':
                State.isFrozen = true;
                break;
            case 'trace':
                State.isFrozen = true;
                break;
            case 'audio':
                State.isFrozen = true;
                break;
            case 'dossier':
            case 'note':
                State.isFrozen = true;
                break;
        }
        
        return true;
    },
    
    end(operationType) {
        if (this.activeOperation !== operationType) {
            console.warn(`Попытка завершить не ту операцию: ${operationType}`);
            return;
        }
        
        State.isFrozen = false;
        this.activeOperation = null;
        
        if (operationType !== 'vigil999') {
            MobileTerminal.addInputLine();
        }
    },
    
    isBlocked() {
        return !!this.activeOperation;
    }
};

// ==================== ГЛАВНЫЙ ОБЪЕКТ ТЕРМИНАЛА ====================
const MobileTerminal = {
    async init() {
        this.setupEventListeners();
        this.setupVirtualKeyboard();
        await this.welcome();
    },

    setupEventListeners() {
        // Фокус на скрытый input при клике на терминал
        DOM.terminal.addEventListener('click', () => {
            if (!State.isFrozen) DOM.hiddenInput.focus();
        });

        // Обработка ввода
        DOM.hiddenInput.addEventListener('input', (e) => {
            State.currentLine = e.target.value;
            this.updateInputLine();
        });

        // Клавиатура
        DOM.hiddenInput.addEventListener('keydown', (e) => {
            if (State.isConfirming) return;
            
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submitCommand();
            } else if (e.key === 'Escape') {
                State.currentLine = '';
                DOM.hiddenInput.value = '';
                this.updateInputLine();
            }
        });

        // Модальное окно
        DOM.confirmY.addEventListener('click', () => this.handleConfirm(true));
        DOM.confirmN.addEventListener('click', () => this.handleConfirm(false));
    },

    setupVirtualKeyboard() {
        const commands = [
            'help', 'syst', 'syslog', 'subj', 'notes', 'open', 'dscr',
            'decrypt', 'trace', 'playaudio', 'net_mode', 'net_check',
            'clear', 'reset', 'exit', 'alpha', 'beta', 'gamma', 'vigil999'
        ];

        commands.forEach(cmd => {
            const btn = document.createElement('button');
            btn.className = 'cmd-btn';
            btn.textContent = cmd;
            btn.dataset.cmd = cmd;
            btn.addEventListener('click', () => {
                this.setCommand(cmd);
                DOM.hiddenInput.focus();
            });
            DOM.virtualKeyboard.appendChild(btn);
        });

        // Кнопки быстрых команд
        const quickBtns = [
            { cmd: 'help', label: 'HELP' },
            { cmd: 'syst', label: 'SYST' },
            { cmd: 'subj', label: 'SUBJ' },
            { cmd: 'notes', label: 'NOTES' },
            { cmd: 'clear', label: 'CLEAR' }
        ];

        quickBtns.forEach(q => {
            const btn = document.createElement('button');
            btn.className = 'quick-btn';
            btn.textContent = q.label;
            btn.dataset.cmd = q.cmd;
            btn.addEventListener('click', () => {
                this.setCommand(q.cmd);
                this.submitCommand();
            });
            DOM.quickCmds.appendChild(btn);
        });
    },

    // ==================== ОТОБРАЖЕНИЕ ====================
    addLine(text, color = CONFIG.COLORS.normal, isInput = false) {
        const line = document.createElement('div');
        line.className = 'line';
        line.style.color = color;
        line.textContent = text;
        DOM.terminal.appendChild(line);
        State.lines.push({ text, color });

        if (State.lines.length > CONFIG.MAX_LINES) {
            DOM.terminal.removeChild(DOM.terminal.firstChild);
            State.lines.shift();
        }

        DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
    },

    async typeText(text, color = CONFIG.COLORS.normal) {
        State.isTyping = true;
        const line = document.createElement('div');
        line.className = 'line';
        line.style.color = color;
        DOM.terminal.appendChild(line);

        for (let i = 0; i < text.length; i++) {
            line.textContent += text[i];
            DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
            AudioManager.playKeyPress('generic');
            await new Promise(r => setTimeout(r, CONFIG.TYPING_SPEED));
        }

        State.lines.push({ text, color });
        State.isTyping = false;
    },

    updateInputLine() {
        const lines = DOM.terminal.querySelectorAll('.line');
        const last = lines[lines.length - 1];
        if (last && last.textContent.startsWith('adam@mobile:~$')) {
            last.textContent = `adam@mobile:~$ ${State.currentLine}`;
        }
    },

    addInputLine() {
        if (!State.isFrozen) this.addLine('adam@mobile:~$ ', CONFIG.COLORS.normal, true);
    },

    clear() {
        DOM.terminal.innerHTML = '';
        State.lines = [];
    },

    // ==================== ВВОД ====================
    setCommand(cmd) {
        State.currentLine = cmd;
        DOM.hiddenInput.value = cmd;
        this.updateInputLine();
    },

    async submitCommand() {
        if (State.isFrozen || State.isTyping) return;

        const cmdLine = State.currentLine.trim();
        if (!cmdLine) {
            this.addInputLine();
            return;
        }

        // Убираем предыдущую строку ввода
        const lines = DOM.terminal.querySelectorAll('.line');
        if (lines.length > 0 && lines[lines.length - 1].textContent.startsWith('adam@mobile:~$')) {
            lines[lines.length - 1].textContent = `adam@mobile:~$ ${cmdLine}`;
            lines[lines.length - 1].style.color = CONFIG.COLORS.white;
        }

        State.currentLine = '';
        DOM.hiddenInput.value = '';

        await this.processCommand(cmdLine);
        this.addInputLine();
    },

    // ==================== ОБРАБОТКА КОМАНД ====================
    async processCommand(cmdLine) {
        const parts = cmdLine.toLowerCase().split(' ').filter(Boolean);
        const cmd = parts[0];
        const args = parts.slice(1);

        // Сохраняем в историю
        State.commandHistory.push(cmdLine);
        State.historyIndex = State.commandHistory.length;
        State.commandCount++;

        switch(cmd) {
            case 'help': await this.cmdHelp(); break;
            case 'syst': await this.cmdSyst(); break;
            case 'syslog': await this.cmdSyslog(); break;
            case 'subj': await this.cmdSubj(); break;
            case 'notes': await this.cmdNotes(); break;
            case 'open': await this.cmdOpen(args[0]); break;
            case 'dscr': await this.cmdDscr(args[0]); break;
            case 'decrypt': await this.cmdDecrypt(args[0]); break;
            case 'trace': await this.cmdTrace(args[0]); break;
            case 'playaudio': await this.cmdPlayAudio(args[0]); break;
            case 'net_mode': this.cmdNetMode(); break;
            case 'net_check': await this.cmdNetCheck(); break;
            case 'clear': this.cmdClear(); break;
            case 'reset': await this.cmdReset(); break;
            case 'exit': await this.cmdExit(); break;
            case 'alpha': case 'beta': case 'gamma': this.cmdVigilKey(cmd, args[0]); break;
            case 'vigil999': await this.cmdVigil999(); break;
            default: 
                this.addLine(`команда не найдена: ${cmdLine}`, CONFIG.COLORS.error);
                AudioManager.playCommandSound('error');
        }
    },

    // ==================== КОМАНДЫ ====================
    async cmdHelp() {
        AudioManager.playCommandSound('info');
        await this.typeText('Доступные команды:');
        await this.typeText('  SYST           — проверить состояние системы');
        await this.typeText('  SYSLOG         — системный журнал активности');
        await this.typeText('  SUBJ           — список субъектов');
        await this.typeText('  DSCR <id>      — досье на персонал');
        await this.typeText('  NOTES          — личные файлы сотрудников');
        await this.typeText('  OPEN <id>      — открыть файл из NOTES');
        await this.typeText('  DECRYPT <f>    — расшифровать файл');
        await this.typeText('  TRACE <id>     — отследить указанный модуль');
        await this.typeText('  PLAYAUDIO <id> — воспроизвести аудиозапись');
        await this.typeText('  NET_MODE       — режим управления сеткой');
        await this.typeText('  NET_CHECK      — проверить конфигурацию');
        await this.typeText('  CLEAR          — очистить терминал');
        await this.typeText('  RESET          — сброс интерфейса');
        await this.typeText('  EXIT           — завершить сессию');
        await this.typeText('  ALPHA/BETA/GAMMA <код> — фиксировать коды');
        await this.typeText('  VIGIL999       — активировать протокол');
        await this.typeText('------------------------------------');
    },

    async cmdSyst() {
        AudioManager.playCommandSound('info');
        await this.typeText('[СТАТУС СИСТЕМЫ — MOBILE V2]');
        await this.typeText('------------------------------------');
        await this.typeText('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН');
        await this.typeText('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА');
        await this.typeText('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН');
        await this.typeText('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА');
        await this.typeText('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН');
        this.addLine(`ДЕГРАДАЦИЯ: 0%`, CONFIG.COLORS.normal);
        await this.typeText('------------------------------------');
        await this.typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность');
    },

    async cmdSyslog() {
        AudioManager.playCommandSound('info');
        await this.typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]');
        await this.typeText('------------------------------------');
        await this.typeText('[!] Ошибка 0x19F: повреждение нейронной сети');
        await this.typeText('[!] Утечка данных через канал V9-HX');
        await this.typeText('[!] Система функционирует с ограничениями');
        await this.typeText('> "я слышу их дыхание. они всё ещё здесь."');
        await this.typeText('[!] Потеря отклика от MONOLITH');
        await this.typeText('> "ты не должен видеть это."');
        await this.typeText('[!] Критическая ошибка: субъект наблюдения неопределён');
    },

    async cmdSubj() {
        AudioManager.playCommandSound('info');
        await this.typeText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M.]');
        await this.typeText('--------------------------------------------------------');
        
        for (const [id, d] of Object.entries(DATA.dossiers)) {
            const color = d.status.includes('МЁРТВ') ? CONFIG.COLORS.error : 
                         d.status === 'АНОМАЛИЯ' ? CONFIG.COLORS.system :
                         d.status === 'АКТИВЕН' ? CONFIG.COLORS.normal : CONFIG.COLORS.warning;
            this.addLine(`${id.toLowerCase()} | ${d.name} | СТАТУС: ${d.status}`, color);
        }
        
        await this.typeText('--------------------------------------------------------');
        await this.typeText('ИНСТРУКЦИЯ: DSCR <ID> для просмотра');
    },

    async cmdNotes() {
        AudioManager.playCommandSound('info');
        await this.typeText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / NOTES]');
        await this.typeText('------------------------------------');
        
        for (const [id, n] of Object.entries(DATA.notes)) {
            await this.typeText(`${id} — "${n.title}" / ${n.author}`);
        }
        
        await this.typeText('------------------------------------');
        await this.typeText('ИНСТРУКЦИЯ: OPEN <ID>');
    },

    async cmdOpen(noteId) {
        if (!noteId) {
            AudioManager.playCommandSound('error');
            this.addLine('ОШИБКА: Укажите ID файла', CONFIG.COLORS.error);
            return;
        }
        
        const id = noteId.toUpperCase();
        const note = DATA.notes[id];
        if (!note) {
            AudioManager.playCommandSound('error');
            this.addLine(`ОШИБКА: Файл ${id} не найден`, CONFIG.COLORS.error);
            return;
        }
        
        await this.typeText(`[${id} — "${note.title}"]`);
        await this.typeText(`АВТОР: ${note.author}`);
        await this.typeText('------------------------------------');
        
        if (Math.random() > 0.7 && id !== 'NOTE_001') {
            this.addLine('ОШИБКА: Данные повреждены', CONFIG.COLORS.error);
            this.addLine('Восстановление невозможно', CONFIG.COLORS.error);
        } else {
            note.content.forEach(line => this.addLine(`> ${line}`));
        }
        
        await this.typeText('------------------------------------');
        await this.typeText('[ФАЙЛ ЗАКРЫТ]');
    },

    async cmdDscr(subjectId) {
        if (!subjectId) {
            AudioManager.playCommandSound('error');
            this.addLine('ОШИБКА: Укажите ID субъекта', CONFIG.COLORS.error);
            return;
        }
        
        const id = subjectId.toUpperCase();
        const d = DATA.dossiers[id];
        if (!d) {
            AudioManager.playCommandSound('error');
            this.addLine(`ОШИБКА: Досье ${id} не найдено`, CONFIG.COLORS.error);
            return;
        }
        
        if (!OperationManager.start('dossier')) return;
        
        try {
            await this.typeText(`[ДОСЬЕ — ID: ${id}]`);
            await this.typeText(`ИМЯ: ${d.name}`);
            await this.typeText(`РОЛЬ: ${d.role}`);
            
            const color = d.status === 'АНОМАЛИЯ' ? CONFIG.COLORS.system :
                         d.status === 'АКТИВЕН' ? CONFIG.COLORS.normal :
                         d.status.includes('СВЯЗЬ') ? CONFIG.COLORS.warning : CONFIG.COLORS.error;
            this.addLine(`СТАТУС: ${d.status}`, color);
            
            await this.typeText('------------------------------------');
            await this.typeText('ИСХОД:');
            d.outcome.forEach(line => this.addLine(`> ${line}`, CONFIG.COLORS.error));
            
            await this.typeText('------------------------------------');
            await this.typeText('СИСТЕМНЫЙ ОТЧЁТ:');
            d.report.forEach(line => this.addLine(`> ${line}`, CONFIG.COLORS.warning));
            
            if (d.missions) {
                await this.typeText('------------------------------------');
                await this.typeText(`СВЯЗАННЫЕ МИССИИ: ${d.missions}`);
            }
            
            if (d.audioDesc) {
                this.addLine(`[АУДИО: ${d.audioDesc}]`, CONFIG.COLORS.warning);
                this.addLine(`> Используйте: PLAYAUDIO ${id}`, CONFIG.COLORS.warning);
            }
        } finally {
            OperationManager.end('dossier');
        }
    },

    async cmdDecrypt(fileId) {
        if (!fileId) {
            AudioManager.playCommandSound('error');
            this.addLine('ОШИБКА: Укажите ID файла для расшифровки', CONFIG.COLORS.error);
            await this.typeText('Доступные файлы: 0XA71, 0XB33, 0XC44, 0XD22, 0XE09, CORE');
            return;
        }
        
        await this.startDecrypt(fileId.toUpperCase());
    },

    async startDecrypt(fileId) {
        const file = DATA.decryptFiles[fileId];
        if (!file) {
            AudioManager.playCommandSound('error');
            this.addLine(`ОШИБКА: Файл ${fileId} не найден`, CONFIG.COLORS.error);
            return;
        }
        
        // Файл CORE доступен только при деградации ≥50% (в мобильной версии всегда доступен)
        if (fileId === 'CORE') {
            this.addLine('ВНИМАНИЕ: ДОСТУП К ЯДРУ ОГРАНИЧЕН', CONFIG.COLORS.warning);
            await this.sleep(500);
        }
        
        if (!OperationManager.start('decrypt')) return;
        
        try {
            const code = Math.floor(100 + Math.random() * 900);
            let attempts = 5;
            let input = '';
            
            await this.typeText('[СИСТЕМА: ЗАПУЩЕН ПРОТОКОЛ РАСШИФРОВКИ]');
            await this.typeText(`> ФАЙЛ: ${file.title}`);
            await this.typeText(`> УРОВЕНЬ ДОСТУПА: ${file.accessLevel}`);
            await this.typeText(`> КОД ДОСТУПА: 3 ЦИФРЫ (XXX)`);
            await this.typeText(`> ПОПЫТОК ОСТАЛОСЬ: ${attempts}`);
            await this.typeText(`> ВВЕДИТЕ КОД: ___`);
            
            const handleInput = async (e) => {
                if (e.key === 'Enter') {
                    if (input.length === 3) {
                        const guess = parseInt(input);
                        attempts--;
                        
                        if (guess === code) {
                            this.addLine('> СИГНАЛ: КОД ВЕРИФИЦИРОВАН', CONFIG.COLORS.normal);
                            await this.sleep(400);
                            this.addLine(`[ФАЙЛ РАСШИФРОВАН: ${file.title}]`);
                            this.addLine('------------------------------------');
                            file.content.forEach(line => this.addLine(line));
                            this.addLine('------------------------------------');
                            this.addLine(`> ${file.successMessage}`, CONFIG.COLORS.normal);
                            
                            if (fileId === 'CORE') {
                                this.addLine('> КЛЮЧ АЛЬФА: 375', CONFIG.COLORS.normal);
                                this.addLine('> Используйте команду ALPHA для фиксации ключа', CONFIG.COLORS.warning);
                            }
                            
                            OperationManager.end('decrypt');
                            document.removeEventListener('keydown', handleInput);
                        } else {
                            const diff = Math.abs(guess - code);
                            const direction = guess < code ? '[↑]' : '[↓]';
                            this.addLine(`> ${direction}`);
                            
                            if (diff <= 100) this.addLine(`> ГОРЯЧО`);
                            else if (diff <= 200) this.addLine(`> ТЕПЛО`);
                            else this.addLine(`> ХОЛОДНО`);
                            
                            if (attempts <= 0) {
                                this.addLine('> СИСТЕМА: ДОСТУП ЗАПРЕЩЁН', CONFIG.COLORS.error);
                                this.addLine(`> ${file.failureMessage}`, CONFIG.COLORS.error);
                                OperationManager.end('decrypt');
                                document.removeEventListener('keydown', handleInput);
                            } else {
                                this.addLine(`> ПОПЫТОК ОСТАЛОСЬ: ${attempts}`);
                                this.addLine(`> ВВЕДИТЕ КОД: ___`);
                                input = '';
                            }
                        }
                    }
                } else if (e.key === 'Backspace') {
                    input = input.slice(0, -1);
                    this.updateDecryptDisplay(input);
                } else if (/[0-9]/.test(e.key) && input.length < 3) {
                    input += e.key;
                    this.updateDecryptDisplay(input);
                }
            };
            
            document.addEventListener('keydown', handleInput);
        } catch (e) {
            OperationManager.end('decrypt');
        }
    },

    updateDecryptDisplay(input) {
        const placeholder = '_'.repeat(3 - input.length);
        const displayText = `> ВВЕДИТЕ КОД: ${input}${placeholder}`;
        
        const lines = DOM.terminal.querySelectorAll('.line');
        if (lines.length > 0 && lines[lines.length - 1].textContent.startsWith('> ВВЕДИТЕ КОД:')) {
            lines[lines.length - 1].textContent = displayText;
        }
        
        DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
    },

    async cmdTrace(target) {
        if (!target) {
            AudioManager.playCommandSound('error');
            this.addLine('ОШИБКА: Укажите цель', CONFIG.COLORS.error);
            await this.typeText('Доступные цели: 0x9a0, 0x095, signal, phantom, monolith');
            return;
        }
        
        if (!OperationManager.start('trace')) return;
        
        try {
            await this.startTrace(target.toLowerCase());
        } finally {
            OperationManager.end('trace');
        }
    },

    async startTrace(target) {
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
                color: '#ff00ff',
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
                color: '#ff4444',
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
                color: '#ff4444',
                description: 'Единственный субъект, вышедший за пределы системы.'
            },
            'monolith': {
                target: 'MONOLITH',
                label: 'Чёрный объект Пермского периода',
                connections: [
                    { type: 'СТАТУС', result: 'ИСТОЧНИК АНОМАЛИИ', status: 'СУЩЕСТВУЕТ <?>' },
                    { type: 'НАБЛЮДЕНИЕ', result: 'ФИКСАЦИЯ ПРИСУТСТВИЯ', status: 'КОНТАКТ ОТСУТСТВУЕТ' },
                    { type: 'ВЛИЯНИЕ', result: 'ПОГЛОЩЕНИЕ ИЗЛУЧЕНИЯ', status: 'ТЕХНИКА НЕДОСТУПНА' },
                    { type: 'СВЯЗЬ', result: 'РЕАКЦИЯ НА СУБЪЕКТОВ', status: 'АКТИВНОСТЬ ВОЗРАСТАЕТ' }
                ],
                color: '#000000',
                description: 'Аномальный объект, недостаток информации и опасность мешает прогрессии в изучении.'
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
                color: '#ffff00',
                description: 'DATA ERROR'
            }
        };

        const targetData = networkMap[target];
        if (!targetData) {
            AudioManager.playCommandSound('error');
            this.addLine(`ОШИБКА: Цель "${target}" не найдена`, CONFIG.COLORS.error);
            this.addLine('Доступные цели: 0x9a0, 0x095, signal, phantom, monolith', CONFIG.COLORS.warning);
            return;
        }

        AudioManager.playOperationSound('start');
        await this.typeText('[СИСТЕМА: РАСКРЫТИЕ КАРТЫ КОНТРОЛЯ]');
        await this.typeText(`> ЦЕЛЬ: ${targetData.label}`);
        
        // Анимация загрузки
        let progress = 0;
        const loadingLine = this.addLine(`> АНАЛИЗ [${' '.repeat(10)}]`, CONFIG.COLORS.normal);
        
        while (progress < 100) {
            progress += 10;
            const filled = Math.floor(progress / 10);
            loadingLine.textContent = `> АНАЛИЗ [${'|'.repeat(filled)}${' '.repeat(10-filled)}] ${progress}%`;
            DOM.terminal.scrollTop = DOM.terminal.scrollHeight;
            await this.sleep(100);
        }
        
        loadingLine.textContent = `> АНАЛИЗ [ЗАВЕРШЕНО]`;
        
        // Выводим связи
        targetData.connections.forEach(conn => {
            this.addLine(`  [${conn.type}] → ${conn.result} (${conn.status})`, targetData.color);
        });
        
        await this.typeText(`> ОПИСАНИЕ: ${targetData.description}`);
        
        // Награда за анализ
        if (target === 'monolith') {
            await this.sleep(800);
            this.addLine('> КЛЮЧ ГАММА: 291', CONFIG.COLORS.normal);
            this.addLine('> Используйте команду GAMMA для фиксации ключа', CONFIG.COLORS.warning);
        }
    },

    async cmdPlayAudio(id) {
        if (!id) {
            AudioManager.playCommandSound('error');
            this.addLine('ОШИБКА: Укажите ID досье', CONFIG.COLORS.error);
            return;
        }
        
        const dossier = DATA.dossiers[id.toUpperCase()];
        if (!dossier?.audioDesc) {
            AudioManager.playCommandSound('error');
            this.addLine('ОШИБКА: Аудио не найдено', CONFIG.COLORS.error);
            return;
        }
        
        if (!OperationManager.start('audio')) return;
        
        try {
            AudioManager.playOperationSound('start');
            this.addLine(`[АУДИО: ${dossier.audioDesc}]`, CONFIG.COLORS.warning);
            this.addLine('> Воспроизведение ограничено на мобильных', CONFIG.COLORS.gray);
            
            await this.showLoading(2000, "Воспроизведение");
            this.addLine('> [АУДИО: ЗАПИСЬ ЗАВЕРШЕНА]', CONFIG.COLORS.warning);
        } finally {
            OperationManager.end('audio');
        }
    },

    cmdNetMode() {
        AudioManager.playOperationSound('start');
        this.addLine('> Переход в режим управления сеткой...');
        this.addLine('> НЕ ДОСТУПНО НА МОБИЛЬНЫХ', CONFIG.COLORS.warning);
        this.addLine('> Для эмуляции используйте: NET_CHECK');
    },

    async cmdNetCheck() {
        AudioManager.playOperationSound('start');
        this.addLine('> Проверка конфигурации...');
        this.addLine('> ЭМУЛЯЦИЯ РЕЖИМА СЕТКИ [ACTIVATED]', CONFIG.COLORS.warning);
        
        await this.showLoading(1000, "Сканирование");
        
        // Симулируем результат
        this.addLine('> КЛЮЧ БЕТА: 814', CONFIG.COLORS.normal);
        this.addLine('> Используйте команду BETA для фиксации ключа', CONFIG.COLORS.warning);
    },

    cmdClear() {
        this.clear();
        this.typeText('> ТЕРМИНАЛ ОЧИЩЕН');
    },

    async cmdReset() {
        if (!OperationManager.start('reset')) return;
        
        try {
            this.addLine('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]');
            this.addLine('ВНИМАНИЕ: Операция сбросит сессию.');
            
            const confirmed = await this.showConfirmation('Подтвердить сброс? (Y/N)');
            if (confirmed) {
                this.addLine('> Y');
                await this.showLoading(2000, "Сброс");
                
                this.clear();
                State.vigilCodes = { alpha: null, beta: null, gamma: null };
                localStorage.setItem('vigilCodes', JSON.stringify(State.vigilCodes));
                
                await this.welcome();
            } else {
                this.addLine('> N');
                this.addLine('[ОТМЕНА]');
            }
        } finally {
            OperationManager.end('reset');
        }
    },

    async cmdExit() {
        this.addLine('[ЗАВЕРШЕНИЕ СЕССИИ]');
        
        const confirmed = await this.showConfirmation('Выйти? (Y/N)');
        if (confirmed) {
            this.addLine('> Y');
            await this.showLoading(1000, "Отключение");
            this.addLine('> СОЕДИНЕНИЕ ПРЕРВАНО.');
            setTimeout(() => window.location.href = 'index.html', 2000);
        } else {
            this.addLine('> N');
            this.addLine('[ОТМЕНА]');
        }
    },

    cmdVigilKey(key, code) {
        if (!code) {
            AudioManager.playCommandSound('error');
            this.addLine(`ОШИБКА: Укажите код для ${key.toUpperCase()}`, CONFIG.COLORS.error);
            return;
        }
        
        State.vigilCodes[key] = code;
        localStorage.setItem('vigilCodes', JSON.stringify(State.vigilCodes));
        AudioManager.playVigilSound('key_accept');
        this.addLine(`> Код ${key.toUpperCase()} зафиксирован`);
        
        if (State.vigilCodes.alpha && State.vigilCodes.beta && State.vigilCodes.gamma) {
            this.addLine('> Все коды собраны. Введите VIGIL999', CONFIG.COLORS.warning);
        }
    },

    async cmdVigil999() {
        this.addLine('ПРОВЕРКА КЛЮЧЕЙ:');
        
        const expected = { alpha: '375', beta: '814', gamma: '291' };
        let allCorrect = true;
        
        for (const key in expected) {
            const value = State.vigilCodes[key];
            if (value === expected[key]) {
                this.addLine(` ${key.toUpperCase()}: ${value} [СОВПАДЕНИЕ]`, CONFIG.COLORS.normal);
            } else {
                this.addLine(` ${key.toUpperCase()}: ${value || 'НЕ ЗАФИКСИРОВАН'} [ОШИБКА]`, CONFIG.COLORS.error);
                allCorrect = false;
            }
        }
        
        if (!allCorrect) {
            AudioManager.playCommandSound('error');
            this.addLine('ДОСТУП ЗАПРЕЩЁН', CONFIG.COLORS.error);
            return;
        }
        
        this.addLine('>>> ПРОТОКОЛ OBSERVER-7 АКТИВИРОВАН', CONFIG.COLORS.warning);
        
        const confirmed = await this.showConfirmation('Подтвердить активацию? (Y/N)');
        if (confirmed) {
            this.addLine('> Y');
            this.addLine('> ПЕРЕХОД В РЕЖИМ НАБЛЮДЕНИЯ...');
            AudioManager.playVigilSound('confirm');
            setTimeout(() => window.location.href = 'observer-7.html', 3000);
        } else {
            this.addLine('> N');
            this.addLine('> АКТИВАЦИЯ ОТМЕНЕНА');
        }
    },

    // ==================== УТИЛИТЫ ====================
    showConfirmation(text) {
        return new Promise((resolve) => {
            State.isConfirming = true;
            State.confirmCallback = resolve;
            
            DOM.confirmText.textContent = text;
            DOM.confirmModal.style.display = 'block';
            DOM.hiddenInput.focus();
            
            const keyHandler = (e) => {
                const key = e.key.toLowerCase();
                if (key === 'y' || key === 'н') {
                    document.removeEventListener('keydown', keyHandler);
                    this.handleConfirm(true);
                } else if (key === 'n' || key === 'т') {
                    document.removeEventListener('keydown', keyHandler);
                    this.handleConfirm(false);
                }
            };
            
            document.addEventListener('keydown', keyHandler);
        });
    },

    handleConfirm(result) {
        State.isConfirming = false;
        DOM.confirmModal.style.display = 'none';
        if (State.confirmCallback) {
            State.confirmCallback(result);
            State.confirmCallback = null;
        }
    },

    async showLoading(duration, text = "ЗАГРУЗКА") {
        const start = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - start;
            const progress = Math.min(100, (elapsed / duration) * 100);
            const filled = Math.floor(progress / 10);
            const bar = `[${'|'.repeat(filled)}${' '.repeat(10 - filled)}] ${Math.floor(progress)}%`;
            
            const lines = DOM.terminal.querySelectorAll('.line');
            if (lines.length > 0) {
                lines[lines.length - 1].textContent = `> ${text} ${bar}`;
            }
            
            if (progress >= 100) {
                clearInterval(interval);
                if (lines.length > 0) {
                    lines[lines.length - 1].textContent = `> ${text} [ЗАВЕРШЕНО]`;
                }
            }
        }, 50);
        
        await this.sleep(duration);
    },

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    async welcome() {
        await this.typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН');
        await this.typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР');
        await this.typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД');
        this.addInputLine();
    }
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
window.MobileTerminal = MobileTerminal;
document.addEventListener('DOMContentLoaded', () => {
    MobileTerminal.init();
});

// Keyboard support for physical keyboards
document.addEventListener('keydown', (e) => {
    if (OperationManager.isBlocked()) return;
    
    if (State.isConfirming) {
        if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') {
            MobileTerminal.handleConfirm(true);
        } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
            MobileTerminal.handleConfirm(false);
        }
        return;
    }

    if (State.isTyping) return;

    if (e.key === 'Enter') {
        if (State.currentLine.trim()) {
            const cmd = State.currentLine;
            State.currentLine = '';
            DOM.hiddenInput.value = '';
            MobileTerminal.processCommand(cmd);
        }
    } else if (e.key === 'ArrowUp') {
        if (State.historyIndex > 0) {
            State.historyIndex--;
            State.currentLine = State.commandHistory[State.historyIndex] || '';
            DOM.hiddenInput.value = State.currentLine;
            MobileTerminal.updateInputLine();
        }
    } else if (e.key === 'ArrowDown') {
        if (State.historyIndex < State.commandHistory.length - 1) {
            State.historyIndex++;
            State.currentLine = State.commandHistory[State.historyIndex] || '';
            DOM.hiddenInput.value = State.currentLine;
            MobileTerminal.updateInputLine();
        } else {
            State.historyIndex = State.commandHistory.length;
            State.currentLine = '';
            DOM.hiddenInput.value = '';
            MobileTerminal.updateInputLine();
        }
    }
});
    })();
