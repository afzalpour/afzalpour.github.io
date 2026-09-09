'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createElectronicInvoiceService } from '../../application/einvoice/einvoice-service.js';
import { openModal, closeModal } from '../components/modal.js';
import { showError } from '../feedback/toast.js';
import { MoneyRuntime } from '../money/money-runtime.js';

const C = installAvanCloud();
const EInvoice = createElectronicInvoiceService(C);
let activeInvoiceId = null;

const SEVERITY_FA = Object.freeze({ error: 'مانع', warning: 'هشدار', info: 'اطلاعات' });
const SOURCE_FA = Object.freeze({
  'avan-core': 'قاعده پایدار آوان',
  'taxpayer-system-stable': 'قاعده پایدار سامانه مؤدیان',
  'provider-profile-required': 'نیازمند پروفایل Provider'
});

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

function modalVisible(documentObject = document) {
  const backdrop = documentObject.getElementById('modalBackdrop');
  return Boolean(backdrop && !backdrop.hidden);
}

function injectPreflightAction(invoiceId, documentObject = document) {
  if (!invoiceId || !modalVisible(documentObject)) return false;
  const modal = documentObject.getElementById('modal');
  if (!modal || !/^فاکتور\b/.test(modal.querySelector('h2')?.textContent?.trim() || '')) return false;
  const actions = modal.querySelector('.form-actions');
  if (!actions) return false;

  let button = actions.querySelector('[data-einvoice-preflight]');
  if (!button) {
    button = documentObject.createElement('button');
    button.type = 'button';
    button.className = 'primary';
    button.dataset.einvoicePreflight = invoiceId;
    button.textContent = '✓ پیش‌اعتبارسنجی صورتحساب الکترونیکی';
    actions.prepend(button);
  } else {
    button.dataset.einvoicePreflight = invoiceId;
  }
  return true;
}

function findingRows(result) {
  const rows = result.validation.findings || [];
  if (!rows.length) return '<div class="success-box">هیچ مانع یا هشداری در قواعد این Gate پیدا نشد.</div>';
  return `<div class="einvoice-finding-list">${rows.map(item => `
    <article class="einvoice-finding einvoice-${esc(item.severity)}">
      <div class="einvoice-finding-head">
        <span class="badge">${esc(SEVERITY_FA[item.severity] || item.severity)}</span>
        <strong>${esc(item.message_fa)}</strong>
      </div>
      <small>${esc(item.code)} · ${esc(item.field)} · ${esc(SOURCE_FA[item.source] || item.source)}</small>
    </article>
  `).join('')}</div>`;
}

function preflightHtml(result) {
  const { model, validation, adapter } = result;
  const summary = validation.summary || {};
  const ready = Boolean(validation.ready);
  const total = MoneyRuntime.isReady()
    ? MoneyRuntime.formatCanonicalDecimal(model.invoice.total_amount)
    : model.invoice.total_amount;

  return `
    <div class="section-head einvoice-preflight-head">
      <div>
        <h2>پیش‌اعتبارسنجی صورتحساب الکترونیکی</h2>
        <span class="muted">فاکتور فروش ${esc(model.invoice.number || 'پیش‌نویس')} · ${esc(model.workspace.name || '')}</span>
      </div>
      <span class="badge ${ready ? 'posted' : 'reversed'}">${ready ? 'آماده از نظر داده' : 'نیازمند اصلاح'}</span>
    </div>

    <div class="grid4 einvoice-summary">
      <div class="card"><div class="kpi-label">مانع</div><div class="kpi-value small-kpi ${Number(summary.errors || 0) ? 'neg' : 'pos'}">${Number(summary.errors || 0).toLocaleString('fa-IR')}</div></div>
      <div class="card"><div class="kpi-label">هشدار</div><div class="kpi-value small-kpi">${Number(summary.warnings || 0).toLocaleString('fa-IR')}</div></div>
      <div class="card"><div class="kpi-label">ردیف</div><div class="kpi-value small-kpi">${model.lines.length.toLocaleString('fa-IR')}</div></div>
      <div class="card"><div class="kpi-label">جمع نهایی</div><div class="kpi-value small-kpi">${esc(total)}</div></div>
    </div>

    <div class="info-box einvoice-boundary-note">
      <b>مرز این Gate:</b> این صفحه فقط داده فاکتور را استاندارد و کنترل می‌کند. هیچ صورتحسابی به سامانه مؤدیان یا سرویس دیگری ارسال نشده است، هیچ کلید/توکن مالیاتی در Browser نگهداری نمی‌شود و Adapter فعلی قابلیت ارسال ندارد.
    </div>

    ${findingRows(result)}

    <div class="section card einvoice-adapter-card">
      <div class="section-head"><div><h3>Adapter Contract</h3><span class="muted">مرز آماده برای Provider نسخه‌دار در Gate بعدی اتصال</span></div><span class="badge">${esc(adapter.id)} v${esc(adapter.version)}</span></div>
      <p class="muted">قابلیت ارسال: <b>غیرفعال</b> · مدل: ${esc(model.schema_version)} · جهت: خروجی / فروش</p>
      <p class="muted">قواعد وابسته به نوع صورتحساب، الگوی سازمان و نسخه Provider در Adapter اختصاصی اضافه می‌شوند؛ قواعد متغیر قانونی در Core آوان Hard-code نمی‌شوند.</p>
    </div>

    <div class="form-actions">
      <button type="button" class="ghost" id="cancelModal">بستن</button>
    </div>
  `;
}

