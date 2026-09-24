import assert from "node:assert/strict";
import { legacySignalScoreV401 } from "../live-features/generated-signal-core-v401.ts";
import {
  assetTypeFromYValV408,
  inferAssetTypeV408,
  marketFromFlowV408,
} from "../live-features/recovered-eco-labels-v408.ts";
import {
  baseSignalRowFromCollector,
  buildBaseSignalFeatures,
  frozenHuntReadiness,
  realFlowRatioFromClientType,
} from "../live-features/live-feature-builder-v1.ts";

assert.equal(assetTypeFromYValV408("300"),"سهام");
assert.equal(assetTypeFromYValV408("301"),"حق تقدم");
assert.equal(assetTypeFromYValV408("303"),"صندوق");
assert.equal(assetTypeFromYValV408("305"),"صندوق");
assert.equal(assetTypeFromYValV408("306"),"صندوق");
assert.equal(assetTypeFromYValV408("400"),"اوراق بدهی");
assert.equal(assetTypeFromYValV408("403"),"اوراق بدهی");
assert.equal(assetTypeFromYValV408("404"),"اوراق بدهی");
assert.equal(assetTypeFromYValV408("999"),"");

assert.equal(inferAssetTypeV408("ضتست","نمونه","سهام"),"اختیار معامله");
assert.equal(inferAssetTypeV408("نماد","اختیار خرید نمونه","سهام"),"اختیار معامله");
for(const symbol of ["اخزا001","اراد001","گام001","افاد001","تسه001"]){
  assert.equal(inferAssetTypeV408(symbol,"نمونه","سهام"),"اوراق بدهی");
}
assert.equal(inferAssetTypeV408("نماد","صندوق\u200cدرآمد ثابت نمونه",""),"صندوق درآمد ثابت");
assert.equal(inferAssetTypeV408("نماد","صندوق سهامی نمونه",""),"صندوق");
assert.equal(inferAssetTypeV408("نماد","شرکت نمونه","حق تقدم"),"حق تقدم");
assert.equal(inferAssetTypeV408("نماد","شرکت نمونه",""),"سهام");

assert.equal(marketFromFlowV408(1),"بورس");
assert.equal(marketFromFlowV408(2),"فرابورس");
assert.equal(marketFromFlowV408(4),"بازار پایه");
assert.equal(marketFromFlowV408(6),"بورس کالا");
assert.equal(marketFromFlowV408(7),"بورس انرژی");
assert.equal(marketFromFlowV408(0),"بازار سرمایه");

const row1={
  id:"1001", isin:"IRO1TEST0001", symbol:"تست", company_name:"شرکت تست",
  heven:100000, closing_price:98, last_price:99, yesterday_price:100,
  low_price:97, high_price:101, min_allowed:90, max_allowed:110,
  tno:20, volume:10000, value:990000, flow:1, cs:"300", pf:0, yval:"300",
  best_limits:[
    {level:1,buy_orders:3,sell_orders:4,bid_price:98,ask_price:100,bid_qty:500,ask_qty:450},
    {level:2,buy_orders:2,sell_orders:2,bid_price:97,ask_price:101,bid_qty:400,ask_qty:350},
    {level:3,buy_orders:2,sell_orders:2,bid_price:96,ask_price:102,bid_qty:300,ask_qty:300},
    {level:4,buy_orders:1,sell_orders:1,bid_price:95,ask_price:103,bid_qty:200,ask_qty:250},
    {level:5,buy_orders:1,sell_orders:1,bid_price:94,ask_price:104,bid_qty:100,ask_qty:200},
  ],
  client_type:{
    individual_buy_count:4,corporate_buy_count:1,individual_buy_volume:4000,corporate_buy_volume:1000,
    individual_sell_count:2,corporate_sell_count:1,individual_sell_volume:2000,corporate_sell_volume:500,
  }
};

assert.equal(realFlowRatioFromClientType(row1.client_type),1);
const base1=baseSignalRowFromCollector(row1);
assert.equal(base1.buy_depth,1500);
assert.equal(base1.sell_depth,1550);
assert.equal(base1.best_bid,98);
assert.equal(base1.best_ask,100);
assert.equal(base1.real_flow_ratio,1);
assert.equal(base1.source_cs,"300");
assert.equal(base1.source_yval,"300");
assert.equal(base1.asset_type,"سهام");
assert.equal(base1.market,"بورس");

const t1=1790272800;
const first=buildBaseSignalFeatures(row1,null,t1);
assert.equal(first.cloud_feature_stage,"BASE_SIGNAL_PARITY_V401");
assert.equal(first.frozen_hunt_input_ready,false);
assert.equal(frozenHuntReadiness(first).ready,false);
assert.equal(Object.hasOwn(first,"hunt_state"),false);
assert.equal(Object.hasOwn(first,"decision"),false);
assert.equal(Object.hasOwn(first,"entry_price"),false);
assert.equal((first.snapshots as any[]).length,1);
assert.equal((first.snapshots as any[])[0].t,t1*1000);

const row2={
  ...row1,
  heven:100030,
  last_price:100,
  closing_price:99,
  volume:11200,
  value:1118000,
  best_limits:[
    {level:1,buy_orders:4,sell_orders:3,bid_price:99,ask_price:100,bid_qty:650,ask_qty:300},
    {level:2,buy_orders:3,sell_orders:2,bid_price:98,ask_price:101,bid_qty:500,ask_qty:300},
    {level:3,buy_orders:2,sell_orders:2,bid_price:97,ask_price:102,bid_qty:350,ask_qty:280},
    {level:4,buy_orders:1,sell_orders:1,bid_price:96,ask_price:103,bid_qty:250,ask_qty:220},
    {level:5,buy_orders:1,sell_orders:1,bid_price:95,ask_price:104,bid_qty:150,ask_qty:180},
  ]
};
const t2=t1+30;
const second=buildBaseSignalFeatures(row2,first,t2);
const direct=legacySignalScoreV401(baseSignalRowFromCollector(row2) as any,first as any,t2*1000) as any;

for(const key of [
  "fast_score","signal_accel","continuation_score","risk_score","qi","ofi",
  "bid_stack_15s","ask_pull_15s","daily_rvol","rsi_5m","ema9_5m","ema21_5m",
  "vwap","atr_5m","technical_score","microprice","absorption","cancellation_ratio",
  "price_velocity","trade_accel","recovery","depth_ratio","queue_decay","momentum"
]){
  assert.deepStrictEqual(second[key],direct[key],key);
}
assert.equal((second.snapshots as any[]).length,2);
assert.equal((second.snapshots as any[])[1].t,t2*1000);
assert.ok(Number.isFinite(Number(second.qi)));
assert.ok(Number.isFinite(Number(second.ofi)));
assert.deepStrictEqual(second.frozen_hunt_blockers,[
  "integrated_view_provenance_unresolved",
]);

console.log("cloud-base-signal-feature-builder: PASS");
