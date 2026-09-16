'use strict';
// Preserve the 4.1.1 Persian interpretation layer while forwarding all five
// forecast models added in 4.1.4 to the underlying detail renderer.
if(typeof detailBefore411==='function'){
  detailHTML=function(...args){
    const x=args[0];
    window.__shMetricContext411=x;
    try{
      let html=detailBefore411(...args);
      html=html.replaceAll('امتیاز اجماع','امتیاز تصمیم');
      html=html.replace('احتمال کالیبره‌شده نیست','شاخص ۰ تا ۱۰۰؛ احتمال موفقیت نیست');
      return html;
    }finally{window.__shMetricContext411=null;}
  };
}
