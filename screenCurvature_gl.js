// screenCurvature_gl.js — CRT curvature with edge noise
(() => {
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 100,
    pointerEvents: "none",
  });
  document.body.appendChild(canvas);

  const gl = canvas.getContext("webgl");
  if (!gl) return console.error("WebGL not supported");

  const vertexShaderSrc = `
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = (position + 1.0) * 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSrc = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uScene;
    uniform vec2 uResolution;
    uniform float uTime;

    float rand(vec2 co){
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    void main(){
      vec2 uv = vUv;

      // CRT curvature
      vec2 center = uv - 0.5;
      float dist = dot(center, center) * 1.2;
      uv = uv + center * dist * 0.25;

      // barrel distortion fix
      uv = clamp(uv, 0.0, 1.0);

      vec3 col = texture2D(uScene, uv).rgb;

      // subtle vignette
      float vignette = smoothstep(0.9, 0.4, length(center)*1.4);
      col *= vignette;

      // edge noise (grain)
      float noise = rand(uv * uResolution.xy + uTime * 60.0);
      col += noise * 0.03;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compileShader(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  const vs = compileShader(gl.VERTEX_SHADER, vertexShaderSrc);
  const fs = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  const quad = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  const fb = gl.createFramebuffer();

  const sceneCanvas = document.createElement("canvas");
  const sctx = sceneCanvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    sceneCanvas.width = window.innerWidth;
    sceneCanvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  window.addEventListener("resize", resize);
  resize();

  const uScene = gl.getUniformLocation(program, "uScene");
  const uResolution = gl.getUniformLocation(program, "uResolution");
  const uTime = gl.getUniformLocation(program, "uTime");

  function render(t) {
    // рендерим содержимое страницы
    sctx.clearRect(0,0,sceneCanvas.width,sceneCanvas.height);
    sctx.drawImage(document.documentElement, 0, 0); // <— основа
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, sceneCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform1i(uScene, 0);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, t * 0.001);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
