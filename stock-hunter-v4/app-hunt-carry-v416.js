'use strict';

// Sticky/Carry-forward layer for Frozen Hunt 4.1.6.
// This layer never changes Hunt Score or thresholds. It only preserves a previously
// detected early hunt for 15 minutes after the first verified +1% crossing.
const HUNT_CARRY_V416_VERSION='4.1.6-carry-v1';
let huntCarryRowsV416=[],huntCarryBySymbolV416=new Map(),huntCarryLoadingV416=false,huntCarryDateV416='';

function huntCarryTodayV416(){
  try{return tehranClockV413().ymd}catch{
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }
}
function huntCarryTsV416(v){const t=Date.parse(v||'');return Number.isFinite(t)?t:0}
function huntCarryFmtTimeV416(v){
  const t=huntCarryTsV416(v);if(!t)return '—';
  return new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(t));
}
function huntCarryActiveRowV416(x){
  const c=huntCarryBySymbolV416.get(String(x?.id||''));if(!c||!c.crossed_plus1_at||!c.carry_until)return null;
  const until=huntCarryTsV416(c.carry_until);
  return until>Date.now()?c:null;
}
function huntCarryAnyRowV416(x){return huntCarryBySymbolV416.get(String(x?.id||''))||null}
function huntCarryMinutesLeftV416(c){return Math.max(0,Math.ceil((huntCarryTsV416(c?.carry_until)-Date.now())/60000))}
function huntCarryCurrentChangeV416(x){return x?.yesterday>0&&x?.last>0?(x.last/x.yesterday-1)*100:Number(x?.dayChangeV416||0)}
function huntCarryCurrentReturnV416(x,c){return Number(c?.detected_price)>0&&Number(x?.last)>0?(Number(x.last)/Number(c.detected_price)-1)*100:null}

async function loadHuntCarryV416(force=false){
  const today=huntCarryTodayV416();
  if(huntCarryLoadingV416||(!force&&huntCarryDateV416===today))return;
  const base=typeof stockHunterMarketBaseV416==='function'?String(stockHunterMarketBaseV416()||'').replace(/\/$/,''):String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base)return;
  huntCarryLoadingV416=true;
  try{
    const p=new URLSearchParams();
    p.set('select','source_event_id,trade_date,symbol_id,symbol,company_name,hunt_mode,detected_at,detected_price,detected_day_change,detected_hunt_score,detected_today_opportunity,evidence_count,dynamic_evidence_count,reference_yesterday_price,crossed_plus1_at,crossed_plus1_price,carry_until,status,last_observed_at,last_price_15m,peak_price_15m,trough_price_15m,peak_day_change_15m,end_day_change_15m,mfe_from_detect_15m,mae_from_detect_15m,mfe_from_cross_15m,mae_from_cross_15m,hit_plus2_15m,hit_plus3_15m,completed_at');
    p.set('trade_date',`eq.${today}`);p.set('order','detected_at.desc');p.set('limit','2000');
    const r=await fetch(`${base}/rest/v1/stock_hunter_hunt_carry_v416?${p.toString()}`,{headers:headers(),cache:'no-store'});
    if(!r.ok)throw new Error(`carry ${r.status}`);
    huntCarryRowsV416=await r.json();
    huntCarryBySymbolV416=new Map(huntCarryRowsV416.map(c=>[String(c.symbol_id),c]));
    huntCarryDateV416=today;
    window.STOCK_HUNTER_HUNT_CARRY_V416={version:HUNT_CARRY_V416_VERSION,rows:huntCarryRowsV416};
  }catch(e){
    console.warn('Stock Hunter carry-forward ledger unavailable.',e);
  }finally{
    huntCarryLoadingV416=false;
    try{render()}catch{}
  }
}

function ensureCarryFilterV416(){
  const s=$('hunt');if(!s)return;
  if(![...s.options].some(o=>o.value==='__carry__')){
    const o=document.createElement('option');o.value='__carry__';o.textContent='عبور موفق';s.appendChild(o);
  }
}

