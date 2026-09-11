// DOM 玻璃的"液态折射"层
// 生成一张径向位移贴图，注入两组 SVG <feDisplacementMap>：
//   #glass-lens        —— 导航条 / 卡片（中等折射）
//   #glass-lens-strong —— 按钮 / 小控件（更强折射，厚玻璃感）
// 在 Chromium 上通过 backdrop-filter: url() 真正弯曲玻璃背后的内容。
// Safari/Firefox 不支持 url() 型 backdrop-filter，自动退化为透亮玻璃 + 高光。

function buildDisplacementMap(size = 320): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      // 归一化到边缘距离：0 中心 → 1 边缘
      const edge = Math.max(Math.abs(nx), Math.abs(ny));
      const m = Math.pow(Math.max(0, (edge - 0.45) / 0.55), 1.4); // 边缘折射带更宽
      const len = Math.hypot(nx, ny) || 1;
      const dx = (-nx / len) * m; // 指向中心 → 边缘呈现凸透镜效果
      const dy = (-ny / len) * m;
      const i = (y * size + x) * 4;
      d[i] = Math.round(128 + dx * 127); // R → 水平位移
      d[i + 1] = Math.round(128 + dy * 127); // G → 垂直位移
      d[i + 2] = 128;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

function injectFilter(href: string, id: string, scale: number) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  filter.id = id;
  filter.setAttribute('x', '-20%');
  filter.setAttribute('y', '-20%');
  filter.setAttribute('width', '140%');
  filter.setAttribute('height', '140%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const feImage = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
  feImage.setAttribute('href', href);
  feImage.setAttribute('preserveAspectRatio', 'none');
  feImage.setAttribute('result', 'map');
  const feDisp = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
  feDisp.setAttribute('in', 'SourceGraphic');
  feDisp.setAttribute('in2', 'map');
  feDisp.setAttribute('scale', String(scale));
  feDisp.setAttribute('xChannelSelector', 'R');
  feDisp.setAttribute('yChannelSelector', 'G');
  filter.append(feImage, feDisp);
  svg.append(filter);
  document.body.append(svg);
}

export function initCardLensFilter() {
  if (!CSS.supports('backdrop-filter', 'url(#glass-lens)')) return;
  const map = buildDisplacementMap();
  injectFilter(map, 'glass-lens', 100);
  injectFilter(map, 'glass-lens-strong', 200);
  document.documentElement.classList.add('lens-ok');
}
