'use strict';
const holdCfg=window.STOCK_HUNTER_CONFIG||{};
const hold$=id=>document.getElementById(id);
const holdFa=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—'};
function holdHeaders(){const k=holdCfg.SUPABASE_PUBLISHABLE_KEY||holdCfg.publishableKey||'';return{apikey:k,Accept:'application/json'}}
function holdStateLabel(v){const m={IDLE_NO_ACTIVE_CANARY:'IDLE — NO ACTIVE CANARY',OBSERVING:'OBSERVING',PASS:'PASS',HOLD:'HOLD',ROLLBACK_RECOMMENDED:'ROLLBACK RECOMMENDED'};return m[String(v||'')]||String(v||'—')}
function holdStateClass(v){return ['PASS','IDLE_NO_ACTIVE_CANARY'].includes(String(v||''))?'ok-text':String(v||'')==='OBSERVING'?'muted':'warn-text'}
function recoveryStateLabel(v){const m={IDLE:'IDLE',MONITORING:'MONITORING',RECOVERY_REQUIRED:'RECOVERY REQUIRED',RECOVERED:'RECOVERED',ROLLBACK_REQUIRED:'ROLLBACK REQUIRED',REVIEW_RETIRED:'REVIEW RETIRED'};return m[String(v||'')]||String(v||'—')}
function recoveryReasonLabel(v){const m={IDLE_NO_ACTIVE_CANARY:'بدون Canary فعال',REVIEW_RETIRED_AFTER_ROLLBACK:'Review پس از Rollback بازنشسته شده است',RECOVERY_STATE_NOT_SYNCED_TO_STAGE:'Recovery State با Stage همگام نیست',ROLLBACK_REQUIRED_LATCHED:'Rollback Required قفل شده است',HOLD_ROLLBACK_GATE_NOT_PASS:'Hold/Rollback Gate هنوز PASS نیست',COOLING_OFF:'Cooling-off هنوز کامل نشده',HEALTHY_CAPTURE_STREAK_NOT_MET:'تعداد Capture سالم متوالی کافی نیست',RECOVERED_PASS:'Recovery کامل و Gate PASS است',READY_NO_RECOVERY_INCIDENT:'Incident بازیابی فعالی وجود ندارد',RECOVERY_BLOCKED:'Recovery مسدود است'};return m[String(v||'')]||String(v||'—')}
function ensureCanaryHoldRollbackSurfaceV417(){
  if(hold$('holdRollbackState'))return;
  const anchor=hold$('expansionPolicyBody')?.closest('.section')||hold$('telemetryMetricsBody')?.closest('.section');
  if(!anchor)return;
  anchor.insertAdjacentHTML('afterend',`<section class="section note"><strong>Canary Hold / Rollback Gate:</strong> این Gate فقط کنترل عملیاتی است. Telemetry بدون Capture سالم از <strong>۲۰ دقیقه</strong> Expansion را Hold می‌کند؛ اگر Active Canary تا <strong>۴۰ دقیقه</strong> بدون Telemetry سالم بماند، Rollback توصیه می‌شود. Severe divergence فقط پس از حداقل Evidence فریز‌شده می‌تواند به Rollback Recommendation ارتقا یابد. <strong>Auto-Rollback و Auto-Kill خاموش‌اند</strong> و هیچ مسیر نوشتنی عمومی در این صفحه وجود ندارد.</section>
<section class="cards"><article class="card"><span>Hold / Rollback State</span><b id="holdRollbackState" class="ok-text" style="font-size:15px">IDLE</b><small id="holdRollbackGuards">—</small></article><article class="card"><span>Challenger Traffic</span><b id="holdRollbackTraffic">۰٪</b></article><article class="card"><span>Telemetry Age / Hold</span><b id="holdRollbackAge">— / ۲۰ دقیقه</b></article><article class="card"><span>Rollback Stale Threshold</span><b id="holdRollbackStale">۴۰ دقیقه</b></article><article class="card"><span>Pairs / Rollback Evidence</span><b id="holdRollbackPairs">۰ / ۳۰</b></article><article class="card"><span>Divergence Guard</span><b id="holdRollbackDivergence">CLEAR</b></article><article class="card"><span>Expansion</span><b id="holdRollbackExpansion" class="ok-text">BLOCKED</b></article><article class="card"><span>Automatic Action</span><b id="holdRollbackAuto" class="ok-text" style="font-size:14px">OFF — MANUAL ONLY</b></article></section>
<section class="section note"><b>Rollback Safety Contract — Frozen</b><p id="holdRollbackPolicy">—</p><p id="holdRollbackDetail" class="muted">Rollback داخلی با State Version و Audit Event انجام می‌شود؛ Browser فقط Gate را مشاهده می‌کند.</p></section>
<section class="section note"><strong>Canary Recovery / Re-entry Gate:</strong> پس از HOLD، Expansion فقط زمانی دوباره مجاز می‌شود که Cooling-off کامل شده باشد و Captureهای سالم متوالی با Gate برابر PASS ثبت شوند. پس از Rollback/Kill، Activation Review قبلی <strong>Retired</strong> می‌شود و برای Re-entry باید Review و Authorization تازه صادر شود. <strong>Auto-Recovery خاموش است.</strong></section>
<section class="cards"><article class="card"><span>Recovery State</span><b id="recoveryState" class="ok-text" style="font-size:15px">IDLE</b><small id="recoveryReason">—</small></article><article class="card"><span>Recovery Ready</span><b id="recoveryReady" class="ok-text">BLOCKED</b></article><article class="card"><span>Cooldown</span><b id="recoveryCooldown">۰ / ۱۵ دقیقه</b></article><article class="card"><span>Healthy Capture Streak</span><b id="recoveryStreak">۰ / ۳</b></article><article class="card"><span>Max Healthy Gap</span><b id="recoveryGap">۱۰ دقیقه</b></article><article class="card"><span>Retired Review</span><b id="recoveryRetiredReview">—</b></article><article class="card"><span>Same-review Re-entry</span><b id="recoveryReentry" class="ok-text">BLOCKED AFTER ROLLBACK</b></article><article class="card"><span>Automatic Recovery</span><b id="recoveryAuto" class="ok-text" style="font-size:14px">OFF — EVIDENCE GATED</b></article></section>
<section class="section note"><b>Recovery Contract — Frozen</b><p id="recoveryPolicy">—</p><p id="recoveryDetail" class="muted">Recovery فقط Expansion را دوباره واجد شرایط می‌کند؛ هیچ Transition خودکاری انجام نمی‌شود.</p></section>`);
}
function renderCanaryHoldRollbackV417(p,g){
  ensureCanaryHoldRollbackSurfaceV417();
  const state=hold$('holdRollbackState');
  if(state){state.textContent=holdStateLabel(g.gate_state);state.className=holdStateClass(g.gate_state)}
  const guards=Array.isArray(g.triggered_guards)?g.triggered_guards:[];
  hold$('holdRollbackGuards').textContent=guards.length?guards.join(' · '):'بدون Guard فعال';
  hold$('holdRollbackTraffic').textContent=`${holdFa(g.challenger_traffic_percent)}٪`;
  hold$('holdRollbackAge').textContent=`${g.telemetry_age_minutes==null?'—':holdFa(g.telemetry_age_minutes)} / ${holdFa(g.hold_stale_after_minutes||p.hold_stale_after_minutes)} دقیقه`;
  hold$('holdRollbackStale').textContent=`${holdFa(g.rollback_stale_after_minutes||p.rollback_stale_after_minutes)} دقیقه`;
  hold$('holdRollbackPairs').textContent=`${holdFa(g.min_routed_pairs_observed)} / ${holdFa(g.min_pairs_per_mode_for_rollback||p.min_pairs_per_mode_for_rollback)}`;
  const div=g.severe_breach?'SEVERE':g.hold_breach?'HOLD BREACH':'CLEAR';
  hold$('holdRollbackDivergence').textContent=div;
  hold$('holdRollbackDivergence').className=div==='CLEAR'?'ok-text':'warn-text';
  hold$('holdRollbackExpansion').textContent=g.expansion_blocked?'BLOCKED':'PASS';
  hold$('holdRollbackExpansion').className=g.expansion_blocked?'warn-text':'ok-text';
  hold$('holdRollbackAuto').textContent=g.auto_rollback?'ON':'OFF — MANUAL ONLY';
  hold$('holdRollbackAuto').className=g.auto_rollback?'warn-text':'ok-text';
  hold$('holdRollbackPolicy').textContent=`Hold stale=${holdFa(p.hold_stale_after_minutes)} دقیقه؛ Rollback stale=${holdFa(p.rollback_stale_after_minutes)} دقیقه؛ حداقل ${holdFa(p.min_pairs_per_mode_for_rollback)} Pair در هر Mode برای Severe rollback؛ Hold on capture error=${p.hold_on_capture_error?'ON':'OFF'}؛ Rollback on severe=${p.rollback_on_severe_breach?'ON':'OFF'}؛ Auto-rollback=${p.auto_rollback?'ON':'OFF'}.`;
  hold$('holdRollbackDetail').textContent=g.rollback_recommended?'Rollback توصیه شده است؛ اقدام فقط از Control Plane داخلی و با بررسی State Version مجاز است.':g.gate_state==='HOLD'?'Expansion متوقف است؛ Canary باید تا رفع Guard در همین Stage بماند.':g.gate_state==='OBSERVING'?'Stage در حال جمع‌آوری Evidence است و Expansion مجاز نیست.':'Rollback خودکار انجام نمی‌شود؛ Kill Switch و Rollback فقط عملیات داخلی صریح هستند.';
}
function renderCanaryRecoveryV417(p,g){
  ensureCanaryHoldRollbackSurfaceV417();
  const state=hold$('recoveryState');
  if(state){state.textContent=recoveryStateLabel(g.recovery_state);state.className=['IDLE','MONITORING','RECOVERED'].includes(String(g.recovery_state||''))?'ok-text':'warn-text'}
  hold$('recoveryReason').textContent=recoveryReasonLabel(g.recovery_reason);
  hold$('recoveryReady').textContent=g.recovery_ready?'READY':'BLOCKED';
  hold$('recoveryReady').className=g.recovery_ready?'warn-text':'ok-text';
  const elapsed=Math.max(0,Number(p.cooldown_minutes||0)-Number(g.cooldown_remaining_minutes||0));
  hold$('recoveryCooldown').textContent=`${holdFa(elapsed)} / ${holdFa(p.cooldown_minutes)} دقیقه`;
  hold$('recoveryStreak').textContent=`${holdFa(g.healthy_capture_streak)} / ${holdFa(p.required_consecutive_pass_captures)}`;
  hold$('recoveryGap').textContent=`${holdFa(p.max_healthy_capture_gap_minutes)} دقیقه`;
  hold$('recoveryRetiredReview').textContent=g.last_retired_review_id?`#${holdFa(g.last_retired_review_id)}`:'—';
  hold$('recoveryReentry').textContent=g.same_review_reentry_blocked?'BLOCKED — NEW REVIEW REQUIRED':p.block_same_review_after_rollback?'BLOCKED AFTER ROLLBACK':'NOT ENFORCED';
  hold$('recoveryReentry').className=g.same_review_reentry_blocked?'warn-text':'ok-text';
  hold$('recoveryAuto').textContent=p.auto_recover?'ON':'OFF — EVIDENCE GATED';
  hold$('recoveryAuto').className=p.auto_recover?'warn-text':'ok-text';
  hold$('recoveryPolicy').textContent=`Cooling-off=${holdFa(p.cooldown_minutes)} دقیقه؛ Capture سالم متوالی لازم=${holdFa(p.required_consecutive_pass_captures)}؛ حداکثر فاصله Capture سالم=${holdFa(p.max_healthy_capture_gap_minutes)} دقیقه؛ Block same review after rollback=${p.block_same_review_after_rollback?'ON':'OFF'}؛ Auto-recover=${p.auto_recover?'ON':'OFF'}.`;
  hold$('recoveryDetail').textContent=g.same_review_reentry_blocked?'این Review بازنشسته شده و Re-entry با همان Review مجاز نیست؛ Review/Authorization جدید لازم است.':g.recovery_state==='RECOVERY_REQUIRED'?(g.cooldown_elapsed?'Cooling-off کامل است؛ برای Recovery باید Healthy Capture Streak کامل شود.':`Cooling-off فعال است؛ حدود ${holdFa(g.cooldown_remaining_minutes)} دقیقه باقی مانده است.`):g.recovery_state==='ROLLBACK_REQUIRED'?'Recovery دیگر مجاز نیست؛ Rollback دستی باید از Control Plane داخلی انجام شود.':g.recovery_state==='RECOVERED'?'Recovery Evidence کامل شده است؛ Expansion همچنان فقط با Authorization دستی یک‌باره مجاز می‌شود.':'Recovery Gate در حالت پایش است و Transition خودکاری انجام نمی‌دهد.';
}
async function loadCanaryHoldRollbackV417(){
  ensureCanaryHoldRollbackSurfaceV417();
  const base=String(holdCfg.SUPABASE_URL||holdCfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base)return;
  try{
    const [pr,gr,rpr,rgr]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_canary_hold_rollback_policy_v417?select=*&policy_id=eq.default&limit=1`,{headers:holdHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_canary_hold_rollback_gate_v417?select=*&limit=1`,{headers:holdHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_canary_recovery_policy_v417?select=*&policy_id=eq.default&limit=1`,{headers:holdHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_canary_recovery_gate_v417?select=*&limit=1`,{headers:holdHeaders(),cache:'no-store'})
    ]);
    if(!pr.ok||!gr.ok||!rpr.ok||!rgr.ok)throw new Error('Canary Hold/Rollback/Recovery API unavailable');
    renderCanaryHoldRollbackV417((await pr.json())[0]||{},(await gr.json())[0]||{});
    renderCanaryRecoveryV417((await rpr.json())[0]||{},(await rgr.json())[0]||{});
  }catch(e){
    const state=hold$('holdRollbackState');if(state){state.textContent='READ ERROR';state.className='warn-text'}
    const recovery=hold$('recoveryState');if(recovery){recovery.textContent='READ ERROR';recovery.className='warn-text'}
    const detail=hold$('holdRollbackDetail');if(detail)detail.textContent=e?.message||'خطا در دریافت Hold/Rollback/Recovery Gate';
    const recoveryDetail=hold$('recoveryDetail');if(recoveryDetail)recoveryDetail.textContent=e?.message||'خطا در دریافت Recovery Gate';
  }
}
ensureCanaryHoldRollbackSurfaceV417();
const holdRefresh=hold$('refreshRoll');if(holdRefresh)holdRefresh.addEventListener('click',loadCanaryHoldRollbackV417);
loadCanaryHoldRollbackV417();