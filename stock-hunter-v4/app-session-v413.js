'use strict';

// Stock Hunter 4.1.3 — only currently tradable instruments may appear in Hunt tables.
// Search remains universal and is intentionally NOT filtered by the session gate.

const normBeforeSessionV413 = norm;
norm = function(r){
  const x = normBeforeSessionV413(r);
  x.snapshots = parseArr(r.snapshots);
  x.stateRaw = r.state || '';
  return x;
};

function faTextV413(v){
  return String(v||'').toLowerCase().replace(/ي|ى/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200dـ]+/g,' ').replace(/\s+/g,' ').trim();
}
function sessionTsSecV413(v){
  let t=Number(v||0);
  if(t>1e12)t/=1000;
  return Number.isFinite(t)?t:0;
}

function tehranClockV413(){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
  const g=t=>p.find(z=>z.type===t)?.value||'';
  return {wd:g('weekday'),hm:Number(g('hour'))*60+Number(g('minute')),ymd:`${g('year')}-${g('month')}-${g('day')}`};
}

function tehranYmdFromTsV413(ts){
  const d=new Date(sessionTsSecV413(ts)*1000);
  if(!Number.isFinite(d.getTime()))return'';
  const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),g=t=>p.find(z=>z.type===t)?.value||'';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

function assetSessionV413(x){
  const s=faTextV413(`${x.symbol} ${x.company} ${x.assetType||''} ${x.market||''}`);
  const c=faTextV413(x.company);
  // Energy commodity-deposit funds: pre-open 10:45-11:00, trading 11:00-15:00.
  if((s.includes('سپرده')&&s.includes('انرژی')) || (s.includes('کالایی')&&s.includes('انرژی')&&s.includes('صندوق')))
    return {key:'energy',label:'صندوق سپرده کالایی انرژی',preStart:645,tradeStart:660,end:900};
  // Gold, silver, saffron and commodity certificates: pre-open 11:45-12:00, trading 12:00-17:00.
  if(String(x.assetType||'').includes('کالایی') || String(x.assetType||'').includes('گواهی') || /طلا|نقره|زعفران|سکه|شمش|گواهی/.test(s))
    return {key:'commodity',label:'طلا، نقره، زعفران و گواهی کالایی',preStart:705,tradeStart:720,end:1020};
  // Fixed-income funds: pre-open 08:25-08:30, trading 08:30-15:00.
  if((/صندوق|ص\.س|سرمایه گذاری/.test(c) && /درآمد ?ثابت|درآمدثابت|[-– ]ثابت(?:$|[-– ])|ثابت-/.test(c)) || /صندوق.*ثابت/.test(c))
    return {key:'fixed',label:'صندوق درآمد ثابت',preStart:505,tradeStart:510,end:900};
  // REIT, housing facilities and debt: pre-open 08:45-09:00, trading 09:00-15:00.
  if(String(x.assetType||'').includes('اوراق بدهی') || /املاک|مستغلات|تسهیلات|اوراق مسکن/.test(s) || /^(اخزا|اراد|گام|افاد|تسه|مرابح)/.test(faTextV413(x.symbol)))
    return {key:'debt',label:'املاک، تسهیلات مسکن و بدهی',preStart:525,tradeStart:540,end:900};
  // Shares, equity funds, rights and stock options: pre-open 08:45-09:00, trading 09:00-12:30.
  return {key:'equity',label:'سهام، صندوق سهامی، حق‌تقدم و اختیار سهام',preStart:525,tradeStart:540,end:750};
}

function sessionPhaseV413(x){
  const now=tehranClockV413(),s=assetSessionV413(x);
  if(!['Sat','Sun','Mon','Tue','Wed'].includes(now.wd))return {...s,phase:'closed',reason:'روز غیرمعاملاتی'};
  if(now.hm>=s.preStart && now.hm<s.tradeStart)return {...s,phase:'preopen',reason:'پیش‌گشایش'};
  if(now.hm>=s.tradeStart && now.hm<=s.end)return {...s,phase:'trading',reason:'در حال معامله'};
  return {...s,phase:'closed',reason:'خارج از ساعت معاملات'};
}

