'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';
import { calculateTaxableAmount, calculateVatAmount } from '../../domains/tax/vat-calculator.js';

const C = installAvanCloud();
const Lifecycle = installUiLifecycle();
let cache = null;
let busy = false;
let refreshQueued = false;

const toBig = value => {
  try { return BigInt(String(value ?? 0).replace(/\.0+$/, '') || '0'); }
  catch { return 0n; }
};

const money = value => {
  let amount = toBig(value);
  const sign = amount < 0n ? '−' : '';
  if (amount < 0n) amount = -amount;
  return `${sign}${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬')} تومان`;
};

const faDate = iso => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(`${iso}T12:00:00`));
  } catch { return iso; }
};

async function loadCatalog(force = false) {
  const state = await C.companyContext.ensure();
  const company = state?.active_company;
  if (!company?.id) return null;
  if (!force && cache?.companyId === company.id) return cache;

  const [profiles, rules] = await Promise.all([
    C.select('tax_profiles', `select=id,name_fa,treatment,rate,applies_to,rule_code,rate_mode,is_active&workspace_id=eq.${company.id}&order=code.asc`),
    C.select('tax_rule_versions', 'select=id,rule_code,version_no,name_fa,effective_from,effective_to,standard_vat_rate,status&status=eq.active&order=effective_from.desc,version_no.desc')
  ]);

  cache = { companyId: company.id, profiles: profiles || [], rules: rules || [] };
  return cache;
}

export function effectiveRule(rules, ruleCode, date) {
  return (rules || [])
    .filter(rule => rule.rule_code === ruleCode && rule.status === 'active' && rule.effective_from <= date && (!rule.effective_to || date <= rule.effective_to))
    .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)) || Number(b.version_no) - Number(a.version_no))[0] || null;
}

export function profileRate(profile, rules, date) {
  if (!profile) return { rate: 0, rule: null };
  if (profile.treatment === 'exempt' || profile.treatment === 'zero') return { rate: 0, rule: null };
  if (profile.rate_mode === 'rule' && profile.rule_code) {
    const rule = effectiveRule(rules, profile.rule_code, date);
    return { rate: rule ? Number(rule.standard_vat_rate || 0) : 0, rule };
  }
  return { rate: Number(profile.rate || 0), rule: null };
}

function invoiceDate(form) {
  return form.querySelector('[name="date"]')?.value ||
    form.querySelector('[name="invoice_date"]')?.value ||
    form.querySelector('input[type="date"]')?.value ||
    new Date().toISOString().slice(0, 10);
}

function rowUsed(row) {
  return Boolean(
    row.querySelector('[name="account"]')?.value ||
    row.querySelector('[name="description"]')?.value?.trim() ||
    row.querySelector('[name="unit_price"]')?.value?.trim()
  );
}

function lineBase(row) {
  return calculateTaxableAmount({
    quantity: row.querySelector('[name="quantity"]')?.value || '1',
    unitPrice: row.querySelector('[name="unit_price"]')?.value || '0',
    discount: row.querySelector('[name="discount"]')?.value || '0'
  }) ?? 0n;
}

function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

function setHtml(node, html) {
  if (node && node.innerHTML !== html) node.innerHTML = html;
}

export function enforceSingleTaxSettings(documentObject = document) {
  if (documentObject.getElementById('pageTitle')?.textContent?.trim() !== 'تنظیمات') return 0;
  const cards = [...documentObject.querySelectorAll('[data-rc15-tax-settings]')];
  if (cards.length <= 1) return cards.length;

  // Keep the newest card. The submit flow can overlap an older async render;
  // the last card contains the latest persisted workspace settings.
  cards.slice(0, -1).forEach(card => card.remove());
  return 1;
}

async function normalizeTaxSettings(documentObject = document) {
  enforceSingleTaxSettings(documentObject);
  const cards = [...documentObject.querySelectorAll('[data-rc15-tax-settings]')];
  const card = cards[cards.length - 1];
  if (!card) return;

  const data = await loadCatalog();
  const today = new Date().toISOString().slice(0, 10);
  const rule = effectiveRule(data?.rules || [], 'IR_GENERAL_VAT', today);
  const host = card.querySelector('.rc15-tax-rule');
  const html = rule
    ? `<b>قاعده مؤثر امروز:</b> ${rule.name_fa} — نرخ عمومی ${Number(rule.standard_vat_rate).toLocaleString('fa-IR', { maximumFractionDigits: 4 })}٪ — ${faDate(rule.effective_from)}${rule.effective_to ? ` تا ${faDate(rule.effective_to)}` : ''}`
    : '<b>قاعده مؤثر امروز:</b> قانون فعالی برای تاریخ امروز تعریف نشده است.';
  setHtml(host, html);
}

