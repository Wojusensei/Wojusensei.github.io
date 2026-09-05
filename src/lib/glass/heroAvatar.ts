// 首页头像的鼠标互动：连续插值的倾斜/平移跟随
// 替代原先 hover 跳变式的 CSS 过渡——指针在主视觉区内移动时，
// 圆章朝指针方向轻微偏转/平移，离开后缓慢回正，全程 rAF lerp（每帧靠近 7%）。
// 仅响应鼠标（触摸滚动不触发）；prefers-reduced-motion 直接不启用。

export function initHeroAvatar() {
  const section = document.querySelector<HTMLElement>('.hero-main');
  const disc = document.querySelector<HTMLElement>('.hero-standee');
  if (!section || !disc) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const target = { rx: 0, ry: 0, tx: 0, ty: 0 };
  const cur = { rx: 0, ry: 0, tx: 0, ty: 0 };
  let raf = 0;

  const tick = () => {
    if (!disc.isConnected) { raf = 0; return; } // 导航换页后旧元素直接停
    cur.rx += (target.rx - cur.rx) * 0.07;
    cur.ry += (target.ry - cur.ry) * 0.07;
    cur.tx += (target.tx - cur.tx) * 0.07;
    cur.ty += (target.ty - cur.ty) * 0.07;
    disc.style.transform =
      `perspective(900px) rotateX(${cur.rx.toFixed(2)}deg) rotateY(${cur.ry.toFixed(2)}deg)` +
      ` translate(${cur.tx.toFixed(1)}px, ${cur.ty.toFixed(1)}px)`;
    const drift =
      Math.abs(cur.rx - target.rx) + Math.abs(cur.ry - target.ry) +
      Math.abs(cur.tx - target.tx) + Math.abs(cur.ty - target.ty);
    if (drift > 0.01) raf = requestAnimationFrame(tick);
    else raf = 0;
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

  section.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = disc.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 1.6)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 1.6)));
    target.ry = nx * 4;      // 朝指针方向偏转
    target.rx = -ny * 4;
    target.tx = nx * 7;
    target.ty = ny * 6;
    wake();
  }, { passive: true });

  section.addEventListener('pointerleave', () => {
    target.rx = 0; target.ry = 0; target.tx = 0; target.ty = 0;
    wake();
  }, { passive: true });
}
