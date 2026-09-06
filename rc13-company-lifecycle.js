'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';
import { openModal, closeModal } from './src/ui/components/modal.js';

const cloud = installAvanCloud();
const companyContext = cloud.companyContext;

const ADMIN_ROLES = new Set(['owner','manager','financial_manager']);
let observer = null;
let scheduled = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[ch]);

function statusText(error) {
  const text = String(error?.message || error || '');
  if (text.includes('COMPANY_NAME_REQUIRED')) return 'نام شرکت الزامی است.';
  if (text.includes('COMPANY_NAME_TOO_LONG')) return 'نام شرکت بیش از حد طولانی است.';
  if (text.includes('FISCAL_DATE_RANGE_INVALID')) return 'بازه سال مالی معتبر نیست.';
  if (text.includes('FISCAL_NAME_INVALID')) return 'نام سال مالی معتبر نیست.';
  if (text.includes('MONEY_UNIT_INVALID')) return 'واحد پول معتبر نیست.';
  if (text.includes('FORBIDDEN') || text.includes('COMPANY_OWNER_REQUIRED')) return 'برای این عملیات دسترسی کافی ندارید.';
  return 'عملیات شرکت انجام نشد. دوباره تلاش کنید.';
}

function onboardingHtml() {
  return `
    <div class="avan-company-onboarding">
      <span class="eyebrow">آوان · راه‌اندازی شرکت</span>
      <h2>ایجاد شرکت جدید</h2>
      <p class="muted">هر شرکت یک Tenant مالی مستقل با مالک، سال مالی، حساب‌های پایه و تنظیمات جداگانه است.</p>
      <form id="avanCreateCompanyForm">
        <div class="avan-onboarding-grid">
          <div class="field avan-onboarding-wide">
            <label>نام شرکت / کسب‌وکار</label>
            <input name="name" maxlength="160" autocomplete="organization" required placeholder="مثلاً شرکت آریا" />
          </div>
          <div class="field">
            <label>نام حقوقی (اختیاری)</label>
            <input name="legal_name" maxlength="200" />
          </div>
          <div class="field">
            <label>نوع شخصیت</label>
            <select name="entity_type">
              <option value="">انتخاب نشده</option>
              <option value="individual">حقیقی</option>
              <option value="legal">حقوقی</option>
              <option value="other">سایر</option>
            </select>
          </div>
          <div class="field">
            <label>استان</label>
            <input name="province" maxlength="120" />
          </div>
          <div class="field">
            <label>شهر</label>
            <input name="city" maxlength="120" />
          </div>
          <div class="field">
            <label>واحد نمایش پول</label>
            <select name="money_unit">
              <option value="toman">تومان</option>
              <option value="rial">ریال</option>
            </select>
          </div>
          <div class="field">
            <label>نام سال مالی</label>
            <input name="fiscal_name" value="۱۴۰۵" maxlength="80" required />
          </div>
          <div class="field">
            <label>شروع سال مالی</label>
            <input name="date_from" type="date" value="2026-03-21" required />
          </div>
          <div class="field">
            <label>پایان سال مالی</label>
            <input name="date_to" type="date" value="2027-03-20" required />
          </div>
        </div>
        <div class="info-box avan-onboarding-note">پس از ایجاد، شما مالک Company جدید می‌شوید. اطلاعات و Ledger این شرکت از تمام Companyهای دیگر جدا می‌ماند.</div>
        <div class="form-actions">
          <button type="button" class="ghost" id="avanCancelCreateCompany">انصراف</button>
          <button type="submit" class="primary" id="avanCreateCompanySubmit">ایجاد و ورود به شرکت</button>
        </div>
        <div id="avanCreateCompanyStatus" aria-live="polite"></div>
      </form>
    </div>
  `;
}

function openCreateCompany() {
  openModal(onboardingHtml());
  const form = document.getElementById('avanCreateCompanyForm');
  const cancel = document.getElementById('avanCancelCreateCompany');
  const submit = document.getElementById('avanCreateCompanySubmit');
  const status = document.getElementById('avanCreateCompanyStatus');

  if (cancel) cancel.onclick = () => closeModal();
  if (!form) return;

  form.onsubmit = async event => {
    event.preventDefault();
    if (submit) submit.disabled = true;
    if (status) status.textContent = 'در حال ایجاد Tenant و راه‌اندازی Core…';

    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const profile = {
      legal_name: String(fd.get('legal_name') || '').trim() || null,
      entity_type: String(fd.get('entity_type') || '').trim() || null,
      province: String(fd.get('province') || '').trim() || null,
      city: String(fd.get('city') || '').trim() || null
    };

    try {
      const result = await cloud.rpc('create_avan_company', {
        p_name: name,
        p_money_unit: String(fd.get('money_unit') || 'toman'),
        p_fiscal_name: String(fd.get('fiscal_name') || '').trim(),
        p_date_from: String(fd.get('date_from') || ''),
        p_date_to: String(fd.get('date_to') || ''),
        p_profile: profile
      });
      const id = result?.company_id || result?.workspace_id;
      if (!id) throw new Error('COMPANY_CREATE_RESULT_INVALID');

      if (status) status.innerHTML = '<span class="success-box" style="display:block">شرکت با موفقیت ایجاد شد. در حال ورود…</span>';
      await companyContext.refresh({ force: true });
      await companyContext.selectCompany(id, { emit: false });
      location.reload();
    } catch (error) {
      console.error('[Avan MT-B] create company failed', error);
      if (status) status.innerHTML = `<span class="error-box" style="display:block">${esc(statusText(error))}</span>`;
      if (submit) submit.disabled = false;
    }
  };
}

