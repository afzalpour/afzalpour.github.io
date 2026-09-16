'use strict';
let universeRows=[], universeLoading=false, universeTimer=null;
if(!columns.some(c=>c[0]==='market')){columns.splice(columns.length-1,0,['market','بازار',false,10],['assetType','نوع ابزار',false,10]);}
function normUniverse(r,signalMap=new Map()){
  const id=String(r.ins_code||r.id||'');
  const live=signalMap.get(id)||rows.find(x=>x.id===id);
  if(live)return {...live,analyzed:true,market:r.market||live.market||'',assetType:r.asset_type||live.assetType||''};
  return {id,symbol:r.symbol||'—',company:r.company_name||'—',market:r.market||'',assetType:r.asset_type||'نامشخص',analyzed:false,hunt:'در انتظار تحلیل لحظه‌ای',decision:'فاقد سیگنال زنده',reason:'این ابزار در فهرست جامع بازار وجود دارد اما در آخرین پایش، سیگنال لحظه‌ای برای آن ثبت نشده است.',candles:[]};
}
const oldCell=cell;
cell=function(k,x){
  if(k==='market')return esc(x.market||'—');
  if(k==='assetType')return esc(x.assetType||'—');
  if(k==='symbol')return `<div class="symbol">${esc(x.symbol)}</div><div class="company">${esc(x.company)}${x.market||x.assetType?` • ${esc([x.market,x.assetType].filter(Boolean).join(' / '))}`:''}</div>`;
  if(x.analyzed===false&&['hunt','decision','fast','price','entry','target1','stop','accel','p2','p3','risk','qi','ofi','bidStack','askPull','rvol'].includes(k)){
    if(k==='hunt')return `<span class="badge watch">در انتظار تحلیل لحظه‌ای</span>`;
    if(k==='decision')return `<span class="badge watch">فاقد سیگنال زنده</span>`;
    return '—';
  }
  if(k==='details'&&x.analyzed===false)return `<button class="detail-btn" disabled title="پس از دریافت داده تحلیلی فعال می‌شود">در انتظار تحلیل</button>`;
  return oldCell(k,x);
};
const oldFiltered=filtered;
filtered=function(){
  const q=$('search').value.trim(),h=$('hunt').value,d=$('decision').value;
  if(!q)return oldFiltered();
  return universeRows.filter(x=>(!h||x.hunt===h)&&(!d||x.decision===d)).sort((a,b)=>(Number(b.analyzed===true)-Number(a.analyzed===true))+((Number(b.fast)||0)-(Number(a.fast)||0))||String(a.symbol).localeCompare(String(b.symbol),'fa'));
};
async function fetchSignalsForUniverse(base,items){
  const ids=items.map(x=>String(x.ins_code||'')).filter(x=>/^\d+$/.test(x));
  if(!ids.length)return new Map();
  try{
    const table=cfg.TABLE||'stock_hunter_signals_v4', p=new URLSearchParams();
    p.set('select','*'); p.set('id',`in.(${ids.join(',')})`); p.set('limit',String(Math.max(150,ids.length)));
    const r=await fetch(`${base}/rest/v1/${table}?${p.toString()}`,{headers:headers(),cache:'no-store'});
    if(!r.ok)return new Map();
    return new Map((await r.json()).map(s=>{const x=norm(s);x.analyzed=true;return[x.id,x]}));
  }catch{return new Map();}
}
async function searchUniverse(q){
  const base=String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base||!q.trim()){universeRows=[];universeLoading=false;render();return;}
  universeLoading=true;
  try{
    const term=q.trim().replace(/[(),]/g,' '), p=new URLSearchParams();
    p.set('select','ins_code,symbol,company_name,market,asset_type,is_active,updated_at');
    p.set('or',`(symbol.ilike.*${term}*,company_name.ilike.*${term}*)`);
    p.set('order','is_active.desc,symbol.asc');
    p.set('limit','150');
    const r=await fetch(`${base}/rest/v1/stock_hunter_universe_v4?${p.toString()}`,{headers:headers(),cache:'no-store'});
    if(!r.ok)throw new Error('جست‌وجوی جامع ناموفق بود');
    const items=await r.json(), signalMap=await fetchSignalsForUniverse(base,items);
    universeRows=items.map(x=>normUniverse(x,signalMap));
  }catch{universeRows=[]}
  finally{universeLoading=false;render();}
}
const searchEl=$('search');
searchEl.placeholder='جست‌وجو در تمام نمادهای بورس، فرابورس، صندوق‌ها، اوراق، اختیار، کالا و انرژی…';
searchEl.addEventListener('input',()=>{
  clearTimeout(universeTimer); page=1;
  const q=searchEl.value.trim();
  if(!q){universeRows=[];render();return;}
  universeTimer=setTimeout(()=>searchUniverse(q),180);
});
