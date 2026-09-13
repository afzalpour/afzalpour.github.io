'use strict';

import { canonicalDecimalToTenths, canonicalTenthsToDecimal } from '../core/money/canonical-money.js';

export const IRAN_COMPLIANCE_RADAR_ARCHITECTURE = Object.freeze({
  id: 'avan-iran-compliance-radar-foundation-v1',
  methodology: 'deterministic-controls-no-arbitrary-score',
  writeOperations: 0,
  actualLedgerMutation: false,
  submissionSupported: false,
  fabricatedDeadlines: false,
  coverage: Object.freeze({ tax: true, electronicInvoice: true, fiscalClose: true, payroll: false, insurance: false })
});

const rank = Object.freeze({ critical: 4, high: 3, medium: 2, low: 1 });
const txt = value => String(value ?? '').trim();
const iso = value => /^\d{4}-\d{2}-\d{2}$/.test(txt(value).slice(0, 10)) ? txt(value).slice(0, 10) : null;

function currentRule(rules, asOf) {
  return [...(rules || [])]
    .filter(row => row?.status === 'active')
    .filter(row => (!iso(row.effective_from) || row.effective_from <= asOf) && (!iso(row.effective_to) || row.effective_to >= asOf))
    .sort((a, b) => txt(b.effective_from).localeCompare(txt(a.effective_from)))[0] || null;
}

function ref(type, id, label, meta = '') {
  return Object.freeze({ type, id: id || null, label: txt(label) || 'مرجع حسابداری', meta: txt(meta) });
}

function finding(id, severity, category, title, description, evidence = []) {
  return Object.freeze({ id, severity, category, title, description, evidence: Object.freeze(evidence.filter(Boolean)) });
}

function sumExact(values) {
  let total = 0n;
  for (const value of values) {
    const parsed = canonicalDecimalToTenths(value ?? '0');
    if (parsed === null) return null;
    total += parsed;
  }
  return canonicalTenthsToDecimal(total);
}

