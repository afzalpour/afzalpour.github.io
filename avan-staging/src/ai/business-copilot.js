'use strict';

import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../core/money/canonical-money.js';

function toTenths(value, field = 'money') {
  const parsed = canonicalDecimalToTenths(String(value ?? '0'));
  if (parsed === null) throw new Error(`COPILOT_INVALID_MONEY:${field}`);
  return parsed;
}

function decimal(value) {
  const out = canonicalTenthsToDecimal(value);
  if (out === null) throw new Error('COPILOT_MONEY_SERIALIZE_FAILED');
  return out;
}

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ');
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

function topExpenseAccounts({ accounts = [], entries = [], lines = [], from = null, to = null }) {
  const accountMap = new Map(accounts.map(account => [account.id, account]));
  const entryMap = new Map(entries.map(entry => [entry.id, entry]));
  const totals = new Map();

  for (const line of lines) {
    const entry = entryMap.get(line.journal_entry_id);
    if (!entry || entry.status === 'draft') continue;
    if (from && entry.entry_date < from) continue;
    if (to && entry.entry_date > to) continue;

    const account = accountMap.get(line.account_id);
    if (!account || account.category !== 'expense') continue;

    const amount = toTenths(line.debit, 'expense_debit') - toTenths(line.credit, 'expense_credit');
    totals.set(account.id, (totals.get(account.id) || 0n) + amount);
  }

  return [...totals.entries()]
    .map(([accountId, amountTenths]) => ({
      accountId,
      accountName: accountMap.get(accountId)?.name || 'حساب هزینه',
      amount: decimal(amountTenths),
      amountTenths
    }))
    .filter(item => item.amountTenths > 0n)
    .sort((a, b) => a.amountTenths === b.amountTenths ? 0 : a.amountTenths > b.amountTenths ? -1 : 1)
    .map(({ amountTenths, ...item }) => Object.freeze(item));
}

function makeInsight(id, level, title, description, value = null, unit = 'money') {
  return Object.freeze({ id, level, title, description, value, unit });
}

export function buildFinancialCopilotSnapshot({
  asOf,
  fiscalFrom = null,
  assets = '0',
  liabilities = '0',
  profit = '0',
  cash = '0',
  aging = null,
  accounts = [],
  entries = [],
  lines = [],
  documents = [],
  invoices = [],
  integrity = null
} = {}) {
  if (!asOf) throw new Error('COPILOT_AS_OF_REQUIRED');

  const ar = aging?.receivables || null;
  const ap = aging?.payables || null;
  const assetsTenths = toTenths(assets, 'assets');
  const liabilitiesTenths = toTenths(liabilities, 'liabilities');
  const profitTenths = toTenths(profit, 'profit');
  const cashTenths = toTenths(cash, 'cash');
  const receivablesTenths = ar?.available ? toTenths(ar.total, 'receivables') : 0n;
  const payablesTenths = ap?.available ? toTenths(ap.total, 'payables') : 0n;
  const overdueReceivablesTenths = overdueTotal(ar);
  const overduePayablesTenths = overdueTotal(ap);

  const topReceivable = ar?.available ? ar.parties?.[0] || null : null;
  const topPayable = ap?.available ? ap.parties?.[0] || null : null;
  const concentration = topReceivable && receivablesTenths > 0n
    ? Number((toTenths(topReceivable.total, 'top_receivable') * 10000n) / receivablesTenths) / 100
    : 0;

  const expenseAccounts = topExpenseAccounts({ accounts, entries, lines, from: fiscalFrom, to: asOf });
  const pendingDocuments = documents.filter(document =>
    document.status !== 'linked' && ['uploaded', 'extracted', 'reviewed'].includes(document.status)
  ).length;
  const draftCount =
    entries.filter(entry => entry.status === 'draft').length +
    invoices.filter(invoice => invoice.status === 'draft').length;
  const unbalancedPosted = Number(integrity?.unbalanced_journals || 0);
  const insights = [];

  if (unbalancedPosted > 0) {
    insights.push(makeInsight(
      'ledger_integrity', 'critical', 'کنترل یکپارچگی Ledger',
      'سند ثبت‌شده نامتوازن گزارش شده و باید فوراً بررسی شود.',
      unbalancedPosted, 'count'
    ));
  }

  if (overduePayablesTenths > 0n && overduePayablesTenths > cashTenths) {
    insights.push(makeInsight(
      'cash_pressure', 'critical', 'فشار نقدینگی کوتاه‌مدت',
      'بدهی تجاری سررسیدگذشته از نقدینگی فعلی بیشتر است.',
      decimal(overduePayablesTenths - cashTenths), 'money'
    ));
  }

  if (profitTenths < 0n) {
    insights.push(makeInsight(
      'loss', 'critical', 'زیان دوره',
      'عملکرد دوره تا این تاریخ منفی است و نیاز به بررسی درآمد و هزینه دارد.',
      decimal(-profitTenths), 'money'
    ));
  }

  if (overdueReceivablesTenths > 0n) {
    insights.push(makeInsight(
      'overdue_receivables', 'warning', 'مطالبات سررسیدگذشته',
      'بخشی از مطالبات از سررسید عبور کرده و نیاز به پیگیری وصول دارد.',
      decimal(overdueReceivablesTenths), 'money'
    ));
  }

  if (concentration >= 50) {
    insights.push(makeInsight(
      'customer_concentration', 'warning', 'تمرکز مطالبات روی یک مشتری',
      'بخش بزرگی از مانده مطالبات به یک طرف‌حساب وابسته است.',
      concentration, 'percent'
    ));
  }

  if (profitTenths > 0n && receivablesTenths > cashTenths && receivablesTenths > 0n) {
    insights.push(makeInsight(
      'profit_cash_gap', 'attention', 'سود مثبت، نقد محدود',
      'سود مثبت است اما مانده مطالبات از نقدینگی بیشتر است؛ وصول مطالبات را بررسی کنید.',
      decimal(receivablesTenths), 'money'
    ));
  }

  if (pendingDocuments > 0) {
    insights.push(makeInsight(
      'document_backlog', 'attention', 'اسناد هوشمند تکمیل‌نشده',
      'چند سند هنوز تا اتصال نهایی به Ledger فاصله دارند.',
      pendingDocuments, 'count'
    ));
  }

  if (draftCount > 0) {
    insights.push(makeInsight(
      'draft_backlog', 'info', 'پیش‌نویس‌های باز',
      'پیش‌نویس فاکتور یا سند حسابداری برای تکمیل وجود دارد.',
      draftCount, 'count'
    ));
  }

  if (!insights.length) {
    insights.push(makeInsight(
      'no_priority_alert', 'healthy', 'مورد بحرانی مشاهده نشد',
      'بر اساس کنترل‌های فعلی، هشدار اولویت‌بالایی برای نمایش وجود ندارد.',
      null, 'none'
    ));
  }

  const order = { critical: 1, warning: 2, attention: 3, info: 4, healthy: 5 };
  insights.sort((a, b) => order[a.level] - order[b.level]);

  return Object.freeze({
    asOf,
    fiscalFrom,
    metrics: Object.freeze({
      assets: decimal(assetsTenths),
      liabilities: decimal(liabilitiesTenths),
      profit: decimal(profitTenths),
      cash: decimal(cashTenths),
      receivables: decimal(receivablesTenths),
      payables: decimal(payablesTenths),
      overdueReceivables: decimal(overdueReceivablesTenths),
      overduePayables: decimal(overduePayablesTenths)
    }),
    topReceivable,
    topPayable,
    receivableConcentration: concentration,
    topExpenseAccounts: Object.freeze(expenseAccounts.slice(0, 5)),
    pendingDocuments,
    draftCount,
    insights: Object.freeze(insights.slice(0, 5)),
    contracts: Object.freeze({
      deterministic: true,
      oneRialExact: true,
      aiGeneratedAmounts: false,
      actualLedgerMutation: false
    })
  });
}

