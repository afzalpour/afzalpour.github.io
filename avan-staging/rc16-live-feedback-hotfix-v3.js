'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from './src/ui/money/money-runtime.js';
import { openModal, closeModal } from './src/ui/components/modal.js';
import { toast } from './src/ui/feedback/toast.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const C = HAS_BROWSER ? installAvanCloud() : null;

export function taxSurfaceNeedsRefresh({ title = '', taxEnabled = '', rowCount = 0, taxFieldCount = 0, hasSettingsCard = false, hasVatReport = false } = {}) {
  if (title === 'تنظیمات') return !hasSettingsCard;
  if (title === 'گزارش‌ها') return !hasVatReport;
  if (!rowCount) return false;
  if (taxEnabled !== '0' && taxEnabled !== '1') return true;
  return taxEnabled === '1' && taxFieldCount < rowCount;
}

export function operationChoicesForDirection(direction) {
  return direction === 'credit'
    ? Object.freeze([{ kind: 'receipt', label: 'ثبت دریافت' }, { kind: 'transfer', label: 'ثبت انتقال به این حساب' }])
    : Object.freeze([{ kind: 'payment', label: 'ثبت پرداخت' }, { kind: 'transfer', label: 'ثبت انتقال از این حساب' }]);
}

function installStyle() {
  if (document.getElementById('avanRc16LiveFeedbackV3Style')) return;
  const style = document.createElement('style');
  style.id = 'avanRc16LiveFeedbackV3Style';
  style.textContent = `
    .avan-bank-grid.avan-bank-grid-focused{grid-template-columns:minmax(0,1fr)!important}
    .avan-bank-grid.avan-bank-grid-focused>aside[hidden]{display:none!important}
    .avan-bank-history-toggle{white-space:nowrap}
    .avan-bank-no-candidate-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)}
    .avan-bank-import-guidance{line-height:1.9}
    .avan-tax-state-note{margin:10px 20px 0}
    #invoiceForm [data-rc15-tax-profile]{pointer-events:auto!important;touch-action:manipulation;min-height:40px}
  `;
  document.head.append(style);
}

function stabilizeExistingTaxSelects() {
  document.querySelectorAll('#invoiceForm [data-rc15-tax-profile]').forEach(select => {
    select.disabled = false;
    select.removeAttribute('aria-disabled');
    select.dataset.avanNativeTaxPicker = '1';
    select.dataset.avanTaxPickerStable = '1';
  });
}

function decorateTaxState() {
  const form = document.getElementById('invoiceForm');
  if (!form) return;
  stabilizeExistingTaxSelects();

  let note = form.querySelector('[data-avan-tax-state-note]');
  const enabled = form.dataset.rc15TaxEnabled;
  const fields = [...form.querySelectorAll('[data-rc15-invoice-tax-field]')];
  const optionCount = fields.reduce((count, field) => count + [...(field.querySelector('[data-rc15-tax-profile]')?.options || [])].filter(option => option.value).length, 0);

  let text = '';
  let className = 'info-box avan-tax-state-note';
  if (enabled === '0') {
    text = 'محاسبه مالیات برای این شرکت در تنظیمات غیرفعال است. برای انتخاب وضعیت مالیاتی، ابتدا «مالیات و ارزش افزوده» را در تنظیمات شرکت فعال کنید.';
  } else if (enabled === '1' && fields.length && optionCount === 0) {
    text = 'وضعیت مالیاتی فعالی برای این شرکت پیدا نشد. تنظیمات مالیاتی شرکت را بررسی و دوباره بازخوانی کنید.';
    className = 'error-box avan-tax-state-note';
  }

  if (!text) {
    note?.remove();
    return;
  }
  if (!note) {
    note = document.createElement('div');
    note.dataset.avanTaxStateNote = '1';
    const firstGrid = form.querySelector(':scope > .form-grid');
    if (firstGrid) firstGrid.insertAdjacentElement('afterend', note);
    else form.prepend(note);
  }
  note.className = className;
  note.textContent = text;
}

