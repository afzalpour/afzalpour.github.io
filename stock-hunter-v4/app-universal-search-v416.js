'use strict';

// Universal search must never inherit Hunt/session filters.
// Search UX contract:
// - input paint is never blocked by a full table/card render;
// - results render is debounced;
// - symbol/company suggestions come from the full Universe catalog;
// - keyboard, pointer and touch selection are supported.
let catalogV416=[],catalogIndexV416=[],catalogLoadingV416=false,catalogLoadedAtV416=0;
let searchRenderTimerV416=null,searchSuggestRafV416=0,searchSuggestTimerV416=null;
let searchComposingV416=false,searchActiveIndexV416=-1,lastSearchInputAtV416=0;
const SEARCH_RENDER_DEBOUNCE_V416=110,SEARCH_SUGGEST_LIMIT_V416=10;

function normalizeSearchV416(v){
  return String(v??'').toLowerCase()
    .replace(/ي|ى/g,'ی').replace(/ك/g,'ک')
    .replace(/[ۀة]/g,'ه')
    .replace(/[‌‍ـ]+/g,' ')
    .replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ').trim();
}
function compactSearchV416(v){return normalizeSearchV416(v).replace(/\s+/g,'');}
function matchesUniversalSearchV416(r,q){
  const n=normalizeSearchV416(q),c=compactSearchV416(q);if(!n)return true;
  const hay=normalizeSearchV416(`${r.symbol||''} ${r.company_name||r.company||''} ${r.search_key||''} ${r.isin||''}`),compact=hay.replace(/\s+/g,'');
  return hay.includes(n)||(c&&compact.includes(c));
}
function searchIndexItemV416(r){
  const symbol=String(r.symbol||''),company=String(r.company_name||r.company||''),searchKey=String(r.search_key||''),isin=String(r.isin||'');
  const symbolNorm=normalizeSearchV416(symbol),companyNorm=normalizeSearchV416(company);
  const hay=normalizeSearchV416(`${symbol} ${company} ${searchKey} ${isin}`);
  return {raw:r,symbol,company,symbolNorm,companyNorm,hay,compact:hay.replace(/\s+/g,'')};
}
function rebuildCatalogIndexV416(){catalogIndexV416=catalogV416.map(searchIndexItemV416);}
function fallbackCatalogV416(){
  return rows.map(x=>({ins_code:String(x.id||''),symbol:x.symbol||'',company_name:x.company||'',market:x.market||'',asset_type:x.assetType||'',is_active:true,last_seen_at:x.updated||'',updated_at:x.updated||'',search_key:`${x.symbol||''} ${x.company||''}`}));
}
function currentSearchIndexV416(){
  if(catalogIndexV416.length)return catalogIndexV416;
  if(typeof universeRows!=='undefined'&&Array.isArray(universeRows)&&universeRows.length)return universeRows.map(searchIndexItemV416);
  return fallbackCatalogV416().map(searchIndexItemV416);
}
function universalRowsV416(q){
  const liveMap=new Map(rows.map(x=>[String(x.id||''),x]));
  if(catalogIndexV416.length){
    return catalogIndexV416.filter(i=>matchesUniversalSearchV416(i.raw,q)).map(i=>{
      const r=i.raw,x=typeof normUniverse==='function'?normUniverse(r,liveMap):(liveMap.get(String(r.ins_code||''))||r);
      x.universeLastSeenV416=r.last_seen_at||r.updated_at||x.updated||'';x.universeListedV416=true;return x;
    }).sort((a,b)=>(Number(b.analyzed===true)-Number(a.analyzed===true))||String(a.symbol||'').localeCompare(String(b.symbol||''),'fa')||String(a.company||'').localeCompare(String(b.company||''),'fa'));
  }
  if(typeof universeRows!=='undefined'&&Array.isArray(universeRows)&&universeRows.length){
    return universeRows.filter(r=>matchesUniversalSearchV416(r,q)).slice().sort((a,b)=>(Number(b.analyzed===true)-Number(a.analyzed===true))||String(a.symbol||'').localeCompare(String(b.symbol||''),'fa'));
  }
  return fallbackCatalogV416().filter(r=>matchesUniversalSearchV416(r,q)).map(r=>liveMap.get(String(r.ins_code||''))||r);
}
function suggestionScoreV416(i,qNorm,qCompact){
  const sc=i.symbolNorm,cc=i.companyNorm;
  if(sc===qNorm)return 0;
  if(sc.startsWith(qNorm))return 1;
  if(cc.startsWith(qNorm))return 2;
  if(sc.includes(qNorm))return 3;
  if(cc.includes(qNorm))return 4;
  if(i.hay.includes(qNorm))return 5;
  if(qCompact&&i.compact.includes(qCompact))return 6;
  return 99;
}
function suggestionsForV416(q){
  const qNorm=normalizeSearchV416(q),qCompact=compactSearchV416(q);if(!qNorm)return[];
  const found=[];
  for(const i of currentSearchIndexV416()){
    const score=suggestionScoreV416(i,qNorm,qCompact);
    if(score<99)found.push({i,score});
  }
  found.sort((a,b)=>a.score-b.score||a.i.symbol.length-b.i.symbol.length||a.i.symbol.localeCompare(b.i.symbol,'fa')||a.i.company.localeCompare(b.i.company,'fa'));
  const seen=new Set(),out=[];
  for(const m of found){
    const key=String(m.i.raw.ins_code||m.i.raw.id||`${m.i.symbol}|${m.i.company}`);
    if(seen.has(key))continue;seen.add(key);out.push(m.i);
    if(out.length>=SEARCH_SUGGEST_LIMIT_V416)break;
  }
  return out;
}
function searchListV416(){return typeof document!=='undefined'?document.getElementById('searchSuggestionsV416'):null;}
function hideSearchSuggestionsV416(){
  const list=searchListV416(),s=typeof $==='function'?$('search'):null;
  searchActiveIndexV416=-1;
  if(list){list.hidden=true;list.innerHTML='';}
  if(s){s.setAttribute('aria-expanded','false');s.removeAttribute('aria-activedescendant');}
}
function setActiveSuggestionV416(index){
  const list=searchListV416(),s=$('search');if(!list)return;
  const opts=[...list.querySelectorAll('[role="option"]')];if(!opts.length)return;
  searchActiveIndexV416=Math.max(0,Math.min(index,opts.length-1));
  opts.forEach((o,i)=>o.classList.toggle('active',i===searchActiveIndexV416));
  const active=opts[searchActiveIndexV416];s.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});
}
function selectSuggestionV416(el){
  const s=$('search'),value=el?.dataset?.searchValue||'';if(!s||!value)return;
  s.value=value;page=1;hideSearchSuggestionsV416();
  clearTimeout(searchRenderTimerV416);
  searchRenderTimerV416=setTimeout(()=>render(),0);
}
function renderSuggestionsV416(){
  const s=$('search'),list=searchListV416();if(!s||!list||searchComposingV416)return;
  const q=s.value.trim();if(!q){hideSearchSuggestionsV416();return;}
  const matches=suggestionsForV416(q);
  if(!matches.length){hideSearchSuggestionsV416();return;}
  const qNorm=normalizeSearchV416(q);
  if(matches.some(i=>i.symbolNorm===qNorm)){hideSearchSuggestionsV416();return;}
  searchActiveIndexV416=-1;
  list.innerHTML=matches.map((i,idx)=>{
    const r=i.raw,market=String(r.market||r.asset_type||r.assetType||'').trim();
    return `<button type="button" class="search-suggestion-v416" role="option" id="searchSuggestionV416-${idx}" aria-selected="false" data-search-value="${esc(i.symbol)}"><span><b>${esc(i.symbol)}</b><small>${esc(i.company||'—')}</small></span>${market?`<em>${esc(market)}</em>`:''}</button>`;
  }).join('');
  list.hidden=false;s.setAttribute('aria-expanded','true');
}
function scheduleSuggestionsV416(){
  if(typeof requestAnimationFrame!=='function'){clearTimeout(searchSuggestTimerV416);searchSuggestTimerV416=setTimeout(renderSuggestionsV416,0);return;}
  if(searchSuggestRafV416)cancelAnimationFrame(searchSuggestRafV416);
  clearTimeout(searchSuggestTimerV416);
  searchSuggestRafV416=requestAnimationFrame(()=>{searchSuggestTimerV416=setTimeout(renderSuggestionsV416,0);});
}
function scheduleSearchRenderV416(delay=SEARCH_RENDER_DEBOUNCE_V416){
  clearTimeout(searchRenderTimerV416);
  searchRenderTimerV416=setTimeout(()=>{
    page=1;
    const q=$('search')?.value?.trim()||'';
    render();
    if(q&&!catalogV416.length&&typeof searchUniverse==='function')searchUniverse(q);
  },delay);
}
function handleSearchInputV416(){
  lastSearchInputAtV416=Date.now();
  if(searchComposingV416)return;
  scheduleSuggestionsV416();
  scheduleSearchRenderV416();
}
function setupSearchComboboxV416(){
  const s=$('search');if(!s||typeof document==='undefined'||s.closest('.search-combobox-v416'))return;
  const wrap=document.createElement('div');wrap.className='search-combobox-v416';
  s.parentNode.insertBefore(wrap,s);wrap.appendChild(s);
  const list=document.createElement('div');list.id='searchSuggestionsV416';list.className='search-suggestions-v416';list.setAttribute('role','listbox');list.hidden=true;wrap.appendChild(list);
  s.setAttribute('role','combobox');s.setAttribute('aria-autocomplete','list');s.setAttribute('aria-controls','searchSuggestionsV416');s.setAttribute('aria-expanded','false');
  s.placeholder='نماد یا نام شرکت را بنویسید…';

  s.addEventListener('compositionstart',()=>{searchComposingV416=true;});
  s.addEventListener('compositionend',()=>{searchComposingV416=false;handleSearchInputV416();});
  s.addEventListener('input',handleSearchInputV416);
  s.addEventListener('focus',()=>{loadCatalogV416();scheduleSuggestionsV416();});
  s.addEventListener('keydown',e=>{
    const list=searchListV416(),opts=list&&!list.hidden?[...list.querySelectorAll('[role="option"]')]:[];
    if(e.key==='ArrowDown'&&opts.length){e.preventDefault();setActiveSuggestionV416(searchActiveIndexV416+1);}
    else if(e.key==='ArrowUp'&&opts.length){e.preventDefault();setActiveSuggestionV416(searchActiveIndexV416<0?opts.length-1:searchActiveIndexV416-1);}
    else if(e.key==='Enter'&&opts.length&&searchActiveIndexV416>=0){e.preventDefault();selectSuggestionV416(opts[searchActiveIndexV416]);}
    else if(e.key==='Escape'){hideSearchSuggestionsV416();}
  });
  list.addEventListener('pointerdown',e=>{
    const option=e.target.closest('[role="option"]');if(!option)return;
    e.preventDefault();selectSuggestionV416(option);s.focus({preventScroll:true});
  });
  document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))hideSearchSuggestionsV416();});
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
    if(all.length){
      const uniq=new Map();for(const r of all)uniq.set(String(r.ins_code||`${r.symbol}|${r.company_name}`),r);
      catalogV416=[...uniq.values()];rebuildCatalogIndexV416();catalogLoadedAtV416=Date.now();
      if($('search')?.value?.trim()){scheduleSuggestionsV416();scheduleSearchRenderV416(0);}
    }
  }catch(e){console.warn?.('universe catalog fallback',e?.message||e);}finally{catalogLoadingV416=false;}
}

const filteredBeforeUniversalV416=filtered;
filtered=function(){
  const q=$('search').value.trim();
  if(q)return universalRowsV416(q);
  return filteredBeforeUniversalV416();
};

if(typeof window!=='undefined'){
  window.STOCK_HUNTER_SEARCH_UI_V416={active:true,version:'4.1.6-search-typeahead-v1'};
  window.scheduleStockHunterSearchRenderV416=scheduleSearchRenderV416;
  window.stockHunterSearchRenderAfterDataV416=()=>{
    const typing=Date.now()-lastSearchInputAtV416<180;
    if(typing)scheduleSearchRenderV416(120);else render();
  };
  setupSearchComboboxV416();
  loadCatalogV416();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadCatalogV416();});
}
