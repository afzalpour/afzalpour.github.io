'use strict';

// Stock Hunter 4.1.1 — plain-Persian interpretation layer.
// Thresholds for QI/OFI/depth/flow variables are internal Stock Hunter
// interpretation bands, not universal market laws. Standard indicators such
// as RSI follow their conventional ranges, but are still interpreted in context.

const decisionCol411=columns.find(c=>c[0]==='consensus');
if(decisionCol411) decisionCol411[1]='امتیاز تصمیم';

function insight411(label,x){
  const v={
    fast:x.fast,accel:x.accel,p2:x.p2,p3:x.p3,risk:x.risk,qi:x.qi,ofi:x.ofi,
    bid:x.bidStack,pull:x.askPull,rvol:x.rvol,rsi:x.rsi,ema9:x.ema9,ema21:x.ema21,
    vwap:x.vwap,atr:x.atr,last:x.last,abs:x.abs,cancel:x.cancel,pv:x.pv,
    qd:x.queueDecay,depth:x.depthRatio,rr:x.rr,entry:x.entry,stop:x.stop,
    t1:x.t1,t2:x.t2,t3:x.t3,cont:x.cont,flow:x.flowScore,trend:x.trendScore,
    momentum:x.momentumScore,consensus:x.integratedScore,confidence:x.confidenceScore
  };
  const out=(state,text,range='')=>({state,text,range});
  switch(label){
    case 'امتیاز لحظه‌ای':
      return v.fast>=70?out('good','قوی؛ فشار لحظه‌ای تقاضا و رفتار سفارش‌ها مساعد است.','۷۰ به بالا قوی؛ ۵۵–۷۰ متوسط؛ زیر ۴۵ ضعیف'):
        v.fast>=55?out('mid','متوسط؛ برای ورود به تأیید جریان پول و تداوم نیاز دارد.','۷۰ به بالا قوی؛ ۵۵–۷۰ متوسط؛ زیر ۴۵ ضعیف'):
        v.fast>=45?out('neutral','خنثی تا ضعیف؛ مزیت لحظه‌ای واضح نیست.','۷۰ به بالا قوی؛ ۵۵–۷۰ متوسط؛ زیر ۴۵ ضعیف'):
        out('bad','ضعیف؛ ریزساختار فعلاً ورود را تأیید نمی‌کند.','زیر ۴۵ ضعیف');
    case 'شتاب سیگنال':
      return v.accel>=20?out('good','شتاب مثبت قوی؛ کیفیت سیگنال نسبت به چرخه قبل سریع بهتر شده است.','+۲۰ به بالا قوی؛ +۸ تا +۲۰ مثبت؛ ±۸ خنثی؛ زیر −۸ تضعیف'):
        v.accel>=8?out('mid','مثبت؛ سیگنال در حال تقویت است.','+۸ تا +۲۰ مثبت'):
        v.accel>-8?out('neutral','خنثی؛ تغییر معنی‌دار نسبت به چرخه قبل ندارد.','−۸ تا +۸ خنثی'):
        v.accel>-20?out('warn','منفی؛ قدرت سیگنال در حال کاهش است.','−۲۰ تا −۸ تضعیف'):
        out('bad','کاهش شدید؛ سیگنال به سرعت ضعیف شده است.','کمتر از −۲۰ ضعیف');
    case 'عدم‌تعادل صف':
      return v.qi>=.35?out('good','تقاضای دفتر سفارش به‌وضوح بر عرضه غالب است.','QI از −۱ تا +۱؛ بالای +۰٫۳۵ قوی، نزدیک صفر متعادل، زیر −۰٫۳۵ عرضه‌محور'):
        v.qi>=.1?out('mid','برتری ملایم تقاضا.','+۰٫۱۰ تا +۰٫۳۵ مثبت'):
        v.qi>-.1?out('neutral','تقریباً متعادل.','−۰٫۱۰ تا +۰٫۱۰ متعادل'):
        v.qi>-.35?out('warn','عرضه کمی سنگین‌تر است.','−۰٫۳۵ تا −۰٫۱۰ منفی'):
        out('bad','غلبه محسوس عرضه در دفتر سفارش.','کمتر از −۰٫۳۵ منفی قوی');
    case 'عدم‌تعادل جریان سفارش':
      return v.ofi>=.25?out('good','ورود/تقویت سفارش خرید نسبت به فروش قوی است.','OFI از −۱ تا +۱؛ بالای +۰٫۲۵ قوی، نزدیک صفر خنثی، زیر −۰٫۲۵ منفی قوی'):
        v.ofi>=.05?out('mid','جریان سفارش اندکی به نفع خریدار است.','+۰٫۰۵ تا +۰٫۲۵ مثبت'):
        v.ofi>-.05?out('neutral','جریان سفارش متعادل است.','−۰٫۰۵ تا +۰٫۰۵ خنثی'):
        v.ofi>-.25?out('warn','جریان سفارش کمی به نفع فروشنده است.','−۰٫۲۵ تا −۰٫۰۵ منفی'):
        out('bad','فشار جریان سفارش فروش بالاست.','کمتر از −۰٫۲۵ منفی قوی');
    case 'انباشت خرید ۱۵ ثانیه':
      return v.bid>=50?out('good','افزایش سریع عمق خرید؛ تقاضای جدید قابل‌توجه است.','بیش از ۵۰٪ قوی؛ ۱۵–۵۰٪ مثبت؛ ±۱۵٪ خنثی'):
        v.bid>=15?out('mid','انباشت خرید مثبت است.','۱۵ تا ۵۰٪ مثبت'):
        v.bid>-15?out('neutral','تغییر عمق خرید محدود است.','−۱۵ تا +۱۵٪ خنثی'):
        out('bad','عمق خرید در حال کاهش است.','کمتر از −۱۵٪ منفی');
    case 'عقب‌نشینی فروش ۱۵ ثانیه':
      return v.pull>=35?out('good','عرضه از دفتر سفارش با سرعت عقب‌نشینی کرده است.','بیش از ۳۵٪ قوی؛ ۱۰–۳۵٪ مثبت؛ نزدیک صفر خنثی'):
        v.pull>=10?out('mid','کاهش عرضه قابل مشاهده است.','۱۰ تا ۳۵٪ مثبت'):
        v.pull>-10?out('neutral','تغییر عرضه محدود است.','−۱۰ تا +۱۰٪ خنثی'):
        out('bad','عرضه در حال افزایش است.','کمتر از −۱۰٪ منفی');
    case 'جذب عرضه':
      return v.abs>=60?out('good','بخش زیادی از کاهش عرضه با معامله واقعی همراه بوده؛ نشانه جذب مناسب است.','۶۰٪ به بالا قوی؛ ۳۰–۶۰٪ متوسط؛ زیر ۱۵٪ مشکوک به لغو'):
        v.abs>=30?out('mid','جذب عرضه متوسط است.','۳۰ تا ۶۰٪ متوسط'):
        v.abs>=15?out('neutral','جذب ضعیف تا متوسط.','۱۵ تا ۳۰٪ ضعیف'):
        out('bad','کاهش سفارش‌ها عمدتاً با معامله توضیح داده نمی‌شود؛ احتمال لغو بالا است.','زیر ۱۵٪ ضعیف/مشکوک');
    case 'لغو سفارش':
      return v.cancel<20?out('good','لغو کم؛ تغییرات دفتر سفارش معتبرتر است.','زیر ۲۰٪ مطلوب؛ ۲۰–۵۰٪ قابل‌قبول؛ ۵۰–۸۰٪ پرریسک؛ بالای ۸۰٪ بسیار پرریسک'):
        v.cancel<50?out('mid','لغو متوسط؛ سیگنال دفتر سفارش نیازمند تأیید است.','۲۰ تا ۵۰٪ متوسط'):
        v.cancel<80?out('warn','لغو بالا؛ احتمال سفارش‌های ناپایدار بیشتر است.','۵۰ تا ۸۰٪ پرریسک'):
        out('bad','لغو بسیار بالا؛ خطر سیگنال کاذب جدی است.','۸۰٪ به بالا بسیار پرریسک');
    case 'سرعت قیمت':
      return v.pv>=.20?out('good','حرکت کوتاه‌مدت قیمت رو به بالا و پرشتاب است.','بیش از +۰٫۲۰ قوی؛ +۰٫۰۵ تا +۰٫۲۰ مثبت؛ ±۰٫۰۵ خنثی'):
        v.pv>=.05?out('mid','سرعت قیمت مثبت است.','+۰٫۰۵ تا +۰٫۲۰ مثبت'):
        v.pv>-.05?out('neutral','قیمت تقریباً بدون شتاب است.','−۰٫۰۵ تا +۰٫۰۵ خنثی'):
        v.pv>-.20?out('warn','سرعت قیمت منفی است.','−۰٫۲۰ تا −۰٫۰۵ منفی'):
        out('bad','افت کوتاه‌مدت پرشتاب است.','کمتر از −۰٫۲۰ منفی قوی');
    case 'کاهش صف فروش':
      return v.qd>=40?out('good','صف فروش به‌طور محسوسی در حال تخلیه است.','۴۰٪ به بالا قوی؛ ۱۵–۴۰٪ مثبت؛ نزدیک صفر خنثی؛ منفی یعنی صف بزرگ‌تر شده'):
        v.qd>=15?out('mid','کاهش صف فروش مثبت است.','۱۵ تا ۴۰٪ مثبت'):
        v.qd>-10?out('neutral','تغییر صف فروش محدود است.','−۱۰ تا +۱۵٪ خنثی'):
        out('bad','صف فروش در حال بزرگ‌تر شدن است.','کمتر از −۱۰٪ منفی');
    case 'قدرت عمق تقاضا':
      return v.depth>=5?out('good','بسیار قوی؛ عمق تقاضای قابل‌مشاهده چند برابر عرضه است. همراه نرخ لغو سفارش بررسی شود.','بالاتر از ۲ قوی؛ ۱٫۲–۲ مثبت؛ ۰٫۸–۱٫۲ متعادل؛ زیر ۰٫۸ ضعیف'):
        v.depth>=2?out('good','قوی؛ عمق خرید بیش از دو برابر عمق فروش است.','بالاتر از ۲ قوی'):
        v.depth>=1.2?out('mid','تقاضا از عرضه بیشتر است.','۱٫۲ تا ۲ مثبت'):
        v.depth>=.8?out('neutral','عمق خرید و فروش تقریباً متعادل است.','۰٫۸ تا ۱٫۲ متعادل'):
        v.depth>=.5?out('warn','عمق عرضه بیشتر از تقاضاست.','۰٫۵ تا ۰٫۸ ضعیف'):
        out('bad','عرضه به‌وضوح بر عمق تقاضا غالب است.','کمتر از ۰٫۵ ضعیف');
    case 'احتمال تداوم ۲ روزه': case 'احتمال تداوم ۳ روزه':
      const p=label.includes('۲')?v.p2:v.p3;
      return p>=70?out('good','برآورد داخلی تداوم قوی است؛ این عدد هنوز احتمال کالیبره‌شده نیست.','۷۰ به بالا قوی؛ ۵۵–۷۰ مثبت؛ ۴۵–۵۵ خنثی؛ زیر ۴۵ ضعیف'):
        p>=55?out('mid','برآورد تداوم مثبت است؛ نیازمند تأیید سایر لایه‌ها.','۵۵ تا ۷۰ مثبت'):
        p>=45?out('neutral','برآورد تداوم خنثی است.','۴۵ تا ۵۵ خنثی'):
        out('bad','برآورد تداوم ضعیف است.','زیر ۴۵ ضعیف');
    case 'شاخص قدرت نسبی':
      return v.rsi>=75?out('warn','مومنتوم بسیار بالا/اشباع خرید؛ در روند قوی الزاماً سیگنال فروش نیست، ولی ریسک تعقیب قیمت بیشتر است.','RSI>70 اشباع خرید؛ 40–60 متعادل؛ <30 اشباع فروش'):
        v.rsi>=60?out('mid','مومنتوم مثبت و نسبتاً قوی.','۶۰ تا ۷۵ مثبت'):
        v.rsi>=40?out('neutral','ناحیه متعادل.','۴۰ تا ۶۰ متعادل'):
        v.rsi>=30?out('warn','مومنتوم ضعیف و نزدیک اشباع فروش.','۳۰ تا ۴۰ ضعیف'):
        out('warn','اشباع فروش؛ می‌تواند نشانه ضعف یا زمینه برگشت باشد و به‌تنهایی سیگنال خرید نیست.','زیر ۳۰ اشباع فروش');
    case 'میانگین نمایی ۹ دوره': case 'میانگین نمایی ۲۱ دوره':
      if(!v.ema9||!v.ema21) return out('neutral','داده کافی برای مقایسه میانگین‌ها موجود نیست.','EMA9 بالاتر از EMA21 معمولاً تأیید روند کوتاه‌مدت مثبت است');
      return v.ema9>v.ema21&&v.last>=v.ema9?out('good','قیمت و EMA9 بالاتر از EMA21 هستند؛ ساختار کوتاه‌مدت مثبت است.','EMA9>EMA21 و قیمت بالای EMA9 مثبت'):
        v.ema9>v.ema21?out('mid','EMA9 بالاتر است، ولی قیمت نیازمند تأیید مجدد است.','EMA9>EMA21 مثبت مشروط'):
        out('bad','EMA9 زیر EMA21 است؛ روند کوتاه‌مدت هنوز ضعیف است.','EMA9<EMA21 منفی');
    case 'میانگین موزون قیمت':
      if(!v.vwap||!v.last)return out('neutral','VWAP کافی در دسترس نیست.','قیمت بالای VWAP نشانه نسبی قدرت در همان جلسه است');
      const dv=(v.last/v.vwap-1)*100;
      return dv>=.2?out('good','قیمت بالاتر از VWAP است؛ خریداران جلسه فعلاً دست بالا را دارند.','بیش از ۰٫۲٪ بالای VWAP مثبت؛ نزدیک VWAP خنثی؛ پایین آن ضعیف'):
        dv>-.2?out('neutral','قیمت نزدیک VWAP است؛ برتری واضحی وجود ندارد.','±۰٫۲٪ خنثی'):
        out('bad','قیمت زیر VWAP است؛ قدرت نسبی جلسه ضعیف‌تر است.','بیش از ۰٫۲٪ زیر VWAP منفی');
    case 'دامنه نوسان واقعی':
      if(!v.atr||!v.last)return out('neutral','ATR برای این نماد کافی نیست.','ATR خوب/بد نیست؛ شدت نوسان و فاصله مناسب حدضرر را نشان می‌دهد');
      const ap=v.atr/v.last*100;
      return ap<1?out('neutral','نوسان کوتاه‌مدت کم است.','ATR/Price زیر ۱٪ کم؛ ۱–۲٫۵٪ متوسط؛ ۲٫۵–۴٪ زیاد؛ بالای ۴٪ بسیار زیاد'):
        ap<2.5?out('mid','نوسان در محدوده متوسط است.','۱ تا ۲٫۵٪ متوسط'):
        ap<4?out('warn','نوسان بالاست؛ اندازه موقعیت و حدضرر باید محافظه‌کارانه‌تر باشد.','۲٫۵ تا ۴٪ زیاد'):
        out('bad','نوسان بسیار بالاست؛ ریسک اجرای معامله زیاد است.','بیش از ۴٪ بسیار زیاد');
    case 'حجم نسبی روزانه':
      return v.rvol>=2?out('good','حجم بسیار بالاتر از معمول؛ مشارکت بازار در حرکت قوی است.','۲ برابر به بالا بسیار قوی؛ ۱٫۵–۲ قوی؛ ۱–۱٫۵ عادی/مثبت؛ زیر ۰٫۷ کم'):
        v.rvol>=1.5?out('good','حجم بالاتر از معمول و تأییدکننده حرکت است.','۱٫۵ تا ۲ برابر قوی'):
        v.rvol>=1?out('mid','حجم نزدیک یا کمی بالاتر از معمول است.','۱ تا ۱٫۵ برابر عادی/مثبت'):
        v.rvol>=.7?out('neutral','حجم کمی کمتر از معمول است.','۰٫۷ تا ۱ برابر'):
        out('warn','مشارکت حجمی پایین است؛ اعتبار شکست‌ها کمتر می‌شود.','کمتر از ۰٫۷ برابر ضعیف');
    case 'نسبت سود به زیان':
      return v.rr>=2?out('good','جذاب؛ سود هدف اول دست‌کم دو برابر ریسک اولیه است.','۲ به بالا مناسب؛ ۱٫۵–۲ قابل‌قبول؛ ۱–۱٫۵ ضعیف؛ زیر ۱ نامطلوب'):
        v.rr>=1.5?out('mid','قابل‌قبول، ولی حاشیه اطمینان متوسط است.','۱٫۵ تا ۲ قابل‌قبول'):
        v.rr>=1?out('warn','ضعیف؛ پاداش نسبت به ریسک محدود است.','۱ تا ۱٫۵ ضعیف'):
        out('bad','نامطلوب؛ ریسک از پاداش هدف اول بیشتر است.','زیر ۱ نامطلوب');
    case 'قیمت فعلی': return out('neutral','خودِ قیمت خوب یا بد نیست؛ باید نسبت به ورود، VWAP، روند و حدضرر سنجیده شود.','بدون آستانه مستقل');
    case 'ورود پیشنهادی': return out('neutral','قیمت اجرایی پیشنهادی مدل؛ اعتبار آن به تصمیم نهایی، نقدشوندگی و تازگی داده وابسته است.','برنامه معامله، نه شاخص کیفیت');
    case 'بازه ورود': return out('neutral','محدوده قابل‌قبول اجرای معامله برای جلوگیری از تعقیب قیمت.','ورود خارج از این بازه نیازمند محاسبه مجدد است');
    case 'حد ضرر': return out('warn','مرز ابطال سناریوی معامله؛ عبور معتبر از آن یعنی فرض اولیه مدل نقض شده است.','ابزار کنترل ریسک');
    case 'هدف اول': case 'هدف دوم': case 'هدف سوم': return out('good','سطح هدف سناریوی معامله؛ رسیدن به آن تضمین‌شده نیست و باید همراه حدضرر مدیریت شود.','هدف برنامه معامله');
    default:return null;
  }
}

