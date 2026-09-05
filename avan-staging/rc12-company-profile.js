'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';
import { toast } from './src/ui/feedback/toast.js';

const cloud = installAvanCloud();
const BUCKET = 'avan-branding';
const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ENTITY_TYPE_FA = Object.freeze({
  individual: 'حقیقی',
  legal: 'حقوقی',
  other: 'سایر'
});

let workspace = null;
let role = '';
let profile = null;
let logoUrl = '';
let patchMissing = false;
let loadPromise = null;
let scheduled = null;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function clean(value) {
  const v = String(value ?? '').trim();
  return v || null;
}

function isPatchMissing(error) {
  const message = String(error?.message || error || '');
  const code = String(error?.code || '');
  return (
    error?.status === 404 ||
    code === 'PGRST202' ||
    message.includes('get_workspace_print_profile')
  );
}

function extension(file) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

function validateLogo(file) {
  if (!file) return;
  if (!LOGO_TYPES.has(file.type)) throw new Error('LOGO_TYPE_INVALID');
  if (!file.size || file.size > MAX_LOGO_SIZE) throw new Error('LOGO_SIZE_INVALID');
}

function profileSnapshot() {
  const p = profile || {};
  return Object.freeze({
    workspace_id: workspace?.id || '',
    workspace_name: workspace?.name || '',
    display_name: p.display_name || workspace?.name || '',
    legal_name: p.legal_name || '',
    entity_type: p.entity_type || '',
    registration_no: p.registration_no || '',
    national_id: p.national_id || '',
    economic_code: p.economic_code || '',
    tax_id: p.tax_id || '',
    phone: p.phone || '',
    email: p.email || '',
    postal_code: p.postal_code || '',
    province: p.province || '',
    city: p.city || '',
    address: p.address || '',
    invoice_footer: p.invoice_footer || '',
    logo_path: p.logo_path || '',
    logo_url: logoUrl || ''
  });
}

function stateKey() {
  const p = profileSnapshot();
  return JSON.stringify([
    patchMissing,
    role,
    p.workspace_id,
    p.display_name,
    p.legal_name,
    p.entity_type,
    p.registration_no,
    p.national_id,
    p.economic_code,
    p.tax_id,
    p.phone,
    p.email,
    p.postal_code,
    p.province,
    p.city,
    p.address,
    p.invoice_footer,
    p.logo_path,
    p.logo_url
  ]);
}

async function resolveWorkspace() {
  const user = await cloud.user();
  if (!user?.id) throw new Error('AUTH_REQUIRED');

  const rows = await cloud.select(
    'workspaces',
    'select=id,name,mode,created_at&order=created_at.asc'
  );

  const current = rows?.[0];
  if (!current?.id) throw new Error('WORKSPACE_REQUIRED');
  workspace = current;
  return current;
}

async function signedLogo(path) {
  if (!path) return '';
  try {
    return await cloud.signedFileUrl(BUCKET, path, 3600);
  } catch (error) {
    console.warn('[Avan company profile] logo signed URL failed', error);
    return '';
  }
}

