// ---- Simple Perlin (Ken Perlin style) ----
const Perlin = (function(){
  const p = new Uint8Array(512);
  const perm = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
  for(let i=0;i<256;i++){ p[i]=perm[i]; p[i+256]=perm[i]; }

  function fade(t){ return t*t*t*(t*(t*6-15)+10); }
  function lerp(a,b,t){ return a + t*(b-a); }
  function grad(hash, x, y, z){
    const h = hash & 15;
    const u = h<8 ? x : y;
    const v = h<4 ? y : (h===12||h===14 ? x : z);
    return ((h&1)?-u:u) + ((h&2)?-v:v);
  }
  function perlin3(x,y,z){
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A  = p[X  ]+Y, AA = p[A]+Z, AB = p[A+1]+Z;
    const B  = p[X+1]+Y, BA = p[B]+Z, BB = p[B+1]+Z;
    return lerp(
      lerp(
        lerp(grad(p[AA], x  , y  , z   ), grad(p[BA], x-1, y  , z   ), u),
        lerp(grad(p[AB], x  , y-1, z   ), grad(p[BB], x-1, y-1, z   ), u),
        v
      ),
      lerp(
        lerp(grad(p[AA+1], x  , y  , z-1 ), grad(p[BA+1], x-1, y  , z-1 ), u),
        lerp(grad(p[AB+1], x  , y-1, z-1 ), grad(p[BB+1], x-1, y-1, z-1 ), u),
        v
      ),
      w
    );
  }
  return { perlin3 };
})();

