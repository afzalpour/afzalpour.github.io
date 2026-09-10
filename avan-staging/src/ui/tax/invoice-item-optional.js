'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';

export function preferredStandardTaxProfileValue(options = []) {
  const rows = Array.from(options || []);
  const standard = rows.find(option =>
    option?.value && option?.dataset?.taxTreatment === 'standard'
  );
  return standard?.value || '';
}

export function invoiceRowIsUsed(row) {
  if (!row?.querySelector) return false;
  return Boolean(
    row.querySelector('[name="account"]')?.value ||
    row.querySelector('[name="description"]')?.value?.trim() ||
    row.querySelector('[name="unit_price"]')?.value?.trim()
  );
}

function explainOptionalItem(row, taxSelect) {
  const note = row.querySelector('[data-rc15-line-tax-note]');
  if (!note) return;
  const itemValue = row.querySelector('[data-e-item]')?.value || row.dataset?.eItem || '';
  if (itemValue) return;
  note.textContent = taxSelect.value
    ? 'انتخاب کالا/خدمت ثبت‌شده اختیاری است؛ وضعیت مالیاتی این ردیف مستقل ثبت می‌شود.'
    : 'انتخاب کالا/خدمت ثبت‌شده اختیاری است؛ فقط وضعیت مالیاتی این ردیف را انتخاب کنید.';
}

export function normalizeInvoiceTaxRow(row) {
  const taxSelect = row?.querySelector?.('[data-rc15-tax-profile]');
  if (!taxSelect) return false;

  taxSelect.required = false;
  taxSelect.removeAttribute('required');

  if (invoiceRowIsUsed(row) && !taxSelect.value) {
    const fallback = preferredStandardTaxProfileValue(taxSelect.options);
    if (fallback) {
      taxSelect.value = fallback;
      taxSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  explainOptionalItem(row, taxSelect);
  return true;
}

export function normalizeInvoiceTaxForm(documentObject = document) {
  const form = documentObject.getElementById('invoiceForm');
  if (!form || form.dataset.rc15TaxEnabled !== '1') return false;
  form.querySelectorAll('[data-invoice-line]').forEach(normalizeInvoiceTaxRow);
  return true;
}

function install(globalObject = window, documentObject = document) {
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  const schedule = reason => Lifecycle.schedule(`tax-item-optional:${reason}`);

  Lifecycle.use('tax:invoice-item-optional', () => normalizeInvoiceTaxForm(documentObject), { priority: 65 });

  documentObject.addEventListener('avan:invoice-tax-metadata-changed', () => {
    globalObject.setTimeout(() => normalizeInvoiceTaxForm(documentObject), 0);
  });
  globalObject.addEventListener('avan:page-rendered', () => schedule('page'));

  documentObject.addEventListener('input', event => {
    const row = event.target?.closest?.('[data-invoice-line]');
    if (!row) return;
    normalizeInvoiceTaxRow(row);
  }, true);

  documentObject.addEventListener('change', event => {
    const row = event.target?.closest?.('[data-invoice-line]');
    if (!row) return;
    if (event.target.matches?.('[data-e-item],[data-rc15-tax-profile],[name="account"]')) {
      globalObject.setTimeout(() => normalizeInvoiceTaxRow(row), 0);
    }
  }, true);

  schedule('ready');
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') install();
