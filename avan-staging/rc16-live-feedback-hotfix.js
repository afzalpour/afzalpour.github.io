'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from './src/ui/money/money-runtime.js';
import { displayDecimalToCanonicalTenth, latinDigits } from './src/core/money/canonical-money.js';
import { toast } from './src/ui/feedback/toast.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const C = HAS_BROWSER ? installAvanCloud() : null;

function delimiterCount(line, delimiter) {
  let count = 0;
  let quoted = false;
  const text = String(line ?? '');
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '"') {
      if (quoted && text[index + 1] === '"') { index += 1; continue; }
      quoted = !quoted;
      continue;
    }
    if (!quoted && ch === delimiter) count += 1;
  }
  return count;
}

function isSeparatorDirective(line) {
  return /^\s*sep\s*=\s*[,;\t]\s*$/i.test(String(line ?? ''));
}

export function stripSpreadsheetPreamble(value) {
  const source = String(value ?? '').replace(/^\uFEFF/, '');
  const lines = source.split(/\r?\n/);
  if (lines.length < 2) return source;

  // Excel may write a separator directive before the real table. It is metadata,
  // not a bank-statement row, so remove it wherever it appears in the preamble.
  for (let index = 0; index < Math.min(lines.length, 12); index += 1) {
    if (isSeparatorDirective(lines[index])) lines[index] = '';
  }

  const delimiters = [',', ';', '\t'];
  let best = null;
  const scanLimit = Math.min(lines.length, 60);

  for (let index = 0; index < scanLimit; index += 1) {
    if (!String(lines[index]).trim()) continue;
    for (const delimiter of delimiters) {
      const width = delimiterCount(lines[index], delimiter);
      if (width < 1) continue;

      let sameWidth = 0;
      let tabular = 0;
      let checked = 0;
      for (let next = index + 1; next < lines.length && checked < 8; next += 1) {
        if (!String(lines[next]).trim() || isSeparatorDirective(lines[next])) continue;
        checked += 1;
        const nextWidth = delimiterCount(lines[next], delimiter);
        if (nextWidth === width) sameWidth += 1;
        if (nextWidth > 0) tabular += 1;
      }
      if (sameWidth < 1) continue;

      const score = sameWidth * 1000 + tabular * 100 + width * 10 - index;
      if (!best || score > best.score) best = { index, score };
    }
  }

  if (!best || best.index <= 0) return lines.filter(line => !isSeparatorDirective(line)).join('\n');
  return lines.slice(best.index).filter(line => !isSeparatorDirective(line)).join('\n');
}

export function decodeCsvBytes(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || 0);
  if (!bytes.length) return '';

  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    try { return new TextDecoder('utf-16be').decode(bytes.subarray(2)); }
    catch { /* fall through */ }
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Excel's legacy CSV / MS-DOS choices on Persian Windows commonly produce
    // a non-UTF-8 byte stream. windows-1256 is the safest browser-supported
    // Persian fallback; structural parsing still remains delimiter-based.
    try { return new TextDecoder('windows-1256').decode(bytes); }
    catch { return new TextDecoder('utf-8').decode(bytes); }
  }
}

export function prepareCsvTextFromBytes(buffer) {
  return stripSpreadsheetPreamble(decodeCsvBytes(buffer));
}

export function localizeBankText(value) {
  return String(value ?? '')
    .replace(/\bMatch\b/g, 'تطبیق')
    .replace(/\bImportها\b/g, 'ورودی‌ها')
    .replace(/\bImport\b/g, 'ورود')
    .replace(/\bCanonical\b/g, 'استاندارد داخلی')
    .replace(/\bTab\b/g, 'تب')
    .replace(/\bCSV\b/g, 'صورت‌حساب');
}

function normalizeIntegerMoney(value) {
  const raw = latinDigits(value)
    .trim()
    .replace(/[٬,\s]/g, '');
  return /^\d+$/.test(raw) ? raw : null;
}

export function rialLegacyValidationProxyValue(value) {
  const raw = normalizeIntegerMoney(value);
  if (raw === null) return null;
  const amount = BigInt(raw);
  if (amount % 10n === 0n) return raw;
  return (amount * 10n).toString();
}

