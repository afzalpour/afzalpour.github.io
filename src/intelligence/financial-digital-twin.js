'use strict';

import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../core/money/canonical-money.js';

const BPS_DENOMINATOR = 10000n;

function toTenths(value, field) {
  const parsed = canonicalDecimalToTenths(String(value ?? '0'));
  if (parsed === null) throw new Error(`DIGITAL_TWIN_INVALID_MONEY:${field}`);
  return parsed;
}

function nonNegativeTenths(value, field) {
  const parsed = toTenths(value, field);
  if (parsed < 0n) throw new Error(`DIGITAL_TWIN_NEGATIVE_FLOW:${field}`);
  return parsed;
}

function decimal(tenths) {
  const result = canonicalTenthsToDecimal(tenths);
  if (result === null) throw new Error('DIGITAL_TWIN_MONEY_SERIALIZE_FAILED');
  return result;
}

function normalizeBps(value, field) {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number)) throw new Error(`DIGITAL_TWIN_INVALID_BPS:${field}`);
  if (number < -10000) throw new Error(`DIGITAL_TWIN_NEGATIVE_SCALE:${field}`);
  return BigInt(number);
}

function roundRatioWithDisclosure(numerator, denominator = BPS_DENOMINATOR) {
  if (denominator <= 0n) throw new Error('DIGITAL_TWIN_INVALID_DENOMINATOR');
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  let quotient = absolute / denominator;
  const remainder = absolute % denominator;
  if (remainder * 2n >= denominator) quotient += 1n;
  return {
    value: negative ? -quotient : quotient,
    rounded: remainder !== 0n,
    remainder,
    denominator
  };
}

function scaleByChangeBps(baseTenths, changeBps, field, disclosures) {
  const factor = BPS_DENOMINATOR + changeBps;
  if (factor < 0n) throw new Error(`DIGITAL_TWIN_NEGATIVE_SCALE:${field}`);
  const result = roundRatioWithDisclosure(baseTenths * factor);

  if (result.rounded) {
    disclosures.push(Object.freeze({
      field,
      rule: 'nearest-rial-half-away-from-zero',
      sourceTenths: baseTenths.toString(),
      factorBps: factor.toString(),
      remainderNumerator: result.remainder.toString(),
      denominator: result.denominator.toString()
    }));
  }

  return result.value;
}

function freezeMoneyView(values) {
  return Object.freeze(Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, decimal(value)])
  ));
}

function normalizeHorizon(horizon = {}) {
  const from = String(horizon.from || '').slice(0, 10);
  const to = String(horizon.to || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    throw new Error('DIGITAL_TWIN_HORIZON_INVALID');
  }
  return Object.freeze({ from, to });
}

function normalizeProvenance(provenance = {}) {
  const output = {};
  for (const [field, refs] of Object.entries(provenance || {})) {
    output[field] = Object.freeze((Array.isArray(refs) ? refs : [])
      .filter(ref => ref && ref.type && ref.id)
      .map(ref => Object.freeze({ type: String(ref.type), id: String(ref.id) })));
  }
  return Object.freeze(output);
}

export function buildFinancialDigitalTwinScenario({
  horizon,
  baseline = {},
  assumptions = {},
  provenance = {}
} = {}) {
  const normalizedHorizon = normalizeHorizon(horizon);

  const openingCash = toTenths(baseline.openingCash, 'openingCash');
  const revenue = nonNegativeTenths(baseline.revenue, 'revenue');
  const collections = nonNegativeTenths(baseline.collections, 'collections');
  const operatingCosts = nonNegativeTenths(baseline.operatingCosts, 'operatingCosts');
  const payments = nonNegativeTenths(baseline.payments, 'payments');

  const revenueChangeBps = normalizeBps(assumptions.revenueChangeBps, 'revenueChangeBps');
  const collectionChangeBps = normalizeBps(assumptions.collectionChangeBps, 'collectionChangeBps');
  const operatingCostChangeBps = normalizeBps(assumptions.operatingCostChangeBps, 'operatingCostChangeBps');
  const paymentChangeBps = normalizeBps(assumptions.paymentChangeBps, 'paymentChangeBps');
  const oneOffCashImpact = toTenths(assumptions.oneOffCashImpact ?? '0', 'oneOffCashImpact');

  const baseEndingCash = openingCash + revenue + collections - operatingCosts - payments;
  const disclosures = [];

  const scenarioRevenue = scaleByChangeBps(revenue, revenueChangeBps, 'revenue', disclosures);
  const scenarioCollections = scaleByChangeBps(collections, collectionChangeBps, 'collections', disclosures);
  const scenarioOperatingCosts = scaleByChangeBps(operatingCosts, operatingCostChangeBps, 'operatingCosts', disclosures);
  const scenarioPayments = scaleByChangeBps(payments, paymentChangeBps, 'payments', disclosures);
  const scenarioEndingCash = openingCash + scenarioRevenue + scenarioCollections
    - scenarioOperatingCosts - scenarioPayments + oneOffCashImpact;
  const deltaEndingCash = scenarioEndingCash - baseEndingCash;

  const base = freezeMoneyView({
    openingCash,
    revenue,
    collections,
    operatingCosts,
    payments,
    endingCash: baseEndingCash
  });

  const scenario = freezeMoneyView({
    openingCash,
    revenue: scenarioRevenue,
    collections: scenarioCollections,
    operatingCosts: scenarioOperatingCosts,
    payments: scenarioPayments,
    oneOffCashImpact,
    endingCash: scenarioEndingCash,
    deltaEndingCash
  });

  return Object.freeze({
    architecture: 'avan-financial-digital-twin-v1',
    horizon: normalizedHorizon,
    base,
    scenario,
    liquidity: Object.freeze({
      baseStatus: baseEndingCash < 0n ? 'stressed' : 'non_negative',
      scenarioStatus: scenarioEndingCash < 0n ? 'stressed' : 'non_negative',
      worsened: scenarioEndingCash < baseEndingCash
    }),
    assumptions: Object.freeze({
      revenueChangeBps: Number(revenueChangeBps),
      collectionChangeBps: Number(collectionChangeBps),
      operatingCostChangeBps: Number(operatingCostChangeBps),
      paymentChangeBps: Number(paymentChangeBps),
      oneOffCashImpact: decimal(oneOffCashImpact)
    }),
    precision: Object.freeze({
      canonical: '0.1-toman-one-rial',
      roundingIsDisclosed: true,
      roundingRule: 'nearest-rial-half-away-from-zero',
      disclosures: Object.freeze(disclosures)
    }),
    provenance: normalizeProvenance(provenance),
    contracts: Object.freeze({
      actualLedgerMutation: false,
      persistenceRequired: false,
      deterministic: true,
      aiArithmetic: false,
      actualScenarioSeparation: true
    })
  });
}
