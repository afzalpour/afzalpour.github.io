'use strict';

// Stock Hunter 4.1.0 — Phase 1 integrated decision UI.
// The authoritative scoring fields are calculated centrally by the Supabase view
// stock_hunter_integrated_v1. This module only maps/explains those fields.

const normBeforeIntegratedV410 = norm;
norm = function(r){
  const x = normBeforeIntegratedV410(r);
  const legacy = r.decision || x.decision || 'نخر';
  x.legacyDecision = legacy;
  x.integratedEligible = r.integrated_eligible === true || r.integrated_eligible === 'true';
  x.integratedScore = n(r.integrated_score_v1) ?? 0;
  x.flowScore = n(r.flow_score_v1) ?? 0;
  x.trendScore = n(r.trend_score_v1) ?? 0;
  x.momentumScore = n(r.momentum_score_v1) ?? 0;
  x.dataQuality = n(r.data_quality_score_v1) ?? 0;
  x.directionAgreement = n(r.direction_agreement_v1) ?? 0;
  x.confidenceScore = n(r.confidence_score_v1) ?? 0;
  x.confidenceLabel = r.confidence_label_v1 || '—';
  x.marketRegime = r.market_regime_v1 || '—';
  x.marketBreadth = n(r.market_breadth_pct_v1);
  x.riskGate = r.risk_gate_v1 === true || r.risk_gate_v1 === 'true';
  x.gateReason = r.gate_reason_v1 || '';
  x.positiveExperts = Number(r.positive_experts_v1 || 0);
  x.negativeExperts = Number(r.negative_experts_v1 || 0);
  x.engineScope = r.engine_scope_v1 || '';
  x.engineVersion = r.engine_version_v1 || '';
  x.assetType = r.asset_type || x.assetType || '';
  x.market = r.market || x.market || '';
  x.volume = n(r.volume) ?? 0;
  x.value = n(r.value) ?? 0;
  x.finalDecision = r.final_decision_v1 || ({'خرید قوی':'ورود قوی','ورود اولیه':'ورود اولیه','تحت نظر':'تحت نظر','نخر':'عدم ورود'}[legacy] || legacy);
  x.decision = x.finalDecision;
  return x;
};

dc = function(v){
  if(v==='ورود قوی' || String(v).includes('خرید قوی')) return 'buy';
  if(v==='ورود اولیه') return 'early';
  if(v==='صبر برای تأیید' || v==='تحت نظر') return 'watch';
  return 'no';
};

const decisionColumnV410 = columns.find(c=>c[0]==='decision');
if(decisionColumnV410) decisionColumnV410[1] = 'تصمیم نهایی';
if(!columns.some(c=>c[0]==='consensus')){
  const i = Math.max(0, columns.findIndex(c=>c[0]==='details'));
  columns.splice(i,0,
    ['consensus','امتیاز اجماع',false,9],
    ['confidence','اعتماد مدل',false,9],
    ['regime','رژیم بازار',false,9]
  );
}

