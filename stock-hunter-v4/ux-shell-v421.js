'use strict';
(function(){
  if(window.StockHunterUxV421)return;
  const VERSION='4.2.1-ux1';
  const $u=id=>document.getElementById(id);
  const escU=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const faU=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—';};
  const pctU=(v,d=2)=>{const n=Number(v);return Number.isFinite(n)?(n>0?'+':'')+faU(n,d)+'٪':'—';};
  const body=document.body;
  if(!body||!document.getElementById('mainTable'))return;
  body.classList.add('stock-ux-v421');

  function group(title,items){
    return '<details><summary>'+title+'</summary><div class="ux-grouped-nav-menu-v421">'+items.map(x=>'<a href="'+x[1]+'">'+x[0]+'</a>').join('')+'</div></details>';
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
    const tableBtn=$u('uxTableToggleV421');if(tableBtn)tableBtn.textContent=m==='pro'?'جدول حرفه‌ای فعال است':body.classList.contains('ux-table-open-v421')?'بستن جدول کامل':'نمایش جدول کامل';
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
    body.appendChild(d);$u('uxOnboardingDoneV421').onclick=()=>{localStorage.setItem('stockHunterOnboardingV421','1');d.close();};setTimeout(()=>{try{d.showModal();}catch{}},300);
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
      modeMarkup()+'<a class="ux-btn-v421" href="report/">گزارش بازار</a><a class="ux-btn-v421" href="performance/">رکورد واقعی</a><button id="uxTableToggleV421" class="ux-btn-v421" type="button">نمایش جدول کامل</button></div></div>'+
      '<div id="uxPulseV421" class="ux-pulse-v421">'+
      '<article><span>وضعیت بازار</span><b id="uxPulseMarketV421">در حال بررسی</b><small id="uxPulseMarketSubV421">—</small></article>'+
      '<article><span>اقدام فوری</span><b id="uxPulseActionV421">۰</b><small>شکار ویژه + هشدار فوری تازه</small></article>'+
      '<article><span>رادار نزدیک</span><b id="uxPulseRadarV421">۰</b><small>شکارهای زودهنگام تازه</small></article>'+
      '<article><span>شرایط بازار</span><b id="uxPulseContextV421">—</b><small id="uxPulseContextSubV421">مؤلفه ثبت‌شده موتور</small></article>'+
      '<article><span>نمادهای دریافت‌شده</span><b id="uxPulseRowsV421">۰</b><small>کل ردیف‌های بارگذاری‌شده</small></article></div>'+
      '<div class="ux-section-head-v421"><div><h3>فرصت‌های مهم امروز</h3><p>فقط صف اقدام فوری؛ رادار نزدیک جداگانه پایین این بخش باقی می‌ماند.</p></div></div>'+
      '<div id="uxActionGridV421" class="ux-opportunity-grid-v421"></div>'+
      '<div id="uxRecordV421" class="ux-record-v421"><div><b>رکورد واقعی در حال شکل‌گیری است</b><span id="uxRecordTextV421">در حال دریافت دفتر رسمی رخدادها…</span></div><a class="ux-btn-v421" href="performance/">مشاهده جزئیات</a></div>';
    ws.insertBefore(sec,summary);
    sec.addEventListener('click',e=>{
      const mode=e.target.closest('[data-ux-mode]');if(mode){setMode(mode.dataset.uxMode);return;}
      const table=e.target.closest('#uxTableToggleV421');if(table){body.classList.toggle('ux-table-open-v421');setMode(body.classList.contains('ux-pro-v421')?'pro':'simple');if(body.classList.contains('ux-table-open-v421'))document.querySelector('.table-panel')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
      const why=e.target.closest('[data-why-id]');if(why){showWhy(why.dataset.whyId);return;}
    });
  }

  function preparedRows(){
    try{return (Array.isArray(rows)?rows:[]).map(x=>typeof applyHuntV416==='function'?applyHuntV416(x):x);}catch{return [];}
  }
  function activeRows(){
    const a=preparedRows();return a.filter(x=>{
      try{return (typeof isActionFreshV416!=='function'||isActionFreshV416(x))&&(typeof isActionSessionV416!=='function'||isActionSessionV416(x));}catch{return true;}
    });
  }
  function actionRows(){
    return preparedRows().filter(x=>{try{return typeof isActionNowV416==='function'?isActionNowV416(x):['شکار ویژه','هشدار فوری'].includes(x.hunt);}catch{return false;}})
      .sort((a,b)=>(Number(b.huntScoreV416)||0)-(Number(a.huntScoreV416)||0)||(Number(b.todayOpportunityV416)||0)-(Number(a.todayOpportunityV416)||0)).slice(0,8);
  }
  function radarRows(){
    return preparedRows().filter(x=>{try{return typeof isRadarEarlyV416==='function'?isRadarEarlyV416(x):x.hunt==='شکار زودهنگام';}catch{return false;}});
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
  function card(x){
    const cls=x.hunt==='شکار ویژه'?'special':'urgent',personal=!!$u('personalWatchlistV417');
    const watch=personal?'<button type="button" class="ux-btn-v421 personal-star-v417" data-watch-id="'+escU(x.id)+'" data-watch-symbol="'+escU(x.symbol)+'">☆ دیده‌بان</button>':'<a class="ux-btn-v421" href="profile/">دیده‌بان</a>';
    return '<article class="ux-hunt-card-v421 '+cls+'"><div class="ux-hunt-card-top-v421"><div><b>'+escU(x.symbol)+'</b><small>'+escU(x.company||'')+'</small></div><span class="ux-state-chip-v421">'+escU(x.hunt)+'</span></div>'+
      '<div class="ux-hunt-card-score-v421"><div><strong>'+faU(x.huntScoreV416,0)+'</strong><span>از ۱۰۰ · امتیاز، نه احتمال</span></div><em>'+escU(x.huntModeLabelV416||'—')+'</em></div>'+
      '<div class="ux-hunt-facts-v421"><div><span>تغییر</span><b>'+pctU(x.dayChangeV416,2)+'</b></div><div><span>فشار سفارش</span><b>'+strength(x.orderPressureV416)+'</b></div><div><span>ریسک</span><b>'+strength(x.risk,true)+'</b></div></div>'+
      '<div class="ux-hunt-actions-v421"><button type="button" class="ux-btn-v421 primary" data-why-id="'+escU(x.id)+'">چرا این سهم؟</button><button type="button" class="ux-btn-v421 detail-btn" data-id="'+escU(x.id)+'">نمایش</button>'+watch+'</div></article>';
  }
  function renderToday(){
    if(!$u('uxTodayV421'))return;
    const all=preparedRows(),active=activeRows(),actions=actionRows(),radar=radarRows();
    const feed=$u('feedState')?.textContent||$u('feedBadge')?.textContent||'در حال بررسی';
    $u('uxPulseMarketV421').textContent=feed;
    $u('uxPulseMarketSubV421').textContent=$u('scanTimes')?.textContent||'—';
    $u('uxPulseActionV421').textContent=actions.length.toLocaleString('fa-IR');
    $u('uxPulseRadarV421').textContent=radar.length.toLocaleString('fa-IR');
    $u('uxPulseRowsV421').textContent=all.length.toLocaleString('fa-IR');
    const contexts=active.map(x=>Number(x.marketContextV416)).filter(Number.isFinite),avg=contexts.length?contexts.reduce((a,b)=>a+b,0)/contexts.length:null;
    $u('uxPulseContextV421').textContent=contextLabel(avg);$u('uxPulseContextSubV421').textContent=avg==null?'داده کافی نیست':'امتیاز زمینه '+faU(avg,0)+' از ۱۰۰';
    const grid=$u('uxActionGridV421');
    if(actions.length)grid.innerHTML=actions.map(card).join('');
    else{const m=emptyMessage();grid.innerHTML='<div class="ux-empty-v421" style="grid-column:1/-1"><b>'+m[0]+'</b><span>'+m[1]+'</span></div>';}
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

  function installRenderHook(){
    if(typeof render!=='function'||render._uxV421)return;
    const prev=render;const wrapped=function(){const out=prev.apply(this,arguments);try{renderToday();}catch{}return out;};wrapped._uxV421=true;render=wrapped;
  }

  const searchBox=$u('search'),huntSelect=$u('hunt');
  if(searchBox)searchBox.addEventListener('input',()=>body.classList.toggle('ux-search-open-v421',!!searchBox.value.trim()));
  if(huntSelect)huntSelect.addEventListener('change',()=>body.classList.toggle('ux-filter-open-v421',!!huntSelect.value));
  setupGroupedNav();ensureToday();ensureWhyDialog();ensureMobileNav();wrapDetail();installRenderHook();
  const saved=localStorage.getItem('stockHunterUxModeV421')||'simple';setMode(saved);renderToday();loadRecord();ensureOnboarding();
  const observer=new MutationObserver(()=>{try{renderToday();}catch{}});const feed=$u('feedState');if(feed)observer.observe(feed,{subtree:true,childList:true,characterData:true});
  window.StockHunterUxV421={version:VERSION,setMode,renderToday,showWhy};
})();