function installCsvFileCompatibility() {
  const FileCtor = globalThis.File;
  if (!FileCtor?.prototype || FileCtor.prototype.__avanCsvCompatibilityInstalled) return;
  const nativeText = FileCtor.prototype.text;

  Object.defineProperty(FileCtor.prototype, '__avanCsvCompatibilityInstalled', {
    value: true,
    configurable: true
  });

  Object.defineProperty(FileCtor.prototype, 'text', {
    configurable: true,
    writable: true,
    value: async function avanCompatibleFileText() {
      const name = String(this?.name || '').toLowerCase();
      if (!name.endsWith('.csv')) {
        if (typeof nativeText === 'function') return nativeText.call(this);
        return new TextDecoder('utf-8').decode(await this.arrayBuffer());
      }
      return prepareCsvTextFromBytes(await this.arrayBuffer());
    }
  });
}

function installStyle() {
  if (document.getElementById('avanRc16LiveFeedbackStyle')) return;
  const style = document.createElement('style');
  style.id = 'avanRc16LiveFeedbackStyle';
  style.textContent = `
    #avanBankCsvFile[data-avan-custom-file="1"]{position:absolute!important;inline-size:1px!important;block-size:1px!important;opacity:0!important;pointer-events:none!important}
    .avan-bank-file-picker{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .avan-bank-file-picker button{min-width:170px}
    .avan-bank-file-name{font-size:.82rem;color:var(--muted,#6b7280);overflow-wrap:anywhere}
    #invoiceForm .rc15-invoice-tax-field{position:relative;z-index:4}
    #invoiceForm .rc15-invoice-tax-field select{position:relative;z-index:5;pointer-events:auto!important;touch-action:manipulation;min-height:40px}
  `;
  document.head.append(style);
}

function installPersianFilePicker(input) {
  if (!input || input.dataset.avanCustomFile === '1') return;
  input.dataset.avanCustomFile = '1';
  const wrapper = document.createElement('div');
  wrapper.className = 'avan-bank-file-picker';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ghost';
  button.textContent = 'انتخاب فایل صورت‌حساب';
  const fileName = document.createElement('span');
  fileName.className = 'avan-bank-file-name';
  fileName.textContent = 'فایلی انتخاب نشده است';
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    fileName.textContent = input.files?.[0]?.name || 'فایلی انتخاب نشده است';
  });
  wrapper.append(button, fileName);
  input.insertAdjacentElement('afterend', wrapper);
}

