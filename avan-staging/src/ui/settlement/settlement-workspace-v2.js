'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';
import { jalalizeDateInputs } from '../date/jalali-picker.js';
import {
  UNIT_RIAL,
  normalizeUnit,
  displayToCanonical,
  canonicalToDisplay,
  formatCanonical,
  groupInteger
} from '../../core/money/canonical-money.js';

const C = installAvanCloud();
const Lifecycle = installUiLifecycle();
let editingInvoiceId = null;
let metaCache = null;
let buildToken = 0;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

function currentUnit() {
  return normalizeUnit(window.AVAN_MONEY_DISPLAY_UNIT);
}

async function activeCompany() {
  const snapshot = await C.companyContext.ensure();
  const company = snapshot?.active_company;
  if (!company?.id) throw new Error('COMPANY_REQUIRED');
  return company;
}

async function settlementMeta(force = false) {
  const company = await activeCompany();
  if (!force && metaCache?.company?.id === company.id) return metaCache;
  const wid = company.id;
  const [accounts, financialAccounts] = await Promise.all([
    C.select('accounts', `select=id,code,name&workspace_id=eq.${wid}&is_active=eq.true&is_postable=eq.true&order=code.asc`),
    C.select('financial_accounts', `select=ledger_account_id,kind,is_active&workspace_id=eq.${wid}&is_active=eq.true`)
  ]);
  const byId = new Map((accounts || []).map(account => [account.id, account]));
  const financial = (financialAccounts || [])
    .map(row => ({ ...row, account: byId.get(row.ledger_account_id) }))
    .filter(row => row.account);
  return metaCache = { company, financial };
}

function financialOptions(meta, selected = '', kind = null) {
  return '<option value="">انتخاب حساب…</option>' + meta.financial
    .filter(row => !kind || row.kind === kind)
    .map(row => `<option value="${row.ledger_account_id}" ${row.ledger_account_id === selected ? 'selected' : ''}>${esc(row.account.code)} — ${esc(row.account.name)} (${row.kind === 'cash' ? 'صندوق' : 'بانک'})</option>`)
    .join('');
}

function isoFromForm(form, name) {
  return String(new FormData(form).get(name) || '');
}

function addMonthsIso(iso, count) {
  const date = new Date(`${iso}T12:00:00`);
  date.setMonth(date.getMonth() + count);
  return date.toISOString().slice(0, 10);
}

function canonicalTotal(form) {
  try { return BigInt(form.dataset.avanCanonicalInvoiceTotalToman || '0'); }
  catch { return 0n; }
}

function displayValue(canonical, unit = currentUnit()) {
  const value = canonicalToDisplay(canonical, unit);
  return value === null ? '' : groupInteger(value);
}

function updateVisibleAmount(row) {
  const visible = row.querySelector('[name="v2_amount_display"]');
  const hidden = row.querySelector('[name="v60_amount"]');
  const note = row.querySelector('[data-v2-amount-error]');
  if (!visible || !hidden) return;
  const converted = displayToCanonical(visible.value || '0', currentUnit());
  if (!converted.ok) {
    hidden.value = '';
    visible.setAttribute('aria-invalid', 'true');
    if (note) note.textContent = 'در حالت ریال مبلغ باید مضرب ۱۰ باشد.';
    return;
  }
  hidden.value = converted.value.toString();
  visible.removeAttribute('aria-invalid');
  if (note) note.textContent = '';
}

