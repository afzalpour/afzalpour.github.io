'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const C = installAvanCloud();
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
let meta = null;
let enhancing = false;

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

function groupedDecimal(value, maxDecimals = 6) {
  const s = decimalRaw(value).replace(/[^\d.]/g, '');
  if (!s) return '';
  const hadDot = s.includes('.');
  const [rawInt = '', rawFrac = ''] = s.split('.');
  const intPart = (rawInt || '0').replace(/^0+(?=\d)/, '') || '0';
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const frac = rawFrac.slice(0, Math.max(0, maxDecimals));
  return hadDot ? `${grouped}${maxDecimals ? `٫${frac}` : ''}` : grouped;
}

function claim(form) {
  if (!form) return;
  // Must be synchronous: the legacy refinement observer checks this flag.
  form.dataset.rc14lEnhanced = '1';
  form.dataset.rc14Stable = '1';
}

async function loadMeta() {
  const state = await C.companyContext.ensure();
  const wid = state?.active_company?.id;
  if (!wid) return null;
  if (meta?.workspaceId === wid) return meta;
  const [items, units] = await Promise.all([
    C.select('inventory_items', `select=id,base_unit_id&workspace_id=eq.${wid}&is_active=eq.true&item_type=eq.inventory`),
    C.select('inventory_units', `select=id,name,decimal_places&workspace_id=eq.${wid}&is_active=eq.true`)
  ]);
  meta = { workspaceId: wid, items: items || [], units: units || [] };
  return meta;
}

function wireNumber(input, decimals) {
  if (!input) return;
  input.dataset.rc14Decimals = String(decimals);
  input.classList.add('rc14l-number-input');
  input.inputMode = 'decimal';
  const format = () => { input.value = groupedDecimal(input.value, Number(input.dataset.rc14Decimals ?? decimals)); };
  if (input.dataset.rc14ClaimNumber !== '1') {
    input.dataset.rc14ClaimNumber = '1';
    input.addEventListener('input', format);
    input.addEventListener('blur', format);
    input.addEventListener('change', format);
  }
  format();
}

async function enhance(form) {
  if (!form || enhancing) return;
  claim(form);
  enhancing = true;
  try {
    const m = await loadMeta();
    if (!m || !form.isConnected) return;
    for (const row of form.querySelectorAll('[data-e-line]')) {
      const itemSelect = row.querySelector('[name="item"]');
      const qty = row.querySelector('[name="qty"]');
      const cost = row.querySelector('[name="cost"]');
      if (!itemSelect) continue;
      const applyUnit = () => {
        const item = m.items.find(i => i.id === itemSelect.value);
        const unit = m.units.find(u => u.id === item?.base_unit_id);
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
      if (itemSelect.dataset.rc14ClaimUnit !== '1') {
        itemSelect.dataset.rc14ClaimUnit = '1';
        itemSelect.addEventListener('change', applyUnit);
      }
      wireNumber(cost, 6);
      applyUnit();
    }
  } catch (err) {
    console.warn('inventory form claim enhancer', err);
  } finally {
    enhancing = false;
  }
}

function inspectAdded(records) {
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
        const nestedForm = node.querySelector?.('#eDocForm');
        if (nestedForm) {
          form = nestedForm;
          claim(form);
          needsEnhance = true;
        }
      }
      if (node.matches?.('[data-e-line]') || node.querySelector?.('[data-e-line]')) needsEnhance = true;
    }
  }
  form ||= document.getElementById('eDocForm');
  if (form && needsEnhance) queueMicrotask(() => enhance(form));
}

function install() {
  const observer = new MutationObserver(inspectAdded);
  observer.observe(document.body, { childList: true, subtree: true });
  const existing = document.getElementById('eDocForm');
  if (existing) { claim(existing); queueMicrotask(() => enhance(existing)); }
  window.addEventListener('avan:company-context-changed', () => { meta = null; });
}

// This module is loaded before the legacy inventory refinement module.
// Register immediately so our MutationObserver is earlier in delivery order.
if (document.body) install();
else document.addEventListener('DOMContentLoaded', install, { once: true });
