'use strict';
const R=StockHunterResearchV416;let journeyRows=[];const $=id=>document.getElementById(id);
const resultFa=v=>({HIT_PLUS3:'رسیده به +۳٪',HIT_PLUS2:'رسیده به +۲٪',HIT_PLUS1:'رسیده به +۱٪',CROSSED_ZERO:'عبور از صفر',POSITIVE_CLOSE:'پایان مثبت',FAILED_SAME_DAY:'ناموفق همان‌روز',PENDING:'در انتظار تکمیل'}[v]||'—');
const modeFa=v=>v==='reversal'?'برگشت از محدوده منفی':v==='acceleration'?'شتاب مثبت اولیه':'—';
const channelFa=v=>v==='RADAR'?'شکار زودهنگام':'شکار فعال';
const stageMatch=(x,s)=>!s||(s==='zero'&&x.crossed_zero_at)||(s==='plus1'&&x.crossed_plus1_at)||(s==='plus2'&&x.crossed_plus2_at)||(s==='plus3'&&x.crossed_plus3_at)||(s==='failed'&&x.result_label==='FAILED_SAME_DAY')||(s==='pending'&&x.result_label==='PENDING');
function filteredJourney(){
  const q=$('journeySearch').value.trim().toLocaleLowerCase('fa'),ch=$('journeyChannel').value,m=$('journeyMode').value,s=$('journeyStage').value;
  return journeyRows.filter(x=>(!q||String(x.symbol||'').toLocaleLowerCase('fa').includes(q)||String(x.company_name||'').toLocaleLowerCase('fa').includes(q))&&(!ch||x.channel===ch)&&(!m||x.hunt_mode===m)&&stageMatch(x,s));
}
function syncStageCards(){
  const s=$('journeyStage').value;document.querySelectorAll('.filter-card').forEach(b=>b.classList.toggle('active',b.dataset.stage===s));
}
function renderJourney(){
  const base=journeyRows.filter(x=>{
    const q=$('journeySearch').value.trim().toLocaleLowerCase('fa'),ch=$('journeyChannel').value,m=$('journeyMode').value;
    return (!q||String(x.symbol||'').toLocaleLowerCase('fa').includes(q)||String(x.company_name||'').toLocaleLowerCase('fa').includes(q))&&(!ch||x.channel===ch)&&(!m||x.hunt_mode===m);
  }),a=filteredJourney();
  $('jTotal').textContent=R.fa(base.length);$('jZero').textContent=R.fa(base.filter(x=>x.crossed_zero_at).length);
  $('jPlus1').textContent=R.fa(base.filter(x=>x.crossed_plus1_at).length);$('jPlus2').textContent=R.fa(base.filter(x=>x.crossed_plus2_at).length);
  $('jPlus3').textContent=R.fa(base.filter(x=>x.crossed_plus3_at).length);$('jFailed').textContent=R.fa(base.filter(x=>x.result_label==='FAILED_SAME_DAY').length);syncStageCards();
  $('journeyBody').innerHTML=a.length?a.map(x=>`<tr data-i="${journeyRows.indexOf(x)}"><td>${R.time(x.detected_at)}</td><td><b>${R.esc(x.symbol)}</b><div class="muted">${R.esc(x.company_name||'')}</div></td><td>${modeFa(x.hunt_mode)}</td><td>${channelFa(x.channel)}<div class="muted">${R.esc(x.hunt_state||'')}</div></td><td>${R.fa(x.detected_price,0)}</td><td>${R.pct(x.detected_day_change)}</td><td>${R.fa(x.hunt_score,1)}</td><td class="stage-zero">${R.time(x.crossed_zero_at)}</td><td class="stage-one">${R.time(x.crossed_plus1_at)}</td><td class="stage-two">${R.time(x.crossed_plus2_at)}</td><td class="stage-three">${R.time(x.crossed_plus3_at)}</td><td class="good">${R.pct(x.same_day_mfe_pct)}</td><td class="bad">${R.pct(x.same_day_mae_pct)}</td><td>${resultFa(x.result_label)}</td></tr>`).join(''):'<tr><td colspan="14"><div class="empty">برای این فیلتر رخدادی وجود ندارد.</div></td></tr>';
  document.querySelectorAll('#journeyBody tr[data-i]').forEach(tr=>tr.onclick=()=>showJourney(journeyRows[Number(tr.dataset.i)]));
}
function step(label,at,meta){return `<div class="timeline-step ${at?'reached':'pending'}"><span>${label}</span><b>${at?R.time(at):'نرسیده'}</b><span>${meta||''}</span></div>`;}
function metricScore(x){
  return [
    ['فشار سفارش',x.order_pressure],['شتاب حرکت',x.impulse],['امکان رسیدن به هدف',x.feasibility],['جریان و حجم',x.flow_volume],
    ['شرایط بازار',x.market_context],['تداوم یک تا دو روزه',x.continuation12],['ریسک',x.risk_score],['نسبت لغو سفارش',x.cancellation_ratio]
  ].filter(a=>a[1]!=null&&Number.isFinite(Number(a[1])));
}
function explainHTML(x){
  const metrics=metricScore(x),positive=[...metrics.filter(([n])=>!['ریسک','نسبت لغو سفارش'].includes(n))].sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,4);
  const blockers=[];
  if(Number(x.risk_score)>62)blockers.push('ریسک در لحظه کشف بالا بوده است.');
  if(Number(x.cancellation_ratio)>60)blockers.push('نسبت لغو سفارش‌ها بالا بوده است.');
  if(Number(x.evidence_count)<3)blockers.push('تعداد شواهد هم‌زمان محدود بوده است.');
  if(Number(x.dynamic_evidence_count)<2)blockers.push('شواهد پویای حرکت محدود بوده است.');
  if(x.gate_reason)blockers.push(String(x.gate_reason));
  if(!blockers.length)blockers.push('در داده ثبت‌شده مانع غالبی که شکار را متوقف کند دیده نشده است.');
  const positives=positive.length?positive.map(([n,v])=>`<li>${R.esc(n)} با امتیاز ${R.fa(v,1)} از ۱۰۰.</li>`).join(''):'<li>جزئیات مؤلفه‌ها برای این رخداد کامل ثبت نشده است.</li>';
  const bars=metrics.map(([n,v])=>{const z=Math.max(0,Math.min(100,Number(v)));return `<div class="metric-bar"><span>${R.esc(n)}</span><b>${R.fa(v,1)}</b><div class="bar-track"><div class="bar-fill" style="width:${z}%"></div></div></div>`;}).join('');
  return `<h3>چرا این نماد شکار شد؟</h3><div class="explain-grid"><div class="explain-box positive"><b>عامل‌های تقویت‌کننده</b><ul class="explain-list">${positives}<li>${R.fa(x.evidence_count)} شاهد هم‌زمان و ${R.fa(x.dynamic_evidence_count)} شاهد پویا ثبت شده است.</li></ul></div><div class="explain-box blocker"><b>موانع و ریسک‌ها</b><ul class="explain-list">${blockers.map(v=>'<li>'+R.esc(v)+'</li>').join('')}</ul></div></div>${bars?'<div class="metric-bars">'+bars+'</div>':''}<p class="footnote">این توضیح بازخوانی مؤلفه‌های ثبت‌شده در همان لحظه است و امتیاز تازه‌ای تولید نمی‌کند.</p>`;
}
function chartHTML(x){
  const pts=[{label:'کشف',t:0,y:Number(x.detected_day_change),cls:''}];
  if(x.crossed_zero_at)pts.push({label:'صفر',t:Number(x.time_to_zero_min)||0,y:0,cls:''});
  if(x.crossed_plus1_at)pts.push({label:'+۱٪',t:Number(x.time_to_plus1_min)||1,y:1,cls:''});
  if(x.crossed_plus2_at)pts.push({label:'+۲٪',t:Number(x.time_to_plus2_min)||2,y:2,cls:''});
  if(x.crossed_plus3_at)pts.push({label:'+۳٪',t:Number(x.time_to_plus3_min)||3,y:3,cls:'peak'});
  const close=Number(x.same_day_close_change_pct);if(Number.isFinite(close))pts.push({label:'پایان روز',t:Math.max(...pts.map(p=>p.t),1)+15,y:close,cls:close<0?'bad':''});
  const ys=pts.map(p=>p.y).filter(Number.isFinite),ymin=Math.min(-1,...ys)-.4,ymax=Math.max(3,...ys)+.4,tmax=Math.max(1,...pts.map(p=>p.t));
  const X=t=>42+(t/tmax)*900,Y=y=>190-((y-ymin)/(ymax-ymin))*150;
  const path=pts.filter(p=>Number.isFinite(p.y)).map((p,i)=>(i?'L':'M')+X(p.t).toFixed(1)+','+Y(p.y).toFixed(1)).join(' ');
  const dots=pts.filter(p=>Number.isFinite(p.y)).map(p=>`<circle class="chart-dot ${p.cls}" cx="${X(p.t)}" cy="${Y(p.y)}" r="4"/><text class="chart-label" x="${X(p.t)}" y="${Y(p.y)-9}" text-anchor="middle">${R.esc(p.label)} ${R.pct(p.y,1)}</text>`).join('');
  return `<h3>نمودار مسیر شکار</h3><div class="journey-chart"><svg viewBox="0 0 960 215" preserveAspectRatio="none"><line class="chart-zero" x1="35" x2="945" y1="${Y(0)}" y2="${Y(0)}"/><text class="chart-label" x="8" y="${Y(0)-4}">صفر</text><path class="chart-line" d="${path}"/>${dots}</svg></div>`;
}
function showJourney(x){
  const carry=x.carry_status?`<article class="card teal-card"><span>پیگیری ۱۵ دقیقه‌ای عبور موفق</span><b>${R.esc(R.carryFa[x.carry_status]||'ثبت شده')}</b><span>پیشروی از کشف ${R.pct(x.carry_mfe_from_detect_15m)} / از عبور ${R.pct(x.carry_mfe_from_cross_15m)}</span></article>`:'';
  $('journeyDetail').innerHTML=`<h2>${R.esc(x.symbol)} — ${R.esc(x.company_name||'')}</h2><div class="section-note">تاریخ: ${R.jalaliDate(x.trade_date)} — زمان کشف: ${R.time(x.detected_at)} — ${channelFa(x.channel)}</div><div class="timeline">
    ${step('کشف',x.detected_at,'قیمت '+R.fa(x.detected_price,0)+' — '+R.pct(x.detected_day_change))}
    <div class="timeline-arrow">←</div>${step('عبور از صفر',x.crossed_zero_at,x.time_to_zero_min!=null?R.fa(x.time_to_zero_min,1)+' دقیقه':'')}
    <div class="timeline-arrow">←</div>${step('رسیدن به +۱٪',x.crossed_plus1_at,x.time_to_plus1_min!=null?R.fa(x.time_to_plus1_min,1)+' دقیقه':'')}
    <div class="timeline-arrow">←</div>${step('رسیدن به +۲٪',x.crossed_plus2_at,x.time_to_plus2_min!=null?R.fa(x.time_to_plus2_min,1)+' دقیقه':'')}
    <div class="timeline-arrow">←</div>${step('رسیدن به +۳٪',x.crossed_plus3_at,x.time_to_plus3_min!=null?R.fa(x.time_to_plus3_min,1)+' دقیقه':'')}
  </div>${chartHTML(x)}<div class="cards"><article class="card"><span>امتیاز شکار</span><b>${R.fa(x.hunt_score,1)}</b></article><article class="card"><span>شواهد هم‌زمان / پویا</span><b>${R.fa(x.evidence_count)} / ${R.fa(x.dynamic_evidence_count)}</b></article><article class="card good-card"><span>بیشترین پیشروی همان‌روز</span><b>${R.pct(x.same_day_mfe_pct)}</b></article><article class="card bad-card"><span>بیشترین افت همان‌روز</span><b>${R.pct(x.same_day_mae_pct)}</b></article><article class="card"><span>تغییر پایانی روز بعد</span><b>${R.pct(x.d1_close_change_pct)}</b></article>${carry}</div>${explainHTML(x)}`;
}
async function loadJourney(){
  R.setStatus('در حال دریافت سفرهای شکار…','warn');
  const d=R.readJalaliInput($('journeyDate'),R.todayIso());
  const select='channel,trade_date,symbol_id,symbol,company_name,asset_type,market,hunt_mode,hunt_state,detected_at,detected_price,detected_day_change,hunt_score,today_opportunity,evidence_count,dynamic_evidence_count,order_pressure,impulse,feasibility,flow_volume,market_context,continuation12,risk_score,cancellation_ratio,gate_reason,crossed_zero_at,crossed_plus1_at,crossed_plus2_at,crossed_plus3_at,time_to_zero_min,time_to_plus1_min,time_to_plus2_min,time_to_plus3_min,same_day_max_change_pct,same_day_close_change_pct,same_day_mfe_pct,same_day_mae_pct,same_day_buy_queue_any,d1_session_date,d1_close_change_pct,d1_return_from_alert_pct,d1_mfe_pct,d1_mae_pct,d1_positive_close,d1_hit_plus1,d1_hit_plus2,d1_hit_plus3,carry_status,carry_peak_price_15m,carry_trough_price_15m,carry_mfe_from_detect_15m,carry_mae_from_detect_15m,carry_mfe_from_cross_15m,carry_mae_from_cross_15m,result_label';
  try{journeyRows=await R.api('stock_hunter_hunt_journey_v416','select='+encodeURIComponent(select)+'&trade_date=eq.'+encodeURIComponent(d)+'&order=detected_at.asc&limit=1500');renderJourney();R.setStatus('سفر شکار در '+R.jalaliDate(d)+' — '+R.fa(journeyRows.length)+' رخداد','ok');}
  catch(e){journeyRows=[];renderJourney();R.setStatus('دریافت سفر شکار ناموفق بود: '+e.message,'bad');}
}
const qp=new URLSearchParams(location.search),qd=qp.get('date'),qs=qp.get('symbol');R.setJalaliInput($('journeyDate'),qd||R.todayIso());if(qs)$('journeySearch').value=qs;$('journeyDate').addEventListener('change',loadJourney);$('journeyDate').addEventListener('keydown',e=>{if(e.key==='Enter')loadJourney();});$('journeyRefresh').onclick=loadJourney;
for(const id of ['journeySearch','journeyChannel','journeyMode','journeyStage'])$(id).addEventListener(id==='journeySearch'?'input':'change',renderJourney);
document.querySelectorAll('.filter-card').forEach(b=>b.onclick=()=>{$('journeyStage').value=b.dataset.stage;renderJourney();});
loadJourney();