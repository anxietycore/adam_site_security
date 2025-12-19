// module_audio.js - Модуль управления аудио для терминала A.D.A.M.
// Отвечает ТОЛЬКО за воспроизведение звуков, логика вызова - в terminal_canvas.js

class AudioManager {
    constructor() {
        this.audioContext = null;
        this.soundCache = new Map();
        this.activeSounds = new Map();
        this.lastKeyPressSound = null;
        this.basePath = 'sounds/';
        
        this.categories = {
            ambient: 'ambient/',
            interface: 'interface/',
            commands: 'commands/',
            grid: 'grid/',
            operations: 'operations/',
            system: 'system/',
            vigil: 'vigil/',
            voices: 'voices/',
            dossiers: 'dossiers/'
        };
        
        this.backgroundSources = new Map();
        this.effectsVolume = 1.0;
        this.backgroundVolume = 0.2;
        this.glitchBackgroundVolume = 0.3;
        
        this.init();
    }
    
    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) {
            console.warn('Web Audio API не поддерживается, используется HTML5 Audio');
        }
    }
    
    // Загрузка звука в кэш
    async loadSound(category, filename) {
        const path = this.basePath + this.categories[category] + filename;
        
        if (this.soundCache.has(path)) {
            return this.soundCache.get(path);
        }
        
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.soundCache.set(path, audioBuffer);
            return audioBuffer;
        } catch(e) {
            console.warn(`Не удалось загрузить звук: ${path}`, e);
            
            // Fallback на HTML5 Audio
            const audio = new Audio(path);
            audio.preload = 'auto';
			audio.load();
            this.soundCache.set(path, { type: 'html5', element: audio });
            return { type: 'html5', element: audio };
        }
    }
    
    // Предзагрузка критичных звуков
    async preloadCriticalSounds() {
        const criticalSounds = [
            ['ambient', 'ambient_terminal.mp3'],
            ['ambient', 'ambient_glitch.mp3'],
            ['interface', 'interface_key_press_01.mp3'],
            ['interface', 'interface_key_press_02.mp3'],
            ['interface', 'interface_key_press_03.mp3'],
            ['interface', 'interface_key_press_04.mp3'],
            ['system', 'system_glitch_e.mp3'],
            ['system', 'system_glitch_error.mp3']
        ];
        
        for (const [category, filename] of criticalSounds) {
            await this.loadSound(category, filename);
        }
    }
    
    // Воспроизведение звука через Web Audio API
    async playSound(category, filename, options = {}) {
        // Если аудиоконтекст приостановлен (политика браузера), возобновляем
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        const path = this.basePath + this.categories[category] + filename;
        let soundData = this.soundCache.get(path);
        
        // Если звук не в кэше, загружаем его
        if (!soundData) {
            soundData = await this.loadSound(category, filename);
        }
        
        if (!soundData) return null;
        
        // Если это HTML5 Audio (fallback)
        if (soundData.type === 'html5') {
            return this.playHTML5Sound(soundData.element, options);
        }
        
        // Воспроизведение через Web Audio API
        return this.playWebAudio(soundData, options);
    }
    
    // Воспроизведение через Web Audio API
playWebAudio(audioBuffer, options) {
    if (!this.audioContext || !audioBuffer) return null;
    
    try {
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        const gainNode = this.audioContext.createGain();
        const volume = options.volume !== undefined ? options.volume : this.effectsVolume;
        gainNode.gain.value = volume;
        
        if (options.playbackRate) {
            source.playbackRate.value = options.playbackRate;
        }
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start(0, options.startTime || 0);
        
        const soundId = Date.now() + Math.random();
        this.activeSounds.set(soundId, source);
        
        source.onended = () => {
            this.activeSounds.delete(soundId);
        };
        
        return {
            id: soundId,
            stop: () => {
                try {
                    source.stop();
                    this.activeSounds.delete(soundId);
                } catch(e) {}
            },
            setVolume: (vol) => {
                gainNode.gain.value = vol;
            },
            setPlaybackRate: (rate) => {
                if (source.playbackRate) {
                    source.playbackRate.value = rate;
                }
            },
            source: source,  // ← ВОТ ЭТО ДОБАВЬ!
            _isWebAudio: true // ← И ЭТО ДЛЯ ОПРЕДЕЛЕНИЯ ТИПА
        };
    } catch(e) {
        console.warn('Ошибка воспроизведения Web Audio:', e);
        return null;
    }
}
    
 // ВОТ ЭТОТ МЕТОД НУЖНО ЗАМЕНИТЬ В КЛАССЕ AudioManager (строка ~200)