function expertStateV410(v){
  const z=Number(v||0);
  return z>=58?'مثبت':z<=42?'منفی':'خنثی';
}
function qualityLabelV410(v){const z=Number(v||0);return z>=82?'تازه':z>=65?'قابل قبول':z>=40?'قدیمی':'ضعیف'}
function ageLabelV410(x){
  const t=Date.parse(x.updated||'');
  if(!Number.isFinite(t))return 'نامشخص';
  const m=Math.max(0,(Date.now()-t)/60000);
  return m<1?'کمتر از یک دقیقه':`${fa(m,0)} دقیقه`;
}
function decisionReasonsV410(x){
  if(!x.integratedEligible) return ['این نوع ابزار هنوز با موتور اختصاصی خود تحلیل نمی‌شود و تصمیم فعلی از مدل عمومی نسخه قبل است.'];
  const out=[];
  if(x.gateReason) out.push(x.gateReason+'.');
  const factors=[
    {d:Math.abs(x.fast-50),pos:x.fast>=58,neg:x.fast<=42,p:'ریزساختار سفارش‌ها و فشار لحظه‌ای تقاضا قوی است.',m:'ریزساختار سفارش‌ها ورود را تأیید نمی‌کند.'},
    {d:Math.abs(x.cont-50),pos:x.cont>=58,neg:x.cont<=42,p:'تداوم حرکت در افق کوتاه‌مدت مناسب است.',m:'امتیاز تداوم حرکت ضعیف است.'},
    {d:Math.abs(x.flowScore-50),pos:x.flowScore>=58,neg:x.flowScore<=42,p:'جریان پول، حجم و عدم‌تعادل سفارش از حرکت حمایت می‌کنند.',m:'جریان پول و حجم حمایت کافی نشان نمی‌دهند.'},
    {d:Math.abs(x.trendScore-50),pos:x.trendScore>=58,neg:x.trendScore<=42,p:'ساختار روند تکنیکال با سناریوی ورود همسو است.',m:'ساختار روند تکنیکال هنوز همسو نیست.'},
    {d:Math.abs(x.momentumScore-50),pos:x.momentumScore>=58,neg:x.momentumScore<=42,p:'مومنتوم قیمت مثبت است.',m:'مومنتوم قیمت ضعیف یا منفی است.'}
  ].sort((a,b)=>b.d-a.d);
  for(const f of factors){if(f.pos)out.push(f.p);else if(f.neg)out.push(f.m);if(out.length>=3)break;}
  if(out.length<3){
    if(x.marketRegime==='صعودی')out.push('رژیم کلی بازار در محاسبه فعلی حمایتی است.');
    else if(x.marketRegime==='نزولی')out.push('رژیم کلی بازار فشار منفی ایجاد می‌کند.');
    else out.push(`رژیم کلی بازار ${x.marketRegime||'خنثی'} است.`);
  }
  if(out.length<3) out.push(`ریسک مدل ${fa(x.risk,1)} از ۱۰۰ است.`);
  return [...new Set(out)].slice(0,3);
}

const cellBeforeIntegratedV410 = cell;
cell = function(k,x){
  if(x?.analyzed===false) return cellBeforeIntegratedV410(k,x);
  if(k==='decision'){
    const sub=x.integratedEligible?`اعتماد ${esc(x.confidenceLabel)} • اجماع ${fa(x.integratedScore,0)}`:'مدل عمومی';
    return `<span class="badge ${dc(x.decision)}">${esc(x.decision)}</span><div class="company">${sub}</div>`;
  }
  if(k==='fast') return `<b>${fa(x.fast,1)}</b><div class="company">امتیاز ریزساختار</div>`;
  if(k==='consensus') return x.integratedEligible?`<b>${fa(x.integratedScore,1)}</b>`:'—';
  if(k==='confidence') return x.integratedEligible?`<b>${esc(x.confidenceLabel)}</b><div class="company">${fa(x.confidenceScore,0)} از ۱۰۰</div>`:'مدل عمومی';
  if(k==='regime') return esc(x.marketRegime||'—');
  return cellBeforeIntegratedV410(k,x);
};

