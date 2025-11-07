// script.js
// Главная логика + визуальный изгиб/шум (curvature + glass noise)
// Заменить текущий script.js этим файлом.
// Сохраняет оригинальную логику загрузки/логина и добавляет визуальный слой,
// который делает "изгиб" страницы аналогично терминалу.

const VALID_CREDENTIALS = { username: "qq", password: "ww" };

/* ==========================
   BOOT / LOGIN (оригинальная логика)
   ========================== */
document.addEventListener('DOMContentLoaded', () => {
  // счётчик посещений — оставляем
  let visits = parseInt(localStorage.getItem('adam_visits')) || 0;
  localStorage.setItem('adam_visits', ++visits);

  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.addEventListener('click', startBootSequence);

  // инициализация визуального изгиба (делаем рано, но не вмешиваемся в DOM логики)
  initCurvatureLayer();

  // фокус логина при загрузке если экран видим
  const usernameInput = document.getElementById('username');
  if (usernameInput) usernameInput.autocomplete = "off";
});

function startBootSequence() {
  const startScreen = document.getElementById('start-screen');
  const bootScreen = document.getElementById('boot-screen');
  if (startScreen) startScreen.classList.add('hidden');
  if (bootScreen) bootScreen.classList.remove('hidden');

  const bootTexts = document.querySelectorAll('#boot-screen .boot-text p');
  let i = 0;
  (function next() {
    if (i < bootTexts.length) {
      bootTexts[i++].style.opacity = 1;
      setTimeout(next, 1000);
    } else setTimeout(showLoginScreen, 1000);
  })();
}

function showLoginScreen() {
  document.getElementById('boot-screen')?.classList.add('hidden');
  document.getElementById('login-screen')?.classList.remove('hidden');
  document.getElementById('username')?.focus();
}

document.getElementById('login-btn')?.addEventListener('click', login);
document.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

function login() {
  const u = document.getElementById('username')?.value;
  const p = document.getElementById('password')?.value;
  const err = document.getElementById('login-error');

  if (u === VALID_CREDENTIALS.username && p === VALID_CREDENTIALS.password) {
    err.textContent = 'ДОСТУП РАЗРЕШЁН';
    err.style.color = '#00FF41';
    err.classList.remove('hidden');
    document.body.style.transition = 'opacity 0.8s ease-in-out';
    document.body.style.opacity = '0';
    setTimeout(() => window.location.href = 'terminal.html', 800);
  } else {
    err.textContent = 'ДОСТУП ЗАПРЕЩЁН';
    err.style.color = '#FF0000';
    err.classList.remove('hidden');
    document.getElementById('password').value = '';
    document.getElementById('username')?.focus();
  }
}

/* ==========================
   CURVATURE + GLASS NOISE LAYER
   --------------------------
   Прикручиваем canvas-слой, который:
    - рендерит shader-canvas (фон) и делает "изгиб" путём разбиения на вертикальные полосы
    - добавляет слой шума / glassFX (подсветка)
    - располагается над shader-canvas, под UI (кнопки, тексты)
   ========================== */

