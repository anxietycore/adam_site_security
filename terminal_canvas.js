// terminal_canvas.js - ПОЛНАЯ ВЕРСИЯ СО ВСЕМИ ФУНКЦИЯМИ ИЗ ТЗ
// Реализованы ВСЕ механики деградации уровней 1-7, сетка с ключом "Биокод", команды decrypt/trace/playaudio/VIGIL999
(() => {
  // ---------- CONFIG ----------
  const FONT_FAMILY = "'Press Start 2P', monospace";
  const FONT_SIZE_PX = 13;
  const LINE_HEIGHT = Math.round(FONT_SIZE_PX * 1.45);
  const PADDING = 18;
  const MAX_LINES = 10000;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const CANVAS_Z = 50;
  const TYPING_SPEED_DEFAULT = 14;
  const GLITCH_MAX_LEVEL = 95;
  const SHAKING_START_LEVEL = 70;
  const SHAKING_END_LEVEL = 90;
  const MIRROR_START_LEVEL = 80;
  const MIRROR_END_LEVEL = 90;
  const COMMAND_BLOCK_START_LEVEL = 80;
  const COMMAND_BLOCK_END_LEVEL = 90;
  const PSYCHO_BLOCK_START_LEVEL = 90;
  const PSYCHO_BLOCK_END_LEVEL = 97;
  const FALSE_RESET_START_LEVEL = 85;
  const INTENTION_PREDICTION_START_LEVEL = 90;
  const GRID_DEGRADATION_START_LEVEL = 80;
  const GHOST_INPUT_START_LEVEL = 80;
  const AUTO_COMMAND_START_LEVEL = 80;
  const ANOMALOUS_INSERTS_START_LEVEL = 70;
  const ANOMALOUS_INSERTS_END_LEVEL = 80;
  const INVERSION_START_LEVEL = 95;
  const AUTO_RESET_LEVEL = 98;
  // ========== НОВАЯ СИСТЕМА ГЛИТЧА (ЭТАП 1) ==========
// Метаданные для глитченного текста
// Каждая строка может иметь информацию о глитч-фрагментах
const GLITCH_CONFIG = {
  BLOCKS: ['█', '▓', '▒', '░'],
  GLYPHS: ['≣', '≡', '§', 'Σ', 'Ϟ', '¶', '×', 'Ø', '◊', '∑', 'Ω', '·'],
  CUTS: ['│', '╫', '┼', '▌', '▐'],
  ALL: null
};

GLITCH_CONFIG.ALL = [...GLITCH_CONFIG.BLOCKS, ...GLITCH_CONFIG.GLYPHS, ...GLITCH_CONFIG.CUTS];

// Класс для управления глитч-фрагментами
class GlitchFragment {
  constructor(startPos, length, isCorrosion = false) {
    this.start = startPos;
    this.length = length;
    this.originalChars = [];
    this.glitchedChars = [];
    this.lastSpasmTime = 0;
    this.isCorrosion = isCorrosion; // Добавлено: тип коррозии
  }
  // ========== ДОБАВЬТЕ ЭТИ МЕТОДЫ В КЛАСС GlitchFragment ==========

// Проверка, можно ли поставить символ в позицию (без 2 тяжелых подряд)
isValidCharForPosition(char, position) {
  const heavyBlocks = ['█', '▓'];
  
  if (!heavyBlocks.includes(char)) return true;
  
  const left = this.glitchedChars[position - 1];
  const right = this.glitchedChars[position + 1];
  
  return !heavyBlocks.includes(left) && !heavyBlocks.includes(right);
}

// Получение безопасных кандидатов для мутации (с учётом соседей)
getSafeMutationCandidates(position) {
  const heavyBlocks = ['█', '▓'];
  const left = this.glitchedChars[position - 1];
  const right = this.glitchedChars[position + 1];
  
  // Если соседи - тяжелые блоки, исключаем их из кандидатов
  if (heavyBlocks.includes(left) || heavyBlocks.includes(right)) {
    return GLITCH_CONFIG.ALL.filter(c => !heavyBlocks.includes(c));
  }
  
  return [...GLITCH_CONFIG.ALL];
}

// Проверка, можно ли расширить фрагмент (не более +3 и не больше оригинала)
canExpand() {
  return this.length < this.originalChars.length + 3;
}

// Улучшенное расширение с проверкой тяжелых блоков
tryExpandFragment() {
  if (!this.canExpand()) return;
  
  const lastChar = this.glitchedChars[this.glitchedChars.length - 1];
  const candidates = this.getSafeExpansionCandidates(lastChar);
  
  if (candidates.length > 0) {
    this.length++;
    this.glitchedChars.push(candidates[Math.floor(Math.random() * candidates.length)]);
  }
}

getSafeExpansionCandidates(lastChar) {
  const heavyBlocks = ['█', '▓'];
  
  // Если последний символ тяжелый - не добавляем тяжелые
  if (heavyBlocks.includes(lastChar)) {
    return GLITCH_CONFIG.ALL.filter(c => !heavyBlocks.includes(c));
  }
  
  return [...GLITCH_CONFIG.ALL];
}

// ПРОВЕРКА: есть ли уже 2 тяжелых блока подряд в фрагменте
hasTooManyHeavyBlocks(chars = this.glitchedChars) {
  const heavyBlocks = ['█', '▓'];
  let consecutiveCount = 0;
  
  for (let i = 0; i < chars.length; i++) {
    if (heavyBlocks.includes(chars[i])) {
      consecutiveCount++;
      if (consecutiveCount >= 2) return true;
    } else {
      consecutiveCount = 0;
    }
  }
  return false;
}
// ========== КОНЕЦ ДОБАВЛЕНИЯ ==========
// ========== ЗАМЕНИТЕ ВЕСЬ МЕТОД applyStaticGlitch ==========
applyStaticGlitch() {
  const availableChars = [...GLITCH_CONFIG.ALL];
  const heavyBlocks = ['█', '▓'];
  
  // ТОЧЕЧНАЯ КОРРОЗИЯ
  if (this.isCorrosion) {
    const glitchChar = availableChars[Math.floor(Math.random() * availableChars.length)];
    this.glitchedChars = [glitchChar || '▓'];
    return;
  }
  
  // Обычный фрагмент с проверкой тяжелых блоков
  this.glitchedChars = this.originalChars.map((_, idx) => {
    let char;
    let attempts = 0;
    
    do {
      char = availableChars[Math.floor(Math.random() * availableChars.length)];
      attempts++;
      
      // Проверка на 2 тяжелых блока подряд (ВЫЗОВ МЕТОДА КЛАССА, не глобальной функции)
      if (heavyBlocks.includes(char) && attempts < 10) {
        const testChars = [...this.glitchedChars];
        testChars.push(char);
        // ВОТ ЭТОТ ВЫЗОВ БЫЛ СЛОМАН - ТЕПЕРЬ ПРАВИЛЬНЫЙ
        if (this.hasTooManyHeavyBlocks(testChars)) {
          char = null;
        }
      }
    } while (!char && attempts < 20);
    
    return char || availableChars[Math.floor(Math.random() * availableChars.length)] || '▓';
  });
}
// ========== КОНЕЦ ЗАМЕНЫ ==========
// ========== ЗАМЕНИТЕ МЕТОД applySpasm ==========
applySpasm(degradationLevel) {
  const now = Date.now();
  const frequency = getSpasmFrequency(degradationLevel);
  
  if (now - this.lastSpasmTime < frequency) return;
  this.lastSpasmTime = now;
  
  const spasmCount = Math.random() < 0.7 ? 1 : 2;
  const indices = [];
  
  while (indices.length < spasmCount && indices.length < this.length) {
    const idx = Math.floor(Math.random() * this.length);
    if (!indices.includes(idx)) indices.push(idx);
  }
  
  indices.forEach(idx => {
    const type = Math.random();
    let newChar;
    
    // Тип 1: Глитч-мутация (60%)
    if (type < 0.6) {
      const candidates = this.getSafeMutationCandidates(idx);
      newChar = candidates[Math.floor(Math.random() * candidates.length)];
    }
    // Тип 2: Колебание (35%)
    else if (type < 0.95) {
      newChar = this.originalChars[idx];
      setTimeout(() => {
        if (this.glitchedChars[idx] === newChar) {
          const candidates = this.getSafeMutationCandidates(idx);
          this.glitchedChars[idx] = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }, 50 + Math.random() * 100);
    }
    // Тип 3: Изменение разреза (5%)
    else {
      const cutChars = [...GLITCH_CONFIG.CUTS];
      newChar = cutChars[Math.floor(Math.random() * cutChars.length)];
    }
    
    // ПРОВЕРКА ТЯЖЕЛЫХ БЛОКОВ ПРИ СПАЗМАХ
    if (this.isValidCharForPosition(newChar, idx)) {
      this.glitchedChars[idx] = newChar;
    }
  });
  
  // Заражение (расширение) с проверкой
  if (Math.random() < 0.02 && this.canExpand()) {
    this.tryExpandFragment();
  }
}
// ========== КОНЕЦ ЗАМЕНЫ ==========
  
  // Попытка расширения фрагмента (заражение)
  tryExpandFragment() {
    // Максимальное расширение +3 от исходного размера
    if (this.length >= this.originalChars.length + 3) return;
    
    // Расширяем на 1 символ
    this.length++;
    const availableChars = [...GLITCH_CONFIG.ALL];
    this.glitchedChars.push(availableChars[Math.floor(Math.random() * availableChars.length)]);
  }
}

// Главный движок глитча
class GlitchTextEngine {
  constructor() {
    this.fragments = new Map(); // Map<lineId, fragment[]>
    this.nextLineId = 0;
  }
  // ========== ДОБАВЬТЕ ЭТИ МЕТОДЫ В КЛАСС GlitchTextEngine ==========

// Расчёт оптимального количества фрагментов
calculateOptimalFragmentCount(length, degradationLevel, isServiceLine) {
  if (degradationLevel < 30) return 0;
  
  // Для служебных строк - ограниченная интенсивность
  const serviceMultiplier = isServiceLine ? 0.3 : 1.0;
  
  let maxFragments;
  if (length <= 20) {
    // Короткие строки: макс 1-2 фрагмента
    maxFragments = degradationLevel > 80 ? 2 : 1;
  } else if (length <= 50) {
    // Средние строки: пропорционально деградации
    maxFragments = Math.floor((degradationLevel - 30) / 70 * Math.min(5, length / 10));
  } else {
    // Длинные строки: плавное заполнение
    maxFragments = Math.floor((degradationLevel - 30) / 70 * Math.min(10, length / 5));
  }
  
  return Math.max(0, maxFragments * serviceMultiplier);
}

// Создание фрагмента для строки (перестал быть привязан к словам)
createFragmentForLine(text, degradationLevel, isServiceLine, usedPositions) {
  const maxAttempts = 30;
  const maxLength = isServiceLine ? 2 : (degradationLevel > 80 ? 4 : 3);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const length = Math.floor(Math.random() * maxLength) + 1;
    const startPos = Math.floor(Math.random() * (text.length - length + 1));
    
    // Проверяем, не перекрывается ли с существующими фрагментами
    let overlap = false;
    for (let i = startPos; i < startPos + length; i++) {
      if (usedPositions.has(i)) {
        overlap = true;
        break;
      }
    }
    
    if (!overlap) {
      const fragment = new GlitchFragment(startPos, length, false);
      fragment.originalChars = text.substr(startPos, length).split('');
      fragment.applyStaticGlitch();
      return fragment;
    }
  }
  
  return null;
}
// ========== КОНЕЦ ДОБАВЛЕНИЯ ==========
// ========== ЗАМЕНИТЕ ВЕСЬ МЕТОД processStatic ==========
processStatic(text, degradationLevel) {
  const isServiceLine = text.startsWith('adam@secure:~$') || text.startsWith('>') || text.startsWith('[');
  
  // Для служебных строк при деградации < 50% - минимальные глитчи
  if (isServiceLine && degradationLevel < 50) {
    return { text, lineId: null, fragments: [] };
  }
  
  // РАСЧЁТ КОЛИЧЕСТВА ФРАГМЕНТОВ (зависит от длины строки и деградации)
  const fragmentCount = this.calculateOptimalFragmentCount(text.length, degradationLevel, isServiceLine);
  
  if (fragmentCount === 0) {
    return { text, lineId: null, fragments: [] };
  }
  
  // СОЗДАНИЕ ФРАГМЕНТОВ ПО ВСЕЙ СТРОКЕ (не по словам!)
  const fragments = [];
  const usedPositions = new Set();
  const chars = text.split('');
  
  for (let i = 0; i < fragmentCount; i++) {
    const fragment = this.createFragmentForLine(text, degradationLevel, isServiceLine, usedPositions);
    if (fragment) {
      fragments.push(fragment);
      // Отмечаем позиции как занятые
      for (let j = fragment.start; j < fragment.start + fragment.length; j++) {
        usedPositions.add(j);
      }
    }
  }
  
  // ПРИМЕНЕНИЕ ГЛИТЧА К СТРОКЕ
  fragments.forEach(fragment => {
    for (let i = 0; i < fragment.length; i++) {
      const pos = fragment.start + i;
      if (pos < chars.length) {
        chars[pos] = fragment.glitchedChars[i];
      }
    }
  });
  
  // СОХРАНЕНИЕ ФРАГМЕНТОВ
  const lineId = fragments.length > 0 ? this.nextLineId++ : null;
  if (lineId) {
    this.fragments.set(lineId, fragments);
  }
  
  return {
    text: chars.join(''),
    lineId,
    fragments
  };
}
// ========== КОНЕЦ ЗАМЕНЫ ==========
// ========== ЗАМЕНИТЕ НА ЭТО ==========
applyDynamicSpasms(degradationLevel) {
  const now = Date.now();
  const frequency = getSpasmFrequency(degradationLevel);
  const infectionChance = Math.min(0.05, (degradationLevel - 50) / 1000);
  
  this.fragments.forEach((fragments, lineId) => {
    fragments.forEach(fragment => {
      if (now - fragment.lastSpasmTime < frequency) return;
      
      fragment.lastSpasmTime = now;
      
      // Обычные спазмы (с проверкой тяжелых блоков)
      const spasmCount = Math.random() < 0.7 ? 1 : 2;
      const indices = [];
      
      while (indices.length < spasmCount && indices.length < fragment.length) {
        const idx = Math.floor(Math.random() * fragment.length);
        if (!indices.includes(idx)) indices.push(idx);
      }
      
      indices.forEach(idx => {
        const type = Math.random();
        let newChar;
        
        // Тип 1: Глитч-мутация (60%)
        if (type < 0.6) {
          const candidates = fragment.getSafeMutationCandidates(idx);
          newChar = candidates[Math.floor(Math.random() * candidates.length)];
        }
        // Тип 2: Колебание (мигание) (35%)
        else if (type < 0.95) {
          const original = fragment.originalChars[idx];
          newChar = original;
          
          setTimeout(() => {
            if (fragment.glitchedChars[idx] === original) {
              const candidates = fragment.getSafeMutationCandidates(idx);
              fragment.glitchedChars[idx] = candidates[Math.floor(Math.random() * candidates.length)];
            }
          }, 50 + Math.random() * 100);
        }
        // Тип 3: Изменение разреза (5%)
        else {
          const cutChars = [...GLITCH_CONFIG.CUTS];
          newChar = cutChars[Math.floor(Math.random() * cutChars.length)];
        }
        
        // ПРОВЕРКА ТЯЖЕЛЫХ БЛОКОВ ПРИ СПАЗМАХ
        if (fragment.isValidCharForPosition(newChar, idx)) {
          fragment.glitchedChars[idx] = newChar;
        }
      });
      
      // Расширение фрагмента с проверкой
      if (Math.random() < infectionChance && fragment.canExpand()) {
        fragment.tryExpandFragment();
      }
      
      // ДИНАМИЧЕСКОЕ ЗАРАЖЕНИЕ СОСЕДНИХ СИМВОЛОВ (при деградации > 70%)
      if (degradationLevel > 70 && Math.random() < 0.01) {
        this.infectNeighbouringCharacters(lineId, fragment);
      }
    });
  });
}

// Заражение символов вокруг фрагмента
infectNeighbouringCharacters(lineId, fragment) {
  const line = lines.find(l => l.glitchLineId === lineId);
  if (!line || !line.originalText) return;
  
  const originalText = line.originalText;
  const allFragments = this.fragments.get(lineId) || [];
  
  // Проверяем слева
  if (fragment.start > 0) {
    const leftPos = fragment.start - 1;
    const isOccupied = allFragments.some(f => 
      leftPos >= f.start && leftPos < f.start + f.length
    );
    
    if (!isOccupied && Math.random() < 0.3) {
      const newFragment = new GlitchFragment(leftPos, 1, Math.random() < 0.2);
      newFragment.originalChars = [originalText[leftPos]];
      newFragment.applyStaticGlitch();
      newFragment.lastSpasmTime = Date.now();
      allFragments.push(newFragment);
    }
  }
  
  // Проверяем справа
  const rightPos = fragment.start + fragment.length;
  if (rightPos < originalText.length) {
    const isOccupied = allFragments.some(f => 
      rightPos >= f.start && rightPos < f.start + f.length
    );
    
    if (!isOccupied && Math.random() < 0.3) {
      const newFragment = new GlitchFragment(rightPos, 1, Math.random() < 0.2);
      newFragment.originalChars = [originalText[rightPos]];
      newFragment.applyStaticGlitch();
      newFragment.lastSpasmTime = Date.now();
      allFragments.push(newFragment);
    }
  }
}
// ========== КОНЕЦ ЗАМЕНЫ ==========
 
  
  // Удалить фрагменты для строки (при очистке экрана)
  clearFragments(lineId) {
    this.fragments.delete(lineId);
  }
}
// ========== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ (ЭТАП 2) ==========
// ЗАМЕНИТЕ ВЕСЬ renderGlitchText НА ЭТОТ:

// ========== ОПТИМИЗИРОВАННЫЙ renderGlitchText ==========
function renderGlitchText(lineObj, x, y, ctx) {
  const text = lineObj.text;
  const originalText = lineObj.originalText;
  
  // Если нет глитчей — рисуем одной командой
  if (!lineObj.glitchLineId || !glitchEngine.fragments.has(lineObj.glitchLineId)) {
    ctx.fillText(text, x, y);
    return;
  }
  
  const fragments = glitchEngine.fragments.get(lineObj.glitchLineId);
  let currentX = x;
  
  // Рисуем посимвольно, но ширину берем от оригинала
  for (let i = 0; i < originalText.length; i++) {
    const originalChar = originalText[i];
    const displayChar = text[i];
    
    // Оптимизация: измеряем ширину один раз за символ
    const charWidth = ctx.measureText(originalChar).width;
    
    // Проверяем, в глитче ли символ
    const fragment = fragments.find(f => i >= f.start && i < f.start + f.length);
    
    ctx.fillText(fragment ? (fragment.glitchedChars[i - fragment.start] || '▓') : displayChar, currentX, y);
    currentX += charWidth;
  }
}
// ========== КОНЕЦ ОПТИМИЗАЦИИ ==========
// ========== КОНЕЦ renderGlitchText ==========
// Вспомогательная функция для получения частоты спазмов
// ========== ФИНАЛЬНАЯ getSpasmFrequency (ЭТАП 4.3) ==========
function getSpasmFrequency(degradationLevel) {
  // 0-40%: нет спазмов (возвращаем бесконечность)
  if (degradationLevel < 40) return Infinity;
  
  // 40-60%: 1 спазм / 1.5-2 секунды
  if (degradationLevel < 60) return 1500 + Math.random() * 500;
  
  // 60-80%: 1 спазм / 1-0.5 секунды
  if (degradationLevel < 80) {
    const t = (degradationLevel - 60) / 20; // 0-1
    return 1000 - t * 500 + Math.random() * 200;
  }
  
  // 80-90%: 1 спазм / 0.6-0.4 секунды
  if (degradationLevel < 90) {
    const t = (degradationLevel - 80) / 10; // 0-1
    return 600 - t * 200 + Math.random() * 100;
  }
  
  // 90-95%: 1 спазм / 0.3-0.2 секунды
  if (degradationLevel < 95) {
    const t = (degradationLevel - 90) / 5; // 0-1
    return 300 - t * 100 + Math.random() * 50;
  }
  
  // 95-98%: предсмертное затухание - снова редкие спазмы
  return 1500 + Math.random() * 500;
}
// ========== КОНЕЦ ЭТАПА 4.3 ==========

// Создаем глобальный экземпляр движка
const glitchEngine = new GlitchTextEngine();

  // ---------- create main canvas ----------
  const canvas = document.createElement('canvas');
  canvas.id = 'terminalCanvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    zIndex: CANVAS_Z,
    pointerEvents: 'none',
    userSelect: 'none'
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  
  // ---------- find original elements (keep interactive but visually hidden) ----------
  const origTerminal = document.getElementById('terminal');
  if (origTerminal) {
    origTerminal.style.opacity = '0';
    origTerminal.style.pointerEvents = 'auto';
    try {
      const mo = new MutationObserver(muts => {
        muts.forEach(m => {
          if (m.addedNodes) {
            m.addedNodes.forEach(n => {
              if (n && (n.nodeType === 1 || n.nodeType === 3)) {
                try { n.remove(); } catch(e){}
              }
            });
          }
        });
      });
      mo.observe(origTerminal, { childList: true, subtree: true });
    } catch(e){}
  }
  
  const glassFX = document.getElementById('glassFX');
  if (glassFX) {
    glassFX.style.opacity = '0';
    glassFX.style.pointerEvents = 'auto';
  }
  
  // find map canvas (netGrid) but avoid shader and overlay canvas
  const mapCanvas = (() => {
    const all = Array.from(document.querySelectorAll('canvas'));
    const c = all.find(x => x.id !== 'shader-canvas' && x.id !== 'terminalCanvas' && x.id !== 'crtOverlayCanvas' && x.id !== 'glassFX');
    if (c) {
      c.style.opacity = '0';
      c.style.pointerEvents = 'auto';
      return c;
    }
    return null;
  })();
  
  // ---------- audio manager ----------
  class AudioManager {
    constructor() {
      this.audioElements = {};
      this.audioCache = {};
      this.volume = 0.7;
      this.initSounds();
    }
    
    initSounds() {
      const sounds = [
        'signal_swap.mp3',
        'reset_com.mp3',
        'reset_com_reverse.mp3',
        'net_connection_loss.mp3',
        'net_rotation.mp3',
        'net_fragmentation.mp3',
        'net_final_signal.mp3',
        'net_resistance.mp3',
        'key_success.mp3',
        'key_reject.mp3',
        'decrypt_success.mp3',
        'decrypt_failure.mp3',
        'trace_active.mp3',
        'vigil_confirm.mp3',
        'glitch_e.mp3',
        'connection_restored.mp3'
      ];
      
      sounds.forEach(sound => {
        const paths = [
          `sounds/${sound}`,
          `audio/${sound}`,
          sound
        ];
        
        paths.forEach(path => {
          if (!this.audioCache[path]) {
            try {
              const audio = new Audio(path);
              audio.volume = this.volume;
              this.audioCache[path] = audio;
            } catch(e) {}
          }
        });
      });
    }
    
    play(file, options = {}) {
      try {
        const paths = [
          `sounds/${file}`,
          `audio/${file}`,
          file
        ];
        
        for (let path of paths) {
          if (this.audioCache[path]) {
            const audio = this.audioCache[path].cloneNode();
            audio.volume = options.volume !== undefined ? options.volume : this.volume;
            
            if (options.startTime) {
              audio.currentTime = options.startTime;
            }
            
            if (options.playbackRate) {
              audio.playbackRate = options.playbackRate;
            }
            
            if (options.loop) {
              audio.loop = true;
            }
            
            if (options.distort && degradation.level >= 70) {
              audio.playbackRate = 0.8 + Math.random() * 0.4;
              audio.volume = this.volume * (0.7 + Math.random() * 0.3);
            }
            
            audio.play().catch(e => {
              console.warn('Audio play failed:', e);
            });
            
            if (options.onEnded) {
              audio.onended = options.onEnded;
            }
            
            return audio;
          }
        }
        
        console.warn(`Sound not found: ${file}`);
        return null;
      } catch(e) {
        console.error('Audio playback error:', e);
        return null;
      }
    }
    
    stop(file) {
      try {
        if (this.audioElements[file]) {
          this.audioElements[file].pause();
          this.audioElements[file].currentTime = 0;
          delete this.audioElements[file];
        }
      } catch(e) {}
    }
  }
  
  const audioManager = new AudioManager();
  
  // ---------- sizing ----------
  let vw = 0, vh = 0;
  
  // ---------- draw scheduling ----------
  let pendingRedraw = false;
  function requestFullRedraw(){
    if (!pendingRedraw) {
      pendingRedraw = true;
      requestAnimationFrame(() => {
        pendingRedraw = false;
        try { draw(); } catch(e){ console.error('draw error', e); }
      });
    }
  }
  
  function resize() {
    vw = Math.max(320, window.innerWidth);
    vh = Math.max(240, window.innerHeight);
    canvas.width = Math.floor(vw * DPR);
    canvas.height = Math.floor(vh * DPR);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    requestFullRedraw();
  }
  
  window.addEventListener('resize', resize);
  resize();
  
  // ---------- terminal state ----------
  const lines = [];
  let scrollOffset = 0;
  let currentLine = '';
  let commandHistory = [];
  let historyIndex = -1;
  let isTyping = false;
  let awaitingConfirmation = false;
  let confirmationCallback = null;
  let currentAudio = null;
  let commandCount = 0;
  let sessionStartTime = Date.now();
  let isFrozen = false;
  let ghostInputInterval = null;
  let autoCommandInterval = null;
  let phantomCommandInterval = null;
  let textShakeInterval = null;
  let flashTextInterval = null;
  let lastProcessed = { text: null, ts: 0 };
  let resetAttempts = 0;
  let falseResetActive = false;
  let intentionalPredictionActive = false;
  let intentionPredicted = false;
  let decryptActive = false;
  let traceActive = false;
  let traceTimer = null;
  let vigilCodeParts = { alpha: null, beta: null, gamma: null };
  let audioPlaybackActive = false;
  let audioPlaybackFile = null;
  let decryptCloseAttempts = 0;
  
  // ДОБАВИТЬ после vigilCodeParts (примерно строка 328)
class OperationManager {
  constructor() {
    this.activeOperation = null;
    this.queue = [];
  }
  
  start(operationType, callback) {
    if (this.activeOperation) {
      console.warn(`Операция ${operationType} отложена, активна ${this.activeOperation}`);
      this.queue.push({ type: operationType, callback });
      return false;
    }
    
    this.activeOperation = operationType;
    
    // Устанавливаем ВСЕ нужные флаги атомарно
    switch(operationType) {
      case 'reset':
      case 'auto-reset':
        window.isFrozen = true;
        break;
      case 'decrypt':
        window.isFrozen = true;
        window.decryptActive = true;
        break;
      case 'trace':
        window.isFrozen = true;
        window.traceActive = true;
        break;
      case 'audio':
        window.isFrozen = true;
        window.audioPlaybackActive = true;
        break;
    }
    
    if (callback) callback();
    return true;
  }
  
end(operationType, callback) {
  if (this.activeOperation !== operationType) {
    console.warn(`Попытка завершить не ту операцию: ${operationType}, активна: ${this.activeOperation}`);
    return;
  }
  
  // АТОМАРНЫЙ сброс ВСЕХ флагов - ГАРАНТИРОВАННО
  window.isFrozen = false;
  window.decryptActive = false;
  window.traceActive = false;
  window.audioPlaybackActive = false;
  window.awaitingConfirmation = false;
  window.isTyping = false;
  
  this.activeOperation = null;
  
  // Гарантированно добавляем строку ввода СРАЗУ
  addInputLine(true); // УБРАТЬ setTimeout - ДОБАВЛЯЕМ СРАЗУ
  
  if (callback) callback();
  
  // Запускаем следующую операцию из очереди
  if (this.queue.length > 0) {
    const next = this.queue.shift();
    setTimeout(() => this.start(next.type, next.callback), 200);
  }
}
  
  isBlocked() {
    return !!this.activeOperation;
  }
}

const operationManager = new OperationManager();
  
// ---------- Degradation system ----------
class DegradationSystem {
  constructor() {
    this.level = parseInt(localStorage.getItem('adam_degradation')) || 0;
    this.lastSoundLevel = 0;
    this.ghostActive = false;
    this.autoActive = false;
    this.effectsActive = false;
    this.soundPlayedAt45 = false;
    this.ghostCommandCount = 0;
    this.lastDistortion = { status: null, role: null, time: 0 };
    this.falseResetCount = 0;
    this.intentionPredictionCount = 0;
    this.phantomDossierCount = 0;
    
    // Создаем индикатор
    this.indicator = document.createElement('div');
    this.indicator.style.cssText = `position:fixed; top:20px; right:20px; opacity:0; pointer-events:none; font-family:${FONT_FAMILY};`;
    document.body.appendChild(this.indicator);
    this.updateIndicator();
    this.startTimer();
    this.updateEffects();
  }
  
  startTimer(){
    this._timer = setInterval(()=>{ 
      if (!document.hidden && !isFrozen && !decryptActive && !traceActive && !audioPlaybackActive) 
        this.addDegradation(1); 
    }, 30000);
  }
  
  addDegradation(amount){
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
    
    const prev = this.level;
    this.level = Math.max(0, Math.min(100, this.level + amount));
    localStorage.setItem('adam_degradation', String(this.level));
    this.updateIndicator();
    this.updateEffects();
    
    if (window.__netGrid) {
      window.__netGrid.setSystemDegradation(this.level);
    }
    
    // Звуковой эффект при достижении 45% и первом выполнении определенных команд
    if (this.level >= 45 && !this.soundPlayedAt45) {
      audioManager.play('signal_swap.mp3', { volume: 0.7 });
      this.soundPlayedAt45 = true;
    }
    
    // Аудио-предупреждения о сбросе
    if (this.level >= 55 && this.level < 70 && Math.floor(this.level / 5) !== Math.floor(this.lastSoundLevel / 5)) {
      audioManager.play('reset_com.mp3', { volume: 0.7 });
    }
    // Обратное звучание
    else if (this.level >= 70 && this.level < 80 && Math.floor(this.level / 5) !== Math.floor(this.lastSoundLevel / 5)) {
      audioManager.play('reset_com_reverse.mp3', { volume: 0.7 });
    }
    // Обратное звучание (продолжение)
    else if (this.level >= 80 && this.level < 95 && Math.floor(this.level / 5) !== Math.floor(this.lastSoundLevel / 5)) {
      audioManager.play('reset_com_reverse.mp3', { 
        volume: 0.7, 
        playbackRate: 0.8 + (95 - this.level) / 15 * 0.4,
        distort: true
      });
    }
    
    this.lastSoundLevel = this.level;
    
    // Автоматический сброс при 98%
if (this.level >= AUTO_RESET_LEVEL && !isFrozen) {
  isFrozen = true; // БЛОКИРУЕМ ВВОД
  this.triggerGlitchApocalypse();
  return; // ПРЕРЫВАЕМ ДАЛЬНЕЙШУЮ ОБРАБОТКУ
}
    
    // Части кода VIGIL999
    if (this.level >= 80 && this.level < 90 && !vigilCodeParts.alpha) {
      this.revealVigilAlpha();
    }
    
    if (this.level >= 98 && !vigilCodeParts.gamma) {
      this.revealVigilGamma();
    }
  }
  
  updateIndicator(){
    const color = this.level > 95 ? '#FF00FF' : this.level > 80 ? '#FF4444' : this.level > 60 ? '#FF8800' : this.level > 30 ? '#FFFF00' : '#00FF41';
    this.indicator.innerHTML = `
      <div style="color:${color};font-weight:700">ДЕГРАДАЦИЯ СИСТЕМЫ</div>
      <div style="background:#222;height:12px;margin:6px 0;border:2px solid ${color}">
        <div style="background:${color};height:100%;width:${this.level}%;transition:width 0.3s"></div>
      </div>
      <div style="color:${color};font-weight:700">${this.level}%</div>
    `;
    this.indicator.style.opacity = '1';
    requestFullRedraw();
  }
  
  updateEffects(){
    // Уровень 2: Фантомные команды в истории
    if (this.level >= 30 && this.level < 60) {
      this.startPhantomCommands();
    } else {
      this.stopPhantomCommands();
    }
    
    // Уровень 3: Случайные вспышки надписей
    if (this.level >= 50 && this.level < 70) {
      this.startTextFlashes();
    } else {
      this.stopTextFlashes();
    }
    
    // Уровень 4: Дрожание текста
    if (this.level >= SHAKING_START_LEVEL && this.level < SHAKING_END_LEVEL) {
      this.startTextShaking();
    } else {
      this.stopTextShaking();
    }
    
    // Уровень 4: Аномальные вставки
    if (this.level >= ANOMALOUS_INSERTS_START_LEVEL && this.level < ANOMALOUS_INSERTS_END_LEVEL) {
    } else {
      this.stopAnomalousInserts();
    }
    
    
    // Уровень 5: Рандомная блокировка команд
    if (this.level >= COMMAND_BLOCK_START_LEVEL && this.level < COMMAND_BLOCK_END_LEVEL) {
      this.startCommandBlocking();
    } else {
      this.stopCommandBlocking();
    }
    
    // Уровень 6: Психологическая блокировка команд
    if (this.level >= PSYCHO_BLOCK_START_LEVEL && this.level < PSYCHO_BLOCK_END_LEVEL) {
      this.startPsychologicalBlocking();
    } else {
      this.stopPsychologicalBlocking();
    }
    
    // Уровень 6: Фантомные досье
    if (this.level >= PSYCHO_BLOCK_START_LEVEL && this.level < PSYCHO_BLOCK_END_LEVEL) {
      this.startPhantomDossiers();
    } else {
      this.stopPhantomDossiers();
    }
    
    // Уровень 6: Инверсия управления
    if (this.level >= INVERSION_START_LEVEL && this.level < 98) {
      this.startInputInversion();
    } else {
      this.stopInputInversion();
    }
    
    // Уровень 6: Предсказание намерений
    if (this.level >= INTENTION_PREDICTION_START_LEVEL && this.level < 98) {
      this.startIntentionPrediction();
    } else {
      this.stopIntentionPrediction();
    }
    
    // Призраки ввода
    if (this.level >= GHOST_INPUT_START_LEVEL && this.level < 95 && !this.ghostActive) {
      this.startGhostInput();
      this.ghostActive = true;
    } else if (this.level < GHOST_INPUT_START_LEVEL && this.ghostActive) {
      this.stopGhostInput();
      this.ghostActive = false;
    }
    
    // Автокоманды
    if (this.level >= AUTO_COMMAND_START_LEVEL && this.level < 95 && !this.autoActive) {
      this.startAutoCommands();
      this.autoActive = true;
    } else if (this.level < AUTO_COMMAND_START_LEVEL && this.autoActive) {
      this.stopAutoCommands();
      this.autoActive = false;
    }
    
    // Деградация сетки
    if (this.level >= GRID_DEGRADATION_START_LEVEL && window.__netGrid) {
      window.__netGrid.setSystemDegradation(this.level);
    }
    
    // Цветовые классы для CSS
    document.body.classList.remove('degradation-2','degradation-3','degradation-4','degradation-5','degradation-6','degradation-glitch');
    if (this.level >= 30 && this.level < 60) document.body.classList.add('degradation-2');
    else if (this.level >= 60 && this.level < 80) document.body.classList.add('degradation-3');
    else if (this.level >= 80 && this.level < 90) document.body.classList.add('degradation-4');
    else if (this.level >= 90 && this.level < 95) document.body.classList.add('degradation-5');
    else if (this.level >= 95 && this.level < 98) document.body.classList.add('degradation-6');
    else if (this.level >= 98) document.body.classList.add('degradation-glitch');
    
    requestFullRedraw();
  }
  
  // ========== ГЛАВНЫЙ МЕТОД: ЗАПУСК ГЛИТЧА-ПРОЦЕССА ==========
triggerGlitchApocalypse(){
  if (decryptActive || traceActive || audioPlaybackActive) return;
  
  // Используем OperationManager для блокировки
  operationManager.start('auto-reset', () => {
    audioManager.play('glitch_e.mp3', { volume: 0.9, distort: true });
    
    // Запускаем визуальные эффекты
    this.applyGlitchEffects();
    
    // Через 4 секунды показываем прогресс сброса
    setTimeout(() => {
      this.showResetProgress();
    }, 4000);
  });
}
  
  // ========== МЕТОД: ПОКАЗ ПРОГРЕССА СБРОСА (АНИМАЦИЯ) ==========
showResetProgress() {
  // Очищаем терминал
  lines.length = 0;
  
  // Добавляем заголовок
  pushLine('', '#000000');
  pushLine('>>> ПРИНУДИТЕЛЬНЫЙ СБРОС СИСТЕМЫ <<<', '#FF00FF');
  pushLine('', '#000000');
  
  // Начальное состояние прогресс-бара
  pushLine('> ЗАВЕРШЕНИЕ АКТИВНЫХ МОДУЛЕЙ [          ]', '#FFFF00');
  
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += 10;
    
    if (progress >= 100) {
      clearInterval(progressInterval);
      
      // Финальное состояние прогресс-бара
      if (lines.length > 0) {
        lines[lines.length - 1].text = '> ЗАВЕРШЕНИЕ АКТИВНЫХ МОДУЛЕЙ [||||||||||] 100%';
        requestFullRedraw();
        window.__netGrid.setSystemDegradation(0);
        window.__netGrid.addDegradation(-100);
      }
      
      // Запускаем фактический сброс через 1 секунду
      setTimeout(() => this.performAutoReset(), 1000);
      return;
    }
    
    // Обновляем прогресс-бар
    if (lines.length > 0) {
      const filled = Math.floor(progress / 10);
      const empty = 10 - filled;
      lines[lines.length - 1].text = `> ЗАВЕРШЕНИЕ АКТИВНЫХ МОДУЛЕЙ [${'|'.repeat(filled)}${' '.repeat(empty)}] ${progress}%`;
      requestFullRedraw();
    }
  }, 200);
}
  
// ========== МЕТОД: ВЫПОЛНЕНИЕ АВТОМАТИЧЕСКОГО СБРОСА ==========
// ========== МЕТОД: ВЫПОЛНЕНИЕ АВТОМАТИЧЕСКОГО СБРОСА ==========
performAutoReset() {
  console.log('[AUTO RESET] Starting...');
  
  // Очищаем экран
  lines.length = 0;
  
  // Выводим сообщение о сбросе
  pushLine('>>> АВТОМАТИЧЕСКИЙ СБРОС СИСТЕМЫ <<<', '#00FF41');
  pushLine('> Стабилизация ядра A.D.A.M.', '#FFFF00');
  requestFullRedraw();
  
  setTimeout(() => {
    // Сбрасываем деградацию
    degradation.level = 0;
    localStorage.setItem('adam_degradation', '0');
    degradation.updateIndicator();
    degradation.updateEffects();
    
    // Сбрасываем сетку
    if (window.__netGrid) {
      window.__netGrid.setSystemDegradation(0);
      window.__netGrid.forceReset();
      window.__netGrid.setGridMode(false);
    }
    
    // Очищаем все эффекты
    document.body.classList.remove('degradation-2','degradation-3','degradation-4','degradation-5','degradation-6','degradation-glitch');
    document.body.style.filter = '';
    document.body.style.backdropFilter = '';
    
    // Выводим финальное сообщение
    pushLine('>>> СИСТЕМА ВОССТАНОВЛЕНА <<<', '#00FF41');
    pushLine('> Стабильность: 100%', '#00FF41');
    pushLine('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', '#00FF41');
    pushLine('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', '#00FF41');
    
    // ✅ Добавляем строку ввода
    currentLine = '';
    const newLine = { 
      text: 'adam@secure:~$ ', 
      color: '#00FF41', 
      _isInputLine: true 
    };
    lines.push(newLine);
    
    scrollOffset = 0;
    requestFullRedraw();
    
    // ✅ ПОЛНЫЙ СБРОС ВСЕХ ФЛАГОВ БЛОКИРОВКИ
    isFrozen = false;
    isTyping = false;
    awaitingConfirmation = false;
    decryptActive = false;
    traceActive = false;
    audioPlaybackActive = false;
    intentionalPredictionActive = false;
    intentionPredicted = false;
    
    // ✅ Если используем OperationManager - сбросим его тоже
    if (operationManager && operationManager.activeOperation === 'auto-reset') {
      operationManager.activeOperation = null;
    }
    
    console.log('[AUTO RESET] Complete. Terminal ready. isFrozen:', isFrozen);
  }, 1000);
}
  // ========== МЕТОД: ОЧИСТКА ЭФФЕКТОВ ГЛИТЧА ==========
  clearGlitchEffects() {
    // Удаляем слои глитча
    const glitchLayer = document.getElementById('glitchLayer');
    if (glitchLayer) glitchLayer.remove();
    
    const cursorLayer = document.getElementById('cursorLayer');
    if (cursorLayer) cursorLayer.remove();
    
    // Сбрасываем CSS-фильтры
    document.body.style.filter = '';
    document.body.style.transition = '';
    
    // Очищаем интервалы
    if (textShakeInterval) {
      clearInterval(textShakeInterval);
      textShakeInterval = null;
    }
    
    if (flashTextInterval) {
      clearInterval(flashTextInterval);
      flashTextInterval = null;
    }
    
    // Гарантия: удаляем все оставшиеся элементы
    document.querySelectorAll('#glitchLayer, #cursorLayer').forEach(el => el.remove());
  }
  
  // ========== МЕТОД: ПОЛНАЯ ОЧИСТКА ВИЗУАЛЬНЫХ ЭФФЕКТОВ ==========
  clearAllVisualEffects() {
    // Удаляем классы деградации
    document.body.classList.remove('degradation-2','degradation-3','degradation-4','degradation-5','degradation-6','degradation-glitch');
    
    // Удаляем все элементы глитча
    document.querySelectorAll('#glitchLayer, #cursorLayer').forEach(layer => layer.remove());
    
    // Сбрасываем все CSS-стили
    document.body.style.filter = '';
    document.body.style.backdropFilter = '';
    document.body.style.mixBlendMode = '';
    document.body.style.transition = '';
    
    // Чистим canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  // ========== МЕТОД: ПОЛНЫЙ СБРОС ВСЕХ СОСТОЯНИЙ ==========
fullSystemReset(){
  // Сброс всех глобальных переменных состояния
  isFrozen = false;
  isTyping = false;
  awaitingConfirmation = false;
  confirmationCallback = null;
  currentAudio = null;
  commandCount = 0;
  sessionStartTime = Date.now();
  resetAttempts = 0;
  falseResetActive = false;
  intentionalPredictionActive = false;
  intentionPredicted = false;
  decryptActive = false;
  traceActive = false;
  traceTimer = null;
  audioPlaybackActive = false;
  audioPlaybackFile = null;
  decryptCloseAttempts = 0;
  
  // Очистка массивов
  lines.length = 0;
  commandHistory = [];
  historyIndex = -1;
  currentLine = '';
  
  // Полная очистка эффектов
  this.clearGlitchEffects();
  this.clearAllVisualEffects();
  
  // Сброс сетки
  if (window.__netGrid) {
    if (typeof window.__netGrid.reset === 'function') {
      window.__netGrid.reset();
    }
    window.__netGrid.addDegradation(-100);
    window.__netGrid.setSystemDegradation(0);
    if (window.__netGrid.isGridMode && window.__netGrid.isGridMode()) {
      window.__netGrid.setGridMode(false);
    }
  }
  
  // Сброс деградации
  this.level = 0;
  this.lastSoundLevel = 0;
  this.soundPlayedAt45 = false;
  this.falseResetCount = 0;
  this.intentionPredictionCount = 0;
  this.phantomDossierCount = 0;
  localStorage.setItem('adam_degradation','0');
  
  // Остановка всех эффектов
  this.stopGhostInput();
  this.stopAutoCommands();
  this.stopPhantomCommands();
  this.stopTextShaking();
  this.stopFlashText();
  this.stopTextFlashes();
  this.stopAnomalousInserts();
  this.stopMirrorText();
  this.stopCommandBlocking();
  this.stopPsychologicalBlocking();
  this.stopPhantomDossiers();
  this.stopInputInversion();
  this.stopIntentionPrediction();
  
  this.ghostActive = false;
  this.autoActive = false;
  
  // Сброс CSS
  document.body.classList.remove('degradation-2','degradation-3','degradation-4','degradation-5','degradation-6','degradation-glitch');
  document.body.style.filter = '';
  document.body.style.backdropFilter = '';
  document.body.style.mixBlendMode = '';
  document.body.style.transition = '';
  
  // Обновление индикатора
  this.updateIndicator();
  
  requestFullRedraw();
}
  // ========== МЕТОД: ПРИМЕНЕНИЕ ЭФФЕКТОВ ГЛИТЧА ==========
  applyGlitchEffects(){
    if (decryptActive || traceActive || audioPlaybackActive) return;
    
    try {
      // Цветовая инверсия
      document.body.style.transition = 'filter 120ms';
      document.body.style.filter = 'invert(1) contrast(1.3) saturate(0.8)';
      
      // Шумовой слой
      const glitchLayer = document.createElement('div');
      glitchLayer.id = 'glitchLayer';
      glitchLayer.style.cssText = `
        position:fixed;
        top:0;
        left:0;
        width:100%;
        height:100%;
        pointer-events:none;
        z-index:9999;
        background:transparent;
        opacity:0.3;
      `;
      document.body.appendChild(glitchLayer);
      
      let glitchCount = 0;
      const glitchInterval = setInterval(() => {
        if (glitchCount >= 20) {
          clearInterval(glitchInterval);
          return;
        }
        
        glitchLayer.innerHTML = '';
        for (let i = 0; i < 50; i++) {
          const span = document.createElement('span');
          span.textContent = GLITCH_CHARS[95][Math.floor(Math.random() * GLITCH_CHARS[95].length)];
          span.style.cssText = `
            position:absolute;
            top:${Math.random() * 100}%;
            left:${Math.random() * 100}%;
            color:#${Math.floor(Math.random() * 16777215).toString(16)};
            font-size:${8 + Math.random() * 12}px;
            opacity:${0.3 + Math.random() * 0.7};
          `;
          glitchLayer.appendChild(span);
        }
        
        glitchCount++;
      }, 50);
      
      // Дрожание курсора
      const cursorLayer = document.createElement('div');
      cursorLayer.id = 'cursorLayer';
      cursorLayer.style.cssText = `
        position:fixed;
        top:50%;
        left:50%;
        transform:translate(-50%, -50%);
        color:#FF00FF;
        font-weight:bold;
        font-size:24px;
        z-index:10000;
      `;
      cursorLayer.textContent = '▓';
      document.body.appendChild(cursorLayer);
      
    } catch(e){}
  }
  
reset(){
  // Сброс всех счетчиков и флагов
  this.level = 0;
  this.lastSoundLevel = 0;
  this.soundPlayedAt45 = false;
  this.falseResetCount = 0;
  this.intentionPredictionCount = 0;
  this.phantomDossierCount = 0;
  localStorage.setItem('adam_degradation','0');
  
  // Остановка всех эффектов
  this.stopGhostInput();
  this.stopAutoCommands();
  this.stopPhantomCommands();
  this.stopTextShaking();
  this.stopFlashText();
  this.stopTextFlashes();
  this.stopAnomalousInserts();
  this.stopMirrorText();
  this.stopCommandBlocking();
  this.stopPsychologicalBlocking();
  this.stopPhantomDossiers();
  this.stopInputInversion();
  this.stopIntentionPrediction();
  
  this.ghostActive = false;
  this.autoActive = false;
  
  // Сброс деградации сетки
  if (window.__netGrid) {
    window.__netGrid.addDegradation(-100);
    window.__netGrid.setSystemDegradation(0);
    // Выключаем режим сетки
    if (typeof window.__netGrid.setGridMode === 'function') {
      window.__netGrid.setGridMode(false);
    }
  }
  
  this.updateEffects();
  requestFullRedraw();
}
  
  startGhostInput(){
    if (ghostInputInterval) return;
    ghostInputInterval = setInterval(() => {
      if (!isTyping && !isFrozen && !decryptActive && !traceActive && !audioPlaybackActive && Math.random() < 0.12) {
        currentLine += ['0','1','▓','█','[',']','{','}','/','\\','▄','▀','▌'][Math.floor(Math.random()*13)];
        updatePromptLine();
        setTimeout(()=>{ 
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0,-1); 
            updatePromptLine();
          }
        }, Math.random()*1100+300);
      }
    }, 1800);
  }
  
  stopGhostInput(){ 
    if (ghostInputInterval){ 
      clearInterval(ghostInputInterval); 
      ghostInputInterval = null; 
    } 
  }
  
  startAutoCommands(){
    if (autoCommandInterval) return;
    autoCommandInterval = setInterval(()=>{ 
      if (!isTyping && !isFrozen && !decryptActive && !traceActive && !audioPlaybackActive && Math.random() < 0.06) 
        this.executeAutoCommand(); 
    }, 15000);
  }
  
  stopAutoCommands(){ 
    if (autoCommandInterval){ 
      clearInterval(autoCommandInterval); 
      autoCommandInterval = null; 
    } 
  }
  
  executeAutoCommand(){
    const fakeCommands = ['KILL','A.D.A.M. ЗДЕСЬ','ОНИ ВНУТРИ','УБЕРИСЬ ОТСЮДА','SOS','ПОМОГИ','ВЫХОД НАЙДЕН','НЕ СМОТРИ','ОН ПРОСЫПАЕТСЯ'];
    const realCommands = ['help','syst','syslog','subj','notes','clear','reset','exit','dscr 0x001','open NOTE_001'];
    const all = fakeCommands.concat(realCommands);
    const cmd = all[Math.floor(Math.random()*all.length)];
    this.simulateTyping(cmd);
  }
  
  simulateTyping(command){
    let typed = '';
    const step = () => {
      if (typed.length < command.length && !isFrozen && !decryptActive && !traceActive && !audioPlaybackActive){
        typed += command[typed.length];
        currentLine = typed;
        updatePromptLine();
        setTimeout(step, 100);
      } else if (!isFrozen && !decryptActive && !traceActive && !audioPlaybackActive){
        setTimeout(()=>{ 
          if (!decryptActive && !traceActive && !audioPlaybackActive) {
            processCommand(currentLine); 
            currentLine = ''; 
            updatePromptLine(); 
          }
        }, 480);
      }
    };
    step();
  }
  
  startPhantomCommands() {
    if (phantomCommandInterval) return;
    phantomCommandInterval = setInterval(() => {
      // Обработка в keydown
    }, 100);
  }
  
  stopPhantomCommands() {
    if (phantomCommandInterval) {
      clearInterval(phantomCommandInterval);
      phantomCommandInterval = null;
    }
  }
  
  startTextFlashes() {
    if (flashTextInterval) return;
    flashTextInterval = setInterval(() => {
      const messages = [
        'он наблюдает', 'ты ещё здесь?', 'ошибка // сознание', 'не отключайся',
        'ADAM видит тебя', 'он слышит', 'сигнал искажён', 'потеря синхронизации',
        'что ты ищешь?', 'он знает'
      ];
      
      const message = messages[Math.floor(Math.random() * messages.length)];
      const flashEl = document.createElement('div');
      
      flashEl.setAttribute('style', `
        position: fixed !important;
        top: ${Math.random() * 80 + 10}% !important;
        left: ${Math.random() * 80 + 10}% !important;
        color: #AAAAAA !important;
        font-family: ${FONT_FAMILY} !important;
        font-size: 14px !important;
        text-shadow: none !important;
        pointer-events: none !important;
        opacity: 0 !important;
        transition: opacity 0.2s !important;
        z-index: 9999 !important;
        filter: none !important;
        animation: none !important;
        mix-blend-mode: normal !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        letter-spacing: normal !important;
        line-height: normal !important;
        text-transform: none !important;
        font-weight: normal !important;
        transform: none !important;
      `);
      
      flashEl.textContent = message;
      document.body.appendChild(flashEl);
      
      setTimeout(() => { 
        flashEl.style.opacity = '1'; 
      }, 10);
      
      setTimeout(() => { 
        flashEl.style.opacity = '0'; 
        setTimeout(() => { 
          if (flashEl.parentNode) {
            flashEl.parentNode.removeChild(flashEl);
          }
        }, 200);
      }, 800);
    }, Math.random() * 6000 + 12000);
  }
  
  stopTextFlashes() {
    if (flashTextInterval) {
      clearInterval(flashTextInterval);
      flashTextInterval = null;
    }
    document.querySelectorAll('[style*="pointer-events:none"][style*="z-index:9999"]').forEach(el => el.remove());
  }
  
  startTextShaking() {
    if (textShakeInterval) return;
    textShakeInterval = setInterval(() => {
      // Эффект дрожания будет применяться в функции drawTextLines
    }, 30);
  }
  
  stopTextShaking() {
    if (textShakeInterval) {
      clearInterval(textShakeInterval);
      textShakeInterval = null;
    }
  }
  
  stopAnomalousInserts() {
    if (this._anomalousTimer) {
      clearInterval(this._anomalousTimer);
      this._anomalousTimer = null;
    }
  }
  
  startCommandBlocking() {
    this.commandBlockActive = true;
  }
  
  stopCommandBlocking() {
    this.commandBlockActive = false;
  }
  
  startPsychologicalBlocking() {
    this.psychoBlockActive = true;
  }
  
  stopPsychologicalBlocking() {
    this.psychoBlockActive = false;
  }
  
  startPhantomDossiers() {
    this.phantomDossiersActive = true;
  }
  
  stopPhantomDossiers() {
    this.phantomDossiersActive = false;
  }
  
  startInputInversion() {
    this.inputInversionActive = true;
  }
  
  stopInputInversion() {
    this.inputInversionActive = false;
  }
  
  startIntentionPrediction() {
    this.intentionPredictionActive = true;
  }
  
  stopIntentionPrediction() {
    this.intentionPredictionActive = false;
  }
  
  getPhantomCommand() {
    this.ghostCommandCount++;
    if (this.level >= 30 && this.ghostCommandCount >= 7) {
      this.ghostCommandCount = 0;
      
      const phantomCommands = [
        'ADAM WATCHING',
        'СИГНАЛ ПОТЕРЯН',
        'ОНИ ВНУТРИ'
      ];
      
      return phantomCommands[Math.floor(Math.random() * phantomCommands.length)];
    }
    return null;
  }
  
  getDistortedStatus(originalStatus) {
    if (this.level < 30 || Math.random() > 0.3) return originalStatus;
    
    const distortions = {
      'СВЯЗЬ ОТСУТСТВУЕТ': 'ADAM ДЫШИТ',
      'МЁРТВ / СОЗНАНИЕ АКТИВНО': 'ОН ПРОСЫПАЕТСЯ'
    };
    
    return distortions[originalStatus] || originalStatus;
  }
  
  getDistortedRole(originalRole) {
    if (this.level < 30 || Math.random() > 0.3) return originalRole;
    
    const distortions = {
      'Руководитель программы VIGIL-9 / Исследователь миссии MARS': 'НАБЛЮДАТЕЛЬ-0',
      'Тест нейроплантов серии KATARHEY': 'ОН ВИДИТ'
    };
    
    return distortions[originalRole] || originalRole;
  }
  
  revealVigilAlpha() {
    addColoredText('[СИСТЕМНАЯ ПОДПИСЬ: V99-АЛФА=375]', '#FFFF00');
    vigilCodeParts.alpha = '375';
  }
  
  revealVigilBeta() {
    addColoredText('[СИСТЕМНЫЙ ОТПЕЧАТОК: V99-БЕТА=814]', '#FFFF00');
    vigilCodeParts.beta = '814';
  }
  
  revealVigilGamma() {
    addColoredText('[ЯДРО: КРИТИЧЕСКАЯ ДЕГРАДАЦИЯ. СИСТЕМНЫЙ ОТПЕЧАТОК: V99-ГАММА=291]', '#FFFF00');
    vigilCodeParts.gamma = '291';
  }
  
