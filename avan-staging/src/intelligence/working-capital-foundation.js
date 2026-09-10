'use strict';

import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../core/money/canonical-money.js';

function toTenths(value, field = 'money') {
  const parsed = canonicalDecimalToTenths(String(value ?? '0'));
  if (parsed === null) throw new Error(`WORKING_CAPITAL_INVALID_MONEY:${field}`);
  return parsed;
}

function decimal(value) {
  const out = canonicalTenthsToDecimal(value);
  if (out === null) throw new Error('WORKING_CAPITAL_MONEY_SERIALIZE_FAILED');
  return out;
}

function requiredDate(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('WORKING_CAPITAL_AS_OF_REQUIRED');
  return text;
}

function daysBetween(older, newer) {
  const a = new Date(`${older}T12:00:00Z`);
  const b = new Date(`${newer}T12:00:00Z`);
  if (Number.isNaN(a.valueOf()) || Number.isNaN(b.valueOf())) return 0;
  return Math.max(0, Math.floor((b - a) / 86400000));
}

function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function ref(type, id) {
  return id ? Object.freeze({ type, id: String(id) }) : null;
}

function uniqueRefs(refs) {
  const seen = new Set();
  return Object.freeze((refs || []).filter(Boolean).filter(item => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}

function entryInScope(entry, asOf) {
  if (!entry || entry.status === 'draft') return false;
  const date = String(entry.entry_date || '').slice(0, 10);
  return Boolean(date) && date <= asOf;
}

function invoiceForEntry(entry, byJournal, byId) {
  return byJournal.get(entry.id) || byId.get(entry.source_id) || null;
}

function allocateFifo(increases, reductions) {
  const open = increases.map(item => ({ ...item, remainingTenths: item.amountTenths }));
  let reductionIndex = 0;
  let reductionRemaining = reductions[0]?.amountTenths || 0n;

  for (const item of open) {
    while (item.remainingTenths > 0n && reductionIndex < reductions.length) {
      if (reductionRemaining <= 0n) {
        reductionIndex += 1;
        reductionRemaining = reductions[reductionIndex]?.amountTenths || 0n;
        continue;
      }
      const used = item.remainingTenths < reductionRemaining ? item.remainingTenths : reductionRemaining;
      item.remainingTenths -= used;
      reductionRemaining -= used;
    }
  }

  return open.filter(item => item.remainingTenths > 0n);
}

function agingBucket(dueDate, asOf) {
  if (!dueDate || dueDate >= asOf) return 'current';
  const days = daysBetween(dueDate, asOf);
  if (days <= 30) return '1_30';
  if (days <= 60) return '31_60';
  if (days <= 90) return '61_90';
  return '90_plus';
}

function collectionPriority(maxDaysPastDue) {
  if (maxDaysPastDue > 90) return Object.freeze({ tier: 'critical', label: 'پیگیری فوری', rule: 'over_90_days' });
  if (maxDaysPastDue > 60) return Object.freeze({ tier: 'high', label: 'پیگیری امروز', rule: '61_90_days' });
  if (maxDaysPastDue > 30) return Object.freeze({ tier: 'medium', label: 'پیگیری نزدیک', rule: '31_60_days' });
  if (maxDaysPastDue > 0) return Object.freeze({ tier: 'watch', label: 'یادآوری سررسیدگذشته', rule: '1_30_days' });
  return Object.freeze({ tier: 'current', label: 'در سررسید', rule: 'not_overdue' });
}

function paymentPriority(dueDate, asOf) {
  if (!dueDate || dueDate < asOf) return Object.freeze({ tier: 'overdue', label: 'سررسیدگذشته', rule: 'overdue' });
  if (dueDate <= addDays(asOf, 7)) return Object.freeze({ tier: 'due_7', label: 'تا ۷ روز آینده', rule: 'due_within_7' });
  if (dueDate <= addDays(asOf, 30)) return Object.freeze({ tier: 'due_30', label: 'تا ۳۰ روز آینده', rule: 'due_within_30' });
  return Object.freeze({ tier: 'future', label: 'بعد از ۳۰ روز', rule: 'future' });
}

function buildSide({ side, accountId, entries, lines, parties, invoices, asOf }) {
  const direction = side === 'receivable' ? 'debit' : 'credit';
  if (!accountId) {
    return Object.freeze({ available: false, total: '0', overdue: '0', due7: '0', due30: '0', parties: Object.freeze([]), openItems: Object.freeze([]) });
  }

  const entryMap = new Map(entries.map(item => [item.id, item]));
  const partyMap = new Map(parties.map(item => [item.id, item]));
  const invoiceByJournal = new Map(invoices.filter(item => item.journal_entry_id).map(item => [item.journal_entry_id, item]));
  const invoiceById = new Map(invoices.map(item => [item.id, item]));
  const grouped = new Map();

  for (const line of lines) {
    if (line.account_id !== accountId || !line.party_id) continue;
    const entry = entryMap.get(line.journal_entry_id);
    if (!entryInScope(entry, asOf)) continue;

    const debit = toTenths(line.debit, 'debit');
    const credit = toTenths(line.credit, 'credit');
    const movement = direction === 'debit' ? debit - credit : credit - debit;
    if (movement === 0n) continue;

    const invoice = invoiceForEntry(entry, invoiceByJournal, invoiceById);
    const dueDate = String(invoice?.due_date || invoice?.invoice_date || entry.entry_date || '').slice(0, 10);
    const evidence = uniqueRefs([
      ref('party', line.party_id),
      ref('journal_entry', entry.id),
      ref('journal_line', line.id),
      ref('invoice', invoice?.id)
    ]);

    if (!grouped.has(line.party_id)) grouped.set(line.party_id, { increases: [], reductions: [] });
    const item = Object.freeze({
      id: `${entry.id}:${line.id || line.line_no || 'line'}`,
      partyId: String(line.party_id),
      journalEntryId: String(entry.id),
      journalNo: entry.journal_no ?? null,
      entryDate: String(entry.entry_date || '').slice(0, 10),
      dueDate,
      dueDateSource: invoice?.due_date ? 'invoice_due_date' : invoice?.invoice_date ? 'invoice_date_fallback' : 'entry_date_fallback',
      invoiceId: invoice?.id ? String(invoice.id) : null,
      invoiceNo: invoice?.invoice_no ?? null,
      sourceType: entry.source_type || null,
      amountTenths: movement > 0n ? movement : -movement,
      evidence
    });
    grouped.get(line.party_id)[movement > 0n ? 'increases' : 'reductions'].push(item);
  }

  const openItems = [];
  const partyRows = [];
  let total = 0n;
  let overdue = 0n;
  let due7 = 0n;
  let due30 = 0n;

  for (const [partyId, group] of grouped.entries()) {
    group.increases.sort((a, b) => a.entryDate.localeCompare(b.entryDate));
    group.reductions.sort((a, b) => a.entryDate.localeCompare(b.entryDate));
    const remaining = allocateFifo(group.increases, group.reductions);
    if (!remaining.length) continue;

    let partyTotal = 0n;
    let partyOverdue = 0n;
    let maxDaysPastDue = 0;
    const partyEvidence = [];

    for (const item of remaining) {
      const daysPastDue = item.dueDate < asOf ? daysBetween(item.dueDate, asOf) : 0;
      const paymentWindow = paymentPriority(item.dueDate, asOf);
      const bucket = agingBucket(item.dueDate, asOf);
      const row = Object.freeze({
        ...item,
        remaining: decimal(item.remainingTenths),
        daysPastDue,
        agingBucket: bucket,
        paymentPriority: side === 'payable' ? paymentWindow : null
      });
      openItems.push(row);
      partyTotal += item.remainingTenths;
      if (daysPastDue > 0) partyOverdue += item.remainingTenths;
      if (daysPastDue > maxDaysPastDue) maxDaysPastDue = daysPastDue;
      if (item.dueDate >= asOf && item.dueDate <= addDays(asOf, 7)) due7 += item.remainingTenths;
      if (item.dueDate >= asOf && item.dueDate <= addDays(asOf, 30)) due30 += item.remainingTenths;
      if (daysPastDue > 0) overdue += item.remainingTenths;
      partyEvidence.push(...item.evidence);
    }

    total += partyTotal;
    partyRows.push(Object.freeze({
      partyId: String(partyId),
      partyName: String(partyMap.get(partyId)?.name || 'طرف‌حساب نامشخص'),
      total: decimal(partyTotal),
      overdue: decimal(partyOverdue),
      maxDaysPastDue,
      priority: side === 'receivable' ? collectionPriority(maxDaysPastDue) : null,
      evidence: uniqueRefs(partyEvidence)
    }));
  }

  partyRows.sort((a, b) => {
    const ao = toTenths(a.overdue);
    const bo = toTenths(b.overdue);
    if (ao !== bo) return ao > bo ? -1 : 1;
    const at = toTenths(a.total);
    const bt = toTenths(b.total);
    return at === bt ? 0 : at > bt ? -1 : 1;
  });

  openItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.daysPastDue - a.daysPastDue);

  return Object.freeze({
    available: true,
    total: decimal(total),
    overdue: decimal(overdue),
    due7: decimal(due7),
    due30: decimal(due30),
    parties: Object.freeze(partyRows),
    openItems: Object.freeze(openItems)
  });
}

function buildCash({ financialAccounts, entries, lines, asOf }) {
  const entryMap = new Map(entries.map(item => [item.id, item]));
  const accountIds = new Set(financialAccounts.filter(item => item.is_active !== false && item.ledger_account_id).map(item => item.ledger_account_id));
  let total = 0n;
  const evidence = [];
  for (const line of lines) {
    if (!accountIds.has(line.account_id)) continue;
    const entry = entryMap.get(line.journal_entry_id);
    if (!entryInScope(entry, asOf)) continue;
    total += toTenths(line.debit, 'cash_debit') - toTenths(line.credit, 'cash_credit');
    evidence.push(ref('journal_entry', entry.id), ref('journal_line', line.id));
  }
  return Object.freeze({ value: decimal(total), evidence: uniqueRefs(evidence) });
}

function buildEvidenceGraph({ receivables, payables }) {
  const nodeMap = new Map();
  const edges = [];
  const addNode = item => {
    if (!item) return;
    const key = `${item.type}:${item.id}`;
    if (!nodeMap.has(key)) nodeMap.set(key, Object.freeze({ key, type: item.type, id: item.id }));
  };
  for (const side of [receivables, payables]) {
    for (const item of side.openItems || []) {
      const itemKey = `open_item:${item.id}`;
      nodeMap.set(itemKey, Object.freeze({ key: itemKey, type: 'open_item', id: item.id, side: side === receivables ? 'receivable' : 'payable' }));
      for (const evidence of item.evidence || []) {
        addNode(evidence);
        edges.push(Object.freeze({ from: itemKey, to: `${evidence.type}:${evidence.id}`, relation: 'supported_by' }));
      }
    }
  }
  return Object.freeze({ nodes: Object.freeze([...nodeMap.values()]), edges: Object.freeze(edges) });
}

export function buildWorkingCapitalFoundation({
  asOf,
  roles = {},
  parties = [],
  invoices = [],
  entries = [],
  lines = [],
  financialAccounts = []
} = {}) {
  const normalizedAsOf = requiredDate(asOf);
  const receivables = buildSide({ side: 'receivable', accountId: roles.receivable, entries, lines, parties, invoices, asOf: normalizedAsOf });
  const payables = buildSide({ side: 'payable', accountId: roles.payable, entries, lines, parties, invoices, asOf: normalizedAsOf });
  const cash = buildCash({ financialAccounts, entries, lines, asOf: normalizedAsOf });
  const cashTenths = toTenths(cash.value, 'cash');
  const due30PayablesTenths = toTenths(payables.overdue, 'payables_overdue') + toTenths(payables.due30, 'payables_due30');
  const nearTermLiquidity = cashTenths - due30PayablesTenths;

  return Object.freeze({
    architecture: 'avan-working-capital-foundation-v1',
    asOf: normalizedAsOf,
    cash,
    receivables,
    payables,
    metrics: Object.freeze({
      grossReceivables: receivables.total,
      overdueReceivables: receivables.overdue,
      grossPayables: payables.total,
      overduePayables: payables.overdue,
      payablesDueWithin30Days: payables.due30,
      cashLessOverdueAnd30DayPayables: decimal(nearTermLiquidity)
    }),
    collectionPriorities: Object.freeze(receivables.parties.filter(item => toTenths(item.total) > 0n).slice(0, 8)),
    paymentCalendar: Object.freeze(payables.openItems.filter(item => item.dueDate <= addDays(normalizedAsOf, 30)).slice(0, 12)),
    evidenceGraph: buildEvidenceGraph({ receivables, payables }),
    contracts: Object.freeze({
      companyScopedInputRequired: true,
      deterministic: true,
      oneRialExact: true,
      crossPartyNetting: false,
      autonomousCollection: false,
      autonomousPayment: false,
      actualLedgerMutation: false,
      aiArithmetic: false
    })
  });
}
