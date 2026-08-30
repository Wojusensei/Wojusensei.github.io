// 星尘粒子系统：受鼠标影响的自稳定物理引擎
// - 每颗粒子有"锚点"，被鼠标搅动后以弹簧力回到锚点附近（自稳定）
// - 锚点自身缓慢漂移 + 亮度闪烁，像星野一样活着
// - 鼠标靠近时被推开，快速划过时还会被"尾流"拖走
// - 遵循 prefers-reduced-motion：静态渲染一帧

interface Particle {
  x: number; y: number; vx: number; vy: number;
  ax: number; ay: number;              // 锚点
  phase: number; speed: number; amp: number; // 锚点漂移
  size: number; alpha: number; tw: number;   // 亮度闪烁
}

const MOUSE_RADIUS = 130;
const SPRING = 0.014;
const DAMPING = 0.9;

export function initParticles() {
  const canvas = document.createElement('canvas');
  canvas.id = 'particle-canvas';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1;
  let particles: Particle[] = [];

  // 预渲染发光贴图，避免每帧画径向渐变
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 48;
  {
    const s = sprite.getContext('2d')!;
    const g = s.createRadialGradient(24, 24, 0, 24, 24, 24);
    g.addColorStop(0, 'rgba(225, 235, 255, 1)');
    g.addColorStop(0.25, 'rgba(190, 210, 255, 0.55)');
    g.addColorStop(1, 'rgba(190, 210, 255, 0)');
    s.fillStyle = g;
    s.fillRect(0, 0, 48, 48);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    spawn();
  }

  function spawn() {
    const n = Math.min(150, Math.round((W * H) / 16000));
    particles = Array.from({ length: n }, () => {
      const ax = Math.random() * W;
      const ay = Math.random() * H;
      return {
        x: ax, y: ay, vx: 0, vy: 0, ax, ay,
        phase: Math.random() * Math.PI * 2,
        speed: 0.05 + Math.random() * 0.12,
        amp: 10 + Math.random() * 26,
        size: 2.5 + Math.random() * 5.5,
        alpha: 0.25 + Math.random() * 0.5,
        tw: 0.4 + Math.random() * 1.4,
      };
    });
  }

  // 鼠标状态
  const mouse = { x: -9999, y: -9999, vx: 0, vy: 0, on: false };
  // 手电：平滑跟随鼠标的光斑（微型，低强度）
  const light = { x: -9999, y: -9999, a: 0 };
  let lastMX = 0, lastMY = 0;
  window.addEventListener('pointermove', (e) => {
    mouse.vx = e.clientX - lastMX;
    mouse.vy = e.clientY - lastMY;
    lastMX = e.clientX; lastMY = e.clientY;
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.on = true;
  }, { passive: true });
  window.addEventListener('pointerleave', () => { mouse.on = false; });
  window.addEventListener('blur', () => { mouse.on = false; });

  function step(t: number) {
    ctx!.clearRect(0, 0, W, H);
    ctx!.globalCompositeOperation = 'lighter';

    // 手电跟随：位置与强度都做插值，移开时缓缓熄灭
    if (mouse.on && !reduced) {
      if (light.x < -999) { light.x = mouse.x; light.y = mouse.y; }
      light.x += (mouse.x - light.x) * 0.14;
      light.y += (mouse.y - light.y) * 0.14;
      light.a += (1 - light.a) * 0.1;
    } else {
      light.a += (0 - light.a) * 0.06;
    }
    if (light.a > 0.01) {
      const wide = ctx!.createRadialGradient(light.x, light.y, 0, light.x, light.y, 300);
      wide.addColorStop(0, `rgba(205, 222, 255, ${0.10 * light.a})`);
      wide.addColorStop(1, 'rgba(205, 222, 255, 0)');
      ctx!.fillStyle = wide;
      ctx!.fillRect(light.x - 300, light.y - 300, 600, 600);
      const core = ctx!.createRadialGradient(light.x, light.y, 0, light.x, light.y, 120);
      core.addColorStop(0, `rgba(228, 238, 255, ${0.14 * light.a})`);
      core.addColorStop(1, 'rgba(228, 238, 255, 0)');
      ctx!.fillStyle = core;
      ctx!.fillRect(light.x - 120, light.y - 120, 240, 240);
    }

    for (const p of particles) {
      if (!reduced) {
        // 锚点缓慢漂移
        const anx = p.ax + Math.cos(t * p.speed + p.phase) * p.amp;
        const any = p.ay + Math.sin(t * p.speed * 0.9 + p.phase * 1.7) * p.amp;
        // 弹簧回锚（自稳定） + 阻尼
        p.vx += (anx - p.x) * SPRING;
        p.vy += (any - p.y) * SPRING;
        // 鼠标影响：近距离推开 + 尾流拖拽
        if (mouse.on) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < MOUSE_RADIUS * MOUSE_RADIUS) {
            const d = Math.sqrt(d2) || 1;
            const f = 1 - d / MOUSE_RADIUS;
            p.vx += (dx / d) * f * f * 1.1 + mouse.vx * f * 0.22;
            p.vy += (dy / d) * f * f * 1.1 + mouse.vy * f * 0.22;
          }
        }
        p.vx *= DAMPING;
        p.vy *= DAMPING;
        p.x += p.vx;
        p.y += p.vy;
      }
      const twinkle = reduced ? 1 : 0.65 + 0.35 * Math.sin(t * p.tw + p.phase);
      // 手电范围内的粒子被照亮、微微放大
      let boost = 1;
      if (light.a > 0.01) {
        const dx = p.x - light.x;
        const dy = p.y - light.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 260) boost = 1 + (1 - d / 260) * 1.8 * light.a;
      }
      const s = p.size * (0.9 + 0.1 * boost);
      ctx!.globalAlpha = Math.min(0.95, p.alpha * twinkle * boost);
      ctx!.drawImage(sprite, p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx!.globalAlpha = 1;
    ctx!.globalCompositeOperation = 'source-over';
  }

  resize();
  window.addEventListener('resize', resize);

  if (reduced) {
    step(0);
  } else {
    let running = true;
    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(loop);
    });
    const loop = (now: number) => {
      if (!running) return;
      step(now / 1000);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
