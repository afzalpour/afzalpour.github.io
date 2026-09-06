'use strict';

const MONEY_FIELD_NAMES = new Set([
  'amount',
  'debit',
  'credit',
  'unit_price',
  'discount',
  'opening_balance',
  'total_amount'
]);

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const GROUP_SEPARATOR = '٬';
let currentDisplayUnit = 'toman';

const UNIT_LABELS = {
  toman: 'تومان',
  rial: 'ریال'
};

const ONES = [
  '', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه',
  'ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده',
  'هفده', 'هجده', 'نوزده'
];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون', 'کوادریلیون', 'کوینتیلیون', 'سکستیلیون'];

function toLatinDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)));
}

function digitsOnly(value) {
  return toLatinDigits(value).replace(/\D/g, '');
}

function formatGrouped(value) {
  const raw = digitsOnly(value).replace(/^0+(?=\d)/, '');
  if (!raw) return '';
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
}

function tripletToWords(number) {
  const n = Number(number);
  if (!n) return '';

  const parts = [];
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds) parts.push(HUNDREDS[hundreds]);

  if (remainder) {
    if (remainder < 20) {
      parts.push(ONES[remainder]);
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      parts.push(TENS[tens]);
      if (ones) parts.push(ONES[ones]);
    }
  }

  return parts.join(' و ');
}

function integerToPersianWords(value) {
  const raw = digitsOnly(value).replace(/^0+(?=\d)/, '');
  if (!raw) return '';
  if (/^0+$/.test(raw)) return 'صفر';

  let n;
  try {
    n = BigInt(raw);
  } catch {
    return '';
  }

  const chunks = [];
  let scaleIndex = 0;

  while (n > 0n) {
    const chunk = Number(n % 1000n);
    if (chunk) {
      if (scaleIndex >= SCALES.length) return raw;
      const words = tripletToWords(chunk);
      const scale = SCALES[scaleIndex];
      chunks.unshift(scale ? `${words} ${scale}` : words);
    }
    n /= 1000n;
    scaleIndex += 1;
  }

  return chunks.join(' و ');
}

function unitLabel(unit = currentDisplayUnit) {
  return UNIT_LABELS[unit] || UNIT_LABELS.toman;
}

function amountInWords(value, unit = currentDisplayUnit) {
  const words = integerToPersianWords(value);
  return words ? `${words} ${unitLabel(unit)}` : '';
}

function isMoneyInputElement(input) {
  if (!(input instanceof HTMLInputElement)) return false;
  if (input.dataset.money === 'false') return false;
  if (input.dataset.money === 'true') return true;
  return MONEY_FIELD_NAMES.has(input.name || '');
}

function caretForDigitCount(formatted, digitCount) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d/.test(formatted[index])) seen += 1;
    if (seen === digitCount) return index + 1;
  }
  return formatted.length;
}

function ensureWordsElement(input) {
  const field = input.closest('.field') || input.parentElement;
  if (!field) return null;

  let words = Array.from(field.children)
    .find(child => child.classList?.contains('money-in-words')) || null;

  if (!words) {
    words = document.createElement('div');
    words.className = 'money-in-words';
    words.setAttribute('aria-live', 'polite');
    words.setAttribute('aria-atomic', 'true');
    input.insertAdjacentElement('afterend', words);
  }
  return words;
}

function refreshWords(input) {
  const words = ensureWordsElement(input);
  if (!words) return;
  words.textContent = amountInWords(input.value);
  words.hidden = !words.textContent;
}

function formatInput(input, preserveCaret = false) {
  const oldValue = input.value;
  const oldCaret = preserveCaret && typeof input.selectionStart === 'number'
    ? input.selectionStart
    : null;
  const digitsBeforeCaret = oldCaret === null
    ? null
    : digitsOnly(oldValue.slice(0, oldCaret)).length;

  const formatted = formatGrouped(oldValue);
  if (formatted !== oldValue) input.value = formatted;

  if (digitsBeforeCaret !== null && document.activeElement === input) {
    const nextCaret = caretForDigitCount(formatted, digitsBeforeCaret);
    try {
      input.setSelectionRange(nextCaret, nextCaret);
    } catch {
      // Some mobile input modes may not expose selection APIs consistently.
    }
  }

  refreshWords(input);
}

function enhanceMoneyInput(input) {
  if (!isMoneyInputElement(input) || input.dataset.moneyEnhanced === 'true') return;

  input.dataset.moneyEnhanced = 'true';
  input.classList.add('money-input-enhanced');
  if (!input.inputMode) input.inputMode = 'numeric';
  input.autocomplete = 'off';

  input.addEventListener('input', () => formatInput(input, true));
  input.addEventListener('change', () => formatInput(input, false));
  input.addEventListener('blur', () => formatInput(input, false));

  formatInput(input, false);
}

function scan(root = document) {
  if (root instanceof HTMLInputElement) enhanceMoneyInput(root);
  if (!root.querySelectorAll) return;
  root.querySelectorAll('input').forEach(enhanceMoneyInput);
}

function refreshAllMoneyInputs(root = document) {
  if (root instanceof HTMLInputElement && isMoneyInputElement(root)) {
    formatInput(root, false);
    return;
  }
  if (!root.querySelectorAll) return;
  root.querySelectorAll('input').forEach(input => {
    if (isMoneyInputElement(input)) formatInput(input, false);
  });
}

function setDisplayUnit(unit) {
  currentDisplayUnit = unit === 'rial' ? 'rial' : 'toman';
  refreshAllMoneyInputs();
  return currentDisplayUnit;
}

function installMoneyInputEnhancer() {
  scan(document);

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installMoneyInputEnhancer, { once: true });
} else {
  installMoneyInputEnhancer();
}

export {
  formatGrouped,
  integerToPersianWords,
  amountInWords,
  installMoneyInputEnhancer,
  setDisplayUnit,
  refreshAllMoneyInputs,
  isMoneyInputElement
};
