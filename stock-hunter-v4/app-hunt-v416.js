'use strict';

// Stock Hunter 4.1.6 — goal-aligned intraday Hunt Engine.
// Objective A: negative -> positive reversal in the same session.
// Objective B: 0% <= dayChange < +1% early acceleration in the same session.
// 1–2 day continuation is only a bounded confirmation modifier.
// The five 10-day forecast models are display-only and never enter Hunt Score.

const HUNT_V416_VERSION='4.1.6-hunt-v2';
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

function snapNumV416(z,...keys){
  for(const k of keys){
    const v=Number(z?.[k]);
    if(Number.isFinite(v))return v;
  }
  return 0;
}
function snapTsSecV416(z){
  let t=snapNumV416(z,'T','t','time');
  if(t>1e12)t/=1000;
  return t;
}
function snapshotDynamicsV416(x){
  const src=Array.isArray(x?.snapshots)?x.snapshots.filter(Boolean):[];
  const sn=src.map(z=>({
    t:snapTsSecV416(z),
    last:snapNumV416(z,'Last','last'),
    volume:snapNumV416(z,'Volume','volume'),
    buyDepth:snapNumV416(z,'BuyDepth','buyDepth','buy_depth'),
    sellDepth:snapNumV416(z,'SellDepth','sellDepth','sell_depth')
  })).filter(z=>z.t>0).sort((a,b)=>a.t-b.t);
  if(sn.length<3)return {ready:false,count:sn.length,span:0,lastDt:0,pv15:0,ofi:0,bidStack:0,askPull:0,tradeAccel:0};
  const first=sn[0],last=sn[sn.length-1],prev=sn[sn.length-2];
  const span=Math.max(0,last.t-first.t),lastDt=Math.max(0,last.t-prev.t);
  const temporal=span>=20&&span<=15*60&&lastDt>0&&lastDt<=5*60;
  const hasCore=(first.last>0&&last.last>0)||(first.buyDepth+first.sellDepth+last.buyDepth+last.sellDepth>0)||(first.volume>0||last.volume>0);
  const pv15=temporal&&first.last>0?pctH416(last.last,first.last)*(15/span):0;
  const db=last.buyDepth-first.buyDepth,ds=last.sellDepth-first.sellDepth;
  const den=Math.abs(db)+Math.abs(ds)+Math.max(last.buyDepth+last.sellDepth,1)*.08;
  const ofi=temporal?Math.max(-1,Math.min(1,(db-ds)/den)):0;
  const bidStack=temporal&&first.buyDepth>0?Math.max(-100,Math.min(300,(last.buyDepth-first.buyDepth)/first.buyDepth*100)):0;
  const askPull=temporal&&first.sellDepth>0?Math.max(-100,Math.min(100,(first.sellDepth-last.sellDepth)/first.sellDepth*100)):0;
  let tradeAccel=0;
  if(temporal&&sn.length>=4){
    const mid=sn[Math.floor((sn.length-1)/2)];
    const dt1=Math.max(1,mid.t-first.t),dt2=Math.max(1,last.t-mid.t);
    const r1=Math.max(0,mid.volume-first.volume)/dt1,r2=Math.max(0,last.volume-mid.volume)/dt2;
    tradeAccel=r1>0?Math.max(-100,Math.min(500,(r2/r1-1)*100)):(r2>0?100:0);
  }
  return {ready:Boolean(temporal&&hasCore),count:sn.length,span,lastDt,pv15,ofi,bidStack,askPull,tradeAccel};
}
function reconcileDynamicV416(current,windowValue,deadband){
  const cur=Number(current||0),win=Number(windowValue||0);
  // A non-trivial current delta is more recent and therefore wins, especially when it turns negative.
  // Use the wider snapshot window only when the latest delta is effectively flat/noisy.
  if(Math.abs(cur)>deadband)return cur>0&&win>0?Math.max(cur,win):cur;
  return win;
}
function effectiveDynamicV416(x,dyn){
  return {
    pv:reconcileDynamicV416(x.pv,dyn.pv15,.005),
    ofi:reconcileDynamicV416(x.ofi,dyn.ofi,.01),
    tradeAccel:reconcileDynamicV416(x.tradeAccel,dyn.tradeAccel,1),
    accel:Number(x.accel||0),
    bidStack:reconcileDynamicV416(x.bidStack,dyn.bidStack,1),
    askPull:reconcileDynamicV416(x.askPull,dyn.askPull,1)
  };
}

