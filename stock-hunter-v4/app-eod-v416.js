'use strict';

// Persistent EOD archive: after 17:00 Tehran show every Special/Urgent symbol
// that was captured at least once during 09:00–17:00, even if its live status later changed.
// If the server archive is temporarily unavailable, fall back to the final-state reconstruction.
let persistentEodArchiveV416=[],persistentEodArchiveReadyV416=false,persistentEodArchiveLoadingV416=false,persistentEodArchiveDateV416='';

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
function timeFaEodV416(v){
  const t=Date.parse(v||'');if(!Number.isFinite(t))return '—';
  return new Date(t).toLocaleTimeString('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit'});
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
function archiveRowToUiV416(a){
  const live=rows.find(x=>String(x.id)===String(a.symbol_id));
  const x=live?{...live}:{id:String(a.symbol_id),symbol:a.symbol||'—',company:a.company_name||'—',analyzed:false,fast:0,market:'',assetType:'',volume:0};
  x.eodArchivedV416=true;
  x.eodFirstSeenAtV416=a.first_seen_at||'';
  x.eodLastSeenAtV416=a.last_seen_at||'';
  x.eodPeakSeenAtV416=a.peak_seen_at||'';
  x.eodSampleCountV416=Number(a.sample_count||0);
  x.eodEngineVersionV416=a.engine_version||'';
  x.hunt=a.peak_state||'هشدار فوری';
  x.huntScoreV416=Number(a.peak_score||0);
  x.todayOpportunityV416=Number(a.peak_today_opportunity||0);
  x.dayChangeV416=Number(a.peak_day_change||0);
  x.huntModeV416=a.peak_mode||'';
  x.huntModeLabelV416=x.huntModeV416==='reversal'?'برگشت منفی':x.huntModeV416==='acceleration'?'شتاب مثبت':'ثبت در طول روز';
  x.decision=a.peak_decision||x.decision||'';
  x.archivePeakDecisionV416=x.decision;
  x.huntDecisionV416=x.hunt==='شکار ویژه'?'شکار فعال ثبت‌شده':x.hunt==='هشدار فوری'?'هشدار ثبت‌شده':'ثبت روزانه';
  return x;
}
function persistentEndOfDayPoolV416(){
  if(persistentEodArchiveReadyV416)return persistentEodArchiveV416.map(archiveRowToUiV416);
  return endOfDayPoolV416().filter(x=>x.hunt==='شکار ویژه'||x.hunt==='هشدار فوری');
}
async function loadPersistentEodArchiveV416(){
  if(!isEndOfDayV416()||persistentEodArchiveLoadingV416)return;
  const base=String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');
  const today=tehranClockV413().ymd;
  if(!base)return;
  persistentEodArchiveLoadingV416=true;
  try{
    const p=new URLSearchParams();
    p.set('select','trade_date,symbol_id,symbol,company_name,first_seen_at,last_seen_at,peak_seen_at,first_state,peak_state,latest_qualifying_state,sample_count,peak_score,peak_today_opportunity,peak_day_change,peak_mode,peak_decision,peak_evidence,peak_dynamic_evidence,last_activity_at,last_source_updated_at,engine_version');
    p.set('trade_date',`eq.${today}`);p.set('order','peak_score.desc');p.set('limit','2000');
    const r=await fetch(`${base}/rest/v1/stock_hunter_hunt_archive_v416?${p.toString()}`,{headers:headers(),cache:'no-store'});
    if(!r.ok)throw new Error(`archive ${r.status}`);
    persistentEodArchiveV416=await r.json();
    persistentEodArchiveReadyV416=true;persistentEodArchiveDateV416=today;
  }catch{
    if(persistentEodArchiveDateV416!==today){persistentEodArchiveReadyV416=false;persistentEodArchiveV416=[];}
  }finally{
    persistentEodArchiveLoadingV416=false;
    try{page=1;render();}catch{}
  }
}

const filteredBeforeEodV416=filtered;
filtered=function(){
  const q=$('search').value.trim();if(q)return filteredBeforeEodV416();
  if(!isEndOfDayV416())return filteredBeforeEodV416();
  const h=$('hunt').value,d=$('decision').value,defaultStates=new Set(['شکار ویژه','هشدار فوری']);
  return persistentEndOfDayPoolV416().filter(x=>{
    if(h?x.hunt!==h:!defaultStates.has(x.hunt))return false;
    if(d&&x.decision!==d)return false;
    return true;
  }).sort((a,b)=>b.huntScoreV416-a.huntScoreV416||b.todayOpportunityV416-a.todayOpportunityV416||Number(b.fast||0)-Number(a.fast||0));
};

