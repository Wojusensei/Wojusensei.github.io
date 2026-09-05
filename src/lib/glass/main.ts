// 入口：玻璃折射滤镜 + 亮暗/中英切换
// （背景液滴物理引擎已按需求移除，engine/physics/jelly 源码保留在目录中备用）
// 挂在 astro:page-load 上：首次加载与 View Transitions 的每次客户端导航都会触发，
// 各 init 自己负责拆掉上一页遗留的监听器 / 动画循环（见各模块的 teardown）

import { initCardLensFilter } from './cardFilter';
import { initParticles } from './particles';
import { initTilt } from './tilt';
import { initBaFx } from './ba-fx';
import { initTheme, initLang } from '../toggles';

function start() {
  initCardLensFilter();
  initParticles();
  initTilt();
  initBaFx();
  initTheme();
  initLang();
}

document.addEventListener('astro:page-load', start);

// Service Worker：仅生产构建注册，为大陆访客提供 github.io 被间歇阻断时的离线兜底
// （dev 模式不注册，避免干扰实时预览；注册失败静默忽略，站点行为不变）
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
