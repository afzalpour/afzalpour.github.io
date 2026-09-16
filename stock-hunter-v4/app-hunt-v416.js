'use strict';

// Stock Hunter 4.1.6 — Goal-aligned intraday Hunt Engine.
// Primary objective:
//  A) negative -> positive reversal during the same session;
//  B) 0%..+1% early-positive -> acceleration / breakout during the same session.
//  1–2 day continuation is only a confirmation modifier. The five 10-day models remain display-only.

const HUNT_V416_VERSION='4.1.6-hunt-v1';
const clampH416=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
const pctH416=(a,b)=>Number(b)>0?((Number(a)/Number(b))-1)*100:0;
const scoreRangeH416=(v,lo,hi)=>hi===lo?50:clampH416((Number(v)-lo)/(hi-lo)*100);

const normBeforeHuntV416=norm;
norm=function(r){
  const x=normBeforeHuntV416(r);
  x.low=Number(r.low_price||0);
  x.high=Number(r.high_price||0);
  x.minAllowed=Number(r.min_allowed||0);
  x.maxAllowed=Number(r.max_allowed||0);
  x.buyDepth=Number(r.buy_depth||0);
  x.sellDepth=Number(r.sell_depth||0);
  x.bestBid=Number(r.best_bid||0);
  x.bestAsk=Number(r.best_ask||0);
  return applyHuntV416(x);
};

function marketContextScoreV416(x){
  const regime=String(x.marketRegime||'');
  const regimeScore=regime==='صعودی'?72:regime==='خنثی'?55:regime==='نزولی'?34:regime==='پرنوسان'?45:50;
  const breadth=Number.isFinite(Number(x.marketBreadth))?clampH416(x.marketBreadth):50;
  return clampH416(.62*regimeScore+.38*breadth);
}

function orderPressureScoreV416(x){
  const qi=scoreRangeH416(x.qi,-.35,.45);
  const ofi=scoreRangeH416(x.ofi,-.25,.35);
  const dr=Number(x.depthRatio||0);
  const depth=dr>0?clampH416(50+32*Math.log(Math.max(.15,dr))):35;
  const bid=clampH416(50+Number(x.bidStack||0)*.75);
  const ask=clampH416(50+Number(x.askPull||0)*.8);
  return clampH416(.32*qi+.30*ofi+.18*depth+.10*bid+.10*ask);
}

function technicalImpulseScoreV416(x){
  let s=50;
  if(x.vwap>0)s+=x.last>=x.vwap?12:-10;
  if(x.ema9>0&&x.ema21>0)s+=x.ema9>x.ema21?12:-10;
  if(x.rsi>0){
    if(x.rsi>=45&&x.rsi<=72)s+=8;
    else if(x.rsi>82)s-=14;
    else if(x.rsi<30)s-=5;
  }
  return clampH416(s);
}

function zeroRecoveryV416(x){
  const lo=Number(x.low||0),y=Number(x.yesterday||0),last=Number(x.last||0);
  if(!(lo>0&&y>lo&&last>0))return clampH416(x.recovery||0);
  return clampH416((last-lo)/(y-lo)*100);
}

function signalEvidenceCountV416(x){
  let c=0;
  if(Number(x.pv)>0.05)c++;
  if(Number(x.ofi)>0.05)c++;
  if(Number(x.qi)>0.10)c++;
  if(Number(x.tradeAccel)>15)c++;
  if(Number(x.accel)>5)c++;
  if(Number(x.rvol)>=1.10)c++;
  if(Number(x.realFlow)>=1.10)c++;
  return c;
}

function impulseScoreV416(x,mode){
  const velocity=clampH416(50+Number(x.pv||0)*90);
  const trade=clampH416(50+Number(x.tradeAccel||0)*.25);
  const accel=clampH416(50+Number(x.accel||0)*1.8);
  const rec=mode==='reversal'?zeroRecoveryV416(x):clampH416(x.recovery||50);
  const tech=technicalImpulseScoreV416(x);
  return clampH416(.30*velocity+.20*trade+.20*accel+.20*rec+.10*tech);
}

function minutesLeftV416(x){
  try{
    const s=sessionPhaseV413(x),now=tehranClockV413();
    return s.phase==='trading'?Math.max(0,s.end-now.hm):0;
  }catch{return 0;}
}

