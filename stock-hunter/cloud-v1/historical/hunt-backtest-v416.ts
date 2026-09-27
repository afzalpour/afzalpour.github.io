#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {buildFrozenHuntReadyBatch,frozenHuntReadiness} from "../live-features/live-feature-builder-v1.ts";
import {evaluate,tparts} from "../frozen-runtime/generated-hunt-v416.ts";

const ENGINE="4.1.6-hunt-v2";
const VERSION="stock-hunter-hunt-backtest-v416-v1";
const ACTIVE=new Set(["شکار ویژه","هشدار فوری","شکار زودهنگام"]);
const ACTION_NOW=new Set(["شکار ویژه","هشدار فوری"]);

type Obs={
  date:string;t:number;symbol_id:string;symbol:string;company:string;asset_type:string;market:string;
  day:number;price:number;buy_queue:number;best_bid:number;best_ask:number;max_allowed:number;
  evaluated:boolean;mode:string|null;state:string;score:number;today:number;gate:string;
};
type Alert={
  channel:"ACTIVE_ANY"|"ACTION_NOW";date:string;next_expected_date:string;symbol_id:string;symbol:string;
  company:string;asset_type:string;market:string;mode:string;state:string;alert_at:number;alert_time_tehran:string;
  alert_price:number;alert_day_change:number;hunt_score:number;today_opportunity:number;
  same_day_objective_reached:boolean;same_day_close_observed:boolean;same_day_closed_target:boolean|null;
  same_day_final_change:number|null;same_day_max_change:number;same_day_mfe_from_alert_pct:number;same_day_mae_from_alert_pct:number;
  d1_observed:boolean;d1_close_observed:boolean;d1_buy_queue_any:boolean|null;d1_buy_queue_close:boolean|null;
  d1_buy_queue_snapshot_pct:number|null;d1_first_buy_queue_time_tehran:string|null;
  d1_max_day_change:number|null;d1_close_day_change:number|null;d1_positive_close:boolean|null;
  d1_hit_plus1:boolean|null;d1_hit_plus2:boolean|null;d1_hit_plus3:boolean|null;
  d1_mfe_from_alert_pct:number|null;d1_mae_from_alert_pct:number|null;
};
type ObjectiveAssessment={
  channel:string;kind:string;pool_symbols:number;pool_events:number;base_rate:number|null;
  candidates:number;tp:number;fp:number;precision:number|null;lift_vs_base:number|null;
  scorable_events:number;detected_events:number;missed_events:number;recall:number|null;
  lead_minutes_median:number|null;
};

function arg(name:string,def=""){const i=process.argv.indexOf(name);return i>=0&&process.argv[i+1]?process.argv[i+1]:def;}
function num(v:unknown){const n=Number(v??0);return Number.isFinite(n)?n:0;}
function pct(a:number,b:number){return b>0?(a/b-1)*100:NaN;}
function round(v:number|null,d=4){if(v===null||!Number.isFinite(v))return null;const p=10**d;return Math.round(v*p)/p;}
function median(v:number[]){if(!v.length)return null;const a=[...v].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function tehranParts(sec:number){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(sec*1000));
  const g=(k:string)=>parts.find(x=>x.type===k)?.value||"";
  return {date:`${g("year")}-${g("month")}-${g("day")}`,time:`${g("hour")}:${g("minute")}:${g("second")}`,minute:Number(g("hour"))*60+Number(g("minute"))};
}
function expectedNextSession(date:string){
  const [y,m,d]=date.split("-").map(Number);let x=new Date(Date.UTC(y,m-1,d,12));
  for(let i=0;i<7;i++){x=new Date(x.getTime()+86400000);const wd=x.getUTCDay();if(wd!==4&&wd!==5)return x.toISOString().slice(0,10);}
  throw new Error("next_session_resolution_failed");
}
function compactPrevious(row:Record<string,unknown>){
  return {snapshots:Array.isArray(row.snapshots)?row.snapshots:[],candles:Array.isArray(row.candles)?row.candles:[],fast_score:row.fast_score,volume:row.volume};
}
function closeObserved(xs:Obs[]){if(!xs.length)return false;return tehranParts(xs.at(-1)!.t).minute>=12*60+25;}
function targetReached(kind:string,o:Obs){return kind==="reversal"?o.day>=0:o.day>=1;}
function channelPass(channel:string,state:string){return channel==="ACTION_NOW"?ACTION_NOW.has(state):ACTIVE.has(state);}

