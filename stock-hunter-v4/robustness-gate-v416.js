'use strict';
const robustCfg=window.STOCK_HUNTER_CONFIG||{};
const robust$=id=>document.getElementById(id);
const robustFa=(v,d=2)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—'};
const robustPct01=v=>{const n=Number(v);return Number.isFinite(n)?`${robustFa(n*100,1)}٪`:'—'};
const robustSigned=v=>{const n=Number(v);return Number.isFinite(n)?`${n>=0?'+':''}${robustFa(n,3)}`:'—'};
function robustHeaders(){const k=robustCfg.SUPABASE_PUBLISHABLE_KEY||robustCfg.publishableKey||'';return{apikey:k,Accept:'application/json'}}
function robustMode(m){return m==='reversal'?'Reversal':'Acceleration'}
function robustRow(r){return `<tr><td>${robustMode(r.hunt_mode)}</td><td>${r.candidate_id||'—'}</td><td>${robustFa(r.validation_trade_dates,0)}</td><td>${robustFa(r.paired_trade_dates,0)}</td><td>${robustFa(r.slice_passes,0)}/۳</td><td>${robustSigned(r.worst_slice_diff)}</td><td>${robustFa(r.bootstrap_reps,0)}</td><td>${robustPct01(r.bootstrap_win_rate)}</td><td>${robustSigned(r.bootstrap_p10_diff)}</td><td>${robustSigned(r.bootstrap_median_diff)}</td><td class="${r.robustness_ready?'ok-text':'warn-text'}">${r.robustness_ready?'پاس':'قفل'}</td><td>${r.robustness_reason||'—'}</td></tr>`}
function sliceRow(r){return `<tr><td>${robustMode(r.hunt_mode)}</td><td>${r.candidate_id||'—'}</td><td>${robustFa(r.time_slice,0)}</td><td>${robustFa(r.validation_trade_dates,0)}</td><td>${robustFa(r.selected_symbol_days,0)}</td><td>${robustSigned(r.candidate_utility)}</td><td>${robustSigned(r.baseline_utility)}</td><td>${robustSigned(r.utility_diff)}</td><td class="${r.slice_pass?'ok-text':'warn-text'}">${r.slice_pass?'پاس':'رد'}</td></tr>`}
function oosResultRow(r){return `<tr><td>${robustMode(r.hunt_mode)}</td><td>${r.result_role==='baseline'?'Baseline':'Candidate'}</td><td>${r.candidate_id||'—'}</td><td>${robustFa(r.selected_count,0)}</td><td>${robustFa(r.selected_trade_dates,0)}</td><td>${robustSigned(r.utility)}</td><td>${robustSigned(r.avg_return_3d_pct)}</td><td>${robustSigned(r.avg_mfe_3d_pct)}</td><td>${robustSigned(r.avg_mae_3d_pct)}</td><td>${r.positive_rate_3d_pct==null?'—':`${robustFa(r.positive_rate_3d_pct,1)}٪`}</td></tr>`}
async function loadRobustness(){
  const base=String(robustCfg.SUPABASE_URL||robustCfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base){robust$('robustStatus').textContent='تنظیمات اتصال موجود نیست.';return}
  robust$('robustStatus').textContent='در حال دریافت Stability & Robustness Gate…';
  try{
    const [pr,rr,ur,sr,mr,cr]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_robustness_policy_v416?select=*&policy_id=eq.default&limit=1`,{headers:robustHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_candidate_robustness_v416?select=*&order=hunt_mode.asc`,{headers:robustHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_oos_unlock_readiness_v416?select=*&limit=1`,{headers:robustHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_candidate_time_slice_metrics_v416?select=*&order=hunt_mode.asc,time_slice.asc`,{headers:robustHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_oos_release_manifest_v416?select=release_id,protocol_version,engine_version,released_at,release_note,dataset_first_trade_date,dataset_last_trade_date,oos_first_trade_date,oos_last_trade_date,total_samples,oos_samples,oos_trade_dates,dataset_fingerprint&order=release_id.desc&limit=1`,{headers:robustHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_oos_release_comparison_v416?select=*&order=hunt_mode.asc,result_role.asc`,{headers:robustHeaders(),cache:'no-store'})
    ]);
    if(!pr.ok||!rr.ok||!ur.ok||!sr.ok||!mr.ok||!cr.ok)throw new Error('دریافت Robustness/OOS ناموفق بود');
    const pol=(await pr.json())[0]||{},rows=await rr.json(),unlock=(await ur.json())[0]||{},slices=await sr.json(),manifest=(await mr.json())[0]||null,oosRows=await cr.json();
    robust$('robustModeCount').textContent=robustFa(unlock.mode_count||0,0);
    robust$('robustPassCount').textContent=robustFa(unlock.robust_modes||0,0);
    robust$('bootstrapRule').textContent=`${robustFa(pol.bootstrap_reps||0,0)} بازنمونه / بلوک ${robustFa(pol.bootstrap_block_days||0,0)} روزه`;
    robust$('bootstrapWinRule').textContent=`حداقل ${robustPct01(pol.min_bootstrap_win_rate)}`;
    robust$('sliceRule').textContent=`حداقل ${robustFa(pol.min_slice_passes,0)} از ۳ زیر‌بازه`;
    robust$('oosReady').textContent=unlock.oos_unlocked?'باز شده':(unlock.can_unlock_oos?'آماده بازگشایی دستی':'قفل');
    robust$('oosReady').className=unlock.oos_unlocked?'warn-text':(unlock.can_unlock_oos?'warn-text':'ok-text');
    robust$('oosReason').textContent=unlock.unlock_reason||'—';
    robust$('autoUnlock').textContent=pol.auto_unlock_oos?'فعال':'خاموش';
    robust$('autoUnlock').className=pol.auto_unlock_oos?'warn-text':'ok-text';
    robust$('robustBody').innerHTML=rows.length?rows.map(robustRow).join(''):'<tr><td colspan="12" class="muted">تا انتخاب Candidate معتبر، Robustness Gate محاسبه نمی‌شود.</td></tr>';
    robust$('sliceBody').innerHTML=slices.length?slices.map(sliceRow).join(''):'<tr><td colspan="9" class="muted">زیر‌بازه Validation هنوز داده کافی ندارد.</td></tr>';
    robust$('oosReleaseState').textContent=manifest?'RELEASED':'LOCKED';
    robust$('oosReleaseState').className=manifest?'warn-text':'ok-text';
    robust$('oosReleaseId').textContent=manifest?robustFa(manifest.release_id,0):'—';
    robust$('oosReleaseTime').textContent=manifest?.released_at?new Date(manifest.released_at).toLocaleString('fa-IR'):'—';
    robust$('oosFingerprint').textContent=manifest?.dataset_fingerprint||'—';
    robust$('oosReleaseNote').textContent=manifest?.release_note||unlock.unlock_reason||'—';
    robust$('oosDatasetRange').textContent=manifest?.dataset_first_trade_date?`${manifest.dataset_first_trade_date} تا ${manifest.dataset_last_trade_date}`:'—';
    robust$('oosFrozenRange').textContent=manifest?.oos_first_trade_date?`${manifest.oos_first_trade_date} تا ${manifest.oos_last_trade_date}`:'—';
    robust$('oosFrozenCount').textContent=manifest?`${robustFa(manifest.oos_samples,0)} نمونه / ${robustFa(manifest.oos_trade_dates,0)} روز`:'۰';
    robust$('oosResultBody').innerHTML=oosRows.length?oosRows.map(oosResultRow).join(''):'<tr><td colspan="10" class="muted">OOS هنوز آزاد نشده و هیچ نتیجه‌ای Freeze نشده است.</td></tr>';
    robust$('robustStatus').textContent=`آخرین بررسی: ${new Date().toLocaleTimeString('fa-IR')}`;
  }catch(e){robust$('robustStatus').textContent=e.message||'خطا در دریافت Robustness/OOS'}
}
robust$('refreshRobust').onclick=loadRobustness;
loadRobustness();
