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
  return document.querySelector('#content h2')?.textContent?.trim() === 'درخت حساب‌ها';
}

function parentOptions(accounts){
  return accounts
    .filter(a => a.is_active && a.level < 4)
    .map(a => `<option value="${a.id}">${esc(a.code)} — ${esc(a.name)} (${LEVEL_FA[a.level] || `سطح ${a.level}`})</option>`)
    .join('');
}

async function enhancePage(){
  if (!accountsPage()) return;
  const d = await snapshot();
  const root = document.getElementById('content');
  if (!root) return;
  const head = root.querySelector('.section-head');
  const subtitle = head?.querySelector('.muted');
  if (subtitle) subtitle.textContent = 'کل / معین / تفصیلی ۱ / تفصیلی ۲ — ثبت فقط روی آخرین حساب قابل‌ثبت انجام می‌شود.';
  if (head && !root.querySelector('[data-four-level-legend]')) {
    const legend = document.createElement('div');
    legend.dataset.fourLevelLegend = '1';
    legend.className = 'rc14-account-level-legend';
    legend.innerHTML = '<span>۱. کل</span><span>۲. معین</span><span>۳. تفصیلی ۱</span><span>۴. تفصیلی ۲</span><small>والدی که زیرحساب دارد، قابل ثبت مستقیم نیست.</small>';
    head.insertAdjacentElement('afterend', legend);
  }
  const byCode = new Map(d.accounts.map(a => [String(a.code), a]));
  root.querySelectorAll('table tbody tr').forEach(row => {
    const code = row.children?.[0]?.textContent?.trim();
    const account = byCode.get(code);
    if (!account) return;
    if (row.children[2]) row.children[2].textContent = LEVEL_FA[account.level] || `سطح ${account.level}`;
    const nameCell = row.children[1];
    if (nameCell && account.level >= 3 && !nameCell.querySelector('.rc14-leaf-badge')) {
      const badge = document.createElement('span');
      badge.className = `rc14-leaf-badge ${account.is_postable ? 'leaf' : 'parent'}`;
      badge.textContent = account.is_postable ? 'قابل ثبت' : 'والد';
      nameCell.append(' ', badge);
    }
  });
}

async function openCreateAccount(){
  try {
    const d = await snapshot();
    if (!MANAGE.has(d.role)) return toast('برای ساخت حساب دسترسی کافی ندارید.');
    openModal(`<h2>حساب جدید</h2>
      <div class="info-box">سطح و کد حساب از روی والد تعیین می‌شود: <b>کل → معین → تفصیلی ۱ → تفصیلی ۲</b>.</div>
      <form id="rc14FourAccountFormV2">
        <div class="form-grid">
          <div class="field"><label>حساب والد</label><select name="parent_id" required><option value="">انتخاب حساب والد…</option>${parentOptions(d.accounts)}</select></div>
          <div class="field"><label>سطح حساب جدید</label><input name="level_preview" value="پس از انتخاب والد" disabled></div>
          <div class="field"><label>نام حساب</label><input name="name" required maxlength="200" placeholder="نام حساب جدید"></div>
          <div class="field"><label>کد پیشنهادی</label><input name="code_preview" value="پس از ذخیره توسط آوان تولید می‌شود" disabled></div>
        </div>
        <div class="form-actions"><button type="button" class="ghost" data-cancel>انصراف</button><button class="primary">ذخیره حساب</button></div>
      </form>`);
    const f = document.getElementById('rc14FourAccountFormV2');
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
        const created = await C.insert('accounts', {
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
        }, 'id,code,name,level,is_postable,parent_id');
        const row = created?.[0];
        const actualLevel = Number(row?.level || p.level + 1);
        sessionStorage.setItem('avan.rc14.account.notice', `${LEVEL_FA[actualLevel]} «${name}» با کد ${row?.code || 'خودکار'} ساخته شد.`);
        closeModal();
        location.reload();
      } catch (err) {
        submit.disabled = false;
        const msg = String(err?.message || err || '');
        if (msg.includes('ACCOUNT_PARENT_HAS_ACTIVITY')) return toast('این تفصیلی ۱ گردش مالی دارد و برای حفظ سابقه نمی‌تواند خودکار به والد تفصیلی ۲ تبدیل شود.');
        if (msg.includes('ACCOUNT_PARENT_INVENTORY_ROLE_BOUND')) return toast('این حساب نقش عملیاتی موجودی دارد و نمی‌تواند والد تفصیلی ۲ شود.');
        if (msg.includes('MAX_ACCOUNT_LEVEL')) return toast('بیش از چهار سطح حساب مجاز نیست.');
        showError(err, 'four level account create v2');
      }
    };
  } catch (err) { showError(err, 'four level account modal v2'); }
}

function install(){
  document.addEventListener('click', e => {
    if (!e.target.closest?.('#addAccount')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openCreateAccount();
  }, true);
  const scan = async () => {
    if (scanBusy) return;
    scanBusy = true;
    try { await enhancePage(); } catch (err) { if (accountsPage()) console.warn('account hierarchy v2', err); }
    finally { scanBusy = false; }
  };
  new MutationObserver(() => queueMicrotask(scan)).observe(document.body, {childList:true,subtree:true});
  window.addEventListener('avan:company-context-changed', () => queueMicrotask(scan));
  const n = sessionStorage.getItem('avan.rc14.account.notice');
  if (n) { sessionStorage.removeItem('avan.rc14.account.notice'); setTimeout(() => toast(n), 600); }
  scan();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
