// Source-equivalent port of public.stock_hunter_integrated_v1.
// Authoritative PostgreSQL pg_get_viewdef(..., true) recovered 2026-09-25.
// View-definition MD5 at recovery: 09f820b9692f94010a5391c489ac9c96
// This module does not change Frozen Hunt 4.1.6; it reconstructs its integrated inputs.

export const INTEGRATED_V410_VIEWDEF_MD5 = "09f820b9692f94010a5391c489ac9c96";
export const INTEGRATED_V410_STAGE = "INTEGRATED_V410_EXACT_SQL";

type Row = Record<string, unknown>;

const clip=(v:number,lo=0,hi=100)=>Math.max(lo,Math.min(hi,v));
const nullableNum=(v:unknown):number|null=>{
  if(v===null||v===undefined||v==="") return null;
  const n=Number(v);
  return Number.isFinite(n)?n:null;
};
const coalesceNum=(v:unknown,fallback:number):number=>nullableNum(v)??fallback;
const str=(v:unknown)=>String(v??"");
const ilikeContains=(v:unknown,needle:string)=>str(v).toLowerCase().includes(needle.toLowerCase());
const avg=(values:(number|null)[]):number|null=>{
  const xs=values.filter((v):v is number=>v!==null&&Number.isFinite(v));
  return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
};
const round1=(v:number)=>Math.round((v+Number.EPSILON)*10)/10;

function updatedAtMs(row:Row):number|null{
  const raw=row.updated_at;
  if(raw instanceof Date){ const t=raw.getTime(); return Number.isFinite(t)?t:null; }
  if(typeof raw==="string"&&raw){ const t=Date.parse(raw); if(Number.isFinite(t)) return t; }
  const featureSec=nullableNum(row.feature_observed_at);
  return featureSec!==null?featureSec*1000:null;
}

// Eco v4.0.8 names ordinary shares "سهام" while the legacy universe taxonomy
// consumed by v4.1.0 names the same integrated bucket "سهام / سایر".
// A live DB aggregate on 2026-09-25 showed the SQL eligibility count unchanged
// when "سهام" was admitted as the compatibility spelling (696 vs 696).
export function universeAssetTypeForIntegratedV410(assetType:unknown):string{
  const a=str(assetType).trim();
  return a==="سهام"?"سهام / سایر":a;
}

export function integratedEligibleV410(row:Row):boolean{
  const rawAsset=(row.universe_asset_type_v410 ?? row.asset_type);
  const asset=universeAssetTypeForIntegratedV410(rawAsset);
  const symbol=str(row.symbol);
  const company=str(row.company_name);
  const phase1Asset=asset==="سهام / سایر"||asset==="حق تقدم";
  const rightLike=symbol.endsWith("ح")||company.toLowerCase().startsWith("ح .");
  return (phase1Asset||rightLike)
    && !ilikeContains(company,"صندوق")
    && !ilikeContains(company,"اختیار");
}

export function flowScoreV410(row:Row):number{
  const rf=Math.max(coalesceNum(row.real_flow_ratio,1),0.10);
  const ofi=clip(coalesceNum(row.ofi,0),-1,1);
  const rvol=clip(coalesceNum(row.daily_rvol,1)-1,-1,2);
  return clip(50+22*Math.log(rf)+18*ofi+10*rvol);
}

export function trendScoreV410(row:Row):number{
  const technical=coalesceNum(row.technical_score,7.5)/15*75;
  const e9=nullableNum(row.ema9_5m),e21=nullableNum(row.ema21_5m);
  const ema=(coalesceNum(row.ema9_5m,0)>0&&e9!==null&&e21!==null&&e9>e21)?10:0;
  const vwap=nullableNum(row.vwap),last=nullableNum(row.last_price);
  const vw=(coalesceNum(row.vwap,0)>0&&vwap!==null&&last!==null&&last>=vwap)?8:0;
  const rsi=coalesceNum(row.rsi_5m,0);
  const rsiConfirm=rsi>=40&&rsi<=72?7:0;
  return clip(technical+ema+vw+rsiConfirm);
}

export function momentumScoreV410(row:Row):number{
  return clip(50+18*clip(coalesceNum(row.momentum,0),-2,2));
}

export function dataQualityScoreV410(row:Row,nowSeconds:number):number{
  if(coalesceNum(row.last_price,0)<=0||coalesceNum(row.volume,0)<=0) return 0;
  const t=updatedAtMs(row),now=nowSeconds*1000;
  if(t!==null&&t>=now-2*60_000) return 100;
  if(t!==null&&t>=now-5*60_000) return 82;
  if(t!==null&&t>=now-10*60_000) return 65;
  if(t!==null&&t>=now-30*60_000) return 40;
  return 25;
}

export type IntegratedMarketV410={
  adv_ratio:number|null;
  avg_return_pct:number|null;
  avg_fast:number|null;
  avg_risk:number|null;
  market_regime_v1:"پرنوسان"|"صعودی"|"نزولی"|"خنثی";
  market_breadth_pct_v1:number;
  regime_adjustment_v1:number;
};