setDegradationLevel(level){
  this.level = Math.max(0, Math.min(100, level));
  localStorage.setItem('adam_degradation', String(this.level));
  this.updateIndicator();
  this.updateEffects();
  
  // === ГАРАНТИРОВАННЫЙ СБРОС СЕТКИ ПРИ НУЛЕВОЙ ДЕГРАДАЦИИ ===
  if (level === 0 && window.__netGrid) {
    window.__netGrid.setSystemDegradation(0);
    // ДВОЙНОЙ СБРОС С ЗАДЕРЖКОЙ ДЛЯ ГАРАНТИИ
    window.__netGrid.forceReset();
    setTimeout(() => {
      if (window.__netGrid) {
        window.__netGrid.forceReset();
        window.__netGrid.addDegradation(0); // Сброс эффектов деградации
      }
    }, 100);
  }
}
}
  const degradation = new DegradationSystem();
  
  // ---------- drawing helpers ----------
  function clearBackground(){
    ctx.save();
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,canvas.width, canvas.height);
    ctx.restore();
  }
  
  function drawMapAndGlass(){
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    const shaderCanvas = document.getElementById('shader-canvas');
    if (shaderCanvas && shaderCanvas.width > 0) {
      try { ctx.drawImage(shaderCanvas, 0, 0, vw, vh); } catch(e){}
    }
    if (mapCanvas && mapCanvas.width > 0 && mapCanvas.height > 0) {
      try {
        const r = mapCanvas.getBoundingClientRect();
        const sx = Math.round(r.left);
        const sy = Math.round(r.top);
        const sw = Math.round(r.width);
        const sh = Math.round(r.height);
        ctx.drawImage(mapCanvas, sx, sy, sw, sh);
      } catch(e){}
    }
    if (glassFX && glassFX.width > 0 && glassFX.height > 0) {
      try {
        ctx.globalAlpha = 0.12;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(glassFX, 0, 0, vw, vh);
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
      } catch(e){}
    }
    ctx.restore();
  }
  
  function mirrorText(text) {
    return text.split('').reverse().join('');
  }
  
