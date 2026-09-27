'use strict';
// Preserve the 4.1.1 Persian interpretation layer while forwarding all six
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
const forecastStyle414=document.createElement('style');
forecastStyle414.textContent=`
.forecast-table-wrap{overflow-x:auto!important}
.forecast-table{min-width:900px}
.forecast-box small{display:block;margin-top:5px;color:#7f9ab1;font-size:9px}
html[data-theme="light"] .forecast-box small{color:#617b90}
@media(max-width:760px){.forecast-table{min-width:860px}.forecast-box{grid-column:1/-1!important}}
`;
document.head.appendChild(forecastStyle414);
