// 滚动渐入：卡片/区块进入视口时淡入 + 上浮 + 去模糊，同批元素错峰入场
// 设计要点：
//   - 隐藏态由 JS 添加类实现（JS 挂了页面照常可见）
//   - 位移用独立 translate 属性，不碰 transform——与 tilt 的内联 transform 互不干扰
//   - 每次页面导航（astro:page-load）重建观察器，旧观察器先断开
const SELECTOR = [
  '.g-card',
  '.section-head',
  '.blog-stats',
  '.hero-copy',
  '.hero-standee',
  '.post-adj',
].join(', ');

let observer: IntersectionObserver | null = null;

export function initReveal() {
  observer?.disconnect();
  observer = null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const targets = document.querySelectorAll<HTMLElement>(SELECTOR);
  if (!targets.length) return;

  // 隐藏初态：JS 运行到这才加上，保证无 JS 环境下内容照常显示
  targets.forEach((el) => {
    if (el.classList.contains('reveal-in')) return;
    el.classList.add('reveal-init');
  });

  observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .forEach((e, i) => {
          const el = e.target as HTMLElement;
          el.style.animationDelay = `${Math.min(i * 70, 420)}ms`;
          el.classList.add('reveal-in');
          observer?.unobserve(el);
        });
    },
    // 视口下缘外扩 22%：元素在进入视口前就开始渐入，滚到时刚好完整出现（不会滚动时才弹出来）
    { threshold: 0.05, rootMargin: '0px 0px 22% 0px' },
  );
  targets.forEach((el) => observer!.observe(el));
}
