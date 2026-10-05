// Stock Hunter public PWA 4.3.3-pwa2 — installable shell, route caching and explicit offline fallback.
// Frozen Hunt 4.1.6 scoring/runtime semantics are untouched.
const CACHE_PREFIX='shikar-sahm-public-';
const CACHE=CACHE_PREFIX+'v4.3.3-pwa2';
const CORE=[
  './','./index.html','./offline.html','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png',
  './styles.css','./extra.css','./forecast-v415.css','./neutral-theme-v416.css','./ux-v421.css','./ux-nav-v433.css','./decision-shell-v428.css','./pwa-v433.css',
  './config.js','./app-core.js','./app-runtime.js','./app-session-v413.js','./app-hunt-v416.js','./app-hunt-challenger-v425.js','./hunt-runtime-core-v417.js','./app-runtime-router-v417.js','./app-hunt-hierarchy-v416.js','./app-universal-search-v416.js','./app-eod-v416.js','./app-hunt-carry-v416.js','./data-export-v418.js','./locale-ui-v419.js','./ux-shell-v421.js','./ux-common-v421.js','./decision-shell-v428.js','./pwa-v433.js',
  './research-lab-v416.css','./research-common-v416.js','./research-tools-v417.js','./replay-catalog-resilience-v431.js','./market-replay-v416.js','./replay-session-v433.js','./replay-visual-v432.js','./replay-visual-v432.css','./replay-visual-v433.js','./replay-visual-v433.css',
  './hunt-journey-v416.js','./backtest-lab-v416.js','./missed-opportunities-v416.js','./alerts-center-v416.js','./reliability-v416.js','./strategy-builder-v417.js','./professional-center-v420.js','./professional-v420.css','./ai-center-v417.js'
];
const ROUTES=['./journey/','./replay/','./alerts/','./report/','./backtest/','./missed/','./strategy/','./professional/','./ai/','./reliability/','./performance/','./profile/'];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled([...CORE,...ROUTES].map(async url=>{try{const r=await fetch(url,{cache:'reload'});if(r.ok)await cache.put(url,r.clone());}catch{}}));
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith(CACHE_PREFIX)&&key!==CACHE)await caches.delete(key);
    if(self.registration.navigationPreload)try{await self.registration.navigationPreload.enable();}catch{}
    await self.clients.claim();
  })());
});
async function networkFirst(request,fallback){
  const cache=await caches.open(CACHE);
  try{
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),5500);
    try{const r=await fetch(request,{cache:'no-cache',signal:ctrl.signal});if(r.ok)cache.put(request,r.clone()).catch(()=>{});return r;}finally{clearTimeout(timer);}
  }catch{
    return (await cache.match(request,{ignoreSearch:true}))||(fallback?await cache.match(fallback,{ignoreSearch:true}):null)||Response.error();
  }
}
async function navigationResponse(event){
  const cache=await caches.open(CACHE);
  try{
    const preload=await event.preloadResponse;if(preload&&preload.ok){cache.put(event.request,preload.clone()).catch(()=>{});return preload;}
  }catch{}
  const r=await networkFirst(event.request,'./offline.html');
  if(r&&r.type!=='error')return r;
  return (await cache.match('./offline.html'))||new Response('شکارچی سهم در این لحظه آفلاین است.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
}
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const u=new URL(request.url);if(u.origin!==self.location.origin)return;
  if(request.mode==='navigate'){event.respondWith(navigationResponse(event));return;}
  const dest=request.destination;
  if(['script','style','image','font','manifest'].includes(dest)||/\.(?:js|css|png|svg|webmanifest)$/i.test(u.pathname))event.respondWith(networkFirst(request));
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const target=new URL(event.notification?.data?.url||'alerts/',self.location.href).href;
  event.waitUntil((async()=>{const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of list){if(client.url===target||client.url.startsWith(target.split('?')[0])){await client.focus();return;}}if(self.clients.openWindow)await self.clients.openWindow(target);})());
});
self.addEventListener('push',event=>{
  let data={};try{data=event.data?event.data.json():{};}catch{data={body:event.data?.text?.()||''};}
  const title=data.title||'شکارچی سهم',options={body:data.body||'رخداد تازه شکار ثبت شد.',icon:data.icon||'icon-192.png',badge:data.badge||'icon-192.png',tag:data.tag||'stock-hunter-cloud-push',renotify:false,data:data.data||{url:'alerts/'}};
  event.waitUntil(self.registration.showNotification(title,options));
});