function timeScoreV416(m){
  if(m>=90)return 100;
  if(m>=60)return 86;
  if(m>=30)return 68;
  if(m>=15)return 45;
  if(m>0)return 22;
  return 0;
}

function feasibilityScoreV416(x,mode,dayChange){
  const left=minutesLeftV416(x),ts=timeScoreV416(left);
  if(mode==='reversal'){
    const distance=Math.max(0,-dayChange);
    const distanceScore=clampH416(100-distance*28);
    const required15=left>0?distance/left*15:99;
    const actual=Math.max(0,Number(x.pv||0));
    const velocityFit=required15>.001?clampH416(20+70*(actual/required15)):100;
    const zr=zeroRecoveryV416(x);
    return {score:clampH416(.40*velocityFit+.25*distanceScore+.20*ts+.15*zr),distance,required15,left,runway:null};
  }
  const headroom=x.maxAllowed>0&&x.last>0?Math.max(0,pctH416(x.maxAllowed,x.last)):Math.max(.5,3-dayChange);
  const headroomScore=clampH416(22+headroom*24);
  const tech=technicalImpulseScoreV416(x);
  return {score:clampH416(.55*headroomScore+.25*ts+.20*tech),distance:0,required15:0,left,runway:headroom};
}

function flowVolumeScoreV416(x){
  const rf=Number(x.realFlow||0);
  const real=rf>0?clampH416(50+27*Math.log(Math.max(.15,rf))):38;
  const rvol=Number(x.rvol||0)>0?clampH416(20+36*Number(x.rvol)):35;
  const absorption=Number.isFinite(Number(x.abs))?clampH416(x.abs):45;
  return clampH416(.45*real+.35*rvol+.20*absorption);
}

function continuationScoreV416(x){
  if(x.integratedEligible){
    return clampH416(.45*Number(x.cont||0)+.23*Number(x.trendScore||0)+.20*Number(x.flowScore||0)+.12*Number(x.momentumScore||0));
  }
  return clampH416(x.cont||50);
}

function huntRiskGateV416(x){
  if(!(x.last>0&&x.yesterday>0)||Number(x.volume||0)<=0)return 'داده قیمت/حجم معتبر نیست';
  if(Number(x.risk||0)>=75)return 'ریسک لحظه‌ای بسیار بالا است';
  if(Number(x.cancel||0)>=90&&Number(x.abs||0)<12)return 'لغو سفارش بسیار بالا و جذب عرضه ضعیف است';
  return '';
}

function huntStatusV416(score,today,risk,evidence,gate){
  if(gate)return 'عادی';
  if(score>=78&&today>=82&&risk<=45&&evidence>=3)return 'شکار ویژه';
  if(score>=68&&today>=74&&risk<=55&&evidence>=2)return 'هشدار فوری';
  if(score>=58&&today>=64&&risk<=62&&evidence>=2)return 'شکار زودهنگام';
  if(score>=50&&today>=55)return 'رصد';
  return 'عادی';
}

function huntDecisionV416(x){
  if(x.huntGate)return 'عدم شکار';
  if(x.hunt==='شکار ویژه')return 'شکار فعال';
  if(x.hunt==='هشدار فوری')return 'تأیید سریع';
  if(x.hunt==='شکار زودهنگام')return 'رصد نزدیک';
  if(x.hunt==='رصد')return 'رصد';
  return 'عدم شکار';
}

