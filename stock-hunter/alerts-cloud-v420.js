'use strict';
(async()=>{
 const R=window.StockHunterResearchV416,cfg=window.STOCK_HUNTER_CONFIG||{},base=String(cfg.SUPABASE_URL||'').replace(/\/$/,''),key=String(cfg.SUPABASE_PUBLISHABLE_KEY||'');
 const filters=document.querySelector('.filters');if(!R||!filters||!base||!key)return;
 const panel=document.createElement('section');panel.className='panel cloud-alert-v420';panel.innerHTML='<div class="panel-title-row"><h2>هشدار ابری واقعی</h2><span id="cloudPushState" class="badge">در حال بررسی…</span></div><p class="footnote">این مسیر سمت سرور اجرا می‌شود و برای رخدادهای تازه، حتی وقتی صفحه شکارچی سهم باز نیست، از Push مرورگر استفاده می‌کند.</p><div class="cloud-levels-v420"><label><input type="checkbox" data-cloud-level="early" checked> شکار زودهنگام</label><label><input type="checkbox" data-cloud-level="special" checked> شکار ویژه</label><label><input type="checkbox" data-cloud-level="success" checked> عبور موفق</label></div><div class="strategy-actions"><button id="cloudPushToggle" type="button">فعال‌سازی هشدار ابری</button><button id="cloudPushTestState" type="button">بررسی سرویس</button></div>';
 filters.insertAdjacentElement('afterend',panel);
 let sb=null,session=null,currentSub=null;
 try{const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm');sb=createClient(base,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});session=(await sb.auth.getSession()).data.session||null;}catch{}
 const state=document.getElementById('cloudPushState'),btn=document.getElementById('cloudPushToggle');
 const setState=(t,s='')=>{state.textContent=t;state.className='badge '+s;};
 function b64(v){const p='='.repeat((4-v.length%4)%4),s=(v+p).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(s),a=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);return a;}
 async function registration(){if(!('serviceWorker'in navigator))throw new Error('مرورگر از خدمت‌کار آفلاین پشتیبانی نمی‌کند');await navigator.serviceWorker.register('./sw.js?v=4.1.6-r18');return navigator.serviceWorker.ready;}
 async function health(){try{const r=await fetch(base+'/functions/v1/stock-hunter-cloud-push-v420',{headers:{apikey:key},cache:'no-store'}),j=await r.json();if(!r.ok)throw new Error('خطای سرویس');return j;}catch(e){setState('سرویس ابری در دسترس نیست','bad');throw e;}}
 async function refresh(){
  const h=await health().catch(()=>null);if(!session){setState(h?.configured?'سرویس آماده؛ ورود لازم است':'پیکربندی ناقص','warn');btn.textContent='ورود برای هشدار ابری';return;}
  const reg=await registration().catch(()=>null);currentSub=reg?await reg.pushManager.getSubscription():null;
  if(currentSub){setState('هشدار ابری فعال','success');btn.textContent='غیرفعال‌سازی هشدار ابری';}else{setState(h?.configured?'آماده فعال‌سازی':'پیکربندی ناقص',h?.configured?'':'bad');btn.textContent='فعال‌سازی هشدار ابری';}
 }
 async function enable(){
  if(!session){location.href='auth-v417.html?next=alerts-center-v416.html';return;}
  if(!('PushManager'in window)||!('Notification'in window)){R.setStatus('این مرورگر از Push ابری پشتیبانی نمی‌کند.','bad');return;}
  const perm=await Notification.requestPermission();if(perm!=='granted'){R.setStatus('اجازه اعلان برای فعال‌سازی هشدار ابری لازم است.','bad');return;}
  const {data:pub,error}=await sb.from('stock_hunter_push_public_v420').select('vapid_public_key').eq('id',1).single();if(error||!pub?.vapid_public_key)throw new Error('کلید عمومی Push در دسترس نیست');
  const reg=await registration();let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(pub.vapid_public_key)});
  const j=sub.toJSON(),levels=[...panel.querySelectorAll('[data-cloud-level]:checked')].map(x=>x.dataset.cloudLevel);
  const payload={user_id:session.user.id,endpoint:sub.endpoint,p256dh:j.keys?.p256dh||'',auth:j.keys?.auth||'',levels,enabled:true,user_agent:navigator.userAgent.slice(0,400),updated_at:new Date().toISOString()};
  const {error:upErr}=await sb.from('stock_hunter_push_subscriptions_v420').upsert(payload,{onConflict:'user_id,endpoint'});if(upErr)throw upErr;currentSub=sub;await refresh();R.setStatus('هشدار ابری فعال شد؛ بررسی رخدادها سمت سرور ادامه دارد.','ok');
 }
 async function disable(){
  if(!session)return;const reg=await registration(),sub=await reg.pushManager.getSubscription();if(sub){await sb.from('stock_hunter_push_subscriptions_v420').update({enabled:false,updated_at:new Date().toISOString()}).eq('user_id',session.user.id).eq('endpoint',sub.endpoint);await sub.unsubscribe().catch(()=>{});}currentSub=null;await refresh();R.setStatus('هشدار ابری این دستگاه غیرفعال شد.','ok');
 }
 async function syncLevels(){
  if(!session||!currentSub)return;
  const levels=[...panel.querySelectorAll('[data-cloud-level]:checked')].map(x=>x.dataset.cloudLevel);
  if(!levels.length){R.setStatus('حداقل یک سطح هشدار ابری باید فعال بماند.','warn');return;}
  const {error}=await sb.from('stock_hunter_push_subscriptions_v420').update({levels,updated_at:new Date().toISOString()}).eq('user_id',session.user.id).eq('endpoint',currentSub.endpoint);
  if(error)R.setStatus('ذخیره سطح‌های هشدار ابری ناموفق بود.','bad');else R.setStatus('سطح‌های هشدار ابری همگام شد.','ok');
 }
 btn.onclick=async()=>{btn.disabled=true;try{if(currentSub)await disable();else await enable();}catch(e){R.setStatus('فعال‌سازی هشدار ابری ناموفق بود: '+(e?.message||e),'bad');}finally{btn.disabled=false;}};
 document.getElementById('cloudPushTestState').onclick=async()=>{const h=await health().catch(()=>null);if(h)R.setStatus('سرویس Push فعال است؛ '+R.fa(h.active_subscriptions||0)+' اشتراک فعال ثبت شده است.','ok');};
 panel.querySelectorAll('[data-cloud-level]').forEach(x=>x.addEventListener('change',syncLevels));
 await refresh();
})();