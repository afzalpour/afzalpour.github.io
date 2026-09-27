'use strict';
updateSummary=function(){
  $('specialCount').textContent=rows.filter(x=>x.hunt==='شکار ویژه').length.toLocaleString('fa-IR');
  $('urgentCount').textContent=rows.filter(x=>x.hunt==='هشدار فوری').length.toLocaleString('fa-IR');
  $('buyCount').textContent=rows.filter(x=>x.decision==='ورود قوی'||x.decision==='ورود اولیه').length.toLocaleString('fa-IR');
  const t=[...rows].filter(x=>x.hunt==='شکار ویژه'||x.hunt==='هشدار فوری').sort((a,b)=>b.fast-a.fast)[0];
  $('topSymbol').textContent=t?.symbol||'—';
  $('topMeta').textContent=t?`${t.company} — ${t.decision}${t.integratedEligible?` — اجماع ${fa(t.integratedScore,0)}`:''}`:'—';
};
try{updateSummary()}catch{}