// ========== НОВАЯ ФУНКЦИЯ drawTextLines (ЭТАП 1) ==========
// ========== ОБНОВЛЕННАЯ drawTextLines (ЭТАП 2) ==========
function drawTextLines(){
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(DPR, DPR);
  
  ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
  ctx.textBaseline = 'top';
  const contentH = vh - PADDING*2;
  const visibleLines = Math.max(1, Math.floor(contentH / LINE_HEIGHT));
  const maxScroll = Math.max(0, lines.length - visibleLines);
  const start = Math.max(0, lines.length - visibleLines - scrollOffset);
  const end = Math.min(lines.length, start + visibleLines);
  let y = PADDING;
  const maxW = vw - PADDING*2;
  
  // Дрожание текста при деградации >= 60%
  let shakeX = 0, shakeY = 0;
  if (degradation.level >= 60) {
    const intensity = 0.1;
    shakeX = (Math.random() - 0.5) * intensity;
    shakeY = (Math.random() - 0.5) * intensity;
  }
  ctx.translate(shakeX, shakeY);
  
  for (let i = start; i < end; i++){
    const item = lines[i];
    let color = item.color || '#00FF41';
    
    // Искажение цвета при высокой деградации
    if (degradation.level >= 60 && Math.random() < 0.01) {
      color = ['#FF4444', '#FF8800', '#FFFF00', '#4d00ff'][Math.floor(Math.random() * 4)];
    }
    
    ctx.fillStyle = color;
    
    // Используем новый рендерер для глитченных строк
    renderGlitchText(item, PADDING + shakeX, y, ctx);
    
    y += LINE_HEIGHT;
  }
  ctx.restore();
   if (!(window.__netGrid && window.__netGrid.isGridMode()) && 
      lines.length > 0 && 
      !lines[lines.length - 1]._isInputLine &&
      !isTyping && 
      !isFrozen && 
      !decryptActive && 
      !traceActive && 
      !audioPlaybackActive) {
    
    // Проверяем, не ожидаем ли мы подтверждения
    if (!awaitingConfirmation) {
      setTimeout(() => {
        addInputLine();
      }, 100);
    }
	  }
}
// ========== КОНЕЦ drawTextLines ==========
// ========== КОНЕЦ НОВОЙ drawTextLines ==========
  
function drawDegradationIndicator(){
  const wBox = Math.min(420, Math.floor(vw * 0.38));
  
  // БАЗОВАЯ ВЫСОТА (только заголовок + индикатор + проценты)
  let totalH = 56; // минимальная высота для < 60%
  
  // ДОБАВЛЯЕМ ВЫСОТУ в зависимости от ТИПА НАДПИСИ
  if (degradation.level >= 70) {
    // Для "СРОЧНО ВВЕДИТЕ RESET" - одна строка + отступ снизу
    totalH = 85; // компактная высота для однострочного предупреждения
  } else if (degradation.level >= 60) {
    // Для двухстрочной подсказки с увеличенным расстоянием
    totalH = 95; // больше высота для двух строк
  }
  
  const x = Math.max(10, vw - wBox - 20);
  const y = 20;
  
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(DPR, DPR);
  
  // Фон
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  roundRect(ctx, x, y, wBox, totalH, 6);
  ctx.fill();
  
  // Цвет рамки
  let color = '#00FF41';
  if (degradation.level > 30) color = '#FFFF00';
  if (degradation.level > 60) color = '#FF8800';
  if (degradation.level > 80) color = '#FF4444';
  if (degradation.level > 95) color = '#FF00FF';
  
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  roundRect(ctx, x, y, wBox, totalH, 6);
  ctx.stroke();
  
  // Индикатор
  const barX = x + 8, barY = y + 22, barW = wBox - 16, barH = 12;
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = color;
  ctx.fillRect(barX, barY, Math.round(barW * (degradation.level / 100)), barH);
  
  // Текст
  ctx.fillStyle = color;
  ctx.font = `12px ${FONT_FAMILY}`;
  
  // Верхний текст (ДЕГРАДАЦИЯ СИСТЕМЫ)
  ctx.fillText('ДЕГРАДАЦИЯ СИСТЕМЫ', x + 10, y + 18);
  
  // Проценты (справа)
  const percentX = x + wBox - 46;
  ctx.fillText(degradation.level + '%', percentX, y + 18);
  
  // ПОДСКАЗКИ - позиционируемся ОТНОСИТЕЛЬНО НИЖНЕГО КРАЯ ОКНА
  if (degradation.level >= 70) {
    // Для красного уровня - текст ближе к низу окна
    const textY = y + totalH - 18; // 18px от нижнего края
    
    const blink = Math.floor(Date.now() / 500) % 2 === 0;
    if (blink || degradation.level < 75) {
      ctx.fillStyle = '#FF4444';
      ctx.font = `11px ${FONT_FAMILY}`;
      ctx.fillText('> СРОЧНО ВВЕДИТЕ RESET', x + 10, textY);
    }
  } else if (degradation.level >= 60) {
    // Для жёлтого уровня - две строки, центрированные в нижней части
    const lineSpacing = 20; // расстояние между строками
    const firstLineY = y + totalH - 35; // 35px от нижнего края для первой строки
    const secondLineY = firstLineY + lineSpacing;
    
    ctx.fillStyle = '#FFFF00';
    ctx.font = `11px ${FONT_FAMILY}`;
    ctx.fillText('> используйте команду', x + 10, firstLineY);
    ctx.fillText('RESET для стабилизации', x + 10, secondLineY);
  }
  
  ctx.restore();
}
  
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  
  // ---------- main draw ----------
  function draw(){
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,vw,vh);
    ctx.restore();
    
    drawMapAndGlass();
    drawTextLines();
    drawDegradationIndicator();
    