const metricBefore411=metric;
metric=function(label,value,c=''){
  const x=window.__shMetricContext411;
  const info=x?insight411(label,x):null;
  if(!info)return metricBefore411(label,value,c);
  return `<div class="metric metric-explained"><span>${esc(label)}</span><b class="${c}">${value}</b><small class="metric-state ${info.state}">${esc(info.text)}</small><small class="metric-range">${esc(info.range)}</small></div>`;
};

const detailBefore411=detailHTML;
detailHTML=function(x,ichi,gann){
  window.__shMetricContext411=x;
  try{
    let html=detailBefore411(x,ichi,gann);
    html=html.replaceAll('امتیاز اجماع','امتیاز تصمیم');
    html=html.replace('احتمال کالیبره‌شده نیست','شاخص ۰ تا ۱۰۰؛ احتمال موفقیت نیست');
    return html;
  }finally{window.__shMetricContext411=null;}
};

const integratedSummaryBefore411=integratedSummaryHTMLV410;
integratedSummaryHTMLV410=function(x){
  return integratedSummaryBefore411(x)
    .replaceAll('امتیاز اجماع','امتیاز تصمیم')
    .replace('احتمال کالیبره‌شده نیست','شاخص ۰ تا ۱۰۰؛ احتمال موفقیت نیست')
    .replace('در نسخه ۴.۱.۰ عدد «امتیاز تصمیم»','در نسخه ۴.۱.۱ عدد «امتیاز تصمیم»');
};

const cellBefore411=cell;
cell=function(k,x){
  if(k==='consensus')return x.integratedEligible?`<b>${fa(x.integratedScore,1)}</b><div class="company">امتیاز تصمیم؛ نه درصد موفقیت</div>`:'—';
  return cellBefore411(k,x);
};

updateSummary=function(){
  $('specialCount').textContent=rows.filter(x=>x.hunt==='شکار ویژه').length.toLocaleString('fa-IR');
  $('urgentCount').textContent=rows.filter(x=>x.hunt==='هشدار فوری').length.toLocaleString('fa-IR');
  $('buyCount').textContent=rows.filter(x=>x.decision==='ورود قوی'||x.decision==='ورود اولیه').length.toLocaleString('fa-IR');
  const t=[...rows].filter(x=>x.hunt==='شکار ویژه'||x.hunt==='هشدار فوری').sort((a,b)=>b.fast-a.fast)[0];
  $('topSymbol').textContent=t?.symbol||'—';
  $('topMeta').textContent=t?`${t.company} — ${t.decision}${t.integratedEligible?` — امتیاز تصمیم ${fa(t.integratedScore,0)}`:''}`:'—';
};
try{updateSummary()}catch{}
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=4.1.1').catch(()=>{});
