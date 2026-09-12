// 入口：玻璃折射滤镜 + 亮暗/中英切换
// （背景液滴物理引擎已按需求移除，engine/physics/jelly 源码保留在目录中备用）
// 挂在 astro:page-load 上：首次加载与 View Transitions 的每次客户端导航都会触发，
// 各 init 自己负责拆掉上一页遗留的监听器 / 动画循环（见各模块的 teardown）

import { initParticles } from './particles';
import { initReveal } from './reveal';
import { initHeroAvatar } from './heroAvatar';
import { initCardLensFilter } from './cardFilter';
import { initTilt } from './tilt';
import { initBaFx } from './ba-fx';
import { initTheme, initLang } from '../toggles';

function start() {
  initParticles();
  initReveal();
  initHeroAvatar();
  initTheme();
  initLang();

  // 双皮肤分派：液态玻璃 = 折射滤镜 + 重力倾斜；毛玻璃 = 无这两样（低开销）
  const skin = document.documentElement.dataset.skin === 'liquid' ? 'liquid' : 'frosted';
  if (skin === 'liquid') {
    initCardLensFilter();
    initTilt();
  }
  // 蔚蓝档案点击 + 光标拖尾特效：两种皮肤都保留（站长要求）
  initBaFx();

  // 右下角皮肤切换：写入偏好 → 加载幕 → 跳转到对方模式的首页
  // （URL 带时间戳击穿 HTTP 缓存，确保拿到新构建的 HTML）
  document.getElementById('skin-toggle')?.addEventListener('click', () => {
    const next = skin === 'liquid' ? 'frosted' : 'liquid';
    try {
      localStorage.setItem('woju-skin', next);
      sessionStorage.setItem('woju-veil-force', '1');
    } catch { /* 存储不可用时静默，仍然跳转 */ }
    location.href = '/?s=' + Date.now(); // 立即换成对方模式的首页
  });
}

document.addEventListener('astro:page-load', start);

// Service Worker：仅生产构建注册，为大陆访客提供 github.io 被间歇阻断时的离线兜底
// （dev 模式不注册，避免干扰实时预览；注册失败静默忽略，站点行为不变）
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
