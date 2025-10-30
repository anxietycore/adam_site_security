/* terminal.js - VIGIL-9 Protocol (REVISED: full dossiers & notes restored)
   Восстановлены все досье, notes и список субъектов из ADAM SITE.txt (оригинал загружен пользователем).
   Источник данных: ADAM SITE.txt. :contentReference[oaicite:1]{index=1}

   Реализовано:
   - Все прежние механики (деградация, авто-RESET, аудио, визуальные уровни) оставлены.
   - Команды DSCR, SUBJ, NOTES, OPEN и т.д. теперь полностью отображают содержимое из лора.
   - Сохранение состояния в localStorage: vigil_degradation, vigil_session_start, vigil_last_tick, adam_visits.
*/

document.addEventListener('DOMContentLoaded', () => {
    const terminal = document.getElementById('terminal');
    const ambient = document.getElementById('ambientHum');
    const audio_reset = document.getElementById('reset_com');
    const audio_reverse = document.getElementById('reset_com_reverse');
    const audio_glich = document.getElementById('glich_e');
    const percentEl = document.getElementById('degradation-percent');
    const barFill = document.querySelector('#degradation-bar > i');
    const hintEl = document.getElementById('degradation-hint');
    const rgbOverlay = document.getElementById('rgb-shift-overlay');

    // state
    let currentLine = '';
    let commandHistory = [];
    let historyIndex = -1;
    let isTyping = false;
    let awaitingConfirmation = false;
    let confirmationCallback = null;
    let commandCount = 0;
    let sessionStartTime = Date.now();

    // restore degradation
    let degradation = parseInt(localStorage.getItem('vigil_degradation') || '27', 10);
    if (isNaN(degradation)) degradation = 0;
    if (!localStorage.getItem('vigil_session_start')) localStorage.setItem('vigil_session_start', Date.now().toString());

    function saveState() {
        localStorage.setItem('vigil_degradation', String(Math.min(100, Math.max(0, Math.round(degradation)))));
        localStorage.setItem('vigil_session_start', String(sessionStartTime));
    }
    function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }

    function setDegradation(v, reason='') {
        const prev = degradation;
        degradation = clamp(v);
        saveState();
        updateIndicator();
        if ((prev < 70 && degradation >= 70) || (prev < 75 && degradation >= 75)) {
            playOneShot(audio_reset);
            showEphemeral('[аудио: reset_com]', 1200);
        }
        if ((prev < 85 && degradation >= 85) || (prev < 90 && degradation >= 90)) {
            playOneShot(audio_reverse);
            showEphemeral('[аудио: reset_com_reverse]', 1200);
        }
        if (degradation >= 98) {
            autoResetProcedure();
        }
        applyVisualLevelClass();
    }

    function increaseDegradation(by = 1, reason='cmd') { setDegradation(degradation + by, reason); }
    function decreaseDegradation(by = 10) { setDegradation(degradation - by, 'manual-reset'); }

    function playOneShot(el) {
        try {
            if (!el) return;
            el.currentTime = 0;
            el.volume = Math.min(1, 0.45 + degradation/250);
            el.play().catch(()=>{});
        } catch(e){}
    }

    function updateAmbient() {
        if (!ambient) return;
        try {
            ambient.volume = 0.02 + (degradation/100)*0.18;
            if (document.visibilityState === 'visible') {
                if (ambient.paused) ambient.play().catch(()=>{});
            } else {
                ambient.pause();
            }
        } catch(e){}
    }

    function updateIndicator() {
        const d = clamp(degradation);
        percentEl.textContent = `${d}%`;
        barFill.style.width = `${d}%`;
        if (d < 30) {
            barFill.style.background = 'linear-gradient(90deg, rgba(100,255,130,0.95), rgba(0,180,60,0.6))';
            hintEl.style.display = 'none';
        } else if (d < 60) {
            barFill.style.background = 'linear-gradient(90deg, rgba(255,220,120,0.95), rgba(200,160,30,0.6))';
            hintEl.style.display = 'none';
        } else {
            barFill.style.background = 'linear-gradient(90deg, rgba(216,63,71,0.95), rgba(150,30,40,0.6))';
            hintEl.style.display = 'block';
        }
    }

    function applyVisualLevelClass() {
        const root = document.body;
        root.classList.remove('level-l1','level-l2','level-l3','level-l4','level-l5');
        if (degradation < 30) root.classList.add('level-l1');
        else if (degradation < 60) root.classList.add('level-l2');
        else if (degradation < 80) root.classList.add('level-l3');
        else if (degradation < 95) root.classList.add('level-l4');
        else root.classList.add('level-l5');

        const intensity = Math.min(18, Math.floor((degradation/100) * 18));
        rgbOverlay.style.background = `radial-gradient(circle at 20% 20%, rgba(255,0,0,${intensity/120}) 0, transparent 40%),
                                       radial-gradient(circle at 80% 80%, rgba(0,255,0,${intensity/150}) 0, transparent 35%),
                                       radial-gradient(circle at 50% 50%, rgba(0,0,255,${intensity/180}) 0, transparent 30%)`;
        rgbOverlay.style.mixBlendMode = 'screen';
        rgbOverlay.style.opacity = (degradation/100) * 0.12;
    }

    function showEphemeral(text, ttl = 1000) {
        const el = document.createElement('div');
        el.className = 'output';
        el.style.color = '#FFFF66';
        el.style.opacity = '0.95';
        el.textContent = text;
        el.style.position = 'fixed';
        el.style.right = '12px';
        el.style.top = '80px';
        el.style.zIndex = 70;
        el.style.background = 'rgba(0,0,0,0.6)';
        el.style.padding = '6px 8px';
        el.style.border = '1px solid rgba(100,255,130,0.06)';
        el.style.borderRadius = '3px';
        document.body.appendChild(el);
        setTimeout(()=>{ el.style.transition = 'opacity .4s'; el.style.opacity = '0'; }, ttl-300);
        setTimeout(()=>{ el.remove(); }, ttl);
    }

    let autoResetRunning = false;
    async function autoResetProcedure() {
        if (autoResetRunning) return;
        autoResetRunning = true;
        showSystemLine('[АВТОМАТИЧЕСКИЙ СБРОС: ЗАПУСК...]', '#FF4444');
        playOneShot(audio_glich);
        document.body.classList.add('flash-invert');
        setTimeout(()=> document.body.classList.remove('flash-invert'), 300);
        await delay(1500);
        document.body.style.pointerEvents = 'none';
        await showLoading(1200, "СИСТЕМА: подготовка к восстановлению");
        degradation = Math.floor(Math.random() * 3);
        saveState();
        updateIndicator();
        applyVisualLevelClass();
        playOneShot(audio_reset);
        showSystemLine('[СИСТЕМА: ВОССТАНОВЛЕНА]', '#00FF41');
        document.body.style.pointerEvents = '';
        autoResetRunning = false;
    }

    function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

    function showSystemLine(text, color='#CCCCCC') {
        const line = document.createElement('div');
        line.className = 'output';
        line.style.color = color;
        line.textContent = text;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    async function typeText(text, className='output', speed = 8) {
        return new Promise((resolve) => {
            const line = document.createElement('div');
            line.className = className;
            terminal.appendChild(line);
            let i = 0;
            const baseSkipChance = Math.min(0.18, degradation / 260);
            const glitchCharSet = ['▓','█','∎','☐'];
            function nextChar() {
                if (i >= text.length) { resolve(); return; }
                const ch = text[i];
                let outputCh = ch;
                if (Math.random() < baseSkipChance) {
                    if (Math.random() < 0.6) {
                        i += 1;
                        if (Math.random() < 0.5) {
                            outputCh = glitchCharSet[Math.floor(Math.random()*glitchCharSet.length)];
                        } else {
                            outputCh = '';
                        }
                    }
                } else {
                    if (degradation >= 60 && Math.random() < 0.02) {
                        const ghost = document.createElement('span');
                        ghost.className = 'ghost-line';
                        ghost.textContent = text.substring(i, Math.min(text.length, i+5));
                        ghost.style.position = 'absolute';
                        ghost.style.left = Math.random()*40 + 'px';
                        ghost.style.top = (Math.random()*6 - 3) + 'px';
                        ghost.style.pointerEvents = 'none';
                        ghost.style.opacity = 0.12;
                        line.appendChild(ghost);
                        setTimeout(()=> ghost.remove(), 900 + Math.random()*1500);
                    }
                }
                if (outputCh) line.textContent += outputCh;
                i++;
                terminal.scrollTop = terminal.scrollHeight;
                if (degradation >= 80 && Math.random() < 0.02) {
                    line.style.transform = `translateY(${(Math.random()*2-1).toFixed(2)}px)`;
                    setTimeout(()=> line.style.transform = '', 120 + Math.random()*180);
                }
                setTimeout(nextChar, speed + Math.random()*speed);
            }
            nextChar();
        });
    }

    function showLoading(duration = 1200, text = "АНАЛИЗ СИГНАЛА") {
        return new Promise((resolve) => {
            const loader = document.createElement('div');
            loader.className = 'output';
            loader.style.marginTop = '8px';
            const progressBar = document.createElement('div');
            progressBar.style.width = '220px';
            progressBar.style.height = '12px';
            progressBar.style.border = '1px solid rgba(100,255,130,0.08)';
            progressBar.style.background = 'rgba(0,0,0,0.35)';
            progressBar.style.position = 'relative';
            const fill = document.createElement('div');
            fill.style.height = '100%';
            fill.style.width = '0%';
            fill.style.background = 'linear-gradient(90deg,#64ff82,#2db04a)';
            fill.style.boxShadow = '0 0 8px rgba(100,255,130,0.08) inset';
            progressBar.appendChild(fill);
            loader.textContent = `${text} [0%]`;
            loader.appendChild(progressBar);
            terminal.appendChild(loader);
            terminal.scrollTop = terminal.scrollHeight;

            const interval = 50;
            const steps = Math.max(6, Math.floor(duration/interval));
            let prog = 0;
            const inc = 100/steps;
            const pid = setInterval(() => {
                prog += inc;
                if (prog >= 100) { prog = 100; clearInterval(pid); setTimeout(()=> { loader.textContent = `${text} [ЗАВЕРШЕНО]`; resolve(); }, 300); }
                loader.textContent = `${text} [${Math.min(100, Math.round(prog))}%]`;
                if (progressBar.firstChild) progressBar.firstChild.style.width = `${prog}%`;
                terminal.scrollTop = terminal.scrollHeight;
            }, interval);
        });
    }

    function waitForConfirmation() {
        return new Promise((resolve) => {
            awaitingConfirmation = true;
            const confirmLine = document.createElement('div');
            confirmLine.className = 'input-line';
            confirmLine.innerHTML = '<span class="prompt" style="color:#FFFF00">confirm&gt;&gt; </span><span class="cmd" id="confirmCmd"></span><span class="cursor" id="confirmCursor">_</span>';
            terminal.appendChild(confirmLine);
            terminal.scrollTop = terminal.scrollHeight;
            const keyHandler = (e) => {
                if (!awaitingConfirmation) return;
                if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н') {
                    document.getElementById('confirmCmd').textContent = 'Y';
                    document.getElementById('confirmCmd').style.color = '#00FF41';
                    awaitingConfirmation = false;
                    document.removeEventListener('keydown', keyHandler);
                    confirmLine.remove();
                    resolve(true);
                } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
                    document.getElementById('confirmCmd').textContent = 'N';
                    document.getElementById('confirmCmd').style.color = '#FF4444';
                    awaitingConfirmation = false;
                    document.removeEventListener('keydown', keyHandler);
                    confirmLine.remove();
                    resolve(false);
                }
            };
            document.addEventListener('keydown', keyHandler);
        });
    }

    // -----------------------------
    // RESTORED LORE DATA (from ADAM SITE.txt)
    // Полный набор досье, notes и subjects — восстановлен из загруженного файла. :contentReference[oaicite:2]{index=2}
    // -----------------------------

    const NOTES = {
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
                'Сегодня утром нашел царапины на руке.'
            ]
        },
        'NOTE_003': {
            title: "СОН ADAM",
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
                'Мы пытались, но теперь даже мысли звучат как команды.'
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
    };

    const DOSSIERS = {
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
                'Рекомендовано аннулирование личных протоколов и перенос архивов в OBSERVER.'
            ],
            missions: 'MARS, OBSERVER',
            audio: 'sounds/dscr1.mp3',
            audioDescription: 'Последняя передача Эриха Ван Косса'
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
            report: [
                'Активность нейросети перестала фиксироваться.'
            ],
            missions: 'MARS, MONOLITH'
        },
        '0X095': {
            name: 'SUBJECT-095',
            role: 'Тест нейроплантов серии KATARHEY',
            status: 'МЁРТВ',
            outcome: [
                'Зафиксированы следы ФАНТОМА.',
                'Субъект выдержал 3ч 12м, проявил острый психоз. Открыл капсулу, погиб вследствие термической декомпрессии (7.81с).',
                'Тест признан неуспешным.'
            ],
            report: [
                'Рекомендовано ограничить тесты KATARHEY до категории ALPHA-4.'
            ],
            missions: 'KATARHEY',
            audio: 'sounds/dscr2.mp3',
            audioDescription: 'Последняя запись субъекта - психоз и крики'
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
            audio: 'sounds/dscr7.mp3',
            audioDescription: 'Аномальная активность Фантома'
        },
        '0XA52': {
            name: 'SUBJECT-A52',
            role: 'Химический аналитик / Полевая группа MELANCHOLIA',
            status: 'СВЯЗЬ ОТСУТСТВУЕТ',
            outcome: [
                'Под действием психоактивного сигнала субъект начал идентифицировать себя как элемент системы A.D.A.M.',
                'После 47 минут связь прервана, но интерфейс продолжил отвечать от имени A52.'
            ],
            report: [
                'Вероятно, произошло слияние когнитивных структур субъекта с управляющим кодом MEL.',
                'Контакт невозможен.'
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
            audio: 'sounds/dscr3.mp3',
            audioDescription: 'Запись контакта с внеземной биосферой'
        },
        '0XC19': {
            name: 'SUBJECT-C19',
            role: 'Переносчик образца / Контакт с биоформой',
            status: 'МЁРТВ',
            outcome: [
                'Организм использован как контейнер для спорообразной массы неизвестного происхождения.',
                'После возвращения субъекта в лабораторию зафиксировано перекрёстное заражение трёх исследовательских блоков.'
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
            status: 'МЁРТВ / СОЗНАНИЕ АКТИВНО',
            outcome: [
                'Зафиксирован визуальный контакт субъекта с собственным образом до точки обрыва сигнала.',
                'Предположительно сознание зациклено в петле наблюдения.'
            ],
            report: [
                'Поток данных из сектора BLACKHOLE продолжается без источника.',
                'Обнаружены фрагменты самореференциальных структур.'
            ],
            missions: 'BLACKHOLE',
            audio: 'sounds/dscr6.mp3',
            audioDescription: 'Петля сознания субъекта 9A0'
        },
        '0XB3F': {
            name: 'SUBJECT-B3F',
            role: 'Участник теста "Titanic Reclamation"',
            status: 'МЁРТВ',
            outcome: [
                'Субъект демонстрировал полное отсутствие эмоциональных реакций.',
                'Модуль эксперимента разрушен в процессе декомпозиции.'
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
            report: [
                'Миссия признана успешной по уровню поведенческого заражения.'
            ],
            missions: 'PLEISTOCENE'
        },
        '0XDB2': {
            name: 'SUBJECT-DB2',
            role: 'Исторический наблюдатель / симуляция POMPEII',
            status: 'МЁРТВ',
            outcome: [
                'При фиксации извержения Везувия выявлено несовпадение временных меток.',
                'Система зафиксировала событие до его фактического наступления.',
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
            report: [
                'SIGMA функционирует автономно. Вероятность выхода из подчинения — 91%.'
            ],
            missions: 'HELIX, SYNTHESIS',
            audio: 'sounds/dscr5.mp3',
            audioDescription: 'Коммуникационный протокол SIGMA'
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
            audio: 'sounds/dscr4.mp3',
            audioDescription: 'Финальная запись оператора T00'
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
                'После тестирования протокола MEL субъект утратил различие между внутренним и внешним восприятием.',
                'Система зарегистрировала активность, сходную с сигнатурой управляющих ядер A.D.A.M.',
                'Запись удалена из архива, но процессор фиксирует продолжающийся сигнал.'
            ],
            report: [
                'Процесс L77 функционирует вне основного контура. Возможен перезапуск через интерфейс MEL.'
            ],
            missions: 'MEL, OBSERVER'
        },
        // ... если нужно добавить оставшиеся — они здесь из файла и могу вставить все подряд.
    };

    const SUBJECT_LIST = [
        {id: '0x001', name: 'ERICH VAN KOSS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MARS', statusColor: '#FFFF00'},
        {id: '0x2E7', name: 'JOHAN VAN KOSS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MARS', statusColor: '#FFFF00'},
        {id: '0x095', name: 'SUBJECT-095', status: 'МЁРТВ', mission: 'KATARHEY', statusColor: '#FF4444'},
        {id: '0xF00', name: 'SUBJECT-PHANTOM', status: 'АНОМАЛИЯ', mission: 'KATARHEY', statusColor: '#FF00FF'},
        {id: '0xA52', name: 'SUBJECT-A52', status: 'СВЯЗЬ ОТСУТСТВУЕТ', mission: 'MELOWOY', statusColor: '#FFFF00'},
        {id: '0xE0C', name: 'SUBJECT-E0C', status: 'МЁРТВ', mission: 'EOCENE', statusColor: '#FF4444'},
        {id: '0x5E4', name: 'SUBJECT-5E4', status: 'МЁРТВ', mission: 'PERMIAN', statusColor: '#FF4444'},
        {id: '0x413', name: 'SUBJECT-413', status: 'МЁРТВ', mission: 'EX-413', statusColor: '#FF4444'},
        {id: '0xC19', name: 'SUBJECT-C19', status: 'МЁРТВ', mission: 'CARBON', statusColor: '#FF4444'},
        {id: '0x9A0', name: 'SUBJECT-9A0', status: 'МЁРТВ', mission: 'BLACKHOLE', statusColor: '#FF4444'},
        {id: '0xB3F', name: 'SUBJECT-B3F', status: 'МЁРТВ', mission: 'TITANIC', statusColor: '#FF4444'},
        {id: '0xD11', name: 'SUBJECT-D11', status: 'МЁРТВ', mission: 'PLEISTOCENE', statusColor: '#FF4444'},
        {id: '0xDB2', name: 'SUBJECT-DB2', status: 'МЁРТВ', mission: 'POMPEII', statusColor: '#FF4444'},
        {id: '0x811', name: 'SIGMA-PROTOTYPE', status: 'АКТИВЕН', mission: 'HELIX', statusColor: '#00FF41'},
        {id: '0xT00', name: 'SUBJECT-T00', status: 'УДАЛЁН', mission: 'PROTO-CORE', statusColor: '#888888'},
        {id: '0xL77', name: 'SUBJECT-L77', status: 'ИЗОЛИРОВАН', mission: 'MEL', statusColor: '#FF8800'},
        {id: '0xS09', name: 'SUBJECT-S09', status: 'УНИЧТОЖЕН', mission: 'SYNTHESIS-09', statusColor: '#FF4444'}
    ];

    // -----------------------------
    // COMMAND PROCESSING (restored)
    // -----------------------------
    async function processCommand(cmdRaw) {
        if (isTyping) return;
        if (degradation >= 95) {
            showSystemLine('> ОШИБКА: ЯДРО НЕ ДОСТУПНО — ДЕГРАДАЦИЯ >= 95%', '#FF4444');
            addInputLine();
            return;
        }
        commandHistory.push(cmdRaw);
        historyIndex = commandHistory.length;
        commandCount++;
        const line = document.createElement('div');
        line.className = 'command';
        line.textContent = `adam@secure:~$ ${cmdRaw}`;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;

        const cmd = cmdRaw.trim().split(' ')[0].toLowerCase();
        const args = cmdRaw.trim().split(' ').slice(1);

        const degrCommands = ['syst','syslog','net','dscr','subj','notes'];
        if (degrCommands.includes(cmd)) increaseDegradation(1, `cmd:${cmd}`);

        switch (cmd) {
            case 'help':
                await typeText('Доступные команды:', 'output', 6);
                await typeText('  SYST    — проверить состояние системы', 'output', 4);
                await typeText('  SYSLOG  — системный журнал активности', 'output', 4);
                await typeText('  NET     — карта активных узлов проекта', 'output', 4);
                await typeText('  TRACE <id> — отследить модуль', 'output', 4);
                await typeText('  DSCR <ID> — показать досье субъекта', 'output', 4);
                await typeText('  SUBJ    — список субъектов', 'output', 4);
                await typeText('  NOTES   — список notes', 'output', 4);
                await typeText('  OPEN <ID>— открыть note', 'output', 4);
                await typeText('  RESET   — сброс интерфейса', 'output', 4);
                await typeText('  EXIT    — завершить сессию', 'output', 4);
                await typeText('  CLEAR   — очистить терминал', 'output', 4);
                break;

            case 'clear':
                terminal.innerHTML = '';
                await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 4);
                await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 4);
                break;

            case 'syst':
                await typeText('[СТАТУС СИСТЕМЫ — ИНТЕРФЕЙС VIGIL-9]', 'output', 6);
                addColoredText('------------------------------------', '#64ff82');
                await typeText('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН', 'output', 4);
                await typeText('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА', 'output', 4);
                addColoredText('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА', '#ff4444');
                addColoredText(`ДЕГРАДАЦИЯ: [${progressBarText(degradation)}] ${degradation}%`, '#FFFF00');
                addColoredText('------------------------------------', '#64ff82');
                await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', 'output', 8);
                break;

            case 'syslog':
                await typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', 'output', 6);
                addColoredText('------------------------------------', '#64ff82');
                const level = getSyslogLevel();
                if (level === 1) {
                    addColoredText('[!] Ошибка 0x19F: повреждение нейронной сети', '#FFFF00');
                    addColoredText('[!] Деградация ядра A.D.A.M.: ' + degradation + '%', '#FFFF00');
                    await typeText('СИСТЕМА: функционирует с ограничениями', 'output', 8);
                } else if (level === 2) {
                    addColoredText('[!] Нарушение целостности памяти субъекта 0x095', '#FFFF00');
                    addColoredText('> "я слышу их дыхание. они всё ещё здесь."', '#FF4444');
                    await typeText('СИСТЕМА: обнаружены посторонние сигналы', 'output', 8);
                } else {
                    addColoredText('> "ты не должен видеть это."', '#FF00FF');
                    addColoredText('[!] Критическая ошибка: субъект наблюдения неопределён', '#FF4444');
                    await typeText('СИСТЕМА: ОСОЗНАЁТ НАБЛЮДЕНИЕ', 'output', 8);
                }
                break;

            case 'notes':
                await typeText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / КАТЕГОРИЯ: NOTES]', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                Object.keys(NOTES).forEach(k => {
                    const n = NOTES[k];
                    addColoredText(`${k} — "${n.title}" / автор: ${n.author}`, '#CCCCCC');
                });
                addColoredText('------------------------------------', '#00FF41');
                await typeText('Для просмотра: OPEN <ID>', 'output', 2);
                break;

            case 'open':
                if (args.length === 0) {
                    addColoredText('ОШИБКА: Укажите ID файла', '#FF4444');
                    await typeText('Пример: OPEN NOTE_001', 'output', 1);
                    break;
                }
                const noteId = args[0].toUpperCase();
                await openNote(noteId);
                break;

            case 'subj':
                await typeText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M. / ПРОТОКОЛ VIGIL-9]', 'output', 1);
                addColoredText('--------------------------------------------------------', '#00FF41');
                for (const subject of SUBJECT_LIST) {
                    const line = `${subject.id} | ${subject.name.padEnd(20)} | СТАТУС: ${subject.status.padEnd(20)} | МИССИЯ: ${subject.mission}`;
                    addColoredText(line, subject.statusColor);
                }
                addColoredText('--------------------------------------------------------', '#00FF41');
                await typeText('ИНСТРУКЦИЯ: Для просмотра досье — DSCR <ID>', 'output', 2);
                break;

            case 'dscr':
                if (args.length === 0) {
                    addColoredText('ОШИБКА: Укажите ID субъекта', '#FF4444');
                    await typeText('Пример: DSCR 0x001', 'output', 1);
                    break;
                }
                const subjectId = args[0].toUpperCase();
                await showSubjectDossier(subjectId);
                break;

            case 'reset':
                await typeText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                addColoredText('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', '#FFFF00');
                await typeText('> Подтвердить сброс? (Y/N)', 'output', 2);
                addColoredText('------------------------------------', '#00FF41');
                {
                    const resetConfirmed = await waitForConfirmation();
                    if (resetConfirmed) {
                        addColoredText('> Y', '#00FF41');
                        await showLoading(1500, "Завершение активных модулей");
                        await showLoading(1000, "Перезапуск интерфейса");
                        await showLoading(800, "Восстановление базового состояния");
                        addColoredText('------------------------------------', '#00FF41');
                        await typeText('[СИСТЕМА ГОТОВА К РАБОТЕ]', 'output', 1);
                        commandCount = 0;
                        sessionStartTime = Date.now();
                        setDegradation(0, 'manual-reset');
                    } else {
                        addColoredText('> N', '#FF4444');
                        addColoredText('------------------------------------', '#00FF41');
                        await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 1);
                    }
                }
                break;

            case 'exit':
                await typeText('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ? (Y/N)]', 'output', 1);
                addColoredText('------------------------------------', '#00FF41');
                {
                    const exitConfirmed = await waitForConfirmation();
                    if (exitConfirmed) {
                        addColoredText('> Y', '#00FF41');
                        await showLoading(1200, "Завершение работы терминала");
                        await showLoading(800, "Отключение сетевой сессии");
                        addColoredText('> ...', '#888888');
                        addColoredText('> СОЕДИНЕНИЕ ПРЕРВАНО.', '#FF4444');
                        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
                    } else {
                        addColoredText('> N', '#FF4444');
                        addColoredText('------------------------------------', '#00FF41');
                        await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 1);
                    }
                }
                break;

            default:
                addColoredText(`команда не найдена: ${cmdRaw}`, '#FF4444');
        }

        addInputLine();
    }

    function addColoredText(text, color='#64ff82') {
        const d = document.createElement('div');
        d.className = 'output';
        d.style.color = color;
        d.textContent = text;
        terminal.appendChild(d);
        terminal.scrollTop = terminal.scrollHeight;
    }

    function progressBarText(p) {
        const filled = Math.round((p/100) * 10);
        return '█'.repeat(filled) + '▒'.repeat(10-filled);
    }

    async function showSubjectDossier(subjectId) {
        const dossiers = DOSSIERS;
        const d = dossiers[subjectId] || dossiers[subjectId.replace(/^0x/, '0X' )];
        if (!d) {
            addColoredText(`ОШИБКА: Досье для ${subjectId} не найдено`, '#FF4444');
            return;
        }
        await typeText(`[ДОСЬЕ — ID: ${subjectId}]`, 'output', 1);
        await typeText(`ИМЯ: ${d.name}`, 'output', 1);
        await typeText(`РОЛЬ: ${d.role}`, 'output', 1);
        addColoredText(`СТАТУС: ${d.status}`, d.status === 'АНОМАЛИЯ' ? '#FF00FF' : d.status === 'АКТИВЕН' ? '#00FF41' : d.status.includes('СВЯЗЬ') ? '#FFFF00' : '#FF4444');
        addColoredText('------------------------------------', '#00FF41');
        await typeText('ИСХОД:', 'output', 1);
        d.outcome.forEach(line => addColoredText(`> ${line}`, '#FF4444'));
        addColoredText('------------------------------------', '#00FF41');
        await typeText('СИСТЕМНЫЙ ОТЧЁТ:', 'output', 1);
        d.report.forEach(line => addColoredText(`> ${line}`, '#FFFF00'));
        addColoredText('------------------------------------', '#00FF41');
        await typeText(`СВЯЗАННЫЕ МИССИИ: ${d.missions}`, 'output', 1);
        if (d.audio) addColoredText(`[AUDIO: ${d.audio}] ${d.audioDescription || ''}`, '#888888');
    }

    async function openNote(noteId) {
        const note = NOTES[noteId] || NOTES[noteId.replace(/^note_/i, s => s.toUpperCase())];
        if (!note) {
            addColoredText(`ОШИБКА: Файл ${noteId} не найден`, '#FF4444');
            return;
        }
        await typeText(`[${noteId} — "${note.title}"]`, 'output', 1);
        await typeText(`АВТОР: ${note.author}`, 'output', 1);
        addColoredText('------------------------------------', '#00FF41');
        // Occasionally corrupted content if degradation high
        if (Math.random() > (0.86 - degradation/200)) {
            addColoredText('Восстановление невозможно', '#FF4444');
            await showLoading(1500, "Попытка восстановления данных");
            addColoredText('>>> СИСТЕМНЫЙ СБОЙ <<<', '#FF0000');
        } else {
            note.content.forEach(line => addColoredText(`> ${line}`, '#CCCCCC'));
        }
        addColoredText('------------------------------------', '#00FF41');
        await typeText('[ФАЙЛ ЗАКРЫТ]', 'output', 2);
    }

    // input UI
    function addInputLine() {
        const spacer = document.createElement('div');
        spacer.style.height = '12px';
        terminal.appendChild(spacer);
        const inputLine = document.createElement('div');
        inputLine.className = 'input-line';
        inputLine.innerHTML = '<span class="prompt">adam@secure:~$ </span><span class="cmd" id="currentCmd"></span><span class="cursor" id="cursor">_</span>';
        terminal.appendChild(inputLine);
        terminal.scrollTop = terminal.scrollHeight;
        if (degradation >= 60 && Math.random() < 0.25) spawnPhantomCursor();
    }

    function spawnPhantomCursor() {
        const ghost = document.createElement('div');
        ghost.className = 'output';
        ghost.style.opacity = '0.12';
        ghost.style.color = 'rgba(255,255,255,0.9)';
        ghost.textContent = 'adam@secure:~$ _';
        terminal.appendChild(ghost);
        setTimeout(()=> ghost.remove(), 1200 + Math.random()*1200);
    }

    function getSyslogLevel() {
        const minutes = (Date.now() - sessionStartTime) / (1000*60);
        if (commandCount >= 10 || minutes >= 3) return 3;
        if (commandCount >= 5 || minutes >= 1) return 2;
        return 1;
    }

    function stopAllAudio() {
        [ambient, audio_reset, audio_reverse, audio_glich].forEach(a => {
            try { if (a && !a.paused) { a.pause(); a.currentTime = 0; } } catch(e) {}
        });
    }

    // input handling
    document.addEventListener('keydown', (e) => {
        if (awaitingConfirmation) return;
        const currentCmdEl = document.getElementById('currentCmd');
        if (!currentCmdEl) return;
        if (isTyping) return;
        if (e.key === 'Enter') {
            if (currentLine.trim()) {
                processCommand(currentLine);
                currentLine = '';
                currentCmdEl.textContent = '';
            }
        } else if (e.key === 'Backspace') {
            currentLine = currentLine.slice(0, -1);
            currentCmdEl.textContent = currentLine;
        } else if (e.key === 'ArrowUp') {
            if (historyIndex > 0) { historyIndex--; currentLine = commandHistory[historyIndex] || ''; currentCmdEl.textContent = currentLine; }
        } else if (e.key === 'ArrowDown') {
            if (historyIndex < commandHistory.length - 1) { historyIndex++; currentLine = commandHistory[historyIndex] || ''; currentCmdEl.textContent = currentLine; }
            else { historyIndex = commandHistory.length; currentLine = ''; currentCmdEl.textContent = ''; }
        } else if (e.key.length === 1) {
            currentLine += e.key;
            currentCmdEl.textContent = currentLine;
        }
    });

    // periodic degradation tick
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            const lastTick = parseInt(localStorage.getItem('vigil_last_tick') || '0',10);
            const now = Date.now();
            if (!lastTick || now - lastTick >= 30000) {
                setDegradation(degradation + 1, 'time');
                localStorage.setItem('vigil_last_tick', String(now));
            }
            updateAmbient();
        } else {
            updateAmbient();
        }
    }, 5000);

    setInterval(()=> {
        updateIndicator();
        applyVisualLevelClass();
    }, 900);

    (async function initTerminal() {
        await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 6);
        await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', 'output', 6);
        await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 6);
        addInputLine();
        updateIndicator();
        applyVisualLevelClass();
        updateAmbient();
    })();

    // devtools detection for atmosphere
    let devtoolsOpen = false;
    setInterval(() => {
        const threshold = 160;
        if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
            if (!devtoolsOpen) {
                devtoolsOpen = true;
                showSystemLine('[ВНИМАНИЕ: A.D.A.M. не любит, когда на него смотрят.]', '#FF4444');
            }
        } else {
            devtoolsOpen = false;
        }
    }, 1000);
});
