// service-worker.js
// EXS Guide PWA Service Worker
// - manuals.json: 네트워크 우선 + 성공 시 캐시 갱신 + 실패 시 캐시 폴백
// - 정적 파일: 캐시 우선 + 없으면 네트워크
// - 설치/활성화 시 이전 캐시 정리

const CACHE_NAME = 'exs-guide-v96'; // ← 배포할 때마다 숫자 올리기

// 초기 프리캐시(오프라인 첫 화면용). manuals.json은 의도적으로 제외.
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './icons/logo.png',
  './manifest.json',
  // 필요 시 아이콘 추가
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(PRECACHE_ASSETS);
      } catch (e) {
        // 네트워크 문제 등으로 일부 에셋 미프리캐시여도 설치는 계속
      }
      // 즉시 대기 종료
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve()))
      );
      // 즉시 컨트롤 획득
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) manuals.json: 네트워크 우선 + 성공 시 캐시에 최신본 저장 + 실패 시 캐시 폴백
  if (url.pathname.endsWith('/manuals.json')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return resp;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 2) 네비게이션 요청(HTML) → 캐시된 index.html 폴백(오프라인 라우팅)
  const acceptsHTML = req.headers.get('accept')?.includes('text/html');
  if (acceptsHTML) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          // HTML은 캐시하지 않음(혹은 원하면 캐시 가능)
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 3) 그 외 정적 리소스: 캐시 우선(+없으면 네트워크 후 캐시 저장)
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const resp = await fetch(req);
        // GET이고 성공이면 캐시에 저장
        if (resp.ok && req.method === 'GET') {
          cache.put(req, resp.clone());
        }
        return resp;
      } catch (err) {
        // 오프라인 폴백(가능하면 캐시 반환)
        return cached || Response.error();
      }
    })
  );
});
