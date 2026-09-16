'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');

global.norm=r=>({
  ...r,id:String(r.id||'1'),symbol:r.symbol||'TEST',company:r.company_name||'Test',
  last:Number(r.last_price||0),yesterday:Number(r.yesterday_price||0),low:Number(r.low_price||0),high:Number(r.high_price||0),
  volume:Number(r.volume||0),qi:Number(r.qi||0),ofi:Number(r.ofi||0),pv:Number(r.price_velocity||0),
  tradeAccel:Number(r.trade_accel||0),accel:Number(r.signal_accel||0),bidStack:Number(r.bid_stack_15s||0),
  askPull:Number(r.ask_pull_15s||0),rvol:Number(r.daily_rvol||0),realFlow:Number(r.real_flow_ratio||0),
  risk:Number(r.risk_score||0),cancel:Number(r.cancellation_ratio||0),abs:Number(r.absorption||0),
  recovery:Number(r.recovery||0),depthRatio:Number(r.depth_ratio||0),vwap:Number(r.vwap||0),
  ema9:Number(r.ema9_5m||0),ema21:Number(r.ema21_5m||0),rsi:Number(r.rsi_5m||0),
  cont:Number(r.continuation_score||50),marketRegime:'خنثی',marketBreadth:50,integratedEligible:false,
  assetType:r.asset_type||'سهام / سایر',snapshots:r.snapshots||[],analyzed:true,maxAllowed:Number(r.max_allowed||110)
});
global.columns=[['symbol','نماد',true,10],['hunt','شکار',true,10],['details','جزئیات',true,10]];
global.visible=new Set(['symbol','hunt','details']);
global.cell=()=>''; global.filtered=()=>[]; global.rows=[]; global.universeRows=[];
global.$=()=>({value:'',innerHTML:'',textContent:'',querySelectorAll:()=>[],addEventListener:()=>{}});
global.fa=(v)=>String(Number(v).toFixed(2));global.esc=s=>String(s??'');global.hc=()=>'';global.renderMobile=()=>{};
global.updateSummary=()=>{};global.detailHTML=()=>'<div class="detail-grid"></div>';global.renderColumnOptions=()=>{};global.render=()=>{};
global.setTimeout=()=>0;
global.sessionPhaseV413=()=>({phase:'trading',end:750});
global.tehranClockV413=()=>({hm:690});
global.isHuntableNowV413=()=>true;

const src=fs.readFileSync(__dirname+'/app-hunt-v416.js','utf8');
vm.runInThisContext(src+'\n;globalThis.__hunt={applyHuntV416,snapshotDynamicsV416,feasibilityScoreV416};');
const {applyHuntV416}=global.__hunt;

function snaps(prices=[98.5,98.7,99.0],buy=[1000,1200,1500],sell=[1200,1000,800],vol=[10000,12000,16000]){
  const t=1789548000;
  return prices.map((p,i)=>({T:t+i*30,Last:p,Volume:vol[i],BuyDepth:buy[i],SellDepth:sell[i],BQ:buy[i]/2,SQ:sell[i]/2,Bid:p-1,Ask:p+1,BuyQueue:0,SellQueue:0}));
}
function base(extra={}){
  return norm({
    id:'1',symbol:'TEST',company_name:'Test',last_price:99,yesterday_price:100,low_price:96,high_price:101,max_allowed:105,volume:16000,
    qi:.30,ofi:.15,price_velocity:.08,trade_accel:40,signal_accel:12,bid_stack_15s:25,ask_pull_15s:20,
    daily_rvol:1.4,real_flow_ratio:1.35,risk_score:25,cancellation_ratio:10,absorption:60,recovery:65,depth_ratio:1.6,
    vwap:98.5,ema9_5m:99,ema21_5m:98.5,rsi_5m:58,continuation_score:70,asset_type:'سهام / سایر',snapshots:snaps(),
    ...extra
  });
}

const rev=applyHuntV416(base());
assert.equal(rev.huntModeV416,'reversal');
assert.equal(rev.deltaReadyV416,true);
assert(Math.abs(rev.requiredVelocity15V416-.25)<1e-9,'Required 15-minute velocity must be 0.25% for 1% gap / 60 min');
assert(Math.abs(rev.requiredVelocity15sV416-(1/(60*60)*15))<1e-9,'Feasibility comparison must use 15-second units');
assert(rev.huntGate==='',`unexpected reversal gate: ${rev.huntGate}`);

const acc=applyHuntV416(base({
  last_price:100.5,yesterday_price:100,low_price:99.5,high_price:101.5,
  snapshots:snaps([100.0,100.2,100.5],[1000,1300,1700],[1300,1050,800],[10000,13000,19000])
}));
assert.equal(acc.huntModeV416,'acceleration');
assert(acc.dayChangeV416>=0&&acc.dayChangeV416<1);
assert(acc.huntEvidenceV416>=3);
assert(acc.huntDynamicEvidenceV416>=2);
assert.equal(acc.huntGate,'');

const outside=applyHuntV416(base({last_price:101,yesterday_price:100}));
assert.equal(outside.huntModeV416,'outside');
assert(outside.huntGate.includes('+۱٪'));

const noDelta=applyHuntV416(base({snapshots:[{T:1789548000,Last:99,Volume:16000,BuyDepth:1000,SellDepth:1000}]}));
assert.equal(noDelta.deltaReadyV416,false);
assert(noDelta.huntGate.includes('Delta'));

const body=src.slice(src.indexOf('function applyHuntV416'),src.indexOf('function isGoalCandidateV416'));
for(const forbidden of ['forecastIchimoku','forecastGann','bollinger','macd','obv']){
  assert(!body.toLowerCase().includes(forbidden.toLowerCase()),`forecast model leaked into Hunt Engine: ${forbidden}`);
}
assert(src.includes("dayChange<0?'reversal':dayChange<1?'acceleration':'outside'"));
console.log('hunt-v416 smoke: PASS');
