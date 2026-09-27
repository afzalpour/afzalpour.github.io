'use strict';

// Versioned runtime router for Stock Hunter 4.1.7.
// Safety rules:
// - Champion 4.1.6 is the default and failure fallback.
// - Challenger requires an activation review tied to a frozen promotion proposal.
// - Browser only performs SELECTs; no activation/rollback RPC is exposed here.
// - Canary assignment is deterministic per symbol + Tehran trade date.

const RUNTIME_ROUTER_V417_VERSION='4.1.7-runtime-router-v1';
const runtimeCoreV417=window.StockHunterRuntimeCoreV417;
const baselineApplyHuntRuntimeV417=applyHuntV416;

const runtimeStateV417={
  loaded:false,
  lastError:'',
  runtimeRoutingEnabled:false,
  routingMode:'CHAMPION_ONLY',
  trafficPercent:0,
  killSwitch:true,
  stateVersion:0,
  activationReviewId:null,
  proposalId:null,
  challengerVersion:'4.1.7-proposed',
  challengerAvailable:false,
  weights:{},
  datasetFingerprint:'',
  updatedAt:''
};
window.STOCK_HUNTER_RUNTIME_V417=runtimeStateV417;
window.applyHuntBaselineV416=baselineApplyHuntRuntimeV417;

