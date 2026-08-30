// 物理世界：Matter.js 驱动的玻璃液滴
// - 零重力漂浮 + 缓慢游走目标，液滴之间完全弹性碰撞
// - 空白处按住可抓取液滴，甩动即可抛掷（速度自然继承）
// - 页面滚动时液滴受到与滚动方向一致的冲击
// - impulseAt() 供按钮点击时向外爆开一圈液滴

import Matter from 'matter-js';

export interface GrabController {
  step(dtMs: number): void;
  impulseAt(x: number, y: number, radius: number, power: number): void;
  scrollKick(dy: number): void;
  resize(): void;
  destroy(): void;
  readonly droplets: Matter.Body[];
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function initPhysics(): GrabController {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });

  let W = window.innerWidth;
  let H = window.innerHeight;

  // 液滴数量随屏幕面积自适应
  const count = clamp(Math.round((W * H) / 190000), 5, 10);
  const smallScreen = Math.min(W, H) < 640;

  const droplets: Matter.Body[] = [];
  const placed: { x: number; y: number; r: number }[] = [];

  for (let i = 0; i < count; i++) {
    const r = smallScreen ? 24 + Math.random() * 22 : 30 + Math.random() * 36;
    let x = 0, y = 0, ok = false;
    for (let tries = 0; tries < 40 && !ok; tries++) {
      x = r + Math.random() * (W - 2 * r);
      y = r + Math.random() * (H - 2 * r);
      ok = placed.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + 40);
    }
    placed.push({ x, y, r });
    const body = Matter.Bodies.circle(x, y, r, {
      restitution: 0.9,
      friction: 0,
      frictionAir: 0.012,
      density: 0.0012,
      label: 'droplet',
    });
    (body as unknown as { plugin: Record<string, unknown> }).plugin = {
      wanderX: x,
      wanderY: y,
      nextWander: Math.random() * 4000,
      seed: Math.random(),
    };
    Matter.Body.setVelocity(body, {
      x: (Math.random() - 0.5) * 1.6,
      y: (Math.random() - 0.5) * 1.6,
    });
    droplets.push(body);
    Matter.Composite.add(engine.world, body);
  }

  // 边界墙（resize 时重建）
  let walls: Matter.Body[] = [];
  function buildWalls() {
    if (walls.length) Matter.Composite.remove(engine.world, walls);
    const T = 300;
    walls = [
      Matter.Bodies.rectangle(W / 2, -T / 2, W + 2 * T, T, { isStatic: true }),
      Matter.Bodies.rectangle(W / 2, H + T / 2, W + 2 * T, T, { isStatic: true }),
      Matter.Bodies.rectangle(-T / 2, H / 2, T, H + 2 * T, { isStatic: true }),
      Matter.Bodies.rectangle(W + T / 2, H / 2, T, H + 2 * T, { isStatic: true }),
    ];
    Matter.Composite.add(engine.world, walls);
  }
  buildWalls();

  // ---- 抓取与抛掷：只在空白处抓液滴，不干扰卡片和按钮 ----
  let grab: Matter.Constraint | null = null;
  let grabBody: Matter.Body | null = null;
  const pointer = { x: 0, y: 0, down: false };

  function interactiveUnder(x: number, y: number): boolean {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    return !!el.closest('a, button, input, textarea, select, [data-no-grab]');
  }

  function onDown(e: PointerEvent) {
    if (interactiveUnder(e.clientX, e.clientY)) return;
    let best: Matter.Body | null = null;
    let bestD = Infinity;
    for (const b of droplets) {
      const d = Math.hypot(b.position.x - e.clientX, b.position.y - e.clientY);
      const grabR = Math.max((b.circleRadius ?? 30) + 26, 72);
      if (d < grabR && d < bestD) { best = b; bestD = d; }
    }
    if (!best) return;
    // 抓液滴时不要让浏览器顺带选中文字 / 触发原生拖拽
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    document.body.style.userSelect = 'none';
    pointer.down = true;
    grabBody = best;
    grab = Matter.Constraint.create({
      pointA: { x: e.clientX, y: e.clientY },
      bodyB: best,
      stiffness: 0.08,
      damping: 0.14,
      length: 0,
    });
    Matter.Composite.add(engine.world, grab);
  }

  function onMove(e: PointerEvent) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (grab) grab.pointA = { x: e.clientX, y: e.clientY };
  }

  function onUp() {
    pointer.down = false;
    document.body.style.userSelect = '';
    if (grab) { Matter.Composite.remove(engine.world, grab); grab = null; }
    grabBody = null;
  }

  window.addEventListener('pointerdown', onDown, { passive: false });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });

  // ---- 滚动冲击：页面滚动时液滴跟着被"甩"一下 ----
  let lastScrollY = window.scrollY;
  let scrollKickV = 0;
  function onScroll() {
    const dy = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    scrollKickV = clamp(scrollKickV + dy * 0.05, -14, 14);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  const api: GrabController = {
    get droplets() { return droplets; },

    step(dtMs: number) {
      // 每颗液滴周期性换一个游走目标，缓慢漂移
      for (const b of droplets) {
        const p = (b as unknown as { plugin: { wanderX: number; wanderY: number; nextWander: number } }).plugin;
        p.nextWander -= dtMs;
        if (p.nextWander <= 0) {
          p.nextWander = 2600 + Math.random() * 3600;
          const m = 90;
          p.wanderX = clamp(b.position.x + (Math.random() - 0.5) * W * 0.5, m, W - m);
          p.wanderY = clamp(b.position.y + (Math.random() - 0.5) * H * 0.5, m, H - m);
        }
        const dx = p.wanderX - b.position.x;
        const dy = p.wanderY - b.position.y;
        Matter.Body.applyForce(b, b.position, { x: dx * 4e-7 * b.mass, y: dy * 4e-7 * b.mass });
      }
      // 滚动冲击衰减
      if (Math.abs(scrollKickV) > 0.01) {
        for (const b of droplets) {
          Matter.Body.setVelocity(b, { x: b.velocity.x, y: b.velocity.y + scrollKickV * 0.12 });
        }
        scrollKickV *= 0.86;
      }
      Matter.Engine.update(engine, dtMs);
    },

    impulseAt(x: number, y: number, radius: number, power: number) {
      for (const b of droplets) {
        const dx = b.position.x - x;
        const dy = b.position.y - y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < radius) {
          const f = (1 - d / radius) * power * b.mass;
          Matter.Body.applyForce(b, b.position, { x: (dx / d) * f * 0.001, y: (dy / d) * f * 0.001 });
        }
      }
    },

    resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      buildWalls();
      for (const b of droplets) {
        const r = b.circleRadius ?? 30;
        if (b.position.x < r || b.position.x > W - r || b.position.y < r || b.position.y > H - r) {
          Matter.Body.setPosition(b, {
            x: clamp(b.position.x, r + 10, W - r - 10),
            y: clamp(b.position.y, r + 10, H - r - 10),
          });
        }
      }
    },

    destroy() {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('scroll', onScroll);
      Matter.Composite.clear(engine.world, false);
    },
  };

  return api;
}

// 无障碍（prefers-reduced-motion）：液滴静止摆放，仍有玻璃质感
export function staticDroplets(): { list: { x: number; y: number; vx: number; vy: number; r: number; seed: number }[] } {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const n = 6;
  const list: { x: number; y: number; vx: number; vy: number; r: number; seed: number }[] = [];
  for (let i = 0; i < n; i++) {
    list.push({
      x: (0.18 + 0.65 * ((i * 0.37) % 1)) * W,
      y: (0.2 + 0.6 * ((i * 0.53) % 1)) * H,
      vx: 0, vy: 0,
      r: 34 + ((i * 17) % 26),
      seed: i * 0.618,
    });
  }
  return { list };
}
