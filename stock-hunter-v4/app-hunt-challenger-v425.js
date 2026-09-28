'use strict';

// Stock Hunter 4.2.5 Challenger — SHADOW ONLY.
// It does not alter Frozen Hunt 4.1.6 scores, states, gates or routing.
// Approved changes:
// 1) price-aware MLOFI from top 3 levels;
// 2) time-of-day RVOL instead of Volume/BaseVolume;
// 3) remove QI/depth-ratio duplicate evidence;
// 4) use book persistence + conservative displayed-depth cancellation proxy;
// 5) separate Reversal and Acceleration scoring functions.

const HUNT_CHALLENGER_V425_VERSION='4.2.5-challenger-shadow-v1';
const c425Clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
const c425RangeSigned=v=>c425Clamp(50+50*c425Clamp(v,-1,1));
const c425Memo=new WeakMap();

function challengerFeatureReadyV425(x){
  return Boolean(x?.bookLevelsReadyV425)&&Number(x?.rvolTodSamplesV425||0)>=3;
}
function challengerOrderBookScoreV425(x){
  // QI and DepthRatio are algebraically redundant, so neither is double-counted here.
  // BidStack/AskPull are omitted because they are derived from the same book-depth changes as MLOFI.
  const imbalance=c425RangeSigned(x.bookImbalance3V425);
  const mlofi=c425RangeSigned(x.mlofi3V425);
  const persistence=c425Clamp(Number(x.bookPersistenceV425||0)*100);
  const cancel=c425Clamp(Number(x.cancelProxyV425||0)*100);
  return c425Clamp(.45*imbalance+.35*mlofi+.20*persistence-.25*cancel);
}
function challengerFlowScoreV425(x){
  const rf=Number(x.realFlow||0);
  const real=rf>0?c425Clamp(50+27*Math.log(Math.max(.15,rf))):38;
  const mature=Number(x.rvolTodSamplesV425||0)>=3&&Number(x.rvolTodV425||0)>0;
  const rvol=mature?c425Clamp(20+36*Number(x.rvolTodV425)):50;
  return c425Clamp(.55*real+.45*rvol);
}
function challengerImpulseV425(x,mode){
  const velocity=c425Clamp(50+Number(x.pv||0)*90);
  const trade=c425Clamp(50+Number(x.tradeAccel||0)*.25);
  const recovery=mode==='reversal'
    ? (typeof zeroRecoveryV416==='function'?zeroRecoveryV416(x):c425Clamp(x.recovery||0))
    : c425Clamp(x.recovery||50);
  const tech=typeof technicalImpulseScoreV416==='function'?technicalImpulseScoreV416(x):50;
  return c425Clamp(.35*velocity+.25*trade+.25*recovery+.15*tech);
}
function challengerContinuationV425(x){
  return typeof continuationScoreV416==='function'?continuationScoreV416(x):c425Clamp(x.cont||50);
}
function challengerMarketV425(x){
  return typeof marketContextScoreV416==='function'?marketContextScoreV416(x):50;
}
function challengerFeasibilityV425(x,mode,dayChange){
  if(typeof feasibilityScoreV416!=='function')return {score:50,left:0,distance:0,runway:0};
  return feasibilityScoreV416(x,mode,dayChange,{pv:Number(x.pv||0),ofi:Number(x.mlofi3V425||0),tradeAccel:Number(x.tradeAccel||0),accel:0,bidStack:0,askPull:0});
}
function challengerRiskPenaltyV425(x){
  // Preserve the Champion's risk semantics. The legacy cancellation term is intentionally
  // not reused because correction #4 replaces it with the new cancellation proxy in Order Score.
  return Math.max(0,Number(x.risk||0)-40)*.23;
}
function challengerGateV425(x){
  if(!(Number(x.last)>0&&Number(x.yesterday)>0)||Number(x.volume||0)<=0)return 'داده قیمت/حجم معتبر نیست';
  if(Number(x.risk||0)>=75)return 'ریسک لحظه‌ای بسیار بالا است';
  if(!Boolean(x.bookLevelsReadyV425))return 'سه سطح معتبر دفتر سفارش برای مقایسه آماده نیست';
  if(Number(x.rvolTodSamplesV425||0)<3)return 'حجم نسبی هم‌زمان هنوز به حداقل سه جلسه نرسیده است';
  return '';
}
function challengerEvidenceV425(x){
  let n=0;
  if(Number(x.mlofi3V425)>0.05)n++;
  if(Number(x.bookImbalance3V425)>0.10)n++;
  if(Number(x.bookPersistenceV425)>=0.50)n++;
  if(Number(x.rvolTodSamplesV425)>=3&&Number(x.rvolTodV425)>=1.10)n++;
  if(Number(x.realFlow)>=1.10)n++;
  if(Number(x.pv)>0.05)n++;
  return n;
}
function challengerBandV425(score,ready){
  if(!ready)return 'داده ناکافی برای مقایسه';
  if(score>=78)return 'قوی آزمایشی';
  if(score>=68)return 'نسبتاً قوی آزمایشی';
  if(score>=58)return 'زیرنظر آزمایشی';
  return 'عادی آزمایشی';
}