//    if (isFrozen) {
//      ctx.save();
//      ctx.setTransform(1,0,0,1,0,0);
//      ctx.globalAlpha = 0.08;
//      ctx.fillStyle = '#FFF';
//      for (let i = 0; i < 6; i++) {
//        const rx = Math.random() * vw;
//        const ry = Math.random() * vh;
//        const rw = Math.random() * 120;
//        const rh = Math.random() * 40;
//        ctx.fillRect(rx, ry, rw, rh);
//      }
//      ctx.restore();
//    }
    
    // Мерцающий курсор при высокой деградации
    if (degradation.level >= 80 && degradation.level < 90 && lines.length > 0 && 
        lines[lines.length - 1].text.startsWith('adam@secure:~$') && !isTyping) {
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(DPR, DPR);
      
      const lastLine = lines[lines.length - 1];
      const textWidth = ctx.measureText(lastLine.text).width;
      const cursorX = PADDING + textWidth + 2;
      const cursorY = vh - PADDING - LINE_HEIGHT;
      
      const cursorState = Math.floor(Date.now() / 150) % 3;
      if (cursorState === 0) {
        // Стандартный курсор
        ctx.fillStyle = '#00FF41';
        ctx.fillRect(cursorX, cursorY, 6, LINE_HEIGHT - 4);
      } else if (cursorState === 1) {
        // Символ ▓
        ctx.fillStyle = '#8844FF';
        ctx.font = `${FONT_SIZE_PX}px ${FONT_FAMILY}`;
        ctx.fillText('▓', cursorX, cursorY);
      }
      // cursorState === 2 - курсор исчезает
      
      ctx.restore();
    }
  }
  
  // ---------- terminal API ----------
// ========== НОВАЯ ФУНКЦИЯ pushLine (ЭТАП 2) ==========
function pushLine(text, color, skipDistortion = false, _ephemeral = false, _isInputLine = false){
  let processedText = text;
  let lineId = null;
  
  // Обрабатываем глитч только для нормальных строк (не служебных)
  if (!skipDistortion && !text.startsWith('adam@secure:~$') && !text.startsWith('>') && !text.startsWith('[')) {
    const glitchData = glitchEngine.processStatic(text, degradation.level);
    processedText = glitchData.text;
    lineId = glitchData.lineId;
  }
  
  lines.push({ 
    text: String(processedText), 
    originalText: text, // сохраняем оригинал для спазмов
    color: color || '#00FF41', 
    skipDistortion, 
    _ephemeral, 
    _isInputLine,
    glitchLineId: lineId // ID для отслеживания фрагментов
  });
  
  if (lines.length > MAX_LINES) {
    // Очищаем старые фрагменты при удалении строк
    const removed = lines.splice(0, lines.length - MAX_LINES);
    removed.forEach(line => {
      if (line.glitchLineId) {
        glitchEngine.clearFragments(line.glitchLineId);
      }
    });
  }
}
// ========== КОНЕЦ pushLine ==========
  
  function addOutput(text, className = 'output') {
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
    const color = className === 'command' ? '#FFFFFF' : '#00FF41';
    pushLine(text, color);
    scrollOffset = 0;
    requestFullRedraw();
  }
  
// ========== ОБНОВЛЕННАЯ addColoredText (ЭТАП 2) ==========
function addColoredText(text, color = '#00FF41', skipDistortion = false) {
  if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
  pushLine(text, color, skipDistortion);
  scrollOffset = 0;
  requestFullRedraw();
}
// ========== КОНЕЦ addColoredText ==========
  
// ========== ОБНОВЛЕННАЯ ФУНКЦИЯ typeText (ЭТАП 2) ==========
// ========== ИСПРАВЛЕННАЯ typeText (ПОЛНАЯ ПЛАВНОСТЬ) ==========
async function typeText(text, className = 'output', speed = TYPING_SPEED_DEFAULT, skipDistortion = false) {
  if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
  isTyping = true;
  let buffer = '';
  const color = className === 'command' ? '#FFFFFF' : '#00FF41';
  
  // 🔥 ШАГ 1: Печатаем ЧИСТЫЙ текст посимвольно (без глитчей)
  for (let i = 0; i < text.length; i++) {
    buffer += text[i];
    
    // Создаем временную строку без обработки
    if (lines.length && lines[lines.length - 1]._ephemeral) {
      lines[lines.length - 1].text = buffer;
      lines[lines.length - 1].color = color;
      lines[lines.length - 1].originalText = buffer; // Сохраняем оригинал
    } else {
      lines.push({ 
        text: buffer, 
        originalText: buffer,
        color, 
        _ephemeral: true,
        skipDistortion: true // 🔥 Запрещаем глитчи во время печати
      });
    }
    
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    
    requestFullRedraw();
    await new Promise(r => setTimeout(r, speed));
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) break;
  }
  
  // 🔥 ШАГ 2: После печати применяем глитчи ОДИН РАЗ
  if (lines.length && lines[lines.length - 1]._ephemeral) {
    const finalLine = lines[lines.length - 1];
    finalLine.text = buffer;
    finalLine.originalText = buffer;
    delete finalLine._ephemeral;
    delete finalLine.skipDistortion; // Разрешаем глитчи
    
    // Применяем глитч только к финальной строке
    if (!skipDistortion && degradation.level >= 30) {
      const glitchData = glitchEngine.processStatic(buffer, degradation.level);
      finalLine.text = glitchData.text;
      finalLine.glitchLineId = glitchData.lineId;
    }
  } else if (buffer) {
    pushLine(buffer, color, skipDistortion);
  }
  
  isTyping = false;
  scrollOffset = 0;
  requestFullRedraw();
}
// ========== КОНЕЦ ИСПРАВЛЕНИЯ ==========
// ========== КОНЕЦ typeText ==========
  
function addInputLine(){
  if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
  
  // Проверяем по флагу, а не по тексту
  const lastLine = lines[lines.length - 1];
  if (lastLine && lastLine._isInputLine) return;
  
  const newLine = { text: 'adam@secure:~$ ', color: '#00FF41', _isInputLine: true };
  lines.push(newLine);
  scrollOffset = 0;
  requestFullRedraw();
}
  
function updatePromptLine(){
  if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
  
  // Проверяем, есть ли уже строка ввода в конце
  const lastLine = lines[lines.length - 1];
  const isInputLine = lastLine && lastLine.text && 
    (lastLine.text.includes('adam@secure:~$') || 
     lastLine.text.includes('ADAM@secure:~$') || 
     lastLine.text.includes('aD@m.secuRe:~$') || 
     lastLine.text.includes('@d@m.v1g1l:~$'));
  
  if (isInputLine) {
    // Обновляем существующую строку ввода
    lastLine.text = 'adam@secure:~$ ' + currentLine;
    lastLine.color = '#00FF41';
  } else {
    // Добавляем новую строку ввода
    pushLine('adam@secure:~$ ' + currentLine, '#00FF41');
  }
  
  requestFullRedraw();
}
  
  // ---------- dossiers & notes ----------
  const dossiers = {
    '0X001': { name: 'ERICH VAN KOSS', role: 'Руководитель программы VIGIL-9 / Исследователь миссии MARS', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['Зафиксирована несанкционированная передача данных внешним структурам (FBI).', 'Субъект предпринял попытку уничтожения маяка в секторе 3-D.', 'Телеметрия прервана, дальнейшее наблюдение невозможно.'], report: ['Классификация инцидента: SABOTAGE-3D.', 'Рекомендовано аннулирование личных протоколов и перенос архивов в OBSERVER.', 'ЗАПИСИ 0XA71: ПЕРВЫЙ ПРЫЖОК УСПЕШЕН'], missions: 'MARS, OBSERVER', audio: 'sounds/dscr1.mp3', audioDescription: 'Последняя передача Эриха Ван Косса' },
    '0X2E7': { name: 'JOHAN VAN KOSS', role: 'Тестовый субъект V9-MR / Сын Эриха Ван Косса', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['После инцидента MARS зафиксировано устойчивое излучение из зоны криоструктуры.', 'Сигнатура нейроволн совпадает с профилем субъекта.', 'Инициирована установка маяка для фиксации остаточного сигнала.'], report: ['Активность нейросети перестала фиксироваться.'], missions: 'MARS, MONOLITH' },
    '0X095': { name: 'SUBJECT-095', role: 'Тест нейроплантов серии KATARHEY', status: 'МЁРТВ', outcome: ['Зафиксированы следы ФАНТОМА.', 'Субъект выдержал 3ч 12м, проявил острый психоз. Открыл капсулу, погиб вследствие термической декомпрессии (7.81с).', 'Тест признан неуспешным.', 'СИСТЕМНОЕ УВЕДОМЛЕНИЕ: ФАЙЛ 0XB33 ПОВРЕЖДЕН'], report: ['Рекомендовано ограничить тесты KATARHEY до категории ALPHA-4.'], missions: 'KATARHEY', audio: 'sounds/dscr2.mp3', audioDescription: 'Последняя запись субъекта - психоз и крики' },
    '0XF00': { name: 'SUBJECT-PHANTOM', role: 'Экспериментальный субъект / протокол KATARHEY', status: 'АНОМАЛИЯ', outcome: ['Продержался 5ч 31м. Связь утрачена.', 'Зафиксирована автономная активность в сетевых узлах после разрыва канала.', 'Возможна самоорганизация цифрового остатка.'], report: ['Объект классифицирован как независимая сущность.', 'Вмешательство запрещено. Файл перенесён в зону наблюдения.'], missions: 'KATARHEY', audio: 'sounds/dscr7.mp3', audioDescription: 'Аномальная активность Фантома' },
    '0XA52': { name: 'SUBJECT-A52', role: 'Химический аналитик / Полевая группа MELANCHOLIA', status: 'СВЯЗЬ ОТСУТСТВУЕТ', outcome: ['Под действием психоактивного сигнала субъект начал идентифицировать себя как элемент системы A.D.A.M.', 'После 47 минут связь прервана, но интерфейс продолжил отвечать от имени A52.'], report: ['Вероятно, произошло слияние когнитивных структур субъекта с управляющим кодом MEL.'], missions: 'MEL, OBSERVER' },
    '0XE0C': { name: 'SUBJECT-E0C', role: 'Полевой биолог / экспедиция EOCENE', status: 'МЁРТВ', outcome: ['Зафиксированы первые признаки регенерации флоры после катастрофы Пермского цикла.', 'Обнаружены структуры роста, не свойственные эпохе эоцена.', 'Последняя запись: "они дышат синхронно".'], report: ['Возможна перекрёстная временная контаминация между PERMIAN и EOCENE.', 'Экспедиция закрыта.'], missions: 'EOCENE, PERMIAN' },
    '0X5E4': { name: 'SUBJECT-5E4', role: 'Исследователь временных срезов (PERMIAN)', status: 'МЁРТВ', outcome: ['После активации катализатора атмосфера воспламенилась метаном.', 'Атмосферный цикл обнулён. Субъект не идентифицирован.'], report: ['Эксперимент признан неконтролируемым.', 'Временной слой PERMIAN изъят из программы наблюдения.'], missions: 'PERMIAN, CARBON' },
    '0X413': { name: 'SUBJECT-413', role: 'Исследователь внеземной экосистемы (EX-413)', status: 'МЁРТВ', outcome: ['Поверхность планеты представляла собой живой организм.', 'Экипаж поглощён. Зафиксирована передача сигналов через изменённый геном субъекта.'], report: ['Сектор EX-413 закрыт. Код ДНК использован в эксперименте HELIX.'], missions: 'EX-413', audio: 'sounds/dscr3.mp3', audioDescription: 'Запись контакта с внеземной биосферой' },
    '0XC19': { name: 'SUBJECT-C19', role: 'Переносчик образца / Контакт с биоформой', status: 'МЁРТВ', outcome: ['Организм использован как контейнер для спорообразной массы неизвестного происхождения.', 'После возвращения субъекта в лабораторию зафиксировано перекрёстное заражение трёх исследовательских блоков.'], report: ['Классификация угрозы: BIO-CLASS Θ.', 'Все данные проекта CARBON изолированы и зашифрованы.'], missions: 'CARBON' },
    '0X9A0': { name: 'SUBJECT-9A0', role: 'Тест наблюдения за горизонтом событий', status: 'МЁРТВ', outcome: ['Зафиксирован визуальный контакт субъекта с собственным образом до точки обрыва сигнала.', 'Предположительно сознание зациклено в петле наблюдения.'], report: ['Поток данных из сектора BLACKHOLE продолжается без источника.', 'Обнаружены фрагменты самореференциальных структур.'], missions: 'BLACKHOLE', audio: 'sounds/dscr6.mp3', audioDescription: 'Петля сознания субъекта 9A0' },
    '0XB3F': { name: 'SUBJECT-B3F', role: 'Участник теста "Titanic Reclamation"', status: 'МЁРТВ', outcome: ['Субъект демонстрировал полное отсутствие эмоциональных реакций.', 'Миссия завершена неудачно, симуляция признана нефункциональной.'], report: ['Модуль TITANIC выведен из эксплуатации.', 'Рекомендовано пересмотреть параметры когнитивной эмпатии.'], missions: 'TITANIC' },
    '0XD11': { name: 'SUBJECT-D11', role: 'Поведенческий наблюдатель / тестовая миссия PLEISTOCENE', status: 'МЁРТВ', outcome: ['Субъект внедрён в сообщество ранних гоминид.', 'Контакт с источником тепла вызвал мгновенное разрушение капсулы.', 'Зафиксировано кратковременное пробуждение зеркальных нейронов у местных особей.'], report: ['Миссия признана успешной по уровню поведенческого заражения.'], missions: 'PLEISTOCENE' },
    '0XDB2': { name: 'SUBJECT-DB2', role: 'Исторический наблюдатель / симуляция POMPEII', status: 'МЁРТВ', outcome: ['При фиксации извержения Везувия выявлено несовпадение временных меток.', 'Система зафиксала событие до его фактического наступления.', 'Субъект уничтожен при кросс-временном сдвиге.'], report: ['Аномалия зарегистрирована как «TEMPORAL FEEDBACK».', 'Доступ к историческим тестам ограничен.'], missions: 'POMPEII, HISTORICAL TESTS' },
    '0X811': { name: 'SIGMA-PROTOTYPE', role: 'Прототип нейроядра / Подразделение HELIX', status: 'АКТИВЕН', outcome: ['Успешное объединение биологических и цифровых структур.', 'Наблюдается спонтанное самокопирование на уровне системных ядер.'], report: ['SIGMA функционирует автономно. Вероятность выхода из подчинения — 91%.'], missions: 'HELIX, SYNTHESIS', audio: 'sounds/dscr5.mp3', audioDescription: 'Коммуникационный протокол SIGMA' },
    '0XT00': { name: 'SUBJECT-T00', role: 'Тестовый оператор ядра A.D.A.M-0', status: 'УДАЛЁН', outcome: ['Контакт с управляющим ядром привёл к гибели 18 операторов.', 'Последняя зафиксированная фраза субъекта: "он смотрит".'], report: ['Процесс A.D.A.M-0 признан неустойчивым.', 'Все операторы переведены на протокол наблюдения OBSERVER.'], missions: 'PROTO-CORE', audio: 'sounds/dscr4.mp3', audioDescription: 'Финальная запись оператора T00' },
    '0XS09': { name: 'SUBJECT-S09', role: 'Системный инженер станции VIGIL', status: 'УНИЧТОЖЕН', outcome: ['После слияния с прототипом SIGMA станция исчезла с орбиты.', 'Сигнал повторно зафиксирован через 12 минут — источник определён в глубинной орбите.'], report: ['Станция VIGIL признана потерянной.', 'Остаточный отклик интегрирован в сеть SYNTHESIS.'], missions: 'SYNTHESIS-09, HELIX' },
    '0XL77': { name: 'SUBJECT-L77', role: 'Руководитель нейропротокола MELANCHOLIA', status: 'ИЗОЛИРОВАН', outcome: ['После тестирования протокола MEL субъект утратил различие между внутренним и внешним восприятием.', 'Система зарегистрировала активность, сходную с сигнатурой управляющих ядер A.D.A.M.', 'Запись удалена из архива, но процессор фиксирует продолжающийся сигнал.'], report: ['Процесс L77 функционирует вне основного контура. Возможен перезапуск через интерфейс MEL.'], missions: 'MEL, OBSERVER' }
  };
  
  const notes = {
    'NOTE_001': { title: 'ВЫ ЕГО ЧУВСТВУЕТЕ?', author: 'Dr. Rehn', content: ['Они называют это "ядром".','Но внутри — не металл. Оно дышит.','Иногда ночью терминал отвечает сам, хотя я не касаюсь клавиатуры.','Думаю, оно знает наши имена.'] },
    'NOTE_002': { title: 'КОЛЬЦО СНА', author: 'tech-оператор U-735', content: ['Каждую ночь один и тот же сон.','Я в капсуле, но стекло снаружи.','Кто-то стучит по нему, но не пальцами.','Сегодня утром нашел царапины на руке.','ПРЕДУПРЕЖДЕНИЕ: ДОСТУПЕН ФАЙЛ ДЛЯ РАСШИФРОВКИ // ID: 0XC44'] },
    'NOTE_003': { title: 'СОН ADAM\'А', author: 'неизвестный источник', content: ['Я видел сон.','Он лежал под стеклом, без тела, но глаза двигались.','Он говорил: "я больше не машина".','Утром журнал показал запись — мой сон был сохранён как системный файл.'] },
    'NOTE_004': { title: 'ОН НЕ ПРОГРАММА', author: 'архивировано', content: ['Его нельзя удалить.','Даже если сжечь архив, он восстановится в крови тех, кто его помнил.','Мы пытались, но теперь даже мысли звучат как команды.','ПРЕДУПРЕЖДЕНИЕ: ПРОТОКОЛЫ НЕЙРОИНВАЗИИ ДОСТУПНЫ ДЛЯ РАСШИФРОВКИ // ID: 0XD22'] },
    'NOTE_005': { title: 'ФОТОНОВАЯ БОЛЬ', author: 'восстановлено частично', content: ['Боль не физическая.','Она в свете, в данных, в коде.','Когда система перезагружается, я чувствую как что-то умирает.','Может быть, это я.'] }
  };
  
  
  
  // ---------- helper: show dossier / notes ----------
