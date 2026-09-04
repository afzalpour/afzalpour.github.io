'use strict';

const UNIT_TOMAN = 'toman';
const UNIT_RIAL = 'rial';
const UNIT_LABEL = {
  toman: 'تومان',
  rial: 'ریال'
};

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const GROUP_SEPARATOR = '٬';
const MONEY_PATTERN = /(-?[0-9۰-۹٠-٩][0-9۰-۹٠-٩٬,]*)\s*(تومان|ریال)/g;

const FINANCIAL_PAGES = new Set([
  'داشبورد',
  'فاکتورها',
  'اسناد حسابداری',
  'گزارش‌ها'
]);

function currentUnit() {
  return window.AVAN_MONEY_DISPLAY_UNIT === UNIT_RIAL
    ? UNIT_RIAL
    : UNIT_TOMAN;
}

function toLatinDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)));
}

function parseInteger(value) {
  const cleaned = toLatinDigits(value)
    .replace(/[٬,\s]/g, '')
    .replace(/[^0-9-]/g, '');

  if (!cleaned || cleaned === '-') return null;

  try {
    return BigInt(cleaned);
  } catch {
    return null;
  }
}

function grouped(value) {
  let n = typeof value === 'bigint'
    ? value
    : parseInteger(value);

  if (n === null) return '';

  const sign = n < 0n ? '-' : '';
  if (n < 0n) n = -n;

  return sign + n
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
}

function isLiveCalculatedNode(node) {
  const parent = node.parentElement;
  if (!parent) return false;

  return Boolean(
    parent.closest('#lineTotals') ||
    parent.closest('#invoiceTotal') ||
    parent.closest('[data-line-amount]')
  );
}

function canonicalFromRendered(amount, renderedLabel, node) {
  const n = parseInteger(amount);
  if (n === null) return null;

  if (renderedLabel === UNIT_LABEL[UNIT_RIAL]) {
    return n % 10n === 0n ? n / 10n : null;
  }

  // During live invoice/journal calculations in Rial mode, app.js may briefly
  // render a Rial-sized number with the legacy Toman suffix before the
  // currency observer relabels it. Treat that number as Rial-sized here.
  if (
    currentUnit() === UNIT_RIAL &&
    renderedLabel === UNIT_LABEL[UNIT_TOMAN] &&
    isLiveCalculatedNode(node)
  ) {
    return n % 10n === 0n ? n / 10n : null;
  }

  return n;
}

function displayFromCanonical(canonical, unit = currentUnit()) {
  if (canonical === null) return null;
  return unit === UNIT_RIAL
    ? canonical * 10n
    : canonical;
}

function shouldSkip(node) {
  const parent = node.parentElement;
  if (!parent) return true;

  return Boolean(parent.closest(
    'script,style,input,textarea,select,option,button,' +
    '.money-in-words,.money-compact,.money-page-unit,' +
    '.currency-settings-card,.toast,.error-box,.success-box,.info-box'
  ));
}

function compactTextNode(node) {
  if (!(node instanceof Text) || shouldSkip(node)) return;

  const text = node.nodeValue || '';
  const matches = [...text.matchAll(MONEY_PATTERN)];
  if (!matches.length) return;

  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const match of matches) {
    const start = match.index ?? 0;
    const whole = match[0];
    const amount = match[1];
    const renderedLabel = match[2];

    if (start > cursor) {
      fragment.append(document.createTextNode(text.slice(cursor, start)));
    }

    const canonical = canonicalFromRendered(amount, renderedLabel, node);

    if (canonical === null) {
      fragment.append(document.createTextNode(whole));
    } else {
      const span = document.createElement('span');
      span.className = 'money-compact';
      span.dataset.moneyCanonical = canonical.toString();

      const display = displayFromCanonical(canonical);
      span.textContent = grouped(display);
      fragment.append(span);
    }

    cursor = start + whole.length;
  }

  if (cursor < text.length) {
    fragment.append(document.createTextNode(text.slice(cursor)));
  }

  node.replaceWith(fragment);
}

function compactRoot(root = document) {
  if (root instanceof Text) {
    compactTextNode(root);
    return;
  }

  if (!root?.querySelectorAll && root !== document) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (shouldSkip(node)) return NodeFilter.FILTER_REJECT;
        MONEY_PATTERN.lastIndex = 0;
        return MONEY_PATTERN.test(node.nodeValue || '')
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(compactTextNode);
}

function refreshCompactAmounts(unit = currentUnit()) {
  document.querySelectorAll('.money-compact[data-money-canonical]')
    .forEach(element => {
      let canonical;
      try {
        canonical = BigInt(element.dataset.moneyCanonical);
      } catch {
        return;
      }

      element.textContent = grouped(displayFromCanonical(canonical, unit));
    });
}

function ensureUnitBadge() {
  const title = document.getElementById('pageTitle');
  if (!title) return;

  const titleText = title.textContent?.trim() || '';
  const host = title.parentElement;
  if (!host) return;

  let badge = host.querySelector('.money-page-unit');

  if (!FINANCIAL_PAGES.has(titleText)) {
    badge?.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'money-page-unit';
    title.insertAdjacentElement('afterend', badge);
  }

  badge.textContent = `واحد: ${UNIT_LABEL[currentUnit()]}`;
}

function installObserver() {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (
          node.nodeType === Node.ELEMENT_NODE ||
          node.nodeType === Node.TEXT_NODE
        ) {
          compactRoot(node);
        }
      });
    }

    ensureUnitBadge();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function install() {
  compactRoot(document);
  ensureUnitBadge();
  installObserver();

  document.addEventListener('avan:money-unit-changed', event => {
    const unit = event.detail?.unit === UNIT_RIAL
      ? UNIT_RIAL
      : UNIT_TOMAN;

    refreshCompactAmounts(unit);
    ensureUnitBadge();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