const filteredBeforeCarryV416=filtered;
filtered=function(){
  const q=$('search').value.trim();if(q)return filteredBeforeCarryV416();
  const h=$('hunt').value,d=$('decision').value;
  if(h==='__carry__'){
    return rows.filter(x=>huntCarryActiveRowV416(x)).filter(x=>!d||x.decision===d)
      .sort((a,b)=>huntCarryTsV416(huntCarryAnyRowV416(b)?.crossed_plus1_at)-huntCarryTsV416(huntCarryAnyRowV416(a)?.crossed_plus1_at));
  }
  const base=filteredBeforeCarryV416();
  if(h)return base;
  const ids=new Set(base.map(x=>String(x.id)));
  const carry=rows.filter(x=>huntCarryActiveRowV416(x)&&!ids.has(String(x.id)))
    .sort((a,b)=>huntCarryTsV416(huntCarryAnyRowV416(b)?.crossed_plus1_at)-huntCarryTsV416(huntCarryAnyRowV416(a)?.crossed_plus1_at));
  return base.concat(carry);
};

const cellBeforeCarryV416=cell;
cell=function(k,x){
  const c=huntCarryActiveRowV416(x);
  if(c){
    if(k==='hunt')return '<span class="badge continue">✓ عبور موفق</span><div class="company">از شکار زودهنگام</div>';
    if(k==='huntSetupV416')return `<span class="badge continue">↗ ادامه حرکت</span><div class="company">عبور از +۱٪ در ${huntCarryFmtTimeV416(c.crossed_plus1_at)}</div>`;
    if(k==='huntScoreV416')return `<b>${fa(c.detected_hunt_score,1)}</b><div class="company">امتیاز هنگام کشف</div>`;
    if(k==='dayMoveV416'){const ch=huntCarryCurrentChangeV416(x);return `<b class="risk-low">${ch>0?'+':''}${fa(ch,2)}٪</b><div class="company">${huntCarryMinutesLeftV416(c).toLocaleString('fa-IR')} دقیقه باقی‌مانده</div>`;}
  }
  return cellBeforeCarryV416(k,x);
};

const renderMobileBeforeCarryV416=renderMobile;
renderMobile=function(a){
  if(!a.some(x=>huntCarryActiveRowV416(x)))return renderMobileBeforeCarryV416(a);
  $('mobileList').innerHTML=a.length?a.map(x=>{
    const c=huntCarryActiveRowV416(x);
    if(!c){
      if(x?.analyzed!==false)applyHuntV416(x);
      const setup=x.huntModeV416==='reversal'?'↗ برگشت منفی':x.huntModeV416==='acceleration'?'⚡ شتاب مثبت':'—',ch=Number(x.dayChangeV416||0);
      return `<article class="mobile-card"><div class="mobile-head"><div><div class="mobile-symbol">${esc(x.symbol)}</div><div class="company">${esc(x.company)}</div></div><div><span class="badge ${hc(x.hunt)}">${esc(x.hunt)}</span></div></div><div class="mobile-metrics"><div><span>نوع فرصت</span><b>${setup}</b></div><div><span>تغییر</span><b>${ch>0?'+':''}${fa(ch,2)}٪</b></div><div><span>امتیاز شکار</span><b>${fa(x.huntScoreV416,1)}</b></div><div><span>قدرت امروز</span><b>${fa(x.todayOpportunityV416,1)}</b></div><div><span>تداوم ۱–۲ روزه</span><b>${fa(x.continuation12V416,1)}</b></div></div><div class="mobile-foot"><span>${esc(x.huntDecisionV416||'')}</span><button class="detail-btn" data-id="${esc(x.id)}">جزئیات</button></div></article>`;
    }
    const ch=huntCarryCurrentChangeV416(x),ret=huntCarryCurrentReturnV416(x,c);
    return `<article class="mobile-card carry-card-v416"><div class="mobile-head"><div><div class="mobile-symbol">${esc(x.symbol)}</div><div class="company">${esc(x.company)}</div></div><div><span class="badge continue">✓ عبور موفق</span></div></div><div class="mobile-metrics"><div><span>کشف</span><b>${fa(c.detected_price,0)}</b></div><div><span>تغییر فعلی</span><b class="risk-low">${ch>0?'+':''}${fa(ch,2)}٪</b></div><div><span>بازده از کشف</span><b class="risk-low">${ret==null?'—':(ret>0?'+':'')+fa(ret,2)+'٪'}</b></div><div><span>امتیاز کشف</span><b>${fa(c.detected_hunt_score,1)}</b></div><div><span>باقی‌مانده</span><b>${huntCarryMinutesLeftV416(c).toLocaleString('fa-IR')} دقیقه</b></div></div><div class="mobile-foot"><span>عبور از +۱٪: ${huntCarryFmtTimeV416(c.crossed_plus1_at)}</span><button class="detail-btn" data-id="${esc(x.id)}">جزئیات</button></div></article>`;
  }).join(''):'<div class="alert-box">داده‌ای مطابق فیلتر فعلی وجود ندارد.</div>';
};

