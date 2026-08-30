// Liquid Glass 渲染引擎（WebGL2）
// 单个全屏 pass：先程序化生成"背景世界"（渐变色斑 + 点阵），
// 再对物理液滴的 SDF 做平滑合并（smin），按折射率弯曲采样光线，
// 叠加边缘透镜、色散、镜面高光、菲涅尔轮辉与接触阴影。
// 这是"真折射"：背景在玻璃边缘被弯曲，而不是 backdrop-filter 的模糊。

export interface DropletRender {
  x: number; // CSS px, y 向下
  y: number;
  vx: number; // px / step
  vy: number;
  r: number;
  seed: number;
}

const MAX_DROPS = 12;

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;
uniform float uTheme;      // 0 亮色 → 1 暗色（JS 侧做插值过渡）
uniform int   uCount;
uniform vec2  uPos[${MAX_DROPS}];
uniform vec2  uVel[${MAX_DROPS}];
uniform float uRad[${MAX_DROPS}];
uniform float uSeed[${MAX_DROPS}];
uniform vec2  uPointer;
uniform float uPointerOn;

const float K_SMIN = 14.0;

float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

// 液滴沿速度方向被"拉长"——运动越快越扁长，像真实液体
vec2 toLocal(vec2 p, int i){
  vec2 v = uVel[i];
  float vl = length(v);
  float sp = clamp(vl * 0.012, 0.0, 0.42);
  vec2 dir = vl > 0.001 ? normalize(v) : vec2(1.0, 0.0);
  vec2 d = p - uPos[i];
  float along = dot(d, dir) / (1.0 + sp);
  float perp  = dot(d, vec2(-dir.y, dir.x)) / (1.0 - sp*0.55);
  return vec2(along, perp);
}

float dropletField(vec2 p){
  float d = 1e5;
  for(int i=0;i<${MAX_DROPS};i++){
    if(i >= uCount) break;
    vec2 lp = toLocal(p, i);
    float wob = 1.0 + 0.05*sin(uTime*1.7 + uSeed[i]*6.2832)
                     + 0.03*cos(uTime*2.4 + uSeed[i]*12.566);
    d = smin(d, length(lp) - uRad[i]*wob, K_SMIN);
  }
  return d;
}

vec3 scene(vec2 p){
  vec3 base = mix(vec3(0.937,0.949,0.980), vec3(0.043,0.059,0.106), uTheme);
  for(int i=0;i<3;i++){
    float fi = float(i);
    vec2 c = uRes * (0.5 + 0.42*vec2(sin(uTime*(0.10+0.04*fi)+fi*2.4),
                                     cos(uTime*(0.085+0.05*fi)+fi*4.9)));
    float rad = uRes.y * (0.52 + 0.14*fi);
    float g = 1.0 - smoothstep(0.0, rad, length(p - c));
    vec3 cl = fi < 0.5 ? vec3(0.62,0.53,0.98) : (fi < 1.5 ? vec3(0.36,0.64,0.98) : vec3(0.20,0.83,0.60));
    vec3 cd = fi < 0.5 ? vec3(0.42,0.40,0.98) : (fi < 1.5 ? vec3(0.55,0.38,0.98) : vec3(0.13,0.78,0.90));
    base = mix(base, mix(cl, cd, uTheme), g * mix(0.16, 0.30, uTheme));
  }
  // 细点阵：让折射的弯曲肉眼可见
  vec2 gp = mod(p, 30.0) - 15.0;
  float dt = 1.0 - smoothstep(1.1, 1.7, length(gp));
  base = mix(base, mix(vec3(0.42,0.47,0.58), vec3(0.72,0.78,0.92), uTheme),
             dt * mix(0.10, 0.13, uTheme));
  return base;
}