function marketContextScoreV416(x){
  const regime=String(x.marketRegime||'');
  const regimeScore=regime==='صعودی'?72:regime==='خنثی'?55:regime==='نزولی'?34:regime==='پرنوسان'?45:50;
  const breadth=Number.isFinite(Number(x.marketBreadth))?clampH416(x.marketBreadth):50;
  return clampH416(.62*regimeScore+.38*breadth);
}
function orderPressureScoreV416(x,e){
  const qi=scoreRangeH416(x.qi,-.35,.45);
  const ofi=scoreRangeH416(e.ofi,-.25,.35);
  const dr=Number(x.depthRatio||0);
  const depth=dr>0?clampH416(50+32*Math.log(Math.max(.15,dr))):35;
  const bid=clampH416(50+Number(e.bidStack||0)*.75);
  const ask=clampH416(50+Number(e.askPull||0)*.8);
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
function huntAssetEligibleV416(x){
  const txt=String(`${x.assetType||''} ${x.company||''} ${x.symbol||''}`).replace(/‌/g,' ');
  if(/اختیار معامله|اختیارخ|اختیارف/.test(txt))return false;
  if(/اوراق بدهی|اسناد خزانه|درآمد ?ثابت|درآمدثابت|تسهیلات مسکن/.test(txt))return false;
  if(/^(اخزا|اراد|گام|افاد|تسه)/.test(String(x.symbol||'')))return false;
  return true;
}
function dynamicEvidenceCountV416(e){
  let c=0;
  if(Number(e.pv)>0.05)c++;
  if(Number(e.ofi)>0.05)c++;
  if(Number(e.tradeAccel)>15)c++;
  if(Number(e.accel)>5)c++;
  if(Number(e.bidStack)>10)c++;
  if(Number(e.askPull)>10)c++;
  return c;
}
function signalEvidenceCountV416(x,e){
  let c=dynamicEvidenceCountV416(e);
  if(Number(x.qi)>0.10)c++;
  if(Number(x.rvol)>=1.10)c++;
  if(Number(x.realFlow)>=1.10)c++;
  return c;
}
function impulseScoreV416(x,mode,e){
  const velocity=clampH416(50+Number(e.pv||0)*90);
  const trade=clampH416(50+Number(e.tradeAccel||0)*.25);
  const accel=clampH416(50+Number(e.accel||0)*1.8);
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
function feasibilityScoreV416(x,mode,dayChange,e){
  const left=minutesLeftV416(x),ts=timeScoreV416(left);
  if(mode==='reversal'){
    const distance=Math.max(0,-dayChange);
    const distanceScore=clampH416(100-distance*28);
    // Feed price_velocity is normalized to a 15-SECOND interval.
    // Keep a 15-minute rate for human-readable display, but compare like-for-like units.
    const required15s=left>0?distance/(left*60)*15:99;
    const required15m=left>0?distance/left*15:99;
    const actual15s=Math.max(0,Number(e.pv||0));
    const velocityFit=required15s>.000001?clampH416(20+70*(actual15s/required15s)):100;
    const zr=zeroRecoveryV416(x);
    return {score:clampH416(.40*velocityFit+.25*distanceScore+.20*ts+.15*zr),distance,required15s,required15m,left,runway:null};
  }
  const headroom=x.maxAllowed>0&&x.last>0?Math.max(0,pctH416(x.maxAllowed,x.last)):Math.max(.5,3-dayChange);
  const headroomScore=clampH416(22+headroom*24);
  const tech=technicalImpulseScoreV416(x);
  return {score:clampH416(.55*headroomScore+.25*ts+.20*tech),distance:0,required15s:0,required15m:0,left,runway:headroom};
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
function huntRiskGateV416(x,dyn){
  if(!(x.last>0&&x.yesterday>0)||Number(x.volume||0)<=0)return 'داده قیمت/حجم معتبر نیست';
  if(!dyn.ready)return 'تاریخچه زمانی معتبر برای محاسبه Deltaهای درون‌روزی کافی نیست';
  if(Number(x.risk||0)>=75)return 'ریسک لحظه‌ای بسیار بالا است';
  if(Number(x.cancel||0)>=90&&Number(x.abs||0)<12)return 'لغو سفارش بسیار بالا و جذب عرضه ضعیف است';
  return '';
}
function huntStatusV416(score,today,risk,evidence,gate){
  if(gate)return 'عادی';
  if(score>=78&&today>=82&&risk<=45&&evidence>=4)return 'شکار ویژه';
  if(score>=68&&today>=74&&risk<=55&&evidence>=3)return 'هشدار فوری';
  if(score>=58&&today>=64&&risk<=62&&evidence>=3)return 'شکار زودهنگام';
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
  const dyn=snapshotDynamicsV416(x),e=effectiveDynamicV416(x,dyn);
  x.dayChangeV416=dayChange;
  x.huntModeV416=mode;
  x.huntModeLabelV416=mode==='reversal'?'برگشت منفی':mode==='acceleration'?'شتاب مثبت':'خارج دامنه شکار';
  x.deltaReadyV416=dyn.ready;
  x.deltaSnapshotCountV416=dyn.count;
  x.deltaSpanSecV416=dyn.span;
  x.effectivePvV416=e.pv;
  x.effectiveOfiV416=e.ofi;
  x.minutesLeftV416=minutesLeftV416(x);
  x.orderPressureV416=orderPressureScoreV416(x,e);
  x.impulseV416=impulseScoreV416(x,mode==='outside'?'acceleration':mode,e);
  const fz=feasibilityScoreV416(x,mode==='outside'?'acceleration':mode,dayChange,e);
  x.feasibilityV416=fz.score;
  x.distanceToZeroV416=fz.distance;
  x.requiredVelocity15sV416=fz.required15s;
  x.requiredVelocity15V416=fz.required15m;
  x.runwayV416=fz.runway;
  x.flowVolumeV416=flowVolumeScoreV416(x);
  x.marketContextV416=marketContextScoreV416(x);
  x.continuation12V416=continuationScoreV416(x);
  x.huntDynamicEvidenceV416=dynamicEvidenceCountV416(e);
  x.huntEvidenceV416=signalEvidenceCountV416(x,e);

  let today=mode==='reversal'
    ? .28*x.orderPressureV416+.27*x.impulseV416+.20*x.feasibilityV416+.15*x.flowVolumeV416+.10*x.marketContextV416
    : .30*x.orderPressureV416+.30*x.impulseV416+.15*x.feasibilityV416+.15*x.flowVolumeV416+.10*x.marketContextV416;
  const riskPenalty=Math.max(0,Number(x.risk||0)-40)*.23+Math.max(0,Number(x.cancel||0)-60)*.10;
  today=clampH416(today-riskPenalty);
  x.todayOpportunityV416=today;
  // Bounded modifier: continuation can only confirm/reduce today's setup; it cannot create a strong hunt by itself.
  x.huntScoreV416=clampH416(today*(.82+.18*x.continuation12V416/100));

  let gate=huntRiskGateV416(x,dyn);
  if(!huntAssetEligibleV416(x))gate=gate||'این نوع ابزار در موتور شکار سریع سهام/صندوق‌های ریسکی قرار نمی‌گیرد';
  if(mode==='outside')gate='نماد از محدوده آغاز حرکت (+۱٪) عبور کرده است';
  if(mode==='acceleration'&&(x.huntEvidenceV416<3||x.huntDynamicEvidenceV416<2))
    gate=gate||'برای شتاب مثبت حداقل سه شاهد هم‌زمان و دو شاهد پویا لازم است';
  if(mode==='reversal'&&x.feasibilityV416<28)gate=gate||'فاصله/زمان برای مثبت‌شدن امروز نامناسب است';
  if(mode==='reversal'&&x.huntDynamicEvidenceV416<1&&zeroRecoveryV416(x)<55)
    gate=gate||'هنوز نشانه پویای کافی از شروع برگشت دیده نمی‌شود';

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
  if(q)return filteredBeforeHuntV416(); // Universal search is intentionally outside Hunt constraints.
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
    return `<article class="mobile-card"><div class="mobile-head"><div><div class="mobile-symbol">${esc(x.symbol)}</div><div class="company">${esc(x.company)}</div></div><div><span class="badge ${hc(x.hunt)}">${esc(x.hunt)}</span></div></div><div class="mobile-metrics"><div><span>نوع فرصت</span><b>${setup}</b></div><div><span>تغییر</span><b>${ch>0?'+':''}${fa(ch,2)}٪</b></div><div><span>امتیاز شکار</span><b>${fa(x.huntScoreV416,1)}</b></div><div><span>قدرت امروز</span><b>${fa(x.todayOpportunityV416,1)}</b></div><div><span>تداوم ۱–۲ روزه</span><b>${fa(x.continuation12V416,1)}</b></div><div><span>Delta</span><b>${x.deltaReadyV416?'آماده':'ناکافی'}</b></div></div><div class="mobile-foot"><span>${esc(x.huntDecisionV416||'')}</span><button class="detail-btn" data-id="${esc(x.id)}">جزئیات</button></div></article>`;
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
    if(x.requiredVelocity15V416>0)out.push(`سرعت لازم برای رسیدن به صفر حدود ${fa(x.requiredVelocity15V416,2)}٪ در هر ۱۵ دقیقه است؛ سرعت مؤثر مشاهده‌شده ${fa(x.effectivePvV416*60,2)}٪ در هر ۱۵ دقیقه است.`);
  }else if(x.huntModeV416==='acceleration'){
    out.push(`نماد ${fa(x.dayChangeV416,2)}٪ تغییر دارد و هنوز در محدوده آغاز حرکت زیر +۱٪ قرار دارد.`);
    if(x.runwayV416!=null)out.push(`فضای تقریبی تا سقف مجاز روز ${fa(x.runwayV416,2)}٪ است.`);
  }
  const comps=[
    ['فشار سفارش',x.orderPressureV416],['شتاب حرکت',x.impulseV416],['امکان‌پذیری امروز',x.feasibilityV416],['جریان پول/حجم',x.flowVolumeV416],['شرایط بازار',x.marketContextV416],['تداوم ۱–۲ روزه',x.continuation12V416]
  ].sort((a,b)=>b[1]-a[1]);
  out.push(`${comps[0][0]} با امتیاز ${fa(comps[0][1],0)} قوی‌ترین مؤلفه فعلی است.`);
  return out.slice(0,3);
}
function huntPanelV416(x){
  applyHuntV416(x);
  const reasons=huntReasonsV416(x);
  const modeIcon=x.huntModeV416==='reversal'?'↗':x.huntModeV416==='acceleration'?'⚡':'—';
  const interp=x.huntScoreV416>=78?'قوی':x.huntScoreV416>=68?'نسبتاً قوی':x.huntScoreV416>=58?'متوسط رو به مثبت':x.huntScoreV416>=50?'رصد':'ضعیف';
  return `<div class="section-title">تحلیل فرصت شکار امروز</div>
    <div class="integrated-banner ${x.hunt==='شکار ویژه'?'buy':x.hunt==='هشدار فوری'?'early':'watch'}">
      <div class="integrated-main"><span>نوع فرصت</span><b>${modeIcon} ${esc(x.huntModeLabelV416)}</b><small>دامنه ورودی: منفی‌ها و کمتر از +۱٪</small></div>
      <div class="integrated-score"><span>امتیاز شکار</span><b>${fa(x.huntScoreV416,1)}</b><small>${interp} — امتیاز مهندسی؛ نه احتمال موفقیت</small></div>
      <div class="integrated-score"><span>قدرت حرکت امروز</span><b>${fa(x.todayOpportunityV416,1)}</b><small>${esc(x.huntDecisionV416)}</small></div>
      <div class="integrated-score"><span>تداوم ۱–۲ روزه</span><b>${fa(x.continuation12V416,1)}</b><small>فقط نقش تأییدی دارد</small></div>
    </div>
    ${x.huntGate?`<div class="integrated-gate">${esc(x.huntGate)}</div>`:''}
    <div class="expert-grid">
      <div><span>تغییر لحظه‌ای</span><b>${x.dayChangeV416>0?'+':''}${fa(x.dayChangeV416,2)}٪</b><small>${x.huntModeV416==='reversal'?`فاصله تا صفر ${fa(x.distanceToZeroV416,2)}٪`:'زیر آستانه +۱٪'}</small></div>
      <div><span>زمان/سرعت لازم</span><b>${fa(x.minutesLeftV416,0)} دقیقه</b><small>${x.huntModeV416==='reversal'?`${fa(x.requiredVelocity15V416,2)}٪ / ۱۵ دقیقه`:'فضای حرکت بررسی شد'}</small></div>
      <div><span>فشار سفارش</span><b>${fa(x.orderPressureV416,0)}</b><small>QI / OFI / عمق سفارش</small></div>
      <div><span>شتاب حرکت</span><b>${fa(x.impulseV416,0)}</b><small>سرعت قیمت و معاملات</small></div>
      <div><span>امکان تکمیل امروز</span><b>${fa(x.feasibilityV416,0)}</b><small>فاصله، زمان و سرعت لازم</small></div>
      <div><span>جریان پول/حجم</span><b>${fa(x.flowVolumeV416,0)}</b><small>حقیقی / RVOL / جذب عرضه</small></div>
      <div><span>شرایط بازار</span><b>${fa(x.marketContextV416,0)}</b><small>${esc(x.marketRegime||'خنثی')} / عرض بازار</small></div>
      <div><span>شواهد هم‌زمان</span><b>${fa(x.huntEvidenceV416,0)}</b><small>${fa(x.huntDynamicEvidenceV416,0)} شاهد پویا</small></div>
      <div><span>کیفیت Delta</span><b>${x.deltaReadyV416?'آماده':'ناکافی'}</b><small>${fa(x.deltaSnapshotCountV416,0)} Snapshot / ${fa(x.deltaSpanSecV416,0)} ثانیه</small></div>
    </div>
    <div class="decision-reasons"><b>توضیح شکار:</b><ol>${reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ol></div>
    <div class="calibration-note">هدف این موتور فقط شناسایی برگشت منفی به مثبت همان روز یا شتاب‌گیری نمادهای کمتر از +۱٪ است. ایچیموکو، گن، بولینگر، MACD و OBV صرفاً برای مشاهده و مقایسه نمایش داده می‌شوند و در Hunt Score هیچ وزن مستقیمی ندارند.</div>`;
}
const detailHTMLBeforeHuntV416=detailHTML;
detailHTML=function(x,...args){
  applyHuntV416(x);
  const html=detailHTMLBeforeHuntV416(x,...args);
  return html.replace('<div class="detail-grid">',`<div class="detail-grid">${huntPanelV416(x)}`);
};

setTimeout(()=>{
  try{
    rows.forEach(applyHuntV416);
    if(typeof universeRows!=='undefined')universeRows.forEach(x=>{if(x?.analyzed!==false)applyHuntV416(x)});
    renderColumnOptions();
    render();
  }catch{}
},0);
