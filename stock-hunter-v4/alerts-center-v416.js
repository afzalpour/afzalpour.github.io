'use strict';
const R=StockHunterResearchV416;const $=id=>document.getElementById(id);let alertRows=[],firstLoad=true,timer=null;
const kindFa={detect:'کشف شکار',zero:'عبور از صفر',plus1:'رسیدن به +۱٪',plus2:'رسیدن به +۲٪',plus3:'رسیدن به +۳٪'};
const kindIcon={detect:'◎',zero:'↗',plus1:'✓',plus2:'✓✓',plus3:'★'};
function soundEnabled(){return localStorage.getItem('stockHunterAlertSoundV416')==='1';}
function renderSound(){$('soundToggle').textContent='صدای هشدار: '+(soundEnabled()?'روشن':'خاموش');$('soundToggle').classList.toggle('active',soundEnabled());}
function beep(level=1){
 if(!soundEnabled())return;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=level>=3?880:level===2?660:520;g.gain.value=.035;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.13);o.onended=()=>c.close();}catch(_){}
}
function notificationAllowed(){return 'Notification'in window&&Notification.permission==='granted';}
async function requestNotify(){
 if(!('Notification'in window)){R.setStatus('این مرورگر از اعلان پشتیبانی نمی‌کند.','bad');return;}
 const p=await Notification.requestPermission();$('notifyBtn').textContent=p==='granted'?'اعلان مرورگر: فعال':'اعلان مرورگر: غیرفعال';$('notifyBtn').classList.toggle('active',p==='granted');
}
function notify(a){
 if(!notificationAllowed())return;
 const body=a.symbol+' — '+kindFa[a.kind]+(a.dayChange!=null?' — '+R.pct(a.dayChange):'');
 try{new Notification('شکارچی سهم: '+kindFa[a.kind],{body,icon:'icon.svg',tag:a.key,renotify:false});}catch(_){}
}
function buildAlerts(rows){
 const out=[];for(const x of rows){
   out.push({key:x.channel+'|'+x.trade_date+'|'+x.symbol_id+'|detect|'+x.detected_at,kind:'detect',at:x.detected_at,symbol:x.symbol,company:x.company_name,dayChange:x.detected_day_change,score:x.hunt_score,state:x.hunt_state,level:x.hunt_state==='شکار ویژه'?3:x.hunt_state==='هشدار فوری'?2:1});
   if(x.crossed_zero_at)out.push({key:x.channel+'|'+x.trade_date+'|'+x.symbol_id+'|zero|'+x.crossed_zero_at,kind:'zero',at:x.crossed_zero_at,symbol:x.symbol,company:x.company_name,dayChange:0,score:x.hunt_score,state:x.hunt_state,level:1});
   if(x.crossed_plus1_at)out.push({key:x.channel+'|'+x.trade_date+'|'+x.symbol_id+'|plus1|'+x.crossed_plus1_at,kind:'plus1',at:x.crossed_plus1_at,symbol:x.symbol,company:x.company_name,dayChange:1,score:x.hunt_score,state:x.hunt_state,level:2});
   if(x.crossed_plus2_at)out.push({key:x.channel+'|'+x.trade_date+'|'+x.symbol_id+'|plus2|'+x.crossed_plus2_at,kind:'plus2',at:x.crossed_plus2_at,symbol:x.symbol,company:x.company_name,dayChange:2,score:x.hunt_score,state:x.hunt_state,level:2});
   if(x.crossed_plus3_at)out.push({key:x.channel+'|'+x.trade_date+'|'+x.symbol_id+'|plus3|'+x.crossed_plus3_at,kind:'plus3',at:x.crossed_plus3_at,symbol:x.symbol,company:x.company_name,dayChange:3,score:x.hunt_score,state:x.hunt_state,level:3});
 }
 return out.sort((a,b)=>new Date(b.at)-new Date(a.at));
}
function filteredAlerts(){const k=$('alertKind').value;return alertRows.filter(x=>!k||x.kind===k);}
function renderAlerts(){
 const a=filteredAlerts();$('aTotal').textContent=R.fa(alertRows.length);for(const k of ['detect','zero','plus1','plus2','plus3'])$('a'+(k==='detect'?'Detect':k==='zero'?'Zero':k==='plus1'?'Plus1':k==='plus2'?'Plus2':'Plus3')).textContent=R.fa(alertRows.filter(x=>x.kind===k).length);
 $('alertList').innerHTML=a.length?a.map(x=>`<article class="alert-item level-${x.level}"><div class="alert-icon">${kindIcon[x.kind]}</div><div><div class="alert-title">${R.esc(x.symbol)} — ${kindFa[x.kind]}</div><div class="alert-meta">${R.esc(x.company||'')} · ${R.esc(x.state||'')} · امتیاز شکار ${R.fa(x.score,1)}${x.dayChange!=null?' · '+R.pct(x.dayChange):''}</div></div><div class="alert-time">${R.jalaliDate(x.at)}<br>${R.time(x.at)}</div></article>`).join(''):'<div class="empty">هشداری برای این فیلتر وجود ندارد.</div>';
}
function processFresh(next,date){
 const storageKey='stockHunterAlertsSeenV416:'+date;const previous=new Set(JSON.parse(localStorage.getItem(storageKey)||'[]'));const keys=next.map(x=>x.key);
 if(firstLoad){localStorage.setItem(storageKey,JSON.stringify(keys.slice(0,3000)));firstLoad=false;return;}
 const fresh=next.filter(x=>!previous.has(x.key));if(fresh.length){const top=[...fresh].sort((a,b)=>b.level-a.level)[0];notify(top);beep(top.level);}
 localStorage.setItem(storageKey,JSON.stringify([...new Set([...keys,...previous])].slice(0,3000)));
}
async function loadAlerts(){
 const d=R.readJalaliInput($('alertDate'),R.todayIso());R.setStatus('در حال دریافت هشدارهای '+R.jalaliDate(d)+'…','warn');
 try{
   const rows=await R.api('stock_hunter_hunt_journey_v416','select=channel,trade_date,symbol_id,symbol,company_name,hunt_state,detected_at,detected_day_change,hunt_score,crossed_zero_at,crossed_plus1_at,crossed_plus2_at,crossed_plus3_at&trade_date=eq.'+encodeURIComponent(d)+'&order=detected_at.desc&limit=1500');
   const next=buildAlerts(rows);if(d===R.todayIso())processFresh(next,d);alertRows=next;renderAlerts();R.setStatus('مرکز هشدار '+R.jalaliDate(d)+' — '+R.fa(alertRows.length)+' رخداد مهم','ok');
 }catch(e){alertRows=[];renderAlerts();R.setStatus('دریافت هشدارها ناموفق بود: '+e.message,'bad');}
 clearTimeout(timer);if(d===R.todayIso())timer=setTimeout(loadAlerts,15000);
}
R.setJalaliInput($('alertDate'),R.todayIso());$('alertDate').addEventListener('change',()=>{firstLoad=true;loadAlerts();});$('alertKind').onchange=renderAlerts;$('alertRefresh').onclick=loadAlerts;$('notifyBtn').onclick=requestNotify;
$('soundToggle').onclick=()=>{localStorage.setItem('stockHunterAlertSoundV416',soundEnabled()?'0':'1');renderSound();if(soundEnabled())beep(1);};
$('notifyBtn').textContent=notificationAllowed()?'اعلان مرورگر: فعال':'فعال‌سازی اعلان مرورگر';$('notifyBtn').classList.toggle('active',notificationAllowed());renderSound();loadAlerts();