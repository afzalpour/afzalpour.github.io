'use strict';

import './intelligence-print-export.js';
import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createIranComplianceRadarService } from '../../application/intelligence/iran-compliance-radar-service.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { setTitle, page } from '../shell/shell-view.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast } from '../feedback/toast.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const C = HAS_BROWSER ? installAvanCloud() : null;
const Service = HAS_BROWSER ? createIranComplianceRadarService({ cloud: C }) : null;
let currentResult = null;
let installed = false;

const STATUS_FA = Object.freeze({ ready: 'آماده', attention: 'نیازمند تکمیل', blocked: 'مسدود' });
const SEVERITY_FA = Object.freeze({ critical: 'بحرانی', high: 'بالا', medium: 'متوسط', low: 'اطلاع' });
const CATEGORY_FA = Object.freeze({
  registration: 'تنظیمات مودی', rule_version: 'نسخه قواعد', tax_profile: 'پروفایل مالیاتی',
  vat: 'مالیات بر ارزش افزوده', electronic_invoice: 'صورتحساب الکترونیکی',
  integrity: 'یکپارچگی حسابداری', fiscal_close: 'دوره مالی', money_integrity: 'دقت مبالغ'
});

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function today() { return new Date().toISOString().slice(0, 10); }
function dateFa(value) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)); }
  catch { return String(value); }
}
function money(value) { return value === null || value === undefined ? '—' : (MoneyRuntime?.formatCanonicalDecimal?.(String(value), { withUnit: true }) || String(value)); }

function readinessCards(snapshot) {
  return `<div class="grid4 avan-compliance-summary">
    <article class="card"><span class="kpi-label">وضعیت آمادگی</span><div class="kpi-value avan-compliance-status ${esc(snapshot.readiness)}">${esc(STATUS_FA[snapshot.readiness] || snapshot.readiness)}</div></article>
    <article class="card"><span class="kpi-label">موارد بحرانی</span><div class="kpi-value">${Number(snapshot.summary.critical || 0).toLocaleString('fa-IR')}</div></article>
    <article class="card"><span class="kpi-label">فاکتور فروش قطعی بررسی‌شده</span><div class="kpi-value">${Number(snapshot.summary.postedSaleInvoices || 0).toLocaleString('fa-IR')}</div></article>
    <article class="card"><span class="kpi-label">مالیات خروجی ثبت‌شده</span><div class="kpi-value" data-avan-number-output="1">${money(snapshot.summary.outputTaxCanonical)}</div></article>
  </div>`;
}

function ruleHtml(snapshot) {
  const rule = snapshot.currentRule;
  return `<section class="card avan-compliance-section">
    <div class="section-head"><div><h2>قاعده مالیاتی فعال</h2><span class="muted">نسخه قاعده بر اساس تاریخ مبنا انتخاب می‌شود؛ تغییر قاعده تاریخچه قبلی را بازنویسی نمی‌کند.</span></div></div>
    ${rule ? `<div class="avan-compliance-rule">
      <div><b>${esc(rule.name || 'قاعده مالیاتی')}</b><span class="muted">از ${esc(dateFa(rule.effectiveFrom))}${rule.effectiveTo ? ` تا ${esc(dateFa(rule.effectiveTo))}` : ''}</span></div>
      <div><span>نرخ عمومی ثبت‌شده</span><b>${esc(String(rule.rate ?? '—'))}٪</b></div>
      <div><span>منبع</span><b>${esc(rule.sourceTitle || '—')}</b><small>${esc(rule.sourceReference || '')}</small></div>
    </div>` : '<div class="error-box">برای تاریخ انتخاب‌شده قاعده فعال قابل استناد در آوان پیدا نشد.</div>'}
  </section>`;
}