async function loadProfile(force = false) {
  if (loadPromise) return loadPromise;
  if (profile && !force) return profileSnapshot();

  loadPromise = (async () => {
    try {
      const ws = await resolveWorkspace();
      role = await cloud.rpc('workspace_role', { wid: ws.id });

      try {
        profile = await cloud.rpc('get_workspace_print_profile', { wid: ws.id });
        patchMissing = false;
      } catch (error) {
        if (!isPatchMissing(error)) throw error;
        patchMissing = true;
        profile = { display_name: ws.name, logo_path: null };
      }

      logoUrl = await signedLogo(profile?.logo_path);
      return profileSnapshot();
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

function field(label, name, value, extra = '') {
  return `
    <div class="field">
      <label>${esc(label)}</label>
      <input name="${esc(name)}" value="${esc(value || '')}" ${extra}>
    </div>
  `;
}

function selectField(label, name, value, options) {
  return `
    <div class="field">
      <label>${esc(label)}</label>
      <select name="${esc(name)}">
        <option value="">انتخاب نشده</option>
        ${options.map(([key, title]) => `
          <option value="${esc(key)}" ${key === value ? 'selected' : ''}>${esc(title)}</option>
        `).join('')}
      </select>
    </div>
  `;
}

function identitySummary(p) {
  const location = [p.province, p.city].filter(Boolean).join('، ');
  const items = [
    p.legal_name,
    p.entity_type ? `نوع شخصیت: ${ENTITY_TYPE_FA[p.entity_type] || p.entity_type}` : '',
    p.national_id ? `شناسه ملی: ${p.national_id}` : '',
    p.economic_code ? `کد اقتصادی: ${p.economic_code}` : '',
    p.phone ? `تلفن: ${p.phone}` : '',
    location,
    p.address
  ].filter(Boolean);

  return items.length
    ? items.map(item => `<span>${esc(item)}</span>`).join('')
    : '<span class="muted">هنوز اطلاعات تکمیلی شرکت ثبت نشده است.</span>';
}

function settingsCardHtml() {
  const p = profileSnapshot();
  const canEdit = ['owner', 'manager'].includes(role);

  if (patchMissing) {
    return `
      <section class="section card avan-company-profile-card" data-avan-company-profile>
        <div class="section-head">
          <div>
            <h2>مشخصات شرکت و چاپ</h2>
            <span class="muted">هویت رسمی و تنظیمات پایه خروجی‌های شرکت</span>
          </div>
        </div>
        <div class="error-box">
          اتصال API مشخصات شرکت هنوز آماده نیست. اگر Patch مرحله RC1.3-B اجرا شده است،
          ممکن است Schema Cache سرویس Supabase هنوز تابع جدید را منتشر نکرده باشد.
        </div>
        <div class="form-actions">
          <span class="muted" id="avanCompanyRetryStatus"></span>
          <button type="button" class="primary" id="avanCompanyRetry">بررسی مجدد اتصال</button>
        </div>
      </section>
    `;
  }

  if (!canEdit) {
    return `
      <section class="section card avan-company-profile-card" data-avan-company-profile>
        <div class="section-head">
          <div>
            <h2>مشخصات شرکت و چاپ</h2>
            <span class="muted">ویرایش این بخش در اختیار مالک و مدیر است.</span>
          </div>
        </div>
        <div class="avan-company-profile-preview">
          ${p.logo_url ? `<img src="${esc(p.logo_url)}" alt="لوگوی شرکت">` : '<div class="avan-company-logo-fallback">آ</div>'}
          <div>
            <strong>${esc(p.display_name || p.workspace_name || '—')}</strong>
            <div class="avan-company-profile-summary">${identitySummary(p)}</div>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="section card avan-company-profile-card" data-avan-company-profile>
      <div class="section-head">
        <div>
          <h2>مشخصات شرکت و چاپ</h2>
          <span class="muted">هویت رسمی شرکت و تنظیمات مشترک خروجی‌های A4 و فاکتور.</span>
        </div>
      </div>

      <div class="avan-company-profile-preview">
        ${p.logo_url ? `<img src="${esc(p.logo_url)}" alt="لوگوی شرکت">` : '<div class="avan-company-logo-fallback">آ</div>'}
        <div>
          <strong>${esc(p.display_name || p.workspace_name || 'آوان')}</strong>
          <div class="avan-company-profile-summary">${identitySummary(p)}</div>
        </div>
      </div>

      <form id="avanCompanyProfileForm" class="section">
        <div class="form-grid">
          ${field('نام نمایشی شرکت', 'display_name', p.display_name || p.workspace_name, 'maxlength="160" required')}
          ${field('نام حقوقی', 'legal_name', p.legal_name, 'maxlength="200"')}
          ${selectField('نوع شخصیت', 'entity_type', p.entity_type, Object.entries(ENTITY_TYPE_FA))}
          ${field('شماره ثبت', 'registration_no', p.registration_no, 'maxlength="64"')}
          ${field('شناسه ملی', 'national_id', p.national_id, 'maxlength="64" inputmode="numeric"')}
          ${field('کد اقتصادی', 'economic_code', p.economic_code, 'maxlength="64" inputmode="numeric"')}
          ${field('شناسه/شماره مالیاتی', 'tax_id', p.tax_id, 'maxlength="96"')}
          ${field('تلفن', 'phone', p.phone, 'maxlength="64"')}
          ${field('ایمیل', 'email', p.email, 'maxlength="160" type="email"')}
          ${field('کد پستی', 'postal_code', p.postal_code, 'maxlength="32" inputmode="numeric"')}
          ${field('استان', 'province', p.province, 'maxlength="120"')}
          ${field('شهر', 'city', p.city, 'maxlength="120"')}
        </div>

        <div class="field section">
          <label>آدرس</label>
          <textarea name="address" rows="3" maxlength="600">${esc(p.address)}</textarea>
        </div>

        <div class="field section">
          <label>متن ثابت پایین فاکتور</label>
          <textarea name="invoice_footer" rows="3" maxlength="600" placeholder="مثلاً شرایط پرداخت، تشکر یا توضیح ثابت">${esc(p.invoice_footer)}</textarea>
          <small>اختیاری است و فقط در چاپ جزئیات فاکتور نمایش داده می‌شود.</small>
        </div>

        <div class="avan-company-logo-editor section">
          <div class="field">
            <label>لوگوی شرکت</label>
            <input id="avanCompanyLogoFile" type="file" accept="image/png,image/jpeg,image/webp">
            <small>PNG، JPG یا WEBP — حداکثر ۲ مگابایت. لوگو در Storage خصوصی شرکت نگهداری می‌شود.</small>
          </div>
          ${p.logo_path ? '<label class="avan-company-remove-logo"><input id="avanRemoveCompanyLogo" type="checkbox"> حذف لوگوی فعلی</label>' : ''}
        </div>

        <div class="form-actions">
          <span class="muted" id="avanCompanyProfileStatus"></span>
          <button class="primary" id="avanCompanyProfileSave">ذخیره مشخصات شرکت</button>
        </div>
      </form>
    </section>
  `;
}

async function retryConnection(button, status) {
  button.disabled = true;
  status.textContent = 'در حال بررسی…';

  try {
    await loadProfile(true);

    if (patchMissing) {
      status.textContent = 'RPC هنوز از API قابل مشاهده نیست؛ Migration باید بررسی شود.';
      button.disabled = false;
      return;
    }

    await renderSettingsCard({ force: true, ensureLoaded: false });
    toast('اتصال مشخصات شرکت برقرار شد.');
  } catch (error) {
    console.warn('[Avan company profile] retry failed', error);
    status.textContent = 'بررسی اتصال انجام نشد.';
    button.disabled = false;
  }
}

async function saveProfile(form) {
  if (!workspace?.id || !['owner', 'manager'].includes(role)) {
    toast('اجازه ویرایش مشخصات شرکت را ندارید.');
    return;
  }

  const save = document.getElementById('avanCompanyProfileSave');
  const status = document.getElementById('avanCompanyProfileStatus');
  const file = document.getElementById('avanCompanyLogoFile')?.files?.[0] || null;
  const removeLogo = Boolean(document.getElementById('avanRemoveCompanyLogo')?.checked);
  const oldPath = profile?.logo_path || null;
  let newPath = oldPath;
  let uploadedPath = null;

  if (save) save.disabled = true;
  if (status) status.textContent = 'در حال ذخیره…';

  try {
    validateLogo(file);

    if (file) {
      newPath = `${workspace.id}/logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension(file)}`;
      await cloud.uploadFile(BUCKET, newPath, file);
      uploadedPath = newPath;
    } else if (removeLogo) {
      newPath = null;
    }

    const data = new FormData(form);
    profile = await cloud.rpc('set_workspace_print_profile', {
      wid: workspace.id,
      p_profile: {
        display_name: clean(data.get('display_name')),
        legal_name: clean(data.get('legal_name')),
        entity_type: clean(data.get('entity_type')),
        registration_no: clean(data.get('registration_no')),
        national_id: clean(data.get('national_id')),
        economic_code: clean(data.get('economic_code')),
        tax_id: clean(data.get('tax_id')),
        phone: clean(data.get('phone')),
        email: clean(data.get('email')),
        postal_code: clean(data.get('postal_code')),
        province: clean(data.get('province')),
        city: clean(data.get('city')),
        address: clean(data.get('address')),
        invoice_footer: clean(data.get('invoice_footer')),
        logo_path: newPath
      }
    });
    patchMissing = false;

    if (oldPath && oldPath !== newPath) {
      try {
        await cloud.removeFiles(BUCKET, [oldPath]);
      } catch (cleanupError) {
        console.warn('[Avan company profile] old logo cleanup failed', cleanupError);
      }
    }

    logoUrl = await signedLogo(profile?.logo_path);
    window.dispatchEvent(new CustomEvent('avan:company-profile-updated', {
      detail: profileSnapshot()
    }));
    toast('مشخصات شرکت ذخیره شد.');
    await renderSettingsCard({ force: true, ensureLoaded: false });
  } catch (error) {
    if (uploadedPath) {
      try {
        await cloud.removeFiles(BUCKET, [uploadedPath]);
      } catch {
        // Best-effort rollback.
      }
    }

    console.error('AVAN_COMPANY_PROFILE_SAVE_FAILED', error);
    if (status) {
      status.textContent = error?.message === 'LOGO_TYPE_INVALID'
        ? 'فرمت لوگو مجاز نیست.'
        : error?.message === 'LOGO_SIZE_INVALID'
          ? 'حجم لوگو باید حداکثر ۲ مگابایت باشد.'
          : 'ذخیره انجام نشد.';
    }
    toast('ذخیره مشخصات شرکت انجام نشد.');
  } finally {
    if (save?.isConnected) save.disabled = false;
  }
}

function bindCard(card) {
  const form = card.querySelector('#avanCompanyProfileForm');
  if (form) {
    form.onsubmit = event => {
      event.preventDefault();
      saveProfile(form);
    };
  }

  const retry = card.querySelector('#avanCompanyRetry');
  const retryStatus = card.querySelector('#avanCompanyRetryStatus');
  if (retry && retryStatus) {
    retry.onclick = () => retryConnection(retry, retryStatus);
  }
}

async function renderSettingsCard({ force = false, ensureLoaded = true } = {}) {
  if (document.getElementById('pageTitle')?.textContent?.trim() !== 'تنظیمات') return;

  const content = document.getElementById('content');
  if (!content) return;

  if (ensureLoaded && !profile) {
    try {
      await loadProfile(false);
    } catch (error) {
      console.warn('[Avan company profile] load failed', error);
      return;
    }
  }

  const key = stateKey();
  const existing = content.querySelector('[data-avan-company-profile]');
  if (!force && existing?.dataset.avanCompanyState === key) return;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = settingsCardHtml().trim();
  const nextCard = wrapper.firstElementChild;
  if (!nextCard) return;

  nextCard.dataset.avanCompanyState = key;

  if (existing) existing.replaceWith(nextCard);
  else content.appendChild(nextCard);

  bindCard(nextCard);
}

async function backgroundLoad() {
  if (profile || loadPromise) return;
  const app = document.getElementById('appShell');
  if (!app || app.hidden) return;

  try {
    await loadProfile(false);
  } catch {
    // App bootstrap can still be settling; page changes will retry safely.
  }
}

function apply() {
  backgroundLoad();
  renderSettingsCard();
}

function schedule() {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(() => {
    scheduled = null;
    apply();
  }, 100);
}

function install() {
  const content = document.getElementById('content');
  const pageTitle = document.getElementById('pageTitle');
  const appShell = document.getElementById('appShell');

  if (content) {
    new MutationObserver(schedule).observe(content, { childList: true });
  }

  if (pageTitle) {
    new MutationObserver(schedule).observe(pageTitle, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  if (appShell) {
    new MutationObserver(schedule).observe(appShell, {
      attributes: true,
      attributeFilter: ['hidden']
    });
  }

  schedule();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}

window.AvanCompanyProfile = Object.freeze({
  snapshot: profileSnapshot,
  refresh: async () => {
    await loadProfile(true);
    await renderSettingsCard({ force: true, ensureLoaded: false });
    return profileSnapshot();
  }
});