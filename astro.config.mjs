import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://wojusensei.github.io',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      // Astro 7 默认用 Lightning CSS 压缩，会把标准 backdrop-filter 与
      // -webkit- 前缀声明合并成只剩前缀版本，而 Chromium 上
      // -webkit-backdrop-filter 对 url(#svg 滤镜) 引用不生效，液态玻璃折射会失效。
      // 换回 esbuild 压缩：不做前缀合并，标准属性原样保留。
      cssMinify: 'esbuild',
    },
  },
});
