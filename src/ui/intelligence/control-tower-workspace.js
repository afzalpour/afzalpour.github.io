'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createControlTowerSnapshotService } from '../../application/intelligence/control-tower-snapshot-service.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { setTitle, page } from '../shell/shell-view.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast } from '../feedback/toast.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const C = HAS_BROWSER ? installAvanCloud() : null;
const Service = HAS_BROWSER ? createControlTowerSnapshotService({ cloud: C }) : null;

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateFa(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function money(value) {
  if (value === null || value === undefined) return 'تعریف نشده';
  return MoneyRuntime?.formatCanonicalDecimal?.(String(value), { withUnit: true }) || '—';
}

const evidenceTypeFa = Object.freeze({
  financial_account: 'حساب مالی',
  journal_entry: 'سند حسابداری',
  journal_line: 'ردیف سند',
  party: 'طرف‌حساب',
  bank_statement_line: 'ردیف صورتحساب بانکی',
  inventory_reconciliation: 'کنترل انبار'
});

export function controlTowerStatusFa(status) {
  return status === 'ready' ? 'آماده' : status === 'attention' ? 'نیازمند رسیدگی' : 'عادی';
}

function metricCard(metric, { count = null } = {}) {
  const value = metric.value === null ? '—' : money(metric.value);
  const status = metric.status === 'attention' ? 'attention' : 'normal';
  return `
    <article class="card avan-control-tower-metric ${status}" data-control-tower-metric="${esc(metric.id)}">
      <div class="avan-control-tower-metric-head">
        <span class="kpi-label">${esc(metric.label)}</span>
        <span class="avan-control-tower-dot" aria-hidden="true"></span>
      </div>
      <div class="kpi-value" data-avan-number-output="1">${value}</div>
      ${count === null ? '' : `<div class="muted">${Number(count).toLocaleString('fa-IR')} مورد باز</div>`}
      <button type="button" class="ghost small" data-control-tower-why="${esc(metric.id)}">چرا این عدد؟</button>
    </article>
  `;
}

function readinessHtml(readiness) {
  const ready = readiness.status === 'ready';
  const blockerLabels = {
    bank_reconciliation_open: 'مغایرت بانکی باز',
    inventory_reconciliation_open: 'مغایرت کنترل انبار',
    receivable_lines_without_party: 'دریافتنی بدون طرف‌حساب',
    payable_lines_without_party: 'پرداختنی بدون طرف‌حساب'
  };
  return `
    <section class="card avan-control-tower-readiness ${ready ? 'ready' : 'attention'}">
      <div class="section-head">
        <div>
          <h2>آمادگی بستن حساب‌ها</h2>
          <span class="muted">در این مرحله امتیاز ساختگی تولید نمی‌شود؛ فقط مانع‌های واقعی نمایش داده می‌شوند.</span>
        </div>
        <span class="cloud-badge">${controlTowerStatusFa(readiness.status)}</span>
      </div>
      ${ready
        ? '<div class="success-box">در کنترل‌های فعلی، مانع باز برای بستن حساب‌ها دیده نشد.</div>'
        : `<div class="avan-control-tower-blockers">${readiness.blockers.map(item => `<span class="summary-pill">${esc(blockerLabels[item] || item)}</span>`).join('')}</div>`}
    </section>
  `;
}

function actionsHtml(actions) {
  return `
    <section class="card avan-control-tower-actions">
      <div class="section-head">
        <div><h2>اقدام‌های اولویت‌دار</h2><span class="muted">پیشنهادهای کنترلی؛ هیچ اقدامی خودکار ثبت یا پرداخت نمی‌شود.</span></div>
        <span class="summary-pill">${Number(actions.length).toLocaleString('fa-IR')} اقدام</span>
      </div>
      ${actions.length ? `<div class="avan-control-tower-action-list">
        ${actions.map(action => `
          <div class="avan-control-tower-action">
            <div><b>${esc(action.title)}</b><span class="muted">${Number(action.count || 0).toLocaleString('fa-IR')} مورد</span></div>
            <button type="button" class="ghost small" data-control-tower-action-evidence="${esc(action.id)}">مشاهده شواهد</button>
          </div>
        `).join('')}
      </div>` : '<div class="success-box">اقدام کنترلی فوری از شاخص‌های فعلی استخراج نشد.</div>'}
    </section>
  `;
}

export function controlTowerPageHtml({ workspace, snapshot }) {
  return `
    <div class="avan-control-tower" data-control-tower-page>
      <section class="card avan-control-tower-hero">
        <div>
          <div class="eyebrow">نمای واقعی · مبتنی بر شواهد</div>
          <h2>برج کنترل مالی</h2>
          <p class="muted">یک نمای مدیریتی از وضعیت مالی «${esc(workspace.name)}»؛ اعداد از دفترکل و زیردفترهای معتبر خوانده می‌شوند و توسط هوش مصنوعی ساخته نشده‌اند.</p>
        </div>
        <form data-control-tower-date-form class="avan-control-tower-date-form">
          <div class="field">
            <label>تا تاریخ</label>
            <input type="date" name="asOf" value="${esc(snapshot.asOf)}" required>
          </div>
          <button type="submit" class="primary">به‌روزرسانی</button>
        </form>
      </section>

      <div class="grid4 avan-control-tower-grid">
        ${metricCard(snapshot.metrics.cash)}
        ${metricCard(snapshot.metrics.receivables)}
        ${metricCard(snapshot.metrics.payables)}
        ${metricCard(snapshot.metrics.bank, { count: snapshot.metrics.bank.count })}
        ${metricCard(snapshot.metrics.inventory, { count: snapshot.metrics.inventory.count })}
      </div>

      ${readinessHtml(snapshot.closeReadiness)}
      ${actionsHtml(snapshot.actions)}

      <section class="card avan-control-tower-twin-preview">
        <div class="section-head">
          <div>
            <h2>دوقلوی مالی</h2>
            <span class="muted">موتور سناریو از داده واقعی جداست و هیچ تغییری در دفترکل ایجاد نمی‌کند.</span>
          </div>
          <span class="cloud-badge">زیرساخت آماده</span>
        </div>
        <p>مرحله بعد همین چرخه: مقایسه حالت مبنا و سناریو برای فروش، وصول، هزینه و شوک نقدینگی با نمایش فرض‌ها و منشأ هر عدد.</p>
      </section>

      <div class="info-box avan-control-tower-contract">
        تاریخ مبنا: ${dateFa(snapshot.asOf)} · دقت پولی: یک ریال · تهاتر بین طرف‌حساب‌ها: غیرفعال · عملیات نوشتنی این صفحه: صفر
      </div>
    </div>
  `;
}

let currentResult = null;
let installed = false;

function setControlTowerNavActive(active) {
  document.querySelectorAll('#nav button.active').forEach(button => button.classList.remove('active'));
  document.querySelector('[data-control-tower-nav]')?.classList.toggle('active', Boolean(active));
}

function evidenceModal(title, explanation, evidence = []) {
  const grouped = new Map();
  evidence.forEach(ref => {
    if (!ref?.type || !ref?.id) return;
    if (!grouped.has(ref.type)) grouped.set(ref.type, []);
    grouped.get(ref.type).push(ref.id);
  });

  openModal(`
    <div data-control-tower-evidence-modal>
      <div class="section-head"><div><h2>${esc(title)}</h2><span class="muted">چرا این عدد؟</span></div><span class="cloud-badge">قابل ردیابی</span></div>
      <div class="info-box">${esc(explanation || 'این شاخص از داده‌های معتبر شرکت محاسبه شده است.')}</div>
      <div class="section avan-control-tower-evidence-list">
        ${grouped.size ? [...grouped.entries()].map(([type, ids]) => `
          <div class="card">
            <b>${esc(evidenceTypeFa[type] || type)}</b>
            <span class="muted">${Number(ids.length).toLocaleString('fa-IR')} مرجع</span>
            <div class="avan-control-tower-evidence-ids">${ids.slice(0, 12).map(id => `<code>${esc(id)}</code>`).join('')}</div>
            ${ids.length > 12 ? `<span class="muted">و ${Number(ids.length - 12).toLocaleString('fa-IR')} مرجع دیگر</span>` : ''}
          </div>
        `).join('') : '<div class="empty">برای این شاخص در وضعیت فعلی مرجع جزئی وجود ندارد.</div>'}
      </div>
      <div class="form-actions"><button type="button" class="ghost" data-control-tower-close-evidence>بستن</button></div>
    </div>
  `);
  document.querySelector('[data-control-tower-close-evidence]')?.addEventListener('click', closeModal, { once: true });
}

function bindPageActions() {
  const root = document.querySelector('[data-control-tower-page]');
  if (!root || !currentResult) return;

  root.querySelector('[data-control-tower-date-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const asOf = String(data.get('asOf') || '');
    if (!asOf) return toast('تاریخ مبنا را انتخاب کنید.');
    void openControlTower(asOf);
  });

  root.querySelectorAll('[data-control-tower-why]').forEach(button => {
    button.addEventListener('click', () => {
      const metric = Object.values(currentResult.snapshot.metrics).find(item => item.id === button.dataset.controlTowerWhy);
      if (!metric) return;
      evidenceModal(metric.label, metric.explanation, metric.evidence);
    });
  });

  root.querySelectorAll('[data-control-tower-action-evidence]').forEach(button => {
    button.addEventListener('click', () => {
      const action = currentResult.snapshot.actions.find(item => item.id === button.dataset.controlTowerActionEvidence);
      if (!action) return;
      evidenceModal(action.title, 'این اقدام از کنترل‌های قطعی و قاعده‌محور برج کنترل استخراج شده است.', action.evidence);
    });
  });
}

