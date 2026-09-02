const CACHE_PREFIX='avan-prod-core-';
const CACHE='avan-prod-core-1-0-v43';

const ASSETS=[
  './',
  './index.html',
  './styles.css',
  './config.js',
  './app.js',
  './manifest.webmanifest',
  './src/core/date/jalali.js',
'./src/ui/date/jalali-picker.js',
'./src/ui/errors/error-messages-fa.js',
'./src/ui/feedback/toast.js',
'./src/ui/components/modal.js',
'./src/ui/shell/shell-view.js',
'./src/infrastructure/supabase/supabase-transport.js',
'./src/infrastructure/supabase/supabase-session.js',
'./src/infrastructure/supabase/supabase-auth.js',
'./src/infrastructure/supabase/supabase-rest.js',
'./src/infrastructure/supabase/supabase-storage.js',
'./src/infrastructure/supabase/supabase-functions.js',
'./src/infrastructure/supabase/supabase-client.js',
'./src/infrastructure/supabase/avan-cloud-bootstrap.js',
'./src/application/auth/auth-controller.js',
'./src/ui/auth/auth-view.js',
'./src/reports/why-number.js',
'./src/reports/party-aging.js',
'./src/ui/reports/party-aging-view.js',
'./src/documents/document-service.js',
'./src/ui/documents/documents-view.js',
'./src/documents/document-proposal.js',
'./src/documents/local-ocr-runtime.js',
'./src/documents/local-ocr-extraction.js',
'./src/ui/documents/document-review-view.js',
];

self.addEventListener(
  'install',
  e=>e.waitUntil(
    caches
      .open(CACHE)
      .then(c=>c.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  )
);

self.addEventListener(
  'activate',
  e=>e.waitUntil(
    caches
      .keys()
      .then(
        keys=>Promise.all(
          keys
            .filter(
              k=>
                k.startsWith(CACHE_PREFIX)&&
                k!==CACHE
            )
            .map(k=>caches.delete(k))
        )
      )
      .then(()=>self.clients.claim())
  )
);

self.addEventListener(
  'fetch',
  e=>{

    if(
      e.request.method!=='GET'||
      new URL(e.request.url).origin!==location.origin
    )
      return;

    e.respondWith(
      fetch(e.request)
        .then(r=>{

          if(r.ok){

            const copy=r.clone();

            caches
              .open(CACHE)
              .then(c=>c.put(e.request,copy));
          }

          return r;
        })
        .catch(
          ()=>caches
            .match(e.request)
            .then(
              r=>
                r||
                caches.match('./index.html')
            )
        )
    );
  }
);
