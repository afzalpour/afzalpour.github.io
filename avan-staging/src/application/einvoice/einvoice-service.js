'use strict';

import { validateEInvoiceCandidate } from '../../domains/einvoice/prevalidation.js';
import IRAN_TAXPAYER_2026_07 from '../../domains/einvoice/adapters/iran-taxpayer-2026-07.js';

export function createEInvoiceService(client) {
  if (!client?.companyContext || !client?.select || !client?.rpc) {
    throw new Error('EINVOICE_SERVICE_CLIENT_REQUIRED');
  }

  async function activeCompany() {
    const state = await client.companyContext.ensure();
    if (state?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
    const company = state?.active_company;
    if (!company?.id) throw new Error('COMPANY_REQUIRED');
    return company;
  }

  async function candidate(invoiceId) {
    const company = await activeCompany();
    const wid = company.id;
    const invoices = await client.select(
      'invoices',
      `select=id,invoice_no,invoice_type,invoice_date,status,party_id,subtotal_amount,tax_total,total_amount&workspace_id=eq.${wid}&id=eq.${invoiceId}&limit=1`
    );
    const invoice = invoices?.[0] || null;
    if (!invoice) return Object.freeze({ company, invoice: null, settings: {}, buyer: {}, lines: [] });

    const [settingsRows, partyRows, lineRows] = await Promise.all([
      client.select('workspace_tax_settings', `select=tax_enabled,tax_identifier,economic_code,taxpayer_memory_id,e_invoice_enabled&workspace_id=eq.${wid}&limit=1`),
      client.select('parties', `select=id,name,national_id,economic_code,postal_code&workspace_id=eq.${wid}&id=eq.${invoice.party_id}&limit=1`),
      client.select(
        'invoice_lines',
        `select=line_no,item_id,quantity,unit_price,discount,line_total,tax_rule_version_id,tax_profile_code,tax_treatment,tax_rate,taxable_amount,tax_amount&workspace_id=eq.${wid}&invoice_id=eq.${invoice.id}&order=line_no.asc`
      )
    ]);

    const itemIds = [...new Set((lineRows || []).map(line => line.item_id).filter(Boolean))];
    let items = [];
    if (itemIds.length) {
      items = await client.select(
        'inventory_items',
        `select=id,sku,name,official_goods_service_id&workspace_id=eq.${wid}&id=in.(${itemIds.join(',')})`
      );
    }
    const itemMap = new Map((items || []).map(item => [item.id, item]));
    const lines = (lineRows || []).map(line => ({ ...line, ...(itemMap.get(line.item_id) || {}) }));

    return Object.freeze({
      company,
      invoice,
      settings: settingsRows?.[0] || {},
      buyer: partyRows?.[0] || {},
      lines: Object.freeze(lines)
    });
  }

  async function prevalidate(invoiceId, options = {}, manifest = IRAN_TAXPAYER_2026_07) {
    const data = await candidate(invoiceId);
    const result = validateEInvoiceCandidate(data, manifest, options);
    return Object.freeze({ data, manifest, result });
  }

  async function recordPrecheck(invoiceId, precheck) {
    const normalized = precheck?.result?.normalized || {};
    return client.rpc('save_e_invoice_precheck', {
      iid: invoiceId,
      p_adapter_key: normalized.adapter_key || IRAN_TAXPAYER_2026_07.key,
      p_adapter_version: normalized.adapter_version || IRAN_TAXPAYER_2026_07.adapterVersion,
      p_spec_version: normalized.spec_version || IRAN_TAXPAYER_2026_07.reportedSpecVersion,
      p_subject: normalized.subject || 'original',
      p_pattern: normalized.pattern || 'general',
      p_send_rule: normalized.send_rule || null,
      p_note1: normalized.note1 || null,
      p_note2: normalized.note2 || null,
      p_validation_result: precheck?.result || { ok: false, errors: [], warnings: [] }
    });
  }

  async function history(invoiceId) {
    return await client.rpc('list_e_invoice_prechecks', { iid: invoiceId }) || [];
  }

  function send() {
    throw new Error('EINVOICE_TRANSPORT_DISABLED');
  }

  return Object.freeze({
    manifest: IRAN_TAXPAYER_2026_07,
    activeCompany,
    candidate,
    prevalidate,
    recordPrecheck,
    history,
    send
  });
}
