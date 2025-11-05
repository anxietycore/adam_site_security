// screenCurvature_gl.js
// FINAL PATCH — restores terminal text, adds "ДЕГРАДАЦИЯ" label, fixes screenGlass z-index
(() => {
  const FPS = 18;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.30;
  const SMOOTH = true;

  const STATE = { style:null, hidden:[], modified:[], canvas:null };

  // remove any old overlay
  document.getElementById('crt-overlay-inject')?.remove();

  // inject CSS: hide duplicates but keep terminal text visible
  const style = document.createElement('style');
  style.id = 'crt-overlay-inject';
  style.textContent = `
    /* hide nothing in terminal now, only prevent overlapping map/deg originals */
    .crt-hide { visibility: hidden !important; pointer-events: auto !important; }
  `;
  document.head.appendChild(style);
  STATE.style = style;

  // elements
  const terminal = document.getElementById('terminal') || document.querySelector('.terminal');
  const mapCanvas = document.querySelector('canvas[style*="right:"]') || Array.from(document.querySelectorAll('canvas')).find(c=>c.clientWidth>30);
  let degIndicator = Array.from(document.body.querySelectorAll('div,section')).find(d=>/(дегра|degrad)/i.test(d.innerText||''));
  const glassEl = document.querySelector('[id*="glass"],[class*="glass"],[id*="screen"],[class*="screen"]');

  // overlay
  const outCanvas = document.createElement('canvas');
  Object.assign(outCanvas.style, {
    position:'fixed',left:0,top:0,width:'100%',height:'100%',
    pointerEvents:'none',zIndex:'9999',willChange:'transform'
  });
  document.body.appendChild(outCanvas);
  STATE.canvas = outCanvas;

  // put glass BELOW overlay now
  if(glassEl){
    STATE.modified.push({el:glassEl,prop:'zIndex',value:glassEl.style.zIndex||''});
    glassEl.style.zIndex = '100';
  }

  // hide map + indicator originals visually
  [mapCanvas,degIndicator].forEach(e=>{if(e){STATE.hidden.push(e);e.classList.add('crt-hide');}});

  // offscreen + gl
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');
  const gl = outCanvas.getContext('webgl');
  const vs = `
    attribute vec2 aPos,aUV;varying vec2 vUV;
    void main(){vUV=aUV;gl_Position=vec4(aPos,0.,1.);}
  `;
  const fs = `
    precision mediump float;varying vec2 vUV;
    uniform sampler2D uTex;uniform float uDist;
    void main(){
      vec2 uv=vUV*2.-1.;float r=length(uv);
      vec2 d=mix(uv,uv*r,uDist);
      vec2 f=(d+1.)*0.5;f.y=1.-f.y;
      gl_FragColor=texture2D(uTex,clamp(f,0.,1.));
    }
  `;
  function compile(s,t){const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);return sh;}
  const prog=gl.createProgram();
  gl.attachShader(prog,compile(vs,gl.VERTEX_SHADER));
  gl.attachShader(prog,compile(fs,gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);gl.useProgram(prog);
  const quad=new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,1,1,1,1]);
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,quad,gl.STATIC_DRAW);
  const aPos=gl.getAttribLocation(prog,'aPos'),aUV=gl.getAttribLocation(prog,'aUV');
  gl.enableVertexAttribArray(aPos);gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,16,0);
  gl.vertexAttribPointer(aUV,2,gl.FLOAT,false,16,8);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,SMOOTH?gl.LINEAR:gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,SMOOTH?gl.LINEAR:gl.NEAREST);
  const uDist=gl.getUniformLocation(prog,'uDist');gl.uniform1f(uDist,DISTORTION);

  function resize(){
    const w=Math.floor(window.innerWidth*DPR),h=Math.floor(window.innerHeight*DPR);
    outCanvas.width=w;outCanvas.height=h;off.width=w;off.height=h;
    gl.viewport(0,0,w,h);
  }
  window.addEventListener('resize',resize);resize();

  function safeColor(el){try{return getComputedStyle(el).color||'#00ff41';}catch{return'#00ff41';}}

  function renderTerminal(ctx,w,h,s){
    ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
    if(!terminal)return;
    const els=terminal.querySelectorAll('.output,.command,.note,.line,.cmd,.prompt');
    let y=8*s;const lh=16*s;
    ctx.font=`${12*s}px "Press Start 2P", monospace`;ctx.textBaseline='top';
    els.forEach(e=>{
      const t=(e.textContent||'').trim();if(!t)return;
      ctx.fillStyle=safeColor(e);ctx.fillText(t,8*s,y);y+=lh;
    });
    // prompt + input
    const prompt=terminal.querySelector('.prompt');
    const input=terminal.querySelector('.input-line,input,textarea,[contenteditable]');
    const p=(prompt?.textContent||'').trim();
    let v='';
    if(input){v=input.value||input.textContent||'';}
    if(p||v){
      ctx.fillStyle=safeColor(input||prompt);
      ctx.fillText(p+(v?' '+v:''),8*s,y);
    }
  }

  function renderIndicator(ctx){
    const vw=window.innerWidth,vh=window.innerHeight;
    let x=vw-280,y=20;
    if(degIndicator){
      const r=degIndicator.getBoundingClientRect();
      if(r.width>8)x=r.left,y=r.top;
    }
    const sx=x*DPR,sy=y*DPR,w=260*DPR,h=60*DPR;
    let perc=localStorage.getItem('adam_degradation')||34;
    const m=degIndicator?.innerText?.match(/(\d{1,3})\s*%/);
    if(m)perc=m[1];
    ctx.strokeStyle='#00FF41';ctx.fillStyle='rgba(0,0,0,0.9)';
    ctx.lineWidth=2*DPR;ctx.fillRect(sx,sy,w,h);ctx.strokeRect(sx,sy,w,h);
    ctx.font=`${10*DPR}px "Press Start 2P", monospace`;
    ctx.fillStyle='#00FF41';
    ctx.fillText('ДЕГРАДАЦИЯ',sx+6*DPR,sy+8*DPR);
    const inner=(w-12*DPR)*(perc/100);
    ctx.fillRect(sx+6*DPR,sy+22*DPR,inner,8*DPR);
    ctx.fillText(`${perc}%`,sx+6*DPR,sy+36*DPR);
  }

  let last=0;const frameT=1000/FPS;
  function step(ts){
    if(ts-last<frameT)return requestAnimationFrame(step);
    last=ts;
    const w=off.width,h=off.height;
    offCtx.clearRect(0,0,w,h);
    renderTerminal(offCtx,w,h,DPR);
    if(mapCanvas){
      const r=mapCanvas.getBoundingClientRect();
      offCtx.drawImage(mapCanvas,r.left*DPR,r.top*DPR,r.width*DPR,r.height*DPR);
    }
    renderIndicator(offCtx);
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,off);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  window.addEventListener('scroll',()=>{outCanvas.style.transform=`translate(${scrollX}px,${scrollY}px)`;});
})();