function runtimeHeadersV417(){
  const k=cfg.SUPABASE_PUBLISHABLE_KEY||cfg.publishableKey||'';
  return {apikey:k,Accept:'application/json'};
}
function runtimeBaseV417(){return String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');}
function tehranTradeDateKeyV417(){
  try{
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }catch{return new Date().toISOString().slice(0,10);}
}
function runtimeRouteKeyV417(x){return `${tehranTradeDateKeyV417()}|${String(x?.id||x?.symbol||'unknown')}`;}
function runtimeSafeChampionV417(reason=''){
  runtimeStateV417.challengerAvailable=false;
  runtimeStateV417.weights={};
  runtimeStateV417.proposalId=null;
  runtimeStateV417.datasetFingerprint='';
  runtimeStateV417.lastError=String(reason||'');
}
function candidateRowsFromProposalV417(proposal,weights){
  const assessment=Array.isArray(proposal?.assessment_snapshot)?proposal.assessment_snapshot:[];
  const out={};
  for(const a of assessment){
    const mode=String(a?.hunt_mode||'');
    const id=String(a?.candidate_id||'');
    if(!['reversal','acceleration'].includes(mode)||!id)continue;
    if(a?.promotion_gate_pass!==true||a?.candidate_is_baseline===true)continue;
    const raw=weights.find(w=>String(w.candidate_id)===id&&String(w.hunt_mode)===mode);
    const normW=runtimeCoreV417?.normalizeWeights(raw);
    if(!normW)continue;
    out[mode]={...normW,candidateId:id};
  }
  return out;
}
function runtimeConfigValidV417(policy,status,review,proposal,weights){
  if(!runtimeCoreV417)return {ok:false,reason:'runtime core unavailable'};
  if(!policy||!status)return {ok:false,reason:'activation policy/status unavailable'};
  if(!review||!proposal)return {ok:false,reason:'activation review/proposal unavailable'};
  if(Number(status.activation_review_id)!==Number(review.review_id))return {ok:false,reason:'activation review mismatch'};
  if(Number(review.proposal_id)!==Number(proposal.proposal_id))return {ok:false,reason:'promotion proposal mismatch'};
  if(String(proposal.target_engine_version||'')!==String(policy.challenger_engine_version||''))return {ok:false,reason:'challenger version mismatch'};
  if(String(status.challenger_engine_version||'')!==String(policy.challenger_engine_version||''))return {ok:false,reason:'activation status version mismatch'};
  const parsed=candidateRowsFromProposalV417(proposal,weights);
  if(!parsed.reversal||!parsed.acceleration)return {ok:false,reason:'frozen challenger weights incomplete'};
  return {ok:true,weights:parsed};
}
async function fetchJsonV417(url){
  const r=await fetch(url,{headers:runtimeHeadersV417(),cache:'no-store'});
  if(!r.ok)throw new Error(`runtime config HTTP ${r.status}`);
  return r.json();
}
async function refreshRuntimeRouterV417(){
  const base=runtimeBaseV417();
  if(!base){runtimeSafeChampionV417('Supabase URL unavailable');return runtimeStateV417;}
  try{
    const [polRows,statusRows]=await Promise.all([
      fetchJsonV417(`${base}/rest/v1/stock_hunter_activation_policy_v417?select=*&policy_id=eq.default&limit=1`),
      fetchJsonV417(`${base}/rest/v1/stock_hunter_activation_status_v417?select=*&status_id=eq.default&limit=1`)
    ]);
    const policy=polRows[0]||null,status=statusRows[0]||null;
    if(!policy||!status)throw new Error('activation policy/status missing');
    runtimeStateV417.runtimeRoutingEnabled=policy.runtime_routing_enabled===true;
    runtimeStateV417.routingMode=String(status.routing_mode||'CHAMPION_ONLY');
    runtimeStateV417.trafficPercent=Number(status.challenger_traffic_percent||0);
    runtimeStateV417.killSwitch=status.kill_switch_engaged!==false;
    runtimeStateV417.stateVersion=Number(status.state_version||0);
    runtimeStateV417.activationReviewId=status.activation_review_id==null?null:Number(status.activation_review_id);
    runtimeStateV417.challengerVersion=String(policy.challenger_engine_version||status.challenger_engine_version||'4.1.7-proposed');
    runtimeStateV417.updatedAt=String(status.updated_at||'');

    // No active review means there is intentionally no executable challenger config yet.
    if(!runtimeStateV417.activationReviewId){runtimeSafeChampionV417('no activation review bound to runtime');runtimeStateV417.loaded=true;return runtimeStateV417;}

    const reviewRows=await fetchJsonV417(`${base}/rest/v1/stock_hunter_activation_reviews_v417?select=review_id,proposal_id,review_fingerprint&review_id=eq.${encodeURIComponent(runtimeStateV417.activationReviewId)}&limit=1`);
    const review=reviewRows[0]||null;
    if(!review)throw new Error('activation review not found');
    const proposalRows=await fetchJsonV417(`${base}/rest/v1/stock_hunter_promotion_proposals_v416?select=proposal_id,source_engine_version,target_engine_version,proposal_status,dataset_fingerprint,assessment_snapshot,created_at&proposal_id=eq.${encodeURIComponent(review.proposal_id)}&limit=1`);
    const proposal=proposalRows[0]||null;
    const weights=await fetchJsonV417(`${base}/rest/v1/stock_hunter_candidate_weights_v416?select=candidate_id,hunt_mode,order_pressure,impulse,feasibility,flow_volume,market_context,continuation_modifier_min,continuation_modifier_max,is_baseline`);
    const valid=runtimeConfigValidV417(policy,status,review,proposal,weights);
    if(!valid.ok){runtimeSafeChampionV417(valid.reason);runtimeStateV417.loaded=true;return runtimeStateV417;}
    runtimeStateV417.weights=valid.weights;
    runtimeStateV417.proposalId=Number(proposal.proposal_id);
    runtimeStateV417.datasetFingerprint=String(proposal.dataset_fingerprint||'');
    runtimeStateV417.challengerAvailable=true;
    runtimeStateV417.lastError='';
    runtimeStateV417.loaded=true;
    return runtimeStateV417;
  }catch(e){
    runtimeSafeChampionV417(e?.message||'runtime config error');
    runtimeStateV417.loaded=true;
    return runtimeStateV417;
  }
}

function shouldRouteChallengerV417(x){
  if(!runtimeCoreV417)return false;
  if(!['reversal','acceleration'].includes(String(x?.huntModeV416||'')))return false;
  return runtimeCoreV417.shouldUseChallenger({
    routingMode:runtimeStateV417.routingMode,
    trafficPercent:runtimeStateV417.trafficPercent,
    killSwitch:runtimeStateV417.killSwitch,
    runtimeRoutingEnabled:runtimeStateV417.runtimeRoutingEnabled,
    challengerAvailable:runtimeStateV417.challengerAvailable,
    key:runtimeRouteKeyV417(x)
  });
}
function applyChallengerScoreV417(x){
  const mode=String(x?.huntModeV416||'');
  const w=runtimeStateV417.weights[mode];
  if(!w)return x;
  x.baselineTodayOpportunityV417=Number(x.todayOpportunityV416||0);
  x.baselineHuntScoreV417=Number(x.huntScoreV416||0);
  x.baselineHuntStatusV417=String(x.hunt||'عادی');
  const scored=runtimeCoreV417.scoreFromComponents({
    orderPressure:x.orderPressureV416,
    impulse:x.impulseV416,
    feasibility:x.feasibilityV416,
    flowVolume:x.flowVolumeV416,
    marketContext:x.marketContextV416,
    continuation:x.continuation12V416,
    risk:x.risk,
    cancel:x.cancel
  },w);
  if(!scored)return x;
  x.todayOpportunityV416=scored.todayOpportunity;
  x.huntScoreV416=scored.huntScore;
  x.hunt=huntStatusV416(x.huntScoreV416,x.todayOpportunityV416,Number(x.risk||0),x.huntEvidenceV416,x.huntGate);
  x.huntDecisionV416=huntDecisionV416(x);
  x.runtimeEngineVersionV417=runtimeStateV417.challengerVersion;
  x.runtimeCandidateIdV417=w.candidateId;
  x.runtimeRouteV417='challenger';
  x.runtimeStateVersionV417=runtimeStateV417.stateVersion;
  return x;
}
function applyRuntimeHuntV417(x){
  const y=baselineApplyHuntRuntimeV417(x);
  if(!y||y.analyzed===false)return y;
  y.runtimeEngineVersionV417='4.1.6-hunt-v2';
  y.runtimeCandidateIdV417='baseline';
  y.runtimeRouteV417='champion';
  y.runtimeStateVersionV417=runtimeStateV417.stateVersion;
  return shouldRouteChallengerV417(y)?applyChallengerScoreV417(y):y;
}

applyHuntV416=applyRuntimeHuntV417;
window.applyHuntRuntimeV417=applyRuntimeHuntV417;
window.refreshRuntimeRouterV417=refreshRuntimeRouterV417;

async function refreshRuntimeAndRenderV417(){
  const before=`${runtimeStateV417.stateVersion}|${runtimeStateV417.routingMode}|${runtimeStateV417.trafficPercent}|${runtimeStateV417.challengerAvailable}|${runtimeStateV417.proposalId}`;
  await refreshRuntimeRouterV417();
  const after=`${runtimeStateV417.stateVersion}|${runtimeStateV417.routingMode}|${runtimeStateV417.trafficPercent}|${runtimeStateV417.challengerAvailable}|${runtimeStateV417.proposalId}`;
  if(before!==after&&Array.isArray(rows)&&rows.length&&typeof render==='function'){
    rows.forEach(applyRuntimeHuntV417);
    render();
  }
}

refreshRuntimeAndRenderV417();
setInterval(refreshRuntimeAndRenderV417,60000);