export function integratedMarketV410(rows:Row[],nowSeconds:number):IntegratedMarketV410{
  const fresh=rows.filter(r=>{
    const t=updatedAtMs(r);
    return t!==null&&t>nowSeconds*1000-5*60_000;
  });
  const eligible=fresh.filter(integratedEligibleV410);
  const adv=avg(eligible.map(r=>{
    const y=nullableNum(r.yesterday_price),last=nullableNum(r.last_price);
    if(y===null||last===null||y<=0) return null;
    return last>y?1:0;
  }));
  const ret=avg(eligible.map(r=>{
    const y=nullableNum(r.yesterday_price),last=nullableNum(r.last_price);
    if(y===null||last===null||y<=0) return null;
    return (last/y-1)*100;
  }));
  const avgFast=avg(eligible.map(r=>nullableNum(r.fast_score)));
  const avgRisk=avg(eligible.map(r=>nullableNum(r.risk_score)));
  const ar=adv??0.5,rr=ret??0,risk=avgRisk??0;
  const regime:IntegratedMarketV410["market_regime_v1"]=
    risk>=58?"پرنوسان":ar>=0.58&&rr>0?"صعودی":ar<=0.42&&rr<0?"نزولی":"خنثی";
  // Exact SQL nuance: score adjustment checks directional breadth before avg-risk,
  // while the regime label checks avg-risk first.
  const adjustment=ar>=0.58&&rr>0?4:ar<=0.42&&rr<0?-4:risk>=58?-2:0;
  return {
    adv_ratio:adv,
    avg_return_pct:ret,
    avg_fast:avgFast,
    avg_risk:avgRisk,
    market_regime_v1:regime,
    market_breadth_pct_v1:round1(ar*100),
    regime_adjustment_v1:adjustment,
  };
}

function legacyFinalDecision(decision:unknown):string{
  switch(str(decision)){
    case "خرید قوی": return "ورود قوی";
    case "ورود اولیه": return "ورود اولیه";
    case "تحت نظر": return "تحت نظر";
    default: return "عدم ورود";
  }
}

export function applyIntegratedRowV410(row:Row,market:IntegratedMarketV410,nowSeconds:number):Row{
  const integrated=integratedEligibleV410(row);
  const flow=flowScoreV410(row),trend=trendScoreV410(row),momentum=momentumScoreV410(row);
  const quality=dataQualityScoreV410(row,nowSeconds);
  const fast=coalesceNum(row.fast_score,0),cont=coalesceNum(row.continuation_score,0),risk=coalesceNum(row.risk_score,0);
  const integratedScore=clip(.38*fast+.22*cont+.18*flow+.14*trend+.08*momentum-.28*risk+market.regime_adjustment_v1);
  const positive=(fast>=58?1:0)+(cont>=58?1:0)+(flow>=58?1:0)+(trend>=58?1:0)+(momentum>=58?1:0);
  const negative=(fast<=42?1:0)+(cont<=42?1:0)+(flow<=42?1:0)+(trend<=42?1:0)+(momentum<=42?1:0);
  const direction=Math.max(positive,negative)*20;
  const confidence=clip(.45*direction+.35*quality+.20*Math.min(100,Math.abs(integratedScore-50)*2));
  const invalid=coalesceNum(row.last_price,0)<=0||coalesceNum(row.volume,0)<=0;
  const cancel=coalesceNum(row.cancellation_ratio,0),absorption=coalesceNum(row.absorption,0);
  const riskGate=invalid||risk>=72||(cancel>=90&&absorption<12);
  const t=updatedAtMs(row),stale10=t!==null&&t<nowSeconds*1000-10*60_000;
  let gateReason:string|null=null;
  if(invalid) gateReason="قیمت یا حجم معتبر برای تصمیم وجود ندارد";
  else if(risk>=72) gateReason="ریسک فیک/برگشت از حد مجاز بالاتر است";
  else if(cancel>=90&&absorption<12) gateReason="لغو سفارش بالا و جذب عرضه ضعیف است";
  else if(stale10) gateReason="داده لحظه‌ای این نماد به اندازه کافی تازه نیست";

  let finalDecision:string;
  const legacyDecision=(row.legacy_decision_v401 ?? row.decision);
  if(!integrated) finalDecision=legacyFinalDecision(legacyDecision);
  else if(riskGate) finalDecision="عدم ورود";
  else if(stale10) finalDecision="صبر برای تأیید";
  else if(integratedScore>=67&&positive>=4&&risk<=45&&confidence>=65) finalDecision="ورود قوی";
  else if(integratedScore>=57&&positive>=3&&risk<=55&&confidence>=55) finalDecision="ورود اولیه";
  else if(integratedScore>=47||(positive>=2&&negative>=2)) finalDecision="صبر برای تأیید";
  else if(integratedScore>=39) finalDecision="تحت نظر";
  else finalDecision="عدم ورود";

  return {
    ...row,
    integrated_eligible:integrated,
    flow_score_v1:flow,
    trend_score_v1:trend,
    momentum_score_v1:momentum,
    data_quality_score_v1:quality,
    market_regime_v1:market.market_regime_v1,
    market_breadth_pct_v1:market.market_breadth_pct_v1,
    integrated_score_v1:integratedScore,
    positive_experts_v1:positive,
    negative_experts_v1:negative,
    direction_agreement_v1:direction,
    confidence_score_v1:confidence,
    risk_gate_v1:riskGate,
    gate_reason_v1:gateReason,
    final_decision_v1:finalDecision,
    confidence_label_v1:!integrated?"مدل عمومی؛ موتور اختصاصی این نوع ابزار هنوز فعال نشده است":confidence>=72?"بالا":confidence>=55?"متوسط":"پایین",
    engine_scope_v1:integrated?"موتور یکپارچه سهام/حق‌تقدم":"مدل عمومی نسخه قبل",
    engine_version_v1:"4.1.0-phase1",
  };
}

export function applyIntegratedBatchV410(rows:Row[],nowSeconds:number):Row[]{
  if(!Number.isSafeInteger(nowSeconds)||nowSeconds<=0) throw new Error("now_seconds_invalid");
  const market=integratedMarketV410(rows,nowSeconds);
  return rows.map(row=>applyIntegratedRowV410(row,market,nowSeconds));
}
