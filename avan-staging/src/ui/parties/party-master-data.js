'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast, showError } from '../feedback/toast.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const cloud = HAS_BROWSER ? installAvanCloud() : null;

const KIND_FA = Object.freeze({
  customer: 'مشتری',
  vendor: 'فروشنده',
  both: 'مشتری و فروشنده',
  other: 'سایر'
});

const ENTITY_FA = Object.freeze({
  individual: 'شخص حقیقی',
  legal: 'شخص حقوقی',
  unspecified: 'تعیین‌نشده'
});

let installed = false;
let scheduled = false;
let generation = 0;
let state = Object.freeze({
  workspaceId: null,
  role: null,
  parties: Object.freeze([])
});

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function clean(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function pageIsParties() {
  return String(document.getElementById('pageTitle')?.textContent || '').trim() === 'طرف‌حساب‌ها';
}

function canEdit() {
  return ['owner', 'manager', 'accountant'].includes(state.role);
}

function partyCompleteness(party) {
  const requiredBase = [party.name, party.kind, party.entity_type, party.phone || party.email];
  if (party.entity_type === 'legal') {
    requiredBase.push(
      party.legal_name || party.name,
      party.national_id,
      party.registration_no,
      party.economic_code,
      party.tax_id,
      party.postal_code,
      party.address
    );
  } else if (party.entity_type === 'individual') {
    requiredBase.push(party.national_id, party.address);
  }
  const complete = requiredBase.every(Boolean) && party.entity_type !== 'unspecified';
  return complete ? 'کامل' : 'نیازمند تکمیل';
}

function completenessClass(party) {
  return partyCompleteness(party) === 'کامل' ? 'avan-party-complete' : 'avan-party-incomplete';
}

function cell(value) {
  return esc(value || '—');
}

function partyRows(parties) {
  if (!parties.length) {
    return '<tr><td colspan="18"><div class="empty">طرف‌حساب ثبت نشده است.</div></td></tr>';
  }

  return parties.map(party => `
    <tr data-party-master-row="${esc(party.id)}">
      <td class="avan-party-sticky-name"><b>${cell(party.name)}</b></td>
      <td>${esc(KIND_FA[party.kind] || 'سایر')}</td>
      <td><span class="badge ${party.entity_type === 'unspecified' ? 'avan-party-entity-missing' : ''}">${esc(ENTITY_FA[party.entity_type] || 'تعیین‌نشده')}</span></td>
      <td>${cell(party.legal_name)}</td>
      <td>${cell(party.national_id)}</td>
      <td>${cell(party.registration_no)}</td>
      <td>${cell(party.economic_code)}</td>
      <td>${cell(party.tax_id)}</td>
      <td>${cell(party.phone)}</td>
      <td>${cell(party.email)}</td>
      <td>${cell(party.postal_code)}</td>
      <td>${cell(party.province)}</td>
      <td>${cell(party.city)}</td>
      <td class="avan-party-address-cell">${cell(party.address)}</td>
      <td>${cell(party.contact_name)}</td>
      <td>${cell(party.website)}</td>
      <td>${party.is_active ? 'فعال' : 'بایگانی'}</td>
      <td><span class="${completenessClass(party)}">${partyCompleteness(party)}</span></td>
      <td>${canEdit()
        ? `<button type="button" class="ghost small" data-party-master-edit="${esc(party.id)}">ویرایش</button>`
        : '<span class="muted">فقط مشاهده</span>'}</td>
    </tr>
  `).join('');
}

function filtersHtml() {
  return `
    <div class="avan-party-toolbar section">
      <div class="field avan-party-search-field">
        <label for="avanPartySearch">جستجو</label>
        <input id="avanPartySearch" type="search" placeholder="نام، شناسه ملی، تلفن، کد اقتصادی…" autocomplete="off">
      </div>
      <div class="field">
        <label for="avanPartyKindFilter">نقش</label>
        <select id="avanPartyKindFilter">
          <option value="">همه</option>
          <option value="customer">مشتری</option>
          <option value="vendor">فروشنده</option>
          <option value="both">مشتری و فروشنده</option>
          <option value="other">سایر</option>
        </select>
      </div>
      <div class="field">
        <label for="avanPartyEntityFilter">ماهیت</label>
        <select id="avanPartyEntityFilter">
          <option value="">همه</option>
          <option value="individual">شخص حقیقی</option>
          <option value="legal">شخص حقوقی</option>
          <option value="unspecified">تعیین‌نشده</option>
        </select>
      </div>
    </div>
  `;
}

function pageHtml(parties) {
  const incompleteCount = parties.filter(party => partyCompleteness(party) !== 'کامل').length;
  return `
    <section class="section card avan-party-master-page" data-avan-party-master-page>
      <div class="section-head">
        <div>
          <h2>پرونده طرف‌حساب‌ها</h2>
          <span class="muted">اطلاعات هویتی، مالیاتی و ارتباطی برای گزارش‌گیری و اسناد مالی</span>
        </div>
        ${canEdit() ? '<button type="button" class="primary" data-party-master-add>＋ طرف‌حساب</button>' : ''}
      </div>

      <div class="grid4 section avan-party-summary-grid">
        <div class="card"><div class="kpi-label">کل طرف‌حساب‌ها</div><div class="kpi-value small-kpi">${parties.length.toLocaleString('fa-IR')}</div></div>
        <div class="card"><div class="kpi-label">اشخاص حقیقی</div><div class="kpi-value small-kpi">${parties.filter(p => p.entity_type === 'individual').length.toLocaleString('fa-IR')}</div></div>
        <div class="card"><div class="kpi-label">اشخاص حقوقی</div><div class="kpi-value small-kpi">${parties.filter(p => p.entity_type === 'legal').length.toLocaleString('fa-IR')}</div></div>
        <div class="card"><div class="kpi-label">نیازمند تکمیل</div><div class="kpi-value small-kpi ${incompleteCount ? 'neg' : ''}">${incompleteCount.toLocaleString('fa-IR')}</div></div>
      </div>

      ${filtersHtml()}

      <div class="avan-party-table-wrap">
        <table class="avan-party-master-table">
          <thead>
            <tr>
              <th>نام/عنوان</th>
              <th>نقش</th>
              <th>ماهیت</th>
              <th>نام رسمی/حقوقی</th>
              <th>کد ملی/شناسه ملی</th>
              <th>شماره ثبت</th>
              <th>کد اقتصادی</th>
              <th>شناسه/شماره مالیاتی</th>
              <th>تلفن</th>
              <th>ایمیل</th>
              <th>کدپستی</th>
              <th>استان</th>
              <th>شهر</th>
              <th>آدرس</th>
              <th>مسئول تماس</th>
              <th>وب‌سایت</th>
              <th>وضعیت</th>
              <th>تکمیل پرونده</th>
              <th>اقدام</th>
            </tr>
          </thead>
          <tbody id="avanPartyMasterBody">${partyRows(parties)}</tbody>
        </table>
      </div>

      ${!canEdit() ? '<div class="info-box section">دسترسی شما فقط مشاهده است؛ ویرایش اطلاعات طرف‌حساب برای مالک، مدیر و حسابدار فعال است.</div>' : ''}
    </section>
  `;
}

function field(label, name, value = '', extra = '') {
  return `
    <div class="field">
      <label>${esc(label)}</label>
      <input name="${esc(name)}" value="${esc(value || '')}" ${extra}>
    </div>
  `;
}

function selectField(label, name, value, options, { required = false, placeholder = null } = {}) {
  const placeholderHtml = placeholder !== null
    ? `<option value="" ${!value || value === 'unspecified' ? 'selected' : ''} disabled>${esc(placeholder)}</option>`
    : '';
  return `
    <div class="field">
      <label>${esc(label)}</label>
      <select name="${esc(name)}" ${required ? 'required' : ''}>
        ${placeholderHtml}
        ${options.map(([key, title]) => `<option value="${esc(key)}" ${key === value ? 'selected' : ''}>${esc(title)}</option>`).join('')}
      </select>
    </div>
  `;
}

function partyModalHtml(party = null) {
  const p = party || {};
  return `
    <div class="section-head">
      <div>
        <h2>${party ? 'ویرایش پرونده طرف‌حساب' : 'طرف‌حساب جدید'}</h2>
        <span class="muted">نقش تجاری و ماهیت حقوقی دو مشخصه مستقل هستند.</span>
      </div>
    </div>
    <form id="avanPartyMasterForm" data-party-id="${esc(p.id || '')}">
      <div class="form-grid">
        ${field('نام/عنوان نمایشی', 'name', p.name, 'maxlength="200" required')}
        ${selectField('نقش تجاری', 'kind', p.kind || 'customer', Object.entries(KIND_FA), { required: true })}
        ${selectField('ماهیت', 'entity_type', p.entity_type, [
          ['individual', 'شخص حقیقی'],
          ['legal', 'شخص حقوقی']
        ], { required: true, placeholder: 'حقیقی یا حقوقی را انتخاب کنید' })}
        ${field('نام رسمی/حقوقی', 'legal_name', p.legal_name, 'maxlength="200"')}
        ${field('کد ملی / شناسه ملی', 'national_id', p.national_id, 'maxlength="64" inputmode="numeric"')}
        ${field('شماره ثبت', 'registration_no', p.registration_no, 'maxlength="64" inputmode="numeric"')}
        ${field('کد اقتصادی', 'economic_code', p.economic_code, 'maxlength="64" inputmode="numeric"')}
        ${field('شناسه/شماره مالیاتی', 'tax_id', p.tax_id, 'maxlength="96"')}
        ${field('تلفن', 'phone', p.phone, 'maxlength="64"')}
        ${field('ایمیل', 'email', p.email, 'maxlength="160" type="email"')}
        ${field('کدپستی', 'postal_code', p.postal_code, 'maxlength="32" inputmode="numeric"')}
        ${field('استان', 'province', p.province, 'maxlength="120"')}
        ${field('شهر', 'city', p.city, 'maxlength="120"')}
        ${field('مسئول تماس', 'contact_name', p.contact_name, 'maxlength="160"')}
        ${field('وب‌سایت', 'website', p.website, 'maxlength="240" inputmode="url"')}
        ${selectField('وضعیت', 'is_active', p.is_active === false ? 'false' : 'true', [
          ['true', 'فعال'],
          ['false', 'بایگانی']
        ], { required: true })}
      </div>

      <div class="field section">
        <label>آدرس کامل</label>
        <textarea name="address" rows="3" maxlength="600">${esc(p.address || '')}</textarea>
      </div>

      ${p.entity_type === 'unspecified' ? '<div class="warning-box section">ماهیت این رکورد قدیمی هنوز تعیین نشده است. پیش از ذخیره، حقیقی یا حقوقی بودن را مشخص کنید.</div>' : ''}

      <div class="form-actions">
        <button type="button" class="ghost" id="avanPartyMasterCancel">انصراف</button>
        <button class="primary" id="avanPartyMasterSave">ذخیره پرونده</button>
      </div>
    </form>
  `;
}

function normalizedSearchText(party) {
  return [
    party.name, party.legal_name, party.national_id, party.registration_no,
    party.economic_code, party.tax_id, party.phone, party.email, party.postal_code,
    party.province, party.city, party.address, party.contact_name, party.website
  ].map(value => String(value || '').toLocaleLowerCase('fa-IR')).join(' ');
}

function applyFilters() {
  const query = String(document.getElementById('avanPartySearch')?.value || '').trim().toLocaleLowerCase('fa-IR');
  const kind = String(document.getElementById('avanPartyKindFilter')?.value || '');
  const entity = String(document.getElementById('avanPartyEntityFilter')?.value || '');
  const filtered = state.parties.filter(party =>
    (!query || normalizedSearchText(party).includes(query)) &&
    (!kind || party.kind === kind) &&
    (!entity || party.entity_type === entity)
  );
  const body = document.getElementById('avanPartyMasterBody');
  if (body) body.innerHTML = partyRows(filtered);
}

async function loadState() {
  const companyState = await cloud.companyContext.ensure();
  if (companyState?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
  const workspaceId = companyState?.active_company?.id;
  if (!workspaceId) throw new Error('COMPANY_REQUIRED');

  const [role, parties] = await Promise.all([
    cloud.rpc('workspace_role', { wid: workspaceId }),
    cloud.select(
      'parties',
      `select=id,name,kind,entity_type,legal_name,national_id,registration_no,economic_code,tax_id,phone,email,postal_code,province,city,address,contact_name,website,is_active,archived_at,created_at,updated_at&workspace_id=eq.${workspaceId}&order=name.asc`
    )
  ]);

  state = Object.freeze({
    workspaceId,
    role: String(role || ''),
    parties: Object.freeze((parties || []).map(item => Object.freeze({ ...item })))
  });
  return state;
}

function bindPage() {
  document.getElementById('avanPartySearch')?.addEventListener('input', applyFilters);
  document.getElementById('avanPartyKindFilter')?.addEventListener('change', applyFilters);
  document.getElementById('avanPartyEntityFilter')?.addEventListener('change', applyFilters);
}

function renderCurrentState() {
  if (!pageIsParties()) return false;
  const content = document.getElementById('content');
  if (!content) return false;
  content.innerHTML = pageHtml(state.parties);
  bindPage();
  return true;
}

async function refresh({ force = false } = {}) {
  if (!pageIsParties()) return false;
  const content = document.getElementById('content');
  if (!content) return false;
  if (!force && content.querySelector('[data-avan-party-master-page]')) return true;

  const ownGeneration = ++generation;
  try {
    await loadState();
    if (ownGeneration !== generation || !pageIsParties()) return false;
    return renderCurrentState();
  } catch (error) {
    console.warn('[Party master data]', error);
    if (pageIsParties()) {
      content.insertAdjacentHTML('afterbegin', '<div class="error-box section">پرونده کامل طرف‌حساب‌ها در حال حاضر قابل بارگذاری نیست.</div>');
    }
    return false;
  }
}

function openPartyModal(partyId = null) {
  if (!canEdit()) return;
  const party = partyId ? state.parties.find(item => item.id === partyId) || null : null;
  openModal(partyModalHtml(party));
  const cancel = document.getElementById('avanPartyMasterCancel');
  if (cancel) cancel.onclick = closeModal;
  const form = document.getElementById('avanPartyMasterForm');
  if (form) form.onsubmit = saveParty;
}

function formPayload(form) {
  const data = new FormData(form);
  const entityType = String(data.get('entity_type') || '');
  if (!['individual', 'legal'].includes(entityType)) {
    const error = new Error('PARTY_ENTITY_TYPE_REQUIRED');
    error.userMessage = 'ماهیت طرف‌حساب (حقیقی یا حقوقی) را مشخص کنید.';
    throw error;
  }

  return {
    name: String(data.get('name') || '').trim(),
    kind: String(data.get('kind') || 'other'),
    entity_type: entityType,
    legal_name: clean(data.get('legal_name')),
    national_id: clean(data.get('national_id')),
    registration_no: clean(data.get('registration_no')),
    economic_code: clean(data.get('economic_code')),
    tax_id: clean(data.get('tax_id')),
    phone: clean(data.get('phone')),
    email: clean(data.get('email')),
    postal_code: clean(data.get('postal_code')),
    province: clean(data.get('province')),
    city: clean(data.get('city')),
    address: clean(data.get('address')),
    contact_name: clean(data.get('contact_name')),
    website: clean(data.get('website')),
    is_active: String(data.get('is_active')) !== 'false'
  };
}

async function saveParty(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById('avanPartyMasterSave');
  if (button) button.disabled = true;

  try {
    const payload = formPayload(form);
    if (!payload.name) throw Object.assign(new Error('PARTY_NAME_REQUIRED'), { userMessage: 'نام/عنوان طرف‌حساب الزامی است.' });
    const now = new Date().toISOString();
    const partyId = String(form.dataset.partyId || '');
    const row = {
      ...payload,
      updated_at: now,
      archived_at: payload.is_active ? null : now
    };

    if (partyId) {
      await cloud.update('parties', row, `id=eq.${partyId}&workspace_id=eq.${state.workspaceId}`);
    } else {
      await cloud.insert('parties', {
        workspace_id: state.workspaceId,
        ...row
      });
    }

    closeModal();
    await refresh({ force: true });
    toast('پرونده طرف‌حساب ذخیره شد.');
  } catch (error) {
    if (error?.userMessage) toast(error.userMessage);
    else showError(error, 'party-master-save');
  } finally {
    if (button) button.disabled = false;
  }
}

function onClick(event) {
  const add = event.target?.closest?.('[data-party-master-add]');
  if (add) {
    event.preventDefault();
    openPartyModal();
    return;
  }
  const edit = event.target?.closest?.('[data-party-master-edit]');
  if (edit) {
    event.preventDefault();
    openPartyModal(String(edit.dataset.partyMasterEdit || ''));
  }
}

function scheduleRefresh() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    refresh().catch(error => console.warn('[Party master data refresh]', error));
  });
}

export function installPartyMasterData() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;
  document.addEventListener('click', onClick, true);
  window.addEventListener('avan:page-rendered', scheduleRefresh);
  window.addEventListener('avan:company-context-changed', () => {
    generation += 1;
    scheduleRefresh();
  });

  const content = document.getElementById('content');
  if (content) {
    const observer = new MutationObserver(() => {
      if (pageIsParties() && !content.querySelector('[data-avan-party-master-page]')) scheduleRefresh();
    });
    observer.observe(content, { childList: true, subtree: false });
  }

  scheduleRefresh();
  window.AvanPartyMasterData = Object.freeze({
    refresh: () => refresh({ force: true }),
    snapshot: () => state
  });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installPartyMasterData, { once: true });
  } else {
    installPartyMasterData();
  }
}