function rowHtml(meta, row = {}, mixed = false) {
  const canonical = BigInt(row.amount || 0);
  const method = row.planned_method || 'open';
  return `<div class="rc14v60-plan-row" data-v60-plan-row data-avan-settlement-row-v2>
    <div class="field"><label>مبلغ (${currentUnit() === UNIT_RIAL ? 'ریال' : 'تومان'})</label>
      <input name="v2_amount_display" data-money="false" inputmode="numeric" value="${displayValue(canonical)}" required>
      <input type="hidden" name="v60_amount" value="${canonical}">
      <small class="neg" data-v2-amount-error></small>
    </div>
    <div class="field"><label>سررسید</label><input type="date" name="v60_due" value="${esc(row.due_date || '')}" required></div>
    ${mixed ? `<div class="field"><label>روش</label><select name="v60_method"><option value="open" ${method === 'open' ? 'selected' : ''}>بعداً تعیین می‌شود</option><option value="cash" ${method === 'cash' ? 'selected' : ''}>صندوق</option><option value="bank" ${method === 'bank' ? 'selected' : ''}>بانک</option><option value="check" ${method === 'check' ? 'selected' : ''}>چک</option></select></div>
      <div class="field v60-fin"><label>حساب</label><select name="v60_fin">${financialOptions(meta, row.financial_account_id || '')}</select></div>
      <div class="field v60-check"><label>شماره چک</label><input name="v60_check_no" value="${esc(row.check_number || '')}"></div>
      <div class="field v60-check"><label>بانک چک</label><input name="v60_check_bank" value="${esc(row.check_bank_name || '')}"></div>` : ''}
    <button type="button" class="danger small" data-v2-remove-plan>×</button>
  </div>`;
}

function syncMixed(row) {
  const method = row?.querySelector('[name="v60_method"]')?.value || 'open';
  row?.querySelectorAll('.v60-fin').forEach(node => { node.hidden = !['cash', 'bank'].includes(method); });
  row?.querySelectorAll('.v60-check').forEach(node => { node.hidden = method !== 'check'; });
}

function splitThree(total, date) {
  const first = total / 3n;
  const second = total / 3n;
  return [
    { amount: first.toString(), due_date: addMonthsIso(date, 1), planned_method: 'open' },
    { amount: second.toString(), due_date: addMonthsIso(date, 2), planned_method: 'open' },
    { amount: (total - first - second).toString(), due_date: addMonthsIso(date, 3), planned_method: 'open' }
  ];
}

function planCanonicalTotal(box, total) {
  const type = box.querySelector('[name="v60_plan_type"]')?.value || 'credit';
  if (['credit', 'cash', 'check'].includes(type)) return total;
  let scheduled = 0n;
  box.querySelectorAll('[name="v60_amount"]').forEach(input => {
    try { scheduled += BigInt(input.value || '0'); } catch { /* invalid row stays zero */ }
  });
  return scheduled;
}

function updatePlanTotal(form, box) {
  const total = canonicalTotal(form);
  const scheduled = planCanonicalTotal(box, total);
  const host = box.querySelector('[data-v60-plan-total]');
  if (!host) return;
  const balanced = scheduled === total;
  const next = `جمع برنامه: <b>${formatCanonical(scheduled, currentUnit())}</b> از <b>${formatCanonical(total, currentUnit())}</b> ${balanced ? '<span class="pos">✓ برابر</span>' : '<span class="neg">مغایرت</span>'}`;
  if (host.innerHTML !== next) host.innerHTML = next;
  host.dataset.avanMoneyOwned = '1';
}

function bindRows(form, box) {
  box.querySelectorAll('[data-avan-settlement-row-v2]').forEach(row => {
    syncMixed(row);
    const visible = row.querySelector('[name="v2_amount_display"]');
    visible?.addEventListener('input', () => {
      updateVisibleAmount(row);
      updatePlanTotal(form, box);
    });
    row.querySelector('[name="v60_method"]')?.addEventListener('change', () => {
      syncMixed(row);
      updatePlanTotal(form, box);
    });
    row.querySelector('[data-v2-remove-plan]')?.addEventListener('click', () => {
      row.remove();
      updatePlanTotal(form, box);
    });
  });
}

async function loadExisting(meta) {
  if (!editingInvoiceId) return { plan: null, schedules: [] };
  const [plans, schedules] = await Promise.all([
    C.select('invoice_settlement_plans', `select=*&workspace_id=eq.${meta.company.id}&invoice_id=eq.${editingInvoiceId}&limit=1`),
    C.select('invoice_settlement_schedule', `select=*&workspace_id=eq.${meta.company.id}&invoice_id=eq.${editingInvoiceId}&order=installment_no.asc`)
  ]);
  return { plan: plans?.[0] || null, schedules: schedules || [] };
}

