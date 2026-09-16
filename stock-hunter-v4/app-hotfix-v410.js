'use strict';
async function resolveLiveDetailRow(id){
  const key=String(id||'');
  let x=rows.find(r=>String(r.id)===key);
  if(!x&&typeof universeRows!=='undefined')x=universeRows.find(r=>String(r.id)===key&&r.analyzed!==false);
  if(x)return x;
  const base=String(cfg.SUPABASE_URL||cfg.supabaseUrl||'').replace(/\/$/,'');
  if(!base||!key)return null;
  try{
    const table=cfg.TABLE||'stock_hunter_signals_v4';
    const p=new URLSearchParams({select:'*',id:`eq.${key}`,limit:'1'});
    const r=await fetch(`${base}/rest/v1/${table}?${p.toString()}`,{headers:headers(),cache:'no-store'});
    if(!r.ok)return null;
    const a=await r.json();
    if(!a.length)return null;
    x=norm(a[0]);
    x.analyzed=true;
    const i=rows.findIndex(z=>String(z.id)===key);
    if(i>=0)rows[i]=x;else rows.push(x);
    return x;
  }catch{return null;}
}
openDetail=async function(id){
  const x=await resolveLiveDetailRow(id);
  if(!x){
    $('dSymbol').textContent='جزئیات در دسترس نیست';
    $('dCompany').textContent='رکورد تحلیلی این نماد هنوز به سامانه نرسیده است.';
    $('detailBody').innerHTML='<div class="alert-box">نماد در فهرست بازار وجود دارد، اما در حال حاضر رکورد تحلیلی قابل بازیابی نیست.</div>';
    if(!$('detailDialog').open)$('detailDialog').showModal();
    return;
  }
  currentDetail=x;
  $('dSymbol').textContent=x.symbol;
  $('dCompany').textContent=x.company;
  $('detailBody').innerHTML='<div class="history-loading">در حال دریافت سابقه روزانه نماد و محاسبه پیش‌بینی ۱۰ روزه…</div>';
  if(!$('detailDialog').open)$('detailDialog').showModal();
  await fetchDailyHistory(x);
  if(currentDetail?.id!==x.id)return;
  const ichi=forecastIchimoku(x),gann=forecastGann(x);
  $('detailBody').innerHTML=detailHTML(x,ichi,gann);
};
