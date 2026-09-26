'use strict';

function headers(){
  const k=cfg.SUPABASE_PUBLISHABLE_KEY||cfg.publishableKey||'';
  return {apikey:k,Accept:'application/json'};
}
function marketFaDateTimeV416(value){
  const d=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(d.getTime()))return '—';
  const parts=new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn',{calendar:'persian',numberingSystem:'latn',timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d);
  const get=t=>parts.find(p=>p.type===t)?.value||'';
  return `${get('year')}/${get('month')}/${get('day')} ساعت ${get('hour')}:${get('minute')}:${get('second')}`;
}
function marketSessionTehran(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()),get=t=>parts.find(p=>p.type===t)?.value||'',wd=get('weekday'),hm=Number(get('hour'))*60+Number(get('minute'));
  if(!['Sat','Sun','Mon','Tue','Wed'].includes(wd)||hm<8*60+25||hm>17*60)return{open:false,label:'بازار بورس در این لحظه تعطیل است',detail:'ساعات فعالیت بازار سرمایه در روزهای معاملاتی از ۸:۲۵ تا ۱۷:۰۰ است.'};
  const active=[];
  if(hm>=8*60+25&&hm<=15*60)active.push('صندوق‌های درآمد ثابت');
  if(hm>=8*60+45&&hm<9*60)active.push('پیش‌گشایش سهام');
  if(hm>=9*60&&hm<=12*60+30)active.push('سهام، صندوق‌های سهامی و حق‌تقدم');
  if(hm>=9*60&&hm<=15*60)active.push('املاک، تسهیلات مسکن و بدهی');
  if(hm>=10*60+45&&hm<=15*60)active.push('سپرده کالایی انرژی');
  if(hm>=11*60+45&&hm<=17*60)active.push('طلا، نقره، زعفران و گواهی کالایی');
  return{open:true,label:'اطلاعات لحظه‌ای بازار دریافت شد',detail:active.length?`بازارهای فعال: ${active.join('، ')}`:'بخشی از بازار در مرحله پیش‌گشایش است'};
}
const MARKET_CACHE_V416='stock-hunter-market-v416-last-good';
const MARKET_CACHE_SIGNALS_V416='./__market-cache__/signals-v416.json';
const MARKET_CACHE_HEALTH_V416='./__market-cache__/health-v416.json';
let marketLoadInFlightV416=false,marketRetryNotBeforeV416=0,marketLastGoodAtV416=0;

function marketHttpErrorV416(response,label){
  const e=new Error(`${label} — HTTP ${response.status}`);
  e.status=response.status;
  const retry=Number(response.headers.get('retry-after')||0);
  e.retryAfterMs=Number.isFinite(retry)&&retry>0?retry*1000:0;
  return e;
}
const MARKET_LOCAL_BASE_V416=String(cfg.LOCAL_BRIDGE_URL||'').replace(/\/$/,'');
let marketActiveBaseV416='',marketActiveSourceV416='none';

