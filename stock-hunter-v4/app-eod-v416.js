'use strict';

// End-of-day layer for Stock Hunter 4.1.6.
// Primary source after 17:00 Tehran: persistent server-side event ledger.
// Fallback: final same-day snapshot logic, so the UI remains useful if the ledger is temporarily unavailable.

let eodLedgerRowsV416=[];
let eodLedgerDateV416='';
let eodLedgerLoadingV416=false;
let eodLedgerAvailableV416=false;

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

function fallbackEndOfDayPoolV416(){
  return rows.map(applyHuntV416).filter(x=>hadActivity9to17V416(x)&&Number(x.dayChangeV416)<1);
}

function strongestLedgerEventsV416(events){
  const rank={'شکار ویژه':2,'هشدار فوری':1},best=new Map();
  for(const e of Array.isArray(events)?events:[]){
    const id=String(e.symbol_id||'');if(!id)continue;
    const cur=best.get(id),er=rank[e.hunt_state]||0,cr=rank[cur?.hunt_state]||0;
    if(!cur||er>cr||(er===cr&&Number(e.max_hunt_score||0)>Number(cur.max_hunt_score||0)))best.set(id,e);
  }
  return [...best.values()];
}

function mergeEodLedgerV416(events,liveRows=rows){
  const live=new Map((Array.isArray(liveRows)?liveRows:[]).map(x=>[String(x.id),x]));
  return strongestLedgerEventsV416(events).map(e=>{
    const base=live.get(String(e.symbol_id));
    if(!base)return null;
    const mode=String(e.hunt_mode||'');
    return {
      ...base,
      eodArchivedV416:true,
      eodLedgerFirstSeenV416:e.first_seen_at||'',
      eodLedgerLastSeenV416:e.last_seen_at||'',
      hunt:e.hunt_state,
      huntModeV416:mode,
      huntModeLabelV416:mode==='reversal'?'برگشت منفی':'شتاب مثبت',
      huntScoreV416:Number(e.max_hunt_score||0),
      todayOpportunityV416:Number(e.max_today_opportunity||0),
      dayChangeV416:Number(e.day_change||0),
      huntEvidenceV416:Number(e.evidence_count||0),
      huntDynamicEvidenceV416:Number(e.dynamic_evidence_count||0),
      huntGate:'',
      huntDecisionV416:e.hunt_state==='شکار ویژه'?'شکار فعال — ثبت‌شده در طول روز':'تأیید سریع — ثبت‌شده در طول روز'
    };
  }).filter(Boolean).sort((a,b)=>b.huntScoreV416-a.huntScoreV416||b.todayOpportunityV416-a.todayOpportunityV416||b.fast-a.fast);
}

const applyHuntBeforeEodArchiveV416=applyHuntV416;
applyHuntV416=function(x){
  if(x?.eodArchivedV416)return x;
  return applyHuntBeforeEodArchiveV416(x);
};

async function loadEodLedgerV416(force=false){
  if(!isEndOfDayV416())return;
  const today=tehranClockV413().ymd;
  if(eodLedgerLoadingV416||(!force&&eodLedgerDateV416===today))return;
  const base=String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');if(!base)return;
  eodLedgerLoadingV416=true;
  try{
    const p=new URLSearchParams();
    p.set('select','trade_date,symbol_id,symbol,company_name,hunt_state,hunt_mode,first_seen_at,last_seen_at,max_hunt_score,max_today_opportunity,day_change,evidence_count,dynamic_evidence_count,source_version');
    p.set('trade_date',`eq.${today}`);p.set('order','max_hunt_score.desc');p.set('limit','2000');
    const r=await fetch(`${base}/rest/v1/stock_hunter_hunt_events_v416?${p.toString()}`,{headers:headers(),cache:'no-store'});
    if(!r.ok)throw new Error(`ledger ${r.status}`);
    const events=await r.json();
    eodLedgerRowsV416=mergeEodLedgerV416(events,rows);
    eodLedgerDateV416=today;
    eodLedgerAvailableV416=true;
  }catch{
    eodLedgerRowsV416=[];
    eodLedgerDateV416=today;
    eodLedgerAvailableV416=false;
  }finally{
    eodLedgerLoadingV416=false;
    try{render();}catch{}
  }
}

function endOfDayPoolV416(){
  if(eodLedgerAvailableV416)return eodLedgerRowsV416.slice();
  return fallbackEndOfDayPoolV416();
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
  const source=eodLedgerAvailableV416?'آرشیو پایدار رویدادهای روز':'آخرین وضعیت معتبر روز (Fallback)';
  $('topMeta').textContent=t?`${source} — ${t.huntModeLabelV416} — امتیاز شکار ${fa(t.huntScoreV416,0)}`:`جمع‌بندی پایان روز: ${source} — شکار ویژه/هشدار فوری ثبت نشده است`;
};

setTimeout(()=>{try{loadEodLedgerV416();}catch{}},0);
setInterval(()=>{try{if(isEndOfDayV416())loadEodLedgerV416(true);}catch{}},60000);
