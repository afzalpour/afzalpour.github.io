'use strict';
const R=window.StockHunterResearchV416,$=id=>document.getElementById(id),cfg=window.STOCK_HUNTER_CONFIG||{};
const base=String(cfg.SUPABASE_URL||'').replace(/\/$/,'');const key=String(cfg.SUPABASE_PUBLISHABLE_KEY||'');
const collator=new Intl.Collator('fa-IR',{sensitivity:'base',numeric:false,ignorePunctuation:true});
let sb=null,session=null,user=null,dateRows=[],historyRows=null,replayRows=[],replayDecision=null;
const dateCache=new Map(),relCache=new Map();
const faPath={reversal:'برگشت از منفی',acceleration:'شتاب‌گیری'};
const decisionFa={OBSERVED:'مشاهده کردم',ENTERED:'وارد شدم',SKIPPED:'وارد نشدم'};
const ctxFa={LIVE:'واقعی',REPLAY:'تمرینی'};
function status(t,s='ok'){$('proStatus').textContent=t;$('proStatus').dataset.state=s;}
function n(v){const x=Number(R.latinDigits(String(v??'')).replace(/,/g,'').replace(/٫/g,'.'));return Number.isFinite(x)?x:null;}
function avg(a){const v=a.map(Number).filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null;}
function med(a){const v=a.map(Number).filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;}
function success(x){return x?.hunt_mode==='reversal'?!!x.crossed_zero_at:!!x.crossed_plus1_at;}
function observed(x){return x&&(x.same_day_mfe_pct!=null||x.same_day_close_change_pct!=null||x.result_label!=null||x.crossed_zero_at||x.crossed_plus1_at||x.crossed_plus2_at||x.crossed_plus3_at);}
function successRate(rows){const obs=(rows||[]).filter(observed);return obs.length?100*obs.filter(success).length/obs.length:null;}
function faPct(v,d=1){return v==null?'—':R.fa(v,d)+'٪';}
function setMetric(id,v){$(id).textContent=v;}
function esc(v){return R.esc(v);}
function evidence(title,text,cls=''){return '<article class="'+cls+'"><b>'+esc(title)+'</b><span>'+esc(text)+'</span></article>';}
function optionRows(rows){const m=new Map();for(const x of rows){if(!m.has(String(x.symbol_id)))m.set(String(x.symbol_id),x);}return [...m.values()].sort((a,b)=>collator.compare(a.symbol||'',b.symbol||''));}
function fillSymbols(select,rows,placeholder='نمادی ثبت نشده است'){const old=select.value;const a=optionRows(rows);select.innerHTML=a.length?a.map(x=>'<option value="'+esc(x.symbol_id)+'">'+esc(x.symbol)+'</option>').join(''):'<option value="">'+placeholder+'</option>';if(a.some(x=>String(x.symbol_id)===old))select.value=old;return a;}
async function initAuth(){
 try{const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm');sb=createClient(base,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});const r=await sb.auth.getSession();session=r.data.session||null;user=session?.user||null;}catch{}
}
async function loadDate(date){
 if(dateCache.has(date))return dateCache.get(date);
 const q='select=*&trade_date=eq.'+encodeURIComponent(date)+'&order=detected_at.asc&limit=2500';
 const rows=await R.api('stock_hunter_hunt_journey_v416',q);dateCache.set(date,rows);return rows;
}
async function loadReliability(date){
 if(relCache.has(date))return relCache.get(date);
 const a=await R.api('stock_hunter_reliability_v416','select=*&trade_date=eq.'+encodeURIComponent(date)+'&order=observed_at.desc&limit=1').catch(()=>[]);
 const x=a[0]||null;relCache.set(date,x);return x;
}
async function loadHistory(){
 if(historyRows)return historyRows;
 const from=R.daysAgoIso(180);historyRows=await R.api('stock_hunter_hunt_journey_v416','select=*&trade_date=gte.'+from+'&order=trade_date.asc,detected_at.asc&limit=5000');return historyRows;
}
function distance(a,b){
 const ks=['order_pressure','impulse','feasibility','flow_volume','market_context','continuation12','risk_score','cancellation_ratio'];let s=0,c=0;
 for(const k of ks){const x=Number(a?.[k]),y=Number(b?.[k]);if(Number.isFinite(x)&&Number.isFinite(y)){s+=Math.abs(x-y)/100;c++;}}
 const dx=Math.abs(Number(a?.detected_day_change)-Number(b?.detected_day_change));if(Number.isFinite(dx)){s+=Math.min(1,dx/5);c++;}return c?s/c:1;
}
async function confidence(){
 const sid=$('confidenceSymbol').value,j=dateRows.find(x=>String(x.symbol_id)===String(sid));if(!j)return;
 const rel=await loadReliability(j.trade_date),hist=await loadHistory();
 const similar=hist.filter(x=>x.trade_date!==j.trade_date&&x.hunt_mode===j.hunt_mode&&x.channel===j.channel).map(x=>({...x,_d:distance(j,x)})).filter(x=>x._d<=.22).sort((a,b)=>a._d-b._d);
 const ev=Math.min(25,Math.max(0,(Number(j.evidence_count)||0)/4*16+(Number(j.dynamic_evidence_count)||0)/3*9));
 const risk=Math.max(0,20*(1-(Number(j.risk_score)||50)/100));
 const cancel=Math.max(0,15*(1-(Number(j.cancellation_ratio)||50)/100));
 const health=rel?.overall_state==='سالم'||rel?.overall_state==='OK'||rel?.overall_state==='ok'?20:(rel?11:7);
 const history=Math.min(20,similar.length/25*20);
 const score=Math.round(Math.max(0,Math.min(100,ev+risk+cancel+health+history)));
 const label=score>=75?'اطمینان بالا':score>=55?'اطمینان متوسط':'اطمینان محدود';
 $('confidenceGauge').style.setProperty('--p',score);setMetric('confidenceScore',R.fa(score));setMetric('confidenceLabel',label);
 $('confidenceEvidence').innerHTML=[
  evidence('کفایت شواهد','شواهد '+R.fa(j.evidence_count||0)+' · شواهد پویا '+R.fa(j.dynamic_evidence_count||0)),
  evidence('ریسک و لغو سفارش','ریسک '+R.fa(j.risk_score,1)+' · لغو '+R.fa(j.cancellation_ratio,1)),
  evidence('سلامت داده',rel?String(rel.overall_state||'نامشخص'):'نمونه پایداری برای این روز ثبت نشده است'),
  evidence('نمونه تاریخی مشابه',R.fa(similar.length)+' نمونه در ۱۸۰ روز؛ موفقیت ثبت‌شده '+faPct(successRate(similar),1))
 ].join('');
 renderPassport(j,similar,rel);
}
function renderPassport(j,similar,rel){
 const pairs=[['نماد',j.symbol],['شرکت',j.company_name||'—'],['تاریخ',R.jalaliDate(j.trade_date)],['زمان کشف',R.time(j.detected_at)],['مسیر',faPath[j.hunt_mode]||j.hunt_mode],['وضعیت',j.hunt_state],['امتیاز شکار',R.fa(j.hunt_score,1)],['تغییر زمان کشف',R.pct(j.detected_day_change)],['ریسک',R.fa(j.risk_score,1)],['شرایط بازار',R.fa(j.market_context,1)],['نمونه مشابه',R.fa(similar.length)],['سلامت سامانه',rel?.overall_state||'—']];
 $('passportGrid').innerHTML=pairs.map(p=>'<div><span>'+esc(p[0])+'</span><b>'+esc(p[1])+'</b></div>').join('');
 $('passportOutcome').innerHTML=[
 evidence('عبور از صفر',j.crossed_zero_at?'ثبت شده در '+R.time(j.crossed_zero_at):'ثبت نشده'),
 evidence('رسیدن به +۱٪',j.crossed_plus1_at?'ثبت شده در '+R.time(j.crossed_plus1_at):'ثبت نشده'),
 evidence('رسیدن به +۲٪',j.crossed_plus2_at?'ثبت شده در '+R.time(j.crossed_plus2_at):'ثبت نشده'),
 evidence('رسیدن به +۳٪',j.crossed_plus3_at?'ثبت شده در '+R.time(j.crossed_plus3_at):'ثبت نشده'),
 evidence('پیشروی / افت','پیشروی '+R.pct(j.same_day_mfe_pct)+' · افت '+R.pct(j.same_day_mae_pct))
 ].join('');
 const metrics=[['فشار سفارش',j.order_pressure],['شتاب حرکت',j.impulse],['امکان رسیدن به هدف',j.feasibility],['جریان و حجم',j.flow_volume],['شرایط بازار',j.market_context],['تداوم',j.continuation12],['ریسک',j.risk_score],['لغو سفارش',j.cancellation_ratio]];
 $('passportEvidenceBody').innerHTML=metrics.map(([k,v])=>{const z=Number(v);let t='داده کافی نیست';if(Number.isFinite(z))t=(k==='ریسک'||k==='لغو سفارش')?(z<=45?'مطلوب':z<=65?'نیازمند توجه':'مانع مهم'):(z>=70?'قوی':z>=50?'متوسط':'ضعیف');return '<tr><td>'+k+'</td><td>'+R.fa(v,1)+'</td><td>'+t+'</td><td><span class="pro-source">سفر شکار · '+R.jalaliDate(j.trade_date)+'</span></td></tr>';}).join('');
}
async function loadConfidenceDay(){
 const d=R.readJalaliInput($('confidenceDate'),R.todayIso());status('در حال دریافت پرونده‌های شکار '+R.jalaliDate(d)+'…','warn');
 try{dateRows=await loadDate(d);for(const id of ['confidenceSymbol','execSymbol','evidenceSymbol','journalSymbol'])fillSymbols($(id),dateRows);await confidence();status('پرونده حرفه‌ای '+R.jalaliDate(d)+' آماده است.','ok');}
 catch(e){status('دریافت پرونده حرفه‌ای ناموفق بود: '+e.message,'bad');}
}
const fieldMap={baseline_hunt_score:'hunt_score',baseline_today_opportunity:'today_opportunity',baseline_state:'hunt_state'};
function testRule(row,r,factor=1){const k=fieldMap[r.field]||r.field,a=row[k],op=r.op||'>=',raw=r.value;if(typeof raw==='number'||Number.isFinite(Number(raw))){const base=Number(raw),b=factor===1?base:((op==='>='||op==='>')?base*factor:(op==='<='||op==='<')?base/factor:base),x=Number(a);if(!Number.isFinite(x))return false;if(op==='>=')return x>=b;if(op==='<=')return x<=b;if(op==='>')return x>b;if(op==='<')return x<b;if(op==='==')return x===b;if(op==='!=')return x!==b;}const x=String(a??''),b=String(raw??'');return op==='!='?x!==b:x===b;}
function applyStrategy(row,s,factor=1){if(!s||s.strategy_id==='__hunt__')return true;const rules=Array.isArray(s.rules)?s.rules:[];if(!rules.length)return true;const v=rules.map(r=>testRule(row,r,factor));return s.match_mode==='ANY'?v.some(Boolean):v.every(Boolean);}
async function loadStrategies(){
 if(!sb||!user)return;const {data}=await sb.from('stock_hunter_user_strategies_v417').select('strategy_id,name,match_mode,rules').eq('user_id',user.id).order('created_at',{ascending:true});
 const sel=$('robustStrategy');sel.innerHTML='<option value="__hunt__">موتور ثابت شکار</option>'+(data||[]).sort((a,b)=>collator.compare(a.name,b.name)).map(x=>'<option value="'+esc(x.strategy_id)+'">'+esc(x.name)+'</option>').join('');sel._rows=data||[];
}
function stats(rows){const obs=rows.filter(observed);return {n:rows.length,observed:obs.length,success:obs.filter(success).length,rate:successRate(obs),mfe:med(obs.map(x=>x.same_day_mfe_pct))};}
async function runRobustness(){
 const a=R.readJalaliInput($('robustStart'),R.daysAgoIso(90)),b=R.readJalaliInput($('robustEnd'),R.todayIso());status('در حال اجرای آزمون استحکام…','warn');
 try{
  const rows=await R.api('stock_hunter_hunt_journey_v416','select=*&trade_date=gte.'+a+'&trade_date=lte.'+b+'&order=trade_date.asc,detected_at.asc&limit=5000');
  const sid=$('robustStrategy').value,s=sid==='__hunt__'?{strategy_id:'__hunt__'}:($('robustStrategy')._rows||[]).find(x=>x.strategy_id===sid);
  const observedRows=rows.filter(observed),factors=sid==='__hunt__'?[1]:[.95,1,1.05];const baseRows=observedRows.filter(x=>applyStrategy(x,s,1));
  const cut=Math.max(1,Math.floor(baseRows.length*.7)),ins=baseRows.slice(0,cut),oos=baseRows.slice(cut),isRate=successRate(ins),oosRate=successRate(oos);
  setMetric('robustCount',R.fa(baseRows.length));setMetric('robustOos',faPct(oosRate,1));setMetric('robustDrop',isRate==null||oosRate==null?'—':R.fa(oosRate-isRate,1)+' واحد درصد');
  const variants=factors.map(f=>({f,rows:observedRows.filter(x=>applyStrategy(x,s,f))}));const vr=variants.map(x=>successRate(x.rows)).filter(Number.isFinite);const spread=vr.length?Math.max(...vr)-Math.min(...vr):null;setMetric('robustStability',spread==null?'—':spread<=8?'پایدار':spread<=15?'متوسط':'حساس');
  $('robustBody').innerHTML=[['درون‌نمونه',ins,isRate,0],['خارج‌ازنمونه',oos,oosRate,oosRate==null||isRate==null?null:oosRate-isRate],...variants.filter(x=>x.f!==1).map(x=>['حساسیت پارامتر '+(x.f<1?'۵٪ آسان‌تر':'۵٪ سخت‌تر'),x.rows,successRate(x.rows),successRate(x.rows)==null||successRate(baseRows)==null?null:successRate(x.rows)-successRate(baseRows)])].map(x=>'<tr><td>'+x[0]+'</td><td>'+R.fa(x[1].length)+'</td><td>'+faPct(x[2],1)+'</td><td>'+faPct(x[3],1)+'</td></tr>').join('');
  const groups=new Map();for(const x of baseRows){const k=x.symbol||x.symbol_id;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x);}
  $('groupBody').innerHTML=[...groups.entries()].map(([symbol,a])=>({symbol,...stats(a)})).sort((x,y)=>y.n-x.n||collator.compare(x.symbol,y.symbol)).slice(0,80).map(x=>'<tr><td>'+esc(x.symbol)+'</td><td>'+R.fa(x.n)+'</td><td>'+R.fa(x.success)+'</td><td>'+faPct(x.rate,1)+'</td><td>'+R.pct(x.mfe)+'</td></tr>').join('');
  status('آزمون استحکام و آزمون گروهی تکمیل شد.','ok');
 }catch(e){status('آزمون استحکام ناموفق بود: '+e.message,'bad');}
}
async function runExecution(){
 const d=R.readJalaliInput($('execDate'),R.todayIso()),sid=$('execSymbol').value,j=(await loadDate(d)).find(x=>String(x.symbol_id)===String(sid));if(!j)return;
 status('در حال شبیه‌سازی اجرای واقعی…','warn');
 try{
  const all=await R.api('stock_hunter_market_replay_v416','select=*&trade_date=eq.'+d+'&symbol_id=eq.'+encodeURIComponent(sid)+'&order=bucket_at.asc&limit=2500');
  const res=[...new Set(all.map(x=>Number(x.bucket_seconds)||300))].sort((a,b)=>a-b)[0];const rows=all.filter(x=>(Number(x.bucket_seconds)||300)===res);
  const delay=Math.max(0,n($('execDelay').value)||0),part=Math.max(1,Math.min(100,n($('execParticipation').value)||10)),capital=Math.max(1,n($('execCapital').value)||1000);
  const target=new Date(j.detected_at).getTime()+delay*1000,snap=rows.find(x=>new Date(x.bucket_at).getTime()>=target)||rows[rows.length-1];if(!snap)throw new Error('نمای بازپخش کافی برای این نماد وجود ندارد');
  const price=Number(snap.close_price||j.detected_price)||1,qty=capital*1e6/price,volume=Math.max(0,Number(snap.last_volume)||0),available=Math.max(1,volume*part/100),fill=Math.min(1,available/qty);
  const buy=Math.max(0,Number(snap.max_buy_queue)||0),sell=Math.max(0,Number(snap.max_sell_queue)||0),queuePressure=(buy+sell)>0?sell/(buy+sell):.5;
  const slip=Math.min(1.5,.25*(delay/120)+.4*queuePressure+.8*(1-fill)),theory=Number(j.same_day_mfe_pct),real=Number.isFinite(theory)?fill*Math.max(-20,theory-slip):null;
  setMetric('execFill',faPct(fill*100,1));setMetric('execSlip',faPct(slip,2));setMetric('execTheory',R.pct(theory));setMetric('execReal',R.pct(real));
  $('execDetails').innerHTML=[evidence('قیمت ورود برآوردی',R.fa(price,0)+' ریال در '+R.time(snap.bucket_at)),evidence('حجم سفارش فرضی',R.fa(qty,0)+' سهم با سرمایه '+R.fa(capital,0)+' میلیون ریال'),evidence('ظرفیت قابل مشارکت',R.fa(available,0)+' سهم با سقف مشارکت '+R.fa(part,1)+'٪'),evidence('وضعیت صف','صف خرید '+R.fa(buy,0)+' · صف فروش '+R.fa(sell,0)),evidence('تفکیک بازپخش',R.fa(res)+' ثانیه')].join('');
  status('شبیه‌سازی اجرا تکمیل شد.','ok');
 }catch(e){status('شبیه‌سازی اجرا ناموفق بود: '+e.message,'bad');}
}
function summarizeDay(rows,date){
 const rate=successRate(rows);return {date,n:rows.length,rate,score:avg(rows.map(x=>x.hunt_score)),risk:avg(rows.map(x=>x.risk_score)),market:avg(rows.map(x=>x.market_context)),change:avg(rows.map(x=>x.detected_day_change)),cancel:avg(rows.map(x=>x.cancellation_ratio))};
}
function classifyRegime(s){
 if(!s||s.n<4)return'داده کم';if((s.risk||0)>=65||(s.cancel||0)>=65)return'ریسک و لغو بالا';if((s.market||0)>=65&&(s.change||0)>.35)return'فشار خرید';if((s.market||100)<=40&&(s.change||0)<-.25)return'فشار فروش';if(Math.abs(s.change||0)<.35)return'کم‌نوسان و متعادل';return'ترکیبی';
}
async function runRegime(){
 const d=R.readJalaliInput($('regimeDate'),R.todayIso());status('در حال تحلیل رژیم و فرسایش…','warn');
 try{
  const from=R.addDaysIso(d,-44),rows=await R.api('stock_hunter_hunt_journey_v416','select=*&trade_date=gte.'+from+'&trade_date=lte.'+d+'&order=trade_date.asc,detected_at.asc&limit=5000'),rel=await loadReliability(d);
  const map=new Map();for(const x of rows){if(!map.has(x.trade_date))map.set(x.trade_date,[]);map.get(x.trade_date).push(x);}const days=[...map.entries()].map(([date,a])=>summarizeDay(a,date)).sort((a,b)=>a.date.localeCompare(b.date));
  const today=days.find(x=>x.date===d)||summarizeDay([],d),recent=days.slice(-7),prior=days.slice(-37,-7),rr=successRate(recent.flatMap(x=>map.get(x.date)||[])),pr=successRate(prior.flatMap(x=>map.get(x.date)||[])),delta=rr==null||pr==null?null:rr-pr;
  setMetric('regimeLabel',classifyRegime(today));setMetric('regimeHealth',rel?.overall_state||'نامشخص');setMetric('driftRecent',faPct(rr,1));setMetric('driftDelta',delta==null?'—':R.fa(delta,1)+' واحد درصد');
  $('regimeEvidence').innerHTML=[evidence('شرایط بازار',R.fa(today.market,1)),evidence('ریسک میانگین',R.fa(today.risk,1)),evidence('لغو سفارش میانگین',R.fa(today.cancel,1)),evidence('تغییر روز در لحظه شکار',R.pct(today.change)),evidence('تعداد شکار ثبت‌شده',R.fa(today.n))].join('');
  let driftText=delta==null?'داده کافی برای مقایسه وجود ندارد.':delta<=-12?'افت معنی‌دار عملیاتی دیده می‌شود و نیازمند بررسی است.':delta<=-6?'نشانه افت متوسط دیده می‌شود.':delta>=8?'عملکرد اخیر بهتر از مبناست؛ برای نتیجه‌گیری قطعی نمونه بیشتری لازم است.':'تغییر اخیر در محدوده عادی قرار دارد.';
  $('driftEvidence').innerHTML=[evidence('مبنای مقایسه',faPct(pr,1)+' در بازه پیشین'),evidence('هفت روز اخیر',faPct(rr,1)),evidence('برداشت',driftText)].join('');
  $('regimeHistoryBody').innerHTML=days.slice().reverse().map(x=>'<tr><td>'+R.jalaliDate(x.date)+'</td><td>'+R.fa(x.n)+'</td><td>'+faPct(x.rate,1)+'</td><td>'+R.fa(x.score,1)+'</td><td>'+R.fa(x.risk,1)+'</td><td>'+R.fa(x.market,1)+'</td></tr>').join('');
  status('تحلیل رژیم و فرسایش تکمیل شد.','ok');
 }catch(e){status('تحلیل رژیم ناموفق بود: '+e.message,'bad');}
}
function smartRule(){return {mode:$('smartMode').value||null,min_score:n($('smartScore').value)??65,max_risk:n($('smartRisk').value)??60};}
function smartMatch(x,r){return (!r.mode||x.hunt_mode===r.mode)&&Number(x.hunt_score)>=r.min_score&&Number(x.risk_score)<=r.max_risk;}
function renderSmart(rows){$('smartBody').innerHTML=rows.length?rows.sort((a,b)=>Number(b.hunt_score)-Number(a.hunt_score)||collator.compare(a.symbol,b.symbol)).map(x=>'<tr><td>'+esc(x.symbol)+'</td><td>'+esc(x.hunt_state)+'</td><td>'+esc(faPath[x.hunt_mode]||x.hunt_mode)+'</td><td>'+R.fa(x.hunt_score,1)+'</td><td>'+R.fa(x.risk_score,1)+'</td><td>'+R.pct(x.detected_day_change)+'</td><td><a href="hunt-journey-v416.html?symbol_id='+encodeURIComponent(x.symbol_id)+'">سفر شکار</a></td></tr>').join(''):'<tr><td colspan="7">نمادی با این قواعد پیدا نشد.</td></tr>';}
function scanSmart(){renderSmart(dateRows.filter(x=>smartMatch(x,smartRule())));}
async function loadSmartSaved(){
 if(!sb||!user){$('smartSaved').innerHTML='<div class="pro-note">برای ذخیره دیده‌بان پویا وارد حساب شوید.</div>';return;}
 const {data,error}=await sb.from('stock_hunter_smart_watchlists_v420').select('*').eq('user_id',user.id).order('updated_at',{ascending:false});if(error){$('smartSaved').innerHTML='<div class="pro-note bad">دریافت دیده‌بان‌ها ناموفق بود.</div>';return;}
 $('smartSaved').innerHTML=(data||[]).length?(data||[]).sort((a,b)=>collator.compare(a.name,b.name)).map(x=>'<article class="pro-item"><div class="pro-item-head"><div><b>'+esc(x.name)+'</b><small>حداقل امتیاز '+R.fa(x.rule_json?.min_score)+' · حداکثر ریسک '+R.fa(x.rule_json?.max_risk)+'</small></div><span class="badge">'+(x.enabled?'فعال':'خاموش')+'</span></div><div class="pro-item-actions"><button data-smart-load="'+x.smart_watchlist_id+'">بارگذاری</button><button data-smart-delete="'+x.smart_watchlist_id+'">حذف</button></div></article>').join(''):'<div class="pro-note">هنوز دیده‌بان هوشمندی ذخیره نشده است.</div>';$('smartSaved')._rows=data||[];
}
async function saveSmart(){
 if(!sb||!user){status('برای ذخیره دیده‌بان هوشمند ابتدا وارد حساب شوید.','warn');return;}const name=$('smartName').value.trim().slice(0,80);if(!name)return;
 const {error}=await sb.from('stock_hunter_smart_watchlists_v420').upsert({user_id:user.id,name,rule_json:smartRule(),enabled:true,updated_at:new Date().toISOString()},{onConflict:'user_id,name'});if(error){status('ذخیره دیده‌بان ناموفق بود: '+error.message,'bad');return;}await loadSmartSaved();status('دیده‌بان هوشمند ذخیره شد.','ok');
}
function selectedEvidenceJourney(){return dateRows.find(x=>String(x.symbol_id)===String($('evidenceSymbol').value));}
function sourceChip(i,t){return '<span class="pro-source">['+R.fa(i)+'] '+esc(t)+'</span>';}
async function askEvidence(){
 const j=selectedEvidenceJourney();if(!j)return;const metrics=[['فشار سفارش',j.order_pressure],['شتاب حرکت',j.impulse],['امکان رسیدن به هدف',j.feasibility],['جریان و حجم',j.flow_volume],['شرایط بازار',j.market_context],['تداوم',j.continuation12]].filter(x=>Number.isFinite(Number(x[1]))).sort((a,b)=>Number(b[1])-Number(a[1]));
 const top=metrics.slice(0,3).map(x=>x[0]+' '+R.fa(x[1],1)).join('، '),weak=metrics.slice().reverse().slice(0,2).map(x=>x[0]+' '+R.fa(x[1],1)).join('، ');
 $('evidenceAnswer').textContent='بر اساس داده ثبت‌شده همان رخداد، عوامل قوی‌تر «'+top+'» هستند [۱]. امتیاز شکار '+R.fa(j.hunt_score,1)+' و وضعیت «'+j.hunt_state+'» ثبت شده است [۲]. در سمت ریسک، ریسک '+R.fa(j.risk_score,1)+' و نسبت لغو سفارش '+R.fa(j.cancellation_ratio,1)+' است [۳]. نقاط ضعیف‌تر این نمونه «'+weak+'» هستند [۴]. این جمع‌بندی فقط تفسیر داده ثبت‌شده است و آستانه یا امتیاز تازه‌ای به موتور اضافه نمی‌کند.';
 $('evidenceSources').innerHTML=sourceChip(1,'مولفه‌های سفر شکار · '+R.jalaliDate(j.trade_date))+sourceChip(2,'امتیاز و وضعیت موتور ۴.۱.۶')+sourceChip(3,'ریسک و لغو سفارش ثبت‌شده')+sourceChip(4,'مقایسه داخلی مولفه‌های همان رخداد');
}
async function runAgent(){
 const d=R.readJalaliInput($('confidenceDate'),R.todayIso()),mission=$('agentMission').value,j=selectedEvidenceJourney();$('agentOutput').textContent='در حال اجرای گردش‌کار چندمرحله‌ای…';
 try{
  const [miss,bt,rel]=await Promise.all([
   R.api('stock_hunter_missed_opportunities_v416','select=*&trade_date=eq.'+d+'&limit=500').catch(()=>[]),
   R.api('stock_hunter_backtest_daily_v416','select=*&trade_date=eq.'+d+'&limit=100').catch(()=>[]),
   loadReliability(d)
  ]);
  const rows=await loadDate(d),failed=rows.filter(x=>!success(x)),rate=successRate(rows),mfe=med(rows.map(x=>x.same_day_mfe_pct)),mae=med(rows.map(x=>x.same_day_mae_pct));
  let lines=['ماموریت عامل: '+$('agentMission').selectedOptions[0].textContent,'۱) سفر شکار: '+R.fa(rows.length)+' رخداد؛ موفقیت ثبت‌شده '+faPct(rate,1)+'.','۲) نتیجه حرکت: پیشروی میانه '+R.pct(mfe)+' و افت میانه '+R.pct(mae)+'.','۳) فرصت‌های از دست‌رفته: '+R.fa(miss.length)+' مورد.','۴) آزمون تاریخی: '+R.fa(bt.length)+' گروه خلاصه ثبت‌شده.','۵) سلامت سامانه: '+String(rel?.overall_state||'نمونه‌ای ثبت نشده است')+'.'];
  if(mission==='failed')lines.push('تمرکز ماموریت: '+R.fa(failed.length)+' شکار به هدف مسیر نرسیده‌اند؛ ریسک میانگین آن‌ها '+R.fa(avg(failed.map(x=>x.risk_score)),1)+' و لغو سفارش '+R.fa(avg(failed.map(x=>x.cancellation_ratio)),1)+'.');
  if(mission==='symbol'&&j)lines.push('پرونده نماد '+j.symbol+': وضعیت '+j.hunt_state+'، امتیاز '+R.fa(j.hunt_score,1)+'، پیشروی '+R.pct(j.same_day_mfe_pct)+'، افت '+R.pct(j.same_day_mae_pct)+'.');
  if(mission==='missed')lines.push(miss.length?'تمرکز ماموریت روی فرصت‌های از دست‌رفته انجام شد؛ برای هر مورد منبع ثبت‌شده باید جداگانه بررسی شود.':'برای این روز فرصت از دست‌رفته ثبت نشده است.');
  lines.push('جمع‌بندی: این گزارش از چند منبع ثبت‌شده ساخته شده و موتور شکار را تغییر نمی‌دهد.');
  $('agentOutput').textContent=lines.join('\n');
 }catch(e){$('agentOutput').textContent='اجرای گردش‌کار ناموفق بود: '+e.message;}
}
async function loadJournal(){
 if(!sb||!user){$('journalBody').innerHTML='<tr><td colspan="7">برای استفاده از دفترچه تصمیم وارد حساب شوید.</td></tr>';$('journalInsight').innerHTML=evidence('وضعیت','ورود کاربر برای همگام‌سازی دفترچه لازم است.');return;}
 const d=R.readJalaliInput($('journalDate'),R.todayIso());const {data,error}=await sb.from('stock_hunter_decision_journal_v420').select('*').eq('user_id',user.id).eq('trade_date',d).order('created_at',{ascending:false});if(error)return;
 const rows=data||[];$('journalBody').innerHTML=rows.length?rows.map(x=>'<tr><td>'+R.jalaliDate(x.trade_date)+'</td><td>'+esc(x.symbol)+'</td><td>'+ctxFa[x.context]+'</td><td>'+decisionFa[x.decision]+'</td><td>'+esc(x.reason||'—')+'</td><td>'+R.pct(x.outcome_pct)+'</td><td>'+R.dateTime(x.created_at)+'</td></tr>').join(''):'<tr><td colspan="7">تصمیمی برای این روز ثبت نشده است.</td></tr>';
 const skipped=rows.filter(x=>x.decision==='SKIPPED'),skippedGood=skipped.filter(x=>Number(x.outcome_pct)>=1);$('journalInsight').innerHTML=[evidence('کل تصمیم‌ها',R.fa(rows.length)),evidence('ورودها',R.fa(rows.filter(x=>x.decision==='ENTERED').length)),evidence('عدم ورودها',R.fa(skipped.length)),evidence('عدم ورودهای با نتیجه +۱٪ یا بیشتر',R.fa(skippedGood.length))].join('');
}
async function saveJournal(context='LIVE',decisionOverride=null,extra={}){
 if(!sb||!user){status('برای ثبت دفترچه تصمیم وارد حساب شوید.','warn');return;}
 const d=context==='REPLAY'?R.readJalaliInput($('decisionReplayDate'),R.todayIso()):R.readJalaliInput($('journalDate'),R.todayIso());
 const sid=context==='REPLAY'?$('decisionReplaySymbol').value:$('journalSymbol').value,source=(await loadDate(d)).find(x=>String(x.symbol_id)===String(sid));
 const symbol=context==='REPLAY'?$('decisionReplaySymbol').selectedOptions[0]?.textContent?.split(' — ')[0]:$('journalSymbol').selectedOptions[0]?.textContent;
 if(!sid||!symbol)return;
 const payload={user_id:user.id,trade_date:d,symbol_id:String(sid),symbol:String(symbol),context,decision:decisionOverride||$('journalDecision').value,reason:context==='LIVE'?$('journalReason').value.trim().slice(0,300):'تصمیم در بازپخش بدون نگاه به آینده',note:context==='LIVE'?$('journalNote').value.trim().slice(0,1200):String(extra.note||''),hunt_state:source?.hunt_state||null,hunt_score:source?.hunt_score??null,entry_price:extra.entry_price??source?.detected_price??null,outcome_pct:extra.outcome_pct??source?.same_day_close_change_pct??null,updated_at:new Date().toISOString()};
 const {error}=await sb.from('stock_hunter_decision_journal_v420').insert(payload);if(error){status('ثبت تصمیم ناموفق بود: '+error.message,'bad');return;}status('تصمیم در دفترچه شخصی ثبت شد.','ok');if(context==='LIVE')await loadJournal();
}
async function loadReplaySymbols(){
 const d=R.readJalaliInput($('decisionReplayDate'),R.todayIso());const rows=await R.api('stock_hunter_market_replay_symbols_v416','select=symbol_id,symbol,bucket_count,resolution_seconds&trade_date=eq.'+d+'&order=symbol.asc&limit=2000').catch(()=>[]);const sel=$('decisionReplaySymbol');sel.innerHTML=rows.length?rows.sort((a,b)=>collator.compare(a.symbol,b.symbol)).map(x=>'<option value="'+esc(x.symbol_id)+'">'+esc(x.symbol)+' — '+R.fa(x.bucket_count)+' نما</option>').join(''):'<option value="">نمادی برای تمرین وجود ندارد</option>';
}
function renderReplay(){
 const i=Math.max(0,Math.min(replayRows.length-1,Number($('decisionReplaySlider').value)||0)),x=replayRows[i];if(!x){$('decisionReplayTime').textContent='—';$('decisionReplayData').innerHTML='';return;}
 $('decisionReplayTime').textContent=R.time(x.bucket_at);const cells=[['قیمت',R.fa(x.close_price,0)],['تغییر',R.pct(x.close_change_pct)],['حجم',R.fa(x.last_volume,0)],['صف خرید',R.fa(x.max_buy_queue,0)],['صف فروش',R.fa(x.max_sell_queue,0)],['بیشینه تا این لحظه',R.pct(x.high_change_pct)],['کمینه تا این لحظه',R.pct(x.low_change_pct)],['نمونه‌های بازه',R.fa(x.sample_count)]];
 $('decisionReplayData').innerHTML=cells.map(c=>'<div><span>'+c[0]+'</span><b>'+c[1]+'</b></div>').join('');$('decisionFuture').textContent='اطلاعات بعد از '+R.time(x.bucket_at)+' پنهان است.';$('decisionReplayOutcome').innerHTML=replayDecision?evidence('تصمیم ثبت‌شده',decisionFa[replayDecision]):evidence('هنوز تصمیمی ثبت نشده است','ابتدا فقط با داده همین لحظه تصمیم بگیرید.');
}
async function loadDecisionReplay(){
 replayDecision=null;const d=R.readJalaliInput($('decisionReplayDate'),R.todayIso()),sid=$('decisionReplaySymbol').value;if(!sid){replayRows=[];renderReplay();return;}status('در حال آماده‌سازی بازپخش تصمیم…','warn');
 const all=await R.api('stock_hunter_market_replay_v416','select=*&trade_date=eq.'+d+'&symbol_id=eq.'+encodeURIComponent(sid)+'&order=bucket_at.asc&limit=2500');const res=[...new Set(all.map(x=>Number(x.bucket_seconds)||300))].sort((a,b)=>a-b)[0];replayRows=all.filter(x=>(Number(x.bucket_seconds)||300)===res);$('decisionReplaySlider').max=String(Math.max(0,replayRows.length-1));$('decisionReplaySlider').value=String(Math.min(Math.floor(replayRows.length*.35),Math.max(0,replayRows.length-1)));renderReplay();status('تمرین آماده است؛ آینده بازار پنهان مانده است.','ok');
}
async function replayDecisionSave(decision){
 if(!replayRows.length)return;replayDecision=decision;const i=Number($('decisionReplaySlider').value)||0,x=replayRows[i];$('decisionReplayOutcome').innerHTML=evidence('تصمیم شما',decisionFa[decision]+' در '+R.time(x.bucket_at));await saveJournal('REPLAY',decision,{entry_price:x.close_price,note:'زمان تصمیم '+R.time(x.bucket_at)});
}
function revealReplay(){
 if(!replayRows.length)return;const i=Number($('decisionReplaySlider').value)||0,f=replayRows.slice(i),cur=replayRows[i],max= Math.max(...f.map(x=>Number(x.high_change_pct)).filter(Number.isFinite)),min=Math.min(...f.map(x=>Number(x.low_change_pct)).filter(Number.isFinite)),last=f[f.length-1];$('decisionFuture').textContent='آینده آشکار شد.';$('decisionReplayOutcome').innerHTML=[evidence('تصمیم شما',replayDecision?decisionFa[replayDecision]:'ثبت نشده'),evidence('بیشترین حرکت بعد از تصمیم',R.pct(max)),evidence('بیشترین افت بعد از تصمیم',R.pct(min)),evidence('تغییر پایان بازپخش',R.pct(last?.close_change_pct)),evidence('قیمت لحظه تصمیم',R.fa(cur?.close_price,0)+' ریال')].join('');
}
function getWorkspace(){try{return JSON.parse(localStorage.getItem('stockHunterWorkspaceV420')||'{}')}catch{return{}}}
function setWorkspaceForm(x){$('wsSummary').checked=x.summary!==false;$('wsRadar').checked=x.radar!==false;$('wsTable').checked=x.table!==false;$('wsCompact').checked=!!x.compact;$('wsFirst').value=['summary','radar','table'].includes(x.first)?x.first:'summary';}
async function loadWorkspace(){
 let x=getWorkspace(),source='ذخیره محلی';if(sb&&user){const {data}=await sb.from('stock_hunter_workspace_v420').select('layout,updated_at').eq('user_id',user.id).maybeSingle();if(data?.layout){x=data.layout;localStorage.setItem('stockHunterWorkspaceV420',JSON.stringify(x));source='همگام‌شده با حساب کاربری';}}setWorkspaceForm(x);$('workspaceState').innerHTML=evidence('منبع چیدمان',source)+evidence('اعمال روی صفحه اصلی','نمای خلاصه، رادار، جدول و تراکم چیدمان از همین تنظیم خوانده می‌شود.');
}
async function saveWorkspace(){
 const layout={summary:$('wsSummary').checked,radar:$('wsRadar').checked,table:$('wsTable').checked,compact:$('wsCompact').checked,first:$('wsFirst').value};localStorage.setItem('stockHunterWorkspaceV420',JSON.stringify(layout));
 if(sb&&user){const {error}=await sb.from('stock_hunter_workspace_v420').upsert({user_id:user.id,layout,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error){status('چیدمان محلی ذخیره شد ولی همگام‌سازی ابری ناموفق بود.','warn');return;}}await loadWorkspace();status('میزکار شخصی ذخیره شد.','ok');
}
async function cloudHealth(){
 $('cloudState').innerHTML=evidence('وضعیت','در حال بررسی سرویس سروری…');try{const r=await fetch(base+'/functions/v1/stock-hunter-cloud-push-v420',{headers:{apikey:key},cache:'no-store'}),j=await r.json();$('cloudState').innerHTML=[evidence('سرویس Push',j.configured?'فعال و پیکربندی‌شده':'پیکربندی ناقص'),evidence('اشتراک فعال',R.fa(j.active_subscriptions||0)),evidence('نسخه',j.version||'—')].join('');}catch(e){$('cloudState').innerHTML=evidence('خطا','بررسی سرویس Push ممکن نشد.','bad');}
}
function wireTabs(){document.querySelectorAll('.pro-tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.pro-tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.pro-view').forEach(x=>x.classList.toggle('active',x.id==='view-'+b.dataset.view));});}
function wireDates(){const t=R.todayIso();for(const id of ['confidenceDate','execDate','regimeDate','journalDate','decisionReplayDate'])R.setJalaliInput($(id),t);R.setJalaliInput($('robustEnd'),t);R.setJalaliInput($('robustStart'),R.daysAgoIso(90));}
async function init(){
 wireTabs();wireDates();await initAuth();await loadStrategies();await Promise.all([loadConfidenceDay(),loadSmartSaved(),loadWorkspace(),loadReplaySymbols(),cloudHealth()]);R.setJalaliInput($('execDate'),R.readJalaliInput($('confidenceDate'),R.todayIso()));R.setJalaliInput($('regimeDate'),R.readJalaliInput($('confidenceDate'),R.todayIso()));R.setJalaliInput($('journalDate'),R.readJalaliInput($('confidenceDate'),R.todayIso()));scanSmart();await loadJournal();status('مرکز حرفه‌ای آماده است؛ ۱۴ قابلیت بدون تغییر موتور ۴.۱.۶ فعال‌اند.','ok');
}
$('confidenceRefresh').onclick=loadConfidenceDay;$('confidenceSymbol').onchange=confidence;$('runRobustness').onclick=runRobustness;$('runExecution').onclick=runExecution;$('runRegime').onclick=runRegime;$('smartScan').onclick=scanSmart;$('smartSave').onclick=saveSmart;$('evidenceAsk').onclick=askEvidence;$('runAgent').onclick=runAgent;$('journalSave').onclick=()=>saveJournal('LIVE');$('journalDate').addEventListener('change',loadJournal);$('decisionReplayDate').addEventListener('change',loadReplaySymbols);$('loadDecisionReplay').onclick=loadDecisionReplay;$('decisionReplaySlider').oninput=renderReplay;document.querySelectorAll('[data-replay-decision]').forEach(b=>b.onclick=()=>replayDecisionSave(b.dataset.replayDecision));$('revealReplay').onclick=revealReplay;$('saveWorkspace').onclick=saveWorkspace;$('cloudHealth').onclick=cloudHealth;
$('confidenceDate').addEventListener('change',async()=>{await loadConfidenceDay();const d=R.readJalaliInput($('confidenceDate'),R.todayIso());for(const id of ['execDate','regimeDate','journalDate'])R.setJalaliInput($(id),d);scanSmart();await loadJournal();});$('execDate').addEventListener('change',async()=>fillSymbols($('execSymbol'),await loadDate(R.readJalaliInput($('execDate'),R.todayIso()))));$('regimeDate').addEventListener('change',runRegime);
$('smartSaved').addEventListener('click',async e=>{const load=e.target.closest('[data-smart-load]'),del=e.target.closest('[data-smart-delete]'),rows=$('smartSaved')._rows||[];if(load){const x=rows.find(z=>z.smart_watchlist_id===load.dataset.smartLoad);if(x){$('smartName').value=x.name;$('smartMode').value=x.rule_json?.mode||'';$('smartScore').value=R.fa(x.rule_json?.min_score??65);$('smartRisk').value=R.fa(x.rule_json?.max_risk??60);scanSmart();}}if(del&&sb&&user){await sb.from('stock_hunter_smart_watchlists_v420').delete().eq('user_id',user.id).eq('smart_watchlist_id',del.dataset.smartDelete);await loadSmartSaved();}});
init().catch(e=>status('راه‌اندازی مرکز حرفه‌ای ناموفق بود: '+e.message,'bad'));