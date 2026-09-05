// 构建最后一步：扫描 dist 生成 Service Worker 预缓存清单并注入 dist/sw.js
// 预缓存内容：全部页面 + 带哈希的 CSS/JS + 星空底图 / 图标 / 指针（小文件）
// 刻意不预缓存：打赏码、友链底图（体积大、非首屏必需，运行时按需缓存）
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const dist = join(process.cwd(), 'dist');
const swPath = join(dist, 'sw.js');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : Promise.resolve([p]);
  }));
  return files.flat();
}

function urlOf(file) {
  const rel = relative(dist, file).split(/[\\/]/).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('.html')) {
    if (rel === '404.html') return '/404.html';
    return '/' + rel.replace(/index\.html$/, '').replace(/\.html$/, '');
  }
  return '/' + rel;
}

const all = (await walk(dist)).filter((f) => {
  const rel = relative(dist, f).split(/[\\/]/).join('/');
  if (rel === 'sw.js') return false;
  if (rel.endsWith('.map')) return false;
  if (rel.startsWith('donate/') || rel.startsWith('friends/shots/')) return false; // 大图运行时按需缓存
  return /\.(html|css|js|webp|png|jpg|cur)$/.test(rel);
});

const urls = all.map(urlOf).sort();
let sw = await readFile(swPath, 'utf8');
if (!sw.includes('self.__WOJU_PRECACHE = [];')) {
  console.error('sw.js 中找不到预缓存占位符，未注入清单');
  process.exit(1);
}
sw = sw.replace('self.__WOJU_PRECACHE = [];', `self.__WOJU_PRECACHE = ${JSON.stringify(urls)};`);
await writeFile(swPath, sw);
console.log(`SW 预缓存清单：${urls.length} 项`);
