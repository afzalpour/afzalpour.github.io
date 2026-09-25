#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {buildFrozenHuntReadyBatch,frozenHuntReadiness} from "../live-features/live-feature-builder-v1.ts";
import {evaluate,tparts} from "../frozen-runtime/generated-hunt-v416.ts";

const VERSION="stock-hunter-live-shadow-v416";
const HUNT_POSITIVE=new Set(["شکار ویژه","هشدار فوری","شکار زودهنگام"]);

function arg(name:string,def=""){
  const i=process.argv.indexOf(name);
  return i>=0&&process.argv[i+1]?process.argv[i+1]:def;
}
function tehranDate(sec:number){
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(sec*1000));
  const g=(k:string)=>p.find(x=>x.type===k)?.value||"";
  return `${g("year")}-${g("month")}-${g("day")}`;
}
function pct(last:number,y:number){return y>0?(last/y-1)*100:NaN;}
function quantile(values:number[],q:number){
  if(!values.length)return null;
  const a=[...values].sort((x,y)=>x-y),i=(a.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);
  return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(i-lo);
}
function round(v:number|null,d=4){
  if(v===null||!Number.isFinite(v))return null;
  const p=10**d;return Math.round(v*p)/p;
}
type Obs={
  t:number;symbol_id:string;symbol:string;day:number;mode:string|null;
  evaluated:boolean;hunt_positive:boolean;state:string;score:number;today:number;gate:string;
};
type Assessment={
  kind:"reversal"|"acceleration";
  pool_symbols:number;pool_events:number;base_rate:number|null;
  candidates:number;tp:number;fp:number;precision:number|null;
  scorable_events:number;detected_events:number;missed_events:number;recall:number|null;
  unscorable_early_cross:number;lift_vs_base:number|null;
  lead_minutes_median:number|null;lead_minutes_p25:number|null;lead_minutes_p75:number|null;
};

export function assessObjective(series:Map<string,Obs[]>,kind:"reversal"|"acceleration"):Assessment{
  let pool=0,poolEvents=0,candidates=0,tp=0,fp=0,scorableEvents=0,detected=0,unscorable=0;
  const leads:number[]=[];
  for(const xs0 of series.values()){
    const xs=[...xs0].sort((a,b)=>a.t-b.t);
    const start=(o:Obs)=>kind==="reversal"?o.day<0:o.day>=0&&o.day<1;
    const crossed=(o:Obs)=>kind==="reversal"?o.day>=0:o.day>=1;
    const startIndex=xs.findIndex(start);
    if(startIndex<0)continue;
    let crossIndex=-1;
    for(let i=startIndex+1;i<xs.length;i++){if(crossed(xs[i])){crossIndex=i;break;}}
    const end=crossIndex>=0?crossIndex:xs.length;
    const pre=xs.slice(startIndex,end).filter(o=>o.evaluated&&o.mode===kind);
    if(pre.length){
      pool++;
      if(crossIndex>=0)poolEvents++;
    }
    const positives=pre.filter(o=>o.hunt_positive);
    if(positives.length){
      candidates++;
      if(crossIndex>=0){tp++;leads.push(Math.max(0,(xs[crossIndex].t-positives[0].t)/60));}
      else fp++;
    }
    if(crossIndex>=0){
      if(!pre.length){unscorable++;continue;}
      scorableEvents++;
      if(positives.length)detected++;
    }
  }
  const precision=candidates?tp/candidates:null,base=pool?poolEvents/pool:null;
  return {
    kind,pool_symbols:pool,pool_events:poolEvents,base_rate:round(base),
    candidates,tp,fp,precision:round(precision),
    scorable_events:scorableEvents,detected_events:detected,missed_events:scorableEvents-detected,
    recall:round(scorableEvents?detected/scorableEvents:null),
    unscorable_early_cross:unscorable,
    lift_vs_base:round(precision!==null&&base!==null&&base>0?precision/base:null),
    lead_minutes_median:round(quantile(leads,.5),2),
    lead_minutes_p25:round(quantile(leads,.25),2),
    lead_minutes_p75:round(quantile(leads,.75),2),
  };
}

