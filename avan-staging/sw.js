importScripts('./sw-assets-common-a.js','./sw-assets-common-b.js');
const CACHE_PREFIX='avan-staging-rc1-';
// Release audit marker: avan-staging-rc1-v117-module5-iran-compliance-radar
const CACHE='avan-staging-rc1-v117-module5-iran-compliance-radar';
const ASSETS=[...new Set([
...self.AVAN_SW_COMMON_A,
...self.AVAN_SW_COMMON_B,
'./','./index.html','./sw-assets-common-a.js','./sw-assets-common-b.js',
'./rc15-final-web-pwa.css','./src/ui/settings/settings-layout-v2.js','./src/ui/settings/workspace-access-settings.js','./src/ui/settings/support-access-settings.js','./src/ui/einvoice/einvoice-preflight-ui.js',
'./rc17-control-tower.css','./rc17-financial-digital-twin.css','./rc17-working-capital.css','./rc17-working-capital-decisions.css','./rc17-party-master-data.css','./rc17-counterparty-360.css',
'./src/ui/intelligence/control-tower-workspace.js','./src/ui/intelligence/financial-digital-twin-workspace.js','./src/ui/intelligence/working-capital-workspace.js','./src/ui/intelligence/working-capital-decision-workspace.js','./src/ui/intelligence/dashboard-accounting-correctness-hotfix.js','./src/ui/intelligence/dashboard-live-contract-v3.js','./src/ui/parties/party-master-data.js','./src/ui/parties/counterparty-360.js','./src/ui/reports/report-exact-live-v2.js',
'./module4-continuous-close-audit.css','./src/application/intelligence/continuous-close-audit-service.js','./src/intelligence/continuous-close-audit-foundation.js','./src/ui/intelligence/continuous-close-audit-workspace.js',
'./module5-iran-compliance-radar.css','./src/application/intelligence/iran-compliance-radar-service.js','./src/intelligence/iran-compliance-radar-foundation.js','./src/ui/intelligence/iran-compliance-radar-workspace.js'
])];

self.addEventListener('install',event=>{
  const freshAssets=ASSETS.map(asset=>new Request(new URL(asset,self.registration.scope),{cache:'reload'}));
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(freshAssets)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window'});
    await Promise.allSettled(clients.map(client=>client.navigate(client.url)));
  })());
});

async function networkFirst(request){
  try{
    const freshRequest=new Request(request,{cache:'reload'});
    const response=await fetch(freshRequest);
    if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}
    return response;
  }catch(error){
    const cached=await caches.match(request);
    if(cached)return cached;
    if(request.mode==='navigate'){
      const shell=await caches.match('./index.html')||await caches.match('./');
      if(shell)return shell;
    }
    throw error;
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  event.respondWith(networkFirst(event.request));
});
