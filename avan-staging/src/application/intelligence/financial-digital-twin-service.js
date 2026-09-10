'use strict';

import { buildFinancialDigitalTwinScenario } from '../../intelligence/financial-digital-twin.js';

function isoDate(value, code) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(code);
  return text;
}

function previousIsoDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error('DIGITAL_TWIN_HORIZON_INVALID');
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function normalizeHorizon({ from, to } = {}) {
  const normalizedFrom = isoDate(from, 'DIGITAL_TWIN_FROM_REQUIRED');
  const normalizedTo = isoDate(to, 'DIGITAL_TWIN_TO_REQUIRED');
  if (normalizedFrom > normalizedTo) throw new Error('DIGITAL_TWIN_HORIZON_INVALID');
  return Object.freeze({ from: normalizedFrom, to: normalizedTo });
}

function userInputRef(id) {
  return Object.freeze({ type: 'user_input', id });
}

function freezeOpening(source, asOf) {
  const cash = source?.snapshot?.metrics?.cash;
  if (!cash || cash.value === null || cash.value === undefined) {
    throw new Error('DIGITAL_TWIN_OPENING_CASH_UNAVAILABLE');
  }
  return Object.freeze({
    asOf,
    cash: String(cash.value),
    label: String(cash.label || 'موقعیت نقد و بانک'),
    explanation: String(cash.explanation || ''),
    evidence: Object.freeze([...(cash.evidence || [])])
  });
}

export function createFinancialDigitalTwinService({
  controlTowerService,
  buildScenario = buildFinancialDigitalTwinScenario
} = {}) {
  if (!controlTowerService?.load || typeof buildScenario !== 'function') {
    throw new Error('DIGITAL_TWIN_DEPENDENCY_MISSING');
  }

  async function prepare({ from, to } = {}) {
    const horizon = normalizeHorizon({ from, to });
    const openingAsOf = previousIsoDate(horizon.from);
    const source = await controlTowerService.load({ asOf: openingAsOf });
    if (!source?.workspace?.id) throw new Error('COMPANY_REQUIRED');

    return Object.freeze({
      workspace: Object.freeze({ ...source.workspace }),
      horizon,
      opening: freezeOpening(source, openingAsOf),
      contracts: Object.freeze({
        companyScoped: true,
        rlsRequired: true,
        openingCashFromActualLedger: true,
        futureFlowsAreUserInputs: true,
        persistence: 'none',
        writeOperations: 0
      })
    });
  }

  function run({ prepared, baseline = {}, assumptions = {} } = {}) {
    if (!prepared?.workspace?.id || !prepared?.opening?.cash || !prepared?.horizon) {
      throw new Error('DIGITAL_TWIN_PREPARE_REQUIRED');
    }

    const scenario = buildScenario({
      horizon: prepared.horizon,
      baseline: {
        openingCash: prepared.opening.cash,
        revenue: baseline.revenue ?? '0',
        collections: baseline.collections ?? '0',
        operatingCosts: baseline.operatingCosts ?? '0',
        payments: baseline.payments ?? '0'
      },
      assumptions: {
        revenueChangeBps: assumptions.revenueChangeBps ?? 0,
        collectionChangeBps: assumptions.collectionChangeBps ?? 0,
        operatingCostChangeBps: assumptions.operatingCostChangeBps ?? 0,
        paymentChangeBps: assumptions.paymentChangeBps ?? 0,
        oneOffCashImpact: assumptions.oneOffCashImpact ?? '0'
      },
      provenance: {
        openingCash: prepared.opening.evidence,
        revenue: [userInputRef('baseline.cash_sales')],
        collections: [userInputRef('baseline.receivables_collection')],
        operatingCosts: [userInputRef('baseline.operating_cash_costs')],
        payments: [userInputRef('baseline.payables_payment')],
        oneOffCashImpact: [userInputRef('scenario.one_off_cash_impact')]
      }
    });

    return Object.freeze({
      workspace: prepared.workspace,
      opening: prepared.opening,
      scenario,
      contracts: Object.freeze({
        actualLedgerMutation: false,
        scenarioPersistence: false,
        aiGeneratedAmounts: false,
        userControlsFutureFlows: true,
        writeOperations: 0
      })
    });
  }

  async function evaluate({ from, to, baseline = {}, assumptions = {} } = {}) {
    const prepared = await prepare({ from, to });
    return run({ prepared, baseline, assumptions });
  }

  return Object.freeze({ prepare, run, evaluate });
}
