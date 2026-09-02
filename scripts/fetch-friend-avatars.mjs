// 友链头像构建时缓存：把 friends.ts 里的 avatarSrc 抓取到 public/friends/，
// 页面只引用本地文件，浏览器不再直连 GitHub，避免头像区黑几秒或加载失败。
// 抓取失败时若本地已有缓存则沿用缓存（离线构建也不受影响）；
// 线上由 deploy.yml 的 6 小时定时构建负责刷新。
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/data/friends.ts'), 'utf8');

// 抓取 avatar → avatarSrc 成对条目；缓存文件名由 avatar 字段（页面引用的本地路径）决定
const pairs = [...src.matchAll(/avatar:\s*'([^']+)'/g)].map((m) => m[1]);
const sources = [...src.matchAll(/avatarSrc:\s*'([^']+)'/g)].map((m) => m[1]);
if (pairs.length === 0 || pairs.length !== sources.length) {
  console.log('friends.ts 中没有 avatar/avatarSrc 成对字段，跳过头像抓取');
  process.exit(0);
}

async function nativeFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'woju-blog-build' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function curlFetch(url) {
  // 本机代理环境 Node 不认其证书，curl 走系统信任库，作为兜底
  return execFileSync('curl', ['-fsSL', '--max-time', '15', '-A', 'woju-blog-build', url], {
    maxBuffer: 10 * 1024 * 1024,
  });
}

let updated = 0, cached = 0, failed = 0;
for (let i = 0; i < pairs.length; i++) {
  const url = sources[i];
  const dest = join(root, 'public', pairs[i].replace(/^\//, ''));
  try {
    let buf;
    try {
      buf = await nativeFetch(url);
    } catch {
      buf = curlFetch(url);
    }
    // GitHub 头像会 302 到 avatars.githubusercontent.com；拿到的必须是图片
    if (buf.length < 100 || (buf[0] !== 0x89 && buf[0] !== 0xff && buf[0] !== 0x47)) {
      throw new Error('响应不是图片');
    }
    writeFileSync(dest, buf);
    updated++;
    console.log(`已更新 ${pairs[i]}（${buf.length} 字节）`);
  } catch (err) {
    if (existsSync(dest)) {
      cached++;
      console.warn(`抓取失败（${err.message}），沿用缓存 ${pairs[i]}`);
    } else {
      failed++;
      console.error(`抓取失败且无缓存：${sources[i]} — ${err.message}`);
    }
  }
}

console.log(`友链头像：更新 ${updated}，沿用缓存 ${cached}，失败 ${failed}`);
if (failed > 0) process.exitCode = 1; // 有失败但不中断构建（页面用本地路径，缺文件才 404）
