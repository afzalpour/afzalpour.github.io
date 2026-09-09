'use strict';

const LEVEL_FA={low:'ریسک پایین',medium:'ریسک متوسط',high:'ریسک بالا',critical:'ریسک بحرانی'};
const SEVERITY_FA={critical:'بحرانی',high:'بالا',medium:'متوسط',low:'پایین'};

function valueHtml(item,money,esc){
  if(item.value===null||item.value===undefined)return '';
  const text=item.unit==='percent'
    ?esc(`${Number(item.value).toLocaleString('fa-IR',{maximumFractionDigits:1})}٪`)
    :money(item.value);
  return `<span class="summary-pill avan-risk-factor-number">${text}</span>`;
}

function actionHtml(finding,esc){
  if(!finding.entityType||!finding.entityId||!['invoice','document','journal'].includes(finding.entityType))return '';
  return `<button type="button" class="ghost small" data-risk-entity="${esc(finding.entityType)}" data-risk-id="${esc(finding.entityId)}">بررسی منبع</button>`;
}

function riskFactorCard(factor,{money,esc}){
  return `<div class="card avan-risk-factor-card">
    <div class="avan-risk-factor-copy">
      <div class="kpi-label">ریسک ${factor.severity==='high'?'بالا':'متوسط'}</div>
      <h3 class="avan-risk-factor-title">${esc(factor.title)}</h3>
    </div>
    <div class="avan-risk-factor-value">${valueHtml(factor,money,esc)}</div>
    <p class="muted avan-risk-factor-description">${esc(factor.description)}</p>
  </div>`;
}

export function riskAuditSectionHtml(snapshot,{money,dateFa,esc}){
  const factors=snapshot.factors||[];
  const findings=snapshot.auditFindings||[];
  return `<div class="section card avan-risk-audit-section">
    <div class="section-head">
      <div>
        <h2>🛡 Business Risk Radar</h2>
        <span class="muted">Continuous Audit Lite — کنترل ریسک و الگوهای نیازمند بررسی تا ${dateFa(snapshot.asOf)}</span>
      </div>
      <span class="cloud-badge">${esc(LEVEL_FA[snapshot.level]||snapshot.level)} — امتیاز ${Number(snapshot.score||0).toLocaleString('fa-IR')}/۱۰۰</span>
    </div>
    ${factors.length?`<div class="grid4 section avan-risk-factor-grid">${factors.slice(0,4).map(factor=>riskFactorCard(factor,{money,esc})).join('')}</div>`:'<div class="success-box section">در کنترل‌های ریسک فعلی، عامل پرریسک قابل توجهی شناسایی نشد.</div>'}
    <div class="section">
      <div class="section-head">
        <div><h3>Continuous Audit</h3><span class="muted">Duplicate، Integrity، مبلغ غیرعادی و الگوهای کنترلی</span></div>
        <span class="summary-pill">${Number(snapshot.stats?.auditFindingCount||0).toLocaleString('fa-IR')} مورد</span>
      </div>
      ${findings.length?`<table>
        <thead><tr><th>سطح</th><th>کنترل</th><th>توضیح</th><th>مقدار</th><th>اقدام</th></tr></thead>
        <tbody>${findings.map(finding=>`<tr>
          <td><span class="badge">${esc(SEVERITY_FA[finding.severity]||finding.severity)}</span></td>
          <td><b>${esc(finding.title)}</b></td>
          <td>${esc(finding.description)}</td>
          <td class="num">${finding.value!==null&&finding.value!==undefined?money(finding.value):finding.count>1?esc(`${finding.count} مورد`):'—'}</td>
          <td>${actionHtml(finding,esc)}</td>
        </tr>`).join('')}</tbody>
      </table>`:'<div class="success-box">در کنترل‌های فعلی، مورد مشکوک یا Integrity Alert برای نمایش پیدا نشد.</div>'}
      <div class="info-box section">Risk Radar و Continuous Audit ابزار کنترلی هستند؛ هشدار آماری یا مشابهت داده به معنی تخلف، تقلب یا اشتباه قطعی نیست. تصمیم نهایی با کاربر/حسابدار است.</div>
    </div>
  </div>`;
}