export async function openControlTower(asOf = today()) {
  if (!HAS_BROWSER || !Service) return null;
  try {
    setTitle('برج کنترل مالی');
    setControlTowerNavActive(true);
    page('<div class="loading">در حال ساخت نمای مالی از دفترکل…</div>');
    await MoneyRuntime?.ready?.();
    currentResult = await Service.load({ asOf });
    page(controlTowerPageHtml(currentResult));
    setControlTowerNavActive(true);
    bindPageActions();
    window.dispatchEvent(new CustomEvent('avan:control-tower-rendered', {
      detail: { workspace_id: currentResult.workspace.id, as_of: currentResult.snapshot.asOf }
    }));
    return currentResult;
  } catch (error) {
    console.error('[Avan Control Tower]', error);
    page('<div class="error-box">برج کنترل مالی در این لحظه قابل محاسبه نیست. دوباره تلاش کنید.</div>');
    return null;
  }
}

function installSidebarEntry() {
  const nav = document.getElementById('nav');
  if (!nav || nav.querySelector('[data-control-tower-nav]')) return;
  const label = document.createElement('div');
  label.className = 'nav-label';
  label.dataset.controlTowerNavLabel = '1';
  label.textContent = 'هوشمندی مالی';
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.controlTowerNav = '1';
  button.innerHTML = '<span>◈</span>برج کنترل مالی';
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeModal();
    void openControlTower();
  });
  nav.append(label, button);
}

