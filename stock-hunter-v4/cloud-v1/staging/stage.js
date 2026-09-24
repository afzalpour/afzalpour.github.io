import {StockHunterCloudClientV1} from "../client/cloud-market-client-v1.js";

const q=s=>document.querySelector(s);
const el={
  api:q("#api"),connect:q("#connect"),disconnect:q("#disconnect"),
  state:q("#state"),fresh:q("#fresh"),age:q("#age"),sequence:q("#sequence"),
  rows:q("#rows"),gate:q("#gate"),events:q("#events"),sample:q("#sample"),
};
let client=null;
const eventLog=[];

function logEvent(v){
  const safe={...v};
  if(safe.health?.latest?.archive_key) safe.health={...safe.health,latest:{...safe.health.latest,archive_key:"[present]"}};
  eventLog.unshift(JSON.stringify(safe,null,2));
  eventLog.splice(12);
  el.events.textContent=eventLog.join("\n\n");
}

function text(v){return v===undefined||v===null||v===""?"—":String(v);}
function renderRows(rows){
  el.sample.replaceChildren();
  const list=Array.isArray(rows)?rows.slice(0,30):[];
  if(!list.length){
    const tr=document.createElement("tr"),td=document.createElement("td");
    td.colSpan=4;td.textContent="Snapshot خالی یا دریافت‌نشده است.";tr.append(td);el.sample.append(tr);return;
  }
  for(const row of list){
    const tr=document.createElement("tr");
    for(const v of [row.symbol,row.last_price,row.volume,row.heven]){
      const td=document.createElement("td");td.textContent=text(v);tr.append(td);
    }
    el.sample.append(tr);
  }
}

function onState(s){
  el.state.textContent=s.type||"—";
  logEvent(s);
  if(s.type==="health_fresh"||s.type==="health_stale"){
    el.fresh.textContent=s.fresh?"تازه":"کهنه";
    el.age.textContent=Number.isFinite(s.ageSeconds)?`${Math.round(s.ageSeconds)} ثانیه`:"—";
    const m=s.health?.latest||{};
    el.sequence.textContent=text(m.sequence);
    el.rows.textContent=text(m.row_count);
    el.gate.textContent=s.fresh?"باز (فقط تازگی)":"بسته";
  }
}

function onSnapshot(s){
  el.fresh.textContent=s.fresh?"تازه":"کهنه";
  el.age.textContent=Number.isFinite(s.ageSeconds)?`${Math.round(s.ageSeconds)} ثانیه`:"—";
  el.sequence.textContent=text(s.payload?.sequence);
  el.rows.textContent=text(s.payload?.rows?.length);
  el.gate.textContent=s.activeHuntAllowed?"باز (فقط تازگی)":"بسته";
  renderRows(s.payload?.rows);
}

function stop(){
  if(client){client.stop();client=null;}
  el.state.textContent="متوقف";
  el.gate.textContent="بسته";
}

async function start(){
  stop();
  const api=el.api.value.trim().replace(/\/+$/,"");
  if(!api)return;
  try{
    const u=new URL(api);
    if(u.protocol!=="https:")throw new Error("HTTPS required");
    localStorage.setItem("stock-hunter-cloud-stage-api",api);
    const here=new URL(location.href);here.searchParams.set("api",api);history.replaceState(null,"",here);
    client=new StockHunterCloudClientV1({apiBase:api,onState,onSnapshot});
    await client.start();
  }catch(e){
    logEvent({type:"stage_start_error",message:String(e?.message||e)});
    el.state.textContent="خطا";
  }
}

const p=new URLSearchParams(location.search).get("api");
el.api.value=p||localStorage.getItem("stock-hunter-cloud-stage-api")||"";
el.connect.addEventListener("click",start);
el.disconnect.addEventListener("click",stop);
window.addEventListener("pagehide",stop);
if(p)start();
