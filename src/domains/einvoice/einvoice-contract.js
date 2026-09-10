'use strict';

export const EINVOICE_SCHEMA_VERSION = 'avan.einvoice.preflight.v1';
export const EINVOICE_DIRECTION_OUTGOING = 'outgoing';
export const EINVOICE_PROVIDER_NEUTRAL = 'provider-neutral';

const text = value => String(value ?? '').trim();
const nullableText = value => text(value) || null;

function freezeArray(rows) {
  return Object.freeze((rows || []).map(row => Object.freeze({ ...row })));
}

export function normalizeElectronicInvoice({ company, taxSettings, invoice, party, lines, itemsById = new Map() }) {
  if (!company?.id) throw new Error('EINVOICE_COMPANY_REQUIRED');
  if (!invoice?.id) throw new Error('EINVOICE_INVOICE_REQUIRED');

  const normalizedLines = (lines || []).map((line, index) => {
    const item = line.item_id ? itemsById.get(line.item_id) : null;
    return {
      line_no: Number(line.line_no ?? index + 1),
      item_id: line.item_id || null,
      sku: nullableText(item?.sku),
      item_name: nullableText(item?.name) || nullableText(line.description),
      official_goods_service_id: nullableText(item?.official_goods_service_id),
      description: nullableText(line.description),
      quantity: text(line.quantity),
      unit_price: text(line.unit_price),
      discount: text(line.discount || '0'),
      line_total: text(line.line_total),
      tax_profile_id: line.tax_profile_id || null,
      tax_rule_version_id: line.tax_rule_version_id || null,
      tax_profile_code: nullableText(line.tax_profile_code),
      tax_profile_name_fa: nullableText(line.tax_profile_name_fa),
      tax_treatment: nullableText(line.tax_treatment),
      tax_rate: text(line.tax_rate ?? ''),
      taxable_amount: text(line.taxable_amount ?? ''),
      tax_amount: text(line.tax_amount ?? '')
    };
  });

  return Object.freeze({
    schema_version: EINVOICE_SCHEMA_VERSION,
    direction: EINVOICE_DIRECTION_OUTGOING,
    provider: EINVOICE_PROVIDER_NEUTRAL,
    generated_at: new Date().toISOString(),
    workspace: Object.freeze({
      id: company.id,
      name: nullableText(company.name)
    }),
    seller: Object.freeze({
      taxpayer_type: nullableText(taxSettings?.taxpayer_type),
      tax_identifier: nullableText(taxSettings?.tax_identifier),
      economic_code: nullableText(taxSettings?.economic_code),
      taxpayer_memory_id: nullableText(taxSettings?.taxpayer_memory_id),
      tax_enabled: Boolean(taxSettings?.tax_enabled),
      e_invoice_enabled: Boolean(taxSettings?.e_invoice_enabled)
    }),
    buyer: Object.freeze({
      party_id: party?.id || null,
      name: nullableText(party?.name),
      national_id: nullableText(party?.national_id),
      economic_code: nullableText(party?.economic_code),
      postal_code: nullableText(party?.postal_code)
    }),
    invoice: Object.freeze({
      id: invoice.id,
      number: invoice.invoice_no === null || invoice.invoice_no === undefined ? null : String(invoice.invoice_no),
      type: nullableText(invoice.invoice_type),
      date: nullableText(invoice.invoice_date),
      due_date: nullableText(invoice.due_date),
      status: nullableText(invoice.status),
      description: nullableText(invoice.description),
      journal_entry_id: invoice.journal_entry_id || null,
      subtotal_amount: text(invoice.subtotal_amount ?? ''),
      tax_total: text(invoice.tax_total ?? ''),
      total_amount: text(invoice.total_amount ?? '')
    }),
    lines: freezeArray(normalizedLines)
  });
}
