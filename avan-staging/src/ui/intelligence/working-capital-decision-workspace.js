'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createWorkingCapitalService } from '../../application/intelligence/working-capital-service.js';
import { createWorkingCapitalDecisionService } from '../../application/intelligence/working-capital-decision-service.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast } from '../feedback/toast.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const C = HAS_BROWSER ? installAvanCloud() : null;
const WorkingCapitalService = HAS_BROWSER ? createWorkingCapitalService({ cloud: C }) : null;
const DecisionService = HAS_BROWSER ? createWorkingCapitalDecisionService({ workingCapitalService: WorkingCapitalService }) : null;
let installed = false;
let requestGeneration = 0;
let current = null;

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

function money(value) {
  return MoneyRuntime?.formatCanonicalDecimal?.(String(value ?? '0'), { withUnit: true }) || '—';
}

function dateFa(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function recommendationClass(tier) {
  if (['critical', 'liquidity_gap'].includes(tier)) return 'danger';
  if (['high', 'medium'].includes(tier)) return 'attention';
  return 'normal';
}

const evidenceTypeFa = Object.freeze({
  party: 'طرف‌حساب',
  journal_entry: 'سند حسابداری',
  journal_line: 'ردیف سند',
  invoice: 'فاکتور'
});

function summaryHtml(decisions) {
  const s = decisions.summary;
  return `
    <div class="grid4 avan-decision-summary">
      <article class="card"><span class="kpi-label">مطالبات سررسیدگذشته</span><strong class="kpi-value" data-avan-number-output="1">${money(s.overdueReceivables)}</strong></article>
      <article class="card"><span class="kpi-label">پرونده وصول نیازمند اقدام</span><strong class="kpi-value">${Number(s.decisionCollectionCount).toLocaleString('fa-IR')}</strong></article>
      <article class="card"><span class="kpi-label">تعهدات بررسی‌شده تا ۳۰ روز</span><strong class="kpi-value">${Number(s.paymentDecisionCount).toLocaleString('fa-IR')}</strong></article>
      <article class="card"><span class="kpi-label">تعهد بدون پوشش کافی در ترتیب فعلی</span><strong class="kpi-value">${Number(s.uncoveredPaymentCount).toLocaleString('fa-IR')}</strong>${s.uncoveredPaymentCount ? `<span class="muted">اولین کسری تجمعی: <b data-avan-number-output="1">${money(s.firstLiquidityShortfall)}</b></span>` : '<span class="muted">کسری شناخته‌شده‌ای در این ترتیب دیده نشد.</span>'}</article>
    </div>`;
}

function collectionDecisionsHtml(items) {
  return `
    <section class="avan-decision-group">
      <div class="section-head"><div><h3>پیشنهادهای کنترل‌شده وصول</h3><span class="muted">قاعده از روزهای تأخیر و مانده واقعی می‌آید؛ پیام یا وصول خودکار انجام نمی‌شود.</span></div><span class="summary-pill">${Number(items.length).toLocaleString('fa-IR')} پیشنهاد</span></div>
      ${items.length ? `<div class="avan-decision-list">${items.slice(0, 8).map(item => `
        <article class="avan-decision-row ${recommendationClass(item.recommendation.tier)}" data-decision-id="${esc(item.id)}">
          <div class="avan-decision-main"><b>${esc(item.partyName)}</b><span class="muted">${esc(item.recommendation.label)}</span><span>${esc(item.recommendation.reason)}</span></div>
          <div class="avan-decision-money"><span>سررسیدگذشته</span><b data-avan-number-output="1">${money(item.overdueAmount)}</b></div>
          <div class="avan-decision-actions"><button type="button" class="ghost small" data-decision-why="${esc(item.id)}">چرا این پیشنهاد؟</button><button type="button" class="ghost small" data-decision-simulate="${esc(item.id)}">آزمایش وصول در دوقلو</button></div>
        </article>`).join('')}</div>` : '<div class="success-box">مطالبه سررسیدگذشته‌ای برای اقدام کنترل‌شده دیده نشد.</div>'}
    </section>`;
}

function paymentDecisionsHtml(items) {
  return `
    <section class="avan-decision-group">
      <div class="section-head"><div><h3>پیشنهادهای کنترل‌شده پرداخت</h3><span class="muted">ترتیب فقط بر اساس سررسید است. پوشش نقد، اثر تجمعی پرداخت همین صف را نشان می‌دهد و دستور پرداخت نیست.</span></div><span class="summary-pill">${Number(items.length).toLocaleString('fa-IR')} پیشنهاد</span></div>
      ${items.length ? `<div class="avan-decision-list">${items.slice(0, 12).map(item => `
        <article class="avan-decision-row ${recommendationClass(item.recommendation.tier)}" data-decision-id="${esc(item.id)}">
          <div class="avan-decision-main"><b>${esc(item.partyName)} · ${item.invoiceNo ? `فاکتور ${esc(item.invoiceNo)}` : `سند ${esc(item.journalNo || '—')}`}</b><span class="muted">سررسید ${esc(dateFa(item.dueDate))} · ${esc(item.recommendation.label)}</span><span>${esc(item.recommendation.reason)}</span></div>
          <div class="avan-decision-money"><span>تعهد باز</span><b data-avan-number-output="1">${money(item.amount)}</b></div>
          <div class="avan-decision-money"><span>نقد پس از این ردیف</span><b data-avan-number-output="1">${money(item.projectedCashAfter)}</b></div>
          <div class="avan-decision-actions"><button type="button" class="ghost small" data-decision-why="${esc(item.id)}">چرا این پیشنهاد؟</button><button type="button" class="ghost small" data-decision-simulate="${esc(item.id)}">آزمایش پرداخت در دوقلو</button></div>
        </article>`).join('')}</div>` : '<div class="success-box">تعهد پرداختنی تا ۳۰ روز آینده برای تصمیم‌یار دیده نشد.</div>'}
    </section>`;
}

function decisionCenterHtml(result) {
  return `
    <section class="card avan-working-capital-decisions" data-working-capital-decision-center>
      <div class="section-head">
        <div><div class="eyebrow">RC1.7-D · Evidence-backed Decision Layer</div><h2>تصمیم‌یار عملیاتی</h2><span class="muted">از داده واقعی تا پیشنهاد قابل توضیح؛ تصمیم نهایی و هر اقدام مالی همچنان با کاربر است.</span></div>
        <span class="cloud-badge">Human-controlled</span>
      </div>
      ${summaryHtml(result.decisions)}
      ${collectionDecisionsHtml(result.decisions.collections)}
      ${paymentDecisionsHtml(result.decisions.payments)}
      <div class="info-box">مبلغ توصیه‌ای ساختگی: صفر · محاسبه با دقت یک ریال · AI arithmetic: صفر · ارسال پیام خودکار: صفر · پرداخت خودکار: صفر · تغییر Actual Ledger: صفر</div>
    </section>`;
}

function decisionById(id) {
  if (!current?.decisions) return null;
  return [...current.decisions.collections, ...current.decisions.payments].find(item => item.id === id) || null;
}

function whyModal(item) {
  const grouped = new Map();
  (item.evidence || []).forEach(ref => {
    if (!ref?.type || !ref?.id) return;
    if (!grouped.has(ref.type)) grouped.set(ref.type, []);
    grouped.get(ref.type).push(ref.id);
  });

  openModal(`
    <div data-decision-why-modal>
      <div class="section-head"><div><h2>چرا این پیشنهاد؟</h2><span class="muted">قاعده + اثر نقد + شواهد</span></div><span class="cloud-badge">قابل ردیابی</span></div>
      <div class="info-box"><b>${esc(item.recommendation.label)}</b><br>${esc(item.recommendation.reason)}</div>
      ${item.kind === 'collection'
        ? `<div class="grid2 section"><div class="card"><span class="kpi-label">مانده باز</span><b data-avan-number-output="1">${money(item.openAmount)}</b></div><div class="card"><span class="kpi-label">سررسیدگذشته</span><b data-avan-number-output="1">${money(item.overdueAmount)}</b></div></div>`
        : `<div class="grid3 section"><div class="card"><span class="kpi-label">تعهد</span><b data-avan-number-output="1">${money(item.amount)}</b></div><div class="card"><span class="kpi-label">نقد قبل از این ردیف</span><b data-avan-number-output="1">${money(item.cashBefore)}</b></div><div class="card"><span class="kpi-label">نقد پس از این ردیف</span><b data-avan-number-output="1">${money(item.projectedCashAfter)}</b></div></div>`}
      <div class="avan-decision-evidence-list">${grouped.size ? [...grouped.entries()].map(([type, ids]) => `<div class="card"><b>${esc(evidenceTypeFa[type] || type)}</b><span class="muted">${Number(ids.length).toLocaleString('fa-IR')} مرجع</span><div>${ids.slice(0, 12).map(id => `<code>${esc(id)}</code>`).join(' ')}</div></div>`).join('') : '<div class="empty">مرجع جزئی برای این پیشنهاد موجود نیست.</div>'}</div>
      <div class="form-actions"><button type="button" class="ghost" data-decision-close>بستن</button></div>
    </div>`);
  document.querySelector('[data-decision-close]')?.addEventListener('click', closeModal, { once: true });
}

function simulate(item) {
  if (!window.AvanFinancialDigitalTwin?.open) {
    toast('دوقلوی مالی در این لحظه آماده نیست.');
    return;
  }
  closeModal();
  void window.AvanFinancialDigitalTwin.open(item.simulationSeed);
}

function bindDecisionActions(root) {
  root.querySelectorAll('[data-decision-why]').forEach(button => button.addEventListener('click', () => {
    const item = decisionById(String(button.dataset.decisionWhy || ''));
    if (item) whyModal(item);
  }));
  root.querySelectorAll('[data-decision-simulate]').forEach(button => button.addEventListener('click', () => {
    const item = decisionById(String(button.dataset.decisionSimulate || ''));
    if (item) simulate(item);
  }));
}

async function enhanceWorkingCapital() {
  if (!DecisionService) return;
  const root = document.querySelector('[data-working-capital-page]');
  if (!root) return;
  const asOf = String(root.querySelector('[data-working-capital-date-form] input[name="asOf"]')?.value || '');
  if (!asOf) return;

  root.querySelector('[data-working-capital-decision-center]')?.remove();
  const anchor = root.querySelector('.avan-working-capital-evidence-summary');
  if (!anchor) return;
  const loading = document.createElement('section');
  loading.className = 'card loading';
  loading.dataset.workingCapitalDecisionCenter = '1';
  loading.textContent = 'در حال ساخت پیشنهادهای کنترل‌شده از شواهد واقعی…';
  anchor.insertAdjacentElement('beforebegin', loading);

  const generation = ++requestGeneration;
  try {
    await MoneyRuntime?.ready?.();
    const result = await DecisionService.load({ asOf });
    if (generation !== requestGeneration || !document.body.contains(loading)) return;
    current = result;
    loading.outerHTML = decisionCenterHtml(result);
    const center = document.querySelector('[data-working-capital-decision-center]');
    if (center) bindDecisionActions(center);
  } catch (error) {
    console.error('[Avan Working Capital Decisions]', error);
    if (generation !== requestGeneration || !document.body.contains(loading)) return;
    loading.className = 'error-box';
    loading.textContent = 'تصمیم‌یار عملیاتی در این لحظه قابل بارگذاری نیست.';
  }
}

function onPageRendered(event) {
  const title = String(event?.detail?.title || document.getElementById('pageTitle')?.textContent || '');
  if (title === 'مرکز سرمایه در گردش') void enhanceWorkingCapital();
  else requestGeneration += 1;
}

export function installWorkingCapitalDecisionWorkspace() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;
  window.addEventListener('avan:page-rendered', onPageRendered);
  if (document.getElementById('pageTitle')?.textContent === 'مرکز سرمایه در گردش') void enhanceWorkingCapital();
  window.AvanWorkingCapitalDecisions = Object.freeze({ refresh: enhanceWorkingCapital });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installWorkingCapitalDecisionWorkspace, { once: true });
  else installWorkingCapitalDecisionWorkspace();
}
