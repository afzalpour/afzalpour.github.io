'use strict';

import { closeModal } from './src/ui/components/modal.js';
import { toast, showError } from './src/ui/feedback/toast.js';
import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const C = installAvanCloud();
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
let docMeta = null;
let enhanceBusy = false;

function toLatin(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, d => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d)));
}

function decimalRaw(value) {
  let s = toLatin(value).trim().replace(/[٬,\s]/g, '').replace(/,/g, '').replace(/٫/g, '.');
  const first = s.indexOf('.');
  if (first >= 0) s = s.slice(0, first + 1) + s.slice(first + 1).replace(/\./g, '');
  return s;
}

function parseDecimal(value, maxDecimals = 6) {
  const s = decimalRaw(value);
  const n = Math.max(0, Math.min(6, Number(maxDecimals) || 0));
  if (n === 0) return /^\d+$/.test(s) ? s : null;
  return new RegExp(`^\\d+(?:\\.\\d{1,${n}})?$`).test(s) ? s : null;
}

function groupedDecimal(value, maxDecimals = 6) {
  const n = Math.max(0, Math.min(6, Number(maxDecimals) || 0));
  const s = decimalRaw(value).replace(/[^\d.]/g, '');
  if (!s) return '';
  const hadDot = s.includes('.');
  const [rawInt = '', rawFrac = ''] = s.split('.');
  const intPart = (rawInt || '0').replace(/^0+(?=\d)/, '') || '0';
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  if (!n || !hadDot) return grouped;
  return `${grouped}٫${rawFrac.slice(0, n)}`;
}

async function loadMeta() {
  const state = await C.companyContext.ensure();
  const company = state?.active_company;
  if (!company?.id) throw new Error('COMPANY_REQUIRED');
  if (docMeta?.workspaceId === company.id) return docMeta;
  const wid = company.id;
  const [items, units, groups] = await Promise.all([
    C.select('inventory_items', `select=id,sku,name,base_unit_id,group_id,variant_label&workspace_id=eq.${wid}&is_active=eq.true&item_type=eq.inventory`),
    C.select('inventory_units', `select=id,name,decimal_places&workspace_id=eq.${wid}&is_active=eq.true`),
    C.select('inventory_item_groups', `select=id,name,parent_group_id&workspace_id=eq.${wid}&is_active=eq.true`)
  ]);
  docMeta = { workspaceId: wid, items: items || [], units: units || [], groups: groups || [] };
  return docMeta;
}

function itemLabel(item, meta) {
  const byGroup = new Map(meta.groups.map(g => [g.id, g]));
  const g = byGroup.get(item.group_id);
  const parent = g?.parent_group_id ? byGroup.get(g.parent_group_id) : null;
  const path = [parent?.name, g?.name].filter(Boolean).join(' › ');
  const variant = String(item.variant_label || '').trim();
  return `${path ? `${path} › ` : ''}${item.name}${variant ? ` · ${variant}` : ''} [${item.sku}]`;
}

function claim(form) {
  if (!form) return;
  form.dataset.rc14lEnhanced = '1';
  form.dataset.rc14Stable = '1';
}

function wireNumber(input, decimals) {
  if (!input) return;
  const n = Math.max(0, Math.min(6, Number(decimals) || 0));
  input.dataset.rc14Decimals = String(n);
  input.classList.add('rc14l-number-input');
  input.inputMode = 'decimal';
  const format = () => { input.value = groupedDecimal(input.value, Number(input.dataset.rc14Decimals ?? n)); };
  if (input.dataset.rc14StableListeners !== '1') {
    input.dataset.rc14StableListeners = '1';
    input.addEventListener('input', format);
    input.addEventListener('blur', format);
    input.addEventListener('change', format);
  }
  format();
}

async function enhanceForm(form = document.getElementById('eDocForm')) {
  if (!form) return;
  claim(form);
  if (enhanceBusy) return;
  enhanceBusy = true;
  try {
    const meta = await loadMeta();
    if (!form.isConnected) return;
    for (const row of form.querySelectorAll('[data-e-line]')) {
      const itemSelect = row.querySelector('[name="item"]');
      const qty = row.querySelector('[name="qty"]');
      const cost = row.querySelector('[name="cost"]');
      if (!itemSelect) continue;

      for (const opt of itemSelect.options) {
        if (!opt.value) continue;
        const item = meta.items.find(i => i.id === opt.value);
        if (!item) continue;
        const label = itemLabel(item, meta);
        if (opt.textContent !== label) opt.textContent = label;
      }

      const applyUnit = () => {
        const item = meta.items.find(i => i.id === itemSelect.value);
        const unit = meta.units.find(u => u.id === item?.base_unit_id);
        const decimals = Number(unit?.decimal_places ?? 6);
        wireNumber(qty, decimals);
        let help = qty?.parentElement?.querySelector('.rc14l-qty-help');
        if (qty && !help) {
          help = document.createElement('small');
          help.className = 'rc14l-field-help rc14l-qty-help';
          qty.insertAdjacentElement('afterend', help);
        }
        if (help) help.textContent = unit ? `${unit.name}: ${decimals ? `تا ${decimals} رقم اعشار` : 'بدون اعشار'}` : '';
      };

      if (itemSelect.dataset.rc14StableUnit !== '1') {
        itemSelect.dataset.rc14StableUnit = '1';
        itemSelect.addEventListener('change', applyUnit);
      }
      wireNumber(cost, 6);
      applyUnit();
    }
  } catch (err) {
    console.warn('inventory stable form enhancer', err);
  } finally {
    enhanceBusy = false;
  }
}

