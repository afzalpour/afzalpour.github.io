#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import vm from "node:vm";
import {buildFrozenHuntReadyBatch} from "../live-features/live-feature-builder-v1.ts";

const VERSION="stock-hunter-live-shadow-v425";
const CHAMPION="4.1.6-hunt-v2";
const CHALLENGER="4.2.5-challenger-shadow-v1";
const POSITIVE=new Set(["شکار ویژه","هشدار فوری","شکار زودهنگام"]);

function arg(name:string,def=""){
  const i=process.argv.indexOf(name);
  return i>=0&&process.argv[i+1]?process.argv[i+1]:def;
}
function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,Number.isFinite(v)?v:0));}
function num(v:unknown){const n=Number(v??0);return Number.isFinite(n)?n:0;}
function pct(a:number,b:number){return b>0?(a/b-1)*100:NaN;}
function round(v:number|null,d=4){
  if(v===null||!Number.isFinite(v))return null;
  const p=10**d;return Math.round(v*p)/p;
}
function quantile(values:number[],q:number){
  if(!values.length)return null;
  const a=[...values].sort((x,y)=>x-y),i=(a.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);
  return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(i-lo);
}
function tehranParts(sec:number){
  const d=new Date(sec*1000);
  const dateParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
  const timeParts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Tehran",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).formatToParts(d);
  const g=(xs:Intl.DateTimeFormatPart[],k:string)=>Number(xs.find(x=>x.type===k)?.value||0);
  const date=`${g(dateParts,"year").toString().padStart(4,"0")}-${g(dateParts,"month").toString().padStart(2,"0")}-${g(dateParts,"day").toString().padStart(2,"0")}`;
  const hour=g(timeParts,"hour"),minute=g(timeParts,"minute"),second=g(timeParts,"second");
  const minuteOfDay=hour*60+minute,bucket=Math.floor(minuteOfDay/5)*5;
  const phase=((minute%5)*60+second)/300;
  return {date,minuteOfDay,bucket,phase:clamp(phase,0,1)};
}
function readPack(file:string){
  const raw=zlib.gunzipSync(fs.readFileSync(file)).toString("utf8");
  return raw.split(/\r?\n/).filter(Boolean).map((line,i)=>{
    let p:any;try{p=JSON.parse(line)}catch{throw new Error(`invalid_json:${file}:${i+1}`)}
    if(p?.protocol!=="stock-hunter-iran-ingest-v1"||!Array.isArray(p?.rows))throw new Error(`payload_invalid:${file}:${i+1}`);
    const t=Number(p.observed_at);if(!Number.isSafeInteger(t)||t<=0)throw new Error(`observed_at_invalid:${file}:${i+1}`);
    return p;
  }).sort((a,b)=>Number(a.observed_at)-Number(b.observed_at)||Number(a.sequence)-Number(b.sequence));
}

