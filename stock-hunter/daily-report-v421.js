'use strict';
(function(){
  const R=window.StockHunterResearchV416,$=id=>document.getElementById(id);if(!R)return;
  let journeys=[],missed=[],health=[];
  const modeFa=v=>v==='reversal'?'برگشت از محدوده منفی':v==='acceleration'?'شتاب مثبت اولیه':'—';
  const resultFa=v=>({HIT_PLUS3:'رسیده به +۳٪',HIT_PLUS2:'رسیده به +۲٪',HIT_PLUS1:'رسیده به +۱٪',CROSSED_ZERO:'عبور از صفر',POSITIVE_CLOSE:'پایان مثبت',FAILED_SAME_DAY:'ناموفق همان‌روز',PENDING:'در انتظار تکمیل'}[v]||'—');
  const median=a=>{const x=a.map(Number).filter(Number.isFinite).sort((m,n)=>m-n);if(!x.length)return null;const i=Math.floor(x.length/2);return x.length%2?x[i]:(x[i-1]+x[i])/2;};
  function tehranNow(){
    const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()),g=t=>p.find(x=>x.type===t)?.value||'';
    return {wd:g('weekday'),hm:Number(g('hour'))*60+Number(g('minute'))};
  }
  function finality(date){
    if(date<R.todayIso())return 'نهایی روز';
    const n=tehranNow();return ['Thu','Fri'].includes(n.wd)||n.hm>=17*60?'نهایی روز':'گزارش موقت تا این لحظه';
  }
  function setCards(){
    $('reportHunts').textContent=R.fa(journeys.length);$('reportZero').textContent=R.fa(journeys.filter(x=>x.crossed_zero_at).length);
    $('reportPlus1').textContent=R.fa(journeys.filter(x=>x.crossed_plus1_at).length);$('reportFailed').textContent=R.fa(journeys.filter(x=>x.result_label==='FAILED_SAME_DAY').length);$('reportMissed').textContent=R.fa(missed.length);
  }
  function renderTop(){
    const a=[...journeys].sort((x,y)=>Number(y.hunt_score)-Number(x.hunt_score)||String(x.symbol||'').localeCompare(String(y.symbol||''),'fa')).slice(0,12);
    $('reportTopBody').innerHTML=a.length?a.map(x=>'<tr><td><b>'+R.esc(x.symbol)+'</b><div class="muted">'+R.esc(x.company_name||'')+'</div></td><td>'+modeFa(x.hunt_mode)+'</td><td>'+R.esc(x.hunt_state||'—')+'</td><td>'+R.fa(x.hunt_score,1)+'</td><td>'+R.pct(x.detected_day_change)+'</td><td class="good">'+R.pct(x.same_day_mfe_pct)+'</td><td class="bad">'+R.pct(x.same_day_mae_pct)+'</td><td>'+resultFa(x.result_label)+'</td></tr>').join(''):'<tr><td colspan="8"><div class="empty">برای این تاریخ شکار ثبت‌شده‌ای وجود ندارد. اگر بازار باز است، نبود رخداد به معنی خرابی سامانه نیست؛ وضعیت پایداری و مسیر داده را بررسی کنید.</div></td></tr>';
  }
  function renderFive(date){
    if(!journeys.length){
      const h=health[0],hs=h?.overall_state?String(h.overall_state):'برای این روز نمونه پایداری ثبت نشده است';
      $('reportFiveMinute').textContent='در '+R.jalaliDate(date)+' رخداد شکار ثبت نشده است. وضعیت سامانه: '+hs+'. برای تشخیص «نبود فرصت» از «نبود داده» صفحه پایداری سامانه را بررسی کنید.';
      return;
    }
    const top=[...journeys].sort((a,b)=>Number(b.hunt_score)-Number(a.hunt_score)).slice(0,3),zero=journeys.filter(x=>x.crossed_zero_at).length,p1=journeys.filter(x=>x.crossed_plus1_at).length,fail=journeys.filter(x=>x.result_label==='FAILED_SAME_DAY').length;
    const lines=['• '+R.fa(journeys.length)+' رخداد شکار ثبت شد؛ '+R.fa(zero)+' مورد از صفر عبور کردند و '+R.fa(p1)+' مورد به +۱٪ رسیدند.'];
    if(top.length)lines.push('• بالاترین امتیازهای ثبت‌شده: '+top.map(x=>x.symbol+' '+R.fa(x.hunt_score,0)).join('، ')+'.');
    lines.push('• '+R.fa(fail)+' رخداد ناموفق همان‌روز و '+R.fa(missed.length)+' فرصت از دست‌رفته در ممیزی ثبت شده است.');
    if(health[0])lines.push('• وضعیت پایداری ثبت‌شده: '+String(health[0].overall_state||'نامشخص')+'.');
    lines.push('• برای قضاوت درباره کیفیت مدل، فقط رخدادهای بالغ‌شده در صفحه «رکورد واقعی» معتبرند؛ این گزارش روزانه جایگزین ارزیابی عملکرد نیست.');
    $('reportFiveMinute').textContent=lines.join('\n');
  }
  function renderNarrative(date){
    if(!journeys.length){$('reportNarrative').textContent='داده کافی برای ساخت روایت روز وجود ندارد. سامانه عدد یا نتیجه ساختگی تولید نمی‌کند.';return;}
    const rev=journeys.filter(x=>x.hunt_mode==='reversal'),acc=journeys.filter(x=>x.hunt_mode==='acceleration'),mfe=median(journeys.map(x=>x.same_day_mfe_pct)),mae=median(journeys.map(x=>x.same_day_mae_pct)),fail=journeys.filter(x=>x.result_label==='FAILED_SAME_DAY').length;
    $('reportNarrative').textContent=finality(date)+' '+R.jalaliDate(date)+': '+R.fa(rev.length)+' رخداد در مسیر برگشت از منفی و '+R.fa(acc.length)+' رخداد در مسیر شتاب مثبت ثبت شد. میانه بیشترین پیشروی '+R.pct(mfe)+' و میانه بیشترین افت '+R.pct(mae)+' بود. '+R.fa(fail)+' شکست همان‌روز ثبت شده است. این اعداد توصیف گذشته‌اند و احتمال موفقیت آینده نیستند.';
  }
  async function load(){
    const d=R.readJalaliInput($('reportDate'),R.todayIso());R.setStatus('در حال دریافت گزارش '+R.jalaliDate(d)+'…','warn');
    try{
      [journeys,missed,health]=await Promise.all([
        R.api('stock_hunter_hunt_journey_v416','select=*&trade_date=eq.'+d+'&order=detected_at.asc&limit=2000'),
        R.api('stock_hunter_missed_opportunities_v416','select=*&trade_date=eq.'+d+'&limit=1500').catch(()=>[]),
        R.api('stock_hunter_reliability_v416','select=*&trade_date=eq.'+d+'&order=observed_at.desc&limit=100').catch(()=>[])
      ]);
      setCards();renderTop();renderFive(d);renderNarrative(d);R.setStatus(finality(d)+' '+R.jalaliDate(d)+' آماده است — '+R.fa(journeys.length)+' رخداد شکار.','ok');
    }catch(e){journeys=[];missed=[];health=[];setCards();renderTop();renderFive(d);renderNarrative(d);R.setStatus('دریافت گزارش ناموفق بود: '+e.message,'bad');}
  }
  const qp=new URLSearchParams(location.search),qd=qp.get('date');R.setJalaliInput($('reportDate'),qd||R.todayIso());$('reportDate').addEventListener('change',load);$('reportRefresh').onclick=load;load();
})();