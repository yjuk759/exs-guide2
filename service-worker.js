// service-worker.js
const CACHE_NAME = 'exs-guide-v18'; // ← 숫자 반드시 올리기

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

// manuals.json 은 무조건 네트워크 우선(캐시 쓰지 않음)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // manuals.json 은 항상 최신
  if (url.pathname.endsWith('/manuals.json')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request)));
    return;
  }

  // 그 외는 캐시-우선(필요시 네트워크)
  e.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(e.request);
      if (cached) return cached;
      try {
        const resp = await fetch(e.request);
        // 정적 파일만 캐시 (HTML 제외)
        if (resp.ok && e.request.method === 'GET' && !e.request.headers.get('accept')?.includes('text/html')) {
          cache.put(e.request, resp.clone());
        }
        return resp;
      } catch (err) {
        // 오프라인 fallback 필요하면 여기서 처리
        return cached || Response.error();
      }
    })
  );
});