// Воспроизведение через HTML5 Audio (fallback)
playHTML5Sound(audioElement, options) {
  try {
    const audio = audioElement.cloneNode();
    const volume = options.volume !== undefined ? options.volume : this.effectsVolume;
    
    audio.volume = volume;
    audio.loop = options.loop || false;
    
    if (options.playbackRate) {
      audio.playbackRate = options.playbackRate;
    }
    
    if (options.startTime) {
      audio.currentTime = options.startTime;
    }
    
    audio.play().catch(e => console.warn('HTML5 Audio play error:', e));
    
    const soundId = Date.now() + Math.random();
    this.activeSounds.set(soundId, audio);
    
    if (!options.loop) {
      audio.onended = () => {
        this.activeSounds.delete(soundId);
      };
    }
    
    return {
      id: soundId,
      stop: () => {
        audio.pause();
        audio.currentTime = 0;
        this.activeSounds.delete(soundId);
      },
      setVolume: (vol) => {
        audio.volume = vol;
      },
      element: audio // ← ВОТ ЭТА СТРОЧКА ДОБАВЛЯЕТ ССЫЛКУ НА AUDIO ЭЛЕМЕНТ
    };
  } catch(e) {
    console.warn('Ошибка воспроизведения HTML5 Audio:', e);
    return null;
  }
}
    
    // Остановка звука
    stopSound(sound) {
        if (sound && sound.stop) {
            sound.stop();
        }
    }
    
    // Остановка всех звуков (кроме фоновых)
    stopAllEffects() {
        this.activeSounds.forEach((sound, id) => {
            // Не останавливаем фоновую музыку
            if (sound._isBackground) return;
            
            if (sound.stop) {
                sound.stop();
            } else if (sound.pause) {
                sound.pause();
            }
            this.activeSounds.delete(id);
        });
    }
    
    // === ФОНОВАЯ МУЗЫКА ===
    // НОВЫЙ МЕТОД ТОЛЬКО ДЛЯ AMBIENT - КАК В INDEX_CANVAS.JS
async playAmbientSeamless(filename, volume = 0.2) {
    // Создаем AudioContext если его нет (как в index_canvas.js)
    if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    }
    
    // Возобновляем контекст если приостановлен
    if (this.audioContext.state === 'suspended') {

        await this.audioContext.resume();
    }
    
    // ПУТЬ КАК В INDEX_CANVAS.JS - прямой путь к файлу
    const path = 'sounds/ambient/ambient_terminal.mp3'; // ⬅️ ПРЯМОЙ ПУТЬ
    

    
    try {
        // ТОЧНО ТАК ЖЕ КАК В INDEX_CANVAS.JS!

        const response = await fetch(path);
        
        if (!response.ok) {
            console.error(`[Audio] Ошибка HTTP: ${response.status} ${response.statusText}`);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        
        // Останавливаем предыдущий источник с таким же именем
        const existing = this.backgroundSources.get(filename);
        if (existing && existing.stop) {

            existing.stop();
            this.backgroundSources.delete(filename);
        }
        
        // Создаем источник (ВОТ ЭТО ГЛАВНОЕ!)
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = true; // БЕСШОВНЫЙ ЦИКЛ
        source.loopStart = 0;
        source.loopEnd = audioBuffer.duration;
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Запускаем с маленькой задержкой чтобы избежать проблем
        const startTime = this.audioContext.currentTime + 0.05;
        source.start(startTime);
        

        
        // Сохраняем
        const sound = {
            id: Date.now(),
            source: source,
            gainNode: gainNode,
            stop: () => {

                try {
                    if (source) {
                        source.stop();
                        source.disconnect();
                    }
                    if (gainNode) {
                        gainNode.disconnect();
                    }
                } catch(e) {
                    console.warn('[Audio] Ошибка при остановке ambient:', e);
                }
            },
            setVolume: (vol) => {
                if (gainNode) {
                    gainNode.gain.value = vol;
                }
            },
            _isBackground: true
        };
        
        this.backgroundSources.set(filename, sound);
        return sound;
        
    } catch (error) {
        console.error('[Audio] Критическая ошибка в seamless ambient:', error);
        
        // Детальная диагностика
        console.error('[Audio Debug] AudioContext состояние:', this.audioContext ? this.audioContext.state : 'нет контекста');
        console.error('[Audio Debug] basePath:', this.basePath);
        console.error('[Audio Debug] filename:', filename);
        console.error('[Audio Debug] Полный путь:', path);
        
        // Пробуем загрузить через XMLHttpRequest как fallback
        try {

            return await this.loadAmbientViaXHR(path, filename, volume);
        } catch (xhrError) {
            console.error('[Audio] XMLHttpRequest тоже не удался:', xhrError);
        }
        
        return null;
    }
}