function loadDay(file:string,date:string){
  const lines=zlib.gunzipSync(fs.readFileSync(file)).toString("utf8").split(/\r?\n/).filter(Boolean);
  const payloads=lines.map((line,i)=>{let p:any;try{p=JSON.parse(line)}catch{throw new Error(`invalid_json:${date}:${i+1}`)}
    if(p?.protocol!=="stock-hunter-iran-ingest-v1"||!Number.isSafeInteger(Number(p.observed_at))||!Array.isArray(p.rows))throw new Error(`payload_invalid:${date}:${i+1}`);
    return p;
  }).sort((a,b)=>Number(a.observed_at)-Number(b.observed_at)||Number(a.sequence)-Number(b.sequence));
  const prev=new Map<string,Record<string,unknown>>();
  const bySymbol=new Map<string,Obs[]>();
  let totalRows=0,readyRows=0,evaluatedRows=0;
  for(const p of payloads){
    const t=Number(p.observed_at);const tp=tehranParts(t);if(tp.date!==date)throw new Error(`mixed_date:${date}:${tp.date}`);
    const features=buildFrozenHuntReadyBatch(p.rows,prev,t,t);const now=tparts(new Date(t*1000));totalRows+=features.length;
    for(const f of features){
      const id=String(f.id??"");if(!id)continue;
      const last=num(f.last_price),y=num(f.yesterday_price),day=pct(last,y);
      if(!Number.isFinite(day)){prev.set(id,compactPrevious(f));continue;}
      if(frozenHuntReadiness(f).ready)readyRows++;
      const z:any=evaluate(f,now);const sh=z?.shadow||null;if(sh)evaluatedRows++;
      const o:Obs={
        date,t,symbol_id:id,symbol:String(f.symbol??""),company:String(f.company_name??""),asset_type:String(f.asset_type??""),market:String(f.market??""),
        day,price:last,buy_queue:num(f.buy_queue),best_bid:num(f.best_bid),best_ask:num(f.best_ask),max_allowed:num(f.max_allowed),
        evaluated:Boolean(sh),mode:sh?.hunt_mode||null,state:String(sh?.baseline_state||""),score:num(sh?.hunt_score),today:num(sh?.today_opportunity),gate:String(sh?.gate_reason||""),
      };
      const a=bySymbol.get(id)||[];a.push(o);bySymbol.set(id,a);prev.set(id,compactPrevious(f));
    }
  }
  for(const a of bySymbol.values())a.sort((x,y)=>x.t-y.t);
  return {date,payloads:payloads.length,totalRows,readyRows,evaluatedRows,bySymbol};
}

