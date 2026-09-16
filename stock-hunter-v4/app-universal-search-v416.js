'use strict';

// Universal search must never inherit Hunt/session filters.
let catalogV416=[],catalogLoadingV416=false,catalogLoadedAtV416=0;

function normalizeSearchV416(v){
  return String(v??'').toLowerCase().replace(/ي|ى/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200dـ]+/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}
function compactSearchV416(v){return normalizeSearchV416(v).replace(/\s+/g,'');}
function matchesUniversalSearchV416(r,q){
  const n=normalizeSearchV416(q),c=compactSearchV416(q);if(!n)return true;
  const hay=normalizeSearchV416(`${r.symbol||''} ${r.company_name||r.company||''} ${r.search_key||''} ${r.isin||''}`),compact=hay.replace(/\s+/g,'');
  return hay.includes(n)||(c&&compact.includes(c));
}
function fallbackCatalogV416(){
  return rows.map(x=>({ins_code:String(x.id||''),symbol:x.symbol||'',company_name:x.company||'',market:x.market||'',asset_type:x.assetType||'',is_active:true,last_seen_at:x.updated||'',updated_at:x.updated||'',search_key:`${x.symbol||''} ${x.company||''}`}));
}
function universalRowsV416(q){
  const liveMap=new Map(rows.map(x=>[String(x.id||''),x])),src=catalogV416.length?catalogV416:fallbackCatalogV416();
  return src.filter(r=>matchesUniversalSearchV416(r,q)).map(r=>{
    const x=typeof normUniverse==='function'?normUniverse(r,liveMap):(liveMap.get(String(r.ins_code||''))||r);
    x.universeLastSeenV416=r.last_seen_at||r.updated_at||x.updated||'';x.universeListedV416=true;return x;
  }).sort((a,b)=>(Number(b.analyzed===true)-Number(a.analyzed===true))||String(a.symbol||'').localeCompare(String(b.symbol||''),'fa')||String(a.company||'').localeCompare(String(b.company||''),'fa'));
}
async function loadCatalogV416(force=false){
  if(catalogLoadingV416)return;
  if(!force&&catalogV416.length&&Date.now()-catalogLoadedAtV416<30*60*1000)return;
  const base=String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');if(!base)return;
  catalogLoadingV416=true;
  try{
    const all=[];
    for(let offset=0;offset<10000;offset+=1000){
      const p=new URLSearchParams();p.set('select','ins_code,symbol,company_name,isin,market,asset_type,is_active,last_seen_at,updated_at,search_key');p.set('order','symbol.asc');p.set('limit','1000');p.set('offset',String(offset));
      const r=await fetch(`${base}/rest/v1/stock_hunter_universe_v4?${p.toString()}`,{headers:headers(),cache:'no-store'});if(!r.ok)throw new Error(`Universe HTTP ${r.status}`);
      const batch=await r.json();all.push(...batch);if(batch.length<1000)break;
    }
    if(all.length){const uniq=new Map();for(const r of all)uniq.set(String(r.ins_code||`${r.symbol}|${r.company_name}`),r);catalogV416=[...uniq.values()];catalogLoadedAtV416=Date.now();if($('search')?.value?.trim()){page=1;render();}}
  }catch(e){console.warn?.('universe catalog fallback',e?.message||e);}finally{catalogLoadingV416=false;}
}

const filteredBeforeUniversalV416=filtered;
filtered=function(){
  const q=$('search').value.trim();
  if(q)return universalRowsV416(q);
  return filteredBeforeUniversalV416();
};

if(typeof window!=='undefined'){
  loadCatalogV416();
  const s=$('search');if(s){s.placeholder='جست‌وجو در تمام نمادهای شرکت‌ها و بازار — باز، بسته یا متوقف…';s.addEventListener('focus',()=>loadCatalogV416());}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadCatalogV416();});
}
