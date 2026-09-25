'use strict';

const perfCfg=window.STOCK_HUNTER_CONFIG||{};
const perf$=id=>document.getElementById(id);
const perfN=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const perfFa=(v,d=2)=>perfN(v)==null?'—':Number(v).toLocaleString('fa-IR',{maximumFractionDigits:d});
const perfPct=(v,d=2)=>perfN(v)==null?'—':`${perfFa(v,d)}٪`;
const perfEsc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const perfMode=v=>v==='reversal'?'برگشت منفی به مثبت':v==='acceleration'?'شتاب مثبت اولیه':String(v||'—');
const perfClass=v=>perfN(v)==null?'muted':Number(v)>0?'pos':Number(v)<0?'neg':'muted';
let performanceRowsV416=[],recentOutcomeRowsV416=[];

function perfHeadersV416(){
  const k=perfCfg.SUPABASE_PUBLISHABLE_KEY||perfCfg.publishableKey||'';
  return {apikey:k,Accept:'application/json'};
}
async function perfFetchV416(path){
  const base=String(perfCfg.SUPABASE_URL||perfCfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base)throw new Error('آدرس پایگاه داده تنظیم نشده است');
  const r=await fetch(`${base}/rest/v1/${path}`,{headers:perfHeadersV416(),cache:'no-store'});
  if(!r.ok)throw new Error(`خطای دریافت داده عملکرد (${r.status})`);
  return r.json();
}
function perfFilteredV416(rows){
  const mode=perf$('modeFilter').value,state=perf$('stateFilter').value;
  return rows.filter(x=>(!mode||x.hunt_mode===mode)&&(!state||x.hunt_state===state));
}
function weightedAvgV416(rows,valueKey,countKey){
  let s=0,n=0;
  for(const r of rows){const v=perfN(r[valueKey]),c=perfN(r[countKey]);if(v!=null&&c!=null&&c>0){s+=v*c;n+=c}}
  return n?s/n:null;
}
function sumKeyV416(rows,key){return rows.reduce((a,r)=>a+(perfN(r[key])||0),0)}
function setTextV416(id,v){perf$(id).textContent=v}
function renderSummaryV416(){
  const rows=perfFilteredV416(performanceRowsV416),events=sumKeyV416(rows,'events_total'),m1=sumKeyV416(rows,'matured_1d'),m3=sumKeyV416(rows,'matured_3d');
  const ret1=weightedAvgV416(rows,'avg_return_1d_pct','matured_1d'),pos1=weightedAvgV416(rows,'positive_rate_1d_pct','matured_1d'),mfe1=weightedAvgV416(rows,'avg_mfe_1d_pct','matured_1d'),mae1=weightedAvgV416(rows,'avg_mae_1d_pct','matured_1d');
  const ret3=weightedAvgV416(rows,'avg_return_3d_pct','matured_3d'),pos3=weightedAvgV416(rows,'positive_rate_3d_pct','matured_3d'),plus3=weightedAvgV416(rows,'plus1_reach_rate_3d_pct','matured_3d'),minus3=weightedAvgV416(rows,'minus1_breach_rate_3d_pct','matured_3d');
  setTextV416('eventsTotal',events.toLocaleString('fa-IR'));setTextV416('matured1',m1.toLocaleString('fa-IR'));setTextV416('matured3',m3.toLocaleString('fa-IR'));
  setTextV416('avgRet1',`میانگین بازده: ${perfPct(ret1,2)}`);setTextV416('positive1',perfPct(pos1,1));setTextV416('mfeMae1',m1?`${perfPct(mfe1,2)} / ${perfPct(mae1,2)}`:'—');
  setTextV416('avgRet3',`میانگین بازده: ${perfPct(ret3,2)}`);setTextV416('positive3',perfPct(pos3,1));setTextV416('plus1_3',perfPct(plus3,1));setTextV416('minus1_3',perfPct(minus3,1));
  const status=m1<20?'نمونه بالغ هنوز کم است؛ نتیجه‌ها صرفاً برای پایش و جمع‌آوری داده نمایش داده می‌شوند و مبنای کالیبراسیون نهایی نیستند.':`تعداد نمونه بالغ ۱ جلسه: ${m1.toLocaleString('fa-IR')} — داده برای تحلیل تجربی اولیه در حال شکل‌گیری است.`;
  perf$('perfStatus').textContent=status;
}
function renderPerformanceTableV416(){
  const rows=perfFilteredV416(performanceRowsV416).sort((a,b)=>String(a.hunt_mode).localeCompare(String(b.hunt_mode))||String(a.hunt_state).localeCompare(String(b.hunt_state))||String(a.score_bucket).localeCompare(String(b.score_bucket)));
  perf$('perfBody').innerHTML=rows.length?rows.map(r=>`<tr>
    <td>${perfEsc(perfMode(r.hunt_mode))}</td><td>${perfEsc(r.hunt_state)}</td><td>${perfEsc(r.score_bucket)}</td><td>${perfFa(r.events_total,0)}</td>
    <td>${perfFa(r.matured_1d,0)}</td><td class="${perfClass(r.avg_return_1d_pct)}">${perfPct(r.avg_return_1d_pct,2)}</td><td>${perfPct(r.positive_rate_1d_pct,1)}</td><td class="${perfClass(r.avg_mfe_1d_pct)}">${perfPct(r.avg_mfe_1d_pct,2)}</td><td class="${perfClass(r.avg_mae_1d_pct)}">${perfPct(r.avg_mae_1d_pct,2)}</td>
    <td>${perfFa(r.matured_3d,0)}</td><td class="${perfClass(r.avg_return_3d_pct)}">${perfPct(r.avg_return_3d_pct,2)}</td><td>${perfPct(r.positive_rate_3d_pct,1)}</td><td>${perfPct(r.plus1_reach_rate_3d_pct,1)}</td><td>${perfPct(r.minus1_breach_rate_3d_pct,1)}</td>
  </tr>`).join(''):'<tr><td colspan="14" class="perf-empty">هنوز نمونه بالغ‌شده‌ای برای این فیلتر وجود ندارد.</td></tr>';
}
function renderRecentV416(){
  const rows=perfFilteredV416(recentOutcomeRowsV416);
  perf$('recentBody').innerHTML=rows.length?rows.map(r=>`<tr>
    <td>${perfEsc(r.trade_date||'—')}</td><td><b>${perfEsc(r.symbol)}</b></td><td>${perfEsc(perfMode(r.hunt_mode))}</td><td>${perfEsc(r.hunt_state)}</td><td>${perfFa(r.max_hunt_score,1)}</td><td>${perfFa(r.first_price,0)}</td><td>${perfFa(r.future_sessions_observed,0)}</td>
    <td class="${perfClass(r.return_1d_pct)}">${perfPct(r.return_1d_pct,2)}</td><td class="${perfClass(r.mfe_1d_pct)}">${perfPct(r.mfe_1d_pct,2)}</td><td class="${perfClass(r.mae_1d_pct)}">${perfPct(r.mae_1d_pct,2)}</td>
    <td class="${perfClass(r.return_3d_pct)}">${perfPct(r.return_3d_pct,2)}</td><td class="${perfClass(r.mfe_3d_pct)}">${perfPct(r.mfe_3d_pct,2)}</td><td class="${perfClass(r.mae_3d_pct)}">${perfPct(r.mae_3d_pct,2)}</td>
  </tr>`).join(''):'<tr><td colspan="13" class="perf-empty">دفتر ثبت رسمی هنوز رخداد قابل ارزیابی ندارد؛ ثبت نتیجه از جلسه معاملاتی بعد به‌صورت خودکار آغاز می‌شود.</td></tr>';
}
function renderAllV416(){renderSummaryV416();renderPerformanceTableV416();renderRecentV416()}
async function loadPerformanceV416(){
  perf$('perfStatus').textContent='در حال دریافت داده عملکرد…';
  try{
    const [p,o]=await Promise.all([
      perfFetchV416('stock_hunter_hunt_performance_v416?select=*&order=hunt_mode.asc,hunt_state.asc,score_bucket.asc'),
      perfFetchV416('stock_hunter_hunt_outcomes_v416?select=trade_date,symbol,hunt_mode,hunt_state,max_hunt_score,first_price,future_sessions_observed,return_1d_pct,mfe_1d_pct,mae_1d_pct,return_3d_pct,mfe_3d_pct,mae_3d_pct&order=trade_date.desc,first_seen_at.desc&limit=300')
    ]);
    performanceRowsV416=Array.isArray(p)?p:[];recentOutcomeRowsV416=Array.isArray(o)?o:[];renderAllV416();
  }catch(e){
    performanceRowsV416=[];recentOutcomeRowsV416=[];renderAllV416();perf$('perfStatus').textContent=`خطا در دریافت داده عملکرد: ${e.message}`;
  }
}

for(const id of ['modeFilter','stateFilter'])perf$(id).addEventListener('change',renderAllV416);
perf$('refreshPerf').addEventListener('click',loadPerformanceV416);
loadPerformanceV416();
