'use strict';

import { buildPartyAging } from './party-aging.js';
import {
  reportMoneyCategoryTenths,
  reportMoneyDecimal,
  sumReportMoneyTenths
} from './report-money-exact.js';

const ALLOWED_RPCS = new Set([
  'report_trial_balance',
  'report_journal',
  'report_profit_loss',
  'report_balance_sheet',
  'report_cash_bank_balances',
  'report_account_statement'
]);

function plain(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  }
  return value;
}

async function trustedRpc(rpc, name, params) {
  if (typeof rpc !== 'function') throw new Error('REPORT_RPC_REQUIRED');
  if (!ALLOWED_RPCS.has(name)) throw new Error('REPORT_RPC_NOT_ALLOWED');
  const rows = await rpc(name, params);
  return Array.isArray(rows) ? rows : [];
}

function rangeOf(intent) {
  const period = intent?.period || {};
  const to = period.to || null;
  return { from: period.from || to, to };
}

function rpcSource(name, params) {
  return { type: 'trusted_rpc', name, params };
}

function clarification(code, extra = {}) {
  return { status: 'clarification', code, read_only: true, ...extra };
}

export async function executeReportIntent({
  intent,
  workspaceId,
  rpc,
  agingContext = {}
} = {}) {
  if (!intent) throw new Error('REPORT_INTENT_REQUIRED');
  if (!workspaceId) throw new Error('REPORT_WORKSPACE_REQUIRED');
  if (intent.read_only !== true || intent.allow_raw_sql === true) {
    throw new Error('REPORT_INTENT_UNSAFE');
  }
  if (intent.requires_clarification) {
    return clarification(intent.clarification_code || 'REPORT_CLARIFICATION_REQUIRED', {
      intent: intent.intent,
      metric: intent.metric
    });
  }

  const { from, to } = rangeOf(intent);
  if (!to) throw new Error('REPORT_PERIOD_REQUIRED');
  const wid = workspaceId;

  if (intent.intent === 'trial_balance') {
    const params = { wid, dfrom: from, dto: to };
    const rows = await trustedRpc(rpc, 'report_trial_balance', params);
    return plain({
      status: 'ok', kind: 'table', title: 'تراز آزمایشی', rows,
      period: intent.period, source: rpcSource('report_trial_balance', params), read_only: true
    });
  }

  if (intent.intent === 'journal') {
    const params = { wid, dfrom: from, dto: to };
    const rows = await trustedRpc(rpc, 'report_journal', params);
    return plain({
      status: 'ok', kind: 'table', title: 'دفتر روزنامه', rows,
      period: intent.period, source: rpcSource('report_journal', params), read_only: true
    });
  }

  if (intent.intent === 'account_statement') {
    if (!intent.account?.id) return clarification('REPORT_ACCOUNT_REQUIRED');
    const params = { wid, aid: intent.account.id, dfrom: from, dto: to };
    const rows = await trustedRpc(rpc, 'report_account_statement', params);
    return plain({
      status: 'ok', kind: 'table', title: `گردش حساب ${intent.account.name}`,
      account: intent.account, rows, period: intent.period,
      source: rpcSource('report_account_statement', params), read_only: true
    });
  }

  if (intent.intent === 'cash_balances') {
    const params = { wid, as_of: to };
    const rows = await trustedRpc(rpc, 'report_cash_bank_balances', params);
    const totalTenths = sumReportMoneyTenths(rows.map(row => row.amount), 'cash');
    return plain({
      status: 'ok', kind: 'metric_table', title: 'مانده بانک و صندوق',
      value: reportMoneyDecimal(totalTenths, 'cash_total'), evidence_metric: 'cash', rows,
      period: intent.period, source: rpcSource('report_cash_bank_balances', params),
      read_only: true, one_rial_exact: true
    });
  }

  if (intent.intent === 'profit_loss' || intent.intent === 'sales') {
    const params = { wid, dfrom: from, dto: to };
    const rows = await trustedRpc(rpc, 'report_profit_loss', params);
    const values = reportMoneyCategoryTenths(rows);
    const income = values.income || 0n;
    const expense = values.expense || 0n;
    const profit = income - expense;

    let valueTenths = profit;
    let title = 'سود / زیان';
    let evidenceMetric = 'profit';
    let approximate = false;
    let note = null;

    if (intent.metric === 'income') {
      valueTenths = income;
      title = 'درآمد';
      evidenceMetric = 'income';
    } else if (intent.metric === 'expense') {
      valueTenths = expense;
      title = 'هزینه';
      evidenceMetric = 'expense';
    }

    if (intent.intent === 'sales') {
      valueTenths = income;
      title = 'درآمد ثبت‌شده';
      evidenceMetric = 'income';
      approximate = true;
      note = 'فعلاً نزدیک‌ترین معیار معتبر Ledger به فروش است؛ گزارش فروش اختصاصی در لایه معنایی بعدی اضافه می‌شود.';
    }

    return plain({
      status: 'ok', kind: 'metric', title,
      value: reportMoneyDecimal(valueTenths, `pnl:${intent.metric || 'profit'}`),
      evidence_metric: evidenceMetric, rows, approximate, note,
      period: intent.period, source: rpcSource('report_profit_loss', params),
      read_only: true, one_rial_exact: true
    });
  }

  if (intent.intent === 'balance_sheet') {
    const params = { wid, as_of: to };
    const rows = await trustedRpc(rpc, 'report_balance_sheet', params);
    const values = reportMoneyCategoryTenths(rows);
    const assets = values.asset || 0n;
    const liabilities = values.liability || 0n;
    const equity = (values.equity || 0n) + (values.current_profit || 0n);

    let valueTenths = assets;
    let title = 'دارایی';
    let evidenceMetric = 'assets';
    if (intent.metric === 'liabilities') {
      valueTenths = liabilities;
      title = 'بدهی';
      evidenceMetric = 'liabilities';
    } else if (intent.metric === 'equity') {
      valueTenths = equity;
      title = 'حقوق مالکانه + سود جاری';
      evidenceMetric = null;
    }

    return plain({
      status: 'ok', kind: 'metric', title,
      value: reportMoneyDecimal(valueTenths, `balance:${intent.metric || 'assets'}`),
      evidence_metric: evidenceMetric, rows, period: intent.period,
      source: rpcSource('report_balance_sheet', params),
      read_only: true, one_rial_exact: true
    });
  }

  if (intent.intent === 'party_aging') {
    const aging = buildPartyAging({
      roles: agingContext.roles || {},
      parties: agingContext.parties || [],
      entries: agingContext.entries || [],
      lines: agingContext.lines || [],
      invoices: agingContext.invoices || [],
      asOf: to
    });
    const side = intent.metric === 'payable' ? aging.payables : aging.receivables;
    return plain({
      status: 'ok', kind: 'aging',
      title: intent.metric === 'payable' ? 'بدهی به طرف‌حساب‌ها' : 'مطالبات از طرف‌حساب‌ها',
      value: side.total, result: side, period: intent.period,
      source: { type: 'trusted_derived_report', name: 'party-aging' },
      read_only: true, one_rial_exact: true
    });
  }

  return clarification('REPORT_INTENT_NOT_EXECUTABLE', { intent: intent.intent });
}