export function buildIranComplianceRadar(input = {}) {
  const asOf = iso(input.asOf);
  if (!asOf) throw new Error('COMPLIANCE_AS_OF_REQUIRED');

  const settings = input.taxSettings || {};
  const rules = input.taxRules || [];
  const profiles = input.taxProfiles || [];
  const items = input.inventoryItems || [];
  const periods = input.fiscalPeriods || [];
  const invoices = (input.invoices || []).filter(row => row?.invoice_type === 'sale' && (!input.periodFrom || row.invoice_date >= input.periodFrom) && row.invoice_date <= asOf);
  const lines = input.invoiceLines || [];
  const findings = [];
  const activeRule = currentRule(rules, asOf);

  if (!activeRule) findings.push(finding('rule-missing', 'critical', 'rule_version', 'قاعده مالیاتی فعال پیدا نشد', 'برای تاریخ انتخاب‌شده نسخه قاعده فعال و قابل استناد در آوان وجود ندارد.'));
  if (!settings.tax_enabled) findings.push(finding('tax-disabled', 'low', 'registration', 'ماژول مالیات شرکت غیرفعال است', 'این وضعیت به‌تنهایی نتیجه حقوقی ایجاد نمی‌کند و فقط دامنه کنترل خودکار آوان را محدود می‌کند.'));
  if (!txt(settings.taxpayer_type) || settings.taxpayer_type === 'unspecified') findings.push(finding('taxpayer-type', 'high', 'registration', 'نوع مودی مشخص نشده است', 'برای تعیین کنترل‌های مناسب، نوع مودی در تنظیمات مالیاتی تکمیل شود.'));
  if (settings.tax_enabled && !txt(settings.tax_identifier)) findings.push(finding('tax-id', 'high', 'registration', 'شناسه مالیاتی تکمیل نشده است', 'تنظیمات مالیاتی شرکت برای کنترل‌های بعدی کامل نیست.'));
  if (settings.e_invoice_enabled && !txt(settings.taxpayer_memory_id)) findings.push(finding('memory-id', 'critical', 'electronic_invoice', 'شناسه حافظه مالیاتی تکمیل نشده است', 'آمادگی صورتحساب الکترونیکی تا تکمیل شناسه حافظه مالیاتی مسدود است.'));

  if (activeRule && settings.default_rule_version_id && String(settings.default_rule_version_id) !== String(activeRule.id)) {
    findings.push(finding('rule-review', 'medium', 'rule_version', 'نسخه قاعده پیش‌فرض نیازمند بازبینی است', 'نسخه پیش‌فرض شرکت با نسخه فعال در تاریخ انتخاب‌شده یکسان نیست؛ این هشدار الزاماً به معنی خطا نیست.', [ref('tax_rule_version', activeRule.id, activeRule.name_fa, activeRule.source_reference)]));
  }

  const profileGaps = profiles.filter(row => row?.is_active !== false && !row?.rule_version_id);
  if (profileGaps.length) findings.push(finding('profile-rule-gap', 'high', 'tax_profile', 'پروفایل مالیاتی بدون نسخه قاعده وجود دارد', `${profileGaps.length} پروفایل فعال به نسخه قاعده متصل نیست.`, profileGaps.slice(0, 12).map(row => ref('tax_profile', row.id, row.name_fa || row.code, row.treatment))));

  const itemGaps = items.filter(row => row?.is_active !== false && !row?.tax_profile_id);
  if (itemGaps.length) findings.push(finding('item-profile-gap', 'high', 'tax_profile', 'کالا یا خدمت بدون پروفایل مالیاتی وجود دارد', `${itemGaps.length} قلم فعال پروفایل مالیاتی مشخص ندارند.`, itemGaps.slice(0, 12).map(row => ref('inventory_item', row.id, row.name || row.sku, row.sku))));

  const invoiceIds = new Set(invoices.map(row => String(row.id)));
  const relevantLines = lines.filter(row => invoiceIds.has(String(row.invoice_id)));
  const snapshotGaps = relevantLines.filter(row => !row?.tax_profile_id || !row?.tax_rule_version_id || !txt(row?.tax_treatment));
  if (snapshotGaps.length) findings.push(finding('invoice-tax-snapshot-gap', 'critical', 'vat', 'Snapshot مالیاتی برخی ردیف‌های فروش ناقص است', `${snapshotGaps.length} ردیف فروش پروفایل، نسخه قاعده یا نوع برخورد مالیاتی کامل ندارند.`, snapshotGaps.slice(0, 16).map(row => ref('invoice_line', row.id, `ردیف ${row.line_no || '—'}`, 'ردیف فاکتور فروش'))));

  const posted = invoices.filter(row => row?.status === 'posted');
  const missingJournal = posted.filter(row => !row?.journal_entry_id);
  if (missingJournal.length) findings.push(finding('posted-journal-gap', 'critical', 'integrity', 'فاکتور فروش قطعی بدون سند حسابداری مرجع وجود دارد', `${missingJournal.length} فاکتور قطعی به سند حسابداری مرجع متصل نیست.`, missingJournal.slice(0, 12).map(row => ref('invoice', row.id, `فاکتور ${row.invoice_no || '—'}`, row.invoice_date))));

  const openPastPeriods = periods.filter(row => row?.status !== 'closed' && iso(row?.date_to) && row.date_to < asOf);
  if (openPastPeriods.length) findings.push(finding('past-period-open', 'medium', 'fiscal_close', 'دوره مالی پایان‌یافته هنوز باز است', `${openPastPeriods.length} دوره با تاریخ پایان قبل از تاریخ مبنا هنوز بسته نشده است؛ این کنترل داخلی است و موعد قانونی محسوب نمی‌شود.`, openPastPeriods.slice(0, 12).map(row => ref('fiscal_period', row.id, row.name, row.date_to))));

  const outputTaxCanonical = sumExact(posted.map(row => row.tax_total ?? '0'));
  if (outputTaxCanonical === null) findings.push(finding('money-precision', 'critical', 'money_integrity', 'جمع مالیات خروجی با دقت یک ریال قابل محاسبه نیست', 'حداقل یک مبلغ از قرارداد پولی دقیق آوان خارج است.'));

  const critical = findings.filter(row => row.severity === 'critical').length;
  const high = findings.filter(row => row.severity === 'high').length;

  return Object.freeze({
    architecture: IRAN_COMPLIANCE_RADAR_ARCHITECTURE,
    asOf,
    periodFrom: input.periodFrom || null,
    readiness: critical ? 'blocked' : high ? 'attention' : 'ready',
    currentRule: activeRule ? Object.freeze({ id: activeRule.id, name: activeRule.name_fa, effectiveFrom: activeRule.effective_from, effectiveTo: activeRule.effective_to || null, rate: activeRule.standard_vat_rate, sourceTitle: activeRule.source_title || '', sourceReference: activeRule.source_reference || '' }) : null,
    summary: Object.freeze({ totalFindings: findings.length, critical, high, postedSaleInvoices: posted.length, draftSaleInvoices: invoices.filter(row => row?.status === 'draft').length, taxSnapshotGaps: snapshotGaps.length, itemsWithoutTaxProfile: itemGaps.length, outputTaxCanonical }),
    findings: Object.freeze(findings.sort((a, b) => rank[b.severity] - rank[a.severity])),
    regulations: Object.freeze([...rules].filter(row => row?.effective_from).sort((a, b) => txt(b.effective_from).localeCompare(txt(a.effective_from))).slice(0, 8).map(row => Object.freeze({ id: row.id, name: row.name_fa, effectiveFrom: row.effective_from, effectiveTo: row.effective_to || null, status: row.status, sourceTitle: row.source_title || '', sourceReference: row.source_reference || '' }))),
    calendar: Object.freeze([
      ...periods.filter(row => row?.date_to).map(row => Object.freeze({ id: `period:${row.id}`, date: row.date_to, title: `پایان ${row.name || 'دوره مالی'}`, type: 'fiscal_period_end', legalDeadline: false })),
      ...rules.filter(row => row?.effective_from).map(row => Object.freeze({ id: `rule:${row.id}`, date: row.effective_from, title: `شروع اثر ${row.name_fa || 'قاعده مالیاتی'}`, type: 'rule_effective_from', legalDeadline: false }))
    ].sort((a, b) => txt(a.date).localeCompare(txt(b.date))).slice(0, 12)),
    coverage: IRAN_COMPLIANCE_RADAR_ARCHITECTURE.coverage,
    notices: Object.freeze(['این رادار آمادگی داده و کنترل‌های داخلی را می‌سنجد و جایگزین نظر حرفه‌ای مالیاتی یا حقوقی نیست.', 'هیچ موعد قانونی بدون منبع نسخه‌دار و ثبت‌شده در آوان ساخته یا حدس زده نمی‌شود.', 'پوشش حقوق و بیمه در Foundation فعلی فعال نیست و درباره آن‌ها نتیجه انطباق صادر نمی‌شود.'])
  });
}
