'use strict';
const R=StockHunterResearchV416;const $=id=>document.getElementById(id);let replayRows=[],journey=null,playTimer=null,index=0,symbolMeta=[];
const faCollator=new Intl.Collator('fa-IR',{usage:'sort',sensitivity:'base',ignorePunctuation:true,numeric:false});
const faName=v=>String(v??'').normalize('NFKC').replace(/ي/g,'ی').replace(/ى/g,'ی').replace(/ك/g,'ک').replace(/\u200c/g,' ').trim();
const numericId=v=>/^\d+$/.test(String(v||'').trim());
function stopPlay(){clearTimeout(playTimer);playTimer=null;$('replayPlay').textContent='▶ شروع بازپخش';$('replayPlay').classList.remove('active');}
function current(){return replayRows[index]||null;}
function resolutionFa(v){const n=Number(v);return n===30?'۳۰ ثانیه':n===300?'۵ دقیقه':Number.isFinite(n)?R.fa(n)+' ثانیه':'—';}
function milestone(label,at){return '<div class="timeline-step '+(at?'reached':'pending')+'"><span>'+R.esc(label)+'</span><b>'+(at?R.time(at):'نرسیده')+'</b></div>';}
function renderMilestones(){
 if(!journey){$('replayMilestones').innerHTML='<div class="empty">برای این نماد در این تاریخ سفر شکار ثبت نشده است.</div>';return;}
 $('replayMilestones').innerHTML=milestone('کشف شکار',journey.detected_at)+'<div class="timeline-arrow">←</div>'+milestone('عبور از صفر',journey.crossed_zero_at)+'<div class="timeline-arrow">←</div>'+milestone('رسیدن به +۱٪',journey.crossed_plus1_at)+'<div class="timeline-arrow">←</div>'+milestone('رسیدن به +۲٪',journey.crossed_plus2_at)+'<div class="timeline-arrow">←</div>'+milestone('رسیدن به +۳٪',journey.crossed_plus3_at);
}
function chart(){
 if(!replayRows.length){$('replayChart').innerHTML='<div class="empty">برای نماد و تاریخ انتخاب‌شده داده بازپخش ثبت نشده است.</div>';return;}
 const vals=replayRows.map(x=>Number(x.close_change_pct)).filter(Number.isFinite),ymin=Math.min(-1,...vals)-.35,ymax=Math.max(1,...vals)+.35,n=Math.max(1,replayRows.length-1);
 const X=i=>42+(i/n)*895,Y=y=>190-((y-ymin)/(ymax-ymin))*150;
 const p=replayRows.map((x,i)=>({i,y:Number(x.close_change_pct)})).filter(x=>Number.isFinite(x.y));
 const path=p.map((x,j)=>(j?'L':'M')+X(x.i).toFixed(1)+','+Y(x.y).toFixed(1)).join(' ');
 const ci=Math.min(index,replayRows.length-1),cy=Number(replayRows[ci]?.close_change_pct);
 const marker=Number.isFinite(cy)?'<circle class="replay-current" cx="'+X(ci)+'" cy="'+Y(cy)+'" r="6"/><text class="chart-label" x="'+X(ci)+'" y="'+(Y(cy)-11)+'" text-anchor="middle">'+R.time(replayRows[ci].bucket_at)+' · '+R.pct(cy,1)+'</text>':'';
 const zero=Y(0),eventMarks=journey?[['کشف',journey.detected_at],['صفر',journey.crossed_zero_at],['+۱٪',journey.crossed_plus1_at],['+۲٪',journey.crossed_plus2_at],['+۳٪',journey.crossed_plus3_at]].map(([l,t])=>{
   if(!t)return '';const z=new Date(t).getTime();let bi=0,bd=Infinity;for(let i=0;i<replayRows.length;i++){const d=Math.abs(new Date(replayRows[i].bucket_at).getTime()-z);if(d<bd){bd=d;bi=i;}}
   return '<line class="replay-event-line" x1="'+X(bi)+'" x2="'+X(bi)+'" y1="22" y2="190"/><text class="chart-label" x="'+X(bi)+'" y="16" text-anchor="middle">'+l+'</text>';
 }).join(''):'';
 $('replayChart').innerHTML='<svg viewBox="0 0 960 215" preserveAspectRatio="none"><line class="chart-zero" x1="35" x2="945" y1="'+zero+'" y2="'+zero+'"/><text class="chart-label" x="8" y="'+(zero-4)+'">صفر</text><path class="chart-line" d="'+path+'"/>'+eventMarks+marker+'</svg>';
}
function renderCurrent(){
 const x=current();$('rpCount').textContent=R.fa(replayRows.length);
 const resolutions=[...new Set(replayRows.map(r=>Number(r.bucket_seconds)||30))].sort((a,b)=>a-b);$('rpResolution').textContent=resolutions.length?resolutions.map(resolutionFa).join(' / '):'—';
 if(!x){for(const id of ['rpTime','rpPrice','rpChange','rpRange','rpQueue'])$(id).textContent='—';chart();return;}
 $('rpTime').textContent=R.time(x.bucket_at);$('rpPrice').textContent=R.fa(x.close_price,0);$('rpChange').textContent=R.pct(x.close_change_pct);
 $('rpRange').textContent=R.fa(x.high_price,0)+' / '+R.fa(x.low_price,0);$('rpQueue').textContent=R.fa(x.max_buy_queue,0)+' / '+R.fa(x.max_sell_queue,0);
 $('replaySlider').value=String(index);chart();
 document.querySelectorAll('#replayBody tr').forEach((tr,i)=>tr.classList.toggle('replay-active',i===index));
 const row=document.querySelector('#replayBody tr.replay-active');if(row&&playTimer)row.scrollIntoView({block:'nearest'});
}
function renderTable(){
 $('replayBody').innerHTML=replayRows.length?replayRows.map((x,i)=>'<tr data-i="'+i+'"><td>'+R.time(x.bucket_at)+'</td><td>'+resolutionFa(x.bucket_seconds)+'</td><td>'+R.fa(x.open_price,0)+'</td><td class="good">'+R.fa(x.high_price,0)+'</td><td class="bad">'+R.fa(x.low_price,0)+'</td><td>'+R.fa(x.close_price,0)+'</td><td class="'+(Number(x.close_change_pct)>=0?'good':'bad')+'">'+R.pct(x.close_change_pct)+'</td><td>'+R.fa(x.max_buy_queue,0)+'</td><td>'+R.fa(x.max_sell_queue,0)+'</td><td>'+R.fa(x.last_volume,0)+'</td><td>'+R.fa(x.sample_count)+'</td></tr>').join(''):'<tr><td colspan="11"><div class="empty">برای این نماد در تاریخ انتخاب‌شده نمونه‌ای در Market Tape وجود ندارد.</div></td></tr>';
 document.querySelectorAll('#replayBody tr[data-i]').forEach(tr=>tr.onclick=()=>{stopPlay();index=Number(tr.dataset.i);renderCurrent();});
}
function scheduleNext(){if(!playTimer)return;const speed=Math.max(1,Number($('replaySpeed').value)||1);if(index>=replayRows.length-1){stopPlay();return;}playTimer=setTimeout(()=>{index++;renderCurrent();scheduleNext();},700/speed);}
function togglePlay(){if(playTimer){stopPlay();return;}if(!replayRows.length)return;if(index>=replayRows.length-1)index=0;$('replayPlay').textContent='⏸ توقف بازپخش';$('replayPlay').classList.add('active');playTimer=true;scheduleNext();}
async function loadSymbols(){
 stopPlay();const d=R.readJalaliInput($('replayDate'),R.todayIso());R.setStatus('در حال دریافت فهرست کامل نمادها و وضعیت داده '+R.jalaliDate(d)+'…','warn');
 try{
   const [universe,available]=await Promise.all([
     R.api('stock_hunter_universe_v4','select=ins_code,symbol,company_name,asset_type,market&is_active=eq.true&order=symbol.asc&limit=5000'),
     R.api('stock_hunter_market_replay_live_symbols_v416','select=symbol_id,symbol,bucket_count,resolution_seconds&trade_date=eq.'+encodeURIComponent(d)+'&order=symbol.asc&limit=5000').catch(()=>[])
   ]);
   const av=new Map((Array.isArray(available)?available:[]).map(x=>[String(x.symbol_id),x]));
   const seen=new Set();
   symbolMeta=(Array.isArray(universe)?universe:[])
     .filter(x=>numericId(x.ins_code)&&x.symbol&&!seen.has(String(x.ins_code))&&(seen.add(String(x.ins_code))||true))
     .map(x=>({symbol_id:String(x.ins_code),symbol:x.symbol,company_name:x.company_name||'',asset_type:x.asset_type||'',market:x.market||'',available:av.get(String(x.ins_code))||null}));
   symbolMeta.sort((a,b)=>Number(Boolean(b.available))-Number(Boolean(a.available))||faCollator.compare(faName(a.symbol),faName(b.symbol))||faCollator.compare(faName(a.company_name),faName(b.company_name)));
   const old=$('replaySymbol').value;
   $('replaySymbol').innerHTML='<option value="">انتخاب نماد…</option>'+symbolMeta.map(x=>{
     const tail=x.available?' — داده دارد · '+R.fa(x.available.bucket_count)+' نمونه':'';
     const company=x.company_name?' — '+R.esc(x.company_name):'';
     return '<option value="'+R.esc(x.symbol_id)+'">'+R.esc(x.symbol)+company+tail+'</option>';
   }).join('');
   let chosen='';
   if(symbolMeta.some(x=>x.symbol_id===old))chosen=old;
   else if(qsid&&symbolMeta.some(x=>x.symbol_id===String(qsid)))chosen=String(qsid);
   else if(qsymbol){const m=symbolMeta.find(x=>faName(x.symbol)===faName(qsymbol));if(m)chosen=m.symbol_id;}
   else {const first=symbolMeta.find(x=>x.available);if(first)chosen=first.symbol_id;}
   $('replaySymbol').value=chosen;
   R.setStatus('فهرست کامل '+R.fa(symbolMeta.length)+' نماد فعال آماده است؛ '+R.fa(av.size)+' نماد برای '+R.jalaliDate(d)+' داده بازپخش دارند.','ok');
   if(chosen)await loadReplay();else{replayRows=[];journey=null;renderTable();renderCurrent();renderMilestones();}
 }catch(e){$('replaySymbol').innerHTML='<option value="">خطا در دریافت نمادها</option>';R.setStatus('دریافت فهرست نمادها ناموفق بود: '+e.message,'bad');}
}
async function loadReplay(){
 stopPlay();const d=R.readJalaliInput($('replayDate'),R.todayIso()),sid=$('replaySymbol').value;
 if(!sid){replayRows=[];journey=null;renderTable();renderCurrent();renderMilestones();R.setStatus('یک نماد را از فهرست آبشاری انتخاب کنید.','warn');return;}
 const selected=symbolMeta.find(x=>x.symbol_id===String(sid));const displayName=selected?.symbol||$('replaySymbol').selectedOptions[0]?.textContent?.split(' — ')[0]||'نماد';
 R.setStatus('در حال دریافت بازپخش '+displayName+' در '+R.jalaliDate(d)+'…','warn');
 try{
   replayRows=await R.api('stock_hunter_market_replay_live_v416','select=*&trade_date=eq.'+encodeURIComponent(d)+'&symbol_id=eq.'+encodeURIComponent(sid)+'&order=bucket_at.asc&limit=2500');
   const available=[...new Set(replayRows.map(x=>Number(x.bucket_seconds)||30))].filter(Number.isFinite).sort((a,b)=>a-b);
   const best=available[0];if(best)replayRows=replayRows.filter(x=>(Number(x.bucket_seconds)||30)===best);
   const jr=await R.api('stock_hunter_hunt_journey_v416','select=channel,trade_date,symbol_id,symbol,detected_at,crossed_zero_at,crossed_plus1_at,crossed_plus2_at,crossed_plus3_at,hunt_state,hunt_score&trade_date=eq.'+encodeURIComponent(d)+'&symbol_id=eq.'+encodeURIComponent(sid)+'&order=detected_at.asc&limit=4').catch(()=>[]);
   journey=jr.find(x=>x.channel==='ACTION_NOW')||jr[0]||null;index=0;$('replaySlider').max=String(Math.max(0,replayRows.length-1));renderTable();renderCurrent();renderMilestones();
   const res=[...new Set(replayRows.map(x=>Number(x.bucket_seconds)||30))].sort((a,b)=>a-b).map(resolutionFa).join(' / ');
   if(replayRows.length)R.setStatus('بازپخش '+displayName+' در '+R.jalaliDate(d)+' — '+R.fa(replayRows.length)+' نما با تفکیک '+(res||'نامشخص'),'ok');
   else R.setStatus('برای '+displayName+' در '+R.jalaliDate(d)+' نمونه Market Tape ثبت نشده است؛ نماد یا تاریخ دیگری را انتخاب کنید.','warn');
 }catch(e){replayRows=[];journey=null;renderTable();renderCurrent();renderMilestones();R.setStatus('دریافت بازپخش ناموفق بود: '+e.message,'bad');}
}
const qp=new URLSearchParams(location.search),qd=qp.get('date'),qsid=qp.get('symbol_id'),qsymbol=qp.get('symbol');
R.setJalaliInput($('replayDate'),qd||R.todayIso());$('replayDate').addEventListener('change',loadSymbols);$('replayDate').addEventListener('keydown',e=>{if(e.key==='Enter')loadSymbols();});
$('replaySymbol').onchange=loadReplay;$('replayRefresh').onclick=loadSymbols;$('replayPlay').onclick=togglePlay;$('replayPrev').onclick=()=>{stopPlay();index=Math.max(0,index-1);renderCurrent();};$('replayNext').onclick=()=>{stopPlay();index=Math.min(replayRows.length-1,index+1);renderCurrent();};
$('replaySlider').oninput=()=>{stopPlay();index=Number($('replaySlider').value)||0;renderCurrent();};loadSymbols();
