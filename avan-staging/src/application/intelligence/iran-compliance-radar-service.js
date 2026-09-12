'use strict';

import { buildIranComplianceRadar } from '../../intelligence/iran-compliance-radar-foundation.js';

function isoDate(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('COMPLIANCE_RADAR_AS_OF_REQUIRED');
  return text;
}

function scoped(table, fields, wid, suffix = '') {
  return [table, `select=${fields}&workspace_id=eq.${wid}${suffix ? `&${suffix}` : ''}`];
}

function fiscalYearForDate(years, asOf) {
  return (years || []).find(row => row.date_from <= asOf && row.date_to >= asOf) || null;
}

export function createIranComplianceRadarService({ cloud, buildSnapshot = buildIranComplianceRadar } = {}) {
  if (!cloud?.companyContext?.ensure || typeof cloud.select !== 'function') {
    throw new Error('COMPLIANCE_RADAR_DEPENDENCY_MISSING');
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

    const [settingsRows, rules, profiles, items, years, periods] = await Promise.all([
      cloud.select(...scoped('workspace_tax_settings', 'workspace_id,tax_enabled,default_rule_version_id,taxpayer_type,tax_identifier,economic_code,taxpayer_memory_id,e_invoice_enabled,updated_at', wid, 'limit=1')),
      cloud.select('tax_rule_versions', 'select=id,name_fa,effective_from,effective_to,standard_vat_rate,status,source_title,source_reference&order=effective_from.desc'),
      cloud.select(...scoped('tax_profiles', 'id,code,name_fa,treatment,rate,applies_to,rule_version_id,is_active,rule_code,rate_mode', wid, 'order=code.asc')),
      cloud.select(...scoped('inventory_items', 'id,sku,name,item_type,tax_profile_id,official_goods_service_id,is_active', wid, 'order=name.asc')),
      cloud.select(...scoped('fiscal_years', 'id,name,date_from,date_to,status', wid, 'order=date_from.desc')),
      cloud.select(...scoped('fiscal_periods', 'id,fiscal_year_id,name,date_from,date_to,status,closed_at', wid, 'order=date_from.desc'))
    ]);

    const fiscalYear = fiscalYearForDate(years, normalizedAsOf);
    const periodFrom = fiscalYear?.date_from || `${normalizedAsOf.slice(0, 4)}-01-01`;
    const invoices = await cloud.select(...scoped(
      'invoices',
      'id,invoice_no,invoice_type,invoice_date,due_date,party_id,subtotal_amount,tax_total,total_amount,status,journal_entry_id,description',
      wid,
      `invoice_date=gte.${periodFrom}&invoice_date=lte.${normalizedAsOf}&order=invoice_date.asc,invoice_no.asc.nullslast`
    ));

    const invoiceIds = (invoices || []).map(row => String(row.id)).filter(Boolean);
    const invoiceLines = invoiceIds.length
      ? await cloud.select(...scoped(
        'invoice_lines',
        'id,invoice_id,line_no,item_id,description,tax_profile_id,tax_rule_version_id,tax_rate,taxable_amount,tax_amount,tax_treatment,tax_profile_code,tax_profile_name_fa',
        wid,
        `invoice_id=in.(${invoiceIds.join(',')})&order=invoice_id.asc,line_no.asc`
      ))
      : [];

    const snapshot = buildSnapshot({
      asOf: normalizedAsOf,
      periodFrom,
      workspace,
      taxSettings: settingsRows?.[0] || { workspace_id: wid, tax_enabled: false, taxpayer_type: 'unspecified', e_invoice_enabled: false },
      taxRules: rules || [],
      taxProfiles: profiles || [],
      inventoryItems: items || [],
      fiscalPeriods: periods || [],
      invoices: invoices || [],
      invoiceLines: invoiceLines || []
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
        submissionSupported: false
      })
    });
  }

  return Object.freeze({ activeWorkspace, load });
}