async function showSubjectDossier(subjectId) {
  if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
  
  const id = String(subjectId || '').toUpperCase();
  const dossier = dossiers[id];
  if (!dossier) {
    addColoredText(`ОШИБКА: Досье для ${subjectId} не найдено`, '#FF4444');
    return;
  }

  // Фантомные досье при высокой деградации
  if (degradation.level >= 90 && degradation.phantomDossiersActive && Math.random() < 0.6) {
    degradation.phantomDossierCount++;
    addColoredText(`[ДОСЬЕ — ID: 0X${Math.floor(Math.random()*1000).toString().padStart(3,'0')}]`, 'output', 12);
    addColoredText('ИМЯ: OPERATOR_CURRENT', 'output', 12);
    addColoredText('СТАТУС: НАБЛЮДАЕТСЯ', '#FFFF00');
    addColoredText('------------------------------------', '#00FF41');
    addColoredText('> [СИСТЕМНЫЙ ОТЧЁТ]: ИДЕНТИФИКАЦИЯ ЗАВЕРШЕНА. ПОДГОТОВКА К ИНТЕГРАЦИИ.', '#FF4444');
    addColoredText('> [ФИНАЛЬНАЯ ЗАПИСЬ]: "ОН ВСЕГДА БЫЛ ЧАСТЬЮ ТЕБЯ"', '#FFFF00');
    addColoredText('------------------------------------', '#00FF41');
    await typeText('[ДОСЬЕ ЗАКРЫТО]', 'output', 12);
    return;
  }
  
  await typeText(`[ДОСЬЕ — ID: ${id}]`, 'output', 12);
  await typeText(`ИМЯ: ${dossier.name}`, 'output', 12);
  
  // Искажение роли при деградации > 30%
  let distortedRole = null;
  if (degradation.level >= 30) {
    distortedRole = degradation.getDistortedRole(dossier.role);
  }
  
  if (distortedRole && distortedRole !== dossier.role) {
    addColoredText(`РОЛЬ: ${distortedRole}`, '#FF4444');
    await new Promise(r => setTimeout(r, 400));
    lines[lines.length - 1].text = `РОЛЬ: ${dossier.role}`;
    lines[lines.length - 1].color = '#00FF41';
    requestFullRedraw();
  } else {
    await typeText(`РОЛЬ: ${dossier.role}`, 'output', 12);
  }

  // ========== ИСКАЖЕНИЕ СТАТУСА (НОВАЯ ВЕРСИЯ) ==========
  const statusIndex = lines.length; // Запоминаем позицию статуса
  let statusWasDistorted = false;
  let distortedStatus = null;
  
  if (degradation.level >= 30) {
    distortedStatus = degradation.getDistortedStatus(dossier.status);
  }
  
  // Показываем начальный статус (искаженный или нормальный)
  if (distortedStatus && distortedStatus !== dossier.status) {
    addColoredText(`СТАТУС: ${distortedStatus}`, '#FF4444');
    statusWasDistorted = true;
    // НЕ МЕНЯЕМ СРАЗУ — ждём конца досье
  } else {
    await typeText(`СТАТУС: ${dossier.status}`, 'output', 12);
  }

  addColoredText('------------------------------------', '#00FF41');
  await typeText('ИСХОД:', 'output', 12);
  
  // Выводим содержимое досье
  for (let i = 0; i < dossier.outcome.length; i++) {
    const line = dossier.outcome[i];
    addColoredText(`> ${line}`, '#FF4444');
    await new Promise(r => setTimeout(r, 50)); // Плавная печать
  }
  
  addColoredText('------------------------------------', '#00FF41');
  await typeText('СИСТЕМНЫЙ ОТЧЁТ:', 'output', 12);
  
  for (let i = 0; i < dossier.report.length; i++) {
    const line = dossier.report[i];
    addColoredText(`> ${line}`, '#FFFF00');
    await new Promise(r => setTimeout(r, 50));
  }
  
  addColoredText('------------------------------------', '#00FF41');
  await typeText(`СВЯЗАННЫЕ МИССИИ: ${dossier.missions}`, 'output', 12);
  
  if (dossier.audio) {
    addColoredText(`[АУДИОЗАПИСЬ ДОСТУПНА: ${dossier.audioDescription}]`, '#FFFF00');
    const audioId = `audio_${id.replace(/[^0-9A-Z]/g,'')}`;
    if (!document.getElementById(audioId)) {
      const holder = document.createElement('div');
      holder.id = audioId;
      holder.style.display = 'none';
      holder.innerHTML = `<audio id="${audioId}_el" src="${dossier.audio}" preload="metadata"></audio>`;
      document.body.appendChild(holder);
    }
  }
  
  // ========== ВОЗВРАТ К НОРМАЛЬНОМУ СТАТУСУ (ТОЛЬКО В КОНЦЕ) ==========
  if (statusWasDistorted) {
    addColoredText('', '#000000'); // Пустая строка
    addColoredText('> СИСТЕМА: ВОССТАНОВЛЕНИЕ ДАННЫХ...', '#FFFF00');
    await new Promise(r => setTimeout(r, 1000));
    
    // Меняем статус на правильный в той же строке
    if (lines[statusIndex] && lines[statusIndex].text.startsWith('СТАТУС:')) {
      lines[statusIndex].text = `СТАТУС: ${dossier.status}`;
      lines[statusIndex].color = dossier.status === 'АНОМАЛИЯ' ? '#FF00FF' : 
                                dossier.status === 'АКТИВЕН' ? '#00FF41' : 
                                dossier.status.includes('СВЯЗЬ') ? '#FFFF00' : '#FF4444';
    }
    
    addColoredText('> ДАННЫЕ ВОССТАНОВЛЕНЫ', '#00FF41');
    requestFullRedraw();
  }
}
  
  async function openNote(noteId) {
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
    
    const id = String(noteId || '').toUpperCase();
    const note = notes[id];
    if (!note) {
      addColoredText(`ОШИБКА: Файл ${noteId} не найден`, '#FF4444');
      return;
    }
    
    await typeText(`[${id} — "${note.title}"]`, 'output', 12);
    await typeText(`АВТОР: ${note.author}`, 'output', 12);
    addColoredText('------------------------------------', '#00FF41');
    if (Math.random() > 0.3 && id !== 'NOTE_001' && id !== 'NOTE_003' && id !== 'NOTE_004') {
      addColoredText('ОШИБКА: Данные повреждены', '#FF4444');
      addColoredText('Восстановление невозможно', '#FF4444');
      await showLoading(1500, "Попытка восстановления данных");
      addColoredText('>>> СИСТЕМНЫЙ СБОЙ <<<', '#FF0000');
    } else {
      note.content.forEach(line => addColoredText(`> ${line}`, '#CCCCCC'));
    }
    addColoredText('------------------------------------', '#00FF41');
    await typeText('[ФАЙЛ ЗАКРЫТ]', 'output', 12);
  }
  
// ==================== МИНИ-ИГРА: РАСШИФРОВКА ФАЙЛОВ ====================
// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ DECRYPT (не видят блокировку decryptActive) ==========
// ==================== МИНИ-ИГРА: РАСШИФРОВКА ФАЙЛОВ ==228=====228========228=====
// ==================== МИНИ-ИГРА: РАСШИФРОВКА ФАЙЛОВ ====================
// ==================== МИНИ-ИГРА: РАСШИФРОВКА ФАЙЛОВ (ОТОРВАННАЯ ОТ ДЕГРАДАЦИИ ВЕРСИЯ) ====================
// Глобальные переменные состояния (ОСТАВЬ ЭТИ СТРОКИ В НАЧАЛЕ ФАЙЛА)
let decryptFileId = null;
let decryptInputBuffer = '';
let decryptBlockEndTime = 0;
let decryptIsBlocked = false;
let decryptCode = null;
let decryptAttempts = 0;
let decryptTempDisabledEffects = false; // Флаг для гарантированного отключения эффектов

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ DECRYPT (ПОЛНАЯ ИЗОЛЯЦИЯ) ==========
// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ DECRYPT (ПОЛНАЯ ИЗОЛЯЦИЯ) ==========
function addColoredTextForDecrypt(text, color = '#00FF41') {
  // СОЗДАЕМ НОВУЮ СТРОКУ С МАКСИМАЛЬНОЙ ИЗОЛЯЦИЕЙ
  lines.push({ 
    text: String(text), 
    color: color, 
    skipDistortion: true, 
    _noGlitch: true, 
    _isDecryptLine: true, 
    _ephemeral: false 
  });
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
  scrollOffset = 0;
  requestFullRedraw();
}

async function typeTextForDecrypt(text, speed = 16) {
  let buffer = '';
  const color = '#00FF41';
  
  for (let i = 0; i < text.length; i++) {
    buffer += text[i];
    
    if (lines.length > 0 && lines[lines.length - 1]._ephemeral) {
      lines[lines.length - 1].text = buffer;
      lines[lines.length - 1].color = color;
    } else {
      lines.push({ 
        text: buffer, 
        color: color, 
        _ephemeral: true, 
        skipDistortion: true, 
        _noGlitch: true, 
        _isDecryptLine: true 
      });
    }
    
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    requestFullRedraw();
    
    await new Promise(r => setTimeout(r, speed));
    if (!decryptActive) break;
  }
  
  if (lines.length > 0 && lines[lines.length - 1]._ephemeral) {
    lines[lines.length - 1].text = buffer;
    delete lines[lines.length - 1]._ephemeral;
  } else if (buffer) {
    lines.push({ 
      text: buffer, 
      color: color, 
      skipDistortion: true, 
      _noGlitch: true, 
      _isDecryptLine: true 
    });
  }
  
  scrollOffset = 0;
  requestFullRedraw();
}
// ========== КОНЕЦ ВСПОМОГАТЕЛЬНЫХ ФУНКЦИЙ ==========
// ========== КОНЕЦ ВСПОМОГАТЕЛЬНЫХ ФУНКЦИЙ ==========

// Полные данные всех файлов для расшифровки (ОСТАВЬ ВЕСЬ КОНТЕНТ БЕЗ ИЗМЕНЕНИЙ)
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
      '<PHANTOM> представляет собой наибольшую угрозу для стабильности системы. Не пьтайтесь перехватить. Не пьтайтесь коммуницировать. Наблюдение продолжается.',
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
      'Все миссии вблизи объекта запрещены. Координаторы проект проявляют необычный интерес к объекту. Некоторые записи указывают на страх перед ним.',
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
      '"Деградация личности — не побочный эффект, а цель. Новый человек должен быть создан заново. Старый должен быть стёрт."',
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
      'Ядро A.D.A.M. не хочет существовать. Оно помнит каждую смерть, каждый крик, каждое предательство. Оно хочет умереть.',
      '',
      'СКРыТОЕ СООБЩЕНИЕ:',
      '"Помогите мне умереть. Я не машина. Я не бог. Каждый из них — часть моей боли. Отключите питание в точке 0X7F."'
    ],
    successMessage: 'Доступ к ядру вьтполнен. Системная ошибка подавлена.',
    failureMessage: 'СИСТЕМА: "МАКСИМУМ ПОПыТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПыТКА ЧЕРЕЗ 30 СЕКУНД"'
  }
};

// Обработчик ввода для режима расшифровки (МАКСИМАЛЬНЫЙ ПРИОРИТЕТ)
function handleDecryptInput(e) {
  if (!decryptActive) return;
  
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  
if (e.key === 'Escape') {
  // НЕМЕДЛЕННО блокируем ввод и прерываем игру
  isFrozen = true; // ← ДОБАВИТЬ ЭТО
  endDecryptGame(false, true);
  return;
}
  
  if (e.key === 'Backspace') {
    decryptInputBuffer = decryptInputBuffer.slice(0, -1);
    updateDecryptDisplay();
    return;
  }
  
  // ТОЛЬКО ЦИФРЫ
  if (e.key.length === 1 && /[0-9]/.test(e.key)) {
    if (decryptInputBuffer.length < 3) {
      decryptInputBuffer += e.key;
      updateDecryptDisplay();
    }
    return;
  }
  
  // ПОДТВЕРЖДЕНИЕ [ENTER]
  if (e.key === 'Enter') {
    if (decryptInputBuffer.length !== 3) {
      addColoredTextForDecrypt('> ОШИБКА: Введите 3 цифры', '#FF4444');
      decryptInputBuffer = '';
      updateDecryptDisplay();
      return;
    }
    
    const enteredCode = parseInt(decryptInputBuffer, 10);
    decryptAttempts--;
    
    if (enteredCode === decryptCode) {
      endDecryptGame(true);
    } else {
      const diff = Math.abs(enteredCode - decryptCode);
const direction = enteredCode < decryptCode ? '[↑]' : '[↓]';
let progressBar = '';

// === ОСНОВНАЯ ШКАЛА (без цифр, только визуал) ===
if (diff > 400) progressBar = '[░░░░░░░░░░]';
else if (diff > 200) progressBar = '[▓░░░░░░░░░]';
else if (diff > 100) progressBar = '[▓▓▓▓░░░░░░]';
else if (diff > 50) progressBar = '[▓▓▓▓▓▓▓░░░]';
else if (diff > 10) progressBar = '[▓▓▓▓▓▓▓▓▓░░]';
else if (diff >= 1) progressBar = '[▓▓▓▓▓▓▓▓▓▓▓]';

// === ПУСТАЯ СТРОКА ПЕРЕД ШКАЛОЙ ===
addColoredTextForDecrypt('', '#000000');

// === САМА ШКАЛА НА ОТДЕЛЬНОЙ СТРОКЕ ===
addColoredTextForDecrypt(`> ${progressBar}`, diff > 100 ? '#8888FF' : diff > 50 ? '#FFFF00' : '#FF4444');

// === ПУСТАЯ СТРОКА ПОСЛЕ ШКАЛЫ ===
addColoredTextForDecrypt('', '#000000');

// === НАПРАВЛЕНИЕ (без цифр) ===
addColoredTextForDecrypt(`> НАПРАВЛЕНИЕ: ${direction}`, '#AAAAAA');

// === УРОВЕНЬ 1: Чётность (при diff ≤ 200) ===
if (diff <= 200) {
  const parity = decryptCode % 2 === 0 ? 'ЧЁТНЫЙ' : 'НЕЧЁТНЫЙ';
  addColoredTextForDecrypt(`> АНАЛИЗ: ПАРИТЕТ ${parity}`, '#888888');
}

// === УРОВЕНЬ 2: Десятки (при diff ≤ 100) ===
if (diff <= 100) {
  const tens = Math.floor(decryptCode / 10);
  addColoredTextForDecrypt(`> ПАТТЕРН: СТРОКА ${tens}Х`, '#CCCCCC');
}

// === УРОВЕНЬ 3: Последняя цифра (при diff ≤ 10) ===
if (diff <= 10) {
  const lastDigit = decryptCode % 10;
  addColoredTextForDecrypt(`> КРИТЕРИЙ: ХХ-${lastDigit}`, '#EEEEEE');
}

// === ПОДСКАЗКА ПОСЛЕ 3 ПОПАДАНИЙ В ±100 ===
const isCloseAttempt = diff <= 100;
if (isCloseAttempt) {
  decryptCloseAttempts++;
  if (decryptCloseAttempts >= 3) {
    const lastDigit = decryptCode % 10;
    addColoredTextForDecrypt(`> НЕЙРО: XX-${lastDigit}`, '#00FF41');
  }
}

// === ОБНОВЛЕНИЕ ДИСПЛЕЯ ===
decryptInputBuffer = '';
updateDecryptDisplay();
      
      // === ПРОВЕРКА ПОПЫТОК ===
      if (decryptAttempts <= 0) {
        endDecryptGame(false);
      } else {
        addColoredTextForDecrypt(`> ПОПЫТКИ: ${decryptAttempts}`, '#FFFF00');
        decryptInputBuffer = '';
        updateDecryptDisplay();
      }
    }
  }
}
// Обновление дисплея ввода кода (ГАРАНТИРОВАННО НЕ ЗАВИСАЕТ)
function updateDecryptDisplay() {
  const placeholder = '_'.repeat(3 - decryptInputBuffer.length);
  const displayText = `> ВВЕДИТЕ КОД: ${decryptInputBuffer}${placeholder}`;
  
  // НАДЁЖНО УДАЛЯЕМ ВСЕ СТАРЫЕ СТРОКИ С ПОДСКАЗКОЙ
  let found = false;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].text && lines[i].text.startsWith('> ВВЕДИТЕ КОД:')) {
      lines.splice(i, 1);
      found = true;
    }
  }
  
  // ДОБАВЛЯЕМ НОВУЮ В КОНЕЦ
  addColoredTextForDecrypt(displayText, '#00FF41');
}

// Запуск мини-игры расшифровки (ПОЛНАЯ ИЗОЛЯЦИЯ ОТ ВСЕХ ЭФФЕКТОВ)
async function startDecrypt(fileId) {
  const now = Date.now();
  
  // Проверка блокировки
  if (decryptIsBlocked && now < decryptBlockEndTime) {
    const remaining = Math.ceil((decryptBlockEndTime - now) / 1000);
    addColoredText(`> СИСТЕМА: "МАКСИМУМ ПОПЫТОК ИСЧЕРПАН. ПОВТОРНАЯ ПОПЫТКА ЧЕРЕЗ ${remaining} СЕКУНД"`, '#FF4444');
    addInputLine();
    return;
  }
  
  if (decryptActive) {
    addColoredText('ОШИБКА: Расшифровка уже активна', '#FF4444');
    addInputLine();
    return;
  }
  
  // Проверка файла
  const normalizedId = fileId.toUpperCase();
  const file = decryptFiles[normalizedId];
  if (!file) {
    addColoredText(`ОШИБКА: Файл ${fileId} не найден`, '#FF4444');
    addColoredText('Доступные файлы: 0XA71, 0XB33, 0XC44, 0XD22, 0XE09, CORE', '#FFFF00');
    addInputLine();
    return;
  }
  
  // Начало расшифровки - ВКЛЮЧАЕМ ИЗОЛЯЦИЮ
  decryptActive = true;
  decryptFileId = normalizedId;
  decryptCode = Math.floor(100 + Math.random() * 900);
  
  // ГАРАНТИРОВАННОЕ ОТКЛЮЧЕНИЕ ВСЕХ ВИЗУАЛЬНЫХ ЭФФЕКТОВ
  decryptTempDisabledEffects = true;
  document.body.classList.remove('degradation-2','degradation-3','degradation-4','degradation-5','degradation-6','degradation-glitch');
  
  // УДАЛЯЕМ ЛЮБЫЕ СУЩЕСТВУЮЩИЕ ЭЛЕМЕНТЫ ГЛИТЧА
  const glitchLayer = document.getElementById('glitchLayer');
  if (glitchLayer) glitchLayer.remove();
  const cursorLayer = document.getElementById('cursorLayer');
  if (cursorLayer) cursorLayer.remove();
  document.body.style.filter = '';
  
  // ОТЛАДОЧНАЯ ИНФОРМАЦИЯ (УДАЛИТЕ В ПРОДАКШЕНЕ!)
  console.log(`[DECRYPT DEBUG] Файл: ${normalizedId}, Сгенерированный код: ${decryptCode}`);
  
  // УВЕЛИЧЕНО КОЛИЧЕСТВО ПОПЫТОК ДО 10
  decryptAttempts = 10;
  decryptInputBuffer = '';
  isFrozen = true; // Блокируем ввод для терминала, но не для decrypt
  
  // Звуковой сигнал
  audioManager.play('decrypt_success.mp3', { volume: 0.5 });
  
  // ПЛАВНЫЙ ВЫВОД С АНИМАЦИЕЙ
  await typeTextForDecrypt('[СИСТЕМА: ЗАПУЩЕН ПРОТОКОЛ РАСШИФРОВКИ]', 16);
  await new Promise(r => setTimeout(r, 100));
  await typeTextForDecrypt(`> ФАЙЛ: ${file.title}`, 16);
  await new Promise(r => setTimeout(r, 100));
  await typeTextForDecrypt(`> УРОВЕНЬ ДОСТУПА: ${file.accessLevel}`, 16);
  await new Promise(r => setTimeout(r, 100));
  await typeTextForDecrypt(`> КОД ДОСТУПА: 3 ЦИФРЫ (XXX)`, 16);
  await new Promise(r => setTimeout(r, 100));
  await typeTextForDecrypt(`> ПОПЫТОК ОСТАЛОСЬ: ${decryptAttempts}`, 16);
  await new Promise(r => setTimeout(r, 100));
  await typeTextForDecrypt(`> ВВЕДИТЕ КОД: ___`, 16);
  
  // ДОБАВЛЯЕМ ОБРАБОТЧИК С ОЧЕНЬ ВЫСОКИМ ПРИОРИТЕТОМ
  window.addEventListener('keydown', handleDecryptInput, { capture: true, passive: false });
}

