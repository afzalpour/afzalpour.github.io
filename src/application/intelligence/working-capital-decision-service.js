'use strict';

import { buildWorkingCapitalDecisions } from '../../intelligence/working-capital-decisions.js';

export function createWorkingCapitalDecisionService({ workingCapitalService, buildDecisions = buildWorkingCapitalDecisions } = {}) {
  if (!workingCapitalService?.load || typeof buildDecisions !== 'function') {
    throw new Error('WORKING_CAPITAL_DECISION_DEPENDENCY_MISSING');
  }

  async function load({ asOf } = {}) {
    const base = await workingCapitalService.load({ asOf });
    const decisions = buildDecisions(base.snapshot);

    return Object.freeze({
      workspace: base.workspace,
      snapshot: base.snapshot,
      decisions,
      contracts: Object.freeze({
        ...base.contracts,
        deterministicRecommendations: true,
        evidenceRequired: true,
        humanConfirmationRequired: true,
        writeOperations: 0,
        autonomousMessage: false,
        autonomousCollection: false,
        autonomousPayment: false,
        actualLedgerMutation: false
      })
    });
  }

  return Object.freeze({ load });
}
