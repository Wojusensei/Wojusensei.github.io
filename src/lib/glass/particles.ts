// 背景层：星尘粒子 + 手电跟随 + 流星雨（左上→右下）+ 鼠标视差 + 点击涟漪
// 全部绘制在同一张画布上，会被液态玻璃卡片真实折射
// 支持跨页面导航（View Transitions）：重复 init 前先完整拆掉上一份监听与动画循环

interface Particle {
  x: number; y: number; vx: number; vy: number;
  ax: number; ay: number;              // 锚点
  phase: number; speed: number; amp: number; // 锚点漂移
  size: number; alpha: number; tw: number;   // 亮度闪烁
}

// 流星：统一从左上划向右下，渐隐尾迹
interface Meteor {
  x: number; y: number;
  vx: number; vy: number;
  life: number; ttl: number;
  len: number;
}

// 点击涟漪
interface Ripple {
  x: number; y: number; life: number; ttl: number;
}

const MOUSE_RADIUS = 130;
const SPRING = 0.014;
const DAMPING = 0.9;

let teardownPrev: (() => void) | null = null;

export function initParticles() {
  teardownPrev?.();
  teardownPrev = null;

  const canvas = document.createElement('canvas');
  canvas.id = 'particle-canvas';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 统一登记监听器，teardown 时一次拆干净
  const disposers: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(
    target: EventTarget, type: K | string, fn: EventListenerOrEventListenerObject, opts?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, fn, opts);
    disposers.push(() => target.removeEventListener(type, fn, opts));
  };

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

  // ---- 流星雨：全部从左上划向右下，高频密集，偶发爆发 ----
  let meteors: Meteor[] = [];
  let spawnTimer = 0.3;
  let lastFrame = 0;

  function spawnMeteor() {
    const angle = (26 + Math.random() * 14) * (Math.PI / 180); // 26°~40°，统一左上→右下
    const speed = 900 + Math.random() * 800;
    let x: number, y: number;
    if (Math.random() < 0.7) {
      x = -140 + Math.random() * W * 0.85;
      y = -60;
    } else {
      x = -140;
      y = -40 + Math.random() * H * 0.55;
    }
    meteors.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      ttl: 0.8 + Math.random() * 0.9,
      len: 100 + Math.random() * 150,
    });
  }

  // ---- 鼠标/陀螺仪视差（很轻）----
  const parallax = { tx: 0, ty: 0, x: 0, y: 0 };

  let lastMX = 0, lastMY = 0;
  on(window, 'pointermove', ((e: PointerEvent) => {
    mouse.vx = e.clientX - lastMX;
    mouse.vy = e.clientY - lastMY;
    lastMX = e.clientX; lastMY = e.clientY;
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.on = true;
    const nx = e.clientX / Math.max(W, 1) - 0.5;
    const ny = e.clientY / Math.max(H, 1) - 0.5;
    parallax.tx = nx * -14; // 反向漂移，幅度刻意很轻
    parallax.ty = ny * -9;
  }) as EventListener, { passive: true });
  on(window, 'pointerleave', () => { mouse.on = false; });
  on(window, 'blur', () => { mouse.on = false; });

  // 移动端陀螺仪视差（iOS 需授权后才有事件，无事件则自动无效果）
  on(window, 'deviceorientation', ((e: DeviceOrientationEvent) => {
    const g = Math.max(-30, Math.min(30, e.gamma ?? 0));
    const b = Math.max(-30, Math.min(30, (e.beta ?? 0) - 40));
    parallax.tx = (-g / 30) * 10;
    parallax.ty = (b / 30) * 7;
  }) as EventListener);

  // ---- 点击涟漪 ----
  const ripples: Ripple[] = [];
  on(window, 'pointerdown', ((e: PointerEvent) => {
    if (!reduced) ripples.push({ x: e.clientX, y: e.clientY, life: 0, ttl: 0.75 });
  }) as EventListener, { passive: true });

  const mouse = { x: -9999, y: -9999, vx: 0, vy: 0, on: false };
  // 手电：平滑跟随鼠标的光斑（微型，低强度）
  const light = { x: -9999, y: -9999, a: 0 };

  function step(t: number) {
    ctx!.clearRect(0, 0, W, H);
    ctx!.globalCompositeOperation = 'lighter';

    const dt = Math.min(Math.max(t - lastFrame, 0), 0.05);
    lastFrame = t;

    // ---- 视差：插值 + 写入 CSS 变量驱动背景照片层 ----
    if (!reduced) {
      parallax.x += (parallax.tx - parallax.x) * 0.045;
      parallax.y += (parallax.ty - parallax.y) * 0.045;
      document.documentElement.style.setProperty('--bg-px', parallax.x.toFixed(2) + 'px');
      document.documentElement.style.setProperty('--bg-py', parallax.y.toFixed(2) + 'px');
    }

    // ---- 手电跟随：位置与强度都做插值，移开时缓缓熄灭 ----
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

    // ---- 流星雨：持续高频生成，偶发小爆发 ----
    if (!reduced) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnMeteor();
        if (Math.random() < 0.4) {
          spawnMeteor();
          if (Math.random() < 0.35) spawnMeteor();
        }
        spawnTimer = 0.22 + Math.random() * 0.42; // 0.22~0.64s 一波
      }
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.life += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const k = m.life / m.ttl;
      if (k >= 1 || m.y > H + 220 || m.x > W + 260) {
        meteors.splice(i, 1);
        continue;
      }
      const alpha = k < 0.18 ? k / 0.18 : 1 - (k - 0.18) / 0.82;
      const sp = Math.hypot(m.vx, m.vy) || 1;
      const tx = m.x - (m.vx / sp) * m.len;
      const ty = m.y - (m.vy / sp) * m.len;
      const grad = ctx!.createLinearGradient(tx, ty, m.x, m.y);
      grad.addColorStop(0, 'rgba(190, 210, 255, 0)');
      grad.addColorStop(0.75, `rgba(205, 224, 255, ${0.38 * alpha})`);
      grad.addColorStop(1, `rgba(240, 246, 255, ${0.92 * alpha})`);
      ctx!.strokeStyle = grad;
      ctx!.lineWidth = 1.6;
      ctx!.lineCap = 'round';
      ctx!.beginPath();
      ctx!.moveTo(tx, ty);
      ctx!.lineTo(m.x, m.y);
      ctx!.stroke();
      ctx!.globalAlpha = Math.min(1, alpha);
      ctx!.drawImage(sprite, m.x - 7, m.y - 7, 14, 14);
      ctx!.globalAlpha = 1;
    }

    // ---- 点击涟漪：玻璃圆环扩散 ----
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.life += dt;
      const k = rp.life / rp.ttl;
      if (k >= 1) { ripples.splice(i, 1); continue; }
      const fade = 1 - k;
      const rad = 12 + k * 115;
      ctx!.strokeStyle = `rgba(205, 224, 255, ${0.34 * fade})`;
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.arc(rp.x, rp.y, rad, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.strokeStyle = `rgba(228, 238, 255, ${0.18 * fade})`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.arc(rp.x, rp.y, rad * 0.62, 0, Math.PI * 2);
      ctx!.stroke();
    }

    // ---- 星尘粒子 ----
    for (const p of particles) {
      if (!reduced) {
        const anx = p.ax + Math.cos(t * p.speed + p.phase) * p.amp;
        const any = p.ay + Math.sin(t * p.speed * 0.9 + p.phase * 1.7) * p.amp;
        p.vx += (anx - p.x) * SPRING;
        p.vy += (any - p.y) * SPRING;
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

  let rafId = 0;
  let running = true;

  resize();
  on(window, 'resize', resize);

  if (reduced) {
    step(0);
  } else {
    on(document, 'visibilitychange', () => {
      running = !document.hidden;
      if (running) {
        lastFrame = performance.now() / 1000; // 避免隐藏期间累积出大 dt
        rafId = requestAnimationFrame(loop);
      }
    });
    const loop = (now: number) => {
      if (!running) return;
      step(now / 1000);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  teardownPrev = () => {
    disposers.forEach((d) => d());
    running = false;
    cancelAnimationFrame(rafId);
    canvas.remove();
    document.documentElement.style.removeProperty('--bg-px');
    document.documentElement.style.removeProperty('--bg-py');
  };
}