function applyHuntV416(x){
  if(!x||x.analyzed===false)return x;
  const dayChange=pctH416(x.last,x.yesterday);
  const mode=dayChange<0?'reversal':dayChange<1?'acceleration':'outside';
  x.dayChangeV416=dayChange;
  x.huntModeV416=mode;
  x.huntModeLabelV416=mode==='reversal'?'برگشت منفی':mode==='acceleration'?'شتاب مثبت':'خارج دامنه شکار';
  x.minutesLeftV416=minutesLeftV416(x);
  x.orderPressureV416=orderPressureScoreV416(x);
  x.impulseV416=impulseScoreV416(x,mode==='outside'?'acceleration':mode);
  const fz=feasibilityScoreV416(x,mode==='outside'?'acceleration':mode,dayChange);
  x.feasibilityV416=fz.score;
  x.distanceToZeroV416=fz.distance;
  x.requiredVelocity15V416=fz.required15;
  x.runwayV416=fz.runway;
  x.flowVolumeV416=flowVolumeScoreV416(x);
  x.marketContextV416=marketContextScoreV416(x);
  x.continuation12V416=continuationScoreV416(x);
  x.huntEvidenceV416=signalEvidenceCountV416(x);
  let today=mode==='reversal'
    ? .28*x.orderPressureV416+.27*x.impulseV416+.20*x.feasibilityV416+.15*x.flowVolumeV416+.10*x.marketContextV416
    : .30*x.orderPressureV416+.30*x.impulseV416+.15*x.feasibilityV416+.15*x.flowVolumeV416+.10*x.marketContextV416;
  const riskPenalty=Math.max(0,Number(x.risk||0)-40)*.23+Math.max(0,Number(x.cancel||0)-60)*.10;
  today=clampH416(today-riskPenalty);
  x.todayOpportunityV416=today;
  // Continuation can confirm/reduce today's setup but can never create a strong hunt by itself.
  x.huntScoreV416=clampH416(today*(.82+.18*x.continuation12V416/100));
  let gate=huntRiskGateV416(x);
  if(mode==='outside')gate=dayChange>=1?'نماد از محدوده آغاز حرکت (+۱٪) عبور کرده است':gate;
  if(mode==='acceleration'&&x.huntEvidenceV416<2)gate=gate||'برای شتاب مثبت هنوز شواهد هم‌زمان کافی وجود ندارد';
  if(mode==='reversal'&&x.feasibilityV416<28)gate=gate||'فاصله/زمان برای مثبت‌شدن امروز نامناسب است';
  x.huntGate=gate;
  x.hunt=huntStatusV416(x.huntScoreV416,x.todayOpportunityV416,Number(x.risk||0),x.huntEvidenceV416,gate);
  x.huntDecisionV416=huntDecisionV416(x);
  x.huntEngineVersionV416=HUNT_V416_VERSION;
  return x;
}

function isGoalCandidateV416(x){
  if(!x||x.analyzed===false)return false;
  applyHuntV416(x);
  if(x.dayChangeV416>=1)return false;
  if(typeof isHuntableNowV413==='function'&&!isHuntableNowV413(x))return false;
  return x.hunt==='شکار ویژه'||x.hunt==='هشدار فوری'||x.hunt==='شکار زودهنگام';
}

// Make the new hunting objective visible in the main table.
if(!columns.some(c=>c[0]==='huntSetupV416')){
  const sym=Math.max(0,columns.findIndex(c=>c[0]==='hunt'));
  columns.splice(sym,0,
    ['dayMoveV416','تغییر لحظه‌ای',true,9],
    ['huntSetupV416','نوع فرصت',true,11],
    ['huntScoreV416','امتیاز شکار',true,9]
  );
  visible.add('dayMoveV416');visible.add('huntSetupV416');visible.add('huntScoreV416');
}

const cellBeforeHuntV416=cell;
cell=function(k,x){
  if(x?.analyzed!==false)applyHuntV416(x);
  if(x?.analyzed===false&&['dayMoveV416','huntSetupV416','huntScoreV416'].includes(k))return '—';
  if(k==='dayMoveV416'){
    const v=Number(x.dayChangeV416||0),cls=v<0?'risk-high':v<1?'risk-low':'';
    return `<b class="${cls}">${v>0?'+':''}${fa(v,2)}٪</b>`;
  }
  if(k==='huntSetupV416'){
    if(x.huntModeV416==='reversal')return `<span class="badge urgent">↗ برگشت منفی</span><div class="company">تا صفر ${fa(x.distanceToZeroV416,2)}٪</div>`;
    if(x.huntModeV416==='acceleration')return `<span class="badge early">⚡ شتاب مثبت</span><div class="company">کمتر از +۱٪</div>`;
    return '<span class="badge watch">خارج دامنه</span>';
  }
  if(k==='huntScoreV416'){
    const cls=x.huntScoreV416>=78?'risk-low':x.huntScoreV416>=58?'':'risk-high';
    return `<b class="${cls}">${fa(x.huntScoreV416,1)}</b><div class="company">امتیاز، نه احتمال</div>`;
  }
  if(k==='hunt'){
    return `<span class="badge ${hc(x.hunt)}">${esc(x.hunt)}</span><div class="company">${esc(x.huntDecisionV416)}</div>`;
  }
  return cellBeforeHuntV416(k,x);
};

