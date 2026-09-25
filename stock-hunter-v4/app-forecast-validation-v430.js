'use strict';

// Stock Hunter Forecast Validation Gate v4.3.0
// UI-only evidence layer. It does NOT modify any forecast equation and does NOT
// participate in Frozen Hunt 4.1.6 scoring, filtering, ranking, Action Now or Radar.
(function(){
  const evidence=Object.freeze({
    version:'4.3.0-forecast-final-gated',
    calibration:'v4.2.1-90case-20260925',
    requestedCases:90,
    completedCases:88,
    cleanCases:70,
    forecastableCleanCases:68,
    independentAnchorWindows:3,
    bestIndividualModel:'MACD/EMA',
    bestIndividualMeanAPE:3.2116352378331805,
    bestIndividualAdjustedP:0.6329742731731625,
    latestWindowBaselineMeanAPE:3.208835186716304,
    latestWindowBestModel:'Bollinger',
    latestWindowBestModelMeanAPE:3.278945,
    verdict:'NO_STATISTICALLY_CONFIRMED_EDGE',
    finalForecastEnabled:false
  });
  window.STOCK_HUNTER_FORECAST_VALIDATION_V430=evidence;

  function faNum(v,d=1){
    return Number(v).toLocaleString('fa-IR',{minimumFractionDigits:d,maximumFractionDigits:d});
  }
  function gateHTML(){
    return '<div class="forecast-validation-gate-v430" role="note" aria-label="وضعیت اعتبارسنجی پنج مدل">'
      +'<div class="forecast-validation-gate-head-v430"><b>اعتبارسنجی پنج مدل: خروجی تشخیصی</b><span>Final Gate: NO_EDGE</span></div>'
      +'<p>ایچیموکو، گن، بولینگر، MACD/EMA و OBV برای مقایسه نمایش داده می‌شوند، اما در داده اعتبارسنجی فعلی برتری آماری پایدار نسبت به Baseline اثبات نشده است؛ بنابراین هیچ قیمت یا جهت ترکیبی به‌عنوان پیش‌بینی نهایی معتبر تولید نمی‌شود.</p>'
      +'<div class="forecast-validation-stats-v430">'
      +'<span>۹۰ آزمون</span><span>۷۰ نمونه پاک</span><span>۶۸ نمونه قابل‌پیش‌بینی</span><span>۳ پنجره مستقل</span>'
      +'<span>بهترین Mean APE منفرد: '+faNum(evidence.bestIndividualMeanAPE,2)+'٪</span>'
      +'<span>Adjusted p: '+faNum(evidence.bestIndividualAdjustedP,3)+'</span>'
      +'</div>'
      +'<small>این Gate فقط به بخش پنج سناریوی ۱۰روزه مربوط است و موتور Frozen Hunt 4.1.6 را تغییر نمی‌دهد.</small>'
      +'</div>';
  }

  if(typeof detailHTML==='function'){
    const detailBefore430=detailHTML;
    detailHTML=function(...args){
      let html=detailBefore430(...args);
      const marker='<div class="section-title">مقایسه ۵ سناریوی عددی برای ۱۰ روز کاری آینده</div>';
      if(html.includes(marker) && !html.includes('forecast-validation-gate-v430')){
        html=html.replace(marker,marker+gateHTML());
      }
      return html;
    };
  }

  const style=document.createElement('style');
  style.textContent=`
    .forecast-validation-gate-v430{
      grid-column:1/-1;
      border:1px solid #665f33;
      background:rgba(110,91,26,.13);
      border-radius:12px;
      padding:12px 14px;
      margin:2px 0 10px;
    }
    .forecast-validation-gate-head-v430{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
    .forecast-validation-gate-head-v430>b{font-size:13px}
    .forecast-validation-gate-head-v430>span{
      direction:ltr;
      font:700 11px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;
      border:1px solid currentColor;
      border-radius:999px;
      padding:4px 8px;
    }
    .forecast-validation-gate-v430 p{margin:8px 0;line-height:1.9;font-size:11px}
    .forecast-validation-stats-v430{display:flex;flex-wrap:wrap;gap:6px;margin:7px 0}
    .forecast-validation-stats-v430 span{border:1px solid rgba(150,150,150,.28);border-radius:999px;padding:3px 7px;font-size:9px}
    .forecast-validation-gate-v430 small{display:block;opacity:.76;font-size:9px;line-height:1.7}
    html[data-theme="light"] .forecast-validation-gate-v430{background:#fff9dd;border-color:#b9a34c;color:#3f381f}
    @media(max-width:760px){.forecast-validation-gate-v430{padding:10px}.forecast-validation-gate-head-v430{align-items:flex-start}}
  `;
  document.head.appendChild(style);
})();