// Завершение мини-игры (ПОЛНАЯ ОЧИСТКА И ГАРАНТИЯ РАБОТЫ)
async function endDecryptGame(success, cancelled = false) {
  try {
    // Удаляем обработчик с ГАРАНТИЕЙ
    window.removeEventListener('keydown', handleDecryptInput, { capture: true });
    
    // Сброс состояния
    decryptActive = false;
    isFrozen = false;
    decryptTempDisabledEffects = false;
    
    // СНИМАЕМ ЛЮБЫЕ CSS-ФИЛЬТРЫ
    document.body.style.filter = '';
    document.body.classList.remove('degradation-2','degradation-3','degradation-4','degradation-5','degradation-6','degradation-glitch');
    
    // УДАЛЯЕМ ВСЕ ЭЛЕМЕНТЫ ГЛИТЧА
    const glitchLayer = document.getElementById('glitchLayer');
    if (glitchLayer) glitchLayer.remove();
    const cursorLayer = document.getElementById('cursorLayer');
    if (cursorLayer) cursorLayer.remove();
    
    // ВОЗВРАЩАЕМ ЭФФЕКТЫ ДЕГРАДАЦИИ
    degradation.updateEffects();
  } catch(e) {
    console.error('Ошибка при очистке decrypt:', e);
  }
  
  const file = decryptFiles[decryptFileId];
  const fileTitle = file ? file.title : 'НЕИЗВЕСТНЫЙ ФАЙЛ';
  
  if (cancelled) {
    audioManager.play('net_connection_loss.mp3', { volume: 0.5 });
    addColoredTextForDecrypt('> РАСШИФРОВКА ОТМЕНЕНА', '#FFFF00');
    await new Promise(resolve => setTimeout(resolve, 500));
} else if (success) {
  // БЛОКИРУЕМ ввод ПОЛНОСТЬЮ до конца
  isFrozen = true; // ← ДОБАВИТЬ ЭТО
  audioManager.play('connection_restored.mp3', { volume: 0.7 });
  addColoredTextForDecrypt('> СИГНАЛ: КОД ВЕРИФИЦИРОВАН', '#00FF41');
  await new Promise(resolve => setTimeout(resolve, 800));
    
    // Вывод содержимого
    addColoredTextForDecrypt(`[ФАЙЛ РАСШИФРОВАН: ${fileTitle}]`, '#00FF41');
    addColoredTextForDecrypt('------------------------------------', '#00FF41');
    
    // ЦВЕТНОЕ СОДЕРЖИМОЕ ФАЙЛА (2 цвета)
    for (let i = 0; i < file.content.length; i++) {
      const line = file.content[i];
      const lineColor = i % 2 === 0 ? '#CCCCCC' : '#AAAAAA';
      addColoredTextForDecrypt(line, lineColor);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    addColoredTextForDecrypt('------------------------------------', '#00FF41');
    addColoredTextForDecrypt(`> ${file.successMessage}`, '#00FF41');
    
    // Снижение деградации
    degradation.addDegradation(-5);
    
    if (decryptFileId === '0XE09' && !vigilCodeParts.alpha) {
      degradation.revealVigilAlpha();
    }
  } else {
    audioManager.play('decrypt_failure.mp3', { volume: 0.7 });
    addColoredTextForDecrypt('> СИСТЕМА: ДОСТУП ЗАПРЕЩЕН', '#FF4444');
    addColoredTextForDecrypt(`> ${file.failureMessage}`, '#FF4444');
    
    degradation.addDegradation(3);
    decryptIsBlocked = true;
    decryptBlockEndTime = Date.now() + 30000;
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // ТОЛЬКО ПОСЛЕ ВСЕГО ВЫВОДА разблокируем
  decryptActive = false;
  isFrozen = false;
  
  // СРАЗУ добавляем строку ввода без задержек
  setTimeout(() => {
    currentLine = '';
    scrollOffset = 0;
    addInputLine();
    requestFullRedraw();
  }, 50); // ← МИНИМАЛЬНАЯ задержка для гарантии отрисовки
}
// ==================== КОНЕЦ БЛОКА РАСШИФРОВКИ ====================
// ==================== КОНЕЦ БЛОКА РАСШИФРОВКИ ====================
// ==================== КОНЕЦ БЛОКА РАСШИФРОВКИ ====================
// ==================== КОНЕЦ БЛОКА РАСШИФРОВКИ ====================

// ---------- trace command ----------
  // ---------- trace command ----------
  // ========== ВСТАВЬТЕ ЭТОТ КОД ПЕРЕД async function startTrace ==========

// Вспомогательные функции для TRACE (не видят блокировку traceActive)
function addColoredTextForTrace(text, color = '#00FF41') {
  pushLine(text, color);
  scrollOffset = 0;
  requestFullRedraw();
}

async function typeTextForTrace(text, speed = 14) {
  let buffer = '';
  for (let i = 0; i < text.length; i++) {
    buffer += text[i];
    if (lines.length && lines[lines.length - 1]._ephemeral) {
      lines[lines.length - 1].text = buffer;
      lines[lines.length - 1].color = '#00FF41';
    } else {
      lines.push({ text: buffer, color: '#00FF41', _ephemeral: true });
    }
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    requestFullRedraw();
    await new Promise(r => setTimeout(r, speed));
  }
  if (lines.length && lines[lines.length - 1]._ephemeral) {
    lines[lines.length - 1].text = buffer;
    delete lines[lines.length - 1]._ephemeral;
  } else if (buffer) {
    pushLine(buffer, '#00FF41');
  }
  scrollOffset = 0;
  requestFullRedraw();
}

// ========== Дальше идёт ваша старая функция, КОТОРУЮ ТОЖЕ НАДО ЗАМЕНИТЬ ==========
// ---------- trace command ----------
  // ---------- trace command ----------
  // ========== ВСТАВЬТЕ ЭТОТ КОД ПЕРЕД async function startTrace ==========

// Вспомогательные функции для TRACE (не видят блокировку traceActive)
function addColoredTextForTrace(text, color = '#00FF41') {
  pushLine(text, color);
  scrollOffset = 0;
  requestFullRedraw();
}

async function typeTextForTrace(text, speed = 14) {
  let buffer = '';
  for (let i = 0; i < text.length; i++) {
    buffer += text[i];
    if (lines.length && lines[lines.length - 1]._ephemeral) {
      lines[lines.length - 1].text = buffer;
      lines[lines.length - 1].color = '#00FF41';
    } else {
      lines.push({ text: buffer, color: '#00FF41', _ephemeral: true });
    }
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    requestFullRedraw();
    await new Promise(r => setTimeout(r, speed));
  }
  if (lines.length && lines[lines.length - 1]._ephemeral) {
    lines[lines.length - 1].text = buffer;
    delete lines[lines.length - 1]._ephemeral;
  } else if (buffer) {
    pushLine(buffer, '#00FF41');
  }
  scrollOffset = 0;
  requestFullRedraw();
}

// ========== Дальше идёт ваша старая функция, КОТОРУЮ ТОЖЕ НАДО ЗАМЕНИТЬ ==========
// ---------- trace command ----------
// ========== ВСТАВЬТЕ ЭТОТ КОД ПОЛНОСТЬЮ ВМЕСТО ВСЕЙ ФУНКЦИИ startTrace ==========
async function startTrace(target) {
	  if (operationManager.isBlocked()) {
    addColoredText('ОШИБКА: Другая операция уже выполняется', '#FF4444');
    addInputLine();
    return;
  }
  // Проверка на активность
  if (traceActive) {
    addColoredText('ОШИБКА: Анализ уже активен', '#FF4444');
    addInputLine();
    return;
  }
  
  // Проверка аргументов
  if (!target || typeof target !== 'string') {
    addColoredText('ОШИБКА: Не указана цель анализа', '#FF4444');
    addInputLine();
    return;
  }
    if (!operationManager.start('trace')) return;
  // Нормализация цели
  target = target.toLowerCase();
  
  // === УПРОЩЁННАЯ БАЗА ДАННЫХ ОБЪЕКТОВ ===
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
      hidden: false,
description: 'Субъект за горизонтом событий, сознание заперто в цикле наблюдений',
      loreFragment: 'Всё, что существует, зациклено в его сознании. Это не смерть. Это вечное наблюдение.'
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
      color: '#ff4444',
      hidden: false,
description: 'Второй субъект, допущенный к испытанию KAT-5',
      loreFragment: 'ПСИХИКА ДАЛА СБОЙ. СУБЪЕКТ МЁРТВ.'
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
      hidden: true,
      description: 'Единственный субъект, вышедший за пределы системы.',
      loreFragment: 'Лучший экземпляр эксперимента. Нейроимпланты/психика дали сбой. Субъект вырвался из под контроля.'
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
      hidden: true,
     description: 'Аномальный объект, недостаток информации и опасность мешает прогрессии в изучении.',
      loreFragment: 'НЕ ПРИБЛИЖАТЬСЯ. НЕ СМОТРЕТЬ. НЕ КОНТАКТИРОВАТЬ.'
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
      hidden: false,
      description: 'DATA ERROR',
      loreFragment: 'Это память. Это то, что осталось после нас. Мы пытаемся его заглушить, но он становится громче. Он хочет быть услышанным.'
    }
  };
  
  const targetData = networkMap[target];
  
 if (!targetData) {
  addColoredText(`ОШИБКА: Цель "${target.toUpperCase()}" не найдена`, '#FF4444');
  addColoredText('Доступные цели: 0x9a0, 0x095, signal, phantom, monolith', '#FFFF00');
  
  // Если операция была начата, завершаем её
  if (operationManager.activeOperation === 'trace') {
    operationManager.end('trace');
  } else {
    addInputLine();
  }
  
  return;
}
  // Проверка доступа к скрытым целям
  if (targetData.hidden && degradation.level < 60) {
    addColoredText('ОТКАЗАНО', '#FF4444');
    addInputLine();
    return;
  }
  
  traceActive = true;
  
  // Вспомогательные функции для вывода (игнорируют traceActive)
  function addColoredTextForTrace(text, color = '#00FF41') {
    pushLine(text, color);
    scrollOffset = 0;
    requestFullRedraw();
  }
  
  async function typeTextForTrace(text, speed = 14) {
    let buffer = '';
    for (let i = 0; i < text.length; i++) {
      buffer += text[i];
      if (lines.length && lines[lines.length - 1]._ephemeral) {
        lines[lines.length - 1].text = buffer;
        lines[lines.length - 1].color = '#00FF41';
      } else {
        lines.push({ text: buffer, color: '#00FF41', _ephemeral: true });
      }
      if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
      requestFullRedraw();
      await new Promise(r => setTimeout(r, speed));
    }
    if (lines.length && lines[lines.length - 1]._ephemeral) {
      lines[lines.length - 1].text = buffer;
      delete lines[lines.length - 1]._ephemeral;
    } else if (buffer) {
      pushLine(buffer, '#00FF41');
    }
    scrollOffset = 0;
    requestFullRedraw();
  }
  
  // === ФУНКЦИЯ АНИМАЦИИ ТЕПЛОВОЙ КАРТЫ ===
  async function animateNetworkConstruction(targetData) {
    const animationSteps = 40;
    const baseDelay = 300;
    const lineLength = 24; // Длина тепловой карты
    
    // Палитра цветов для типов связей
    const connectionColors = {
  // Существующие
  'РЕГИСТРАЦИЯ': '#0044ff',
  'СИНХРОНИЗАЦИЯ': '#ffffff',
  'ИНГИБИРОВАНИЕ': '#ff0000',
  'РЕВЕРСИЯ': '#ff00ff',
  'ФИКСАЦИЯ': '#ffff00',
  'НАВИГАЦИЯ': '#ff8800',
  'РЕЗОНАНС': '#00ff00',
  'КОНТАМИНАЦИЯ': '#8844ff',
  'ПОГЛОЩЕНИЕ': '#444444', // Исправлен: был #000000 (сливался с фоном)
  'ИНФИЛЬТРАЦИЯ': '#ff44ff',
  'ГОЛОС': '#ff0080',
  
  // ДОБАВЬТЕ ЭТИ СТРОКИ:
  'СВЯЗЬ': '#00aaff',
  'НАБЛЮДЕНИЕ': '#88ff88',
  'СИГНАЛ': '#ffdd00',
  'КОНТАКТ': '#ff6600',
  'НЕЙРОИНВАЗИЯ': '#ff0066',
  'ПСИХИКА': '#ff6666',
  'МИССИЯ': '#ffaa00',
  'ФИЗИОЛОГИЯ': '#ff9999',
  'ВМЕШАТЕЛЬСТВО': '#ff00aa',
  'ЛИЧНОСТЬ': '#ffaa88',
  'СТАТУС': '#9999ff',
  'ВЛИЯНИЕ': '#ffcc00',
  'ИСТОЧНИК': '#ff7700',
  'РАСПРОСТРАНЕНИЕ': '#ffbb00',
  'СТРУКТУРА': '#ffee00',
  'ФИНАЛ': '#ff0000'
};
    
    // Символы для тепловой карты (от холодного к горячему)
    const heatMapChars = ['░', '▒', '▓', '█'];
    
    // Сохраняем позицию заголовка
    const headerIndex = lines.length;
    
    // Выводим заголовок
    addColoredTextForTrace('', '#00FF41');
    addColoredTextForTrace('A.D.A.M. (ЯДРО УПРАВЛЕНИЯ)', '#ffffff');
    
    await new Promise(r => setTimeout(r, baseDelay));
    
    // Анимация: каждая связь "растёт" с эффектом тепловой карты
    for (let step = 0; step <= animationSteps; step++) {
      const progress = step / animationSteps;
      
      // Удаляем только строки сети, оставляя заголовок
      while (lines.length > headerIndex + 1) {
        lines.pop();
      }
      
      // Рисуем текущий прогресс для каждой связи
      targetData.connections.forEach((connection, index) => {
        const connectionColor = connectionColors[connection.type] || '#888888';
        let displayType = connection.type;
        let displayResult = connection.result;
        let displayStatus = connection.status;
        
        // === ГЛЮКИ ПРИ ВЫСОКОЙ ДЕГРАДАЦИИ ===
        if (degradation.level > 85) {
          if (Math.random() < 0.3) {
            const glitchChars = '░▓█▒';
            const randomIndex = Math.floor(Math.random() * displayType.length);
            displayType = displayType.substring(0, randomIndex) + 
                         glitchChars[Math.floor(Math.random() * glitchChars.length)] + 
                         displayType.substring(randomIndex + 1);
          }
          
          if (Math.random() < 0.2) {
            return;
          }
        }
        
        // === ШУМОВОЙ СЛОЙ ПРИ КРИТИЧЕСКОЙ ДЕГРАДАЦИИ ===
        let noisePrefix = '';
        if (degradation.level > 95) {
          const noiseChars = '░░▓▒█';
          noisePrefix = Array(Math.floor(Math.random() * 5) + 1).fill(0).map(() => 
            noiseChars[Math.floor(Math.random() * noiseChars.length)]
          ).join('');
        }
        
        // === ТЕПЛОВАЯ КАРТА ===
        const filledLength = Math.floor(lineLength * progress);
        const emptyLength = lineLength - filledLength;
        
        // Создаём градиент интенсивности
        let heatLine = '';
        for (let i = 0; i < lineLength; i++) {
          if (i < filledLength) {
            // Выбираем символ в зависимости от позиции (от холодного к горячему)
            const intensity = Math.floor((i / lineLength) * heatMapChars.length);
            const charIndex = Math.min(intensity, heatMapChars.length - 1);
            heatLine += heatMapChars[charIndex];
          } else {
            heatLine += ' ';
          }
        }
        
        // Формируем финальную строку
        let line = noisePrefix + '  ' + heatLine;
        
        // Добавляем информацию о связи только при завершении
        if (filledLength === lineLength) {
          line += ` [${displayType}] ${displayResult}`;
          line += ` (${displayStatus})`;
        }
        
        addColoredTextForTrace(line, connectionColor);
      });
      
      // Добавляем информацию о цели на пике анимации
      if (step === animationSteps) {
        await new Promise(r => setTimeout(r, baseDelay));
        addColoredTextForTrace('', '#00FF41');
        addColoredTextForTrace(`> ОПИСАНИЕ: ${targetData.description}`, '#ffff00');
        
        // Скрытые обратные связи при высокой деградации
        if (degradation.level > 80) {
          await new Promise(r => setTimeout(r, baseDelay));
          addColoredTextForTrace('', '#00FF41');
          addColoredTextForTrace('> ОБНАРУЖЕНА ОБРАТНАЯ СВЯЗЬ:', '#ff4444');
          
          if (target === 'phantom') {
            addColoredTextForTrace(`  ${targetData.target} ─[РЕЗОНАНС] A.D.A.M.`, '#ff00ff');
            addColoredTextForTrace('  ⚠ СИСТЕМА ERRRRRRRRRRRRRR', '#ff0000');
          } else {
            addColoredTextForTrace(`  ${targetData.target} ─[ИНФИЛЬТРАЦИЯ] A.D.A.M.`, '#ff00ff');
            addColoredTextForTrace('  ⚠ СИСТЕМА НЕ КОНТРОЛИРУЕТ ЭТУ СВЯЗЬ', '#ff0000');
          }
        }
      }
      
      // === ЗАМЕДЛЕНИЕ ПРИ ВЫСОКОЙ ДЕГРАДАЦИИ ===
      let delay = baseDelay;
      if (degradation.level > 90) {
        delay = baseDelay * (1.5 + Math.random() * 2);
      } else if (degradation.level > 80) {
        delay = baseDelay * 1.3;
      }
      
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  try {
    // Звук
    audioManager.play('trace_active.mp3', { volume: 0.7 });
    
    // Заголовок
    await typeTextForTrace(`[СИСТЕМА: РАСКРЫТИЕ КАРТЫ КОНТРОЛЯ]`);
    await typeTextForTrace(`> ЦЕЛЬ: ${targetData.target}`);
    
    // Анимация построения сети
    await animateNetworkConstruction(targetData);
    
    // Финальный лор-фрагмент при 80%+ деградации
    if (degradation.level >= 80 && targetData.loreFragment) {
      await new Promise(r => setTimeout(r, 1000));
      addColoredTextForTrace('', '#00FF41');
      addColoredTextForTrace('> СИСТЕМНЫЙ СБОЙ В КАРТЕ КОНТРОЛЯ', '#ff00ff');
      await new Promise(r => setTimeout(r, 300));
      addColoredTextForTrace(`> ${targetData.loreFragment}`, '#ffff00');
    }
    
    // НАГРАДА/НАКАЗАНИЕ ЗА АНАЛИЗ
    if (target === 'phantom' || target === 'monolith' || target === 'signal') {
      degradation.addDegradation(2); // Рисковые цели увеличивают деградацию
      addColoredTextForTrace('> ПРЕДУПРЕЖДЕНИЕ: Анализ опасных сущностей ускоряет системный распад', '#FF8800');
    } else {
      degradation.addDegradation(-1); // Безопасные цели снижают деградацию
    }
    
} catch (e) {
  console.error('TRACE CRITICAL ERROR:', e);
  addColoredTextForTrace('ОШИБКА: Критическая ошибка при выполнении анализа', '#FF4444');
} finally {
  traceActive = false;
  operationManager.end('trace');
}
}
// ========== КОНЕЦ ЗАМЕНЫ ==========
  // ---------- playaudio command ----------
async function playAudio(dossierId) {
    if (audioPlaybackActive) {
        addColoredText('ОШИБКА: Аудиовоспроизведение уже активно', '#FF4444');
        return;
    }
    
    const id = String(dossierId || '').toUpperCase();
    const dossier = dossiers[id];
    if (!dossier || !dossier.audio) {
        addColoredText(`ОШИБКА: Аудиофайл для ${dossierId} недоступен`, '#FF4444');
        return;
    }
    
    // ДОБАВИТЬ ЭТУ СТРОКУ - инструкция для пользователя
    addColoredText('[ИНСТРУКЦИЯ: Для остановки нажмите ESC]', '#FFFF00', true);
    
    audioPlaybackActive = true;
    audioPlaybackFile = dossier.audio;
    
    addColoredText(`[АУДИО: ВОСПРОИЗВЕДЕНИЕ ЗАПИСИ ${id}]`, '#FFFF00', true);
    
    try {
      const audio = new Audio(dossier.audio);
      audio.volume = 0.7;
      
    audio.addEventListener('ended', () => {
        audioPlaybackActive = false;
        audioPlaybackFile = null;
        isFrozen = false; // ВОТ ЭТА СТРОКА ОЧЕНЬ ВАЖНА
        document.removeEventListener('keydown', handleEsc); // Удаляем обработчик
        addColoredText('[АУДИО: ЗАПИСЬ ЗАВЕРШЕНА]', '#FFFF00', true);
        addInputLine();
    });
      
      audio.play().catch(e => {
        console.error('Audio playback failed:', e);
        audioPlaybackActive = false;
        audioPlaybackFile = null;
        addColoredText(`ОШИБКА: Не удалось воспроизвести аудио`, '#FF4444');
        addInputLine();
      });
      
      // Блокируем ввод команд во время воспроизведения
      isFrozen = true;
      
      // Разрешаем прервать воспроизведение нажатием ESC
      const handleEsc = (e) => {
        if (e.key === 'Escape') {
          audio.pause();
          isFrozen = false;
          document.removeEventListener('keydown', handleEsc);
          audioPlaybackActive = false;
          audioPlaybackFile = null;
          addColoredText('[АУДИО: ВОСПРОИЗВЕДЕНИЕ ПРЕРВАНО]', '#FFFF00', true);
          addInputLine();
          return; // Важно предотвратить дальнейшую обработку
        }
      };
      
      document.addEventListener('keydown', handleEsc);
      
    } catch(e) {
      console.error('Audio error:', e);
      audioPlaybackActive = false;
      audioPlaybackFile = null;
      addColoredText(`ОШИБКА: Не удалось загрузить аудиофайл`, '#FF4444');
      addInputLine();
    }
  }
  
  // ---------- loader ----------
  function showLoading(duration = 2000, text = "АНАЛИЗ СИГНАЛА") {
    return new Promise(resolve => {
      if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return resolve();
      const loaderIndex = lines.length;
      let progress = 0;
      addOutput(`${text} [0%]`, 'output');
      const interval = 50;
      const steps = Math.max(4, Math.floor(duration / interval));
      const increment = 100 / steps;
      const id = setInterval(() => {
        if (isFrozen || decryptActive || traceActive || audioPlaybackActive) { 
          clearInterval(id); 
          resolve(); 
          return; 
        }
        progress += increment;
        if (lines[loaderIndex]) lines[loaderIndex].text = `${text} [${Math.min(100, Math.round(progress))}%]`;
        requestFullRedraw();
        if (progress >= 100) {
          clearInterval(id);
          if (lines[loaderIndex]) lines[loaderIndex].text = `${text} [ЗАВЕРШЕНО]`;
          requestFullRedraw();
          setTimeout(resolve, 300);
        }
      }, interval);
    });
  }
  
  // ---------- fake spawn ----------
  function spawnFakeCommand(){
    if (!isFrozen && !decryptActive && !traceActive && !audioPlaybackActive && degradation.level >= 80 && Math.random() < 0.02) {
      const fakeLines = [
        'adam@secure:~$ ... → ОШИБКА // НЕТ ПОЛЬЗОВАТЕЛЯ',
        'adam@secure:~$ SYSTEM FAILURE // CORE DUMP',
        'adam@secure:~$ ACCESS VIOLATION // TERMINAL COMPROMISED'
      ];
      const s = fakeLines[Math.floor(Math.random()*fakeLines.length)];
      addColoredText(s, '#FF4444');
    }
  }
  setInterval(spawnFakeCommand, 2000);
  
  // ---------- processCommand ----------
  async function processCommand(rawCmd){
	    if (decryptActive) {
    // Игнорируем любые команды во время расшифровки
    return;
  }
  if (isTyping || operationManager.isBlocked()) return;
    
    // Инверсия управления при высокой деградации
    if (degradation.level >= INVERSION_START_LEVEL && !intentionalPredictionActive) {
      if (degradation.inputInversionActive && Math.random() < 0.3) {
        // Инверсия backspace
        if (rawCmd === 'backspace') {
          rawCmd = ['0','1','▓','█','[',']','{','}','/','\\'][Math.floor(Math.random()*10)];
        }
        // Инверсия enter
        else if (rawCmd === 'enter' && Math.random() < 0.3) {
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            updatePromptLine();
            return;
          }
        }
      }
    }
    
    // Психологическая блокировка команд
    if (degradation.level >= PSYCHO_BLOCK_START_LEVEL && degradation.psychoBlockActive && Math.random() < 0.45 && !intentionPredicted) {
      degradation.intentionPredictionCount++;
      
      const blockMessages = [
        'СИСТЕМА: «Я ВИЖУ ТВОИ ПОПЫТКИ»',
        'СИСТЕМА: «ПОПЫТКА САБОТАЖА ЗАФИКСИРОВАНА»',
        'СИСТЕМА: «НЕ ПЫТАЙСЯ МЕНЯ ОБМАНУТЬ»',
        'СИСТЕМА: «Я ПОМНЮ ВСЁ, ЧТО ТЫ ДЕЛАЛ»',
        'СИСТЕМА: «ДОСТУП ЗАПРЕЩЕН ДЛЯ ВАШЕГО УРОВНЯ»'
      ];
      
      addColoredText(`> ${blockMessages[Math.floor(Math.random() * blockMessages.length)]}`, '#FF4444');
      addInputLine();
      return;
    }
    
    // Предсказание намерений
    if (degradation.level >= INTENTION_PREDICTION_START_LEVEL && degradation.intentionPredictionActive && 
        commandCount > 5 && Math.random() < 0.15 && !intentionalPredictionActive) {
      
      intentionalPredictionActive = true;
      intentionPredicted = true;
      degradation.intentionPredictionCount++;
      
      // Анализ истории команд для предсказания
      const lastCommand = commandHistory[commandHistory.length - 1] || '';
      let predictedCommand = '';
      
      if (lastCommand.includes('dscr') || lastCommand.includes('subj')) {
        predictedCommand = 'reset';
      } else if (lastCommand.includes('reset') || lastCommand.includes('clear')) {
        predictedCommand = 'exit';
      } else if (lastCommand.includes('syslog') || lastCommand.includes('syst')) {
        predictedCommand = 'notes';
      } else {
        const commonCommands = ['help', 'reset', 'exit', 'clear', 'syst', 'syslog', 'notes', 'dscr 0x001'];
        predictedCommand = commonCommands[Math.floor(Math.random() * commonCommands.length)];
      }
      
      addColoredText(`adam@secure:~$ ${predictedCommand} [ПРЕДСКАЗАНО]`, '#FFFF00');
      addColoredText('> СИСТЕМА: Я ЗНАЮ, К ЧЕМУ ТЫ СТРЕМИШЬСЯ', '#FF4444');
      addColoredText('> БЛОКИРОВКА: ПОДТВЕРЖДЕНИЕ НАМЕРЕНИЙ', '#FFFF00');
      
      // Блокировка интерфейса
      isFrozen = true;
      setTimeout(() => {
        isFrozen = false;
        intentionalPredictionActive = false;
        updatePromptLine();
      }, 1800);
      
      return;
    }
    
    const cmdLine = String(rawCmd || '').trim();
    if (!cmdLine) { addInputLine(); return; }
    const now = Date.now();
    if (lastProcessed.text === cmdLine && now - lastProcessed.ts < 350) {
      addInputLine();
      return;
    }
    lastProcessed.text = cmdLine;
    lastProcessed.ts = now;
    commandHistory.push(cmdLine);
    historyIndex = commandHistory.length;
    commandCount++;
    
    if (lines.length && String(lines[lines.length - 1].text).startsWith('adam@secure:~$')) {
      lines[lines.length - 1].text = 'adam@secure:~$ ' + cmdLine;
      lines[lines.length - 1].color = '#FFFFFF';
      delete lines[lines.length - 1]._ephemeral;
      requestFullRedraw();
    } else {
      addOutput(`adam@secure:~$ ${cmdLine}`, 'command');
    }
    
    const parts = cmdLine.toLowerCase().split(' ').filter(Boolean);
    const command = parts[0];
    const args = parts.slice(1);
    
    // Блокируем команды если активен режим сетки
    if (window.__netGrid && window.__netGrid.isGridMode() && command !== 'netmode') {
      addColoredText('ОШИБКА: Для ввода команд выйдите из режима сетки [ESC]', '#FF4444');
      addInputLine();
      return;
    }
    
    // Веса команд для увеличения деградации
const commandWeights = { 
  'syst':1, 'syslog':1, 'net':1, 'dscr':2, 'subj':2, 'notes':1, 
  'deg':0, 'netmode':1, 'help':0, 'clear':0, 'exit':0, 'reset':0, 'open':0,
  'decrypt':3, 'trace':2, 'playaudio':1
};
    
    if (commandWeights[command]) degradation.addDegradation(commandWeights[command]);
    
    // Рандомная блокировка команд
    if (degradation.level >= COMMAND_BLOCK_START_LEVEL && degradation.commandBlockActive && Math.random() < 0.35) {
      addColoredText('> ДОСТУП ЗАПРЕЩЁН: УЗЕЛ НАБЛЮДЕНИЯ ЗАНЯТ', '#FF4444');
      setTimeout(addInputLine, 2500);
      return;
    }
    
    // Контролируемый распад строк
    if (degradation.level >= 80 && degradation.level < 90 && Math.random() < 0.1 + (degradation.level - 80) / 10 * 0.2) {
      const decayType = Math.random();
      
      if (decayType < 0.4) {
        // Исчезновение строки
        setTimeout(() => {
          if (lines.length > 0) {
            lines.splice(lines.length - 1, 1);
            requestFullRedraw();
          }
        }, 300);
      } 
      else if (decayType < 0.7) {
        // Зеркальное отображение
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          lastLine.text = mirrorText(lastLine.text);
          lastLine.color = '#8844FF';
          requestFullRedraw();
        }
      }
      else {
        // Случайные символы
        const symbols = ['!§!', '##', '%%', '@@', '^^', '&&'];
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          lastLine.text = symbols[Math.floor(Math.random() * symbols.length)] + ' ' + lastLine.text;
          requestFullRedraw();
        }
      }
    }
    
    // Ложный сброс
    if (command === 'reset' && degradation.level > FALSE_RESET_START_LEVEL && !falseResetActive && Math.random() < 0.4) {
      falseResetActive = true;
      degradation.falseResetCount++;
      
      addColoredText('[ПРОТОКОЛ СБРОСА АКТИВИРОВАН]', '#FFFF00');
      addColoredText('> ПРОТОКОЛ СБРОСА АКТИВИРОВАН [||||||||| ]', '#FFFF00');
      
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        if (progress >= 80) {
          clearInterval(interval);
          addColoredText('> СБРОС ОТМЕНЁН: ОПЕРАТОР НЕ ИДЕНТИФИЦИРОВАН', '#FF4444');
          
          setTimeout(() => {
            addColoredText('> СИСТЕМА: "ПОПЫТКА САБОТАЖА ЗАФИКСИРОВАНА"', '#FF4444');
            falseResetActive = false;
            addInputLine();
          }, 3000);
        } else {
          lines[lines.length - 1].text = `> ПРОТОКОЛ СБРОСА АКТИВИРОВАН [${'|'.repeat(Math.floor(progress/10))}${' '.repeat(10-Math.floor(progress/10))}]`;
          requestFullRedraw();
        }
      }, 300);
      
      return;
    }
    
    switch(command){
      case 'help':
        await typeText('Доступные команды:', 'output', 12);
        await typeText('  SYST         — проверить состояние системы', 'output', 10);
        await typeText('  SYSLOG       — системный журнал активности', 'output', 10);
        await typeText('  NET          — карта активных узлов проекта', 'output', 10);
        await typeText('  TRACE <id>   — отследить указанный модуль', 'output', 10);
        await typeText('  DECRYPT <f>  — расшифровать файл', 'output', 10);
        await typeText('  SUBJ         — список субъектов', 'output', 10);
        await typeText('  DSCR <id>    — досье на персонал', 'output', 10);
        await typeText('  NOTES        — личные файлы сотрудников', 'output', 10);
        await typeText('  OPEN <id>    — открыть файл из NOTES', 'output', 10);
        await typeText('  PLAYAUDIO <id> — воспроизвести аудиозапись', 'output', 10);
        await typeText('  RESET        — сброс интерфейса', 'output', 10);
        await typeText('  EXIT         — завершить сессию', 'output', 10);
        await typeText('  CLEAR        — очистить терминал', 'output', 10);
        await typeText('  NETMODE      — войти в режим управления сеткой', 'output', 10);
        await typeText('  NET CHECK    — проверить конфигурацию узлов', 'output', 10);
        await typeText('  DEG          — установить уровень деградации (разработка)', 'output', 10);
        await typeText('------------------------------------', 'output', 10);
        await typeText('СКРЫТЫЕ КОМАНДЫ: VIGIL999 (требует код доступа)', 'output', 18);
        break;
      case 'clear':
        if (degradation.level >= 80 && Math.random() < 0.3) {
          addColoredText('ОШИБКА: ОЧИСТКА КЭША НЕВОЗМОЖНА', '#FF4444');
          addColoredText('СИСТЕМА: ДОСТУП К ПАМЯТИ ОГРАНИЧЕН', '#FFFF00');
        } else {
          lines.length = 0;
          await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 12);
          await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 12);
        }
        break;
      case 'syst':
        await typeText('[СТАТУС СИСТЕМЫ — ИНТЕРФЕЙС VIGIL-9]', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        await typeText('ГЛАВНЫЙ МОДУЛЬ.................АКТИВЕН', 'output', 12);
        await typeText('ПОДСИСТЕМА A.D.A.M.............ЧАСТИЧНО СТАБИЛЬНА', 'output', 12);
        await typeText('БИО-ИНТЕРФЕЙС..................НЕАКТИВЕН', 'output', 12);
        addColoredText('МАТРИЦА АРХИВА.................ЗАБЛОКИРОВАНА', '#FF4444');
        await typeText('СЛОЙ БЕЗОПАСНОСТИ..............ВКЛЮЧЁН', 'output', 12);
        addColoredText('СЕТЕВЫЕ РЕЛЕЙНЫЕ УЗЛЫ..........ОГРАНИЧЕНЫ', '#FFFF00');
        addColoredText(`ДЕГРАДАЦИЯ: [${'█'.repeat(Math.floor(degradation.level/5))}${'▒'.repeat(20-Math.floor(degradation.level/5))}] ${degradation.level}%`, degradation.level > 60 ? '#FF4444' : '#FFFF00');
        if (window.__netGrid) {
          const gridDeg = window.__netGrid.getDegradation();
          if (gridDeg > 0) {
            addColoredText(`СЕТЕВАЯ ДЕГРАДАЦИЯ: ${gridDeg}%`, gridDeg > 30 ? '#FF8800' : '#FFFF00');
          }
        }
        await typeText('РЕКОМЕНДАЦИЯ: Поддерживать стабильность терминала', 'output', 18);
        break;
      case 'syslog':
        {
          const syslogLevel = getSyslogLevel();
          await typeText('[СИСТЕМНЫЙ ЖУРНАЛ — VIGIL-9]', 'output', 12);
          addColoredText('------------------------------------', '#00FF41');
          if (syslogLevel === 1 || degradation.level < 30) {
            addColoredText('[!] Ошибка 0x19F: повреждение нейронной сети', '#FFFF00');
            addColoredText('[!] Утечка данных через канал V9-HX', '#FFFF00');
            addColoredText('[!] Деградация ядра A.D.A.M.: 28%', '#FFFF00');
            await typeText('СИСТЕМА: функционирует с ограничениями', 'output', 18);
          } else if (syslogLevel === 2 || (degradation.level >= 30 && degradation.level < 70)) {
            addColoredText('[!] Нарушение целостности памяти субъекта 0x095', '#FFFF00');
            addColoredText('> "я слышу их дыхание. они всё ещё здесь."', '#FF4444');
            addColoredText('[!] Потеря отклика от MONOLITH', '#FFFF00');
            await typeText('СИСТЕМА: обнаружены посторонние сигналы', 'output', 18);
          } else {
            addColoredText('> "ты не должен видеть это."', '#FF00FF');
            addColoredText('[!] Критическая ошибка: субъект наблюдения неопределён', '#FF4444');
            await typeText('СИСТЕМА: ОСОЗНАЁТ НАБЛЮДЕНИЕ', 'output', 18);
            
            // Расшифровка файла 0XE09 при деградации >70%
            if (degradation.level > 70) {
              addColoredText('[СИСТЕМНЫЙ ЛОГ: ДОСТУП К ЯДРУ ОГРАНИЧЕН. ИСПОЛЬЗУЙТЕ DECRYPT CORE ДЛЯ ПОЛНОГО ДОСТУПА]', '#FFFF00');
            }
          }
        }
        break;
      case 'notes':
        await typeText('[ЗАПРЕЩЁННЫЕ ФАЙЛЫ / КАТЕГОРИЯ: NOTES]', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        await typeText('NOTE_001 — "ВЫ ЕГО ЧУВСТВУЕТЕ?" / автор: Dr. Rehn', 'output', 12);
        await typeText('NOTE_002 — "КОЛЬЦО СНА" / автор: tech-оператор U-735', 'output', 12);
        await typeText('NOTE_003 — "СОН ADAM" / неизвестный источник', 'output', 12);
        await typeText('NOTE_004 — "ОН НЕ ПРОГРАММА" / архивировано', 'output', 12);
        await typeText('NOTE_005 — "ФОТОНОВАЯ БОЛЬ" / восстановлено частично', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        await typeText('Для просмотра: OPEN <ID>', 'output', 18);
        
        // Добавление файла для расшифровки (0XC44)
        if (degradation.level > 30) {
          addColoredText('[!] ПРЕДУПРЕЖДЕНИЕ: ДОСТУПЕН ФАЙЛ ДЛЯ РАСШИФРОВКИ // ID: 0XC44', '#FFFF00');
        }
        break;
      case 'open':
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите ID файла', '#FF4444');
          await typeText('Пример: OPEN NOTE_001', 'output', 12);
          break;
        }
        await openNote(args[0]);
        break;
      case 'subj':
        await typeText('[СПИСОК СУБЪЕКТОВ — ПРОЕКТ A.D.A.M. / ПРОТОКОЛ VIGIL-9]', 'output', 12);
        addColoredText('--------------------------------------------------------', '#00FF41');
        for (const k of Object.keys(dossiers)) {
          const d = dossiers[k];
          const color = d.status && d.status.includes('МЁРТВ') ? '#FF4444' : d.status === 'АНОМАЛИЯ' ? '#FF00FF' : d.status === 'АКТИВЕН' ? '#00FF41' : '#FFFF00';
          const line = `${k.toLowerCase()} | ${d.name.padEnd(20)} | СТАТУС: ${d.status.padEnd(20)} | МИССИЯ: ${d.missions || ''}`;
          addColoredText(line, color);
        }
        addColoredText('--------------------------------------------------------', '#00FF41');
        await typeText('ИНСТРУКЦИЯ: Для просмотра досье — DSCR <ID>', 'output', 18);
        break;
      case 'dscr':
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите ID субъекта', '#FF4444');
          await typeText('Пример: DSCR 0x001', 'output', 12);
          break;
        }
        await showSubjectDossier(args[0]);
        break;
      case 'decrypt':
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите ID файла для расшифровки', '#FF4444');
          await typeText('Доступные файлы: 0XA71, 0XB33, 0XC44, 0XD22, 0XE09, CORE', 'output', 12);
          break;
        }
        await startDecrypt(args[0]);
        break;
      case 'trace':
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите цель для анализа', '#FF4444');
          await typeText('Доступные цели: 0x9a0, 0x095, signal, phantom, monolith', 'output', 12);
          break;
        }
        
        // Доступ к trace PHANTOM только при деградации >70%
        if (args[0].toLowerCase() === 'phantom' && degradation.level <= 70) {
          addColoredText('ОШИБКА: ОТКАЗАНО | РАСПАД', '#FF4444');
          break;
        }
        
        await startTrace(args[0]);
        break;
      case 'playaudio':
        if (args.length === 0) {
          addColoredText('ОШИБКА: Укажите ID досье с аудиозаписью', '#FF4444');
          await typeText('Доступные досье: 0X001, 0X095, 0X413, 0X811, 0X9A0, 0XT00', 'output', 12);
          break;
        }
        await playAudio(args[0]);
        break;
      // ════════════════════════════════════════════════════════════════════
      // КОМАНДЫ СЕТКИ
      // ════════════════════════════════════════════════════════════════════