// Добавьте этот метод как fallback
async loadAmbientViaXHR(path, filename, volume) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', path, true);
        xhr.responseType = 'arraybuffer';
        
        xhr.onload = async () => {
            if (xhr.status === 200) {
                try {
                    const arrayBuffer = xhr.response;
                    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                    
                    const source = this.audioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.loop = true;
                    source.loopStart = 0;
                    source.loopEnd = audioBuffer.duration;
                    
                    const gainNode = this.audioContext.createGain();
                    gainNode.gain.value = volume;
                    
                    source.connect(gainNode);
                    gainNode.connect(this.audioContext.destination);
                    
                    source.start(0);
                    
                    const sound = {
                        id: Date.now(),
                        source: source,
                        gainNode: gainNode,
                        stop: () => {
                            try {
                                source.stop();
                                source.disconnect();
                                gainNode.disconnect();
                            } catch(e) {}
                        },
                        setVolume: (vol) => {
                            gainNode.gain.value = vol;
                        },
                        _isBackground: true
                    };
                    
                    this.backgroundSources.set(filename, sound);

                    resolve(sound);
                } catch (error) {
                    reject(error);
                }
            } else {
                reject(new Error(`XHR Status: ${xhr.status}`));
            }
        };
        
        xhr.onerror = () => {
            reject(new Error('XHR Network Error'));
        };
        
        xhr.send();
    });
}
    // Запуск фоновой музыки
    async startBackgroundMusic(glitchLayer = false) {
        const filename = glitchLayer ? 'ambient_glitch.mp3' : 'ambient_terminal.mp3';
        const volume = glitchLayer ? this.glitchBackgroundVolume : this.backgroundVolume;
        
        // Останавливаем предыдущий фон, если он есть
        if (this.backgroundSources.has(filename)) {
            this.stopBackgroundMusic(filename);
        }
        
        const sound = await this.playSound('ambient', filename, {
            volume: volume,
            loop: true
        });
        
        if (sound) {
            sound._isBackground = true;
            this.backgroundSources.set(filename, sound);
            return sound;
        }
        
        return null;
    }
    
    // Остановка фоновой музыки
    stopBackgroundMusic(filename = null) {
        if (filename) {
            const sound = this.backgroundSources.get(filename);
            if (sound) {
                this.stopSound(sound);
                this.backgroundSources.delete(filename);
            }
        } else {
            // Останавливаем всю фоновую музыку
            this.backgroundSources.forEach((sound, key) => {
                this.stopSound(sound);
            });
            this.backgroundSources.clear();
        }
    }
    
    // Установка громкости фоновой музыки
    setBackgroundVolume(filename, volume) {
        const sound = this.backgroundSources.get(filename);
        if (sound && sound.setVolume) {
            sound.setVolume(volume);
        }
    }
    
    // === СПЕЦИАЛЬНЫЕ МЕТОДЫ ДЛЯ УДОБСТВА ===
    
    // Звуки нажатия клавиш (с предотвращением повторений)
    playKeyPress(keyType = 'generic') {
        let soundFile;
        
        switch(keyType.toLowerCase()) {
            case 'backspace':
                soundFile = 'interface_key_press_backspace.mp3';
                break;
            case 'enter':
                soundFile = 'interface_key_press_enter.mp3';
                break;
            case 'space':
                soundFile = 'interface_key_press_space.mp3';
                break;
            case 'escape':
                soundFile = 'interface_key_press_esc.mp3';
                break;
            case 'shift':
                soundFile = 'interface_key_press_shift.mp3';
                break;
            case 'ctrl':
                soundFile = 'interface_key_press_ctrl.mp3';
                break;
            case 'alt':
                soundFile = 'interface_key_press_alt.mp3';
                break;
            case 'capslock':
                soundFile = 'interface_key_press_capslock.mp3';
                break;
            case 'generic':
                // Выбираем случайный звук из 01-04, но не повторяем предыдущий
                const sounds = [
                    'interface_key_press_01.mp3',
                    'interface_key_press_02.mp3',
                    'interface_key_press_03.mp3',
                    'interface_key_press_04.mp3'
                ];
                
                let availableSounds = sounds.filter(s => s !== this.lastKeyPressSound);
                if (availableSounds.length === 0) availableSounds = sounds;
                
                soundFile = availableSounds[Math.floor(Math.random() * availableSounds.length)];
                this.lastKeyPressSound = soundFile;
                break;
            default:
                soundFile = 'interface_key_press_01.mp3';
        }
        
        return this.playSound('interface', soundFile, { volume: 0.7 });
    }
    
    // Звуки сетки
    playGridSound(type) {
        switch(type) {
            case 'move':
                return this.playSound('grid', 'grid_move.wav', { volume: 0.5 });
            case 'select':
                return this.playSound('grid', 'grid_select.wav', { volume: 0.6 });
            case 'lock':
                return this.playSound('grid', 'grid_lock.wav', { volume: 0.7 });
            case 'unlock':
                return this.playSound('grid', 'grid_unlock.wav', { volume: 0.7 });
            default:
                return null;
        }
    }
    
    // Звуки команд терминала
    playCommandSound(type) {
        switch(type) {
            case 'info':
                return this.playSound('commands', 'commands_info.mp3', { volume: 0.7 });
            case 'navigate':
                return this.playSound('commands', 'commands_navigate.mp3', { volume: 0.7 });
            case 'system':
                return this.playSound('commands', 'commands_system.mp3', { volume: 0.7 });
            case 'error':
                return this.playSound('commands', 'commands_error.mp3', { volume: 0.8 });
            default:
                return null;
        }
    }
    
    // Звуки операций
   async playOperationSound(type) {
    switch(type) {
        case 'start':
            return await this.playSound('operations', 'operations_start.mp3', { volume: 0.7 });
        case 'decrypt_success':
            return await this.playSound('operations', 'operations_decrypt_success.mp3', { volume: 0.85 });
        case 'decrypt_failure':
            return await this.playSound('operations', 'operations_decrypt_failure.mp3', { volume: 0.85 });
        case 'trace_scan':
            return await this.playSound('operations', 'operations_trace_scan.mp3', { 
                volume: 0.75,
                loop: true
            });
        case 'trace_complete':
            return await this.playSound('operations', 'operations_trace_complete.mp3', { volume: 0.75 });
        case 'process':
            return await this.playSound('operations', 'operations_process.mp3', { volume: 0.7 });
        default:
            return null;
    }
}
    
    // Системные звуки
    playSystemSound(type, options = {}) {
        const soundMap = {
            'glitch_e': ['system', 'system_glitch_e.mp3', 0.9],
            'glitch_error': ['system', 'system_glitch_error.mp3', 0.7],
            'reset_com': ['system', 'system_reset_com.mp3', 0.7],
            'reset_com_reverse': ['system', 'system_reset_com_reverse.mp3', 0.7],
            'connection_loss': ['system', 'system_connection_loss.mp3', 0.6],
            'random_glitch': ['system', 'system_random_glitch.mp3', 0.4],
            'Y': ['system', 'system_Y.mp3', 0.7],
            'N': ['system', 'system_N.mp3', 0.7],
            'reset': ['system', 'system_reset.mp3', 0.7],
            'glitch_text': ['system', 'system_glitch_text.mp3', 0.5]
        };
        
        if (soundMap[type]) {
            const [category, filename, defaultVolume] = soundMap[type];
            const volume = options.volume !== undefined ? options.volume : defaultVolume;
            
            const sound = this.playSound(category, filename, { 
                volume: volume,
                playbackRate: options.playbackRate,
                loop: options.loop
            });
            
            // Для звука glitch_text регулируем скорость в зависимости от деградации
            if (type === 'glitch_text' && options.playbackRate && sound) {
                if (sound.setPlaybackRate) {
                    sound.setPlaybackRate(options.playbackRate);
                }
            }
            
            return sound;
        }
        
        return null;
    }
    
    // Звуки VIGIL999
    playVigilSound(type) {
        switch(type) {
            case 'confirm':
                return this.playSound('vigil', 'vigil_confirm.mp3', { volume: 0.8 });
            case 'key_accept':
                return this.playSound('vigil', 'vigil_key_accept.mp3', { volume: 0.75 });
            case 'question':
                return this.playSound('vigil', 'vigil_question.mp3', { volume: 0.7 });
            case 'transition':
                return this.playSound('vigil', 'vigil_transition.mp3', { volume: 0.5 });
            default:
                return null;
        }
    }
    
    // Голоса и шёпоты
    playVoiceSound(type) {
        const soundMap = {
            'adam_02': ['voices', 'voices_adam_02.mp3', 0.3],
            'adam_03': ['voices', 'voices_adam_03.mp3', 0.3],
            'whisper_01': ['voices', 'voices_whisper_01.mp3', 0.3],
            'whisper_02': ['voices', 'voices_whisper_02.mp3', 0.3],
            'whisper_03': ['voices', 'voices_whisper_03.mp3', 0.3]
        };
        
        if (soundMap[type]) {
            const [category, filename, volume] = soundMap[type];
            return this.playSound(category, filename, { volume: volume });
        }
        
        return null;
    }
    
    // Аудиодосье
    playDossierSound(dossierId) {
        const dossierMap = {
            '0X001': 'dscr_erich_van_koss.mp3',
            '0X095': 'dscr_subject_095.mp3',
            '0X413': 'dscr_alien_biosphere.mp3',
            '0X811': 'dscr_sigma_prototype.mp3',
            '0X9A0': 'dscr_blackhole_loop.mp3',
            '0XT00': 'dscr_operator_T00.mp3',
            '0XF00': 'dscr_subject_phantom.mp3'
        };
        
        const filename = dossierMap[dossierId];
        if (filename) {
            return this.playSound('dossiers', filename, { volume: 0.8 });
        }
        
        return null;
    }
    
    // Переход между режимами (терминал ↔ сетка)
    playInterfaceTransition(toGrid = true) {
        const filename = toGrid ? 'interface_mode_to_grid.mp3' : 'interface_mode_to_terminal.mp3';
        return this.playSound('interface', filename, { volume: 0.8 });
    }
    
    // Успех/отказ интерфейса
    playInterfaceResult(success = true) {
        const filename = success ? 'interface_key_success.mp3' : 'interface_key_reject.mp3';
        const volume = success ? 0.7 : 0.8;
        return this.playSound('interface', filename, { volume: volume });
    }
    
    // Установка громкости эффектов
    setEffectsVolume(volume) {
        this.effectsVolume = Math.max(0, Math.min(1, volume));
    }
    
    // Установка громкости фона
    setBackgroundMusicVolume(volume) {
        this.backgroundVolume = Math.max(0, Math.min(1, volume));
        
        // Обновляем громкость активной фоновой музыки
        this.backgroundSources.forEach((sound, filename) => {
            if (sound.setVolume && !filename.includes('glitch')) {
                sound.setVolume(volume);
            }
        });
    }
    
    // Пауза/возобновление всех звуков
    pauseAll() {
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }
    }
    
    resumeAll() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioManager;
} else {
    window.AudioManager = AudioManager;
}
