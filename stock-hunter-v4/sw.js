const CACHE='stock-hunter-v4.0.1-hotfix-20260915';
const STATIC=['./','./index.html','./styles.css','./app.js?v=4.0.1','./config.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC).catch(()=>{})))});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.pathname.endsWith('/config.js')||u.pathname.endsWith('/app.js')||u.pathname.endsWith('/index.html')||u.pathname.endsWith('/styles.css')){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));return;}if(u.origin===location.origin)e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