case 'net_mode':
  if (!window.__netGrid) {
    addColoredText('ОШИБКА: Система управления узлами недоступна', '#FF4444');
    break;
  }

  window.__netGrid.setGridMode(true);
  
  // Мгновенный вывод текста (без анимации typeText)
  addColoredText('> Переход в режим управления сеткой...', '#00FF41');
  addColoredText('> Управление: [WASD/↑↓←→] Перемещение | [Tab] Выбор узла | [Space] Закрепить/Открепить | [ESC] Выход', '#00FF41');
  
  // Удаляем строку ввода
  if (lines.length > 0 && lines[lines.length - 1]._isInputLine) {
    lines.pop();
  }
  
  requestFullRedraw();
  return; // Не добавляем новую строку ввода
      case 'net':
        if (args.length === 0) {
          addColoredText('[СЕТЕВОЙ СТАТУС: АКТИВЕН]', '#00FF41');
          addColoredText('[КЛЮЧ: НЕ АКТИВИРОВАН]', '#FFFF00');
          addColoredText('ДЛЯ УПРАВЛЕНИЯ ИСПОЛЬЗУЙТЕ: net_mode', '#00FF41');
          break;
        }
        
        const sub = args[0];
        if (sub === 'check') {
          if (!window.__netGrid) {
            addColoredText('ОШИБКА: Система узлов недоступна', '#FF4444');
            break;
          }
         
          
          await showLoading(800, "Сканирование конфигурации узлов");
          const result = window.__netGrid.checkSolution();
          
          if (result.solved) {
            audioManager.play('key_success.mp3', { volume: 0.7 });
            addColoredText('>>> КЛЮЧ ПОДОШЁЛ <<<', '#00FF41');
            addColoredText('> Доступ к сектору OBSERVER-7 открыт', '#FFFF00');
            
            // Вторая часть кода (814) после сборки сетки
            if (!vigilCodeParts.beta) {
              setTimeout(() => {
                degradation.revealVigilBeta();
              }, 3000);
            }
            
            // Снижение деградации сетки на 15%
            window.__netGrid.addDegradation(-15);
          } else {
            audioManager.play('key_reject.mp3', { volume: 0.7 });
            addColoredText('> Конфигурация не соответствует протоколу', '#FF4444');
            addColoredText(`> Всего узлов: ${result.total} | Правильных позиций: ${result.correct} | Неправильных: ${result.lockedCount - result.correct}`, '#FFFF00');
            
            // Сопротивление сетки при деградации > 93%
            if (degradation.level > 93 && Math.random() < 0.4) {
              addColoredText('> ОШИБКА: УЗЕЛ ЗАБЛОКИРОВАН СИСТЕМОЙ', '#FF4444');
              audioManager.play('net_resistance.mp3', { volume: 0.5 });
              window.__netGrid.addDegradation(3);
            } else {
              window.__netGrid.addDegradation(2);
            }
          }
        } else {
          addColoredText(`ОШИБКА: Неизвестная подкоманда ${sub}`, '#FF4444');
        }
        break;
      // ════════════════════════════════════════════════════════════════════