function compactPrevious(row:Record<string,unknown>){
  return {
    snapshots:Array.isArray(row.snapshots)?row.snapshots:[],
    candles:Array.isArray(row.candles)?row.candles:[],
    fast_score:row.fast_score,
    volume:row.volume,
  };
}

const input=path.resolve(arg("--input","market-facts.ndjson.gz"));
const output=path.resolve(arg("--output","shadow-v416-report.json"));
const expectedDate=arg("--date","");

if(!fs.existsSync(input)){console.error("SHADOW_INPUT_MISSING");process.exit(2);}
const lines=zlib.gunzipSync(fs.readFileSync(input)).toString("utf8").split(/\r?\n/).filter(Boolean);
if(!lines.length){console.error("SHADOW_INPUT_EMPTY");process.exit(2);}
const payloads=lines.map((line,i)=>{
  let p:any;try{p=JSON.parse(line)}catch(e){throw new Error(`invalid_json_line:${i+1}`)}
  if(p?.protocol!=="stock-hunter-iran-ingest-v1")throw new Error(`protocol_mismatch:${i+1}`);
  if(!Number.isSafeInteger(Number(p.observed_at))||!Array.isArray(p.rows))throw new Error(`payload_invalid:${i+1}`);
  return p;
}).sort((a,b)=>Number(a.observed_at)-Number(b.observed_at)||Number(a.sequence)-Number(b.sequence));

const date=expectedDate||tehranDate(Number(payloads[0].observed_at));
for(const p of payloads)if(tehranDate(Number(p.observed_at))!==date)throw new Error("mixed_tehran_dates");

const previous=new Map<string,Record<string,unknown>>();
const series=new Map<string,Obs[]>();
const stateCounts:Record<string,number>={};
let evaluatedRows=0,positiveRows=0,featureReadyRows=0,totalRows=0;

for(const p of payloads){
  const observed=Number(p.observed_at);
  const features=buildFrozenHuntReadyBatch(p.rows,previous,observed,observed);
  const now=tparts(new Date(observed*1000));
  totalRows+=features.length;
  for(const f of features){
    const id=String(f.id??"");
    if(!id)continue;
    if(frozenHuntReadiness(f).ready)featureReadyRows++;
    const last=Number(f.last_price||0),y=Number(f.yesterday_price||0),day=pct(last,y);
    if(!Number.isFinite(day)){previous.set(id,compactPrevious(f));continue;}
    const z=evaluate(f,now) as any;
    const shadow=z?.shadow||null;
    const o:Obs={
      t:observed,symbol_id:id,symbol:String(f.symbol??""),
      day,mode:shadow?.hunt_mode||null,evaluated:Boolean(shadow),
      hunt_positive:Boolean(shadow&&HUNT_POSITIVE.has(String(shadow.baseline_state))),
      state:String(shadow?.baseline_state||""),score:Number(shadow?.hunt_score||0),
      today:Number(shadow?.today_opportunity||0),gate:String(shadow?.gate_reason||""),
    };
    const a=series.get(id)||[];a.push(o);series.set(id,a);
    if(shadow){
      evaluatedRows++;
      stateCounts[o.state]=(stateCounts[o.state]||0)+1;
      if(o.hunt_positive)positiveRows++;
    }
    previous.set(id,compactPrevious(f));
  }
}

const reversal=assessObjective(series,"reversal");
const acceleration=assessObjective(series,"acceleration");
const report={
  schema:VERSION,
  engine:"4.1.6-hunt-v2",
  integrated_viewdef_md5:"09f820b9692f94010a5391c489ac9c96",
  date,
  prospective_capture_only:true,
  replay_order:"observed_at_then_sequence",
  no_future_features:true,
  hunt_positive_states:[...HUNT_POSITIVE],
  snapshots:payloads.length,
  first_observed_at:Number(payloads[0].observed_at),
  last_observed_at:Number(payloads.at(-1).observed_at),
  total_input_rows:totalRows,
  distinct_symbols:series.size,
  feature_ready_rows:featureReadyRows,
  evaluated_rows:evaluatedRows,
  hunt_positive_rows:positiveRows,
  state_counts:stateCounts,
  objectives:{reversal,acceleration},
  acceptance_note:"Daily shadow evidence only. Do not tune thresholds on this cohort; aggregate prospective sessions before production actionability.",
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