function installReportsLauncher() {
  const content = document.getElementById('content');
  if (!content || content.querySelector('[data-control-tower-report-launcher]')) return;
  const card = document.createElement('section');
  card.className = 'card avan-control-tower-report-launcher';
  card.dataset.controlTowerReportLauncher = '1';
  card.innerHTML = `
    <div><b>◈ برج کنترل مالی</b><span class="muted">نقدینگی، مطالبات، بدهی‌ها، مغایرت‌ها و آمادگی بستن در یک نما</span></div>
    <button type="button" class="primary">مشاهده برج کنترل</button>
  `;
  card.querySelector('button')?.addEventListener('click', () => void openControlTower());
  content.prepend(card);
}

function onPageRendered(event) {
  const title = String(event?.detail?.title || document.getElementById('pageTitle')?.textContent || '');
  if (title === 'گزارش‌ها') installReportsLauncher();
  if (title !== 'برج کنترل مالی') document.querySelector('[data-control-tower-nav]')?.classList.remove('active');
}

export function installControlTowerWorkspace() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;
  installSidebarEntry();
  window.addEventListener('avan:page-rendered', onPageRendered);
  window.addEventListener('avan:company-context-changed', () => {
    if (document.querySelector('[data-control-tower-page]')) void openControlTower();
  });
  if (document.getElementById('pageTitle')?.textContent === 'گزارش‌ها') installReportsLauncher();
  window.AvanControlTower = Object.freeze({ open: openControlTower });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installControlTowerWorkspace, { once: true });
  else installControlTowerWorkspace();
}
