'use strict';

import { buildPartyAging } from './party-aging.js';
import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../core/money/canonical-money.js';

const METRICS = Object.freeze({
  assets: {
    title: 'دارایی',
    sourceReport: 'report_balance_sheet',
    categories: ['asset'],
    scope: 'as_of'
  },
  liabilities: {
    title: 'بدهی',
    sourceReport: 'report_balance_sheet',
    categories: ['liability'],
    scope: 'as_of'
  },
  cash: {
    title: 'بانک و صندوق',
    sourceReport: 'report_cash_bank_balances',
    categories: [],
    scope: 'as_of'
  },
  profit: {
    title: 'سود/زیان سال',
    sourceReport: 'report_profit_loss',
    categories: ['income', 'expense'],
    scope: 'range'
  },
  income: {
    title: 'درآمد',
    sourceReport: 'report_profit_loss',
    categories: ['income'],
    scope: 'range'
  },
  expense: {
    title: 'هزینه',
    sourceReport: 'report_profit_loss',
    categories: ['expense'],
    scope: 'range'
  },
  receivables: {
    title: 'مطالبات باز',
    sourceReport: 'AR Aging / Ledger',
    scope: 'as_of',
    agingSide: 'receivables',
    roleKey: 'receivable',
    overdueOnly: false
  },
  overdue_receivables: {
    title: 'مطالبات سررسیدگذشته',
    sourceReport: 'AR Aging / Ledger',
    scope: 'as_of',
    agingSide: 'receivables',
    roleKey: 'receivable',
    overdueOnly: true
  },
  payables: {
    title: 'بدهی تجاری باز',
    sourceReport: 'AP Aging / Ledger',
    scope: 'as_of',
    agingSide: 'payables',
    roleKey: 'payable',
    overdueOnly: false
  },
  overdue_payables: {
    title: 'بدهی تجاری سررسیدگذشته',
    sourceReport: 'AP Aging / Ledger',
    scope: 'as_of',
    agingSide: 'payables',
    roleKey: 'payable',
    overdueOnly: true
  }
});

function toTenths(value, field = 'money') {
  const parsed = canonicalDecimalToTenths(String(value ?? '0'));
  if (parsed === null) throw new Error(`WHY_NUMBER_INVALID_MONEY:${field}`);
  return parsed;
}

function decimal(value) {
  const out = canonicalTenthsToDecimal(value);
  if (out === null) throw new Error('WHY_NUMBER_MONEY_SERIALIZE_FAILED');
  return out;
}

function entryInScope(entry, meta, from, to) {
  const date = String(entry?.entry_date || '');
  if (!date) return false;
  if (to && date > to) return false;
  if (meta.scope === 'range' && from && date < from) return false;
  return entry.status !== 'draft';
}

function journalEvidence({ evidenceLines, entries }) {
  const journalIds = new Set(evidenceLines.map(line => line.journal_entry_id));
  return entries
    .filter(entry => journalIds.has(entry.id))
    .sort((a, b) => {
      const ad = String(a.entry_date || '');
      const bd = String(b.entry_date || '');
      if (ad !== bd) return bd.localeCompare(ad);
      return String(b.journal_no ?? '').localeCompare(String(a.journal_no ?? ''));
    });
}

function evidenceAccounts({ accounts, accountIds }) {
  return accounts
    .filter(account => accountIds.has(account.id))
    .sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
}

function overdueTenths(party, asOf) {
  return (party?.openItems || []).reduce((sum, item) => {
    if (!item?.dueDate || item.dueDate >= asOf) return sum;
    return sum + toTenths(item.remaining, 'aging_remaining');
  }, 0n);
}

function buildAgingEvidence({
  metric,
  meta,
  roles,
  parties,
  accounts,
  entries,
  lines,
  invoices,
  from,
  to,
  targetPartyId
}) {
  const aging = buildPartyAging({
    roles,
    parties,
    entries,
    lines,
    invoices,
    asOf: to
  });
  const side = aging[meta.agingSide];
  const accountId = roles?.[meta.roleKey] || null;
  const accountIds = new Set(accountId ? [accountId] : []);
  const sideParties = side?.available ? side.parties || [] : [];
  const selectedParties = targetPartyId
    ? sideParties.filter(party => party.partyId === targetPartyId)
    : sideParties;

  const calculatedTenths = selectedParties.reduce((sum, party) => {
    if (meta.overdueOnly) return sum + overdueTenths(party, to);
    return sum + toTenths(party.total, 'aging_party_total');
  }, 0n);

  const contributingPartyIds = new Set(
    selectedParties
      .filter(party => !meta.overdueOnly || overdueTenths(party, to) > 0n)
      .map(party => party.partyId)
  );
  const entryMap = new Map(entries.map(entry => [entry.id, entry]));
  const evidenceLines = lines.filter(line => {
    if (!accountId || line.account_id !== accountId) return false;
    if (!line.party_id || !contributingPartyIds.has(line.party_id)) return false;
    const entry = entryMap.get(line.journal_entry_id);
    return entryInScope(entry, meta, from, to);
  });
  const journals = journalEvidence({ evidenceLines, entries });
  const matchedParty = targetPartyId
    ? parties.find(party => party.id === targetPartyId) || null
    : null;
  const title = matchedParty
    ? `${meta.title} — ${matchedParty.name || 'طرف‌حساب'}`
    : meta.title;
  const calculationNote = meta.overdueOnly
    ? 'جمع مانده‌های باز پس از تخصیص FIFO در همان طرف‌حساب؛ فقط اقلامی که تاریخ سررسیدشان قبل از تاریخ گزارش است در عدد سررسیدگذشته وارد می‌شوند.'
    : 'جمع مانده‌های باز کنترل حساب پس از تخصیص FIFO دریافت/پرداخت داخل همان طرف‌حساب؛ هیچ تهاتر بین طرف‌حساب‌ها انجام نمی‌شود.';

  return {
    metric,
    title,
    sourceReport: meta.sourceReport,
    scope: meta.scope,
    from,
    to,
    accountCount: evidenceAccounts({ accounts, accountIds }).length,
    journalCount: journals.length,
    lineCount: evidenceLines.length,
    accounts: evidenceAccounts({ accounts, accountIds }),
    journals,
    calculatedAmount: decimal(calculatedTenths),
    calculationNote,
    targetPartyId: targetPartyId || null
  };
}

