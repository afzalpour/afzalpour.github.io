'use strict';

import { openModal, closeModal } from './src/ui/components/modal.js';
import { toast, showError } from './src/ui/feedback/toast.js';
import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const C = installAvanCloud();
const LEVEL_FA = Object.freeze({1:'کل',2:'معین',3:'تفصیلی ۱',4:'تفصیلی ۲'});
const MANAGE = new Set(['owner','manager','accountant']);
let scanBusy = false;

const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function snapshot(){
  const state = await C.companyContext.ensure();
  const company = state?.active_company;
  if (!company?.id) throw new Error('COMPANY_REQUIRED');
  const wid = company.id;
  const [accounts, role] = await Promise.all([
    C.select('accounts', `select=*&workspace_id=eq.${wid}&order=code.asc`),
    C.rpc('workspace_role', {wid})
  ]);
  return {company, accounts: accounts || [], role};
}

function accountsPage(){
  const h = document.querySelector('#content h2');
  return h?.textContent?.trim() === 'درخت حساب‌ها';
}

function codeFromRow(row){
  return row?.children?.[0]?.textContent?.trim() || '';
}

async function enhancePage(){
  if (!accountsPage()) return;
  const d = await snapshot();
  const root = document.getElementById('content');
  if (!root) return;

  const head = root.querySelector('.section-head');
  const subtitle = head?.querySelector('.muted');
  if (subtitle) subtitle.textContent = 'کل / معین / تفصیلی ۱ / تفصیلی ۲ — ثبت سند فقط روی آخرین حساب قابل‌ثبت انجام می‌شود.';

  if (head && !head.querySelector('[data-four-level-legend]')) {
    const legend = document.createElement('div');
    legend.dataset.fourLevelLegend = '1';
    legend.className = 'rc14-account-level-legend';
    legend.innerHTML = '<span>۱. کل</span><span>۲. معین</span><span>۳. تفصیلی ۱</span><span>۴. تفصیلی ۲</span><small>والدی که زیرحساب دارد، قابل ثبت مستقیم نیست.</small>';
    head.insertAdjacentElement('afterend', legend);
  }

  const byCode = new Map(d.accounts.map(a => [String(a.code), a]));
  root.querySelectorAll('table tbody tr').forEach(row => {
    const account = byCode.get(codeFromRow(row));
    if (!account) return;
    if (row.children[2]) row.children[2].textContent = LEVEL_FA[account.level] || `سطح ${account.level}`;
    row.dataset.accountLevel = String(account.level);
    row.dataset.accountPostable = account.is_postable ? '1' : '0';
    const nameCell = row.children[1];
    if (nameCell && account.level >= 3 && !nameCell.querySelector('.rc14-leaf-badge')) {
      const badge = document.createElement('span');
      badge.className = `rc14-leaf-badge ${account.is_postable ? 'leaf' : 'parent'}`;
      badge.textContent = account.is_postable ? 'قابل ثبت' : 'والد';
      nameCell.append(' ', badge);
    }
  });
}

function parentOptions(accounts){
  return accounts
    .filter(a => a.is_active && a.level < 4 && !(a.level === 3 && a.is_system))
    .map(a => `<option value="${a.id}">${esc(a.code)} — ${esc(a.name)} (${LEVEL_FA[a.level]})</option>`)
    .join('');
}

async function openCreateAccount(){
  try {
    const d = await snapshot();
    if (!MANAGE.has(d.role)) return toast('برای ساخت حساب دسترسی کافی ندارید.');
    openModal(`<h2>حساب جدید</h2>
      <div class="info-box">سطح حساب از روی والد تعیین می‌شود. ساختار آوان: <b>کل → معین → تفصیلی ۱ → تفصیلی ۲</b>. کد حساب نیز خودکار و یکتا تولید می‌شود.</div>
      <form id="rc14FourAccountForm">
        <div class="form-grid">
          <div class="field"><label>حساب والد</label><select name="parent_id" required><option value="">انتخاب حساب والد…</option>${parentOptions(d.accounts)}</select></div>
          <div class="field"><label>سطح حساب جدید</label><input name="level_preview" value="پس از انتخاب والد" disabled></div>
          <div class="field"><label>نام حساب</label><input name="name" required maxlength="200" placeholder="مثلاً شعبه مرکزی / سایز ۴۲ / پرسنل الف"></div>
          <div class="field"><label>کد</label><input value="توسط آوان تولید می‌شود" disabled></div>
        </div>
        <div class="form-actions"><button type="button" class="ghost" data-cancel>انصراف</button><button class="primary">ذخیره حساب</button></div>
      </form>`);
    const f = document.getElementById('rc14FourAccountForm');
    const parentSelect = f.elements.parent_id;
    const preview = f.elements.level_preview;
    const refresh = () => {
      const p = d.accounts.find(a => a.id === parentSelect.value);
      preview.value = p ? LEVEL_FA[p.level + 1] : 'پس از انتخاب والد';
    };
    parentSelect.addEventListener('change', refresh);
    f.querySelector('[data-cancel]')?.addEventListener('click', closeModal);
    f.onsubmit = async e => {
      e.preventDefault();
      const p = d.accounts.find(a => a.id === parentSelect.value);
      const name = String(f.elements.name.value || '').trim();
      if (!p) return toast('حساب والد معتبر نیست.');
      if (!name) return toast('نام حساب را وارد کنید.');
      const submit = f.querySelector('button.primary');
      submit.disabled = true;
      try {
        await C.insert('accounts', {
          workspace_id: d.company.id,
          parent_id: p.id,
          code: '',
          name,
          level: p.level + 1,
          category: p.category,
          normal_balance: p.normal_balance,
          is_postable: true,
          is_system: false,
          is_active: true
        });
        sessionStorage.setItem('avan.rc14.account.notice', `${LEVEL_FA[p.level + 1]} «${name}» ساخته شد.`);
        closeModal();
        location.reload();
      } catch (err) {
        submit.disabled = false;
        const msg = String(err?.message || err || '');
        if (msg.includes('ACCOUNT_PARENT_HAS_OPERATIONAL_BINDING')) return toast('این تفصیلی ۱ قبلاً گردش یا اتصال عملیاتی دارد و نمی‌تواند به والد تفصیلی ۲ تبدیل شود.');
        if (msg.includes('SYSTEM_OPERATIONAL_ACCOUNT_CANNOT_BECOME_PARENT')) return toast('حساب عملیاتی سیستمی را نمی‌توان والد تفصیلی ۲ کرد؛ یک تفصیلی ۱ جدید زیر معین مربوط بسازید.');
        if (msg.includes('MAX_ACCOUNT_LEVEL')) return toast('بیش از چهار سطح حساب مجاز نیست.');
        showError(err, 'four level account create');
      }
    };
  } catch (err) { showError(err, 'four level account modal'); }
}

function install(){
  document.addEventListener('click', e => {
    if (e.target.closest?.('#addAccount')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openCreateAccount();
    }
  }, true);

  const scan = async () => {
    if (scanBusy) return;
    scanBusy = true;
    try { await enhancePage(); } catch (err) { if (accountsPage()) console.warn('account hierarchy enhancer', err); }
    finally { scanBusy = false; }
  };
  new MutationObserver(() => queueMicrotask(scan)).observe(document.body, {childList:true,subtree:true});
  window.addEventListener('avan:company-context-changed', () => queueMicrotask(scan));
  const n = sessionStorage.getItem('avan.rc14.account.notice');
  if (n) { sessionStorage.removeItem('avan.rc14.account.notice'); setTimeout(() => toast(n), 700); }
  scan();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
