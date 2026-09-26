import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

const R=window.StockHunterResearchV416;
const cfg=window.STOCK_HUNTER_CONFIG||{};
const $=id=>document.getElementById(id);
const supabase=createClient(String(cfg.SUPABASE_URL||'').replace(/\/$/,''),String(cfg.SUPABASE_PUBLISHABLE_KEY||''),{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}
});

const FIELD_DEFS={
  hunt_mode:{label:'مسیر شکار',type:'choice',values:[['reversal','برگشت از محدوده منفی'],['acceleration','شتاب مثبت اولیه']]},
  day_change:{label:'تغییر قیمت روزانه',type:'number',step:'0.1'},
  baseline_hunt_score:{label:'امتیاز شکار ثبت‌شده',type:'number',step:'1'},
  baseline_today_opportunity:{label:'قدرت فرصت امروز',type:'number',step:'1'},
  order_pressure:{label:'فشار سفارش',type:'number',step:'1'},
  impulse:{label:'شتاب حرکت',type:'number',step:'1'},
  feasibility:{label:'امکان رسیدن به هدف',type:'number',step:'1'},
  flow_volume:{label:'جریان و حجم',type:'number',step:'1'},
  market_context:{label:'شرایط بازار',type:'number',step:'1'},
  continuation12:{label:'تداوم یک تا دو روزه',type:'number',step:'1'},
  risk_score:{label:'ریسک',type:'number',step:'1'},
  cancellation_ratio:{label:'نسبت لغو سفارش',type:'number',step:'1'},
  evidence_count:{label:'شواهد هم‌زمان',type:'number',step:'1'},
  dynamic_evidence_count:{label:'شواهد پویا',type:'number',step:'1'},
  baseline_state:{label:'وضعیت شکار ثبت‌شده',type:'choice',values:[
    ['شکار ویژه','شکار ویژه'],['هشدار فوری','هشدار فوری'],['شکار زودهنگام','شکار زودهنگام'],['رصد','رصد'],['عادی','عادی']
  ]}
};
const NUM_OPS=[['>=','حداقل'],['>','بیشتر از'],['<=','حداکثر'],['<','کمتر از'],['=','برابر']];
const TEXT_OPS=[['=','برابر'],['!=','نابرابر']];
let rules=[];
let strategyId=null;
let cloudStrategies=[];
let session=null;
let alertTimer=null;
let lastScanRows=[];