async function refreshInvoice(form) {
  if (!form || form.dataset.rc15TaxEnabled !== '1') return;
  const data = await loadCatalog();
  if (!data) return;

  const date = invoiceDate(form);
  let subtotal = 0n;
  let tax = 0n;

  for (const row of form.querySelectorAll('[data-invoice-line]')) {
    const select = row.querySelector('[data-rc15-tax-profile]');
    if (!select) continue;

    for (const option of select.options) {
      if (!option.value) continue;
      const profile = data.profiles.find(item => item.id === option.value);
      if (!profile) continue;
      const resolved = profileRate(profile, data.rules, date);
      const suffix = profile.treatment === 'exempt'
        ? 'معاف'
        : profile.treatment === 'zero'
          ? 'نرخ صفر'
          : `${Number(resolved.rate).toLocaleString('fa-IR', { maximumFractionDigits: 4 })}٪`;
      setText(option, `${profile.name_fa} — ${suffix}`);
    }

    if (!rowUsed(row)) continue;
    const base = lineBase(row);
    const profile = data.profiles.find(item => item.id === select.value);
    const resolved = profileRate(profile, data.rules, date);
    const rowTax = profile
      ? (calculateVatAmount({ taxableAmount: base, rate: resolved.rate }) ?? 0n)
      : 0n;

    subtotal += base;
    tax += rowTax;
    const note = row.querySelector('[data-rc15-line-tax-note]');
    setText(note, profile
      ? `${resolved.rule ? `براساس ${resolved.rule.name_fa} · ` : ''}مالیات این ردیف: ${money(rowTax)}`
      : 'وضعیت مالیاتی را انتخاب کنید');
  }

  const summary = form.querySelector('[data-rc15-invoice-tax-summary]');
  const summaryHtml = `<div class="rc15-invoice-totals"><span><small>جمع قبل از مالیات</small><b>${money(subtotal)}</b></span><span><small>مالیات</small><b>${money(tax)}</b></span><span class="rc15-grand"><small>جمع نهایی</small><b>${money(subtotal + tax)}</b></span></div>`;
  setHtml(summary, summaryHtml);

  const taxText = tax.toString();
  const grandText = (subtotal + tax).toString();
  if (form.dataset.rc15TaxTotal !== taxText) form.dataset.rc15TaxTotal = taxText;
  if (form.dataset.rc15GrandTotal !== grandText) form.dataset.rc15GrandTotal = grandText;
}

function queueInvoiceRefresh(form) {
  if (!form || refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    void refreshInvoice(form);
  });
}

function bindInvoice(form) {
  if (!form || form.dataset.rc15C2StableBound === '1') return;
  form.dataset.rc15C2StableBound = '1';
  form.addEventListener('input', () => queueInvoiceRefresh(form), true);
  form.addEventListener('change', () => queueInvoiceRefresh(form), true);
}

async function apply() {
  if (busy) return;
  busy = true;
  try {
    await normalizeTaxSettings();
    const form = document.getElementById('invoiceForm');
    bindInvoice(form);
    await refreshInvoice(form);
  } catch (error) {
    console.warn('[Avan tax live stability]', error);
  } finally {
    busy = false;
  }
}

Lifecycle.use('tax-c2:live-stability', () => apply(), { priority: 260 });

// A settings save can overlap an older async render. Re-check after submit
// without installing another MutationObserver.
document.addEventListener('submit', event => {
  if (event.target?.id !== 'rc15TaxSettingsForm') return;
  queueMicrotask(() => enforceSingleTaxSettings(document));
  setTimeout(() => enforceSingleTaxSettings(document), 120);
}, true);

window.addEventListener('avan:company-context-changed', () => {
  cache = null;
  Lifecycle.schedule('tax-c2-company', 'company-context');
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Lifecycle.schedule('tax-c2-ready', 'ready'), { once: true });
} else {
  Lifecycle.schedule('tax-c2-ready', 'ready');
}
