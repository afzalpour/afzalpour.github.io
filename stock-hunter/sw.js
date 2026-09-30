// Stock Hunter public PWA 4.2.4 — optimized shell for /stock-hunter/.
// Frozen Hunt 4.1.6 scoring/runtime semantics are untouched.
const CACHE_PREFIX='shikar-sahm-public-';
const CACHE=CACHE_PREFIX+'v4.2.5-ui1';
const CORE=[
  './','./index.html','./styles.css','./extra.css','./forecast-v415.css','./neutral-theme-v416.css','./ux-v421.css',
  './config.js','./app-core.js','./app-runtime.js','./app-session-v413.js','./app-hunt-v416.js','./app-hunt-challenger-v425.js',
  './hunt-runtime-core-v417.js','./app-runtime-router-v417.js','./app-hunt-hierarchy-v416.js',
  './app-universal-search-v416.js','./app-eod-v416.js','./app-hunt-carry-v416.js',
  './data-export-v418.js','./locale-ui-v419.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'
];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async url=>{
      try{const r=await fetch(url,{cache:'reload'});if(r.ok)await cache.put(url,r.clone());}catch{}
    }));
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith(CACHE_PREFIX)&&key!==CACHE)await caches.delete(key);
    if(self.registration.navigationPreload)try{await self.registration.navigationPreload.enable();}catch{}
    await self.clients.claim();
  })());
});
async function cachedStatic(request){
  const cache=await caches.open(CACHE);
  const hit=await cache.match(request,{ignoreSearch:true});
  const refresh=fetch(request,{cache:'no-cache'}).then(async r=>{if(r.ok)await cache.put(request,r.clone());return r;}).catch(()=>null);
  return hit||(await refresh)||Response.error();
}
async function navigationResponse(event){
  const cache=await caches.open(CACHE);
  try{
    const preload=await event.preloadResponse;if(preload&&preload.ok){cache.put(event.request,preload.clone()).catch(()=>{});return preload;}
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),4500);
    try{
      const r=await fetch(event.request,{cache:'no-cache',signal:ctrl.signal});
      if(r.ok)cache.put(event.request,r.clone()).catch(()=>{});
      return r;
    }finally{clearTimeout(timer);}
  }catch{
    return (await cache.match(event.request,{ignoreSearch:true}))||
      (await cache.match('./index.html',{ignoreSearch:true}))||
      new Response('شکارچی سهم در این لحظه آفلاین است.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
  }
}
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const u=new URL(request.url);if(u.origin!==self.location.origin)return;
  if(request.mode==='navigate'){event.respondWith(navigationResponse(event));return;}
  const dest=request.destination;
  if(['script','style','image','font','manifest'].includes(dest)||/\.(?:js|css|png|svg|webmanifest)$/i.test(u.pathname)){
    event.respondWith(cachedStatic(request));
  }
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification?.data?.url||'alerts/',self.location.href).href;
  event.waitUntil((async()=>{
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){if(client.url===target||client.url.startsWith(target.split('?')[0])){await client.focus();return;}}
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});
self.addEventListener('push',event=>{
  let data={};try{data=event.data?event.data.json():{};}catch{data={body:event.data?.text?.()||''};}
  const title=data.title||'شکارچی سهم';
  const options={body:data.body||'رخداد تازه شکار ثبت شد.',icon:data.icon||'icon-192.png',badge:data.badge||'icon-192.png',tag:data.tag||'stock-hunter-cloud-push',renotify:false,data:data.data||{url:'alerts/'}};
  event.waitUntil(self.registration.showNotification(title,options));
});
