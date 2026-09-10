'use strict';

import { createTaxService } from '../tax/tax-service.js';
import { normalizeElectronicInvoice } from '../../domains/einvoice/einvoice-contract.js';
import { prevalidateElectronicInvoice } from '../../domains/einvoice/prevalidation.js';
import { ProviderNeutralAdapter } from '../../domains/einvoice/adapter-contract.js';

export function createElectronicInvoiceService(client) {
  if (!client?.companyContext || !client?.select) throw new Error('EINVOICE_SERVICE_CLIENT_REQUIRED');
  const Tax = createTaxService(client);

  async function loadInvoiceContext(invoiceId) {
    if (!invoiceId) throw new Error('EINVOICE_INVOICE_ID_REQUIRED');
    const tax = await Tax.load();
    const wid = tax.company.id;
    const invoices = await client.select(
      'invoices',
      `select=id,workspace_id,fiscal_year_id,invoice_no,invoice_type,invoice_date,due_date,party_id,description,subtotal_amount,tax_total,total_amount,status,journal_entry_id&workspace_id=eq.${wid}&id=eq.${invoiceId}&limit=1`
    );
    const invoice = invoices?.[0];
    if (!invoice) throw new Error('EINVOICE_INVOICE_NOT_FOUND');

    const [lines, parties] = await Promise.all([
      client.select(
        'invoice_lines',
        `select=id,line_no,account_id,item_id,description,quantity,unit_price,discount,line_total,tax_profile_id,tax_rule_version_id,tax_rate,taxable_amount,tax_amount,tax_treatment,tax_profile_code,tax_profile_name_fa&workspace_id=eq.${wid}&invoice_id=eq.${invoiceId}&order=line_no.asc`
      ),
      invoice.party_id
        ? client.select(
            'parties',
            `select=id,name,kind,national_id,economic_code,postal_code&workspace_id=eq.${wid}&id=eq.${invoice.party_id}&limit=1`
          )
        : Promise.resolve([])
    ]);

    const itemsById = new Map((tax.items || []).map(item => [item.id, item]));
    const model = normalizeElectronicInvoice({
      company: tax.company,
      taxSettings: tax.settings,
      invoice,
      party: parties?.[0] || null,
      lines: lines || [],
      itemsById
    });
    return Object.freeze({ tax, invoice, lines: Object.freeze(lines || []), party: parties?.[0] || null, model });
  }

  async function prevalidate(invoiceId) {
    const context = await loadInvoiceContext(invoiceId);
    const validation = prevalidateElectronicInvoice(context.model);
    const adapterPayload = ProviderNeutralAdapter.buildPayload(context.model);
    return Object.freeze({
      model: context.model,
      validation,
      adapter: Object.freeze({
        id: ProviderNeutralAdapter.id,
        version: ProviderNeutralAdapter.version,
        supports_submission: ProviderNeutralAdapter.supports_submission
      }),
      adapter_payload: adapterPayload
    });
  }

  return Object.freeze({
    loadInvoiceContext,
    prevalidate,
    adapter: ProviderNeutralAdapter
  });
}