function initCurvatureLayer() {
  // безопасно: если уже есть — не создаём ещё один
  if (document.getElementById('curvature-canvas')) return;

  const shaderCanvas = document.getElementById('shader-canvas');
  // Если shader-canvas нет — всё равно создаём curvature canvas (пустой фон рисуем чёрным)
  const curvature = document.createElement('canvas');
  curvature.id = 'curvature-canvas';
  curvature.style.position = 'fixed';
  curvature.style.left = '0';
  curvature.style.top = '0';
  curvature.style.width = '100%';
  curvature.style.height = '100%';
  // z-index: чуть выше shader-canvas, ниже UI (start/login). В index.html UI не имеет z-index,
  // поэтому даём небольшой положительный z-index, но UI остаётся выше (его можно поднять в CSS при необходимости).
  curvature.style.zIndex = 5;
  curvature.style.pointerEvents = 'none';
  curvature.style.opacity = '1';
  document.body.appendChild(curvature);

  const ctx = curvature.getContext('2d', { alpha: false });

  // noise / glass overlay canvas (drawn into curvature canvas, not separate DOM element)
  // track size
  let vw = Math.max(320, window.innerWidth);
  let vh = Math.max(240, window.innerHeight);
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let widthPx = Math.floor(vw * DPR);
  let heightPx = Math.floor(vh * DPR);
  curvature.width = widthPx;
  curvature.height = heightPx;
  curvature.style.width = vw + 'px';
  curvature.style.height = vh + 'px';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(DPR, DPR);

  // parameters (подбрал близко к терминалу)
  const params = {
    curvatureStrength: 0.22,   // 0..0.4 — сила изгиба
    curvatureZoom: 1.06,       // масштаб по центру
    noiseAlpha: 0.12,          // интенсивность шумового слоя
    glassAlpha: 0.08,          // дополнительный glass shine alpha
    sliceWidth: 6,             // ширина вертикальной полоски для "warp"
    fpsThrottle: 30,           // target FPS
    enableWarp: true,
    enableNoise: true
  };

  // prepare an offscreen canvas to read shader-canvas (if present)
  const off = document.createElement('canvas');
  let offCtx = off.getContext('2d');
  off.width = widthPx;
  off.height = heightPx;
  offCtx.setTransform(1, 0, 0, 1, 0, 0);
  offCtx.scale(DPR, DPR);

  // prepare noise imageData (we'll reuse it and update slowly)
  let noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = Math.max(64, Math.floor(vw / 8));
  noiseCanvas.height = Math.max(64, Math.floor(vh / 8));
  let noiseCtx = noiseCanvas.getContext('2d');
  let noiseImage = noiseCtx.createImageData(noiseCanvas.width, noiseCanvas.height);

  function regenNoise() {
    const d = noiseImage.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      // monochrome noise
      d[i] = v;
      d[i+1] = v;
      d[i+2] = v;
      d[i+3] = 255;
    }
    noiseCtx.putImageData(noiseImage, 0, 0);
  }
  regenNoise();

  // resize handler
  function resize() {
    vw = Math.max(320, window.innerWidth);
    vh = Math.max(240, window.innerHeight);
    widthPx = Math.floor(vw * DPR);
    heightPx = Math.floor(vh * DPR);
    curvature.width = widthPx;
    curvature.height = heightPx;
    curvature.style.width = vw + 'px';
    curvature.style.height = vh + 'px';

    off.width = widthPx;
    off.height = heightPx;
    offCtx.setTransform(1,0,0,1,0,0);
    offCtx.scale(DPR, DPR);

    // noise smaller canvas updated
    noiseCanvas.width = Math.max(64, Math.floor(vw / 8));
    noiseCanvas.height = Math.max(64, Math.floor(vh / 8));
    noiseCtx = noiseCanvas.getContext('2d');
    noiseImage = noiseCtx.createImageData(noiseCanvas.width, noiseCanvas.height);
    regenNoise();
  }
  window.addEventListener('resize', resize);

  // simple mapping function for curvature displacement across x ∈ [0,1]
  function curvatureOffset(normX) {
    // shaped bump toward center (0 at edges, max at center)
    // use smooth cosine-based bump
    const t = (normX - 0.5) * 2; // -1..1
    const bump = 1 - Math.abs(t); // 0..1 (triangle shape)
    // smoother:
    const smooth = 0.5 + 0.5 * Math.cos((1 - bump) * Math.PI);
    return smooth;
  }

  // warp-draw: split into vertical slices and draw each slice with horizontal offset + scale
  function drawWarped(sourceCanvas, targetCtx) {
    // source (off) assumed same logical size as target in CSS pixels (we manage DPR outside)
    const slices = Math.max(6, Math.floor(vw / params.sliceWidth));
    const sliceW = Math.ceil(vw / slices);
    // center-based mapping
    for (let i = 0; i < slices; i++) {
      const sx = i * sliceW;
      const sw = Math.min(sliceW, vw - sx);
      const normX = (sx + sw * 0.5) / vw; // 0..1
      const bump = curvatureOffset(normX); // 0..1
      const dx = (normX - 0.5) * -1 * params.curvatureStrength * vw * bump; // horizontal bend
      // vertical scale change for lens-like effect
      const sy = 0;
      const sh = vh;
      const dw = sw * params.curvatureZoom;
      const dh = sh * (1 - params.curvatureStrength * 0.12 * bump);
      const dxPos = sx + dx + (sw - dw) * 0.5;
      const dyPos = (vh - dh) * 0.5;
      try {
        // drawImage uses device pixels, we must multiply coords by DPR
        targetCtx.drawImage(
          sourceCanvas,
          Math.round(sx * DPR), Math.round(sy * DPR), Math.round(sw * DPR), Math.round(sh * DPR),
          Math.round(dxPos * DPR), Math.round(dyPos * DPR), Math.round(dw * DPR), Math.round(dh * DPR)
        );
      } catch (e) {
        // fallback: full draw
        targetCtx.drawImage(sourceCanvas, 0, 0, widthPx, heightPx, 0, 0, widthPx, heightPx);
        break;
      }
    }
  }

  // main draw loop with FPS throttle
  let lastFrame = performance.now();
  let acc = 0;
  const frameInterval = 1000 / params.fpsThrottle;

  function renderLoop(ts) {
    const dt = ts - lastFrame;
    lastFrame = ts;
    acc += dt;
    if (acc >= frameInterval) {
      acc = 0;
      render(); // do actual rendering
    }
    requestAnimationFrame(renderLoop);
  }

  // render function: copy shader-canvas into offscreen, then warp & draw noise/glass
  function render() {
    // clear target
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();

    // draw shader-canvas into off (or fill black if missing)
    if (shaderCanvas && shaderCanvas.width > 0) {
      // shaderCanvas may be full device pixels — draw directly scaled to vw/vh
      try {
        offCtx.save();
        offCtx.setTransform(1,0,0,1,0,0);
        offCtx.scale(DPR, DPR);
        offCtx.clearRect(0,0,vw,vh);
        offCtx.drawImage(shaderCanvas, 0, 0, vw, vh);
        offCtx.restore();
      } catch (e) {
        offCtx.save();
        offCtx.setTransform(1,0,0,1,0,0);
        offCtx.fillStyle = '#000';
        offCtx.fillRect(0,0,vw,vh);
        offCtx.restore();
      }
    } else {
      offCtx.save();
      offCtx.setTransform(1,0,0,1,0,0);
      offCtx.fillStyle = '#000';
      offCtx.fillRect(0,0,vw,vh);
      offCtx.restore();
    }

    // draw warped off -> main ctx
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(DPR, DPR);

    if (params.enableWarp) {
      // attempt warped draw
      drawWarped(off, ctx);
    } else {
      // fallback: just draw center scaled
      try {
        ctx.drawImage(off, 0, 0, widthPx, heightPx, 0, 0, vw, vh);
      } catch (e) {}
    }

    // overlay glass/noise under UI
    if (params.enableNoise) {
      // draw small noise scaled up
      ctx.globalAlpha = params.noiseAlpha;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(noiseCanvas, 0, 0, noiseCanvas.width, noiseCanvas.height, 0, 0, vw, vh);
      ctx.globalAlpha = 1.0;
    }

    // subtle glass shine: radial gradient at top-left center
    const g = ctx.createRadialGradient(vw * 0.2, vh * 0.18, 20, vw * 0.2, vh * 0.18, Math.max(vw, vh) * 0.9);
    g.addColorStop(0, `rgba(255,255,255,${params.glassAlpha})`);
    g.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
    ctx.globalCompositeOperation = 'source-over';

    // slight vignette
    const vg = ctx.createRadialGradient(vw/2, vh/2, Math.max(vw,vh)*0.2, vw/2, vh/2, Math.max(vw,vh)*0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, vw, vh);

    ctx.restore();

    // occasionally regenerate noise to simulate subtle movement
    if (Math.random() < 0.08) regenNoise();
  }

  // start loop
  requestAnimationFrame(renderLoop);

  // Expose controls for debugging in console (if needed)
  window.__ScreenCurvature = {
    setStrength(v) { params.curvatureStrength = Math.max(0, Math.min(0.45, v)); },
    setZoom(z) { params.curvatureZoom = Math.max(1.0, Math.min(1.12, z)); },
    setNoiseAlpha(a) { params.noiseAlpha = Math.max(0, Math.min(0.6, a)); },
    regenNoise,
    enableWarp(b) { params.enableWarp = !!b; },
    enableNoise(b) { params.enableNoise = !!b; }
  };
}

/* ==========================
   Примечания / рекомендации
   ==========================
 - Этот файл НЕ трогает существующие screenGlass.js / screenCurvature.js если они подключены.
 - Curvature-канвас расположен поверх shader-canvas и под UI (zIndex = 5).
   Если в вашей странице кнопки/экраны оказываются ниже канваса — поднимите их CSS z-index (например, #start-screen { z-index: 10; }).
 - Параметры изгиба и шума можно менять в рантайме через window.__ScreenCurvature.
 - Если нужно абсолютно точное поведение, как в терминале (слой под текстом/точная геометрия полос),
   скажи — я подогнал алгоритм под твою сцену и могу увеличить качество (меньшая sliceWidth, больше слоёв),
   но это повысит нагрузку. Сейчас поставил баланс качество/производительность.
 - Если shader-canvas рендерит в device-pixels искажения, наш offCtx.drawImage может требовать другой sourceRect — в таком случае пришли содержимое shader-canvas или скажи, и подгоню.
*/
