'use strict';
const R=StockHunterResearchV416;const $=id=>document.getElementById(id);let alertRows=[],firstLoad=true,timer=null;
const kindFa={detect:'کشف شکار',zero:'عبور از صفر',plus1:'رسیدن به +۱٪',plus2:'رسیدن به +۲٪',plus3:'رسیدن به +۳٪'};
const kindIcon={detect:'◎',zero:'↗',plus1:'✓',plus2:'✓✓',plus3:'★'};
const levelFa={early:'شکار زودهنگام',special:'شکار ویژه',success:'عبور موفق'};
function soundEnabled(){return localStorage.getItem('stockHunterAlertSoundV416')==='1';}
function renderSound(){$('soundToggle').textContent='صدای هشدار: '+(soundEnabled()?'روشن':'خاموش');$('soundToggle').classList.toggle('active',soundEnabled());}
function tone(ctx,freq,start,dur,gain=.032){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=freq;g.gain.setValueAtTime(gain,ctx.currentTime+start);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+start+dur);o.connect(g);g.connect(ctx.destination);o.start(ctx.currentTime+start);o.stop(ctx.currentTime+start+dur);}
function beep(levelKey,force=false){
 if(!force&&!soundEnabled())return;
 try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C();
   if(levelKey==='early')tone(c,520,0,.13);
   else if(levelKey==='special'){tone(c,700,0,.12);tone(c,820,.16,.14);}
   else{tone(c,760,0,.10);tone(c,920,.12,.11);tone(c,1080,.25,.16);}
   setTimeout(()=>c.close().catch(()=>{}),700);
 }catch(_){}
}
async function ensureServiceWorker(){if(!('serviceWorker'in navigator))return null;try{return await navigator.serviceWorker.register('./sw.js?v=4.1.6-r18');}catch(_){return null;}}
function notificationAllowed(){return 'Notification'in window&&Notification.permission==='granted';}
async function requestNotify(){
 if(!('Notification'in window)){R.setStatus('این مرورگر از اعلان پشتیبانی نمی‌کند.','bad');return;}
 await ensureServiceWorker();const p=await Notification.requestPermission();$('notifyBtn').textContent=p==='granted'?'اعلان برنامه: فعال':'اعلان برنامه: غیرفعال';$('notifyBtn').classList.toggle('active',p==='granted');
 if(p==='granted')R.setStatus('اعلان برنامه فعال شد. رخداد تازه فقط یک‌بار اعلان می‌شود.','ok');
}
async function notify(a){
 if(!notificationAllowed())return;
 const title='شکارچی سهم — '+levelFa[a.levelKey],body=a.symbol+' — '+kindFa[a.kind]+(a.dayChange!=null?' — '+R.pct(a.dayChange):'');
 const options={body,icon:'icon.svg',badge:'icon.svg',tag:a.key,renotify:false,data:{url:'alerts-center-v416.html'}};
 try{
   if('serviceWorker'in navigator){const reg=await ensureServiceWorker();if(reg){await reg.showNotification(title,options);return;}}
   new Notification(title,options);
 }catch(_){}
}
function alertLevel(x,kind){
 if(kind!=='detect')return'success';
 return x.channel==='RADAR'?'early':'special';
}
function buildAlerts(rows){
 const out=[];for(const x of rows){
   const add=(kind,at,dayChange)=>{
     if(!at)return;const levelKey=alertLevel(x,kind),key=x.channel+'|'+x.trade_date+'|'+x.symbol_id+'|'+kind+'|'+at;
     out.push({key,kind,levelKey,at,symbol:x.symbol,company:x.company_name,dayChange,score:x.hunt_score,state:x.hunt_state,channel:x.channel});
   };
   add('detect',x.detected_at,x.detected_day_change);add('zero',x.crossed_zero_at,0);add('plus1',x.crossed_plus1_at,1);add('plus2',x.crossed_plus2_at,2);add('plus3',x.crossed_plus3_at,3);
 }
 return out.sort((a,b)=>new Date(b.at)-new Date(a.at));
}
function filteredAlerts(){const k=$('alertKind').value,l=$('alertLevel').value;return alertRows.filter(x=>(!k||x.kind===k)&&(!l||x.levelKey===l));}
function renderAlerts(){
 const a=filteredAlerts();$('aTotal').textContent=R.fa(alertRows.length);$('aEarly').textContent=R.fa(alertRows.filter(x=>x.levelKey==='early').length);$('aSpecial').textContent=R.fa(alertRows.filter(x=>x.levelKey==='special').length);$('aSuccess').textContent=R.fa(alertRows.filter(x=>x.levelKey==='success').length);$('aPlus1').textContent=R.fa(alertRows.filter(x=>x.kind==='plus1').length);$('aPlus3').textContent=R.fa(alertRows.filter(x=>x.kind==='plus3').length);
 $('alertList').innerHTML=a.length?a.map(x=>`<article class="alert-item level-${x.levelKey}"><div class="alert-icon">${kindIcon[x.kind]}</div><div><div class="alert-title">${R.esc(x.symbol)} — ${kindFa[x.kind]} <span class="badge">${levelFa[x.levelKey]}</span></div><div class="alert-meta">${R.esc(x.company||'')} · ${R.esc(x.state||'')} · امتیاز شکار ${R.fa(x.score,1)}${x.dayChange!=null?' · '+R.pct(x.dayChange):''}</div></div><div class="alert-time">${R.jalaliDate(x.at)}<br>${R.time(x.at)}</div></article>`).join(''):'<div class="empty">هشداری برای این فیلتر وجود ندارد.</div>';
}
async function processFresh(next,date){
 const storageKey='stockHunterAlertsSeenV416:'+date;let old=[];try{old=JSON.parse(localStorage.getItem(storageKey)||'[]')}catch{}const previous=new Set(old),keys=next.map(x=>x.key);
 if(firstLoad){localStorage.setItem(storageKey,JSON.stringify(keys.slice(0,5000)));firstLoad=false;return;}
 const fresh=next.filter(x=>!previous.has(x.key));
 for(const a of fresh.slice().reverse().slice(0,8)){await notify(a);beep(a.levelKey);}
 localStorage.setItem(storageKey,JSON.stringify([...new Set([...keys,...old])].slice(0,5000)));
}
async function loadAlerts(){
 const d=R.readJalaliInput($('alertDate'),R.todayIso());R.setStatus('در حال دریافت هشدارهای '+R.jalaliDate(d)+'…','warn');
 try{
   const rows=await R.api('stock_hunter_hunt_journey_v416','select=channel,trade_date,symbol_id,symbol,company_name,hunt_state,detected_at,detected_day_change,hunt_score,crossed_zero_at,crossed_plus1_at,crossed_plus2_at,crossed_plus3_at&trade_date=eq.'+encodeURIComponent(d)+'&order=detected_at.desc&limit=1500');
   const next=buildAlerts(rows);if(d===R.todayIso())await processFresh(next,d);alertRows=next;renderAlerts();R.setStatus('مرکز هشدار '+R.jalaliDate(d)+' — '+R.fa(alertRows.length)+' رخداد مهم','ok');
 }catch(e){alertRows=[];renderAlerts();R.setStatus('دریافت هشدارها ناموفق بود: '+e.message,'bad');}
 clearTimeout(timer);if(d===R.todayIso())timer=setTimeout(loadAlerts,15000);
}
async function testSounds(){beep('early',true);setTimeout(()=>beep('special',true),500);setTimeout(()=>beep('success',true),1100);}
R.setJalaliInput($('alertDate'),R.todayIso());$('alertDate').addEventListener('change',()=>{firstLoad=true;loadAlerts();});$('alertLevel').onchange=renderAlerts;$('alertKind').onchange=renderAlerts;$('alertRefresh').onclick=loadAlerts;$('notifyBtn').onclick=requestNotify;$('soundTest').onclick=testSounds;
$('soundToggle').onclick=()=>{localStorage.setItem('stockHunterAlertSoundV416',soundEnabled()?'0':'1');renderSound();if(soundEnabled())beep('early');};
$('notifyBtn').textContent=notificationAllowed()?'اعلان برنامه: فعال':'فعال‌سازی اعلان برنامه';$('notifyBtn').classList.toggle('active',notificationAllowed());renderSound();loadAlerts();