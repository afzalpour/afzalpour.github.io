'use strict';
const admissionCfg=window.STOCK_HUNTER_CONFIG||{};
const admission$=id=>document.getElementById(id);
const admissionFa=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—'};
function admissionHeaders(){const k=admissionCfg.SUPABASE_PUBLISHABLE_KEY||admissionCfg.publishableKey||'';return{apikey:k,Accept:'application/json'}}
function admissionGate(v){return v?'<span class="ok-text">پاس</span>':'<span class="warn-text">رد</span>'}
function admissionLabel(v){const m={NO_ACTIVATION_REVIEW_BOUND:'بدون Activation Review',NOT_IN_SAFE_CHAMPION_STATE:'خارج از Safe Champion State',TELEMETRY_NOT_READY_FOR_REVIEW:'Telemetry هنوز آماده نیست',BOTH_MODES_REQUIRED:'هر دو Mode لازم است',INSUFFICIENT_PAIRS:'Pair کافی نیست',INSUFFICIENT_SYMBOL_DIVERSITY:'تنوع نماد کافی نیست',INSUFFICIENT_TIME_BUCKETS:'بازه زمانی کافی نیست',TELEMETRY_STALE:'Telemetry کهنه است',TELEMETRY_RECOMMENDATION_NOT_PASS:'Telemetry Recommendation پاس نیست',READY_FOR_MANUAL_CANARY_AUTHORIZATION:'آماده Authorization دستی'};return m[String(v||'')]||String(v||'—')}
function renderAdmissionV417(p,r){
  const state=admission$('admissionState');
  state.textContent=r.admission_ready?'READY FOR MANUAL AUTHORIZATION':'BLOCKED';
  state.className=r.admission_ready?'warn-text':'ok-text';
  admission$('admissionReason').textContent=admissionLabel(r.admission_reason);
  admission$('admissionReview').textContent=r.activation_review_id?`#${admissionFa(r.activation_review_id)}`:'—';
  admission$('admissionPairs').textContent=`${admissionFa(r.min_pairs_observed)} / ${admissionFa(r.min_pairs_per_mode||p.min_pairs_per_mode)}`;
  admission$('admissionSymbols').textContent=`${admissionFa(r.min_symbols_observed)} / ${admissionFa(r.min_symbols_per_mode||p.min_symbols_per_mode)}`;
  admission$('admissionBuckets').textContent=`${admissionFa(r.min_buckets_observed)} / ${admissionFa(r.min_buckets_per_mode||p.min_buckets_per_mode)}`;
  admission$('admissionFreshness').textContent=r.pass_freshness?'FRESH':'WAITING / STALE';
  admission$('admissionFreshness').className=r.pass_freshness?'ok-text':'warn-text';
  admission$('admissionLastTelemetry').textContent=r.telemetry_last_success_at?new Date(r.telemetry_last_success_at).toLocaleString('fa-IR'):'—';
  admission$('admissionRecommendation').textContent=r.telemetry_recommendation||'—';
  admission$('admissionRecommendation').className=r.pass_recommendation?'ok-text':'warn-text';
  admission$('admissionAuto').textContent=p.auto_start?'ON':'OFF — MANUAL ONLY';
  admission$('admissionAuto').className=p.auto_start?'warn-text':'ok-text';
  admission$('admissionPolicy').textContent=`حداقل ${admissionFa(p.min_pairs_per_mode)} Pair، ${admissionFa(p.min_symbols_per_mode)} نماد و ${admissionFa(p.min_buckets_per_mode)} بازه زمانی برای هر Mode؛ حداکثر سن Telemetry ${admissionFa(p.max_telemetry_age_minutes)} دقیقه؛ Recommendation لازم=${p.required_recommendation||'PASS'}؛ Auto-start=${p.auto_start?'ON':'OFF'}.`;
  admission$('admissionGates').innerHTML=`Review ${admissionGate(r.pass_review_bound)} · Safe State ${admissionGate(r.pass_safe_state)} · Capture ${admissionGate(r.pass_capture_ready)} · Pairs ${admissionGate(r.pass_pairs)} · Symbols ${admissionGate(r.pass_symbols)} · Buckets ${admissionGate(r.pass_buckets)} · Freshness ${admissionGate(r.pass_freshness)} · Recommendation ${admissionGate(r.pass_recommendation)}`;
}
async function loadCanaryAdmissionV417(){
  const base=String(admissionCfg.SUPABASE_URL||admissionCfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base)return;
  try{
    const [pr,rr]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_canary_admission_policy_v417?select=*&policy_id=eq.default&limit=1`,{headers:admissionHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_canary_admission_readiness_v417?select=*&limit=1`,{headers:admissionHeaders(),cache:'no-store'})
    ]);
    if(!pr.ok||!rr.ok)throw new Error('Canary Admission API unavailable');
    const p=(await pr.json())[0]||{},r=(await rr.json())[0]||{};
    renderAdmissionV417(p,r);
  }catch(e){
    const state=admission$('admissionState');
    if(state){state.textContent='READ ERROR';state.className='warn-text'}
    const reason=admission$('admissionReason');if(reason)reason.textContent=e?.message||'خطا در دریافت Admission Gate';
  }
}
function loadCanaryExpansionSurfaceV417(){
  if(document.querySelector('script[data-canary-expansion-v417]'))return;
  const s=document.createElement('script');s.src='canary-expansion-v417.js?v=4.1.7';s.defer=true;s.dataset.canaryExpansionV417='1';document.body.appendChild(s);
}
const admissionRefresh=admission$('refreshRoll');if(admissionRefresh)admissionRefresh.addEventListener('click',loadCanaryAdmissionV417);
loadCanaryAdmissionV417();
loadCanaryExpansionSurfaceV417();