export function answerBusinessQuestion({ query, snapshot } = {}) {
  if (!snapshot) throw new Error('COPILOT_SNAPSHOT_REQUIRED');
  const q = normalize(query);
  if (!q) return { kind: 'unknown', source: 'Avan Intelligence', data: {} };

  if (/چرا.*(پول|نقد)/.test(q) || /سود.*(پول|نقد)/.test(q) || /(پول|نقد).*(کجاست|ندار)/.test(q)) {
    return { kind: 'cash_explanation', source: 'Profit & Loss + Cash + AR/AP Aging', data: { ...snapshot.metrics } };
  }
  if (/بدهکارترین مشتری/.test(q) || /بیشترین مطالبات/.test(q) || /بزرگترین.*طلب/.test(q)) {
    return { kind: 'top_receivable', source: 'AR Aging / Ledger', data: { party: snapshot.topReceivable || null, total: snapshot.metrics.receivables } };
  }
  if (/مطالبات/.test(q) || /طلب/.test(q) || /دریافتنی/.test(q)) {
    return { kind: 'receivables', source: 'AR Aging / Ledger', data: { total: snapshot.metrics.receivables, overdue: snapshot.metrics.overdueReceivables } };
  }
  if (/بستانکارترین/.test(q) || /بیشترین بدهی.*(تامین|فروشنده|طرف)/.test(q)) {
    return { kind: 'top_payable', source: 'AP Aging / Ledger', data: { party: snapshot.topPayable || null, total: snapshot.metrics.payables } };
  }
  if (/بدهی تجاری/.test(q) || /پرداختنی/.test(q)) {
    return { kind: 'payables', source: 'AP Aging / Ledger', data: { total: snapshot.metrics.payables, overdue: snapshot.metrics.overduePayables } };
  }
  if (/بزرگترین هزینه/.test(q) || /بیشترین هزینه/.test(q) || /هزینه.*بیشتر/.test(q)) {
    return { kind: 'top_expense', source: 'Journal Lines / Ledger', data: { account: snapshot.topExpenseAccounts?.[0] || null } };
  }
  if (/سود/.test(q) || /زیان/.test(q)) {
    return {
      kind: 'profit', source: 'report_profit_loss', evidenceMetric: 'profit',
      evidenceAmount: snapshot.metrics.profit, data: { profit: snapshot.metrics.profit }
    };
  }
  if (/نقدینگی/.test(q) || /بانک/.test(q) || /صندوق/.test(q) || /چقدر پول/.test(q)) {
    return {
      kind: 'cash', source: 'report_cash_bank_balances', evidenceMetric: 'cash',
      evidenceAmount: snapshot.metrics.cash, data: { cash: snapshot.metrics.cash }
    };
  }
  if (/ریسک/.test(q) || /مشکل/.test(q) || /توجه/.test(q) || /اوضاع/.test(q) || /چه خبر/.test(q)) {
    return { kind: 'priorities', source: 'Avan CFO Autopilot', data: { insights: snapshot.insights.slice(0, 3) } };
  }
  return { kind: 'unknown', source: 'Avan Intelligence', data: {} };
}
