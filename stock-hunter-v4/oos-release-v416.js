'use strict';
const oosCfg=window.STOCK_HUNTER_CONFIG||{};
const oos$=id=>document.getElementById(id);
const oosFa=(v,d=2)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—'};
const oosPct=v=>{const n=Number(v);return Number.isFinite(n)?`${n>=0?'+':''}${oosFa(n,2)}٪`:'—'};
function oosHeaders(){const k=oosCfg.SUPABASE_PUBLISHABLE_KEY||oosCfg.publishableKey||'';return{apikey:k,Accept:'application/json'}}
function oosMode(m){return m==='reversal'?'Reversal':'Acceleration'}
function oosRole(r){return r==='candidate'?'Candidate':'Baseline'}
function oosWeights(r){const vals=[r.order_pressure_w,r.impulse_w,r.feasibility_w,r.flow_volume_w,r.market_context_w];return vals.every(v=>Number.isFinite(Number(v)))?vals.map(v=>oosFa(Number(v)*100,0)+'٪').join(' / '):'—'}
function oosRow(r){return `<tr><td>${oosMode(r.hunt_mode)}</td><td>${oosRole(r.result_role)}</td><td>${r.candidate_id||'—'}</td><td>${oosWeights(r)}</td><td>${oosFa(r.selected_count,0)}</td><td>${oosFa(r.selected_trade_dates,0)}</td><td>${oosPct(r.avg_return_3d_pct)}</td><td>${oosPct(r.avg_mfe_3d_pct)}</td><td>${oosPct(r.avg_mae_3d_pct)}</td><td>${oosFa(r.utility,3)}</td><td>${Number.isFinite(Number(r.positive_rate_3d_pct))?oosFa(r.positive_rate_3d_pct,1)+'٪':'—'}</td></tr>`}
async function loadOosRelease(){
  const base=String(oosCfg.SUPABASE_URL||oosCfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base){oos$('oosReleaseStatus').textContent='تنظیمات اتصال موجود نیست.';return}
  oos$('oosReleaseStatus').textContent='در حال دریافت OOS Release Protocol…';
  try{
    const [mr,cr,ur]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_oos_release_manifest_v416?select=*&order=release_id.desc&limit=1`,{headers:oosHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_oos_release_comparison_v416?select=*&order=hunt_mode.asc,result_role.desc`,{headers:oosHeaders(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_oos_unlock_readiness_v416?select=*&limit=1`,{headers:oosHeaders(),cache:'no-store'})
    ]);
    if(!mr.ok||!cr.ok||!ur.ok)throw new Error('دریافت OOS Release Protocol ناموفق بود');
    const manifest=(await mr.json())[0]||null,rows=await cr.json(),unlock=(await ur.json())[0]||{};
    const released=!!manifest;
    oos$('oosProtocolState').textContent=released?'Released — Snapshot فریز شده':(unlock.can_unlock_oos?'آماده Release دستی':'قفل — Release انجام نشده');
    oos$('oosProtocolState').className=released?'warn-text':'ok-text';
    oos$('oosProtocolVersion').textContent=manifest?.protocol_version||'4.1.6-oos-release-v1';
    oos$('oosReleasedAt').textContent=manifest?.released_at?new Date(manifest.released_at).toLocaleString('fa-IR'):'—';
    oos$('oosFrozenRange').textContent=manifest?.dataset_first_trade_date?`${manifest.dataset_first_trade_date} تا ${manifest.dataset_last_trade_date}`:'—';
    oos$('oosFrozenHoldout').textContent=manifest?.oos_first_trade_date?`${manifest.oos_first_trade_date} تا ${manifest.oos_last_trade_date}`:'—';
    oos$('oosFrozenSamples').textContent=released?`${oosFa(manifest.oos_samples,0)} / ${oosFa(manifest.oos_trade_dates,0)} روز`:'—';
    oos$('oosFingerprint').textContent=manifest?.dataset_fingerprint||'—';
    oos$('oosReleaseReason').textContent=released?'نتیجه OOS از Manifest/Result Snapshot ثابت خوانده می‌شود و با ورود داده جدید تغییر نمی‌کند.':(unlock.unlock_reason||'—');
    oos$('oosComparisonBody').innerHTML=rows.length?rows.map(oosRow).join(''):'<tr><td colspan="11" class="muted">OOS هنوز Release نشده است؛ هیچ نتیجه Holdout نمایش داده نمی‌شود.</td></tr>';
    oos$('oosReleaseStatus').textContent=`آخرین بررسی: ${new Date().toLocaleTimeString('fa-IR')}`;
  }catch(e){oos$('oosReleaseStatus').textContent=e.message||'خطا در دریافت OOS Release Protocol'}
}
oos$('refreshOosRelease').onclick=loadOosRelease;
loadOosRelease();
