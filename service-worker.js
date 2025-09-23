const CACHE_NAME='exs-guide-v7';
const ASSETS=[
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './manuals.json'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
});
self.addEventListener('fetch',e=>{
  e.respondWith(
    caches.match(e.request).then(res=> res || fetch(e.request).then(net=>{
      // Cache new requests for offline (best-effort)
      const copy = net.clone();
      caches.open(CACHE_NAME).then(c=>c.put(e.request, copy)).catch(()=>{});
      return net;
    }).catch(()=>res))
  );
});