function challengerReversalV425(x,dayChange){
  const order=challengerOrderBookScoreV425(x);
  const impulse=challengerImpulseV425(x,'reversal');
  const feasibility=challengerFeasibilityV425(x,'reversal',dayChange);
  const flow=challengerFlowScoreV425(x);
  const market=challengerMarketV425(x);
  const continuation=challengerContinuationV425(x);
  // Keep the champion's top-level component weights to isolate the five approved changes.
  const today=c425Clamp(.28*order+.27*impulse+.20*feasibility.score+.15*flow+.10*market-challengerRiskPenaltyV425(x));
  const score=c425Clamp(today*(.82+.18*continuation/100));
  return {mode:'reversal',today,score,order,impulse,feasibility:feasibility.score,flow,market,continuation};
}
function challengerAccelerationV425(x,dayChange){
  const order=challengerOrderBookScoreV425(x);
  const impulse=challengerImpulseV425(x,'acceleration');
  const feasibility=challengerFeasibilityV425(x,'acceleration',dayChange);
  const flow=challengerFlowScoreV425(x);
  const market=challengerMarketV425(x);
  const continuation=challengerContinuationV425(x);
  const today=c425Clamp(.30*order+.30*impulse+.15*feasibility.score+.15*flow+.10*market-challengerRiskPenaltyV425(x));
  const score=c425Clamp(today*(.82+.18*continuation/100));
  return {mode:'acceleration',today,score,order,impulse,feasibility:feasibility.score,flow,market,continuation};
}

function applyHuntChallengerV425(x){
  if(!x||x.analyzed===false)return x;
  const key=[
    x.updated||'',x.last,x.yesterday,x.volume,
    x.bookImbalance3V425,x.mlofi3V425,x.bookPersistenceV425,x.cancelProxyV425,
    x.rvolTodV425,x.rvolTodSamplesV425,x.realFlow
  ].join('|');
  if(c425Memo.get(x)===key)return x;

  const day=typeof pctH416==='function'?pctH416(x.last,x.yesterday):(Number(x.yesterday)>0?(Number(x.last)/Number(x.yesterday)-1)*100:0);
  const mode=day<0?'reversal':day<1?'acceleration':'outside';
  x.challengerModeV425=mode;
  x.challengerGateV425=challengerGateV425(x);
  x.challengerComparableV425=challengerFeatureReadyV425(x)&&!x.challengerGateV425;
  x.challengerEvidenceV425=challengerEvidenceV425(x);
  x.challengerVersionV425=HUNT_CHALLENGER_V425_VERSION;

  if(mode==='outside'){
    x.challengerTodayV425=0;
    x.challengerScoreV425=0;
    x.challengerBandV425='خارج دامنه';
    c425Memo.set(x,key);
    return x;
  }

  const out=mode==='reversal'?challengerReversalV425(x,day):challengerAccelerationV425(x,day);
  x.challengerTodayV425=out.today;
  x.challengerScoreV425=out.score;
  x.challengerOrderV425=out.order;
  x.challengerImpulseV425=out.impulse;
  x.challengerFeasibilityV425=out.feasibility;
  x.challengerFlowV425=out.flow;
  x.challengerMarketV425=out.market;
  x.challengerContinuationV425=out.continuation;
  x.challengerBandV425=challengerBandV425(out.score,x.challengerComparableV425);
  c425Memo.set(x,key);
  return x;
}

