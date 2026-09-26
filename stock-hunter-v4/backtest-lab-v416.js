'use strict';
const R=StockHunterResearchV416;let btRows=[],sliceRows=[],detailRows=[],retentionRows=[];const $=id=>document.getElementById(id);
const channelFa=v=>v==='RADAR'?'شکار زودهنگام':'شکار فعال',modeFa=v=>v==='reversal'?'برگشت از محدوده منفی':'شتاب مثبت اولیه';
const sum=(a,k)=>a.reduce((z,x)=>z+Number(x[k]||0),0),rate=(n,d)=>d?100*n/d:null;
function median(a){const x=a.map(Number).filter(Number.isFinite).sort((m,n)=>m-n);if(!x.length)return null;const i=Math.floor(x.length/2);return x.length%2?x[i]:(x[i-1]+x[i])/2;}
function filters(){return{f:R.readJalaliInput($('btFrom'),R.daysAgoIso(30)),t:R.readJalaliInput($('btTo'),R.todayIso()),ch:$('btChannel').value,m:$('btMode').value,s:$('btState').value};}
function accept(x,z=filters()){return(!z.f||x.trade_date>=z.f)&&(!z.t||x.trade_date<=z.t)&&(!z.ch||x.channel===z.ch)&&(!z.m||x.hunt_mode===z.m)&&(!z.s||x.hunt_state===z.s);}
function filteredBt(){const z=filters();return btRows.filter(x=>accept(x,z));}
function filteredDetails(){const z=filters();return detailRows.filter(x=>accept(x,z));}
function targetHit(x){return x.hunt_mode==='reversal'?!!x.crossed_zero_at:!!x.crossed_plus1_at;}
function renderCards(){
 const d=filteredDetails(),a=filteredBt();
 if(d.length){
   const signals=d.length,precision=d.filter(targetHit).length,zero=d.filter(x=>x.crossed_zero_at).length,p1=d.filter(x=>x.crossed_plus1_at).length,p2=d.filter(x=>x.crossed_plus2_at).length,p3=d.filter(x=>x.crossed_plus3_at).length;
   $('btSignals').textContent=R.fa(signals);$('btPrecision').textContent=R.pct(rate(precision,signals),1);$('btFailures').textContent=R.fa(signals-precision)+' · '+R.pct(rate(signals-precision,signals),1);
   $('btZero').textContent=R.pct(rate(zero,signals),1);$('btPlus1').textContent=R.pct(rate(p1,signals),1);$('btPlus2').textContent=R.pct(rate(p2,signals),1);$('btPlus3').textContent=R.pct(rate(p3,signals),1);
   $('btExcursion').textContent=R.pct(median(d.map(x=>x.same_day_mfe_pct)))+' / '+R.pct(median(d.map(x=>x.same_day_mae_pct)));
   const t0=median(d.map(x=>x.time_to_zero_min)),t1=median(d.map(x=>x.time_to_plus1_min));
   $('btT0').textContent=t0==null?'—':R.fa(t0,1)+' دقیقه';$('btT1').textContent=t1==null?'—':R.fa(t1,1)+' دقیقه';
   $('btPositive').textContent=R.pct(rate(d.filter(x=>Number(x.same_day_close_change_pct)>0).length,signals),1);
   $('btQueue').textContent=R.pct(rate(d.filter(x=>x.same_day_buy_queue_any===true).length,signals),1);
   const d1=d.filter(x=>x.d1_session_date);$('btD1').textContent=R.pct(rate(d1.filter(x=>x.d1_positive_close===true).length,d1.length),1);return;
 }
 const signals=sum(a,'signal_count'),precision=sum(a,'precision_count');
 $('btSignals').textContent=R.fa(signals);$('btPrecision').textContent=R.pct(rate(precision,signals),1);$('btFailures').textContent=R.fa(Math.max(0,signals-precision))+' · '+R.pct(rate(Math.max(0,signals-precision),signals),1);
 $('btZero').textContent=R.pct(rate(sum(a,'crossed_zero_count'),signals),1);$('btPlus1').textContent=R.pct(rate(sum(a,'hit_plus1_count'),signals),1);$('btPlus2').textContent=R.pct(rate(sum(a,'hit_plus2_count'),signals),1);$('btPlus3').textContent=R.pct(rate(sum(a,'hit_plus3_count'),signals),1);
 $('btExcursion').textContent=R.pct(median(a.map(x=>x.median_mfe_pct)))+' / '+R.pct(median(a.map(x=>x.median_mae_pct)));
 $('btT0').textContent=R.fa(median(a.map(x=>x.median_time_to_zero_min)),1)+' دقیقه';$('btT1').textContent=R.fa(median(a.map(x=>x.median_time_to_plus1_min)),1)+' دقیقه';
 $('btPositive').textContent=R.pct(rate(sum(a,'positive_close_count'),signals),1);$('btQueue').textContent=R.pct(rate(sum(a,'buy_queue_count'),signals),1);
 let d1n=sum(a,'d1_observed_count'),d1p=0;for(const x of a){const n=Number(x.d1_observed_count||0),r=Number(x.d1_positive_close_rate);if(Number.isFinite(r))d1p+=n*r/100;}$('btD1').textContent=R.pct(rate(d1p,d1n),1);
}
function renderDaily(){
 const a=filteredBt();
 $('btBody').innerHTML=a.length?[...a].sort((x,y)=>String(y.trade_date).localeCompare(String(x.trade_date))).map(x=>`<tr><td>${R.jalaliDate(x.trade_date)}</td><td>${channelFa(x.channel)}</td><td>${modeFa(x.hunt_mode)}</td><td>${R.esc(x.hunt_state)}</td><td>${R.fa(x.signal_count)}</td><td class="good">${R.pct(x.precision_rate)}</td><td class="teal">${R.pct(x.crossed_zero_rate)}</td><td class="good">${R.pct(x.hit_plus1_rate)}</td><td class="good">${R.pct(x.hit_plus2_rate)}</td><td class="violet">${R.pct(x.hit_plus3_rate)}</td><td class="good">${R.pct(x.median_mfe_pct)}</td><td class="bad">${R.pct(x.median_mae_pct)}</td><td>${x.median_time_to_zero_min==null?'—':R.fa(x.median_time_to_zero_min,1)+' دقیقه'}</td><td>${x.median_time_to_plus1_min==null?'—':R.fa(x.median_time_to_plus1_min,1)+' دقیقه'}</td><td>${R.pct(x.d1_positive_close_rate)}</td></tr>`).join(''):'<tr><td colspan="15"><div class="empty">داده‌ای برای بازه انتخاب‌شده وجود ندارد.</div></td></tr>';
}
function renderSlices(){
 const z=filters(),type=$('btSliceType').value,a=sliceRows.filter(x=>x.slice_type===type&&accept(x,z));
 $('btSliceBody').innerHTML=a.length?[...a].sort((x,y)=>String(y.trade_date).localeCompare(String(x.trade_date))||String(x.slice_value).localeCompare(String(y.slice_value),'fa')).map(x=>{
   const tm=x.hunt_mode==='reversal'?x.median_time_to_zero_min:x.median_time_to_plus1_min;
   return `<tr><td>${R.jalaliDate(x.trade_date)}</td><td><b>${R.esc(x.slice_value)}</b></td><td>${channelFa(x.channel)}</td><td>${modeFa(x.hunt_mode)}</td><td>${R.esc(x.hunt_state)}</td><td>${R.fa(x.signal_count)}</td><td class="good">${R.pct(x.precision_rate)}</td><td class="teal">${R.pct(x.crossed_zero_rate)}</td><td class="good">${R.pct(x.hit_plus1_rate)}</td><td>${R.pct(x.hit_plus2_rate)}</td><td class="violet">${R.pct(x.hit_plus3_rate)}</td><td class="good">${R.pct(x.median_mfe_pct)}</td><td class="bad">${R.pct(x.median_mae_pct)}</td><td>${tm==null?'—':R.fa(tm,1)+' دقیقه'}</td></tr>`;
 }).join(''):'<tr><td colspan="14"><div class="empty">برای این تفکیک داده‌ای وجود ندارد.</div></td></tr>';
}
function renderRetention(){$('retentionGrid').innerHTML=retentionRows.map(x=>`<div class="retention-item"><b>${R.esc(R.datasetFa[x.dataset]||x.dataset)} — ${R.fa(x.retention_days)} روز</b><span>${R.esc(R.tierFa[x.tier]||x.tier)} — ${R.esc(x.purpose)}</span></div>`).join('');}
async function paged(table,q,max=12000){const out=[];for(let o=0;o<max;o+=1000){const p=await R.api(table,q+'&limit=1000&offset='+o);out.push(...p);if(p.length<1000)break;}return out;}
function renderAll(){renderCards();renderDaily();renderSlices();}
async function loadBt(){
 R.setStatus('در حال دریافت داده آزمون تاریخی و برش‌های تحلیلی…','warn');const f=R.readJalaliInput($('btFrom'),R.daysAgoIso(30));
 try{
   const selectDetail='channel,trade_date,symbol_id,hunt_mode,hunt_state,crossed_zero_at,crossed_plus1_at,crossed_plus2_at,crossed_plus3_at,time_to_zero_min,time_to_plus1_min,same_day_close_change_pct,same_day_mfe_pct,same_day_mae_pct,same_day_buy_queue_any,d1_session_date,d1_positive_close';
   [btRows,sliceRows,retentionRows,detailRows]=await Promise.all([
     paged('stock_hunter_backtest_daily_v416','select=*&trade_date=gte.'+encodeURIComponent(f)+'&order=trade_date.desc',8000),
     paged('stock_hunter_backtest_slices_v416','select=*&trade_date=gte.'+encodeURIComponent(f)+'&order=trade_date.desc',12000),
     R.api('stock_hunter_research_retention_v416','select=dataset,retention_days,tier,purpose&order=retention_days.asc'),
     paged('stock_hunter_hunt_journey_v416','select='+encodeURIComponent(selectDetail)+'&trade_date=gte.'+encodeURIComponent(f)+'&order=trade_date.desc',12000)
   ]);
   renderAll();renderRetention();R.setStatus('آزمون تاریخی آماده است — '+R.fa(btRows.length)+' خلاصه روزانه و '+R.fa(sliceRows.length)+' برش تحلیلی.','ok');
 }catch(e){btRows=[];sliceRows=[];detailRows=[];renderAll();R.setStatus('دریافت داده آزمون تاریخی ناموفق بود: '+e.message,'bad');}
}
R.setJalaliInput($('btFrom'),R.daysAgoIso(30));R.setJalaliInput($('btTo'),R.todayIso());$('btRefresh').onclick=loadBt;
$('btFrom').addEventListener('change',loadBt);$('btTo').addEventListener('change',renderAll);
for(const id of ['btChannel','btMode','btState'])$(id).addEventListener('change',renderAll);
$('btSliceType').addEventListener('change',renderSlices);loadBt();