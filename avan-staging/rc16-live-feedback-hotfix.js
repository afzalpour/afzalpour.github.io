'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from './src/ui/money/money-runtime.js';
import { displayDecimalToCanonicalTenth, latinDigits } from './src/core/money/canonical-money.js';
import { toast } from './src/ui/feedback/toast.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const C = HAS_BROWSER ? installAvanCloud() : null;
const ESC = '\u001b';

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

function normalizeFa(value) {
  return String(value ?? '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function headerKey(value) {
  return normalizeFa(value)
    .replace(/[()（）]/g, ' ')
    .replace(/\b(?:ریال|تومان)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeDate(value) {
  const raw = latinDigits(value).trim().replace(/[.-]/g, '/');
  return /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(raw);
}

function findEscHeader(lines) {
  const limit = Math.min(lines.length, 80);
  for (let index = 0; index < limit; index += 1) {
    if (!String(lines[index]).includes(ESC)) continue;
    const keys = String(lines[index]).split(ESC).map(headerKey);
    const hasDate = keys.some(key => key === 'تاریخ' || key.includes('تاریخ'));
    const hasDescription = keys.some(key => key === 'شرح' || key.includes('توضیحات'));
    const hasCredit = keys.some(key => key.includes('واریز') || key === 'بستانکار');
    const hasDebit = keys.some(key => key.includes('برداشت') || key === 'بدهکار');
    if (hasDate && hasDescription && (hasCredit || hasDebit)) return index;
  }
  return -1;
}

export function stripSpreadsheetPreamble(value) {
  const source = String(value ?? '').replace(/^\uFEFF/, '');
  const lines = source.split(/\r?\n/);
  if (lines.length < 2) return source;

  for (let index = 0; index < Math.min(lines.length, 12); index += 1) {
    if (isSeparatorDirective(lines[index])) lines[index] = '';
  }

  const escHeader = findEscHeader(lines);
  if (escHeader >= 0) {
    return lines.slice(escHeader).filter(line => !isSeparatorDirective(line)).join('\n');
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
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    try { return new TextDecoder('utf-16be').decode(bytes.subarray(2)); }
    catch { /* continue */ }
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch {
    try { return new TextDecoder('windows-1256').decode(bytes); }
    catch { return new TextDecoder('utf-8').decode(bytes); }
  }
}

function firstIndex(headers, predicates) {
  return headers.findIndex(value => predicates.some(predicate => predicate(value)));
}

function tsvCell(value) {
  const text = String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
  return text.includes('"') ? text.replace(/"/g, '""') : text;
}

export function normalizeEscBankExport(value) {
  const source = String(value ?? '').replace(/^\uFEFF/, '');
  const lines = source.split(/\r?\n/);
  const headerIndex = findEscHeader(lines);
  if (headerIndex < 0) return null;

  const rawHeaders = String(lines[headerIndex]).split(ESC).map(normalizeFa);
  const keys = rawHeaders.map(headerKey);
  const dateIndex = firstIndex(keys, [key => key === 'تاریخ', key => key.includes('تاریخ')]);
  const descriptionIndex = firstIndex(keys, [key => key === 'شرح', key => key.includes('توضیحات')]);
  const operationIndex = firstIndex(keys, [key => key === 'عملیات', key => key.includes('نوع عملیات')]);
  const creditIndex = firstIndex(keys, [key => key.includes('واریز'), key => key === 'بستانکار']);
  const debitIndex = firstIndex(keys, [key => key.includes('برداشت'), key => key === 'بدهکار']);
  const balanceIndex = firstIndex(keys, [key => key.includes('مانده')]);

  if (dateIndex < 0 || (creditIndex < 0 && debitIndex < 0)) return null;

  const sourceUnit = rawHeaders.some(header => header.includes('ریال'))
    ? 'rial'
    : rawHeaders.some(header => header.includes('تومان')) ? 'toman' : null;

  const output = ['تاریخ\tشرح\tواریز\tبرداشت\tمانده'];
  let rowCount = 0;
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    if (!String(lines[index]).includes(ESC)) continue;
    const cells = String(lines[index]).split(ESC);
    const date = cells[dateIndex]?.trim() || '';
    if (!looksLikeDate(date)) continue;
    const description = cells[descriptionIndex]?.trim() || cells[operationIndex]?.trim() || '';
    const credit = cells[creditIndex]?.trim() || '0';
    const debit = cells[debitIndex]?.trim() || '0';
    const balance = cells[balanceIndex]?.trim() || '';
    output.push([date, description, credit, debit, balance].map(tsvCell).join('\t'));
    rowCount += 1;
  }

  return Object.freeze({
    text: output.join('\n'),
    sourceUnit,
    rowCount,
    mapping: Object.freeze({ date: 'تاریخ', description: 'شرح', credit: 'واریز', debit: 'برداشت', balance: 'مانده' })
  });
}

export function prepareCsvImportFromBytes(buffer) {
  const decoded = decodeCsvBytes(buffer);
  const esc = normalizeEscBankExport(decoded);
  if (esc) return esc;
  return Object.freeze({ text: stripSpreadsheetPreamble(decoded), sourceUnit: null, rowCount: null, mapping: null });
}

export function prepareCsvTextFromBytes(buffer) {
  return prepareCsvImportFromBytes(buffer).text;
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
  const raw = latinDigits(value).trim().replace(/[٬,\s]/g, '');
  return /^\d+$/.test(raw) ? raw : null;
}

export function rialLegacyValidationProxyValue(value) {
  const raw = normalizeIntegerMoney(value);
  if (raw === null) return null;
  const amount = BigInt(raw);
  return amount % 10n === 0n ? raw : (amount * 10n).toString();
}

export function exactRialCanonicalValue(value) {
  const parsed = displayDecimalToCanonicalTenth(String(value ?? ''), 'rial');
  return parsed.ok ? parsed.value : null;
}

function applyDetectedSourceUnit(sourceUnit) {
  if (!HAS_BROWSER || !sourceUnit) return;
  const select = document.getElementById('avanBankSourceUnit');
  if (!select || select.value === sourceUnit) return;
  select.value = sourceUnit;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function installCsvFileCompatibility() {
  const FileCtor = globalThis.File;
  if (!FileCtor?.prototype || FileCtor.prototype.__avanCsvCompatibilityV2Installed) return;
  const priorText = FileCtor.prototype.text;
  Object.defineProperty(FileCtor.prototype, '__avanCsvCompatibilityV2Installed', { value: true, configurable: true });
  Object.defineProperty(FileCtor.prototype, 'text', {
    configurable: true,
    writable: true,
    value: async function avanCompatibleFileTextV2() {
      const name = String(this?.name || '').toLowerCase();
      if (!name.endsWith('.csv')) {
        if (typeof priorText === 'function') return priorText.call(this);
        return new TextDecoder('utf-8').decode(await this.arrayBuffer());
      }
      const prepared = prepareCsvImportFromBytes(await this.arrayBuffer());
      applyDetectedSourceUnit(prepared.sourceUnit);
      return prepared.text;
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
    .avan-bank-file-picker button{min-width:170px}.avan-bank-file-name{font-size:.82rem;color:var(--muted,#6b7280);overflow-wrap:anywhere}
    .avan-bank-detected-mapping{margin-top:10px;line-height:1.9}.avan-bank-detected-mapping b{display:block;margin-bottom:3px}
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
  input.addEventListener('change', () => { fileName.textContent = input.files?.[0]?.name || 'فایلی انتخاب نشده است'; });
  wrapper.append(button, fileName);
  input.insertAdjacentElement('afterend', wrapper);
}

function enhanceBankMappingExplanation(root) {
  const map = root.querySelector('.avan-bank-preview-map');
  if (!map || root.querySelector('.avan-bank-detected-mapping')) return;
  const pairs = [...map.querySelectorAll('[data-bank-map]')]
    .map(select => {
      const label = select.closest('.field')?.querySelector('label')?.textContent?.replace('*', '').trim();
      const selected = select.selectedOptions?.[0]?.textContent?.trim();
      return label && select.value ? `${label} ← ${selected}` : null;
    })
    .filter(Boolean);
  const box = document.createElement('div');
  box.className = 'info-box avan-bank-detected-mapping';
  box.innerHTML = `<b>تشخیص آوان از ستون‌های فایل</b>${pairs.length ? pairs.join(' · ') : 'ستون‌های اصلی را از فهرست‌های بالا مشخص کنید.'}<br><span class="muted">جدول پایین فقط نمونه چند ردیف اول برای کنترل شماست؛ هنگام ثبت، همه ردیف‌های معتبر فایل بررسی می‌شوند.</span>`;
  map.insertAdjacentElement('afterend', box);
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
  const input = root.querySelector('#avanBankCsvFile');
  installPersianFilePicker(input);
  enhanceBankMappingExplanation(root);
}

function restoreNativeTaxProfileSelects() {
  document.querySelectorAll('#invoiceForm [data-rc15-tax-profile]').forEach(select => {
    if (select.dataset.avanNativeTaxPicker === '1') return;
    const clone = select.cloneNode(true);
    clone.value = select.value;
    clone.disabled = false;
    clone.dataset.avanTaxPickerStable = '1';
    clone.dataset.avanNativeTaxPicker = '1';
    clone.removeAttribute('aria-disabled');
    clone.addEventListener('change', () => {
      document.dispatchEvent(new CustomEvent('avan:invoice-tax-metadata-changed'));
    });
    select.replaceWith(clone);
  });
}

async function ensureTaxWorkspace() {
  const form = document.getElementById('invoiceForm');
  if (!form || form.dataset.avanTaxRefreshAttempted === '1') {
    restoreNativeTaxProfileSelects();
    return;
  }
  form.dataset.avanTaxRefreshAttempted = '1';
  if (!form.querySelector('[data-rc15-invoice-tax-field]') && typeof window.AvanTax?.refresh === 'function') {
    try { await window.AvanTax.refresh(); }
    catch (error) { console.warn('[Avan tax live feedback]', error); }
  }
  restoreNativeTaxProfileSelects();
  if (form.dataset.rc15TaxEnabled === '1') {
    form.querySelectorAll('[data-rc15-invoice-tax-field]').forEach(field => {
      const select = field.querySelector('[data-rc15-tax-profile]');
      if (!select || [...select.options].filter(option => option.value).length) return;
      if (field.querySelector('[data-avan-tax-empty]')) return;
      const note = document.createElement('small');
      note.dataset.avanTaxEmpty = '1';
      note.className = 'neg';
      note.textContent = 'برای این شرکت وضعیت مالیاتی فعالی تعریف نشده است.';
      field.append(note);
    });
  }
}

function operationFormAmountInput(form) {
  if (!(form instanceof HTMLFormElement) || form.id === 'invoiceForm') return null;
  const input = form.querySelector('input[name="amount"]');
  if (!input) return null;
  const title = form.closest('#modal')?.querySelector('h2')?.textContent?.trim() || '';
  return /دریافت|پرداخت|انتقال|مانده افتتاحیه/.test(title) ? input : null;
}

function installOperationRialCompatibility() {
  if (!C || C.operations.has('rpc', 'operation.exact-rial-live-feedback')) return;

  C.operations.use('rpc', 'operation.exact-rial-live-feedback', ({ args, next }) => {
    const [name, payload = {}] = args;
    if (name !== 'post_financial_operation' || MoneyRuntime?.unit?.() !== 'rial') return next(name, payload);
    const input = document.querySelector('#modal input[name="amount"][data-avan-exact-rial-operation-value]');
    const exact = exactRialCanonicalValue(input?.dataset?.avanExactRialOperationValue || '');
    if (exact === null) return next(name, payload);
    return next(name, { ...payload, p_amount: exact });
  }, { priority: 140 });

  document.addEventListener('submit', event => {
    if (MoneyRuntime?.unit?.() !== 'rial') return;
    const form = event.target;
    const input = operationFormAmountInput(form);
    if (!input) return;
    const raw = String(input.value || '').trim();
    const exact = exactRialCanonicalValue(raw);
    if (exact === null) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast('مبلغ ریالی باید به عدد صحیح ریال وارد شود؛ مبلغ کمتر از یک ریال مجاز نیست.');
      return;
    }
    const proxy = rialLegacyValidationProxyValue(raw);
    const normalized = normalizeIntegerMoney(raw);
    if (!proxy || proxy === normalized) return;
    input.dataset.avanExactRialOperationValue = raw;
    input.value = proxy;
    window.setTimeout(() => {
      if (input.dataset.avanExactRialOperationValue) input.value = input.dataset.avanExactRialOperationValue;
      delete input.dataset.avanExactRialOperationValue;
    }, 0);
  }, true);
}

function usedInvoiceRows(form) {
  return [...form.querySelectorAll('[data-invoice-line]')].filter(row => Boolean(
    row.querySelector('[name="account"]')?.value || row.querySelector('[name="description"]')?.value?.trim() || row.querySelector('[name="unit_price"]')?.value?.trim()
  ));
}

function proxyExactRialInputs(form) {
  const changed = [];
  for (const row of usedInvoiceRows(form)) {
    for (const name of ['unit_price', 'discount']) {
      const input = row.querySelector(`[name="${name}"]`);
      if (!input || !String(input.value || '').trim()) continue;
      const exact = exactRialCanonicalValue(input.value);
      if (exact === null) continue;
      const proxy = rialLegacyValidationProxyValue(input.value);
      const raw = normalizeIntegerMoney(input.value);
      if (!proxy || raw === proxy) continue;
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
  C.operations.use('rpc', 'invoice.exact-rial-live-feedback', ({ args, next }) => {
    const [name, payload = {}] = args;
    if (name !== 'save_draft_invoice' || !Array.isArray(payload.p_lines)) return next(name, payload);
    const form = document.getElementById('invoiceForm');
    if (!form || MoneyRuntime?.unit?.() !== 'rial') return next(name, payload);
    const rows = usedInvoiceRows(form);
    return next(name, {
      ...payload,
      p_lines: payload.p_lines.map((line, index) => {
        const row = rows[index];
        if (!row) return line;
        const price = row.querySelector('[name="unit_price"]');
        const discount = row.querySelector('[name="discount"]');
        return { ...line, unit_price: price?.dataset?.avanExactRialValue || line.unit_price, discount: discount?.dataset?.avanExactRialValue || line.discount };
      })
    });
  }, { priority: 140 });

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'invoiceForm' || MoneyRuntime?.unit?.() !== 'rial') return;
    for (const row of usedInvoiceRows(form)) {
      for (const name of ['unit_price', 'discount']) {
        const input = row.querySelector(`[name="${name}"]`);
        if (!input || !String(input.value || '').trim()) continue;
        if (exactRialCanonicalValue(input.value) !== null) continue;
        event.preventDefault();
        event.stopImmediatePropagation();
        toast(name === 'unit_price'
          ? 'فی ریالی باید به عدد صحیح ریال وارد شود؛ مبلغ کمتر از یک ریال مجاز نیست.'
          : 'تخفیف ریالی باید به عدد صحیح ریال وارد شود؛ مبلغ کمتر از یک ریال مجاز نیست.');
        return;
      }
    }
    const changed = proxyExactRialInputs(form);
    if (changed.length) window.setTimeout(() => restoreExactRialInputs(changed), 0);
  }, true);
}

function applyUiFixes() {
  installStyle();
  localizeBankWorkspace();
  void ensureTaxWorkspace();
}

function installUiObserver() {
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; applyUiFixes(); });
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
  installOperationRialCompatibility();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installUiObserver, { once: true });
  else installUiObserver();
}
