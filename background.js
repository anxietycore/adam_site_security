precision mediump float;
varying vec2 vUv;
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;

#define S(a,b,t) smoothstep(a,b,t)
#define NUM_LAYERS 3.0

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
    return offs + vec2(sin(a*n1), cos(a*n2))*0.4; // УМЕНЬШЕНА АМПЛИТУДА
}

float df_line(vec2 a, vec2 b, vec2 p){
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa - ba*h);
}

float line(vec2 a, vec2 b, vec2 uv){
    float r1 = 0.004;
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
        
        // УПРОЩЁННЫЙ SPARKLE
        float s = 0.0015/(d*d + 0.001);
        float pulse = sin(t + n + float(i)) * 0.3 + 0.7;
        s *= pulse;
        sparkle += s;
    }

    // ВОССТАНАВЛИВАЕМ ВСЕ ЛИНИИ
    m += line(p[1],p[3],st);
    m += line(p[1],p[5],st);
    m += line(p[7],p[5],st);
    m += line(p[7],p[3],st);

    float sPhase = sin(t + n) * 0.3 + 0.7;
    m += sparkle * sPhase;

    return m;
}

void main(){
    vec2 fragCoord = vUv * iResolution.xy;
    float aspect = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord - iResolution.xy * 0.5) / aspect;
    vec2 M = iMouse.xy / iResolution.xy - 0.5;
    float t = iTime * 0.0003; // ЗАМЕДЛЕНА АНИМАЦИЯ

    float s = sin(t);
    float c = cos(t);
    mat2 rot = mat2(c, -s, s, c);
    vec2 st = uv * rot;
    M *= rot;

    float m = 0.0;
    for(float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYERS){
        float z = fract(t + i);
        // БОЛЬШЕ OVERLAP МЕЖДУ СЛОЯМИ
        float size = mix(25.0, 5.0, z);
        float fade = S(0.0, 0.01, z) * S(0.0, 0.15, z);
        m += fade * NetLayer(st * size - M * z, i, iTime);
    }

    vec3 baseCol = vec3(0.7, 0.7, 0.8);
    vec3 col = baseCol * m;
    col *= 2.2;
    col += vec3(0.12, 0.12, 0.15);
    gl_FragColor = vec4(col, 1.0);
}