function challengerPanelV425(x){
  applyHuntChallengerV425(x);
  const ready=x.challengerComparableV425;
  const mode=x.challengerModeV425==='reversal'?'برگشت منفی':x.challengerModeV425==='acceleration'?'شتاب مثبت':'خارج دامنه';
  const rvolSamples=Number(x.rvolTodSamplesV425||0);
  return '<div class="section-title">مدل آزمایشی شکار ۴.۲.۵ — سایه</div>'+
    '<div class="integrated-banner watch">'+
      '<div class="integrated-main"><span>مسیر مستقل</span><b>'+esc(mode)+'</b><small>روی تصمیم ۴.۱.۶ هیچ اثری ندارد</small></div>'+
      '<div class="integrated-score"><span>امتیاز سایه</span><b>'+fa(x.challengerScoreV425,1)+'</b><small>'+esc(x.challengerBandV425||'—')+'</small></div>'+
      '<div class="integrated-score"><span>کیفیت داده</span><b>'+(ready?'قابل مقایسه':'در حال بلوغ')+'</b><small>RVOL: '+fa(rvolSamples,0)+' جلسه هم‌زمان</small></div>'+
    '</div>'+
    '<div class="expert-grid">'+
      '<div><span>عدم‌تعادل سه‌ردیفی</span><b>'+fa(Number(x.bookImbalance3V425||0)*100,1)+'٪</b><small>بدون تکرار Depth Ratio</small></div>'+
      '<div><span>جریان سفارش سه‌سطحی</span><b>'+fa(Number(x.mlofi3V425||0),3)+'</b><small>قیمت‌محور، سه ردیف اول</small></div>'+
      '<div><span>پایداری سمت خرید</span><b>'+fa(Number(x.bookPersistenceV425||0)*100,0)+'٪</b><small>پایداری چند Snapshot</small></div>'+
      '<div><span>برآورد لغو عمق</span><b>'+fa(Number(x.cancelProxyV425||0)*100,0)+'٪</b><small>پروکسی محافظه‌کارانه؛ نه آمار رسمی لغو</small></div>'+
      '<div><span>حجم نسبی هم‌زمان روز</span><b>'+(rvolSamples>=3?fa(x.rvolTodV425,2)+' برابر':'در حال جمع‌آوری')+'</b><small>مقایسه با همان بازه ۵ دقیقه‌ای جلسات قبل</small></div>'+
      '<div><span>فشار سفارش آزمایشی</span><b>'+fa(x.challengerOrderV425,0)+'</b><small>Imbalance + MLOFI + Persistence − Cancellation</small></div>'+
      '<div><span>قدرت امروز آزمایشی</span><b>'+fa(x.challengerTodayV425,1)+'</b><small>Reversal و Acceleration جداگانه</small></div>'+
      '<div><span>شواهد مستقل</span><b>'+fa(x.challengerEvidenceV425,0)+'</b><small>صرفاً برای ارزیابی Shadow</small></div>'+
    '</div>'+
    (x.challengerGateV425?'<div class="integrated-gate">'+esc(x.challengerGateV425)+'</div>':'')+
    '<div class="calibration-note">این Challenger فقط برای جمع‌آوری و مقایسه آینده‌نگر ساخته شده است. آستانه‌های نمایشی آن مجوز معامله یا جایگزینی Champion نیستند و تا اعتبارسنجی خارج از نمونه و Shadow تغییر مسیر تولید ممنوع است.</div>';
}

const detailHTMLBeforeChallengerV425=detailHTML;
detailHTML=function(x,...args){
  if(x?.analyzed!==false)applyHuntChallengerV425(x);
  const html=detailHTMLBeforeChallengerV425(x,...args);
  if(!x||x.analyzed===false)return html;
  const panel=challengerPanelV425(x);
  const marker='<div class="detail-grid">';
  return html.includes(marker)?html.replace(marker,marker+panel):html+panel;
};

window.StockHunterChallengerV425={
  version:HUNT_CHALLENGER_V425_VERSION,
  apply:applyHuntChallengerV425,
  reversal:challengerReversalV425,
  acceleration:challengerAccelerationV425,
  featureReady:challengerFeatureReadyV425
};
