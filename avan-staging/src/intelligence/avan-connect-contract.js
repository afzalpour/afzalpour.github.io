'use strict';

export const AVAN_CONNECT_ARCHITECTURE = Object.freeze({
  id: 'avan-connect-automation-marketplace-v1',
  writeOperations: 0,
  actualLedgerMutation: false,
  workflowExecution: false,
  connectionMutation: false,
  humanApprovalDefault: true,
  idempotencyRequired: true,
  auditTrailRequired: true
});

export const AVAN_CONNECT_EXECUTION_CONTRACT = Object.freeze({
  idempotency: Object.freeze({
    generatedServerSide: true,
    components: Object.freeze(['workspace_id','connector_key','source_reference','payload_hash']),
    uniqueWithinWorkspace: true
  }),
  audit: Object.freeze({
    appendOnlyExecutionEvents: true,
    actorRequiredForSensitiveAction: true,
    sourceReferenceRequired: true
  }),
  approval: Object.freeze({
    financialWrite: 'required',
    posting: 'required',
    payment: 'required',
    externalSubmission: 'required'
  })
});
