// screenCurvature_gl.js
// Full-page WebGL barrel distortion + subtle edge noise.
// Uses html2canvas to capture page bitmap on changes (debounced).
// Expose window.crtGL.set({...}) and window.crtGL.disable().

(() => {
  // CONFIG
  const CONF = {
    captureDebounce: 300,   // ms between captures on changes
    maxScaleForCapture: 1.0, // multiply html2canvas scale by DPR*maxScaleForCapture (reduce to lighten)
    strength: 0.7,          // distortion strength (0..1.5)
    noiseAmount: 0.06,      // edge noise intensity (0..0.2)
    chroma: 6.0,            // chromatic offset in px
    dprLimit: 1.5
  };

  // helper: load html2canvas if missing
  function ensureHtml2Canvas(cb) {
    if (window.html2canvas) return cb();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => {
      setTimeout(cb, 50);
    };
    s.onerror = () => {
      console.error('crtGL: failed to load html2canvas from CDN');
      cb(new Error('html2canvas load failed'));
    };
    document.head.appendChild(s);
  }

  const DPR = Math.min(window.devicePixelRatio || 1, CONF.dprLimit);

  // create GL canvas overlay
  const glCanvas = document.createElement('canvas');
  Object.assign(glCanvas.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 999999
  });
  document.body.appendChild(glCanvas);

  const gl = glCanvas.getContext('webgl', { alpha: true, antialias: true });
  if (!gl) { console.error('crtGL: WebGL not available'); return; }

  function resizeGL() {
    const w = Math.floor(window.innerWidth * DPR);
    const h = Math.floor(window.innerHeight * DPR);
    if (glCanvas.width !== w || glCanvas.height !== h) {
      glCanvas.width = w; glCanvas.height = h;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
  }
  resizeGL();
  window.addEventListener('resize', resizeGL);

  // create offscreen canvas for capture result (we'll use html2canvas to populate an <canvas>)
  let captureCanvas = document.createElement('canvas');

  // compile helpers
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const vsSrc = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const fsSrc = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec2 uRes; // screen px
    uniform vec2 uTexSize; // capture canvas px
    uniform float uStrength;
    uniform float uChroma;
    uniform float uNoise;
    uniform float uTime;

    // barrel distortion (centered)
    vec2 barrel(vec2 uv, float k) {
      vec2 c = uv - 0.5;
      float r2 = dot(c,c);
      return uv + c * k * r2;
    }

    float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

    void main() {
      // We map full screen uv -> sample from capture texture which is same size as screen (captured)
      vec2 uv = vUv;

      // apply barrel
      uv = barrel(uv, uStrength);

      // clamp to avoid sampling outside
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0,0.0,0.0,0.0);
        return;
      }

      // chromatic sampling (small offsets)
      float ch = uChroma / uTexSize.x; // convert px to uv
      vec2 shift = (uv - 0.5) * 0.0; // slight proportional shift if needed
      vec3 cR = texture2D(uTex, uv + vec2(-ch,0.0)).rgb;
      vec3 cG = texture2D(uTex, uv).rgb;
      vec3 cB = texture2D(uTex, uv + vec2(ch,0.0)).rgb;
      vec3 color = vec3(cR.r, cG.g, cB.b);

      // vignette (edges darker)
      vec2 cent = uv - 0.5;
      float r = length(cent);
      float vig = smoothstep(0.95, 0.4, r);
      color *= (1.0 - 0.45 * vig);

      // subtle edge noise stronger near corners
      float edgeFactor = smoothstep(0.5, 0.95, r);
      float n = (rand(vec2(uTime*12.0, uv.x*720.0 + uv.y*540.0)) - 0.5) * uNoise * edgeFactor;
      color += n;

      // output
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const vs = compile(gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  // quad
  const quad = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // texture
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // uniform locations
  const uTex = gl.getUniformLocation(prog, 'uTex');
  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTexSize = gl.getUniformLocation(prog, 'uTexSize');
  const uStrength = gl.getUniformLocation(prog, 'uStrength');
  const uChroma = gl.getUniformLocation(prog, 'uChroma');
  const uNoise = gl.getUniformLocation(prog, 'uNoise');
  const uTime = gl.getUniformLocation(prog, 'uTime');

  // flags
  let latestBitmap = null;
  let dirty = true;
  let lastCaptureAt = 0;
  let captureScheduled = false;

  // capture function (uses html2canvas)
  function capturePage() {
    const now = Date.now();
    if (now - lastCaptureAt < CONF.captureDebounce) {
      // schedule later
      if (!captureScheduled) {
        captureScheduled = true;
        setTimeout(() => { captureScheduled = false; capturePage(); }, CONF.captureDebounce - (now - lastCaptureAt));
      }
      return;
    }
    lastCaptureAt = now;
    // options: use DPR * scale
    const scale = DPR * CONF.maxScaleForCapture;
    try {
      window.html2canvas(document.documentElement, {
        backgroundColor: null,
        scale: scale,
        logging: false,
        useCORS: true,
        allowTaint: true,
        removeContainer: false
      }).then(canvas => {
        // replace captureCanvas
        captureCanvas = canvas;
        dirty = true;
      }).catch(err => {
        console.warn('crtGL: capture error', err);
      });
    } catch (e) {
      console.warn('crtGL: html2canvas thrown', e);
    }
  }

  // initial ensure html2canvas -> then initial capture -> start render loop
  ensureHtml2Canvas(err => {
    if (err) { console.error('crtGL: cannot load html2canvas'); return; }
    capturePage();
    // set up MutationObserver: observe changes to body subtree
    const mo = new MutationObserver((mutations) => {
      // on any mutation schedule capture
      capturePage();
    });
    mo.observe(document.documentElement, { attributes: true, childList: true, subtree: true, characterData: true });

    // also capture on resize & scroll (layout changes)
    window.addEventListener('resize', () => capturePage());
    window.addEventListener('scroll', () => capturePage());

    // also capture shortly after key input
    ['keydown','keyup','input'].forEach(evt => {
      window.addEventListener(evt, () => { setTimeout(capturePage, 120); });
    });

    // render loop
    const start = performance.now();
    function render(now) {
      resizeGL(); // ensure sizes
      // if dirty => upload new texture
      if (dirty && captureCanvas && captureCanvas.width > 0) {
        try {
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, captureCanvas);
          dirty = false;
        } catch (e) {
          // fallback: try ImageBitmap
          createImageBitmap(captureCanvas).then(bitmap => {
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
            bitmap.close && bitmap.close();
            dirty = false;
          }).catch(err => console.warn('crtGL: bitmap fallback err', err));
        }
      }

      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(prog);
      // texture unit 0
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(uTex, 0);
      gl.uniform2f(uRes, glCanvas.width / DPR, glCanvas.height / DPR);
      gl.uniform2f(uTexSize, captureCanvas.width || 1, captureCanvas.height || 1);
      gl.uniform1f(uStrength, CONF.strength);
      gl.uniform1f(uChroma, CONF.chroma);
      gl.uniform1f(uNoise, CONF.noiseAmount);
      gl.uniform1f(uTime, (performance.now() - start) * 0.001);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    // expose API
    window.crtGL = {
      set(opts = {}) {
        Object.assign(CONF, opts);
        // immediate recapture if scale changed
        capturePage();
      },
      captureNow() { capturePage(); },
      disable() {
        try {
          mo.disconnect();
        } catch(e){}
        window.removeEventListener('resize', capturePage);
        window.removeEventListener('scroll', capturePage);
        // remove canvas
        try { glCanvas.remove(); } catch(e){}
        console.info('crtGL disabled');
      }
    };

    console.info('crtGL initialized — will capture page on change. Use window.crtGL.set({strength:0.8, noiseAmount:0.08})');
  });

})();