// ---- Canvas Brain Background ----
class BrainBackground {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.canvas.className = 'brain-background';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
            pointer-events: none;
        `;
        
        this.W = this.canvas.width = window.innerWidth;
        this.H = this.canvas.height = window.innerHeight;

        this.OPT = {
            POINTS: 400,
            CONNECT_DIST: 68,
            FOCAL: 520,
            DEPTH_OFF: 320,
            ROT_SPEED_Y: 0.0003,
            ROT_SPEED_X: 0.0002,
            BREATH_SCALE: 8,
            NODE_BASE: 1.2,
            WIRE_ALPHA: 0.06,
            NODE_ALPHA: 0.7,
            TRI_ALPHA: 0.03,
            COLOR_NODE: [0, 255, 65],
            COLOR_WIRE: [0, 200, 50],
            BACK: '#0a0a0a'
        };

        this.points = [];
        this.edges = [];
        this.tick = 0;
        
        this.init();
    }

    brainMask(x,y,z){
        const scaleX = 140, scaleY = 95, scaleZ = 100;
        const sep = 54;
        const lx = (x + sep)/scaleX, ly = y/scaleY, lz = z/scaleZ;
        const left = (lx*lx + ly*ly + lz*lz) < 1.0;
        const rx = (x - sep)/scaleX, ry = y/scaleY, rz = z/scaleZ;
        const right = (rx*rx + ry*ry + rz*rz) < 1.0;
        const bridge = (x*x)/(120*120) + (y*y)/(80*80) + (z*z)/(80*80) < 1.0;
        const stem = (Math.abs(x) < 35 && y > 60 && Math.abs(z) < 40);
        return (left || right || bridge || stem);
    }

    P(x,y,z){
        this.x = x; this.y = y; this.z = z;
        this.nei = [];
        this.screen = { x:0,y:0,z:0,s:1 };
    }

    generatePoints(count){
        this.points = [];
        this.edges = [];
        const bx=180, by=160, bz=150;
        let attempts=0;
        while(this.points.length < count && attempts < count*10){
            attempts++;
            const x = (Math.random()*2-1)*bx;
            const y = (Math.random()*2-1)*by;
            const z = (Math.random()*2-1)*bz;
            if(this.brainMask(x,y,z)){
                this.points.push({x, y, z, nei: [], screen: {x:0,y:0,z:0,s:1}});
            }
        }
        this.buildEdges();
    }

    buildEdges(){
        this.edges = [];
        const cd2 = this.OPT.CONNECT_DIST * this.OPT.CONNECT_DIST;
        for(let i=0;i<this.points.length;i++){
            this.points[i].nei = [];
        }
        for(let i=0;i<this.points.length;i++){
            for(let j=i+1;j<this.points.length;j++){
                const dx = this.points[i].x - this.points[j].x;
                const dy = this.points[i].y - this.points[j].y;
                const dz = this.points[i].z - this.points[j].z;
                const d2 = dx*dx + dy*dy + dz*dz;
                if(d2 <= cd2){
                    this.points[i].nei.push(j);
                    this.points[j].nei.push(i);
                    this.edges.push([i,j]);
                }
            }
        }
    }

    project(pt, rotX, rotY){
        let x = pt.x, y = pt.y, z = pt.z;
        let yy = y * Math.cos(rotX) - z * Math.sin(rotX);
        let zz = y * Math.sin(rotX) + z * Math.cos(rotX);
        let xx = x * Math.cos(rotY) + zz * Math.sin(rotY);
        zz = -x * Math.sin(rotY) + zz * Math.cos(rotY);
        const zt = zz + this.OPT.DEPTH_OFF;
        const s = this.OPT.FOCAL / zt;
        return {
            x: this.W/2 + xx * s,
            y: this.H/2 + yy * s,
            z: zt,
            s
        };
    }

    draw(){
        this.tick++;
        const rotY = this.tick * this.OPT.ROT_SPEED_Y;
        const rotX = Math.sin(this.tick * this.OPT.ROT_SPEED_X) * 0.3;

        this.ctx.fillStyle = this.OPT.BACK;
        this.ctx.fillRect(0,0,this.W,this.H);

        const timeFactor = this.tick * 0.003;
        for(let i=0;i<this.points.length;i++){
            const p = this.points[i];
            const n = Perlin.perlin3(p.x*0.01, p.y*0.01, timeFactor);
            const n2 = Perlin.perlin3(p.x*0.008, p.z*0.008, timeFactor*0.7);
            p._bx = p.x + n * this.OPT.BREATH_SCALE * 0.9 + n2 * (this.OPT.BREATH_SCALE*0.4);
            p._by = p.y + Perlin.perlin3(p.y*0.01, p.z*0.01, timeFactor*1.3) * (this.OPT.BREATH_SCALE*0.6);
            p._bz = p.z + Perlin.perlin3(p.z*0.012, p.x*0.012, timeFactor*0.9) * (this.OPT.BREATH_SCALE*0.8);
        }

        for(let i=0;i<this.points.length;i++){
            const temp = { x: this.points[i]._bx, y: this.points[i]._by, z: this.points[i]._bz };
            this.points[i].screen = this.project(temp, rotX, rotY);
        }

        this.ctx.globalAlpha = 0.1;
        for(let e=0;e<this.edges.length;e++){
            const [a,b] = this.edges[e];
            const A = this.points[a].screen;
            const B = this.points[b].screen;
            if(A.z <= 0 || B.z <= 0) continue;
            const depth = (A.z + B.z)/2;
            const alpha = this.OPT.WIRE_ALPHA * (1 - depth/(this.OPT.DEPTH_OFF+450));
            this.ctx.strokeStyle = `rgba(${this.OPT.COLOR_WIRE[0]},${this.OPT.COLOR_WIRE[1]},${this.OPT.COLOR_WIRE[2]},${Math.max(0,alpha)})`;
            this.ctx.beginPath();
            this.ctx.moveTo(A.x,A.y);
            this.ctx.lineTo(B.x,B.y);
            this.ctx.stroke();
        }

        this.ctx.globalAlpha = 0.3;
        for(let i=0;i<this.points.length;i++){
            const s = this.points[i].screen;
            if(s.z <= 0) continue;
            const depth = 1 - (s.z/(this.OPT.DEPTH_OFF+450));
            const r = Math.max(0.4, this.OPT.NODE_BASE * s.s);
            
            this.ctx.beginPath();
            this.ctx.fillStyle = `rgba(${this.OPT.COLOR_NODE[0]},${this.OPT.COLOR_NODE[1]},${this.OPT.COLOR_NODE[2]},${(0.04*depth)})`;
            this.ctx.arc(s.x, s.y, r*3, 0, Math.PI*2);
            this.ctx.fill();
            
            this.ctx.beginPath();
            this.ctx.fillStyle = `rgba(${this.OPT.COLOR_NODE[0]},${this.OPT.COLOR_NODE[1]},${this.OPT.COLOR_NODE[2]},${(0.7*depth)})`;
            this.ctx.arc(s.x, s.y, r, 0, Math.PI*2);
            this.ctx.fill();
        }

        this.ctx.globalAlpha = 1;
        requestAnimationFrame(() => this.draw());
    }

    init(){
        this.generatePoints(this.OPT.POINTS);
        document.body.appendChild(this.canvas);
        this.draw();
        
        window.addEventListener('resize', () => {
            this.W = this.canvas.width = window.innerWidth;
            this.H = this.canvas.height = window.innerHeight;
        });
    }
}
