'use strict';

import { closeModal } from './src/ui/components/modal.js';
import { toast, showError } from './src/ui/feedback/toast.js';
import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const C = installAvanCloud();
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
let saveBusy = false;

function toLatin(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, d => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d)));
}

function rawDecimal(value) {
  let s = toLatin(value).trim().replace(/[٬,\s]/g, '').replace(/٫/g, '.');
  const first = s.indexOf('.');
  if (first >= 0) s = s.slice(0, first + 1) + s.slice(first + 1).replace(/\./g, '');
  return s;
}

function parseDecimal(value, maxDecimals = 6) {
  const s = rawDecimal(value);
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${maxDecimals}})?$`).test(s)) return null;
  return s;
}

function groupedDecimal(value, maxDecimals = 6) {
  const s = rawDecimal(value).replace(/[^\d.]/g, '');
  if (!s) return '';
  const hadDot = s.includes('.');
  const [rawInt = '', rawFrac = ''] = s.split('.');
  const intPart = (rawInt || '0').replace(/^0+(?=\d)/, '') || '0';
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const frac = rawFrac.slice(0, Math.max(0, maxDecimals));
  return hadDot && maxDecimals > 0 ? `${grouped}٫${frac}` : grouped;
}

function qtyDecimals(input) {
  const n = Number(input?.dataset?.rc14Decimals ?? 6);
  return Number.isFinite(n) ? Math.max(0, Math.min(6, n)) : 6;
}

function formatInput(input) {
  if (!(input instanceof HTMLInputElement) || !input.closest('#eDocForm')) return;
  if (input.name === 'qty') input.value = groupedDecimal(input.value, qtyDecimals(input));
  if (input.name === 'cost') input.value = groupedDecimal(input.value, 6);
}

async function masterData() {
  const state = await C.companyContext.ensure();
  const company = state?.active_company;
  if (!company?.id) throw new Error('COMPANY_REQUIRED');
  const wid = company.id;
  const [items, units] = await Promise.all([
    C.select('inventory_items', `select=id,base_unit_id,item_type,is_active&workspace_id=eq.${wid}`),
    C.select('inventory_units', `select=id,decimal_places,is_active&workspace_id=eq.${wid}`)
  ]);
  return { company, items: items || [], units: units || [] };
}

async function saveInventoryDraft(form, button) {
  if (!form || saveBusy) return;
  saveBusy = true;
  const oldText = button?.textContent || 'ذخیره پیش‌نویس';
  if (button) {
    button.disabled = true;
    button.textContent = 'در حال ذخیره…';
  }

  try {
    const d = await masterData();
    const type = form.elements.type?.value;
    const rows = [];
    const lineEls = [...form.querySelectorAll('[data-e-line]')];

    if (!lineEls.length) throw new Error('حداقل یک ردیف لازم است');

    for (const [i, row] of lineEls.entries()) {
      const itemId = row.querySelector('[name="item"]')?.value || '';
      const item = d.items.find(x => x.id === itemId);
      const unit = d.units.find(x => x.id === item?.base_unit_id);
      const decimals = Number(unit?.decimal_places ?? 6);
      const qty = parseDecimal(row.querySelector('[name="qty"]')?.value, decimals);
      const dir = row.querySelector('[name="dir"]')?.value || 'in';
      let from = row.querySelector('[name="from"]')?.value || null;
      let to = row.querySelector('[name="to"]')?.value || null;

      if (!item || item.item_type !== 'inventory') throw new Error(`کالای ردیف ${i + 1} معتبر نیست`);
      if (!qty || Number(qty) <= 0) throw new Error(`مقدار ردیف ${i + 1} معتبر نیست`);

      if (['receipt', 'opening'].includes(type)) {
        from = null;
        if (!to) throw new Error('انبار مقصد را انتخاب کنید');
      }
      if (type === 'issue') {
        to = null;
        if (!from) throw new Error('انبار مبدأ را انتخاب کنید');
      }
      if (type === 'transfer' && (!from || !to || from === to)) {
        throw new Error('مبدأ و مقصد انتقال معتبر نیست');
      }
      if (type === 'adjustment') {
        if (dir === 'in') {
          from = null;
          if (!to) throw new Error('انبار تعدیل را انتخاب کنید');
        } else {
          to = null;
          if (!from) throw new Error('انبار تعدیل را انتخاب کنید');
        }
      }

      const needsCost = ['receipt', 'opening'].includes(type) || (type === 'adjustment' && dir === 'in');
      const cost = parseDecimal(row.querySelector('[name="cost"]')?.value || '0', 6);
      if (cost === null || (needsCost && Number(cost) <= 0)) {
        throw new Error(`بهای واحد ردیف ${i + 1} معتبر نیست`);
      }

      rows.push({
        item_id: item.id,
        from_warehouse_id: from,
        to_warehouse_id: to,
        quantity: qty,
        unit_cost: cost,
        description: row.querySelector('[name="desc"]')?.value.trim() || null
      });
    }

    await C.rpc('save_inventory_draft', {
      p_workspace_id: d.company.id,
      p_fiscal_year_id: form.elements.fy?.value,
      p_document_id: null,
      p_document_type: type,
      p_document_date: form.elements.date?.value,
      p_description: form.elements.description?.value.trim() || null,
      p_lines: rows
    });

    closeModal();
    toast('پیش‌نویس سند انبار ذخیره شد');

    // No full-page reload. Re-render only the Inventory Documents panel.
    const documentsTab = document.querySelector('[data-e-tab="documents"]');
    if (documentsTab) {
      queueMicrotask(() => documentsTab.click());
    }
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (/معتبر نیست|انتخاب کنید|حداقل یک ردیف/.test(msg)) toast(msg);
    else showError(err, 'inventory draft save v3');
  } finally {
    saveBusy = false;
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = oldText;
    }
  }
}

function install() {
  // Ensure all dynamic quantity/cost fields format consistently while typing.
  document.addEventListener('input', e => {
    if (e.target?.matches?.('#eDocForm [name="qty"], #eDocForm [name="cost"]')) formatInput(e.target);
  }, true);
  document.addEventListener('blur', e => {
    if (e.target?.matches?.('#eDocForm [name="qty"], #eDocForm [name="cost"]')) formatInput(e.target);
  }, true);

  // One deterministic save path. Prevent the legacy form submit handlers from firing.
  document.addEventListener('click', e => {
    const button = e.target.closest?.('#eDocForm button.primary');
    if (!button) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    saveInventoryDraft(button.form || document.getElementById('eDocForm'), button);
  }, true);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target?.closest?.('#eDocForm') || e.target.tagName === 'TEXTAREA') return;
    const form = e.target.closest('#eDocForm');
    e.preventDefault();
    e.stopImmediatePropagation();
    saveInventoryDraft(form, form.querySelector('.form-actions button.primary'));
  }, true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
