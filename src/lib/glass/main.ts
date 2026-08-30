// 入口：玻璃折射滤镜 + 亮暗/中英切换
// （背景液滴物理引擎已按需求移除，engine/physics/jelly 源码保留在目录中备用）

import { initCardLensFilter } from './cardFilter';
import { initParticles } from './particles';
import { initTilt } from './tilt';
import { initTheme, initLang } from '../toggles';

function start() {
  initCardLensFilter();
  initParticles();
  initTilt();
  initTheme();
  initLang();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