function integratedSummaryHTMLV410(x){
  if(!x.integratedEligible){
    return `<div class="section-title">تصمیم یکپارچه</div><div class="integrated-banner legacy"><div><span>دامنه مدل</span><b>مدل عمومی فعلی</b></div><p>موتور یکپارچه فاز اول فقط برای سهام و حق‌تقدم فعال است. برای ${esc(x.assetType||'این ابزار')} موتور اختصاصی جداگانه ساخته خواهد شد.</p></div>`;
  }
  const reasons=decisionReasonsV410(x);
  const gate=x.gateReason?`<div class="integrated-gate">${esc(x.gateReason)}</div>`:'';
  return `<div class="section-title">تصمیم یکپارچه</div>
    <div class="integrated-banner ${dc(x.decision)}">
      <div class="integrated-main"><span>تصمیم نهایی</span><b>${esc(x.decision)}</b><small>افق تصمیم: ۱ تا ۳ روز کاری</small></div>
      <div class="integrated-score"><span>امتیاز اجماع</span><b>${fa(x.integratedScore,1)}</b><small>احتمال کالیبره‌شده نیست</small></div>
      <div class="integrated-score"><span>اعتماد مدل</span><b>${esc(x.confidenceLabel)}</b><small>${fa(x.confidenceScore,0)} از ۱۰۰</small></div>
      <div class="integrated-score"><span>رژیم بازار</span><b>${esc(x.marketRegime)}</b><small>عرض بازار ${fa(x.marketBreadth,0)}٪</small></div>
    </div>${gate}
    <div class="expert-grid">
      <div><span>ریزساختار</span><b>${expertStateV410(x.fast)}</b><small>${fa(x.fast,0)}</small></div>
      <div><span>جریان پول/حجم</span><b>${expertStateV410(x.flowScore)}</b><small>${fa(x.flowScore,0)}</small></div>
      <div><span>تداوم</span><b>${expertStateV410(x.cont)}</b><small>${fa(x.cont,0)}</small></div>
      <div><span>روند تکنیکال</span><b>${expertStateV410(x.trendScore)}</b><small>${fa(x.trendScore,0)}</small></div>
      <div><span>مومنتوم</span><b>${expertStateV410(x.momentumScore)}</b><small>${fa(x.momentumScore,0)}</small></div>
      <div><span>تازگی داده</span><b>${qualityLabelV410(x.dataQuality)}</b><small>${ageLabelV410(x)}</small></div>
    </div>
    <div class="decision-reasons"><b>سه دلیل اصلی تصمیم:</b><ol>${reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ol></div>
    <div class="calibration-note">در نسخه ۴.۱.۰ عدد «امتیاز اجماع» یک امتیاز مهندسی‌شده است، نه احتمال موفقیت. نمایش احتمال موفقیت فقط پس از جمع‌آوری نتیجه معاملات و کالیبراسیون خارج از نمونه فعال می‌شود.</div>`;
}

const detailHTMLBeforeIntegratedV410 = detailHTML;
detailHTML = function(x,ichi,gann){
  let html=detailHTMLBeforeIntegratedV410(x,ichi,gann);
  html=html.replace('<div class="detail-grid">',`<div class="detail-grid">${integratedSummaryHTMLV410(x)}`);
  html=html.replace('<span>تصمیم</span>','<span>تصمیم نهایی</span>');
  html=html.replace('<b>منطق انتخاب:</b>','<b>منطق مدل لحظه‌ای:</b>');
  html=html.replace('پیش‌بینی عددی ۱۰ روز کاری','تحلیل تکمیلی ۱۰ روزه');
  html=html.replace('پیش‌بینی بر پایه ایچیموکو','چشم‌انداز ایچیموکو (تکمیلی)');
  html=html.replace('پیش‌بینی بر پایه گن','سناریوی گن (آزمایشی)');
  html=html.replace('اعداد بالا برآورد سناریویی بر پایه داده تاریخی واقعی بورس هستند و تضمین بازده یا توصیه قطعی خرید/فروش محسوب نمی‌شوند.','ایچیموکو و گن در فاز اول رأی مستقل خرید/فروش نیستند؛ برای توضیح روند و سناریوی قیمت نمایش داده می‌شوند و گن فعلاً وزن مستقیم در تصمیم نهایی ندارد.');
  return html;
};

