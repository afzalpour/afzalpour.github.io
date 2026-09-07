'use strict';

const faToEn = value => String(value ?? '')
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

const onlyDigits = value => faToEn(value).replace(/[^0-9]/g, '');
const grouped = value => onlyDigits(value).replace(/\B(?=(\d{3})+(?!\d))/g, '٬');

function caretForDigitCount(value, digitCount) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (/\d/.test(value[i])) seen += 1;
    if (seen >= digitCount) return i + 1;
  }
  return value.length;
}

function formatLiveMoneyInput(input) {
  const current = String(input.value ?? '');
  const start = input.selectionStart ?? current.length;
  const digitsBeforeCaret = onlyDigits(current.slice(0, start)).length;
  const next = grouped(current);
  if (next === current) return;
  input.value = next;
  const caret = caretForDigitCount(next, digitsBeforeCaret);
  try { input.setSelectionRange(caret, caret); } catch {}
}

function isLiveMoneyTarget(target) {
  return target instanceof HTMLInputElement && (
    target.name === 'v60_amount' ||
    target.matches('[data-live-money-input]')
  );
}

document.addEventListener('input', event => {
  const target = event.target;
  if (!isLiveMoneyTarget(target)) return;
  formatLiveMoneyInput(target);
}, true);

document.addEventListener('focusin', event => {
  const target = event.target;
  if (!isLiveMoneyTarget(target)) return;
  formatLiveMoneyInput(target);
}, true);
