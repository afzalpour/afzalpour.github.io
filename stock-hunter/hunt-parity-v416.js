'use strict';
const fs=require('fs'),vm=require('vm');

const RealDate=Date;
const FIXED_ISO='2026-09-16T07:00:00.000Z'; // Wed 10:30 Asia/Tehran
const FIXED_MS=RealDate.parse(FIXED_ISO);
class FakeDate extends RealDate{
  constructor(...args){super(...(args.length?args:[FIXED_MS]));}
  static now(){return FIXED_MS;}
}
global.Date=FakeDate;

const parseArr=v=>Array.isArray(v)?v:(typeof v==='string'?(()=>{try{const x=JSON.parse(v);return Array.isArray(x)?x:[]}catch{return[]}})():[]);
global.parseArr=parseArr;
global.n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
global.norm=r=>({
  id:String(r.id||'1'),symbol:r.symbol||'TEST',company:r.company_name||'Test',analyzed:true,
  last:Number(r.last_price||0),yesterday:Number(r.yesterday_price||0),volume:Number(r.volume||0),
  qi:Number(r.qi||0),ofi:Number(r.ofi||0),bidStack:Number(r.bid_stack_15s||0),askPull:Number(r.ask_pull_15s||0),
  rvol:Number(r.daily_rvol||0),rsi:Number(r.rsi_5m||0),ema9:Number(r.ema9_5m||0),ema21:Number(r.ema21_5m||0),vwap:Number(r.vwap||0),
  abs:Number(r.absorption||0),cancel:Number(r.cancellation_ratio||0),pv:Number(r.price_velocity||0),tradeAccel:Number(r.trade_accel||0),
  recovery:Number(r.recovery||0),depthRatio:Number(r.depth_ratio||0),accel:Number(r.signal_accel||0),realFlow:Number(r.real_flow_ratio||0),
  risk:Number(r.risk_score||0),cont:Number(r.continuation_score||0),candles:parseArr(r.candles),
  integratedEligible:r.integrated_eligible===true||r.integrated_eligible==='true',flowScore:Number(r.flow_score_v1||0),trendScore:Number(r.trend_score_v1||0),
  momentumScore:Number(r.momentum_score_v1||0),marketRegime:r.market_regime_v1||'—',marketBreadth:Number(r.market_breadth_pct_v1??0),
  assetType:r.asset_type||'',market:r.market||''
});
global.columns=[['symbol','نماد',true,10],['hunt','شکار',true,10],['details','جزئیات',true,10]];
global.visible=new Set(['symbol','hunt','details']);
global.cell=()=>'';global.filtered=()=>[];global.rows=[];global.universeRows=[];
global.$=()=>({value:'',innerHTML:'',textContent:'',querySelectorAll:()=>[],addEventListener:()=>{}});
global.fa=v=>String(Number(v).toFixed(2));global.esc=s=>String(s??'');global.hc=()=>'';
global.renderMobile=()=>{};global.updateSummary=()=>{};global.detailHTML=()=>'<div class="detail-grid"></div>';global.renderColumnOptions=()=>{};global.render=()=>{};
global.setInterval=()=>0;global.setTimeout=()=>0;

const sessionSrc=fs.readFileSync(__dirname+'/app-session-v413.js','utf8');
vm.runInThisContext(sessionSrc+'\n;globalThis.__session={isHuntableNowV413,todayTradeEvidenceV413,recentBookActivityV413,sessionTsSecV413};');
const huntSrc=fs.readFileSync(__dirname+'/app-hunt-v416.js','utf8');
vm.runInThisContext(huntSrc+'\n;globalThis.__huntParity={applyHuntV416};');
const {isHuntableNowV413}=global.__session;
const {applyHuntV416}=global.__huntParity;

