'use strict';
const R=StockHunterResearchV416;let journeyRows=[];
const $=id=>document.getElementById(id);
const resultFa=v=>({HIT_PLUS3:'رسیده به +۳٪',HIT_PLUS2:'رسیده به +۲٪',HIT_PLUS1:'رسیده به +۱٪',CROSSED_ZERO:'عبور از صفر',POSITIVE_CLOSE:'پایان مثبت',FAILED_SAME_DAY:'ناموفق همان‌روز',PENDING:'در انتظار تکمیل'}[v]||v||'—');
const modeFa=v=>v==='reversal'?'برگشت منفی':v==='acceleration'?'شتاب مثبت':'—';
const channelFa=v=>v==='RADAR'?'شکار زودهنگام':'شکار فعال';
function filteredJourney(){
  const q=$('journeySearch').value.trim().toLocaleLowerCase('fa'),ch=$('journeyChannel').value,m=$('journeyMode').value;
  return journeyRows.filter(x=>(!q||String(x.symbol||'').toLocaleLowerCase('fa').includes(q)||String(x.company_name||'').toLocaleLowerCase('fa').includes(q))&&(!ch||x.channel===ch)&&(!m||x.hunt_mode===m));
}
function renderJourney(){
  const a=filteredJourney();
  $('jTotal').textContent=R.fa(a.length);$('jZero').textContent=R.fa(a.filter(x=>x.crossed_zero_at).length);
  $('jPlus1').textContent=R.fa(a.filter(x=>x.crossed_plus1_at).length);$('jPlus2').textContent=R.fa(a.filter(x=>x.crossed_plus2_at).length);
  $('jPlus3').textContent=R.fa(a.filter(x=>x.crossed_plus3_at).length);$('jFailed').textContent=R.fa(a.filter(x=>x.result_label==='FAILED_SAME_DAY').length);
  $('journeyBody').innerHTML=a.length?a.map((x,i)=>`<tr data-i="${journeyRows.indexOf(x)}"><td>${R.time(x.detected_at)}</td><td><b>${R.esc(x.symbol)}</b><div class="muted">${R.esc(x.company_name||'')}</div></td><td>${modeFa(x.hunt_mode)}</td><td>${channelFa(x.channel)}<div class="muted">${R.esc(x.hunt_state||'')}</div></td><td>${R.fa(x.detected_price,0)}</td><td>${R.pct(x.detected_day_change)}</td><td>${R.fa(x.hunt_score,1)}</td><td>${R.time(x.crossed_zero_at)}</td><td>${R.time(x.crossed_plus1_at)}</td><td>${R.time(x.crossed_plus2_at)}</td><td>${R.time(x.crossed_plus3_at)}</td><td class="good">${R.pct(x.same_day_mfe_pct)}</td><td class="bad">${R.pct(x.same_day_mae_pct)}</td><td>${resultFa(x.result_label)}</td></tr>`).join(''):'<tr><td colspan="14"><div class="empty">برای این فیلتر رخدادی وجود ندارد.</div></td></tr>';
  document.querySelectorAll('#journeyBody tr[data-i]').forEach(tr=>tr.onclick=()=>showJourney(journeyRows[Number(tr.dataset.i)]));
}
function step(label,at,meta,cls=''){return `<div class="timeline-step ${cls}"><span>${label}</span><b>${at?R.time(at):'نرسیده'}</b><span>${meta||''}</span></div>`;}
function showJourney(x){
  const carry=x.carry_status?`<div class="card"><span>Carry ۱۵ دقیقه‌ای</span><b>${R.esc(x.carry_status)}</b><span>MFE از کشف ${R.pct(x.carry_mfe_from_detect_15m)} / از عبور ${R.pct(x.carry_mfe_from_cross_15m)}</span></div>`:'';
  $('journeyDetail').innerHTML=`<h2>${R.esc(x.symbol)} — ${R.esc(x.company_name||'')}</h2><div class="timeline">
    ${step('کشف',x.detected_at,'قیمت '+R.fa(x.detected_price,0)+' — '+R.pct(x.detected_day_change))}
    <div class="timeline-arrow">←</div>${step('عبور از صفر',x.crossed_zero_at,x.time_to_zero_min!=null?R.fa(x.time_to_zero_min,1)+' دقیقه':'')}
    <div class="timeline-arrow">←</div>${step('+۱٪',x.crossed_plus1_at,x.time_to_plus1_min!=null?R.fa(x.time_to_plus1_min,1)+' دقیقه':'')}
    <div class="timeline-arrow">←</div>${step('+۲٪',x.crossed_plus2_at,x.time_to_plus2_min!=null?R.fa(x.time_to_plus2_min,1)+' دقیقه':'')}
    <div class="timeline-arrow">←</div>${step('+۳٪',x.crossed_plus3_at,x.time_to_plus3_min!=null?R.fa(x.time_to_plus3_min,1)+' دقیقه':'')}
  </div><div class="cards"><article class="card"><span>امتیاز شکار</span><b>${R.fa(x.hunt_score,1)}</b></article><article class="card"><span>شواهد</span><b>${R.fa(x.evidence_count)} / ${R.fa(x.dynamic_evidence_count)}</b></article><article class="card"><span>بیشترین حرکت روز</span><b>${R.pct(x.same_day_max_change_pct)}</b></article><article class="card"><span>MFE / MAE</span><b>${R.pct(x.same_day_mfe_pct)} / ${R.pct(x.same_day_mae_pct)}</b></article><article class="card"><span>بسته‌شدن روز بعد</span><b>${R.pct(x.d1_close_change_pct)}</b></article>${carry}</div>`;
}
async function loadJourney(){
  R.setStatus('در حال دریافت Journey…','warn');
  const d=$('journeyDate').value||R.todayIso();
  const select='channel,trade_date,symbol_id,symbol,company_name,asset_type,market,hunt_mode,hunt_state,detected_at,detected_price,detected_day_change,hunt_score,today_opportunity,evidence_count,dynamic_evidence_count,crossed_zero_at,crossed_plus1_at,crossed_plus2_at,crossed_plus3_at,time_to_zero_min,time_to_plus1_min,time_to_plus2_min,time_to_plus3_min,same_day_max_change_pct,same_day_close_change_pct,same_day_mfe_pct,same_day_mae_pct,same_day_buy_queue_any,d1_session_date,d1_close_change_pct,d1_return_from_alert_pct,d1_mfe_pct,d1_mae_pct,d1_positive_close,d1_hit_plus1,d1_hit_plus2,d1_hit_plus3,carry_status,carry_peak_price_15m,carry_trough_price_15m,carry_mfe_from_detect_15m,carry_mae_from_detect_15m,carry_mfe_from_cross_15m,carry_mae_from_cross_15m,result_label';
  try{journeyRows=await R.api('stock_hunter_hunt_journey_v416','select='+encodeURIComponent(select)+'&trade_date=eq.'+encodeURIComponent(d)+'&order=detected_at.asc&limit=1500');renderJourney();R.setStatus('Journey '+R.jalaliDate(d)+' — '+R.fa(journeyRows.length)+' رخداد','ok');}
  catch(e){journeyRows=[];renderJourney();R.setStatus('دریافت Journey ناموفق بود: '+e.message,'bad');}
}
$('journeyDate').value=R.todayIso();$('journeyDate').onchange=loadJourney;$('journeyRefresh').onclick=loadJourney;
for(const id of ['journeySearch','journeyChannel','journeyMode'])$(id).addEventListener(id==='journeySearch'?'input':'change',renderJourney);
loadJourney();