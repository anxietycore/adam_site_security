precision mediump float;
varying vec2 vUv;
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;

#define S(a,b,t) smoothstep(a,b,t)
#define NUM_LAYERS 3.0  // ЕДИНСТВЕННОЕ ИЗМЕНЕНИЕ - было 4.0

// ВСЁ ОСТАЛЬНОЕ КАК В ОРИГИНАЛЕ
float N21(vec2 p){
    vec3 a = fract(vec3(p.xyx)*vec3(613.897,553.453,80.098));
    a += dot(a,a.yzx+88.76);
    return fract((a.x+a.y)*a.z);
}

vec2 GetPos(vec2 id, vec2 offs, float t){
    float n = N21(id+offs);
    float n1 = fract(n*0.7);
    float n2 = fract(n*79.7);
    float a = t+n;
    return offs + vec2(sin(a*n1), cos(a*n2))*0.5;
}

float df_line(vec2 a, vec2 b, vec2 p){
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa - ba*h);
}

float line(vec2 a, vec2 b, vec2 uv){
    float r1 = 0.005;
    float r2 = 0.0001;
    float d = df_line(a,b,uv);
    float d2 = length(a-b);
    float fade = S(0.005,0.05,d2);
    fade += S(0.0005,0.0002,abs(d2-0.025));
    return S(r1,r2,d)*fade;
}

float NetLayer(vec2 st, float n, float t){
    vec2 id = floor(st)+n;
    st = fract(st)-0.5;

    vec2 p[9];
    p[0] = GetPos(id, vec2(-1.0,-1.0), t);
    p[1] = GetPos(id, vec2( 0.0,-1.0), t);
    p[2] = GetPos(id, vec2( 1.0,-1.0), t);
    p[3] = GetPos(id, vec2(-1.0, 0.0), t);
    p[4] = GetPos(id, vec2( 0.0, 0.0), t);
    p[5] = GetPos(id, vec2( 1.0, 0.0), t);
    p[6] = GetPos(id, vec2(-1.0, 1.0), t);
    p[7] = GetPos(id, vec2( 0.0, 1.0), t);
    p[8] = GetPos(id, vec2( 1.0, 1.0), t);

    float m = 0.0;
    float sparkle = 0.0;
    for (int i = 0; i < 9; i++) {
        vec2 pt = p[i];
        m += line(p[4], pt, st);
        float d = length(st - pt);
        float s = 0.002/(d*d + 0.0001);
        s *= S(1.0,0.1,d);
        float pulse = sin((fract(pt.x)+fract(pt.y)+t)*5.0)*0.4+0.6;
        pulse = pow(pulse,20.0);
        s *= pulse;
        sparkle += s;
    }

    m += line(p[1],p[3],st);
    m += line(p[1],p[5],st);
    m += line(p[7],p[5],st);
    m += line(p[7],p[3],st);

    float sPhase = (sin(t + n) + sin(t * 0.1)) * 0.25 + 0.5;
    sPhase += pow(sin(t * 0.1) * 0.5 + 0.5, 50.0) * 5.0;
    m += sparkle * sPhase;

    return m;
}

void main(){
    vec2 fragCoord = vUv * iResolution.xy;
    float aspect = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord - iResolution.xy * 0.5) / aspect;
    vec2 M = iMouse.xy / iResolution.xy - 0.5;
    float t = iTime * 0.0005;

    float s = sin(t);
    float c = cos(t);
    mat2 rot = mat2(c, -s, s, c);
    vec2 st = uv * rot;
    M *= rot;

    float m = 0.0;
    for(float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYERS){
        float z = fract(t + i);
        float size = mix(15.0, 0.0, z);
        float fade = S(0.0, 0.006, z) * S(0.0, 0.08, z);
        m += fade * NetLayer(st * size - M * z, i, iTime);
    }

    vec3 baseCol = vec3(s, cos(t * 0.1), -sin(t * 0.14)) * 0.3 + 0.3;
    vec3 col = baseCol * m;
    col *= 1.0;
    col *= 2.0;
    col += vec3(0.12, 0.12, 0.15);
    gl_FragColor = vec4(col, 1.0);
}