function marketIsLocalBaseV416(base){return !!MARKET_LOCAL_BASE_V416&&String(base).replace(/\/$/,'')===MARKET_LOCAL_BASE_V416;}
function marketHeadersForBaseV416(base){return marketIsLocalBaseV416(base)?{Accept:'application/json'}:headers();}
async function marketFetchV416(url,base,timeoutMs=30000){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  const opts={headers:marketHeadersForBaseV416(base),cache:'no-store',signal:ctrl.signal};
  if(marketIsLocalBaseV416(base))opts.targetAddressSpace='loopback';
  try{return await fetch(url,opts);}
  finally{clearTimeout(timer);}
}
const MARKET_SIGNAL_SELECT_V416=[
  'id','symbol','company_name','state','last_price','closing_price','yesterday_price','low_price','high_price','min_allowed','max_allowed','volume','value',
  'buy_depth','sell_depth','best_bid','best_ask','sell_queue','buy_queue','fast_score','fast_probability','signal_accel','continuation_score','prob_2d','prob_3d','risk_score',
  'qi','ofi','bid_stack_15s','ask_pull_15s','daily_rvol','rsi_5m','ema9_5m','ema21_5m','vwap','atr_5m','technical_score','microprice','absorption',
  'cancellation_ratio','price_velocity','trade_accel','recovery','depth_ratio','queue_decay','momentum','real_flow_ratio','hunt_state','decision','entry_price','entry_low',
  'entry_high','stop_loss','target_1','target_2','target_3','risk_reward','reason','snapshots','candles','updated_at'
].join(',');
const MARKET_INTEGRATED_SELECT_V416=[
  'id','updated_at','asset_type','market','integrated_eligible','flow_score_v1','trend_score_v1','momentum_score_v1','data_quality_score_v1',
  'market_regime_v1','market_breadth_pct_v1','integrated_score_v1','positive_experts_v1','negative_experts_v1','direction_agreement_v1',
  'confidence_score_v1','risk_gate_v1','gate_reason_v1','final_decision_v1','confidence_label_v1','engine_scope_v1','engine_version_v1'
].join(',');
function marketFreshFilterV416(health){
  const last=Date.parse(health?.[0]?.last_feed_at||'');
  return Number.isFinite(last)?`&updated_at=gte.${encodeURIComponent(new Date(last-180000).toISOString())}`:'';
}
async function marketReadPagedV416(base,table,select,freshFilter,timeout,label){
  const rows=[];let response=null;
  for(let offset=0;offset<5000;offset+=1000){
    const url=`${base}/rest/v1/${table}?select=${encodeURIComponent(select)}${freshFilter}&offset=${offset}&limit=1000`;
    response=await marketFetchV416(url,base,timeout);
    if(!response.ok)throw marketHttpErrorV416(response,label);
    const batch=await response.json();
    if(!Array.isArray(batch))throw new Error('پاسخ داده بازار نامعتبر است');
    rows.push(...batch);
    if(batch.length<1000)break;
  }
  return{response,rows};
}
async function marketReadCloudSignalsV416(base,table,health,timeout){
  const freshFilter=marketFreshFilterV416(health);
  const primary=await marketReadPagedV416(base,'stock_hunter_signals_v4',MARKET_SIGNAL_SELECT_V416,freshFilter,timeout,'دریافت داده بازار ناموفق بود');
  let signalRows=primary.rows;
  if(table&&table!=='stock_hunter_signals_v4'&&signalRows.length){
    try{
      const extra=await marketReadPagedV416(base,table,MARKET_INTEGRATED_SELECT_V416,freshFilter,timeout,'دریافت داده تکمیلی بازار ناموفق بود');
      const byId=new Map(extra.rows.map(r=>[String(r.id),r]));
      signalRows=signalRows.map(r=>({...r,...(byId.get(String(r.id))||{})}));
    }catch(e){
      console.warn('Stock Hunter integrated enrichment unavailable; live signal rows remain active.',e);
    }
  }
  return{sr:primary.response,signalRows};
}
async function marketReadBaseV416(base,source){
  const timeout=source==='local'?3000:30000,table=cfg.TABLE||'stock_hunter_signals_v4';
  const hr=await marketFetchV416(`${base}/rest/v1/stock_hunter_feed_health_v4?select=*&id=eq.local-agent&limit=1`,base,timeout);
  let health=[];if(hr.ok)health=await hr.json();
  if(source==='supabase'){
    const {sr,signalRows}=await marketReadCloudSignalsV416(base,table,health,timeout);
    return{base,source,sr,hr,signalRows,health};
  }
  const sr=await marketFetchV416(`${base}/rest/v1/${table}?select=*&order=fast_score.desc&limit=2000`,base,timeout);
  if(!sr.ok)throw marketHttpErrorV416(sr,'پل محلی بازار پاسخ معتبر نداد');
  const signalRows=await sr.json();
  if(!signalRows.length&&!health.length){const e=new Error('پل محلی هنوز snapshot بازار ندارد');e.status=204;throw e;}
  return{base,source,sr,hr,signalRows,health};
}
function marketBaseCandidatesV416(){
  const out=[];
  const cloud=String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');
  const key=cfg.SUPABASE_PUBLISHABLE_KEY||cfg.publishableKey||'';
  if(cloud&&key)out.push({base:cloud,source:'supabase'});
  if(MARKET_LOCAL_BASE_V416)out.push({base:MARKET_LOCAL_BASE_V416,source:'local'});
  return out;
}
if(typeof window!=='undefined'){
  window.stockHunterMarketBaseV416=()=>marketActiveBaseV416||String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');
  window.stockHunterMarketSourceV416=()=>marketActiveSourceV416;
}

