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
async function loadRobustness(){
  const base=String(robustCfg.SUPABASE_URL||robustCfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base){robust$('robustStatus').textContent='تنظیمات اتصال موجود نیست.';return}
  robust$('robustStatus').textContent='در حال دریافت Stability & Robustness Gate…';
  try{
    const [pr,rr,ur,sr]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_robustness_policy_v416?select=*&policy_id=eq.default&limit=1`,{headers:robustHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_candidate_robustness_v416?select=*&order=hunt_mode.asc`,{headers:robustHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_oos_unlock_readiness_v416?select=*&limit=1`,{headers:robustHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_candidate_time_slice_metrics_v416?select=*&order=hunt_mode.asc,time_slice.asc`,{headers:robustHeaders(),cache:'no-store'})
    ]);
    if(!pr.ok||!rr.ok||!ur.ok||!sr.ok)throw new Error('دریافت Robustness Gate ناموفق بود');
    const pol=(await pr.json())[0]||{},rows=await rr.json(),unlock=(await ur.json())[0]||{},slices=await sr.json();
    robust$('robustModeCount').textContent=robustFa(unlock.mode_count||0,0);
    robust$('robustPassCount').textContent=robustFa(unlock.robust_modes||0,0);
    robust$('bootstrapRule').textContent=`${robustFa(pol.bootstrap_reps||0,0)} بازنمونه / بلوک ${robustFa(pol.bootstrap_block_days||0,0)} روزه`;
    robust$('bootstrapWinRule').textContent=`حداقل ${robustPct01(pol.min_bootstrap_win_rate)}`;
    robust$('sliceRule').textContent=`حداقل ${robustFa(pol.min_slice_passes,0)} از ۳ زیر‌بازه`;
    robust$('oosReady').textContent=unlock.can_unlock_oos?'آماده بازگشایی دستی':'قفل';
    robust$('oosReady').className=unlock.can_unlock_oos?'warn-text':'ok-text';
    robust$('oosReason').textContent=unlock.unlock_reason||'—';
    robust$('autoUnlock').textContent=pol.auto_unlock_oos?'فعال':'خاموش';
    robust$('autoUnlock').className=pol.auto_unlock_oos?'warn-text':'ok-text';
    robust$('robustBody').innerHTML=rows.length?rows.map(robustRow).join(''):'<tr><td colspan="12" class="muted">تا انتخاب Candidate معتبر، Robustness Gate محاسبه نمی‌شود.</td></tr>';
    robust$('sliceBody').innerHTML=slices.length?slices.map(sliceRow).join(''):'<tr><td colspan="9" class="muted">زیر‌بازه Validation هنوز داده کافی ندارد.</td></tr>';
    robust$('robustStatus').textContent=`آخرین بررسی: ${new Date().toLocaleTimeString('fa-IR')}`;
  }catch(e){robust$('robustStatus').textContent=e.message||'خطا در دریافت Robustness Gate'}
}
robust$('refreshRobust').onclick=loadRobustness;
loadRobustness();
