'use strict';

// After 17:00 Tehran on a trading day, keep the day's final strong Hunt results visible.
// Activity is accepted only when the symbol has real same-day activity between 09:00 and 17:00.

function tehranHmFromTsEodV416(ts){
  const d=new Date(Number(ts)*1000);if(!Number.isFinite(d.getTime()))return null;
  const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d),g=t=>p.find(z=>z.type===t)?.value||'';
  return Number(g('hour'))*60+Number(g('minute'));
}
function todayActivityTsEodV416(x){
  const now=tehranClockV413(),today=now.ymd;
  let t=0;try{t=Number(todayTradeEvidenceV413(x)||0);}catch{}
  if(t&&tehranYmdFromTsV413(t)===today)return t;
  const u=Date.parse(x?.updated||x?.universeLastSeenV416||'')/1000;
  if(Number.isFinite(u)&&u>0&&Number(x?.volume||0)>0&&tehranYmdFromTsV413(u)===today)return u;
  return 0;
}
function hadActivity9to17V416(x){
  const t=todayActivityTsEodV416(x);if(!t)return false;
  const hm=tehranHmFromTsEodV416(t);return hm!=null&&hm>=9*60&&hm<=17*60;
}
function isEndOfDayV416(){
  const now=tehranClockV413();return ['Sat','Sun','Mon','Tue','Wed'].includes(now.wd)&&now.hm>17*60;
}

// Preserve the feasibility clock at the last valid in-session activity after close.
const minutesLeftBeforeEodV416=minutesLeftV416;
minutesLeftV416=function(x){
  try{
    const s=assetSessionV413(x),phase=sessionPhaseV413(x),now=tehranClockV413();
    if(phase.phase==='trading')return Math.max(0,s.end-now.hm);
    if(isEndOfDayV416()){
      const t=todayActivityTsEodV416(x),hm=t?tehranHmFromTsEodV416(t):null;
      if(t&&tehranYmdFromTsV413(t)===now.ymd&&hm!=null&&hm>=s.tradeStart&&hm<=s.end)return Math.max(0,s.end-hm);
    }
  }catch{}
  return minutesLeftBeforeEodV416(x);
};

function endOfDayPoolV416(){
  return rows.map(applyHuntV416).filter(x=>hadActivity9to17V416(x)&&Number(x.dayChangeV416)<1);
}

const filteredBeforeEodV416=filtered;
filtered=function(){
  const q=$('search').value.trim();if(q)return filteredBeforeEodV416();
  if(!isEndOfDayV416())return filteredBeforeEodV416();
  const h=$('hunt').value,d=$('decision').value,defaultStates=new Set(['شکار ویژه','هشدار فوری']);
  return endOfDayPoolV416().filter(x=>{
    if(h?x.hunt!==h:!defaultStates.has(x.hunt))return false;
    if(d&&x.decision!==d)return false;
    return true;
  }).sort((a,b)=>b.huntScoreV416-a.huntScoreV416||b.todayOpportunityV416-a.todayOpportunityV416||b.fast-a.fast);
};

const updateSummaryBeforeEodV416=updateSummary;
updateSummary=function(){
  if(!isEndOfDayV416())return updateSummaryBeforeEodV416();
  const pool=endOfDayPoolV416(),special=pool.filter(x=>x.hunt==='شکار ویژه'),urgent=pool.filter(x=>x.hunt==='هشدار فوری'),strong=[...special,...urgent].sort((a,b)=>b.huntScoreV416-a.huntScoreV416),t=strong[0];
  $('specialCount').textContent=special.length.toLocaleString('fa-IR');
  $('urgentCount').textContent=urgent.length.toLocaleString('fa-IR');
  $('buyCount').textContent=strong.length.toLocaleString('fa-IR');
  $('topSymbol').textContent=t?.symbol||'—';
  $('topMeta').textContent=t?`جمع‌بندی پایان روز — ${t.huntModeLabelV416} — امتیاز شکار ${fa(t.huntScoreV416,0)}`:'جمع‌بندی پایان روز: شکار ویژه/هشدار فوری ثبت نشده است';
};
