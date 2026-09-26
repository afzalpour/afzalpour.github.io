'use strict';
const R=StockHunterResearchV416;let missRows=[];const $=id=>document.getElementById(id);
function reasonLabel(x){return x.miss_reason_text||'علت دقیق ثبت نشده است';}
function filteredMiss(){
 const q=$('missSearch').value.trim().toLocaleLowerCase('fa'),sev=$('missSeverity').value,reason=$('missReason').value;
 return missRows.filter(x=>(!q||String(x.symbol||'').toLocaleLowerCase('fa').includes(q)||String(x.company_name||'').toLocaleLowerCase('fa').includes(q))&&(!sev||x.severity===sev)&&(!reason||x.miss_reason_code===reason));
}
function fillReasons(){
 const cur=$('missReason').value,vals=[...new Map(missRows.map(x=>[x.miss_reason_code,reasonLabel(x)])).entries()];
 $('missReason').innerHTML='<option value="">همه علت‌ها</option>'+vals.map(([k,v])=>`<option value="${R.esc(k)}">${R.esc(v)}</option>`).join('');$('missReason').value=cur;
}
function renderMiss(){
 const a=filteredMiss(),maxRb=a.reduce((m,x)=>Math.max(m,Number(x.rebound_points||-Infinity)),-Infinity),maxScore=a.reduce((m,x)=>Math.max(m,Number(x.best_hunt_score||-Infinity)),-Infinity);
 $('mTotal').textContent=R.fa(a.length);$('mHigh').textContent=R.fa(a.filter(x=>x.severity==='HIGH').length);$('mPlus3').textContent=R.fa(a.filter(x=>x.crossed_plus3_at).length);$('mLate').textContent=R.fa(a.filter(x=>x.late_event_at).length);$('mRebound').textContent=Number.isFinite(maxRb)?R.pct(maxRb):'—';$('mScore').textContent=Number.isFinite(maxScore)?R.fa(maxScore,1):'—';
 $('missBody').innerHTML=a.length?a.map(x=>`<tr data-id="${R.esc(x.symbol_id)}"><td><b>${R.esc(x.symbol)}</b><div class="muted">${R.esc(x.company_name||'')}</div><span class="badge ${x.severity==='HIGH'?'high':'medium'}">${x.severity==='HIGH'?'بالا':'متوسط'}</span></td><td class="bad">${R.pct(x.low_change_pct)}</td><td>${R.time(x.low_at)}</td><td class="teal">${R.time(x.crossed_zero_at)}</td><td class="good">${R.time(x.crossed_plus1_at)}</td><td class="good">${R.time(x.crossed_plus2_at)}</td><td class="violet">${R.time(x.crossed_plus3_at)}</td><td class="good">${R.pct(x.peak_change_pct)}</td><td>${R.pct(x.rebound_points)}</td><td>${R.fa(x.best_hunt_score,1)}</td><td>${R.esc(x.best_shadow_state||'—')}</td><td title="${R.esc(reasonLabel(x))}">${R.esc(reasonLabel(x))}</td><td>${R.time(x.late_event_at)}</td></tr>`).join(''):'<tr><td colspan="13"><div class="empty">در این تاریخ و با تعریف فعلی، فرصت از دست‌رفته‌ای ثبت نشده است.</div></td></tr>';
 document.querySelectorAll('#missBody tr[data-id]').forEach(tr=>tr.onclick=()=>showMiss(missRows.find(x=>String(x.symbol_id)===tr.dataset.id)));
}
function showMiss(x){if(!x)return;
 $('missDetail').innerHTML=`<h2>${R.esc(x.symbol)} — ${R.esc(x.company_name||'')}</h2><div class="section-note">تاریخ: ${R.jalaliDate(x.trade_date)} — دلیل ثبت این مورد: ${R.esc(reasonLabel(x))}</div><div class="timeline">
 <div class="timeline-step reached"><span>کف روز</span><b>${R.time(x.low_at)}</b><span>${R.pct(x.low_change_pct)} — قیمت ${R.fa(x.low_price,0)}</span></div><div class="timeline-arrow">←</div>
 <div class="timeline-step ${x.crossed_zero_at?'reached':'pending'}"><span>عبور صفر</span><b>${R.time(x.crossed_zero_at)}</b></div><div class="timeline-arrow">←</div>
 <div class="timeline-step ${x.crossed_plus1_at?'reached':'pending'}"><span>عبور +۱٪</span><b>${R.time(x.crossed_plus1_at)}</b></div><div class="timeline-arrow">←</div>
 <div class="timeline-step reached"><span>اوج پس از کف</span><b>${R.time(x.peak_at)}</b><span>${R.pct(x.peak_change_pct)} — بازگشت ${R.pct(x.rebound_points)}</span></div></div>
 <div class="cards"><article class="card"><span>بهترین امتیاز پیش از +۱٪</span><b>${R.fa(x.best_hunt_score,1)}</b></article><article class="card"><span>قدرت فرصت امروز</span><b>${R.fa(x.best_today_opportunity,1)}</b></article><article class="card ${Number(x.best_risk_score)>62?'bad-card':''}"><span>ریسک</span><b>${R.fa(x.best_risk_score,1)}</b></article><article class="card"><span>شواهد هم‌زمان / پویا</span><b>${R.fa(x.best_evidence_count)} / ${R.fa(x.best_dynamic_evidence_count)}</b></article><article class="card"><span>نزدیک‌ترین وضعیت</span><b>${R.esc(x.best_shadow_state||'—')}</b></article><article class="card warn-card"><span>شکار دیرهنگام</span><b>${R.time(x.late_event_at)}</b></article></div>
 <p class="footnote"><b>علت ثبت‌شده:</b> ${R.esc(reasonLabel(x))}${x.best_gate_reason?'<br><b>شرط توقف:</b> '+R.esc(x.best_gate_reason):''}</p>`;
}
async function loadMiss(){
 R.setStatus('در حال بررسی فرصت‌های از دست‌رفته…','warn');const d=R.readJalaliInput($('missDate'),R.todayIso());
 try{missRows=await R.api('stock_hunter_missed_opportunities_v416','select=*&trade_date=eq.'+encodeURIComponent(d)+'&order=severity.asc,peak_change_pct.desc&limit=1500');fillReasons();renderMiss();R.setStatus('ممیزی '+R.jalaliDate(d)+' — '+R.fa(missRows.length)+' فرصت از دست‌رفته','ok');}
 catch(e){missRows=[];fillReasons();renderMiss();R.setStatus('دریافت گزارش فرصت‌های از دست‌رفته ناموفق بود: '+e.message,'bad');}
}
R.setJalaliInput($('missDate'),R.todayIso());$('missDate').addEventListener('change',loadMiss);$('missDate').addEventListener('keydown',e=>{if(e.key==='Enter')loadMiss();});$('missRefresh').onclick=loadMiss;
for(const id of ['missSearch','missSeverity','missReason'])$(id).addEventListener(id==='missSearch'?'input':'change',renderMiss);
loadMiss();