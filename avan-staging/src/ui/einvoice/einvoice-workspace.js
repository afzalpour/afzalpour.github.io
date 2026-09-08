'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';
import { createEInvoiceService } from '../../application/einvoice/einvoice-service.js';
import { toast, showError } from '../feedback/toast.js';

const MANAGE = new Set(['owner', 'manager', 'accountant']);

export function installEInvoiceWorkspace({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanEInvoice?.installed) return globalObject.AvanEInvoice;

  const C = installAvanCloud({ globalObject });
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  const Service = createEInvoiceService(C);
  let viewingInvoiceId = null;
  let editingPartyId = null;
  let partyCache = null;
  let itemCache = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  async function context() {
    const state = await C.companyContext.ensure();
    const company = state?.active_company;
    if (!company?.id) throw new Error('COMPANY_REQUIRED');
    return company;
  }

  async function role(wid) {
    return C.rpc('workspace_role', { wid });
  }

  async function loadParty(id) {
    if (!id) return null;
    const company = await context();
    const key = `${company.id}:${id}`;
    if (partyCache?.key === key) return partyCache.row;
    const rows = await C.select(
      'parties',
      `select=id,national_id,economic_code,postal_code&workspace_id=eq.${company.id}&id=eq.${id}&limit=1`
    );
    const row = rows?.[0] || null;
    partyCache = { key, row };
    return row;
  }

  async function injectPartyFields() {
    const form = documentObject.getElementById('partyForm');
    if (!form || form.dataset.eInvoicePartyReady === '1') return;
    const grid = form.querySelector('.form-grid');
    if (!grid) return;

    try {
      const company = await context();
      const actorRole = await role(company.id);
      if (!MANAGE.has(actorRole)) return;
      const row = await loadParty(editingPartyId);

      form.dataset.eInvoicePartyReady = '1';
      const box = documentObject.createElement('div');
      box.dataset.eInvoicePartyFields = '1';
      box.style.display = 'contents';
      box.innerHTML = `
        <div class="field"><label>شناسه ملی / شماره ملی</label><input name="einvoice_national_id" maxlength="64" value="${esc(row?.national_id || '')}"><small>برای شناسایی خریدار در صورتحساب الکترونیکی</small></div>
        <div class="field"><label>کد اقتصادی</label><input name="einvoice_economic_code" maxlength="64" value="${esc(row?.economic_code || '')}"></div>
        <div class="field"><label>کد پستی</label><input name="einvoice_postal_code" maxlength="32" value="${esc(row?.postal_code || '')}"></div>
      `;
      grid.append(box);
    } catch (error) {
      console.warn('[EInvoice party fields]', error);
    }
  }

  function partyPayload(payload) {
    const form = documentObject.getElementById('partyForm');
    if (!form || !payload || typeof payload !== 'object') return payload;
    return {
      ...payload,
      national_id: form.querySelector('[name="einvoice_national_id"]')?.value?.trim() || null,
      economic_code: form.querySelector('[name="einvoice_economic_code"]')?.value?.trim() || null,
      postal_code: form.querySelector('[name="einvoice_postal_code"]')?.value?.trim() || null
    };
  }

  if (!C.operations.has('insert', 'einvoice.party-identity')) {
    C.operations.use('insert', 'einvoice.party-identity', ({ args, next }) => {
      const [table, payload, ...rest] = args;
      return next(table, table === 'parties' ? partyPayload(payload) : payload, ...rest);
    }, { priority: 240 });
  }
  if (!C.operations.has('update', 'einvoice.party-identity')) {
    C.operations.use('update', 'einvoice.party-identity', ({ args, next }) => {
      const [table, payload, filter, ...rest] = args;
      return next(table, table === 'parties' ? partyPayload(payload) : payload, filter, ...rest);
    }, { priority: 240 });
  }

  async function currentItemForForm(form) {
    const sku = form?.querySelector('[name="sku"]')?.value?.trim();
    if (!sku) return null;
    const company = await context();
    const key = `${company.id}:${sku}`;
    if (itemCache?.key === key) return itemCache.row;
    const rows = await C.select(
      'inventory_items',
      `select=id,sku,official_goods_service_id&workspace_id=eq.${company.id}&sku=eq.${encodeURIComponent(sku)}&limit=1`
    );
    const row = rows?.[0] || null;
    itemCache = { key, row };
    return row;
  }

  async function injectItemField() {
    const form = documentObject.getElementById('rc14ItemForm');
    if (!form || form.dataset.eInvoiceItemReady === '1') return;
    const grid = form.querySelector('.form-grid');
    if (!grid) return;

    try {
      const company = await context();
      const actorRole = await role(company.id);
      if (!MANAGE.has(actorRole)) return;
      const item = await currentItemForForm(form);
      form.dataset.eInvoiceItemReady = '1';
      const field = documentObject.createElement('div');
      field.className = 'field';
      field.dataset.eInvoiceItemField = '1';
      field.innerHTML = `<label>شناسه مالیاتی کالا / خدمت</label><input name="einvoice_goods_service_id" maxlength="64" inputmode="numeric" value="${esc(item?.official_goods_service_id || '')}"><small>شناسه رسمی متناظر با کالا/خدمت؛ نرخ در خود کالا هاردکد نمی‌شود.</small>`;
      grid.append(field);
    } catch (error) {
      console.warn('[EInvoice item field]', error);
    }
  }

  function itemPayload(payload) {
    const form = documentObject.getElementById('rc14ItemForm');
    if (!form || !payload || typeof payload !== 'object') return payload;
    const input = form.querySelector('[name="einvoice_goods_service_id"]');
    return input ? { ...payload, official_goods_service_id: input.value.trim() || null } : payload;
  }

  if (!C.operations.has('insert', 'einvoice.item-official-id')) {
    C.operations.use('insert', 'einvoice.item-official-id', ({ args, next }) => {
      const [table, payload, ...rest] = args;
      return next(table, table === 'inventory_items' ? itemPayload(payload) : payload, ...rest);
    }, { priority: 240 });
  }
  if (!C.operations.has('update', 'einvoice.item-official-id')) {
    C.operations.use('update', 'einvoice.item-official-id', ({ args, next }) => {
      const [table, payload, filter, ...rest] = args;
      return next(table, table === 'inventory_items' ? itemPayload(payload) : payload, filter, ...rest);
    }, { priority: 240 });
  }

  function resultHtml(result) {
    const errors = result?.errors || [];
    const warnings = result?.warnings || [];
    return `
      <div class="${result?.ok ? 'success-box' : 'error-box'}" style="display:block">
        <b>${result?.ok ? 'از نظر اطلاعات فعلی، آماده پیش‌ارسال است.' : 'برای آماده‌شدن صورتحساب، موارد زیر باید اصلاح شود.'}</b>
      </div>
      ${errors.length ? `<ul class="rc15-einvoice-issues">${errors.map(row => `<li>${row.line_no ? `ردیف ${Number(row.line_no).toLocaleString('fa-IR')}: ` : ''}${esc(row.message)}</li>`).join('')}</ul>` : ''}
      ${warnings.length ? `<div class="info-box"><b>یادآوری:</b><ul>${warnings.map(row => `<li>${esc(row.message)}</li>`).join('')}</ul></div>` : ''}
    `;
  }

  function historyHtml(rows) {
    if (!rows?.length) return '<div class="muted">هنوز پیش‌اعتبارسنجی ثبت نشده است.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>نوبت</th><th>نتیجه</th><th>نسخه Adapter</th><th>زمان</th></tr></thead><tbody>${rows.slice(0, 5).map(row => `<tr><td>${Number(row.attempt_no).toLocaleString('fa-IR')}</td><td>${row.status === 'ready' ? 'آماده' : 'نیازمند اصلاح'}</td><td>${esc(row.adapter_version || '—')}</td><td>${row.created_at ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.created_at)) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
  }

  async function renderInvoiceCard(force = false) {
    if (!viewingInvoiceId) return;
    const modal = documentObject.getElementById('modal');
    if (!modal || modal.querySelector('#invoiceForm')) return;
    const existing = modal.querySelector('[data-rc15-einvoice-card]');
    if (existing && !force) return;

    try {
      const candidate = await Service.candidate(viewingInvoiceId);
      if (!candidate.invoice || candidate.invoice.invoice_type !== 'sale') return;
      const history = await Service.history(viewingInvoiceId);
      const card = documentObject.createElement('section');
      card.className = 'card section rc15-einvoice-card';
      card.dataset.rc15EinvoiceCard = '1';
      card.innerHTML = `
        <div class="section-head"><div><h3>صورتحساب الکترونیکی</h3><span class="muted">پیش‌اعتبارسنجی نسخه‌دار؛ ارسال واقعی در این Gate غیرفعال است.</span></div><span class="badge">قالب ${esc(Service.manifest.reportedSpecVersion)}</span></div>
        <div class="form-grid section">
          <div class="field"><label>موضوع</label><select name="einvoice_subject" disabled><option value="original">اصلی</option></select></div>
          <div class="field"><label>الگو</label><select name="einvoice_pattern" disabled><option value="general">عمومی فروش کالا/خدمت</option></select></div>
          <div class="field"><label>قاعده ارسال</label><input name="einvoice_send_rule" maxlength="64" placeholder="در صورت الزام نسخه جاری"></div>
          <div class="field"><label>یادداشت ۱</label><input name="einvoice_note1" maxlength="30"></div>
          <div class="field"><label>یادداشت ۲</label><input name="einvoice_note2" maxlength="30"></div>
        </div>
        <div class="form-actions"><button type="button" class="primary" data-einvoice-precheck>بررسی آمادگی ارسال</button></div>
        <div data-einvoice-result class="section"></div>
        <div class="section"><h4>سوابق بررسی</h4><div data-einvoice-history>${historyHtml(history)}</div></div>
        <div class="info-box">هیچ دکمه «ارسال» در این مرحله وجود ندارد. کلید خصوصی، توکن یا گواهی نیز در مرورگر یا این تاریخچه ذخیره نمی‌شود.</div>
      `;
      if (existing) existing.replaceWith(card); else modal.append(card);

      card.querySelector('[data-einvoice-precheck]')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          const options = {
            subject: 'original',
            pattern: 'general',
            sendRule: card.querySelector('[name="einvoice_send_rule"]')?.value || '',
            note1: card.querySelector('[name="einvoice_note1"]')?.value || '',
            note2: card.querySelector('[name="einvoice_note2"]')?.value || ''
          };
          const precheck = await Service.prevalidate(viewingInvoiceId, options);
          await Service.recordPrecheck(viewingInvoiceId, precheck);
          card.querySelector('[data-einvoice-result]').innerHTML = resultHtml(precheck.result);
          const rows = await Service.history(viewingInvoiceId);
          card.querySelector('[data-einvoice-history]').innerHTML = historyHtml(rows);
          toast(precheck.result.ok ? 'پیش‌اعتبارسنجی با موفقیت انجام شد' : 'موارد نیازمند اصلاح مشخص شد');
        } catch (error) {
          showError(error, 'e-invoice precheck');
        } finally {
          if (button.isConnected) button.disabled = false;
        }
      });
    } catch (error) {
      console.warn('[EInvoice invoice card]', error);
    }
  }

  async function apply() {
    await injectPartyFields();
    await injectItemField();
    await renderInvoiceCard();
  }

  Lifecycle.use('einvoice:workspace', apply, { priority: 850 });

  documentObject.addEventListener('click', event => {
    const partyEdit = event.target.closest?.('[data-edit-party]');
    const addParty = event.target.closest?.('#addParty');
    const viewInvoice = event.target.closest?.('[data-view-invoice]');
    if (partyEdit) {
      editingPartyId = partyEdit.dataset.editParty || null;
      partyCache = null;
    } else if (addParty) {
      editingPartyId = null;
      partyCache = null;
    }
    if (viewInvoice) viewingInvoiceId = viewInvoice.dataset.viewInvoice || null;
  }, true);

  globalObject.addEventListener('avan:company-context-changed', () => {
    viewingInvoiceId = null;
    editingPartyId = null;
    partyCache = null;
    itemCache = null;
  });

  const api = Object.freeze({
    installed: true,
    manifest: Service.manifest,
    prevalidate: (invoiceId, options) => Service.prevalidate(invoiceId, options),
    history: invoiceId => Service.history(invoiceId),
    send: () => Service.send()
  });
  globalObject.AvanEInvoice = api;
  Lifecycle.schedule('einvoice-install', 'install');
  return api;
}
