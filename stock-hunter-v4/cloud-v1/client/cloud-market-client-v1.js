'use strict';

// Stock Hunter Cloud Client v1.
// STAGING-ONLY module: intentionally not loaded by production index.html.
// No secrets belong in this module.

export const STOCK_HUNTER_CLOUD_CLIENT_PROTOCOL='stock-hunter-live-v1';
export const STOCK_HUNTER_CLOUD_FRESH_SECONDS=180;

export function cloudApiBaseV1(v){
  const s=String(v||'').trim().replace(/\/+$/,'');
  if(!/^https:\/\//i.test(s))throw new Error('cloud_api_base_must_be_https');
  return s;
}

export function cloudWsUrlV1(base){
  const u=new URL(cloudApiBaseV1(base));
  u.protocol='wss:';
  u.pathname='/v1/ws';
  u.search='';
  u.hash='';
  return u.toString();
}

export function cloudSnapshotFreshnessV1(observedAt,nowMs=Date.now(),maxAgeSec=STOCK_HUNTER_CLOUD_FRESH_SECONDS){
  const ts=Number(observedAt||0);
  const now=Number(nowMs||0)/1000;
  if(!Number.isFinite(ts)||ts<=0||!Number.isFinite(now)||now<=0)
    return {fresh:false,ageSeconds:Infinity,reason:'timestamp_invalid'};
  const age=Math.max(0,now-ts);
  return {
    fresh:age<=maxAgeSec,
    ageSeconds:age,
    reason:age<=maxAgeSec?'fresh':'stale',
  };
}

export function validateCloudSnapshotV1(payload){
  if(!payload||typeof payload!=='object')throw new Error('snapshot_invalid');
  if(!Array.isArray(payload.rows))throw new Error('snapshot_rows_invalid');
  const observedAt=Number(payload.observed_at||0);
  const sequence=Number(payload.sequence||0);
  if(!Number.isSafeInteger(observedAt)||observedAt<=0)throw new Error('snapshot_observed_at_invalid');
  if(!Number.isSafeInteger(sequence)||sequence<=0)throw new Error('snapshot_sequence_invalid');
  return payload;
}

function timeoutSignalV1(ms){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),ms);
  return {signal:ctrl.signal,clear:()=>clearTimeout(timer)};
}

export class StockHunterCloudClientV1{
  constructor({
    apiBase,
    onSnapshot=()=>{},
    onState=()=>{},
    fetchImpl=globalThis.fetch,
    WebSocketImpl=globalThis.WebSocket,
    maxAgeSeconds=STOCK_HUNTER_CLOUD_FRESH_SECONDS,
  }={}){
    this.apiBase=cloudApiBaseV1(apiBase);
    this.onSnapshot=onSnapshot;
    this.onState=onState;
    this.fetchImpl=fetchImpl;
    this.WebSocketImpl=WebSocketImpl;
    this.maxAgeSeconds=Math.max(30,Number(maxAgeSeconds)||STOCK_HUNTER_CLOUD_FRESH_SECONDS);
    this.running=false;
    this.ws=null;
    this.retryMs=1000;
    this.retryTimer=null;
    this.latestSequence=0;
    this.latestFetch=null;
    this.pendingLatest=false;
  }

  state(type,detail={}){
    try{this.onState({type,...detail,at:Date.now()});}catch{}
  }

  async fetchJson(path,timeoutMs=12000){
    const t=timeoutSignalV1(timeoutMs);
    try{
      const r=await this.fetchImpl(this.apiBase+path,{
        method:'GET',
        cache:'no-store',
        headers:{Accept:'application/json'},
        signal:t.signal,
      });
      if(!r.ok)throw new Error(`cloud_http_${r.status}`);
      return await r.json();
    }finally{t.clear();}
  }

