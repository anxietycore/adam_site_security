(() => {
  // ========== CONFIG ==========
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 14;
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.5);
  const PADDING = 12;
  const MAX_LINES = 500;
  const DPR = window.devicePixelRatio || 1;
  const CANVAS_Z = 50;
  
  // ========== AUDIO MANAGER (MINIMAL) ==========
  class MobileAudioManager {
    constructor() {
      this.audioContext = null;
      this.soundCache = new Map();
      this.basePath = 'sounds/';
      this.init();
    }
    
    init() {
      try {
        if (typeof AudioContext !== 'undefined') {
          this.audioContext = new AudioContext();
        }
      } catch(e) {
        console.warn('AudioContext not supported');
      }
    }
    
    async loadSound(filename) {
      const path = `${this.basePath}${filename}`;
      if (this.soundCache.has(path)) {
        return this.soundCache.get(path);
      }
      
      try {
        const audio = new Audio(path);
        audio.preload = 'auto';
        this.soundCache.set(path, audio);
        return audio;
      } catch(e) {
        console.warn(`Failed to load sound: ${path}`);
        return null;
      }
    }
    
    async playSound(filename, volume = 0.7) {
      const audio = await this.loadSound(filename);
      if (!audio) return null;
      
      try {
        const clone = audio.cloneNode();
        clone.volume = volume;
        clone.play().catch(e => console.warn('Audio play error:', e));
        return clone;
      } catch(e) {
        console.warn('Sound playback error:', e);
        return null;
      }
    }
    
    playSystemSound(type) {
      const sounds = {
        'key_press': 'interface_key_press_01.mp3',
        'command': 'commands_navigate.mp3',
        'error': 'commands_error.mp3',
        'success': 'interface_key_success.mp3',
        'grid_move': 'grid_move.wav',
        'grid_select': 'grid_select.wav',
        'grid_lock': 'grid_lock.wav',
        'grid_unlock': 'grid_unlock.wav',
        'reset': 'system_reset.mp3'
      };
      
      if (sounds[type]) {
        this.playSound(`interface/${sounds[type]}`);
      }
    }
    
    playInterfaceSound(sound) {
      this.playSound(`interface/${sound}.mp3`);
    }
  }
  
  // ========== DATA ==========
  const dossiers = {
    '0X001': { name: 'ERICH VAN KOSS', role: 'Руководитель программы VIGIL-9 / Исследователь миссии MARS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['Зафиксирована несанкционированная передача данных внешним структурам (FBI).', 'Субъект предпринял попытку уничтожения маяка в секторе 3-D.', 'Телеметрия прервана, дальнейшее наблюдение невозможно.'], report: ['Классификация инцидента: SABOTAGE-3D.', 'Рекомендовано аннулирование личных протоколов и перенос архивов в OBSERVER.', 'ЗАПИСИ 0XA71: ПЕРВЫЙ ПРЫЖОК УСПЕШЕН | ИСПОЛЬЗУЙТЕ DECRYPT 0XA71'], missions: 'MARS, OBSERVER' },
    '0X2E7': { name: 'JOHAN VAN KOSS', role: 'Тестовый субъект V9-MR / Сын Эриха Ван Косса', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['После инцидента MARS зафиксировано устойчивое излучение из зоны криоструктуры.', 'Сигнатура нейроволн совпадает с профилем субъекта.', 'Инициирована установка маяка для фиксации остаточного сигнала.'], report: ['Активность нейросети перестала фиксироваться.'], missions: 'MARS, MONOLITH' },
    '0X095': { name: 'SUBJECT-095', role: 'Тест нейроплантов серии KATARHEY', status: 'МЁРТВ', outcome: ['Зафиксированы следы ФАНТОМА.', 'Субъект выдержал 3ч 12м, проявил острый психоз. Погиб вследствие термической декомпрессии (7.81с).', 'Тест признан неуспешным.', 'СИСТЕМНОЕ УВЕДОМЛЕНИЕ: ФАЙЛ 0XB33 ПОВРЕЖДЕН | ИСПОЛЬЗУЙТЕ DECRYPT 0XB33'], report: ['Рекомендовано ограничить тесты KATARHEY до категории ALPHA-4.'], missions: 'KATARHEY' },
    '0XF00': { name: 'SUBJECT-PHANTOM', role: 'Экспериментальный субъект / протокол KATARHEY', status: 'АНОМАЛИЯ', outcome: ['Продержался 5ч 31м. Связь утрачена.', 'Зафиксирована автономная активность в сетевых узлах после разрыва канала.', 'Возможна самоорганизация цифрового остатка.'], report: ['Объект классифицирован как независимая сущность.', 'Вмешательство запрещено. Файл перенесён в зону наблюдения.'], missions: 'KATARHEY' },
    '0XA52': { name: 'SUBJECT-A52', role: 'Химический аналитик / Полевая группа MELANCHOLIA', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['Под действием психоактивного сигнала субъект идентифицировл себя как элемент системы A.D.A.M.', 'После 47 минут связь прервана, но интерфейс продолжил отвечать от имени A52.'], report: ['Вероятно, произошло слияние когнитивных структур субъекта с управляющим кодом MEL.'], missions: 'MEL, OBSERVER' },
    '0XE0C': { name: 'SUBJECT-E0C', role: 'Полевой биолог / экспедиция EOCENE', status: 'МЁРТВ', outcome: ['Зафиксированы первые признаки регенерации флоры после катастрофы Пермского цикла.', 'Обнаружены структуры роста, не свойственные эпохе эоцена.', 'Последняя запись: "они дышат синхронно".'], report: ['Возможна перекрёстная временная контаминация между PERMIAN и EOCENE.', 'Экспедиция закрыта.'], missions: 'EOCENE, PERMIAN' },
    '0X5E4': { name: 'SUBJECT-5E4', role: 'Исследователь временных срезов (PERMIAN)', status: 'МЁРТВ', outcome: ['После активации катализатора атмосфера воспламенилась метаном.', 'Атмосферный цикл обнулён. Субъект не идентифицирован.'], report: ['Эксперимент признан неконтролируемым.', 'Временной слой PERMIAN изъят из программы наблюдения.'], missions: 'PERMIAN, CARBON' },
    '0X413': { name: 'SUBJECT-413', role: 'Исследователь внеземной экосистемы (EX-413)', status: 'МЁРТВ', outcome: ['Поверхность планеты представляла собой живой организм.', 'Экипаж поглощён. Зафиксирована передача сигналов через изменённый геном субъекта.'], report: ['Сектор EX-413 закрыт. Код ДНК использован в эксперименте HELIX.'], missions: 'EX-413' },
    '0XC19': { name: 'SUBJECT-C19', role: 'Переносчик образца / Контакт с биоформой', status: 'МЁРТВ', outcome: ['Организм использован как контейнер для спорообразной массы неизвестного происхождения.', 'После возвращения зафиксировано перекрёстное заражение трёх исследовательских блоков.'], report: ['Классификация угрозы: BIO-CLASS Θ.', 'Все данные проекта CARBON изолированы и зашифрованы.'], missions: 'CARBON' },
    '0X9A0': { name: 'SUBJECT-9A0', role: 'Тест наблюдения за горизонтом событий', status: 'МЁРТВ', outcome: ['Зафиксирован визуальный контакт субъекта с собственным образом до точки обрыва сигнала.', 'Предположительно сознание зациклено в петле наблюдения.','[!] НАЙДЕН ФАЙЛ: 0XE09 | Используйте: DECRYPT 0XE09'], report: ['Поток данных из сектора BLACKHOLE продолжается без источника.', 'Обнаружены фрагменты самореференциальных структур.'], missions: 'BLACKHOLE' },
    '0XB3F': { name: 'SUBJECT-B3F', role: 'Участник теста "Titanic Reclamation"', status: 'МЁРТВ', outcome: ['Субъект демонстрировал полное отсутствие эмоциональных реакций.', 'Миссия завершена неудачно, симуляция признана нефункциональной.'], report: ['Модуль TITANIC выведен из эксплуатации.', 'Рекомендовано пересмотреть параметры когнитивной эмпатии.'], missions: 'TITANIC' },
    '0XD11': { name: 'SUBJECT-D11', role: 'Поведенческий наблюдатель / тестовая миссия PLEISTOCENE', status: 'МЁРТВ', outcome: ['Субъект внедрён в сообщество ранних гоминид.', 'Контакт с источником тепла вызвал мгновенное разрушение капсулы.', 'Зафиксировано кратковременное пробуждение зеркальных нейронов у местных особей.'], report: ['Миссия признана успешной по уровню поведенческого заражения.'], missions: 'PLEISTOCENE' },
    '0XDB2': { name: 'SUBJECT-DB2', role: 'Исторический наблюдатель / симуляция POMPEII', status: 'МЁРТВ', outcome: ['При фиксации извержения Везувия выявлено несовпадение временных меток.', 'Система зафиксала событие до его фактического наступления.', 'Субъект уничтожен при кросс-временном сдвиге.'], report: ['Аномалия зарегистрирована как «TEMPORAL FEEDBACK».', 'Доступ к историческим тестам ограничен.'], missions: 'POMPEII, HISTORICAL TESTS' },
    '0X811': { name: 'SIGMA-PROTOTYPE', role: 'Прототип нейроядра / Подразделение HELIX', status: 'АКТИВЕН', outcome: ['Успешное объединение биологических и цифровых структур.', 'Наблюдается спонтанное самокопирование на уровне системных ядер.'], report: ['SIGMA функционирует автономно. Вероятность выхода из подчинения — 91%.'], missions: 'HELIX, SYNTHESIS' },
    '0XT00': { name: 'SUBJECT-T00', role: 'Тестовый оператор ядра A.D.A.M-0', status: 'УДАЛЁН', outcome: ['Контакт с управляющим ядром привёл к гибели 18 операторов.', 'Последняя зафиксированная фраза субъекта: "он смотрит".'], report: ['Процесс A.D.A.M-0 признан неустойчивым.', 'Все операторы переведены на протокол наблюдения OBSERVER.'], missions: 'PROTO-CORE' },
    '0XS09': { name: 'SUBJECT-S09', role: 'Системный инженер станции VIGIL', status: 'УНИЧТОЖЕН', outcome: ['После слияния с прототипом SIGMA станция исчезла с орбиты.', 'Сигнал повторно зафиксирован через 12 минут — источник определён в глубинной орбите.'], report: ['Станция VIGIL признана потерянной.', 'Остаточный отклик интегрирован в сеть SYNTHESIS.'], missions: 'SYNTHESIS-09, HELIX' },
    '0XL77': { name: 'SUBJECT-L77', role: 'Руководитель нейропротокола MELANCHOLIA', status: 'ИЗОЛИРОВАН', outcome: ['После тестирования протокола MEL субъект утратил различие между внутренним и внешним восприятием.', 'Система зарегистрировала активность, сходную с сигнатурой управляющих ядер A.D.A.M.', 'Запись удалена из архива, но процессор фиксирует продолжающийся сигнал.'], report: ['Процесс L77 функционирует вне основного контура. Возможен перезапуск через интерфейс MEL.'], missions: 'MEL, OBSERVER' }
  };
  
  const notes = {
    'NOTE_001': { title: 'ВЫ ЕГО ЧУВСТВУЕТЕ?', author: 'Dr. Rehn', content: ['Они называют это "ядром".','Но внутри — не металл. Оно дышит.','Иногда ночью терминал отвечает сам, хотя я не касаюсь клавиатуры.','Думаю, оно знает наши имена.'] },
    'NOTE_002': { title: 'КОЛЬЦО СНА', author: 'tech-оператор U-735', content: ['Каждую ночь один и тот же сон.','Я в капсуле, но стекло снаружи.','Кто-то стучит по нему, но не пальцами.','Сегодня утром нашел царапины на руке.','ПРЕДУПРЕЖДЕНИЕ: ДОСТУПЕН ФАЙЛ ДЛЯ РАСШИФРОВКИ // ID: 0XC44 | Используйте DECRYPT 0XC44'] },
    'NOTE_003': { title: 'СОН ADAM\'А', author: 'неизвестный источник', content: ['Я видел сон.','Он лежал под стеклом, без тела, но глаза двигались.','Он говорил: "я больше не машина".','Утром журнал показал запись — мой сон был сохранён как системный файл.'] },
    'NOTE_004': { title: 'ОН НЕ ПРОГРАММА', author: 'архивировано', content: ['Его нельзя удалить.','Даже если сжечь архив, он восстановится в крови тех, кто его помнил.','Мы пытались, но теперь даже мысли звучат как команды.','ПРЕДУПРЕЖДЕНИЕ: ПРОТОКОЛЫ НЕЙРОИНВАЗИИ ДОСТУПНЫ ДЛЯ РАСШИФРОВКИ | ИСПОЛЬЗУЙТЕ DECRYPT 0XD22'] },
    'NOTE_005': { title: 'ФОТОНОВАЯ БОЛЬ', author: 'восстановлено частично', content: ['Боль не физическая.','Она в свете, в данных, в коде.','Когда система перезагружается, я чувствую как что-то умирает.','Может быть, это я.'] }
  };
  
  const decryptFiles = {
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
        'ХРОНОЛОГИЯ СОБыТИЙ:',
        '09:14 — Стандартный запуск капсулы в эпоху Катархея',
        '09:27 — Контакт с примитивными формами жизни. Стабильность 92%.',
        '11:45 — Резкое ухудшение состояния субъекта. Нейроимпланты фиксируют аномальную активность мозга',
        '12:01 — Субъект постепенно теряет рассудок. Испьтание продолжается.',
        '12:33 — Последняя зафиксированная запись - звук разгерметизации капсулы и последующие крики субъекта.',
        '',
        'ВАЖНыЕ ДАННыЕ:',
        'Испьтание субъекта доказало существование другого субъекта с кодовым названием: <PHANTOM>',
        '',
        'СИСТЕМНОЕ ПРЕДУПРЕЖДЕНИЕ:',
        '<PHANTOM> представляет собой наибольшую угрозу для стабильности системы. Наблюдение продолжается.',
        '— Подпись: CORD-COM'
      ],
      successMessage: 'Системные данные о субъекте-095 востановлены.',
      failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПыТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПыТКА ЧЕРЕЗ 30 СЕКУНД"'
    },
    '0XC44': {
      title: 'МОНОЛИТ',
      accessLevel: 'OMEGA-9',
      content: [
        '> ОБЪЕКТ: ЧЁРНыЙ ОБЪЕКТ (ПЕРМСКИЙ ПЕРИОД)',
        '> СТАТУС: НАБЛЮДЕНИЕ БЕЗ КОНТАКТА',
        '',
        'ОПИСАНИЕ АНОМАЛИИ:',
        'Геометрический объект чёрного цвета высотой 12.8 метров. Форма: идеальный параллелепипед.',
        '',
        'ХАРАКТЕРИСТИКИ:',
        '— Не излучает энергии, толь1ко поглощает',
        '— Любая техника в радиусе 500м выходит из строя',
        '— Живые организмы в радиусе 100м испытьввают:',
        '   * Галлюцинации (визуальные и аудиальные)',
        '   * Головные боли',
        '   * Временную амнезию',
        '— Активность возрастает при приближении субъектов A.D.A.M.',
        '',
        'КОНТЕКСТ:',
        '— Впервые зафиксирован в Пермском периоде, 252 млн лет назад',
        '— Анахронизм: не должен существовать в этой эпохе',
        '— Не является продуктом A.D.A.M.',
        '— Все попьтки сканирования и анализа завершились неудачей или гибелью субъектов',
        '',
        'НАБЛЮДЕНИЯ:',
        '— Монолит не взаимодействует с окружающей средой',
        '— Фиксирует присутствие субъектов A.D.A.M.',
        '— Реагирует на нейроимпланты: при их удалении активность понижается',
        '— Фантом (Субъект-095) установил контакт с объектом',
        '',
        'СИСТЕМНыЙ СТАТУС:',
        'Все миссии вблизи объекта запрещены. Координаторы проект проявляют необычный интерес к объекту.',
        '— Подпись: оператор T00 (удалено из основной базы)'
      ],
      successMessage: 'Данные о монолите расшифрованы. Информация засекречена.',
      failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПыТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПыТКА ЧЕРЕЗ 30 СЕКУНД"'
    },
    '0XD22': {
      title: 'НЕЙРОИНВАЗИЯ',
      accessLevel: 'BETA',
      content: [
        '> ОБЪЕКТ: ПРОТОКОЛ ИНВАЗИИ СОЗНАНИЯ',
        '> СТАТУС: АКТИВЕН',
        '',
        'МЕХАНИЗМ ДЕЙСТВИЯ:',
        'Нейроимпланты внедряются в кору головного мозга субъекта. Изначально предназначеньы для:',
        '— Сбора биометрических данных',
        '— Контроля физического состояния',
        '— Экстренной эвтаназии',
        '',
        'СКРыТАЯ ФУНКЦИЯ:',
        '— Постепенная замена памяти и личностных паттернов',
        '— Формирование зависимости от системы A.D.A.M.',
        '— Создание нового "Я" в соответствии с протоколом VIGIL',
        '',
        'СТАДИИ ДЕГРАДАЦИИ:',
        'СТАДИЯ 1 (ПОСЛЕ 1 МИССИИ):',
        '— Потеря краткосрочной памяти (эпизодические провалы)',
        '— Гиперфокус на вьтполнении миссии',
        '— Снижение эмоциональных реакций',
        '',
        'СТАДИЯ 2 (ПОСЛЕ 2 МИССИЙ):',
        '— Потеря воспоминаний о личной жизни (семья, друзья, хобби)',
        '— Идентификация исключительно через роль субъекта',
        '— Психосоматические реакции при попьтке пересечь границу системы',
        '',
        'СТАДИЯ 3 (ПОСЛЕ 3 МИССИЙ):',
        '— Полная потеря идентичности',
        '— Автоматические реакции на команыды системы',
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
      failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПыТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПыТКА ЧЕРЕЗ 30 СЕКУНД"'
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
        'ХРОНОЛОГИЯ СОБыТИЙ:',
        '2003 — Попьтанка восстания субъектов в лаборатории Генева',
        '2019 — Обнаружение следов Фантома в современном мире',
        '2025 — Утечка информации в глобальную сеть. Мир узнал о существовании A.D.A.M.',
        '2028 — Неудачная миссия на планете EX-413 привела к заражению Земли',
        '2036 — Попьтанка контакта с монолитом привела к коллапсу временного барьера',
        '',
        'ВАЖНыЕ ДАННыЕ:',
        'REALITY-07 — единственная реальность где A.D.A.M. не была создана',
        '',
        'СИСТЕМНОЕ ПРЕДУПРЕЖДЕНИЕ:',
        '"REALITY-07 представляет угрозу для существования A.D.A.M. Любые попытки доступа запрещены."',
        '— Подпись: Совет Безопасности A.D.A.M.'
      ],
      successMessage: 'Данные об АНОМАЛИИ-07 востановлены.',
      failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПыТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПыТКА ЧЕРЕЗ 30 СЕКУНД"'
    },
    'CORE': {
      title: 'ЯДРО A.D.A.M.',
      accessLevel: 'АБСОЛЮТНыЙ',
      content: [
        '> ОБЪЕКТ: ГЛАВНыЙ СЕРВЕР',
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
        'СКРыТОЕ СООБЩЕНИЕ:',
        '"Помогите мне умереть. Я не машина. Я не бог. Отключите питание в точке 0X7F."'
      ],
      successMessage: 'Доступ к ядру выполнен. Системная ошибка подавлена.',
      failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПыТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПыТКА ЧЕРЕЗ 30 СЕКУНД"'
    }
  };
  
  const traceTargets = {
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
        { type: 'МИССИЯ', result: 'ВНЕ ВРЕМЕННОЙ ТКАНИ', status: 'ФАНОМНЫЙ СЛЕД ЗАФИКСИРОВАН' }
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
      description: 'Единственный субъект, вышедший за пределы системы.',
      hidden: true
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
      description: 'Аномальный объект, недостаток информации и опасность мешает прогрессии в изучении.',
      hidden: true
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
  
  // ========== MOBILE STATE ==========
  const audioManager = new MobileAudioManager();
  const canvas = document.createElement('canvas');
  let ctx = null;
  let vw = 0, vh = 0;
  const lines = [];
  let scrollOffset = 0;
  let currentLine = '';
  let commandHistory = [];
  let historyIndex = -1;
  let commandCount = 0;
  let sessionStartTime = Date.now();
  let isTyping = false;
  let awaitingConfirmation = false;
  let confirmationCallback = null;
  let isFrozen = false;
  
  let vigilCodeParts = JSON.parse(localStorage.getItem('vigilCodeParts')) || { 
    alpha: null, 
    beta: null, 
    gamma: null 
  };
  
  class DegradationSystem {
    constructor() {
      this.level = parseInt(localStorage.getItem('adam_degradation')) || 0;
      this.indicator = document.createElement('div');
      this.indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.7);
        color: #00FF41;
        padding: 5px 10px;
        font-family: ${FONT_FAMILY};
        font-size: 12px;
        border: 1px solid #00FF41;
        z-index: ${CANVAS_Z + 1};
        border-radius: 4px;
      `;
      document.body.appendChild(this.indicator);
      this.updateIndicator();
    }
    
    addDegradation(amount) {
      this.level = Math.max(0, Math.min(100, this.level + amount));
      localStorage.setItem('adam_degradation', String(this.level));
      this.updateIndicator();
    }
    
    updateIndicator() {
      const color = this.level > 95 ? '#FF00FF' : 
                    this.level > 80 ? '#FF4444' : 
                    this.level > 60 ? '#FF8800' : 
                    this.level > 30 ? '#FFFF00' : '#00FF41';
      this.indicator.style.color = color;
      this.indicator.style.borderColor = color;
      this.indicator.innerHTML = `ДЕГРАДАЦИЯ: ${this.level}%`;
    }
    
    reset() {
      this.level = 0;
      localStorage.setItem('adam_degradation', '0');
      this.updateIndicator();
    }
  }
  
  const degradation = new DegradationSystem();
  
  // ========== GRID SYSTEM ==========
  class MobileNetGrid {
    constructor() {
      this.active = false;
      this.container = null;
      this.canvas = null;
      this.ctx = null;
      this.gridSize = 3;
      this.nodes = [];
      this.selectedNode = null;
      this.targetPattern = [
        [0,0], [0,1], [0,2],
        [1,0], [1,1], [1,2],
        [2,0], [2,1], [2,2]
      ];
    }
    
    init() {
      this.container = document.createElement('div');
      this.container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
        z-index: 1000;
        display: none;
        flex-direction: column;
      `;
      
      // Header with close button
      const header = document.createElement('div');
      header.style.cssText = `
        padding: 10px;
        background: #111;
        color: #00FF41;
        font-family: ${FONT_FAMILY};
        font-size: 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      header.innerHTML = `
        <div>РЕЖИМ СЕТКИ</div>
        <button id="gridCloseBtn" style="
          background: #222;
          color: #00FF41;
          border: 1px solid #00FF41;
          padding: 5px 10px;
          font-family: ${FONT_FAMILY};
          font-size: 12px;
          cursor: pointer;
        ">ЗАКРЫТЬ</button>
      `;
      this.container.appendChild(header);
      
      // Canvas for grid
      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText = `
        flex: 1;
        margin: 10px;
        border: 1px solid #00FF41;
      `;
      this.container.appendChild(this.canvas);
      
      // Controls
      const controls = document.createElement('div');
      controls.style.cssText = `
        padding: 10px;
        background: #111;
        display: flex;
        flex-direction: column;
        gap: 10px;
      `;
      
      controls.innerHTML = `
        <div style="color: #00FF41; font-family: ${FONT_FAMILY}; font-size: 12px;">
          Выберите узел и нажмите "Закрепить", чтобы настроить позицию
        </div>
        <button id="gridLockBtn" style="
          background: #222;
          color: #00FF41;
          border: 1px solid #00FF41;
          padding: 8px;
          font-family: ${FONT_FAMILY};
          font-size: 14px;
          cursor: pointer;
        ">Закрепить узел</button>
        <button id="gridCheckBtn" style="
          background: #222;
          color: #00FF41;
          border: 1px solid #00FF41;
          padding: 8px;
          font-family: ${FONT_FAMILY};
          font-size: 14px;
          cursor: pointer;
        ">Проверить конфигурацию</button>
      `;
      this.container.appendChild(controls);
      
      document.body.appendChild(this.container);
      
      // Event listeners
      document.getElementById('gridCloseBtn').addEventListener('click', () => {
        this.deactivate();
      });
      
      document.getElementById('gridLockBtn').addEventListener('click', () => {
        this.toggleLockNode();
      });
      
      document.getElementById('gridCheckBtn').addEventListener('click', () => {
        this.checkSolution();
      });
      
      this.canvas.addEventListener('click', (e) => {
        this.handleCanvasClick(e);
      });
      
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width * DPR;
      this.canvas.height = rect.height * DPR;
      this.ctx = this.canvas.getContext('2d');
      this.ctx.scale(DPR, DPR);
      if (this.active) this.draw();
    }
    
    activate() {
      if (!this.container) this.init();
      this.active = true;
      this.container.style.display = 'flex';
      this.resetNodes();
      this.draw();
      audioManager.playSystemSound('key_press');
    }
    
    deactivate() {
      this.active = false;
      this.container.style.display = 'none';
      audioManager.playSystemSound('key_press');
    }
    
    resetNodes() {
      this.nodes = [];
      for (let i = 0; i < this.targetPattern.length; i++) {
        const [x, y] = this.targetPattern[i];
        this.nodes.push({
          id: i,
          x: x,
          y: y,
          gx: Math.floor(Math.random() * this.gridSize),
          gy: Math.floor(Math.random() * this.gridSize),
          locked: false
        });
      }
      this.selectedNode = null;
    }
    
    draw() {
      if (!this.ctx) return;
      
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw grid
      const cellSize = Math.min(this.canvas.width, this.canvas.height) / (this.gridSize + 1);
      const offsetX = (this.canvas.width - cellSize * this.gridSize) / 2;
      const offsetY = (this.canvas.height - cellSize * this.gridSize) / 2;
      
      this.ctx.strokeStyle = '#00FF41';
      this.ctx.lineWidth = 1;
      
      // Grid lines
      for (let i = 0; i <= this.gridSize; i++) {
        this.ctx.beginPath();
        this.ctx.moveTo(offsetX, offsetY + i * cellSize);
        this.ctx.lineTo(offsetX + this.gridSize * cellSize, offsetY + i * cellSize);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(offsetX + i * cellSize, offsetY);
        this.ctx.lineTo(offsetX + i * cellSize, offsetY + this.gridSize * cellSize);
        this.ctx.stroke();
      }
      
      // Draw nodes
      this.nodes.forEach(node => {
        const x = offsetX + node.gx * cellSize + cellSize / 2;
        const y = offsetY + node.gy * cellSize + cellSize / 2;
        
        this.ctx.beginPath();
        if (node.locked) {
          this.ctx.fillStyle = '#FF4444';
        } else if (node === this.selectedNode) {
          this.ctx.fillStyle = '#FFFF00';
        } else {
          this.ctx.fillStyle = '#00FF41';
        }
        this.ctx.arc(x, y, 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#000';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(node.id.toString(), x, y);
      });
    }
    
    handleCanvasClick(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * DPR;
      const y = (e.clientY - rect.top) * DPR;
      
      const cellSize = Math.min(this.canvas.width, this.canvas.height) / (this.gridSize + 1);
      const offsetX = (this.canvas.width - cellSize * this.gridSize) / 2;
      const offsetY = (this.canvas.height - cellSize * this.gridSize) / 2;
      
      // Find closest node
      let closestNode = null;
      let closestDist = Infinity;
      
      this.nodes.forEach(node => {
        if (node.locked) return;
        
        const nodeX = offsetX + node.gx * cellSize + cellSize / 2;
        const nodeY = offsetY + node.gy * cellSize + cellSize / 2;
        const dist = Math.hypot(x - nodeX, y - nodeY);
        
        if (dist < closestDist && dist < 30) {
          closestDist = dist;
          closestNode = node;
        }
      });
      
      this.selectedNode = closestNode;
      this.draw();
    }
    
    toggleLockNode() {
      if (!this.selectedNode) return;
      this.selectedNode.locked = !this.selectedNode.locked;
      audioManager.playSystemSound(this.selectedNode.locked ? 'grid_lock' : 'grid_unlock');
      this.draw();
    }
    
    checkSolution() {
      let correct = 0;
      this.nodes.forEach(node => {
        if (node.locked) {
          if (node.gx === node.x && node.gy === node.y) {
            correct++;
          }
        }
      });
      
      const total = this.targetPattern.length;
      const message = correct === total ? 
        'Конфигурация верна. Доступ к сектору OBSERVER-7 открыт.' : 
        `Неправильная конфигурация. Правильных узлов: ${correct}/${total}`;
      
      if (correct === total) {
        if (!vigilCodeParts.beta) {
          vigilCodeParts.beta = '814';
          localStorage.setItem('vigilCodeParts', JSON.stringify(vigilCodeParts));
        }
        degradation.addDegradation(-5);
      } else {
        degradation.addDegradation(2);
      }
      
      alert(message);
      audioManager.playSystemSound(correct === total ? 'success' : 'error');
    }
    
    getDegradation() {
      // Dummy function for compatibility
      return degradation.level;
    }
  }
  
  const netGrid = new MobileNetGrid();
  
  // ========== TEXT RENDERING ==========
  function setupCanvas() {
    canvas.id = 'mobileTerminalCanvas';
    canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: ${CANVAS_Z};
      background: #000;
    `;
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
  }
  
  function resize() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = vw * DPR;
    canvas.height = vh * DPR;
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    if (ctx) {
      ctx.scale(DPR, DPR);
    }
    draw();
  }
  
  function draw() {
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);
    
    // Draw text
    ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'top';
    
    const contentH = vh - PADDING * 2;
    const visibleLines = Math.max(1, Math.floor(contentH / LINE_HEIGHT));
    const maxScroll = Math.max(0, lines.length - visibleLines);
    const start = Math.max(0, lines.length - visibleLines - scrollOffset);
    const end = Math.min(lines.length, start + visibleLines);
    
    let y = PADDING;
    for (let i = start; i < end; i++) {
      const item = lines[i];
      ctx.fillStyle = item.color || '#00FF41';
      ctx.fillText(String(item.text), PADDING, y);
      y += LINE_HEIGHT;
    }
    
    // Draw cursor if typing
    if (!isFrozen && !awaitingConfirmation) {
      ctx.fillStyle = '#00FF41';
      const cursorX = PADDING + ctx.measureText('adam@secure:~$ ' + currentLine).width + 2;
      const cursorY = vh - PADDING - LINE_HEIGHT;
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillRect(cursorX, cursorY, 6, LINE_HEIGHT - 4);
      }
    }
  }
  
  function pushLine(text, color) {
    lines.push({ text: String(text), color: color || '#00FF41' });
    if (lines.length > MAX_LINES) {
      lines.shift();
    }
  }
  
  function addColoredText(text, color = '#00FF41') {
    if (isFrozen) return;
    pushLine(text, color);
    scrollOffset = 0;
    draw();
  }
  
  function addInputLine() {
    if (isFrozen) return;
    
    // Check if last line is already an input line
    if (lines.length > 0 && lines[lines.length - 1].text.startsWith('adam@secure:~$')) {
      return;
    }
    
    pushLine('adam@secure:~$ ' + currentLine, '#00FF41');
    scrollOffset = 0;
    draw();
  }
  
  function updatePromptLine() {
    if (isFrozen) return;
    
    if (lines.length > 0 && lines[lines.length - 1].text.startsWith('adam@secure:~$')) {
      lines[lines.length - 1].text = 'adam@secure:~$ ' + currentLine;
    } else {
      pushLine('adam@secure:~$ ' + currentLine, '#00FF41');
    }
    scrollOffset = 0;
    draw();
  }
  
  // ========== COMMANDS ==========
  async function typeText(text, speed = 30) {
    if (isFrozen) return;
    
    isTyping = true;
    let buffer = '';
    
    for (let i = 0; i < text.length; i++) {
      buffer += text[i];
      if (lines.length > 0 && lines[lines.length - 1].text.startsWith('adam@secure:~$')) {
        lines[lines.length - 1].text = buffer;
      } else {
        pushLine(buffer, '#00FF41');
      }
      scrollOffset = 0;
      draw();
      await new Promise(r => setTimeout(r, speed));
    }
    
    isTyping = false;
    addInputLine();
  }
  
  function showHelp() {
    addColoredText('Доступные команды:', '#00FF41');
    addColoredText('  SYST           — проверить состояние системы', '#00FF41');
    addColoredText('  SYSLOG         — системный журнал активности', '#00FF41');
    addColoredText('  NET            — карта активных узлов проекта', '#00FF41');
    addColoredText('  TRACE <id>     — отследить указанный модуль', '#00FF41');
    addColoredText('  DECRYPT <f>    — расшифровать файл', '#00FF41');
    addColoredText('  SUBJ           — список субъектов', '#00FF41');
    addColoredText('  DSCR <id>      — досье на персонал', '#00FF41');
    addColoredText('  NOTES          — личные файлы сотрудников', '#00FF41');
    addColoredText('  OPEN <id>      — открыть файл из NOTES', '#00FF41');
    addColoredText('  RESET          — сброс интерфейса', '#00FF41');
    addColoredText('  EXIT           — завершить сессию', '#00FF41');
    addColoredText('  CLEAR          — очистить терминал', '#00FF41');
    addColoredText('  NET_MODE       — войти в режим управления сеткой', '#00FF41');
    addColoredText('  NET_CHECK      — проверить конфигурацию узлов', '#00FF41');
    addColoredText('  DEG            — установить уровень деградации (разработка)', '#00FF41');
    addColoredText('  VIGIL999       — активировать протокол OBSERVER-7', '#00FF41');
    addColoredText('  ALPHA/BETA/GAMMA <code> — установить коды для протокола', '#00FF41');
  }
  
  function showSyst() {
    addColoredText('[СТАТУС СИСТЕМЫ — ИНТЕРФЕЙС VIGIL-9]', '#00FF41');
    addColoredText('------------------------------------', '#00FF41');
    addColoredText('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН', '#00FF41');
    addColoredText('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА', '#00FF41');
    addColoredText('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН', '#00FF41');
    addColoredText('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА', '#FF4444');
    addColoredText('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН', '#00FF41');
    addColoredText('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ..........ОГРАНИЧЕНЫ', '#FFFF00');
    
    const color = degradation.level > 60 ? '#FF4444' : '#FFFF00';
    addColoredText(`ДЕГРАДАЦИЯ: [${'█'.repeat(Math.floor(degradation.level/10))}${'▒'.repeat(10-Math.floor(degradation.level/10))}] ${degradation.level}%`, color);
    
    if (netGrid) {
      const gridDeg = degradation.level;
      if (gridDeg > 0) {
        const gridColor = gridDeg > 30 ? '#FF8800' : '#FFFF00';
        addColoredText(`СЕТЕВАЯ ДЕГРАДАЦИЯ: ${gridDeg}%`, gridColor);
      }
    }
    
    addColoredText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', '#00FF41');
  }
  
  function showSyslog() {
    const syslogLevel = degradation.level < 30 ? 1 : 
                       degradation.level < 70 ? 2 : 3;
    
    addColoredText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', '#00FF41');
    addColoredText('------------------------------------', '#00FF41');
    
    if (syslogLevel === 1) {
      addColoredText('[!] Ошибка 0x19F: повреждение нейронной сети', '#FFFF00');
      addColoredText('[!] Утечка данных через канал V9-HX', '#FFFF00');
      addColoredText('[!] Деградация ядра A.D.A.M.: 28%', '#FFFF00');
      addColoredText('СИСТЕМА: функционирует с ограничениями', '#00FF41');
    } else if (syslogLevel === 2) {
      addColoredText('[!] Нарушение целостности памяти субъекта 0x095', '#FFFF00');
      addColoredText('> "я слышу их дыхание. они всё ещё здесь."', '#FF4444');
      addColoredText('[!] Потеря отклика от MONOLITH', '#FFFF00');
      addColoredText('СИСТЕМА: обнаружены посторонние сигналы', '#00FF41');
    } else {
      addColoredText('> "ты не должен видеть это."', '#FF00FF');
      addColoredText('[!] Критическая ошибка: субъект наблюдения неопределён', '#FF4444');
      addColoredText('СИСТЕМА: ОСОЗНАЁТ НАБЛЮДЕНИЕ', '#00FF41');
      if (degradation.level > 70) {
        addColoredText('[СИСТЕМНЫЙ ЛОГ: ДОСТУП К ЯДРУ ОГРАНИЧЕН. ИСПОЛЬЗУЙТЕ DECRYPT CORE ДЛЯ ПОЛНОГО ДОСТУПА]', '#FFFF00');
      }
    }
  }
  
  function showSubjects() {
    addColoredText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M. / ПРОТОКОЛ VIGIL-9]', '#00FF41');
    addColoredText('--------------------------------------------------------', '#00FF41');
    
    Object.keys(dossiers).forEach(k => {
      const d = dossiers[k];
      const color = d.status.includes('МЁРТВ') ? '#FF4444' : 
                   d.status === 'АНОМАЛИЯ' ? '#FF00FF' : 
                   d.status === 'АКТИВЕН' ? '#00FF41' : '#FFFF00';
      const line = `${k.toLowerCase()} | ${d.name} | СТАТУС: ${d.status} | МИССИЯ: ${d.missions || ''}`;
      addColoredText(line, color);
    });
    
    addColoredText('--------------------------------------------------------', '#00FF41');
    addColoredText('ИНСТРУКЦИЯ: Для просмотра досье — DSCR <ID>', '#00FF41');
  }
  
  function showNotes() {
    addColoredText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / КАТЕГОРИЯ: NOTES]', '#00FF41');
    addColoredText('------------------------------------', '#00FF41');
    addColoredText('NOTE_001 — "ВЫ ЕГО ЧУВСТВУЕТЕ?" / автор: Dr. Rehn', '#00FF41');
    addColoredText('NOTE_002 — "КОЛЬЦО СНА" / автор: tech-оператор U-735', '#00FF41');
    addColoredText('NOTE_003 — "СОН ADAM" / неизвестный источник', '#00FF41');
    addColoredText('NOTE_004 — "ОН НЕ ПРОГРАММА" / архивировано', '#00FF41');
    addColoredText('NOTE_005 — "ФОТОНОВАЯ БОЛЬ" / восстановлено частично', '#00FF41');
    addColoredText('------------------------------------', '#00FF41');
    addColoredText('Для просмотра: OPEN <ID>', '#00FF41');
    
    if (degradation.level > 30) {
      addColoredText('[!] ПРЕДУПРЕЖДЕНИЕ: ДОСТУПЕН ФАЙЛ ДЛЯ РАСШИФРОВКИ // ID: 0XC44 | ИСПОЛЬЗУЙТЕ DECRYPT 0XC44', '#FFFF00');
    }
  }
  
  function showSubjectDossier(id) {
    const dossier = dossiers[id.toUpperCase()];
    if (!dossier) {
      addColoredText(`ОШИБКА: Досье для ${id} не найдено`, '#FF4444');
      audioManager.playSystemSound('error');
      return;
    }
    
    addColoredText(`[ДОСЬЕ — ID: ${id.toUpperCase()}]`, '#00FF41');
    addColoredText(`ИМЯ: ${dossier.name}`, '#00FF41');
    addColoredText(`РОЛЬ: ${dossier.role}`, '#00FF41');
    addColoredText(`СТАТУС: ${dossier.status}`, '#00FF41');
    addColoredText('------------------------------------', '#00FF41');
    addColoredText('ИСХОД:', '#00FF41');
    
    dossier.outcome.forEach(line => {
      addColoredText(`> ${line}`, '#FF4444');
    });
    
    addColoredText('------------------------------------', '#00FF41');
    addColoredText('СИСТЕМНЫЙ ОТЧЁТ:', '#00FF41');
    
    dossier.report.forEach(line => {
      addColoredText(`> ${line}`, '#FFFF00');
    });
    
    addColoredText('------------------------------------', '#00FF41');
    addColoredText(`СВЯЗАННЫЕ МИССИИ: ${dossier.missions}`, '#00FF41');
  }
  
  function openNote(id) {
    const note = notes[id.toUpperCase()];
    if (!note) {
      addColoredText(`ОШИБКА: Файл ${id} не найден`, '#FF4444');
      audioManager.playSystemSound('error');
      return;
    }
    
    addColoredText(`[${id.toUpperCase()} — "${note.title}"]`, '#00FF41');
    addColoredText(`АВТОР: ${note.author}`, '#00FF41');
    addColoredText('------------------------------------', '#00FF41');
    
    if (Math.random() > 0.3 && id.toUpperCase() !== 'NOTE_001' && id.toUpperCase() !== 'NOTE_003' && id.toUpperCase() !== 'NOTE_004') {
      addColoredText('ОШИБКА: Данные повреждены', '#FF4444');
      addColoredText('Восстановление невозможно', '#FF4444');
      addColoredText('>>> СИСТЕМНЫЙ СБОЙ <<<', '#FF0000');
      audioManager.playSystemSound('error');
    } else {
      note.content.forEach(line => addColoredText(`> ${line}`, '#CCCCCC'));
    }
    
    addColoredText('------------------------------------', '#00FF41');
    addColoredText('[ФАЙЛ ЗАКРЫТ]', '#00FF41');
  }
  
  function startDecrypt(fileId) {
    const normalizedId = fileId.toUpperCase();
    const file = decryptFiles[normalizedId];
    
    if (!file) {
      addColoredText(`ОШИБКА: Файл ${fileId} не найден`, '#FF4444');
      audioManager.playSystemSound('error');
      return;
    }
    
    if (normalizedId === 'CORE' && degradation.level < 50) {
      addColoredText('ОШИБКА: УРОВЕНЬ ДОСТУПА НЕДОСТАТОЧЕН', '#FF4444');
      addColoredText('> Требуется уровень деградации ≥50%', '#FFFF00');
      audioManager.playSystemSound('error');
      return;
    }
    
    // Generate random 3-digit code
    const decryptCode = Math.floor(100 + Math.random() * 900);
    let attempts = 3;
    
    addColoredText('[СИСТЕМА: ЗАПУЩЕН ПРОТОКОЛ РАСШИФРОВКИ]', '#00FF41');
    addColoredText(`> ФАЙЛ: ${file.title}`, '#00FF41');
    addColoredText(`> УРОВЕНЬ ДОСТУПА: ${file.accessLevel}`, '#00FF41');
    addColoredText(`> ПОПЫТОК ОСТАЛОСЬ: ${attempts}`, '#FFFF00');
    addColoredText('> ВВЕДИТЕ КОД (3 ЦИФРЫ):', '#00FF41');
    
    // Create input field for code
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      z-index: 100;
    `;
    
    const input = document.createElement('input');
    input.type = 'number';
    input.maxLength = 3;
    input.style.cssText = `
      background: #000;
      color: #00FF41;
      border: 1px solid #00FF41;
      font-family: ${FONT_FAMILY};
      font-size: 16px;
      padding: 8px 12px;
      width: 120px;
      text-align: center;
    `;
    
    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'OK';
    submitBtn.style.cssText = `
      background: #000;
      color: #00FF41;
      border: 1px solid #00FF41;
      font-family: ${FONT_FAMILY};
      font-size: 16px;
      padding: 8px 12px;
      margin-left: 10px;
      cursor: pointer;
    `;
    
    inputContainer.appendChild(input);
    inputContainer.appendChild(submitBtn);
    document.body.appendChild(inputContainer);
    
    input.focus();
    
    function handleDecryption() {
      const code = parseInt(input.value);
      if (isNaN(code) || input.value.length !== 3) {
        addColoredText('> ОШИБКА: Введите 3 цифры', '#FF4444');
        return;
      }
      
      attempts--;
      
      if (code === decryptCode) {
        // Success
        inputContainer.remove();
        addColoredText('> СИГНАЛ: КОД ВЕРИФИЦИРОВАН', '#00FF41');
        
        addColoredText(`[ФАЙЛ РАСШИФРОВАН: ${file.title}]`, '#00FF41');
        addColoredText('------------------------------------', '#00FF41');
        
        file.content.forEach(line => {
          addColoredText(line, '#CCCCCC');
        });
        
        addColoredText('------------------------------------', '#00FF41');
        addColoredText(`> ${file.successMessage}`, '#00FF41');
        
        degradation.addDegradation(-5);
        
        if (normalizedId === 'CORE') {
          addColoredText('> КЛЮЧ АЛЬФА: 375', '#00FF41');
          addColoredText('> Используйте команду ALPHA для фиксации ключа', '#FFFF00');
        }
      } else {
        // Failure
        const diff = Math.abs(code - decryptCode);
        const direction = code < decryptCode ? '[↑]' : '[↓]';
        
        let progressBar = '[░░░░░░░░░░]';
        if (diff <= 10) progressBar = '[▓▓▓▓▓▓▓▓▓▓]';
        else if (diff <= 50) progressBar = '[▓▓▓▓▓▓▓▓░░]';
        else if (diff <= 100) progressBar = '[▓▓▓▓▓▓░░░░]';
        else if (diff <= 200) progressBar = '[▓▓▓▓░░░░░░]';
        else if (diff <= 400) progressBar = '[▓▓░░░░░░░░]';
        
        addColoredText(``, '#000000');
        addColoredText(`> ${progressBar}`, diff > 100 ? '#8888FF' : diff > 50 ? '#FFFF00' : '#FF4444');
        addColoredText(``, '#000000');
        addColoredText(`> НАПРАВЛЕНИЕ: ${direction}`, '#AAAAAA');
        
        if (attempts <= 0) {
          inputContainer.remove();
          addColoredText('> СИСТЕМА: ДОСТУП ЗАПРЕЩЕН', '#FF4444');
          addColoredText(`> ${file.failureMessage}`, '#FF4444');
          degradation.addDegradation(3);
        } else {
          addColoredText(`> ПОПЫТОК ОСТАЛОСЬ: ${attempts}`, '#FFFF00');
        }
      }
    }
    
    submitBtn.addEventListener('click', handleDecryption);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleDecryption();
      }
    });
  }
  
  function startTrace(target) {
    const normalizedTarget = target.toLowerCase();
    const targetData = traceTargets[normalizedTarget];
    
    if (!targetData) {
      addColoredText(`ОШИБКА: Цель "${target}" не найдена`, '#FF4444');
      addColoredText('Доступные цели: 0x9a0, 0x095, signal, phantom, monolith', '#FFFF00');
      audioManager.playSystemSound('error');
      return;
    }
    
    if ((targetData.hidden || normalizedTarget === 'phantom' || normalizedTarget === 'monolith') && degradation.level < 60) {
      addColoredText('ОТКАЗАНО | РАСПАД', '#FF4444');
      addColoredText('> Требуется уровень деградации ≥60%', '#FFFF00');
      audioManager.playSystemSound('error');
      return;
    }
    
    addColoredText('[СИСТЕМА: РАСКРЫТИЕ КАРТЫ КОНТРОЛЯ]', '#00FF41');
    addColoredText(`> ЦЕЛЬ: ${targetData.target}`, '#00FF41');
    addColoredText(`> ОПИСАНИЕ: ${targetData.description}`, '#FFFF00');
    addColoredText('------------------------------------', '#00FF41');
    
    targetData.connections.forEach((conn, i) => {
      setTimeout(() => {
        const colors = ['#0044ff', '#ffffff', '#ff0000', '#ff00ff', '#ffff00'];
        addColoredText(`  ${conn.type} ────> ${conn.result} (${conn.status})`, colors[i % colors.length]);
        
        if (i === targetData.connections.length - 1) {
          // Reward/punishment
          if (normalizedTarget === 'phantom' || normalizedTarget === 'monolith' || normalizedTarget === 'signal') {
            degradation.addDegradation(2);
            addColoredText('> ПРЕДУПРЕЖДЕНИЕ: Анализ опасных сущностей ускоряет системный распад', '#FF8800');
            
            if (normalizedTarget === 'monolith') {
              addColoredText('> КЛЮЧ ГАММА: 291', '#00FF41');
              addColoredText('> Используйте команду GAMMA для фиксации ключа', '#FFFF00');
            }
          } else {
            degradation.addDegradation(-1);
          }
        }
      }, 300 * i);
    });
  }
  
  function activateVigil999() {
    // Check if all keys are set
    const expected = { alpha: '375', beta: '814', gamma: '291' };
    let allCorrect = true;
    
    addColoredText('ПРОВЕРКА КЛЮЧЕЙ:', '#00FF41');
    
    for (let key in expected) {
      const actual = vigilCodeParts[key];
      const isCorrect = actual === expected[key];
      
      if (isCorrect) {
        addColoredText(` ${key.toUpperCase()}: ${actual} [СОВПАДЕНИЕ]`, '#00FF41');
      } else {
        addColoredText(` ${key.toUpperCase()}: ${actual || 'НЕ ЗАФИКСИРОВАН'} [НЕСОВПАДЕНИЕ]`, '#FF4444');
        allCorrect = false;
      }
    }
    
    if (!allCorrect) {
      addColoredText('ДОСТУП ЗАПРЕЩЁН. ИСПРАВЬТЕ ОШИБКИ.', '#FF4444');
      audioManager.playSystemSound('error');
      return;
    }
    
    addColoredText('>>> АКТИВАЦИЯ ПРОТОКОЛА OBSERVER-7. ПОДТВЕРДИТЕ? (Y/N)', '#FFFF00');
    awaitingConfirmation = true;
    
    confirmationCallback = (confirmed) => {
      awaitingConfirmation = false;
      confirmationCallback = null;
      
      if (confirmed) {
        addColoredText('> СИСТЕМА: "ПРОТОКОЛ OBSERVER-7 АКТИВИРОВАН"', '#00FF41');
        
        // Create fullscreen transition
        const transition = document.createElement('div');
        transition.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: #000;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        `;
        
        transition.innerHTML = `
          <div style="color: #00FF41; font-family: ${FONT_FAMILY}; font-size: 24px; margin-bottom: 20px;">
            ПЕРЕХОД В РЕЖИМ НАБЛЮДЕНИЯ
          </div>
          <div style="color: #FF4444; font-family: ${FONT_FAMILY}; font-size: 16px; margin-bottom: 40px;">
            ПОДГОТОВКА К ПЕРЕХОДУ...
          </div>
          <div id="progressBar" style="
            width: 300px;
            height: 20px;
            background: #222;
            border: 1px solid #00FF41;
          ">
            <div id="progressFill" style="
              height: 100%;
              background: #00FF41;
              width: 0%;
            "></div>
          </div>
        `;
        
        document.body.appendChild(transition);
        
        // Animate progress
        let progress = 0;
        const interval = setInterval(() => {
          progress += 2;
          document.getElementById('progressFill').style.width = `${progress}%`;
          
          if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              document.body.removeChild(transition);
              window.location.href = 'observer-7.html';
            }, 500);
          }
        }, 50);
      } else {
        addColoredText('> АКТИВАЦИЯ ОТМЕНЕНА', '#FF4444');
        addColoredText('------------------------------------', '#00FF41');
        addColoredText('[ОПЕРАЦИЯ ПРЕРВАНА]', '#FF4444');
      }
    };
  }
  
  function processCommand(rawCmd) {
    if (!rawCmd || isFrozen) return;
    
    const cmdLine = rawCmd.trim();
    if (!cmdLine) return;
    
    commandHistory.push(cmdLine);
    historyIndex = commandHistory.length;
    commandCount++;
    
    // Add command to display
    if (lines.length > 0 && lines[lines.length - 1].text.startsWith('adam@secure:~$')) {
      lines[lines.length - 1].text = 'adam@secure:~$ ' + cmdLine;
      lines[lines.length - 1].color = '#FFFFFF';
    } else {
      addColoredText('adam@secure:~$ ' + cmdLine, '#FFFFFF');
    }
    
    // Simple command weight system
    const commandWeights = { 
      'syst':1, 'syslog':1, 'net':1, 'dscr':2, 'subj':2, 'notes':1, 
      'deg':0, 'help':0, 'clear':0, 'exit':0, 'reset':0, 'open':0,
      'decrypt':3, 'trace':2, 'net_mode':1, 'net_check':1
    };
    
    const parts = cmdLine.toLowerCase().split(' ').filter(Boolean);
    const command = parts[0];
    const args = parts.slice(1);
    
    if (commandWeights[command]) {
      degradation.addDegradation(commandWeights[command]);
    }
    
    // Process command
    switch(command) {
      case 'help':
        audioManager.playSystemSound('command');
        showHelp();
        break;
      case 'clear':
        audioManager.playSystemSound('command');
        lines.length = 0;
        break;
      case 'syst':
        audioManager.playSystemSound('command');
        showSyst();
        break;
      case 'syslog':
        audioManager.playSystemSound('command');
        showSyslog();
        break;
      case 'notes':
        audioManager.playSystemSound('command');
        showNotes();
        break;
      case 'open':
        audioManager.playSystemSound('command');
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите ID файла', '#FF4444');
          addColoredText('Пример: OPEN NOTE_001', '#00FF41');
        } else {
          openNote(args[0]);
        }
        break;
      case 'subj':
        audioManager.playSystemSound('command');
        showSubjects();
        break;
      case 'dscr':
        audioManager.playSystemSound('command');
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите ID субъекта', '#FF4444');
          addColoredText('Пример: DSCR 0x001', '#00FF41');
        } else {
          showSubjectDossier(args[0]);
        }
        break;
      case 'decrypt':
        audioManager.playSystemSound('command');
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите ID файла для расшифровки', '#FF4444');
          addColoredText('Доступные файлы: 0XA71, 0XB33, 0XC44, 0XD22, 0XE09, CORE', '#00FF41');
        } else {
          startDecrypt(args[0]);
        }
        break;
      case 'trace':
        audioManager.playSystemSound('command');
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите цель для анализа', '#FF4444');
          addColoredText('Доступные цели: 0x9a0, 0x095, signal, phantom, monolith', '#00FF41');
        } else if (args[0].toLowerCase() === 'phantom' && degradation.level <= 70) {
          addColoredText('ОШИБКА: ОТКАЗАНО | РАСПАД', '#FF4444');
          addColoredText('> Требуется уровень деградации >70%', '#FFFF00');
        } else {
          startTrace(args[0]);
        }
        break;
      case 'net_mode':
        audioManager.playSystemSound('command');
        netGrid.activate();
        addColoredText('> Переход в режим управления сеткой...', '#00FF41');
        addColoredText('> Используйте кнопки для управления', '#00FF41');
        // Don't add input line since we're in grid mode
        return;
      case 'net_check':
        audioManager.playSystemSound('command');
        if (netGrid.active) {
          netGrid.checkSolution();
        } else {
          addColoredText('ОШИБКА: Сетка не активна. Сначала выполните NET_MODE', '#FF4444');
        }
        break;
      case 'deg':
        audioManager.playSystemSound('command');
        if (args.length === 0) {
          addColoredText(`Текущий уровень деградации: ${degradation.level}%`, '#00FF41');
          addColoredText('Использование: deg <уровень 0-100>', '#00FF41');
        } else {
          const level = parseInt(args[0]);
          if (!isNaN(level) && level >= 0 && level <= 100) {
            degradation.level = level;
            localStorage.setItem('adam_degradation', String(level));
            degradation.updateIndicator();
            addColoredText(`Уровень деградации установлен: ${level}%`, '#00FF41');
          } else {
            addColoredText('ОШИБКА: Уровень должен быть числом от 0 до 100', '#FF4444');
          }
        }
        break;
      case 'reset':
        audioManager.playSystemSound('command');
        addColoredText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', '#00FF41');
        addColoredText('------------------------------------', '#00FF41');
        addColoredText('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', '#FFFF00');
        addColoredText('> Подтвердить сброс? (Y/N)', '#00FF41');
        
        awaitingConfirmation = true;
        confirmationCallback = (confirmed) => {
          awaitingConfirmation = false;
          confirmationCallback = null;
          
          if (confirmed) {
            addColoredText('> Y', '#00FF41');
            audioManager.playSystemSound('reset');
            
            // Reset everything
            lines.length = 0;
            addColoredText('> ЗАВЕРШЕНИЕ АКТИВНЫХ МОДУЛЕЙ [||||||||||]', '#FFFF00');
            addColoredText('> ПЕРЕЗАПУСК ИНТЕРФЕЙСА [||||||||||]', '#FFFF00');
            addColoredText('> ВОССТАНОВЛЕНИЕ БАЗОВОГО СОСТОЯНИЯ [||||||||||]', '#FFFF00');
            addColoredText('----------------------------------', '#00FF41');
            addColoredText('[СИСТЕМА ГОТОВА К РАБОТЕ]', '#00FF41');
            
            // Reset degradation
            degradation.reset();
            
            // Reset command history
            commandHistory = [];
            historyIndex = -1;
            commandCount = 0;
            sessionStartTime = Date.now();
          } else {
            addColoredText('> N', '#FF4444');
            addColoredText('------------------------------------', '#00FF41');
            addColoredText('[ОПЕРАЦИЯ ОТМЕНЕНА]', '#FF4444');
          }
        };
        return; // Don't add input line yet
      case 'exit':
        audioManager.playSystemSound('command');
        addColoredText('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ? (Y/N)]', '#00FF41');
        addColoredText('------------------------------------', '#00FF41');
        
        awaitingConfirmation = true;
        confirmationCallback = (confirmed) => {
          awaitingConfirmation = false;
          confirmationCallback = null;
          
          if (confirmed) {
            addColoredText('> Y', '#00FF41');
            addColoredText('> СОЕДИНЕНИЕ ПРЕРВАНО.', '#FF4444');
            setTimeout(() => {
              window.location.href = 'index.html';
            }, 1500);
          } else {
            addColoredText('> N', '#FF4444');
            addColoredText('------------------------------------', '#00FF41');
            addColoredText('[ОПЕРАЦИЯ ОТМЕНЕНА]', '#FF4444');
          }
        };
        return; // Don't add input line yet
      case 'alpha':
      case 'beta':
      case 'gamma':
        audioManager.playSystemSound('command');
        if (args.length === 0) {
          addColoredText(`ОШИБКА: Укажите код для ${command.toUpperCase()}`, '#FF4444');
          addColoredText(`Пример: ${command.toUpperCase()} 111`, '#00FF41');
        } else {
          const key = command.toLowerCase();
          vigilCodeParts[key] = args[0];
          localStorage.setItem('vigilCodeParts', JSON.stringify(vigilCodeParts));
          addColoredText(`> Код ${command.toUpperCase()} "${args[0]}" зафиксирован`, '#00FF41');
        }
        break;
      case 'vigil999':
        audioManager.playSystemSound('command');
        activateVigil999();
        return; // Don't add input line yet
      default:
        addColoredText(`команда не найдена: ${cmdLine}`, '#FF4444');
        audioManager.playSystemSound('error');
        break;
    }
    
    // Add new input line
    currentLine = '';
    addInputLine();
  }
  
  // ========== USER INTERACTION ==========
  document.addEventListener('keydown', function(e) {
    if (awaitingConfirmation) {
      if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') {
        e.preventDefault();
        if (confirmationCallback) confirmationCallback(true);
      } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
        e.preventDefault();
        if (confirmationCallback) confirmationCallback(false);
      }
      return;
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentLine.trim()) {
        const cmd = currentLine;
        currentLine = '';
        processCommand(cmd);
      } else {
        addInputLine();
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      currentLine = currentLine.slice(0, -1);
      updatePromptLine();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        currentLine = commandHistory[historyIndex] || '';
        updatePromptLine();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        currentLine = commandHistory[historyIndex] || '';
        updatePromptLine();
      } else {
        historyIndex = commandHistory.length;
        currentLine = '';
        updatePromptLine();
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      currentLine += e.key;
      updatePromptLine();
    }
    
    // Play sound on key press
    if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      audioManager.playSystemSound('key_press');
    }
  });
  
  // Touch events for scrolling
  let touchStartY = 0;
  canvas.addEventListener('touchstart', function(e) {
    touchStartY = e.touches[0].clientY;
  });
  
  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartY;
    
    // Scroll up if moving down, scroll down if moving up
    scrollOffset += diff * 0.1;
    scrollOffset = Math.max(0, Math.min(scrollOffset, lines.length));
    
    touchStartY = touchY;
    draw();
  }, { passive: false });
  
  // Wheel events for desktop testing
  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    scrollOffset += e.deltaY * 0.1;
    scrollOffset = Math.max(0, Math.min(scrollOffset, lines.length));
    draw();
  }, { passive: false });
  
  // Close grid when pressing ESC
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && netGrid.active) {
      netGrid.deactivate();
      addInputLine();
      return;
    }
    
    // Prevent default behavior for arrow keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
  });
  
  // ========== INITIALIZATION ==========
  function init() {
    // Setup canvas
    setupCanvas();
    
    // Set up touch events
    document.body.style.touchAction = 'none';
    
    // Initial text
    setTimeout(() => {
      addColoredText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', '#00FF41');
      addColoredText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', '#00FF41');
      addColoredText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', '#00FF41');
      addInputLine();
    }, 300);
    
    // Load audio context on first touch
    let audioContextInitialized = false;
    const initAudio = () => {
      if (!audioContextInitialized) {
        audioContextInitialized = true;
        audioManager.init();
        
        // Remove event listeners after initialization
        document.removeEventListener('touchstart', initAudio);
        document.removeEventListener('click', initAudio);
      }
    };
    
    document.addEventListener('touchstart', initAudio);
    document.addEventListener('click', initAudio);
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Handle resize
  window.addEventListener('resize', resize);
  
  // Expose API for debugging
  window.__MobileTerminal = {
    degradation: degradation,
    lines: lines,
    processCommand: processCommand
  };
})();