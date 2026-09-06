'use strict';

import { setTitle, setNav, page } from './src/ui/shell/shell-view.js';
import { openModal, closeModal } from './src/ui/components/modal.js';
import { toast, showError } from './src/ui/feedback/toast.js';
import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const C = installAvanCloud();
const TYPE_FA = Object.freeze({ inventory: 'کالای انباری', service: 'خدمت', non_inventory: 'غیرانباری' });
const COSTING_FA = Object.freeze({ weighted_average: 'میانگین موزون' });
const MANAGE_ROLES = new Set(['owner', 'manager', 'accountant']);
let snapshot = null;

const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));

function isInventoryPageActive() {
  return document.querySelector('.sidebar [data-page="inventory"]')?.classList.contains('active') === true;
}

function ensureSidebarEntry() {
  const nav = document.getElementById('nav');
  if (!nav || nav.querySelector('[data-page="inventory"]')) return;
  const parties = nav.querySelector('[data-page="parties"]');
  if (!parties) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.page = 'inventory';
  button.innerHTML = '<span>▣</span>کالا و انبار';
  parties.insertAdjacentElement('afterend', button);
}

async function activeCompany() {
  const state = await C.companyContext.ensure();
  if (state?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
  const company = state?.active_company;
  if (!company?.id) throw new Error('COMPANY_REQUIRED');
  return company;
}

async function loadSnapshot() {
  const company = await activeCompany();
  const wid = company.id;
  const [units, warehouses, items, settingsRows, role] = await Promise.all([
    C.select('inventory_units', `select=*&workspace_id=eq.${wid}&order=is_system.desc,name.asc`),
    C.select('warehouses', `select=*&workspace_id=eq.${wid}&order=is_default.desc,name.asc`),
    C.select('inventory_items', `select=*&workspace_id=eq.${wid}&order=is_active.desc,name.asc`),
    C.select('inventory_settings', `select=*&workspace_id=eq.${wid}&limit=1`),
    C.rpc('workspace_role', { wid })
  ]);
  snapshot = {
    company,
    role,
    units: Array.isArray(units) ? units : [],
    warehouses: Array.isArray(warehouses) ? warehouses : [],
    items: Array.isArray(items) ? items : [],
    settings: Array.isArray(settingsRows) ? settingsRows[0] || null : null
  };
  return snapshot;
}

function canManage() { return MANAGE_ROLES.has(snapshot?.role); }
function unitName(id) { return snapshot?.units.find(unit => unit.id === id)?.name || '—'; }

function managerActions() {
  if (!canManage()) return '';
  return `<div class="rc14-inventory-actions"><button class="primary" type="button" data-rc14-new-item>＋ کالا / خدمت</button><button class="ghost" type="button" data-rc14-new-warehouse>＋ انبار</button><button class="ghost" type="button" data-rc14-new-unit>＋ واحد</button></div>`;
}

function summaryHtml() {
  const settings = snapshot.settings || {};
  const activeItems = snapshot.items.filter(item => item.is_active).length;
  const stockItems = snapshot.items.filter(item => item.is_active && item.item_type === 'inventory').length;
  const activeWarehouses = snapshot.warehouses.filter(warehouse => warehouse.is_active).length;
  return `<div class="rc14-inventory-summary">
    <div class="card rc14-stat"><span>کالا و خدمت فعال</span><strong>${activeItems}</strong><small>${stockItems} کالای انباری</small></div>
    <div class="card rc14-stat"><span>انبار فعال</span><strong>${activeWarehouses}</strong><small>${snapshot.warehouses.find(w => w.is_default)?.name || 'بدون انبار پیش‌فرض'}</small></div>
    <div class="card rc14-stat"><span>روش بهای تمام‌شده</span><strong class="rc14-stat-text">${COSTING_FA[settings.costing_method] || '—'}</strong><small>پایه RC1.4</small></div>
    <div class="card rc14-stat"><span>موجودی منفی</span><strong class="rc14-stat-text">${settings.allow_negative_stock ? 'مجاز' : 'ممنوع'}</strong><small>کنترل سطح Ledger در Gate بعدی</small></div>
  </div>`;
}

function itemsHtml() {
  const rows = snapshot.items.map(item => `<tr class="${item.is_active ? '' : 'rc14-row-inactive'}">
    <td><b>${esc(item.sku)}</b>${item.barcode ? `<small class="rc14-subline">${esc(item.barcode)}</small>` : ''}</td>
    <td>${esc(item.name)}</td><td>${TYPE_FA[item.item_type] || esc(item.item_type)}</td><td>${esc(unitName(item.base_unit_id))}</td>
    <td class="num">${esc(item.min_stock)}</td><td><span class="status ${item.is_active ? 'posted' : 'draft'}">${item.is_active ? 'فعال' : 'غیرفعال'}</span></td>
    <td>${canManage() ? `<div class="rc14-row-actions"><button class="ghost" type="button" data-rc14-edit-item="${item.id}">ویرایش</button><button class="ghost" type="button" data-rc14-toggle-item="${item.id}">${item.is_active ? 'غیرفعال' : 'فعال'}</button></div>` : '—'}</td>
  </tr>`).join('');
  return `<section class="card rc14-section"><div class="rc14-section-head"><div><h3>کالا و خدمات</h3><p class="muted">اطلاعات پایه؛ هنوز گردش موجودی و بهای تمام‌شده در این Gate ثبت نمی‌شود.</p></div></div><div class="table-wrap"><table><thead><tr><th>کد / بارکد</th><th>نام</th><th>نوع</th><th>واحد پایه</th><th>حداقل موجودی</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>${rows || '<tr><td colspan="7"><div class="empty-state">هنوز کالا یا خدمتی ثبت نشده است.</div></td></tr>'}</tbody></table></div></section>`;
}

function warehousesHtml() {
  const rows = snapshot.warehouses.map(warehouse => `<tr class="${warehouse.is_active ? '' : 'rc14-row-inactive'}"><td><b>${esc(warehouse.code)}</b></td><td>${esc(warehouse.name)}${warehouse.is_default ? '<span class="rc14-default-badge">پیش‌فرض</span>' : ''}</td><td>${esc(warehouse.description || '—')}</td><td>${warehouse.is_active ? 'فعال' : 'غیرفعال'}</td><td>${canManage() ? `<button class="ghost" type="button" data-rc14-edit-warehouse="${warehouse.id}">ویرایش</button>` : '—'}</td></tr>`).join('');
  return `<section class="card rc14-section"><div class="rc14-section-head"><div><h3>انبارها</h3><p class="muted">هر شرکت یک «انبار اصلی» پیش‌فرض دارد؛ حذف فیزیکی اطلاعات پایه مجاز نیست.</p></div></div><div class="table-wrap"><table><thead><tr><th>کد</th><th>نام</th><th>توضیح</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function unitsHtml() {
  const rows = snapshot.units.map(unit => `<tr class="${unit.is_active ? '' : 'rc14-row-inactive'}"><td><b>${esc(unit.code)}</b></td><td>${esc(unit.name)}</td><td>${esc(unit.symbol || '—')}</td><td class="num">${esc(unit.decimal_places)}</td><td>${unit.is_system ? 'استاندارد' : 'سفارشی'}</td><td>${canManage() && !unit.is_system ? `<button class="ghost" type="button" data-rc14-edit-unit="${unit.id}">ویرایش</button>` : '—'}</td></tr>`).join('');
  return `<section class="card rc14-section"><div class="rc14-section-head"><div><h3>واحدهای اندازه‌گیری</h3><p class="muted">واحدهای استاندارد برای هر شرکت به‌صورت خودکار ساخته شده‌اند.</p></div></div><div class="table-wrap"><table><thead><tr><th>کد</th><th>نام</th><th>نماد</th><th>اعشار</th><th>نوع</th><th>اقدام</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function bindPageActions() {
  document.querySelector('[data-rc14-new-item]')?.addEventListener('click', () => openItemModal());
  document.querySelector('[data-rc14-new-warehouse]')?.addEventListener('click', () => openWarehouseModal());
  document.querySelector('[data-rc14-new-unit]')?.addEventListener('click', () => openUnitModal());
  document.querySelectorAll('[data-rc14-edit-item]').forEach(button => button.addEventListener('click', () => openItemModal(snapshot.items.find(item => item.id === button.dataset.rc14EditItem))));
  document.querySelectorAll('[data-rc14-toggle-item]').forEach(button => button.addEventListener('click', () => toggleItem(button.dataset.rc14ToggleItem)));
  document.querySelectorAll('[data-rc14-edit-warehouse]').forEach(button => button.addEventListener('click', () => openWarehouseModal(snapshot.warehouses.find(item => item.id === button.dataset.rc14EditWarehouse))));
  document.querySelectorAll('[data-rc14-edit-unit]').forEach(button => button.addEventListener('click', () => openUnitModal(snapshot.units.find(item => item.id === button.dataset.rc14EditUnit))));
}

export async function renderInventoryFoundation() {
  ensureSidebarEntry(); setTitle('کالا و انبار'); setNav('inventory'); page('<div class="loading">در حال دریافت اطلاعات کالا و انبار…</div>');
  try {
    await loadSnapshot(); setTitle('کالا و انبار'); setNav('inventory');
    page(`<div class="rc14-inventory-page"><div class="rc14-page-head"><div><h2>کالا و انبار</h2><p class="muted">شرکت: ${esc(snapshot.company.name || '—')} · RC1.4-A Foundation</p></div>${managerActions()}</div>${summaryHtml()}${itemsHtml()}<div class="rc14-two-col">${warehousesHtml()}${unitsHtml()}</div></div>`);
    bindPageActions();
  } catch (error) {
    page('<div class="error-box">بارگذاری ماژول کالا و انبار انجام نشد.</div>'); showError(error, 'RC1.4 inventory');
  }
}

function itemForm(item = null) {
  const activeUnits = snapshot.units.filter(unit => unit.is_active || unit.id === item?.base_unit_id);
  const selectedUnit = item?.base_unit_id || activeUnits[0]?.id || '';
  return `<h2>${item ? 'ویرایش کالا / خدمت' : 'کالا / خدمت جدید'}</h2><form id="rc14ItemForm"><div class="form-grid">
    <div class="field"><label>کد کالا / خدمت</label><input name="sku" value="${esc(item?.sku || '')}" required maxlength="80"></div>
    <div class="field"><label>بارکد</label><input name="barcode" value="${esc(item?.barcode || '')}" maxlength="120" placeholder="اختیاری"></div>
    <div class="field"><label>نام</label><input name="name" value="${esc(item?.name || '')}" required maxlength="200"></div>
    <div class="field"><label>نوع</label><select name="item_type"><option value="inventory" ${item?.item_type === 'inventory' || !item ? 'selected' : ''}>کالای انباری</option><option value="service" ${item?.item_type === 'service' ? 'selected' : ''}>خدمت</option><option value="non_inventory" ${item?.item_type === 'non_inventory' ? 'selected' : ''}>غیرانباری</option></select></div>
    <div class="field"><label>واحد پایه</label><select name="base_unit_id" required>${activeUnits.map(unit => `<option value="${unit.id}" ${unit.id === selectedUnit ? 'selected' : ''}>${esc(unit.name)} (${esc(unit.symbol || unit.code)})</option>`).join('')}</select></div>
    <div class="field"><label>حداقل موجودی</label><input name="min_stock" type="number" min="0" step="0.001" value="${esc(item?.min_stock ?? '0')}"></div>
  </div><div class="field" style="margin-top:12px"><label>یادداشت</label><textarea name="notes" rows="3">${esc(item?.notes || '')}</textarea></div><div class="form-actions"><button type="button" class="ghost" data-rc14-cancel>انصراف</button><button class="primary">ذخیره</button></div></form>`;
}

function openItemModal(item = null) {
  openModal(itemForm(item)); document.querySelector('[data-rc14-cancel]')?.addEventListener('click', closeModal);
  document.getElementById('rc14ItemForm').onsubmit = async event => {
    event.preventDefault(); const form = new FormData(event.target);
    const payload = { workspace_id: snapshot.company.id, sku: String(form.get('sku') || '').trim(), barcode: String(form.get('barcode') || '').trim() || null, name: String(form.get('name') || '').trim(), item_type: String(form.get('item_type') || 'inventory'), base_unit_id: String(form.get('base_unit_id') || ''), min_stock: String(form.get('min_stock') || '0'), notes: String(form.get('notes') || '').trim() || null };
    try {
      if (item) { const { workspace_id, ...patch } = payload; await C.update('inventory_items', patch, `id=eq.${item.id}&workspace_id=eq.${snapshot.company.id}`); }
      else await C.insert('inventory_items', payload);
      closeModal(); toast(item ? 'کالا / خدمت ویرایش شد' : 'کالا / خدمت ثبت شد'); await renderInventoryFoundation();
    } catch (error) { showError(error, 'inventory item save'); }
  };
}

async function toggleItem(id) {
  const item = snapshot.items.find(row => row.id === id); if (!item) return;
  try { await C.update('inventory_items', { is_active: !item.is_active }, `id=eq.${item.id}&workspace_id=eq.${snapshot.company.id}`); toast(item.is_active ? 'کالا / خدمت غیرفعال شد' : 'کالا / خدمت فعال شد'); await renderInventoryFoundation(); }
  catch (error) { showError(error, 'inventory item toggle'); }
}

function openWarehouseModal(warehouse = null) {
  openModal(`<h2>${warehouse ? 'ویرایش انبار' : 'انبار جدید'}</h2><form id="rc14WarehouseForm"><div class="form-grid"><div class="field"><label>کد انبار</label><input name="code" value="${esc(warehouse?.code || '')}" required maxlength="40"></div><div class="field"><label>نام انبار</label><input name="name" value="${esc(warehouse?.name || '')}" required maxlength="160"></div></div><div class="field" style="margin-top:12px"><label>توضیح</label><textarea name="description" rows="3">${esc(warehouse?.description || '')}</textarea></div>${warehouse ? `<label class="rc14-check"><input name="is_active" type="checkbox" ${warehouse.is_active ? 'checked' : ''} ${warehouse.is_default ? 'disabled' : ''}> فعال${warehouse.is_default ? ' — انبار پیش‌فرض در این Gate غیرفعال نمی‌شود.' : ''}</label>` : ''}<div class="form-actions"><button type="button" class="ghost" data-rc14-cancel>انصراف</button><button class="primary">ذخیره</button></div></form>`);
  document.querySelector('[data-rc14-cancel]')?.addEventListener('click', closeModal);
  document.getElementById('rc14WarehouseForm').onsubmit = async event => {
    event.preventDefault(); const form = new FormData(event.target); const base = { code: String(form.get('code') || '').trim(), name: String(form.get('name') || '').trim(), description: String(form.get('description') || '').trim() || null };
    try {
      if (warehouse) await C.update('warehouses', { ...base, is_active: warehouse.is_default ? true : form.get('is_active') === 'on' }, `id=eq.${warehouse.id}&workspace_id=eq.${snapshot.company.id}`);
      else await C.insert('warehouses', { workspace_id: snapshot.company.id, ...base, is_default: false, is_active: true });
      closeModal(); toast(warehouse ? 'انبار ویرایش شد' : 'انبار ثبت شد'); await renderInventoryFoundation();
    } catch (error) { showError(error, 'warehouse save'); }
  };
}

function openUnitModal(unit = null) {
  if (unit?.is_system) return;
  openModal(`<h2>${unit ? 'ویرایش واحد اندازه‌گیری' : 'واحد اندازه‌گیری جدید'}</h2><form id="rc14UnitForm"><div class="form-grid"><div class="field"><label>کد</label><input name="code" value="${esc(unit?.code || '')}" required maxlength="40"></div><div class="field"><label>نام</label><input name="name" value="${esc(unit?.name || '')}" required maxlength="120"></div><div class="field"><label>نماد</label><input name="symbol" value="${esc(unit?.symbol || '')}" maxlength="40"></div><div class="field"><label>تعداد اعشار</label><input name="decimal_places" type="number" min="0" max="6" step="1" value="${esc(unit?.decimal_places ?? 3)}" required></div></div>${unit ? `<label class="rc14-check"><input name="is_active" type="checkbox" ${unit.is_active ? 'checked' : ''}> فعال</label>` : ''}<div class="form-actions"><button type="button" class="ghost" data-rc14-cancel>انصراف</button><button class="primary">ذخیره</button></div></form>`);
  document.querySelector('[data-rc14-cancel]')?.addEventListener('click', closeModal);
  document.getElementById('rc14UnitForm').onsubmit = async event => {
    event.preventDefault(); const form = new FormData(event.target); const base = { code: String(form.get('code') || '').trim(), name: String(form.get('name') || '').trim(), symbol: String(form.get('symbol') || '').trim() || null, decimal_places: Number(form.get('decimal_places') || 0) };
    try {
      if (unit) await C.update('inventory_units', { ...base, is_active: form.get('is_active') === 'on' }, `id=eq.${unit.id}&workspace_id=eq.${snapshot.company.id}`);
      else await C.insert('inventory_units', { workspace_id: snapshot.company.id, ...base, is_system: false, is_active: true });
      closeModal(); toast(unit ? 'واحد اندازه‌گیری ویرایش شد' : 'واحد اندازه‌گیری ثبت شد'); await renderInventoryFoundation();
    } catch (error) { showError(error, 'inventory unit save'); }
  };
}

function installNavigation() {
  ensureSidebarEntry();
  document.addEventListener('click', event => {
    const inventoryTarget = event.target.closest?.('[data-page="inventory"]');
    if (!inventoryTarget) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); void renderInventoryFoundation();
  }, true);
  window.addEventListener('avan:company-context-changed', () => { if (isInventoryPageActive()) void renderInventoryFoundation(); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installNavigation, { once: true });
else installNavigation();

window.AvanInventoryFoundation = Object.freeze({ render: renderInventoryFoundation });
