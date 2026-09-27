(function(){
'use strict';
const cfg=window.STOCK_HUNTER_CONFIG||{};
const $=id=>document.getElementById(id);
const fa=(v,d=2)=>{const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—'};
const pct=v=>{const n=Number(v);return Number.isFinite(n)?`${n>=0?'+':''}${fa(n,2)}٪`:'—'};
function headers(){const k=cfg.SUPABASE_PUBLISHABLE_KEY||cfg.publishableKey||'';return{apikey:k,Accept:'application/json'}}
function modeLabel(m){return m==='reversal'?'برگشت منفی به مثبت':'شتاب مثبت اولیه'}
function row(c){return `<tr><td>${modeLabel(c.hunt_mode)}</td><td>${c.is_baseline?'مبنای ثابت':'گزینه آزمایشی'}</td><td>${fa(c.order_pressure,2)}</td><td>${fa(c.impulse,2)}</td><td>${fa(c.feasibility,2)}</td><td>${fa(c.flow_volume,2)}</td><td>${fa(c.market_context,2)}</td><td>${fa(c.train_selected,0)}</td><td>${fa(c.validation_selected,0)}</td><td>${pct(c.validation_return_3d_pct)}</td><td>${pct(c.validation_mfe_3d_pct)}</td><td>${pct(c.validation_mae_3d_pct)}</td><td>${fa(c.validation_utility,3)}</td><td>${c.eligible_for_selection?fa(c.validation_rank,0):'—'}</td></tr>`}
async function loadEvaluator(){
  const base=String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base){$('evalStatus').textContent='تنظیمات اتصال موجود نیست.';return}
  $('evalStatus').textContent='در حال دریافت ارزیاب گزینه‌های آزمایشی…';
  try{
    const [lr,sr,cr,or]=await Promise.all([
      fetch(`${base}/rest/v1/stock_hunter_candidate_leaderboard_v416?select=*&order=hunt_mode.asc,is_baseline.desc,validation_rank.asc.nullslast,candidate_id.asc`,{headers:headers(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_candidate_selected_v416?select=*`,{headers:headers(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_candidate_eval_control_v416?select=*&singleton=eq.true&limit=1`,{headers:headers(),cache:'no-store'}),
      fetch(`${base}/rest/v1/stock_hunter_candidate_oos_v416?select=candidate_id&limit=1`,{headers:headers(),cache:'no-store'})
    ]);
    if(!lr.ok||!sr.ok||!cr.ok||!or.ok)throw new Error('دریافت ارزیاب گزینه‌های آزمایشی ناموفق بود');
    const rows=await lr.json(),selected=await sr.json(),ctl=(await cr.json())[0]||{},oos=await or.json();
    $('candidateCount').textContent=fa(rows.length,0);
    $('eligibleCount').textContent=fa(rows.filter(x=>x.eligible_for_selection).length,0);
    $('oosLock').textContent=ctl.oos_unlocked?'باز شده':'قفل';
    $('oosLock').className=ctl.oos_unlocked?'warn-text':'ok-text';
    $('promotionLock').textContent=ctl.auto_promote?'فعال':'خاموش';
    $('promotionLock').className=ctl.auto_promote?'warn-text':'ok-text';
    $('selectedCandidates').textContent=selected.length?selected.map(x=>`${modeLabel(x.hunt_mode)}: ${x.candidate_id}`).join(' | '):'هنوز گزینه آزمایشی منتخبی وجود ندارد';
    $('oosVisible').textContent=fa(oos.length,0);
    const top=rows.filter(x=>x.is_baseline||x.eligible_for_selection).sort((a,b)=>String(a.hunt_mode).localeCompare(String(b.hunt_mode))||Number(a.validation_rank||999)-Number(b.validation_rank||999)).slice(0,30);
    $('candidateBody').innerHTML=top.length?top.map(row).join(''):'<tr><td colspan="14" class="muted">تا بلوغ مجموعه‌داده، فقط شبکه گزینه‌های آزمایشی ساخته می‌شود و هنوز رتبه معتبری محاسبه نمی‌شود.</td></tr>';
    $('evalStatus').textContent=`آخرین بررسی: ${new Date().toLocaleTimeString('fa-IR')}`;
  }catch(e){$('evalStatus').textContent=e.message||'خطا در دریافت ارزیاب'}
}
$('refreshEval').onclick=loadEvaluator;
loadEvaluator();
})();
