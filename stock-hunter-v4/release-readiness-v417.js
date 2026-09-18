'use strict';
const releaseGateCfg=window.STOCK_HUNTER_CONFIG||{};
const releaseGate$=id=>document.getElementById(id);
const releaseGateFa=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—'};
function releaseGateHeaders(){const k=releaseGateCfg.SUPABASE_PUBLISHABLE_KEY||releaseGateCfg.publishableKey||'';return{apikey:k,Accept:'application/json'}}
function releaseGateLabel(v){
  const m={
    NO_ACTIVATION_REVIEW_BOUND:'Activation Review متصل نیست',NOT_IN_ACTIVE_CANARY:'Canary فعال نیست',FULL_ACTIVATION_REQUIRES_EXACT_50_PERCENT:'Full Activation فقط از ۵۰٪ مجاز است',FULL_OBSERVATION_WINDOW_NOT_MET:'پنجره مشاهده ۵۰٪ کامل نشده',TELEMETRY_NOT_BOUND_TO_REVIEW:'Telemetry به Review جاری متصل نیست',TELEMETRY_STALE:'Telemetry کهنه است',STAGE_METRICS_NOT_BOUND_TO_CURRENT_STATE:'Metrics به State جاری متصل نیست',BOTH_MODES_REQUIRED:'هر دو Mode لازم است',INSUFFICIENT_ROUTED_PAIRS:'Pair کافی نیست',INSUFFICIENT_ROUTED_SYMBOLS:'تنوع نماد کافی نیست',INSUFFICIENT_ROUTED_BUCKETS:'Time bucket کافی نیست',CURRENT_MODE_RECOMMENDATIONS_MISSING:'Recommendation جاری ناقص است',RECOMMENDATION_NOT_PASS_FOR_BOTH_MODES:'هر دو Mode باید PASS باشند',HOLD_OR_ROLLBACK_GUARD_NOT_CLEAR:'Hold/Rollback Guard پاک نیست',RECOVERY_STATE_NOT_CLEAR:'Recovery پاک نیست',READY_FOR_SEPARATE_FULL_ACTIVATION_AUTHORIZATION:'آماده Authorization مستقل ۱۰۰٪',
    NOT_AT_FULL_ACTIVATION:'هنوز ۱۰۰٪ فعال نشده',ROLLBACK_TARGET_NOT_PRESERVED:'Rollback target قبلی حفظ نشده',POST_ACTIVATION_TELEMETRY_NOT_READY:'Telemetry پس از Activation آماده نیست',POST_ACTIVATION_TELEMETRY_STALE:'Telemetry پس از Activation کهنه است',NO_POST_ACTIVATION_PAIRED_DATA_FOR_CURRENT_STATE:'Pair مربوط به State جدید هنوز ثبت نشده',STABILITY_TRADE_DATES_NOT_MET:'روز معاملاتی دوره پایداری کافی نیست',POST_ACTIVATION_PAIRS_NOT_MET:'Pair دوره پایداری کافی نیست',POST_ACTIVATION_SYMBOLS_NOT_MET:'تنوع نماد دوره پایداری کافی نیست',POST_ACTIVATION_BUCKETS_NOT_MET:'Time bucket دوره پایداری کافی نیست',POST_ACTIVATION_RECOMMENDATIONS_MISSING:'Recommendation پس از Activation ناقص است',POST_ACTIVATION_RECOMMENDATION_NOT_PASS:'Recommendation پس از Activation PASS نیست',UNRESOLVED_RECOVERY_OR_ROLLBACK_INCIDENT:'Recovery/Rollback حل‌نشده وجود دارد',AUTOMATIC_ROLLBACK_MUST_REMAIN_OFF:'Auto-Rollback باید خاموش بماند',AUTOMATIC_FINALIZATION_MUST_REMAIN_OFF:'Auto-Finalize باید خاموش بماند',READY_FOR_MANUAL_VERSION_PROMOTION_REVIEW:'آماده بررسی دستی Version Promotion'
  };
  return m[String(v||'')]||String(v||'—');
}
function ensureReleaseGateSurface(){
  if(releaseGate$('fullActivationGate417'))return;
  const main=document.querySelector('main.roll-shell')||document.querySelector('main');
  if(!main)return;
  main.insertAdjacentHTML('beforeend',`
<section id="fullActivationGate417" class="section note"><strong>Full Activation Gate — 50% → 100%:</strong> این بخش فقط Read-only است. Full Activation نیازمند Gate مستقل، Authorization یک‌بارمصرف و Transition داخلی است؛ هیچ Auto-Activate یا RPC عمومی در این صفحه وجود ندارد.</section>
<section class="cards">
<article class="card"><span>Full Activation State</span><b id="fullGateState" class="ok-text">BLOCKED</b><small id="fullGateReason">—</small></article>
<article class="card"><span>Current / Required Stage</span><b id="fullGateStage">۰٪ / ۵۰٪</b></article>
<article class="card"><span>Observation Minutes</span><b id="fullGateMinutes">۰ / ۱۲۰</b></article>
<article class="card"><span>Min Routed Pairs / Mode</span><b id="fullGatePairs">۰ / ۲۵۰</b></article>
<article class="card"><span>Min Symbols / Mode</span><b id="fullGateSymbols">۰ / ۵۰</b></article>
<article class="card"><span>Min Buckets / Mode</span><b id="fullGateBuckets">۰ / ۵</b></article>
<article class="card"><span>PASS Recommendations</span><b id="fullGateRecommendations">۰ / ۲</b></article>
<article class="card"><span>Auto Activate</span><b id="fullGateAuto" class="ok-text">OFF — MANUAL ONLY</b></article>
</section>
<section class="section note"><strong>Post-Activation Stabilization:</strong> پس از ۱۰۰٪، Champion قبلی 4.1.6 به‌عنوان Rollback Target حفظ می‌شود و paired monitoring فقط روی State Version جدید ادامه دارد. Auto-Rollback و Auto-Finalize باید خاموش بمانند.</section>
<section class="cards">
<article class="card"><span>Stabilization State</span><b id="postGateState" class="ok-text">BLOCKED</b><small id="postGateReason">—</small></article>
<article class="card"><span>Trade Dates / Required</span><b id="postGateDays">۰ / ۵</b></article>
<article class="card"><span>Min Pairs / Mode</span><b id="postGatePairs">۰ / ۵۰۰</b></article>
<article class="card"><span>Min Symbols / Mode</span><b id="postGateSymbols">۰ / ۷۵</b></article>
<article class="card"><span>Min Buckets / Mode</span><b id="postGateBuckets">۰ / ۸</b></article>
<article class="card"><span>PASS Recommendations</span><b id="postGateRecommendations">۰ / ۲</b></article>
<article class="card"><span>Rollback Target</span><b id="postGateRollback" style="font-size:15px">4.1.6-hunt-v2</b></article>
<article class="card"><span>Auto Rollback / Finalize</span><b id="postGateAuto" class="ok-text" style="font-size:14px">OFF / OFF</b></article>
</section>`);
}
function renderFullActivationGate(r){
  const ready=r?.full_activation_ready===true;
  releaseGate$('fullGateState').textContent=ready?'READY FOR MANUAL AUTHORIZATION':'BLOCKED';
  releaseGate$('fullGateState').className=ready?'warn-text':'ok-text';
  releaseGate$('fullGateReason').textContent=releaseGateLabel(r?.full_activation_reason);
  releaseGate$('fullGateStage').textContent=`${releaseGateFa(r?.current_percent)}٪ / ${releaseGateFa(r?.required_from_percent||50)}٪`;
  releaseGate$('fullGateMinutes').textContent=`${releaseGateFa(r?.stage_elapsed_minutes)} / ${releaseGateFa(r?.min_stage_minutes||120)}`;
  releaseGate$('fullGatePairs').textContent=`${releaseGateFa(r?.min_routed_pairs_observed)} / ${releaseGateFa(r?.min_routed_pairs_per_mode||250)}`;
  releaseGate$('fullGateSymbols').textContent=`${releaseGateFa(r?.min_routed_symbols_observed)} / ${releaseGateFa(r?.min_routed_symbols_per_mode||50)}`;
  releaseGate$('fullGateBuckets').textContent=`${releaseGateFa(r?.min_routed_buckets_observed)} / ${releaseGateFa(r?.min_routed_buckets_per_mode||5)}`;
  releaseGate$('fullGateRecommendations').textContent=`${releaseGateFa(r?.pass_recommendation_mode_count)} / ۲`;
  releaseGate$('fullGateAuto').textContent=r?.auto_activate?'ON — UNSAFE':'OFF — MANUAL ONLY';
  releaseGate$('fullGateAuto').className=r?.auto_activate?'warn-text':'ok-text';
}
function renderPostActivationGate(r){
  const ready=r?.stabilization_ready_for_version_promotion===true;
  releaseGate$('postGateState').textContent=ready?'READY FOR VERSION PROMOTION REVIEW':'BLOCKED';
  releaseGate$('postGateState').className=ready?'warn-text':'ok-text';
  releaseGate$('postGateReason').textContent=releaseGateLabel(r?.stabilization_reason);
  releaseGate$('postGateDays').textContent=`${releaseGateFa(r?.min_trade_dates_observed)} / ${releaseGateFa(r?.min_stability_trade_dates||5)}`;
  releaseGate$('postGatePairs').textContent=`${releaseGateFa(r?.min_pairs_observed)} / ${releaseGateFa(r?.min_pairs_per_mode||500)}`;
  releaseGate$('postGateSymbols').textContent=`${releaseGateFa(r?.min_symbols_observed)} / ${releaseGateFa(r?.min_symbols_per_mode||75)}`;
  releaseGate$('postGateBuckets').textContent=`${releaseGateFa(r?.min_buckets_observed)} / ${releaseGateFa(r?.min_buckets_per_mode||8)}`;
  releaseGate$('postGateRecommendations').textContent=`${releaseGateFa(r?.pass_recommendation_mode_count)} / ۲`;
  releaseGate$('postGateRollback').textContent=r?.rollback_target_engine_version||'—';
  releaseGate$('postGateAuto').textContent=`${r?.auto_rollback?'ON':'OFF'} / ${r?.auto_finalize?'ON':'OFF'}`;
  releaseGate$('postGateAuto').className=r?.auto_rollback||r?.auto_finalize?'warn-text':'ok-text';
}
async function loadReleaseReadinessV417(){
  ensureReleaseGateSurface();
  const base=String(releaseGateCfg.SUPABASE_URL||releaseGateCfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base)return;
  try{
    const [fr,pr]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_full_activation_readiness_v417?select=*&limit=1`,{headers:releaseGateHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_post_activation_monitor_v417?select=*&limit=1`,{headers:releaseGateHeaders(),cache:'no-store'})
    ]);
    if(!fr.ok||!pr.ok)throw new Error('Full/Post Activation readiness API unavailable');
    renderFullActivationGate((await fr.json())[0]||{});
    renderPostActivationGate((await pr.json())[0]||{});
  }catch(e){
    const a=releaseGate$('fullGateReason'),b=releaseGate$('postGateReason');
    if(a)a.textContent=e?.message||'خطا در دریافت Full Activation Gate';
    if(b)b.textContent=e?.message||'خطا در دریافت Post-Activation Gate';
  }
}
ensureReleaseGateSurface();
const releaseGateRefresh=releaseGate$('refreshRoll');if(releaseGateRefresh)releaseGateRefresh.addEventListener('click',loadReleaseReadinessV417);
loadReleaseReadinessV417();