function localizeBankWorkspace() {
  const root = document.querySelector('[data-avan-bank-workspace]');
  if (!root) return;

  const warning = root.querySelector('.avan-bank-warning');
  if (warning?.textContent.includes('Match')) {
    warning.innerHTML = '<b>این بخش فقط پیشنهاد تطبیق ارائه می‌کند و هیچ سند حسابداری به‌صورت خودکار ثبت نمی‌شود.</b><br>حتی امتیاز ۱۰۰ نیز فقط یک پیشنهاد است؛ تا زمانی که شما «تأیید تطبیق» را انتخاب نکنید، هیچ تطبیقی ثبت نخواهد شد.';
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const next = localizeBankText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  root.querySelectorAll('h3').forEach(heading => {
    if (heading.textContent.trim() === 'ورود صورت‌حساب صورت‌حساب') heading.textContent = 'ورود صورت‌حساب بانکی';
  });
  root.querySelectorAll('.field>label').forEach(label => {
    if (label.textContent.trim() === 'فایل صورت‌حساب') label.textContent = 'فایل صورت‌حساب بانکی';
  });

  const input = root.querySelector('#avanBankCsvFile');
  installPersianFilePicker(input);
}

function stabilizeTaxProfileSelects() {
  document.querySelectorAll('#invoiceForm [data-rc15-tax-profile]').forEach(select => {
    if (select.dataset.avanTaxPickerStable === '1') return;
    select.dataset.avanTaxPickerStable = '1';
    select.disabled = false;
    select.addEventListener('pointerdown', event => {
      if (typeof select.showPicker !== 'function') return;
      try {
        select.showPicker();
        event.preventDefault();
      } catch {
        // Browsers without programmatic picker support keep their native behavior.
      }
    });
  });
}

function usedInvoiceRows(form) {
  return [...form.querySelectorAll('[data-invoice-line]')].filter(row => Boolean(
    row.querySelector('[name="account"]')?.value ||
    row.querySelector('[name="description"]')?.value?.trim() ||
    row.querySelector('[name="unit_price"]')?.value?.trim()
  ));
}

function exactRialError(form) {
  for (const row of usedInvoiceRows(form)) {
    const price = row.querySelector('[name="unit_price"]');
    const discount = row.querySelector('[name="discount"]');
    const priceRaw = String(price?.value || '').trim();
    const discountRaw = String(discount?.value || '0').trim() || '0';
    if (priceRaw) {
      const parsed = displayDecimalToCanonicalTenth(priceRaw, 'rial');
      if (!parsed.ok) return 'فی ریالی باید به عدد صحیح ریال وارد شود؛ مبلغ کمتر از یک ریال مجاز نیست.';
    }
    const discountParsed = displayDecimalToCanonicalTenth(discountRaw, 'rial');
    if (!discountParsed.ok) return 'تخفیف ریالی باید به عدد صحیح ریال وارد شود؛ مبلغ کمتر از یک ریال مجاز نیست.';
  }
  return '';
}

function proxyExactRialInputs(form) {
  const changed = [];
  for (const row of usedInvoiceRows(form)) {
    for (const name of ['unit_price', 'discount']) {
      const input = row.querySelector(`[name="${name}"]`);
      if (!input || !String(input.value || '').trim()) continue;
      const proxy = rialLegacyValidationProxyValue(input.value);
      if (proxy === null) continue;
      const raw = normalizeIntegerMoney(input.value);
      if (raw === proxy) continue;
      input.dataset.avanExactRialValue = String(input.value);
      changed.push(input);
      input.value = proxy;
    }
  }
  return changed;
}

function restoreExactRialInputs(inputs) {
  for (const input of inputs) {
    if (!input?.dataset?.avanExactRialValue) continue;
    input.value = input.dataset.avanExactRialValue;
    delete input.dataset.avanExactRialValue;
  }
}

function installInvoiceRialCompatibility() {
  if (!C || C.operations.has('rpc', 'invoice.exact-rial-live-feedback')) return;

  // app.js still performs a legacy integer-Toman preflight before the modern
  // invoice money owner runs. This middleware restores the exact display Rial
  // values after that legacy preflight and before canonical one-Rial conversion.
  C.operations.use('rpc', 'invoice.exact-rial-live-feedback', ({ args, next }) => {
    const [name, payload = {}] = args;
    if (name !== 'save_draft_invoice' || !Array.isArray(payload.p_lines)) return next(name, payload);
    const form = document.getElementById('invoiceForm');
    if (!form || MoneyRuntime?.unit?.() !== 'rial') return next(name, payload);

    const rows = usedInvoiceRows(form);
    const restored = {
      ...payload,
      p_lines: payload.p_lines.map((line, index) => {
        const row = rows[index];
        if (!row) return line;
        const price = row.querySelector('[name="unit_price"]');
        const discount = row.querySelector('[name="discount"]');
        return {
          ...line,
          unit_price: price?.dataset?.avanExactRialValue || line.unit_price,
          discount: discount?.dataset?.avanExactRialValue || line.discount
        };
      })
    };
    return next(name, restored);
  }, { priority: 140 });

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'invoiceForm' || MoneyRuntime?.unit?.() !== 'rial') return;

    const error = exactRialError(form);
    if (error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast(error);
      return;
    }

    const changed = proxyExactRialInputs(form);
    if (!changed.length) return;
    window.setTimeout(() => restoreExactRialInputs(changed), 0);
  }, true);
}

function applyUiFixes() {
  installStyle();
  localizeBankWorkspace();
  stabilizeTaxProfileSelects();
}

function installUiObserver() {
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      applyUiFixes();
    });
  };
  const content = document.getElementById('content');
  const modal = document.getElementById('modal');
  const observer = new MutationObserver(schedule);
  if (content) observer.observe(content, { childList: true, subtree: true });
  if (modal) observer.observe(modal, { childList: true, subtree: true });
  document.addEventListener('avan:ui-changed', schedule);
  window.addEventListener('avan:page-rendered', schedule);
  schedule();
}

if (HAS_BROWSER) {
  installCsvFileCompatibility();
  installInvoiceRialCompatibility();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installUiObserver, { once: true });
  } else {
    installUiObserver();
  }
}
