'use strict';
(function(){
  const cfg=window.STOCK_HUNTER_CONFIG||{},base=String(cfg.SUPABASE_URL||'').replace(/\/$/,''),key=String(cfg.SUPABASE_PUBLISHABLE_KEY||'');
  if(!base||!key||typeof openDetail!=='function')return;
  const previous=openDetail;
  const escV=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const faV=(v,d=0)=>typeof fa==='function'?fa(v,d):(Number.isFinite(Number(v))?Number(v).toLocaleString('fa-IR',{maximumFractionDigits:d}):'—');
  const pctV=(v,d=2)=>{const n=Number(v);return Number.isFinite(n)?((n>0?'+':'')+faV(n,d)+'٪'):'—';};
  const timeV=v=>{if(!v)return '—';const d=new Date(v);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('fa-IR-u-nu-latn',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d):'—';};
  const dateV=v=>{if(!v)return '—';const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(v))?v+'T12:00:00Z':v);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('fa-IR-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):'—';};
  async function api(table,q){
    const r=await fetch(base+'/rest/v1/'+table+'?'+q,{headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'},cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);return r.json();
  }
  function step(label,at,meta=''){return `<div class="detail-timeline-step ${at?'reached':'pending'}"><span>${escV(label)}</span><b>${at?timeV(at):'نرسیده'}</b><small>${escV(meta)}</small></div>`;}
  function nearest(rows,at){
    if(!at||!rows.length)return null;const t=new Date(at).getTime();let best=null,dist=Infinity;
    for(let i=0;i<rows.length;i++){const d=Math.abs(new Date(rows[i].bucket_at).getTime()-t);if(d<dist){dist=d;best={...rows[i],i};}}return best;
  }
  function chart(rows,journey){
    if(!rows.length)return '<div class="detail-hunt-empty">برای این رخداد داده بازپخش قیمت در بازه نگهداشت موجود نیست.</div>';
    const vals=rows.map(x=>Number(x.close_change_pct)).filter(Number.isFinite);if(!vals.length)return '';
    const ymin=Math.min(-.5,...vals)-.25,ymax=Math.max(1,...vals)+.25,n=Math.max(1,rows.length-1);
    const X=i=>42+(i/n)*895,Y=y=>190-((y-ymin)/(ymax-ymin))*150;
    const points=rows.map((x,i)=>({i,y:Number(x.close_change_pct)})).filter(x=>Number.isFinite(x.y));
    const path=points.map((p,i)=>(i?'L':'M')+X(p.i).toFixed(1)+','+Y(p.y).toFixed(1)).join(' ');
    const marks=[
      ['کشف',journey.detected_at],['صفر',journey.crossed_zero_at],['+۱٪',journey.crossed_plus1_at],
      ['+۲٪',journey.crossed_plus2_at],['+۳٪',journey.crossed_plus3_at]
    ].map(([label,at])=>{const p=nearest(rows,at);if(!p)return '';return `<line class="detail-chart-marker-line" x1="${X(p.i)}" x2="${X(p.i)}" y1="22" y2="190"/><circle class="detail-chart-marker" cx="${X(p.i)}" cy="${Y(Number(p.close_change_pct))}" r="4"/><text class="detail-chart-label" x="${X(p.i)}" y="16" text-anchor="middle">${label}</text>`;}).join('');
    return `<div class="detail-hunt-chart"><svg viewBox="0 0 960 215" preserveAspectRatio="none"><line class="detail-chart-zero" x1="35" x2="945" y1="${Y(0)}" y2="${Y(0)}"/><path class="detail-chart-line" d="${path}"/>${marks}</svg></div>`;
  }
  function chooseJourney(rows){
    if(!rows.length)return null;
    return [...rows].sort((a,b)=>{
      const av=a.channel==='ACTION_NOW'?1:0,bv=b.channel==='ACTION_NOW'?1:0;
      return bv-av||new Date(a.detected_at)-new Date(b.detected_at);
    })[0];
  }
  async function loadPanel(id){
    const jr=await api('stock_hunter_hunt_journey_v416','select=*&symbol_id=eq.'+encodeURIComponent(id)+'&order=trade_date.desc,detected_at.asc&limit=4');
    if(!jr.length)return null;
    const latestDate=jr[0].trade_date,dayRows=jr.filter(x=>x.trade_date===latestDate),j=chooseJourney(dayRows);
    let replay=await api('stock_hunter_market_replay_v416','select=bucket_at,close_change_pct,close_price,bucket_seconds&trade_date=eq.'+encodeURIComponent(latestDate)+'&symbol_id=eq.'+encodeURIComponent(id)+'&order=bucket_at.asc&limit=2500').catch(()=>[]);
    const bestResolution=replay.length?Math.min(...replay.map(x=>Number(x.bucket_seconds)||300)):0;if(bestResolution)replay=replay.filter(x=>(Number(x.bucket_seconds)||300)===bestResolution);
    const radar=dayRows.find(x=>x.channel==='RADAR'),action=dayRows.find(x=>x.channel==='ACTION_NOW');
    const first=[...dayRows].sort((a,b)=>new Date(a.detected_at)-new Date(b.detected_at))[0];
    const res=replay.length?(Number(replay[0].bucket_seconds)||300):(j?30:0);
    return `<section class="detail-hunt-timeline-v416">
      <div class="detail-hunt-title"><div><b>خط زمانی شکار</b><small>آخرین رخداد ثبت‌شده: ${dateV(latestDate)}</small></div><div><a href="hunt-journey-v416.html?symbol=${encodeURIComponent(j.symbol||'')}&date=${encodeURIComponent(latestDate)}">سفر کامل شکار</a><a href="market-replay-v416.html?symbol_id=${encodeURIComponent(id)}&date=${encodeURIComponent(latestDate)}">بازپخش بازار</a></div></div>
      <div class="detail-hunt-steps">
        ${step('اولین مشاهده شکار',first?.detected_at,first?pctV(first.detected_day_change):'')}
        ${step('شکار زودهنگام',radar?.detected_at,radar?('امتیاز '+faV(radar.hunt_score,1)):'')}
        ${step('شکار فعال',action?.detected_at,action?('امتیاز '+faV(action.hunt_score,1)):'')}
        ${step('عبور از صفر',j.crossed_zero_at,j.time_to_zero_min!=null?faV(j.time_to_zero_min,1)+' دقیقه':'')}
        ${step('رسیدن به +۱٪',j.crossed_plus1_at,j.time_to_plus1_min!=null?faV(j.time_to_plus1_min,1)+' دقیقه':'')}
        ${step('رسیدن به +۲٪',j.crossed_plus2_at,j.time_to_plus2_min!=null?faV(j.time_to_plus2_min,1)+' دقیقه':'')}
        ${step('رسیدن به +۳٪',j.crossed_plus3_at,j.time_to_plus3_min!=null?faV(j.time_to_plus3_min,1)+' دقیقه':'')}
      </div>
      ${chart(replay,j)}
      <div class="detail-hunt-metrics"><span>بیشترین پیشروی <b>${pctV(j.same_day_mfe_pct)}</b></span><span>بیشترین افت <b>${pctV(j.same_day_mae_pct)}</b></span><span>پایان همان‌روز <b>${pctV(j.same_day_close_change_pct)}</b></span><span>روز کاری بعد <b>${pctV(j.d1_close_change_pct)}</b></span><span>تفکیک بازپخش <b>${res===30?'۳۰ ثانیه':res===300?'۵ دقیقه':faV(res)+' ثانیه'}</b></span></div>
    </section>`;
  }
  openDetail=async function(id){
    await previous(id);
    const target=document.getElementById('detailBody');if(!target)return;
    const token=String(id||'');target.dataset.timelineRequest=token;
    const placeholder=document.createElement('div');placeholder.className='detail-hunt-timeline-loading';placeholder.textContent='در حال دریافت خط زمانی شکار…';target.appendChild(placeholder);
    try{
      const html=await loadPanel(token);
      if(target.dataset.timelineRequest!==token)return;
      placeholder.remove();if(html)target.insertAdjacentHTML('beforeend',html);
    }catch(_){placeholder.remove();}
  };
})();