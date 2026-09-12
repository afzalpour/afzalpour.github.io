'use strict';

import { buildPartyAging } from '../reports/party-aging.js';
import { buildPartyLedger } from '../reports/party-ledger.js';
import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../core/money/canonical-money.js';

function required(value, code) {
  const out = String(value ?? '').trim();
  if (!out) throw new Error(code);
  return out;
}

function toTenths(value, field = 'amount') {
  const out = canonicalDecimalToTenths(String(value ?? '0'));
  if (out === null) throw new Error(`COUNTERPARTY_360_INVALID_MONEY:${field}`);
  return out;
}

function decimal(value) {
  const out = canonicalTenthsToDecimal(value);
  if (out === null) throw new Error('COUNTERPARTY_360_MONEY_SERIALIZE_FAILED');
  return out;
}

function openParty(side, partyId) {
  return (side?.parties || []).find(item => String(item.partyId) === String(partyId)) || null;
}

function overdueTenths(party) {
  return (party?.openItems || []).reduce((sum, item, index) =>
    Number(item.daysPastDue || 0) > 0
      ? sum + toTenths(item.remaining, `overdue:${index}`)
      : sum,
  0n);
}

function oldestDueDate(receivable, payable) {
  const dates = [...(receivable?.openItems || []), ...(payable?.openItems || [])]
    .map(item => String(item.dueDate || '').slice(0, 10))
    .filter(Boolean)
    .sort();
  return dates[0] || null;
}

function profileMissingFields(party) {
  const missing = [];
  if (!party?.entity_type || party.entity_type === 'unspecified') missing.push('ماهیت');
  if (!party?.phone && !party?.email) missing.push('اطلاعات تماس');
  if (!party?.address) missing.push('آدرس');
  if (party?.entity_type === 'legal') {
    if (!party.national_id) missing.push('شناسه ملی');
    if (!party.registration_no) missing.push('شماره ثبت');
    if (!party.economic_code) missing.push('کد اقتصادی');
    if (!party.tax_id) missing.push('شناسه مالیاتی');
    if (!party.postal_code) missing.push('کدپستی');
  } else if (party?.entity_type === 'individual' && !party.national_id) {
    missing.push('کد ملی');
  }
  return missing;
}

function invoiceRows(invoices, partyId) {
  return (invoices || [])
    .filter(invoice => String(invoice.party_id || '') === String(partyId))
    .sort((a, b) => {
      const byDate = String(b.invoice_date || '').localeCompare(String(a.invoice_date || ''));
      if (byDate) return byDate;
      return Number(b.invoice_no || 0) - Number(a.invoice_no || 0);
    })
    .map(invoice => Object.freeze({
      id: String(invoice.id),
      invoiceNo: invoice.invoice_no ?? null,
      invoiceType: invoice.invoice_type || '',
      invoiceDate: invoice.invoice_date || null,
      dueDate: invoice.due_date || invoice.invoice_date || null,
      status: invoice.status || '',
      journalEntryId: invoice.journal_entry_id ? String(invoice.journal_entry_id) : null,
      totalAmount: String(invoice.total_amount ?? '0')
    }));
}

function evidenceJournals({ receivable, payable, ledger, entries }) {
  const ids = new Set();
  for (const item of [...(receivable?.openItems || []), ...(payable?.openItems || [])]) {
    if (item.journalEntryId) ids.add(String(item.journalEntryId));
  }
  for (const row of ledger?.rows || []) {
    if (row.journalEntryId) ids.add(String(row.journalEntryId));
  }
  return (entries || [])
    .filter(entry => ids.has(String(entry.id)))
    .sort((a, b) => {
      const byDate = String(b.entry_date || '').localeCompare(String(a.entry_date || ''));
      if (byDate) return byDate;
      return Number(b.journal_no || 0) - Number(a.journal_no || 0);
    })
    .map(entry => Object.freeze({
      id: String(entry.id),
      journalNo: entry.journal_no ?? null,
      entryDate: entry.entry_date || null,
      sourceType: entry.source_type || '',
      sourceId: entry.source_id || null,
      description: entry.description || ''
    }));
}

