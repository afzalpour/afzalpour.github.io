'use strict';
const expansionCfg=window.STOCK_HUNTER_CONFIG||{};
const expansion$=id=>document.getElementById(id);
const expansionFa=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—'};
function expansionHeaders(){const k=expansionCfg.SUPABASE_PUBLISHABLE_KEY||expansionCfg.publishableKey||'';return{apikey:k,Accept:'application/json'}}
function expansionGate(v){return v?'<span class="ok-text">پاس</span>':'<span class="warn-text">رد</span>'}
function expansionReasonLabel(v){const m={NO_ACTIVATION_REVIEW_BOUND:'Activation Review متصل نیست',NOT_IN_ACTIVE_CANARY:'Canary فعال نیست',NO_FURTHER_CANARY_STEP:'مرحله Canary دیگری تعریف نشده',TELEMETRY_NOT_READY_FOR_STAGE:'Telemetry برای این Stage آماده نیست',STAGE_OBSERVATION_WINDOW_NOT_MET:'حداقل زمان مشاهده Stage کامل نشده',BOTH_MODES_REQUIRED:'هر دو Mode باید نمونه Routed داشته باشند',INSUFFICIENT_ROUTED_PAIRS:'Pair Routed کافی نیست',INSUFFICIENT_ROUTED_SYMBOL_DIVERSITY:'تنوع نماد Routed کافی نیست',INSUFFICIENT_ROUTED_TIME_BUCKETS:'بازه زمانی Routed کافی نیست',TELEMETRY_STALE:'Telemetry کهنه است',STAGE_RECOMMENDATION_NOT_PASS:'Recommendation این Stage پاس نیست',READY_FOR_MANUAL_EXPANSION_AUTHORIZATION:'آماده Authorization دستی برای مرحله بعد'};return m[String(v||'')]||String(v||'—')}
function ensureCanaryExpansionSurfaceV417(){
  if(expansion$('expansionState'))return;
  const anchor=expansion$('telemetryMetricsBody')?.closest('.section');
  if(!anchor)return;
  anchor.insertAdjacentHTML('beforebegin',`<section class="section note"><strong>Canary Expansion Gate:</strong> افزایش ترافیک Challenger فقط مرحله‌ای <strong>۵٪ → ۱۰٪ → ۲۵٪ → ۵۰٪</strong> است. هر Stage باید حداقل زمان مشاهده، Pair Routed کافی در هر دو Mode، تنوع نماد و بازه زمانی، Telemetry تازه و Recommendation برابر PASS داشته باشد. <strong>Recovery Gate نیز باید PASS باشد.</strong> <strong>Auto-Expand خاموش است</strong> و هر افزایش نیازمند Authorization داخلی یک‌باره و Recheck دقیق قبل از Advance است.</section>
<section class="cards"><article class="card"><span>Expansion State</span><b id="expansionState" class="ok-text" style="font-size:15px">BLOCKED</b><small id="expansionReason">—</small></article><article class="card"><span>Current → Next</span><b id="expansionStage">۰٪ → —</b></article><article class="card"><span>Stage Time / Required</span><b id="expansionElapsed">۰ / — دقیقه</b></article><article class="card"><span>Routed Pairs / Required</span><b id="expansionPairs">۰ / —</b></article><article class="card"><span>Routed Symbols / Required</span><b id="expansionSymbols">۰ / —</b></article><article class="card"><span>Routed Buckets / Required</span><b id="expansionBuckets">۰ / —</b></article><article class="card"><span>Telemetry Freshness</span><b id="expansionFreshness" class="warn-text">WAITING</b><small id="expansionLastTelemetry">—</small></article><article class="card"><span>Stage Recommendation</span><b id="expansionRecommendation">—</b></article><article class="card"><span>Automatic Expansion</span><b id="expansionAuto" class="ok-text" style="font-size:14px">OFF — MANUAL ONLY</b></article></section>
<section class="section note"><b>Expansion Gates — Stage Scoped</b><p id="expansionGates" class="muted">Review رد · Active Canary رد · Next Step رد · Capture رد · Duration رد · Modes رد · Routed Pairs رد · Symbols رد · Buckets رد · Freshness رد · Recommendation رد · Recovery رد</p></section>
<section class="section"><h2>Frozen Canary Expansion Policy</h2><div class="table-wrap"><table class="table compact"><thead><tr><th>From</th><th>To</th><th>Min Stage</th><th>Pairs / Mode</th><th>Symbols / Mode</th><th>Buckets / Mode</th><th>Max Age</th><th>Required Rec.</th><th>Auto</th></tr></thead><tbody id="expansionPolicyBody"><tr><td colspan="9" class="muted">در حال دریافت Expansion Policy…</td></tr></tbody></table></div></section>`);
}
function renderCanaryExpansionV417(rows,ready,recovery={}){
  ensureCanaryExpansionSurfaceV417();
  const recoveryReady=!!recovery.recovery_ready;
  const effectiveReady=!!ready.expansion_ready&&recoveryReady;
  const state=expansion$('expansionState');
  if(state){state.textContent=effectiveReady?'READY FOR MANUAL EXPANSION':'BLOCKED';state.className=effectiveReady?'warn-text':'ok-text'}
  expansion$('expansionReason').textContent=ready.expansion_ready&&!recoveryReady?`Recovery Gate: ${recovery.recovery_reason||'BLOCKED'}`:expansionReasonLabel(ready.expansion_reason);
  expansion$('expansionStage').textContent=`${expansionFa(ready.current_percent)}% → ${ready.target_percent==null?'—':expansionFa(ready.target_percent)+'%'}`;
  expansion$('expansionElapsed').textContent=`${expansionFa(ready.stage_elapsed_minutes)} / ${expansionFa(ready.min_stage_minutes)} دقیقه`;
  expansion$('expansionPairs').textContent=`${expansionFa(ready.min_routed_pairs_observed)} / ${expansionFa(ready.min_routed_pairs_per_mode)}`;
  expansion$('expansionSymbols').textContent=`${expansionFa(ready.min_routed_symbols_observed)} / ${expansionFa(ready.min_routed_symbols_per_mode)}`;
  expansion$('expansionBuckets').textContent=`${expansionFa(ready.min_routed_buckets_observed)} / ${expansionFa(ready.min_routed_buckets_per_mode)}`;
  expansion$('expansionFreshness').textContent=ready.pass_freshness?'FRESH':'WAITING / STALE';
  expansion$('expansionFreshness').className=ready.pass_freshness?'ok-text':'warn-text';
  expansion$('expansionRecommendation').textContent=ready.stage_recommendation||'—';
  expansion$('expansionRecommendation').className=ready.pass_recommendation?'ok-text':'warn-text';
  expansion$('expansionAuto').textContent=ready.auto_expand?'ON':'OFF — MANUAL ONLY';
  expansion$('expansionAuto').className=ready.auto_expand?'warn-text':'ok-text';
  expansion$('expansionLastTelemetry').textContent=ready.telemetry_last_success_at?new Date(ready.telemetry_last_success_at).toLocaleString('fa-IR'):'—';
  expansion$('expansionGates').innerHTML=`Review ${expansionGate(ready.pass_review_bound)} · Active Canary ${expansionGate(ready.pass_active_canary)} · Next Step ${expansionGate(ready.pass_has_next_step)} · Capture ${expansionGate(ready.pass_capture_ready)} · Duration ${expansionGate(ready.pass_stage_duration)} · Modes ${expansionGate(ready.pass_modes)} · Routed Pairs ${expansionGate(ready.pass_routed_pairs)} · Symbols ${expansionGate(ready.pass_routed_symbols)} · Buckets ${expansionGate(ready.pass_routed_buckets)} · Freshness ${expansionGate(ready.pass_freshness)} · Recommendation ${expansionGate(ready.pass_recommendation)} · Recovery ${expansionGate(recoveryReady)}`;
  const body=expansion$('expansionPolicyBody');
  if(body)body.innerHTML=(rows||[]).map(p=>`<tr><td>${expansionFa(p.from_percent)}%</td><td>${expansionFa(p.to_percent)}%</td><td>${expansionFa(p.min_stage_minutes)} دقیقه</td><td>${expansionFa(p.min_routed_pairs_per_mode)}</td><td>${expansionFa(p.min_routed_symbols_per_mode)}</td><td>${expansionFa(p.min_routed_buckets_per_mode)}</td><td>${expansionFa(p.max_telemetry_age_minutes)} دقیقه</td><td>${p.required_recommendation||'PASS'}</td><td>${p.auto_expand?'ON':'OFF'}</td></tr>`).join('')||'<tr><td colspan="9" class="muted">Expansion Policy در دسترس نیست.</td></tr>';
}
async function loadCanaryExpansionV417(){
  ensureCanaryExpansionSurfaceV417();
  const base=String(expansionCfg.SUPABASE_URL||expansionCfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base)return;
  try{
    const [pr,rr,cr]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_canary_expansion_policy_v417?select=*&policy_id=eq.default&order=from_percent.asc`,{headers:expansionHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_canary_expansion_readiness_v417?select=*&limit=1`,{headers:expansionHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_canary_recovery_gate_v417?select=*&limit=1`,{headers:expansionHeaders(),cache:'no-store'})
    ]);
    if(!pr.ok||!rr.ok||!cr.ok)throw new Error('Canary Expansion / Recovery API unavailable');
    renderCanaryExpansionV417(await pr.json(),(await rr.json())[0]||{},(await cr.json())[0]||{});
  }catch(e){
    const state=expansion$('expansionState');if(state){state.textContent='READ ERROR';state.className='warn-text'}
    const reason=expansion$('expansionReason');if(reason)reason.textContent=e?.message||'خطا در دریافت Expansion Gate';
  }
}
function loadCanaryHoldRollbackSurfaceV417(){
  if(document.querySelector('script[data-canary-hold-rollback-v417]'))return;
  const s=document.createElement('script');s.src='canary-hold-rollback-v417.js?v=4.1.7';s.defer=true;s.dataset.canaryHoldRollbackV417='1';document.body.appendChild(s);
}
ensureCanaryExpansionSurfaceV417();
const expansionRefresh=expansion$('refreshRoll');if(expansionRefresh)expansionRefresh.addEventListener('click',loadCanaryExpansionV417);
loadCanaryExpansionV417();
loadCanaryHoldRollbackSurfaceV417();