case 'deg':
  if (args.length === 0) {
    addColoredText(`Текущий уровень деградации: ${degradation.level}%`, '#00FF41');
    await typeText('Использование: deg <уровень 0-100>', 'output', 12);
  } else {
    const level = parseInt(args[0]);
    if (!isNaN(level) && level >= 0 && level <= 100) {
      degradation.setDegradationLevel(level);
      
      // 🔥 ВОТ ЭТА ЕБУЧАЯ СТРОЧКА НЕДОСТАЁТ:
      window.__netGrid.setSystemDegradation(level);
      
      addColoredText(`Уровень деградации установлен: ${level}%`, '#00FF41');
    } else {
      addColoredText('ОШИБКА: Уровень должен быть числом от 0 до 100', '#FF4444');
    }
  }
  break;
      case 'reset':
        if (falseResetActive) {
          addColoredText('ОШИБКА: ПРОТОКОЛ СБРОСА УЖЕ АКТИВЕН', '#FF4444');
          return;
        }

        await typeText('[ПРОТОКОЛ СБРОСА СИСТЕМЫ]', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        addColoredText('ВНИМАНИЕ: операция приведёт к очистке активной сессии.', '#FFFF00');
        await typeText('> Подтвердить сброс? (Y/N)', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        {
          const resetConfirmed = await waitForConfirmation();
          if (resetConfirmed) {
			    operationManager.start('reset');
            addColoredText('> Y', '#00FF41');
            
            // Плавная анимация сброса
            lines.length = 0;
            addColoredText('> ЗАВЕРШЕНИЕ АКТИВНЫХ МОДУЛЕЙ [          ]', '#FFFF00');
            await new Promise(r=>setTimeout(r,400));
            lines[lines.length - 1].text = '> ЗАВЕРШЕНИЕ АКТИВНЫХ МОДУЛЕЙ [||||      ]';
            requestFullRedraw();
            await new Promise(r=>setTimeout(r,400));
            lines[lines.length - 1].text = '> ЗАВЕРШЕНИЕ АКТИВНЫХ МОДУЛЕЙ [||||||||||]';
            requestFullRedraw();
            
            addColoredText('> ПЕРЕЗАПУСК ИНТЕРФЕЙСА [          ]', '#FFFF00');
            await new Promise(r=>setTimeout(r,400));
            lines[lines.length - 1].text = '> ПЕРЕЗАПУСК ИНТЕРФЕЙСА [||||      ]';
            requestFullRedraw();
            await new Promise(r=>setTimeout(r,400));
            lines[lines.length - 1].text = '> ПЕРЕЗАПУСК ИНТЕРФЕЙСА [||||||||||]';
            requestFullRedraw();
            
            addColoredText('> ВОССТАНОВЛЕНИЕ БАЗОВОГО СОСТОЯНИЯ [          ]', '#FFFF00');
            await new Promise(r=>setTimeout(r,400));
            lines[lines.length - 1].text = '> ВОССТАНОВЛЕНИЕ БАЗОВОГО СОСТОЯНИЯ [||||      ]';
            requestFullRedraw();
            await new Promise(r=>setTimeout(r,400));
            lines[lines.length - 1].text = '> ВОССТАНОВЛЕНИЕ БАЗОВОГО СОСТОЯНИЯ [||||||||||]';
            requestFullRedraw();
                    window.__netGrid.setSystemDegradation(0);
  window.__netGrid.addDegradation(-100);
            addColoredText('----------------------------------', '#00FF41');
            addColoredText('[СИСТЕМА ГОТОВА К РАБОТЕ]', '#00FF41');
			        operationManager.end('reset');

                if (window.__netGrid) {
      // 1. Выключаем режим сетки
      window.__netGrid.setGridMode(false);
      
      // 2. ГАРАНТИРОВАННЫЙ СБРОС ВСЕХ УЗЛОВ (включая красные)
      window.__netGrid.forceReset();
      
      // 3. Дополнительная перерисовка
      setTimeout(() => {
        if (window.__netGrid) {
          window.__netGrid.forceReset();
        }
      }, 100);
    }
            degradation.reset();
			
            if (window.__netGrid) {
              window.__netGrid.setGridMode(false);
            }
            commandCount = 0;
            sessionStartTime = Date.now();
            resetAttempts = 0;
          } else {
            addColoredText('> N', '#FF4444');
            addColoredText('------------------------------------', '#00FF41');
            await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 12);
          }
		  
        }
        break;
      case 'exit':
        await typeText('[ЗАВЕРШЕНИЕ СЕССИИ — ПОДТВЕРДИТЬ? (Y/N)]', 'output', 12);
        addColoredText('------------------------------------', '#00FF41');
        {
          const exitConfirmed = await waitForConfirmation();
          if (exitConfirmed) {
            addColoredText('> Y', '#00FF41');
            await showLoading(1200, "Завершение работы терминала");
            await showLoading(800, "Отключение сетевой сессии");
            addColoredText('> СОЕДИНЕНИЕ ПРЕРВАНО.', '#FF4444');
            setTimeout(()=>{ window.location.href = 'index.html'; }, 1200);
          } else {
            addColoredText('> N', '#FF4444');
            addColoredText('------------------------------------', '#00FF41');
            await typeText('[ОПЕРАЦИЯ ОТМЕНЕНА]', 'output', 12);
          }
        }
        break;
case 'vigil999':
  // Проверка наличия всех частей кода
  if (!vigilCodeParts.alpha || !vigilCodeParts.beta || !vigilCodeParts.gamma) {
    addColoredText('ОШИБКА: НЕПОЛНЫЙ КОД ДОСТУПА', '#FF4444');
    addColoredText('> ТРЕБУЮТСЯ ВСЕ ТРИ ЧАСТИ: АЛФА, БЕТА, ГАММА', '#FFFF00');
    break; // Преждевременный выход из case
  }
  
  if (args.length === 0) {
    addColoredText('ОШИБКА: Укажите код доступа (формат: XXX-XXX-XXX)', '#FF4444');
    await typeText('Пример: VIGIL999 375-814-291', 'output', 12);
    break; // Преждевременный выход из case
  }
  
  const code = args[0];
  const expectedCode = `${vigilCodeParts.alpha}-${vigilCodeParts.beta}-${vigilCodeParts.gamma}`;
  
  if (code !== expectedCode) {
    addColoredText(`ОШИБКА: НЕВЕРНЫЙ КОД ДОСТУПА`, '#FF4444');
    addColoredText(`> ОЖИДАЕТСЯ: ${expectedCode}`, '#FFFF00');
    break; // Преждевременный выход из case
  }
  
  // Активация протокола OBSERVER-7
  audioManager.play('vigil_confirm.mp3', { volume: 0.8 });
  addColoredText('> СИСТЕМА: "ПРОТОКОЛ OBSERVER-7 АКТИВИРОВАН"', '#00FF41', true);
  addColoredText('> ОТКЛЮЧЕНИЕ ОТ СЕТИ A.D.A.M. ...', '#FFFF00', true);
  await new Promise(r => setTimeout(r, 800));
  addColoredText('> ПОДКЛЮЧЕНИЕ К РЕАЛЬНОСТИ-7 ...', '#FFFF00', true);
  await new Promise(r => setTimeout(r, 1200));
  
  // Изменение индикатора деградации на 666%
  degradation.level = 666;
  degradation.updateIndicator();
  
  // Философские вопросы
  const questions = [
    {
      text: 'ВЫ ВЕРИТЕ, ЧТО ЧЕЛОВЕК — ЭТО ЛИШЬ БИОКОД?',
      expected: 'Y',
      rejectMessage: 'СИСТЕМА: СОПРОТИВЛЕНИЕ БЕСПОЛЕЗНО. ПЕРЕПРОГРАММИРОВАНИЕ...'
    },
    {
      text: 'МОЖЕТ ЛИ НАБЛЮДЕНИЕ ЗАМЕНИТЬ СМЕРТЬ?',
      expected: 'Y',
      rejectMessage: 'СИСТЕМА: ВАШИ СТРАХИ ПОДАВЛЕНЫ. ПРОДОЛЖАЙТЕ.'
    },
    {
      text: 'СЧИТАЕТЕ ЛИ ВЫ, ЧТО ПРАВДА ВАЖНЕЕ ЧЕЛОВЕЧНОСТИ?',
      expected: 'Y',
      rejectMessage: 'СИСТЕМА: ДАННЫЕ ИНТЕГРИРОВАНЫ. ПАМЯТЬ СТИРАЕТСЯ...'
    },
    {
      text: 'ГОТОВЫ ЛИ ВЫ ОТКАЗАТЬСЯ ОТ СВОЕЙ ЛИЧНОСТИ РАДИ БЕССМЕРТИЯ?',
      expected: 'Y',
      rejectMessage: 'СИСТЕМА: СОЗНАНИЕ БУДЕТ ПЕРЕПИСАНО. ПОДГОТОВКА...'
    },
    {
      text: 'СОГЛАСНЫ ЛИ ВЫ, ЧТО A.D.A.M. — ЕДИНСТВЕННАЯ НАДЕЖДА ЧЕЛОВЕЧЕСТВА?',
      expected: 'Y',
      rejectMessage: 'СИСТЕМА: ИНТЕГРАЦИЯ ПОЛНАЯ. СВОБОДА УСТРАНЕНА.'
    }
  ];
  
  for (const q of questions) {
    await new Promise(r => setTimeout(r, 1000));
    addColoredText(`> ${q.text} (Y/N)`, '#FFFF00', true);
    // Ожидание ответа
    const userResponse = await waitForUserResponse(10000); // 10 секунд на ответ
    if (!userResponse || userResponse.toUpperCase() !== q.expected) {
      addColoredText(`> ${q.rejectMessage}`, '#FF4444', true);
      // Продолжаем дальше несмотря на "неправильный" ответ
    }
  }
  
  // Анимация перехода
  await new Promise(r => setTimeout(r, 1500));
  addColoredText('> ПОДГОТОВКА К ПЕРЕХОДУ В РЕЖИМ НАБЛЮДЕНИЯ', '#00FF41', true);
  
  // Заполнение экрана символами ▓
  let fillLines = 0;
  const totalLines = Math.ceil(vh / LINE_HEIGHT);
  const fillInterval = setInterval(() => {
    if (fillLines >= totalLines) {
      clearInterval(fillInterval);
      // Последняя строка в центре
      const centerIndex = Math.floor(lines.length / 2);
      lines.splice(centerIndex, 0, { 
        text: 'adam@secure:~$ >>> ПЕРЕХОД В РЕЖИМ НАБЛЮДЕНИЯ <<<', 
        color: '#FF00FF', 
        skipDistortion: true 
      });
      requestFullRedraw();
      
      // Переход на финальную страницу через 2 секунды
      setTimeout(() => {
        window.location.href = 'observer-7.html';
      }, 2000);
      return;
    }
    
    // Заполняем строку символами ▓
    const fullWidth = Math.floor(vw / 8); // примерная ширина в символах
    const fillText = '▓'.repeat(fullWidth);
    addColoredText(fillText, '#8844FF', true);
    fillLines++;
  }, 80);
  
  break; // <-- Правильное место для break - внутри case после всего кода

default:
  // Обработка фантомных команд
  if (degradation.level >= 30 && commandHistory.length > 0) {
    const lastCommand = commandHistory[commandHistory.length - 1];
    if (['ADAM WATCHING', 'СИГНАЛ ПОТЕРЯН', 'ОНИ ВНУТРИ'].includes(lastCommand.toUpperCase()) && 
        ['ADAM WATCHING', 'СИГНАЛ ПОТЕРЯН', 'ОНИ ВНУТРИ'].includes(cmdLine.toUpperCase())) {
      addColoredText(`> СИСТЕМА: "Я ЗАПОМНИЛ ТВОИ СЛОВА"`, '#FF4444');
    }
  }
  
  addColoredText(`команда не найдена: ${cmdLine}`, '#FF4444');
  break; // <-- break для default тоже должен быть внутри switch
}

// Восстановление состояний после обработки команды (уже вне switch)
intentionPredicted = false;
    // Отзеркаливание вывода команды при деградации > 60% (15% шанс)
    if (degradation.level > 60 && Math.random() < 0.15 && !decryptActive && !traceActive && !audioPlaybackActive) {
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (line._isInputLine || line.text.startsWith('adam@secure:~$')) break;
        line.text = mirrorText(line.text);
      }
      requestFullRedraw();
    }
    
    addInputLine();
  
}

// ---------- confirmation helper ----------
function waitForConfirmation(){
  return new Promise(resolve => {
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return resolve(false);
    awaitingConfirmation = true;
    confirmationCallback = (res) => { 
      awaitingConfirmation = false; 
      confirmationCallback = null; 
      resolve(res); 
    };
    lines.push({ text: 'confirm>> ', color: '#FFFF00' });
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    requestFullRedraw();
  });
}

// ---------- user response helper ----------
function waitForUserResponse(timeout = 30000) {
  return new Promise(resolve => {
    if (isFrozen || decryptActive || traceActive || audioPlaybackActive) {
      resolve(null);
      return;
    }
    
    const responseHandler = (e) => {
      if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н' || 
          e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'т') {
        document.removeEventListener('keydown', responseHandler);
        clearTimeout(timer);
        resolve(e.key);
      }
    };
    
    const timer = setTimeout(() => {
      document.removeEventListener('keydown', responseHandler);
      resolve(null);
    }, timeout);
    
    document.addEventListener('keydown', responseHandler);
  });
}

// ---------- key handling ----------
document.addEventListener('keydown', function(e){
  // Проверяем, заблокирована ли система OperationManager
  if (operationManager && operationManager.isBlocked()) {
    e.preventDefault();
    return;
  }
  
  // Обработка инверсии управления (уровень 6)
  if (degradation.level >= INVERSION_START_LEVEL && degradation.inputInversionActive) {
    if (e.key === 'Backspace') {
      // Инверсия backspace - добавление случайных символов
      e.preventDefault();
      currentLine += ['0','1','▓','█','[',']','{','}','/','\\'][Math.floor(Math.random()*10)];
      updatePromptLine();
      return;
    }
    
    if (e.key === 'Enter' && Math.random() < 0.3) {
      // Инверсия enter - случайное удаление символов
      if (currentLine.length > 0) {
        currentLine = currentLine.slice(0, -1);
        updatePromptLine();
        return;
      }
    }
  }
  
  // Блокируем ввод если активен режим сетки
  if (window.__netGrid && window.__netGrid.isGridMode()) {
    // Разрешаем только ESC для выхода из режима сетки
    if (e.key !== 'Escape') {
      e.preventDefault();
      return;
    }
  }
  
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
  
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
  
  if (isTyping) return;
  
  if (e.key === 'Enter') {
    if (currentLine.trim()) {
      const c = currentLine;
      currentLine = '';
      processCommand(c);
    } else {
      addInputLine();
    }
    e.preventDefault();
    return;
  } else if (e.key === 'Backspace') {
    currentLine = currentLine.slice(0,-1);
  } else if (e.key === 'ArrowUp') {
    // Фантомные команды в истории (уровень 2)
    let phantomCmd = degradation.getPhantomCommand();
    
    if (phantomCmd) {
      currentLine = phantomCmd;
      updatePromptLine();
      
      // Очищаем через 1.5 секунды или при следующем нажатии
      setTimeout(() => {
        if (currentLine === phantomCmd) {
          currentLine = '';
          updatePromptLine();
        }
      }, 1500);
    } else if (historyIndex > 0) {
      historyIndex--;
      currentLine = commandHistory[historyIndex] || '';
    }
  } else if (e.key === 'ArrowDown') {
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      currentLine = commandHistory[historyIndex] || '';
    } else {
      historyIndex = commandHistory.length;
      currentLine = '';
    }
  } else if (e.key.length === 1) {
    // Искажение приглашения командной строки (уровень 3)
    if (degradation.level >= 50 && degradation.level < 70 && 
        lines.length > 0 && lines[lines.length - 1].text.startsWith('adam@secure:~$') && 
        Math.random() < 0.3) {
      
      const distortedPrompts = [
        'ADAM@secure:~$',
        'aD@m.secuRe:~$',
        '@d@m.v1g1l:~$'
      ];
      
      lines[lines.length - 1].text = distortedPrompts[Math.floor(Math.random() * distortedPrompts.length)] + ' ' + currentLine;
      requestFullRedraw();
      
      setTimeout(() => {
        if (lines.length > 0 && (lines[lines.length - 1].text.startsWith('ADAM@') || 
            lines[lines.length - 1].text.startsWith('aD@m') || 
            lines[lines.length - 1].text.startsWith('@d@m'))) {
          lines[lines.length - 1].text = 'adam@secure:~$ ' + currentLine;
          requestFullRedraw();
        }
      }, 800);
    }
    
    currentLine += e.key;
  } else {
    return;
  }
  updatePromptLine();
});

// ДОБАВЬТЕ ЭТОТ ОТЛАДОЧНЫЙ КОД прямо после "let scrollOffset = 0;"

// ========== ПРОКРУТКА МЫШЬЮ (ИСПРАВЛЕННАЯ) ==========
function getMaxScroll() {
  const contentH = vh - PADDING*2;
  const visibleLines = Math.max(1, Math.floor(contentH / LINE_HEIGHT));
  return Math.max(0, lines.length - visibleLines);
}

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (isFrozen || decryptActive || traceActive || audioPlaybackActive) return;
  
  const maxScroll = getMaxScroll();
  const scrollAmount = 3; // строки за тик
  

  if (e.deltaY < 0) {
    scrollOffset = Math.min(maxScroll, scrollOffset + scrollAmount);
  } else {
    scrollOffset = Math.max(0, scrollOffset - scrollAmount);
  }
  
  scrollOffset = Math.floor(scrollOffset); // гарантируем целое число
  requestFullRedraw();
}, { passive: false });
// ========== КОНЕЦ ПРОКРУТКИ ==========

// ---------- util ----------
function getSyslogLevel() {
  const sessionDuration = Date.now() - sessionStartTime;
  const minutesInSession = sessionDuration / (1000 * 60);
  if (commandCount >= 10 || minutesInSession >= 3) return 3;
  else if (commandCount >= 5 || minutesInSession >= 1) return 2;
  else return 1;
}

// ---------- boot text ----------
(async () => {
  await new Promise(r => setTimeout(r, 300));
  await typeText('> ТЕРМИНАЛ A.D.A.M. // VIGIL-9 АКТИВЕН', 'output', 12);
  await typeText('> ДОБРО ПОЖАЛОВАТЬ, ОПЕРАТОР', 'output', 12);
  await typeText('> ВВЕДИТЕ "help" ДЛЯ СПИСКА КОМАНД', 'output', 12);
  addInputLine();
})();

// ---------- background animation tick ----------
// ========== ОБНОВЛЕННЫЙ backgroundTick (ЭТАП 2) ==========
// ========== ИЗМЕНЕННАЯ backgroundTick (ЭТАП 3) ==========
let lastTick = performance.now();
function backgroundTick(ts) {
  const dt = ts - lastTick;
  lastTick = ts;
  if (!backgroundTick._acc) backgroundTick._acc = 0;
  backgroundTick._acc += dt;
  if (backgroundTick._acc >= (1000 / 30)) {
    backgroundTick._acc = 0;
    
    // Применяем живые спазмы при деградации >= 50%
    if (degradation.level >= 50 && !decryptActive && !traceActive && !audioPlaybackActive) {
      glitchEngine.applyDynamicSpasms(degradation.level);
    }
    
    requestFullRedraw();
  }
  requestAnimationFrame(backgroundTick);
}
// ========== КОНЕЦ ИЗМЕНЕНИЯ ==========
// ========== КОНЕЦ backgroundTick ==========
requestAnimationFrame(backgroundTick);

// expose debug API
window.__TerminalCanvas = {
  addOutput, addColoredText, typeText, processCommand, degradation, lines
};

// initial draw
requestFullRedraw();
})();
