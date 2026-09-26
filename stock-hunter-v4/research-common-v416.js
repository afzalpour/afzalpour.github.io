'use strict';
(function(){
  const cfg=window.STOCK_HUNTER_CONFIG||{};
  const base=String(cfg.SUPABASE_URL||'').replace(/\/$/,'');
  const key=String(cfg.SUPABASE_PUBLISHABLE_KEY||'');
  function headers(){return {'apikey':key,'Authorization':'Bearer '+key,'Accept':'application/json'};}
  async function api(table,query){
    const url=base+'/rest/v1/'+table+(query?('?'+query):'');
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
    try{
      const r=await fetch(url,{headers:headers(),cache:'no-store',signal:ctrl.signal});
      if(!r.ok)throw new Error('HTTP '+r.status);
      return await r.json();
    }finally{clearTimeout(timer);}
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function fa(v,d=0){if(v==null||v==='')return '—';const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
  function pct(v,d=2){if(v==null||v==='')return '—';const n=Number(v);return Number.isFinite(n)?((n>0?'+':'')+fa(n,d)+'٪'):'—';}
  function jalaliDate(v){
    if(!v)return '—';const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(v))?String(v)+'T12:00:00Z':v);
    if(!Number.isFinite(d.getTime()))return String(v);
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn',{calendar:'persian',numberingSystem:'latn',timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }
  function time(v){
    if(!v)return '—';const d=new Date(v);if(!Number.isFinite(d.getTime()))return '—';
    return new Intl.DateTimeFormat('fa-IR-u-nu-latn',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
  }
  function dateTime(v){return v?jalaliDate(v)+' '+time(v):'—';}
  function todayIso(){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const g=t=>parts.find(p=>p.type===t)?.value||'';return g('year')+'-'+g('month')+'-'+g('day');
  }
  function daysAgoIso(n){const d=new Date();d.setUTCDate(d.getUTCDate()-Number(n||0));return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
  function setStatus(text,state='ok'){const e=document.getElementById('researchStatus');if(!e)return;e.textContent=text;e.dataset.state=state;}
  window.StockHunterResearchV416={version:'4.1.6-research-v1',api,esc,fa,pct,jalaliDate,time,dateTime,todayIso,daysAgoIso,setStatus};
})();