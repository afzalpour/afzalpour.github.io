'use strict';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

export function counterpartScopeForOperation(kind) {
  return kind === 'transfer' ? 'cash-bank-only' : 'all-postable';
}

export function counterpartGuidanceForOperation(kind, direction = '') {
  if (kind === 'transfer') {
    return direction === 'credit'
      ? 'انتقال فقط برای جابه‌جایی وجه از یک بانک/صندوق دیگر به این حساب است؛ حساب مبدأ عمداً فقط از بانک‌ها و صندوق‌ها انتخاب می‌شود.'
      : 'انتقال فقط برای جابه‌جایی وجه از این حساب به یک بانک/صندوق دیگر است؛ حساب مقصد عمداً فقط از بانک‌ها و صندوق‌ها انتخاب می‌شود.';
  }
  return kind === 'receipt'
    ? 'برای دریافت واقعی، حساب مقابل می‌تواند هر حساب فعالِ قابل ثبت مانند مشتری/دریافتنی، درآمد، تسهیلات، جاری شرکا و سایر حساب‌های مرتبط باشد.'
    : 'برای پرداخت واقعی، حساب مقابل می‌تواند هر حساب فعالِ قابل ثبت مانند فروشنده/پرداختنی، هزینه، دارایی، بدهی، جاری شرکا و سایر حساب‌های مرتبط باشد.';
}

function operationKindFromModal() {
  const modal = document.getElementById('modal');
  const form = document.getElementById('opForm');
  if (!modal || !form) return '';
  const heading = modal.querySelector('h2')?.textContent?.trim() || '';
  if (heading === 'دریافت') return 'receipt';
  if (heading === 'پرداخت') return 'payment';
  if (heading === 'انتقال') return 'transfer';
  return '';
}

function fieldFor(select) {
  return select?.closest('.field') || null;
}

function setFieldLabel(select, text) {
  const label = fieldFor(select)?.querySelector('label');
  if (label) label.textContent = text;
}

function decorateBankOperationChoice() {
  const modal = document.getElementById('modal');
  if (!modal) return;
  const heading = modal.querySelector('h2')?.textContent?.trim() || '';
  if (heading !== 'ثبت رویداد مالی برای ردیف بانک') return;
  if (modal.querySelector('[data-avan-bank-operation-scope-help]')) return;

  const transferButton = modal.querySelector('[data-avan-bank-operation-kind="transfer"]');
  const normalButton = modal.querySelector('[data-avan-bank-operation-kind="receipt"], [data-avan-bank-operation-kind="payment"]');
  if (!transferButton || !normalButton) return;

  const normalKind = normalButton.dataset.avanBankOperationKind;
  const direction = normalKind === 'receipt' ? 'credit' : 'debit';
  const help = document.createElement('div');
  help.dataset.avanBankOperationScopeHelp = '1';
  help.className = 'info-box';
  help.innerHTML = `<b>انتخاب نوع رویداد مهم است:</b><br>${counterpartGuidanceForOperation(normalKind, direction)}<br>${counterpartGuidanceForOperation('transfer', direction)}`;
  const actions = modal.querySelector('.form-actions');
  actions?.insertAdjacentElement('beforebegin', help);
}

function decorateBankPrefilledOperationForm() {
  const form = document.getElementById('opForm');
  if (!form?.dataset?.avanBankSourceLineId) return;
  const kind = operationKindFromModal();
  if (!kind) return;

  const primary = form.querySelector('[name="primary"]');
  const counter = form.querySelector('[name="counter"]');
  const party = form.querySelector('[name="party"]');
  const direction = kind === 'receipt' ? 'credit' : kind === 'payment' ? 'debit' : '';

  if (kind === 'receipt') {
    setFieldLabel(primary, 'واریز به حساب بانکی');
    setFieldLabel(counter, 'حساب مقابل (همه حساب‌های قابل ثبت)');
  } else if (kind === 'payment') {
    setFieldLabel(primary, 'پرداخت از حساب بانکی');
    setFieldLabel(counter, 'حساب مقابل (همه حساب‌های قابل ثبت)');
  } else {
    setFieldLabel(primary, 'حساب مبدأ نقدی (بانک/صندوق)');
    setFieldLabel(counter, 'حساب مقصد نقدی (بانک/صندوق)');
  }

  if (party) setFieldLabel(party, 'طرف‌حساب (در صورت ارتباط)');

  let note = form.querySelector('[data-avan-bank-counterpart-scope-note]');
  if (!note) {
    note = document.createElement('div');
    note.dataset.avanBankCounterpartScopeNote = '1';
    note.className = 'info-box';
    const existing = form.querySelector('[data-avan-bank-prefill-note]');
    (existing || form.firstElementChild)?.insertAdjacentElement('afterend', note);
  }
  const effectiveDirection = direction || (counter?.value ? 'credit' : 'debit');
  note.textContent = counterpartGuidanceForOperation(kind, effectiveDirection);
}

function apply() {
  decorateBankOperationChoice();
  decorateBankPrefilledOperationForm();
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
  const modal = document.getElementById('modal');
  if (modal) {
    new MutationObserver(schedule).observe(modal, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-avan-bank-source-line-id']
    });
  }
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-avan-bank-operation-kind]')) {
      window.requestAnimationFrame(schedule);
    }
  }, true);
  schedule();
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}
