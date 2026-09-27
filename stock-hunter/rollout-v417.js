'use strict';
const rollCfg=window.STOCK_HUNTER_CONFIG||{};
const roll$=id=>document.getElementById(id);
const rollFa=(v,d=2)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—'};
const rollSigned=(v,d=3)=>{const n=Number(v);return Number.isFinite(n)?`${n>=0?'+':''}${rollFa(n,d)}`:'—'};
const rollPctRatio=v=>{const n=Number(v);return Number.isFinite(n)?`${rollFa(n*100,1)}٪`:'—'};
function rollHeaders(extra={}){const k=rollCfg.SUPABASE_PUBLISHABLE_KEY||rollCfg.publishableKey||'';return{apikey:k,Accept:'application/json',...extra}}
function rollMode(m){return m==='reversal'?'Reversal':m==='acceleration'?'Acceleration':String(m||'—')}
function rollGate(v){return v?'<span class="ok-text">پاس</span>':'<span class="warn-text">رد</span>'}
function rollRow(r){return `<tr><td>${rollMode(r.hunt_mode)}</td><td>${rollFa(r.fresh_trade_dates,0)}</td><td>${rollFa(r.challenger_selected_count,0)}</td><td>${rollFa(r.champion_selected_count,0)}</td><td>${rollPctRatio(r.selected_coverage_ratio)}</td><td>${rollSigned(r.utility_lift)}</td><td>${rollSigned(r.return_lift_3d_pct)}</td><td>${rollSigned(r.mfe_lift_3d_pct)}</td><td>${rollSigned(r.mae_delta_3d_pct)}</td><td>${rollSigned(r.positive_rate_delta_pp,1)}</td><td>${rollGate(r.pass_fresh_dates)}</td><td>${rollGate(r.pass_min_samples)}</td><td>${rollGate(r.pass_coverage)}</td><td>${rollGate(r.pass_utility)}</td><td>${rollGate(r.pass_return)}</td><td>${rollGate(r.pass_mae_guard)}</td><td>${rollGate(r.pass_positive_rate_guard)}</td><td>${rollGate(r.rollout_gate_pass)}</td></tr>`}
function rollReviewState(ready,review){
  const state=roll$('reviewState');
  if(review?.review_id){state.textContent='RECORDED';state.className='warn-text';}
  else if(ready?.can_record_review){state.textContent='READY TO RECORD';state.className='warn-text';}
  else{state.textContent='LOCKED';state.className='ok-text';}
  roll$('reviewId').textContent=review?.review_id?`#${rollFa(review.review_id,0)}`:'—';
  roll$('reviewTime').textContent=review?.reviewed_at?new Date(review.reviewed_at).toLocaleString('fa-IR'):'—';
  roll$('reviewActivated').textContent=review?.production_activated?'بله':'خیر';
  roll$('reviewActivated').className=review?.production_activated?'warn-text':'ok-text';
  roll$('reviewFingerprint').textContent=review?.review_fingerprint||'—';
  roll$('reviewReason').textContent=ready?.review_reason||'—';
  roll$('reviewNote').textContent=review?.review_note||'هنوز Review ثبت نشده است.';
}
function rollActivationState(policy,status){
  const runtime=roll$('activationRuntime');
  runtime.textContent=policy?.runtime_routing_enabled?'CONNECTED':'BLOCKED / NOT CONNECTED';
  runtime.className=policy?.runtime_routing_enabled?'warn-text':'ok-text';
  const mode=String(status?.routing_mode||'CHAMPION_ONLY');
  roll$('activationMode').textContent=mode;
  roll$('activationMode').className=mode==='CHAMPION_ONLY'||mode==='ROLLED_BACK'?'ok-text':'warn-text';
  roll$('activationTraffic').textContent=`${rollFa(status?.challenger_traffic_percent||0,0)}٪`;
  roll$('activationKill').textContent=status?.kill_switch_engaged?'ENGAGED':'DISENGAGED';
  roll$('activationKill').className=status?.kill_switch_engaged?'ok-text':'warn-text';
  roll$('activationStateVersion').textContent=rollFa(status?.state_version||1,0);
  const steps=Array.isArray(policy?.canary_steps)?policy.canary_steps:[];
  roll$('activationSteps').textContent=steps.length?`${steps.map(x=>rollFa(x,0)).join(' ← ')} ← ۱۰۰٪`:'—';
  roll$('activationAutomation').textContent=`${policy?.auto_activate?'فعال':'خاموش'} / ${policy?.auto_expand?'فعال':'خاموش'}`;
  roll$('activationAutomation').className=policy?.auto_activate||policy?.auto_expand?'warn-text':'ok-text';
  roll$('activationTransition').textContent=status?.last_transition||'—';
  roll$('activationTransitionTime').textContent=status?.last_transition_at?new Date(status.last_transition_at).toLocaleString('fa-IR'):'—';
}
function rollTelemetryLabel(v){
  const m={IDLE_NO_CHALLENGER:'IDLE — NO CHALLENGER',INSUFFICIENT_DATA:'WARMUP / INSUFFICIENT DATA',PASS:'PASS',HOLD_EXPANSION:'HOLD EXPANSION',BLOCK_CANARY:'BLOCK CANARY',KILL_SWITCH_RECOMMENDED:'KILL SWITCH RECOMMENDED'};
  return m[String(v||'')]||String(v||'—');
}
function rollTelemetryMetricRow(r){return `<tr><td>${rollMode(r.hunt_mode)}</td><td>${rollFa(r.pair_count,0)}</td><td>${rollFa(r.symbol_count,0)}</td><td>${rollFa(r.bucket_count,0)}</td><td>${rollPctRatio(r.status_disagreement_ratio)}</td><td>${rollPctRatio(r.strong_disagreement_ratio)}</td><td>${rollPctRatio(r.extreme_status_jump_ratio)}</td><td>${rollSigned(r.avg_score_delta)}</td><td>${rollFa(r.avg_abs_score_delta,2)}</td><td>${rollFa(r.p95_abs_score_delta,2)}</td><td>${rollFa(r.max_abs_score_delta,2)}</td></tr>`}
function rollDivergenceRow(r){return `<tr><td>${r.observed_at?new Date(r.observed_at).toLocaleTimeString('fa-IR'):'—'}</td><td>${r.symbol||r.symbol_id||'—'}</td><td>${rollMode(r.hunt_mode)}</td><td>${r.champion_hunt_state||'—'}</td><td>${r.challenger_hunt_state||'—'}</td><td>${rollSigned(r.hunt_score_delta,2)}</td><td>${rollSigned(r.today_opportunity_delta,2)}</td><td>${rollFa(r.risk_score,1)}</td><td>${rollFa(r.evidence_count,0)} / ${rollFa(r.dynamic_evidence_count,0)}</td></tr>`}
function rollTelemetryState(policy,health,monitor,metrics,divergences){
  const rec=String(monitor?.recommendation||health?.config_state||'IDLE_NO_CHALLENGER');
  const recEl=roll$('telemetryRecommendation');
  recEl.textContent=rollTelemetryLabel(rec);
  recEl.className=['PASS','IDLE_NO_CHALLENGER'].includes(rec)?'ok-text':rec==='INSUFFICIENT_DATA'?'muted':'warn-text';
  roll$('telemetryConfig').textContent=health?.config_state||'—';
  roll$('telemetryPairs').textContent=`${rollFa(monitor?.min_pairs_observed||0,0)} / ${rollFa(policy?.min_pairs_per_mode||0,0)}`;
  roll$('telemetryTotal').textContent=rollFa(monitor?.total_pairs||0,0);
  roll$('telemetryStatusDisagree').textContent=rollPctRatio(monitor?.max_status_disagreement_ratio||0);
  roll$('telemetryStrongDisagree').textContent=rollPctRatio(monitor?.max_strong_disagreement_ratio||0);
  roll$('telemetryP95Score').textContent=rollFa(monitor?.max_p95_abs_score_delta||0,2);
  roll$('telemetryJump').textContent=rollPctRatio(monitor?.max_extreme_status_jump_ratio||0);
  roll$('telemetryLastSuccess').textContent=health?.last_success_at?new Date(health.last_success_at).toLocaleString('fa-IR'):'—';
  roll$('telemetryAutoAction').textContent=monitor?.automatic_action_taken?'YES':'NO — MANUAL ONLY';
  roll$('telemetryAutoAction').className=monitor?.automatic_action_taken?'warn-text':'ok-text';
  roll$('telemetryPolicy').textContent=`حداقل ${rollFa(policy?.min_pairs_per_mode||0,0)} Pair برای هر Mode؛ HOLD اگر Status disagreement ≥ ${rollPctRatio(policy?.hold_status_disagreement_ratio)}, Strong disagreement ≥ ${rollPctRatio(policy?.hold_strong_disagreement_ratio)}, P95 |ΔScore| ≥ ${rollFa(policy?.hold_p95_abs_score_delta,1)} یا Extreme jump ≥ ${rollPctRatio(policy?.hold_extreme_status_jump_ratio)}. Severe guard: به‌ترتیب ${rollPctRatio(policy?.severe_status_disagreement_ratio)}، ${rollPctRatio(policy?.severe_strong_disagreement_ratio)}، ${rollFa(policy?.severe_p95_abs_score_delta,1)} و ${rollPctRatio(policy?.severe_extreme_status_jump_ratio)}. Auto-kill=${policy?.auto_kill?'ON':'OFF'}.`;
  roll$('telemetryMetricsBody').innerHTML=metrics.length?metrics.map(rollTelemetryMetricRow).join(''):'<tr><td colspan="11" class="muted">هنوز Pair معتبر پس از Activation Review ثبت نشده است.</td></tr>';
  roll$('telemetryDivergenceBody').innerHTML=divergences.length?divergences.map(rollDivergenceRow).join(''):'<tr><td colspan="9" class="muted">Divergence ثبت‌شده‌ای وجود ندارد.</td></tr>';
}
async function loadRolloutV417(){
  const base=String(rollCfg.SUPABASE_URL||rollCfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base){roll$('rollStatus').textContent='تنظیمات اتصال موجود نیست.';return}
  roll$('rollStatus').textContent='در حال دریافت Forward Shadow / Runtime / Canary Telemetry…';
  try{
    const [pr,rr,mr,sr,ar,avr,apr,asr,tpr,thr,tmr,tdr]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_rollout_policy_v417?select=*&policy_id=eq.default&limit=1`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_rollout_readiness_v417?select=*&limit=1`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_champion_challenger_metrics_v417?select=*&order=hunt_mode.asc`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_challenger_shadow_samples_v417?select=sample_id&limit=1`,{headers:rollHeaders({Prefer:'count=exact'}),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_activation_review_readiness_v417?select=*&limit=1`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_activation_reviews_v417?select=review_id,reviewed_at,review_status,review_note,review_fingerprint,production_activated&order=review_id.desc&limit=1`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_activation_policy_v417?select=policy_id,protocol_version,champion_engine_version,challenger_engine_version,runtime_routing_enabled,initial_canary_percent,canary_steps,require_pre_full_canary_percent,auto_activate,auto_expand&policy_id=eq.default&limit=1`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_activation_status_v417?select=*&status_id=eq.default&limit=1`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_canary_telemetry_policy_v417?select=*&policy_id=eq.default&limit=1`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_canary_telemetry_health_v417?select=*&health_id=eq.default&limit=1`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_canary_monitor_v417?select=*&limit=1`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_canary_telemetry_v417?select=trade_date,observed_at,symbol_id,symbol,hunt_mode,champion_hunt_state,challenger_hunt_state,hunt_score_delta,today_opportunity_delta,risk_score,evidence_count,dynamic_evidence_count&status_disagreement=eq.true&order=observed_at.desc&limit=50`,{headers:rollHeaders(),cache:'no-store'})
    ]);
    if(!pr.ok||!rr.ok||!mr.ok||!sr.ok||!ar.ok||!avr.ok||!apr.ok||!asr.ok||!tpr.ok||!thr.ok||!tmr.ok||!tdr.ok)throw new Error('دریافت Forward Shadow / Activation / Telemetry ناموفق بود');
    const pol=(await pr.json())[0]||{},ready=(await rr.json())[0]||{},rows=await mr.json(),reviewReady=(await ar.json())[0]||{},review=(await avr.json())[0]||null,activationPolicy=(await apr.json())[0]||{},activationStatus=(await asr.json())[0]||{},telemetryPolicy=(await tpr.json())[0]||{},telemetryHealth=(await thr.json())[0]||{},telemetryMonitor=(await tmr.json())[0]||{};
    const divergences=await tdr.json();
    const telemetryMetricsResponse=await fetch(`${base}/rest/v1/stock_hunter_canary_telemetry_metrics_v417?select=*&order=hunt_mode.asc`,{headers:rollHeaders(),cache:'no-store'});
    if(!telemetryMetricsResponse.ok)throw new Error('دریافت Telemetry Metrics ناموفق بود');
    const telemetryMetrics=await telemetryMetricsResponse.json();
    const range=sr.headers.get('content-range')||'',shadowCount=Number((range.split('/')[1]||'0'))||0;
    roll$('rollProposal').textContent=ready.proposal_id?`#${rollFa(ready.proposal_id,0)}`:'هنوز ثبت نشده';
    roll$('rollTarget').textContent=ready.target_engine_version||pol.challenger_engine_version||'4.1.7-proposed';
    roll$('rollFreshDays').textContent=`${rollFa(ready.min_fresh_trade_dates_observed||0,0)} / ${rollFa(pol.min_fresh_trade_dates||0,0)}`;
    roll$('rollSelectedMin').textContent=`${rollFa(ready.min_challenger_selected_observed||0,0)} / ${rollFa(pol.min_selected_per_mode||0,0)}`;
    roll$('rollModeGate').textContent=`${rollFa(ready.passed_modes||0,0)} / ${rollFa(ready.mode_count||0,0)}`;
    roll$('rollReady').textContent=ready.activation_review_ready?'READY FOR MANUAL REVIEW':'SHADOW / LOCKED';
    roll$('rollReady').className=ready.activation_review_ready?'warn-text':'ok-text';
    roll$('rollReason').textContent=ready.readiness_reason||'—';
    roll$('rollAuto').textContent=pol.auto_activate?'فعال':'خاموش';
    roll$('rollAuto').className=pol.auto_activate?'warn-text':'ok-text';
    roll$('rollShadowCount').textContent=rollFa(shadowCount,0);
    roll$('rollChampion').textContent=pol.champion_engine_version||'4.1.6-hunt-v2';
    roll$('rollChallenger').textContent=pol.challenger_engine_version||'4.1.7-proposed';
    roll$('rollPolicy').textContent=`حداقل ${rollFa(pol.min_fresh_trade_dates,0)} روز معاملاتی تازه مشترک، حداقل ${rollFa(pol.min_selected_per_mode,0)} انتخاب برای هر مدل در هر Mode، پوشش Challenger حداقل ${rollPctRatio(pol.min_coverage_ratio)}، ΔUtility حداقل ${rollSigned(pol.min_utility_lift)}، ΔReturn 3D حداقل ${rollSigned(pol.min_return_lift_3d_pct)} واحد درصد، افت مجاز MAE حداکثر ${rollFa(pol.max_mae_deterioration_3d_pct,2)} واحد درصد و افت مجاز Positive-rate حداکثر ${rollFa(pol.max_positive_rate_deterioration_pp,1)} واحد درصد. هر دو Mode باید پاس شوند.`;
    roll$('rollBody').innerHTML=rows.length?rows.map(rollRow).join(''):'<tr><td colspan="18" class="muted">تا قبل از Promotion Proposal و بلوغ Forward Shadow، نتیجه‌ای وجود ندارد.</td></tr>';
    rollReviewState(reviewReady,review);
    rollActivationState(activationPolicy,activationStatus);
    rollTelemetryState(telemetryPolicy,telemetryHealth,telemetryMonitor,telemetryMetrics,divergences);
    roll$('rollStatus').textContent=`آخرین بررسی: ${new Date().toLocaleTimeString('fa-IR')}`;
  }catch(e){roll$('rollStatus').textContent=e.message||'خطا در دریافت Forward Shadow / Telemetry'}
}
roll$('refreshRoll').onclick=loadRolloutV417;
loadRolloutV417();
