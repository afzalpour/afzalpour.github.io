'use strict';
const cellBeforeV410=cell;
cell=function(k,x){
  if(k==='details')return `<button class="detail-btn" data-id="${esc(x.id)}">نمایش</button>`;
  return cellBeforeV410(k,x);
};
function normalizeFaSearchV410(v){return String(v||'').toLowerCase().replace(/ي|ى/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200d\sـ]+/g,'').trim();}
function findUniverseSeedV409(id){
  const key=String(id||'');
  let u=typeof universeRows!=='undefined'?universeRows.find(r=>String(r.id)===key):null;
  if(u)return u;
  if(typeof catalogV416!=='undefined'&&Array.isArray(catalogV416)){
    const raw=catalogV416.find(r=>String(r.ins_code||r.id||'')===key);
    if(raw&&typeof normUniverse==='function')return normUniverse(raw,new Map());
  }
  return null;
}
async function resolveLiveDetailRow(id){
  const key=String(id||'');
  let x=rows.find(r=>String(r.id)===key);
  const seed=findUniverseSeedV409(key);
  if(!x&&seed?.symbol){
    const sk=typeof universeSymbolKeyV409==='function'?universeSymbolKeyV409(seed.symbol):normalizeFaSearchV410(seed.symbol);
    x=rows.find(r=>(typeof universeSymbolKeyV409==='function'?universeSymbolKeyV409(r.symbol):normalizeFaSearchV410(r.symbol))===sk);
  }
  if(!x&&typeof universeRows!=='undefined')x=universeRows.find(r=>String(r.id)===key&&r.analyzed!==false);
  if(x)return x;
  const preferred=typeof window!=='undefined'&&typeof window.stockHunterMarketBaseV416==='function'?window.stockHunterMarketBaseV416():'';
  const base=String(preferred||cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base||!key)return null;
  try{
    const table=cfg.TABLE||'stock_hunter_signals_v4';
    const p=new URLSearchParams({select:'*',id:`eq.${key}`,limit:'1'});
    const u=`${base}/rest/v1/${table}?${p.toString()}`;
    const r=typeof marketFetchV416==='function'?await marketFetchV416(u,base,9000):await fetch(u,{headers:headers(),cache:'no-store'});
    if(!r.ok)return null;
    const a=await r.json();
    if(!a.length)return null;
    x=norm(a[0]);
    x.analyzed=true;
    const i=rows.findIndex(z=>String(z.id)===key);
    if(i>=0)rows[i]=x;else rows.push(x);
    if(typeof universeRows!=='undefined'){
      const ui=universeRows.findIndex(z=>String(z.id)===key);
      if(ui>=0)universeRows[ui]={...universeRows[ui],...x,analyzed:true};
    }
    return x;
  }catch{return null;}
}
function historicalDetailHTMLV409(x){
  const c=dailyCandles(x),latest=c[c.length-1],prev=c[c.length-2],models=forecastModels(x);
  const pct=latest&&prev?.close?((latest.close-prev.close)/prev.close*100):null;
  const date=latest?.t?new Date(latest.t*1000).toLocaleDateString('fa-IR',{timeZone:'Asia/Tehran'}):'—';
  return `<div class="detail-grid">
    <div class="alert-box"><b>اطلاعات روزانه این نماد</b><br>داده لحظه‌ای تحلیلی این نماد فعلاً در دسترس نیست. اطلاعات روزانه واقعی و سناریوهای ۱۰روزه بر پایه همان داده‌ها نمایش داده می‌شوند.</div>
    <div class="section-title">آخرین داده روزانه معتبر</div>
    ${metricExplainV416('تاریخ آخرین داده',esc(date),'','این تاریخ مربوط به آخرین کندل روزانه دریافت‌شده است.')}
    ${metricExplainV416('قیمت پایانی',latest?fa(latest.close,0):'—','','آخرین قیمت پایانی موجود در سابقه روزانه.')}
    ${metricExplainV416('تغییر نسبت به روز قبل',pct==null?'—':fa(pct,2)+'٪',pct!=null&&pct<0?'risk-high':(pct!=null&&pct>0?'risk-low':''),'تغییر قیمت پایانی نسبت به روز معاملاتی قبل.')}
    ${metricExplainV416('بیشترین روز',latest?fa(latest.high,0):'—','','بیشترین قیمت ثبت‌شده در آخرین روز موجود.')}
    ${metricExplainV416('کمترین روز',latest?fa(latest.low,0):'—','','کمترین قیمت ثبت‌شده در آخرین روز موجود.')}
    ${metricExplainV416('حجم روز',latest?fa(latest.volume,0):'—','','حجم ثبت‌شده در آخرین روز موجود.')}
    <div class="section-title">مقایسه ۶ سناریوی عددی برای ۱۰ روز کاری آینده</div>
    ${models.map(modelBox).join('')}
    ${forecastTable(models)}
    <div class="forecast-note"><b>توجه:</b> در این حالت شاخص‌های لحظه‌ای دفتر سفارش، ورود و حد ضرر در دسترس نیستند. شش سناریوی ۱۰روزه فقط برای مشاهده و مقایسه نمایش داده می‌شوند.</div>
  </div>`;
}
async function openHistoricalUniverseDetailV409(seed){
  const x={...seed,analyzed:false,candles:Array.isArray(seed?.candles)?seed.candles:[],snapshots:[]};
  currentDetail=x;
  $('dSymbol').textContent=x.symbol||'نماد';
  $('dCompany').textContent=x.company||'';
  $('detailBody').innerHTML='<div class="history-loading">در حال دریافت فقط سابقه روزانه همین نماد…</div>';
  if($('printDetailBtn')){$('printDetailBtn').disabled=false;$('printDetailBtn').title='چاپ / ذخیره PDF گزارش روزانه';}
  if(!$('detailDialog').open)$('detailDialog').showModal();
  await fetchDailyHistory(x);
  if(currentDetail?.id!==x.id)return;
  const c=dailyCandles(x);
  if(!c.length){
    $('detailBody').innerHTML='<div class="alert-box">نماد در فهرست کامل بازار وجود دارد، اما در حال حاضر حتی سابقه روزانه آن از منبع بازار قابل دریافت نیست. هیچ داده مصنوعی ساخته نشد.</div>';
    return;
  }
  const latest=c[c.length-1],prev=c[c.length-2];
  x.last=latest.close||0;x.close=latest.close||0;x.yesterday=prev?.close||0;
  $('detailBody').innerHTML=historicalDetailHTMLV409(x);
}

