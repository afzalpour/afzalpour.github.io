'use strict';
(function(){
  const cfg=window.STOCK_HUNTER_CONFIG||{},base=String(cfg.SUPABASE_URL||'').replace(/\/$/,''),key=String(cfg.SUPABASE_PUBLISHABLE_KEY||'');
  if(!base||!key||typeof openDetail!=='function')return;
  const previous=openDetail;let sbPromise=null,aiConfigured=null;
  const escA=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const faA=(v,d=1)=>typeof fa==='function'?fa(v,d):(Number.isFinite(Number(v))?Number(v).toLocaleString('fa-IR',{maximumFractionDigits:d}):'—');
  const pctA=v=>Number.isFinite(Number(v))?((Number(v)>0?'+':'')+faA(v,2)+'٪'):'—';
  async function api(table,q){const r=await fetch(base+'/rest/v1/'+table+'?'+q,{headers:{apikey:key,Accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
  async function client(){if(!sbPromise)sbPromise=import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm').then(m=>m.createClient(base,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}}));return sbPromise;}
  async function configured(){if(aiConfigured!=null)return aiConfigured;try{const r=await fetch(base+'/functions/v1/stock-hunter-ai-v417?health=1',{headers:{apikey:key}}),j=await r.json();return aiConfigured=!!j.configured;}catch{return aiConfigured=false;}}
  async function remote(mode,payload){try{if(!await configured())return null;const c=await client(),{data}=await c.auth.getSession(),s=data.session;if(!s)return null;const r=await fetch(base+'/functions/v1/stock-hunter-ai-v417',{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+s.access_token},body:JSON.stringify({mode,payload})});if(!r.ok)return null;return await r.json();}catch{return null;}}
  function local(x,j,q){
    const metrics=[['فشار سفارش',j?.order_pressure],['شتاب حرکت',j?.impulse],['امکان رسیدن به هدف',j?.feasibility],['جریان و حجم',j?.flow_volume],['شرایط بازار',j?.market_context],['تداوم',j?.continuation12]].filter(a=>Number.isFinite(Number(a[1]))).sort((a,b)=>Number(b[1])-Number(a[1]));
    const top=metrics.slice(0,3).map(a=>a[0]+' '+faA(a[1],1)).join('، ')||'جزئیات مؤلفه‌های سفر کامل نیست';
    const risks=[];if(Number(j?.risk_score??x.risk)>62)risks.push('ریسک بالا');if(Number(j?.cancellation_ratio??x.cancel)>60)risks.push('لغو سفارش بالا');if(Number(j?.dynamic_evidence_count)<2)risks.push('شواهد پویای محدود');if(j?.gate_reason)risks.push(String(j.gate_reason));
    if(/مانع|ریسک|ضعف/.test(q))return risks.length?'موانع مهم ثبت‌شده: '+risks.join('؛ ')+'.':'مانع غالبی در داده ثبت‌شده دیده نمی‌شود؛ ریسک فعلی '+faA(j?.risk_score??x.risk,1)+' است.';
    if(/چرا|علت|دلیل/.test(q))return 'عوامل قوی‌تر ثبت‌شده: '+top+'. امتیاز شکار '+faA(j?.hunt_score??x.fast,1)+' و وضعیت «'+String(j?.hunt_state??x.hunt)+'» است.';
    if(/بعد|مرحله|ویژه|فوری/.test(q))return 'تغییر مرحله فقط با احراز دوباره قواعد ثابت موتور ۴.۱.۶ از داده زنده رخ می‌دهد. این دستیار هیچ آستانه یا امتیاز تازه‌ای تولید نمی‌کند.';
    return 'خلاصه '+x.symbol+': وضعیت «'+x.hunt+'»، امتیاز '+faA(j?.hunt_score??x.fast,1)+'، ریسک '+faA(j?.risk_score??x.risk,1)+'؛ عوامل قوی‌تر: '+top+'.';
  }
  function ctx(x,j){return {symbol:x.symbol,company:x.company,hunt_state:j?.hunt_state||x.hunt,hunt_mode:j?.hunt_mode,day_change:j?.detected_day_change,hunt_score:j?.hunt_score??x.fast,risk_score:j?.risk_score??x.risk,evidence_count:j?.evidence_count,dynamic_evidence_count:j?.dynamic_evidence_count,order_pressure:j?.order_pressure,impulse:j?.impulse,feasibility:j?.feasibility,flow_volume:j?.flow_volume,market_context:j?.market_context,continuation12:j?.continuation12,cancellation_ratio:j?.cancellation_ratio,crossed_zero:!!j?.crossed_zero_at,crossed_plus1:!!j?.crossed_plus1_at,crossed_plus2:!!j?.crossed_plus2_at,crossed_plus3:!!j?.crossed_plus3_at,same_day_mfe_pct:j?.same_day_mfe_pct,same_day_mae_pct:j?.same_day_mae_pct};}
  function dateFa(v){if(!v)return '—';return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v+'T12:00:00Z'));}
  function distance(a,b){
    const ks=['order_pressure','impulse','feasibility','flow_volume','market_context','continuation12','risk_score','cancellation_ratio'];let s=0,n=0;
    for(const k of ks){const x=Number(a?.[k]),y=Number(b?.[k]);if(Number.isFinite(x)&&Number.isFinite(y)){s+=Math.abs(x-y)/100;n++;}}
    const d=Math.abs(Number(a?.detected_day_change)-Number(b?.detected_day_change??b?.day_change));if(Number.isFinite(d)){s+=Math.min(1,d/5);n++;}return n?s/n:1;
  }
  async function similar(j,out){
    if(!j){out.innerHTML='<div class="muted">برای این نماد سفر شکار کافی ثبت نشده است.</div>';return;}out.textContent='در حال یافتن نمونه‌های مشابه…';
    try{
      const from=new Date(Date.now()-180*86400000).toISOString().slice(0,10),sel='channel,trade_date,symbol_id,symbol,hunt_mode,detected_day_change,order_pressure,impulse,feasibility,flow_volume,market_context,continuation12,risk_score,cancellation_ratio,hunt_score,same_day_mfe_pct,same_day_mae_pct,crossed_zero_at,crossed_plus1_at';
      const all=await api('stock_hunter_hunt_journey_v416','select='+encodeURIComponent(sel)+'&trade_date=gte.'+from+'&hunt_mode=eq.'+encodeURIComponent(j.hunt_mode)+'&channel=eq.'+encodeURIComponent(j.channel)+'&order=trade_date.desc&limit=2000');
      const a=all.filter(z=>String(z.symbol_id)!==String(j.symbol_id)||z.trade_date!==j.trade_date).map(z=>({...z,_d:distance(j,z)})).sort((m,n)=>m._d-n._d).slice(0,5);
      out.innerHTML=a.length?'<div class="detail-ai-similar-grid">'+a.map(z=>{const hit=z.hunt_mode==='reversal'?!!z.crossed_zero_at:!!z.crossed_plus1_at;return '<article><b>'+escA(z.symbol)+'</b><span>'+dateFa(z.trade_date)+' · شباهت '+faA(Math.max(0,100*(1-z._d)),1)+'٪</span><small>هدف '+(hit?'موفق':'ناموفق')+' · پیشروی '+pctA(z.same_day_mfe_pct)+' · افت '+pctA(z.same_day_mae_pct)+'</small></article>';}).join('')+'</div>':'<div class="muted">نمونه تاریخی کافی وجود ندارد.</div>';
    }catch{out.innerHTML='<div class="muted">دریافت نمونه‌های مشابه ممکن نشد.</div>';}
  }
  openDetail=async function(id){
    await previous(id);const target=document.getElementById('detailBody');if(!target)return;
    let x=null;try{x=rows.find(r=>String(r.id)===String(id));}catch{}if(!x)return;
    let jr=[];try{jr=await api('stock_hunter_hunt_journey_v416','select=*&symbol_id=eq.'+encodeURIComponent(id)+'&order=trade_date.desc,detected_at.asc&limit=4');}catch{}
    const j=jr.find(z=>z.channel==='ACTION_NOW')||jr[0]||null;
    const sec=document.createElement('section');sec.className='detail-ai-v417';sec.innerHTML='<div class="detail-ai-title"><div><b>دستیار هوشمند شکار</b><small>تفسیر داده‌های ثبت‌شده؛ بدون تغییر موتور ۴.۱.۶</small></div><a href="ai-center-v417.html">مرکز هوش مصنوعی</a></div><div class="detail-ai-quick"><button type="button" data-q="چرا این نماد شکار شد؟">چرا شکار شد؟</button><button type="button" data-q="مهم‌ترین مانع و ریسک چیست؟">مانع اصلی</button><button type="button" data-q="برای تغییر مرحله چه چیزی لازم است؟">مرحله بعد</button></div><textarea rows="2" placeholder="پرسش خود را درباره همین نماد بنویسید…"></textarea><div class="detail-ai-actions"><button type="button" data-ask>پرسش از دستیار</button><button type="button" data-similar>شکارهای مشابه تاریخی</button></div><div class="detail-ai-output">یک پرسش انتخاب کنید یا بنویسید.</div><div class="detail-ai-similar"></div>';
    target.appendChild(sec);const ta=sec.querySelector('textarea'),out=sec.querySelector('.detail-ai-output'),sim=sec.querySelector('.detail-ai-similar');
    sec.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ta.value=b.dataset.q;});
    sec.querySelector('[data-ask]').onclick=async()=>{const q=ta.value.trim()||'این شکار را توضیح بده.';out.textContent='در حال تحلیل…';const r=await remote('assistant',{question:q,context:ctx(x,j)});out.textContent=r?.text||local(x,j,q);};
    sec.querySelector('[data-similar]').onclick=()=>similar(j,sim);
  };
})();