  async health(){
    const h=await this.fetchJson('/v1/health',8000);
    const observedAt=Number(h?.latest?.observed_at||0);
    const f=cloudSnapshotFreshnessV1(observedAt,Date.now(),this.maxAgeSeconds);
    this.state(f.fresh?'health_fresh':'health_stale',{health:h,...f});
    return {health:h,...f};
  }

  async latest(){
    if(this.latestFetch){
      this.pendingLatest=true;
      return this.latestFetch;
    }
    this.latestFetch=(async()=>{
      try{
        const payload=validateCloudSnapshotV1(await this.fetchJson('/v1/latest',15000));
        const f=cloudSnapshotFreshnessV1(payload.observed_at,Date.now(),this.maxAgeSeconds);
        this.latestSequence=Math.max(this.latestSequence,Number(payload.sequence||0));
        this.state(f.fresh?'snapshot_fresh':'snapshot_stale',{
          sequence:Number(payload.sequence||0),rowCount:payload.rows.length,...f,
        });
        try{
          this.onSnapshot({
            payload,
            fresh:f.fresh,
            ageSeconds:f.ageSeconds,
            activeHuntAllowed:f.fresh,
          });
        }catch{}
        return {payload,...f};
      }finally{
        this.latestFetch=null;
        if(this.pendingLatest&&this.running){
          this.pendingLatest=false;
          queueMicrotask(()=>this.latest().catch(e=>this.state('latest_error',{message:String(e?.message||e)})));
        }
      }
    })();
    return this.latestFetch;
  }

  handleWsMessage(raw){
    let msg;
    try{msg=JSON.parse(String(raw));}catch{return;}
    if(msg?.protocol!==STOCK_HUNTER_CLOUD_CLIENT_PROTOCOL)return;
    if(msg.type==='snapshot_available'){
      const seq=Number(msg.sequence||0);
      if(Number.isSafeInteger(seq)&&seq>this.latestSequence&&this.running){
        this.latest().catch(e=>this.state('latest_error',{message:String(e?.message||e)}));
      }
      return;
    }
    if(msg.type==='waiting_for_snapshot')this.state('waiting_for_snapshot');
    else if(msg.type==='alive')this.state('ws_alive');
  }

  connectWs(){
    if(!this.running||!this.WebSocketImpl)return;
    let ws;
    try{ws=new this.WebSocketImpl(cloudWsUrlV1(this.apiBase));}
    catch(e){this.scheduleReconnect(e);return;}
    this.ws=ws;
    ws.onopen=()=>{
      if(this.ws!==ws)return;
      this.retryMs=1000;
      this.state('ws_open');
    };
    ws.onmessage=e=>{if(this.ws===ws)this.handleWsMessage(e.data);};
    ws.onerror=()=>{if(this.ws===ws)this.state('ws_error');};
    ws.onclose=e=>{
      if(this.ws!==ws)return;
      this.ws=null;
      this.state('ws_closed',{code:e?.code||0,reason:e?.reason||''});
      if(this.running)this.scheduleReconnect();
    };
  }

  scheduleReconnect(error){
    if(!this.running)return;
    clearTimeout(this.retryTimer);
    const delay=this.retryMs;
    this.retryMs=Math.min(30000,this.retryMs*2);
    this.state('ws_reconnect_scheduled',{
      delayMs:delay,
      message:error?String(error?.message||error):'',
    });
    this.retryTimer=setTimeout(()=>this.connectWs(),delay);
  }

  async start(){
    if(this.running)return;
    this.running=true;
    this.state('starting');
    try{await this.health();}catch(e){this.state('health_error',{message:String(e?.message||e)});}
    try{await this.latest();}catch(e){this.state('latest_error',{message:String(e?.message||e)});}
    this.connectWs();
  }

  stop(){
    this.running=false;
    clearTimeout(this.retryTimer);
    this.retryTimer=null;
    if(this.ws){
      try{this.ws.close(1000,'client_stop');}catch{}
      this.ws=null;
    }
    this.state('stopped');
  }
}