searchUniverse=async function(q){
  const preferred=typeof window!=='undefined'&&typeof window.stockHunterMarketBaseV416==='function'?window.stockHunterMarketBaseV416():'';
  const base=String(preferred||cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');
  const raw=String(q||'').trim(),key=normalizeFaSearchV410(raw);
  if(!base||!raw){universeRows=[];universeLoading=false;render();return;}
  universeLoading=true;
  try{
    const term=raw.replace(/[(),]/g,' '),p=new URLSearchParams();
    p.set('select','ins_code,symbol,company_name,market,asset_type,is_active,updated_at');
    p.set('or',`(search_key.like.*${key}*,symbol.ilike.*${term}*,company_name.ilike.*${term}*)`);
    p.set('order','is_active.desc,symbol.asc');
    p.set('limit','200');
    const u=`${base}/rest/v1/stock_hunter_universe_v4?${p.toString()}`;
    const r=typeof marketFetchV416==='function'?await marketFetchV416(u,base,9000):await fetch(u,{headers:headers(),cache:'no-store'});
    if(!r.ok)throw new Error('جست‌وجوی جامع ناموفق بود');
    let items=await r.json();
    if(!items.length){
      const table=cfg.TABLE||'stock_hunter_signals_v4',sp=new URLSearchParams();
      sp.set('select','id,symbol,company_name,updated_at');
      sp.set('or',`(symbol.ilike.*${term}*,company_name.ilike.*${term}*)`);
      sp.set('limit','200');
      const su=`${base}/rest/v1/${table}?${sp.toString()}`;
      const sr=typeof marketFetchV416==='function'?await marketFetchV416(su,base,9000):await fetch(su,{headers:headers(),cache:'no-store'});
      if(sr.ok)items=(await sr.json()).map(s=>({ins_code:String(s.id),symbol:s.symbol,company_name:s.company_name,market:'',asset_type:'',is_active:true,updated_at:s.updated_at}));
    }
    const signalMap=await fetchSignalsForUniverse(base,items);
    universeRows=items.map(x=>normUniverse(x,signalMap));
  }catch{universeRows=[]}
  finally{universeLoading=false;render();}
};
openDetail=async function(id){
  const x=await resolveLiveDetailRow(id);
  if(!x){
    const seed=findUniverseSeedV409(id);
    if(seed)return openHistoricalUniverseDetailV409(seed);
    $('dSymbol').textContent='جزئیات در دسترس نیست';
    $('dCompany').textContent='اطلاعات این نماد در داده‌های فعلی پیدا نشد.';
    $('detailBody').innerHTML='<div class="alert-box">رکورد این نماد در حافظه محلی بازار پیدا نشد. هیچ داده مصنوعی نمایش داده نمی‌شود.</div>';
    if(!$('detailDialog').open)$('detailDialog').showModal();
    return;
  }
  currentDetail=x;
  if($('printDetailBtn')){$('printDetailBtn').disabled=false;$('printDetailBtn').title='';}
  $('dSymbol').textContent=x.symbol;
  $('dCompany').textContent=x.company;
  $('detailBody').innerHTML='<div class="history-loading">در حال دریافت سابقه روزانه نماد و محاسبه پیش‌بینی ۱۰ روزه…</div>';
  if(!$('detailDialog').open)$('detailDialog').showModal();
  await fetchDailyHistory(x);
  if(currentDetail?.id!==x.id)return;
  const models=forecastModels(x);
  $('detailBody').innerHTML=detailHTML(x,...models.map(m=>m.data));
};
