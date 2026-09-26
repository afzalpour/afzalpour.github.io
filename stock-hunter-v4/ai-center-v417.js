import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';
const R=window.StockHunterResearchV416,cfg=window.STOCK_HUNTER_CONFIG||{},$=id=>document.getElementById(id);
const supabase=createClient(String(cfg.SUPABASE_URL||'').replace(/\/$/,''),String(cfg.SUPABASE_PUBLISHABLE_KEY||''),{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
let journeys=[],missed=[],backtest=[],health=[],session=null,aiConfigured=false;
const modeFa=v=>v==='reversal'?'برگشت از محدوده منفی':v==='acceleration'?'شتاب مثبت اولیه':'—';
const median=a=>{const x=a.map(Number).filter(Number.isFinite).sort((m,n)=>m-n);if(!x.length)return null;const i=Math.floor(x.length/2);return x.length%2?x[i]:(x[i-1]+x[i])/2;};

async function healthAi(){
  try{const r=await fetch(String(cfg.SUPABASE_URL).replace(/\/$/,'')+'/functions/v1/stock-hunter-ai-v417?health=1',{headers:{apikey:String(cfg.SUPABASE_PUBLISHABLE_KEY||'')}});const j=await r.json();aiConfigured=!!j.configured;}catch{aiConfigured=false;}
  $('aiModelState').textContent=aiConfigured?'هوش مصنوعی مولد: آماده':'تحلیل محلی فعال';
  $('aiModelState').classList.toggle('success',aiConfigured);
}
async function invoke(mode,payload){
  if(!session||!aiConfigured)return null;
  try{
    const r=await fetch(String(cfg.SUPABASE_URL).replace(/\/$/,'')+'/functions/v1/stock-hunter-ai-v417',{method:'POST',headers:{'Content-Type':'application/json',apikey:String(cfg.SUPABASE_PUBLISHABLE_KEY||''),Authorization:'Bearer '+session.access_token},body:JSON.stringify({mode,payload})});
    if(!r.ok)return null;return await r.json();
  }catch{return null;}
}
function selected(){return journeys.find(x=>String(x.symbol_id)===$('aiSymbol').value)||null;}
function fillSymbols(){
  const map=new Map();for(const x of journeys)if(!map.has(String(x.symbol_id)))map.set(String(x.symbol_id),x);
  $('aiSymbol').innerHTML=map.size?[...map.values()].map(x=>'<option value="'+R.esc(x.symbol_id)+'">'+R.esc(x.symbol)+' — '+modeFa(x.hunt_mode)+'</option>').join(''):'<option value="">رخدادی وجود ندارد</option>';
}
function localAnswer(x,q){
  if(!x)return 'برای این تاریخ رخداد شکار قابل تحلیل وجود ندارد.';
  const metrics=[['فشار سفارش',x.order_pressure],['شتاب حرکت',x.impulse],['امکان رسیدن به هدف',x.feasibility],['جریان و حجم',x.flow_volume],['شرایط بازار',x.market_context],['تداوم',x.continuation12]].filter(a=>Number.isFinite(Number(a[1]))).sort((a,b)=>Number(b[1])-Number(a[1]));
  const strong=metrics.slice(0,3).map(a=>a[0]+' '+R.fa(a[1],1)).join('، ')||'جزئیات مؤلفه‌ها کامل نیست';
  const risks=[];if(Number(x.risk_score)>62)risks.push('ریسک بالا');if(Number(x.cancellation_ratio)>60)risks.push('لغو سفارش بالا');if(Number(x.dynamic_evidence_count)<2)risks.push('شواهد پویای محدود');if(x.gate_reason)risks.push(String(x.gate_reason));
  const qq=String(q||'');
  if(/مانع|ریسک|ضعف/.test(qq))return risks.length?'مهم‌ترین موانع ثبت‌شده: '+risks.join('؛ ')+' .':'در داده ثبت‌شده مانع غالبی دیده نمی‌شود؛ ریسک '+R.fa(x.risk_score,1)+' و نسبت لغو '+R.fa(x.cancellation_ratio,1)+' ثبت شده است.';
  if(/چرا|علت|دلیل/.test(qq))return 'عامل‌های قوی‌تر در لحظه کشف: '+strong+'. امتیاز شکار '+R.fa(x.hunt_score,1)+' با '+R.fa(x.evidence_count)+' شاهد هم‌زمان و '+R.fa(x.dynamic_evidence_count)+' شاهد پویا ثبت شده است.';
  if(/بعد|مرحله|ویژه|فوری/.test(qq))return 'برای تغییر وضعیت باید داده زنده همان موتور دوباره شرایط آستانه‌ای ثابت ۴.۱.۶ را احراز کند. این دستیار آستانه یا امتیاز تازه تولید نمی‌کند. وضعیت فعلی ثبت‌شده «'+String(x.hunt_state||'—')+'» است.';
  return 'خلاصه رخداد '+x.symbol+': مسیر '+modeFa(x.hunt_mode)+'، امتیاز '+R.fa(x.hunt_score,1)+'، تغییر هنگام کشف '+R.pct(x.detected_day_change)+'، ریسک '+R.fa(x.risk_score,1)+'. نقاط قوت: '+strong+'.';
}
function context(x){return {symbol:x?.symbol,company:x?.company_name,trade_date:x?.trade_date,hunt_mode:x?.hunt_mode,hunt_state:x?.hunt_state,detected_day_change:x?.detected_day_change,hunt_score:x?.hunt_score,today_opportunity:x?.today_opportunity,evidence_count:x?.evidence_count,dynamic_evidence_count:x?.dynamic_evidence_count,order_pressure:x?.order_pressure,impulse:x?.impulse,feasibility:x?.feasibility,flow_volume:x?.flow_volume,market_context:x?.market_context,continuation12:x?.continuation12,risk_score:x?.risk_score,cancellation_ratio:x?.cancellation_ratio,gate_reason:x?.gate_reason,crossed_zero:!!x?.crossed_zero_at,crossed_plus1:!!x?.crossed_plus1_at,crossed_plus2:!!x?.crossed_plus2_at,crossed_plus3:!!x?.crossed_plus3_at,same_day_mfe_pct:x?.same_day_mfe_pct,same_day_mae_pct:x?.same_day_mae_pct,d1_close_change_pct:x?.d1_close_change_pct};}
async function ask(){
  const x=selected(),q=$('aiQuestion').value.trim()||'این شکار را توضیح بده.';$('aiAnswer').textContent='در حال تحلیل…';
  const remote=await invoke('assistant',{question:q,context:context(x)});$('aiAnswer').textContent=remote?.text||localAnswer(x,q);
}
function dist(a,b){
  const keys=['order_pressure','impulse','feasibility','flow_volume','market_context','continuation12','risk_score','cancellation_ratio'];let s=0,n=0;
  for(const k of keys){const x=Number(a[k]),y=Number(b[k]);if(Number.isFinite(x)&&Number.isFinite(y)){s+=Math.abs(x-y)/100;n++;}}
  const dc=Math.abs(Number(a.detected_day_change??a.day_change)-Number(b.detected_day_change??b.day_change));if(Number.isFinite(dc)){s+=Math.min(1,dc/5);n++;}
  const hs=Math.abs(Number(a.hunt_score??a.baseline_hunt_score)-Number(b.hunt_score??b.baseline_hunt_score));if(Number.isFinite(hs)){s+=Math.min(1,hs/100);n++;}
  return n?s/n:1;
}
async function similar(){
  const x=selected();if(!x){$('aiSimilarBody').innerHTML='<tr><td colspan="8"><div class="empty">رخدادی انتخاب نشده است.</div></td></tr>';return;}
  R.setStatus('در حال یافتن نمونه‌های تاریخی مشابه…','warn');
  try{
    const from=R.daysAgoIso(180),sel='channel,trade_date,symbol_id,symbol,company_name,hunt_mode,detected_day_change,order_pressure,impulse,feasibility,flow_volume,market_context,continuation12,risk_score,cancellation_ratio,hunt_score,same_day_mfe_pct,same_day_mae_pct,crossed_zero_at,crossed_plus1_at';
    const all=await R.api('stock_hunter_hunt_journey_v416','select='+encodeURIComponent(sel)+'&trade_date=gte.'+from+'&hunt_mode=eq.'+encodeURIComponent(x.hunt_mode)+'&order=trade_date.desc&limit=3000');
    const a=all.filter(z=>(String(z.symbol_id)!==String(x.symbol_id)||z.trade_date!==x.trade_date)&&z.channel===x.channel).map(z=>({...z,_d:dist(x,z)})).sort((m,n)=>m._d-n._d).slice(0,10);
    $('aiSimilarBody').innerHTML=a.length?a.map(z=>{const hit=z.hunt_mode==='reversal'?!!z.crossed_zero_at:!!z.crossed_plus1_at;return '<tr><td>'+R.jalaliDate(z.trade_date)+'</td><td><b>'+R.esc(z.symbol)+'</b></td><td>'+modeFa(z.hunt_mode)+'</td><td>'+R.fa(Math.max(0,100*(1-z._d)),1)+'٪</td><td>'+R.fa(z.hunt_score,1)+'</td><td class="'+(hit?'good':'bad')+'">'+(hit?'موفق':'ناموفق')+'</td><td class="good">'+R.pct(z.same_day_mfe_pct)+'</td><td class="bad">'+R.pct(z.same_day_mae_pct)+'</td></tr>';}).join(''):'<tr><td colspan="8"><div class="empty">نمونه تاریخی کافی برای مقایسه وجود ندارد.</div></td></tr>';
    R.setStatus('نمونه‌های مشابه بر اساس فاصله مؤلفه‌های ثبت‌شده مرتب شدند.','ok');
  }catch(e){R.setStatus('یافتن نمونه‌های مشابه ناموفق بود: '+e.message,'bad');}
}
function localDaily(){
  const zero=journeys.filter(x=>x.crossed_zero_at).length,p1=journeys.filter(x=>x.crossed_plus1_at).length,p3=journeys.filter(x=>x.crossed_plus3_at).length,failed=journeys.filter(x=>x.result_label==='FAILED_SAME_DAY').length;
  const mfe=median(journeys.map(x=>x.same_day_mfe_pct)),mae=median(journeys.map(x=>x.same_day_mae_pct)),h=health[0];
  return 'در این روز '+R.fa(journeys.length)+' رخداد شکار ثبت شد؛ '+R.fa(zero)+' مورد از صفر عبور کردند، '+R.fa(p1)+' مورد به +۱٪ و '+R.fa(p3)+' مورد به +۳٪ رسیدند. '+R.fa(failed)+' شکست همان‌روز ثبت شده است. میانه بیشترین پیشروی '+R.pct(mfe)+' و میانه بیشترین افت '+R.pct(mae)+' بود. '+R.fa(missed.length)+' فرصت از دست‌رفته در ممیزی ثبت شده است. وضعیت پایداری سامانه: '+String(h?.overall_state||'داده‌ای ثبت نشده')+'.';
}
async function daily(){
  $('aiDailyOutput').textContent='در حال ساخت گزارش…';
  const summary={date:R.readJalaliInput($('aiDate'),R.todayIso()),journey_count:journeys.length,zero_count:journeys.filter(x=>x.crossed_zero_at).length,plus1_count:journeys.filter(x=>x.crossed_plus1_at).length,plus2_count:journeys.filter(x=>x.crossed_plus2_at).length,plus3_count:journeys.filter(x=>x.crossed_plus3_at).length,failed_count:journeys.filter(x=>x.result_label==='FAILED_SAME_DAY').length,median_mfe:median(journeys.map(x=>x.same_day_mfe_pct)),median_mae:median(journeys.map(x=>x.same_day_mae_pct)),missed_count:missed.length,high_missed:missed.filter(x=>x.severity==='HIGH').length,backtest_groups:backtest.length,reliability:health[0]||null};
  const remote=await invoke('daily_report',summary);$('aiDailyOutput').textContent=remote?.text||localDaily();
}
function localDiag(){
  const x=health[0];if(!x)return 'برای این تاریخ داده پایداری ثبت نشده است.';
  const issues=[];if(x.capture_has_error)issues.push('ثبت شکار دارای خطا گزارش شده');if(Number(x.feed_age_seconds)>120)issues.push('داده بازار قدیمی است');if(Number(x.capture_age_seconds)>180)issues.push('ثبت شکار عقب افتاده است');if(!issues.length)issues.push('در نماهای ثبت‌شده نشانه غالبی از اختلال مسیر داده دیده نمی‌شود');
  return 'وضعیت کلی «'+String(x.overall_state||'—')+'» است. سن داده بازار '+R.fa(x.feed_age_seconds)+' ثانیه و سن ثبت شکار '+R.fa(x.capture_age_seconds)+' ثانیه است. نتیجه: '+issues.join('؛ ')+'.';
}
async function diagnose(){
  $('aiDiagOutput').textContent='در حال تحلیل سلامت سامانه…';const remote=await invoke('diagnose',{date:R.readJalaliInput($('aiDate'),R.todayIso()),latest:health[0]||null,history:health.slice(0,24)});$('aiDiagOutput').textContent=remote?.text||localDiag();
}
async function load(){
  const d=R.readJalaliInput($('aiDate'),R.todayIso());R.setStatus('در حال دریافت داده '+R.jalaliDate(d)+'…','warn');
  try{
    [journeys,missed,backtest,health]=await Promise.all([
      R.api('stock_hunter_hunt_journey_v416','select=*&trade_date=eq.'+d+'&order=detected_at.asc&limit=1500'),
      R.api('stock_hunter_missed_opportunities_v416','select=*&trade_date=eq.'+d+'&limit=1500'),
      R.api('stock_hunter_backtest_daily_v416','select=*&trade_date=eq.'+d+'&limit=1000'),
      R.api('stock_hunter_reliability_v416','select=*&trade_date=eq.'+d+'&order=observed_at.desc&limit=300')
    ]);fillSymbols();$('aiDailyOutput').textContent=localDaily();$('aiDiagOutput').textContent=localDiag();R.setStatus('داده هوشمند '+R.jalaliDate(d)+' آماده است — '+R.fa(journeys.length)+' رخداد شکار.','ok');
  }catch(e){journeys=[];missed=[];backtest=[];health=[];fillSymbols();R.setStatus('دریافت داده مرکز هوش مصنوعی ناموفق بود: '+e.message,'bad');}
}
const {data}=await supabase.auth.getSession();session=data.session||null;supabase.auth.onAuthStateChange((_e,s)=>session=s);
R.setJalaliInput($('aiDate'),R.todayIso());$('aiDate').onchange=load;$('aiRefresh').onclick=load;$('aiAsk').onclick=ask;$('aiSimilar').onclick=similar;$('aiDaily').onclick=daily;$('aiDiagnose').onclick=diagnose;
await healthAi();await load();