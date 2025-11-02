// screenGlass.js optimized

const c = document.createElement('canvas');
c.id = "glassFX";
document.body.appendChild(c);
const ctx = c.getContext('2d');

function resize(){
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    drawStatic();
}
resize();
window.addEventListener('resize', resize);

// tiny scratch texture
const scratch = new Image();
scratch.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAN0lEQVR4AWP4DwQMDAwMjIzc3EA8iMyMzPxgYGD08fHxD0iIiL+xsTEwYGBg+Pn5+X///3/DwMBkAAAjFguw5j3XpQAAAABJRU5ErkJggg==";

let staticImg = null;

function drawStatic(){
    const W=c.width,H=c.height;

    const tmp = document.createElement('canvas');
    tmp.width=W;tmp.height=H;
    const tctx=tmp.getContext('2d');

    // glass base
    tctx.fillStyle="rgba(0,0,0,0.15)";
    tctx.fillRect(0,0,W,H);

    // glare top
    const grad=tctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,"rgba(255,255,255,0.06)");
    grad.addColorStop(0.25,"rgba(255,255,255,0.00)");
    grad.addColorStop(1,"rgba(255,255,255,0.02)");
    tctx.fillStyle=grad;
    tctx.fillRect(0,0,W,H);

    // scratches
    tctx.globalAlpha=0.12;
    tctx.drawImage(scratch,0,0,W*1.2,H*1.2);
    tctx.globalAlpha=1;

    staticImg = tctx.getImageData(0,0,W,H);
    ctx.putImageData(staticImg,0,0);
}

// noise update
function addNoise(){
    if(!staticImg) return;
    const W=c.width,H=c.height;
    const img = new ImageData(new Uint8ClampedArray(staticImg.data),W,H);
    const d=img.data;
    for(let i=0;i<d.length;i+=4){
        const x=(i/4)%W;
        const b=Math.min(x,W-x);
        const edge=(1-Math.min(b/140,1));
        if(edge>0){
            const n=(Math.random()*80*edge);
            d[i]+=n; d[i+1]+=n; d[i+2]+=n;
        }
    }
    ctx.putImageData(img,0,0);
}

// first draw
setTimeout(drawStatic,200);

// update noise ~5fps
setInterval(addNoise,200);