type Level={bidP:number;bidQ:number;askP:number;askQ:number};
type Book={t:number;volume:number;levels:Level[]};
function bookFromRow(row:any,t:number):Book{
  const levels=(Array.isArray(row?.best_limits)?row.best_limits:[])
    .filter((x:any)=>Number(x?.level)>=1&&Number(x?.level)<=3)
    .slice().sort((a:any,b:any)=>Number(a.level)-Number(b.level))
    .map((x:any)=>({bidP:num(x.bid_price),bidQ:num(x.bid_qty),askP:num(x.ask_price),askQ:num(x.ask_qty)}));
  return {t,volume:num(row?.volume),levels};
}
function bookReady(b:Book){
  return b.levels.length===3&&b.levels.every(x=>x.bidP>0&&x.askP>0&&x.bidQ>=0&&x.askQ>=0);
}
function imbalance3(b:Book){
  if(!bookReady(b))return 0;
  let buy=0,sell=0;for(const l of b.levels){buy+=l.bidQ;sell+=l.askQ;}
  return buy+sell>0?clamp((buy-sell)/(buy+sell),-1,1):0;
}
function bidDelta(o:Level,c:Level){
  if(c.bidP>o.bidP)return Math.max(0,c.bidQ);
  if(c.bidP===o.bidP)return c.bidQ-o.bidQ;
  return -Math.max(0,o.bidQ);
}
function askDelta(o:Level,c:Level){
  if(c.askP<o.askP)return Math.max(0,c.askQ);
  if(c.askP===o.askP)return c.askQ-o.askQ;
  return -Math.max(0,o.askQ);
}
function mlofi3(oldB:Book,curB:Book){
  if(!bookReady(oldB)||!bookReady(curB))return 0;
  let sum=0;
  for(let i=0;i<3;i++){
    const o=oldB.levels[i],c=curB.levels[i];
    const den=Math.max(1,(o.bidQ+c.bidQ+o.askQ+c.askQ)/2);
    sum+=clamp((bidDelta(o,c)-askDelta(o,c))/den,-1,1);
  }
  return clamp(sum/3,-1,1);
}
function persistence(books:Book[]){
  const xs=books.slice(-4).filter(bookReady);
  if(!xs.length)return 0;
  return xs.filter(x=>imbalance3(x)>.05).length/xs.length;
}
function cancelProxy(oldB:Book,curB:Book){
  if(!bookReady(oldB)||!bookReady(curB))return 0;
  let oldDepth=0,removed=0;
  for(const side of ["bid","ask"] as const){
    const prev=new Map<number,number>(),next=new Map<number,number>();
    for(const l of oldB.levels){
      const px=side==="bid"?l.bidP:l.askP,q=side==="bid"?l.bidQ:l.askQ;
      if(px>0)prev.set(px,(prev.get(px)||0)+Math.max(0,q));
    }
    for(const l of curB.levels){
      const px=side==="bid"?l.bidP:l.askP,q=side==="bid"?l.bidQ:l.askQ;
      if(px>0)next.set(px,(next.get(px)||0)+Math.max(0,q));
    }
    for(const [px,q] of prev){oldDepth+=q;removed+=Math.max(0,q-(next.get(px)||0));}
  }
  const traded=Math.max(0,curB.volume-oldB.volume);
  return clamp(Math.max(0,removed-traded)/Math.max(1,oldDepth),0,1);
}

type BaselineCell={sum:number;count:number};
type Baseline=Map<string,Map<number,BaselineCell>>;
function buildRvolBaseline(files:string[]):Baseline{
  const baseline:Baseline=new Map();
  for(const file of files){
    const day=new Map<string,Map<number,number>>();
    for(const p of readPack(file)){
      const tp=tehranParts(Number(p.observed_at));
      for(const row of p.rows){
        const id=String(row?.id||"");if(!id)continue;
        const byBucket=day.get(id)||new Map<number,number>();
        byBucket.set(tp.bucket,Math.max(byBucket.get(tp.bucket)||0,num(row?.volume)));
        day.set(id,byBucket);
      }
    }
    for(const [id,buckets] of day){
      const dst=baseline.get(id)||new Map<number,BaselineCell>();
      for(const [bucket,volume] of buckets){
        if(volume<=0)continue;
        const cell=dst.get(bucket)||{sum:0,count:0};
        cell.sum+=volume;cell.count++;dst.set(bucket,cell);
      }
      baseline.set(id,dst);
    }
  }
  return baseline;
}
function rvolTod(baseline:Baseline,id:string,bucket:number,phase:number,volume:number){
  const by=baseline.get(id),cur=by?.get(bucket);
  if(!cur||cur.count<3||cur.sum<=0)return {value:0,samples:cur?.count||0};
  const curAvg=cur.sum/cur.count,prev=by?.get(bucket-5);
  let expected=curAvg;
  if(prev&&prev.count>=3&&prev.sum>0){
    expected=prev.sum/prev.count+phase*(curAvg-prev.sum/prev.count);
  }else expected=curAvg*Math.max(.10,phase);
  return {value:expected>0?clamp(volume/expected,0,10):0,samples:cur.count};
}

