'use strict';

import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../../core/money/canonical-money.js';

const LEVEL_FA = {
  critical: 'فوری',
  warning: 'هشدار',
  attention: 'نیازمند توجه',
  info: 'اطلاع',
  healthy: 'عادی'
};

function tenths(value) {
  const parsed = canonicalDecimalToTenths(String(value ?? '0'));
  return parsed === null ? 0n : parsed;
}

function insightValue(insight, money) {
  if (insight.value === null || insight.value === undefined) return '';
  if (insight.unit === 'percent') {
    return `${Number(insight.value).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪`;
  }
  if (insight.unit === 'count') {
    return `${Number(insight.value).toLocaleString('fa-IR')} مورد`;
  }
  return money(insight.value);
}

function insightCard(insight, { money, esc }) {
  return `
    <div class="card">
      <div class="section-head">
        <div>
          <div class="kpi-label">${esc(LEVEL_FA[insight.level] || insight.level)}</div>
          <h3>${esc(insight.title)}</h3>
        </div>
        ${insight.value !== null && insight.value !== undefined
          ? `<span class="summary-pill">${esc(insightValue(insight, money))}</span>`
          : ''}
      </div>
      <p class="muted">${esc(insight.description)}</p>
    </div>
  `;
}

export function financialCopilotSectionHtml(snapshot, { money, esc, dateFa }) {
  const insights = snapshot.insights.slice(0, 4);
  return `
    <div class="section card">
      <div class="section-head">
        <div>
          <h2>✦ Avan Intelligence</h2>
          <span class="muted">CFO Autopilot — تحلیل کنترل‌شده بر پایه Ledger تا ${dateFa(snapshot.asOf)}</span>
        </div>
        <span class="cloud-badge">Explainable AI</span>
      </div>

      <div class="grid4 section">
        ${insights.map(insight => insightCard(insight, { money, esc })).join('')}
      </div>

      <div class="section card">
        <div class="section-head">
          <div>
            <h3>از آوان درباره کسب‌وکار بپرس</h3>
            <span class="muted">پاسخ از داده‌های واقعی Workspace؛ بدون SQL آزاد و بدون ثبت حسابداری.</span>
          </div>
        </div>

        <form id="businessAskForm">
          <div class="form-grid">
            <div class="field">
              <label>سؤال مدیریتی</label>
              <input id="businessAskQuery" autocomplete="off" placeholder="مثلاً چرا با اینکه سود دارم پول ندارم؟" required>
            </div>
            <div class="field">
              <label>&nbsp;</label>
              <button class="primary" type="submit">✦ تحلیل کن</button>
            </div>
          </div>
        </form>

        <div class="row-actions section">
          <button type="button" class="ghost small" data-business-example="چرا با اینکه سود دارم پول ندارم؟">چرا پول ندارم؟</button>
          <button type="button" class="ghost small" data-business-example="بدهکارترین مشتری کیست؟">بدهکارترین مشتری</button>
          <button type="button" class="ghost small" data-business-example="بزرگترین هزینه من چیست؟">بزرگ‌ترین هزینه</button>
          <button type="button" class="ghost small" data-business-example="چه چیزهایی نیاز به توجه دارد؟">اولویت‌های امروز</button>
        </div>

        <div id="businessAskAnswer" class="section">
          <div class="info-box">سؤال بالا را بنویسید؛ آوان پاسخ را با منبع محاسبه نمایش می‌دهد.</div>
        </div>
      </div>
    </div>
  `;
}

function accountingMoneyHtml(value, money, esc) {
  const parsed = canonicalDecimalToTenths(String(value ?? '0'));
  if (parsed === null) {
    return `<span class="avan-business-money-value" data-avan-number-output="1">${esc(money(value))}</span>`;
  }
  if (parsed < 0n) {
    const absolute = canonicalTenthsToDecimal(-parsed) || '0';
    const formatted = String(money(absolute));
    return `
      <span
        class="avan-accounting-negative avan-business-money-value"
        data-avan-number-output="1"
        data-avan-sign="negative"
        aria-label="${esc(`منفی ${formatted}`)}"
      ><span class="avan-accounting-negative-absolute" aria-hidden="true">${esc(formatted)}</span></span>
    `;
  }
  return `<span class="avan-business-money-value" data-avan-number-output="1">${esc(money(value))}</span>`;
}

function evidenceButton({ metric, amount, label, partyId = null, accountId = null }, esc) {
  if (!metric || amount === undefined || amount === null) return '';
  return `
    <button
      type="button"
      class="ghost small avan-business-evidence-button"
      data-business-evidence-metric="${esc(metric)}"
      data-business-evidence-amount="${esc(amount)}"
      data-business-evidence-label="${esc(label || '')}"
      ${partyId ? `data-business-evidence-party-id="${esc(partyId)}"` : ''}
      ${accountId ? `data-business-evidence-account-id="${esc(accountId)}"` : ''}
    >چرا این عدد؟</button>
  `;
}

function metricValue({ label, value, metric, partyId = null, accountId = null }, { money, esc }) {
  return `
    <span class="avan-business-metric-evidence">
      ${accountingMoneyHtml(value, money, esc)}
      ${evidenceButton({ metric, amount: value, label, partyId, accountId }, esc)}
    </span>
  `;
}

