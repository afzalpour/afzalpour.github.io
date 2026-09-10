'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';

const C = installAvanCloud();
const Lifecycle = installUiLifecycle();
let cache = null;
let busy = false;
let invoiceQueued = false;

const faDate = iso => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
};

async function loadCatalog(force = false) {
  const state = await C.companyContext.ensure();
  const company = state?.active_company;
  if (!company?.id) return null;
  if (!force && cache?.companyId === company.id) return cache;

  const [profiles, rules] = await Promise.all([
    C.select(
      'tax_profiles',
      `select=id,name_fa,treatment,rate,applies_to,rule_code,rate_mode,is_active&workspace_id=eq.${company.id}&order=code.asc`
    ),
    C.select(
      'tax_rule_versions',
      'select=id,rule_code,version_no,name_fa,effective_from,effective_to,standard_vat_rate,status&status=eq.active&order=effective_from.desc,version_no.desc'
    )
  ]);

  cache = Object.freeze({
    companyId: company.id,
    profiles: Object.freeze([...(profiles || [])]),
    rules: Object.freeze([...(rules || [])])
  });
  return cache;
}

export function effectiveRule(rules, ruleCode, date) {
  return [...(rules || [])]
    .filter(rule =>
      rule.rule_code === ruleCode &&
      rule.status === 'active' &&
      rule.effective_from <= date &&
      (!rule.effective_to || date <= rule.effective_to)
    )
    .sort((a, b) =>
      String(b.effective_from).localeCompare(String(a.effective_from)) ||
      Number(b.version_no) - Number(a.version_no)
    )[0] || null;
}

export function profileRate(profile, rules, date) {
  if (!profile) return { rate: 0, rule: null };
  if (profile.treatment === 'exempt' || profile.treatment === 'zero') {
    return { rate: 0, rule: null };
  }
  if (profile.rate_mode === 'rule' && profile.rule_code) {
    const rule = effectiveRule(rules, profile.rule_code, date);
    return { rate: rule ? Number(rule.standard_vat_rate || 0) : 0, rule };
  }
  return { rate: Number(profile.rate || 0), rule: null };
}

function invoiceDate(form) {
  return form?.querySelector('[name="date"]')?.value ||
    form?.querySelector('[name="invoice_date"]')?.value ||
    form?.querySelector('input[type="date"]')?.value ||
    new Date().toISOString().slice(0, 10);
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function setDataset(node, key, value) {
  if (!node) return;
  const next = String(value ?? '');
  if (node.dataset[key] !== next) node.dataset[key] = next;
}

async function refreshInvoice(form = document.getElementById('invoiceForm')) {
  if (!form) return false;

  if (form.dataset.rc15TaxEnabled !== '1') {
    form.dataset.rc15TaxMetadataReady = '1';
    const signature = `off|${invoiceDate(form)}`;
    if (form.dataset.rc15TaxMetadataSignature !== signature) {
      form.dataset.rc15TaxMetadataSignature = signature;
      document.dispatchEvent(new CustomEvent('avan:invoice-tax-metadata-changed', {
        detail: { enabled: false, date: invoiceDate(form) }
      }));
    }
    return true;
  }

  const data = await loadCatalog();
  if (!data) return false;
  const date = invoiceDate(form);
  const signatureParts = [date];

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
      setDataset(option, 'taxRate', resolved.rate);
      setDataset(option, 'taxRuleId', resolved.rule?.id || '');
      setDataset(option, 'taxRuleName', resolved.rule?.name_fa || '');
    }

    const selected = select.selectedOptions?.[0];
    signatureParts.push([
      select.value || '',
      selected?.dataset?.taxRate || '0',
      selected?.dataset?.taxRuleId || ''
    ].join(':'));
  }

  form.dataset.rc15TaxEffectiveDate = date;
  form.dataset.rc15TaxMetadataReady = '1';
  const signature = signatureParts.join('|');
  if (form.dataset.rc15TaxMetadataSignature !== signature) {
    form.dataset.rc15TaxMetadataSignature = signature;
    document.dispatchEvent(new CustomEvent('avan:invoice-tax-metadata-changed', {
      detail: { enabled: true, date, signature }
    }));
  }
  return true;
}

async function normalizeTaxSettings() {
  if (document.getElementById('pageTitle')?.textContent?.trim() !== 'تنظیمات') return;
  const cards = [...document.querySelectorAll('[data-rc15-tax-settings]')];
  if (cards.length > 1) cards.slice(0, -1).forEach(card => card.remove());
  const card = cards[cards.length - 1];
  if (!card) return;

  const data = await loadCatalog();
  const today = new Date().toISOString().slice(0, 10);
  const rule = effectiveRule(data?.rules || [], 'IR_GENERAL_VAT', today);
  const host = card.querySelector('.rc15-tax-rule');
  if (!host) return;

  const html = rule
    ? `<b>قاعده مؤثر امروز:</b> ${rule.name_fa} — نرخ عمومی ${Number(rule.standard_vat_rate).toLocaleString('fa-IR', { maximumFractionDigits: 4 })}٪ — ${faDate(rule.effective_from)}${rule.effective_to ? ` تا ${faDate(rule.effective_to)}` : ''}`
    : '<b>قاعده مؤثر امروز:</b> قانون فعالی برای تاریخ امروز تعریف نشده است.';
  if (host.innerHTML !== html) host.innerHTML = html;
}

function queueInvoiceRefresh() {
  if (invoiceQueued) return;
  invoiceQueued = true;
  requestAnimationFrame(() => {
    invoiceQueued = false;
    void refreshInvoice();
  });
}

function bindInvoice(form) {
  if (!form || form.dataset.rc15C1MetadataBound === '1') return;
  form.dataset.rc15C1MetadataBound = '1';
  form.addEventListener('input', event => {
    if (event.target?.matches?.('[name="date"],[name="invoice_date"]')) queueInvoiceRefresh();
  }, true);
  form.addEventListener('change', event => {
    if (event.target?.matches?.('[name="date"],[name="invoice_date"],[data-rc15-tax-profile],[data-e-item]')) {
      queueInvoiceRefresh();
    }
  }, true);
  queueInvoiceRefresh();
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
    console.warn('[Avan tax date metadata]', error);
  } finally {
    busy = false;
  }
}

Lifecycle.use('tax-c1:date-metadata', () => apply(), { priority: 260 });
document.addEventListener('avan:invoice-tax-metadata-changed', event => {
  if (event.detail?.source === 'date-aware') return;
});
document.addEventListener('avan:ui-changed', queueInvoiceRefresh);
window.addEventListener('avan:company-context-changed', () => {
  cache = null;
  Lifecycle.schedule('tax-c1-company');
});
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Lifecycle.schedule('tax-c1-ready'), { once: true });
} else {
  Lifecycle.schedule('tax-c1-ready');
}
