'use strict';

import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../core/money/canonical-money.js';

function requiredIsoDate(value, code = 'CONTROL_TOWER_AS_OF_REQUIRED') {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(code);
  return text;
}

function toTenths(value, code = 'CONTROL_TOWER_INVALID_MONEY') {
  const parsed = canonicalDecimalToTenths(String(value ?? '0'));
  if (parsed === null) throw new Error(code);
  return parsed;
}

function decimal(tenths) {
  const value = canonicalTenthsToDecimal(tenths);
  if (value === null) throw new Error('CONTROL_TOWER_MONEY_SERIALIZE_FAILED');
  return value;
}

function entryIsInScope(entry, asOf) {
  if (!entry || entry.status === 'draft') return false;
  const date = String(entry.entry_date || '').slice(0, 10);
  return Boolean(date) && date <= asOf;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sourceRefs(type, ids) {
  return unique(ids).map(id => Object.freeze({ type, id }));
}

function metric({ id, label, value, status = 'normal', explanation, evidence = [] }) {
  return Object.freeze({
    id,
    label,
    value,
    status,
    explanation,
    evidence: Object.freeze(evidence)
  });
}

function buildScopedLedger({ entries, lines, asOf }) {
  const entryMap = new Map(entries.map(entry => [entry.id, entry]));
  const scopedLines = [];

  for (const line of lines) {
    const entry = entryMap.get(line.journal_entry_id);
    if (!entryIsInScope(entry, asOf)) continue;
    scopedLines.push({ line, entry });
  }

  return scopedLines;
}

function buildCashMetric({ financialAccounts, scopedLedger }) {
  const active = financialAccounts.filter(account =>
    account?.is_active !== false && account?.ledger_account_id
  );
  const ledgerAccountIds = new Set(active.map(account => account.ledger_account_id));
  let total = 0n;
  const journalIds = [];

  for (const { line, entry } of scopedLedger) {
    if (!ledgerAccountIds.has(line.account_id)) continue;
    total += toTenths(line.debit) - toTenths(line.credit);
    journalIds.push(entry.id);
  }

  return metric({
    id: 'cash_position',
    label: 'موقعیت نقد و بانک',
    value: decimal(total),
    status: total < 0n ? 'attention' : 'normal',
    explanation: 'مانده بانک/صندوق از خطوط Ledger حساب‌های مالی فعال محاسبه شده است.',
    evidence: [
      ...sourceRefs('financial_account', active.map(account => account.id)),
      ...sourceRefs('journal_entry', journalIds)
    ]
  });
}

function buildPartyExposure({ accountId, direction, scopedLedger, side }) {
  if (!accountId) {
    return {
      available: false,
      total: 0n,
      partyBalances: [],
      unassignedLineIds: [],
      journalIds: []
    };
  }

  const balances = new Map();
  const unassignedLineIds = [];
  const journalIds = [];

  for (const { line, entry } of scopedLedger) {
    if (line.account_id !== accountId) continue;
    journalIds.push(entry.id);

    if (!line.party_id) {
      unassignedLineIds.push(line.id || `${entry.id}:${line.line_no ?? ''}`);
      continue;
    }

    const debit = toTenths(line.debit);
    const credit = toTenths(line.credit);
    const movement = direction === 'debit' ? debit - credit : credit - debit;
    balances.set(line.party_id, (balances.get(line.party_id) || 0n) + movement);
  }

  const partyBalances = [...balances.entries()]
    .map(([partyId, balance]) => ({ partyId, balance }))
    .filter(item => item.balance !== 0n)
    .sort((a, b) => a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1);

  const total = partyBalances.reduce(
    (sum, item) => sum + (item.balance > 0n ? item.balance : 0n),
    0n
  );

  return {
    side,
    available: true,
    total,
    partyBalances,
    unassignedLineIds,
    journalIds
  };
}

function exposureMetric(exposure, side) {
  const receivable = side === 'receivable';
  return metric({
    id: receivable ? 'gross_receivables' : 'gross_payables',
    label: receivable ? 'مطالبات باز' : 'بدهی‌های باز',
    value: exposure.available ? decimal(exposure.total) : null,
    status: exposure.unassignedLineIds.length ? 'attention' : 'normal',
    explanation: exposure.available
      ? `مانده ${receivable ? 'دریافتنی' : 'پرداختنی'} به تفکیک party_id محاسبه و فقط مانده‌های مثبت هر طرف جمع شده‌اند؛ بین طرف‌ها تهاتر نشده است.`
      : `حساب کنترلی ${receivable ? 'دریافتنی' : 'پرداختنی'} برای شرکت پیکربندی نشده است.`,
    evidence: exposure.available
      ? [
          ...sourceRefs('party', exposure.partyBalances.map(item => item.partyId)),
          ...sourceRefs('journal_entry', exposure.journalIds)
        ]
      : []
  });
}

function buildBankMetric({ bankStatementLines, bankMatches }) {
  const activeMatchedLineIds = new Set(
    bankMatches
      .filter(match => !match?.voided_at)
      .map(match => match.statement_line_id)
      .filter(Boolean)
  );

  const unresolved = bankStatementLines.filter(line =>
    line?.id && !line.ignored_at && !activeMatchedLineIds.has(line.id)
  );

  let total = 0n;
  for (const line of unresolved) total += toTenths(line.amount);

  return Object.freeze({
    ...metric({
      id: 'unresolved_bank_reconciliation',
      label: 'مغایرت بانکی باز',
      value: decimal(total),
      status: unresolved.length ? 'attention' : 'normal',
      explanation: 'جمع خطوط صورتحساب بانکی که نه Ignore شده‌اند و نه Match فعال دارند.',
      evidence: sourceRefs('bank_statement_line', unresolved.map(line => line.id))
    }),
    count: unresolved.length
  });
}

function buildInventoryMetric(inventoryReconciliations) {
  const unresolved = inventoryReconciliations.filter(row => row?.is_reconciled === false);
  return Object.freeze({
    id: 'inventory_control_risks',
    label: 'ریسک کنترل انبار',
    count: unresolved.length,
    value: null,
    status: unresolved.length ? 'attention' : 'normal',
    explanation: 'تعداد کنترل‌های انبار/مالی که وضعیت reconciled ندارند.',
    evidence: Object.freeze(sourceRefs(
      'inventory_reconciliation',
      unresolved.map(row => row.id || row.workspace_id)
    ))
  });
}

function buildCloseReadiness({ bank, inventory, receivable, payable }) {
  const blockers = [];
  if (bank.count > 0) blockers.push('bank_reconciliation_open');
  if (inventory.count > 0) blockers.push('inventory_reconciliation_open');
  if (receivable.unassignedLineIds.length > 0) blockers.push('receivable_lines_without_party');
  if (payable.unassignedLineIds.length > 0) blockers.push('payable_lines_without_party');

  return Object.freeze({
    status: blockers.length ? 'attention' : 'ready',
    score: null,
    methodology: 'foundation-no-arbitrary-score',
    blockers: Object.freeze(blockers)
  });
}

function buildActions({ bank, inventory, receivable, payable }) {
  const actions = [];

  if (bank.count) {
    actions.push({
      id: 'resolve_bank_reconciliation',
      priority: 'high',
      title: 'رسیدگی به مغایرت‌های بانکی باز',
      count: bank.count,
      evidence: bank.evidence
    });
  }

  if (inventory.count) {
    actions.push({
      id: 'review_inventory_reconciliation',
      priority: 'high',
      title: 'بررسی مغایرت کنترل انبار',
      count: inventory.count,
      evidence: inventory.evidence
    });
  }

  const missingPartyCount = receivable.unassignedLineIds.length + payable.unassignedLineIds.length;
  if (missingPartyCount) {
    actions.push({
      id: 'review_control_account_party_links',
      priority: 'high',
      title: 'بررسی خطوط دریافتنی/پرداختنی بدون طرف‌حساب',
      count: missingPartyCount,
      evidence: Object.freeze([
        ...sourceRefs('journal_line', receivable.unassignedLineIds),
        ...sourceRefs('journal_line', payable.unassignedLineIds)
      ])
    });
  }

  return Object.freeze(actions.map(action => Object.freeze(action)));
}

export function buildControlTowerFoundation({
  asOf,
  roles = {},
  financialAccounts = [],
  entries = [],
  lines = [],
  bankStatementLines = [],
  bankMatches = [],
  inventoryReconciliations = []
} = {}) {
  const normalizedAsOf = requiredIsoDate(asOf);
  const scopedLedger = buildScopedLedger({ entries, lines, asOf: normalizedAsOf });
  const cash = buildCashMetric({ financialAccounts, scopedLedger });
  const receivable = buildPartyExposure({
    accountId: roles.receivable,
    direction: 'debit',
    scopedLedger,
    side: 'receivable'
  });
  const payable = buildPartyExposure({
    accountId: roles.payable,
    direction: 'credit',
    scopedLedger,
    side: 'payable'
  });
  const receivables = exposureMetric(receivable, 'receivable');
  const payables = exposureMetric(payable, 'payable');
  const bank = buildBankMetric({ bankStatementLines, bankMatches });
  const inventory = buildInventoryMetric(inventoryReconciliations);
  const closeReadiness = buildCloseReadiness({ bank, inventory, receivable, payable });
  const actions = buildActions({ bank, inventory, receivable, payable });

  return Object.freeze({
    architecture: 'avan-control-tower-foundation-v1',
    asOf: normalizedAsOf,
    metrics: Object.freeze({
      cash,
      receivables,
      payables,
      bank,
      inventory
    }),
    closeReadiness,
    actions,
    contracts: Object.freeze({
      sourceOfTruth: 'ledger-and-authoritative-subledgers',
      deterministic: true,
      aiGeneratedAmounts: false,
      crossPartyNetting: false,
      moneyPrecision: '0.1-toman-one-rial',
      mutation: 'none'
    })
  });
}