function taxRefreshSnapshot() {
  const title = document.getElementById('pageTitle')?.textContent?.trim() || '';
  const form = document.getElementById('invoiceForm');
  const rows = form ? [...form.querySelectorAll('[data-invoice-line]')] : [];
  return {
    title,
    taxEnabled: form?.dataset?.rc15TaxEnabled || '',
    rowCount: rows.length,
    taxFieldCount: rows.filter(row => row.querySelector('[data-rc15-invoice-tax-field]')).length,
    hasSettingsCard: Boolean(document.querySelector('[data-rc15-tax-settings]')),
    hasVatReport: Boolean(document.querySelector('[data-rc15-vat-report]'))
  };
}

function installStableTaxLifecycle() {
  const Lifecycle = window.AvanUiLifecycle;
  if (!Lifecycle?.remove || !Lifecycle?.use || typeof window.AvanTax?.refresh !== 'function') return false;
  if (window.__avanStableTaxLifecycleV3) return true;
  window.__avanStableTaxLifecycleV3 = true;

  Lifecycle.remove('tax:workspace-v2');
  let busy = false;
  Lifecycle.use('tax:workspace-v2-stable', async () => {
    if (busy) return;
    const snapshot = taxRefreshSnapshot();
    if (!taxSurfaceNeedsRefresh(snapshot)) {
      decorateTaxState();
      return;
    }
    busy = true;
    try {
      await window.AvanTax.refresh();
      stabilizeExistingTaxSelects();
      decorateTaxState();
    } catch (error) {
      console.warn('[Avan stable tax lifecycle]', error);
    } finally {
      busy = false;
    }
  }, { priority: 60 });
  Lifecycle.schedule('tax-stable-v3', 'install');
  return true;
}

function addBankImportGuidance(root) {
  const previewCard = root.querySelector('#avanBankPreview')?.closest('.card');
  if (!previewCard || previewCard.querySelector('[data-avan-bank-import-guidance]')) return;
  const box = document.createElement('div');
  box.dataset.avanBankImportGuidance = '1';
  box.className = 'info-box avan-bank-import-guidance';
  box.innerHTML = '<b>ستون‌های فایل بانک‌ها لازم نیست یکسان باشند.</b><br>آوان ستون‌های هر فایل را به ساختار استاندارد داخلی نگاشت می‌کند. اگر تشخیص خودکار درست نبود، پیش از ثبت، نگاشت ستون‌ها را از فهرست‌های «پیش‌نمایش و نگاشت ستون‌ها» اصلاح کنید.';
  const head = previewCard.querySelector('.section-head');
  head?.insertAdjacentElement('afterend', box);
}