function findingsHtml(snapshot) {
  const rows = snapshot.findings || [];
  return `<section class="card avan-compliance-section" id="avanComplianceFindings">
    <div class="section-head"><div><h2>فهرست اقدام‌های انطباق</h2><span class="muted">مواردی که داده یا تنظیمات آن‌ها باید بررسی شوند؛ هشدار به معنی تخلف قطعی نیست.</span></div><span class="summary-pill">${Number(rows.length).toLocaleString('fa-IR')} مورد</span></div>
    ${rows.length ? `<div class="avan-compliance-table-wrap"><table><thead><tr><th>سطح</th><th>حوزه</th><th>مورد</th><th>توضیح</th><th>شواهد</th></tr></thead><tbody>
      ${rows.map(row => `<tr><td><span class="avan-compliance-severity ${esc(row.severity)}">${esc(SEVERITY_FA[row.severity] || row.severity)}</span></td><td>${esc(CATEGORY_FA[row.category] || row.category)}</td><td><b>${esc(row.title)}</b></td><td>${esc(row.description)}</td><td><button type="button" class="ghost small" data-compliance-evidence="${esc(row.id)}">مشاهده شواهد</button></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="success-box">در دامنه فعلی رادار، مورد بازی برای اقدام شناسایی نشد.</div>'}
  </section>`;
}

function regulationsHtml(snapshot) {
  const rows = snapshot.regulations || [];
  return `<section class="card avan-compliance-section">
    <div class="section-head"><div><h2>تغییرات قواعد ثبت‌شده در آوان</h2><span class="muted">فقط نسخه‌ها و منابعی که در سامانه ثبت شده‌اند نمایش داده می‌شوند.</span></div></div>
    ${rows.length ? `<div class="avan-compliance-table-wrap"><table><thead><tr><th>قاعده</th><th>شروع اثر</th><th>پایان اثر</th><th>وضعیت</th><th>منبع ثبت‌شده</th></tr></thead><tbody>
      ${rows.map(row => `<tr><td><b>${esc(row.name || 'قاعده مالیاتی')}</b></td><td>${esc(dateFa(row.effectiveFrom))}</td><td>${esc(dateFa(row.effectiveTo))}</td><td>${esc(row.status || '—')}</td><td><b>${esc(row.sourceTitle || '—')}</b>${row.sourceReference ? `<small class="muted">${esc(row.sourceReference)}</small>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="info-box">نسخه قاعده‌ای برای نمایش ثبت نشده است.</div>'}
  </section>`;
}

function calendarHtml(snapshot) {
  const rows = snapshot.calendar || [];
  return `<section class="card avan-compliance-section">
    <div class="section-head"><div><h2>تقویم کنترلی</h2><span class="muted">تاریخ‌های زیر پایان دوره یا شروع اثر قاعده‌اند؛ تا زمانی که منبع نسخه‌دار جداگانه ثبت نشود «موعد قانونی» محسوب نمی‌شوند.</span></div></div>
    ${rows.length ? `<div class="avan-compliance-calendar">${rows.map(row => `<div class="avan-compliance-calendar-row"><time>${esc(dateFa(row.date))}</time><b>${esc(row.title)}</b><span class="muted">${row.type === 'fiscal_period_end' ? 'کنترل پایان دوره' : 'شروع اثر قاعده'}</span><span class="badge">موعد قانونی نیست</span></div>`).join('')}</div>` : '<div class="info-box">تاریخ کنترلی ثبت‌شده‌ای برای این نما وجود ندارد.</div>'}
  </section>`;
}

function coverageHtml(snapshot) {
  const c = snapshot.coverage || {};
  const item = (title, ok, note) => `<article class="card"><b>${esc(title)}</b><span class="${ok ? 'success-text' : 'muted'}">${ok ? 'پوشش فعال' : 'در Foundation فعلی پوشش داده نمی‌شود'}</span><small>${esc(note)}</small></article>`;
  return `<section class="avan-compliance-coverage"><h2>دامنه پوشش رادار</h2><div class="grid4">
    ${item('مالیات و ارزش افزوده', c.tax, 'بر پایه قواعد نسخه‌دار و Snapshot مالیاتی')}
    ${item('صورتحساب الکترونیکی', c.electronicInvoice, 'کنترل آمادگی داده؛ بدون ارسال خودکار')}
    ${item('حقوق و دستمزد', c.payroll, 'تا اضافه‌شدن Source of Truth حقوق، نتیجه‌ای صادر نمی‌شود')}
    ${item('بیمه', c.insurance, 'تا اضافه‌شدن داده معتبر بیمه، نتیجه‌ای صادر نمی‌شود')}
  </div></section>`;
}

export function iranComplianceRadarPageHtml({ workspace, snapshot }) {
  return `<div class="avan-compliance" data-iran-compliance-radar-page>
    <section class="card avan-compliance-hero"><div><div class="eyebrow">کنترل قاعده‌محور · بدون اقدام خودکار</div><h2>رادار انطباق مالی ایران</h2><p class="muted">آمادگی مالیاتی، کیفیت داده و تغییرات قواعد ثبت‌شده برای «${esc(workspace.name)}»؛ قابل ردیابی و فقط‌خواندنی.</p></div>
      <form data-compliance-date-form class="avan-compliance-date-form"><div class="field"><label>تا تاریخ</label><input type="date" name="asOf" value="${esc(snapshot.asOf)}" required></div><button type="submit" class="primary">اجرای رادار</button></form>
    </section>
    <div class="info-box">این رادار ابزار کنترل و آمادگی است؛ جایگزین نظر حرفه‌ای مالیاتی، حقوقی یا بیمه‌ای نیست و هیچ اظهارنامه، صورتحساب یا سند حسابداری را خودکار ارسال/ثبت نمی‌کند.</div>
    ${readinessCards(snapshot)}${ruleHtml(snapshot)}${findingsHtml(snapshot)}${regulationsHtml(snapshot)}${calendarHtml(snapshot)}${coverageHtml(snapshot)}
  </div>`;
}

function evidenceModal(item) {
  const refs = item?.evidence || [];
  openModal(`<div data-compliance-evidence-modal><div class="section-head"><div><h3>${esc(item.title)}</h3><span class="muted">${esc(item.description)}</span></div><button type="button" class="ghost small" data-close-compliance-evidence>بستن</button></div>
    ${refs.length ? `<div class="avan-compliance-evidence-list">${refs.map(ref => `<div class="card"><b>${esc(ref.label)}</b>${ref.meta ? `<span class="muted">${esc(ref.meta)}</span>` : ''}</div>`).join('')}</div>` : '<div class="info-box">برای این کنترل مرجع جزئی ثبت نشده است.</div>'}</div>`);
  document.querySelector('[data-close-compliance-evidence]')?.addEventListener('click', closeModal);
}

function bindPageActions() {
  const root = document.querySelector('[data-iran-compliance-radar-page]');
  if (!root || !currentResult) return;
  root.querySelector('[data-compliance-date-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const asOf = String(new FormData(event.currentTarget).get('asOf') || '');
    if (!asOf) return toast('تاریخ مبنا را انتخاب کنید.');
    void openIranComplianceRadar(asOf);
  });
  root.querySelectorAll('[data-compliance-evidence]').forEach(button => button.addEventListener('click', () => {
    const item = currentResult.snapshot.findings.find(row => row.id === button.dataset.complianceEvidence);
    if (item) evidenceModal(item);
  }));
}

function setNavActive(active) {
  document.querySelectorAll('#nav button.active').forEach(button => button.classList.remove('active'));
  document.querySelector('[data-iran-compliance-radar-nav]')?.classList.toggle('active', Boolean(active));
}

export async function openIranComplianceRadar(asOf = today()) {
  if (!HAS_BROWSER || !Service) return null;
  try {
    setTitle('رادار انطباق مالی ایران');
    setNavActive(true);
    page('<div class="loading">در حال اجرای کنترل‌های انطباق و آمادگی داده…</div>');
    await MoneyRuntime?.ready?.();
    currentResult = await Service.load({ asOf });
    page(iranComplianceRadarPageHtml(currentResult));
    setNavActive(true);
    bindPageActions();
    window.dispatchEvent(new CustomEvent('avan:iran-compliance-radar-rendered', { detail: { workspace_id: currentResult.workspace.id, as_of: currentResult.snapshot.asOf } }));
    return currentResult;
  } catch (error) {
    console.error('[Avan Iran Compliance Radar]', error);
    page('<div class="error-box">رادار انطباق در این لحظه قابل محاسبه نیست. دوباره تلاش کنید.</div>');
    return null;
  }
}

function installSidebarEntry() {
  const nav = document.getElementById('nav');
  if (!nav || nav.querySelector('[data-iran-compliance-radar-nav]')) return;
  if (!nav.querySelector('[data-control-tower-nav-label]')) { const label = document.createElement('div'); label.className = 'nav-label'; label.textContent = 'هوشمندی مالی'; nav.append(label); }
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.iranComplianceRadarNav = '1'; button.innerHTML = '<span>§</span>رادار انطباق مالی ایران';
  button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); closeModal(); void openIranComplianceRadar(); });
  nav.append(button);
}

function installReportsLauncher() {
  const content = document.getElementById('content');
  if (!content || content.querySelector('[data-compliance-report-launcher]')) return;
  const card = document.createElement('section'); card.className = 'card avan-compliance-report-launcher'; card.dataset.complianceReportLauncher = '1';
  card.innerHTML = '<div><b>§ رادار انطباق مالی ایران</b><span class="muted">آمادگی مالیاتی، نسخه قواعد، کیفیت داده و صورتحساب الکترونیکی</span></div><button type="button" class="primary">اجرای رادار</button>';
  card.querySelector('button')?.addEventListener('click', () => void openIranComplianceRadar());
  content.prepend(card);
}

function onPageRendered(event) {
  const title = String(event?.detail?.title || document.getElementById('pageTitle')?.textContent || '');
  if (title === 'گزارش‌ها') installReportsLauncher();
  if (title !== 'رادار انطباق مالی ایران') document.querySelector('[data-iran-compliance-radar-nav]')?.classList.remove('active');
}

export function installIranComplianceRadarWorkspace() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;
  installSidebarEntry();
  window.addEventListener('avan:page-rendered', onPageRendered);
  window.addEventListener('avan:company-context-changed', () => { if (document.querySelector('[data-iran-compliance-radar-page]')) void openIranComplianceRadar(); });
  if (document.getElementById('pageTitle')?.textContent === 'گزارش‌ها') installReportsLauncher();
  window.AvanIranComplianceRadar = Object.freeze({ open: openIranComplianceRadar });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installIranComplianceRadarWorkspace, { once: true });
  else installIranComplianceRadarWorkspace();
}
