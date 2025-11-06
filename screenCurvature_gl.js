// screenCurvature_gl.js — refinement patch
(() => {
  const FPS = 18, SNAP_FPS = 6, DPR = Math.min(window.devicePixelRatio || 1, 2);
  const DISTORTION = 0.30, SMOOTH = true;

  const term = document.querySelector('#terminal');
  const glass = document.querySelector('#glassFX');
  const map = document.querySelector('canvas[style*="right:"]') ||
              Array.from(document.querySelectorAll('canvas')).find(c=>c.id!=='glassFX'&&c.clientWidth>30);

  // force scroll available
  document.documentElement.style.overflow = 'auto';
  document.body.style.overflow = 'auto';

  const out = document.createElement('canvas');
  Object.assign(out.style,{
    position:'fixed',left:0,top:0,width:'100%',height:'100%',
    pointerEvents:'none',zIndex:'9998',willChange:'transform'
  });
  document.body.appendChild(out);

  // dim noise
  if (glass) glass.style.opacity = '0.25';

  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d',{alpha:false});
  const gl = out.getContext('webgl');
  if(!gl){console.error('WebGL missing');return;}

  const vs=`attribute vec2 aPos,aUV;varying vec2 vUV;
            void main(){vUV=aUV;gl_Position=vec4(aPos,0.,1.);} `;
  const fs=`precision mediump float;varying vec2 vUV;
            uniform sampler2D uTex;uniform float uDist;
            void main(){vec2 uv=vUV*2.-1.;float r=length(uv);
            vec2 d=mix(uv,uv*r,uDist);
            vec2 f=(d+1.)*0.5;f.y=1.-f.y;
            gl_FragColor=texture2D(uTex,clamp(f,0.,1.));}`;
  function sh(s,t){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o;}
  const p=gl.createProgram();gl.attachShader(p,sh(vs,gl.VERTEX_SHADER));
  gl.attachShader(p,sh(fs,gl.FRAGMENT_SHADER));gl.linkProgram(p);gl.useProgram(p);
  const quad=new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,1,1,1,1]);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
  gl.bufferData(gl.ARRAY_BUFFER,quad,gl.STATIC_DRAW);
  const aP=gl.getAttribLocation(p,'aPos'),aU=gl.getAttribLocation(p,'aUV');
  gl.enableVertexAttribArray(aP);gl.enableVertexAttribArray(aU);
  gl.vertexAttribPointer(aP,2,gl.FLOAT,false,16,0);
  gl.vertexAttribPointer(aU,2,gl.FLOAT,false,16,8);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,SMOOTH?gl.LINEAR:gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,SMOOTH?gl.LINEAR:gl.NEAREST);
  const uD=gl.getUniformLocation(p,'uDist');gl.uniform1f(uD,DISTORTION);

  function resize(){
    const w=Math.floor(innerWidth*DPR),h=Math.floor(innerHeight*DPR);
    out.width=w;out.height=h;off.width=w;off.height=h;
    gl.viewport(0,0,w,h);
  } resize(); addEventListener('resize',resize);

  // fallback render
  function renderTerm(ctx){
    ctx.fillStyle='#000';ctx.fillRect(0,0,off.width,off.height);
    if(!term)return;
    const scale=DPR, lh=16*scale;
    ctx.font=`${12*scale}px "Press Start 2P",monospace`;ctx.textBaseline='top';
    let y=8*scale;
    term.querySelectorAll('.output,.command,.note,.line,.cmd').forEach(el=>{
      const t=(el.textContent||'').trim();if(!t)return;
      ctx.fillStyle=getComputedStyle(el).color||'#00ff41';
      ctx.fillText(t,8*scale,y);y+=lh;
    });
    // prompt+input always visible
    const pr=term.querySelector('.prompt'), inp=term.querySelector('.input-line,input,[contenteditable]');
    const p=(pr?.textContent||'').trim(), v=(inp?.value||inp?.textContent||'').trim();
    if(p||v){ctx.fillStyle='#00ff41';ctx.fillText(p+(v?' '+v:''),8*scale,y);}
  }

  function drawIndicator(ctx){
    const vw=innerWidth,vh=innerHeight;
    let x=vw-280,y=20;
    const elem=Array.from(document.querySelectorAll('div')).find(d=>/(дегра|degra)/i.test(d.innerText||''))||null;
    if(elem){const r=elem.getBoundingClientRect();x=r.left;y=r.top;}
    const sx=x*DPR,sy=y*DPR,w=260*DPR,h=60*DPR;
    const perc=parseInt(localStorage.getItem('adam_degradation'))||0;
    ctx.strokeStyle='#00FF41';ctx.lineWidth=2*DPR;
    ctx.fillStyle='rgba(0,0,0,0.9)';ctx.fillRect(sx,sy,w,h);ctx.strokeRect(sx,sy,w,h);
    ctx.fillStyle='#00FF41';ctx.font=`${10*DPR}px "Press Start 2P",monospace`;
    ctx.fillText('ДЕГРАДАЦИЯ СИСТЕМЫ',sx+8*DPR,sy+10*DPR);
    const inner=(w-12*DPR)*(perc/100);
    ctx.fillRect(sx+6*DPR,sy+26*DPR,inner,8*DPR);
    ctx.fillText(`${perc}%`,sx+6*DPR,sy+42*DPR);
  }

  let last=0,frameT=1000/FPS;
  function loop(ts){
    requestAnimationFrame(loop);
    if(ts-last<frameT)return;last=ts;
    offCtx.clearRect(0,0,off.width,off.height);
    renderTerm(offCtx);
    if(map){const r=map.getBoundingClientRect();
      offCtx.drawImage(map,r.left*DPR,r.top*DPR,r.width*DPR,r.height*DPR);}
    drawIndicator(offCtx);
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,off);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  requestAnimationFrame(loop);

  window.__CRTOverlay={setGlassOpacity:v=>{if(glass)glass.style.opacity=v;}};
})();
