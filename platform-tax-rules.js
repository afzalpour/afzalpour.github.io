'use strict';

import { createSupabaseClient } from './src/infrastructure/supabase/supabase-client.js';
import { jalaliToIso, isoToJalali } from './src/core/date/jalali.js';

const client = createSupabaseClient({ config: window.AVAN_CONFIG || {}, storage: localStorage });
const host = document.getElementById('platformTaxRules');
let role = '';
let rules = [];
let editingRuleId = '';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
const faDigits = value => String(value ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const pad2 = value => String(value).padStart(2,'0');
const faDate = value => {
  if (!value) return '—';
  const j = isoToJalali(String(value));
  return j ? faDigits(`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`) : '—';
};
const faNum = value => Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits:4 });
const statusFa = value => ({ active:'منتشرشده', draft:'پیش‌نویس', retired:'بازنشسته' }[value] || 'نامشخص');
const familyFa = value => ({ IR_GENERAL_VAT:'مالیات بر ارزش افزوده عمومی ایران' }[value] || 'خانواده مالیاتی تعریف‌شده');
const canEditDrafts = () => role === 'platform_owner' || role === 'platform_admin' || role === 'administrator';

function currentRule() {
  const today = new Date().toISOString().slice(0,10);
  return rules.filter(rule => rule.status === 'active' && rule.effective_from <= today && (!rule.effective_to || today <= rule.effective_to))
    .sort((a,b) => String(b.effective_from).localeCompare(String(a.effective_from)) || Number(b.version_no)-Number(a.version_no))[0] || null;
}

function editingRule() {
  return rules.find(rule => rule.id === editingRuleId && rule.status === 'draft') || null;
}

function rowsHtml() {
  if (!rules.length) return '<tr><td colspan="8" class="empty">هنوز قانونی تعریف نشده است.</td></tr>';
  return rules.map(rule => {
    const actions = [];
    if (rule.status === 'draft' && canEditDrafts()) actions.push(`<button class="ghost small" data-edit-tax-rule="${rule.id}">ویرایش</button>`);
    if (rule.status === 'draft' && role === 'platform_owner') actions.push(`<button class="primary small" data-publish-tax-rule="${rule.id}">انتشار</button>`);
    return `<tr><td>${esc(familyFa(rule.rule_code))}</td><td>${Number(rule.version_no).toLocaleString('fa-IR')}</td><td>${esc(rule.name_fa)}</td><td>${faDate(rule.effective_from)}${rule.effective_to ? ` تا ${faDate(rule.effective_to)}` : ' به بعد'}</td><td class="platform-tax-rate">${faNum(rule.standard_vat_rate)}٪</td><td><span class="badge ${rule.status === 'active' ? 'ok' : ''}">${statusFa(rule.status)}</span></td><td class="platform-tax-source"><span>${esc(rule.source_title || '—')}</span>${rule.source_reference ? `<small>${esc(rule.source_reference)}</small>` : ''}</td><td><div class="platform-tax-actions">${actions.length ? actions.join('') : '—'}</div></td></tr>`;
  }).join('');
}

