'use strict';

import { buildControlTowerFoundation } from '../../intelligence/control-tower-foundation.js';

function isoDate(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('CONTROL_TOWER_AS_OF_REQUIRED');
  return text;
}

function freezeWorkspace(workspace) {
  return Object.freeze({
    id: String(workspace.id),
    name: String(workspace.display_name || workspace.name || 'شرکت بدون نام'),
    role: String(workspace.role || '')
  });
}

function queryWorkspace(table, fields, workspaceId, suffix = '') {
  const tail = suffix ? `&${suffix}` : '';
  return [table, `select=${fields}&workspace_id=eq.${workspaceId}${tail}`];
}

export function createControlTowerSnapshotService({
  cloud,
  buildSnapshot = buildControlTowerFoundation
} = {}) {
  if (!cloud?.companyContext?.ensure || typeof cloud.select !== 'function') {
    throw new Error('CONTROL_TOWER_DEPENDENCY_MISSING');
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

    const [
      roleRows,
      financialAccounts,
      entries,
      lines,
      bankStatementLines,
      bankMatches,
      inventoryReconciliations
    ] = await Promise.all([
      cloud.select(...queryWorkspace('account_roles', 'role_key,account_id', wid)),
      cloud.select(...queryWorkspace(
        'financial_accounts',
        'id,ledger_account_id,kind,is_active',
        wid,
        'is_active=eq.true&order=kind.asc'
      )),
      cloud.select(...queryWorkspace(
        'journal_entries',
        'id,journal_no,entry_date,status,source_type,source_id,description',
        wid,
        `entry_date=lte.${normalizedAsOf}&order=entry_date.asc,journal_no.asc.nullslast`
      )),
      cloud.select(...queryWorkspace(
        'journal_lines',
        'journal_entry_id,line_no,account_id,party_id,description,debit,credit',
        wid,
        'order=journal_entry_id.asc,line_no.asc'
      )),
      cloud.select(...queryWorkspace(
        'bank_statement_lines',
        'id,import_id,financial_account_id,booking_date,direction,amount,description,ignored_at',
        wid,
        `booking_date=lte.${normalizedAsOf}&order=booking_date.asc,line_no.asc`
      )),
      cloud.select(...queryWorkspace(
        'bank_reconciliation_matches',
        'statement_line_id,financial_transaction_id,voided_at',
        wid
      )),
      cloud.select(...queryWorkspace(
        'inventory_financial_reconciliation',
        'workspace_id,is_reconciled,inventory_difference,cogs_difference',
        wid
      ))
    ]);

    const roles = Object.fromEntries(
      (roleRows || [])
        .filter(row => row?.role_key && row?.account_id)
        .map(row => [row.role_key, row.account_id])
    );

    const snapshot = buildSnapshot({
      asOf: normalizedAsOf,
      roles,
      financialAccounts: financialAccounts || [],
      entries: entries || [],
      lines: lines || [],
      bankStatementLines: bankStatementLines || [],
      bankMatches: bankMatches || [],
      inventoryReconciliations: inventoryReconciliations || []
    });

    return Object.freeze({
      workspace,
      snapshot,
      contracts: Object.freeze({
        companyScoped: true,
        explicitWorkspaceFilter: true,
        rlsRequired: true,
        writeOperations: 0
      })
    });
  }

  return Object.freeze({ load, activeWorkspace });
}