function riskFlags({ party, receivableOverdue, payableOverdue, missingFields }) {
  const flags = [];
  if (receivableOverdue > 0n) {
    flags.push(Object.freeze({ key: 'overdue_receivable', level: 'attention', label: 'مطالبات سررسیدگذشته' }));
  }
  if (payableOverdue > 0n) {
    flags.push(Object.freeze({ key: 'overdue_payable', level: 'attention', label: 'بدهی سررسیدگذشته' }));
  }
  if (missingFields.length) {
    flags.push(Object.freeze({ key: 'incomplete_profile', level: 'data', label: 'پرونده هویتی/مالیاتی ناقص' }));
  }
  if (party?.is_active === false) {
    flags.push(Object.freeze({ key: 'inactive_party', level: 'data', label: 'طرف‌حساب بایگانی است' }));
  }
  return Object.freeze(flags);
}

export function buildCounterparty360({
  party,
  roles = {},
  accounts = [],
  entries = [],
  lines = [],
  invoices = [],
  fiscalFrom,
  asOf
} = {}) {
  const partyId = required(party?.id, 'COUNTERPARTY_360_PARTY_REQUIRED');
  const from = required(fiscalFrom, 'COUNTERPARTY_360_FISCAL_FROM_REQUIRED');
  const to = required(asOf, 'COUNTERPARTY_360_AS_OF_REQUIRED');

  const aging = buildPartyAging({
    roles,
    parties: [party],
    entries,
    lines,
    invoices,
    asOf: to
  });
  const receivable = openParty(aging.receivables, partyId);
  const payable = openParty(aging.payables, partyId);
  const receivableTotal = receivable ? toTenths(receivable.total, 'receivable_total') : 0n;
  const payableTotal = payable ? toTenths(payable.total, 'payable_total') : 0n;
  const receivableOverdue = overdueTenths(receivable);
  const payableOverdue = overdueTenths(payable);

  const ledger = buildPartyLedger({
    partyId,
    roles,
    entries,
    lines,
    accounts,
    from,
    to
  });
  const partyInvoices = invoiceRows(invoices, partyId);
  const evidence = evidenceJournals({ receivable, payable, ledger, entries });
  const missingFields = profileMissingFields(party);
  const risks = riskFlags({ party, receivableOverdue, payableOverdue, missingFields });
  const activityDates = [
    ...ledger.rows.map(row => row.entryDate),
    ...partyInvoices.map(row => row.invoiceDate)
  ].filter(Boolean).sort();

  return Object.freeze({
    party: Object.freeze({
      id: partyId,
      name: party.name || '',
      kind: party.kind || 'other',
      entityType: party.entity_type || 'unspecified',
      legalName: party.legal_name || '',
      nationalId: party.national_id || '',
      registrationNo: party.registration_no || '',
      economicCode: party.economic_code || '',
      taxId: party.tax_id || '',
      phone: party.phone || '',
      email: party.email || '',
      postalCode: party.postal_code || '',
      province: party.province || '',
      city: party.city || '',
      address: party.address || '',
      contactName: party.contact_name || '',
      website: party.website || '',
      isActive: party.is_active !== false,
      missingFields: Object.freeze(missingFields)
    }),
    financial: Object.freeze({
      receivable: decimal(receivableTotal),
      overdueReceivable: decimal(receivableOverdue),
      payable: decimal(payableTotal),
      overduePayable: decimal(payableOverdue),
      oldestDueDate: oldestDueDate(receivable, payable),
      receivableOpenItems: Object.freeze([...(receivable?.openItems || [])]),
      payableOpenItems: Object.freeze([...(payable?.openItems || [])])
    }),
    ledger,
    invoices: Object.freeze(partyInvoices),
    evidence: Object.freeze(evidence),
    risks,
    lastActivityDate: activityDates.at(-1) || null,
    contracts: Object.freeze({
      oneRialExact: true,
      deterministic: true,
      readOnly: true,
      actualLedgerMutation: false,
      arApDisplayedSeparately: true,
      crossPartyNetting: false,
      evidenceBacked: true
    })
  });
}
