'use strict';
const R=StockHunterResearchV416;let btRows=[],retentionRows=[];const $=id=>document.getElementById(id);
const channelFa=v=>v==='RADAR'?'زودهنگام':'فعال',modeFa=v=>v==='reversal'?'برگشت':'شتاب';
function filteredBt(){
 const f=$('btFrom').value,t=$('btTo').value,ch=$('btChannel').value,m=$('btMode').value,s=$('btState').value;
 return btRows.filter(x=>(!f||x.trade_date>=f)&&(!t||x.trade_date<=t)&&(!ch||x.channel===ch)&&(!m||x.hunt_mode===m)&&(!s||x.hunt_state===s));
}
const sum=(a,k)=>a.reduce((z,x)=>z+Number(x[k]||0),0);
const weighted=(a,k,w)=>{let n=0,d=0;for(const x of a){const v=Number(x[k]),ww=Number(x[w]||0);if(Number.isFinite(v)&&ww>0){n+=v*ww;d+=ww}}return d?n/d:null};
const rate=(n,d)=>d?100*n/d:null;
function renderBt(){
 const a=filteredBt(),signals=sum(a,'signal_count'),obs=sum(a,'observed_count'),d1=sum(a,'d1_observed_count');
 const zero=sum(a,'crossed_zero_count'),p1=sum(a,'hit_plus1_count'),p2=sum(a,'hit_plus2_count'),p3=sum(a,'hit_plus3_count');
 $('btSignals').textContent=R.fa(signals);$('btZero').textContent=R.pct(rate(zero,signals));$('btPlus1').textContent=R.pct(rate(p1,signals));
 $('btPlus2').textContent=R.pct(rate(p2,signals));$('btPlus3').textContent=R.pct(rate(p3,signals));
 const mfe=weighted(a,'avg_mfe_pct','observed_count'),mae=weighted(a,'avg_mae_pct','observed_count');$('btExcursion').textContent=R.pct(mfe)+' / '+R.pct(mae);
 $('btPositive').textContent=R.pct(rate(sum(a,'positive_close_count'),signals));$('btQueue').textContent=R.pct(rate(sum(a,'buy_queue_count'),signals));
 $('btScore').textContent=R.fa(weighted(a,'avg_hunt_score','signal_count'),1);
 $('btT0').textContent=(weighted(a,'avg_time_to_zero_min','crossed_zero_count')==null?'—':R.fa(weighted(a,'avg_time_to_zero_min','crossed_zero_count'),1)+' دقیقه');
 $('btT1').textContent=(weighted(a,'avg_time_to_plus1_min','hit_plus1_count')==null?'—':R.fa(weighted(a,'avg_time_to_plus1_min','hit_plus1_count'),1)+' دقیقه');
 let d1Pos=0;for(const x of a){const r=Number(x.d1_positive_close_rate),n=Number(x.d1_observed_count||0);if(Number.isFinite(r))d1Pos+=r*n/100;}
 $('btD1').textContent=R.pct(rate(d1Pos,d1));
 $('btBody').innerHTML=a.length?[...a].sort((x,y)=>String(y.trade_date).localeCompare(String(x.trade_date))).map(x=>`<tr><td>${R.jalaliDate(x.trade_date)}</td><td>${channelFa(x.channel)}</td><td>${modeFa(x.hunt_mode)}</td><td>${R.esc(x.hunt_state)}</td><td>${R.fa(x.signal_count)}</td><td>${R.pct(x.crossed_zero_rate)}</td><td>${R.pct(x.hit_plus1_rate)}</td><td>${R.pct(x.hit_plus2_rate)}</td><td>${R.pct(x.hit_plus3_rate)}</td><td>${R.pct(x.positive_close_rate)}</td><td class="good">${R.pct(x.avg_mfe_pct)}</td><td class="bad">${R.pct(x.avg_mae_pct)}</td><td>${x.avg_time_to_plus1_min==null?'—':R.fa(x.avg_time_to_plus1_min,1)+' دقیقه'}</td><td>${R.pct(x.d1_positive_close_rate)}</td></tr>`).join(''):'<tr><td colspan="14"><div class="empty">داده‌ای برای بازه انتخاب‌شده وجود ندارد.</div></td></tr>';
}
function renderRetention(){
 $('retentionGrid').innerHTML=retentionRows.map(x=>`<div class="retention-item"><b>${R.esc(x.dataset)} — ${R.fa(x.retention_days)} روز</b><span>${R.esc(x.tier)} — ${R.esc(x.purpose)}</span></div>`).join('');
}
async function loadBt(){
 R.setStatus('در حال دریافت خلاصه بک‌تست…','warn');
 const from=$('btFrom').value||R.daysAgoIso(30);
 try{
   btRows=await R.api('stock_hunter_backtest_daily_v416','select=*&trade_date=gte.'+encodeURIComponent(from)+'&order=trade_date.desc&limit=5000');
   retentionRows=await R.api('stock_hunter_research_retention_v416','select=dataset,retention_days,tier,purpose&order=retention_days.asc');
   renderBt();renderRetention();R.setStatus('بک‌تست رخدادمحور — '+R.fa(btRows.length)+' ردیف خلاصه روزانه','ok');
 }catch(e){btRows=[];renderBt();R.setStatus('دریافت داده بک‌تست ناموفق بود: '+e.message,'bad');}
}
$('btFrom').value=R.daysAgoIso(30);$('btTo').value=R.todayIso();$('btRefresh').onclick=loadBt;
for(const id of ['btFrom','btTo','btChannel','btMode','btState'])$(id).addEventListener('change',id==='btFrom'?loadBt:renderBt);
loadBt();