'use strict';

import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../core/money/canonical-money.js';

function toTenths(value, field = 'money') {
  const parsed = canonicalDecimalToTenths(String(value ?? '0'));
  if (parsed === null) throw new Error(`RISK_AUDIT_INVALID_MONEY:${field}`);
  return parsed;
}

function decimal(value) {
  const out = canonicalTenthsToDecimal(value);
  if (out === null) throw new Error('RISK_AUDIT_MONEY_SERIALIZE_FAILED');
  return out;
}

function isoDay(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function dayDiff(a, b) {
  const da = new Date(`${a}T12:00:00Z`);
  const db = new Date(`${b}T12:00:00Z`);
  if (Number.isNaN(da.valueOf()) || Number.isNaN(db.valueOf())) return null;
  return Math.round((db - da) / 86400000);
}

function overdueTotal(side) {
  if (!side?.available) return 0n;
  return (
    toTenths(side.aging?.['1_30'], 'aging_1_30') +
    toTenths(side.aging?.['31_60'], 'aging_31_60') +
    toTenths(side.aging?.['61_90'], 'aging_61_90') +
    toTenths(side.aging?.['90_plus'], 'aging_90_plus')
  );
}

function ninetyPlus(side) {
  return side?.available ? toTenths(side.aging?.['90_plus'], 'aging_90_plus') : 0n;
}

function concentration(side) {
  if (!side?.available || !side.parties?.length) return { percent: 0, party: null };
  const total = toTenths(side.total, 'side_total');
  if (total <= 0n) return { percent: 0, party: null };
  const top = side.parties[0];
  return {
    percent: Number((toTenths(top.total, 'party_total') * 10000n) / total) / 100,
    party: top
  };
}

function evidence(type, rows = []) {
  const seen = new Set();
  return Object.freeze(rows.flatMap(row => {
    const id = row?.id;
    if (!id) return [];
    const key = `${type}:${id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [Object.freeze({ type, id: String(id) })];
  }));
}

function finding({
  id,
  severity,
  title,
  description,
  count = 1,
  value = null,
  entityType = null,
  entityId = null,
  confidence = 'rule',
  evidence: findingEvidence = []
}) {
  return Object.freeze({
    id, severity, title, description, count, value, entityType, entityId, confidence,
    evidence: Object.freeze([...(findingEvidence || [])])
  });
}

function groupDuplicates(rows, keyBuilder) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyBuilder(row);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].filter(group => group.length > 1);
}

function documentDuplicateFindings(documents) {
  return groupDuplicates(
    documents.filter(document => document.file_hash && document.status !== 'rejected'),
    document => String(document.file_hash).trim() || null
  ).slice(0, 3).map((group, index) => finding({
    id: `duplicate_document_${index}`,
    severity: 'high',
    title: 'فایل سند تکراری',
    description: `${group.length} فایل با هش یکسان در اسناد هوشمند پیدا شد. قبل از ثبت حسابداری، تکراری بودن منبع بررسی شود.`,
    count: group.length,
    entityType: 'document',
    entityId: group[0]?.id || null,
    confidence: 'exact_hash',
    evidence: evidence('document', group)
  }));
}

function invoiceDuplicateFindings(invoices) {
  const candidates = invoices.filter(invoice =>
    invoice.status !== 'reversed' &&
    invoice.party_id &&
    invoice.invoice_date &&
    toTenths(invoice.total_amount, 'invoice_total') > 0n
  );
  return groupDuplicates(candidates, invoice => [
    invoice.invoice_type,
    invoice.party_id,
    isoDay(invoice.invoice_date),
    toTenths(invoice.total_amount, 'invoice_total').toString()
  ].join('|')).slice(0, 3).map((group, index) => finding({
    id: `duplicate_invoice_${index}`,
    severity: 'medium',
    title: 'فاکتورهای بسیار مشابه',
    description: `${group.length} فاکتور با نوع، طرف‌حساب، تاریخ و مبلغ یکسان پیدا شد. این الزاماً خطا نیست، اما نیازمند بررسی Duplicate است.`,
    count: group.length,
    value: decimal(toTenths(group[0]?.total_amount, 'invoice_total')),
    entityType: 'invoice',
    entityId: group[0]?.id || null,
    confidence: 'exact_fields',
    evidence: evidence('invoice', group)
  }));
}

function transactionDuplicateFindings(transactions) {
  const candidates = transactions.filter(transaction =>
    transaction.tx_date &&
    transaction.tx_type &&
    toTenths(transaction.amount, 'transaction_amount') > 0n
  );
  return groupDuplicates(candidates, transaction => [
    isoDay(transaction.tx_date),
    transaction.tx_type,
    transaction.party_id || '',
    toTenths(transaction.amount, 'transaction_amount').toString(),
    transaction.primary_account_id || transaction.from_account_id || transaction.to_account_id || '',
    transaction.counterpart_account_id || ''
  ].join('|')).slice(0, 3).map((group, index) => finding({
    id: `duplicate_transaction_${index}`,
    severity: 'medium',
    title: 'عملیات مالی مشابه',
    description: `${group.length} عملیات مالی با تاریخ، نوع، مبلغ و طرف‌های اصلی یکسان دیده شد. احتمال ثبت تکراری را بررسی کنید.`,
    count: group.length,
    value: decimal(toTenths(group[0]?.amount, 'transaction_amount')),
    entityType: 'transaction',
    entityId: group[0]?.id || null,
    confidence: 'exact_fields',
    evidence: evidence('financial_transaction', group)
  }));
}

function medianBigInt(values) {
  const sorted = values.filter(value => value > 0n).sort((a, b) => a === b ? 0 : a < b ? -1 : 1);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0n;
}

function unusualTransactionFindings(transactions) {
  const rows = transactions
    .map(transaction => ({ transaction, amountTenths: toTenths(transaction.amount, 'transaction_amount') }))
    .filter(item => item.amountTenths > 0n);
  if (rows.length < 8) return [];
  const median = medianBigInt(rows.map(item => item.amountTenths));
  if (median <= 0n) return [];
  return rows
    .filter(item => item.amountTenths >= median * 4n)
    .sort((a, b) => a.amountTenths === b.amountTenths ? 0 : a.amountTenths > b.amountTenths ? -1 : 1)
    .slice(0, 3)
    .map((item, index) => finding({
      id: `unusual_transaction_${index}`,
      severity: 'medium',
      title: 'مبلغ غیرعادی نسبت به الگوی اخیر',
      description: 'مبلغ این عملیات حداقل چهار برابر میانه عملیات مالی موجود است. این یک هشدار آماری است و به معنی تخلف یا اشتباه قطعی نیست.',
      value: decimal(item.amountTenths),
      entityType: 'transaction',
      entityId: item.transaction?.id || null,
      confidence: 'statistical_rule',
      evidence: evidence('financial_transaction', [item.transaction])
    }));
}

function newPartyPaymentFindings({ parties, transactions }) {
  const partyMap = new Map(
    parties.filter(party => party.id && party.created_at).map(party => [party.id, party])
  );
  const payments = transactions
    .filter(transaction => transaction.tx_type === 'payment' && transaction.party_id)
    .map(transaction => ({ transaction, amountTenths: toTenths(transaction.amount, 'payment_amount') }))
    .filter(item => item.amountTenths > 0n);
  if (payments.length < 4) return [];
  const median = medianBigInt(payments.map(item => item.amountTenths));
  if (median <= 0n) return [];

  return payments.filter(item => {
    const party = partyMap.get(item.transaction.party_id);
    if (!party) return false;
    const created = isoDay(party.created_at);
    const paid = isoDay(item.transaction.tx_date || item.transaction.created_at);
    if (!created || !paid) return false;
    const days = dayDiff(created, paid);
    return days !== null && days >= 0 && days <= 7 && item.amountTenths >= median * 2n;
  }).slice(0, 2).map((item, index) => {
    const party = partyMap.get(item.transaction.party_id);
    return finding({
      id: `new_party_payment_${index}`,
      severity: 'medium',
      title: 'پرداخت نسبتاً بزرگ به طرف‌حساب جدید',
      description: `پرداختی به «${party?.name || 'طرف‌حساب جدید'}» در هفت روز اول ایجاد آن ثبت شده و مبلغ آن حداقل دو برابر میانه پرداخت‌هاست. بررسی کنترلی پیشنهاد می‌شود.`,
      value: decimal(item.amountTenths),
      entityType: 'transaction',
      entityId: item.transaction?.id || null,
      confidence: 'behavioral_rule',
      evidence: Object.freeze([
        ...evidence('financial_transaction', [item.transaction]),
        ...evidence('party', [party])
      ])
    });
  });
}

function integrityEvidence() {
  return Object.freeze([{ type: 'integrity_control', id: 'ledger_invoice_integrity' }]);
}

function integrityFindings({ integrity, invoiceIntegrity }) {
  const result = [];
  const unbalanced = Number(integrity?.unbalanced_journals || 0);
  if (unbalanced > 0) result.push(finding({
    id: 'unbalanced_posted', severity: 'critical', title: 'سند ثبت‌شده نامتوازن',
    description: 'کنترل یکپارچگی، سند Posted نامتوازن گزارش کرده است. این مورد باید فوراً بررسی شود.',
    count: unbalanced, confidence: 'database_integrity', evidence: integrityEvidence()
  }));
  const orphanLines = Number(integrity?.orphan_lines || 0);
  if (orphanLines > 0) result.push(finding({
    id: 'orphan_lines', severity: 'critical', title: 'ردیف Ledger یتیم',
    description: 'ردیف حسابداری بدون سند والد گزارش شده است.', count: orphanLines,
    confidence: 'database_integrity', evidence: integrityEvidence()
  }));
  const withoutJournal = Number(invoiceIntegrity?.posted_without_journal || 0);
  if (withoutJournal > 0) result.push(finding({
    id: 'posted_invoice_without_journal', severity: 'critical', title: 'فاکتور ثبت‌شده بدون سند حسابداری',
    description: 'یک یا چند فاکتور Posted فاقد اتصال معتبر به Journal هستند.',
    count: withoutJournal, confidence: 'database_integrity', evidence: integrityEvidence()
  }));
  const mismatch = Number(invoiceIntegrity?.total_mismatch || 0);
  if (mismatch > 0) result.push(finding({
    id: 'invoice_total_mismatch', severity: 'high', title: 'اختلاف جمع فاکتور',
    description: 'کنترل یکپارچگی، اختلاف بین جمع فاکتور و ردیف‌های آن را گزارش کرده است.',
    count: mismatch, confidence: 'database_integrity', evidence: integrityEvidence()
  }));
  return result;
}

function riskFactor({ id, severity, title, description, value = null, unit = 'money' }) {
  return Object.freeze({ id, severity, title, description, value, unit });
}

function riskLevel(score) {
  if (score >= 70) return 'critical';
  if (score >= 45) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

export function buildRiskAuditSnapshot({
  asOf,
  cash = '0',
  aging = null,
  parties = [],
  invoices = [],
  transactions = [],
  documents = [],
  integrity = null,
  invoiceIntegrity = null
} = {}) {
  if (!asOf) throw new Error('RISK_AUDIT_AS_OF_REQUIRED');

  const ar = aging?.receivables || null;
  const ap = aging?.payables || null;
  const cashTenths = toTenths(cash, 'cash');
  const overdueAr = overdueTotal(ar);
  const overdueAp = overdueTotal(ap);
  const ar90 = ninetyPlus(ar);
  const arConcentration = concentration(ar);
  const apConcentration = concentration(ap);
  const factors = [];

  if (overdueAp > 0n && overdueAp > cashTenths) {
    factors.push(riskFactor({
      id: 'liquidity_coverage', severity: 'high', title: 'پوشش ناکافی بدهی سررسیدگذشته',
      description: 'بدهی تجاری سررسیدگذشته از مانده فعلی بانک و صندوق بیشتر است.',
      value: decimal(overdueAp - cashTenths)
    }));
  }
  if (ar90 > 0n) {
    factors.push(riskFactor({
      id: 'aged_receivables', severity: 'high', title: 'مطالبات بیش از ۹۰ روز',
      description: 'بخشی از مطالبات بیش از ۹۰ روز از سررسید عبور کرده و ریسک وصول بالاتری دارد.',
      value: decimal(ar90)
    }));
  }
  if (arConcentration.percent >= 50) {
    factors.push(riskFactor({
      id: 'customer_concentration', severity: 'medium', title: 'تمرکز بالای مطالبات',
      description: `حدود ${arConcentration.percent.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪ مطالبات روی یک طرف‌حساب متمرکز است.`,
      value: arConcentration.percent, unit: 'percent'
    }));
  }
  if (apConcentration.percent >= 60) {
    factors.push(riskFactor({
      id: 'supplier_concentration', severity: 'medium', title: 'تمرکز بدهی تجاری',
      description: `حدود ${apConcentration.percent.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪ بدهی تجاری روی یک طرف‌حساب متمرکز است.`,
      value: apConcentration.percent, unit: 'percent'
    }));
  }
  if (overdueAr > 0n && cashTenths > 0n && overdueAr > cashTenths * 2n) {
    factors.push(riskFactor({
      id: 'cash_locked_in_ar', severity: 'medium', title: 'وابستگی نقدینگی به وصول مطالبات',
      description: 'مطالبات سررسیدگذشته بیش از دو برابر نقدینگی فعلی است؛ وصول آن می‌تواند اثر معنی‌داری بر وضعیت نقد داشته باشد.',
      value: decimal(overdueAr)
    }));
  }

  const auditFindings = [
    ...integrityFindings({ integrity, invoiceIntegrity }),
    ...documentDuplicateFindings(documents),
    ...invoiceDuplicateFindings(invoices),
    ...transactionDuplicateFindings(transactions),
    ...unusualTransactionFindings(transactions),
    ...newPartyPaymentFindings({ parties, transactions })
  ];
  const severityWeight = { critical: 35, high: 20, medium: 10, low: 4 };
  let score = factors.reduce((sum, factor) => sum + (factor.severity === 'high' ? 18 : factor.severity === 'medium' ? 9 : 4), 0);
  score += auditFindings.reduce((sum, item) => sum + (severityWeight[item.severity] || 0), 0);
  score = Math.min(100, score);
  const auditOrder = { critical: 1, high: 2, medium: 3, low: 4 };
  auditFindings.sort((a, b) => auditOrder[a.severity] - auditOrder[b.severity]);

  return Object.freeze({
    asOf,
    score,
    level: riskLevel(score),
    factors: Object.freeze(factors.slice(0, 5)),
    auditFindings: Object.freeze(auditFindings.slice(0, 8)),
    stats: Object.freeze({
      overdueReceivables: decimal(overdueAr),
      overduePayables: decimal(overdueAp),
      receivables90Plus: decimal(ar90),
      customerConcentration: arConcentration.percent,
      supplierConcentration: apConcentration.percent,
      auditFindingCount: auditFindings.length
    }),
    contracts: Object.freeze({
      deterministic: true,
      oneRialExact: true,
      aiGeneratedAmounts: false,
      actualLedgerMutation: false
    })
  });
}
