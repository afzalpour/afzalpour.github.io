'use strict';

import { openModal, closeModal } from './src/ui/components/modal.js';
import { toast, showError } from './src/ui/feedback/toast.js';
import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const C = installAvanCloud();
const LEVEL_FA = Object.freeze({1:'کل',2:'معین',3:'تفصیلی ۱',4:'تفصیلی ۲'});
const MANAGE = new Set(['owner','manager','accountant']);
let scanBusy = false;
let enhancedTable = null;

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

function codeFromRow(row){ return row?.children?.[0]?.textContent?.trim() || ''; }

function nextCode(parent, accounts){
  if (!parent) return '';
  const children = accounts.filter(a => a.parent_id === parent.id && /^\d+$/.test(String(a.code || '')));
  if (parent.level === 2) {
    const suffixes = children.map(a => String(a.code).slice(String(parent.code).length)).filter(s => /^\d{1,2}$/.test(s)).map(Number);
    const n = Math.max(0, ...suffixes) + 1;
    return n <= 99 ? `${parent.code}${n}` : 'ظرفیت کد تکمیل است';
  }
  if (parent.level === 3) {
    const suffixes = children.map(a => String(a.code).slice(String(parent.code).length)).filter(s => /^\d{3}$/.test(s)).map(Number);
    const n = Math.max(0, ...suffixes) + 1;
    return n <= 999 ? `${parent.code}${String(n).padStart(3,'0')}` : 'ظرفیت کد تکمیل است';
  }
  if (parent.level === 1) {
    const nums = children.map(a => Number(a.code)).filter(Number.isFinite);
    const base = Number(parent.code);
    const n = nums.length ? Math.max(...nums) + 10 : base + 10;
    return String(n);
  }
  return '';
}

