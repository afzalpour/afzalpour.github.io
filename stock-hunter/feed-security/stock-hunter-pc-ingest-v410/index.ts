import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const PC_KEY_SHA256='a44db59e173ced2712fd0d405213a5a1fbbc6a2cc30498398f22ccea9408e89f';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,content-encoding,x-pc-key','Access-Control-Allow-Methods':'POST,OPTIONS'};

async function sha256Hex(value:string){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function backendKey(){
  let key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const raw=Deno.env.get('SUPABASE_SECRET_KEYS');
  if(raw){try{key=JSON.parse(raw).default||key}catch{}}
  return key;
}
function safeRow(r:any){
  const allowed=['id','symbol','company_name','state','last_price','closing_price','yesterday_price','low_price','high_price','min_allowed','max_allowed','volume','value','buy_depth','sell_depth','best_bid','best_ask','sell_queue','buy_queue','fast_score','fast_probability','signal_accel','continuation_score','prob_2d','prob_3d','risk_score','qi','ofi','bid_stack_15s','ask_pull_15s','daily_rvol','rsi_5m','ema9_5m','ema21_5m','vwap','atr_5m','technical_score','microprice','absorption','cancellation_ratio','price_velocity','trade_accel','recovery','depth_ratio','queue_decay','momentum','real_flow_ratio','hunt_state','decision','entry_price','entry_low','entry_high','stop_loss','target_1','target_2','target_3','risk_reward','reason','snapshots','candles','raw_json'];
  const o:any={};for(const k of allowed)if(r?.[k]!==undefined)o[k]=r[k];
  o.id=String(o.id||'').trim();o.symbol=String(o.symbol||'').trim();o.company_name=String(o.company_name||'').trim();o.updated_at=new Date().toISOString();return o;
}
async function decodeBody(req:Request){
  const raw=new Uint8Array(await req.arrayBuffer());
  if(raw.byteLength>2_000_000)throw new Error('compressed payload too large');
  let bytes=raw;
  if((req.headers.get('content-encoding')||'').toLowerCase()==='gzip'){
    const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes=new Uint8Array(await new Response(stream).arrayBuffer());
  }
  if(bytes.byteLength>8_000_000)throw new Error('payload too large');
  return JSON.parse(new TextDecoder().decode(bytes));
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return new Response(JSON.stringify({ok:false,error:'method'}),{status:405,headers:{...cors,'Content-Type':'application/json'}});
  const supplied=req.headers.get('x-pc-key')||'';
  if(!supplied||await sha256Hex(supplied)!==PC_KEY_SHA256)return new Response(JSON.stringify({ok:false,error:'unauthorized'}),{status:401,headers:{...cors,'Content-Type':'application/json'}});
  try{
    const body=await decodeBody(req),rows=Array.isArray(body?.rows)?body.rows:[];
    if(rows.length<1||rows.length>300)return new Response(JSON.stringify({ok:false,error:'row_count'}),{status:413,headers:{...cors,'Content-Type':'application/json'}});const totalSymbols=Number(body?.total_symbols||rows.length),batchIndex=Number(body?.batch_index||1),batchCount=Number(body?.batch_count||1);if(!Number.isInteger(totalSymbols)||totalSymbols<rows.length||totalSymbols>5000||!Number.isInteger(batchIndex)||!Number.isInteger(batchCount)||batchIndex<1||batchCount<1||batchIndex>batchCount||batchCount>32)return new Response(JSON.stringify({ok:false,error:'batch_metadata'}),{status:400,headers:{...cors,'Content-Type':'application/json'}});
    const url=Deno.env.get('SUPABASE_URL')||'',key=backendKey();if(!url||!key)throw new Error('backend credentials unavailable');
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const clean=rows.map(safeRow).filter((r:any)=>r.id&&r.symbol&&r.symbol!=='—');if(!clean.length)throw new Error('no valid rows');
    const {error}=await db.from('stock_hunter_signals_v4').upsert(clean,{onConflict:'id'});if(error)throw error;
    const seed=clean.map((r:any)=>({ins_code:r.id,symbol:r.symbol,company_name:r.company_name,source:'pc-eco-bridge-v411',is_active:true,last_seen_at:r.updated_at,updated_at:new Date().toISOString()}));
    const {error:se}=await db.from('stock_hunter_universe_v4').upsert(seed,{onConflict:'ins_code'});if(se)throw se;
    const health={id:'local-agent',source:'pc-eco-bridge-v411',status:'ok',message:String(body?.message||'compressed pc bridge'),symbols:totalSymbols,agent_version:String(body?.agent_version||'4.1.1-pc-eco-full-universe'),last_feed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const {error:he}=await db.from('stock_hunter_feed_health_v4').upsert(health,{onConflict:'id'});if(he)throw he;
    return new Response(JSON.stringify({ok:true,count:clean.length,total_symbols:totalSymbols,batch_index:batchIndex,batch_count:batchCount}),{headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  }catch(e){
    return new Response(JSON.stringify({ok:false,error:String((e as any)?.message||e)}),{status:500,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
});