import { legacySignalScoreV401 } from "./generated-signal-core-v401.ts";

export type CollectorBestLimit = {
  level: number;
  buy_orders?: number;
  sell_orders?: number;
  bid_price?: number;
  ask_price?: number;
  bid_qty?: number;
  ask_qty?: number;
};

export type CollectorClientType = {
  individual_buy_count?: number;
  corporate_buy_count?: number;
  individual_buy_volume?: number;
  corporate_buy_volume?: number;
  individual_sell_count?: number;
  corporate_sell_count?: number;
  individual_sell_volume?: number;
  corporate_sell_volume?: number;
};

export type CollectorMarketRow = {
  id: string;
  isin?: string | null;
  symbol: string;
  company_name?: string;
  heven?: number;
  closing_price?: number;
  last_price?: number;
  tno?: number;
  volume?: number;
  value?: number;
  low_price?: number;
  high_price?: number;
  yesterday_price?: number;
  min_allowed?: number;
  max_allowed?: number;
  flow?: number;
  cs?: string | null;
  pf?: number;
  best_limits?: CollectorBestLimit[];
  client_type?: CollectorClientType | null;
  asset_type?: string | null;
  market?: string | null;
};

const num=(v: unknown): number => {
  const n=Number(v ?? 0);
  return Number.isFinite(n)?n:0;
};

const approx=(a:number,b:number): boolean =>
  a>0 && b>0 && Math.abs(a-b)/b*100<=0.1;

export function realFlowRatioFromClientType(ct?: CollectorClientType|null): number {
  if(!ct) return 0;
  const buyCount=num(ct.individual_buy_count);
  const sellCount=num(ct.individual_sell_count);
  const buyVolume=num(ct.individual_buy_volume);
  const sellVolume=num(ct.individual_sell_volume);
  if(buyCount<=0 || sellCount<=0 || sellVolume<=0) return 0;
  return (buyVolume/buyCount)/(sellVolume/sellCount);
}

export function baseSignalRowFromCollector(row: CollectorMarketRow) {
  const levels=(Array.isArray(row.best_limits)?row.best_limits:[])
    .filter(x=>Number.isFinite(Number(x?.level)) && Number(x.level)>=1 && Number(x.level)<=5)
    .slice()
    .sort((a,b)=>Number(a.level)-Number(b.level));

  let buyDepth=0,sellDepth=0;
  for(const level of levels){
    buyDepth+=num(level.bid_qty);
    sellDepth+=num(level.ask_qty);
  }
  const l1=levels.find(x=>Number(x.level)===1) || levels[0] || ({} as CollectorBestLimit);
  const bestBid=num(l1.bid_price), bestAsk=num(l1.ask_price);
  const bestBidQty=num(l1.bid_qty), bestAskQty=num(l1.ask_qty);
  const minAllowed=num(row.min_allowed), maxAllowed=num(row.max_allowed);

  return {
    id:String(row.id??"").trim(),
    isin:String(row.isin??"").trim()||null,
    symbol:String(row.symbol??"").trim(),
    company_name:String(row.company_name??"").trim(),
    state:"",
    heven:num(row.heven),
    last_price:num(row.last_price),
    closing_price:num(row.closing_price),
    yesterday_price:num(row.yesterday_price),
    low_price:num(row.low_price),
    high_price:num(row.high_price),
    min_allowed:minAllowed,
    max_allowed:maxAllowed,
    tno:num(row.tno),
    volume:num(row.volume),
    value:num(row.value),
    buy_depth:buyDepth,
    sell_depth:sellDepth,
    best_bid:bestBid,
    best_ask:bestAsk,
    best_bid_qty:bestBidQty,
    best_ask_qty:bestAskQty,
    sell_queue:approx(bestAsk,minAllowed)?bestAskQty:0,
    buy_queue:approx(bestBid,maxAllowed)?bestBidQty:0,
    real_flow_ratio:realFlowRatioFromClientType(row.client_type),
    source_flow:num(row.flow),
    source_cs:String(row.cs??"").trim()||null,
    source_pf:num(row.pf),
    asset_type:String(row.asset_type??"").trim()||null,
    market:String(row.market??"").trim()||null,
  };
}

const AUTHORITATIVE_SIGNAL_FIELDS=[
  "id","isin","symbol","company_name","state","heven",
  "last_price","closing_price","yesterday_price","low_price","high_price",
  "min_allowed","max_allowed","tno","volume","value","buy_depth","sell_depth",
  "best_bid","best_ask","sell_queue","buy_queue","real_flow_ratio",
  "fast_score","fast_probability","signal_accel","continuation_score",
  "risk_score","qi","ofi","bid_stack_15s","ask_pull_15s","daily_rvol",
  "rsi_5m","ema9_5m","ema21_5m","vwap","atr_5m","technical_score",
  "microprice","absorption","cancellation_ratio","price_velocity",
  "trade_accel","recovery","depth_ratio","queue_decay","momentum",
  "snapshots","candles","asset_type","market","source_flow","source_cs","source_pf"
] as const;

export function buildBaseSignalFeatures(
  row: CollectorMarketRow,
  previous: Record<string,unknown>|null|undefined,
  observedAtSeconds: number,
){
  if(!Number.isSafeInteger(observedAtSeconds) || observedAtSeconds<=0){
    throw new Error("observed_at_invalid");
  }
  const base=baseSignalRowFromCollector(row);
  if(!base.id || !base.symbol) throw new Error("instrument_identity_invalid");

  const evaluated=legacySignalScoreV401(base as any,previous as any,observedAtSeconds*1000) as Record<string,unknown>;
  const out: Record<string,unknown>={};
  for(const key of AUTHORITATIVE_SIGNAL_FIELDS){
    if(Object.prototype.hasOwnProperty.call(evaluated,key)) out[key]=evaluated[key];
    else if(Object.prototype.hasOwnProperty.call(base,key)) out[key]=(base as any)[key];
  }

  // Re-attach raw classification/provenance fields not consumed by the legacy score().
  out.isin=base.isin;
  out.heven=base.heven;
  out.tno=base.tno;
  out.asset_type=base.asset_type;
  out.market=base.market;
  out.source_flow=base.source_flow;
  out.source_cs=base.source_cs;
  out.source_pf=base.source_pf;

  // Explicitly do not expose obsolete legacy decision/entry/target outputs.
  out.cloud_feature_stage="BASE_SIGNAL_PARITY_V401";
  out.feature_observed_at=observedAtSeconds;
  out.frozen_hunt_input_ready=false;
  out.frozen_hunt_blockers=[
    "integrated_view_provenance_unresolved",
    "asset_session_classification_provenance_unresolved",
  ];

  return out;
}

export function frozenHuntReadiness(row: Record<string,unknown>){
  const blockers=Array.isArray(row.frozen_hunt_blockers)
    ? row.frozen_hunt_blockers.map(String)
    : ["readiness_metadata_missing"];
  return {
    ready: row.frozen_hunt_input_ready===true && blockers.length===0,
    blockers,
    stage:String(row.cloud_feature_stage??"unknown"),
  };
}