async function marketCacheWriteV416(signalRows,healthRows){
  if(typeof caches==='undefined')return;
  try{
    const cache=await caches.open(MARKET_CACHE_V416),stamp=new Date().toISOString();
    await Promise.all([
      cache.put(MARKET_CACHE_SIGNALS_V416,new Response(JSON.stringify({saved_at:stamp,rows:signalRows}),{headers:{'Content-Type':'application/json'}})),
      cache.put(MARKET_CACHE_HEALTH_V416,new Response(JSON.stringify({saved_at:stamp,rows:healthRows||[]}),{headers:{'Content-Type':'application/json'}}))
    ]);
  }catch{}
}
async function marketCacheReadV416(){
  if(typeof caches==='undefined')return null;
  try{
    const cache=await caches.open(MARKET_CACHE_V416),[sr,hr]=await Promise.all([
      cache.match(MARKET_CACHE_SIGNALS_V416),cache.match(MARKET_CACHE_HEALTH_V416)
    ]);
    if(!sr)return null;
    const s=await sr.json(),h=hr?await hr.json():{rows:[]};
    return {savedAt:s.saved_at||null,signals:Array.isArray(s.rows)?s.rows:[],health:Array.isArray(h.rows)?h.rows:[]};
  }catch{return null;}
}
function marketApplyRowsV416(sourceRows){
  rows=(Array.isArray(sourceRows)?sourceRows:[]).map(norm).sort((a,b)=>b.fast-a.fast);
  rows.forEach(x=>x.analyzed=true);
}
function marketRenderAfterDataV416(){
  if(typeof window!=='undefined'&&typeof window.stockHunterSearchRenderAfterDataV416==='function')window.stockHunterSearchRenderAfterDataV416();
  else render();
}
function marketOutageDetailV416(e,cache){
  const status=Number(e?.status||0);
  const infra=status===522||status===503||status===504;
  const code=status?`HTTP ${status}`:(e?.name==='AbortError'?'timeout':'network');
  const source=cache?.savedAt?marketFaDateTimeV416(cache.savedAt):'ناموجود';
  return infra
    ? `اختلال موقت زیرساخت داده (${code}). آخرین داده معتبر: ${source}. داده قدیمی به‌عنوان شکار فعال استفاده نمی‌شود.`
    : `ارتباط زنده بازار برقرار نشد (${code}). آخرین snapshot معتبر: ${source}. داده قدیمی به‌عنوان شکار فعال استفاده نمی‌شود.`;
}
async function load(force=false){
  const session=marketSessionTehran(),candidates=marketBaseCandidatesV416();
  if(!candidates.length){showFeed('bad','اتصال اطلاعات بازار تنظیم نشده','نه پل محلی و نه مسیر ابری داده تنظیم نشده است');return;}
  if(marketLoadInFlightV416)return;
  if(!force&&Date.now()<marketRetryNotBeforeV416)return;
  marketLoadInFlightV416=true;
  try{
    let chosen=null,lastErr=null;
    for(const c of candidates){
      try{chosen=await marketReadBaseV416(c.base,c.source);break;}
      catch(e){lastErr=e;}
    }
    if(!chosen)throw lastErr||new Error('هیچ مسیر داده‌ای پاسخ نداد');
    const {base,source,sr,hr,signalRows,health}=chosen;
    marketActiveBaseV416=base;marketActiveSourceV416=source;
    marketApplyRowsV416(signalRows);
    marketLastGoodAtV416=Date.now();
    marketRetryNotBeforeV416=0;
    marketCacheWriteV416(signalRows,health);
    const h=health[0],age=h?.last_feed_at?Date.now()-Date.parse(h.last_feed_at):Infinity;
    const route=source==='local'?'مسیر محلی پشتیبان':'مسیر اصلی';
    if(!session.open){
      showFeed('closed',session.label,h?.last_feed_at?`آخرین اطلاعات ثبت‌شده: ${marketFaDateTimeV416(h.last_feed_at)} — ${route}`:session.detail);
    }else if(h&&h.status==='ok'&&age<60000){
      const when=marketFaDateTimeV416(h.last_feed_at),count=Number(h.symbols||0).toLocaleString('fa-IR');
      showFeed('ok',session.label,`${session.detail} — آخرین دریافت: ${when} — ${count} نماد — ${route}`);
    }else if(h&&age<180000){
      showFeed('warn','اطلاعات بازار با تأخیر دریافت می‌شود',`آخرین ارتباط ${marketFaDateTimeV416(h.last_feed_at)} — ${route}`);
    }else if(!hr.ok){
      const last=h?.last_feed_at?marketFaDateTimeV416(h.last_feed_at):'ناموجود';
      showFeed('warn','داده بازار دریافت شد؛ وضعیت Feed در دسترس نیست',`آخرین اطلاعات ثبت‌شده: ${last} — اطلاعات نمادها بارگذاری شد اما وضعیت سلامت Feed پاسخ HTTP ${hr.status} داد — ${route}.`);
    }else{
      const last=h?.last_feed_at?marketFaDateTimeV416(h.last_feed_at):'ناموجود';
      showFeed('bad','اطلاعات لحظه‌ای معاملات در دسترس نیست',`آخرین اطلاعات ثبت‌شده: ${last} — در ساعات رسمی بازار داده تازه دریافت نشده است؛ احتمال وقفه در مسیر دریافت داده وجود دارد — ${route}.`);
    }
    marketRenderAfterDataV416();
    const urgent=rows.filter(x=>x.hunt==='شکار ویژه'||x.hunt==='هشدار فوری');
    if(sound&&session.open&&urgent.some(x=>!seen.has(x.id))){
      try{const c=new AudioContext(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);g.gain.value=.035;o.frequency.value=900;o.start();o.stop(c.currentTime+.12);}catch{}
    }
    urgent.forEach(x=>seen.add(x.id));
  }catch(e){
    const retry=Math.max(Number(e?.retryAfterMs||0),Number(cfg.REFRESH_MS||15000));
    const maxRetry=MARKET_LOCAL_BASE_V416?15000:120000;
    marketRetryNotBeforeV416=Date.now()+Math.min(Math.max(retry,15000),maxRetry);
    const cached=await marketCacheReadV416();
    if(!rows.length&&cached?.signals?.length){
      marketApplyRowsV416(cached.signals);
      marketRenderAfterDataV416();
    }else if(rows.length){
      try{marketRenderAfterDataV416();}catch{}
    }
    if(!session.open){
      const extra=cached?.savedAt?`آخرین اطلاعات ذخیره‌شده: ${marketFaDateTimeV416(cached.savedAt)}`:session.detail;
      showFeed('closed',session.label,extra);
    }else if(rows.length||cached?.signals?.length){
      showFeed('warn','ارتباط زنده بازار موقتاً قطع است',marketOutageDetailV416(e,cached));
    }else{
      showFeed('warn','مسیر زنده اطلاعات بازار موقتاً در دسترس نیست',marketOutageDetailV416(e,cached));
    }
  }finally{
    marketLoadInFlightV416=false;
  }
}
function showFeed(type,title,sub){
  $('feedBadge').className=`feed-badge ${type}`;$('feedBadge').textContent=title;$('feedState').textContent=title;$('scanTimes').textContent=sub;
  const quiet=type==='ok'||type==='closed';$('alertBox').hidden=quiet;if(!quiet)$('alertBox').textContent=sub;
}
function openColumns(){$('columnPanel').classList.add('open');$('columnPanel').setAttribute('aria-hidden','false');$('panelBackdrop').hidden=false;}
function closeColumns(){$('columnPanel').classList.remove('open');$('columnPanel').setAttribute('aria-hidden','true');$('panelBackdrop').hidden=true;}
function renderColumnOptions(){
  $('columnOptions').innerHTML=columns.map(c=>`<label><input type="checkbox" data-col="${c[0]}" ${visible.has(c[0])?'checked':''}>${c[1]}</label>`).join('');
  $('columnOptions').querySelectorAll('input').forEach(i=>i.onchange=()=>{
    i.checked?visible.add(i.dataset.col):visible.delete(i.dataset.col);
    if(visible.size<4){visible.add(i.dataset.col);i.checked=true;}
    localStorage.setItem('sh_columns_v407',JSON.stringify([...visible]));render();
  });
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)openDetail(b.dataset.id);});
$('closeDetail').onclick=()=>$('detailDialog').close();
$('printDetailBtn').onclick=printDetail;
$('columnsBtn').onclick=openColumns;$('closeColumns').onclick=closeColumns;$('panelBackdrop').onclick=closeColumns;
$('defaultColumns').onclick=()=>{visible=new Set(defaultKeys);localStorage.setItem('sh_columns_v407',JSON.stringify([...visible]));renderColumnOptions();render();};
$('allColumns').onclick=()=>{visible=new Set(columns.map(c=>c[0]));localStorage.setItem('sh_columns_v407',JSON.stringify([...visible]));renderColumnOptions();render();};
$('prevPage').onclick=()=>{if(page>1){page--;render();}};
$('nextPage').onclick=()=>{page++;render();};
for(const id of ['hunt','decision','pageSize'])$(id).addEventListener('change',()=>{page=1;render();});
$('refreshBtn').onclick=()=>{marketRetryNotBeforeV416=0;load(true);};
$('soundBtn').onclick=()=>{sound=!sound;$('soundBtn').textContent=sound?'🔔 هشدار روشن':'🔕 هشدار خاموش';};

async function registerServiceWorkerV416(){
  if(!('serviceWorker' in navigator))return;
  try{
    await navigator.serviceWorker.register('./sw.js?v=4.1.6');
  }catch{}
}
renderColumnOptions();
load();
setInterval(load,Number(cfg.REFRESH_MS||15000));
registerServiceWorkerV416();
