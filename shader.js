// shader.js
const frag = `#define S(a,b,t) smoothstep(a,b,t)
#define NUM_LAYERS 4.
float N21(vec2 p){vec3 a=fract(vec3(p.xyx)*vec3(613.897,553.453,80.098));a+=dot(a,a.yzx+88.76);return fract((a.x+a.y)*a.z);}
vec2 GetPos(vec2 id,vec2 offs,float t){float n=N21(id+offs);float n1=fract(n*0.7);float n2=fract(n*79.7);float a=t+n;return offs+vec2(sin(a*n1),cos(a*n2))*0.5;}
float df_line(in vec2 a,in vec2 b,in vec2 p){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
float line(vec2 a,vec2 b,vec2 uv){float r1=0.005,r2=.0001,d=df_line(a,b,uv),d2=length(a-b),fade=S(0.005,.05,d2);fade+=S(.0005,.0002,abs(d2-.025));return S(r1,r2,d)*fade;}
float NetLayer(vec2 st,float n,float t){vec2 id=floor(st)+n;st=fract(st)-.5;vec2 p[9];int i=0;for(float y=-1.;y<=1.;y++){for(float x=-1.;x<=1.;x++){p[i++]=GetPos(id,vec2(x,y),t);}}float m=0.,sparkle=0.;for(int i=0;i<9;i++){m+=line(p[4],p[i],st);float d=length(st-p[i]);float s=(.002/(d*d));s*=S(1.,.1,d);float pulse=sin((fract(p[i].x)+fract(p[i].y)+t)*5.)*.4+.6;pulse=pow(pulse,20.);s*=pulse;sparkle+=s;}m+=line(p[1],p[3],st);m+=line(p[1],p[5],st);m+=line(p[7],p[5],st);m+=line(p[7],p[3],st);float sPhase=(sin(t+n)+sin(t*.1))*.25+.5;sPhase+=pow(sin(t*.1)*.5+.5,50.)*5.;m+=sparkle*sPhase;return m;}
void main(){vec2 uv=(gl_FragCoord.xy-iResolution.xy*.5)/iResolution.y;vec2 M=vec2(0.0);float t=iGlobalTime*.0005;float s=sin(t),c=cos(t);mat2 rot=mat2(c,-s,s,c);vec2 st=uv*rot;float m=0.;for(float i=0.;i<1.;i+=1./NUM_LAYERS){float z=fract(t+i);float size=mix(15.,0.,z);float fade=S(0.,.006,z)*S(0.,.08,z);m+=fade*NetLayer(st*size-M*z,i,iGlobalTime);}vec3 baseCol=vec3(s,cos(t*.1),-sin(t*.14))*.1+.1;vec3 col=baseCol*m;col*=1.-dot(uv,uv);t=mod(iGlobalTime,330.);col*=S(0.,20.,t)*S(224.,100.,t);gl_FragColor=vec4(col,1);}`;

window.addEventListener('load', () => {
    const canvas = document.getElementById('shader-bg');
    if (canvas && typeof GlslCanvas !== 'undefined') {
        const sandbox = new GlslCanvas(canvas);
        sandbox.load(frag);
    } else {
        console.error('GlslCanvas не загружен или canvas не найден');
    }
});
