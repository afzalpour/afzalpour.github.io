'use strict';

import { closeModal } from './src/ui/components/modal.js';
import { toast, showError } from './src/ui/feedback/toast.js';
import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const C = installAvanCloud();
let requestedType = null;
let editingInvoiceId = null;
let cache = null;

const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[ch]));

const faToLatin = value => String(value ?? '')
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

function cleanInteger(value) {
  const s = faToLatin(value).trim().replace(/[٬,\s]/g, '');
  return /^\d+$/.test(s) ? s : null;
}

function cleanDecimal(value, maxDecimals = 6) {
  const s = faToLatin(value).trim().replace(/٫|,/g, '.').replace(/\s/g, '');
  return new RegExp(`^\\d+(?:\\.\\d{1,${maxDecimals}})?$`).test(s) ? s : null;
}

async function activeData(force = false) {
  const state = await C.companyContext.ensure();
  const company = state?.active_company;
  if (!company?.id) throw new Error('COMPANY_REQUIRED');
  if (!force && cache?.company?.id === company.id) return cache;

  const wid = company.id;
  const [parties, accounts, roles, financialAccounts, years, invoices] = await Promise.all([
    C.select('parties', `select=id,name,kind,phone,is_active&workspace_id=eq.${wid}&order=name.asc`),
    C.select('accounts', `select=id,code,name,category,is_active,is_postable&workspace_id=eq.${wid}&order=code.asc`),
    C.select('account_roles', `select=role_key,account_id&workspace_id=eq.${wid}`),
    C.select('financial_accounts', `select=ledger_account_id,is_active&workspace_id=eq.${wid}`),
    C.select('fiscal_years', `select=id,name,date_from,date_to,status&workspace_id=eq.${wid}&order=date_from.desc`),
    C.select('invoices', `select=id,invoice_type,party_id,fiscal_year_id,status&workspace_id=eq.${wid}&order=created_at.desc&limit=500`)
  ]);

  cache = {
    company,
    parties: parties || [],
    accounts: accounts || [],
    roles: Object.fromEntries((roles || []).map(r => [r.role_key, r.account_id])),
    financialAccounts: financialAccounts || [],
    years: years || [],
    invoices: invoices || []
  };
  return cache;
}

function inferType(form, d = null) {
  if (requestedType) return requestedType;
  const current = d?.invoices?.find(x => x.id === editingInvoiceId);
  if (current?.invoice_type) return current.invoice_type;
  const text = form.closest('.modal')?.textContent || '';
  return text.includes('خرید') ? 'purchase' : 'sale';
}

function partyKindAllowed(type, kind) {
  return type === 'sale'
    ? kind === 'customer' || kind === 'both'
    : kind === 'vendor' || kind === 'both';
}

function allowedAccounts(d, type) {
  const financialIds = new Set(
    d.financialAccounts.filter(x => x.is_active).map(x => x.ledger_account_id)
  );
  const receivable = d.roles.receivable;
  const salesDiscount = d.roles.sales_discount;
  return d.accounts.filter(a => {
    if (!a.is_active || !a.is_postable) return false;
    if (type === 'sale') return a.category === 'income' && a.id !== salesDiscount;
    return (a.category === 'expense' || a.category === 'asset')
      && a.id !== receivable
      && !financialIds.has(a.id);
  });
}

function accountOptions(rows, selected = '') {
  return '<option value="">انتخاب حساب…</option>' + rows.map(a =>
    `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${esc(a.code)} — ${esc(a.name)}</option>`
  ).join('');
}

async function syncAccountSelects(form, d, type) {
  const rows = allowedAccounts(d, type);
  const fallback = type === 'sale' ? d.roles.default_income : d.roles.default_expense;
  form.querySelectorAll('[data-invoice-line]').forEach(row => {
    const select = row.querySelector('[name="account"]');
    if (!select) return;
    const previous = select.value;
    select.innerHTML = accountOptions(rows, previous);
    if (rows.some(a => a.id === previous)) select.value = previous;
    else if (fallback && rows.some(a => a.id === fallback)) select.value = fallback;
  });
}