function makeAlert(channel:"ACTIVE_ANY"|"ACTION_NOW",date:string,xs:Obs[],next:Map<string,Obs[]>|undefined):Alert|null{
  const i=xs.findIndex(o=>o.evaluated&&o.mode&&(o.mode==="reversal"||o.mode==="acceleration")&&channelPass(channel,o.state));
  if(i<0)return null;const a=xs[i];const after=xs.slice(i);const kind=String(a.mode);
  const sameReached=after.some(o=>targetReached(kind,o));
  const sameClose=closeObserved(xs);const final=xs.at(-1)!;
  const sameRets=after.map(o=>pct(o.price,a.price)).filter(Number.isFinite);
  const sameMax=Math.max(...after.map(o=>o.day));
  const nextExpected=expectedNextSession(date);const d1=next?.get(a.symbol_id)||[];
  const d1Observed=d1.length>0;const d1Close=d1Observed&&closeObserved(d1);
  const q=d1.filter(o=>o.buy_queue>0);
  const d1Rets=d1.map(o=>pct(o.price,a.price)).filter(Number.isFinite);
  return {
    channel,date,next_expected_date:nextExpected,symbol_id:a.symbol_id,symbol:a.symbol,company:a.company,asset_type:a.asset_type,market:a.market,
    mode:kind,state:a.state,alert_at:a.t,alert_time_tehran:tehranParts(a.t).time,alert_price:a.price,alert_day_change:round(a.day,4)!,hunt_score:round(a.score,4)!,today_opportunity:round(a.today,4)!,
    same_day_objective_reached:sameReached,same_day_close_observed:sameClose,same_day_closed_target:sameClose?targetReached(kind,final):null,
    same_day_final_change:sameClose?round(final.day,4):null,same_day_max_change:round(sameMax,4)!,
    same_day_mfe_from_alert_pct:round(sameRets.length?Math.max(...sameRets):0,4)!,same_day_mae_from_alert_pct:round(sameRets.length?Math.min(...sameRets):0,4)!,
    d1_observed:d1Observed,d1_close_observed:d1Close,d1_buy_queue_any:d1Observed?q.length>0:null,d1_buy_queue_close:d1Close?d1.at(-1)!.buy_queue>0:null,
    d1_buy_queue_snapshot_pct:d1Observed?round(q.length/d1.length*100,3):null,d1_first_buy_queue_time_tehran:q.length?tehranParts(q[0].t).time:null,
    d1_max_day_change:d1Observed?round(Math.max(...d1.map(o=>o.day)),4):null,d1_close_day_change:d1Close?round(d1.at(-1)!.day,4):null,
    d1_positive_close:d1Close?d1.at(-1)!.day>0:null,d1_hit_plus1:d1Observed?d1.some(o=>o.day>=1):null,d1_hit_plus2:d1Observed?d1.some(o=>o.day>=2):null,d1_hit_plus3:d1Observed?d1.some(o=>o.day>=3):null,
    d1_mfe_from_alert_pct:d1Rets.length?round(Math.max(...d1Rets),4):null,d1_mae_from_alert_pct:d1Rets.length?round(Math.min(...d1Rets),4):null,
  };
}

function assess(days:any[],channel:"ACTIVE_ANY"|"ACTION_NOW",kind:"reversal"|"acceleration",equityOnly=true):ObjectiveAssessment{
  let pool=0,poolEvents=0,candidates=0,tp=0,fp=0,scorable=0,detected=0;const leads:number[]=[];
  for(const d of days)for(const xs0 of d.bySymbol.values() as IterableIterator<Obs[]>){
    const xs=xs0.filter(o=>!equityOnly||o.asset_type==="سهام");if(!xs.length)continue;
    const start=(o:Obs)=>kind==="reversal"?o.day<0:o.day>=0&&o.day<1;
    const crossed=(o:Obs)=>kind==="reversal"?o.day>=0:o.day>=1;
    const si=xs.findIndex(start);if(si<0)continue;let ci=-1;for(let i=si+1;i<xs.length;i++){if(crossed(xs[i])){ci=i;break;}}
    const end=ci>=0?ci:xs.length;const pre=xs.slice(si,end).filter(o=>o.evaluated&&o.mode===kind);if(!pre.length)continue;
    pool++;if(ci>=0)poolEvents++;
    const pos=pre.filter(o=>channelPass(channel,o.state));if(pos.length){candidates++;if(ci>=0){tp++;leads.push((xs[ci].t-pos[0].t)/60)}else fp++;}
    if(ci>=0){scorable++;if(pos.length)detected++;}
  }
  const precision=candidates?tp/candidates:null,base=pool?poolEvents/pool:null;
  return {channel,kind,pool_symbols:pool,pool_events:poolEvents,base_rate:round(base),candidates,tp,fp,precision:round(precision),lift_vs_base:precision!==null&&base!==null&&base>0?round(precision/base):null,scorable_events:scorable,detected_events:detected,missed_events:scorable-detected,recall:scorable?round(detected/scorable):null,lead_minutes_median:round(median(leads),2)};
}