let fakeNowMs=Date.now();
function installBrowserHarness(){
  const RealDate=Date;
  class FakeDate extends RealDate{
    constructor(...args:any[]){super(...(args.length?args:[fakeNowMs]) as [any]);}
    static now(){return fakeNowMs;}
  }
  const g:any=globalThis;
  g.Date=FakeDate;
  g.window={};g.columns=[["symbol","نماد",true,10],["hunt","شکار",true,10],["details","جزئیات",true,10]];
  g.visible=new Set(["symbol","hunt","details"]);g.rows=[];g.universeRows=[];
  g.parseArr=(v:any)=>Array.isArray(v)?v:[];
  g.n=(v:any)=>{const x=Number(v);return Number.isFinite(x)?x:null};
  g.norm=(r:any)=>({
    id:String(r.id||""),symbol:r.symbol||"TEST",company:r.company_name||"",analyzed:true,
    last:num(r.last_price),close:num(r.closing_price),yesterday:num(r.yesterday_price),volume:num(r.volume),
    qi:num(r.qi),ofi:num(r.ofi),bidStack:num(r.bid_stack_15s),askPull:num(r.ask_pull_15s),
    rvol:num(r.daily_rvol),rsi:num(r.rsi_5m),ema9:num(r.ema9_5m),ema21:num(r.ema21_5m),vwap:num(r.vwap),
    abs:num(r.absorption),cancel:num(r.cancellation_ratio),pv:num(r.price_velocity),tradeAccel:num(r.trade_accel),
    recovery:num(r.recovery),depthRatio:num(r.depth_ratio),accel:num(r.signal_accel),realFlow:num(r.real_flow_ratio),
    risk:num(r.risk_score),cont:num(r.continuation_score),candles:Array.isArray(r.candles)?r.candles:[],
    snapshots:Array.isArray(r.snapshots)?r.snapshots:[],integratedEligible:r.integrated_eligible===true||r.integrated_eligible==="true",
    flowScore:num(r.flow_score_v1),trendScore:num(r.trend_score_v1),momentumScore:num(r.momentum_score_v1),
    marketRegime:r.market_regime_v1||"—",marketBreadth:num(r.market_breadth_pct_v1),
    assetType:r.asset_type||"",market:r.market||"",updated:r.updated_at||"",
    bookImbalance3V425:num(r.book_imbalance3_v425),mlofi3V425:num(r.mlofi3_v425),
    bookPersistenceV425:num(r.book_persistence_v425),cancelProxyV425:num(r.cancel_proxy_v425),
    rvolTodV425:num(r.rvol_tod_v425),rvolTodSamplesV425:num(r.rvol_tod_samples_v425),
    bookLevelsReadyV425:Boolean(r.book_levels_ready_v425),
  });
  g.cell=()=>"";g.filtered=()=>[];g.$=()=>({value:"",innerHTML:"",textContent:"",querySelectorAll:()=>[],addEventListener:()=>{}});
  g.fa=(v:any)=>String(Number(v||0).toFixed(2));g.esc=(s:any)=>String(s??"");g.hc=()=>"";
  g.renderMobile=()=>{};g.updateSummary=()=>{};g.detailHTML=()=>'<div class="detail-grid"></div>';
  g.renderColumnOptions=()=>{};g.render=()=>{};g.setInterval=()=>0;g.setTimeout=()=>0;

  const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),"../..");
  const session=fs.readFileSync(path.join(root,"app-session-v413.js"),"utf8");
  vm.runInThisContext(session+"\n;globalThis.__v425session={isHuntableNowV413};");
  const hunt=fs.readFileSync(path.join(root,"app-hunt-v416.js"),"utf8");
  vm.runInThisContext(hunt+"\n;globalThis.__v425champion={applyHuntV416};");
  const challenger=fs.readFileSync(path.join(root,"app-hunt-challenger-v425.js"),"utf8");
  vm.runInThisContext(challenger);
  return {
    setNow:(sec:number)=>{fakeNowMs=sec*1000;},
    norm:(r:any)=>g.norm(r),
    champion:(x:any)=>g.__v425champion.applyHuntV416(x),
    challenger:(x:any)=>g.window.StockHunterChallengerV425.apply(x),
  };
}

