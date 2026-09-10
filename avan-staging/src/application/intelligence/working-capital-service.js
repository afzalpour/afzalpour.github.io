'use strict';

import { buildWorkingCapitalFoundation } from '../../intelligence/working-capital-foundation.js';

function isoDate(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('WORKING_CAPITAL_AS_OF_REQUIRED');
  return text;
}

function queryWorkspace(table, fields, workspaceId, suffix = '') {
  const tail = suffix ? `&${suffix}` : '';
  return [table, `select=${fields}&workspace_id=eq.${workspaceId}${tail}`];
}

function freezeWorkspace(workspace) {
  return Object.freeze({
    id: String(workspace.id),
    name: String(workspace.display_name || workspace.name || 'شرکت بدون نام'),
    role: String(workspace.role || '')
  });
}

export function createWorkingCapitalService({ cloud, buildSnapshot = buildWorkingCapitalFoundation } = {}) {
  if (!cloud?.companyContext?.ensure || typeof cloud.select !== 'function') {
    throw new Error('WORKING_CAPITAL_DEPENDENCY_MISSING');
  }

  async function activeWorkspace() {
    const state = await cloud.companyContext.ensure();
    if (state?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
    const workspace = state?.active_company;
    if (!workspace?.id) throw new Error('COMPANY_REQUIRED');
    return freezeWorkspace(workspace);
  }

  async function load({ asOf } = {}) {
    const normalizedAsOf = isoDate(asOf);
    const workspace = await activeWorkspace();
    const wid = workspace.id;

    const [roleRows, parties, invoices, entries, lines, financialAccounts] = await Promise.all([
      cloud.select(...queryWorkspace('account_roles', 'role_key,account_id', wid)),
      cloud.select(...queryWorkspace('parties', 'id,name,kind,is_active,archived_at', wid, 'order=name.asc')),
      cloud.select(...queryWorkspace(
        'invoices',
        'id,invoice_no,invoice_type,invoice_date,due_date,party_id,status,journal_entry_id,reversal_journal_entry_id,total_amount',
        wid,
        `invoice_date=lte.${normalizedAsOf}&order=invoice_date.asc,invoice_no.asc`
      )),
      cloud.select(...queryWorkspace(
        'journal_entries',
        'id,journal_no,entry_date,status,source_type,source_id,description',
        wid,
        `entry_date=lte.${normalizedAsOf}&order=entry_date.asc,journal_no.asc.nullslast`
      )),
      cloud.select(...queryWorkspace(
        'journal_lines',
        'id,journal_entry_id,line_no,account_id,party_id,description,debit,credit',
        wid,
        'order=journal_entry_id.asc,line_no.asc'
      )),
      cloud.select(...queryWorkspace(
        'financial_accounts',
        'id,ledger_account_id,kind,is_active',
        wid,
        'is_active=eq.true&order=kind.asc'
      ))
    ]);

    const roles = Object.fromEntries((roleRows || [])
      .filter(row => row?.role_key && row?.account_id)
      .map(row => [row.role_key, row.account_id]));

    const snapshot = buildSnapshot({
      asOf: normalizedAsOf,
      roles,
      parties: parties || [],
      invoices: invoices || [],
      entries: entries || [],
      lines: lines || [],
      financialAccounts: financialAccounts || []
    });

    return Object.freeze({
      workspace,
      snapshot,
      contracts: Object.freeze({
        companyScoped: true,
        explicitWorkspaceFilter: true,
        rlsRequired: true,
        writeOperations: 0,
        autonomousCollection: false,
        autonomousPayment: false
      })
    });
  }

  return Object.freeze({ load, activeWorkspace });
}
