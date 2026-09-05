// Wojusensei 站点 Service Worker：给大陆访客提供 github.io 被间歇阻断时的离线兜底
// 策略（按资源类型分流，保证正常网络下更新零延迟）：
//   - 页面（HTML）        ：网络优先，成功即更新缓存；网络失败回退缓存（回头客被墙也能打开）
//   - /_astro/ 带哈希资源 ：缓存优先（文件名含内容哈希，永不过期，不存在旧版问题）
//   - 其余同源静态资源    ：缓存优先 + 后台刷新（stale-while-revalidate）
//   - 跨域请求（访客计数等）：完全不干预
// 缓存版本：改动策略或想强制刷新底图时递增 VERSION，activate 会自动清掉旧版本缓存
const VERSION = 'v1';
const CACHE = `woju-${VERSION}`;

// 构建最后一步由 scripts/inject-sw-manifest.mjs 注入精确的预缓存清单
self.__WOJU_PRECACHE = [];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const list = self.__WOJU_PRECACHE || [];
    await Promise.all(list.map((u) =>
      cache.add(new Request(u, { cache: 'reload' })).catch(() => {}) // 单个失败不拖垮安装
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('woju-') && k !== CACHE).map((k) => caches.delete(k)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname === '/sw.js') return;

  // 页面：HTML 导航 + Astro ClientRouter 的同源取页（fetch 目的地为空但路径形如页面）
  const isPage = req.mode === 'navigate'
    || req.destination === 'document'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('.html');
  const isHashed = url.pathname.startsWith('/_astro/');

  if (isPage) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          caches.open(CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
        }
        return res;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match('/');
      }
    })());
    return;
  }

  if (isHashed) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          caches.open(CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
        }
        return res;
      } catch {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  // 其余同源静态资源：stale-while-revalidate
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const refresh = fetch(req).then((res) => {
      if (res && res.ok) {
        caches.open(CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
      }
      return res;
    }).catch(() => null);
    if (cached) {
      event.waitUntil(refresh.catch(() => {}));
      return cached;
    }
    return refresh || new Response('', { status: 504 });
  })());
});
