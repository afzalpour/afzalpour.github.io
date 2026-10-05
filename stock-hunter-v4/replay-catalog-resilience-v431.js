'use strict';
/* Stock Hunter 4.3.1 — resilient replay symbol catalog.
   UI/data-access only. Frozen Hunt engine 4.1.6-hunt-v2 is untouched.
   The legacy single JSON RPC can time out when PostgREST is under write pressure.
   Intercept only that RPC and build the same response from small paginated reads.
   Availability is optional: the complete active universe is still returned if its
   date-specific availability lookup is temporarily unavailable. */
(()=>{
  const TARGET='/rest/v1/rpc/stock_hunter_market_replay_symbol_catalog_v430';
  const nativeFetch=window.fetch.bind(window);
  const PAGE=500;

  function headersFrom(input,init){
    const h=new Headers(input instanceof Request?input.headers:undefined);
    const extra=new Headers(init&&init.headers||undefined);
    extra.forEach((v,k)=>h.set(k,v));
    const cfg=window.STOCK_HUNTER_CONFIG||{};
    const key=String(cfg.SUPABASE_PUBLISHABLE_KEY||'');
    if(key&&!h.has('apikey'))h.set('apikey',key);
    if(key&&!h.has('Authorization'))h.set('Authorization','Bearer '+key);
    h.set('Accept','application/json');
    return h;
  }
  function apiRoot(url){
    const u=new URL(url,location.href);
    return u.origin+'/rest/v1';
  }
  async function jsonGet(root,path,headers,range){
    const h=new Headers(headers);
    if(range)h.set('Range',range[0]+'-'+range[1]);
    const r=await nativeFetch(root+path,{method:'GET',headers:h,cache:'no-store'});
    if(!r.ok){
      let detail='';try{detail=(await r.json())?.message||'';}catch{}
      throw new Error('GET '+path.split('?')[0]+' → '+r.status+(detail?' · '+detail:''));
    }
    const j=await r.json();return Array.isArray(j)?j:[];
  }
  async function paged(root,path,headers){
    const out=[];let from=0;
    for(let guard=0;guard<100;guard++){
      const rows=await jsonGet(root,path,headers,[from,from+PAGE-1]);
      if(!rows.length)break;
      out.push(...rows);
      from+=rows.length;
    }
    return out;
  }
  async function latestReplayDate(root,headers){
    const rows=await jsonGet(root,'/stock_hunter_hunt_market_tape_v416?select=observation_date&order=observation_date.desc&limit=1',headers);
    return rows[0]?.observation_date||null;
  }
  async function buildCatalog(url,input,init){
    const root=apiRoot(url),headers=headersFrom(input,init);
    let body={};
    try{
      const raw=typeof init?.body==='string'?init.body:(input instanceof Request?await input.clone().text():'');
      if(raw)body=JSON.parse(raw)||{};
    }catch{}
    const requested=body.p_trade_date||null;
    let resolved=requested;
    if(!resolved)resolved=await latestReplayDate(root,headers);

    const universePath='/stock_hunter_universe_v4?select=ins_code,symbol,company_name,asset_type,market&is_active=eq.true&order=ins_code.asc';
    const universe=await paged(root,universePath,headers);

    let availability=[];
    if(resolved){
      const avPath='/stock_hunter_market_replay_live_symbols_v416?select=symbol_id,symbol,bucket_count,resolution_seconds&trade_date=eq.'+encodeURIComponent(resolved)+'&order=symbol_id.asc';
      try{availability=await paged(root,avPath,headers);}catch(e){console.warn('[replay catalog] availability degraded:',e.message);}
    }
    const av=new Map(availability.map(x=>[String(x.symbol_id),x]));
    const seen=new Set(),symbols=[];
    for(const u of universe){
      const id=String(u.ins_code||'').trim();
      if(!/^\d+$/.test(id)||!u.symbol||seen.has(id))continue;
      seen.add(id);const a=av.get(id);
      symbols.push({
        symbol_id:id,symbol:u.symbol,company_name:u.company_name||'',asset_type:u.asset_type||'',market:u.market||'',
        bucket_count:a?Number(a.bucket_count)||0:null,resolution_seconds:a?Number(a.resolution_seconds)||30:null
      });
    }
    symbols.sort((a,b)=>Number(b.bucket_count!=null)-Number(a.bucket_count!=null)||String(a.symbol).localeCompare(String(b.symbol),'fa'));
    return {
      requested_trade_date:requested,
      trade_date:resolved,
      total_symbols:symbols.length,
      available_symbols:availability.length,
      symbols,
      source:'PAGINATED_REST_V431',
      availability_degraded:Boolean(resolved&&availability.length===0)
    };
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    let path='';try{path=new URL(url,location.href).pathname;}catch{}
    if(path!==TARGET)return nativeFetch(input,init);
    try{
      const catalog=await buildCatalog(url,input,init);
      return new Response(JSON.stringify(catalog),{status:200,headers:{'Content-Type':'application/json; charset=utf-8','X-Stock-Hunter-Replay-Catalog':'PAGINATED_REST_V431'}});
    }catch(e){
      console.error('[replay catalog] resilient catalog failed',e);
      return new Response(JSON.stringify({code:'REPLAY_CATALOG_V431_FAILED',message:String(e&&e.message||e)}),{status:503,headers:{'Content-Type':'application/json; charset=utf-8'}});
    }
  };
  window.STOCK_HUNTER_REPLAY_CATALOG_V431={version:'4.3.1-replay-catalog-resilience',mode:'PAGINATED_REST',pageSize:PAGE};
})();
