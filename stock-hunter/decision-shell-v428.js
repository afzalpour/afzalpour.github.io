'use strict';
/* Stock Hunter Decision Shell 4.2.8 — presentation only. Frozen Hunt 4.1.6 is untouched. */
(function(){
  if(window.StockHunterDecisionShellV428||!document.getElementById('mainTable'))return;
  const VERSION='4.2.8-decision-shell1';
  const body=document.body,$=id=>document.getElementById(id);
  const cfg=window.STOCK_HUNTER_CONFIG||{};
  const base=String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');
  const key=String(cfg.SUPABASE_PUBLISHABLE_KEY||cfg.publishableKey||'');
  const headers=base&&key?{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'}:{};
  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fa=v=>String(v??'').replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  const num=(v,d=1)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';};
  const pct=(v,d=1)=>{const n=Number(v);return Number.isFinite(n)?(n>0?'+':'')+num(n,d)+'٪':'—';};
  const jalali=v=>{const d=new Date(String(v||'')+'T12:00:00Z');return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('fa-IR-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):'—';};
  body.classList.add('stock-decision-v428');

  let journeyById=new Map(),forwardById=new Map(),lastSignature='';
  let decorateTimer=0,dataTimer=0;

  function prepared(){
    try{return (Array.isArray(rows)?rows:[]).map(x=>typeof applyHuntV416==='function'?applyHuntV416(x):x);}catch{return [];}
  }
  function preparedMap(){const m=new Map();for(const x of prepared())if(x?.id!=null)m.set(String(x.id),x);return m;}
  async function get(table,q){
    if(!base||!key)throw new Error('config-unavailable');
    const r=await fetch(base+'/rest/v1/'+table+'?'+q,{headers,cache:'no-store'});
    if(!r.ok)throw new Error(table+':'+r.status);
    return r.json();
  }

  function ensureDecisionStrip(){
    if($('uiDecisionStripV428'))return;
    const today=$('uxTodayV421'),ws=document.querySelector('.workspace');if(!today||!ws)return;
    const bar=document.createElement('section');bar.id='uiDecisionStripV428';bar.className='ui-decision-strip-v428';
    bar.innerHTML=
      '<div><span>بازار</span><b id="uiDecisionMarketV428">در حال بررسی</b></div>'+
      '<div><span>داده</span><b id="uiDecisionDataV428">در حال دریافت</b></div>'+
      '<div><span>شکار ویژه</span><b id="uiDecisionSpecialV428">۰</b></div>'+
      '<div><span>هشدار فوری</span><b id="uiDecisionUrgentV428">۰</b></div>'+
      '<div class="pick"><span>بهترین فرصت</span><b id="uiDecisionTopV428">—</b></div>'+
      '<div class="model"><span>مدل</span><b>۴.۱.۶ · ثابت</b></div>';
    today.insertAdjacentElement('beforebegin',bar);
  }
  function updateDecisionStrip(){
    ensureDecisionStrip();
    const feed=String($('feedState')?.textContent||$('feedBadge')?.textContent||'در حال بررسی').trim();
    const market=$('uiDecisionMarketV428'),data=$('uiDecisionDataV428');
    if(market)market.textContent=feed.length>28?feed.slice(0,28)+'…':feed;
    if(data){
      const times=String($('scanTimes')?.textContent||'').trim();
      data.textContent=/خطا|قطع|قدیمی|نامعتبر/.test(feed)?'نیازمند بررسی':(times&&times!=='—'?'تازه':'دریافت‌شده');
      data.className=/خطا|قطع|قدیمی|نامعتبر/.test(feed)?'bad':'ok';
    }
    if($('uiDecisionSpecialV428'))$('uiDecisionSpecialV428').textContent=$('specialCount')?.textContent||'۰';
    if($('uiDecisionUrgentV428'))$('uiDecisionUrgentV428').textContent=$('urgentCount')?.textContent||'۰';
    if($('uiDecisionTopV428'))$('uiDecisionTopV428').textContent=$('topSymbol')?.textContent||'—';
  }

  function relabelModes(){
    const simple=document.querySelector('[data-ux-mode="simple"]'),pro=document.querySelector('[data-ux-mode="pro"]');
    if(simple){simple.textContent='تصمیم';simple.title='نمای سریع برای انتخاب و پایش فرصت‌های امروز';}
    if(pro){pro.textContent='تحلیل';pro.title='نمای کامل جدول، فیلترها و داده‌های تخصصی';}
    const group=document.querySelector('.ux-mode-v421');if(group)group.setAttribute('aria-label','نوع نمایش: تصمیم یا تحلیل');
  }

  function groupSidebar(){
    const nav=document.querySelector('#uiSidebarV426 .ui-side-nav-v426');if(!nav||nav.dataset.groupedV428==='1')return;
    nav.dataset.groupedV428='1';
    const groups=[
      ['شکار',[["⌂","امروز","index.html",true],["↝","سفر شکار","journey/"],["◎","هشدارها و دیده‌بان","alerts/"]]],
      ['تحلیل',[["▦","آزمایشگاه آزمون تاریخی","backtest/"],["◇","فرصت‌های از دست‌رفته","missed/"],["◆","مرکز حرفه‌ای","professional/"]]],
      ['هوشمندی',[["✦","هوش مصنوعی","ai/"],["◫","عملکرد مدل","performance/"]]],
      ['سامانه',[["●","سلامت سامانه","reliability/"],["◉","حساب من","profile/"]]]
    ];
    nav.innerHTML=groups.map(g=>'<section class="ui-side-group-v428"><b class="ui-side-group-title-v428 ui-side-label-v426">'+g[0]+'</b>'+g[1].map(x=>'<a '+(x[3]?'class="active" ':'')+'href="'+x[2]+'"><span class="ui-ico-v426">'+x[0]+'</span><span class="ui-side-label-v426">'+x[1]+'</span></a>').join('')+'</section>').join('');
  }

  function ensureAnalysisLayer(){
    if($('uiAnalysisLayerV428'))return;
    const heat=$('uiHeatmapV426'),today=$('uxTodayV421'),ws=document.querySelector('.workspace');if(!ws||!today)return;
    const details=document.createElement('details');details.id='uiAnalysisLayerV428';details.className='ui-analysis-layer-v428';
    details.innerHTML='<summary><div><b>تحلیل و جدول کامل</b><span>فیلترها، رادار، ستون‌های تخصصی و تمام نمادها</span></div><em>باز کردن</em></summary>';
    (heat||today).insertAdjacentElement('afterend',details);
    details.addEventListener('toggle',()=>{
      const e=details.querySelector('summary em');if(e)e.textContent=details.open?'بستن':'باز کردن';
      body.classList.toggle('ui-analysis-open-v428',details.open);
    });
    syncAnalysisMode();
  }
  function syncAnalysisMode(){
    const d=$('uiAnalysisLayerV428');if(!d)return;
    d.open=body.classList.contains('ux-pro-v421');
    body.classList.toggle('ui-analysis-open-v428',d.open);
    const e=d.querySelector('summary em');if(e)e.textContent=d.open?'بستن':'باز کردن';
  }

  function rowReasons(x){
    const out=[];
    const push=(ok,label)=>{if(ok&&!out.includes(label)&&out.length<3)out.push(label);};
    push(Number(x?.orderPressureV416)>=60,'فشار سفارش قوی');
    push(Number(x?.flowVolumeV416)>=60,'جریان پول مناسب');
    push(Number(x?.impulseV416)>=60,'شتاب مثبت');
    push(Number(x?.continuation12V416??x?.continuationV416)>=60,'تداوم مناسب');
    push(Number(x?.marketContextV416)>=60,'زمینه بازار حمایتی');
    push(Number(x?.risk)<=45,'ریسک کنترل‌شده');
    if(!out.length)out.push('ترکیب شواهد موتور');
    return out;
  }
  function progressState(j){
    const label=String(j?.result_label||''),mfe=Number(j?.same_day_mfe_pct),det=Number(j?.detected_day_change);
    const zero=['CROSSED_ZERO','POSITIVE_CLOSE','HIT_PLUS1','HIT_PLUS2','HIT_PLUS3'].includes(label)||det>=0;
    const p1=['HIT_PLUS1','HIT_PLUS2','HIT_PLUS3'].includes(label)||mfe>=1;
    const p2=['HIT_PLUS2','HIT_PLUS3'].includes(label)||mfe>=2;
    const p3=label==='HIT_PLUS3'||mfe>=3;
    return [true,zero,p1,p2,p3];
  }
  function progressMarkup(j){
    const st=progressState(j),labels=['شناسایی','صفر','+۱٪','+۲٪','+۳٪'];
    return '<div class="ui-hunt-progress-v428" aria-label="مسیر شکار"><div class="ui-hunt-progress-head-v428"><span>مسیر شکار</span><small>'+(j?.trade_date?'جلسه '+jalali(j.trade_date):'در انتظار دفتر رخداد')+'</small></div><div class="ui-hunt-progress-track-v428">'+labels.map((l,i)=>'<span class="'+(st[i]?'reached':'')+'"><i></i><b>'+l+'</b></span>').join('')+'</div></div>';
  }
  function forwardCell(label,v,q){
    const has=v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)),n=has?Number(v):NaN,cls=!has?'pending':n>0?'pos':n<0?'neg':'flat';
    const quality=q==='PARTIAL'?' · توصیفی':'';
    return '<div class="'+cls+'"><span>'+label+'</span><b>'+pct(v,1)+'</b><small>'+(!has?'در انتظار بلوغ':(q==='FULL'?'جلسه کامل':quality||'ثبت‌شده'))+'</small></div>';
  }
  function forwardMarkup(f){
    if(!f)return '<div class="ui-forward-v428 empty"><div class="ui-forward-head-v428"><span>ماندگاری آخرین پیشنهاد</span><small>هنوز افق بعدی بالغ نشده است</small></div></div>';
    return '<div class="ui-forward-v428"><div class="ui-forward-head-v428"><span>ماندگاری آخرین پیشنهاد بالغ</span><small>'+jalali(f.trade_date)+' · '+(f.channel==='ACTION_NOW'?'اقدام اکنون':'رادار')+'</small></div><div class="ui-forward-grid-v428">'+
      forwardCell('D+1',f.d1_return_pct,f.d1_quality)+forwardCell('D+2',f.d2_return_pct,f.d2_quality)+forwardCell('D+3',f.d3_return_pct,f.d3_quality)+forwardCell('D+5',f.d5_return_pct,f.d5_quality)+'</div></div>';
  }

  function cardIds(){return [...document.querySelectorAll('#uxActionGridV421 .ux-hunt-card-v421')].map(card=>String(card.querySelector('[data-id]')?.dataset.id||card.querySelector('[data-why-id]')?.dataset.whyId||'')).filter(Boolean);}
  async function loadContext(ids){
    if(!ids.length||!base||!key)return;
    const sig=ids.slice().sort().join(',');if(sig===lastSignature&&journeyById.size)return;lastSignature=sig;
    const filter='('+ids.map(x=>encodeURIComponent(x)).join(',')+')';
    try{
      const [journey,forward]=await Promise.all([
        get('stock_hunter_hunt_journey_v416','select=trade_date,symbol_id,symbol,result_label,same_day_mfe_pct,detected_day_change,detected_at,hunt_state&symbol_id=in.'+filter+'&order=trade_date.desc,detected_at.desc&limit=120'),
        get('stock_hunter_forward_ui_v416','select=trade_date,channel,symbol_id,symbol,d1_return_pct,d1_quality,d2_return_pct,d2_quality,d3_return_pct,d3_quality,d5_return_pct,d5_quality&symbol_id=in.'+filter+'&order=trade_date.desc,alert_at.desc&limit=120')
      ]);
      journeyById=new Map();for(const x of Array.isArray(journey)?journey:[]){const id=String(x.symbol_id);if(!journeyById.has(id))journeyById.set(id,x);}
      forwardById=new Map();
      for(const x of Array.isArray(forward)?forward:[]){
        const id=String(x.symbol_id),prev=forwardById.get(id);
        const maturity=['d1_return_pct','d2_return_pct','d3_return_pct','d5_return_pct'].filter(k=>x[k]!==null&&x[k]!==undefined&&x[k]!==''&&Number.isFinite(Number(x[k]))).length;
        const prevMat=prev?['d1_return_pct','d2_return_pct','d3_return_pct','d5_return_pct'].filter(k=>prev[k]!==null&&prev[k]!==undefined&&prev[k]!==''&&Number.isFinite(Number(prev[k]))).length:-1;
        if(!prev||maturity>prevMat||(maturity===prevMat&&x.channel==='ACTION_NOW'))forwardById.set(id,x);
      }
      scheduleDecorate();
    }catch(e){console.warn('Stock Hunter decision context unavailable',e);}
  }

  function decorateCards(){
    const map=preparedMap(),cards=[...document.querySelectorAll('#uxActionGridV421 .ux-hunt-card-v421')];
    for(const card of cards){
      const id=String(card.querySelector('[data-id]')?.dataset.id||card.querySelector('[data-why-id]')?.dataset.whyId||'');if(!id)continue;
      const x=map.get(id),j=journeyById.get(id),f=forwardById.get(id);
      let reason=card.querySelector('.ui-reasons-v428');
      if(!reason){reason=document.createElement('div');reason.className='ui-reasons-v428';const actions=card.querySelector('.ux-hunt-actions-v421');actions?.insertAdjacentElement('beforebegin',reason);}
      if(reason)reason.innerHTML='<span>چرا مهم است؟</span><div>'+rowReasons(x).map(v=>'<b>'+safe(v)+'</b>').join('')+'</div>';
      let progress=card.querySelector('.ui-hunt-progress-v428');if(progress)progress.remove();
      const facts=card.querySelector('.ux-hunt-facts-v421');if(facts)facts.insertAdjacentHTML('afterend',progressMarkup(j));
      let forward=card.querySelector('.ui-forward-v428');if(forward)forward.remove();
      const p=card.querySelector('.ui-hunt-progress-v428');if(p)p.insertAdjacentHTML('afterend',forwardMarkup(f));
      card.dataset.decisionEnhancedV428='1';
    }
  }
  function scheduleDecorate(delay=60){clearTimeout(decorateTimer);decorateTimer=setTimeout(decorateCards,delay);}
  function scheduleData(delay=160){clearTimeout(dataTimer);dataTimer=setTimeout(()=>loadContext(cardIds()),delay);}

  function init(){
    ensureDecisionStrip();relabelModes();groupSidebar();ensureAnalysisLayer();updateDecisionStrip();
    scheduleDecorate();scheduleData();
    document.addEventListener('click',e=>{if(e.target.closest('[data-ux-mode]'))setTimeout(()=>{relabelModes();syncAnalysisMode();},0);});
    const grid=$('uxActionGridV421');if(grid)new MutationObserver(()=>{scheduleDecorate();scheduleData();updateDecisionStrip();}).observe(grid,{childList:true,subtree:false});
    const feed=$('feedState');if(feed)new MutationObserver(updateDecisionStrip).observe(feed,{childList:true,subtree:true,characterData:true});
    const side=$('uiSidebarV426');if(side)new MutationObserver(groupSidebar).observe(side,{childList:true,subtree:true});
    new MutationObserver(()=>{syncAnalysisMode();}).observe(body,{attributes:true,attributeFilter:['class']});
    setInterval(updateDecisionStrip,4000);
    window.StockHunterDecisionShellV428={version:VERSION,refresh:()=>{updateDecisionStrip();scheduleData(0);scheduleDecorate(0);}};
  }
  setTimeout(init,0);
})();