'use strict';
const R=StockHunterResearchV416;const $=id=>document.getElementById(id);let healthRows=[];
function ageFa(v){const n=Number(v);if(!Number.isFinite(n))return '—';if(n<60)return R.fa(n)+' ثانیه';if(n<3600)return R.fa(n/60,1)+' دقیقه';return R.fa(n/3600,1)+' ساعت';}
function stateClass(x){
 if(!x)return '';
 if(x.capture_has_error)return 'attn';
 if(x.market_session&&(Number(x.feed_age_seconds)>120||Number(x.capture_age_seconds)>180))return 'attn';
 return 'ok';
}
function latest(){return healthRows[0]||null;}
function renderCards(){
 const x=latest(),pairs=[['hState',x?.overall_state],['hFeedAge',ageFa(x?.feed_age_seconds)],['hCaptureAge',ageFa(x?.capture_age_seconds)],['hSymbols',R.fa(x?.feed_symbols)],['hJourney',R.fa(x?.journey_count_today)],['hBacktest',R.fa(x?.backtest_group_count_today)],['hCarry',R.fa(x?.carry_active_count)],['hMissed',R.fa(x?.missed_count_today)]];
 for(const [id,v] of pairs)$(id).textContent=v??'—';
 for(const [id,obj] of [['hStateCard',x],['hFeedCard',x],['hCaptureCard',x]]){$(id).classList.remove('ok','attn');const c=stateClass(obj);if(c)$(id).classList.add(c);}
}
function chart(){
 if(!healthRows.length){$('healthChart').innerHTML='<div class="empty">تاریخچه‌ای برای این تاریخ وجود ندارد.</div>';return;}
 const a=[...healthRows].reverse(),max=Math.max(60,...a.flatMap(x=>[Number(x.feed_age_seconds)||0,Number(x.capture_age_seconds)||0]).filter(Number.isFinite)),n=Math.max(1,a.length-1);
 const X=i=>45+(i/n)*885,Y=v=>165-(Math.min(max,Math.max(0,v))/max)*125;
 const p=(key,cls)=>'<path class="'+cls+'" d="'+a.map((x,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(Number(x[key])||0).toFixed(1)).join(' ')+'"/>';
 $('healthChart').innerHTML='<svg viewBox="0 0 960 180" preserveAspectRatio="none"><line class="chart-zero" x1="40" x2="940" y1="165" y2="165"/>'+p('feed_age_seconds','health-line feed')+p('capture_age_seconds','health-line capture')+'<text class="chart-label" x="50" y="20">فیروزه‌ای: سن داده بازار</text><text class="chart-label" x="240" y="20">بنفش: سن ثبت شکار</text></svg>';
}
function renderTable(){
 $('healthBody').innerHTML=healthRows.length?healthRows.map(x=>'<tr><td>'+R.time(x.observed_at)+'</td><td>'+R.esc(x.overall_state||'—')+'</td><td>'+R.fa(x.feed_symbols)+'</td><td>'+ageFa(x.feed_age_seconds)+'</td><td>'+ageFa(x.capture_age_seconds)+'</td><td>'+R.fa(x.capture_event_count)+'</td><td>'+R.fa(x.journey_count_today)+'</td><td>'+R.fa(x.backtest_group_count_today)+'</td><td>'+R.fa(x.carry_active_count)+'</td><td>'+R.fa(x.missed_count_today)+'</td></tr>').join(''):'<tr><td colspan="10"><div class="empty">داده‌ای ثبت نشده است.</div></td></tr>';
}
async function loadHealth(){
 const d=R.readJalaliInput($('healthDate'),R.todayIso());R.setStatus('در حال بررسی پایداری '+R.jalaliDate(d)+'…','warn');
 try{
   healthRows=await R.api('stock_hunter_reliability_v416','select=*&trade_date=eq.'+encodeURIComponent(d)+'&order=observed_at.desc&limit=300');
   renderCards();chart();renderTable();const x=latest();R.setStatus('پایداری '+R.jalaliDate(d)+' — '+(x?.overall_state||'داده‌ای ثبت نشده است'),stateClass(x)==='attn'?'bad':'ok');
 }catch(e){healthRows=[];renderCards();chart();renderTable();R.setStatus('دریافت وضعیت پایداری ناموفق بود: '+e.message,'bad');}
}
R.setJalaliInput($('healthDate'),R.todayIso());$('healthDate').addEventListener('change',loadHealth);$('healthDate').addEventListener('keydown',e=>{if(e.key==='Enter')loadHealth();});$('healthRefresh').onclick=loadHealth;loadHealth();