void main(){
  vec2 p = gl_FragCoord.xy;
  float d = dropletField(p);
  float eps = 1.5;
  vec2 g = vec2(dropletField(p + vec2(eps, 0.0)) - d,
                dropletField(p + vec2(0.0, eps)) - d);
  g /= max(length(g), 1e-4);   // SDF 梯度 = 表面外法线（2D 投影）

  vec3 col;
  if(d < 0.0){
    float edge = 1.0 - smoothstep(0.0, 36.0, -d);   // 越靠近边缘越强
    float rim  = smoothstep(0.0, 9.0, -d);          // 边缘薄薄一圈
    vec2 off = -g * (5.0 + 26.0*edge) - g * (1.0 - rim) * 24.0;
    vec3 cR = scene(p + off * 0.90);
    vec3 cG = scene(p + off);
    vec3 cB = scene(p + off * 1.10);
    col = vec3(cR.r, cG.g, cB.b);                   // 色散
    col = mix(col * 0.99 + 0.02, col * 1.04 + 0.012, uTheme);
    vec2 L1 = normalize(vec2(-0.55, 0.82));
    vec2 L2 = normalize(vec2(0.45, -0.75));
    float s1 = pow(max(dot(g, L1), 0.0), 70.0) * (0.20 + 0.85*edge);
    float s2 = pow(max(dot(g, L2), 0.0), 90.0) * 0.5 * edge;
    float rimGlow = (1.0 - rim) * mix(0.20, 0.32, uTheme);
    col += s1 + s2;
    col += rimGlow * mix(vec3(1.0,1.0,1.0), vec3(0.75,0.83,1.0), uTheme);
  } else {
    vec3 bg = scene(p);
    float halo = 1.0 - smoothstep(0.0, 44.0, d);    // 玻璃周围背景被轻微弯曲
    col = mix(bg, scene(p - g * 16.0 * halo), halo * 0.55);
    col *= 1.0 - (1.0 - smoothstep(0.0, 15.0, d)) * 0.07;  // 接触阴影
  }

  float pg = uPointerOn * (1.0 - smoothstep(0.0, 280.0, length(p - uPointer)));
  col += pg * 0.045 * mix(0.35, 1.0, uTheme);

  outColor = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

export class GlassEngine {
  private gl: WebGL2RenderingContext;
  private uRes!: WebGLUniformLocation;
  private uTime!: WebGLUniformLocation;
  private uTheme!: WebGLUniformLocation;
  private uCount!: WebGLUniformLocation;
  private uPos!: WebGLUniformLocation;
  private uVel!: WebGLUniformLocation;
  private uRad!: WebGLUniformLocation;
  private uSeed!: WebGLUniformLocation;
  private uPointer!: WebGLUniformLocation;
  private uPointerOn!: WebGLUniformLocation;

  private posBuf = new Float32Array(MAX_DROPS * 2);
  private velBuf = new Float32Array(MAX_DROPS * 2);
  private radBuf = new Float32Array(MAX_DROPS);
  private seedBuf = new Float32Array(MAX_DROPS);

  private theme = 0;
  private themeTarget = 0;
  private droplets: DropletRender[] = [];
  private pointer = { x: 0, y: 0, on: 0 };
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('link: ' + gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const u = (n: string) => gl.getUniformLocation(prog, n);
    this.uRes = u('uRes');
    this.uTime = u('uTime');
    this.uTheme = u('uTheme');
    this.uCount = u('uCount');
    this.uPos = u('uPos[0]');
    this.uVel = u('uVel[0]');
    this.uRad = u('uRad[0]');
    this.uSeed = u('uSeed[0]');
    this.uPointer = u('uPointer');
    this.uPointerOn = u('uPointerOn');

    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(window.innerWidth * this.dpr));
    const h = Math.max(1, Math.round(window.innerHeight * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  setTheme(dark: boolean, immediate = false) {
    this.themeTarget = dark ? 1 : 0;
    if (immediate) this.theme = this.themeTarget;
  }

  setPointer(cssX: number, cssY: number, on: boolean) {
    this.pointer = { x: cssX, y: window.innerHeight - cssY, on: on ? 1 : 0 };
  }

  setDroplets(list: DropletRender[]) {
    this.droplets = list;
  }

  // 主题切换 / 无障碍静态模式下的单帧渲染
  renderOnce(nowMs: number) {
    this.draw(nowMs);
  }

  draw(nowMs: number) {
    const gl = this.gl;
    this.theme += (this.themeTarget - this.theme) * 0.06;
    if (Math.abs(this.themeTarget - this.theme) < 0.003) this.theme = this.themeTarget;

    const H = window.innerHeight;
    const n = Math.min(this.droplets.length, MAX_DROPS);
    for (let i = 0; i < n; i++) {
      const d = this.droplets[i];
      this.posBuf[i * 2] = d.x * this.dpr;
      this.posBuf[i * 2 + 1] = (H - d.y) * this.dpr; // gl_FragCoord y 轴朝上
      this.velBuf[i * 2] = d.vx * this.dpr;
      this.velBuf[i * 2 + 1] = -d.vy * this.dpr;
      this.radBuf[i] = d.r * this.dpr;
      this.seedBuf[i] = d.seed;
    }
    for (let i = n; i < MAX_DROPS; i++) this.radBuf[i] = 0;

    gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uTime, nowMs / 1000);
    gl.uniform1f(this.uTheme, this.theme);
    gl.uniform1i(this.uCount, n);
    gl.uniform2fv(this.uPos, this.posBuf);
    gl.uniform2fv(this.uVel, this.velBuf);
    gl.uniform1fv(this.uRad, this.radBuf);
    gl.uniform1fv(this.uSeed, this.seedBuf);
    gl.uniform2f(this.uPointer, this.pointer.x * this.dpr, this.pointer.y * this.dpr);
    gl.uniform1f(this.uPointerOn, this.pointer.on);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
