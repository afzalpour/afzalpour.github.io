'use strict';

import { openModal, closeModal } from './src/ui/components/modal.js';
import { toast, showError } from './src/ui/feedback/toast.js';
import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';
import { renderInventoryFoundation } from './rc14-inventory-foundation.js';

const C = installAvanCloud();
const MANAGE = new Set(['owner', 'manager', 'accountant']);
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
let editingItemId = null;
let scanBusy = false;

const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));

function toLatin(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, d => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d)));
}

function decimalRaw(value) {
  let s = toLatin(value).trim().replace(/[٬,\s]/g, '').replace(/٫/g, '.');
  const first = s.indexOf('.');
  if (first >= 0) s = s.slice(0, first + 1) + s.slice(first + 1).replace(/\./g, '');
  return s;
}

function parseDecimal(value, maxDecimals = 6) {
  const s = decimalRaw(value);
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${maxDecimals}})?$`).test(s)) return null;
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

async function data() {
  const state = await C.companyContext.ensure();
  const company = state?.active_company;
  if (!company?.id) throw new Error('COMPANY_REQUIRED');
  const wid = company.id;
  const [groups, items, units, role] = await Promise.all([
    C.select('inventory_item_groups', `select=*&workspace_id=eq.${wid}&order=level.asc,name.asc`),
    C.select('inventory_items', `select=*&workspace_id=eq.${wid}&order=is_active.desc,name.asc`),
    C.select('inventory_units', `select=*&workspace_id=eq.${wid}&order=name.asc`),
    C.rpc('workspace_role', { wid })
  ]);
  return { company, groups: groups || [], items: items || [], units: units || [], role };
}

function groupPath(groupId, groups) {
  if (!groupId) return '';
  const byId = new Map(groups.map(g => [g.id, g]));
  const g = byId.get(groupId);
  if (!g) return '';
  if (!g.parent_group_id) return g.name;
  const p = byId.get(g.parent_group_id);
  return p ? `${p.name} › ${g.name}` : g.name;
}

function itemLabel(item, d) {
  const path = groupPath(item.group_id, d.groups);
  const variant = String(item.variant_label || '').trim();
  return `${path ? `${path} › ` : ''}${item.name}${variant ? ` · ${variant}` : ''} [${item.sku}]`;
}

function codeToken(value) {
  return toLatin(value).trim().toUpperCase().replace(/[^A-Z0-9آ-ی]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
}

function suggestSku(d, groupId, variant) {
  const group = d.groups.find(g => g.id === groupId);
  const parts = [codeToken(group?.code || 'K')];
  const v = codeToken(variant);
  if (v) parts.push(v);
  const base = parts.filter(Boolean).join('-') || 'K';
  const used = new Set(d.items.map(i => String(i.sku || '').toUpperCase()));
  for (let n = 1; n < 10000; n += 1) {
    const candidate = `${base}-${String(n).padStart(3, '0')}`;
    if (!used.has(candidate.toUpperCase())) return candidate;
  }
  return `${base}-${Date.now().toString().slice(-6)}`;
}

async function openGroupModal(group = null) {
  try {
    const d = await data();
    const parents = d.groups.filter(g => g.level === 1 && g.is_active && g.id !== group?.id);
    openModal(`<h2>${group ? 'ویرایش گروه / مدل' : 'گروه / مدل جدید'}</h2>
      <form id="rc14GroupForm">
        <div class="form-grid">
          <div class="field"><label>کد گروه / مدل</label><input name="code" required maxlength="40" value="${esc(group?.code || '')}" placeholder="مثلاً SH یا SH-X"></div>
          <div class="field"><label>نام</label><input name="name" required maxlength="160" value="${esc(group?.name || '')}" placeholder="مثلاً کفش مردانه یا مدل X"></div>
          <div class="field"><label>سطح بالاتر</label><select name="parent" ${group ? 'disabled' : ''}><option value="">گروه اصلی</option>${parents.map(p => `<option value="${p.id}" ${p.id === group?.parent_group_id ? 'selected' : ''}>${esc(p.code)} — ${esc(p.name)}</option>`).join('')}</select><small class="rc14l-field-help">خالی = گروه اصلی؛ انتخاب یک گروه = مدل / زیرگروه آن.</small></div>
          <div class="field"><label>وضعیت</label><select name="active"><option value="1" ${group?.is_active === false ? '' : 'selected'}>فعال</option><option value="0" ${group?.is_active === false ? 'selected' : ''}>غیرفعال</option></select></div>
        </div>
        <div class="form-actions"><button type="button" class="ghost" data-cancel>انصراف</button><button class="primary">ذخیره</button></div>
      </form>`);
    document.querySelector('#rc14GroupForm [data-cancel]')?.addEventListener('click', closeModal);
    document.getElementById('rc14GroupForm').onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const payload = {
        workspace_id: d.company.id,
        code: String(fd.get('code') || '').trim(),
        name: String(fd.get('name') || '').trim(),
        is_active: fd.get('active') === '1'
      };
      try {
        if (group) {
          const { workspace_id, ...patch } = payload;
          await C.update('inventory_item_groups', patch, `id=eq.${group.id}&workspace_id=eq.${d.company.id}`);
        } else {
          payload.parent_group_id = String(fd.get('parent') || '') || null;
          await C.insert('inventory_item_groups', payload);
        }
        closeModal();
        toast(group ? 'گروه / مدل ویرایش شد' : 'گروه / مدل ثبت شد');
        await renderInventoryFoundation();
      } catch (err) {
        showError(err, 'inventory group save');
      }
    };
  } catch (err) {
    showError(err, 'inventory group modal');
  }
}

async function ensureGroupCard() {
  const page = document.querySelector('.rc14-inventory-page');
  if (!page) return;
  const panel = page.querySelector('[data-e-panel="masters"]') || page;
  if (panel.querySelector('[data-rc14l-groups]')) return;
  try {
    const d = await data();
    const canManage = MANAGE.has(d.role);
    const byParent = new Map();
    d.groups.forEach(g => {
      const key = g.parent_group_id || 'root';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(g);
    });
    const rows = [];
    for (const g of byParent.get('root') || []) {
      rows.push(`<tr><td><b>${esc(g.code)}</b></td><td>${esc(g.name)}</td><td>گروه اصلی</td><td>${g.is_active ? 'فعال' : 'غیرفعال'}</td><td>${canManage ? `<button class="ghost small" data-edit-group="${g.id}">ویرایش</button>` : '—'}</td></tr>`);
      for (const child of byParent.get(g.id) || []) {
        rows.push(`<tr><td><b>${esc(child.code)}</b></td><td>↳ ${esc(child.name)}</td><td>مدل / زیرگروه</td><td>${child.is_active ? 'فعال' : 'غیرفعال'}</td><td>${canManage ? `<button class="ghost small" data-edit-group="${child.id}">ویرایش</button>` : '—'}</td></tr>`);
      }
    }
    const card = document.createElement('section');
    card.className = 'card rc14-section rc14l-groups-card';
    card.dataset.rc14lGroups = '1';
    card.innerHTML = `<div class="rc14-section-head"><div><h3>ساختار کالا</h3><p class="muted">گروه اصلی → مدل / زیرگروه → کالای واقعی (SKU). موجودی فقط روی SKU واقعی ثبت می‌شود.</p></div>${canManage ? '<button class="ghost" type="button" data-new-group>＋ گروه / مدل</button>' : ''}</div>
      <div class="table-wrap"><table><thead><tr><th>کد</th><th>نام</th><th>سطح</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>${rows.join('') || '<tr><td colspan="5"><div class="empty-state">هنوز گروه یا مدلی تعریف نشده است.</div></td></tr>'}</tbody></table></div>`;
    const firstSection = panel.querySelector('.rc14-section');
    if (firstSection) firstSection.insertAdjacentElement('beforebegin', card); else panel.append(card);
    card.querySelector('[data-new-group]')?.addEventListener('click', () => openGroupModal());
    card.querySelectorAll('[data-edit-group]').forEach(b => b.addEventListener('click', () => openGroupModal(d.groups.find(g => g.id === b.dataset.editGroup))));
    enhanceItemsTable(d);
  } catch (err) {
    if (!/inventory_item_groups|schema cache/i.test(String(err?.message || err))) showError(err, 'inventory groups');
  }
}

function enhanceItemsTable(d) {
  const sections = [...document.querySelectorAll('.rc14-section')];
  const section = sections.find(s => s.querySelector('h3')?.textContent.trim() === 'کالا و خدمات');
  const table = section?.querySelector('table');
  if (!table || table.dataset.rc14lStructure === '1') return;
  table.dataset.rc14lStructure = '1';
  const head = table.querySelector('thead tr');
  const th = document.createElement('th'); th.textContent = 'ساختار / تنوع';
  head?.children?.[1]?.insertAdjacentElement('afterend', th);
  table.querySelectorAll('tbody tr').forEach(row => {
    const id = row.querySelector('[data-rc14-edit-item]')?.dataset.rc14EditItem || row.querySelector('[data-rc14-toggle-item]')?.dataset.rc14ToggleItem;
    const item = d.items.find(i => i.id === id);
    if (!item || row.querySelector('.rc14l-structure-cell')) return;
    const td = document.createElement('td');
    td.className = 'rc14l-structure-cell';
    const path = groupPath(item.group_id, d.groups);
    td.textContent = [path, item.variant_label].filter(Boolean).join(' · ') || '—';
    row.children[1]?.insertAdjacentElement('afterend', td);
  });
}

async function enhanceItemForm(form) {
  if (!form || form.dataset.rc14l === '1') return;
  try {
    const d = await data();
    form.dataset.rc14l = '1';
    const item = d.items.find(i => i.id === editingItemId) || null;
    const sku = form.querySelector('[name="sku"]');
    if (sku) {
      const help = document.createElement('div');
      help.className = 'rc14l-sku-help';
      help.innerHTML = '<small>پیشنهاد آوان: کد کوتاه، ثابت و یکتا باشد. الگو: «کد گروه/مدل - ویژگی - شماره». مثال: <b>SH-X-42-001</b></small><button type="button" class="ghost small" data-suggest-sku>پیشنهاد کد</button>';
      sku.insertAdjacentElement('afterend', help);
    }
    const grid = form.querySelector('.form-grid');
    const groupField = document.createElement('div');
    groupField.className = 'field';
    groupField.innerHTML = `<label>گروه / مدل</label><select name="group_id"><option value="">بدون گروه</option>${d.groups.filter(g => g.is_active || g.id === item?.group_id).map(g => `<option value="${g.id}" ${g.id === item?.group_id ? 'selected' : ''}>${esc(groupPath(g.id, d.groups))} (${esc(g.code)})</option>`).join('')}</select>`;
    const variantField = document.createElement('div');
    variantField.className = 'field';
    variantField.innerHTML = `<label>تنوع / واریانت</label><input name="variant_label" maxlength="120" value="${esc(item?.variant_label || '')}" placeholder="مثلاً سایز 42 / مشکی"><small class="rc14l-field-help">برای سایز، رنگ، بسته‌بندی یا ویژگی متمایزکننده SKU.</small>`;
    grid?.append(groupField, variantField);
    form.querySelector('[data-suggest-sku]')?.addEventListener('click', () => {
      if (!sku) return;
      sku.value = suggestSku(d, form.elements.group_id?.value || '', form.elements.variant_label?.value || '');
      sku.focus();
    });
    form.onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        workspace_id: d.company.id,
        sku: String(fd.get('sku') || '').trim(),
        barcode: String(fd.get('barcode') || '').trim() || null,
        name: String(fd.get('name') || '').trim(),
        item_type: String(fd.get('item_type') || 'inventory'),
        base_unit_id: String(fd.get('base_unit_id') || ''),
        min_stock: String(fd.get('min_stock') || '0'),
        notes: String(fd.get('notes') || '').trim() || null,
        group_id: String(fd.get('group_id') || '') || null,
        variant_label: String(fd.get('variant_label') || '').trim() || null
      };
      try {
        if (item) {
          const { workspace_id, ...patch } = payload;
          await C.update('inventory_items', patch, `id=eq.${item.id}&workspace_id=eq.${d.company.id}`);
        } else {
          await C.insert('inventory_items', payload);
        }
        closeModal();
        toast(item ? 'کالا / خدمت ویرایش شد' : 'کالا / خدمت ثبت شد');
        editingItemId = null;
        await renderInventoryFoundation();
      } catch (err) {
        showError(err, 'inventory item hierarchy save');
      }
    };
  } catch (err) {
    showError(err, 'inventory item hierarchy');
  }
}

function enhanceDecimalInput(input, maxDecimals = 6) {
  if (!input || input.dataset.rc14lNumber === '1') return;
  input.dataset.rc14lNumber = '1';
  input.classList.add('rc14l-number-input');
  input.inputMode = 'decimal';
  const format = () => { input.value = groupedDecimal(input.value, Number(input.dataset.rc14Decimals ?? maxDecimals)); };
  input.addEventListener('input', format);
  input.addEventListener('blur', format);
  input.addEventListener('change', format);
  format();
}

async function enhanceDocForm(form) {
  if (!form || form.dataset.rc14lEnhanced === '1') return;
  form.dataset.rc14lEnhanced = '1';
  try {
    const d = await data();
    const updateRow = row => {
      const itemSelect = row.querySelector('[name="item"]');
      if (!itemSelect) return;
      [...itemSelect.options].forEach(opt => {
        if (!opt.value) return;
        const item = d.items.find(i => i.id === opt.value);
        if (item) opt.textContent = itemLabel(item, d);
      });
      const qty = row.querySelector('[name="qty"]');
      const cost = row.querySelector('[name="cost"]');
      const applyUnit = () => {
        const item = d.items.find(i => i.id === itemSelect.value);
        const unit = d.units.find(u => u.id === item?.base_unit_id);
        const decimals = Number(unit?.decimal_places ?? 6);
        if (qty) {
          qty.dataset.rc14Decimals = String(decimals);
          qty.value = groupedDecimal(qty.value, decimals);
          let help = qty.parentElement?.querySelector('.rc14l-qty-help');
          if (!help && qty.parentElement) { help = document.createElement('small'); help.className = 'rc14l-field-help rc14l-qty-help'; qty.insertAdjacentElement('afterend', help); }
          if (help) help.textContent = unit ? `${unit.name}: ${decimals ? `تا ${decimals} رقم اعشار` : 'بدون اعشار'}` : '';
        }
      };
      itemSelect.addEventListener('change', applyUnit);
      enhanceDecimalInput(qty, 6);
      enhanceDecimalInput(cost, 6);
      applyUnit();
    };
    form.querySelectorAll('[data-e-line]').forEach(updateRow);
    new MutationObserver(() => form.querySelectorAll('[data-e-line]').forEach(updateRow)).observe(form.querySelector('#eLines') || form, { childList: true, subtree: true });
  } catch (err) {
    showError(err, 'inventory document refinements');
  }
}

async function saveInventoryDraftAtomic(e) {
  const form = e.target;
  if (form?.id !== 'eDocForm') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const submit = e.submitter || form.querySelector('button.primary');
  try {
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
      if (!itemId) return toast(`کالای ردیف ${idx + 1} را انتخاب کنید`);
      if (!qty || Number(qty) <= 0) return toast(`تعداد ردیف ${idx + 1} معتبر نیست`);
      if (cost === null) return toast(`بهای ردیف ${idx + 1} معتبر نیست`);
      if (['receipt', 'opening'].includes(type)) { from = null; if (!to) return toast('انبار مقصد را انتخاب کنید'); }
      if (type === 'issue') { to = null; if (!from) return toast('انبار مبدأ را انتخاب کنید'); }
      if (type === 'transfer' && (!from || !to || from === to)) return toast('مبدأ و مقصد انتقال معتبر نیست');
      if (type === 'adjustment') {
        if (dir === 'in') { from = null; if (!to) return toast('انبار تعدیل را انتخاب کنید'); }
        else { to = null; if (!from) return toast('انبار تعدیل را انتخاب کنید'); }
      }
      const inbound = ['receipt', 'opening'].includes(type) || (type === 'adjustment' && dir === 'in');
      if (inbound && Number(cost) <= 0) return toast(`بهای واحد ردیف ${idx + 1} باید بیشتر از صفر باشد`);
      rows.push({
        item_id: itemId,
        from_warehouse_id: from,
        to_warehouse_id: to,
        quantity: qty,
        unit_cost: cost,
        description: row.querySelector('[name="desc"]')?.value.trim() || null
      });
    }
    if (submit) { submit.disabled = true; submit.dataset.oldText = submit.textContent; submit.textContent = 'در حال ذخیره…'; }
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
    setTimeout(() => document.querySelector('[data-e-tab="documents"]')?.click(), 0);
  } catch (err) {
    if (submit) { submit.disabled = false; submit.textContent = submit.dataset.oldText || 'ذخیره پیش‌نویس'; }
    showError(err, 'inventory atomic draft save');
  }
}

async function enhanceInvoiceItemLabels() {
  const selects = [...document.querySelectorAll('select[data-e-item]')].filter(s => s.dataset.rc14lLabels !== '1');
  if (!selects.length) return;
  try {
    const d = await data();
    selects.forEach(select => {
      select.dataset.rc14lLabels = '1';
      [...select.options].forEach(opt => {
        if (!opt.value) return;
        const item = d.items.find(i => i.id === opt.value);
        if (item) opt.textContent = itemLabel(item, d);
      });
    });
  } catch {}
}

function removeTechnicalSubtitle() {
  document.querySelectorAll('.rc14e-section-head').forEach(head => {
    if (head.querySelector('h3')?.textContent.trim() === 'اسناد انبار') head.querySelector('p.muted')?.remove();
  });
}

async function scan() {
  if (scanBusy) return;
  scanBusy = true;
  try {
    removeTechnicalSubtitle();
    await ensureGroupCard();
    const itemForm = document.getElementById('rc14ItemForm');
    if (itemForm) await enhanceItemForm(itemForm);
    const docForm = document.getElementById('eDocForm');
    if (docForm) await enhanceDocForm(docForm);
    await enhanceInvoiceItemLabels();
  } finally {
    scanBusy = false;
  }
}

function install() {
  document.addEventListener('click', e => {
    const edit = e.target.closest?.('[data-rc14-edit-item]');
    if (edit) editingItemId = edit.dataset.rc14EditItem;
    if (e.target.closest?.('[data-rc14-new-item]')) editingItemId = null;
  }, true);
  document.addEventListener('submit', saveInventoryDraftAtomic, true);
  new MutationObserver(() => queueMicrotask(scan)).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('avan:company-context-changed', () => { editingItemId = null; queueMicrotask(scan); });
  scan();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