async function enhancePage(){
  if (!accountsPage()) return;
  const root = document.getElementById('content');
  const table = root?.querySelector('table');
  if (!root || !table || table === enhancedTable) return;

  const d = await snapshot();
  const head = root.querySelector('.section-head');
  const subtitle = head?.querySelector('.muted');
  if (subtitle) subtitle.textContent = 'کل / معین / تفصیلی ۱ / تفصیلی ۲ — ثبت سند فقط روی آخرین حساب قابل‌ثبت انجام می‌شود.';
  if (head && !root.querySelector('[data-four-level-legend]')) {
    const legend = document.createElement('div');
    legend.dataset.fourLevelLegend = '1';
    legend.className = 'rc14-account-level-legend';
    legend.innerHTML = '<span>۱. کل</span><span>۲. معین</span><span>۳. تفصیلی ۱</span><span>۴. تفصیلی ۲</span><small>والدی که زیرحساب دارد، قابل ثبت مستقیم نیست.</small>';
    head.insertAdjacentElement('afterend', legend);
  }

  const byCode = new Map(d.accounts.map(a => [String(a.code), a]));
  table.querySelectorAll('tbody tr').forEach(row => {
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
  enhancedTable = table;
}

function parentOptions(accounts){
  return accounts
    .filter(a => a.is_active && a.level < 4)
    .sort((a,b) => a.level - b.level || String(a.code).localeCompare(String(b.code),'fa'))
    .map(a => `<option value="${a.id}">${esc(a.code)} — ${esc(a.name)} (${LEVEL_FA[a.level]})</option>`)
    .join('');
}

async function openCreateAccount(){
  try {
    const d = await snapshot();
    if (!MANAGE.has(d.role)) return toast('برای ساخت حساب دسترسی کافی ندارید.');
    openModal(`<h2>حساب جدید</h2>
      <div class="info-box">سطح و کد از روی والد تعیین می‌شود: <b>کل → معین → تفصیلی ۱ → تفصیلی ۲</b>.</div>
      <form id="rc14FourAccountForm">
        <div class="form-grid">
          <div class="field"><label>حساب والد</label><select name="parent_id" required><option value="">انتخاب حساب والد…</option>${parentOptions(d.accounts)}</select></div>
          <div class="field"><label>سطح حساب جدید</label><input name="level_preview" value="پس از انتخاب والد" disabled></div>
          <div class="field"><label>کد پیشنهادی</label><input name="code_preview" value="پس از انتخاب والد" disabled></div>
          <div class="field"><label>نام حساب</label><input name="name" required maxlength="200" placeholder="مثلاً حساب جاری شعبه مرکزی"></div>
        </div>
        <div class="form-actions"><button type="button" class="ghost" data-cancel>انصراف</button><button class="primary">ذخیره حساب</button></div>
      </form>`);
    const f = document.getElementById('rc14FourAccountForm');
    const parentSelect = f.elements.parent_id;
    const levelPreview = f.elements.level_preview;
    const codePreview = f.elements.code_preview;
    const refresh = () => {
      const p = d.accounts.find(a => a.id === parentSelect.value);
      levelPreview.value = p ? LEVEL_FA[p.level + 1] : 'پس از انتخاب والد';
      codePreview.value = p ? nextCode(p, d.accounts) : 'پس از انتخاب والد';
    };
    parentSelect.addEventListener('change', refresh);
    f.querySelector('[data-cancel]')?.addEventListener('click', closeModal);
    f.onsubmit = async e => {
      e.preventDefault();
      const p = d.accounts.find(a => a.id === parentSelect.value);
      const name = String(f.elements.name.value || '').trim();
      if (!p) return toast('حساب والد معتبر نیست.');
      if (!name) return toast('نام حساب را وارد کنید.');
      if (p.level >= 4) return toast('تفصیلی ۲ نمی‌تواند زیرحساب دیگری داشته باشد.');
      const expectedLevel = p.level + 1;
      const submit = f.querySelector('button.primary');
      submit.disabled = true;
      try {
        const created = await C.insert('accounts', {
          workspace_id: d.company.id,
          parent_id: p.id,
          code: '',
          name,
          level: expectedLevel,
          category: p.category,
          normal_balance: p.normal_balance,
          is_postable: true,
          is_system: false,
          is_active: true
        });
        const account = Array.isArray(created) ? created[0] : created;
        if (!account || Number(account.level) !== expectedLevel || account.parent_id !== p.id) throw new Error('ACCOUNT_LEVEL_CONFIRMATION_FAILED');
        closeModal();
        toast(`${LEVEL_FA[account.level]} «${account.name}» با کد ${account.code} ساخته شد.`);
        enhancedTable = null;
        document.querySelector('[data-page="accounts"]')?.click();
      } catch (err) {
        submit.disabled = false;
        const msg = String(err?.message || err || '');
        if (msg.includes('ACCOUNT_PARENT_HAS_JOURNAL_HISTORY')) return toast('این تفصیلی ۱ گردش تاریخی دارد و تبدیل خودکار آن به والد تفصیلی ۲ مجاز نیست.');
        if (msg.includes('MAX_ACCOUNT_LEVEL')) return toast('بیش از چهار سطح حساب مجاز نیست.');
        if (msg.includes('ACCOUNT_CODE_SPACE_EXHAUSTED')) return toast('ظرفیت کدگذاری زیر این حساب تکمیل شده است.');
        showError(err, 'four level account create');
      }
    };
  } catch (err) { showError(err, 'four level account modal'); }
}

async function scan(){
  if (scanBusy || !accountsPage()) return;
  scanBusy = true;
  try { await enhancePage(); }
  catch (err) { if (accountsPage()) console.warn('account hierarchy enhancer', err); }
  finally { scanBusy = false; }
}

function scheduleAccountScan(){
  [0,60,180,450,900].forEach(ms => setTimeout(scan, ms));
}

function install(){
  document.addEventListener('click', e => {
    if (e.target.closest?.('#addAccount')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openCreateAccount();
      return;
    }
    if (e.target.closest?.('[data-page="accounts"]')) {
      enhancedTable = null;
      scheduleAccountScan();
    }
  }, true);
  window.addEventListener('avan:company-context-changed', () => {
    enhancedTable = null;
    scheduleAccountScan();
  });
  scheduleAccountScan();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