function renderBody(form, box, meta, state) {
  const body = box.querySelector('[data-v60-plan-body]');
  const type = box.querySelector('[name="v60_plan_type"]')?.value || 'credit';
  const total = canonicalTotal(form);
  const date = isoFromForm(form, 'date') || new Date().toISOString().slice(0, 10);
  const due = isoFromForm(form, 'due') || date;
  let schedules = state.schedules || [];

  if (type === 'credit') {
    body.innerHTML = `<div class="rc14v60-simple-plan"><div class="field"><label>مبلغ اعتباری (${currentUnit() === UNIT_RIAL ? 'ریال' : 'تومان'})</label><input data-v60-fixed-amount data-money="false" value="${displayValue(total)}" disabled></div><div class="field"><label>سررسید</label><input type="date" name="v60_credit_due" value="${esc(schedules[0]?.due_date || due)}"></div></div>`;
  } else if (type === 'cash') {
    body.innerHTML = `<div class="rc14v60-simple-plan"><div class="field"><label>مبلغ نقدی (${currentUnit() === UNIT_RIAL ? 'ریال' : 'تومان'})</label><input data-v60-fixed-amount data-money="false" value="${displayValue(total)}" disabled></div><div class="field"><label>صندوق / بانک</label><select name="v60_cash_account">${financialOptions(meta, schedules[0]?.financial_account_id || '')}</select></div></div>`;
  } else if (type === 'check') {
    body.innerHTML = `<div class="rc14v60-check-plan"><div class="field"><label>مبلغ چک (${currentUnit() === UNIT_RIAL ? 'ریال' : 'تومان'})</label><input data-v60-fixed-amount data-money="false" value="${displayValue(total)}" disabled></div><div class="field"><label>سررسید چک</label><input type="date" name="v60_check_due" value="${esc(schedules[0]?.due_date || due)}"></div><div class="field"><label>شماره چک</label><input name="v60_check_no" value="${esc(schedules[0]?.check_number || '')}"></div><div class="field"><label>بانک چک</label><input name="v60_check_bank" value="${esc(schedules[0]?.check_bank_name || '')}"></div><div class="field"><label>شعبه</label><input name="v60_check_branch" value="${esc(schedules[0]?.check_branch || '')}"></div></div>`;
  } else {
    const mixed = type === 'mixed';
    if (!schedules.length) schedules = type === 'installment'
      ? splitThree(total, date)
      : [{ amount: total.toString(), due_date: due, planned_method: 'open' }];
    body.innerHTML = `<div class="rc14v60-plan-toolbar"><div class="row-actions"><button type="button" class="ghost small" data-v2-add-plan>＋ ردیف</button>${type === 'installment' ? '<button type="button" class="ghost small" data-v2-split3>تقسیم مساوی ۳ قسط</button>' : ''}</div><span class="muted">${type === 'installment' ? 'روش دریافت/پرداخت هر قسط هنگام تسویه تعیین می‌شود.' : 'برای هر بخش روش تسویه را مشخص کنید.'}</span></div><div data-v2-plan-rows>${schedules.map(row => rowHtml(meta, row, mixed)).join('')}</div>`;
    body.querySelector('[data-v2-add-plan]')?.addEventListener('click', () => {
      const rows = body.querySelector('[data-v2-plan-rows]');
      rows.insertAdjacentHTML('beforeend', rowHtml(meta, { amount: '0', due_date: due }, mixed));
      bindRows(form, box);
      jalalizeDateInputs(rows);
      updatePlanTotal(form, box);
    });
    body.querySelector('[data-v2-split3]')?.addEventListener('click', () => {
      const rows = body.querySelector('[data-v2-plan-rows]');
      rows.innerHTML = splitThree(canonicalTotal(form), date).map(row => rowHtml(meta, row, false)).join('');
      bindRows(form, box);
      jalalizeDateInputs(rows);
      updatePlanTotal(form, box);
    });
  }

  box.querySelectorAll('[data-v60-fixed-amount]').forEach(input => {
    input.value = displayValue(canonicalTotal(form));
    input.dataset.avanMoneyOwned = '1';
  });
  jalalizeDateInputs(body);
  bindRows(form, box);
  updatePlanTotal(form, box);
}

