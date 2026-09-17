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
async function loadRolloutV417(){
  const base=String(rollCfg.SUPABASE_URL||rollCfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base){roll$('rollStatus').textContent='تنظیمات اتصال موجود نیست.';return}
  roll$('rollStatus').textContent='در حال دریافت Champion / Challenger Forward Shadow…';
  try{
    const [pr,rr,mr,sr,ar,avr]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_rollout_policy_v417?select=*&policy_id=eq.default&limit=1`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_rollout_readiness_v417?select=*&limit=1`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_champion_challenger_metrics_v417?select=*&order=hunt_mode.asc`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_challenger_shadow_samples_v417?select=sample_id&limit=1`,{headers:rollHeaders({Prefer:'count=exact'}),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_activation_review_readiness_v417?select=*&limit=1`,{headers:rollHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_activation_reviews_v417?select=review_id,reviewed_at,review_status,review_note,review_fingerprint,production_activated&order=review_id.desc&limit=1`,{headers:rollHeaders(),cache:'no-store'})
    ]);
    if(!pr.ok||!rr.ok||!mr.ok||!sr.ok||!ar.ok||!avr.ok)throw new Error('دریافت Forward Shadow / Activation Review ناموفق بود');
    const pol=(await pr.json())[0]||{},ready=(await rr.json())[0]||{},rows=await mr.json(),reviewReady=(await ar.json())[0]||{},review=(await avr.json())[0]||null;
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
    roll$('rollStatus').textContent=`آخرین بررسی: ${new Date().toLocaleTimeString('fa-IR')}`;
  }catch(e){roll$('rollStatus').textContent=e.message||'خطا در دریافت Forward Shadow'}
}
roll$('refreshRoll').onclick=loadRolloutV417;
loadRolloutV417();
