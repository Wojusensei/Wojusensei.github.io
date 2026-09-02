// 玻璃板块的重力倾斜系统（自稳定，克制的幅度）
// - 悬停：卡片向指针方向极轻微倾斜（随动插值，无弹簧抖动）
// - 按住：卡片像被"吊"在按点上有重力地下垂、下沉，松手后平滑回正
// - 全程用同一 rAF 插值器，幅度小、阻尼重，保持"厚玻璃"的沉稳手感

const LERP = 0.09; // 插值速度：越小越沉稳

// getBoundingClientRect 每次调用都强制布局；
// pointermove 一帧可能触发多次，这里按 ~一帧的时间窗缓存，密集移动时只读一次
const rectCache = new WeakMap<HTMLElement, { at: number; rect: DOMRect }>();
function getRect(el: HTMLElement): DOMRect {
  const now = performance.now();
  const cached = rectCache.get(el);
  if (cached && now - cached.at < 32) return cached.rect;
  const rect = el.getBoundingClientRect();
  rectCache.set(el, { at: now, rect });
  return rect;
}

interface TiltState {
  el: HTMLElement;
  rx: number; ry: number; lift: number;       // 当前
  trx: number; try_: number; tlift: number;   // 目标
  pressing: boolean; hovering: boolean;
  settled: boolean;
}

const states: TiltState[] = [];
let raf = 0;

function tick() {
  let active = false;
  for (const s of states) {
    s.rx += (s.trx - s.rx) * LERP;
    s.ry += (s.try_ - s.ry) * LERP;
    s.lift += (s.tlift - s.lift) * LERP;

    if (!s.hovering && !s.pressing &&
        Math.abs(s.rx) < 0.02 && Math.abs(s.ry) < 0.02 && Math.abs(s.lift) < 0.05) {
      if (!s.settled) {
        s.el.style.transform = '';
        s.settled = true;
      }
      continue;
    }
    s.settled = false;
    active = true;
    s.el.style.transform =
      `perspective(900px) rotateX(${s.rx.toFixed(2)}deg) rotateY(${s.ry.toFixed(2)}deg) translateY(${s.lift.toFixed(2)}px)`;
  }
  raf = active ? requestAnimationFrame(tick) : 0;
}

function wake() {
  if (!raf) raf = requestAnimationFrame(tick);
}

export function initTilt() {
  // 跨页面导航重入：清掉上一页卡片的插值状态，避免数组无限增长
  states.length = 0;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover)').matches) return; // 触屏不启用

  document.querySelectorAll<HTMLElement>('.g-card').forEach((el) => {
    const s: TiltState = {
      el, rx: 0, ry: 0, lift: 0, trx: 0, try_: 0, tlift: 0,
      pressing: false, hovering: false, settled: true,
    };
    states.push(s);

    // 悬停：轻微朝指针倾斜 + 上浮 3px
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      s.hovering = true;
      if (!s.pressing) s.tlift = -3;
      wake();
    });

    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = getRect(el);
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;  // -1..1
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (s.pressing) {
        // 按住：像被吊在按点上，重力下垂（幅度大于悬停）
        s.try_ = nx * 5;
        s.trx = -ny * 4;
        s.tlift = 3;
      } else {
        s.try_ = nx * 1.6;
        s.trx = -ny * 1.4;
        s.tlift = -3;
      }
      wake();
    });

    const release = () => {
      s.pressing = false;
      s.trx = 0; s.try_ = 0;
      s.tlift = s.hovering ? -3 : 0;
      wake();
    };

    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      s.pressing = true;
      // 立即产生一次下垂趋势
      const r = getRect(el);
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      s.try_ = nx * 5;
      s.trx = -ny * 4;
      s.tlift = 3;
      wake();
    });
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', () => {
      s.hovering = false;
      release();
    });
  });
}