function renameHtml(company) {
  return `
    <div class="avan-company-onboarding">
      <span class="eyebrow">آوان · Company Identity</span>
      <h2>تغییر نام شرکت</h2>
      <p class="muted">این نام در Company Portfolio و هویت نمایشی شرکت همگام می‌شود.</p>
      <form id="avanRenameCompanyForm">
        <div class="field">
          <label>نام جدید</label>
          <input name="name" maxlength="160" required value="${esc(company.display_name || company.name || '')}" />
        </div>
        <div class="form-actions">
          <button type="button" class="ghost" id="avanCancelRenameCompany">انصراف</button>
          <button type="submit" class="primary" id="avanRenameCompanySubmit">ذخیره نام</button>
        </div>
        <div id="avanRenameCompanyStatus" aria-live="polite"></div>
      </form>
    </div>
  `;
}

function openRenameCompany(company) {
  if (!company?.id || !ADMIN_ROLES.has(company.role)) return;
  openModal(renameHtml(company));
  const form = document.getElementById('avanRenameCompanyForm');
  const cancel = document.getElementById('avanCancelRenameCompany');
  const submit = document.getElementById('avanRenameCompanySubmit');
  const status = document.getElementById('avanRenameCompanyStatus');
  if (cancel) cancel.onclick = () => closeModal();
  if (!form) return;

  form.onsubmit = async event => {
    event.preventDefault();
    if (submit) submit.disabled = true;
    if (status) status.textContent = 'در حال ذخیره…';
    const fd = new FormData(form);
    try {
      await cloud.rpc('rename_avan_company', {
        wid: company.id,
        p_name: String(fd.get('name') || '').trim()
      });
      if (status) status.innerHTML = '<span class="success-box" style="display:block">نام شرکت ذخیره شد.</span>';
      await companyContext.refresh({ force: true });
      window.dispatchEvent(new CustomEvent('avan:company-profile-updated', { detail: { company_id: company.id } }));
      setTimeout(() => location.reload(), 250);
    } catch (error) {
      console.error('[Avan MT-B] rename company failed', error);
      if (status) status.innerHTML = `<span class="error-box" style="display:block">${esc(statusText(error))}</span>`;
      if (submit) submit.disabled = false;
    }
  };
}

function injectLifecycleActions() {
  const overlay = document.getElementById('avanCompanyPortfolio');
  if (!overlay) return;

  const foot = overlay.querySelector('.avan-company-portfolio-foot');
  if (foot && !foot.querySelector('#avanCreateCompanyButton')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'avanCreateCompanyButton';
    button.className = 'primary avan-create-company-button';
    button.textContent = '＋ ایجاد شرکت جدید';
    button.onclick = openCreateCompany;
    foot.prepend(button);
  }

  const companies = companyContext.list();
  overlay.querySelectorAll('.avan-company-portfolio-card').forEach(card => {
    if (card.querySelector('[data-rename-company]')) return;
    const enter = card.querySelector('[data-enter-company]');
    const id = enter?.dataset.enterCompany;
    const company = companies.find(item => item.id === id);
    if (!company || !ADMIN_ROLES.has(company.role)) return;

    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'ghost avan-rename-company-button';
    action.dataset.renameCompany = id;
    action.textContent = 'تغییر نام';
    action.onclick = () => openRenameCompany(company);
    enter?.insertAdjacentElement('beforebegin', action);
  });
}

function scheduleInject() {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(() => {
    scheduled = null;
    injectLifecycleActions();
  }, 30);
}

function install() {
  observer = new MutationObserver(scheduleInject);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleInject();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}

window.AvanCompanyLifecycle = Object.freeze({
  create: openCreateCompany,
  rename: companyId => {
    const company = companyContext.list().find(item => item.id === companyId);
    if (company) openRenameCompany(company);
  }
});
