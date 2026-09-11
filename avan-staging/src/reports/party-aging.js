'use strict';

import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../core/money/canonical-money.js';

function toTenths(value, field = 'money') {
  const parsed = canonicalDecimalToTenths(String(value ?? '0'));
  if (parsed === null) throw new Error(`PARTY_AGING_INVALID_MONEY:${field}`);
  return parsed;
}

function decimal(value) {
  const out = canonicalTenthsToDecimal(value);
  if (out === null) throw new Error('PARTY_AGING_MONEY_SERIALIZE_FAILED');
  return out;
}

function daysBetween(olderDate, newerDate) {
  const a = new Date(`${olderDate}T12:00:00Z`);
  const b = new Date(`${newerDate}T12:00:00Z`);
  if (Number.isNaN(a.valueOf()) || Number.isNaN(b.valueOf())) return 0;
  return Math.max(0, Math.floor((b - a) / 86400000));
}

function bucketForDays(days) {
  if (days <= 0) return 'current';
  if (days <= 30) return '1_30';
  if (days <= 60) return '31_60';
  if (days <= 90) return '61_90';
  return '90_plus';
}

function allocateFifo(increases, reductions) {
  const open = increases.map(item => ({ ...item, remainingTenths: item.amountTenths }));
  let reduceIndex = 0;
  let reductionRemaining = reductions[0]?.amountTenths || 0n;

  for (const item of open) {
    while (item.remainingTenths > 0n && reduceIndex < reductions.length) {
      if (reductionRemaining <= 0n) {
        reduceIndex += 1;
        reductionRemaining = reductions[reduceIndex]?.amountTenths || 0n;
        continue;
      }
      const used = item.remainingTenths < reductionRemaining
        ? item.remainingTenths
        : reductionRemaining;
      item.remainingTenths -= used;
      reductionRemaining -= used;
    }
  }

  return open.filter(item => item.remainingTenths > 0n);
}

function unavailableSide() {
  return Object.freeze({
    available: false,
    total: '0',
    parties: Object.freeze([]),
    aging: Object.freeze({
      current: '0',
      '1_30': '0',
      '31_60': '0',
      '61_90': '0',
      '90_plus': '0'
    })
  });
}

