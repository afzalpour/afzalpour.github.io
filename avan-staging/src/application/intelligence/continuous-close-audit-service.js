'use strict';

import { createControlTowerSnapshotService } from './control-tower-snapshot-service.js';
import { buildContinuousCloseAuditFoundation } from '../../intelligence/continuous-close-audit-foundation.js';

function isoDate(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('CONTINUOUS_CLOSE_AUDIT_AS_OF_REQUIRED');
  return text;
}

function queryWorkspace(table, fields, workspaceId, suffix = '') {
  const tail = suffix ? `&${suffix}` : '';
  return [table, `select=${fields}&workspace_id=eq.${workspaceId}${tail}`];
}

export function createContinuousCloseAuditService({
  cloud,
  buildSnapshot = buildContinuousCloseAuditFoundation,
  createTowerService = createControlTowerSnapshotService
} = {}) {
  if (!cloud?.companyContext?.ensure || typeof cloud.select !== 'function' || typeof cloud.rpc !== 'function') {
    throw new Error('CONTINUOUS_CLOSE_AUDIT_DEPENDENCY_MISSING');
  }

  const towerService = createTowerService({ cloud });

  async function load({ asOf } = {}) {
    const normalizedAsOf = isoDate(asOf);
    const workspace = await towerService.activeWorkspace();
    const wid = workspace.id;
    const endOfDay = `${normalizedAsOf}T23:59:59.999Z`;

    const [
      towerResult,
      entries,
      lines,
      invoices,
      transactions,
      documents,
      parties,
      periods,
      integrity,
      invoiceIntegrity
    ] = await Promise.all([
      towerService.load({ asOf: normalizedAsOf }),
      cloud.select(...queryWorkspace(
        'journal_entries',
        'id,journal_no,entry_date,status,source_type,source_id,description,reversal_of,created_at',
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
        'invoices',
        'id,invoice_no,invoice_type,invoice_date,due_date,party_id,total_amount,status,journal_entry_id,description',
        wid,
        `invoice_date=lte.${normalizedAsOf}&order=invoice_date.asc,invoice_no.asc.nullslast`
      )),
      cloud.select(...queryWorkspace(
        'financial_transactions',
        'id,tx_date,tx_type,amount,from_account_id,to_account_id,counterpart_account_id,party_id,description,status,journal_entry_id,created_at',
        wid,
        `tx_date=lte.${normalizedAsOf}&order=tx_date.asc,created_at.asc`
      )),
      cloud.select(...queryWorkspace(
        'documents',
        'id,party_id,document_type,status,file_name,file_hash,source_document_date,total_amount,linked_journal_entry_id,created_at',
        wid,
        `created_at=lte.${encodeURIComponent(endOfDay)}&order=created_at.asc`
      )),
      cloud.select(...queryWorkspace(
        'parties',
        'id,name,kind,created_at,is_active',
        wid,
        'order=name.asc'
      )),
      cloud.select(...queryWorkspace(
        'fiscal_periods',
        'id,name,date_from,date_to,status,closed_at',
        wid,
        `date_from=lte.${normalizedAsOf}&order=date_from.desc`
      )),
      cloud.rpc('avan_core_integrity', { wid }),
      cloud.rpc('invoice_integrity', { wid })
    ]);

    if (String(towerResult?.workspace?.id || '') !== String(wid)) {
      throw new Error('CONTINUOUS_CLOSE_AUDIT_WORKSPACE_MISMATCH');
    }

    const snapshot = buildSnapshot({
      asOf: normalizedAsOf,
      controlTower: towerResult.snapshot,
      entries: entries || [],
      lines: lines || [],
      invoices: invoices || [],
      transactions: transactions || [],
      documents: documents || [],
      parties: parties || [],
      periods: periods || [],
      integrity: integrity || {},
      invoiceIntegrity: invoiceIntegrity || {}
    });

    return Object.freeze({
      workspace,
      snapshot,
      contracts: Object.freeze({
        companyScoped: true,
        explicitWorkspaceFilter: true,
        rlsRequired: true,
        sourceOfTruth: 'postgresql-supabase',
        writeOperations: 0
      })
    });
  }

  return Object.freeze({ load });
}
