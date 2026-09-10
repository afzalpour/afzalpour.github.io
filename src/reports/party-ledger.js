'use strict';

import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../core/money/canonical-money.js';

function required(value, code) {
  const out = String(value ?? '').trim();
  if (!out) throw new Error(code);
  return out;
}

function tenths(value) {
  const parsed = canonicalDecimalToTenths(String(value ?? '0'));
  if (parsed === null) throw new Error('PARTY_LEDGER_INVALID_MONEY');
  return parsed;
}

function decimal(value) {
  return canonicalTenthsToDecimal(value) || '0';
}

function compareRows(a, b) {
  const byDate = String(a.entryDate || '').localeCompare(String(b.entryDate || ''));
  if (byDate) return byDate;
  const aj = Number(a.journalNo ?? Number.MAX_SAFE_INTEGER);
  const bj = Number(b.journalNo ?? Number.MAX_SAFE_INTEGER);
  if (aj !== bj) return aj - bj;
  return Number(a.lineNo || 0) - Number(b.lineNo || 0);
}

function sideForAccount(accountId, receivableId, payableId) {
  if (accountId === receivableId) return 'receivable';
  if (accountId === payableId) return 'payable';
  return null;
}

function normalBalanceDelta(side, debitTenths, creditTenths) {
  return side === 'receivable'
    ? debitTenths - creditTenths
    : creditTenths - debitTenths;
}

export function partyPositionLabel(netTenths) {
  const net = typeof netTenths === 'bigint' ? netTenths : BigInt(netTenths || 0);
  if (net > 0n) return 'طلب ما از طرف‌حساب';
  if (net < 0n) return 'بدهی ما به طرف‌حساب';
  return 'تسویه';
}

export function buildPartyLedger({
  partyId,
  roles = {},
  entries = [],
  lines = [],
  accounts = [],
  from,
  to
} = {}) {
  const pid = required(partyId, 'PARTY_LEDGER_PARTY_REQUIRED');
  const dfrom = required(from, 'PARTY_LEDGER_FROM_REQUIRED');
  const dto = required(to, 'PARTY_LEDGER_TO_REQUIRED');
  if (dfrom > dto) throw new Error('PARTY_LEDGER_RANGE_INVALID');

  const receivableId = roles.receivable ? String(roles.receivable) : '';
  const payableId = roles.payable ? String(roles.payable) : '';
  const controlIds = new Set([receivableId, payableId].filter(Boolean));
  const entryMap = new Map((entries || []).map(entry => [String(entry.id), entry]));
  const accountMap = new Map((accounts || []).map(account => [String(account.id), account]));

  const relevant = [];
  for (const line of lines || []) {
    if (String(line.party_id || '') !== pid) continue;
    const accountId = String(line.account_id || '');
    if (!controlIds.has(accountId)) continue;
    const entry = entryMap.get(String(line.journal_entry_id || ''));
    if (!entry || entry.status === 'draft' || !entry.entry_date || entry.entry_date > dto) continue;

    const side = sideForAccount(accountId, receivableId, payableId);
    if (!side) continue;
    const debitTenths = tenths(line.debit);
    const creditTenths = tenths(line.credit);
    const claimDeltaTenths = debitTenths - creditTenths;
    const normalDeltaTenths = normalBalanceDelta(side, debitTenths, creditTenths);

    relevant.push({
      journalEntryId: String(entry.id),
      journalNo: entry.journal_no ?? null,
      entryDate: entry.entry_date,
      lineNo: Number(line.line_no || 0),
      sourceType: entry.source_type || '',
      sourceId: entry.source_id || null,
      description: line.description || entry.description || '',
      accountId,
      accountCode: accountMap.get(accountId)?.code || '',
      accountName: accountMap.get(accountId)?.name || '',
      side,
      debitTenths,
      creditTenths,
      claimDeltaTenths,
      normalDeltaTenths
    });
  }

  relevant.sort(compareRows);

  let openingReceivable = 0n;
  let openingPayable = 0n;
  let closingReceivable = 0n;
  let closingPayable = 0n;
  let periodDebit = 0n;
  let periodCredit = 0n;

  for (const row of relevant) {
    if (row.side === 'receivable') closingReceivable += row.normalDeltaTenths;
    else closingPayable += row.normalDeltaTenths;

    if (row.entryDate < dfrom) {
      if (row.side === 'receivable') openingReceivable += row.normalDeltaTenths;
      else openingPayable += row.normalDeltaTenths;
    } else {
      periodDebit += row.debitTenths;
      periodCredit += row.creditTenths;
    }
  }

  let runningNet = openingReceivable - openingPayable;
  const rows = relevant
    .filter(row => row.entryDate >= dfrom && row.entryDate <= dto)
    .map(row => {
      runningNet += row.claimDeltaTenths;
      return Object.freeze({
        journalEntryId: row.journalEntryId,
        journalNo: row.journalNo,
        entryDate: row.entryDate,
        lineNo: row.lineNo,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        description: row.description,
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        side: row.side,
        debit: decimal(row.debitTenths),
        credit: decimal(row.creditTenths),
        effect: decimal(row.claimDeltaTenths),
        runningNet: decimal(runningNet)
      });
    });

  const openingNet = openingReceivable - openingPayable;
  const closingNet = closingReceivable - closingPayable;

  return Object.freeze({
    partyId: pid,
    from: dfrom,
    to: dto,
    available: controlIds.size > 0,
    receivableConfigured: Boolean(receivableId),
    payableConfigured: Boolean(payableId),
    opening: Object.freeze({
      receivable: decimal(openingReceivable),
      payable: decimal(openingPayable),
      net: decimal(openingNet)
    }),
    period: Object.freeze({
      debit: decimal(periodDebit),
      credit: decimal(periodCredit)
    }),
    closing: Object.freeze({
      receivable: decimal(closingReceivable),
      payable: decimal(closingPayable),
      net: decimal(closingNet),
      position: partyPositionLabel(closingNet)
    }),
    rows
  });
}