async function saveDraft(e) {
  const form = e.target;
  if (form?.id !== 'eDocForm') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (form.dataset.rc14Saving === '1') return;
  form.dataset.rc14Saving = '1';

  const submit = e.submitter || form.querySelector('button.primary');
  const oldText = submit?.textContent || 'ذخیره پیش‌نویس';
  try {
    claim(form);
    await enhanceForm(form);
    const state = await C.companyContext.ensure();
    const company = state?.active_company;
    if (!company?.id) throw new Error('COMPANY_REQUIRED');

    const type = form.elements.type?.value;
    const rows = [];
    for (const [idx, row] of [...form.querySelectorAll('[data-e-line]')].entries()) {
      const itemId = row.querySelector('[name="item"]')?.value || '';
      const qtyInput = row.querySelector('[name="qty"]');
      const maxDecimals = Number(qtyInput?.dataset.rc14Decimals ?? 6);
      const qty = parseDecimal(qtyInput?.value, maxDecimals);
      const cost = parseDecimal(row.querySelector('[name="cost"]')?.value || '0', 6);
      const dir = row.querySelector('[name="dir"]')?.value || 'in';
      let from = row.querySelector('[name="from"]')?.value || null;
      let to = row.querySelector('[name="to"]')?.value || null;

      if (!itemId) throw new Error(`کالای ردیف ${idx + 1} را انتخاب کنید`);
      if (!qty || Number(qty) <= 0) throw new Error(`تعداد ردیف ${idx + 1} معتبر نیست`);
      if (cost === null) throw new Error(`بهای ردیف ${idx + 1} معتبر نیست`);
      if (['receipt', 'opening'].includes(type)) { from = null; if (!to) throw new Error('انبار مقصد را انتخاب کنید'); }
      if (type === 'issue') { to = null; if (!from) throw new Error('انبار مبدأ را انتخاب کنید'); }
      if (type === 'transfer' && (!from || !to || from === to)) throw new Error('مبدأ و مقصد انتقال معتبر نیست');
      if (type === 'adjustment') {
        if (dir === 'in') { from = null; if (!to) throw new Error('انبار تعدیل را انتخاب کنید'); }
        else { to = null; if (!from) throw new Error('انبار تعدیل را انتخاب کنید'); }
      }
      const inbound = ['receipt', 'opening'].includes(type) || (type === 'adjustment' && dir === 'in');
      if (inbound && Number(cost) <= 0) throw new Error(`بهای واحد ردیف ${idx + 1} باید بیشتر از صفر باشد`);

      rows.push({
        item_id: itemId,
        from_warehouse_id: from,
        to_warehouse_id: to,
        quantity: qty,
        unit_cost: cost,
        description: row.querySelector('[name="desc"]')?.value.trim() || null
      });
    }

    if (submit) { submit.disabled = true; submit.textContent = 'در حال ذخیره…'; }
    await C.rpc('save_inventory_draft', {
      p_workspace_id: company.id,
      p_fiscal_year_id: form.elements.fy?.value,
      p_document_id: null,
      p_document_type: type,
      p_document_date: form.elements.date?.value,
      p_description: form.elements.description?.value.trim() || null,
      p_lines: rows
    });

    closeModal();
    toast('پیش‌نویس سند انبار ذخیره شد');
    document.querySelector('[data-e-tab="documents"]')?.click();
  } catch (err) {
    const msg = String(err?.message || err || 'خطا در ذخیره سند انبار');
    if (/انتخاب کنید|معتبر نیست|بیشتر از صفر/.test(msg)) toast(msg);
    else showError(err, 'inventory stable draft save');
    if (submit?.isConnected) { submit.disabled = false; submit.textContent = oldText; }
  } finally {
    if (form?.isConnected) delete form.dataset.rc14Saving;
  }
}

function inspectMutations(records) {
  let form = null;
  let needsEnhance = false;
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches?.('#eDocForm')) {
        form = node;
        claim(form);
        needsEnhance = true;
      } else {
        const nested = node.querySelector?.('#eDocForm');
        if (nested) {
          form = nested;
          claim(form);
          needsEnhance = true;
        }
      }
      if (node.matches?.('[data-e-line]') || node.querySelector?.('[data-e-line]')) needsEnhance = true;
    }
  }
  form ||= document.getElementById('eDocForm');
  if (form && needsEnhance) queueMicrotask(() => enhanceForm(form));
}

function installNow() {
  const observer = new MutationObserver(inspectMutations);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('submit', saveDraft, true);
  window.addEventListener('avan:company-context-changed', () => { docMeta = null; });
  const existing = document.getElementById('eDocForm');
  if (existing) { claim(existing); queueMicrotask(() => enhanceForm(existing)); }
}

if (document.body) installNow();
else document.addEventListener('DOMContentLoaded', installNow, { once: true });
