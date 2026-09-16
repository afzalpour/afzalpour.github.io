'use strict';

// 4.1.6 hierarchy: the intraday Hunt Engine is primary; the prior integrated 1–3 day view is supplementary.
const decisionColHierarchyV416=columns.find(c=>c[0]==='decision');
if(decisionColHierarchyV416)decisionColHierarchyV416[1]='تأیید تکمیلی ۱–۳ روزه';
try{
  const dsel=$('decision');
  if(dsel?.options?.length)dsel.options[0].textContent='همه تأییدهای تکمیلی';
}catch{}

const detailHTMLBeforeHierarchyV416=detailHTML;
detailHTML=function(...args){
  let html=detailHTMLBeforeHierarchyV416(...args);
  html=html.replaceAll('تصمیم یکپارچه','تحلیل تکمیلی ۱–۳ روزه');
  html=html.replaceAll('تصمیم نهایی','تأیید تکمیلی');
  html=html.replaceAll('سه دلیل اصلی تصمیم:','سه دلیل تحلیل تکمیلی:');
  html=html.replaceAll('افق تصمیم: ۱ تا ۳ روز کاری','افق تکمیلی: ۱ تا ۳ روز کاری');
  return html;
};

setTimeout(()=>{try{renderColumnOptions();render();}catch{}},0);