function aggregate(alerts:Alert[]){
  const keys=[...new Set(alerts.map(a=>`${a.channel}|${a.mode}|${a.state}`))].sort();
  return keys.map(k=>{const [channel,mode,state]=k.split("|");const a=alerts.filter(x=>x.channel===channel&&x.mode===mode&&x.state===state);
    const close=a.filter(x=>x.same_day_close_observed),d1=a.filter(x=>x.d1_observed),d1c=a.filter(x=>x.d1_close_observed);
    const rate=(n:number,d:number)=>d?round(n/d*100,2):null;
    return {channel,mode,state,alerts:a.length,
      same_day_objective_rate_pct:rate(a.filter(x=>x.same_day_objective_reached).length,a.length),
      same_day_close_matured:close.length,same_day_closed_target_rate_pct:rate(close.filter(x=>x.same_day_closed_target).length,close.length),
      d1_matured:d1.length,d1_buy_queue_any_rate_pct:rate(d1.filter(x=>x.d1_buy_queue_any).length,d1.length),
      d1_close_matured:d1c.length,d1_buy_queue_close_rate_pct:rate(d1c.filter(x=>x.d1_buy_queue_close).length,d1c.length),
      d1_positive_close_rate_pct:rate(d1c.filter(x=>x.d1_positive_close).length,d1c.length),
      d1_hit_plus1_rate_pct:rate(d1.filter(x=>x.d1_hit_plus1).length,d1.length),d1_hit_plus2_rate_pct:rate(d1.filter(x=>x.d1_hit_plus2).length,d1.length),d1_hit_plus3_rate_pct:rate(d1.filter(x=>x.d1_hit_plus3).length,d1.length),
      median_same_day_mfe_pct:round(median(a.map(x=>x.same_day_mfe_from_alert_pct)),3),median_d1_mfe_pct:round(median(d1.map(x=>x.d1_mfe_from_alert_pct!).filter(Number.isFinite)),3)
    };
  });
}
function csv(v:unknown){const s=String(v??"");return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}
function writeCsv(file:string,rows:Alert[]){
  const cols=["channel","date","next_expected_date","symbol","asset_type","market","mode","state","alert_time_tehran","alert_price","alert_day_change","hunt_score","today_opportunity","same_day_objective_reached","same_day_close_observed","same_day_closed_target","same_day_final_change","same_day_max_change","same_day_mfe_from_alert_pct","same_day_mae_from_alert_pct","d1_observed","d1_close_observed","d1_buy_queue_any","d1_buy_queue_close","d1_buy_queue_snapshot_pct","d1_first_buy_queue_time_tehran","d1_max_day_change","d1_close_day_change","d1_positive_close","d1_hit_plus1","d1_hit_plus2","d1_hit_plus3","d1_mfe_from_alert_pct","d1_mae_from_alert_pct"];
  fs.writeFileSync(file,cols.join(",")+"\n"+rows.map(r=>cols.map(c=>csv((r as any)[c])).join(",")).join("\n")+"\n");
}

function selfTest(){
  if(expectedNextSession("2026-09-23")!=="2026-09-26")throw new Error("weekend_next_session");
  if(expectedNextSession("2026-09-21")!=="2026-09-22")throw new Error("weekday_next_session");
  const x:any={day:-.5};if(targetReached("reversal",x))throw new Error("reversal_false");x.day=.01;if(!targetReached("reversal",x))throw new Error("reversal_true");
  if(channelPass("ACTION_NOW","شکار زودهنگام"))throw new Error("action_now_scope");
  if(!channelPass("ACTIVE_ANY","شکار زودهنگام"))throw new Error("active_scope");
  console.log("SELFTEST PASS",VERSION,ENGINE);
}
if(process.argv.includes("--self-test")){selfTest();process.exit(0);}

