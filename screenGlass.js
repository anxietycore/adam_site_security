// screenGlass.js
// OVERLAY GLASS+NOISE + SCRATCHES

const c = document.createElement('canvas');
c.id = "glassFX";
document.body.appendChild(c);

const ctx = c.getContext('2d');

function resize(){
    c.width = window.innerWidth;
    c.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// noise seed
let t = 0;

// SCRATCH IMAGE (dataURL tiny pattern)
const scratch = new Image();
scratch.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAN0lEQVR4AWP4DwQMDAwMjIzc3EA8iMyMzPxgYGD08fHxD0iIiL+xsTEwYGBg+Pn5+X///3/DwMBkAAAjFguw5j3XpQAAAABJRU5ErkJggg==";

function draw(){
    t+=0.003;
    const W=c.width,H=c.height;

    // DARK GLASS BASE
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle="rgba(0,0,0,0.15)";
    ctx.fillRect(0,0,W,H);

    // subtle glare top
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,"rgba(255,255,255,0.06)");
    grad.addColorStop(0.25,"rgba(255,255,255,0.00)");
    grad.addColorStop(1,"rgba(255,255,255,0.02)");
    ctx.fillStyle=grad;
    ctx.fillRect(0,0,W,H);

    // scratches overlay
    ctx.globalAlpha=0.12;
    ctx.drawImage(scratch,0,0,W*1.2,H*1.2);
    ctx.globalAlpha=1;

    // static noise on borders
    const imgData = ctx.getImageData(0, 0, W, H);
    const d = imgData.data;
    for(let i=0;i<d.length;i+=4){
        const x=(i/4)%W;
        const b=Math.min(x, W-x); 
        const edge= (1- Math.min(b/140.0,1) );
        if(edge>0){
            const n=(Math.random()*255*edge*0.25);
            d[i]+=n;d[i+1]+=n;d[i+2]+=n;
        }
    }
    ctx.putImageData(imgData,0,0);

    requestAnimationFrame(draw);
}
draw();
