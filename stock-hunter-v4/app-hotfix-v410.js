'use strict';
const cellBeforeV410=cell;
cell=function(k,x){
  if(k==='details')return `<button class="detail-btn" data-id="${esc(x.id)}">نمایش</button>`;
  return cellBeforeV410(k,x);
};
function normalizeFaSearchV410(v){return String(v||'').toLowerCase().replace(/ي|ى/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200d\sـ]+/g,'').trim();}
async function resolveLiveDetailRow(id){
  const key=String(id||'');
  let x=rows.find(r=>String(r.id)===key);
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
      const u=universeRows.findIndex(z=>String(z.id)===key);
      if(u>=0)universeRows[u]={...universeRows[u],...x,analyzed:true};
    }
    return x;
  }catch{return null;}
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
    $('dSymbol').textContent='جزئیات در دسترس نیست';
    $('dCompany').textContent='رکورد تحلیلی این نماد هنوز به سامانه نرسیده است.';
    $('detailBody').innerHTML='<div class="alert-box">نماد در فهرست بازار وجود دارد، اما در حال حاضر رکورد تحلیلی قابل بازیابی نیست.</div>';
    if(!$('detailDialog').open)$('detailDialog').showModal();
    return;
  }
  currentDetail=x;
  $('dSymbol').textContent=x.symbol;
  $('dCompany').textContent=x.company;
  $('detailBody').innerHTML='<div class="history-loading">در حال دریافت سابقه روزانه نماد و محاسبه پیش‌بینی ۱۰ روزه…</div>';
  if(!$('detailDialog').open)$('detailDialog').showModal();
  await fetchDailyHistory(x);
  if(currentDetail?.id!==x.id)return;
  const ichi=forecastIchimoku(x),gann=forecastGann(x);
  $('detailBody').innerHTML=detailHTML(x,ichi,gann);
};