export function businessAnswerHtml(answer, { money, esc }) {
  const data = answer?.data || {};
  let title = 'پاسخ آوان';
  let body = '';

  if (answer.kind === 'cash_explanation') {
    title = 'سود با نقدینگی یکی نیست';
    const profit = data.profit || '0';
    const cash = data.cash || '0';
    const receivables = data.receivables || '0';
    const overdue = data.overdueReceivables || '0';
    const profitTenths = tenths(profit);
    const cashTenths = tenths(cash);
    const receivableTenths = tenths(receivables);

    body = `
      <p>
        سود/زیان دوره:
        <b>${metricValue({ label: 'سود/زیان دوره', value: profit, metric: 'profit' }, { money, esc })}</b>
        — نقدینگی فعلی:
        <b>${metricValue({ label: 'نقدینگی فعلی', value: cash, metric: 'cash' }, { money, esc })}</b>.
      </p>
      <p>
        مطالبات باز:
        <b>${metricValue({ label: 'مطالبات باز', value: receivables, metric: 'receivables' }, { money, esc })}</b>
        که
        <b>${metricValue({ label: 'مطالبات سررسیدگذشته', value: overdue, metric: 'overdue_receivables' }, { money, esc })}</b>
        آن سررسیدگذشته است.
      </p>
      ${profitTenths > 0n && receivableTenths > cashTenths
        ? `<div class="info-box">بر اساس داده‌های فعلی، یکی از عوامل مهم فاصله سود و پول نقد می‌تواند باقی‌ماندن منابع در مطالبات باشد. این پاسخ علت قطعی جریان نقد نیست؛ بلکه تحلیل داده‌های موجود در Ledger و Aging است.</div>`
        : `<div class="info-box">برای توضیح کامل جریان نقد، باید تغییرات مطالبات، بدهی‌ها، سرمایه‌گذاری و سایر جریان‌های نقدی در کنار سود بررسی شوند.</div>`}
    `;
  } else if (answer.kind === 'top_receivable') {
    title = 'بدهکارترین مشتری';
    body = data.party
      ? `<p><b>${esc(data.party.partyName)}</b> با مانده باز <b>${metricValue({ label: `مانده باز ${data.party.partyName}`, value: data.party.total, metric: 'receivables', partyId: data.party.partyId }, { money, esc })}</b> در حال حاضر بیشترین مانده مطالبات را دارد.</p>`
      : '<div class="empty">مانده مطالبات قابل نمایش وجود ندارد.</div>';
  } else if (answer.kind === 'receivables') {
    title = 'وضعیت مطالبات';
    body = `
      <p>مطالبات باز: <b>${metricValue({ label: 'مطالبات باز', value: data.total, metric: 'receivables' }, { money, esc })}</b></p>
      <p>سررسیدگذشته: <b>${metricValue({ label: 'مطالبات سررسیدگذشته', value: data.overdue, metric: 'overdue_receivables' }, { money, esc })}</b></p>
    `;
  } else if (answer.kind === 'top_payable') {
    title = 'بیشترین بدهی تجاری';
    body = data.party
      ? `<p><b>${esc(data.party.partyName)}</b> با مانده <b>${metricValue({ label: `بدهی تجاری ${data.party.partyName}`, value: data.party.total, metric: 'payables', partyId: data.party.partyId }, { money, esc })}</b> در صدر بدهی‌های تجاری قرار دارد.</p>`
      : '<div class="empty">بدهی تجاری قابل نمایش وجود ندارد.</div>';
  } else if (answer.kind === 'payables') {
    title = 'وضعیت بدهی تجاری';
    body = `
      <p>بدهی تجاری باز: <b>${metricValue({ label: 'بدهی تجاری باز', value: data.total, metric: 'payables' }, { money, esc })}</b></p>
      <p>سررسیدگذشته: <b>${metricValue({ label: 'بدهی تجاری سررسیدگذشته', value: data.overdue, metric: 'overdue_payables' }, { money, esc })}</b></p>
    `;
  } else if (answer.kind === 'top_expense') {
    title = 'بزرگ‌ترین حساب هزینه';
    body = data.account
      ? `<p><b>${esc(data.account.accountName)}</b> با خالص گردش <b>${metricValue({ label: `خالص گردش ${data.account.accountName}`, value: data.account.amount, metric: 'expense', accountId: data.account.accountId }, { money, esc })}</b> در بازه مالی فعلی، بزرگ‌ترین حساب هزینه ثبت‌شده است.</p>`
      : '<div class="empty">گردش هزینه قابل نمایش وجود ندارد.</div>';
  } else if (answer.kind === 'profit') {
    title = 'سود/زیان دوره';
    body = `<p>نتیجه دوره تا امروز: <b>${metricValue({ label: 'سود/زیان دوره', value: data.profit, metric: 'profit' }, { money, esc })}</b></p>`;
  } else if (answer.kind === 'cash') {
    title = 'نقدینگی فعلی';
    body = `<p>مجموع مانده بانک و صندوق: <b>${metricValue({ label: 'نقدینگی فعلی', value: data.cash, metric: 'cash' }, { money, esc })}</b></p>`;
  } else if (answer.kind === 'priorities') {
    title = 'اولویت‌های CFO Autopilot';
    body = data.insights?.length
      ? `<ol>${data.insights.map(insight => `<li><b>${esc(insight.title)}</b> — ${esc(insight.description)}</li>`).join('')}</ol>`
      : '<div class="empty">اولویت خاصی پیدا نشد.</div>';
  } else {
    title = 'این سؤال هنوز در نسخه 1.0 پشتیبانی نمی‌شود';
    body = '<div class="info-box">فعلاً سؤال‌هایی درباره نقدینگی، سود، مطالبات، بدهی تجاری، بزرگ‌ترین هزینه و اولویت‌های مالی را بپرسید.</div>';
  }

  return `
    <div class="card">
      <div class="section-head">
        <div>
          <h3>${esc(title)}</h3>
          <span class="muted">منبع: ${esc(answer.source || 'Ledger')}</span>
        </div>
      </div>
      ${body}
    </div>
  `;
}