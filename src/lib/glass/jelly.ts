// 果冻弹性物理（DOM 层）
// - .g-card：跟随指针轻微倾斜 + 按压压扁，松手后欠阻尼弹簧回弹
// - .g-btn / .nav-links a：点击时脉冲缩放，并向物理世界发送一次"爆发"事件（液滴被震开）
// 全部走统一的阻尼弹簧积分器，遵循 prefers-reduced-motion。

const SPRING_K = 170;
const SPRING_D = 13;

interface State {
  el: HTMLElement;
  tx: number; ty: number; rx: number; ry: number; s: number;
  vrx: number; vry: number; vs: number;
  hover: boolean; pressed: boolean;
  settled: boolean;
}

const states: State[] = [];
let raf = 0;
let last = 0;

function tick(now: number) {
  const dt = Math.min((now - last) / 1000, 0.033) || 0.016;
  last = now;
  let active = false;
  for (const st of states) {
    const tRx = st.hover ? st.rx : 0;
    const tRy = st.hover ? st.ry : 0;
    // 倾斜：弹簧追踪目标
    st.vrx += (-(st.rx) * SPRING_K - (st.hover ? 0 : st.vrx * SPRING_D)) * dt * 10;
    st.vry += (-(st.ry) * SPRING_K - (st.hover ? 0 : st.vry * SPRING_D)) * dt * 10;
    st.rx += st.vrx * dt;
    st.ry += st.vry * dt;
    // 缩放：欠阻尼弹簧回到 1
    st.vs += (-(st.s - 1) * SPRING_K * 14 - st.vs * SPRING_D * 1.1) * dt;
    st.s += st.vs * dt;

    if (!st.hover && Math.abs(st.rx) < 0.001 && Math.abs(st.ry) < 0.001 && Math.abs(st.s - 1) < 0.001) {
      if (!st.settled) {
        st.el.style.transform = '';
        st.settled = true;
      }
      continue;
    }
    st.settled = false;
    active = true;
    st.el.style.transform =
      `perspective(700px) rotateX(${st.rx.toFixed(2)}deg) rotateY(${st.ry.toFixed(2)}deg) scale(${st.s.toFixed(4)})`;
  }
  raf = active ? requestAnimationFrame(tick) : 0;
}

function wake() {
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
}

function burst(x: number, y: number) {
  window.dispatchEvent(new CustomEvent('woju-burst', { detail: { x, y } }));
}

export function initJelly() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll<HTMLElement>('.g-card').forEach((el) => {
    const st: State = { el, tx: 0, ty: 0, rx: 0, ry: 0, s: 1, vrx: 0, vry: 0, vs: 0, hover: false, pressed: false, settled: true };
    states.push(st);

    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      st.hover = true;
      wake();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !st.hover) return;
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      st.ry = nx * 3.2;   // 向指针方向倾斜
      st.rx = -ny * 2.6;
      wake();
    });
    el.addEventListener('pointerleave', () => {
      st.hover = false;
      wake();
    });
    el.addEventListener('pointerdown', () => {
      st.pressed = true;
      st.vs -= 2.2; // 压扁冲量
      wake();
    });
    const release = () => {
      if (!st.pressed) return;
      st.pressed = false;
      st.vs += 3.4; // 回弹过冲
      wake();
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
  });

  // 按钮与导航：点击脉冲 + 震开液滴
  const pulse = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    el.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(0.9)', offset: 0.35 },
        { transform: 'scale(1.06)', offset: 0.7 },
        { transform: 'scale(1)' },
      ],
      { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    );
    burst(r.left + r.width / 2, r.top + r.height / 2);
  };
  document.querySelectorAll<HTMLElement>('.g-btn, .nav-links a').forEach((el) => {
    el.addEventListener('click', () => pulse(el));
  });
}
