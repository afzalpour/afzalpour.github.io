'use strict';

import { createSupabaseClient } from './src/infrastructure/supabase/supabase-client.js';

const client = createSupabaseClient({ config: window.AVAN_CONFIG || {}, storage: localStorage });
const host = document.getElementById('platformTaxRules');
let role = '';
let rules = [];

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
const faDate = value => {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(`${value}T12:00:00`)); }
  catch { return String(value); }
};
const faNum = value => Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits: 4 });
const statusFa = value => ({ active:'منتشرشده', draft:'پیش‌نویس', retired:'بازنشسته' }[value] || 'نامشخص');

function currentRule() {
  const today = new Date().toISOString().slice(0, 10);
  return rules.filter(rule => rule.status === 'active' && rule.effective_from <= today && (!rule.effective_to || today <= rule.effective_to))
    .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)) || Number(b.version_no) - Number(a.version_no))[0] || null;
}

function rowsHtml() {
  if (!rules.length) return '<tr><td colspan="8" class="empty">هنوز قانونی تعریف نشده است.</td></tr>';
  return rules.map(rule => `<tr><td>${esc(rule.rule_code)}</td><td>${Number(rule.version_no).toLocaleString('fa-IR')}</td><td>${esc(rule.name_fa)}</td><td>${faDate(rule.effective_from)}${rule.effective_to ? ` تا ${faDate(rule.effective_to)}` : ' به بعد'}</td><td class="platform-tax-rate">${faNum(rule.standard_vat_rate)}٪</td><td><span class="badge ${rule.status === 'active' ? 'ok' : ''}">${statusFa(rule.status)}</span></td><td class="platform-tax-source">${esc(rule.source_title || '—')}<br><small>${esc(rule.source_reference || '')}</small></td><td>${rule.status === 'draft' && role === 'platform_owner' ? `<button class="primary small" data-publish-tax-rule="${rule.id}">انتشار</button>` : '—'}</td></tr>`).join('');
}

function render() {
  if (!host) return;
  const current = currentRule();
  host.innerHTML = `<div class="panel-head"><div><h2>مرکز قوانین مالیاتی آوان</h2><p>قوانین مالیاتی به‌صورت نسخه‌ای و تاریخ‌دار نگهداری می‌شوند. نرخ‌های قبلی بازنویسی نمی‌شوند و فاکتور براساس تاریخ خودش قانون مؤثر را دریافت می‌کند.</p></div></div>${current ? `<div class="control-note platform-tax-note">قانون مؤثر امروز: <b>${esc(current.name_fa)}</b> — ${faNum(current.standard_vat_rate)}٪ — از ${faDate(current.effective_from)}${current.effective_to ? ` تا ${faDate(current.effective_to)}` : ''}</div>` : '<div class="control-note platform-tax-note">برای تاریخ امروز قانون فعالی وجود ندارد.</div>'}<form id="platformTaxRuleForm" class="platform-tax-form"><div class="field"><label>کد خانواده قانون</label><input name="rule_code" value="IR_GENERAL_VAT" required maxlength="64"></div><div class="field"><label>نام فارسی نسخه</label><input name="name_fa" required maxlength="160" placeholder="مثلاً نرخ عمومی مالیات بر ارزش افزوده ۱۴۰۶"></div><div class="field"><label>شروع اثر</label><input type="date" name="effective_from" required></div><div class="field"><label>پایان اثر</label><input type="date" name="effective_to"></div><div class="field"><label>نرخ عمومی</label><input type="number" name="rate" min="0" max="100" step="0.0001" required></div><div class="field"><label>عنوان منبع قانونی</label><input name="source_title" maxlength="200"></div><div class="field"><label>شماره/مرجع قانونی</label><input name="source_reference" maxlength="240"></div><div class="field"><label>سال مالیاتی</label><input type="number" name="tax_year" min="1300" max="1600" inputmode="numeric"></div><div class="form-actions"><button class="primary">ذخیره پیش‌نویس قانون</button></div></form><div class="control-note platform-tax-note">انتشار نسخه جدید فقط توسط مالک سامانه انجام می‌شود. هنگام انتشار، اگر نسخه قبلی بازه باز داشته باشد، پایان اثر آن به روز قبل از شروع نسخه جدید محدود می‌شود؛ نرخ و Snapshot اسناد تاریخی تغییر نمی‌کند.</div><div class="table-wrap"><table class="operations-table platform-tax-table"><thead><tr><th>خانواده</th><th>نسخه</th><th>نام</th><th>بازه اثر</th><th>نرخ</th><th>وضعیت</th><th>منبع</th><th>اقدام</th></tr></thead><tbody>${rowsHtml()}</tbody></table></div>`;
  bind();
}

function bind() {
  const form = document.getElementById('platformTaxRuleForm');
  if (form) form.addEventListener('submit', async event => {
    event.preventDefault();
    const fd = new FormData(form);
    const taxYear = Number(fd.get('tax_year') || 0) || null;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await client.rpc('platform_admin_create_tax_rule', {
        p_rule_code: String(fd.get('rule_code') || '').trim(),
        p_name_fa: String(fd.get('name_fa') || '').trim(),
        p_effective_from: fd.get('effective_from'),
        p_effective_to: fd.get('effective_to') || null,
        p_standard_vat_rate: Number(fd.get('rate')),
        p_source_title: String(fd.get('source_title') || '').trim() || null,
        p_source_reference: String(fd.get('source_reference') || '').trim() || null,
        p_rule_payload: taxYear ? { tax_year: taxYear, jurisdiction: 'IR', rate_basis: 'general_vat' } : { jurisdiction: 'IR' }
      });
      form.reset();
      form.rule_code.value = 'IR_GENERAL_VAT';
      await load();
      alert('پیش‌نویس قانون مالیاتی ذخیره شد.');
    } catch (error) {
      console.error(error);
      alert('ذخیره پیش‌نویس قانون انجام نشد.');
    } finally { button.disabled = false; }
  });

  host.querySelectorAll('[data-publish-tax-rule]').forEach(button => button.addEventListener('click', async () => {
    const reason = prompt('دلیل انتشار این نسخه قانون را وارد کنید:', 'انتشار نسخه جدید قانون مالیاتی');
    if (!reason || reason.trim().length < 5) return;
    if (!confirm('این نسخه منتشر شود؟ پس از انتشار، فاکتورها براساس تاریخ اثر از آن استفاده خواهند کرد.')) return;
    button.disabled = true;
    try {
      await client.rpc('platform_admin_publish_tax_rule', { p_rule_id: button.dataset.publishTaxRule, p_reason: reason.trim() });
      await load();
      alert('نسخه قانون مالیاتی منتشر شد.');
    } catch (error) {
      console.error(error);
      alert(String(error?.message || '').includes('PLATFORM_OWNER_REQUIRED') ? 'انتشار قانون فقط برای مالک سامانه مجاز است.' : 'انتشار قانون انجام نشد.');
    } finally { button.disabled = false; }
  }));
}

async function load() {
  if (!host) return;
  try {
    const me = await client.rpc('platform_admin_me', {});
    if (!me?.authorized) { host.innerHTML = '<div class="empty">دسترسی به قوانین مالیاتی مجاز نیست.</div>'; return; }
    role = me.role || '';
    const data = await client.rpc('platform_admin_tax_rules', {});
    rules = Array.isArray(data) ? data : [];
    render();
  } catch (error) {
    console.error(error);
    host.innerHTML = '<div class="empty">خواندن قوانین مالیاتی انجام نشد.</div>';
  }
}

window.addEventListener('avan:platform-admin-refreshed', load);
load();
