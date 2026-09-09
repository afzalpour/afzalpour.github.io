'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import {
  canonicalTenthsToDecimal,
  displayDecimalToCanonicalTenth
} from '../../core/money/canonical-money.js';
import {
  canonicalSettlementAmount,
  validateSettlementPlanTotal
} from '../../domains/settlement/settlement-plan-contract.js';

const C = installAvanCloud();

function fieldValue(root, name) {
  return String(root?.querySelector?.(`[name="${name}"]`)?.value || '');
}

function isoFromForm(form, name) {
  return String(new FormData(form).get(name) || '');
}

function canonicalFromTenths(tenths) {
  return canonicalTenthsToDecimal(tenths) || '0';
}

function exactCanonical(raw) {
  return canonicalSettlementAmount(raw);
}

function settlementRowCanonical(row, isV2) {
  const raw = fieldValue(row, 'v60_amount');
  if (isV2) return exactCanonical(raw);
  const parsed = displayDecimalToCanonicalTenth(raw || '0', MoneyRuntime.unit());
  return parsed.ok ? { tenths: parsed.tenths, value: parsed.value } : null;
}

async function activeCompany() {
  const snapshot = await C.companyContext.ensure();
  const company = snapshot?.active_company;
  if (!company?.id) throw new Error('COMPANY_REQUIRED');
  return company;
}

async function financialKind(workspaceId, accountId) {
  if (!accountId) return null;
  const rows = await C.select(
    'financial_accounts',
    `select=kind&workspace_id=eq.${workspaceId}&ledger_account_id=eq.${accountId}&is_active=eq.true&limit=1`
  );
  return rows?.[0]?.kind || null;
}

async function gatherPlan(form, totalCanonical, company) {
  const box = form.querySelector('[data-v60-settlement-box]');
  if (!box) return null;

  const total = exactCanonical(totalCanonical);
  if (!total || total.tenths <= 0n) return null;

  const type = fieldValue(box, 'v60_plan_type') || 'credit';
  const date = isoFromForm(form, 'date') || new Date().toISOString().slice(0, 10);
  const due = isoFromForm(form, 'due') || date;
  const rows = [];
  const isV2 = box.dataset.avanSettlementV2 === '1';

  if (type === 'credit') {
    rows.push({
      amount: total.value,
      due_date: fieldValue(box, 'v60_credit_due') || due,
      planned_method: 'open',
      auto_settle: false
    });
  } else if (type === 'cash') {
    const accountId = fieldValue(box, 'v60_cash_account');
    if (!accountId) throw new Error('برای فاکتور نقدی صندوق یا بانک را انتخاب کنید');
    const kind = await financialKind(company.id, accountId);
    rows.push({
      amount: total.value,
      due_date: date,
      planned_method: kind === 'cash' ? 'cash' : 'bank',
      auto_settle: true,
      financial_account_id: accountId
    });
  } else if (type === 'check') {
    const checkNumber = fieldValue(box, 'v60_check_no').trim();
    const bankName = fieldValue(box, 'v60_check_bank').trim();
    if (!checkNumber || !bankName) throw new Error('شماره و بانک چک را وارد کنید');
    rows.push({
      amount: total.value,
      due_date: fieldValue(box, 'v60_check_due') || due,
      planned_method: 'check',
      auto_settle: true,
      check_number: checkNumber,
      check_bank_name: bankName,
      check_branch: fieldValue(box, 'v60_check_branch').trim() || null
    });
  } else {
    for (const row of box.querySelectorAll('[data-v60-plan-row]')) {
      const amount = settlementRowCanonical(row, isV2);
      if (!amount || amount.tenths <= 0n) throw new Error('مبلغ یکی از ردیف‌های تسویه معتبر نیست');
      const method = type === 'installment' ? 'open' : (fieldValue(row, 'v60_method') || 'open');
      const item = {
        amount: amount.value,
        due_date: fieldValue(row, 'v60_due') || due,
        planned_method: method,
        auto_settle: type === 'mixed' && method !== 'open'
      };
      if (['cash', 'bank'].includes(method)) {
        item.financial_account_id = fieldValue(row, 'v60_fin') || null;
        if (!item.financial_account_id) throw new Error('حساب صندوق/بانک یکی از ردیف‌های تسویه را انتخاب کنید');
      }
      if (method === 'check') {
        item.check_number = fieldValue(row, 'v60_check_no').trim();
        item.check_bank_name = fieldValue(row, 'v60_check_bank').trim();
        if (!item.check_number || !item.check_bank_name) throw new Error('اطلاعات چک یکی از ردیف‌ها کامل نیست');
      }
      rows.push(item);
    }
  }

  const validation = validateSettlementPlanTotal(total.value, rows);
  if (!validation.ok) {
    throw new Error(validation.code === 'SETTLEMENT_TOTAL_MISMATCH'
      ? 'جمع شرایط تسویه باید دقیقاً با جمع نهایی فاکتور برابر باشد'
      : 'مبلغ یکی از ردیف‌های تسویه معتبر نیست');
  }
  return { type, rows };
}

if (!C.operations.has('rpc', 'settlement:invoice-plan')) {
  C.operations.use('rpc', 'settlement:invoice-plan', async ({ args, next }) => {
    const [name, payload = {}] = args;
    const form = document.getElementById('invoiceForm');
    if (name !== 'save_draft_invoice' || !form) return next(name, payload);

    let nextPayload = payload;
    const saved = form.dataset.v60DraftId || '';
    if (!payload.p_invoice_id && saved) nextPayload = { ...payload, p_invoice_id: saved };

    const result = await next(name, nextPayload);
    form.dataset.v60DraftId = String(result);

    const company = await activeCompany();
    const persisted = await C.select(
      'invoices',
      `select=total_amount&workspace_id=eq.${company.id}&id=eq.${result}&limit=1`
    );
    const totalCanonical = String(persisted?.[0]?.total_amount ?? '');
    const total = exactCanonical(totalCanonical);
    if (!total) throw new Error('جمع نهایی فاکتور پس از ذخیره قابل خواندن نیست');

    form.dataset.avanInvoiceTotal = total.value;
    form.dataset.avanCanonicalInvoiceTotalToman = total.value;
    const plan = await gatherPlan(form, total.value, company);
    if (plan) {
      await C.rpc('save_invoice_settlement_plan', {
        p_invoice_id: result,
        p_plan_type: plan.type,
        p_schedule: plan.rows,
        p_notes: null
      });
    }
    return result;
  }, { priority: 300 });
}

export const SettlementSaveBoundaryV3 = Object.freeze({
  architecture: 'settlement-save-boundary-v3',
  gatherPlan,
  validateSettlementPlanTotal
});
