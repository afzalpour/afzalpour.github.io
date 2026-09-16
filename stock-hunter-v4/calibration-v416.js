'use strict';
const cfg=window.STOCK_HUNTER_CONFIG||{};
const $=id=>document.getElementById(id);
const fa=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—'};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function headers(extra={}){const k=cfg.SUPABASE_PUBLISHABLE_KEY||cfg.publishableKey||'';return{apikey:k,Accept:'application/json',...extra}}
function weightRows(w){const modes=[['reversal','Reversal'],['acceleration','Acceleration']];return modes.map(([key,label])=>{const x=w?.[key]||{};return `<tr><td>${label}</td><td>${fa(x.order_pressure,2)}</td><td>${fa(x.impulse,2)}</td><td>${fa(x.feasibility,2)}</td><td>${fa(x.flow_volume,2)}</td><td>${fa(x.market_context,2)}</td><td>${fa(x.continuation_modifier_min,2)} تا ${fa(x.continuation_modifier_max,2)}</td></tr>`}).join('')}
async function loadCalibration(){
  const base=String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base){$('calStatus').textContent='تنظیمات اتصال در دسترس نیست.';return}
  $('calStatus').textContent='در حال دریافت وضعیت Calibration…';
  try{
    const [rr,pr,sr]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_calibration_readiness_v416?select=*&limit=1`,{headers:headers(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_calibration_policy_v416?select=*&policy_id=eq.default&limit=1`,{headers:headers(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_shadow_samples_v416?select=sample_id&limit=1`,{headers:headers({Prefer:'count=exact'}),cache:'no-store'})
    ]);
    if(!rr.ok||!pr.ok)throw new Error('دریافت وضعیت Calibration ناموفق بود');
    const ready=(await rr.json())[0]||{},policy=(await pr.json())[0]||{};
    const range=sr.headers.get('content-range')||'',shadowCount=Number((range.split('/')[1]||'0'))||0;
    $('shadowCount').textContent=fa(shadowCount);
    $('matureCount').textContent=fa(ready.total_samples||0);
    $('tradeDates').textContent=fa(ready.trade_dates||0);
    $('oosCount').textContent=fa(ready.oos_samples||0);
    $('revCount').textContent=fa(ready.reversal_samples||0);
    $('accCount').textContent=fa(ready.acceleration_samples||0);
    $('readyFlag').textContent=ready.calibration_ready?'آماده ارزیابی Candidate':'هنوز آماده نیست';
    $('readyFlag').className=ready.calibration_ready?'ok-text':'warn-text';
    $('reason').textContent=ready.readiness_reason||'—';
    $('thresholds').textContent=`حداقل‌ها: ${fa(policy.min_total_samples)} نمونه کل، ${fa(policy.min_mode_samples)} نمونه برای هر Mode، ${fa(policy.min_oos_samples)} نمونه OOS و ${fa(policy.min_trade_dates)} روز معاملاتی.`;
    $('promotion').textContent=policy.auto_promote?'فعال':'غیرفعال — تغییر وزن فقط پس از بررسی انسانی';
    $('riskFormula').textContent=policy.risk_formula||'—';
    $('weightsBody').innerHTML=weightRows(policy.baseline_weights||{});
    $('dateRange').textContent=ready.first_trade_date?`${ready.first_trade_date} تا ${ready.last_trade_date||ready.first_trade_date}`:'هنوز نمونه بالغ وجود ندارد';
    $('calStatus').textContent=`آخرین بررسی: ${new Date().toLocaleTimeString('fa-IR')}`;
  }catch(e){$('calStatus').textContent=e.message||'خطا در دریافت داده'}
}
$('refreshCal').onclick=loadCalibration;
loadCalibration();