printDetail = function(){
  const x=currentDetail;if(!x)return;
  const ichi=forecastIchimoku(x),gann=forecastGann(x),ft=forecastTable(ichi,gann),w=window.open('','_blank','width=900,height=1100');if(!w)return;
  const reasons=decisionReasonsV410(x);
  const metrics=[
    ['تصمیم نهایی',x.decision],['امتیاز اجماع',x.integratedEligible?fa(x.integratedScore,1):'مدل عمومی'],['اعتماد مدل',x.integratedEligible?x.confidenceLabel:'—'],['رژیم بازار',x.marketRegime||'—'],
    ['امتیاز لحظه‌ای',fa(x.fast,1)],['تداوم',fa(x.cont,1)],['جریان پول/حجم',x.integratedEligible?fa(x.flowScore,1):'—'],['روند تکنیکال',x.integratedEligible?fa(x.trendScore,1):'—'],['ریسک',fa(x.risk,1)],
    ['قیمت فعلی',fa(x.last,0)],['ورود پیشنهادی',fa(x.entry,0)],['حد ضرر',fa(x.stop,0)],['هدف اول',fa(x.t1,0)],['هدف دوم',fa(x.t2,0)],['هدف سوم',fa(x.t3,0)],['نسبت سود به زیان',fa(x.rr,2)]
  ];
  w.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${esc(x.symbol)} - شکارچی سهم</title><style>@page{size:A4 portrait;margin:5mm}*{box-sizing:border-box}body{font-family:Tahoma,"IRANSans",sans-serif;color:#111;margin:0;font-size:7pt}h1{font-size:14pt;margin:0}h2{font-size:8.5pt;margin:2.4mm 0 1.2mm;border-bottom:.3mm solid #aaa;padding-bottom:.7mm}.head{display:flex;justify-content:space-between;align-items:flex-end}.sub{font-size:7.5pt;color:#555}.decision{border:.35mm solid #333;border-radius:1.5mm;padding:1.7mm;margin:2mm 0;display:grid;grid-template-columns:repeat(4,1fr);gap:1mm}.decision div span,.grid span{display:block;color:#666;font-size:5.8pt}.decision div b{font-size:8.2pt}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1mm}.grid div{border:.2mm solid #ccc;border-radius:1mm;padding:1.2mm;min-height:8.5mm}.grid b{display:block;margin-top:.4mm;font-size:7.2pt}.reasons{font-size:6.2pt;margin:1mm 0}.reasons ol{margin:.5mm 4mm 0 0;padding:0}.forecast{display:grid;grid-template-columns:1fr 1fr;gap:1mm}.forecast>div{border:.2mm solid #aaa;padding:1mm}.forecast p{margin:.5mm 0;font-size:5.9pt;line-height:1.35}.forecast-table{width:100%;border-collapse:collapse;margin-top:1mm;font-size:5.5pt}.forecast-table th,.forecast-table td{border:.2mm solid #bbb;padding:.45mm;text-align:center}.note,.footer{font-size:5.3pt;color:#666;margin-top:1mm}.footer{display:flex;justify-content:space-between}</style></head><body><div class="head"><div><h1>${esc(x.symbol)}</h1><div class="sub">${esc(x.company)}</div></div><div class="sub">شکارچی سهم ۴.۱.۰ — طراح: دکتر نیما افضل پور</div></div><div class="decision"><div><span>تصمیم نهایی</span><b>${esc(x.decision)}</b></div><div><span>امتیاز اجماع</span><b>${x.integratedEligible?fa(x.integratedScore,1):'—'}</b></div><div><span>اعتماد</span><b>${x.integratedEligible?esc(x.confidenceLabel):'مدل عمومی'}</b></div><div><span>رژیم بازار</span><b>${esc(x.marketRegime||'—')}</b></div></div><div class="reasons"><b>دلایل اصلی:</b><ol>${reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ol></div><h2>برنامه معامله و شاخص‌ها</h2><div class="grid">${metrics.map(m=>`<div><span>${m[0]}</span><b>${m[1]}</b></div>`).join('')}</div><h2>تحلیل تکمیلی ۱۰ روزه</h2><div class="forecast"><div><b>ایچیموکو</b><p>${esc(ichi.text)}</p></div><div><b>گن — آزمایشی</b><p>${esc(gann.text)}</p></div></div>${ft}<div class="note">امتیاز اجماع هنوز احتمال کالیبره‌شده نیست. ایچیموکو و گن رأی مستقل خرید/فروش محسوب نمی‌شوند.</div><div class="footer"><span>تاریخ تهیه: ${new Date().toLocaleString('fa-IR',{timeZone:'Asia/Tehran'})}</span><span>چاپ / ذخیره PDF</span></div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);w.document.close();
};

if($('printDetailBtn')) $('printDetailBtn').onclick=printDetail;
if(typeof renderColumnOptions==='function') renderColumnOptions();
if('serviceWorker'in navigator) navigator.serviceWorker.register('./sw.js?v=4.1.0').catch(()=>{});
// Reload once so rows already fetched by the previous runtime are remapped from the integrated view.
setTimeout(()=>{try{load()}catch{}},60);