function partyOptions(d, type, selected = '') {
  const rows = d.parties.filter(p => p.is_active && partyKindAllowed(type, p.kind));
  const placeholder = rows.length
    ? 'انتخاب طرف‌حساب…'
    : 'طرف‌حساب مناسب ثبت نشده — از «＋ طرف‌حساب» بسازید';
  return `<option value="">${placeholder}</option>` + rows.map(p =>
    `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');
}

function ensurePartyEditor(form, d, type, selected = '') {
  const select = form.querySelector('[name="party"]');
  if (!select) return;

  const wanted = selected || select.value;
  select.innerHTML = partyOptions(d, type, wanted);
  if (wanted && [...select.options].some(o => o.value === wanted)) select.value = wanted;

  const field = select.closest('.field');
  if (!field) return;
  field.classList.add('rc14i-party-field');

  let tools = field.querySelector('[data-rc14i-party-tools]');
  if (!tools) {
    tools = document.createElement('div');
    tools.className = 'rc14i-party-tools';
    tools.dataset.rc14iPartyTools = '1';
    tools.innerHTML = `
      <button type="button" class="ghost small" data-rc14i-new-party>＋ طرف‌حساب</button>
      <small>طرف‌حساب از شرکت فعال خوانده می‌شود.</small>
      <div class="rc14i-party-editor" data-rc14i-party-editor hidden>
        <input name="rc14i_party_name" placeholder="نام طرف‌حساب" maxlength="180">
        <select name="rc14i_party_kind">
          <option value="customer">مشتری</option>
          <option value="vendor">فروشنده</option>
          <option value="both">مشتری و فروشنده</option>
        </select>
        <input name="rc14i_party_phone" placeholder="تلفن (اختیاری)" maxlength="60" inputmode="tel">
        <button type="button" class="primary small" data-rc14i-save-party>ذخیره</button>
        <button type="button" class="ghost small" data-rc14i-cancel-party>بستن</button>
      </div>`;
    field.append(tools);
  }

  const editor = tools.querySelector('[data-rc14i-party-editor]');
  const kind = tools.querySelector('[name="rc14i_party_kind"]');
  if (kind) kind.value = type === 'sale' ? 'customer' : 'vendor';

  tools.querySelector('[data-rc14i-new-party]').onclick = () => {
    editor.hidden = !editor.hidden;
    if (!editor.hidden) tools.querySelector('[name="rc14i_party_name"]')?.focus();
  };
  tools.querySelector('[data-rc14i-cancel-party]').onclick = () => { editor.hidden = true; };
  tools.querySelector('[data-rc14i-save-party]').onclick = async () => {
    const name = String(tools.querySelector('[name="rc14i_party_name"]')?.value || '').trim();
    const partyKind = tools.querySelector('[name="rc14i_party_kind"]')?.value || (type === 'sale' ? 'customer' : 'vendor');
    const phone = String(tools.querySelector('[name="rc14i_party_phone"]')?.value || '').trim();
    if (!name) return toast('نام طرف‌حساب را وارد کنید');
    try {
      const inserted = await C.insert('parties', {
        workspace_id: d.company.id,
        name,
        kind: partyKind,
        phone: phone || null
      }, 'id');
      const id = inserted?.[0]?.id;
      cache = null;
      const fresh = await activeData(true);
      ensurePartyEditor(form, fresh, type, id || '');
      toast('طرف‌حساب ثبت و انتخاب شد');
    } catch (err) {
      showError(err, 'invoice inline party');
    }
  };
}

function stockPurchaseDefault(form, d, type) {
  if (type !== 'purchase') return;
  const inventoryAsset = d.roles.inventory_asset;
  if (!inventoryAsset) return;
  form.querySelectorAll('[data-invoice-line]').forEach(row => {
    const item = row.querySelector('[data-e-item]');
    const account = row.querySelector('[name="account"]');
    if (!item || !account || !item.value) return;
    if ([...account.options].some(o => o.value === inventoryAsset)) account.value = inventoryAsset;
  });
}

async function enhance(form) {
  if (!form || form.dataset.rc14iEnhancing === '1') return;
  form.dataset.rc14iEnhancing = '1';
  try {
    const d = await activeData();
    const type = inferType(form, d);
    form.dataset.rc14InvoiceWindow = '1';
    form.dataset.rc14InvoiceType = type;

    let selectedParty = form.querySelector('[name="party"]')?.value || '';
    if (editingInvoiceId) {
      const inv = d.invoices.find(x => x.id === editingInvoiceId);
      if (inv) selectedParty = inv.party_id || '';
    }

    ensurePartyEditor(form, d, type, selectedParty);
    await syncAccountSelects(form, d, type);
    stockPurchaseDefault(form, d, type);

    const lines = form.querySelector('#invoiceLines') || form;
    if (!lines.dataset.rc14iObserver) {
      lines.dataset.rc14iObserver = '1';
      new MutationObserver(async mutations => {
        if (!mutations.some(m => m.addedNodes.length)) return;
        try {
          const fresh = await activeData();
          const currentType = inferType(form, fresh);
          await syncAccountSelects(form, fresh, currentType);
          stockPurchaseDefault(form, fresh, currentType);
        } catch (err) {
          console.warn('[RC1.4 invoice window] line sync failed', err);
        }
      }).observe(lines, { childList: true, subtree: true });
    }

    form.addEventListener('change', e => {
      if (!e.target.closest?.('[data-e-item]')) return;
      stockPurchaseDefault(form, d, type);
    });
  } catch (err) {
    showError(err, 'invoice active-company UI');
  } finally {
    delete form.dataset.rc14iEnhancing;
  }
}

async function saveInvoice(form, submitter) {
  try {
    const d = await activeData();
    const type = inferType(form, d);
    const fd = new FormData(form);
    const date = String(fd.get('date') || '');
    const partyId = String(fd.get('party') || '');
    if (!partyId) return toast('طرف‌حساب را انتخاب یا در همین پنجره ثبت کنید');

    const rows = [];
    for (const row of form.querySelectorAll('[data-invoice-line]')) {
      const accountId = row.querySelector('[name="account"]')?.value || '';
      const description = row.querySelector('[name="description"]')?.value.trim() || '';
      const rawPrice = row.querySelector('[name="unit_price"]')?.value || '';
      if (!accountId && !description && !String(rawPrice).trim()) continue;

      const quantity = cleanDecimal(row.querySelector('[name="quantity"]')?.value || '1', 6);
      const unitPrice = cleanInteger(rawPrice);
      const discount = cleanInteger(row.querySelector('[name="discount"]')?.value || '0');
      if (!accountId || !quantity || Number(quantity) <= 0 || !unitPrice || BigInt(unitPrice) <= 0n || discount === null) {
        return toast('اطلاعات یکی از ردیف‌های فاکتور معتبر نیست');
      }

      rows.push({
        account_id: accountId,
        description,
        quantity,
        unit_price: unitPrice,
        discount,
        item_id: row.dataset.eItem || row.querySelector('[data-e-item]')?.value || null,
        unit_id: row.dataset.eUnit || null,
        warehouse_id: row.querySelector('[data-e-wh]')?.value || null,
        receipt_line_id: row.querySelector('[data-e-rec]')?.value || null
      });
    }
    if (!rows.length) return toast('حداقل یک ردیف فاکتور وارد کنید');

    let fiscalYearId = null;
    if (editingInvoiceId) {
      const inv = d.invoices.find(x => x.id === editingInvoiceId);
      fiscalYearId = inv?.fiscal_year_id || null;
      if (!inv) throw new Error('INVOICE_NOT_IN_ACTIVE_COMPANY');
    }
    fiscalYearId ||= d.years.find(y => date >= y.date_from && date <= y.date_to)?.id
      || d.years.find(y => y.status === 'open')?.id;
    if (!fiscalYearId) return toast('سال مالی معتبر برای تاریخ فاکتور پیدا نشد');

    const id = await C.rpc('save_draft_invoice', {
      p_workspace_id: d.company.id,
      p_fiscal_year_id: fiscalYearId,
      p_invoice_id: editingInvoiceId || null,
      p_invoice_type: type,
      p_invoice_date: date,
      p_due_date: fd.get('due') || null,
      p_party_id: partyId,
      p_description: fd.get('description') || null,
      p_lines: rows
    });

    const mode = submitter?.dataset?.invoiceSave || 'draft';
    if (mode === 'post') await C.rpc('post_invoice', { iid: id });
    closeModal();
    sessionStorage.setItem(
      'avan.rc14i.invoice.notice',
      mode === 'post' ? 'فاکتور ثبت قطعی شد' : 'فاکتور ذخیره شد'
    );
    location.reload();
  } catch (err) {
    showError(err, 'invoice active-company save');
  }
}

function install() {
  document.addEventListener('click', e => {
    if (e.target.closest?.('#newSaleInvoice')) {
      requestedType = 'sale';
      editingInvoiceId = null;
    } else if (e.target.closest?.('#newPurchaseInvoice')) {
      requestedType = 'purchase';
      editingInvoiceId = null;
    } else {
      const edit = e.target.closest?.('[data-edit-invoice]');
      if (edit) {
        editingInvoiceId = edit.dataset.editInvoice || null;
        requestedType = null;
      }
    }
  }, true);

  document.addEventListener('submit', e => {
    const form = e.target;
    if (form?.id !== 'invoiceForm' || form.dataset.rc14InvoiceWindow !== '1') return;

    // Quantities with >3 decimals are already intercepted by the earlier RC1.4 inventory bridge.
    const hasHighPrecision = [...form.querySelectorAll('[data-invoice-line]')].some(row => {
      if (!(row.dataset.eItem || row.querySelector('[data-e-item]')?.value)) return false;
      const raw = faToLatin(row.querySelector('[name="quantity"]')?.value || '').replace(/٫|,/g, '.');
      return (raw.split('.')[1] || '').length > 3;
    });
    if (hasHighPrecision) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    saveInvoice(form, e.submitter);
  }, true);

  new MutationObserver(() => {
    const form = document.getElementById('invoiceForm');
    if (form && form.dataset.rc14InvoiceWindow !== '1') enhance(form);
  }).observe(document.body, { childList: true, subtree: true });

  window.addEventListener('avan:company-context-changed', () => {
    cache = null;
    requestedType = null;
    editingInvoiceId = null;
  });

  const notice = sessionStorage.getItem('avan.rc14i.invoice.notice');
  if (notice) {
    sessionStorage.removeItem('avan.rc14i.invoice.notice');
    setTimeout(() => toast(notice), 700);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