function render() {
  if (!host) return;
  const current = currentRule();
  const edit = editingRule();
  const payload = edit?.rule_payload || {};
  const formTitle = edit ? `ویرایش پیش‌نویس نسخه ${Number(edit.version_no).toLocaleString('fa-IR')}` : 'تعریف نسخه جدید';
  const submitTitle = edit ? 'ذخیره ویرایش' : 'ذخیره پیش‌نویس';

  host.innerHTML = `
    <div class="panel-head"><div><h2>مرکز قوانین مالیاتی آوان</h2><p>هر تغییر قانونی به‌عنوان نسخه جدید ثبت می‌شود؛ نسخه‌های منتشرشده و اسناد تاریخی قابل بازنویسی نیستند.</p></div></div>
    ${current ? `<div class="control-note platform-tax-note">قانون مؤثر امروز: <b>${esc(current.name_fa)}</b> — ${faNum(current.standard_vat_rate)}٪ — از ${faDate(current.effective_from)}${current.effective_to ? ` تا ${faDate(current.effective_to)}` : ''}</div>` : '<div class="control-note platform-tax-note">برای تاریخ امروز قانون فعالی وجود ندارد.</div>'}
    <div class="platform-tax-form-title"><strong>${formTitle}</strong>${edit ? '<button class="ghost small" type="button" id="cancelTaxRuleEdit">انصراف از ویرایش</button>' : ''}</div>
    <form id="platformTaxRuleForm" class="platform-tax-form platform-tax-form-inline">
      <div class="field family-field"><label>خانواده قانون</label><select name="rule_code" required ${edit ? 'disabled' : ''}><option value="IR_GENERAL_VAT">مالیات بر ارزش افزوده عمومی ایران</option></select></div>
      <div class="field name-field"><label>نام نسخه</label><input name="name_fa" required maxlength="160" value="${esc(edit?.name_fa || '')}" placeholder="مثلاً نرخ عمومی ارزش افزوده ۱۴۰۶"></div>
      <div class="field date-field"><label>شروع اثر (شمسی)</label><input name="effective_from_jalali" inputmode="numeric" dir="ltr" required value="${edit ? faDate(edit.effective_from) : ''}" placeholder="۱۴۰۶/۰۱/۰۱"></div>
      <div class="field date-field"><label>پایان اثر (شمسی)</label><input name="effective_to_jalali" inputmode="numeric" dir="ltr" value="${edit?.effective_to ? faDate(edit.effective_to) : ''}" placeholder="اختیاری"></div>
      <div class="field rate-field"><label>نرخ عمومی</label><input type="number" name="rate" min="0" max="100" step="0.0001" required value="${edit ? esc(edit.standard_vat_rate) : ''}"></div>
      <div class="field source-field"><label>عنوان منبع قانونی</label><input name="source_title" maxlength="200" value="${esc(edit?.source_title || '')}" placeholder="قانون / بخشنامه"></div>
      <div class="field ref-field"><label>مرجع قانونی</label><input name="source_reference" maxlength="240" value="${esc(edit?.source_reference || '')}" placeholder="شماره یا شناسه مرجع"></div>
      <div class="field year-field"><label>سال مالیاتی</label><input type="number" name="tax_year" min="1300" max="1600" inputmode="numeric" value="${esc(payload.tax_year || '')}" placeholder="۱۴۰۶"></div>
      <div class="form-actions inline-tax-action"><button class="primary">${submitTitle}</button></div>
    </form>
    <div class="control-note platform-tax-note">مدیر ارشد سامانه می‌تواند پیش‌نویس قانون را ویرایش کند. نسخه منتشرشده قابل ویرایش نیست و انتشار نسخه جدید فقط توسط مالک سامانه انجام می‌شود تا تاریخچه قانونی محفوظ بماند.</div>
    <div class="table-wrap"><table class="operations-table platform-tax-table"><thead><tr><th>خانواده قانون</th><th>نسخه</th><th>نام</th><th>بازه اثر شمسی</th><th>نرخ</th><th>وضعیت</th><th>منبع</th><th>اقدام</th></tr></thead><tbody>${rowsHtml()}</tbody></table></div>`;
  bind();
}

function readForm(form) {
  const fd = new FormData(form);
  const startIso = jalaliToIso(fd.get('effective_from_jalali'));
  const endRaw = String(fd.get('effective_to_jalali') || '').trim();
  const endIso = endRaw ? jalaliToIso(endRaw) : null;
  if (!startIso) throw new Error('START_DATE_INVALID');
  if (endRaw && !endIso) throw new Error('END_DATE_INVALID');
  if (endIso && endIso < startIso) throw new Error('DATE_ORDER_INVALID');
  const taxYear = Number(fd.get('tax_year') || 0) || Number(String(fd.get('effective_from_jalali') || '').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).slice(0,4)) || null;
  return {
    ruleCode: editRuleCode(fd),
    nameFa: String(fd.get('name_fa') || '').trim(),
    startIso,
    endIso,
    rate: Number(fd.get('rate')),
    sourceTitle: String(fd.get('source_title') || '').trim() || null,
    sourceReference: String(fd.get('source_reference') || '').trim() || null,
    payload: taxYear ? { tax_year:taxYear, jurisdiction:'IR', rate_basis:'general_vat' } : { jurisdiction:'IR' }
  };
}

