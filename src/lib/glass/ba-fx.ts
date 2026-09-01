// 蔚蓝档案点击特效 + 光标拖尾（ba-click-fx，MIT 协议）
// 从游戏 FX_Touch.prefab 逐参数移植的网页特效库，WebGL2 渲染 + 自动降级链
// - 主题色映射为站点 accent（蓝紫色系）
// - prefers-reduced-motion 时不启用
// - 触屏设备：点击特效照常，拖尾跟随自动隐藏（库内处理）

import { BAClickFX } from 'ba-click-fx';

export function initBaFx(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    new BAClickFX({
      themeColor: '#8fb0ff', // 站点 accent，特效整体映射为蓝紫色系
      themeColorMode: 'relative-oklch',
      opacity: 0.9,          // 稍柔，避免抢内容
      scale: 0.9,            // 特效略小一号，保持克制
      trailEnabled: true,
      clickEnabled: true,
      maxDpr: 1.5,           // 发光类特效 1x 已足够，限制 DPR 保性能
    });
  } catch (e) {
    console.warn('[ba-fx] 初始化失败，点击特效未启用', e);
  }
}