const filteredBeforeHuntV416=filtered;
filtered=function(){
  const q=$('search').value.trim();
  if(q)return filteredBeforeHuntV416(); // Search stays universal, including closed/out-of-scope symbols.
  const h=$('hunt').value,d=$('decision').value;
  const defaultStates=new Set(['شکار ویژه','هشدار فوری','شکار زودهنگام']);
  return rows.map(applyHuntV416).filter(x=>{
    if(typeof isHuntableNowV413==='function'&&!isHuntableNowV413(x))return false;
    if(x.dayChangeV416>=1)return false;
    if(h?x.hunt!==h:!defaultStates.has(x.hunt))return false;
    if(d&&x.decision!==d)return false;
    return true;
  }).sort((a,b)=>b.huntScoreV416-a.huntScoreV416||b.todayOpportunityV416-a.todayOpportunityV416||b.fast-a.fast);
};

renderMobile=function(a){
  $('mobileList').innerHTML=a.length?a.map(x=>{
    if(x?.analyzed!==false)applyHuntV416(x);
    const setup=x.huntModeV416==='reversal'?'↗ برگشت منفی':x.huntModeV416==='acceleration'?'⚡ شتاب مثبت':'—';
    const ch=Number(x.dayChangeV416||0);
    return `<article class="mobile-card"><div class="mobile-head"><div><div class="mobile-symbol">${esc(x.symbol)}</div><div class="company">${esc(x.company)}</div></div><div><span class="badge ${hc(x.hunt)}">${esc(x.hunt)}</span></div></div><div class="mobile-metrics"><div><span>نوع فرصت</span><b>${setup}</b></div><div><span>تغییر</span><b>${ch>0?'+':''}${fa(ch,2)}٪</b></div><div><span>امتیاز شکار</span><b>${fa(x.huntScoreV416,1)}</b></div><div><span>قدرت امروز</span><b>${fa(x.todayOpportunityV416,1)}</b></div><div><span>تداوم ۱–۲ روزه</span><b>${fa(x.continuation12V416,1)}</b></div></div><div class="mobile-foot"><span>${esc(x.huntDecisionV416||'')}</span><button class="detail-btn" data-id="${esc(x.id)}">جزئیات</button></div></article>`;
  }).join(''):'<div class="alert-box">در این لحظه کاندید هدف‌محور مطابق فیلتر فعلی وجود ندارد.</div>';
};

updateSummary=function(){
  const active=rows.map(applyHuntV416).filter(x=>typeof isHuntableNowV413!=='function'||isHuntableNowV413(x));
  const candidates=active.filter(x=>x.dayChangeV416<1);
  $('specialCount').textContent=candidates.filter(x=>x.hunt==='شکار ویژه').length.toLocaleString('fa-IR');
  $('urgentCount').textContent=candidates.filter(x=>x.hunt==='هشدار فوری').length.toLocaleString('fa-IR');
  $('buyCount').textContent=candidates.filter(x=>isGoalCandidateV416(x)).length.toLocaleString('fa-IR');
  const t=[...candidates].filter(isGoalCandidateV416).sort((a,b)=>b.huntScoreV416-a.huntScoreV416)[0];
  $('topSymbol').textContent=t?.symbol||'—';
  $('topMeta').textContent=t?`${t.huntModeLabelV416} — امتیاز شکار ${fa(t.huntScoreV416,0)} — ${t.huntDecisionV416}`:'در این لحظه شکار هدف‌محور وجود ندارد';
};

function huntReasonsV416(x){
  const out=[];
  if(x.huntGate)out.push(x.huntGate+'.');
  if(x.huntModeV416==='reversal'){
    out.push(`فاصله فعلی تا صفر ${fa(x.distanceToZeroV416,2)}٪ و زمان باقی‌مانده حدود ${fa(x.minutesLeftV416,0)} دقیقه است.`);
    if(x.requiredVelocity15V416>0)out.push(`سرعت لازم برای رسیدن به صفر حدود ${fa(x.requiredVelocity15V416,2)}٪ در هر ۱۵ دقیقه است؛ سرعت مشاهده‌شده ${fa(x.pv,2)}٪ است.`);
  }else if(x.huntModeV416==='acceleration'){
    out.push(`نماد فقط ${fa(x.dayChangeV416,2)}٪ مثبت است و هنوز در محدوده آغاز حرکت زیر +۱٪ قرار دارد.`);
    if(x.runwayV416!=null)out.push(`فضای تقریبی تا سقف مجاز روز ${fa(x.runwayV416,2)}٪ است.`);
  }
  const comps=[
    ['فشار سفارش',x.orderPressureV416],['شتاب حرکت',x.impulseV416],['امکان‌پذیری امروز',x.feasibilityV416],['جریان پول/حجم',x.flowVolumeV416],['تداوم ۱–۲ روزه',x.continuation12V416]
  ].sort((a,b)=>b[1]-a[1]);
  out.push(`${comps[0][0]} با امتیاز ${fa(comps[0][1],0)} قوی‌ترین مؤلفه فعلی است.`);
  return out.slice(0,3);
}