function todayTradeEvidenceV413(x){
  const today=tehranClockV413().ymd,c=Array.isArray(x.candles)?x.candles:[],sn=Array.isArray(x.snapshots)?x.snapshots:[];
  let lastTradeTs=0;
  for(const z of c){const t=sessionTsSecV413(z.t??z.time??0),v=Number(z.volume??0);if(t&&v>0&&tehranYmdFromTsV413(t)===today)lastTradeTs=Math.max(lastTradeTs,t);}
  for(let i=1;i<sn.length;i++){
    const a=sn[i-1]||{},b=sn[i]||{},t=sessionTsSecV413(b.T??b.t??0),va=Number(a.Volume??a.volume??0),vb=Number(b.Volume??b.volume??0);
    if(t&&vb>va&&tehranYmdFromTsV413(t)===today)lastTradeTs=Math.max(lastTradeTs,t);
  }
  return lastTradeTs;
}

function recentBookActivityV413(x,minutes=30){
  const sn=(Array.isArray(x.snapshots)?x.snapshots:[]).filter(Boolean),cut=Date.now()/1000-minutes*60;
  const a=sn.filter(z=>sessionTsSecV413(z.T??z.t??0)>=cut);
  if(a.length<2)return false;
  const keys=['Volume','Last','BuyDepth','SellDepth','BQ','SQ','Bid','Ask','BuyQueue','SellQueue'];
  for(let i=1;i<a.length;i++)for(const k of keys)if(Number(a[i]?.[k]??0)!==Number(a[i-1]?.[k]??0))return true;
  return false;
}

function isHuntableNowV413(x){
  if(!x || x.analyzed===false)return false;
  const session=sessionPhaseV413(x);
  if(session.phase!=='trading')return false;
  const lastTrade=todayTradeEvidenceV413(x);
  if(!lastTrade)return false; // no valid trade evidence today => keep only in Search.
  const mins=(Date.now()/1000-lastTrade)/60;
  // A long frozen tape plus no order-book movement is treated as halted/non-huntable.
  if(mins>30 && !recentBookActivityV413(x,30))return false;
  return true;
}

const filteredBeforeSessionV413=filtered;
filtered=function(){
  const q=$('search').value.trim();
  const a=filteredBeforeSessionV413();
  return q?a:a.filter(isHuntableNowV413);
};

const cellBeforeSessionV413=cell;
cell=function(k,x){
  if(k==='symbol' && $('search').value.trim()){
    const base=cellBeforeSessionV413(k,x),s=sessionPhaseV413(x),huntable=isHuntableNowV413(x);
    if(!huntable){
      const why=s.phase==='preopen'?'پیش‌گشایش؛ هنوز قابل شکار نیست':s.phase==='closed'?`خارج از بازه شکار (${s.label})`:'فاقد فعالیت معاملاتی معتبر/توقف احتمالی';
      return `${base}<div class="company">${esc(why)}</div>`;
    }
    return `${base}<div class="company risk-low">اکنون قابل شکار</div>`;
  }
  return cellBeforeSessionV413(k,x);
};

updateSummary=function(){
  const active=rows.filter(isHuntableNowV413);
  $('specialCount').textContent=active.filter(x=>x.hunt==='شکار ویژه').length.toLocaleString('fa-IR');
  $('urgentCount').textContent=active.filter(x=>x.hunt==='هشدار فوری').length.toLocaleString('fa-IR');
  $('buyCount').textContent=active.filter(x=>x.decision==='ورود قوی'||x.decision==='ورود اولیه').length.toLocaleString('fa-IR');
  const t=[...active].filter(x=>x.hunt==='شکار ویژه'||x.hunt==='هشدار فوری').sort((a,b)=>b.fast-a.fast)[0];
  $('topSymbol').textContent=t?.symbol||'—';
  $('topMeta').textContent=t?`${t.company} — ${t.decision}${t.integratedEligible?` — امتیاز تصمیم ${fa(t.integratedScore,0)}`:''}`:'در این لحظه شکار فعال وجود ندارد';
};

// Refresh the visible Hunt table as a session boundary passes even if market data itself is unchanged.
setInterval(()=>{try{render();}catch{}},30000);