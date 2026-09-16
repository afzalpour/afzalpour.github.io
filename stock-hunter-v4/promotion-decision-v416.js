'use strict';
const promoCfg=window.STOCK_HUNTER_CONFIG||{};
const promo$=id=>document.getElementById(id);
const promoFa=(v,d=2)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—'};
const promoSigned=(v,d=3)=>{const n=Number(v);return Number.isFinite(n)?`${n>=0?'+':''}${promoFa(n,d)}`:'—'};
const promoPctRatio=v=>{const n=Number(v);return Number.isFinite(n)?`${promoFa(n*100,1)}٪`:'—'};
function promoHeaders(){const k=promoCfg.SUPABASE_PUBLISHABLE_KEY||promoCfg.publishableKey||'';return{apikey:k,Accept:'application/json'}}
function promoMode(m){return m==='reversal'?'Reversal':m==='acceleration'?'Acceleration':String(m||'—')}
function promoGate(v){return v?'<span class="ok-text">پاس</span>':'<span class="warn-text">رد</span>'}
function promoAssessmentRow(r){return `<tr><td>${promoMode(r.hunt_mode)}</td><td>${r.candidate_id||'—'}</td><td>${promoFa(r.candidate_selected_count,0)}</td><td>${promoPctRatio(r.selected_coverage_ratio)}</td><td>${promoSigned(r.utility_lift)}</td><td>${promoSigned(r.return_lift_3d_pct)}</td><td>${promoSigned(r.mae_delta_3d_pct)}</td><td>${promoSigned(r.positive_rate_delta_pp,1)}</td><td>${promoGate(r.pass_distinct_candidate)}</td><td>${promoGate(r.pass_min_samples)}</td><td>${promoGate(r.pass_coverage)}</td><td>${promoGate(r.pass_utility)}</td><td>${promoGate(r.pass_return)}</td><td>${promoGate(r.pass_mae_guard)}</td><td>${promoGate(r.pass_positive_rate_guard)}</td><td>${promoGate(r.promotion_gate_pass)}</td></tr>`}
function promoProposalRow(r){return `<tr><td>${promoFa(r.proposal_id,0)}</td><td>${r.target_engine_version||'—'}</td><td>${r.proposal_status||'—'}</td><td>${r.created_at?new Date(r.created_at).toLocaleString('fa-IR'):'—'}</td><td class="mono">${r.dataset_fingerprint||'—'}</td><td>${r.proposal_note||'—'}</td></tr>`}
async function loadPromotionDecision(){
  const base=String(promoCfg.SUPABASE_URL||promoCfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base){promo$('promoStatus').textContent='تنظیمات اتصال موجود نیست.';return}
  promo$('promoStatus').textContent='در حال دریافت Promotion Decision Protocol…';
  try{
    const [pr,rr,ar,qr]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_promotion_policy_v416?select=*&policy_id=eq.default&limit=1`,{headers:promoHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_promotion_readiness_v416?select=*&limit=1`,{headers:promoHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_promotion_assessment_v416?select=*&order=hunt_mode.asc`,{headers:promoHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_promotion_proposals_v416?select=proposal_id,release_id,target_engine_version,proposal_status,proposal_note,dataset_fingerprint,created_at&order=proposal_id.desc&limit=5`,{headers:promoHeaders(),cache:'no-store'})
    ]);
    if(!pr.ok||!rr.ok||!ar.ok||!qr.ok)throw new Error('دریافت Promotion Protocol ناموفق بود');
    const pol=(await pr.json())[0]||{},ready=(await rr.json())[0]||{},assess=await ar.json(),proposals=await qr.json();
    promo$('promoTarget').textContent=pol.target_engine_version||'—';
    promo$('promoModeGate').textContent=`${promoFa(ready.passed_modes||0,0)} / ${promoFa(ready.mode_count||0,0)}`;
    promo$('promoReady').textContent=ready.proposal_id?'PROPOSED':ready.proposal_ready?'READY TO PROPOSE':'LOCKED';
    promo$('promoReady').className=ready.proposal_id||ready.proposal_ready?'warn-text':'ok-text';
    promo$('promoReason').textContent=ready.readiness_reason||'—';
    promo$('promoAuto').textContent=pol.auto_promote?'فعال':'خاموش';
    promo$('promoAuto').className=pol.auto_promote?'warn-text':'ok-text';
    promo$('promoThresholds').textContent=`Thresholdهای فریز‌شده: حداقل ${promoFa(pol.min_oos_selected_per_mode,0)} انتخاب OOS در هر Mode؛ پوشش حداقل ${promoPctRatio(pol.min_selected_coverage_ratio)} نسبت به Baseline؛ ΔUtility حداقل ${promoSigned(pol.min_utility_lift)}؛ ΔReturn 3D حداقل ${promoSigned(pol.min_return_lift_3d_pct)} واحد درصد؛ افت مجاز MAE حداکثر ${promoFa(pol.max_mae_deterioration_3d_pct,2)} واحد درصد و افت مجاز Positive-rate حداکثر ${promoFa(pol.max_positive_rate_deterioration_pp,1)} واحد درصد.`;
    promo$('promoAssessmentBody').innerHTML=assess.length?assess.map(promoAssessmentRow).join(''):'<tr><td colspan="16" class="muted">تا قبل از OOS Release، Promotion Assessment ساخته نمی‌شود.</td></tr>';
    promo$('promoProposalBody').innerHTML=proposals.length?proposals.map(promoProposalRow).join(''):'<tr><td colspan="6" class="muted">هنوز هیچ پیشنهاد نسخه بعدی ثبت نشده است.</td></tr>';
    promo$('promoStatus').textContent=`آخرین بررسی: ${new Date().toLocaleTimeString('fa-IR')}`;
  }catch(e){promo$('promoStatus').textContent=e.message||'خطا در Promotion Protocol'}
}
promo$('refreshPromo').onclick=loadPromotionDecision;
loadPromotionDecision();