function huntPanelV416(x){
  applyHuntV416(x);
  const reasons=huntReasonsV416(x);
  const modeIcon=x.huntModeV416==='reversal'?'↗':x.huntModeV416==='acceleration'?'⚡':'—';
  return `<div class="section-title">موتور شکار سریع — هدف امروز و ۱–۲ روز آتی</div>
    <div class="integrated-banner ${x.hunt==='شکار ویژه'?'buy':x.hunt==='هشدار فوری'?'early':'watch'}">
      <div class="integrated-main"><span>نوع فرصت</span><b>${modeIcon} ${esc(x.huntModeLabelV416)}</b><small>دامنه ورودی: منفی‌ها و کمتر از +۱٪</small></div>
      <div class="integrated-score"><span>امتیاز شکار</span><b>${fa(x.huntScoreV416,1)}</b><small>امتیاز مهندسی؛ نه احتمال موفقیت</small></div>
      <div class="integrated-score"><span>قدرت حرکت امروز</span><b>${fa(x.todayOpportunityV416,1)}</b><small>${esc(x.huntDecisionV416)}</small></div>
      <div class="integrated-score"><span>تداوم ۱–۲ روزه</span><b>${fa(x.continuation12V416,1)}</b><small>فقط نقش تأییدی دارد</small></div>
    </div>
    ${x.huntGate?`<div class="integrated-gate">${esc(x.huntGate)}</div>`:''}
    <div class="expert-grid">
      <div><span>تغییر لحظه‌ای</span><b>${x.dayChangeV416>0?'+':''}${fa(x.dayChangeV416,2)}٪</b><small>${x.huntModeV416==='reversal'?`فاصله تا صفر ${fa(x.distanceToZeroV416,2)}٪`:'زیر آستانه +۱٪'}</small></div>
      <div><span>فشار سفارش</span><b>${fa(x.orderPressureV416,0)}</b><small>QI / OFI / عمق سفارش</small></div>
      <div><span>شتاب حرکت</span><b>${fa(x.impulseV416,0)}</b><small>سرعت قیمت و معاملات</small></div>
      <div><span>امکان‌پذیری امروز</span><b>${fa(x.feasibilityV416,0)}</b><small>${fa(x.minutesLeftV416,0)} دقیقه تا پایان این بازار</small></div>
      <div><span>جریان پول/حجم</span><b>${fa(x.flowVolumeV416,0)}</b><small>حقیقی / RVOL / جذب عرضه</small></div>
      <div><span>شواهد هم‌زمان</span><b>${fa(x.huntEvidenceV416,0)}</b><small>از ۷ نشانه کوتاه‌مدت</small></div>
    </div>
    <div class="decision-reasons"><b>توضیح شکار:</b><ol>${reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ol></div>
    <div class="calibration-note">هدف این موتور فقط شناسایی برگشت منفی به مثبت همان روز یا شتاب‌گیری نمادهای کمتر از +۱٪ است. ایچیموکو، گن، بولینگر، MACD و OBV همچنان صرفاً برای مشاهده و مقایسه کاربر نمایش داده می‌شوند و در امتیاز شکار رأی ندارند.</div>`;
}

const detailHTMLBeforeHuntV416=detailHTML;
detailHTML=function(x,...args){
  applyHuntV416(x);
  let html=detailHTMLBeforeHuntV416(x,...args);
  return html.replace('<div class="detail-grid">',`<div class="detail-grid">${huntPanelV416(x)}`);
};

// Re-score any rows that may have arrived before this late-loaded module and refresh the UI.
setTimeout(()=>{
  try{
    rows.forEach(applyHuntV416);
    if(typeof universeRows!=='undefined')universeRows.forEach(x=>{if(x?.analyzed!==false)applyHuntV416(x)});
    renderColumnOptions();
    render();
  }catch{}
},0);

if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=4.1.6').catch(()=>{});