type Obs={
  t:number;day:number;
  championMode:string;championReady:boolean;championPositive:boolean;championScore:number;
  challengerMode:string;challengerReady:boolean;challengerPositive:boolean;challengerScore:number;
};
type Metric={
  pool_symbols:number;pool_events:number;base_rate:number|null;candidates:number;tp:number;fp:number;
  precision:number|null;scorable_events:number;detected_events:number;missed_events:number;recall:number|null;
  lift_vs_base:number|null;lead_minutes_median:number|null;lead_minutes_p25:number|null;lead_minutes_p75:number|null;
};
function assess(series:Map<string,Obs[]>,kind:"reversal"|"acceleration",model:"champion"|"challenger"):Metric{
  let pool=0,poolEvents=0,candidates=0,tp=0,fp=0,scorable=0,detected=0;const leads:number[]=[];
  for(const xs0 of series.values()){
    const xs=[...xs0].sort((a,b)=>a.t-b.t);
    const start=(o:Obs)=>kind==="reversal"?o.day<0:o.day>=0&&o.day<1;
    const crossed=(o:Obs)=>kind==="reversal"?o.day>=0:o.day>=1;
    const si=xs.findIndex(start);if(si<0)continue;
    let ci=-1;for(let i=si+1;i<xs.length;i++){if(crossed(xs[i])){ci=i;break;}}
    const pre=xs.slice(si,ci>=0?ci:xs.length).filter(o=>
      model==="champion"?(o.championReady&&o.championMode===kind):(o.challengerReady&&o.challengerMode===kind)
    );
    if(!pre.length)continue;
    pool++;if(ci>=0)poolEvents++;
    const positives=pre.filter(o=>model==="champion"?o.championPositive:o.challengerPositive);
    if(positives.length){
      candidates++;
      if(ci>=0){tp++;leads.push(Math.max(0,(xs[ci].t-positives[0].t)/60));}else fp++;
    }
    if(ci>=0){scorable++;if(positives.length)detected++;}
  }
  const precision=candidates?tp/candidates:null,base=pool?poolEvents/pool:null;
  return {
    pool_symbols:pool,pool_events:poolEvents,base_rate:round(base),candidates,tp,fp,precision:round(precision),
    scorable_events:scorable,detected_events:detected,missed_events:scorable-detected,recall:round(scorable?detected/scorable:null),
    lift_vs_base:round(precision!==null&&base!==null&&base>0?precision/base:null),
    lead_minutes_median:round(quantile(leads,.5),2),lead_minutes_p25:round(quantile(leads,.25),2),lead_minutes_p75:round(quantile(leads,.75),2),
  };
}
function challengerLegacyPositive(x:any){
  if(!x?.challengerComparableV425||x.challengerGateV425)return false;
  const s=num(x.challengerScoreV425),today=num(x.challengerTodayV425),risk=num(x.risk),e=num(x.challengerEvidenceV425);
  return (s>=78&&today>=82&&risk<=45&&e>=4)||
    (s>=68&&today>=74&&risk<=55&&e>=3)||
    (s>=58&&today>=64&&risk<=62&&e>=3);
}
function compactPrevious(row:Record<string,unknown>){
  return {snapshots:Array.isArray(row.snapshots)?row.snapshots:[],candles:Array.isArray(row.candles)?row.candles:[],fast_score:row.fast_score,volume:row.volume};
}
function selfTest(){
  const oldB:Book={t:1,volume:1000,levels:[
    {bidP:100,bidQ:100,askP:101,askQ:100},{bidP:99,bidQ:100,askP:102,askQ:100},{bidP:98,bidQ:100,askP:103,askQ:100}
  ]};
  const curB:Book={t:2,volume:1100,levels:[
    {bidP:101,bidQ:150,askP:102,askQ:80},{bidP:100,bidQ:130,askP:103,askQ:90},{bidP:99,bidQ:120,askP:104,askQ:95}
  ]};
  if(!(mlofi3(oldB,curB)>0))throw new Error("mlofi_selftest");
  if(!(imbalance3(curB)>0))throw new Error("imbalance_selftest");
  const b:Baseline=new Map([["1",new Map([[540,{sum:300,count:3}]])]]);
  const rv=rvolTod(b,"1",540,1,150);if(rv.samples!==3||Math.abs(rv.value-1.5)>.000001)throw new Error("rvol_selftest");
  console.log("shadow-replay-v425-selftest: PASS");
}

if(process.argv.includes("--self-test")){selfTest();process.exit(0);}

const input=path.resolve(arg("--input","market-facts.ndjson.gz"));
const baselineDir=path.resolve(arg("--baseline-dir","baseline-input"));
const output=path.resolve(arg("--output","shadow-v425-report.json"));
const expectedDate=arg("--date","");
if(!fs.existsSync(input))throw new Error("SHADOW_INPUT_MISSING");
const baselineFiles=fs.existsSync(baselineDir)?fs.readdirSync(baselineDir).filter(x=>x.endsWith(".gz")).sort().map(x=>path.join(baselineDir,x)):[];
const baseline=buildRvolBaseline(baselineFiles);
const payloads=readPack(input);
if(!payloads.length)throw new Error("SHADOW_INPUT_EMPTY");
const date=expectedDate||tehranParts(Number(payloads[0].observed_at)).date;
for(const p of payloads)if(tehranParts(Number(p.observed_at)).date!==date)throw new Error("mixed_tehran_dates");