async function showPreflight(invoiceId) {
  try {
    await MoneyRuntime.ready();
    openModal('<div class="loading">در حال ساخت مدل صورتحساب و اجرای کنترل‌های پیش‌ارسال…</div>');
    const result = await EInvoice.prevalidate(invoiceId);
    openModal(preflightHtml(result));
    document.getElementById('cancelModal').onclick = closeModal;
    window.AvanMoneyOutput?.project?.();
  } catch (error) {
    closeModal();
    showError(error, 'e-invoice preflight');
  }
}

function installStyle(documentObject = document) {
  if (documentObject.getElementById('avanEInvoicePreflightStyle')) return;
  const style = documentObject.createElement('style');
  style.id = 'avanEInvoicePreflightStyle';
  style.textContent = `
    .einvoice-preflight-head{align-items:flex-start}.einvoice-summary{margin-top:12px}
    .einvoice-finding-list{display:grid;gap:9px;margin-top:14px}
    .einvoice-finding{border:1px solid var(--line);border-radius:11px;padding:11px 12px;background:var(--surface)}
    .einvoice-finding-head{display:flex;gap:8px;align-items:flex-start}.einvoice-finding-head strong{line-height:1.9;font-size:13px}
    .einvoice-finding small{display:block;color:var(--faint);margin-top:6px;direction:ltr;text-align:left}
    .einvoice-error{border-color:#f2caca;background:var(--bad-soft)}
    .einvoice-warning{border-color:#efd7ba;background:var(--warn-soft)}
    .einvoice-info{background:var(--surface2)}
    .einvoice-adapter-card h3{margin:0;font-size:15px}.einvoice-boundary-note{line-height:2}
  `;
  documentObject.head.append(style);
}

export function installEInvoicePreflightUi({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanEInvoicePreflight?.installed) return globalObject.AvanEInvoicePreflight;
  installStyle(documentObject);

  const scheduleInject = invoiceId => [0, 40, 120, 300].forEach(delay =>
    globalObject.setTimeout(() => injectPreflightAction(invoiceId, documentObject), delay)
  );

  documentObject.addEventListener('click', event => {
    const view = event.target.closest?.('[data-view-invoice]');
    if (view?.dataset.viewInvoice) {
      activeInvoiceId = view.dataset.viewInvoice;
      scheduleInject(activeInvoiceId);
      return;
    }
    const action = event.target.closest?.('[data-einvoice-preflight]');
    if (action?.dataset.einvoicePreflight) {
      event.preventDefault();
      void showPreflight(action.dataset.einvoicePreflight);
    }
  }, true);

  globalObject.addEventListener('avan:page-rendered', () => {
    if (activeInvoiceId) scheduleInject(activeInvoiceId);
  });

  const api = Object.freeze({
    installed: true,
    prevalidate: invoiceId => EInvoice.prevalidate(invoiceId),
    open: invoiceId => showPreflight(invoiceId)
  });
  globalObject.AvanEInvoicePreflight = api;
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installEInvoicePreflightUi();
