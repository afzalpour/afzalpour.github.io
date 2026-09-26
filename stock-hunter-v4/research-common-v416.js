'use strict';
(function(){
  const cfg=window.STOCK_HUNTER_CONFIG||{};
  const base=String(cfg.SUPABASE_URL||'').replace(/\/$/,'');
  const key=String(cfg.SUPABASE_PUBLISHABLE_KEY||'');
  function headers(){return {'apikey':key,'Authorization':'Bearer '+key,'Accept':'application/json'};}
  async function api(table,query){
    const url=base+'/rest/v1/'+table+(query?('?'+query):'');
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
    try{
      const r=await fetch(url,{headers:headers(),cache:'no-store',signal:ctrl.signal});
      if(!r.ok)throw new Error('خطای دریافت داده؛ کد '+r.status);
      return await r.json();
    }finally{clearTimeout(timer);}
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function fa(v,d=0){if(v==null||v==='')return '—';const n=Number(v);return Number.isFinite(n)?n.toLocaleString('fa-IR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
  function pct(v,d=2){if(v==null||v==='')return '—';const n=Number(v);return Number.isFinite(n)?((n>0?'+':'')+fa(n,d)+'٪'):'—';}
  function latinDigits(v){return String(v??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));}
  function jalaliDate(v){
    if(!v)return '—';
    const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(v))?String(v)+'T12:00:00Z':v);
    if(!Number.isFinite(d.getTime()))return '—';
    const parts=new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn',{calendar:'persian',numberingSystem:'latn',timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const g=t=>latinDigits(parts.find(p=>p.type===t)?.value||'');
    return g('year').padStart(4,'0')+'/'+g('month').padStart(2,'0')+'/'+g('day').padStart(2,'0');
  }
  function jalaliToIso(v){
    const s=latinDigits(v).trim().replace(/[.\-]/g,'/').replace(/\s+/g,'');
    const m=s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);if(!m)return null;
    let jy=Number(m[1]),jm=Number(m[2]),jd=Number(m[3]);
    if(jm<1||jm>12||jd<1||jd>31||(jm>6&&jd>30))return null;
    jy+=1595;
    let days=-355668+(365*jy)+Math.floor(jy/33)*8+Math.floor(((jy%33)+3)/4)+jd+(jm<7?(jm-1)*31:((jm-7)*30)+186);
    let gy=400*Math.floor(days/146097);days%=146097;
    if(days>36524){gy+=100*Math.floor(--days/36524);days%=36524;if(days>=365)days++;}
    gy+=4*Math.floor(days/1461);days%=1461;
    if(days>365){gy+=Math.floor((days-1)/365);days=(days-1)%365;}
    let gd=days+1;
    const leap=(gy%4===0&&gy%100!==0)||gy%400===0;
    const md=[0,31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
    let gm=1;while(gm<=12&&gd>md[gm]){gd-=md[gm];gm++;}
    const iso=String(gy).padStart(4,'0')+'-'+String(gm).padStart(2,'0')+'-'+String(gd).padStart(2,'0');
    return jalaliDate(iso)===String(m[1]).padStart(4,'0')+'/'+String(jm).padStart(2,'0')+'/'+String(jd).padStart(2,'0')?iso:null;
  }
  function setJalaliInput(el,iso){if(el){el.dataset.iso=iso;el.value=jalaliDate(iso);}}
  function readJalaliInput(el,fallback){
    const iso=jalaliToIso(el?.value);if(iso){if(el)el.dataset.iso=iso;return iso;}
    const fb=el?.dataset.iso||fallback||todayIso();setJalaliInput(el,fb);return fb;
  }
  function time(v){
    if(!v)return '—';const d=new Date(v);if(!Number.isFinite(d.getTime()))return '—';
    return new Intl.DateTimeFormat('fa-IR-u-nu-latn',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
  }
  function dateTime(v){return v?jalaliDate(v)+' ساعت '+time(v):'—';}
  function todayIso(){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const g=t=>parts.find(p=>p.type===t)?.value||'';return g('year')+'-'+g('month')+'-'+g('day');
  }
  function daysAgoIso(n){const d=new Date();d.setUTCDate(d.getUTCDate()-Number(n||0));return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
  function addDaysIso(iso,n){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+Number(n||0));return d.toISOString().slice(0,10);}
  function setStatus(text,state='ok'){const e=document.getElementById('researchStatus');if(!e)return;e.textContent=text;e.dataset.state=state;}
  const datasetFa={
    RAW_MARKET_TAPE:'داده خام لحظه‌ای بازار',SHADOW_SAMPLES:'نمونه‌های پایش تشخیصی',
    OUTCOME_OBSERVATIONS:'مشاهدات نتیجه',HUNT_EVENTS:'رخدادهای شکار',
    HUNT_EFFECTIVENESS:'سنجش اثربخشی شکار',HUNT_CARRY:'پیگیری عبور موفق',
    HUNT_JOURNEY:'سفر شکار',MISSED_OPPORTUNITIES:'فرصت‌های از دست‌رفته',
    BACKTEST_DAILY:'خلاصه روزانه آزمون تاریخی',BACKTEST_SLICES:'برش‌های تحلیلی آزمون تاریخی',MARKET_REPLAY_30SEC:'بازپخش ۳۰ثانیه‌ای بازار',RELIABILITY_SNAPSHOTS:'نماهای پایداری سامانه'
  };
  const tierFa={RAW:'خام و کوتاه‌مدت',COMPACT:'فشرده و تحلیلی',SUMMARY:'خلاصه بلندمدت'};
  const carryFa={WAITING_CROSS:'در انتظار عبور +۱٪',ACTIVE:'پیگیری ۱۵ دقیقه‌ای فعال',COMPLETED:'پیگیری تکمیل شده',EXPIRED_NO_CROSS:'بدون عبور +۱٪'};
  window.StockHunterResearchV416={
    version:'4.1.6-research-v3',api,esc,fa,pct,latinDigits,jalaliDate,jalaliToIso,setJalaliInput,readJalaliInput,
    time,dateTime,todayIso,daysAgoIso,addDaysIso,setStatus,datasetFa,tierFa,carryFa
  };
})();