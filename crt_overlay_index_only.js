// crt_overlay_index_only.js — overlay: искажение, шум, и ретрансляция событий на indexCanvas
(() => {
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const DISTORTION = 0.32;

  // ждём indexCanvas
  let attempts = 0;
  const checkInterval = setInterval(() => {
    const sourceCanvas = document.getElementById('indexCanvas');
    if (sourceCanvas) {
      clearInterval(checkInterval);
      initOverlay(sourceCanvas);
    } else if (++attempts > 80) {
      clearInterval(checkInterval);
      console.warn('indexCanvas not found after 80 attempts');
    }
  }, 80);

  function initOverlay(sourceCanvas) {
    // make sure source canvas is present but invisible
    sourceCanvas.style.opacity = '0';        // скрываем визуально
    sourceCanvas.style.pointerEvents = 'none';
    sourceCanvas.style.visibility = 'hidden'; // keep layout but invisible

    const overlay = document.createElement('canvas');
    overlay.id = 'crtOverlayIndex';
    Object.assign(overlay.style, {
      position: 'fixed',
      left: '0', top: '0',
      width: '100vw', height: '100vh',
      zIndex: '1000',
      pointerEvents: 'auto' // overlay WILL receive events
    });
    document.body.appendChild(overlay);

    const gl = overlay.getContext('webgl', { antialias: false });
    if (!gl) {
      console.error('WebGL not available for overlay');
      return;
    }

    // VERTEX
    const vs = `
      attribute vec2 aPos;
      attribute vec2 aUV;
      varying vec2 vUV;
      void main() {
        vUV = aUV;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;

    // FRAGMENT with moving noise and brightness damping
    const fs = `
      precision mediump float;
      varying vec2 vUV;
      uniform sampler2D uTex;
      uniform float uDist;
      uniform float uTime;
      float rand(vec2 co){return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453123);}
      void main() {
        // remap to [-1,1]
        vec2 uv = vUV * 2.0 - 1.0;
        float r = length(uv);
        vec2 distorted = mix(uv, uv * r, uDist);
        vec2 finalUV = (distorted + 1.0) * 0.5;
        finalUV.y = 1.0 - finalUV.y;
        vec4 base = texture2D(uTex, clamp(finalUV, 0.0, 1.0));

        // moving noise: small high-frequency flicker
        float n = rand(finalUV * 200.0 + vec2(uTime * 5.0, uTime * 3.0));
        float n2 = rand(finalUV * 80.0 + vec2(uTime * 12.0, uTime * 7.0));
        float noise = (n - 0.5) * 0.06 + (n2 - 0.5) * 0.03;

        // slight scanline / banding effect (subtle)
        float scan = sin((vUV.y + uTime*0.2) * 800.0) * 0.0025;

        // dampen brightness a little to remove "burn" look
        vec3 color = base.rgb * 0.92;
        color += noise;
        color -= scan;

        // clamp & subtle gamma
        color = clamp(color, 0.0, 1.0);
        color = pow(color, vec3(0.95));

        gl_FragColor = vec4(color, base.a);
      }
    `;

    function compile(src, type) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader compile error', gl.getShaderInfoLog(s));
      }
      return s;
    }

    const prog = gl.createProgram();
    const vsS = compile(vs, gl.VERTEX_SHADER);
    const fsS = compile(fs, gl.FRAGMENT_SHADER);
    gl.attachShader(prog, vsS);
    gl.attachShader(prog, fsS);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const quad = new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
       1,  1, 1, 1
    ]);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'aPos');
    const aUV = gl.getAttribLocation(prog, 'aUV');
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);

    const uDistLoc = gl.getUniformLocation(prog, 'uDist');
    const uTimeLoc = gl.getUniformLocation(prog, 'uTime');

    gl.uniform1f(uDistLoc, DISTORTION);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    function resize() {
      overlay.width = Math.floor(window.innerWidth * DPR);
      overlay.height = Math.floor(window.innerHeight * DPR);
      overlay.style.width = window.innerWidth + 'px';
      overlay.style.height = window.innerHeight + 'px';
      gl.viewport(0, 0, overlay.width, overlay.height);
    }
    window.addEventListener('resize', resize);
    resize();

    // inverse-distortion mapping: map distorted (screen) -> original uv in [-1,1]
    // We use the fact that distortion scales vector by scalar s = 1 + k*(r-1)
    function invertDistort(targetX, targetY) {
      // targetX/Y: normalized in [0,1] (overlay CSS pixels -> normalized)
      // return sourceUV in [0,1]
      const k = DISTORTION;
      // map to [-1,1]
      let tx = targetX * 2.0 - 1.0;
      let ty = targetY * 2.0 - 1.0;
      const td_mag = Math.sqrt(tx*tx + ty*ty);
      if (td_mag < 1e-6) {
        return {u: 0.5, v: 0.5};
      }
      // direction
      const dirx = tx / td_mag;
      const diry = ty / td_mag;
      // Solve scalar equation for m: m*(1 + k*(m - 1)) = td_mag
      // Newton method
      let m = Math.max(0.0001, td_mag); // initial
      for (let i=0;i<8;i++){
        const g = m * (1 + k*(m - 1)) - td_mag;
        const dg = 1 + k*(2*m - 1);
        const delta = g / (dg || 1e-6);
        m -= delta;
        if (Math.abs(delta) < 1e-6) break;
        if (m < 0) { m = 0; break; }
      }
      // uv in [-1,1]
      const ux = dirx * m;
      const uy = diry * m;
      // back to [0,1]
      return { u: (ux + 1) * 0.5, v: 1.0 - ((uy + 1) * 0.5) };
    }

    // map overlay client coords -> sourceCanvas client coords via inverse-distortion
    function mapOverlayToSourceClient(clientX, clientY) {
      const rectOverlay = overlay.getBoundingClientRect();
      const rectSource = sourceCanvas.getBoundingClientRect();
      const nx = (clientX - rectOverlay.left) / rectOverlay.width;
      const ny = (clientY - rectOverlay.top) / rectOverlay.height;
      const uv = invertDistort(nx, ny); // returns u,v in [0..1] with v already flipped
      // map to source client coords
      const mappedX = rectSource.left + uv.u * rectSource.width;
      const mappedY = rectSource.top + uv.v * rectSource.height;
      return { x: mappedX, y: mappedY };
    }

    // forward event to sourceCanvas by dispatching synthetic mouse events with mapped coords
    function forwardMouseEvent(type, origEvent) {
      const m = mapOverlayToSourceClient(origEvent.clientX, origEvent.clientY);
      const ev = new MouseEvent(type, {
        clientX: m.x,
        clientY: m.y,
        screenX: m.x,
        screenY: m.y,
        bubbles: true,
        cancelable: true,
        view: window,
        button: origEvent.button || 0
      });
      sourceCanvas.dispatchEvent(ev);
    }

    // overlay listeners -> forward mapped events to sourceCanvas
    overlay.addEventListener('mousemove', (e) => forwardMouseEvent('mousemove', e));
    overlay.addEventListener('mousedown', (e) => forwardMouseEvent('mousedown', e));
    overlay.addEventListener('mouseup', (e) => forwardMouseEvent('mouseup', e));
    overlay.addEventListener('click', (e) => forwardMouseEvent('click', e));
    // also keyboard passthrough: forward keydown/up to document (index logic listens on document)
    overlay.addEventListener('keydown', (e) => { /* nothing special */ });

    // Render loop: update texture from sourceCanvas and draw with shader
    let start = performance.now();
    function render() {
      const t = (performance.now() - start) * 0.001;
      // update texture from source canvas
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
      } catch (err) {
        // texImage2D can fail if canvas is cross-origin or zero-size; ignore
      }
      // uniforms
      gl.uniform1f(uTimeLoc, t);

      // clear and draw
      gl.clearColor(0,0,0,1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    render();
  }
})();
