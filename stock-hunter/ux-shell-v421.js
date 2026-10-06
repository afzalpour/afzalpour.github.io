'use strict';
(function(){
  if(window.StockHunterUxV421)return;
  const VERSION='4.2.4-today-table-order1';
  const $u=id=>document.getElementById(id);
  const escU=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const faU=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—';};
  const pctU=(v,d=2)=>{const n=Number(v);return Number.isFinite(n)?(n>0?'+':'')+faU(n,d)+'٪':'—';};
  const body=document.body;
  if(!body||!document.getElementById('mainTable'))return;
  body.classList.add('stock-ux-v421');
  const requiredMainColumnsV424=['symbol','dayMoveV416','huntSetupV416','huntScoreV416','hunt','decision','fast','price','entry','target1','stop','details'];
  try{if(typeof visible!=='undefined')requiredMainColumnsV424.forEach(k=>visible.add(k));}catch{}

  function group(title,items,extraClass=''){
    return '<details class="'+extraClass+'"><summary>'+title+'</summary><div class="ux-grouped-nav-menu-v421">'+items.map(x=>'<a href="'+x[1]+'">'+x[0]+'</a>').join('')+'</div></details>';
  }
  function setupGroupedNav(){
    const actions=document.querySelector('.top-actions');if(!actions||$u('uxGroupedNavV421'))return;
    actions.querySelectorAll('a.top-link').forEach(a=>a.hidden=true);
    const nav=document.createElement('nav');nav.id='uxGroupedNavV421';nav.className='ux-grouped-nav-v421';
    nav.innerHTML=
      group('شکار',[['امروز','index.html'],['سفر شکار','journey/'],['بازپخش بازار','replay/'],['دیده‌بان و هشدارها','alerts/'],['گزارش بازار','report/']])+
      group('تحلیل و آزمون',[['آزمایشگاه آزمون تاریخی','backtest/'],['فرصت‌های از دست‌رفته','missed/'],['سازنده راهبرد','strategy/'],['عملکرد واقعی','performance/']])+
      group('پژوهش حرفه‌ای',[['مرکز حرفه‌ای','professional/'],['مرکز هوش مصنوعی','ai/'],['پایداری سامانه','reliability/']],'ux-pro-only-v421')+
      group('حساب من',[['پروفایل و تنظیمات','profile/'],['محیط شخصی','index-v417.html']]);
    const theme=$u('themeToggle');actions.insertBefore(nav,theme||actions.firstChild);
    document.addEventListener('click',e=>{if(!e.target.closest('#uxGroupedNavV421 details'))nav.querySelectorAll('details[open]').forEach(d=>d.removeAttribute('open'));});
  }

  function setMode(mode){
    const m=mode==='pro'?'pro':'simple';
    body.classList.toggle('ux-simple-v421',m==='simple');body.classList.toggle('ux-pro-v421',m==='pro');
    localStorage.setItem('stockHunterUxModeV421',m);
    document.querySelectorAll('[data-ux-mode]').forEach(b=>b.classList.toggle('active',b.dataset.uxMode===m));
    const tableBtn=$u('uxTableToggleV421');if(tableBtn)tableBtn.textContent='رفتن به جدول شکار';
  }
  function modeMarkup(){
    return '<div class="ux-mode-v421" role="group" aria-label="سطح نمایش"><button type="button" data-ux-mode="simple">نمای ساده</button><button type="button" data-ux-mode="pro">نمای حرفه‌ای</button></div>';
  }

  function ensureWhyDialog(){
    if($u('uxWhyDialogV421'))return;
    const d=document.createElement('dialog');d.id='uxWhyDialogV421';d.className='ux-why-dialog-v421';
    d.innerHTML='<div class="ux-why-head-v421"><div><h2 id="uxWhyTitleV421">چرا این سهم؟</h2><p id="uxWhySubV421">بازخوانی داده ثبت‌شده؛ بدون ساخت امتیاز جدید</p></div><button type="button" id="uxWhyCloseV421" aria-label="بستن">×</button></div><div id="uxWhyBodyV421" class="ux-why-body-v421"></div><div id="uxWhyFootV421" class="ux-why-foot-v421"></div>';
    body.appendChild(d);$u('uxWhyCloseV421').onclick=()=>d.close();
  }
  function ensureOnboarding(){
    if(localStorage.getItem('stockHunterOnboardingV421')==='1'||$u('uxOnboardingV421'))return;
    const d=document.createElement('dialog');d.id='uxOnboardingV421';d.className='ux-onboarding-v421';
    d.innerHTML='<h2>از «امروز» شروع کنید</h2><p>شکارچی سهم امکانات پژوهشی زیادی دارد، اما برای استفاده روزانه فقط این سه نکته کافی است.</p><div class="ux-onboarding-steps-v421"><article><b>۱. فرصت مهم را ببینید</b><span>کارت‌های «اقدام فوری» فقط شکار ویژه و هشدار فوری تازه را نشان می‌دهند.</span></article><article><b>۲. دلیل را بخوانید</b><span>«چرا این سهم؟» شواهد و ریسک ثبت‌شده را به زبان ساده توضیح می‌دهد؛ امتیاز شکار احتمال موفقیت نیست.</span></article><article><b>۳. اگر لازم بود عمیق شوید</b><span>سفر شکار، بازپخش، آزمون تاریخی و مرکز حرفه‌ای در لایه بعدی قرار دارند.</span></article></div><div class="ux-onboarding-actions-v421"><button class="ux-btn-v421 primary" id="uxOnboardingDoneV421" type="button">شروع با صفحه امروز</button></div>';
    body.appendChild(d);$u('uxOnboardingDoneV421').onclick=()=>{localStorage.setItem('stockHunterOnboardingV421','1');d.close();};setTimeout(()=>{try{d.show();}catch{}},700);
  }
  function ensureMobileNav(){
    if($u('uxMobileNavV421'))return;
    const nav=document.createElement('nav');nav.id='uxMobileNavV421';nav.className='ux-mobile-nav-v421';nav.innerHTML='<a class="active" href="index.html"><b>⌖</b><span>امروز</span></a><a href="profile/"><b>☆</b><span>دیده‌بان</span></a><a href="alerts/"><b>◉</b><span>هشدارها</span></a><a href="professional/"><b>☰</b><span>بیشتر</span></a>';body.appendChild(nav);
  }

  function ensureToday(){
    if($u('uxTodayV421'))return;
    const ws=document.querySelector('.workspace'),summary=document.querySelector('.summary-row');if(!ws||!summary)return;
    const sec=document.createElement('section');sec.id='uxTodayV421';sec.className='ux-today-v421';
    sec.innerHTML=
      '<div class="ux-today-head-v421"><div class="ux-today-title-v421"><h2>امروز</h2><p>اول فرصت‌های مهم، بعد دلیل، سپس جزئیات. این صفحه هیچ تغییری در موتور ثابت ۴.۱.۶ ایجاد نمی‌کند.</p></div><div class="ux-today-actions-v421">'+
      modeMarkup()+'<a class="ux-btn-v421" href="report/">گزارش بازار</a><a class="ux-btn-v421" href="performance/">رکورد واقعی</a><button id="uxTableToggleV421" class="ux-btn-v421" type="button">رفتن به جدول شکار</button></div></div>'+
      '<div id="uxPulseV421" class="ux-pulse-v421">'+
      '<article><span>وضعیت بازار</span><b id="uxPulseMarketV421">در حال بررسی</b><small id="uxPulseMarketSubV421">—</small></article>'+
      '<article><span>اقدام فوری</span><b id="uxPulseActionV421">۰</b><small>شکار ویژه + هشدار فوری تازه</small></article>'+
      '<article><span>رادار نزدیک</span><b id="uxPulseRadarV421">۰</b><small>شکارهای زودهنگام تازه</small></article>'+
      '<article><span>شرایط بازار</span><b id="uxPulseContextV421">—</b><small id="uxPulseContextSubV421">مؤلفه ثبت‌شده موتور</small></article>'+
      '<article><span>نمادهای دریافت‌شده</span><b id="uxPulseRowsV421">۰</b><small>کل ردیف‌های بارگذاری‌شده</small></article></div>'+
      '<div class="ux-section-head-v421"><div><h3>فرصت‌های مهم امروز</h3><p>فقط صف اقدام فوری؛ رادار نزدیک جداگانه پایین این بخش باقی می‌ماند.</p></div></div>'+
      '<div id="uxActionGridV421" class="ux-opportunity-grid-v421"></div>'+
      '<div id="uxRecordV421" class="ux-record-v421"><div><b>رکورد واقعی در حال شکل‌گیری است</b><span id="uxRecordTextV421">در حال دریافت دفتر رسمی رخدادها…</span></div><a class="ux-btn-v421" href="performance/">مشاهده جزئیات</a></div>';
    ws.prepend(sec);
    const ordered=[summary,document.querySelector('.toolbar'),$u('alertBox'),$u('huntRadarV416'),document.querySelector('.table-panel'),$u('mobileList')].filter(Boolean);
    let anchor=sec;
    for(const el of ordered){
      if(el.parentElement!==ws)continue;
      anchor.insertAdjacentElement('afterend',el);
      anchor=el;
    }
    sec.addEventListener('click',e=>{
      const mode=e.target.closest('[data-ux-mode]');if(mode){setMode(mode.dataset.uxMode);return;}
      const table=e.target.closest('#uxTableToggleV421');if(table){document.querySelector('.table-panel')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
      const why=e.target.closest('[data-why-id]');if(why){showWhy(why.dataset.whyId);return;}
    });
  }

  function preparedRows(){
    try{return (Array.isArray(rows)?rows:[]).map(x=>typeof applyHuntV416==='function'?applyHuntV416(x):x);}catch{return [];}
  }
  function activeRows(a){
    return a.filter(x=>{
      try{return (typeof isActionFreshV416!=='function'||isActionFreshV416(x))&&(typeof isActionSessionV416!=='function'||isActionSessionV416(x));}catch{return true;}
    });
  }
  function actionRows(a){
    return a.filter(x=>{try{return typeof isActionNowV416==='function'?isActionNowV416(x):['شکار ویژه','هشدار فوری'].includes(x.hunt);}catch{return false;}})
      .sort((m,n)=>(Number(n.huntScoreV416)||0)-(Number(m.huntScoreV416)||0)||(Number(n.todayOpportunityV416)||0)-(Number(m.todayOpportunityV416)||0)).slice(0,8);
  }
  function radarRows(a){
    return a.filter(x=>{try{return typeof isRadarEarlyV416==='function'?isRadarEarlyV416(x):x.hunt==='شکار زودهنگام';}catch{return false;}});
  }
  function strength(v,inverse=false){
    const n=Number(v);if(!Number.isFinite(n))return 'نامشخص';
    if(inverse)return n<=40?'کم':n<=60?'متوسط':'زیاد';
    return n>=72?'زیاد':n>=52?'متوسط':'کم';
  }
  function contextLabel(v){
    const n=Number(v);if(!Number.isFinite(n))return '—';return n>=65?'حمایتی':n>=45?'متعادل':'ضعیف';
  }
  function emptyMessage(){
    const badge=$u('feedBadge'),text=(badge?.textContent||'')+' '+($u('scanTimes')?.textContent||'');
    if(/تعطیل/.test(text))return ['بازار اکنون بسته است','آخرین اطلاعات ثبت‌شده در نوار وضعیت بازار نمایش داده می‌شود. رخدادهای روز را از «گزارش بازار» و «سفر شکار» مرور کنید.'];
    if(badge?.classList.contains('bad')||badge?.classList.contains('warn'))return ['داده تازه برای اقدام فوری کافی نیست','سامانه بین «نبود فرصت» و «مشکل داده» تفاوت می‌گذارد. وضعیت دقیق مسیر دریافت داده در بالای صفحه نوشته شده است.'];
    return ['در این لحظه شکار واجد شرایط اقدام فوری وجود ندارد','سامانه فعال است؛ رادار نزدیک را بررسی کنید. نبود شکار فعال به معنی خرابی نرم‌افزار نیست.'];
  }
  let actionDetectionTimesV421=Object.create(null),actionDetectionLoadingV421=false,actionDetectionLoadedV421=false;
  function detectionDateTimeV421(v){
    if(!v)return '—';
    const d=new Date(v);if(!Number.isFinite(d.getTime()))return '—';
    try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{calendar:'persian',numberingSystem:'arabext',timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(d);}
    catch{return new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(d);}
  }
  async function loadActionDetectionTimesV421(){
    if(actionDetectionLoadingV421)return;
    const cfg=window.STOCK_HUNTER_CONFIG||{},base=String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,''),key=String(cfg.SUPABASE_PUBLISHABLE_KEY||cfg.publishableKey||'');
    if(!base||!key)return;
    actionDetectionLoadingV421=true;
    try{
      const headers={apikey:key,Authorization:'Bearer '+key,Accept:'application/json'};
      const latest=await fetch(base+'/rest/v1/stock_hunter_hunt_journey_v416?select=trade_date&order=trade_date.desc&limit=1',{headers,cache:'no-store'});
      if(!latest.ok)throw new Error('latest trade date '+latest.status);
      const latestRows=await latest.json(),date=String(latestRows?.[0]?.trade_date||'');
      if(!date)return;
      const q='select=symbol_id,symbol,detected_at,trade_date&trade_date=eq.'+encodeURIComponent(date)+'&channel=eq.ACTION_NOW&order=detected_at.desc&limit=1000';
      const r=await fetch(base+'/rest/v1/stock_hunter_hunt_journey_v416?'+q,{headers,cache:'no-store'});
      if(!r.ok)throw new Error('action times '+r.status);
      const data=await r.json();
      const next=Object.create(null);
      for(const row of (Array.isArray(data)?data:[])){
        if(row?.detected_at){
          if(row.symbol_id&&!next[String(row.symbol_id)])next[String(row.symbol_id)]=row.detected_at;
          if(row.symbol&&!next['symbol:'+String(row.symbol)])next['symbol:'+String(row.symbol)]=row.detected_at;
        }
      }
      actionDetectionTimesV421=next;actionDetectionLoadedV421=true;
      try{scheduleTodayRenderV422(0);}catch{}
    }catch(e){console.warn('Stock Hunter action detection times unavailable',e);}
    finally{actionDetectionLoadingV421=false;}
  }
  function card(x){
    const cls=x.hunt==='شکار ویژه'?'special':'urgent',personal=!!$u('personalWatchlistV417');
    const watch=personal?'<button type="button" class="ux-btn-v421 personal-star-v417" data-watch-id="'+escU(x.id)+'" data-watch-symbol="'+escU(x.symbol)+'">☆ دیده‌بان</button>':'<a class="ux-btn-v421" href="profile/">دیده‌بان</a>';
    const detectedAt=actionDetectionTimesV421[String(x.id)]||actionDetectionTimesV421['symbol:'+String(x.symbol||'')]||x.updated||'';
    const detectedLabel=detectedAt?'شناسایی: '+detectionDateTimeV421(detectedAt):'زمان شناسایی در دفتر رخدادها در دسترس نیست';
    return '<article class="ux-hunt-card-v421 '+cls+'"><div class="ux-hunt-card-top-v421"><div><b>'+escU(x.symbol)+'</b><small>'+escU(x.company||'')+'</small><small class="ux-hunt-detected-time-v421">'+escU(detectedLabel)+'</small></div><span class="ux-state-chip-v421">'+escU(x.hunt)+'</span></div>'+
      '<div class="ux-hunt-card-score-v421"><div><strong>'+faU(x.huntScoreV416,0)+'</strong><span>از ۱۰۰ · امتیاز، نه احتمال</span></div><em>'+escU(x.huntModeLabelV416||'—')+'</em></div>'+
      '<div class="ux-hunt-facts-v421"><div><span>تغییر</span><b>'+pctU(x.dayChangeV416,2)+'</b></div><div><span>فشار سفارش</span><b>'+strength(x.orderPressureV416)+'</b></div><div><span>ریسک</span><b>'+strength(x.risk,true)+'</b></div></div>'+
      '<div class="ux-hunt-actions-v421"><button type="button" class="ux-btn-v421 primary" data-why-id="'+escU(x.id)+'">چرا این سهم؟</button><button type="button" class="ux-btn-v421 detail-btn" data-id="'+escU(x.id)+'">نمایش</button>'+watch+'</div></article>';
  }
  let lastActionMarkupV422='';
  function renderToday(){
    if(!$u('uxTodayV421'))return;
    const all=preparedRows(),active=activeRows(all),actions=actionRows(all),radar=radarRows(all);
    const feed=$u('feedState')?.textContent||$u('feedBadge')?.textContent||'در حال بررسی';
    $u('uxPulseMarketV421').textContent=feed;
    $u('uxPulseMarketSubV421').textContent=$u('scanTimes')?.textContent||'—';
    $u('uxPulseActionV421').textContent=actions.length.toLocaleString('fa-IR');
    $u('uxPulseRadarV421').textContent=radar.length.toLocaleString('fa-IR');
    $u('uxPulseRowsV421').textContent=all.length.toLocaleString('fa-IR');
    const contexts=active.map(x=>Number(x.marketContextV416)).filter(Number.isFinite),avg=contexts.length?contexts.reduce((a,b)=>a+b,0)/contexts.length:null;
    $u('uxPulseContextV421').textContent=contextLabel(avg);$u('uxPulseContextSubV421').textContent=avg==null?'داده کافی نیست':'امتیاز زمینه '+faU(avg,0)+' از ۱۰۰';
    const grid=$u('uxActionGridV421');
    const markup=actions.length?actions.map(card).join(''):(()=>{const m=emptyMessage();return '<div class="ux-empty-v421" style="grid-column:1/-1"><b>'+m[0]+'</b><span>'+m[1]+'</span></div>';})();
    if(markup!==lastActionMarkupV422){grid.innerHTML=markup;lastActionMarkupV422=markup;}
  }

  function snapshot(x){
    return {at:new Date().toISOString(),hunt:x.hunt||'',score:Number(x.huntScoreV416),day:Number(x.dayChangeV416),order:Number(x.orderPressureV416),risk:Number(x.risk)};
  }
  function keyFor(id){return 'stockHunterLastVisitV421:'+String(id);}
  function readSnapshot(id){try{return JSON.parse(localStorage.getItem(keyFor(id))||'null')}catch{return null;}}
  function writeSnapshot(x){try{localStorage.setItem(keyFor(x.id),JSON.stringify(snapshot(x)));}catch{}}
  function arrow(oldV,newV,d=1,suffix=''){
    if(!Number.isFinite(Number(oldV))||!Number.isFinite(Number(newV)))return '—';
    return faU(oldV,d)+suffix+' ← '+faU(newV,d)+suffix;
  }
  function changePanel(x,old){
    if(!old)return '<section class="ux-change-panel-v421"><h3>از آخرین بررسی شما</h3><div class="ux-empty-v421"><span>این نخستین بررسی ثبت‌شده شما برای این نماد است. از بازدید بعد، تغییر امتیاز، قیمت، فشار سفارش و ریسک نمایش داده می‌شود.</span></div></section>';
    return '<section class="ux-change-panel-v421"><h3>از آخرین بررسی شما</h3><div class="ux-change-grid-v421">'+
      '<div><span>امتیاز شکار</span><b>'+arrow(old.score,x.huntScoreV416,0)+'</b><small>'+escU(old.hunt||'—')+' ← '+escU(x.hunt||'—')+'</small></div>'+
      '<div><span>تغییر روز</span><b>'+arrow(old.day,x.dayChangeV416,2,'٪')+'</b><small>مقایسه با بازدید قبلی</small></div>'+
      '<div><span>فشار سفارش</span><b>'+arrow(old.order,x.orderPressureV416,0)+'</b><small>'+strength(old.order)+' ← '+strength(x.orderPressureV416)+'</small></div>'+
      '<div><span>ریسک</span><b>'+arrow(old.risk,x.risk,0)+'</b><small>'+strength(old.risk,true)+' ← '+strength(x.risk,true)+'</small></div>'+
      '</div></section>';
  }
  function reasons(x){
    try{if(typeof huntReasonsV416==='function')return huntReasonsV416(x);}catch{}
    const out=[];if(Number(x.orderPressureV416)>=60)out.push('فشار سفارش در محدوده قوی ثبت شده است.');if(Number(x.impulseV416)>=60)out.push('شتاب حرکت نسبتاً قوی است.');if(Number(x.risk)>=60)out.push('ریسک لحظه‌ای نیازمند توجه است.');return out;
  }
  function showWhy(id){
    ensureWhyDialog();const x=preparedRows().find(z=>String(z.id)===String(id));if(!x)return;
    const rs=reasons(x),old=readSnapshot(id),good=rs.filter(r=>!/ریسک|مانع|ناکافی|لغو/.test(r)),bad=[];
    if(x.huntGate)bad.push(x.huntGate);if(Number(x.risk)>=60)bad.push('ریسک لحظه‌ای در محدوده قابل توجه است.');if(Number(x.cancel)>=60)bad.push('نسبت لغو سفارش نیازمند توجه است.');if(!bad.length)bad.push('در داده ثبت‌شده مانع غالبی که شکار را متوقف کند دیده نشده است.');
    const lead=x.huntModeV416==='reversal'?'این نماد در مسیر برگشت از محدوده منفی است و اکنون '+faU(x.distanceToZeroV416,2)+'٪ تا صفر فاصله دارد.':'این نماد هنوز زیر +۱٪ است و شواهد ثبت‌شده از شروع شتاب مثبت بررسی شده‌اند.';
    $u('uxWhyTitleV421').textContent='چرا '+x.symbol+'؟';
    $u('uxWhySubV421').textContent=(x.hunt||'—')+' · امتیاز شکار '+faU(x.huntScoreV416,0)+' از ۱۰۰ · امتیاز، نه احتمال موفقیت';
    $u('uxWhyBodyV421').innerHTML='<div class="ux-why-lead-v421">'+escU(lead)+'</div>'+
      '<div class="ux-why-grid-v421"><div class="ux-why-box-v421"><b>نشانه‌های تقویت‌کننده</b><ul>'+(good.length?good:rs.slice(0,3)).map(v=>'<li>'+escU(v)+'</li>').join('')+'</ul></div><div class="ux-why-box-v421"><b>ریسک‌ها و موانع</b><ul>'+bad.map(v=>'<li>'+escU(v)+'</li>').join('')+'</ul></div></div>'+
      '<div class="ux-why-metrics-v421"><div><span>فشار سفارش</span><b>'+faU(x.orderPressureV416,0)+'</b></div><div><span>شتاب حرکت</span><b>'+faU(x.impulseV416,0)+'</b></div><div><span>امکان تکمیل امروز</span><b>'+faU(x.feasibilityV416,0)+'</b></div><div><span>ریسک</span><b>'+faU(x.risk,0)+'</b></div></div>'+
      changePanel(x,old);
    $u('uxWhyFootV421').innerHTML='<button class="ux-btn-v421" type="button" data-id="'+escU(x.id)+'" id="uxWhyDetailV421">جزئیات کامل</button><a class="ux-btn-v421 primary" href="professional/?symbol_id='+encodeURIComponent(x.id)+'">بررسی حرفه‌ای</a>';
    $u('uxWhyDialogV421').showModal();writeSnapshot(x);
    const b=$u('uxWhyDetailV421');if(b)b.onclick=()=>{$u('uxWhyDialogV421').close();try{openDetail(x.id);}catch{}};
  }

  function wrapDetail(){
    if(typeof openDetail!=='function'||openDetail._uxV421)return;
    const prev=openDetail;
    const wrapped=async function(id){
      const x=preparedRows().find(z=>String(z.id)===String(id)),old=readSnapshot(id);
      await prev(id);
      const target=$u('detailBody');if(target&&x&&!target.querySelector('.ux-change-panel-v421'))target.insertAdjacentHTML('beforeend',changePanel(x,old));
      if(target&&x&&!target.querySelector('.ux-professional-link-v421'))target.insertAdjacentHTML('beforeend','<div class="ux-why-foot-v421 ux-professional-link-v421"><a class="ux-btn-v421 primary" href="professional/?symbol_id='+encodeURIComponent(x.id)+'">بررسی حرفه‌ای این نماد</a><a class="ux-btn-v421" href="journey/?symbol='+encodeURIComponent(x.symbol)+'">سفر کامل شکار</a></div>');
      if(x)writeSnapshot(x);
    };
    wrapped._uxV421=true;openDetail=wrapped;
  }

  async function loadRecord(){
    const target=$u('uxRecordTextV421');if(!target)return;
    try{
      const base=String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,''),k=cfg.SUPABASE_PUBLISHABLE_KEY||cfg.publishableKey||'';if(!base||!k)throw new Error('config');
      const r=await fetch(base+'/rest/v1/stock_hunter_hunt_performance_v416?select=events_total,matured_1d,matured_3d',{headers:{apikey:k,Accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error(String(r.status));
      const a=await r.json(),events=a.reduce((s,x)=>s+(Number(x.events_total)||0),0),m1=a.reduce((s,x)=>s+(Number(x.matured_1d)||0),0),m3=a.reduce((s,x)=>s+(Number(x.matured_3d)||0),0);
      target.textContent=faU(events,0)+' رخداد واقعی ثبت شده است؛ '+(m1?faU(m1,0)+' نتیجه یک‌جلسه‌ای بالغ شده':'نتیجه یک‌جلسه‌ای هنوز بالغ نشده')+' و '+(m3?faU(m3,0)+' نتیجه سه‌جلسه‌ای بالغ شده':'نتیجه سه‌جلسه‌ای هنوز بالغ نشده')+'.';
    }catch{target.textContent='دفتر عملکرد واقعی در دسترس است؛ برای جزئیات و وضعیت بلوغ داده‌ها صفحه رکورد واقعی را باز کنید.';}
  }

  let todayRenderTimerV422=0,todayRenderRafV422=0;
  function scheduleTodayRenderV422(delay=28){
    clearTimeout(todayRenderTimerV422);
    todayRenderTimerV422=setTimeout(()=>{
      if(todayRenderRafV422&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(todayRenderRafV422);
      const run=()=>{todayRenderRafV422=0;try{renderToday();}catch{}};
      todayRenderRafV422=typeof requestAnimationFrame==='function'?requestAnimationFrame(run):0;
      if(!todayRenderRafV422)run();
    },delay);
  }
  function installRenderHook(){
    if(typeof render!=='function'||render._uxV421)return;
    const prev=render;const wrapped=function(){const out=prev.apply(this,arguments);scheduleTodayRenderV422();return out;};wrapped._uxV421=true;render=wrapped;
  }

  const searchBox=$u('search'),huntSelect=$u('hunt');
  if(searchBox)searchBox.addEventListener('input',()=>body.classList.toggle('ux-search-open-v421',!!searchBox.value.trim()));
  if(huntSelect)huntSelect.addEventListener('change',()=>body.classList.toggle('ux-filter-open-v421',!!huntSelect.value));
  setupGroupedNav();ensureToday();ensureWhyDialog();ensureMobileNav();wrapDetail();installRenderHook();
  const saved=localStorage.getItem('stockHunterUxModeV421')||'simple';setMode(saved);renderToday();
  loadActionDetectionTimesV421();
  setInterval(loadActionDetectionTimesV421,30000);
  const deferNonCritical=fn=>{if(typeof requestIdleCallback==='function')requestIdleCallback(()=>fn(),{timeout:2200});else setTimeout(fn,1600);};
  deferNonCritical(loadRecord);ensureOnboarding();
  const observer=new MutationObserver(()=>scheduleTodayRenderV422(80));const feed=$u('feedState');if(feed)observer.observe(feed,{subtree:true,childList:true,characterData:true});
  window.StockHunterUxV421={version:VERSION,setMode,renderToday,scheduleTodayRender:scheduleTodayRenderV422,showWhy};
})();

/* Stock Hunter UX 4.2.6 — interaction redesign only. Frozen Hunt 4.1.6 remains untouched. */
(function(){
  'use strict';
  if(window.StockHunterUiV426)return;
  const body=document.body, main=document.getElementById('mainTable');
  if(!body||!main)return;
  body.classList.add('stock-ui-v426');
  const $=id=>document.getElementById(id);
  const fa=n=>String(n??'').replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const viewKey='stockHunterSavedViewV426';
  const collapseKey='stockHunterSidebarV426';
  function dispatch(el,type='change'){if(!el)return;el.dispatchEvent(new Event(type,{bubbles:true}));}
  function sidebar(){
    if($('.uiSidebarV426'))return;
    const el=document.createElement('aside');el.id='uiSidebarV426';el.className='ui-sidebar-v426';
    el.innerHTML='<div class="ui-side-head-v426"><div class="ui-side-brand-v426"><span class="ui-side-mark-v426">ش</span><span class="ui-side-label-v426">شکارچی سهم</span></div><button id="uiSideToggleV426" class="ui-side-toggle-v426" type="button" aria-label="جمع کردن منو">‹</button></div>'+
      '<nav class="ui-side-nav-v426">'+
      '<a class="active" href="index.html"><span class="ui-ico-v426">⌂</span><span class="ui-side-label-v426">امروز</span></a>'+
      '<a href="journey/"><span class="ui-ico-v426">↝</span><span class="ui-side-label-v426">سفر شکار</span></a>'+
      '<a href="alerts/"><span class="ui-ico-v426">◎</span><span class="ui-side-label-v426">هشدارها و دیده‌بان</span></a>'+
      '<a href="backtest/"><span class="ui-ico-v426">▦</span><span class="ui-side-label-v426">آزمایشگاه آزمون تاریخی</span></a>'+
      '<a href="missed/"><span class="ui-ico-v426">◇</span><span class="ui-side-label-v426">فرصت‌های از دست‌رفته</span></a>'+
      '<a href="professional/"><span class="ui-ico-v426">◆</span><span class="ui-side-label-v426">مرکز حرفه‌ای</span></a>'+
      '<a href="ai/"><span class="ui-ico-v426">✦</span><span class="ui-side-label-v426">هوش مصنوعی</span></a>'+
      '<a href="reliability/"><span class="ui-ico-v426">●</span><span class="ui-side-label-v426">سلامت سامانه</span></a>'+
      '<a href="profile/"><span class="ui-ico-v426">◉</span><span class="ui-side-label-v426">حساب من</span></a>'+
      '</nav><div class="ui-side-foot-v426">موتور ثابت شکار <b>۴.۱.۶</b><br>بازطراحی فقط رابط و تجربه کاربری است.</div>';
    body.prepend(el);
    const collapsed=localStorage.getItem(collapseKey)==='۱';
    body.classList.toggle('ui-sidebar-collapsed-v426',collapsed);
    $('uiSideToggleV426').onclick=()=>{const next=!body.classList.contains('ui-sidebar-collapsed-v426');body.classList.toggle('ui-sidebar-collapsed-v426',next);localStorage.setItem(collapseKey,next?'۱':'۰');};
  }
  function command(){
    const top=document.querySelector('.topbar'),actions=document.querySelector('.top-actions');
    if(!top||!actions||$('.uiCommandV426'))return;
    const wrap=document.createElement('div');wrap.id='uiCommandV426';wrap.className='ui-command-v426';
    wrap.innerHTML='<span class="ui-command-icon-v426">⌕</span><input id="uiCommandInputV426" autocomplete="off" placeholder="جست‌وجوی نماد یا فرمان؛ نمونه: شکار ویژه"><div id="uiCommandResultsV426" class="ui-command-results-v426"></div>';
    top.insertBefore(wrap,actions);
    const inp=$('uiCommandInputV426'),box=$('uiCommandResultsV426');
    function setSearch(q){const s=$('search');if(!s)return;s.value=q;dispatch(s,'input');s.scrollIntoView({behavior:'smooth',block:'center'});}
    function setHunt(v){const h=$('hunt');if(!h)return;h.value=v;dispatch(h);document.querySelector('.table-panel')?.scrollIntoView({behavior:'smooth',block:'start'});}
    const commands=[
      ['شکار ویژه','شکار ویژه'],['هشدار فوری','هشدار فوری'],['شکار زودهنگام','شکار زودهنگام'],['همه نمادها','__all__']
    ];
    function prepared(){
      try{return (Array.isArray(rows)?rows:[]).map(x=>typeof applyHuntV416==='function'?applyHuntV416(x):x);}catch{return [];}
    }
    function render(){
      const q=inp.value.trim();
      if(!q){box.classList.remove('open');box.innerHTML='';return;}
      const cmd=commands.filter(x=>x[0].includes(q)).slice(0,4);
      const symbols=prepared().filter(x=>String(x.symbol||'').includes(q)||String(x.company||'').includes(q)).slice(0,6);
      box.innerHTML=cmd.map(x=>'<div class="ui-command-item-v426" data-cmd="'+safe(x[1])+'"><b>'+safe(x[0])+'</b><small>فرمان فیلتر</small></div>').join('')+
        symbols.map(x=>'<div class="ui-command-item-v426" data-symbol="'+safe(x.symbol)+'"><b>'+safe(x.symbol)+'</b><small>'+safe(x.company||'')+'</small></div>').join('');
      box.classList.toggle('open',!!box.innerHTML);
    }
    inp.addEventListener('input',render);inp.addEventListener('focus',render);
    box.addEventListener('click',e=>{const c=e.target.closest('[data-cmd]'),s=e.target.closest('[data-symbol]');if(c){setHunt(c.dataset.cmd);inp.value='';}else if(s){setSearch(s.dataset.symbol);inp.value=s.dataset.symbol;}box.classList.remove('open');});
    document.addEventListener('click',e=>{if(!e.target.closest('#uiCommandV426'))box.classList.remove('open');});
  }
  function tools(){
    const actions=document.querySelector('.top-actions');if(!actions||$('.uiFocusV426'))return;
    const focus=document.createElement('button');focus.id='uiFocusV426';focus.type='button';focus.className='ui-tool-v426';focus.title='حالت تمرکز';focus.textContent='تمرکز';
    const save=document.createElement('button');save.id='uiSaveViewV426';save.type='button';save.className='ui-tool-v426';save.title='ذخیره نمای فعلی';save.textContent='ذخیره نما';
    const load=document.createElement('button');load.id='uiLoadViewV426';load.type='button';load.className='ui-tool-v426';load.title='بازیابی نمای ذخیره‌شده';load.textContent='نمای من';
    const alerts=document.createElement('a');alerts.className='ui-tool-v426';alerts.href='alerts/';alerts.title='مرکز اعلان و دیده‌بان';alerts.textContent='اعلان';
    const theme=$('themeToggle');actions.insertBefore(focus,theme||actions.firstChild);actions.insertBefore(save,theme||actions.firstChild);actions.insertBefore(load,theme||actions.firstChild);actions.insertBefore(alerts,theme||actions.firstChild);
    focus.onclick=()=>{body.classList.toggle('ui-focus-v426');focus.textContent=body.classList.contains('ui-focus-v426')?'خروج از تمرکز':'تمرکز';};
    save.onclick=()=>{const data={search:$('search')?.value||'',hunt:$('hunt')?.value||'',decision:$('decision')?.value||'',pageSize:$('pageSize')?.value||'',mode:body.classList.contains('ux-pro-v421')?'pro':'simple'};localStorage.setItem(viewKey,JSON.stringify(data));save.textContent='ذخیره شد';setTimeout(()=>save.textContent='ذخیره نما',1200);};
    load.onclick=()=>{try{const d=JSON.parse(localStorage.getItem(viewKey)||'null');if(!d)return;for(const k of ['search','hunt','decision','pageSize']){const el=$(k);if(el&&d[k]!=null){el.value=d[k];dispatch(el,k==='search'?'input':'change');}}if(window.StockHunterUxV421?.setMode)window.StockHunterUxV421.setMode(d.mode||'simple');load.textContent='بازیابی شد';setTimeout(()=>load.textContent='نمای من',1200);}catch{}};
  }
  function heatmapShell(){
    if($('.uiHeatmapV426'))return;
    const anchor=$('uxTodayV421')||$('huntRadarV416')||document.querySelector('.toolbar');
    if(!anchor)return;
    const sec=document.createElement('section');sec.id='uiHeatmapV426';sec.className='ui-heatmap-v426';
    sec.innerHTML='<div class="ui-heat-head-v426"><div><h3>نقشه شکار بازار</h3><p>رنگ فقط شدت وضعیت شکار را نشان می‌دهد؛ معیارهای موتور بدون تغییر باقی مانده‌اند.</p></div><span id="uiHeatNoteV426" class="ui-view-note-v426">—</span></div><div id="uiHeatGridV426" class="ui-heat-grid-v426"></div>';
    anchor.insertAdjacentElement('afterend',sec);
  }
  function heatmap(){
    const grid=$('uiHeatGridV426'),note=$('uiHeatNoteV426');if(!grid)return;
    let a=[];try{a=(Array.isArray(rows)?rows:[]).map(x=>typeof applyHuntV416==='function'?applyHuntV416(x):x);}catch{}
    a=a.filter(x=>x&&x.symbol).sort((m,n)=>(Number(n.huntScoreV416)||0)-(Number(m.huntScoreV416)||0)).slice(0,50);
    grid.innerHTML=a.map(x=>{const h=String(x.hunt||'');const cls=h==='شکار ویژه'?'special':h==='هشدار فوری'?'urgent':h==='شکار زودهنگام'?'early':'neutral';const score=Number(x.huntScoreV416);return '<button type="button" class="ui-heat-v426 '+cls+'" data-ui-id="'+safe(x.id)+'"><b>'+safe(x.symbol)+'</b><span>'+safe(h||'عادی')+(Number.isFinite(score)?' · '+fa(Math.round(score)):'')+'</span></button>';}).join('');
    if(note)note.textContent=a.length?fa(a.length)+' نماد برتر از نظر امتیاز موجود':'در انتظار داده بازار';
  }
  function init(){
    sidebar();command();tools();heatmapShell();heatmap();
    $('uiHeatGridV426')?.addEventListener('click',e=>{const b=e.target.closest('[data-ui-id]');if(!b)return;try{if(typeof openDetail==='function')openDetail(b.dataset.uiId);}catch{}});
    const obs=new MutationObserver(()=>heatmap());const tbody=$('tbody');if(tbody)obs.observe(tbody,{childList:true,subtree:false});
    setInterval(heatmap,4000);
  }
  init();
  window.StockHunterUiV426={version:'4.2.6-ui1',renderHeatmap:heatmap};
})();


/* Stock Hunter UX 4.2.7 — closed-market last-session summary. Presentation only. */
(function(){
  'use strict';
  if(window.StockHunterLastSessionV427||!document.getElementById('mainTable'))return;
  const cfg=window.STOCK_HUNTER_CONFIG||{},base=String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');
  const key=String(cfg.SUPABASE_PUBLISHABLE_KEY||cfg.publishableKey||'');
  if(!base||!key)return;
  const $=id=>document.getElementById(id);
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';};
  const pct=(v,d=1)=>{const n=Number(v);return Number.isFinite(n)?(n>0?'+':'')+num(n,d)+'٪':'—';};
  const jalali=v=>{const d=new Date(String(v)+'T12:00:00Z');return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('fa-IR-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):'—';};
  const time=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hour12:false}).format(d):'—';};
  const headers={apikey:key,Authorization:'Bearer '+key,Accept:'application/json'};
  async function get(table,q){
    const r=await fetch(base+'/rest/v1/'+table+'?'+q,{headers,cache:'no-store'});
    if(!r.ok)throw new Error(String(r.status));
    return r.json();
  }
  function sessionOpen(){
    try{return typeof marketSessionTehran==='function'?!!marketSessionTehran().open:false;}catch{return false;}
  }
  function outcome(v){
    return ({HIT_PLUS3:'رسیده به +۳٪',HIT_PLUS2:'رسیده به +۲٪',HIT_PLUS1:'رسیده به +۱٪',CROSSED_ZERO:'عبور از صفر',POSITIVE_CLOSE:'پایان مثبت',FAILED_SAME_DAY:'ناموفق همان‌روز',PENDING:'در انتظار تکمیل'})[v]||'ثبت شده';
  }
  function archiveCard(x){
    const cls=x.hunt_state==='شکار ویژه'?'special':x.hunt_state==='هشدار فوری'?'urgent':'';
    return '<article class="ux-hunt-card-v421 '+cls+'"><div class="ux-hunt-card-top-v421"><div><b>'+safe(x.symbol)+'</b><small>'+safe(x.company_name||'')+'</small></div><span class="ux-state-chip-v421">'+safe(x.hunt_state||'شکار ثبت‌شده')+'</span></div>'+
      '<div class="ux-hunt-card-score-v421"><div><strong>'+num(x.hunt_score,0)+'</strong><span>از ۱۰۰ · امتیاز ثبت‌شده</span></div><em>'+safe(outcome(x.result_label))+'</em></div>'+
      '<div class="ux-hunt-facts-v421"><div><span>تغییر هنگام شکار</span><b>'+pct(x.detected_day_change,2)+'</b></div><div><span>بیشترین پیشروی</span><b>'+pct(x.same_day_mfe_pct,2)+'</b></div><div><span>زمان کشف</span><b>'+time(x.detected_at)+'</b></div></div>'+
      '<div class="ux-hunt-actions-v421"><a class="ux-btn-v421 primary" href="journey/?date='+encodeURIComponent(x.trade_date)+'&symbol='+encodeURIComponent(x.symbol)+'">سفر شکار</a><a class="ux-btn-v421" href="professional/?symbol_id='+encodeURIComponent(x.symbol_id||'')+'">بررسی حرفه‌ای</a></div></article>';
  }
  function renderArchive(date,rows){
    if(sessionOpen()||!rows.length)return;
    const special=rows.filter(x=>x.hunt_state==='شکار ویژه'),urgent=rows.filter(x=>x.hunt_state==='هشدار فوری'),early=rows.filter(x=>x.hunt_state==='شکار زودهنگام');
    const candidates=rows.filter(x=>['شکار ویژه','هشدار فوری','شکار زودهنگام'].includes(x.hunt_state));
    const top=[...candidates].sort((a,b)=>(Number(b.hunt_score)||0)-(Number(a.hunt_score)||0))[0];
    if($('specialCount'))$('specialCount').textContent=special.length.toLocaleString('fa-IR');
    if($('urgentCount'))$('urgentCount').textContent=urgent.length.toLocaleString('fa-IR');
    if($('buyCount'))$('buyCount').textContent=candidates.length.toLocaleString('fa-IR');
    if($('topSymbol'))$('topSymbol').textContent=top?.symbol||'—';
    if($('topMeta'))$('topMeta').textContent=top?'آخرین روز معاملاتی · امتیاز '+num(top.hunt_score,0):'داده‌ای ثبت نشده است';
    if($('uxPulseActionV421'))$('uxPulseActionV421').textContent=(special.length+urgent.length).toLocaleString('fa-IR');
    if($('uxPulseRadarV421'))$('uxPulseRadarV421').textContent=early.length.toLocaleString('fa-IR');
    if($('uxPulseRowsV421'))$('uxPulseRowsV421').textContent=rows.length.toLocaleString('fa-IR');
    const ctx=rows.map(x=>Number(x.market_context)).filter(Number.isFinite),avg=ctx.length?ctx.reduce((a,b)=>a+b,0)/ctx.length:null;
    if($('uxPulseContextV421'))$('uxPulseContextV421').textContent=avg==null?'—':avg>=65?'حمایتی':avg>=45?'متعادل':'ضعیف';
    if($('uxPulseContextSubV421'))$('uxPulseContextSubV421').textContent=avg==null?'داده کافی نیست':'امتیاز زمینه '+num(avg,0)+' از ۱۰۰';
    let banner=$('uiLastSessionBannerV427');
    if(!banner){
      banner=document.createElement('div');banner.id='uiLastSessionBannerV427';banner.className='ui-last-session-banner-v427';
      const head=document.querySelector('#uxTodayV421 .ux-today-head-v421');
      head?.insertAdjacentElement('afterend',banner);
    }
    if(banner)banner.innerHTML='<b>نمایش آخرین روز معاملاتی</b><span>بازار اکنون بسته است؛ اطلاعات ثبت‌شده '+jalali(date)+' نمایش داده می‌شود و به‌عنوان سیگنال زنده تلقی نمی‌شود.</span>';
    const title=document.querySelector('#uxTodayV421 .ux-section-head-v421 h3');
    const sub=document.querySelector('#uxTodayV421 .ux-section-head-v421 p');
    if(title)title.textContent='فرصت‌های مهم آخرین روز معاملاتی';
    if(sub)sub.textContent='مرور شکارهای ثبت‌شده '+jalali(date)+'؛ این فهرست آرشیوی است و فرمان ورود لحظه‌ای نیست.';
    const grid=$('uxActionGridV421');
    const important=[...special,...urgent].sort((a,b)=>(Number(b.hunt_score)||0)-(Number(a.hunt_score)||0)).slice(0,8);
    if(grid)grid.innerHTML=important.length?important.map(archiveCard).join(''):'<div class="ux-empty-v421" style="grid-column:1/-1"><b>در آخرین روز معاملاتی شکار ویژه یا هشدار فوری ثبت نشده است.</b><span>سفر شکار همچنان تمام رخدادهای ثبت‌شده روز را نگه می‌دارد.</span></div>';
  }
  async function load(){
    if(sessionOpen())return;
    try{
      const d=await get('stock_hunter_hunt_journey_v416','select=trade_date&order=trade_date.desc&limit=1');
      const date=String(d?.[0]?.trade_date||'');if(!date)return;
      const fields='trade_date,symbol_id,symbol,company_name,hunt_state,hunt_score,hunt_mode,detected_at,detected_day_change,result_label,same_day_mfe_pct,same_day_mae_pct,market_context';
      const rows=await get('stock_hunter_hunt_journey_v416','select='+encodeURIComponent(fields)+'&trade_date=eq.'+encodeURIComponent(date)+'&order=hunt_score.desc&limit=1500');
      renderArchive(date,Array.isArray(rows)?rows:[]);
    }catch(e){console.warn('Stock Hunter last-session summary unavailable',e);}
  }
  setTimeout(load,600);
  window.StockHunterLastSessionV427={version:'4.2.7',load};
})();

