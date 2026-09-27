'use strict';
const recoveryCfg=window.STOCK_HUNTER_CONFIG||{};
const recovery$=id=>document.getElementById(id);
const recoveryFa=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—'};
function recoveryHeaders(){const k=recoveryCfg.SUPABASE_PUBLISHABLE_KEY||recoveryCfg.publishableKey||'';return{apikey:k,Accept:'application/json'}}
function recoveryStateLabel(v){const m={IDLE:'IDLE',MONITORING:'MONITORING',RECOVERY_REQUIRED:'RECOVERY REQUIRED',RECOVERED:'RECOVERED',ROLLBACK_REQUIRED:'ROLLBACK REQUIRED',REVIEW_RETIRED:'REVIEW RETIRED'};return m[String(v||'')]||String(v||'—')}
function recoveryReasonLabel(v){const m={IDLE_NO_ACTIVE_CANARY:'Canary فعالی وجود ندارد',REVIEW_RETIRED_AFTER_ROLLBACK:'این Review پس از Rollback بازنشسته شده است',RECOVERY_STATE_NOT_SYNCED_TO_STAGE:'Recovery State هنوز با Stage همگام نشده',ROLLBACK_REQUIRED_LATCHED:'Rollback Recommendation لَچ شده و با Capture سالم باز نمی‌شود',HOLD_ROLLBACK_GATE_NOT_PASS:'Hold / Rollback Gate هنوز PASS نیست',COOLING_OFF:'Cooling-off هنوز کامل نشده',HEALTHY_CAPTURE_STREAK_NOT_MET:'Captureهای PASS متوالی کافی نیست',RECOVERED_PASS:'Recovery کامل و Gate آماده است',READY_NO_RECOVERY_INCIDENT:'Incident بازی برای Recovery وجود ندارد',RECOVERY_BLOCKED:'Recovery مسدود است'};return m[String(v||'')]||String(v||'—')}
function ensureCanaryRecoverySurfaceV417(){
  if(recovery$('canaryRecoveryState'))return;
  const anchor=recovery$('holdRollbackPolicy')?.closest('.section')||recovery$('holdRollbackState')?.closest('.cards')||recovery$('expansionPolicyBody')?.closest('.section');
  if(!anchor)return;
  anchor.insertAdjacentHTML('afterend',`<section class="section note"><strong>Canary Recovery / Re-entry Gate:</strong> بعد از HOLD، Expansion فقط پس از Cooling-off فریز‌شده و چند Capture سالم متوالی دوباره مجاز می‌شود. <strong>ROLLBACK_RECOMMENDED قابل Auto-Recovery نیست</strong>. پس از Rollback/Kill، همان Activation Review بازنشسته است و Re-entry به Review و Authorization جدید نیاز دارد. <strong>Auto-Recover خاموش است.</strong></section>
<section class="cards"><article class="card"><span>Recovery State</span><b id="canaryRecoveryState" class="ok-text" style="font-size:15px">IDLE</b><small id="canaryRecoveryReason">—</small></article><article class="card"><span>Hold / Rollback Gate</span><b id="canaryRecoveryHold">—</b></article><article class="card"><span>Cooldown</span><b id="canaryRecoveryCooldown">—</b></article><article class="card"><span>Healthy PASS Streak</span><b id="canaryRecoveryStreak">۰ / ۳</b></article><article class="card"><span>Max Capture Gap</span><b id="canaryRecoveryGap">۱۰ دقیقه</b></article><article class="card"><span>Same Review Re-entry</span><b id="canaryRecoveryReentry" class="ok-text">CLEAR</b></article><article class="card"><span>Recovery Gate</span><b id="canaryRecoveryReady" class="warn-text">BLOCKED</b></article><article class="card"><span>Automatic Recovery</span><b id="canaryRecoveryAuto" class="ok-text" style="font-size:14px">OFF — MANUAL ONLY</b></article></section>
<section class="section note"><b>Recovery Contract — Frozen</b><p id="canaryRecoveryPolicy">—</p><p id="canaryRecoveryDetail" class="muted">Recovery فقط Expansion را دوباره واجد شرایط می‌کند؛ هیچ Transition یا Kill Switch خودکاری از Browser انجام نمی‌شود.</p></section>`);
}
function renderCanaryRecoveryV417(p,g){
  ensureCanaryRecoverySurfaceV417();
  const state=recovery$('canaryRecoveryState');if(state){state.textContent=recoveryStateLabel(g.recovery_state);state.className=['MONITORING','RECOVERED','IDLE'].includes(String(g.recovery_state||''))?'ok-text':'warn-text'}
  recovery$('canaryRecoveryReason').textContent=recoveryReasonLabel(g.recovery_reason);
  recovery$('canaryRecoveryHold').textContent=g.hold_rollback_gate_state||'—';
  recovery$('canaryRecoveryHold').className=g.hold_rollback_gate_state==='PASS'||g.hold_rollback_gate_state==='IDLE_NO_ACTIVE_CANARY'?'ok-text':'warn-text';
  recovery$('canaryRecoveryCooldown').textContent=g.incident_started_at?`${g.cooldown_elapsed?'کامل':'باقی‌مانده '+recoveryFa(g.cooldown_remaining_minutes)+' دقیقه'} / ${recoveryFa(g.cooldown_minutes||p.cooldown_minutes)} دقیقه`:`${recoveryFa(p.cooldown_minutes)} دقیقه`;
  recovery$('canaryRecoveryStreak').textContent=`${recoveryFa(g.healthy_capture_streak)} / ${recoveryFa(g.required_consecutive_pass_captures||p.required_consecutive_pass_captures)}`;
  recovery$('canaryRecoveryGap').textContent=`${recoveryFa(g.max_healthy_capture_gap_minutes||p.max_healthy_capture_gap_minutes)} دقیقه`;
  recovery$('canaryRecoveryReentry').textContent=g.same_review_reentry_blocked?'BLOCKED — NEW REVIEW REQUIRED':'CLEAR';
  recovery$('canaryRecoveryReentry').className=g.same_review_reentry_blocked?'warn-text':'ok-text';
  recovery$('canaryRecoveryReady').textContent=g.recovery_ready?'PASS':'BLOCKED';
  recovery$('canaryRecoveryReady').className=g.recovery_ready?'ok-text':'warn-text';
  recovery$('canaryRecoveryAuto').textContent=g.auto_recover?'ON':'OFF — MANUAL ONLY';
  recovery$('canaryRecoveryAuto').className=g.auto_recover?'warn-text':'ok-text';
  recovery$('canaryRecoveryPolicy').textContent=`Cooling-off=${recoveryFa(p.cooldown_minutes)} دقیقه؛ Capture PASS متوالی=${recoveryFa(p.required_consecutive_pass_captures)}؛ حداکثر فاصله Capture سالم=${recoveryFa(p.max_healthy_capture_gap_minutes)} دقیقه؛ Same-review after rollback=${p.block_same_review_after_rollback?'BLOCK':'ALLOW'}؛ Auto-recover=${p.auto_recover?'ON':'OFF'}.`;
  recovery$('canaryRecoveryDetail').textContent=g.recovery_state==='ROLLBACK_REQUIRED'?'Rollback Recommendation لَچ شده است؛ Recovery با Capture جدید مجاز نیست و تصمیم عملیاتی باید دستی بماند.':g.same_review_reentry_blocked?'این Activation Review بازنشسته است؛ Reset فقط Champion baseline را برمی‌گرداند و برای Canary جدید Review/Authorization تازه لازم است.':g.recovery_state==='RECOVERY_REQUIRED'?'تا تکمیل Cooling-off و Streak سالم، Expansion Authorization و Advance مسدود می‌مانند.':'این Surface فقط خواندنی است؛ هیچ RPC یا عملیات نوشتنی عمومی ندارد.';
}
async function loadCanaryRecoveryV417(){
  ensureCanaryRecoverySurfaceV417();
  const base=String(recoveryCfg.SUPABASE_URL||recoveryCfg.supabaseUrl||'').replace(/\/$/,'');if(!base)return;
  try{
    const [pr,gr]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_canary_recovery_policy_v417?select=*&policy_id=eq.default&limit=1`,{headers:recoveryHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_canary_recovery_gate_v417?select=*&limit=1`,{headers:recoveryHeaders(),cache:'no-store'})
    ]);
    if(!pr.ok||!gr.ok)throw new Error('Canary Recovery API unavailable');
    renderCanaryRecoveryV417((await pr.json())[0]||{},(await gr.json())[0]||{});
  }catch(e){const s=recovery$('canaryRecoveryState');if(s){s.textContent='READ ERROR';s.className='warn-text'}const d=recovery$('canaryRecoveryDetail');if(d)d.textContent=e?.message||'خطا در دریافت Recovery Gate';}
}
ensureCanaryRecoverySurfaceV417();
const recoveryRefresh=recovery$('refreshRoll');if(recoveryRefresh)recoveryRefresh.addEventListener('click',loadCanaryRecoveryV417);
loadCanaryRecoveryV417();
