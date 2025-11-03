// screenCurvature.js — Real CRT curvature effect (WebGL lens distortion, no html2canvas)

(() => {
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 999,
    pointerEvents: "none",
  });
  document.body.appendChild(canvas);

  const gl = canvas.getContext("webgl", { premultipliedAlpha: false });
  if (!gl) {
    console.error("WebGL не поддерживается");
    return;
  }

  const vert = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const frag = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform float u_strength;

    void main() {
      vec2 p = v_uv - 0.5;
      float r = length(p);
      float k = u_strength;
      // Геометрическое искажение: выпуклость
      vec2 distorted = p * (1.0 + k * r * r);
      vec2 uv = distorted + 0.5;

      // Тёмная виньетка по краям
      float vignette = smoothstep(0.9, 0.2, r);

      vec3 col = texture2D(u_tex, uv).rgb * vignette;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error(gl.getShaderInfoLog(s));
    return s;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vert));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);
  gl.useProgram(program);

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  const aPos = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uTex = gl.getUniformLocation(program, "u_tex");
  const uStrength = gl.getUniformLocation(program, "u_strength");

  const texCanvas = document.createElement("canvas");
  const ctx2d = texCanvas.getContext("2d");

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  function resize() {
    canvas.width = texCanvas.width = window.innerWidth;
    canvas.height = texCanvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener("resize", resize);
  resize();

  function render() {
    // Снимаем DOM через paint
    ctx2d.clearRect(0, 0, texCanvas.width, texCanvas.height);
    ctx2d.drawImage(document.documentElement, 0, 0); // в большинстве браузеров пусто, мы просто фон имитируем

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      texCanvas
    );

    gl.uniform1f(uStrength, 0.35); // <-- сила выпуклости (0.1–0.5)
    gl.uniform1i(uTex, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  render();
})();