const harness=installBrowserHarness();
const previous=new Map<string,Record<string,unknown>>();
const books=new Map<string,Book[]>();
const series=new Map<string,Obs[]>();
let totalRows=0,bookReadyRows=0,rvolMatureRows=0,comparableRows=0,championPositiveRows=0,challengerPositiveRows=0;

for(const p of payloads){
  const observed=Number(p.observed_at);harness.setNow(observed);
  const features=buildFrozenHuntReadyBatch(p.rows,previous,observed,observed);
  totalRows+=features.length;
  for(let i=0;i<features.length;i++){
    const f:any=features[i],raw:any=p.rows[i]||{},id=String(f.id||raw.id||"");if(!id)continue;
    const b=bookFromRow(raw,observed),history=books.get(id)||[],prev=history.at(-1);
    history.push(b);if(history.length>6)history.splice(0,history.length-6);books.set(id,history);
    const tp=tehranParts(observed),rv=rvolTod(baseline,id,tp.bucket,tp.phase,num(raw.volume));
    const ready=Boolean(prev&&bookReady(prev)&&bookReady(b));
    f.book_imbalance3_v425=imbalance3(b);
    f.mlofi3_v425=prev?mlofi3(prev,b):0;
    f.book_persistence_v425=persistence(history);
    f.cancel_proxy_v425=prev?cancelProxy(prev,b):0;
    f.rvol_tod_v425=rv.value;
    f.rvol_tod_samples_v425=rv.samples;
    f.book_levels_ready_v425=ready;
    f.challenger_feature_version_v425="4.2.5-cloud-shadow-derived-v1";
    f.updated_at=new Date(observed*1000).toISOString();
    if(ready)bookReadyRows++;if(rv.samples>=3)rvolMatureRows++;

    const x:any=harness.norm(f);harness.champion(x);harness.challenger(x);
    const day=pct(num(x.last),num(x.yesterday));if(!Number.isFinite(day)){previous.set(id,compactPrevious(f));continue;}
    const championReady=String(x.huntModeV416||"")==="reversal"||String(x.huntModeV416||"")==="acceleration";
    const challengerReady=Boolean(x.challengerComparableV425);
    const cp=championReady&&POSITIVE.has(String(x.hunt||""));
    const xp=challengerReady&&challengerLegacyPositive(x);
    if(challengerReady)comparableRows++;if(cp)championPositiveRows++;if(xp)challengerPositiveRows++;
    const o:Obs={
      t:observed,day,
      championMode:String(x.huntModeV416||""),championReady,championPositive:cp,championScore:num(x.huntScoreV416),
      challengerMode:String(x.challengerModeV425||""),challengerReady,challengerPositive:xp,challengerScore:num(x.challengerScoreV425),
    };
    const a=series.get(id)||[];a.push(o);series.set(id,a);
    previous.set(id,compactPrevious(f));
  }
}

const report={
  schema:VERSION,date,prospective_capture_only:true,no_future_features:true,
  champion_engine:CHAMPION,challenger_engine:CHALLENGER,
  challenger_state_rule:"Champion legacy action thresholds applied diagnostically to Challenger score/today/risk/evidence; no production routing.",
  baseline_pack_days:baselineFiles.length,baseline_minimum_sessions:3,
  snapshots:payloads.length,distinct_symbols:series.size,total_input_rows:totalRows,
  book_ready_rows:bookReadyRows,rvol_mature_rows:rvolMatureRows,challenger_comparable_rows:comparableRows,
  champion_positive_rows:championPositiveRows,challenger_positive_rows:challengerPositiveRows,
  first_observed_at:Number(payloads[0].observed_at),last_observed_at:Number(payloads.at(-1).observed_at),
  objectives:{
    reversal:{champion:assess(series,"reversal","champion"),challenger:assess(series,"reversal","challenger")},
    acceleration:{champion:assess(series,"acceleration","champion"),challenger:assess(series,"acceleration","challenger")},
  },
  acceptance_note:"Shadow evidence only. Do not tune or promote on the same cohort; aggregate future sessions and retain frozen 4.1.6 Champion until independent OOS/promotion gates pass.",
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
