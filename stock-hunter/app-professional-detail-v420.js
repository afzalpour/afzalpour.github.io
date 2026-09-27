'use strict';
(function(){
 const cfg=window.STOCK_HUNTER_CONFIG||{},base=String(cfg.SUPABASE_URL||'').replace(/\/$/,''),key=String(cfg.SUPABASE_PUBLISHABLE_KEY||'');
 if(!base||!key||typeof openDetail!=='function')return;
 const prior=openDetail,fa=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('fa-IR',{maximumFractionDigits:1}):'—',esc2=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 async function api(t,q){const r=await fetch(base+'/rest/v1/'+t+'?'+q,{headers:{apikey:key,Accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error(String(r.status));return r.json();}
 function confidence(j,health=''){const ev=Math.min(30,(Number(j.evidence_count)||0)*5+(Number(j.dynamic_evidence_count)||0)*5),risk=Math.max(0,25*(1-(Number(j.risk_score)||50)/100)),cancel=Math.max(0,20*(1-(Number(j.cancellation_ratio)||50)/100)),h=/سالم|ok/i.test(health)?25:15;return Math.round(Math.max(0,Math.min(100,ev+risk+cancel+h)));}
 openDetail=async function(id){
   await prior(id);const body=document.getElementById('detailBody');if(!body)return;
   try{
     const [jr,rel]=await Promise.all([
       api('stock_hunter_hunt_journey_v416','select=*&symbol_id=eq.'+encodeURIComponent(id)+'&order=trade_date.desc,detected_at.asc&limit=4'),
       api('stock_hunter_reliability_v416','select=overall_state&order=observed_at.desc&limit=1').catch(()=>[])
     ]);
     const j=jr.find(x=>x.channel==='ACTION_NOW')||jr[0];if(!j)return;
     const q=confidence(j,rel[0]?.overall_state||''),label=q>=75?'بالا':q>=55?'متوسط':'محدود';
     const sec=document.createElement('section');sec.className='detail-professional-v420';
     sec.innerHTML='<div class="detail-prof-head"><div><b>گذرنامه و اعتبار شکار</b><small>لایه توضیحی مستقل از امتیاز شکار</small></div><a href="professional-center-v420.html">مرکز حرفه‌ای</a></div>'+
     '<div class="detail-prof-grid"><article><span>کیفیت اطمینان</span><b>'+fa(q)+' از ۱۰۰</b><small>'+label+'</small></article><article><span>شواهد</span><b>'+fa(j.evidence_count)+' / پویا '+fa(j.dynamic_evidence_count)+'</b></article><article><span>ریسک / لغو</span><b>'+fa(j.risk_score)+' / '+fa(j.cancellation_ratio)+'</b></article><article><span>سرنوشت روز</span><b>پیشروی '+fa(j.same_day_mfe_pct)+'٪</b><small>افت '+fa(j.same_day_mae_pct)+'٪</small></article></div>'+
     '<div class="detail-prof-line">مسیر: <b>'+esc2(j.hunt_mode==='reversal'?'برگشت از منفی':'شتاب‌گیری')+'</b> · وضعیت: <b>'+esc2(j.hunt_state)+'</b> · سلامت داده: <b>'+esc2(rel[0]?.overall_state||'نامشخص')+'</b></div>';
     body.appendChild(sec);
   }catch{}
 };
})();