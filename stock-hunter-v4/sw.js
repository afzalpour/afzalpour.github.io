const CACHE='shikar-sahm-v4.0.3-20260915';
const STATIC=['./','./index.html','./styles.css','./app.js','./config.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC).catch(()=>{})))});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);const fresh=['/config.js','/app.js','/index.html','/styles.css','/manifest.webmanifest','/icon.svg'].some(x=>u.pathname.endsWith(x));if(fresh){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));return}if(u.origin===location.origin)e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
