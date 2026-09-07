'use strict';

export function createTaxService(client) {
  if (!client?.companyContext || !client?.select || !client?.rpc) {
    throw new Error('TAX_SERVICE_CLIENT_REQUIRED');
  }

  let cache = null;

  async function activeCompany() {
    const state = await client.companyContext.ensure();
    if (state?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
    const company = state?.active_company;
    if (!company?.id) throw new Error('COMPANY_REQUIRED');
    return company;
  }

  async function load(force = false) {
    const company = await activeCompany();
    if (!force && cache?.company?.id === company.id) return cache;
    const wid = company.id;

    const [settings, profiles, rules, items, years, role] = await Promise.all([
      client.select('workspace_tax_settings', `select=*&workspace_id=eq.${wid}&limit=1`),
      client.select('tax_profiles', `select=id,code,name_fa,treatment,rate,applies_to,rule_version_id,is_active&workspace_id=eq.${wid}&order=code.asc`),
      client.select('tax_rule_versions', 'select=id,name_fa,effective_from,effective_to,standard_vat_rate,status,source_title,source_reference&status=eq.active&order=effective_from.desc'),
      client.select('inventory_items', `select=id,sku,name,item_type,tax_profile_id,is_active&workspace_id=eq.${wid}&order=name.asc`),
      client.select('fiscal_years', `select=id,name,date_from,date_to,status&workspace_id=eq.${wid}&order=date_from.desc`),
      client.rpc('workspace_role', { wid })
    ]);

    cache = Object.freeze({
      company,
      settings: settings?.[0] || {
        workspace_id: wid,
        tax_enabled: false,
        taxpayer_type: 'unspecified'
      },
      profiles: Object.freeze([...(profiles || [])]),
      rules: Object.freeze([...(rules || [])]),
      items: Object.freeze([...(items || [])]),
      years: Object.freeze([...(years || [])]),
      role
    });
    return cache;
  }

  function invalidate() {
    cache = null;
  }

  async function saveWorkspaceSettings({
    workspaceId,
    taxEnabled,
    taxpayerType,
    taxIdentifier,
    economicCode,
    taxpayerMemoryId
  }) {
    const result = await client.rpc('set_workspace_tax_settings', {
      wid: workspaceId,
      p_tax_enabled: Boolean(taxEnabled),
      p_taxpayer_type: taxpayerType || 'unspecified',
      p_tax_identifier: taxIdentifier || null,
      p_economic_code: economicCode || null,
      p_taxpayer_memory_id: taxpayerMemoryId || null
    });
    invalidate();
    return result;
  }

  async function invoiceLineTaxProfiles(invoiceId, workspaceId) {
    if (!invoiceId) return [];
    return client.select(
      'invoice_lines',
      `select=line_no,tax_profile_id&invoice_id=eq.${invoiceId}&workspace_id=eq.${workspaceId}&order=line_no.asc`
    );
  }

  async function invoiceTaxDetail(invoiceId, workspaceId) {
    const [invoices, lines] = await Promise.all([
      client.select(
        'invoices',
        `select=id,invoice_no,subtotal_amount,tax_total,total_amount&workspace_id=eq.${workspaceId}&id=eq.${invoiceId}&limit=1`
      ),
      client.select(
        'invoice_lines',
        `select=line_no,tax_profile_id,tax_profile_name_fa,tax_treatment,tax_rate,taxable_amount,tax_amount&workspace_id=eq.${workspaceId}&invoice_id=eq.${invoiceId}&order=line_no.asc`
      )
    ]);
    return Object.freeze({ invoice: invoices?.[0] || null, lines: lines || [] });
  }

  async function vatTransactions(workspaceId, from, to) {
    return await client.rpc('report_vat_transactions', {
      wid: workspaceId,
      dfrom: from,
      dto: to
    }) || [];
  }

  return Object.freeze({
    activeCompany,
    load,
    invalidate,
    saveWorkspaceSettings,
    invoiceLineTaxProfiles,
    invoiceTaxDetail,
    vatTransactions
  });
}