const NOW_SEC=Math.floor(FIXED_MS/1000);
function snaps({prices=[98.5,98.7,98.9,99],buy=[1000,1200,1400,1600],sell=[1400,1200,1000,800],vol=[10000,12000,15000,19000],ms=false,times=[-90,-60,-30,0],extra=[]}={}){
  return prices.map((p,i)=>({
    T:(NOW_SEC+times[i])*(ms?1000:1),Last:p,Volume:vol[i],BuyDepth:buy[i],SellDepth:sell[i],
    BQ:buy[i]/2,SQ:sell[i]/2,Bid:p-.1,Ask:p+.1,BuyQueue:0,SellQueue:0,...(extra[i]||{})
  }));
}
function raw(id,extra={}){
  return {
    id:String(id),symbol:`T${id}`,company_name:`Fixture ${id}`,last_price:99,yesterday_price:100,low_price:96,high_price:101,max_allowed:105,volume:19000,
    qi:.30,ofi:.15,price_velocity:.08,trade_accel:40,signal_accel:12,bid_stack_15s:25,ask_pull_15s:20,daily_rvol:1.4,real_flow_ratio:1.35,
    risk_score:25,cancellation_ratio:10,absorption:60,recovery:65,depth_ratio:1.6,vwap:98.5,ema9_5m:99,ema21_5m:98.5,rsi_5m:58,
    continuation_score:70,asset_type:'سهام / سایر',market:'بورس',integrated_eligible:false,flow_score_v1:0,trend_score_v1:0,momentum_score_v1:0,
    market_regime_v1:'خنثی',market_breadth_pct_v1:50,snapshots:snaps(),candles:[],...extra
  };
}
function staleBook(active){
  const a={T:NOW_SEC-2700,Last:99,Volume:100,BuyDepth:1000,SellDepth:1000,BQ:500,SQ:500,Bid:98.9,Ask:99.1,BuyQueue:0,SellQueue:0};
  const b={...a,T:NOW_SEC-2670,Volume:200};
  const c={...b,T:NOW_SEC-300};
  const d={...c,T:NOW_SEC-120};
  if(active){d.Bid=99;d.Ask=99.05;d.BQ=560;}
  return [a,b,c,d];
}
const fixtures=[
  raw('101'),
  raw('102',{last_price:100.5,yesterday_price:100,low_price:99.5,high_price:101.5,snapshots:snaps({prices:[100,100.2,100.35,100.5]})}),
  raw('103',{snapshots:[{T:NOW_SEC-60,Last:99,Volume:19000,BuyDepth:1000,SellDepth:1000}],candles:[{t:NOW_SEC-30,volume:500,open:99,high:99,low:99,close:99}]}),
  raw('104',{risk_score:80}),
  raw('105',{asset_type:'اختیار معامله'}),
  raw('106',{snapshots:snaps({vol:[19000,19000,19000,19000]}),candles:[{t:NOW_SEC-30,volume:500,open:99,high:99,low:99,close:99}]}),
  raw('107',{snapshots:staleBook(true),volume:200}),
  raw('108',{snapshots:snaps({ms:true})}),
  raw('109',{snapshots:staleBook(false),volume:200})
];

function resultFor(r){
  const x=norm(r);
  const huntable=isHuntableNowV413(x);
  if(!huntable)return {id:String(r.id),captured:false};
  applyHuntV416(x);
  if(x.huntModeV416==='outside')return {id:String(r.id),captured:false};
  return {
    id:String(r.id),captured:true,mode:x.huntModeV416,
    today:+x.todayOpportunityV416.toFixed(10),score:+x.huntScoreV416.toFixed(10),state:x.hunt,gate:x.huntGate,
    evidence:x.huntEvidenceV416,dynamicEvidence:x.huntDynamicEvidenceV416,
    orderPressure:+x.orderPressureV416.toFixed(10),impulse:+x.impulseV416.toFixed(10),feasibility:+x.feasibilityV416.toFixed(10),
    flowVolume:+x.flowVolumeV416.toFixed(10),marketContext:+x.marketContextV416.toFixed(10),continuation:+x.continuation12V416.toFixed(10)
  };
}
const out={protocol:'4.1.6-browser-server-parity-v1',fixedNow:FIXED_ISO,results:fixtures.map(resultFor)};
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(out));
else{
  const byId=Object.fromEntries(out.results.map(x=>[x.id,x]));
  if(!byId['106'].captured)throw new Error('candle-only recent trade evidence must be huntable');
  if(!byId['107'].captured)throw new Error('recent quote/book movement must keep stale-trade symbol huntable');
  if(!byId['108'].captured)throw new Error('millisecond snapshot timestamps must be normalized');
  if(byId['109'].captured)throw new Error('stale frozen tape must not be huntable');
  console.log('hunt-browser-parity-fixtures: PASS');
}
