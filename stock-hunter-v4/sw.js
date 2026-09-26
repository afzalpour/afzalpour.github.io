// Canary admission + expansion + hold/rollback + recovery dashboard assets are pinned to cache r18.
// Recovery/Re-entry release gate: all CI workflows validate this same service-worker head.
const CACHE='shikar-sahm-v4.1.6-r18';
const STATIC=[
  './','./index.html','./styles.css','./extra.css','./forecast-v415.css','./neutral-theme-v416.css',
  './app-core.js','./app-forecast.js','./app-runtime.js','./app-universe.js',
  './app-hotfix-v410.js','./app-integrated-v410.js','./app-integrated-summary-v410.js',
  './app-explain-v411.js','./app-forecast-bridge-v414.js','./app-forecast-trend-v415.js','./app-forecast-validation-v430.js',
  './app-theme-v412.js','./app-session-v413.js','./app-hunt-v416.js','./hunt-runtime-core-v417.js','./app-runtime-router-v417.js','./app-hunt-hierarchy-v416.js',
  './app-universal-search-v416.js','./app-eod-v416.js','./app-hunt-carry-v416.js','./app-hunt-timeline-v416.js','./app-ai-assistant-v417.js','./performance.html','./performance-v416.js','./calibration.html','./calibration-v416.js','./candidate-evaluator-v416.js','./robustness-gate-v416.js','./promotion-decision-v416.js','./rollout-v417.html','./rollout-v417.js','./canary-admission-v417.js','./canary-expansion-v417.js','./canary-hold-rollback-v417.js','./canary-recovery-v417.js',
  './config.js','./manifest.webmanifest','./icon.svg','./methodology.html','./hunt-methodology-v416.html','./research-lab-v416.css','./research-common-v416.js','./research-tools-v417.js','./ai-center-v417.html','./ai-center-v417.js','./hunt-journey-v416.html','./hunt-journey-v416.js','./market-replay-v416.html','./market-replay-v416.js','./backtest-lab-v416.html','./backtest-lab-v416.js','./missed-opportunities-v416.html','./missed-opportunities-v416.js','./alerts-center-v416.html','./alerts-center-v416.js','./reliability-v416.html','./reliability-v416.js','./strategy-builder-v417.html','./strategy-builder-v417.js'
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
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const target=new URL(e.notification?.data?.url||'alerts-center-v416.html',self.location.href).href;
  e.waitUntil((async()=>{
    const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){if(client.url===target||client.url.startsWith(target.split('?')[0])){await client.focus();return;}}
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});