async function ensureSettlementWorkspace(form = document.getElementById('invoiceForm')) {
  if (!form) return false;
  const existingV2 = form.querySelector('[data-avan-settlement-v2]');
  if (existingV2) {
    existingV2.querySelectorAll('[data-v60-fixed-amount]').forEach(input => {
      input.value = displayValue(canonicalTotal(form));
    });
    updatePlanTotal(form, existingV2);
    return true;
  }

  // Claim the legacy compatibility flag before v61's lifecycle handler runs.
  form.dataset.v60Settlement = '1';
  form.querySelectorAll('[data-v60-settlement-box]').forEach(node => node.remove());
  const token = ++buildToken;
  try {
    const meta = await settlementMeta();
    const state = await loadExisting(meta);
    if (token !== buildToken || !form.isConnected) return false;
    if (editingInvoiceId) form.dataset.v60DraftId = editingInvoiceId;

    const box = document.createElement('section');
    box.className = 'rc14v60-settlement-box';
    box.dataset.v60SettlementBox = '1';
    box.dataset.avanSettlementV2 = '1';
    box.dataset.avanMoneyOwned = '1';
    box.innerHTML = `<div class="rc14v60-settlement-head"><div><strong>شرایط تسویه</strong><small>مبلغ این بخش مستقیماً از جمع نهایی Canonical فاکتور خوانده می‌شود.</small></div><select name="v60_plan_type"><option value="credit">اعتباری</option><option value="cash">نقدی</option><option value="check">چکی</option><option value="installment">اقساطی</option><option value="mixed">ترکیبی</option></select></div><div data-v60-plan-body></div><div class="rc14v60-plan-total" data-v60-plan-total data-avan-money-owned="1"></div>`;
    const anchor = form.querySelector('.invoice-grand-total');
    if (anchor) anchor.before(box); else form.append(box);
    const type = box.querySelector('[name="v60_plan_type"]');
    type.value = state.plan?.plan_type || 'credit';
    type.addEventListener('change', () => {
      state.schedules = [];
      renderBody(form, box, meta, state);
    });
    renderBody(form, box, meta, state);
    return true;
  } catch (error) {
    console.error('[Settlement v2]', error);
    form.dataset.v60Settlement = '1';
    return false;
  }
}

function refreshSettlementWorkspace() {
  const form = document.getElementById('invoiceForm');
  const box = form?.querySelector('[data-avan-settlement-v2]');
  if (!form || !box) return;
  box.querySelectorAll('[data-v60-fixed-amount]').forEach(input => {
    input.value = displayValue(canonicalTotal(form));
  });
  box.querySelectorAll('[data-avan-settlement-row-v2]').forEach(row => {
    const hidden = row.querySelector('[name="v60_amount"]');
    const visible = row.querySelector('[name="v2_amount_display"]');
    if (!hidden || !visible || visible === document.activeElement) return;
    try { visible.value = displayValue(BigInt(hidden.value || '0')); } catch { /* keep visible value */ }
    const label = visible.closest('.field')?.querySelector('label');
    if (label) label.textContent = `مبلغ (${currentUnit() === UNIT_RIAL ? 'ریال' : 'تومان'})`;
  });
  updatePlanTotal(form, box);
}

Lifecycle.use('settlement:workspace-v2', () => ensureSettlementWorkspace(), { priority: 45 });

document.addEventListener('avan:invoice-money-changed', refreshSettlementWorkspace);
document.addEventListener('avan:money-unit-changed', refreshSettlementWorkspace);
window.addEventListener('avan:page-rendered', () => {
  // Explicitly wake the central lifecycle so the invoice-list settlement/check
  // dashboard from the compatibility module is restored on Web as it is in PWA.
  Lifecycle.schedule('settlement-page-rendered-v2');
});
window.addEventListener('avan:company-context-changed', () => {
  metaCache = null;
  editingInvoiceId = null;
  buildToken += 1;
  Lifecycle.schedule('settlement-company-v2');
});

document.addEventListener('click', event => {
  const edit = event.target.closest?.('[data-edit-invoice]');
  if (edit) editingInvoiceId = edit.dataset.editInvoice || null;
  if (event.target.closest?.('#newSaleInvoice,#newPurchaseInvoice')) editingInvoiceId = null;
}, true);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Lifecycle.schedule('settlement-v2-ready'), { once: true });
} else {
  Lifecycle.schedule('settlement-v2-ready');
}

window.AvanSettlementV2 = Object.freeze({
  ensure: ensureSettlementWorkspace,
  refresh: refreshSettlementWorkspace
});