function editRuleCode(fd) {
  return editingRule()?.rule_code || String(fd.get('rule_code') || '').trim();
}

function bind() {
  document.getElementById('cancelTaxRuleEdit')?.addEventListener('click', () => { editingRuleId = ''; render(); });

  const form = document.getElementById('platformTaxRuleForm');
  if (form) form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"], .inline-tax-action button');
    try {
      const data = readForm(form);
      if (button) button.disabled = true;
      if (editingRuleId) {
        await client.rpc('platform_admin_update_tax_rule', {
          p_rule_id: editingRuleId,
          p_name_fa:data.nameFa,
          p_effective_from:data.startIso,
          p_effective_to:data.endIso,
          p_standard_vat_rate:data.rate,
          p_source_title:data.sourceTitle,
          p_source_reference:data.sourceReference,
          p_rule_payload:data.payload
        });
        editingRuleId = '';
        await load();
        alert('ویرایش پیش‌نویس قانون مالیاتی ذخیره شد.');
      } else {
        await client.rpc('platform_admin_create_tax_rule', {
          p_rule_code:data.ruleCode,
          p_name_fa:data.nameFa,
          p_effective_from:data.startIso,
          p_effective_to:data.endIso,
          p_standard_vat_rate:data.rate,
          p_source_title:data.sourceTitle,
          p_source_reference:data.sourceReference,
          p_rule_payload:data.payload
        });
        form.reset();
        await load();
        alert('پیش‌نویس قانون مالیاتی ذخیره شد.');
      }
    } catch (error) {
      const code = String(error?.message || error || '');
      console.error(error);
      if (code.includes('START_DATE_INVALID')) alert('تاریخ شروع را به‌صورت شمسی و معتبر وارد کنید.');
      else if (code.includes('END_DATE_INVALID')) alert('تاریخ پایان را به‌صورت شمسی و معتبر وارد کنید.');
      else if (code.includes('DATE_ORDER_INVALID')) alert('تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.');
      else if (code.includes('TAX_RULE_IMMUTABLE_AFTER_PUBLISH')) alert('نسخه منتشرشده قابل ویرایش نیست.');
      else alert(editingRuleId ? 'ذخیره ویرایش قانون انجام نشد.' : 'ذخیره پیش‌نویس قانون انجام نشد.');
    } finally { if (button?.isConnected) button.disabled = false; }
  });

  host.querySelectorAll('[data-edit-tax-rule]').forEach(button => button.addEventListener('click', () => {
    editingRuleId = button.dataset.editTaxRule;
    render();
    host.scrollIntoView({ behavior:'smooth', block:'start' });
  }));

  host.querySelectorAll('[data-publish-tax-rule]').forEach(button => button.addEventListener('click', async () => {
    const reason = prompt('دلیل انتشار این نسخه قانون را وارد کنید:', 'انتشار نسخه جدید قانون مالیاتی');
    if (!reason || reason.trim().length < 5) return;
    if (!confirm('این نسخه منتشر شود؟ فاکتورها براساس تاریخ اثر از آن استفاده خواهند کرد.')) return;
    button.disabled = true;
    try {
      await client.rpc('platform_admin_publish_tax_rule', { p_rule_id:button.dataset.publishTaxRule, p_reason:reason.trim() });
      await load();
      alert('نسخه قانون مالیاتی منتشر شد.');
    } catch (error) {
      console.error(error);
      alert(String(error?.message || '').includes('PLATFORM_OWNER_REQUIRED') ? 'انتشار قانون فقط برای مالک سامانه مجاز است.' : 'انتشار قانون انجام نشد.');
    } finally { if (button?.isConnected) button.disabled = false; }
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
    if (editingRuleId && !editingRule()) editingRuleId = '';
    render();
  } catch (error) {
    console.error(error);
    host.innerHTML = '<div class="empty">خواندن قوانین مالیاتی انجام نشد.</div>';
  }
}

window.addEventListener('avan:platform-admin-refreshed', load);
load();
