'use strict';

export const ADAPTER_SUBMISSION_DISABLED = 'EINVOICE_SUBMISSION_NOT_AVAILABLE_IN_RC15D';

export function normalizeAdapterResult(result = {}) {
  return Object.freeze({
    ok: Boolean(result.ok),
    provider: String(result.provider || 'unknown'),
    provider_version: result.provider_version ? String(result.provider_version) : null,
    reference: result.reference ? String(result.reference) : null,
    status: result.status ? String(result.status) : null,
    errors: Object.freeze([...(result.errors || [])])
  });
}

export function createElectronicInvoiceAdapterContract({
  id,
  version,
  preflight,
  buildPayload
} = {}) {
  if (!id || typeof preflight !== 'function' || typeof buildPayload !== 'function') {
    throw new Error('EINVOICE_ADAPTER_CONTRACT_INVALID');
  }

  return Object.freeze({
    id: String(id),
    version: String(version || 'unversioned'),
    preflight,
    buildPayload,
    supports_submission: false,
    async submit() {
      const error = new Error(ADAPTER_SUBMISSION_DISABLED);
      error.code = ADAPTER_SUBMISSION_DISABLED;
      throw error;
    }
  });
}

export const ProviderNeutralAdapter = createElectronicInvoiceAdapterContract({
  id: 'avan-provider-neutral-preflight',
  version: '1',
  preflight: normalizedInvoice => normalizedInvoice,
  buildPayload: normalizedInvoice => Object.freeze({
    schema_version: normalizedInvoice?.schema_version || null,
    provider: 'provider-neutral',
    submission_disabled: true,
    invoice: normalizedInvoice || null
  })
});