const inputDir=path.resolve(arg("--input-dir","backtest-input"));const outDir=path.resolve(arg("--output-dir","backtest-out"));
const files=fs.existsSync(inputDir)?fs.readdirSync(inputDir).filter(x=>/^\d{4}-\d{2}-\d{2}\.ndjson\.gz$/.test(x)).sort():[];
if(!files.length){console.error("BACKTEST_INPUT_EMPTY");process.exit(2);}
const days=files.map(x=>loadDay(path.join(inputDir,x),x.slice(0,10)));
const dayMap=new Map(days.map(d=>[d.date,d.bySymbol]));
const alerts:Alert[]=[];
for(const d of days){
  const next=dayMap.get(expectedNextSession(d.date));
  for(const xs of d.bySymbol.values() as IterableIterator<Obs[]>){
    if(!xs.length||xs[0].asset_type!=="سهام")continue;
    for(const channel of ["ACTIVE_ANY","ACTION_NOW"] as const){const a=makeAlert(channel,d.date,xs,next);if(a)alerts.push(a);}
  }
}
const assessments=[
  assess(days,"ACTIVE_ANY","reversal"),assess(days,"ACTION_NOW","reversal"),
  assess(days,"ACTIVE_ANY","acceleration"),assess(days,"ACTION_NOW","acceleration")
];
const summary={
  schema:VERSION,engine:ENGINE,generated_at:new Date().toISOString(),prospective_raw_only:true,no_future_features:true,
  primary_population:"asset_type=سهام",alert_dedup:"first Hunt-positive per symbol/day/channel",
  action_now_states:[...ACTION_NOW],active_states:[...ACTIVE],
  buy_queue_definition:"canonical feature buy_queue > 0; best bid approximately equals max_allowed with positive level-1 bid quantity",
  d1_definition:"next expected Iran market session skipping Thursday/Friday; missing pack => not matured; exchange holidays are conservatively not inferred",
  dates:days.map(d=>({date:d.date,snapshots:d.payloads,total_rows:d.totalRows,ready_rows:d.readyRows,evaluated_rows:d.evaluatedRows})),
  alerts_total:alerts.length,aggregates:aggregate(alerts),objective_assessments:assessments,alerts
};
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,"hunt-backtest-v416.json"),JSON.stringify(summary,null,2)+"\n");
writeCsv(path.join(outDir,"hunt-backtest-alerts-v416.csv"),alerts);
const md=[
  "# Stock Hunter Frozen Hunt 4.1.6 — Real Prospective Backtest","",
  `Engine: ${ENGINE}`,`Dates: ${days.map(d=>d.date).join(", ")}`,`Equity alert records: ${alerts.length}`,"",
  "## Objective assessment (same-day target)",
  ...assessments.map(a=>`- ${a.channel} / ${a.kind}: candidates=${a.candidates}, precision=${a.precision??"NA"}, base=${a.base_rate??"NA"}, lift=${a.lift_vs_base??"NA"}, recall=${a.recall??"NA"}`),"",
  "## Outcome aggregates",
  ...aggregate(alerts).map((a:any)=>`- ${a.channel} / ${a.mode} / ${a.state}: n=${a.alerts}, same-day target=${a.same_day_objective_rate_pct??"NA"}%, close-target=${a.same_day_closed_target_rate_pct??"NA"}%, D+1 buy-queue-any=${a.d1_buy_queue_any_rate_pct??"NA"}%, D+1 positive-close=${a.d1_positive_close_rate_pct??"NA"}%`),"",
  "No missing D+1 session is backfilled or inferred. A missing expected raw pack remains unmatured."
].join("\n");
fs.writeFileSync(path.join(outDir,"HUNT_BACKTEST_REPORT_V416.md"),md+"\n");
console.log(JSON.stringify({engine:ENGINE,dates:days.map(d=>d.date),alerts:alerts.length,assessments,aggregates:summary.aggregates},null,2));
