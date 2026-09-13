'use strict';

import { buildSmartProcurementSpendControl } from '../../intelligence/smart-procurement-spend-foundation.js';

function isoDate(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('PROCUREMENT_AS_OF_REQUIRED');
  return text;
}

function scoped(table, fields, wid, suffix = '') {
  return [table, `select=${fields}&workspace_id=eq.${wid}${suffix ? `&${suffix}` : ''}`];
}

function fiscalYearForDate(years, asOf) {
  return (years || []).find(row => row.date_from <= asOf && row.date_to >= asOf) || null;
}

export function createSmartProcurementSpendService({ cloud, buildSnapshot = buildSmartProcurementSpendControl } = {}) {
  if (!cloud?.companyContext?.ensure || typeof cloud.select !== 'function') {
    throw new Error('PROCUREMENT_DEPENDENCY_MISSING');
  }

  async function activeWorkspace() {
    const state = await cloud.companyContext.ensure();
    if (state?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
    const workspace = state?.active_company;
    if (!workspace?.id) throw new Error('COMPANY_REQUIRED');
    return workspace;
  }

  async function load({ asOf } = {}) {
    const normalizedAsOf = isoDate(asOf);
    const workspace = await activeWorkspace();
    const wid = workspace.id;

    const [years, items, onHand] = await Promise.all([
      cloud.select(...scoped('fiscal_years', 'id,name,date_from,date_to,status', wid, 'order=date_from.desc')),
      cloud.select(...scoped('inventory_items', 'id,sku,name,item_type,min_stock,is_active', wid, 'order=name.asc')),
      cloud.select(...scoped('inventory_on_hand', 'workspace_id,item_id,warehouse_id,quantity_on_hand,inventory_value,average_unit_cost', wid, 'order=item_id.asc'))
    ]);

    const fiscalYear = fiscalYearForDate(years, normalizedAsOf);
    const periodFrom = fiscalYear?.date_from || `${normalizedAsOf.slice(0, 4)}-01-01`;

    const invoices = await cloud.select(...scoped(
      'invoices',
      'id,invoice_no,invoice_type,invoice_date,due_date,party_id,subtotal_amount,tax_total,total_amount,status,journal_entry_id,inventory_document_id,description',
      wid,
      `invoice_type=eq.purchase&invoice_date=gte.${periodFrom}&invoice_date=lte.${normalizedAsOf}&order=invoice_date.asc,invoice_no.asc.nullslast`
    ));

    const invoiceIds = (invoices || []).map(row => String(row.id)).filter(Boolean);
    const partyIds = [...new Set((invoices || []).map(row => String(row.party_id || '')).filter(Boolean))];

    const [invoiceLines, parties, receiptDocuments] = await Promise.all([
      invoiceIds.length ? cloud.select(...scoped(
        'invoice_lines',
        'id,invoice_id,line_no,item_id,description,quantity,unit_price,discount,line_total,receipt_line_id',
        wid,
        `invoice_id=in.(${invoiceIds.join(',')})&order=invoice_id.asc,line_no.asc`
      )) : [],
      partyIds.length ? cloud.select(...scoped(
        'parties',
        'id,name,kind,is_active,national_id,economic_code,tax_id,entity_type',
        wid,
        `id=in.(${partyIds.join(',')})&order=name.asc`
      )) : [],
      cloud.select(...scoped(
        'inventory_documents',
        'id,document_no,document_type,document_date,status,source_type,source_id,journal_entry_id,description',
        wid,
        `document_type=eq.receipt&document_date=gte.${periodFrom}&document_date=lte.${normalizedAsOf}&order=document_date.asc,document_no.asc.nullslast`
      ))
    ]);

    const receiptDocumentIds = (receiptDocuments || []).map(row => String(row.id)).filter(Boolean);
    const receiptLines = receiptDocumentIds.length ? await cloud.select(...scoped(
      'inventory_document_lines',
      'id,inventory_document_id,line_no,item_id,to_warehouse_id,quantity,unit_cost,description',
      wid,
      `inventory_document_id=in.(${receiptDocumentIds.join(',')})&order=inventory_document_id.asc,line_no.asc`
    )) : [];

    const snapshot = buildSnapshot({
      asOf: normalizedAsOf,
      periodFrom,
      workspace,
      invoices: invoices || [],
      invoiceLines: invoiceLines || [],
      parties: parties || [],
      inventoryItems: items || [],
      inventoryOnHand: onHand || [],
      inventoryDocuments: receiptDocuments || [],
      inventoryDocumentLines: receiptLines || []
    });

    return Object.freeze({
      workspace,
      snapshot,
      contracts: Object.freeze({
        companyScoped: true,
        explicitWorkspaceFilter: true,
        rlsRequired: true,
        sourceOfTruth: 'postgresql-supabase',
        writeOperations: 0,
        paymentMutation: false,
        approvalMutation: false
      })
    });
  }

  return Object.freeze({ activeWorkspace, load });
}
