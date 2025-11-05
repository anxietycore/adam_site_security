// screenCurvature_gl.js
// Final stable build — curvature + scroll + proper degradation + no input duplication + background visible
(() => {
  const FPS = 15;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.3;
  const SMOOTH = true;

  const outCanvas = document.createElement('canvas');
  Object.assign(outCanvas.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    zIndex: 800, // под шумом, но над терминалом
    pointerEvents: 'none'
  });
  document.body.appendChild(outCanvas);

  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { alpha: false });
  const gl = outCanvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) { console.error('WebGL not supported'); return; }

  const vs = `
    attribute vec2 aPos; attribute vec2 aUV;
    varying vec2 vUV;
    void main(){ vUV=aUV; gl_Position=vec4(aPos,0.0,1.0); }
  `;
  const fs = `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uTex;
    uniform float uDist;
    void main(){
      vec2 uv=vUV*2.0-1.0;
      float r=length(uv);
      vec2 distorted=mix(uv,uv*r,uDist);
      vec2 f=(distorted+1.0)*0.5;
      f.y=1.0-f.y;
      gl_FragColor=texture2D(uTex,clamp(f,0.0,1.0));
    }
  `;
  function sh(s,t){const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(x));return x;}
  const p=gl.createProgram();
  gl.attachShader(p,sh(vs,gl.VERTEX_SHADER));
  gl.attachShader(p,sh(fs,gl.FRAGMENT_SHADER));
  gl.linkProgram(p);
  gl.useProgram(p);
  const quad=new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1]);
  const b=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,b);
  gl.bufferData(gl.ARRAY_BUFFER,quad,gl.STATIC_DRAW);
  const aPos=gl.getAttribLocation(p,'aPos');
  const aUV=gl.getAttribLocation(p,'aUV');
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,16,0);
  gl.vertexAttribPointer(aUV,2,gl.FLOAT,false,16,8);
  const tex=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,SMOOTH?gl.LINEAR:gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,SMOOTH?gl.LINEAR:gl.NEAREST);
  const uDist=gl.getUniformLocation(p,'uDist');
  gl.uniform1f(uDist,DISTORTION);

  const terminal=document.getElementById('terminal')||document.querySelector('.terminal');
  const mapCanvas=document.querySelector('canvas[style*="right:"]')||document.querySelector('canvas');
  let degIndicator=[...document.querySelectorAll('div')].find(d=>(d.innerText||'').includes('ДЕГРАДАЦ'));
  if(degIndicator) degIndicator.style.opacity='0';

  function resizeAll(){
    const w=Math.floor(window.innerWidth*DPR);
    const h=Math.floor(window.innerHeight*DPR);
    outCanvas.width=w; outCanvas.height=h;
    gl.viewport(0,0,w,h);
    off.width=w; off.height=h;
  }
  resizeAll(); window.addEventListener('resize',resizeAll);

  function renderTerminal(ctx,w,h,scale){
    ctx.fillStyle='#000'; ctx.fillRect(0,0,w,h);
    if(!terminal)return;
    const lines=[];
    terminal.querySelectorAll('.output,.command,.prompt,.cmd,.line').forEach(el=>{
      const txt=el.textContent||''; if(!txt.trim())return;
      if(el.classList.contains('prompt')){
        const next=el.nextElementSibling;
        if(next&&next.classList.contains('input-line')){
          const comb=el.textContent+(next.textContent||'');
          lines.push({text:comb,color:getComputedStyle(el).color});
          return;
        }
      }
      lines.push({text:txt,color:getComputedStyle(el).color});
    });
    ctx.font=`${14*scale}px "Press Start 2P", monospace`;
    ctx.textBaseline='top';
    let y=8*scale;
    const lh=17*scale;
    lines.forEach(l=>{ctx.fillStyle=l.color;ctx.fillText(l.text,8*scale,y);y+=lh;});
  }

  function renderIndicator(ctx,x,y,s){
    const perc=(parseInt(localStorage.getItem('adam_degradation'))||34);
    const w=260*s,h=60*s;
    ctx.strokeStyle='#00FF41';ctx.lineWidth=2*s;ctx.fillStyle='rgba(0,0,0,0.9)';
    ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
    ctx.fillStyle='#00FF41';ctx.fillRect(x+6*s,y+12*s,(w-12*s)*(perc/100),12*s);
    ctx.font=`${12*s}px "Press Start 2P", monospace`;ctx.fillText(`${perc}%`,x+6*s,y+30*s);
  }

  function step(){
    const w=off.width,h=off.height;
    offCtx.clearRect(0,0,w,h);
    renderTerminal(offCtx,w,h,DPR);
    if(mapCanvas&&mapCanvas.width){
      const r=mapCanvas.getBoundingClientRect();
      offCtx.drawImage(mapCanvas,r.left*DPR,r.top*DPR,r.width*DPR,r.height*DPR);
    }
    if(degIndicator){
      const r=degIndicator.getBoundingClientRect();
      const x=r.width<50?window.innerWidth-280:Math.max(20,r.left)*DPR;
      const y=r.height<20?20:r.top*DPR;
      renderIndicator(offCtx,x,y,DPR);
    }
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,off);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  // scroll tracking
  window.addEventListener('scroll',()=>{
    outCanvas.style.top=`${window.scrollY}px`;
  });
})();