function regularCalculatedAmount(metric, evidenceLines, accountMap) {
  if (!['cash', 'profit', 'income', 'expense'].includes(metric)) return null;
  let total = 0n;
  for (const line of evidenceLines) {
    const debit = toTenths(line.debit, 'evidence_debit');
    const credit = toTenths(line.credit, 'evidence_credit');
    const category = accountMap.get(line.account_id)?.category;
    if (metric === 'cash') total += debit - credit;
    else if (metric === 'income') total += credit - debit;
    else if (metric === 'expense') total += debit - credit;
    else if (metric === 'profit') {
      if (category === 'income') total += credit - debit;
      if (category === 'expense') total -= debit - credit;
    }
  }
  return decimal(total);
}

function regularCalculationNote(metric, targetAccountId) {
  if (metric === 'profit') return 'سود/زیان = خالص درآمدها منهای خالص هزینه‌ها در بازه گزارش.';
  if (metric === 'cash') return 'مانده بانک و صندوق = جمع بدهکار منهای بستانکار حساب‌های مالی فعال تا تاریخ گزارش.';
  if (metric === 'income') return 'درآمد = جمع بستانکار منهای بدهکار حساب‌های درآمد در بازه گزارش.';
  if (metric === 'expense' && targetAccountId) return 'خالص گردش این حساب هزینه = بدهکار منهای بستانکار همان حساب در بازه گزارش.';
  if (metric === 'expense') return 'هزینه = جمع بدهکار منهای بستانکار حساب‌های هزینه در بازه گزارش.';
  return 'عدد از گزارش معتبر حسابداری و ردیف‌های دفتر کل مرتبط ردیابی می‌شود.';
}

export function buildWhyNumberEvidence({
  metric,
  accounts = [],
  financialAccounts = [],
  roles = {},
  parties = [],
  entries = [],
  lines = [],
  invoices = [],
  from = null,
  to = null,
  targetPartyId = null,
  targetAccountId = null
} = {}) {
  const meta = METRICS[metric];
  if (!meta) throw new Error('WHY_NUMBER_METRIC_INVALID');
  if (!to) throw new Error('WHY_NUMBER_TO_REQUIRED');

  if (meta.agingSide) {
    return buildAgingEvidence({
      metric,
      meta,
      roles,
      parties,
      accounts,
      entries,
      lines,
      invoices,
      from,
      to,
      targetPartyId
    });
  }

  const accountIds = new Set();
  if (targetAccountId) {
    accountIds.add(targetAccountId);
  } else if (metric === 'cash') {
    financialAccounts
      .filter(item => item?.is_active !== false)
      .forEach(item => {
        if (item?.ledger_account_id) accountIds.add(item.ledger_account_id);
      });
  } else {
    const categories = new Set(meta.categories);
    accounts.forEach(account => {
      if (categories.has(account?.category)) accountIds.add(account.id);
    });
  }

  const entryMap = new Map(entries.map(entry => [entry.id, entry]));
  const evidenceLines = lines.filter(line => {
    if (!accountIds.has(line.account_id)) return false;
    if (targetPartyId && line.party_id !== targetPartyId) return false;
    const entry = entryMap.get(line.journal_entry_id);
    return entryInScope(entry, meta, from, to);
  });
  const journals = journalEvidence({ evidenceLines, entries });
  const selectedAccounts = evidenceAccounts({ accounts, accountIds });
  const accountMap = new Map(accounts.map(account => [account.id, account]));
  const targetAccount = targetAccountId
    ? accountMap.get(targetAccountId) || null
    : null;

  return {
    metric,
    title: targetAccount ? `${meta.title} — ${targetAccount.name || 'حساب'}` : meta.title,
    sourceReport: meta.sourceReport,
    scope: meta.scope,
    from,
    to,
    accountCount: selectedAccounts.length,
    journalCount: journals.length,
    lineCount: evidenceLines.length,
    accounts: selectedAccounts,
    journals,
    calculatedAmount: regularCalculatedAmount(metric, evidenceLines, accountMap),
    calculationNote: regularCalculationNote(metric, targetAccountId),
    targetAccountId: targetAccountId || null
  };
}