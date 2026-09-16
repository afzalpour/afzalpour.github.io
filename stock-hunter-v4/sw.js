const CACHE='shikar-sahm-v4.1.6-r7';
const STATIC=[
  './','./index.html','./styles.css','./extra.css','./forecast-v415.css',
  './app-core.js','./app-forecast.js','./app-runtime.js','./app-universe.js',
  './app-hotfix-v410.js','./app-integrated-v410.js','./app-integrated-summary-v410.js',
  './app-explain-v411.js','./app-forecast-bridge-v414.js','./app-forecast-trend-v415.js',
  './app-theme-v412.js','./app-session-v413.js','./app-hunt-v416.js','./app-hunt-hierarchy-v416.js',
  './app-universal-search-v416.js','./app-eod-v416.js','./performance.html','./performance-v416.js','./calibration.html','./calibration-v416.js','./candidate-evaluator-v416.js','./robustness-gate-v416.js',
  './config.js','./manifest.webmanifest','./icon.svg','./methodology.html','./hunt-methodology-v416.html'
];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)));
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  e.respondWith(
    fetch(e.request,{cache:'no-store'}).then(r=>{
      if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});}
      return r;
    }).catch(()=>caches.match(e.request))
  );
});
