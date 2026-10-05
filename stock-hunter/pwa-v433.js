'use strict';
/* Stock Hunter PWA v4.3.3 — install/update/offline shell. */
(function(){
  if(window.STOCK_HUNTER_PWA_V433)return;
  const VERSION='4.3.3-pwa2';
  const script=[...document.scripts].find(s=>/pwa-v433\.js/.test(s.src));
  const root=new URL('./',script?.src||document.baseURI);
  const state={version:VERSION,root:root.href,standalone:matchMedia('(display-mode: standalone)').matches||navigator.standalone===true,online:navigator.onLine,registration:null,installPrompt:null};
  window.STOCK_HUNTER_PWA_V433=state;
  document.documentElement.classList.toggle('pwa-standalone-v433',state.standalone);
  let manifest=document.querySelector('link[rel="manifest"]');
  if(!manifest){manifest=document.createElement('link');manifest.rel='manifest';document.head.appendChild(manifest);}
  manifest.href=new URL('manifest.webmanifest?v='+VERSION,root).href;
  function host(){return document.querySelector('.top-actions')||document.querySelector('.ux-global-nav-v421')||null;}
  function ensureUi(){
    const h=host();if(!h||document.getElementById('pwaInstallV433'))return;
    const status=document.createElement('span');status.id='pwaStatusV433';status.className='pwa-status-v433';status.textContent=state.online?'برخط':'آفلاین';status.dataset.state=state.online?'online':'offline';status.title='وضعیت اتصال نسخه نصب‌شونده';
    const install=document.createElement('button');install.id='pwaInstallV433';install.className='pwa-install-v433';install.type='button';install.textContent=state.standalone?'نسخه نصب‌شده':'نصب برنامه';install.hidden=!state.installPrompt&&!state.standalone;install.disabled=state.standalone;
    install.onclick=async()=>{if(!state.installPrompt)return;const p=state.installPrompt;state.installPrompt=null;await p.prompt();try{await p.userChoice;}catch{}install.hidden=true;};
    h.append(status,install);
  }
  function updateNetwork(){state.online=navigator.onLine;const el=document.getElementById('pwaStatusV433');if(el){el.textContent=state.online?'برخط':'آفلاین';el.dataset.state=state.online?'online':'offline';}}
  addEventListener('online',updateNetwork);addEventListener('offline',updateNetwork);
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;ensureUi();const b=document.getElementById('pwaInstallV433');if(b){b.hidden=false;b.disabled=false;b.textContent='نصب برنامه';}});
  addEventListener('appinstalled',()=>{state.standalone=true;state.installPrompt=null;document.documentElement.classList.add('pwa-standalone-v433');const b=document.getElementById('pwaInstallV433');if(b){b.hidden=false;b.disabled=true;b.textContent='نسخه نصب‌شده';}});
  function showUpdate(reg){
    if(document.getElementById('pwaUpdateV433'))return;
    const b=document.createElement('button');b.id='pwaUpdateV433';b.className='pwa-update-v433';b.type='button';b.textContent='نسخه تازه آماده است — به‌روزرسانی';
    b.onclick=()=>{reg.waiting?.postMessage('SKIP_WAITING');b.disabled=true;b.textContent='در حال به‌روزرسانی…';};
    (host()||document.body).appendChild(b);
  }
  if('serviceWorker' in navigator){
    addEventListener('load',async()=>{
      try{
        const reg=await navigator.serviceWorker.register(new URL('sw.js',root).href,{scope:root.pathname,updateViaCache:'none'});state.registration=reg;reg.update().catch(()=>{});
        if(reg.waiting)showUpdate(reg);
        reg.addEventListener('updatefound',()=>{const w=reg.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)showUpdate(reg);});});
        const reloadKey='stockHunterPwaControllerReloadV433';
        navigator.serviceWorker.addEventListener('controllerchange',()=>{
          try{
            if(sessionStorage.getItem(reloadKey)===VERSION)return;
            sessionStorage.setItem(reloadKey,VERSION);
          }catch{}
          location.reload();
        });
      }catch(e){console.warn('[PWA 4.3.3] service worker registration failed:',e);}
      ensureUi();updateNetwork();
    });
  }else{addEventListener('DOMContentLoaded',ensureUi,{once:true});}
})();
