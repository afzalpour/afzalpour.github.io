'use strict';

/**
 * Versioned e-invoice capability manifest.
 *
 * This is deliberately NOT a transport implementation. It freezes only the
 * validation/field contract Avan understands for the July 1405 generation of
 * the Iranian taxpayer-system invoice instructions. Network endpoints,
 * credentials and private signing material are intentionally absent.
 *
 * The currently reported instruction revision is 7.9. Before any real
 * submission transport is enabled, the official Tax Administration source
 * must be re-verified and a new adapter version added if the contract changed.
 */
export const IRAN_TAXPAYER_2026_07 = Object.freeze({
  key: 'iran-taxpayer',
  adapterVersion: '2026-07',
  reportedSpecVersion: '7.9',
  sourceStatus: 'reported-mirror-needs-official-recheck-before-transport',
  supportedInvoiceTypes: Object.freeze(['sale']),
  supportedStatuses: Object.freeze(['posted']),
  supportedSubjects: Object.freeze(['original']),
  supportedPatterns: Object.freeze(['general']),
  fields: Object.freeze({
    note1MaxLength: 30,
    note2MaxLength: 30,
    sendRuleMaxLength: 64,
    goodsServiceIdMaxLength: 64
  }),
  requirements: Object.freeze({
    taxpayerMemoryId: true,
    sellerEconomicOrTaxId: true,
    buyerIdentityForGeneralPattern: true,
    officialGoodsServiceIdPerLine: true,
    taxSnapshotPerLine: true,
    deterministicTotals: true
  }),
  transport: Object.freeze({
    enabled: false,
    reason: 'REAL_SUBMISSION_TRANSPORT_NOT_IMPLEMENTED'
  })
});

export default IRAN_TAXPAYER_2026_07;