const cellBeforePersistentEodV416=cell;
cell=function(k,x){
  if(!(isEndOfDayV416()&&x?.eodArchivedV416))return cellBeforePersistentEodV416(k,x);
  if(k==='hunt')return `<span class="badge ${hc(x.hunt)}">${esc(x.hunt)}</span><div class="company">ثبت پایدار روزانه • اوج ${timeFaEodV416(x.eodPeakSeenAtV416)}</div>`;
  if(k==='huntScoreV416')return `<b class="${x.huntScoreV416>=78?'risk-low':''}">${fa(x.huntScoreV416,1)}</b><div class="company">اوج ثبت‌شده روز</div>`;
  if(k==='dayMoveV416')return `<b>${x.dayChangeV416>0?'+':''}${fa(x.dayChangeV416,2)}٪</b><div class="company">در زمان اوج شکار</div>`;
  if(k==='huntSetupV416'){
    const label=x.huntModeV416==='reversal'?'↗ برگشت منفی':x.huntModeV416==='acceleration'?'⚡ شتاب مثبت':'ثبت روزانه';
    return `<span class="badge ${x.huntModeV416==='reversal'?'urgent':'early'}">${label}</span><div class="company">${timeFaEodV416(x.eodFirstSeenAtV416)} تا ${timeFaEodV416(x.eodLastSeenAtV416)}</div>`;
  }
  if(k==='decision')return `<span class="badge ${dc(x.decision||'')}">${esc(x.decision||'—')}</span><div class="company">تأیید تکمیلی در زمان اوج</div>`;
  if(k==='symbol'){
    const y={...x,eodArchivedV416:false};
    const base=cellBeforePersistentEodV416(k,y);
    return `${base}<div class="company risk-low">در طول روز ثبت شده • ${fa(x.eodSampleCountV416,0)} نمونه</div>`;
  }
  if(k==='details')return `<button class="detail-btn" data-id="${esc(x.id)}" title="جزئیات فعلی نماد؛ وضعیت شکار بالا مربوط به اوج ثبت‌شده امروز است">جزئیات فعلی</button>`;
  return cellBeforePersistentEodV416(k,{...x,eodArchivedV416:false});
};

const renderMobileBeforePersistentEodV416=renderMobile;
renderMobile=function(a){
  if(!(isEndOfDayV416()&&a.some(x=>x?.eodArchivedV416)))return renderMobileBeforePersistentEodV416(a);
  $('mobileList').innerHTML=a.length?a.map(x=>`<article class="mobile-card"><div class="mobile-head"><div><div class="mobile-symbol">${esc(x.symbol)}</div><div class="company">${esc(x.company)}</div></div><div><span class="badge ${hc(x.hunt)}">${esc(x.hunt)}</span></div></div><div class="mobile-metrics"><div><span>اوج امتیاز شکار</span><b>${fa(x.huntScoreV416,1)}</b></div><div><span>قدرت امروز در اوج</span><b>${fa(x.todayOpportunityV416,1)}</b></div><div><span>تغییر در اوج</span><b>${x.dayChangeV416>0?'+':''}${fa(x.dayChangeV416,2)}٪</b></div><div><span>اولین ثبت</span><b>${timeFaEodV416(x.eodFirstSeenAtV416)}</b></div><div><span>آخرین ثبت</span><b>${timeFaEodV416(x.eodLastSeenAtV416)}</b></div><div><span>نمونه ثبت‌شده</span><b>${fa(x.eodSampleCountV416,0)}</b></div></div><div class="mobile-foot"><span>آرشیو پایدار پایان روز</span><button class="detail-btn" data-id="${esc(x.id)}">جزئیات فعلی</button></div></article>`).join(''):'<div class="alert-box">امروز شکار ویژه/هشدار فوری ثبت نشده است.</div>';
};

const updateSummaryBeforeEodV416=updateSummary;
updateSummary=function(){
  if(!isEndOfDayV416())return updateSummaryBeforeEodV416();
  const pool=persistentEndOfDayPoolV416(),special=pool.filter(x=>x.hunt==='شکار ویژه'),urgent=pool.filter(x=>x.hunt==='هشدار فوری'),strong=[...special,...urgent].sort((a,b)=>b.huntScoreV416-a.huntScoreV416),t=strong[0];
  $('specialCount').textContent=special.length.toLocaleString('fa-IR');
  $('urgentCount').textContent=urgent.length.toLocaleString('fa-IR');
  $('buyCount').textContent=strong.length.toLocaleString('fa-IR');
  $('topSymbol').textContent=t?.symbol||'—';
  const source=persistentEodArchiveReadyV416?'آرشیو پایدار ۹–۱۷':'بازسازی وضعیت نهایی';
  $('topMeta').textContent=t?`${source} — ${t.huntModeLabelV416} — اوج امتیاز ${fa(t.huntScoreV416,0)}`:`${source}: شکار ویژه/هشدار فوری ثبت نشده است`;
};

if(typeof window!=='undefined'){
  setTimeout(()=>{try{loadPersistentEodArchiveV416();}catch{}},0);
  setInterval(()=>{try{if(isEndOfDayV416())loadPersistentEodArchiveV416();}catch{}},60000);
}