function buildSide({
  accountId,
  direction,
  parties,
  entries,
  lines,
  invoices,
  asOf
}) {
  if (!accountId) return unavailableSide();

  const entryMap = new Map(entries.map(entry => [entry.id, entry]));
  const partyMap = new Map(parties.map(party => [party.id, party]));
  const invoiceById = new Map(invoices.map(invoice => [invoice.id, invoice]));
  const invoiceByJournal = new Map(
    invoices
      .filter(invoice => invoice.journal_entry_id)
      .map(invoice => [invoice.journal_entry_id, invoice])
  );
  const byParty = new Map();

  for (const line of lines) {
    if (line.account_id !== accountId) continue;
    const entry = entryMap.get(line.journal_entry_id);
    if (
      !entry ||
      entry.status === 'draft' ||
      !line.party_id ||
      (asOf && String(entry.entry_date || '').slice(0, 10) > asOf)
    ) continue;

    const debit = toTenths(line.debit, 'debit');
    const credit = toTenths(line.credit, 'credit');
    const movement = direction === 'debit' ? debit - credit : credit - debit;
    if (movement === 0n) continue;

    if (!byParty.has(line.party_id)) {
      byParty.set(line.party_id, { increases: [], reductions: [] });
    }

    const invoice =
      invoiceByJournal.get(entry.id) ||
      invoiceById.get(entry.source_id) ||
      null;
    const entryDate = String(entry.entry_date || '').slice(0, 10);
    const dueDate = String(
      invoice?.due_date ||
      invoice?.invoice_date ||
      entryDate
    ).slice(0, 10);

    const item = Object.freeze({
      journalEntryId: String(entry.id),
      journalNo: entry.journal_no ?? null,
      entryDate,
      dueDate,
      dueDateSource: invoice?.due_date
        ? 'invoice_due_date'
        : invoice?.invoice_date
          ? 'invoice_date_fallback'
          : 'entry_date_fallback',
      sourceType: entry.source_type || null,
      sourceId: entry.source_id || null,
      invoiceId: invoice?.id ? String(invoice.id) : null,
      amountTenths: movement > 0n ? movement : -movement
    });

    byParty.get(line.party_id)[movement > 0n ? 'increases' : 'reductions'].push(item);
  }

  const agingTenths = {
    current: 0n,
    '1_30': 0n,
    '31_60': 0n,
    '61_90': 0n,
    '90_plus': 0n
  };
  const resultParties = [];
  let grandTotalTenths = 0n;

  for (const [partyId, group] of byParty.entries()) {
    group.increases.sort((a, b) => a.entryDate.localeCompare(b.entryDate));
    group.reductions.sort((a, b) => a.entryDate.localeCompare(b.entryDate));

    const remaining = allocateFifo(group.increases, group.reductions);
    const totalTenths = remaining.reduce((sum, item) => sum + item.remainingTenths, 0n);
    if (totalTenths <= 0n) continue;

    const openItems = remaining.map(item => {
      const days = item.dueDate && item.dueDate < asOf
        ? daysBetween(item.dueDate, asOf)
        : 0;
      const bucket = bucketForDays(days);
      agingTenths[bucket] += item.remainingTenths;
      return Object.freeze({
        journalEntryId: item.journalEntryId,
        journalNo: item.journalNo,
        entryDate: item.entryDate,
        dueDate: item.dueDate,
        dueDateSource: item.dueDateSource,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        invoiceId: item.invoiceId,
        remaining: decimal(item.remainingTenths),
        daysPastDue: days,
        agingBucket: bucket
      });
    });

    grandTotalTenths += totalTenths;
    resultParties.push({
      partyId: String(partyId),
      partyName: String(partyMap.get(partyId)?.name || 'طرف‌حساب نامشخص'),
      total: decimal(totalTenths),
      totalTenths,
      openItems: Object.freeze(openItems)
    });
  }

  resultParties.sort((a, b) =>
    a.totalTenths === b.totalTenths
      ? a.partyName.localeCompare(b.partyName, 'fa')
      : a.totalTenths > b.totalTenths ? -1 : 1
  );

  const partiesOut = resultParties.map(({ totalTenths, ...party }) => Object.freeze(party));
  return Object.freeze({
    available: true,
    total: decimal(grandTotalTenths),
    parties: Object.freeze(partiesOut),
    aging: Object.freeze({
      current: decimal(agingTenths.current),
      '1_30': decimal(agingTenths['1_30']),
      '31_60': decimal(agingTenths['31_60']),
      '61_90': decimal(agingTenths['61_90']),
      '90_plus': decimal(agingTenths['90_plus'])
    }),
    contracts: Object.freeze({
      deterministic: true,
      oneRialExact: true,
      crossPartyNetting: false,
      draftExcluded: true
    })
  });
}

export function buildPartyAging({
  roles = {},
  parties = [],
  entries = [],
  lines = [],
  invoices = [],
  asOf
} = {}) {
  if (!asOf) throw new Error('AGING_AS_OF_REQUIRED');
  return Object.freeze({
    asOf,
    receivables: buildSide({
      accountId: roles.receivable,
      direction: 'debit',
      parties,
      entries,
      lines,
      invoices,
      asOf
    }),
    payables: buildSide({
      accountId: roles.payable,
      direction: 'credit',
      parties,
      entries,
      lines,
      invoices,
      asOf
    }),
    contracts: Object.freeze({
      deterministic: true,
      oneRialExact: true,
      crossPartyNetting: false,
      actualLedgerMutation: false
    })
  });
}
