// 页面入场编排：加载时全部目标元素按 DOM 顺序错峰淡入上浮
// 设计取舍（站长反馈驱动）：
//   - 不用 IntersectionObserver/滚动触发——观察器任何一环出错都会让内容永久卡在隐藏态，
//     且「滚动到才弹出」容易被访客当成 bug
//   - 纯时间驱动：动画必然播完，下方内容在屏外就完成入场，滚到时永远已就位
//   - 无 JS 环境不加隐藏类，内容照常显示；prefers-reduced-motion 直接跳过

const SELECTOR = [
  '.g-card',
  '.section-head',
  '.blog-stats',
  '.hero-copy',
  '.hero-standee',
  '.post-adj',
].join(', ');

export function initReveal() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const targets = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
  if (!targets.length) return;

  targets.forEach((el, i) => {
    if (el.classList.contains('reveal-in')) return;
    el.classList.add('reveal-init');
    // 错峰入场：按 DOM 顺序每个 60ms，总时长封顶 400ms
    el.style.animationDelay = `${Math.min(i * 60, 400)}ms`;
  });

  // 双 rAF：确保隐藏初态先被浏览器提交，再统一开始播放
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      targets.forEach((el) => el.classList.add('reveal-in'));
    });
  });
}