function huntCarryPanelV416(x,c){
  const active=huntCarryActiveRowV416(x),ret=huntCarryCurrentReturnV416(x,c),current=huntCarryCurrentChangeV416(x);
  const status=active?`عبور موفق — ${huntCarryMinutesLeftV416(c).toLocaleString('fa-IR')} دقیقه از پنجره ۱۵ دقیقه‌ای باقی مانده`:
    c.status==='COMPLETED'?'پنجره ۱۵ دقیقه‌ای تکمیل شده':c.status==='WAITING_CROSS'?'شکار زودهنگام ثبت شده؛ هنوز عبور +۱٪ ثبت نشده است':'پنجره عبور بدون تأیید +۱٪ پایان یافته است';
  return `<div class="section-title">پیگیری شکار زودهنگام / Carry-forward</div>
    <div class="carry-panel-v416">
      <div class="carry-head-v416"><b>${esc(status)}</b><span>بدون تغییر امتیاز یا آستانه شکار</span></div>
      <div class="carry-grid-v416">
        <div><span>زمان کشف</span><b>${huntCarryFmtTimeV416(c.detected_at)}</b><small>قیمت ${fa(c.detected_price,0)}</small></div>
        <div><span>امتیاز هنگام کشف</span><b>${fa(c.detected_hunt_score,1)}</b><small>${fa(c.evidence_count,0)} شاهد / ${fa(c.dynamic_evidence_count,0)} پویا</small></div>
        <div><span>عبور از +۱٪</span><b>${huntCarryFmtTimeV416(c.crossed_plus1_at)}</b><small>${c.crossed_plus1_price?fa(c.crossed_plus1_price,0):'—'}</small></div>
        <div><span>تغییر فعلی</span><b class="risk-low">${current>0?'+':''}${fa(current,2)}٪</b><small>از کشف: ${ret==null?'—':(ret>0?'+':'')+fa(ret,2)+'٪'}</small></div>
        <div><span>اوج ۱۵ دقیقه Carry</span><b>${fa(c.peak_price_15m,0)}</b><small>تغییر روز: ${fa(c.peak_day_change_15m,2)}٪</small></div>
        <div><span>MFE از کشف</span><b>${fa(c.mfe_from_detect_15m,2)}٪</b><small>MAE: ${fa(c.mae_from_detect_15m,2)}٪</small></div>
        <div><span>MFE از عبور +۱٪</span><b>${fa(c.mfe_from_cross_15m,2)}٪</b><small>MAE: ${fa(c.mae_from_cross_15m,2)}٪</small></div>
        <div><span>اهداف ثبت‌شده</span><b>${c.hit_plus2_15m?'✓ +۲٪':'— +۲٪'} / ${c.hit_plus3_15m?'✓ +۳٪':'— +۳٪'}</b><small>برای بک‌تست ذخیره می‌شود</small></div>
      </div>
    </div>`;
}

const detailHTMLBeforeCarryV416=detailHTML;
detailHTML=function(x,...args){
  const html=detailHTMLBeforeCarryV416(x,...args),c=huntCarryAnyRowV416(x);if(!c)return html;
  return html.replace('<div class="detail-grid">',`<div class="detail-grid">${huntCarryPanelV416(x,c)}`);
};

const carryStyleV416=document.createElement('style');
carryStyleV416.textContent=`
  .carry-panel-v416{grid-column:1/-1;border:1px solid #49515a;border-radius:12px;padding:10px;background:#1b1e22}
  .carry-head-v416{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}.carry-head-v416 span{font-size:9px;color:var(--muted)}
  .carry-grid-v416{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.carry-grid-v416>div{background:#202328;border:1px solid #373c42;border-radius:9px;padding:7px}
  .carry-grid-v416 span,.carry-grid-v416 small{display:block;color:var(--muted);font-size:9px}.carry-grid-v416 b{display:block;margin:3px 0;font-size:12px}
  @media(max-width:760px){.carry-grid-v416{grid-template-columns:repeat(2,1fr)}.carry-head-v416{align-items:flex-start;flex-direction:column}}
`;
document.head.appendChild(carryStyleV416);

ensureCarryFilterV416();
setTimeout(()=>{try{loadHuntCarryV416(true)}catch{}},0);
setInterval(()=>{try{loadHuntCarryV416(true)}catch{}},30000);