function compactBankHistory(root) {
  const grid = root.querySelector('.avan-bank-grid');
  const aside = grid?.querySelector(':scope > aside.card');
  const details = grid?.querySelector(':scope > main.card');
  if (!grid || !aside || !details) return;
  const hasSelectedImport = !details.querySelector('.avan-bank-empty') && Boolean(aside.querySelector('[data-bank-import-id]'));
  if (!hasSelectedImport) return;

  grid.classList.add('avan-bank-grid-focused');
  aside.hidden = true;
  const header = details.querySelector(':scope > .section-head');
  if (!header || header.querySelector('[data-avan-bank-history-toggle]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ghost small avan-bank-history-toggle';
  button.dataset.avanBankHistoryToggle = '1';
  button.textContent = 'صورت‌حساب‌های قبلی';
  button.addEventListener('click', () => {
    aside.hidden = !aside.hidden;
    button.textContent = aside.hidden ? 'صورت‌حساب‌های قبلی' : 'بستن فهرست صورت‌حساب‌ها';
  });
  header.append(button);
}

async function activeWorkspaceId() {
  const context = await C.companyContext.ensure();
  if (context?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
  const id = context?.active_company?.id || null;
  if (!id) throw new Error('COMPANY_REQUIRED');
  return id;
}

async function loadBankLine(lineId) {
  const wid = await activeWorkspaceId();
  const rows = await C.select('bank_statement_lines', `select=id,workspace_id,line_no,booking_date,description,reference_no,counterparty,direction,amount&workspace_id=eq.${wid}&id=eq.${lineId}&limit=1`);
  const line = rows?.[0];
  if (!line) throw new Error('BANK_STATEMENT_LINE_REQUIRED');
  const financialAccountId = document.getElementById('avanBankAccount')?.value || '';
  const accounts = financialAccountId
    ? await C.select('financial_accounts', `select=id,ledger_account_id&workspace_id=eq.${wid}&id=eq.${financialAccountId}&limit=1`)
    : [];
  const ledgerAccountId = accounts?.[0]?.ledger_account_id || '';
  if (!ledgerAccountId) throw new Error('BANK_ACCOUNT_REQUIRED');
  return { line, ledgerAccountId };
}

function addRequiredPlaceholder(select, text) {
  if (!select) return;
  let option = [...select.options].find(item => item.value === '');
  if (!option) {
    option = document.createElement('option');
    option.value = '';
    select.prepend(option);
  }
  option.textContent = text;
  select.value = '';
  select.required = true;
}

function setSelectValue(select, value) {
  if (!select || !value) return false;
  const exists = [...select.options].some(option => option.value === value);
  if (!exists) return false;
  select.value = value;
  return true;
}

function fillExistingOperationForm({ kind, line, ledgerAccountId }) {
  const form = document.getElementById('opForm');
  if (!form) return false;
  const date = form.querySelector('[name="date"]');
  const amount = form.querySelector('[name="amount"]');
  const primary = form.querySelector('[name="primary"]');
  const counter = form.querySelector('[name="counter"]');
  const description = form.querySelector('[name="description"]');

  if (date) date.value = line.booking_date || date.value;
  if (amount) {
    amount.value = MoneyRuntime?.decimalInputFromCanonical?.(String(line.amount)) || String(line.amount || '');
    amount.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (description) {
    const ref = line.reference_no ? ` — پیگیری ${line.reference_no}` : '';
    description.value = `ثبت از مغایرت بانکی — ${line.description || 'تراکنش بانکی'}${ref}`;
  }

  if (kind === 'receipt' || kind === 'payment') {
    setSelectValue(primary, ledgerAccountId);
    addRequiredPlaceholder(counter, 'حساب مقابل را انتخاب کنید…');
  } else if (kind === 'transfer') {
    if (line.direction === 'credit') {
      setSelectValue(counter, ledgerAccountId);
      addRequiredPlaceholder(primary, 'حساب مبدأ را انتخاب کنید…');
    } else {
      setSelectValue(primary, ledgerAccountId);
      addRequiredPlaceholder(counter, 'حساب مقصد را انتخاب کنید…');
    }
  }

  if (!form.querySelector('[data-avan-bank-prefill-note]')) {
    const note = document.createElement('div');
    note.dataset.avanBankPrefillNote = '1';
    note.className = 'info-box';
    note.innerHTML = '<b>این فرم از ردیف صورت‌حساب بانک پر شده است.</b><br>تاریخ، مبلغ و سمت حساب بانکی از فایل آمده‌اند؛ حساب مقابل/مبدأ/مقصد را خودتان کنترل و انتخاب کنید. تا فشردن «ثبت قطعی» هیچ سندی ایجاد نمی‌شود.';
    form.prepend(note);
  }
  form.dataset.avanBankSourceLineId = String(line.id || '');
  return true;
}

function openExistingOperation(kind, line, ledgerAccountId) {
  closeModal();
  const trigger = document.querySelector(`#nav [data-action="${kind}"]`) || document.querySelector(`[data-action="${kind}"]`);
  if (!trigger) return toast('فرم ثبت مالی در دسترس نیست.');
  trigger.click();
  window.requestAnimationFrame(() => {
    if (!fillExistingOperationForm({ kind, line, ledgerAccountId })) {
      window.setTimeout(() => fillExistingOperationForm({ kind, line, ledgerAccountId }), 50);
    }
  });
}

async function openBankOperationChoice(lineId) {
  try {
    const { line, ledgerAccountId } = await loadBankLine(lineId);
    const choices = operationChoicesForDirection(line.direction);
    const directionText = line.direction === 'credit' ? 'واریز به حساب بانک' : 'برداشت از حساب بانک';
    openModal(`
      <h2>ثبت رویداد مالی برای ردیف بانک</h2>
      <div class="info-box"><b>${directionText}</b><br>${line.booking_date || '—'} · ${MoneyRuntime?.formatCanonicalDecimal?.(String(line.amount)) || line.amount}<br>${line.description || 'بدون شرح'}</div>
      <p class="muted">آوان نوع سند را به‌صورت خودکار انتخاب نمی‌کند. نوع رویداد واقعی را شما مشخص کنید؛ فرم بعدی فقط با اطلاعات این ردیف از پیش پر می‌شود.</p>
      <div class="form-actions">
        ${choices.map(choice => `<button type="button" class="${choice.kind === 'transfer' ? 'ghost' : 'primary'}" data-avan-bank-operation-kind="${choice.kind}">${choice.label}</button>`).join('')}
        <button type="button" class="ghost" id="cancelModal">انصراف</button>
      </div>
    `);
    document.getElementById('cancelModal').onclick = closeModal;
    document.querySelectorAll('[data-avan-bank-operation-kind]').forEach(button => {
      button.addEventListener('click', () => openExistingOperation(button.dataset.avanBankOperationKind, line, ledgerAccountId));
    });
  } catch (error) {
    console.warn('[Avan bank create operation]', error);
    toast('اطلاعات ردیف بانکی برای ثبت مالی قابل بازیابی نیست.');
  }
}

function addNoCandidateActions(root) {
  root.querySelectorAll('.avan-bank-candidates').forEach(box => {
    if (!box.textContent.includes('کاندید معتبر با مبلغ و سمت بانکی دقیق در بازه تاریخ یافت نشد.')) return;
    if (box.querySelector('[data-avan-bank-create-operation]')) return;
    const candidateRow = box.closest('tr');
    const sourceRow = candidateRow?.previousElementSibling;
    const lineId = sourceRow?.querySelector('[data-bank-candidates]')?.dataset?.bankCandidates;
    if (!lineId) return;
    const actions = document.createElement('div');
    actions.className = 'avan-bank-no-candidate-actions';
    actions.innerHTML = '<span class="muted">اگر این تراکنش هنوز در آوان ثبت نشده است:</span>';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary small';
    button.dataset.avanBankCreateOperation = lineId;
    button.textContent = 'ثبت رویداد مالی مناسب';
    button.addEventListener('click', () => void openBankOperationChoice(lineId));
    actions.append(button);
    box.append(actions);
  });
}

function enhanceBankWorkspace() {
  const root = document.querySelector('[data-avan-bank-workspace]');
  if (!root) return;
  addBankImportGuidance(root);
  compactBankHistory(root);
  addNoCandidateActions(root);
}

function apply() {
  installStyle();
  installStableTaxLifecycle();
  stabilizeExistingTaxSelects();
  decorateTaxState();
  enhanceBankWorkspace();
}

function install() {
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      apply();
    });
  };
  const observer = new MutationObserver(schedule);
  const content = document.getElementById('content');
  const modal = document.getElementById('modal');
  if (content) observer.observe(content, { childList: true, subtree: true });
  if (modal) observer.observe(modal, { childList: true, subtree: true });
  document.addEventListener('avan:ui-changed', schedule);
  window.addEventListener('avan:page-rendered', schedule);
  window.addEventListener('avan:company-context-changed', schedule);
  schedule();
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}