function uid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(16).slice(2);}
function fieldOptions(selected){return Object.entries(FIELD_DEFS).map(([k,d])=>`<option value="${R.esc(k)}" ${k===selected?'selected':''}>${R.esc(d.label)}</option>`).join('');}
function opOptions(def,selected){const ops=def.type==='choice'?TEXT_OPS:NUM_OPS;return ops.map(([v,l])=>`<option value="${v}" ${v===selected?'selected':''}>${l}</option>`).join('');}
function valueControl(rule){
  const d=FIELD_DEFS[rule.field]||FIELD_DEFS.baseline_hunt_score;
  if(d.type==='choice')return `<select class="rule-value">${d.values.map(([v,l])=>`<option value="${R.esc(v)}" ${String(rule.value)===String(v)?'selected':''}>${R.esc(l)}</option>`).join('')}</select>`;
  return `<input class="rule-value" type="number" step="${d.step||'1'}" value="${R.esc(rule.value??'')}">`;
}
function normalizeRule(rule){
  const d=FIELD_DEFS[rule.field]||FIELD_DEFS.baseline_hunt_score;
  return {
    id:rule.id||uid(),field:FIELD_DEFS[rule.field]?rule.field:'baseline_hunt_score',
    op:rule.op||(d.type==='choice'?'=':'>='),value:rule.value??(d.type==='choice'?d.values[0][0]:60)
  };
}
function renderRules(){
  $('ruleList').innerHTML=rules.length?rules.map(r=>{
    const d=FIELD_DEFS[r.field];
    return `<div class="rule-row" data-rule-id="${r.id}">
      <select class="rule-field" aria-label="شاخص">${fieldOptions(r.field)}</select>
      <select class="rule-op" aria-label="رابطه">${opOptions(d,r.op)}</select>
      <span class="rule-value-wrap">${valueControl(r)}</span>
      <button type="button" class="rule-remove" title="حذف شرط">×</button>
    </div>`;
  }).join(''):'<div class="empty compact">هنوز شرطی تعریف نشده است. در این حالت هیچ پویشی اجرا نمی‌شود.</div>';
}
function syncRulesFromDom(){
  document.querySelectorAll('.rule-row').forEach(row=>{
    const r=rules.find(x=>x.id===row.dataset.ruleId);if(!r)return;
    r.field=row.querySelector('.rule-field').value;
    r.op=row.querySelector('.rule-op').value;
    const d=FIELD_DEFS[r.field],raw=row.querySelector('.rule-value')?.value;
    r.value=d.type==='number'?(raw===''?null:Number(raw)):raw;
  });
}
function onRuleChange(e){
  const row=e.target.closest('.rule-row');if(!row)return;
  const r=rules.find(x=>x.id===row.dataset.ruleId);if(!r)return;
  if(e.target.classList.contains('rule-field')){
    r.field=e.target.value;
    const d=FIELD_DEFS[r.field];r.op=d.type==='choice'?'=':'>=';
    r.value=d.type==='choice'?d.values[0][0]:60;renderRules();return;
  }
  syncRulesFromDom();
}
function addRule(field='baseline_hunt_score',op='>=',value=60){rules.push(normalizeRule({field,op,value}));renderRules();}
function preset(name){
  if(name==='clear'){rules=[];}
  if(name==='reversal')rules=[
    normalizeRule({field:'hunt_mode',op:'=',value:'reversal'}),
    normalizeRule({field:'baseline_hunt_score',op:'>=',value:60}),
    normalizeRule({field:'evidence_count',op:'>=',value:5}),
    normalizeRule({field:'risk_score',op:'<=',value:62})
  ];
  if(name==='acceleration')rules=[
    normalizeRule({field:'hunt_mode',op:'=',value:'acceleration'}),
    normalizeRule({field:'day_change',op:'<',value:1}),
    normalizeRule({field:'impulse',op:'>=',value:60}),
    normalizeRule({field:'dynamic_evidence_count',op:'>=',value:2})
  ];
  renderRules();
}
function compare(a,op,b,type){
  if(type==='number'){
    const x=Number(a),y=Number(b);if(!Number.isFinite(x)||!Number.isFinite(y))return false;
    if(op==='>=')return x>=y;if(op==='>')return x>y;if(op==='<=')return x<=y;if(op==='<')return x<y;return x===y;
  }
  const x=String(a??''),y=String(b??'');return op==='!='?x!==y:x===y;
}
function matches(row){
  if(!rules.length)return false;
  const test=r=>compare(row[r.field],r.op,r.value,FIELD_DEFS[r.field].type);
  return $('strategyMatchMode').value==='ANY'?rules.some(test):rules.every(test);
}
async function paged(table,query,maxRows=10000){
  const out=[],pageSize=1000;
  for(let offset=0;offset<maxRows;offset+=pageSize){
    const join=query+(query?'&':'')+`limit=${pageSize}&offset=${offset}`;
    const part=await R.api(table,join);out.push(...part);
    if(part.length<pageSize)break;
  }
  return out;
}
function dedupeLatest(rows){
  const seen=new Set(),out=[];
  for(const r of rows){const k=String(r.symbol_id||r.symbol);if(seen.has(k))continue;seen.add(k);out.push(r);}
  return out;
}
function modeFa(v){return v==='reversal'?'برگشت از محدوده منفی':v==='acceleration'?'شتاب مثبت اولیه':'—';}
function median(values){
  const a=values.map(Number).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;
  const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function targetResult(r){
  return r.hunt_mode==='reversal'?r.reversal_crossed_reference_same_day:r.hit_plus_1pct_1d;
}
function boolFa(v){return v===true?'موفق':v===false?'ناموفق':'نامشخص';}
function renderScan(rows,total){
  $('sScanned').textContent=R.fa(total);$('sMatched').textContent=R.fa(rows.length);
  $('strategyScanBody').innerHTML=rows.length?rows.slice(0,300).map(x=>`<tr>
    <td>${R.time(x.observed_at)}</td><td><b>${R.esc(x.symbol)}</b><div class="muted">${R.esc(x.company_name||'')}</div></td>
    <td>${modeFa(x.hunt_mode)}</td><td>${R.pct(x.day_change)}</td><td>${R.fa(x.baseline_hunt_score,1)}</td>
    <td>${R.fa(x.baseline_today_opportunity,1)}</td><td>${R.fa(x.evidence_count)} / ${R.fa(x.dynamic_evidence_count)}</td>
    <td class="${Number(x.risk_score)>62?'bad':''}">${R.fa(x.risk_score,1)}</td><td>${R.esc(x.baseline_state||'—')}</td>
  </tr>`).join(''):'<tr><td colspan="9"><div class="empty">نمادی با همه شرط‌های این راهبرد منطبق نیست.</div></td></tr>';
}
function renderBacktest(rows,total){
  const observed=rows.filter(x=>targetResult(x)!==null),success=observed.filter(x=>targetResult(x)===true);
  $('sHistorical').textContent=R.fa(rows.length);
  $('sPrecision').textContent=observed.length?R.pct(100*success.length/observed.length,1):'—';
  $('sMfe').textContent=R.pct(median(rows.map(x=>x.mfe_1d_pct)));
  $('sMae').textContent=R.pct(median(rows.map(x=>x.mae_1d_pct)));
  $('strategyBacktestNote').textContent=`از ${R.fa(total)} رخداد بررسی‌شده، ${R.fa(rows.length)} رخداد با همه شرط‌ها منطبق بود؛ برای ${R.fa(observed.length)} مورد نتیجه هدف قابل سنجش است و ${R.fa(success.length)} مورد به هدف مسیر خود رسیده‌اند.`;
  $('strategyBacktestBody').innerHTML=rows.length?rows.slice(0,500).map(x=>`<tr>
    <td>${R.jalaliDate(x.trade_date)}</td><td><b>${R.esc(x.symbol)}</b><div class="muted">${R.esc(x.company_name||'')}</div></td>
    <td>${modeFa(x.hunt_mode)}</td><td>${R.fa(x.baseline_hunt_score,1)}</td>
    <td class="${targetResult(x)===true?'good':targetResult(x)===false?'bad':''}">${boolFa(targetResult(x))}</td>
    <td class="good">${R.pct(x.mfe_1d_pct)}</td><td class="bad">${R.pct(x.mae_1d_pct)}</td><td>${R.pct(x.return_1d_pct)}</td>
  </tr>`).join(''):'<tr><td colspan="8"><div class="empty">رخداد تاریخی منطبقی پیدا نشد.</div></td></tr>';
}

const NL_DEFS=[
  {field:'baseline_hunt_score',re:/امتیاز(?:\s+)?شکار/},
  {field:'baseline_today_opportunity',re:/قدرت(?:\s+)?(?:فرصت|امروز)/},
  {field:'order_pressure',re:/فشار(?:\s+)?سفارش/},
  {field:'impulse',re:/شتاب(?:\s+)?(?:حرکت|سیگنال)?/},
  {field:'feasibility',re:/امکان(?:\s+)?(?:رسیدن|هدف)/},
  {field:'flow_volume',re:/جریان(?:\s+)?و(?:\s+)?حجم/},
  {field:'market_context',re:/شرایط(?:\s+)?بازار/},
  {field:'continuation12',re:/تداوم/},
  {field:'risk_score',re:/ریسک/},
  {field:'cancellation_ratio',re:/لغو(?:\s+)?سفارش/},
  {field:'evidence_count',re:/شاهد(?:های)?(?:\s+)?هم(?:‌|\s|-)?زمان|شواهد(?:\s+)?هم(?:‌|\s|-)?زمان/},
  {field:'dynamic_evidence_count',re:/شاهد(?:های)?(?:\s+)?پویا|شواهد(?:\s+)?پویا/},
  {field:'day_change',re:/تغییر(?:\s+)?(?:قیمت|روزانه)/}
];
function nlOp(segment){
  if(/کمتر|زیر|حداکثر|بیشینه|نهایت/.test(segment))return '<=';
  if(/بیشتر|بالای|حداقل|کمینه|از\s+/.test(segment))return '>=';
  return '>=';
}
function localRulesFromText(text){
  const s=R.latinDigits(String(text||'')).replace(/٫/g,'.').replace(/−/g,'-'),out=[];
  if(/برگشت|منفی/.test(s))out.push({field:'hunt_mode',op:'=',value:'reversal'});
  else if(/شتاب/.test(s))out.push({field:'hunt_mode',op:'=',value:'acceleration'});
  for(const d of NL_DEFS){
    const m=d.re.exec(s);if(!m)continue;const tail=s.slice(m.index,m.index+90),num=tail.match(/-?\d+(?:\.\d+)?/);if(!num)continue;
    out.push({field:d.field,op:nlOp(tail.slice(0,num.index)),value:Number(num[0])});
  }
  for(const state of ['شکار ویژه','هشدار فوری','شکار زودهنگام','رصد','عادی'])if(s.includes(state)){out.push({field:'baseline_state',op:'=',value:state});break;}
  return sanitizeParsedRules(out);
}
function sanitizeParsedRules(a){
  if(!Array.isArray(a))return[];
  const okOps=new Set(['>=','>','<=','<','=','!=']),out=[];
  for(const r of a){
    if(!FIELD_DEFS[r?.field]||!okOps.has(String(r?.op)))continue;const d=FIELD_DEFS[r.field];
    let value=r.value;if(d.type==='number'){value=Number(value);if(!Number.isFinite(value))continue;}
    else if(!d.values.some(([v])=>String(v)===String(value)))continue;
    out.push(normalizeRule({field:r.field,op:String(r.op),value}));
  }
  return out.slice(0,20);
}
async function aiRulesFromText(text){
  if(!session)return null;
  try{
    const r=await fetch(String(cfg.SUPABASE_URL||'').replace(/\/$/,'')+'/functions/v1/stock-hunter-ai-v417',{method:'POST',headers:{'Content-Type':'application/json',apikey:String(cfg.SUPABASE_PUBLISHABLE_KEY||''),Authorization:'Bearer '+session.access_token},body:JSON.stringify({mode:'strategy_parse',payload:{text}})});
    if(!r.ok)return null;const j=await r.json();return sanitizeParsedRules(j.rules);
  }catch{return null;}
}
async function translateNaturalStrategy(){
  const text=$('strategyNaturalLanguage').value.trim();if(!text){$('strategyAiState').textContent='ابتدا راهبرد را به فارسی بنویسید.';return;}
  $('strategyAiState').textContent='در حال تبدیل متن به شرط‌های قابل مشاهده…';
  let parsed=await aiRulesFromText(text);if(!parsed?.length)parsed=localRulesFromText(text);
  if(!parsed.length){$('strategyAiState').textContent='از این متن شرط قابل اتکایی استخراج نشد؛ عبارت را با نام شاخص و عدد روشن‌تر بنویسید.';return;}
  rules=parsed;$('strategyMatchMode').value=/\sیا\s|یا،|یا\./.test(text)?'ANY':'ALL';renderRules();
  $('strategyAiState').textContent=R.fa(rules.length)+' شرط ساخته شد. قبل از اجرا می‌توانید همه شرط‌ها را ببینید و ویرایش کنید.';
}
function validate(){
  syncRulesFromDom();
  if(!rules.length){R.setStatus('حداقل یک شرط به راهبرد اضافه کنید.','bad');return false;}
  if(rules.some(r=>FIELD_DEFS[r.field].type==='number'&&!Number.isFinite(Number(r.value)))){R.setStatus('مقدار یکی از شرط‌های عددی معتبر نیست.','bad');return false;}
  return true;
}
async function runScan({notify=false}={}){
  if(!validate())return [];
  const d=R.todayIso();R.setStatus('در حال پویش داده امروز با تعریف فعلی…','warn');
  try{
    const select='sample_id,trade_date,symbol_id,symbol,company_name,hunt_mode,observed_at,day_change,order_pressure,impulse,feasibility,flow_volume,market_context,continuation12,risk_score,cancellation_ratio,evidence_count,dynamic_evidence_count,baseline_today_opportunity,baseline_hunt_score,baseline_state,gate_reason';
    const all=await paged('stock_hunter_shadow_samples_v416','select='+encodeURIComponent(select)+'&trade_date=eq.'+encodeURIComponent(d)+'&order=observed_at.desc',12000);
    const latest=dedupeLatest(all),matched=latest.filter(matches);lastScanRows=matched;renderScan(matched,latest.length);
    R.setStatus('پویش انجام شد — '+R.fa(matched.length)+' نماد منطبق از '+R.fa(latest.length)+' نماد دارای نمونه امروز.','ok');
    if(notify)notifyFresh(matched);
    return matched;
  }catch(e){R.setStatus('پویش بازار ناموفق بود: '+e.message,'bad');return [];}
}
async function runBacktest(){
  if(!validate())return;
  const from=R.readJalaliInput($('strategyFrom'),R.daysAgoIso(30)),to=R.readJalaliInput($('strategyTo'),R.todayIso());
  R.setStatus('در حال اجرای همان تعریف روی داده تاریخی…','warn');
  try{
    const select='sample_id,trade_date,symbol_id,symbol,company_name,hunt_mode,observed_at,day_change,order_pressure,impulse,feasibility,flow_volume,market_context,continuation12,risk_score,cancellation_ratio,evidence_count,dynamic_evidence_count,baseline_today_opportunity,baseline_hunt_score,baseline_state,gate_reason,return_1d_pct,mfe_1d_pct,mae_1d_pct,positive_1d,hit_plus_1pct_1d,reversal_crossed_reference_same_day';
    const all=await paged('stock_hunter_shadow_outcomes_v416','select='+encodeURIComponent(select)+'&trade_date=gte.'+encodeURIComponent(from)+'&trade_date=lte.'+encodeURIComponent(to)+'&order=trade_date.desc,observed_at.desc',20000);
    const matched=all.filter(matches);renderBacktest(matched,all.length);
    R.setStatus('آزمون تاریخی همین راهبرد تکمیل شد — '+R.fa(matched.length)+' رخداد منطبق.','ok');
  }catch(e){R.setStatus('آزمون تاریخی راهبرد ناموفق بود: '+e.message,'bad');}
}
function localList(){
  try{return JSON.parse(localStorage.getItem('stockHunterStrategiesV417')||'[]')}catch{return[]}
}
function writeLocal(list){localStorage.setItem('stockHunterStrategiesV417',JSON.stringify(list.slice(0,50)));}
function payload(){
  syncRulesFromDom();
  return {strategy_id:strategyId||uid(),user_id:session?.user?.id||null,name:$('strategyName').value.trim()||'راهبرد بدون نام',match_mode:$('strategyMatchMode').value==='ANY'?'ANY':'ALL',rules:rules.map(({field,op,value})=>({field,op,value})),alert_enabled:$('strategyAlert').checked};
}
async function save(){
  if(!validate())return;
  const p=payload();strategyId=p.strategy_id;
  const loc=localList().filter(x=>x.strategy_id!==p.strategy_id);loc.unshift({...p,user_id:null,updated_at:new Date().toISOString()});writeLocal(loc);
  if(session){
    const {error}=await supabase.from('stock_hunter_user_strategies_v417').upsert({
      strategy_id:p.strategy_id,user_id:session.user.id,name:p.name,match_mode:p.match_mode,rules:p.rules,alert_enabled:p.alert_enabled,updated_at:new Date().toISOString()
    },{onConflict:'strategy_id'});
    if(error){R.setStatus('راهبرد روی این دستگاه ذخیره شد، اما همگام‌سازی حساب ناموفق بود: '+error.message,'bad');renderSaved();return;}
  }
  R.setStatus(session?'راهبرد در حساب شما و این دستگاه ذخیره شد.':'راهبرد روی این دستگاه ذخیره شد؛ با ورود به حساب، ذخیره ابری نیز فعال می‌شود.','ok');
  await loadCloud();renderSaved();syncAlertTimer();
}
function loadStrategy(s){
  strategyId=s.strategy_id||null;$('strategyName').value=s.name||'راهبرد شخصی من';$('strategyMatchMode').value=s.match_mode==='ANY'?'ANY':'ALL';$('strategyAlert').checked=!!s.alert_enabled;
  rules=(Array.isArray(s.rules)?s.rules:[]).map(normalizeRule);renderRules();R.setStatus('راهبرد «'+(s.name||'بدون نام')+'» بارگذاری شد.','ok');syncAlertTimer();
}
async function removeStrategy(id,cloud){
  writeLocal(localList().filter(x=>x.strategy_id!==id));
  if(session&&cloud){await supabase.from('stock_hunter_user_strategies_v417').delete().eq('strategy_id',id);}
  if(strategyId===id)strategyId=null;await loadCloud();renderSaved();
}
async function loadCloud(){
  if(!session){cloudStrategies=[];return;}
  const {data,error}=await supabase.from('stock_hunter_user_strategies_v417').select('*').order('updated_at',{ascending:false}).limit(50);
  cloudStrategies=error?[]:(data||[]);
}
function mergedSaved(){
  const map=new Map();
  for(const s of localList())map.set(s.strategy_id,{...s,cloud:false});
  for(const s of cloudStrategies)map.set(s.strategy_id,{...s,cloud:true});
  return [...map.values()].sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
}
function renderSaved(){
  $('accountState').textContent=session?'ذخیره ابری حساب فعال':'ذخیره محلی';
  $('accountState').classList.toggle('success',!!session);
  const a=mergedSaved();
  $('savedStrategies').innerHTML=a.length?a.map(s=>`<article class="saved-strategy" data-id="${R.esc(s.strategy_id)}">
    <div><b>${R.esc(s.name)}</b><span>${R.fa((s.rules||[]).length)} شرط · ${s.match_mode==='ANY'?'رابطه یا':'رابطه و'} · ${s.alert_enabled?'هشدار روشن':'هشدار خاموش'} · ${s.cloud?'حساب کاربری':'این دستگاه'}</span></div>
    <div><button class="load-strategy" type="button">بارگذاری</button><button class="delete-strategy" type="button">حذف</button></div>
  </article>`).join(''):'<div class="empty">هنوز راهبردی ذخیره نشده است.</div>';
}
async function ensureServiceWorker(){if(!('serviceWorker'in navigator))return null;try{return await navigator.serviceWorker.register('./sw.js?v=4.1.6-r17');}catch(_){return null;}}
async function showNotification(row){
  if(!('Notification'in window)||Notification.permission!=='granted')return;
  const title='راهبرد شما منطبق شد';
  const body=`${row.symbol} — ${modeFa(row.hunt_mode)} — امتیاز ${R.fa(row.baseline_hunt_score,1)}`;
  try{
    if('serviceWorker'in navigator){const reg=await ensureServiceWorker();if(reg){await reg.showNotification(title,{body,icon:'icon.svg',tag:'strategy-'+strategyId+'-'+row.symbol_id,data:{url:'strategy-builder-v417.html'}});return;}}
    new Notification(title,{body,icon:'icon.svg'});
  }catch(_){}
}
function notifyFresh(rows){
  if(!$('strategyAlert').checked||!strategyId)return;
  const k='stockHunterStrategySeenV417:'+strategyId+':'+R.todayIso();
  let seen=[];try{seen=JSON.parse(localStorage.getItem(k)||'[]')}catch{}
  const set=new Set(seen),fresh=rows.filter(r=>!set.has(String(r.sample_id)));
  for(const r of fresh.slice(0,5))showNotification(r);
  localStorage.setItem(k,JSON.stringify([...new Set([...rows.map(r=>String(r.sample_id)),...seen])].slice(0,5000)));
}
async function ensurePermission(){
  if(!$('strategyAlert').checked||!('Notification'in window))return;
  await ensureServiceWorker();if(Notification.permission==='default')await Notification.requestPermission();
}
function syncAlertTimer(){
  clearInterval(alertTimer);alertTimer=null;
  if($('strategyAlert').checked&&rules.length){ensurePermission();alertTimer=setInterval(()=>runScan({notify:true}),15000);}
}
async function init(){
  R.setJalaliInput($('strategyFrom'),R.daysAgoIso(30));R.setJalaliInput($('strategyTo'),R.todayIso());
  preset('reversal');
  const {data}=await supabase.auth.getSession();session=data.session||null;await loadCloud();renderSaved();
  R.setStatus('سازنده راهبرد آماده است. یک نمونه را ویرایش کنید یا شرط‌های دلخواه خود را بسازید.','ok');
}
$('ruleList').addEventListener('change',onRuleChange);
$('ruleList').addEventListener('input',e=>{if(e.target.classList.contains('rule-value'))syncRulesFromDom();});
$('ruleList').addEventListener('click',e=>{const b=e.target.closest('.rule-remove');if(!b)return;const row=b.closest('.rule-row');rules=rules.filter(x=>x.id!==row.dataset.ruleId);renderRules();});
$('addRule').onclick=()=>addRule();
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>preset(b.dataset.preset));
$('translateStrategy').onclick=translateNaturalStrategy;
$('runScan').onclick=()=>runScan();
$('runBacktest').onclick=runBacktest;
$('saveStrategy').onclick=save;
$('strategyMatchMode').onchange=()=>{if(lastScanRows.length)runScan();syncAlertTimer();};
$('strategyAlert').onchange=()=>{ensurePermission();syncAlertTimer();};
$('savedStrategies').addEventListener('click',async e=>{
  const card=e.target.closest('.saved-strategy');if(!card)return;const s=mergedSaved().find(x=>x.strategy_id===card.dataset.id);if(!s)return;
  if(e.target.closest('.load-strategy'))loadStrategy(s);
  if(e.target.closest('.delete-strategy'))await removeStrategy(s.strategy_id,s.cloud);
});
window.addEventListener('beforeunload',()=>clearInterval(alertTimer));
init();
